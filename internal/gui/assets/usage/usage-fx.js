// Usage, in motion: the Usage page's numbers run up to what they now are,
// its bars and columns grow to theirs, the Overview's timeline is stacked by
// model as the Requests tab's is, a column under the pointer is crossed by a
// line at its total, and what a refresh brought — calls, tokens, requests —
// is told as it lands. app.js and context.js own the page's data; the
// Overview's model chart and ranking use a separate gateway-only snapshot.
// Loaded after app.js and context.js (index.html). The same helpers are
// window.UsageFx, for a page to use without app.js (the prototype).
(() => {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => media.matches;
  const NS = "http://www.w3.org/2000/svg";
  const ease = (k) => 1 - (1 - k) ** 3;
  const moving = new Set();
  const visible = (node) => node.isConnected && !document.hidden && !node.closest("[hidden]");
  const finish = () => { for (const end of [...moving]) end(); };
  media.addEventListener("change", () => { if (still()) finish(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); });
  function tween(node, ms, draw) {
    const start = performance.now();
    let raf = 0;
    const end = () => { cancelAnimationFrame(raf); draw(1); moving.delete(end); };
    const step = (ts) => {
      if (still() || !visible(node) || ts - start >= ms) return end();
      draw(ease(Math.max(0, (ts - start) / ms)));
      raf = requestAnimationFrame(step);
    };
    moving.add(end);
    raf = requestAnimationFrame(step);
    return end;
  }

  // ---------- numbers ----------
  // a figure as it is written: what comes before its number, the number, its
  // decimals, whether it groups thousands, and what comes after ("≈$76.59",
  // "23M", "88.0%", "1,234", "8000 万")
  const NUM = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s;
  function figure(s) {
    const m = NUM.exec((s || "").trim());
    if (!m) return null;
    const d = m[2].split(".")[1];
    return { pre: m[1], n: parseFloat(m[2].replace(/,/g, "")), dec: d ? d.length : 0, comma: m[2].includes(","), post: m[3] };
  }
  const write = (f, n) => f.pre + (f.comma ? n.toLocaleString("en", { minimumFractionDigits: f.dec, maximumFractionDigits: f.dec }) : n.toFixed(f.dec)) + f.post;
  // roll: a node's text runs from what it said to what it says, when both are
  // the same kind of figure; otherwise it just says it
  function roll(node, from, to, ms = 620) {
    node._roll?.();
    node.textContent = to;
    const a = figure(from), b = figure(to);
    if (still() || !visible(node) || !a || !b || a.pre !== b.pre || a.post !== b.post || a.n === b.n) return;
    node.textContent = from;
    node._roll = tween(node, ms, (k) => { node.textContent = k < 1 ? write(b, a.n + (b.n - a.n) * k) : to; });
  }
  // what each figure, bar and column said last, by a key of its own: one
  // redrawn from scratch is still the same figure
  const seen = new Map();
  function text(node, key) {
    if (!node) return;
    const now = node.textContent, was = seen.get(key);
    seen.set(key, now);
    if (was !== undefined && was !== now) roll(node, was, now);
  }
  // width: a bar grows from the width it had to the one it has; one new,
  // from nothing
  function width(node, key) {
    if (!node || !node.style.width) return;
    const to = node.style.width, was = seen.get(key);
    seen.set(key, to);
    const from = was ?? "0%";
    if (from === to || still() || !visible(node) || !node.animate) return;
    const animation = node.animate([{ width: from }, { width: to }], { duration: 720, easing: "cubic-bezier(.2, .8, .2, 1)" });
    const end = () => { animation.cancel(); moving.delete(end); };
    moving.add(end);
    animation.onfinish = animation.oncancel = () => moving.delete(end);
  }
  // delta: what a refresh added to a figure, beside it a moment
  function delta(host, text) {
    if (!host || !text || still()) return;
    host.querySelector(":scope > .ux-delta")?.remove();
    const d = document.createElement("span");
    d.className = "ux-delta";
    d.textContent = text;
    host.append(d);
    setTimeout(() => d.remove(), 2700);
  }

  // ---------- columns ----------
  // columns: each column of a chart grows to its height from the one it had,
  // its parts staying stacked on the way; a chart drawn for the first time
  // grows from its axis. key is the chart's: its box, what it is split by
  // and what it counts.
  const cols = new Map();
  function columns(box, key, points = []) {
    const g = box?.querySelector(".plot > svg");
    if (!g) return;
    const rects = [...g.querySelectorAll("rect.col")].filter((r) => !r.classList.contains("mark") && !r.classList.contains("all"));
    const xs = [...new Set(rects.map((r) => +r.getAttribute("x")))].sort((a, b) => a - b);
    const foot = new Map();
    for (const r of rects) {
      const x = +r.getAttribute("x"), b = +r.getAttribute("y") + +r.getAttribute("height");
      foot.set(x, Math.max(foot.get(x) || 0, b));
    }
    const saved = cols.get(key), size = g.getAttribute("viewBox");
    const prev = saved?.bars, now = new Map(), moves = [];
    const grid = g.querySelector("line.grid"), hot = g.querySelector("rect.hot");
    for (const r of rects) {
      const x = +r.getAttribute("x");
      const i = hot && grid ? Math.floor((x - +grid.getAttribute("x1")) / +hot.getAttribute("width")) : xs.indexOf(x);
      const k = (points[i]?.time || i) + "|" + (r.dataset.k || ""), y = +r.getAttribute("y"), h = +r.getAttribute("height");
      now.set(k, [y, h]);
      const from = prev?.get(k) || [foot.get(x), 0];
      if (Math.abs(from[0] - y) > .2 || Math.abs(from[1] - h) > .2) moves.push([r, from, [y, h]]);
    }
    cols.set(key, { size, bars: now });
    if (still() || !visible(box) || saved && saved.size !== size || !moves.length) return;
    for (const [r, [y, h]] of moves) { r.setAttribute("y", y); r.setAttribute("height", h); }
    tween(g, 680, (k) => {
      for (const [r, a, b] of moves) {
        if (!r.isConnected) continue;
        r.setAttribute("y", k === 1 ? b[0] : (a[0] + (b[0] - a[0]) * k).toFixed(2));
        r.setAttribute("height", k === 1 ? b[1] : Math.max(0, a[1] + (b[1] - a[1]) * k).toFixed(2));
      }
    });
  }
  // crosshair: the column under the pointer, crossed by a line at its total,
  // the total told on the axis
  function crosshair(box) {
    const g = box?.querySelector(".plot > svg");
    if (!g || g._ux) return;
    g._ux = true;
    const plot = g.parentElement, grid = g.querySelector("line.grid");
    if (!grid) return;
    const line = document.createElementNS(NS, "line"), dot = document.createElementNS(NS, "circle");
    line.setAttribute("class", "ux-xh");
    dot.setAttribute("class", "ux-xd");
    dot.setAttribute("r", 3);
    const tag = document.createElement("span");
    tag.className = "ux-ytag";
    const hide = () => { line.style.display = dot.style.display = "none"; tag.hidden = true; };
    hide();
    g.append(line, dot);
    plot.append(tag);
    const x1 = +grid.getAttribute("x1"), x2 = +grid.getAttribute("x2");
    g.addEventListener("pointermove", () => {
      if (still()) return hide();
      const hot = g.querySelector("rect.hot");
      if (!hot || hot.style.display === "none") return hide();
      const hx = +hot.getAttribute("x"), hw = +hot.getAttribute("width");
      let top = Infinity;
      for (const r of g.querySelectorAll("rect.col:not(.mark)")) {
        const x = +r.getAttribute("x");
        if (x >= hx - .5 && x <= hx + hw) top = Math.min(top, +r.getAttribute("y"));
      }
      if (!isFinite(top)) return hide();
      for (const [k, v] of [["x1", x1], ["x2", x2], ["y1", top], ["y2", top]]) line.setAttribute(k, v);
      dot.setAttribute("cx", hx + hw / 2);
      dot.setAttribute("cy", top);
      line.style.display = dot.style.display = "";
      const sum = box.querySelector(".tip .sum em")?.textContent || "";
      tag.textContent = sum.split(" · ")[0];
      tag.style.top = top + "px";
      tag.style.right = (plot.clientWidth - x1 + 4) + "px";
      tag.hidden = !tag.textContent;
    });
    g.addEventListener("pointerleave", hide);
  }

  // ---------- the Context tab ----------
  // context.js draws the pane whole on each refresh; here what it says runs
  // from what it said. Figures roll, bars, segments and the ring move to their
  // new size, a window cell that changed flashes, and an agent or session new
  // to the pane comes in. on() says whether the tab is the one shown.
  const waffles = new Map(), entered = new Set();
  function contextMotion(pane, on = () => true, prefix = "ctx|") {
    if (!pane) return;
    const qa = (s) => [...pane.querySelectorAll(s)];
    const owner = (n) => {
      const a = n.closest(".ctx-agent"), s = n.closest(".ctx-sess");
      if (a) return "a|" + (a.querySelector(".ctx-who b")?.textContent || "");
      if (s) return "s|" + (s.querySelector(".ctx-sess-name")?.textContent || "");
      return "p";
    };
    // each node keyed by whom it belongs to and its place among those alike
    const each = (sel, name, f) => {
      const at = new Map();
      for (const n of qa(sel)) {
        const o = owner(n), i = at.get(o) || 0;
        at.set(o, i + 1);
        f(n, prefix + o + "|" + name + "|" + i);
      }
    };
    // a bar not drawn before is set, not grown
    const grow = (n, k) => { if (seen.has(k)) width(n, k); else seen.set(k, n.style.width); };
    const ease = "cubic-bezier(.2, .8, .2, 1)";
    new MutationObserver(() => requestAnimationFrame(() => {
      if (!on()) return;
      const first = !entered.size;
      each(".ctx-big", "big", (n, k) => text(n, k));
      each(".ctx-ring > b", "score", (n, k) => text(n, k));
      each(".ctx-ring .arc", "arc", (arc, k) => {
        const to = parseFloat(arc.style.getPropertyValue("--to")), was = seen.get(k);
        seen.set(k, to);
        if (was === undefined || was === to || still() || !visible(arc) || !arc.animate) return;
        arc.animate([{ strokeDashoffset: was }, { strokeDashoffset: to }], { duration: 900, easing: ease });
      });
      each(".ctx-fact b", "fact", (n, k) => text(n, k));
      each(".ctx-score .v", "pts", (n, k) => text(n, k));
      each(".ctx-score .ctx-bar i", "bar", grow);
      each(".ctx-cache .ctx-bar i", "cache", grow);
      each(".ctx-mini i", "mini", grow);
      each(".ctx-sess-peak", "peak", (n, k) => text(n, k));
      each(".ctx-share i", "share", (n, k) => {
        const to = parseFloat(n.style.flexGrow) || 0, was = seen.get(k);
        seen.set(k, to);
        if (was === undefined || was === to || still() || !visible(n) || !n.animate) return;
        n.animate([{ flexGrow: was }, { flexGrow: to }], { duration: 720, easing: ease });
      });
      for (const w of qa(".ctx-waffle")) {
        const k = prefix + owner(w) + "|waffle", now = [...w.children].map((c) => c.className), was = waffles.get(k);
        waffles.set(k, now);
        if (!was || still() || !visible(w)) continue;
        now.forEach((c, i) => {
          if (c !== was[i] && w.children[i]?.animate) w.children[i].animate([{ transform: "scale(1.6)" }, { transform: "scale(1)" }], { duration: 560, easing: "ease-out" });
        });
      }
      for (const n of qa(".ctx-agent, .ctx-sess")) {
        const k = prefix + owner(n) + "|in";
        if (entered.has(k)) continue;
        entered.add(k);
        if (first || still() || !visible(n) || !n.animate) continue;
        n.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 380, easing: "ease-out" });
      }
    })).observe(pane, { childList: true });
  }

  // ---------- the Sessions tab ----------
  // the page's own structure, set moving: the six figures roll, the bars of the
  // projects and models move to their width and their figures roll, the top
  // sessions and the list roll theirs, a session new to the list is flashed,
  // an hour of the week that changed its level jumps. root holds the tab,
  // prefix keeps its figures apart from another page's
  const heat = new Map(), listed = new Map();
  function sessionsMotion(root, prefix = "") {
    const all = (node, s) => [...node.querySelectorAll(s)];
    all(root, "#sessStats .kpi").forEach((tile, i) => text(tile.querySelector("b"), prefix + "kpi|" + i));
    text(root.querySelector("#sessChart .sess-chart-head .peak"), prefix + "peak");
    for (const card of all(root, "#sessProjects, #sessModels")) {
      all(card, ".sess-bar").forEach((r) => {
        const k = prefix + card.id + "|" + (r.querySelector(".n")?.textContent || "");
        width(r.querySelector(".track i"), k + "|w");
        text(r.querySelector(".v"), k + "|v");
        text(r.querySelector(".c"), k + "|c");
      });
    }
    all(root, "#sessTop .sess-top").forEach((r) => text(r.querySelector(".v"), prefix + "top|" + (r.querySelector(".name")?.textContent || "")));
    const rows = all(root, "#sessList .sess-item > .row").map((r) => [r.querySelector(".name")?.textContent || "", r]);
    for (const [name, r] of rows) {
      text(r.querySelector(".num b"), prefix + "row|" + name + "|n");
      text(r.querySelector(".cost"), prefix + "row|" + name + "|c");
    }
    const was = listed.get(prefix);
    listed.set(prefix, new Set(rows.map(([n]) => n)));
    if (was && !still()) for (const [name, r] of rows) if (!was.has(name) && visible(r) && r.animate) r.animate([{ backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)" }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
    const hours = root.querySelector("#sessHours .sess-hours");
    if (hours) {
      const cells = all(hours, ":scope > i"), now = cells.map((c) => c.className), old = heat.get(prefix);
      heat.set(prefix, now);
      if (old && !still() && visible(hours)) cells.forEach((c, i) => { if (now[i] !== old[i] && c.animate) c.animate([{ transform: "scale(1.6)" }, { transform: "scale(1)" }], { duration: 520, easing: "ease-out" }); });
    }
  }
  window.UsageFx = { figure, roll, text, width, delta, columns, crosshair, seen, context: contextMotion, sessions: sessionsMotion };

  // ---------- the app's Usage page ----------
  if (typeof renderUsage !== "function" || mode === "panel") return;
  const $1 = (s, r = document) => r.querySelector(s), $all = (s, r = document) => [...r.querySelectorAll(s)];
  const inUsage = (n) => !!n?.closest?.("#view-usage");
  const fmt = (n) => (typeof fmtN === "function" ? fmtN(n) : String(n));
  const tokensIn = (x) => (typeof tokensOf === "function" ? tokensOf(x) : (x.input || 0) + (x.output || 0));
  const active = (tab) => view === "usage" && (!tab || usageTab === tab) && !document.hidden;
  new MutationObserver(() => { if ($1("#view-usage").hidden) finish(); }).observe($1("#view-usage"), { attributes: true, attributeFilter: ["hidden"] });

  // the lists under the Overview: each row by its list and name
  function lists() {
    for (const id of ["usageAgents", "usageModels", "usageAccounts", "usageKeys"]) {
      for (const r of $all("#" + id + " .row.stat")) {
        const k = period + "|" + id + "|" + ($1(".who .name", r)?.textContent || "");
        text($1(".num b", r), k + "|n");
        text($1(".cost", r), k + "|c");
        width($1(".share i", r), k + "|w");
      }
    }
  }
  // the figures of the Overview, and what a refresh added to them
  let lastOv = null;
  function figures() {
    $all("#stats .kpi").forEach((tile) => {
      const key = period + "|kpi|" + tile.dataset.metric;
      text($1(".v", tile), key);
      width($1(".meter i", tile), key + "|meter");
    });
    text($1("#usageCost b"), period + "|cost");
    const u = usage;
    if (!u) return;
    const cur = { period, calls: u.calls || 0, tokens: tokensIn(u) };
    if (lastOv && lastOv.period === cur.period) {
      if (cur.tokens > lastOv.tokens) delta($1('#stats [data-metric="tokens"]'), "+" + fmt(cur.tokens - lastOv.tokens));
      if (cur.calls > lastOv.calls) delta($1('#stats [data-metric="calls"]'), "+" + (cur.calls - lastOv.calls));
    }
    lastOv = cur;
  }

  // the Overview's timeline, stacked by model: the Requests tab's answer for
  // the same period, through the gateway only, as the Overview counts
  let ov = null, ovFlight = null;
  const ovWant = () => new URLSearchParams({ period, limit: "1", via: "through" }).toString();
  function overview() {
    const box = $1("#chart");
    if (!active("usage") || !box || box.hidden || !usage?.calls) return;
    const want = ovWant(), source = usage;
    if (ov && ov.want === want && ov.source === source) { drawOverview(box); return; }
    box.classList.remove("ux-split");
    if (ovFlight) return;
    ovFlight = api("usage/requests?" + want).then((l) => {
      if (want !== ovWant() || source !== usage || l?.period && l.period !== period ||
          !Array.isArray(l?.series) || !l.series.length || !Array.isArray(l.by?.model)) return;
      ov = { want, source, l };
      if (active("usage") && !box.hidden) drawOverview(box);
    }).catch(() => {}).finally(() => {
      ovFlight = null;
      // A period pick or refresh that arrived during this read still gets
      // its own chart, even when automatic refresh is turned off.
      if (want !== ovWant() || source !== usage) overview();
    });
  }
  function drawOverview(box) {
    const l = ov.l;
    box.classList.add("ux-split");
    const plot = el("div", "led-chart");
    plot.id = "uxChart";
    const head = el("div", "usage-trend-head");
    head.append(el("span", "usage-trend-title", t("Tokens including cache reads and writes") + " · " + t("Model")));
    head.title = t("Tokens including cache reads and writes");
    const body = el("div", "led-body");
    const rank = el("div", "led-rank usage-rank");
    rank.id = "uxRank";
    body.append(plot, rank);
    box.replaceChildren(head, body);
    drawLedColumns(plot, l, "model", "tokens", false);
    rank.chart = plot;
    drawLedRank(rank, l, "model", "tokens", "", (x) => {
      ledOffset = 0; ledPurpose = ""; ledAgent = ""; ledProvider = ""; ledAccount = ""; ledCallerKey = "";
      ledFailed = false; ledRoute = 0; ledRouteInfo = null; ledBeforeRoute = null; ledComputer = ""; ledDay = "";
      ledVia = "through"; ledModel = x.id; ledQuery = x.id;
      $1("#ledQ").value = x.id;
      usageTab = "requests";
      try { localStorage.setItem("magpie.usageTab", usageTab); } catch {}
      loadUsage().catch((e) => status(e.message, "err"));
    });
  }
  new ResizeObserver(() => {
    const plot = $1("#uxChart");
    if (plot && ov?.source === usage && ov.want === ovWant() && active("usage")) drawLedColumns(plot, ov.l, "model", "tokens", false);
  }).observe($1("#chart"));

  const _renderUsage = renderUsage;
  renderUsage = function () {
    $1("#chart")?.classList.remove("ux-split");
    const r = _renderUsage.apply(this, arguments);
    if (active("usage")) { figures(); lists(); overview(); }
    return r;
  };

  // the allowance and balance cards: each card's figures and meters
  if (typeof renderQuotas === "function") {
    const _renderQuotas = renderQuotas;
    renderQuotas = function () {
      const r = _renderQuotas.apply(this, arguments);
      if (active("usage")) {
        for (const card of $all("#subscriptionUsage > .subscription-card")) {
          let account = card.dataset.card || card.dataset.provider;
          for (const block of card.children) {
            if (block.dataset.card) account = block.dataset.card;
            const k = "q|" + account;
            if (block.classList.contains("quota-balance")) {
              $all("b", block).forEach((b, i) => text(b, k + "|balance|" + i));
              $all(".quota-track > i", block).forEach((m, i) => width(m, k + "|balance-meter|" + i));
            }
            for (const quota of $all(".quota", block)) {
              const key = k + "|" + $1(".quota-labels > span", quota)?.textContent + "|" + quotaLeft;
              $all(".quota-n > span", quota).forEach((b, i) => text(b, key + "|n" + i));
              width($1(".quota-track > i", quota), key + "|w");
            }
          }
        }
      }
      return r;
    };
  }

  // every column chart on the page: grown, and crossed under the pointer
  if (typeof drawLedColumns === "function") {
    const _draw = drawLedColumns;
    drawLedColumns = function (box, l, split, metric) {
      const r = _draw.apply(this, arguments);
      if (inUsage(box) && active()) {
        if (metric !== "speed") columns(box, (box.id || "") + "|" + period + "|" + split + "|" + metric, l.series);
        crosshair(box);
      }
      return r;
    };
  }
  // the Requests tab's ranking: its figures and bars, by what it ranks
  if (typeof drawLedRank === "function") {
    const _rank = drawLedRank;
    drawLedRank = function (box, l, split, metric) {
      const r = _rank.apply(this, arguments);
      if (inUsage(box) && active()) for (const b of $all(".rk", box)) {
        const k = "rk|" + box.id + "|" + period + "|" + (usageTab === "requests" ? ledParams({}) : "through") + "|" + split + "|" + metric + "|" + ($1(".rk-nm", b)?.textContent || "");
        text($1(".rk-val", b), k + "|v");
        width($1(".rk-bar i", b), k + "|w");
      }
      return r;
    };
  }
  // the Requests tab: its figures, what a refresh added, and the requests it
  // brought, each flashed once as it comes in at the top
  if (typeof renderLedger === "function") {
    const _led = renderLedger;
    let lastLed = null, keysSeen = null, keysWant = "";
    renderLedger = function () {
      const r = _led.apply(this, arguments);
      if (active("requests")) {
        for (const b of $all("#ledKpi .blk")) {
          const k = "led|" + ledParams({}) + "|" + ($1(".k", b)?.textContent || "");
          text($1(".v", b), k);
          width($1(".meter i", b), k + "|m");
        }
        const l = ledger;
        if (!l) return r;
        const want = typeof ledParams === "function" ? ledParams({}) : "";
        const tot = typeof allTokens === "function" ? allTokens(l) : 0;
        if (lastLed && lastLed.want === want) {
          const blks = $all("#ledKpi .blk");
          if (tot > lastLed.tokens) delta(blks[0], "+" + fmt(tot - lastLed.tokens));
          if ((l.calls || 0) > lastLed.calls) delta(blks[1], "+" + (l.calls - lastLed.calls));
        }
        lastLed = { want, calls: l.calls || 0, tokens: tot };
        const rows = $all("#ledWrap tr.led-row"), keys = (l.rows || []).map((x) => typeof ledKey === "function" ? ledKey(x) : x.t);
        if (keysSeen && keysWant === want && !ledOffset && !still()) {
          rows.forEach((tr, i) => { if (keys[i] !== undefined && !keysSeen.has(keys[i])) tr.classList.add("ux-fresh"); });
        }
        keysSeen = new Set(keys);
        keysWant = want;
      }
      return r;
    };
  }

  // the Context tab: contextMotion (above), on while the tab is shown
  contextMotion($1("#contextPane"), () => active("context"));
  if (typeof renderSessTop === "function") {
    const _renderSessTop = renderSessTop;
    renderSessTop = function () {
      const r = _renderSessTop.apply(this, arguments);
      try { if (active("sessions")) sessionsMotion(document); } catch {}
      return r;
    };
  }
  if (typeof renderSessions === "function") {
    const _renderSessions = renderSessions;
    renderSessions = function () {
      const r = _renderSessions.apply(this, arguments);
      try { if (active("sessions")) sessionsMotion(document); } catch {}
      return r;
    };
  }
})();
