// The supplied layout: five summary cells, a model chart/ranking and nine
// request columns. Secondary fields stay reachable, including on a narrow
// desktop window. All API data here is isolated from the running app.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");
const assets = path.resolve(__dirname, "../../assets");
const base = process.env.MAGPIE_USAGE_BASELINE;
const names = ["deepseek-v4-flash", "kimi-k3", "google/gemini-3.1-pro", "glm-5.3"];
const models = names.map((name, i) => ({ id: name, name, calls: (4 - i) * 10, input: (4 - i) * 180000, output: (4 - i) * 20000, cache_read: (4 - i) * 700000, cache_write: 0, cost: (4 - i) * .37, timed: (4 - i) * 10, ttft_ms: (4 - i) * 8000, decode_out: (4 - i) * 20000, decode_ms: (4 - i) * 140800 }));
const totals = Object.fromEntries(["calls", "input", "output", "cache_read", "cache_write", "cost", "timed", "ttft_ms", "decode_out", "decode_ms"].map((key) => [key, models.reduce((sum, m) => sum + m[key], 0)]));
Object.assign(totals, { errors: 0, reasoning: 0, unpriced: 0 });
const now = new Date(); now.setHours(0, 0, 0, 0);
const series = Array.from({ length: 30 }, (_, i) => ({ ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / 30])), time: new Date(+now - (29 - i) * 86400000).toISOString(), label: String(i + 1), by: { model: Object.fromEntries(models.map((m) => [m.id, { tokens: (m.input + m.output + m.cache_read) / 30, calls: m.calls / 30, cost: m.cost / 30 }])) } }));
const rows = Array.from({ length: 9 }, (_, i) => ({ t: new Date(+now + 18 * 3600000 - i * 60000).toISOString(), agent: "claude", agentName: i % 2 ? "Codex" : "Claude Code", icon: i % 2 ? "codex-color" : "claudecode-color", req: names[i % names.length], model: names[i % names.length], served: "reported-model", provider: "demo", providerName: "Demo", in: 18300 + i * 1000, out: 2700, cache_read: 5000, cache_write: 800, effort: "high", ms: 5900, ttft_ms: 800, priced: true, cost: .0448, status: 200, rid: "fixture-" + i }));

async function open(t, engine, lang) {
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  t.after(() => browser.close());
  const p = await browser.newPage({ viewport: { width: 1280, height: 1080 }, reducedMotion: "reduce" });
  p.setDefaultTimeout(5000);
  const errors = [], reads = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => { localStorage.setItem("magpie.usageEvery", "0"); localStorage.setItem("magpie.period", "30d"); });
  await p.route("**/*", async (route) => {
    const u = new URL(route.request().url()), json = (v) => route.fulfill({ json: v });
    if (u.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs={lang:${JSON.stringify(lang)},theme:"light",web:false};` });
    if (u.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window={};" });
    if (u.pathname === "/api/state") return json({ agents: [], profiles: [], settings: { lang, theme: "light" } });
    if (u.pathname === "/api/providers") return json({ providers: [], presets: [], excluded: [], models: [], gateway: { running: true } });
    if (u.pathname === "/api/plugins") return json({ plugins: [] });
    if (u.pathname === "/api/groups") return json({ groups: [], pools: [], models: [] });
    if (u.pathname === "/api/usage") return json({ ...totals, period: u.searchParams.get("period"), bucket: "day", series, agents: [], models, accounts: [], path: "/test/usage.jsonl" });
    if (u.pathname === "/api/usage/requests") {
      reads.push(u.searchParams);
      return json({ ...totals, period: u.searchParams.get("period"), bucket: "day", series, by: { model: models }, agents: [], providers: [], total: rows.length, offset: 0, rows });
    }
    if (u.pathname === "/api/usage/quotas" || u.pathname === "/api/usage/quotas/history") return json([]);
    if (u.pathname === "/api/usage/requests/export") return json({ rows: rows.length, path: "/test/requests.csv" });
    if (u.pathname.startsWith("/api/")) return json({});
    const rel = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
    let file = path.join(assets, rel);
    if (base) {
      const candidate = path.join(base, "internal/gui/assets", rel);
      if (await fs.stat(candidate).catch(() => null)) file = candidate;
    }
    await route.fulfill({ body: await fs.readFile(file), contentType: { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)] });
  });
  await p.goto("http://magpie.test/?view=usage");
  await p.locator("#stats .kpi b").first().waitFor();
  return { p, errors, reads };
}

async function beside(p, chartID, rankID) {
  const chart = await p.locator(chartID).boundingBox(), rank = await p.locator(rankID).boundingBox();
  assert(rank.x >= chart.x + chart.width, "model ranking belongs beside the chart");
  assert(Math.abs(rank.y - chart.y) < 2, "chart and ranking share a row");
  assert(chart.height >= 290, "the full chart replaces the small overview strip");
}

for (const engine of process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"]) {
  for (const lang of ["en", "zh", "zh-TW", "ja", "de"]) {
    test(`${engine} ${lang}: both usage layouts match the supplied structure and keep details reachable`, async (t) => {
      const { p, errors, reads } = await open(t, engine, lang);
      assert.equal(await p.locator("#stats .kpi").count(), 5, "overview must have tokens, requests, cost, cache rate and speed");
      await p.locator("#uxRank .rk").first().waitFor();
      await beside(p, "#uxChart", "#uxRank");
      const k = await p.locator("#stats .k").first().boundingBox(), v = await p.locator("#stats .v").first().boundingBox();
      assert(k.y < v.y, "metric labels belong above the large values");
      assert.equal(await p.locator('#stats [data-metric="cache"] .v').textContent(), "79.5%");
      assert.equal(await p.locator('#stats [data-metric="speed"] .v').textContent(), { en: "142 tok/s", zh: "142 token/秒", "zh-TW": "142 token/秒", ja: "142 トークン/秒", de: "142 Token/s" }[lang]);
      assert.equal(await p.locator("#usageLive").isVisible(), false, "manual refresh must not claim to be live");
      const shots = process.env.ARTIFACT_DIR;
      if (shots && lang === "zh") {
        await fs.mkdir(shots, { recursive: true });
        await p.locator("#view-usage").screenshot({ path: path.join(shots, `${engine}-overview.png`) });
      }
      await p.locator("#usageTab .opt").nth(1).click();
      await p.locator("#ledWrap .led-row").first().waitFor();
      assert.equal(await p.locator("#ledKpi .blk").count(), 5);
      await beside(p, "#ledChart", "#ledRank");
      assert.equal(await p.locator("#ledWrap th:visible").count(), 9, "the table has the nine primary columns in the reference");
      const card = await p.locator("#ledKpi").boundingBox(), trend = await p.locator("#ledDash .led-trend").boundingBox();
      assert(trend.y > card.y + card.height, "summary precedes the chart");
      if (shots && lang === "zh") await p.locator("#view-usage").screenshot({ path: path.join(shots, `${engine}-requests.png`) });
      await p.locator("#ledWrap .led-row").first().press("Enter");
      const detail = p.locator("#ledWrap .led-detail").first();
      assert(await detail.isVisible());
      assert((await detail.innerText()).includes("reported-model"), "the actual served model stays available");
      assert((await detail.innerText()).includes("high"), "reasoning effort stays in the detail");
      assert(await detail.locator(".lc-opt").first().isVisible(), "secondary columns are readable in row details");
      await p.locator("#ledWrap .led-row").first().press("Enter");
      await p.locator("#ledChartOptions > summary").click();
      await p.locator("#ledMetric .opt").nth(1).click();
      assert.equal(await p.locator("#ledTrendTitle").textContent(), await p.locator("#ledMetric .opt.on").textContent() + " · " + await p.locator("#ledSplit .opt.on").textContent());
      await p.locator("#ledChartOptions > summary").click();
      await p.locator("#ledTools > summary").click();
      assert(await p.locator("#ledQ").isVisible());
      assert(await p.locator("#ledExport").isVisible());
      await p.locator("#ledTools > summary").click();
      for (const width of [900, 860, 440]) {
        await p.setViewportSize({ width, height: 1000 });
        await p.waitForTimeout(100);
        assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `request page must fit ${width}px`);
        assert(await p.locator("#ledKpi .v").evaluateAll((values) => values.every((v) => v.scrollWidth <= v.clientWidth + 1)), `request values must not be clipped at ${width}px`);
        await p.locator("#usageTab .opt").first().click();
        await p.locator("#uxRank .rk").first().waitFor();
        assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overview must fit ${width}px`);
        if (shots && lang === "zh" && width === 440) await p.screenshot({ path: path.join(shots, `${engine}-overview-narrow.png`), fullPage: true });
        await p.locator("#usageTab .opt").nth(1).click();
      }
      await p.setViewportSize({ width: 1280, height: 1080 });
      await p.locator("#usageTab .opt").first().click();
      await p.locator("#uxRank .rk").first().click();
      await p.locator("#ledWrap .led-row").first().waitFor();
      await p.locator("#ledQ").waitFor({ state: "visible" });
      assert.equal(reads.at(-1).get("model"), names[0]);
      assert.equal(reads.at(-1).get("via"), "through", "overview drilldown retains gateway-only scope");
      assert(await p.locator("#ledQ").isVisible(), "drilldown exposes the selected filter and its clear action");
      await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
      if (shots && lang === "zh") await p.screenshot({ path: path.join(shots, `${engine}-requests-dark.png`), fullPage: true });
      assert.deepEqual(errors, []);
    });
  }
}
