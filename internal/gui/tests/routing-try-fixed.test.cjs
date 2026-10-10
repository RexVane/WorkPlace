// Run with Node's test runner and Playwright on the module path; see README.md.
// A try sent at an effort its member isn't fixed at still reaches its row
// (#865, uiots: the magpie stopped at magpie's door and never flew on to a
// member). A Claude Code tier at high sends a member that follows the
// group's effort with its try's fixed "high", while the member's own seat
// has no fixed: the page looked the row up by the try's seat, found none
// and skipped the flight, and the row never said it was answering. Now the
// request is carried on to the member's row and held there while it
// answers, and the row says so.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");
const iso = (ms) => new Date(ms).toISOString();
const member = (n) => ({ id: `key-${n}`, provider: `prov${n}`, name: `Provider ${n}`, who: `key ${n}`, kind: "key", model: `model-${n}` });

function live() {
  const t0 = Date.now() - 400;
  const order = [member(1), member(2)];
  // sent at high, which the member isn't fixed at
  const tries = [{ id: order[0].id, model: order[0].model, effort: "high", fixed: "high", start: iso(t0), done: false }];
  return { id: 1, seq: 1, time: iso(t0), agent: "claude", model: "group/flash", provider: order[0].provider, group: { id: "flash", name: "Flash", members: ["prov1/model-1", "prov2/model-2"] }, order, tries, done: false };
}

function serve(lang, feed = {}) {
  const state = { agents: [{ id: "claude", name: "Claude Code", path: "/test/claude", fields: [] }], profiles: [], settings: { lang, theme: "light" } };
  return async (route) => {
    const url = new URL(route.request().url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state);
    if (url.pathname === "/api/plugins") return json({ plugins: [] });
    if (url.pathname === "/api/gateway/trace") {
      const trace = (routes) => json({ mine: true, now: new Date().toISOString(), seq: 1, totals: { requests: 1, rerouted: 0, errors: 0 }, routes });
      if (!url.searchParams.get("wait")) return trace([feed.request || live()]);
      await new Promise((r) => setTimeout(r, 1000)); // still answering
      return trace([]).catch(() => {});
    }
    if (url.pathname === "/api/gateway/history") return json({ cut: false, days: [], routes: [] });
    if (url.pathname === "/api/groups") return json({ models: [], groups: [], pools: [] });
    if (url.pathname === "/api/usage/quotas") { feed.reads = (feed.reads || 0) + 1; return json(feed.quotas ?? []); }
    if (url.pathname === "/api/usage/quotas/history") return json({});
    if (url.pathname === "/api/providers") return json({ providers: [], presets: [], excluded: [], gateway: { running: true, window: true, url: "http://127.0.0.1:3999" } });
    if (url.pathname.startsWith("/api/")) return json({});
    const file = path.join(assets, url.pathname === "/" ? "index.html" : url.pathname);
    const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)];
    await route.fulfill({ body: await fs.readFile(file), contentType });
  };
}

const answering = { en: "answering…", zh: "回答中…" };

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: a try sent at an effort its member isn't fixed at flies to the member's row`, async (t) => {
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/*", serve(lang));
      t.after(async () => {
        if (process.env.ARTIFACT_DIR) {
          await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-${lang}-try-fixed.png`) });
        }
        await browser.close();
      });
      await page.goto("http://magpie.test/?view=routing");
      const rowOf = () => [...document.querySelectorAll("li")].find((li) => li.querySelector("code.mdl")?.textContent === "model-1");
      await page.waitForFunction(`(${rowOf})()`);
      // the row the try went to says it is answering
      await page.waitForFunction(([f, w]) => (0, eval)(`(${f})`)()?.textContent.includes(w), [String(rowOf), answering[lang]]);
      // and the request was carried to it, and is held there while it answers
      await page.waitForSelector("circle.pkt.held", { state: "attached" });
      const at = await page.evaluate((f) => {
        const d = document.querySelector("circle.pkt.held").getBoundingClientRect();
        const li = (0, eval)(`(${f})`)().getBoundingClientRect();
        return { x: d.left + d.width / 2, y: d.top + d.height / 2, left: li.left, top: li.top, bottom: li.bottom };
      }, String(rowOf));
      assert.ok(Math.abs(at.x - at.left) < 60 && at.y >= at.top - 30 && at.y <= at.bottom + 30, `held at ${JSON.stringify(at)}, not at the member's row`);
      assert.equal(await page.locator(".rt-core-n").textContent(), "1", "the gateway counts the live request");
      const activeNodes = await page.locator(".rt-stage, .rt-hub, .rt-src, .rt-accts li.on").evaluateAll((nodes) => nodes.map((node) => {
        const style = getComputedStyle(node);
        return { opacity: Number(style.opacity), interactive: style.pointerEvents !== "none" };
      }));
      assert(activeNodes.every((node) => node.opacity === 1 && node.interactive), `live routing stays readable and interactive: ${JSON.stringify(activeNodes)}`);
      const timer = page.locator(".rt-info .lt").first();
      const before = await timer.textContent();
      await page.waitForFunction((before) => document.querySelector(".rt-info .lt")?.textContent !== before, before);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.evaluate(() => {
        const core = document.querySelector(".rt-core"), wave = document.querySelector(".rt-core-wave.late");
        document.querySelector(".rt-hub").classList.add("tick");
        return [getComputedStyle(core, "::after").animationName, getComputedStyle(wave).animationName];
      });
      assert.deepEqual(motion, ["none", "none"], "reduced motion stops the busy core and both arrival waves");
      assert.deepEqual(errors, []);
    });
  }
}

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  test(`${engine}: routing balances keep failed readings out of the shared Usage state`, async (t) => {
    const browser = await (engine === "webkit" ? webkit : chromium).launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion: "reduce" });
    const feed = { quotas: { unavailable: true } }, errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", serve("en", feed));
    await page.goto("http://magpie.test/");
    await page.waitForFunction(() => typeof quotas !== "undefined");
    await page.evaluate(() => {
      quotas = [{ provider: "prov1", balance: "$12.00" }];
      quotasAt = Date.now() - 61000;
    });
    await page.locator('#nav button[data-view="routing"]').click();
    await page.waitForFunction(() => document.querySelector(".rt-info .q")?.textContent.includes("$12.00"));
    await page.waitForTimeout(500);
    assert.equal(feed.reads, 1, "one balance read for all rendered rows");
    assert.equal(await page.evaluate(() => quotas[0]?.balance), "$12.00", "an invalid reading keeps the shared cache");
    assert.deepEqual(errors, []);

    feed.quotas = [{ provider: "prov1", balance: "$9.00" }];
    await page.evaluate(() => { const clock = Date.now; Date.now = () => clock() + 61000; });
    await page.locator('#nav button[data-view="agents"]').click();
    await page.locator('#nav button[data-view="routing"]').click();
    await page.waitForFunction(() => document.querySelector(".rt-info .q")?.textContent.includes("$9.00"));
    assert.equal(feed.reads, 2, "balances can refresh after a minute");
    assert.equal(await page.evaluate(() => quotas[0]?.balance), "$12.00", "the routing read does not redraw or replace the Usage cache");
    assert.deepEqual(errors, []);
  });

  test(`${engine}: account metrics follow the request metric picker`, async (t) => {
    const browser = await (engine === "webkit" ? webkit : chromium).launch();
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const request = live();
    Object.assign(request, { done: true, status: 200, ms: 4000, ttft: 1000, firstText: 2000, tokens: 1500, out: 100 });
    Object.assign(request.tries[0], { done: true, status: 200, ms: 4000, ttft: 1000, firstText: 2000 });
    await page.route("**/*", serve("en", { request }));
    await page.goto("http://magpie.test/?view=routing");
    await page.locator(".rt-info .duration").waitFor();
    assert.equal(await page.locator(".rt-info .tokens").count(), 1, "the selected token count is shown on the account");
    await page.locator("#rtMetrics").click();
    const duration = page.locator(".rt-metric-menu").getByRole("menuitemcheckbox", { name: "Duration", exact: true });
    await duration.click();
    assert.equal(await page.locator(".rt-info .duration").count(), 0, "unticking duration updates the account immediately");
    await duration.click();
    assert.equal(await page.locator(".rt-info .duration").count(), 1);
    assert.match(await page.locator(".rt-info .think").textContent(), /thought/);
  });
}
