package agent

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/yetone/magpie/internal/edit"
	"github.com/yetone/magpie/internal/provider"
	"github.com/yetone/magpie/internal/settings"
)

// Connect starts an agent on a provider's own model, never on a routing
// group: a group is a way through magpie the reader turns on for one agent
// at a time, so a catalog that has both leaves the agent on the model. A
// group is still what it falls back to when it is all magpie has (see
// TestConnectOnARoutingGroupAlone).
func TestConnectPrefersAProviderOverARoutingGroup(t *testing.T) {
	home, _ := codexHome(t, "", "")
	// codexHome seeds a provider of its own; this is about the two below
	if err := provider.Delete("fake"); err != nil {
		t.Fatal(err)
	}
	if err := provider.Save(provider.Provider{ID: "relay", Name: "Relay", Chat: "https://a.example/v1", Key: "k", Models: []string{"m1", "m2"}}); err != nil {
		t.Fatal(err)
	}
	// saved first, so a pick by the catalog's own order would take it
	if err := provider.SaveGroup(provider.Group{ID: "aaa", Name: "AAA", Members: []string{"relay/m1"}}); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(home, ".claude", "settings.json")
	writeFile(t, path, `{}`)
	c := claude(home)
	conn, err := c.ConnectHow()
	if err != nil {
		t.Fatal(err)
	}
	m, _ := edit.GetJSON(path, "model")
	if strings.HasPrefix(m, provider.GroupPrefix) {
		t.Fatalf("connected on the routing group %q (how %q); want a provider's model:\n%s", m, conn.How, readFile(path))
	}
	if m != "relay/m1" && m != "relay/m2" {
		t.Fatalf("connected on %q, want one of relay's:\n%s", m, readFile(path))
	}

	// the group is all magpie has left once the provider's models are taken
	// out of Claude Code's lists: then it is what the agent is connected on
	// (#939). The provider stays, so the group still has its models
	s := settings.Load()
	s.HiddenModels = map[string][]string{"claude": {"relay/m1", "relay/m2"}}
	if err := settings.Save(s); err != nil {
		t.Fatal(err)
	}
	writeFile(t, path, `{}`)
	if _, err := claude(home).ConnectHow(); err != nil {
		t.Fatal(err)
	}
	if m, _ := edit.GetJSON(path, "model"); m != provider.GroupPrefix+"aaa" {
		t.Fatalf("with nothing else, connected on %q, want the group:\n%s", m, readFile(path))
	}
}
