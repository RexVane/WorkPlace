package gui

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/yetone/magpie/internal/provider"
	"github.com/yetone/magpie/internal/settings"
)

// 「Turn routing groups off everywhere」: every agent goes on its own
// provider's models and on none of the catalog's routing groups. The answer
// is how many agents had one switched on.
func TestRoutingGroupsOffEverywhere(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(home, ".cache"))
	t.Setenv("CODEX_HOME", filepath.Join(home, ".codex"))
	os.MkdirAll(filepath.Join(home, ".codex"), 0o755)
	os.WriteFile(filepath.Join(home, ".codex", "config.toml"), []byte("model = \"magpie/relay/m1\"\n"), 0o600)
	if err := provider.Save(provider.Provider{ID: "relay", Name: "Relay", Key: "k", Chat: "http://127.0.0.1:1/v1", Models: []string{"m1", "m2"}}); err != nil {
		t.Fatal(err)
	}
	if err := provider.SaveGroup(provider.Group{ID: "fast", Name: "Fast", Members: []string{"relay/m1"}}); err != nil {
		t.Fatal(err)
	}
	if err := provider.SetGroupOn("codex", "group/fast", true); err != nil {
		t.Fatal(err)
	}
	if err := provider.SetGroupOn("claude", "group/fast", true); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	agentScopeAPI(mux)
	post := func() int {
		t.Helper()
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/agents/routing-groups-off", strings.NewReader("{}")))
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
		var out struct {
			Changed int `json:"changed"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out.Changed
	}

	if n := post(); n != 2 {
		t.Fatalf("changed %d agents, want 2", n)
	}
	if len(settings.Load().GroupsOn) != 0 {
		t.Fatalf("groups are still on: %v", settings.Load().GroupsOn)
	}
	for _, id := range []string{"codex", "claude"} {
		shown, _ := provider.CatalogFor(id)
		if slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group != "" }) {
			t.Fatalf("%s is still shown a group: %v", id, shown)
		}
		// its own provider's models are untouched
		if !slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Model == "m1" }) {
			t.Fatalf("%s lost its provider's models: %v", id, shown)
		}
	}
	// the same again changes nothing
	if n := post(); n != 0 {
		t.Fatalf("the second press changed %d agents", n)
	}
	// and one switched on by hand afterwards is switched off again
	if err := provider.SetGroupOn("codex", "group/fast", true); err != nil {
		t.Fatal(err)
	}
	if n := post(); n != 1 {
		t.Fatalf("a group switched on by hand: %d agents changed, want 1", n)
	}
	if len(settings.Load().GroupsOn) != 0 {
		t.Fatalf("the group was kept: %v", settings.Load().GroupsOn)
	}
}