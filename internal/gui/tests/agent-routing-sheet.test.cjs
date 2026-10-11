// Run with Node's test runner and Playwright on the module path; see README.md.
// The routing sheet of an agent's model list: routing groups are off until
// one is switched on for that agent, so an agent goes on its own provider's
// models and through a group only when the reader says so. The sheet is the
// list's own place inside the pop, and the switch slides as the write goes.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");

// the catalog: one provider's models, and two routing groups
const full = () => [
  { id: "group/fast", name: "Fast", group: "Routing groups", icons: ["openai"], candidates: ["group/fast"] },
  { id: "group/slow", name: "Slow", group: "Routing groups", icons: ["openai"], candidates: ["group/slow"] },
  { id: "relay/m1", name: "M1", group: "Relay", icon: "openai", candidates: ["relay"] },
  { id: "relay/m2", name: "M2", group: "Relay", icon: "openai", candidates: ["relay"] },
];

function fixture(lang) {
  // the groups switched on for this agent, as settings' GroupsOn holds them
  let on = [];
  const all = [
    { name: "group/fast", kind: "group", label: "Fast", icon: "openai", entries: 1 },
    { name: "group/slow", kind: "group", label: "Slow", icon: "openai", entries: 2 },
  ];
  // what the agent's list is drawn from: its provider's models, plus the
  // models of the groups switched on
  const listed = () => full().filter((m) => m.group !== "Routing groups" || on.includes(m.id));
  const count = () => ({ shown: listed().length, listed: listed().length, by: [] });
  const state = () => ({
    agents: [{
      id: "codex", name: "Codex", path: "/test/config.toml", icon: "codex-color", wired: true,
      fields: [{ key: "model", label: "model", value: "magpie/relay/m1", options: [{ value: "magpie/relay/m1", label: "M1", ref: "relay/m1" }] }],
      models: count(),
    }],
    profiles: [], settings: { lang, theme: "light" },
  });
  const scope = () => ({ scope: { agent: "codex", names: on, all }, used: { shown: listed().length, catalog: full().length, names: on.length } });
  async function serve(route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state());
    if (url.pathname === "/api/agent-scope/codex") {
      if (req.method() === "POST") {
        const { id, on: want } = req.postDataJSON();
        on = want ? [...new Set([...on, id])] : on.filter((g) => g !== id);
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
  return { serve, on: () => on };
}

const W = {
  en: {
    off: "Routing: off", one: "Routing: 1", two: "Routing: 2",
    head: (n, all) => `${n} of ${all} on`,
    note: /^Codex goes on its own provider's models/,
    models: (n) => `${n} models`,
  },
  zh: {
    off: "路由：全关", one: "路由：1", two: "路由：2",
    head: (n, all) => `${n} / ${all} 已开`,
    note: /^Codex 走它自己供应商的模型/,
    models: (n) => `${n} 个模型`,
  },
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: an agent's routing sheet`, async (t) => {
      const w = W[lang];
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
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

      // routing is off: the agent's list has its provider's models alone
      const scopeBtn = pop.locator(".am-scope");
      assert.equal(await scopeBtn.innerText(), w.off);
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 2);

      // the sheet: every routing group, all switched off, in the list's place
      await scopeBtn.click();
      const sheet = pop.locator(".am-sheet");
      await sheet.waitFor();
      assert.match(await sheet.locator(".am-d").innerText(), w.note);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), w.head(0, 2));
      assert.equal(await sheet.locator(".am-sr").count(), 2);
      assert.equal(await sheet.locator('.am-sr[aria-checked="false"]').count(), 2);
      assert.equal(await sheet.locator(".am-sr .lib-switch.on").count(), 0);
      assert.equal(await pop.locator(".am-search").isVisible(), false, "the sheet takes the list's tools");
      // a group's row says how many models it brings
      const slow = sheet.locator(".am-sr", { hasText: "Slow" }).first();
      assert.equal(await slow.locator(".am-sc-n").innerText(), w.models(2));

      // switching one on saves at once and brings its models into the list
      await sheet.locator(".am-sr", { hasText: "Fast" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.one);
      assert.deepEqual(fx.on(), ["group/fast"]);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), w.head(1, 2));
      assert.equal(await sheet.locator(".am-sr .lib-switch.on").count(), 1);
      assert.equal(await sheet.locator('.am-sr[aria-checked="true"]').count(), 1);

      // closing it: the group's models are in the list now
      await scopeBtn.click();
      await sheet.waitFor({ state: "detached" });
      assert.equal(await scopeBtn.innerText(), w.one);
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 3);

      // and off again, from the same switch
      await scopeBtn.click();
      await sheet.waitFor();
      assert.equal(await sheet.locator(".am-sh .c").innerText(), w.head(1, 2));
      await sheet.locator(".am-sr", { hasText: "Fast" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.off);
      assert.deepEqual(fx.on(), []);
      assert.equal(await sheet.locator(".am-sr .lib-switch.on").count(), 0);

      // two at once
      await sheet.locator(".am-sr", { hasText: "Fast" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.one);
      await sheet.locator(".am-sr", { hasText: "Slow" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, w.two);
      assert.deepEqual(fx.on().sort(), ["group/fast", "group/slow"]);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), w.head(2, 2));
      await scopeBtn.click();
      await sheet.waitFor({ state: "detached" });
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 4, "the provider's two and both groups'");
      assert.deepEqual(errors, []);
    });
  }
}