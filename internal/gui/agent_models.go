package gui

import (
	"cmp"
	"encoding/json"
	"net/http"
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
// button): which families, provider ids and routing group ids its lists
// are narrowed to (settings' Visible, `magpie visible`), and every name
// the catalog offers to narrow them by.
//
// Names is the agent's range as saved, empty when it has none — every name
// is then in it, which is what the sheet starts from: it keeps the whole
// set and the user unticks what the agent shouldn't be shown. Saving that
// whole set back drops the range rather than pinning every name, so a
// model or group added later is still shown, as the foot says.
type scopeJSON struct {
	Agent string               `json:"agent"`
	Names []string             `json:"names"`
	All   []provider.ScopeName `json:"all"`
}

// scopeUsed is how much of an agent's catalog its range keeps, for the
// line the sheet says under the title.
type scopeUsed struct {
	// Shown is the models the agent is shown: what its range gives it,
	// less the ones taken out of its lists one by one (HiddenModels).
	Shown int `json:"shown"`
	// Catalog is every model magpie has, which the range narrows.
	Catalog int `json:"catalog"`
	// Names is how many names the range holds, 0 when it has none and the
	// agent is shown the whole catalog.
	Names int `json:"names"`
}

func agentScope(a *agent.Agent) scopeJSON {
	names, _ := provider.VisibleTo(a.ListsFor())
	if names == nil {
		names = []string{}
	}
	all := provider.ScopeNames()
	if all == nil {
		all = []provider.ScopeName{}
	}
	return scopeJSON{Agent: a.ListsFor(), Names: names, All: all}
}

// scopeOf is an agent's range sheet and how much of the catalog it keeps.
func scopeOf(a *agent.Agent) (scopeJSON, scopeUsed) {
	shown, _ := provider.CatalogFor(a.ListsFor())
	names, narrowed := provider.VisibleTo(a.ListsFor())
	used := scopeUsed{Shown: len(shown), Catalog: len(provider.Catalog())}
	if narrowed {
		used.Names = len(names)
	}
	return agentScope(a), used
}

func agentScopeAPI(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/agent-scope/{id}", func(rw http.ResponseWriter, r *http.Request) {
		a, err := agent.Find(r.PathValue("id"))
		if err != nil {
			fail(rw, err)
			return
		}
		scope, used := scopeOf(a)
		writeJSON(rw, map[string]any{"scope": scope, "used": used})
	})
	// names is the agent's whole range: what the catalog is narrowed to,
	// and the entries the page's list is then drawn from. An empty one
	// puts every model back, as `magpie visible <agent> all` does
	mux.HandleFunc("POST /api/agent-scope/{id}", func(rw http.ResponseWriter, r *http.Request) {
		var in struct {
			Names []string
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
		if err := provider.SetVisible(a.ListsFor(), in.Names); err != nil {
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
