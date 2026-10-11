package provider

import (
	"testing"

	"github.com/yetone/magpie/internal/settings"
)

// routingGroupsOn switches every routing group on for the agents these
// tests name, since a group is off for an agent until it is (settings'
// GroupsOn, see visible.go): what those tests are about — how a group's
// models are named in a list — needs the group in the list to begin with.
func routingGroupsOn(t *testing.T, agents ...string) {
	t.Helper()
	s := settings.Load()
	if s.GroupsOn == nil {
		s.GroupsOn = map[string][]string{}
	}
	var ids []string
	for _, g := range Groups() {
		ids = append(ids, GroupPrefix+g.ID)
	}
	for _, a := range agents {
		s.GroupsOn[a] = ids
	}
	if err := settings.Save(s); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		s := settings.Load()
		for _, a := range agents {
			delete(s.GroupsOn, a)
		}
		settings.Save(s)
	})
}
