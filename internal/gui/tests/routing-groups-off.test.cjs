// Run with Node's test runner and Playwright on the module path; see README.md.
// 「Turn routing groups off everywhere」: the Agents page's one button takes
// the catalog's routing groups out of every agent's range, so each agent
// goes on its own provider's models and a group is turned on for one agent
// at a time (in that agent's Scope sheet). The button goes away once no
// agent has a group left in range.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");

const catalog = () => [
  { id: "group/fast", name: "Fast", group: "Routing groups", icons: ["openai"], candidates: ["group/fast"] },
  { id: "relay/m1", name: "M1", group: "Relay", icon: "openai", candidates: ["relay"] },
];

function fixture(lang) {
  let visible = { codex: ["relay", "group/fast"] };
  let posts = 0;
  const listed = () => catalog().filter((m) => m.candidates.some((c) => (visible.codex || []).some((n) => n.toLowerCase() === c)));
  const count = () => ({ shown: listed().length, listed: listed().length, by: [] });
  const state = () => ({
    agents: [{
      id: "codex", name: "Codex", path: "/test/config.toml", icon: "codex-color", wired: true,
      fields: [{ key: "model", label: "model", value: "magpie/relay/m1", options: [{ value: "magpie/relay/m1", label: "M1", ref: "relay/m1" }] }],
      models: count(),
    }],
    profiles: [], settings: { lang, theme: "light", visible },
  });
  async function serve(route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state());
    if (url.pathname === "/api/agents/routing-groups-off") {
      posts++;
      visible = { codex: ["relay"] };
      return json({ ...state(), changed: 1 });
    }
    if (url.pathname === "/api/agent-models/codex") return json({ models: listed(), count: count() });
    if (url.pathname === "/api/agent-scope/codex") return json({ scope: { agent: "codex", names: visible.codex, all: [] }, used: { shown: listed().length, catalog: catalog().length, names: (visible.codex || []).length } });
    if (url.pathname === "/api/groups") return json({ groups: [] });
    if (url.pathname === "/api/providers") return json({ providers: [], gateway: { running: true, window: true } });
    if (url.pathname.startsWith("/api/")) return json({});
    const file = path.join(assets, url.pathname === "/" ? "index.html" : url.pathname);
    const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)];
    await route.fulfill({ body: await fs.readFile(file), contentType });
  }
  return { serve, posts: () => posts };
}

const W = {
  en: { off: "Turn routing groups off everywhere", done: "Routing groups are off for 1 agents" },
  zh: { off: "一键关掉所有 Agent 的路由组", done: "已关掉 1 个 Agent 的路由组" },
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: routing groups off everywhere`, async (t) => {
      const w = W[lang];
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const fx = fixture(lang);
      await page.route("**/*", fx.serve);
      t.after(async () => { await browser.close(); });
      await page.goto("http://magpie.test/");
      const lead = page.locator("#agentsLead");
      await lead.waitFor();
      const off = lead.locator(".ag-nogroups");
      await off.waitFor();
      assert.equal(await off.innerText(), w.off);
      if (process.env.ARTIFACT_DIR) {
        await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-lead-off.png`) });
      }
      await off.click();
      await page.waitForFunction(() => document.querySelector(".ag-nogroups") === null, null, { timeout: 5000 });
      assert.equal(fx.posts(), 1);
      // said in words too, and the button is gone: no agent has a group left
      await page.waitForFunction((want) => (document.querySelector("#status")?.textContent || "").includes(want), w.done, { timeout: 5000 });
      assert.equal(await lead.locator(".ag-nogroups").count(), 0);
      assert.deepEqual(errors, []);
    });
  }
}
