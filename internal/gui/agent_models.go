package gui

import (
	"cmp"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/yetone/magpie/internal/agent"
	"github.com/yetone/magpie/internal/provider"
)

// Which of the catalog an agent's lists show, picked one model at a time
// on the Agents page (settings.HiddenModels): the line under an agent's
// name counts them, and opens the list to pick in.

// modelCountJSON is how many models an agent's lists show, of those its
// visibility gives it.
type modelCountJSON struct {
	Shown  int `json:"shown"`
	Listed int `json:"listed"`
	// By is the models shown by whose they are, a connected agent's
	// expanded row's chips (OpenAI 6 · OpenRouter 24)
	By []modelGroupJSON `json:"by,omitempty"`
	// Names are the first few models shown by name, for a row that says
	// which it lists rather than how many (Claude Desktop's)
	Names []string `json:"names,omitempty"`
}

// countNames is how many models' names modelCount gives.
const countNames = 3

// modelGroupJSON is how many of the models shown one provider (or the
// routing groups) gives.
type modelGroupJSON struct {
	Name  string   `json:"name"`
	Icon  string   `json:"icon,omitempty"`
	Icons []string `json:"icons,omitempty"`
	N     int      `json:"n"`
}

// agentModelJSON is a model an agent may be shown, as the list draws it.
type agentModelJSON struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Group string   `json:"group"` // its provider's name, or "Routing groups"
	Icon  string   `json:"icon,omitempty"`
	Icons []string `json:"icons,omitempty"`
	// Logo is its maker's: known by the model's family, or its provider's
	// when that is the maker; "" when neither says, and for a group, which
	// has Icons
	Logo    string `json:"logo,omitempty"`
	Context int    `json:"context,omitempty"`
	Hidden  bool   `json:"hidden,omitempty"`
	// InUse: the agent is set to it, so it can't be taken out
	InUse bool `json:"inUse,omitempty"`
	// Candidates are the names of the agent's range (settings' Visible,
	// see provider.Entry.Names) that would show it: the entry's family,
	// and its provider's or its group's id. The list's range sheet ticks
	// and unticks them, the entry shown or dimmed by whether any is in
	// the range. Empty for an agent whose lists aren't narrowed: every
	// name is in its range, so the sheet starts with all of them ticked.
	Candidates []string `json:"candidates,omitempty"`
	// Own: one of Codex's own, a ChatGPT account's, which Codex lists
	// ahead of magpie's until the user puts them in an order (#855)
	Own bool `json:"own,omitempty"`
}

// takesCatalog reports whether an agent picks among magpie's catalog: some
// option of a field of its is a catalog entry.
func takesCatalog(fields []fieldJSON) bool {
	for _, f := range fields {
		for _, o := range f.Options {
			if o.Ref != "" {
				return true
			}
		}
	}
	return false
}

// agentFields are an agent's pickers as the Agents page draws them.
func agentFields(a *agent.Agent, vals map[string]string) []fieldJSON {
	out := []fieldJSON{}
	for _, f := range a.Fields {
		opts := f.Options(vals)
		if opts == nil {
			opts = []agent.Option{}
		}
		out = append(out, fieldJSON{Key: f.Key, Label: f.Label, Value: vals[f.Key], Options: opts})
	}
	return out
}

// agentModelCount is the line under an agent's name, nil for an agent that
// doesn't pick among the catalog nor has its menu from the gateway's list
// (agent.ListsModels). Its pickers list only the models shown, so
// with every one taken out they have no catalog entry left, yet the line is
// the one way to put them back (#356): it stays while any is hidden.
func agentModelCount(a *agent.Agent, fields []fieldJSON) *modelCountJSON {
	id := a.ListsFor()
	if takesCatalog(fields) || a.ListsModels {
		return modelCount(id)
	}
	if len(provider.HiddenModels(id)) == 0 {
		return nil
	}
	if c := modelCount(id); c.Shown < c.Listed {
		return c
	}
	return nil
}

func modelCount(id string) *modelCountJSON {
	listed, _ := provider.ListedFor(id)
	off := provider.HiddenModels(id)
	c := &modelCountJSON{Listed: len(listed)}
	at := map[string]int{}
	for _, e := range listed {
		if off[e.ID] {
			continue
		}
		c.Shown++
		if len(c.Names) < countNames {
			c.Names = append(c.Names, cmp.Or(e.Name, e.Model, e.ID))
		}
		g := modelGroupJSON{Name: e.Provider.Name, Icon: e.Provider.Icon}
		if e.Group != "" {
			g = modelGroupJSON{Name: agent.RoutingGroups, Icons: e.Icons}
		}
		i, ok := at[g.Name]
		if !ok {
			i = len(c.By)
			at[g.Name] = i
			c.By = append(c.By, g)
		}
		c.By[i].N++
	}
	return c
}

// usedBy reports whether one of the agent's values is the entry: its id,
// with a prefix the agent's files give it (magpie/…), or, for the agent's
// own account, the vendor's model id alone.
func usedBy(a *agent.Agent, vals map[string]string, e provider.Entry) bool {
	for _, v := range vals {
		if v == "" {
			continue
		}
		if v == e.ID || strings.HasSuffix(v, "/"+e.ID) {
			return true
		}
		if acc := e.Provider.Account; e.Group == "" && acc != nil && acc.Agent == a.ListsFor() && v == e.Model {
			return true
		}
	}
	return false
}

func agentModelList(a *agent.Agent) []agentModelJSON {
	id := a.ListsFor()
	listed, _ := provider.ListedFor(id)
	off := provider.HiddenModels(id)
	vals := a.Values()
	out := []agentModelJSON{}
	for _, e := range listed {
		m := agentModelJSON{ID: e.ID, Name: e.Name, Group: e.Provider.Name, Icon: e.Provider.Icon, Context: e.Context,
			Hidden: off[e.ID], InUse: usedBy(a, vals, e), Own: id == "codex" && provider.CodexOwn(e),
			Candidates: e.Names()}
		if m.Name == "" {
			m.Name = e.Model
		}
		m.Logo = agent.ModelIcon(e.Model)
		if e.Group != "" {
			// a group shows its providers' icons, as it does everywhere else
			m.Group, m.Icons, m.Logo = agent.RoutingGroups, e.Icons, ""
		} else if m.Logo == "" {
			if p := provider.Preset(e.Provider.Preset); p != nil && p.Kind == provider.KindVendor {
				m.Logo = e.Provider.Icon
			}
		}
		out = append(out, m)
	}
	return out
}

// scopeJSON is the routing sheet of one agent's model list (the "Routing"
// button), in the two steps the reader works in: which routing groups the
// agent may go through, and — under each one that is on — which of that
// group's models it is shown.
//
// Names are the groups switched on for it (settings.GroupsOn), All every
// group the catalog offers. Each group carries its own models and whether
// the agent is shown each (settings.HiddenModels, the same per-model
// switch the list itself ticks): taking one out hides it from this agent
// alone — every other agent keeps it, and the group still routes through
// it — which is 「路由组的某些模型显不显示」.
type scopeJSON struct {
	Agent  string               `json:"agent"`
	Names  []string             `json:"names"`
	All    []provider.ScopeName `json:"all"`
	Models []scopeGroupJSON     `json:"models,omitempty"`
	// Hidden is every entry this agent's lists don't show (settings'
	// HiddenModels, whole). The sheet sends this set back with the one
	// model it changed, so ticking one under a group never puts another
	// back that the list — or a group the agent no longer goes through —
	// had taken out
	Hidden []string `json:"hidden,omitempty"`
}

// scopeGroupJSON is one routing group's own models, as the sheet draws them
// under its switch: the group's catalog id and the entries it is made of.
type scopeGroupJSON struct {
	ID     string           `json:"id"`
	Models []scopeModelJSON `json:"models"`
}

// scopeModelJSON is one model of a group: what the sheet names it by, and
// whether this agent is shown it.
type scopeModelJSON struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Provider is whose model it is, said beside the name: a group's members
	// often carry the same name from several providers (claude's and
	// copilot's Claude Opus 5.5), and the rows would otherwise read alike
	Provider string `json:"provider,omitempty"`
	// Hidden: this agent's lists don't show it (settings.HiddenModels)
	Hidden bool `json:"hidden,omitempty"`
	// InUse: the agent is set to it, so it stays whatever is asked
	InUse bool   `json:"inUse,omitempty"`
	Icon  string `json:"icon,omitempty"`
}

// scopeUsed is how much of an agent's catalog its range keeps, for the
// line the sheet says under the title.
type scopeUsed struct {
	// Shown is the models the agent is shown.
	Shown int `json:"shown"`
	// Catalog is every model magpie has.
	Catalog int `json:"catalog"`
	// Names is how many routing groups are switched on for it.
	Names int `json:"names"`
}

func agentScope(a *agent.Agent) scopeJSON {
	id := a.ListsFor()
	on := provider.GroupsOn(id)
	names := make([]string, 0, len(on))
	for gid := range on {
		names = append(names, gid)
	}
	slices.Sort(names)
	// the sheet switches catalog entries, so only the "group/<id>" spelling
	// of a group is offered: ScopeNames also gives a group the tag it goes
	// by, which is a visibility name and not something to switch
	var all []provider.ScopeName
	for _, s := range provider.ScopeNames() {
		if s.Kind == provider.ScopeGroup && strings.HasPrefix(s.Name, provider.GroupPrefix) {
			all = append(all, s)
		}
	}
	if all == nil {
		all = []provider.ScopeName{}
	}
	// each group's own models, with this agent's per-model switch on them
	off := provider.HiddenModels(id)
	vals := a.Values()
	models := make([]scopeGroupJSON, 0, len(all))
	for _, s := range all {
		members := provider.GroupMembers(s.Name)
		if len(members) == 0 {
			continue
		}
		g := scopeGroupJSON{ID: s.Name, Models: make([]scopeModelJSON, 0, len(members))}
		for _, e := range members {
			name := e.Name
			if name == "" {
				name = e.Model
			}
			m := scopeModelJSON{ID: e.ID, Name: name, Provider: e.Provider.Name, Hidden: off[e.ID], InUse: usedIn(vals, e), Icon: e.Provider.Icon}
			g.Models = append(g.Models, m)
		}
		models = append(models, g)
	}
	// and the whole hidden set, so the sheet can send it back with one change
	hidden := make([]string, 0, len(off))
	for hid := range off {
		hidden = append(hidden, hid)
	}
	slices.Sort(hidden)
	return scopeJSON{Agent: id, Names: names, All: all, Models: models, Hidden: hidden}
}

// usedIn reports whether one of the agent's values is this entry, so the
// sheet can keep it from being taken out (the list's own rows do the same
// through usedBy).
func usedIn(vals map[string]string, e provider.Entry) bool {
	for _, v := range vals {
		if v == "" {
			continue
		}
		if v == e.ID || strings.HasSuffix(v, "/"+e.ID) {
			return true
		}
		if acc := e.Provider.Account; e.Group == "" && acc != nil && v == e.Model {
			return true
		}
	}
	return false
}

// scopeOf is an agent's range sheet and how much of the catalog it keeps.
func scopeOf(a *agent.Agent) (scopeJSON, scopeUsed) {
	shown, _ := provider.CatalogFor(a.ListsFor())
	used := scopeUsed{Shown: len(shown), Catalog: len(provider.Catalog()),
		Names: len(provider.GroupsOn(a.ListsFor()))}
	return agentScope(a), used
}

func agentScopeAPI(mux *http.ServeMux) {
	// routing-groups-off turns every routing group off for every agent at
	// once: each one goes on its own provider's models and on no group
	// until one is switched on for it (see provider.SetGroupsOff)
	mux.HandleFunc("POST /api/agents/routing-groups-off", func(rw http.ResponseWriter, r *http.Request) {
		changed, err := provider.SetGroupsOff()
		if err != nil {
			fail(rw, err)
			return
		}
		writeJSON(rw, struct {
			stateJSON
			Changed int `json:"changed"`
		}{state(), changed})
	})
	mux.HandleFunc("GET /api/agent-scope/{id}", func(rw http.ResponseWriter, r *http.Request) {
		a, err := agent.Find(r.PathValue("id"))
		if err != nil {
			fail(rw, err)
			return
		}
		scope, used := scopeOf(a)
		writeJSON(rw, map[string]any{"scope": scope, "used": used})
	})
	// on switches one routing group on or off for this agent alone. That
	// agent's own list is drawn from what comes back
	//
	// hidden, when sent, is the models of the group being switched that this
	// agent should no longer be shown (the sheet's ticks under it): the same
	// per-model switch the list's own rows write, so a model taken out here
	// is out there too, and every other agent keeps it
	mux.HandleFunc("POST /api/agent-scope/{id}", func(rw http.ResponseWriter, r *http.Request) {
		var in struct {
			ID     string
			On     bool
			Hidden *[]string
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			fail(rw, err)
			return
		}
		a, err := agent.Find(r.PathValue("id"))
		if err != nil {
			fail(rw, err)
			return
		}
		lists := a.ListsFor()
		if in.Hidden != nil {
			if err := provider.SetHiddenModels(lists, *in.Hidden); err != nil {
				fail(rw, err)
				return
			}
		}
		if err := provider.SetGroupOn(lists, in.ID, in.On); err != nil {
			fail(rw, err)
			return
		}
		scope, used := scopeOf(a)
		writeJSON(rw, map[string]any{"scope": scope, "used": used,
			"models": agentModelList(a), "count": modelCount(lists)})
	})
}

func agentModelsAPI(mux *http.ServeMux) {
	// a model the agent picks sent in its vendor's fast mode, or not (#954):
	// for is the option's fastFor, the agent whose requests it goes on
	mux.HandleFunc("POST /api/agent-fast", func(rw http.ResponseWriter, r *http.Request) {
		var in struct {
			For, Ref string
			Fast     bool
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			fail(rw, err)
			return
		}
		if err := provider.SetFastPick(in.For, in.Ref, in.Fast); err != nil {
			fail(rw, err)
			return
		}
		writeJSON(rw, map[string]any{"fast": provider.IsFastPick(in.For, in.Ref)})
	})
	mux.HandleFunc("GET /api/agent-models/{id}", func(rw http.ResponseWriter, r *http.Request) {
		a, err := agent.Find(r.PathValue("id"))
		if err != nil {
			fail(rw, err)
			return
		}
		writeJSON(rw, map[string]any{"models": agentModelList(a), "ordered": len(provider.ModelOrder(a.ListsFor())) > 0})
	})
	// hidden is every entry to take out of the agent's lists; the others
	// are shown, and one the agent is set to is kept in whatever is asked
	//
	// order, instead, is the order the agent's list puts them in (#855):
	// the ones named first, as named; none puts back magpie's own. Every
	// agent's (#1052): its list, the gateway's /models and the files magpie
	// writes for it all come from provider.CatalogFor, which keeps it
	mux.HandleFunc("POST /api/agent-models/{id}", func(rw http.ResponseWriter, r *http.Request) {
		var in struct {
			Hidden []string
			Order  *[]string
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			fail(rw, err)
			return
		}
		a, err := agent.Find(r.PathValue("id"))
		if err != nil {
			fail(rw, err)
			return
		}
		if in.Order != nil {
			if err := provider.SetModelOrder(a.ListsFor(), *in.Order); err != nil {
				fail(rw, err)
				return
			}
			writeJSON(rw, map[string]any{"models": agentModelList(a), "ordered": len(provider.ModelOrder(a.ListsFor())) > 0})
			return
		}
		used := map[string]bool{}
		for _, m := range agentModelList(a) {
			used[m.ID] = m.InUse
		}
		var hidden []string
		for _, id := range in.Hidden {
			if !used[id] {
				hidden = append(hidden, id)
			}
		}
		if err := provider.SetHiddenModels(a.ListsFor(), hidden); err != nil {
			fail(rw, err)
			return
		}
		writeJSON(rw, map[string]any{"models": agentModelList(a), "count": modelCount(a.ListsFor())})
	})
}
