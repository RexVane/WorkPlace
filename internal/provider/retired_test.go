package provider

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/yetone/magpie/internal/catalog"
)

// A model its own maker has retired is not offered to an agent and not
// written into its files, while a request naming it is still served; a
// reseller's word on its own copy of a model doesn't retire the model
// (its maker's word is what counts).
func TestRetiredModelsAreNotOffered(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("XDG_CACHE_HOME", filepath.Join(home, ".cache"))
	if err := os.MkdirAll(filepath.Dir(catalog.CachePath()), 0o755); err != nil {
		t.Fatal(err)
	}
	// deepseek retires v4-flash and keeps v4-pro; nvidia retires its copy of
	// v4-pro only
	if err := os.WriteFile(catalog.CachePath(), []byte(`{
	  "deepseek": {"models": {
	    "deepseek-v4-flash": {"id":"deepseek-v4-flash","name":"DeepSeek V4 Flash","status":"deprecated"},
	    "deepseek-v4-pro": {"id":"deepseek-v4-pro","name":"DeepSeek V4 Pro"}}},
	  "nvidia": {"models": {
	    "deepseek/deepseek-v4-pro": {"id":"deepseek/deepseek-v4-pro","status":"deprecated"}}}
	}`), 0o644); err != nil {
		t.Fatal(err)
	}
	catalog.Reset()
	t.Cleanup(catalog.Reset)
	// a relay serving both, as its own list gives them
	if err := catalog.SaveLive("relay", "https://relay.test/v1", []catalog.Model{
		{ID: "deepseek-v4-flash"}, {ID: "deepseek-v4-pro"},
	}); err != nil {
		t.Fatal(err)
	}
	if err := Save(Provider{ID: "relay", Name: "Relay", Key: "k", Chat: "https://relay.test/v1",
		Models: []string{"deepseek-v4-flash", "deepseek-v4-pro"}}); err != nil {
		t.Fatal(err)
	}
	p, err := Find("relay")
	if err != nil {
		t.Fatal(err)
	}
	var exposed []string
	for _, m := range p.Exposed() {
		exposed = append(exposed, m.ID)
	}
	if slices.Contains(exposed, "deepseek-v4-flash") {
		t.Fatalf("a retired model is still offered: %v", exposed)
	}
	if !slices.Contains(exposed, "deepseek-v4-pro") {
		t.Fatalf("a model its maker still serves was taken away (a reseller's word counted): %v", exposed)
	}
	// and the catalog the agents see follows
	if shown, _ := CatalogFor("codex"); slices.ContainsFunc(shown, func(e Entry) bool { return e.Model == "deepseek-v4-flash" }) {
		t.Fatalf("the retired model is in the catalog: %v", shown)
	}
	// while a request naming it is still resolved, so an agent already on it
	// keeps working
	if _, model, ok := Resolve("relay/deepseek-v4-flash"); !ok || model != "deepseek-v4-flash" {
		t.Fatalf("a retired model is no longer served: %q %v", model, ok)
	}
}