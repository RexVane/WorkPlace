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

// The range sheet of an agent's model list: every name its lists may be
// narrowed to, the ones they are narrowed to, and how much of the catalog
// that keeps. Saving a narrower range takes the models it leaves out of the
// agent's list and its count; nothing at all puts the whole catalog back.
func TestAgentScopeAPI(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(home, ".cache"))
	t.Setenv("CODEX_HOME", filepath.Join(home, ".codex"))
	os.MkdirAll(filepath.Join(home, ".codex"), 0o755)
	// on a model of the provider the range is about to leave out, so that
	// provider's models are the ones missing from the list afterwards
	os.WriteFile(filepath.Join(home, ".codex", "config.toml"), []byte("model = \"magpie/other/m1\"\n"), 0o600)
	for _, p := range []provider.Provider{
		{ID: "relay", Name: "Relay", Key: "k", Chat: "http://127.0.0.1:1/v1", Models: []string{"m1", "m2"}},
		{ID: "other", Name: "Other", Key: "k", Chat: "http://127.0.0.1:1/v1", Models: []string{"m1"}},
	} {
		if err := provider.Save(p); err != nil {
			t.Fatal(err)
		}
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
	names := func(ss []provider.ScopeName) []string {
		var out []string
		for _, s := range ss {
			out = append(out, s.Name)
		}
		return out
	}

	// an agent no range names is shown the whole catalog
	got := call("GET", "codex", "")
	if got.Scope.Agent != "codex" || len(got.Scope.Names) != 0 {
		t.Fatalf("an agent with no range: %+v", got.Scope)
	}
	if got.Used.Names != 0 || got.Used.Catalog == 0 || got.Used.Shown != got.Used.Catalog {
		t.Fatalf("used %+v", got.Used)
	}
	if !slices.Contains(names(got.Scope.All), "relay") || !slices.Contains(names(got.Scope.All), "other") {
		t.Fatalf("the names offered: %v", names(got.Scope.All))
	}

	// narrowed to one provider: the other's models go from the list, and
	// from what the count line under the agent's name says
	got = call("POST", "codex", `{"names":["relay"]}`)
	if !slices.Equal(settings.Load().Visible["codex"], []string{"relay"}) {
		t.Fatalf("saved %v", settings.Load().Visible)
	}
	if !slices.Equal(got.Scope.Names, []string{"relay"}) || got.Used.Names != 1 {
		t.Fatalf("the range read back: %+v %+v", got.Scope, got.Used)
	}
	if ids := modelIDs(got.Models); slices.Contains(ids, "other/m1") || len(ids) != 2 {
		t.Fatalf("the list after narrowing: %v", ids)
	}
	if got.Count == nil || got.Count.Shown != len(got.Models) {
		t.Fatalf("the count line: %+v %v", got.Count, modelIDs(got.Models))
	}
	if got.Used.Shown != got.Count.Shown || got.Used.Catalog <= got.Used.Shown {
		t.Fatalf("used %+v, count %+v", got.Used, got.Count)
	}
	// every model the list still has is named by the provider the range
	// keeps, which is what the sheet ticks
	for _, m := range got.Models {
		if !slices.Contains(m.Candidates, "relay") {
			t.Fatalf("a model of the kept provider: %+v", m)
		}
	}

	// a model taken out of the agent's lists one by one is still the
	// agent's own, under its range
	if err := provider.SetHiddenModels("codex", []string{"relay/m2"}); err != nil {
		t.Fatal(err)
	}
	if got = call("GET", "codex", ""); got.Used.Shown != got.Used.Catalog-3 {
		t.Fatalf("a hidden model under a range: %+v", got.Used)
	}
	if err := provider.SetHiddenModels("codex", nil); err != nil {
		t.Fatal(err)
	}

	// nothing at all puts the whole catalog back and leaves no range
	got = call("POST", "codex", `{"names":[]}`)
	if _, ok := settings.Load().Visible["codex"]; ok {
		t.Fatal("an empty range was kept")
	}
	if len(got.Scope.Names) != 0 || got.Used.Shown != got.Used.Catalog {
		t.Fatalf("put back: %+v %+v", got.Scope, got.Used)
	}
	if ids := modelIDs(got.Models); !slices.Contains(ids, "other/m1") {
		t.Fatalf("the list after putting it back: %v", ids)
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
