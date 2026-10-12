// Run with Node's test runner and Playwright on the module path; see README.md.
// An agent's model list, in the two steps the reader works in: the left rail
// lists every routing group with its own switch (may this agent go through
// it), and picking one shows that group's models on the right, a tick each
// (is the agent shown that model). A group's models are readable whether it
// is on or off, so they can be picked before the group itself is switched on.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");

// the catalog: two providers' own models, plus the groups' entries (the
// rail is only drawn with more than two sources, so a second provider is
// needed for its own headings to appear)
const full = () => [
  { id: "relay/m1", name: "M1", group: "Relay", icon: "openai", candidates: ["relay"] },
  { id: "relay/m2", name: "M2", group: "Relay", icon: "openai", candidates: ["relay"] },
  { id: "other/m1", name: "OTHER1", group: "Other", icon: "generic", candidates: ["other"] },
  { id: "third/m1", name: "THIRD1", group: "Third", icon: "generic", candidates: ["third"] },
];

function fixture(lang) {
  let on = [];
  let hidden = [];
  const all = [
    { name: "group/fast", kind: "group", label: "Fast", icon: "openai", entries: 2 },
    { name: "group/slow", kind: "group", label: "Slow", icon: "openai", entries: 1 },
  ];
  // two members under different providers' marks, so a row's own provider
  // shows both in the source name and in the slot before it
  const members = {
    "group/fast": [
      { id: "relay/m1", name: "M1", provider: "Relay", icon: "openai" },
      { id: "relay/m2", name: "M2", provider: "Relay", icon: "anthropic" },
    ],
    "group/slow": [{ id: "relay/m2", name: "M2", provider: "Relay", icon: "anthropic" }],
  };
  const hiddenSet = () => new Set(hidden);
  const listed = () => {
    const off = hiddenSet();
    const out = full().filter((m) => !off.has(m.id));
    for (const g of on) {
      out.push({ id: g, name: g === "group/fast" ? "Fast" : "Slow", group: "Routing groups", icons: ["openai"], candidates: [g] });
    }
    return out;
  };
  const count = () => ({ shown: listed().length, listed: listed().length, by: [] });
  const state = () => ({
    agents: [{
      id: "codex", name: "Codex", path: "/test/config.toml", icon: "codex-color", wired: true,
      fields: [{ key: "model", label: "model", value: "magpie/relay/m1", options: [{ value: "magpie/relay/m1", label: "M1", ref: "relay/m1" }] }],
      models: count(),
    }],
    profiles: [], settings: { lang, theme: "light" },
  });
  const scope = () => ({
    scope: {
      agent: "codex", names: on, all, hidden,
      models: all.map((g) => ({ id: g.name, models: (members[g.name] || []).map((m) => ({ ...m, hidden: hiddenSet().has(m.id) })) })),
    },
    used: { shown: listed().length, catalog: full().length + all.length, names: on.length },
  });
  async function serve(route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state());
    if (url.pathname === "/api/agent-scope/codex") {
      if (req.method() === "POST") {
        const body = req.postDataJSON();
        if (body.hidden) hidden = body.hidden;
        if (body.on) on = [...new Set([...on, body.id])];
        else on = on.filter((g) => g !== body.id);
        return json({ ...scope(), models: listed(), count: count() });
      }
      return json(scope());
    }
    if (url.pathname === "/api/agent-models/codex") return json({ models: listed(), count: count() });
    if (url.pathname === "/api/groups") return json({ groups: [] });
    if (url.pathname === "/api/providers") return json({ providers: [], gateway: { running: true, window: true } });
    if (url.pathname.startsWith("/api/")) return json({});
    const file = path.join(assets, url.pathname === "/" ? "index.html" : url.pathname);
    const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)];
    await route.fulfill({ body: await fs.readFile(file), contentType });
  }
  return { serve, on: () => on, hidden: () => hidden };
}

const W = {
  en: { seg: ["All", "Shown", "Hidden"], routes: "Routing groups", providers: "Providers", note: /^This routing group is off for Codex/ },
  zh: { seg: ["全部", "已显示", "已隐藏"], routes: "路由组", providers: "供应商", note: /^这个路由组对 Codex 是关着的/ },
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: a routing group in the rail, its models on the right`, async (t) => {
      const w = W[lang];
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const page = await browser.newPage({ viewport: { width: 1040, height: 820 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const fx = fixture(lang);
      await page.route("**/*", fx.serve);
      t.after(async () => {
        if (process.env.ARTIFACT_DIR) {
          await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-${lang}-rail.png`) });
        }
        await browser.close();
      });
      await page.goto("http://magpie.test/");
      const row = page.locator('.row.agent[data-id="codex"]');
      await row.locator(".ag-link").click();
      await row.locator(".ag-exp .ag-chips .ag-quiet").click();
      const pop = page.locator(".am-pop:not(.leaving)");
      await pop.waitFor();
      await page.waitForFunction(() => document.getAnimations().length === 0);
      await page.waitForTimeout(400); // the scope read comes back

      // the scope read is what fills the rail's groups; wait for it
      await pop.locator(".am-railhead").first().waitFor();

      // the toolbar is All / Shown / Hidden alone: no Order, no Scope button
      assert.deepEqual(await pop.locator(".am-seg button").allInnerTexts(), w.seg);
      assert.equal(await pop.locator(".am-scope").count(), 0, "the routing button is gone");
      assert.equal(await pop.locator(".am-search").isVisible(), true);

      // the rail holds the routing groups first, then the providers
      assert.deepEqual(await pop.locator(".am-railhead").allInnerTexts(), [w.routes, w.providers].map((s) => s.toUpperCase()));
      const rails = pop.locator(".am-ri");
      const fast = rails.filter({ hasText: "Fast" }).first();
      const slow = rails.filter({ hasText: "Slow" }).first();
      assert.equal(await rails.filter({ has: page.locator(".lib-switch") }).count(), 2, "one switch a group");

      // a group's own models are readable while it is off, with the note; the
      // source leads each row, so two providers' same-named models differ
      await fast.click();
      await page.waitForTimeout(200);
      assert.match(await pop.locator(".am-note").innerText(), w.note);
      assert.deepEqual(await pop.locator(".am-mr .n").allInnerTexts(), ["Relay\nM1", "Relay\nM2"]);
      assert.equal(await pop.locator('.am-mr[aria-checked="true"]').count(), 2);
      // each row leads with whose model it is, its provider's own mark in the
      // slot the provider's own rows use, so two same-named members differ at
      // a glance — not only by reading the source name
      assert.deepEqual(await pop.locator(".am-mr .lg[data-icon]").evaluateAll((es) => es.map((e) => e.dataset.icon)),
        ["openai", "anthropic"], "a member row carries its provider's mark");

      // switching it on lets the agent go through it: the group joins the
      // list, and the note goes
      await fast.locator(".lib-switch").click();
      await page.waitForTimeout(300);
      assert.deepEqual(fx.on(), ["group/fast"]);
      assert.equal(await fast.locator(".lib-switch.on").count(), 1);
      assert.equal(await pop.locator(".am-note").count(), 0, "the note goes once it is on");

      // and a tick under the group hides that model for this agent alone
      await pop.locator(".am-mr").first().click();
      await page.waitForTimeout(300);
      assert.deepEqual(fx.hidden(), ["relay/m1"]);
      assert.deepEqual(fx.on(), ["group/fast"], "the group is still on");
      assert.equal(await pop.locator('.am-mr[aria-checked="false"]').count(), 1);

      // "Hidden" shows what is not in the list; "All" brings everything back
      await pop.locator(".am-seg button", { hasText: w.seg[2] }).click();
      await page.waitForTimeout(200);
      assert.deepEqual(await pop.locator(".am-mr .n").allInnerTexts(), ["Relay\nM1"]);
      await pop.locator(".am-seg button", { hasText: w.seg[0] }).click();
      await page.waitForTimeout(200);
      assert.equal(await pop.locator(".am-mr").count(), 2);

      // the second group, its own single model, and off again
      await slow.click();
      await page.waitForTimeout(200);
      assert.deepEqual(await pop.locator(".am-mr .n").allInnerTexts(), ["Relay\nM2"]);
      await slow.locator(".lib-switch").click();
      await page.waitForTimeout(300);
      assert.deepEqual(fx.on().sort(), ["group/fast", "group/slow"]);
      await slow.locator(".lib-switch").click();
      await page.waitForTimeout(300);
      assert.deepEqual(fx.on(), ["group/fast"]);
      assert.deepEqual(errors, []);
    });
  }
}