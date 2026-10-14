// Run with Node's test runner and Playwright on the module path; see README.md.
// A routing group in an agent's model list leads each of its own models with
// **that model's provider's mark**, and the names still start in one column:
// the marks of four providers, and of one that carries none, begin at the same
// left and stay inside their rows.
//
// The group is read in the two steps the list works in (see
// agent-routing-sheet.test.cjs): the rail lists every routing group, and
// picking one shows its own models on the right. It used to draw a group as a
// row of its own, with its providers' icons stacked in a 56px slot
// (e1fd75de); a2e2044c moved the groups to the rail and gave each member row
// its own provider's mark instead, which is what this checks now.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");
const GROUP = "group/wide";
// four providers' models, one of them carrying no mark of its own
const members = [
  { id: "openai/m1", name: "wide-1", provider: "OpenAI", icon: "openai" },
  { id: "anthropic/m1", name: "wide-2", provider: "Anthropic", icon: "anthropic" },
  { id: "xai/m1", name: "wide-3", provider: "xAI", icon: "xai" },
  { id: "bare/m1", name: "wide-4", provider: "Bare" },
];
const models = [
  { id: "group/wide", name: "wide", group: "Routing groups", icons: ["openai", "anthropic", "xai"] },
  { id: "openai/gpt-6", name: "GPT-6", group: "OpenAI", icon: "openai", logo: "openai", context: 1e6, inUse: true },
  // a third source: the rail is only drawn with more than two of them
  { id: "xai/grok-9", name: "Grok 9", group: "xAI", icon: "xai", logo: "xai", context: 2e6 },
];

async function serve(route) {
  const url = new URL(route.request().url());
  const json = (data) => route.fulfill({ json: data });
  if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"en",theme:"light",web:true};` });
  if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
  if (url.pathname === "/api/state") return json({
    agents: [{
      id: "codex", name: "Codex", path: "/test/config.toml", icon: "codex-color", wired: true,
      fields: [{ key: "model", label: "model", value: "magpie/openai/gpt-6", options: [{ value: "magpie/openai/gpt-6", label: "GPT-6", ref: "openai/gpt-6" }] }],
      models: { shown: models.length, listed: models.length },
    }],
    profiles: [], settings: { lang: "en", theme: "light" },
  });
  if (url.pathname === "/api/agent-models/codex") return json({ models });
  // the group is off for this agent: its models are readable all the same
  if (url.pathname === "/api/agent-scope/codex") return json({
    scope: {
      agent: "codex", names: [], hidden: [],
      all: [{ name: GROUP, kind: "group", label: "wide", entries: members.length }],
      models: [{ id: GROUP, models: members }],
    },
    used: { shown: models.length, catalog: models.length + members.length, names: 0 },
  });
  if (url.pathname === "/api/groups") return json({ groups: [] });
  if (url.pathname === "/api/providers") return json({ providers: [], gateway: { running: true, window: true } });
  if (url.pathname.startsWith("/api/")) return json({});
  const file = path.join(assets, url.pathname === "/" ? "index.html" : url.pathname);
  const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)];
  await route.fulfill({ body: await fs.readFile(file), contentType });
}

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  test(`${engine}: a routing group's models lead with their own providers' marks`, async (t) => {
    const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", serve);
    t.after(async () => {
      if (process.env.ARTIFACT_DIR) {
        await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
        await page.locator(".am-pop").screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-model-groups.png`) }).catch(() => {});
      }
      await browser.close();
    });
    await page.goto("http://magpie.test/");
    await page.locator('.row.agent[data-id="codex"] .ag-link').click();
    await page.locator('.row.agent[data-id="codex"] .ag-exp .ag-chips .ag-quiet').click();
    const pop = page.locator(".am-pop:not(.leaving)");
    await pop.waitFor();

    // the rail lists the group; picking it shows its own models
    const rail = pop.locator(".am-ri").filter({ has: page.locator(".lib-switch") }).first();
    await rail.click();
    await pop.locator(".am-g.routes .am-mr").first().waitFor();

    // each member leads with its own provider's mark — not the group's stack,
    // not a maker's logo, and the one with none draws an empty slot. The slot
    // is the icon element itself (modelRow adds .lg to what icon() gives).
    const marks = await pop.locator(".am-g.routes .am-mr").evaluateAll((rs) => rs.map((r) => ({
      name: r.querySelector(".n")?.innerText.replace(/\n/g, " "),
      icon: r.querySelector(".lg")?.dataset.icon ?? null,
      stack: !!r.querySelector(".lg.ic-stack"),
      fan: !!r.querySelector(".lg > svg"),
    })));
    assert.deepEqual(marks, [
      { name: "OpenAI wide-1", icon: "openai", stack: false, fan: false },
      { name: "Anthropic wide-2", icon: "anthropic", stack: false, fan: false },
      { name: "xAI wide-3", icon: "xai", stack: false, fan: false },
      { name: "Bare wide-4", icon: null, stack: false, fan: false },
    ]);

    // the names start in one column, every mark begins at the row's left, and
    // both stay inside their rows
    const boxes = await pop.locator(".am-g.routes .am-mr").evaluateAll((rs) => rs.map((r) => {
      const b = r.getBoundingClientRect(), lg = r.querySelector(".lg").getBoundingClientRect(), n = r.querySelector(".n").getBoundingClientRect();
      // what's drawn begins where the slot does: the slot is the mark
      return { top: b.top, bottom: b.bottom, lgTop: lg.top, lgBottom: lg.bottom, lgRight: lg.right, n: n.left, mark: lg.left };
    }));
    assert.equal(boxes.length, 4);
    assert.equal(new Set(boxes.map((b) => Math.round(b.n))).size, 1, JSON.stringify(boxes));
    assert(Math.max(...boxes.map((b) => b.mark)) - Math.min(...boxes.map((b) => b.mark)) <= 2, JSON.stringify(boxes));
    for (const b of boxes) {
      assert(b.lgRight <= b.n, JSON.stringify(b));
      assert(b.lgTop >= b.top && b.lgBottom <= b.bottom, JSON.stringify(b));
    }

    // a provider's own model still keeps its maker's logo: back to the whole list
    await pop.locator(".am-ri").first().click();
    await pop.locator(".am-g:not(.routes) .am-mr").first().waitFor();
    assert.equal(await pop.locator(".am-mr", { hasText: "GPT-6" }).last().locator(".lg").getAttribute("data-icon"), "openai");

    assert.deepEqual(errors, []);
  });
}
