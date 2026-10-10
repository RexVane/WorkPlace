package provider

import (
	"slices"
	"testing"

	"github.com/yetone/magpie/internal/catalog"
)

// scopeSave is a provider the tests below put in the catalog, tagged so a
// family can be picked apart from its own id.
func scopeSave(t *testing.T, id, family string, models ...string) {
	t.Helper()
	if err := Save(Provider{ID: id, Name: "My " + id, Key: "k", Chat: "http://127.0.0.1:1/v1",
		Family: family, Models: models}); err != nil {
		t.Fatal(err)
	}
}

// The names an agent's range may hold, as the GUI's range sheet offers
// them: every family, provider id and routing group id magpie has, each
// with how many entries it would show.
func TestScopeNamesOffersEveryName(t *testing.T) {
	isolate(t)
	t.Setenv("HOME", t.TempDir())
	t.Setenv("USERPROFILE", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	scopeSave(t, "relay", "fast", "m1", "m2")
	scopeSave(t, "other", "", "m1")

	got := ScopeNames()
	at := map[string]ScopeName{}
	for _, n := range got {
		if _, twice := at[n.Name]; twice {
			t.Fatalf("%q offered twice: %+v", n.Name, got)
		}
		at[n.Name] = n
	}
	if n := at["fast"]; n.Kind != ScopeFamily || n.Entries != 2 {
		t.Fatalf("the family: %+v", n)
	}
	if n := at["relay"]; n.Kind != ScopeProvider || n.Entries != 2 {
		t.Fatalf("the tagged provider, by its own id: %+v", n)
	}
	if n := at["other"]; n.Kind != ScopeProvider || n.Entries != 1 {
		t.Fatalf("the untagged provider: %+v", n)
	}
	// the model both providers serve: one found group, named by the model
	if n := at[AutoGroupID("m1")]; n.Kind != ScopeGroup || n.Entries != 1 || n.Label == "" {
		t.Fatalf("the found group: %+v", n)
	}
	if at[AutoGroupID("m2")].Name != "" {
		t.Fatalf("a model one provider serves was offered as a group: %+v", got)
	}
	// the order the sheet lists them in: families, providers, groups
	var order []ScopeKind
	for _, n := range got {
		if len(order) == 0 || order[len(order)-1] != n.Kind {
			order = append(order, n.Kind)
		}
	}
	want := []ScopeKind{ScopeFamily, ScopeProvider, ScopeGroup}
	if !slices.Equal(order, want) {
		t.Fatalf("kinds in order %v, want %v (%+v)", order, want, got)
	}
	// a model new to the catalog is counted
	scopeSave(t, "relay", "fast", "m1", "m2", "m3")
	if n := ScopeNames(); !slices.ContainsFunc(n, func(x ScopeName) bool { return x.Name == "relay" && x.Entries == 3 }) {
		t.Fatalf("a new model's provider: %+v", n)
	}
	// a range that leaves a provider out keeps it offered, there to be
	// ticked back — the sheet is the whole catalog's, not the agent's
	if err := SetVisible("codex", []string{"fast"}); err != nil {
		t.Fatal(err)
	}
	if shown, kept := CatalogFor("codex"); slices.Contains(ids(shown), "other/m1") || !slices.Contains(ids(kept), "other/m1") {
		t.Fatalf("shown %v kept %v", ids(shown), ids(kept))
	}
	if n := ScopeNames(); !slices.ContainsFunc(n, func(x ScopeName) bool { return x.Name == "other" && x.Entries == 1 }) {
		t.Fatalf("a name the range leaves out is not offered: %+v", n)
	}
	// a provider that is gone is offered by nothing: its models are gone too
	if err := Delete("other"); err != nil {
		t.Fatal(err)
	}
	if n := ScopeNames(); slices.ContainsFunc(n, func(x ScopeName) bool { return x.Name == "other" }) {
		t.Fatalf("a removed provider is still offered: %+v", n)
	}
}

// An agent's range (settings' Visible), written from the GUI: the models
// it keeps, the entries they are named by, and every agent told; none puts
// the whole catalog back.
func TestSetVisibleNarrows(t *testing.T) {
	isolate(t)
	t.Setenv("HOME", t.TempDir())
	t.Setenv("USERPROFILE", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	scopeSave(t, "relay", "fast", "m1", "m2")
	scopeSave(t, "other", "", "m1")

	all, _ := CatalogFor("codex")
	told := 0
	was := catalog.Changed
	catalog.Changed = func() { told++ }
	t.Cleanup(func() { catalog.Changed = was })

	// the family keeps both its models, whatever else the catalog has; the
	// untagged provider is named by its id alone
	if err := SetVisible("Codex", []string{" fast ", "other", "fast"}); err != nil {
		t.Fatal(err)
	}
	// the agent id is lowered, the names trimmed and taken once
	if names, ok := VisibleTo("codex"); !ok || !slices.Equal(names, []string{"fast", "other"}) {
		t.Fatalf("saved %v %v", names, ok)
	}
	shown, hidden := CatalogFor("codex")
	if len(shown) != 3 || slices.Contains(ids(shown), GroupPrefix+AutoGroupID("m1")) {
		t.Fatalf("shown %v", ids(shown))
	}
	if !slices.Contains(ids(hidden), GroupPrefix+AutoGroupID("m1")) {
		t.Fatalf("kept %v", ids(hidden))
	}
	// another agent still has every one
	if other, _ := CatalogFor("claude"); len(other) != len(all) {
		t.Fatalf("another agent's list narrowed: %v", ids(other))
	}
	if told != 1 {
		t.Fatalf("agents told %d times", told)
	}
	// the same again writes nothing and tells no one
	if err := SetVisible("codex", []string{"fast", "other"}); err != nil || told != 1 {
		t.Fatalf("%v told %d", err, told)
	}
	// an entry's own id names its provider, so the other provider's models
	// go — the whole provider is what a range holds, not one of its models
	if err := SetVisible("codex", []string{"relay/m2"}); err != nil {
		t.Fatal(err)
	}
	if shown, _ := CatalogFor("codex"); slices.Contains(ids(shown), "other/m1") {
		t.Fatalf("one entry: %v", ids(shown))
	}
	// a group id keeps the group
	if err := SetVisible("codex", []string{GroupPrefix + AutoGroupID("m1")}); err != nil {
		t.Fatal(err)
	}
	if names, _ := VisibleTo("codex"); !slices.Equal(names, []string{GroupPrefix + AutoGroupID("m1")}) {
		t.Fatalf("the id as given is kept: %v", names)
	}
	if shown, _ := CatalogFor("codex"); !slices.Equal(ids(shown), []string{GroupPrefix + AutoGroupID("m1")}) {
		t.Fatalf("group prefix: %v", ids(shown))
	}
	// none puts every model back, and no range is left in settings
	if err := SetVisible("codex", nil); err != nil {
		t.Fatal(err)
	}
	if _, ok := VisibleTo("codex"); ok {
		t.Fatal("an empty range kept")
	}
	if shown, hidden := CatalogFor("codex"); len(shown) != len(all) || len(hidden) != 0 {
		t.Fatalf("put back: %v kept %v", ids(shown), ids(hidden))
	}
	if told != 4 {
		t.Fatalf("agents told %d times", told)
	}
	// and setting none again writes nothing
	if err := SetVisible("codex", nil); err != nil || told != 4 {
		t.Fatalf("%v told %d", err, told)
	}
	// a range with no agent is refused
	if err := SetVisible("", []string{"fast"}); err == nil {
		t.Fatal("a range with no agent was accepted")
	}
}
