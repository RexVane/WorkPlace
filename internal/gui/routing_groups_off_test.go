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

// 「Turn routing groups off everywhere」: every agent is left its providers'
// own models and nothing of the catalog's routing groups, so an agent goes
// through a group only once the reader turns one on for it. An agent shown
// nothing but groups keeps them — with none left it would be shown
// nothing, and the connect that follows would refuse it.
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
	// an agent with nothing but the groups in its range: left as it is
	if err := provider.SetVisible("claude", []string{"group/fast"}); err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	agentScopeAPI(mux)
	post := func() (changed int, state struct {
		Agents []agentJSON `json:"agents"`
	}) {
		t.Helper()
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("POST", "/api/agents/routing-groups-off", strings.NewReader("{}")))
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
		var out struct {
			Changed int         `json:"changed"`
			Agents  []agentJSON `json:"agents"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out.Changed, struct {
			Agents []agentJSON `json:"agents"`
		}{out.Agents}
	}
	changed, _ := post()
	if changed == 0 {
		t.Fatal("no agent was narrowed")
	}
	vis := settings.Load().Visible
	if slices.ContainsFunc(vis["codex"], func(n string) bool { return strings.HasPrefix(n, provider.GroupPrefix) }) {
		t.Fatalf("codex keeps a routing group: %v", vis["codex"])
	}
	if !slices.Contains(vis["codex"], "relay") {
		t.Fatalf("codex lost its provider too: %v", vis["codex"])
	}
	if !slices.Equal(vis["claude"], []string{"group/fast"}) {
		t.Fatalf("an agent shown nothing but groups was narrowed: %v", vis["claude"])
	}
	// and the agents' own lists follow: codex has no group left in its
	// catalog, claude still has the one it lives on
	if shown, _ := provider.CatalogFor("codex"); slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group != "" }) {
		t.Fatalf("codex is still shown a group: %v", shown)
	}
	if shown, _ := provider.CatalogFor("claude"); !slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group == "fast" }) {
		t.Fatalf("claude lost the group it lives on: %v", shown)
	}

	// the same again changes nothing
	if n, _ := post(); n != 0 {
		t.Fatalf("the second press changed %d agents", n)
	}
	// and a range turned back on by hand is narrowed again
	if err := provider.SetVisible("codex", []string{"relay", "group/fast"}); err != nil {
		t.Fatal(err)
	}
	if n, _ := post(); n != 1 {
		t.Fatalf("a group turned on by hand: %d agents changed, want 1", n)
	}
	if slices.Contains(settings.Load().Visible["codex"], "group/fast") {
		t.Fatalf("the group was kept: %v", settings.Load().Visible["codex"])
	}
}
