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

// scopeJSON is the range sheet of one agent's model list (the "Scope"
// button): which routing groups that agent may go through. Routing groups
// are off until one is switched on for the agent, so an agent connects on
// a provider's own model and goes through a group only when the reader
// says so.
//
// Names are the groups switched on for it (settings.GroupsOn), All every
// group the catalog offers — the switch's own list. Which of a provider's
// models the agent is shown is the list's matter, not this sheet's: those
// are ticked one by one there (settings.HiddenModels).
type scopeJSON struct {
	Agent string               `json:"agent"`
	Names []string             `json:"names"`
	All   []provider.ScopeName `json:"all"`
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
	on := provider.GroupsOn(a.ListsFor())
	names := make([]string, 0, len(on))
	for id := range on {
		names = append(names, id)
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
	return scopeJSON{Agent: a.ListsFor(), Names: names, All: all}
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
	mux.HandleFunc("POST /api/agent-scope/{id}", func(rw http.ResponseWriter, r *http.Request) {
		var in struct {
			ID string
			On bool
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
		if err := provider.SetGroupOn(a.ListsFor(), in.ID, in.On); err != nil {
			fail(rw, err)
			return
		}
		scope, used := scopeOf(a)
		writeJSON(rw, map[string]any{"scope": scope, "used": used,
			"models": agentModelList(a), "count": modelCount(a.ListsFor())})
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
