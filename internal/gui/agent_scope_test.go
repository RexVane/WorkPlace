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

// An agent's routing sheet: every routing group the catalog has, and which
// of them that agent may go through. Routing groups are off until one is
// switched on for the agent, so the models of a group join its list only
// then — and a switch is that agent's alone.
func TestAgentScopeAPI(t *testing.T) {
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
	if err := provider.SaveGroup(provider.Group{ID: "slow", Name: "Slow", Members: []string{"relay/m2"}}); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	agentScopeAPI(mux)
	agentModelsAPI(mux)
	type answer struct {
		Scope struct {
			Agent string
			Names []string
			All   []provider.ScopeName
		}
		Used struct {
			Shown, Catalog, Names int
		}
		Models []agentModelJSON
		Count  *modelCountJSON
	}
	call := func(method, id, body string) answer {
		t.Helper()
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(method, "/api/agent-scope/"+id, strings.NewReader(body)))
		if w.Code != 200 {
			t.Fatalf("%s %s %d %s", method, id, w.Code, w.Body)
		}
		var out answer
		json.Unmarshal(w.Body.Bytes(), &out)
		return out
	}
	groups := func(ss []provider.ScopeName) []string {
		var out []string
		for _, s := range ss {
			if s.Kind == provider.ScopeGroup {
				out = append(out, s.Name)
			}
		}
		return out
	}

	// nothing switched on: both groups are offered (each with the tag it
	// goes by too), the agent's list holds its provider's models alone. The
	// GET carries the sheet; the list comes with a switch's answer
	got := call("GET", "codex", "")
	if got.Scope.Agent != "codex" || len(got.Scope.Names) != 0 {
		t.Fatalf("an agent with no groups: %+v", got.Scope)
	}
	offered := groups(got.Scope.All)
	if !slices.Contains(offered, "group/fast") || !slices.Contains(offered, "group/slow") {
		t.Fatalf("the groups offered: %v", offered)
	}
	if got.Used.Names != 0 || got.Used.Shown != 2 {
		t.Fatalf("before any switch: %+v", got.Used)
	}
	if shown, _ := provider.CatalogFor("codex"); slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group != "" }) {
		t.Fatalf("a group is in the list with nothing switched on: %v", shown)
	}

	// one switched on: it and its models join the agent's list
	got = call("POST", "codex", `{"id":"group/fast","on":true}`)
	if !slices.Equal(got.Scope.Names, []string{"group/fast"}) || got.Used.Names != 1 {
		t.Fatalf("the sheet after a switch: %+v", got.Scope)
	}
	if ids := modelIDs(got.Models); !slices.Contains(ids, "group/fast") {
		t.Fatalf("the group did not join the list: %v", ids)
	}
	if !slices.Equal(settings.Load().GroupsOn["codex"], []string{"group/fast"}) {
		t.Fatalf("saved %v", settings.Load().GroupsOn)
	}
	// the switch is this agent's alone
	if err := provider.SetGroupOn("claude", "group/slow", true); err != nil {
		t.Fatal(err)
	}
	if got := call("GET", "codex", ""); !slices.Equal(got.Scope.Names, []string{"group/fast"}) {
		t.Fatalf("another agent's switch changed this one: %v", got.Scope.Names)
	}
	if shown, _ := provider.CatalogFor("codex"); slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group == "slow" }) {
		t.Fatalf("codex has a group it never switched on: %v", shown)
	}
	if shown, _ := provider.CatalogFor("claude"); !slices.ContainsFunc(shown, func(e provider.Entry) bool { return e.Group == "slow" }) {
		t.Fatalf("claude lost the group it switched on: %v", shown)
	}

	// both on, then one off again
	call("POST", "codex", `{"id":"group/slow","on":true}`)
	if got := call("GET", "codex", ""); len(got.Scope.Names) != 2 {
		t.Fatalf("both on: %v", got.Scope.Names)
	}
	got = call("POST", "codex", `{"id":"group/fast","on":false}`)
	if !slices.Equal(got.Scope.Names, []string{"group/slow"}) {
		t.Fatalf("one off: %v", got.Scope.Names)
	}
	if ids := modelIDs(got.Models); slices.Contains(ids, "group/fast") {
		t.Fatalf("a switched-off group is still in the list: %v", ids)
	}
	// while a request naming it is still served (Resolve answers the group's
	// first member), so an agent already on it keeps working
	if _, _, ok := provider.Resolve("group/fast"); !ok {
		t.Fatalf("a switched-off group is no longer served")
	}

	// an agent magpie doesn't know is refused
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/agent-scope/nobody", nil))
	if w.Code == 200 {
		t.Fatalf("an unknown agent: %d %s", w.Code, w.Body)
	}
}

func modelIDs(ms []agentModelJSON) []string {
	out := []string{}
	for _, m := range ms {
		out = append(out, m.ID)
	}
	return out
}