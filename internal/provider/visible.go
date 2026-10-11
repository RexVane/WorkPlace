package provider

import (
	"errors"
	"slices"
	"strings"

	"github.com/yetone/magpie/internal/catalog"
	"github.com/yetone/magpie/internal/settings"
)

// Which of the catalog an agent is shown. Settings' Visible names, for an
// agent, the families its lists hold: a family is the tag providers and
// groups are given (magpie provider set <id> family=relay), and a
// provider's or group's id names it alone. The gateway's model list and
// what magpie writes into the agents' files both come from CatalogFor, so
// the two never differ.

// Names are what an entry answers to in a visibility: its family, and its
// provider's id or its group's id (as group/<id> too).
func (e Entry) Names() []string {
	var out []string
	if e.Family != "" {
		out = append(out, e.Family)
	}
	if e.Group != "" {
		return append(out, e.Group, GroupPrefix+e.Group)
	}
	return append(out, e.Provider.ID)
}

// VisibleTo is what agent's lists are narrowed to, and whether they are.
func VisibleTo(agent string) ([]string, bool) {
	names, ok := heldSettings().Visible[strings.ToLower(agent)]
	return slices.Clone(names), ok
}

// Shows reports whether a visibility shows e.
func Shows(names []string, e Entry) bool {
	for _, n := range e.Names() {
		if slices.ContainsFunc(names, func(v string) bool { return strings.EqualFold(v, n) }) {
			return true
		}
	}
	return false
}

// SetVisible narrows agent's lists to these names (its families, providers
// and routing groups, see VisibleTo) and tells the agents, as `magpie
// visible <agent> <name>…` does. None puts every model back, the way
// `magpie visible <agent> all` does. Names are trimmed, and a repeat is
// taken once; the order is the caller's.
func SetVisible(agent string, names []string) error {
	agent = strings.ToLower(strings.TrimSpace(agent))
	if agent == "" {
		return errors.New("no agent")
	}
	var keep []string
	for _, n := range names {
		if n = strings.TrimSpace(n); n != "" && !slices.ContainsFunc(keep, func(k string) bool { return strings.EqualFold(k, n) }) {
			keep = append(keep, n)
		}
	}
	s := settings.Load()
	if len(keep) == 0 {
		if _, ok := s.Visible[agent]; !ok {
			return nil
		}
		delete(s.Visible, agent)
	} else {
		if slices.Equal(s.Visible[agent], keep) {
			return nil
		}
		if s.Visible == nil {
			s.Visible = map[string][]string{}
		}
		s.Visible[agent] = keep
	}
	if err := settings.Save(s); err != nil {
		return err
	}
	catalog.Touched()
	return nil
}

// ScopeKind is what a range's name is: a family, a provider's or a routing
// group's id. The GUI groups its range sheet by it.
type ScopeKind string

const (
	ScopeFamily   ScopeKind = "family"
	ScopeProvider ScopeKind = "provider"
	ScopeGroup    ScopeKind = "group"
)

// ScopeName is one name an agent's range can hold, and the entries it
// would show: the whole catalog's count, so a name the agent's range
// leaves out is offered with what ticking it back would show.
type ScopeName struct {
	Name string    `json:"name"`
	Kind ScopeKind `json:"kind"`
	// Label is what the sheet calls it: a routing group's own name when
	// the user gave it one, else "" — a provider's and a family's names
	// are their own.
	Label string `json:"label,omitempty"`
	// Icon is a routing group's first provider's; "" for a provider or a
	// family.
	Icon string `json:"icon,omitempty"`
	// Entries is how many of the catalog's entries it names.
	Entries int `json:"entries"`
}

// ScopeNames is every name an agent's range can hold, families first, then
// providers, then routing groups, each by name. It is the whole catalog's
// (Served), not one agent's: a name whose every model the agent's range
// leaves out is offered still, there to be ticked back. A provider or a
// group tagged with a family is named by its own id as well, so the sheet
// offers the one and the other apart.
func ScopeNames() []ScopeName {
	entries := Served()
	// every family first: a family is a name of its own, not one of the
	// entries it tags, and it comes before the providers in the sheet
	families := lowerSet(Families())
	counts := map[string]int{}
	spelled := map[string]string{}
	kinds := map[string]ScopeKind{}
	labels := map[string]string{}
	icons := map[string]string{}
	note := func(n string, kind ScopeKind, label, icon string) {
		if n == "" {
			return
		}
		k := strings.ToLower(n)
		if _, ok := counts[k]; !ok {
			spelled[k], kinds[k], labels[k], icons[k] = n, kind, label, icon
		}
		counts[k]++
	}
	for _, e := range entries {
		kind, label, icon := ScopeProvider, "", ""
		if e.Group != "" {
			// a group's own name says more than its id when the user gave
			// it one; a found group's ("auto-…") is the model's, as the
			// pickers show
			kind, label, icon = ScopeGroup, e.Name, e.Provider.Icon
			if g, _, ok := FindGroup(GroupPrefix + e.Group); ok && !g.Auto {
				label = g.Name
			}
		}
		for _, n := range e.Names() {
			if families[strings.ToLower(n)] {
				note(n, ScopeFamily, "", "")
				continue
			}
			note(n, kind, label, icon)
		}
	}
	out := make([]ScopeName, 0, len(spelled))
	for k, name := range spelled {
		out = append(out, ScopeName{Name: name, Kind: kinds[k], Label: labels[k], Icon: icons[k], Entries: counts[k]})
	}
	slices.SortStableFunc(out, func(a, b ScopeName) int {
		if a.Kind != b.Kind {
			return kindRank(a.Kind) - kindRank(b.Kind)
		}
		return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	})
	return out
}

// kindRank orders the range's names as the sheet lists them.
func kindRank(k ScopeKind) int {
	switch k {
	case ScopeFamily:
		return 0
	case ScopeProvider:
		return 1
	}
	return 2
}

// Described is set by the gateway: whether an image sent to a model that
// can't see is described to it by one that can (Settings › Vision). Agents
// are then told every model takes images; told a model is text-only, they
// turn the user's image away before magpie is asked (Codex: "does not
// support image input").
var Described func() bool

// described is Described, false before the gateway sets it.
func described() bool { return Described != nil && Described() }

// CatalogFor is the catalog as agent is shown it, and what is kept from it
// (none when its lists aren't narrowed): its visibility's, less the models
// taken out of its lists one by one (HiddenModels).
func CatalogFor(agent string) (shown, hidden []Entry) {
	listed, hidden := ListedFor(agent)
	off := HiddenModels(agent)
	for _, e := range listed {
		if off[e.ID] {
			hidden = append(hidden, e)
		} else {
			shown = append(shown, e)
		}
	}
	return shown, hidden
}

// ListedFor is the catalog agent's visibility gives it, the models it may
// pick to show or not among, and what the visibility keeps from it: its
// visibility's names, less the routing groups it may not go through — a
// group is off for an agent until it is switched on for it alone
// (GroupsOn), which is what 「路由组默认不启用」 says.
func ListedFor(agent string) (listed, kept []Entry) {
	all := Catalog()
	names, ok := VisibleTo(agent)
	for _, e := range all {
		if ok && !Shows(names, e) {
			kept = append(kept, e)
			continue
		}
		if e.Group != "" && !GroupOn(agent, e.ID) {
			kept = append(kept, e)
			continue
		}
		listed = append(listed, e)
	}
	return InOrder(agent, listed), kept
}

// GroupsOn are the routing groups agent may go through, by entry id
// ("group/<id>"). An agent the settings don't name has none: a group it is
// not given here is kept out of its lists (its picker, the model list
// magpie writes into its files and the gateway's model list alike, through
// CatalogFor) until it is switched on for it, which is what 「路由组默认不
// 启用」 asks for. Every provider's own models are untouched either way.
func GroupsOn(agent string) map[string]bool {
	s := heldSettings()
	ids := s.GroupsOn[strings.ToLower(agent)]
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out
}

// GroupOn reports whether agent may go through this one routing group.
func GroupOn(agent, id string) bool {
	return GroupsOn(agent)[id]
}

// SetGroupOn turns one routing group on or off for agent alone. The switch
// is per agent: turning a group on for one leaves every other agent as it
// was, and an agent with no groups of its own still has none.
func SetGroupOn(agent, id string, on bool) error {
	agent = strings.ToLower(strings.TrimSpace(agent))
	id = strings.TrimSpace(id)
	if agent == "" {
		return errors.New("no agent")
	}
	if id == "" {
		return errors.New("no group")
	}
	s := settings.Load()
	groups := slices.Clone(s.GroupsOn[agent])
	if on {
		if slices.Contains(groups, id) {
			return nil
		}
		groups = append(groups, id)
	} else {
		i := slices.Index(groups, id)
		if i < 0 {
			return nil
		}
		groups = slices.Delete(groups, i, i+1)
	}
	slices.Sort(groups)
	if s.GroupsOn == nil {
		s.GroupsOn = map[string][]string{}
	}
	if len(groups) == 0 {
		delete(s.GroupsOn, agent)
	} else {
		s.GroupsOn[agent] = groups
	}
	if err := settings.Save(s); err != nil {
		return err
	}
	catalog.Touched()
	return nil
}

// SetGroupsOff takes every routing group away from every agent: each one
// keeps its providers' own models and goes on none of the catalog's
// groups, until one is switched on for it in its own list. The answer is
// how many agents had one switched on.
func SetGroupsOff() (int, error) {
	s := settings.Load()
	changed := len(s.GroupsOn)
	if changed == 0 {
		return 0, nil
	}
	s.GroupsOn = nil
	if err := settings.Save(s); err != nil {
		return 0, err
	}
	catalog.Touched()
	return changed, nil
}

// HiddenModels are the ids of the entries taken out of agent's lists.
func HiddenModels(agent string) map[string]bool {
	ids := heldSettings().HiddenModels[strings.ToLower(agent)]
	out := make(map[string]bool, len(ids))
	for _, id := range ids {
		out[id] = true
	}
	return out
}

// SetHiddenModels takes these entries out of agent's lists, and puts back
// every other; none shows it every model its visibility gives it. The
// agents that keep the models in files of their own are told.
func SetHiddenModels(agent string, ids []string) error {
	agent = strings.ToLower(strings.TrimSpace(agent))
	if agent == "" {
		return errors.New("no agent")
	}
	var keep []string
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" && !slices.Contains(keep, id) {
			keep = append(keep, id)
		}
	}
	slices.Sort(keep)
	s := settings.Load()
	if slices.Equal(s.HiddenModels[agent], keep) {
		return nil
	}
	if len(keep) == 0 {
		delete(s.HiddenModels, agent)
	} else {
		if s.HiddenModels == nil {
			s.HiddenModels = map[string][]string{}
		}
		s.HiddenModels[agent] = keep
	}
	if err := settings.Save(s); err != nil {
		return err
	}
	catalog.Touched()
	return nil
}

// Families are the families providers and groups are tagged with, sorted.
func Families() []string {
	var out []string
	add := func(f string) {
		if f != "" && !slices.Contains(out, f) {
			out = append(out, f)
		}
	}
	for _, p := range All() {
		add(p.Family)
	}
	for _, g := range Groups() {
		add(g.Family)
	}
	slices.Sort(out)
	return out
}

// ModelOrder is the order the user put agent's models in (OrderedModels),
// by entry id; none when they never did.
func ModelOrder(agent string) []string {
	return slices.Clone(heldSettings().OrderedModels[strings.ToLower(agent)])
}

// SetModelOrder lists agent's models in this order, by entry id: the ones
// it names first, as it names them, then every other as before; none puts
// them back in magpie's own order. Only agent's lists follow it.
func SetModelOrder(agent string, ids []string) error {
	agent = strings.ToLower(strings.TrimSpace(agent))
	if agent == "" {
		return errors.New("no agent")
	}
	var keep []string
	for _, id := range ids {
		if id = strings.TrimSpace(id); id != "" && !slices.Contains(keep, id) {
			keep = append(keep, id)
		}
	}
	s := settings.Load()
	if slices.Equal(s.OrderedModels[agent], keep) {
		return nil
	}
	if len(keep) == 0 {
		delete(s.OrderedModels, agent)
	} else {
		if s.OrderedModels == nil {
			s.OrderedModels = map[string][]string{}
		}
		s.OrderedModels[agent] = keep
	}
	if err := settings.Save(s); err != nil {
		return err
	}
	catalog.Touched()
	return nil
}

// InOrder is es in agent's order: the entries ModelOrder names first, as it
// names them, then the rest as they come — a model added since goes after.
// Codex's own, a ChatGPT account's models, lead the rest, as Codex's list
// has them before magpie's.
func InOrder(agent string, es []Entry) []Entry {
	order := ModelOrder(agent)
	if len(order) == 0 {
		return es
	}
	at := make(map[string]int, len(order))
	for i, id := range order {
		at[id] = i
	}
	out := slices.Clone(es)
	rank := func(e Entry) int {
		if i, ok := at[e.ID]; ok {
			return i
		}
		if strings.EqualFold(agent, "codex") && !CodexOwn(e) {
			return len(order) + 1
		}
		return len(order)
	}
	slices.SortStableFunc(out, func(a, b Entry) int { return rank(a) - rank(b) })
	return out
}

// CodexOwn reports whether e is one of a ChatGPT account's own models,
// which the ChatGPT backend lists to Codex by its bare slug (e.Model).
func CodexOwn(e Entry) bool {
	return e.Group == "" && e.Provider.Account != nil && e.Provider.Account.Agent == "codex"
}
