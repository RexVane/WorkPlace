// Run with Node's test runner and Playwright on the module path; see README.md.
// The routing sheet of an agent's model list, in the two steps the reader
// works in: switch a routing group on for the agent, and then, under it,
// tick which of that group's models the agent is shown. Routing groups are
// off until one is switched on; a model ticked off is hidden from this agent
// alone, while the group still routes through it.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");

// the catalog: a provider's own models, and a group made of two of them
const full = () => [
  { id: "relay/m1", name: "M1", group: "Relay", icon: "openai", candidates: ["relay"] },
  { id: "relay/m2", name: "M2", group: "Relay", icon: "openai", candidates: ["relay"] },
  { id: "relay/m3", name: "M3", group: "Relay", icon: "openai", candidates: ["relay"] },
];

function fixture(lang) {
  // what the sheet holds: the groups on, and the whole hidden set
  let on = [];
  let hidden = [];
  const all = [
    { name: "group/fast", kind: "group", label: "Fast", icon: "openai", entries: 2 },
    { name: "group/slow", kind: "group", label: "Slow", icon: "openai", entries: 1 },
  ];
  const members = {
    "group/fast": [
      { id: "relay/m1", name: "M1", icon: "openai" },
      { id: "relay/m2", name: "M2", icon: "openai" },
    ],
    "group/slow": [{ id: "relay/m3", name: "M3", icon: "openai" }],
  };
  const hiddenSet = () => new Set(hidden);
  // the models the agent's list holds: its provider's, plus the groups it
  // goes through — less what is hidden
  const listed = () => {
    const off = hiddenSet();
    const out = full().filter((m) => !off.has(m.id));
    for (const g of on) out.push({ id: g, name: g === "group/fast" ? "Fast" : "Slow", group: "Routing groups", icons: ["openai"], candidates: [g] });
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
  const off = hiddenSet();
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
  en: {
    off: "Routing: off", one: "Routing: 1", two: "Routing: 2",
    head: (n, all) => `${n} of ${all} on`,
    note: /^Codex goes on its own provider's models/,
  },
  zh: {
    off: "路由：全关", one: "路由：1", two: "路由：2",
    head: (n, all) => `${n} / ${all} 已开`,
    note: /^Codex 走它自己供应商的模型/,
  },
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: an agent's routing sheet, group then its models`, async (t) => {
      const w = W[lang];
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const fx = fixture(lang);
      await page.route("**/*", fx.serve);
      t.after(async () => {
        if (process.env.ARTIFACT_DIR) {
          await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-${lang}-routing.png`) });
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

      // step one: no group is on, so no group has models under it
      const scopeBtn = pop.locator(".am-scope");
      assert.equal(await scopeBtn.innerText(), w.off);
      await scopeBtn.click();
      const sheet = pop.locator(".am-sheet");
      await sheet.waitFor();
      assert.match(await sheet.locator(".am-d").innerText(), w.note);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), w.head(0, 2));
      assert.equal(await sheet.locator(".am-sr").count(), 2);
      assert.equal(await sheet.locator(".am-sown").count(), 0, "no group is on, so none is open");
      assert.equal(await pop.locator(".am-search").isVisible(), false, "the sheet takes the list's tools");

      // switching one on opens it, with its own models under the switch
      await sheet.locator(".am-sr", { hasText: "Fast" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.one);
      assert.deepEqual(fx.on(), ["group/fast"]);
      assert.equal(await sheet.locator(".am-sown").count(), 1);
      const own = sheet.locator(".am-sown .am-mown");
      assert.equal(await own.count(), 2, "Fast is made of two models");
      assert.deepEqual(await own.locator(".n").allInnerTexts(), ["M1", "M2"]);
      assert.equal(await sheet.locator('.am-mown[aria-checked="true"]').count(), 2);

      // step two: ticking one of the group's models hides it from this
      // agent alone — the group stays on, and the other agent's list is
      // untouched (the fixture holds one agent, so only this is checked)
      await own.first().click();
      await page.waitForTimeout(200);
      assert.deepEqual(fx.hidden(), ["relay/m1"], "the ticked-off model is the hidden one");
      assert.deepEqual(fx.on(), ["group/fast"], "the group is still on");
      // the sheet was drawn again, so the rows are looked up afresh
      assert.equal(await pop.locator('.am-sown .am-mown[aria-checked="false"]').count(), 1);
      assert(await pop.locator(".am-sown .am-mown").first().evaluate((e) => e.classList.contains("off")));

      // closing it: the group row and its models are in the list, less the
      // one ticked off (the fixture holds a single agent, so its own
      // provider's M3 is there too)
      await scopeBtn.click();
      await sheet.waitFor({ state: "detached" });
      const ids = await pop.locator(".am-mr:not(.am-sr)").evaluateAll((els) => els.map((e) => e.querySelector(".n")?.textContent));
      assert.deepEqual(ids.filter(Boolean).sort(), ["Fast", "M2", "M3"], "M1 is hidden");

      // and back in the sheet, ticking it on again puts it back
      await scopeBtn.click();
      await sheet.waitFor();
      assert.equal(await sheet.locator(".am-sown .am-mown").count(), 2);
      await sheet.locator(".am-sown .am-mown").first().click();
      await page.waitForTimeout(200);
      assert.deepEqual(fx.hidden(), []);

      // a second group, and its own single model
      await sheet.locator(".am-sr", { hasText: "Slow" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.two);
      assert.deepEqual(fx.on().sort(), ["group/fast", "group/slow"]);
      assert.equal(await sheet.locator(".am-sown").count(), 2);
      assert.deepEqual(await sheet.locator(".am-sown").nth(1).locator(".n").allInnerTexts(), ["M3"]);

      // switching one off closes it again and takes its models out
      await sheet.locator(".am-sr", { hasText: "Slow" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.one);
      assert.equal(await sheet.locator(".am-sown").count(), 1, "the switched-off group has no models shown");
      assert.deepEqual(fx.on(), ["group/fast"]);
      assert.deepEqual(errors, []);
    });
  }
}