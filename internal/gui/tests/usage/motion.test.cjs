// The delivered Usage effects must keep figures truthful, ignore stale
// chart answers and leave shared caches and the tray panel alone.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");
const assets = path.resolve(__dirname, "../../assets");
const totals = { calls: 10, errors: 0, input: 700, output: 300, cache_read: 800, cache_write: 200, reasoning: 30, cost: .4, unpriced: 0 };
const models = [
  { id: "model-a", name: "model-a", calls: 6, input: 600, output: 200, cache_read: 500, cache_write: 100, cost: .3 },
  { id: "model-b", name: "model-b", calls: 4, input: 100, output: 100, cache_read: 300, cache_write: 100, cost: .1 },
];
function data(period, factor = 1) {
  const scale = (x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "number" ? v * factor : v]));
  const total = scale(totals), by = { model: models.map(scale) };
  const time = new Date(); time.setHours(0, 0, 0, 0);
  const series = [0, 1].map((i) => ({ ...Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / 2])), label: String(i), time: new Date(+time + i * 3600000).toISOString(), by: { model: Object.fromEntries(by.model.map((m) => [m.id, { tokens: (m.input + m.output + m.cache_read + m.cache_write) / 2, calls: m.calls / 2, cost: m.cost / 2 }])) } }));
  const summary = { ...total, period, bucket: "hour", series, models: by.model, agents: [], accounts: [], path: "/test/usage.jsonl" };
  const ledger = { ...total, period, bucket: "hour", series, by, agents: [], providers: [], offset: 0, total: 1, rows: [{ t: time.toISOString(), model: "model-a", provider: "demo", providerName: "Demo", agent: "claude", agentName: "Claude Code", in: total.input, out: total.output, cache_read: total.cache_read, cache_write: total.cache_write, status: 200, ms: 1000, priced: true, cost: total.cost }] };
  return { summary, ledger };
}
async function open(t, engine, feed = {}, options = {}) {
  const browser = await (engine === "webkit" ? webkit : chromium).launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, reducedMotion: options.reducedMotion || "no-preference" });
  page.setDefaultTimeout(5000);
  await page.addInitScript(() => localStorage.setItem("magpie.usageEvery", "0"));
  const errors = [], reads = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url()), json = (v) => route.fulfill({ json: v });
    const lang = options.lang || "en", theme = options.theme || "light";
    if (u.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"${theme}",web:true};` });
    if (u.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (u.pathname === "/api/state") return json({ agents: [], profiles: [], settings: { lang, theme } });
    if (u.pathname === "/api/providers") return json({ providers: [], presets: [], excluded: [], gateway: { running: true, window: true } });
    if (u.pathname === "/api/plugins") return json({ plugins: [] });
    if (u.pathname === "/api/groups") return json({ groups: [], models: [], pools: [] });
    if (u.pathname === "/api/usage") return json(data(u.searchParams.get("period"), feed.factor || 1).summary);
    if (u.pathname === "/api/usage/requests") {
      reads.push(u.searchParams);
      const reply = data(u.searchParams.get("period"), feed.factor || 1).ledger;
      if (feed.hold && reads.length === 1) await new Promise((r) => { feed.release = r; });
      return json(feed.bad ? {} : reply).catch(() => {});
    }
    if (u.pathname === "/api/usage/quotas") return json(feed.quotas || [{ provider: "demo", name: "Demo", icon: "generic", balance: "$12.00" }]);
    if (u.pathname === "/api/usage/quotas/history") return json([]);
    if (u.pathname.startsWith("/api/")) return json({});
    const file = path.join(assets, u.pathname === "/" ? "index.html" : u.pathname);
    return route.fulfill({ body: await fs.readFile(file), contentType: { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)] });
  });
  await page.goto("http://magpie.test/?view=usage");
  await page.locator("#stats .kpi b").first().waitFor();
  return { page, errors, reads };
}

for (const engine of process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"]) {
  test(`${engine}: overview model shares use the API totals and keep the Usage caches`, async (t) => {
    const { page, reads, errors } = await open(t, engine);
    await page.locator("#uxRank .rk-b").first().waitFor();
    assert.deepEqual((await page.locator("#uxRank .rk-b").allTextContents()).map((s) => s.match(/\d+%$/)?.[0]), ["70%", "30%"]);
    assert.equal(reads[0].get("via"), "through");
    assert.equal(reads[0].get("limit"), "1");
    assert.deepEqual(await page.evaluate(() => ({ calls: usage.calls, tokens: usage.input + usage.output, ledger, balance: quotas[0].balance })), { calls: 10, tokens: 1000, ledger: null, balance: "$12.00" });
    await page.waitForTimeout(750);
    const column = await page.locator("#uxChart rect.col").first().boundingBox();
    await page.mouse.move(column.x + column.width / 2, column.y + column.height / 2);
    assert.equal(await page.locator("#uxChart .ux-ytag").textContent(), "1,000");
    await page.locator("#uxRank button").first().focus();
    assert.equal(await page.locator('#uxChart rect.col[data-k="model-b"]').first().evaluate((r) => Number(r.style.opacity)), .22);
    assert.deepEqual(errors, []);
  });

  test(`${engine}: a pending overview chart cannot swallow a new period`, async (t) => {
    const feed = { hold: true };
    const { page, reads, errors } = await open(t, engine, feed);
    t.after(() => feed.release?.());
    await page.waitForTimeout(100);
    await page.locator("#period .opt").nth(1).click();
    await page.waitForFunction(() => usage.period === "7d");
    feed.release();
    await page.waitForSelector("#uxChart rect.col");
    assert.equal(reads.at(-1).get("period"), "7d");
    assert.deepEqual(errors, []);
  });

  test(`${engine}: refreshed figures replace an older pending chart`, async (t) => {
    const feed = { hold: true };
    const { page, reads, errors } = await open(t, engine, feed);
    t.after(() => feed.release?.());
    await page.waitForTimeout(100);
    feed.factor = 2;
    await page.evaluate(() => refreshUsage(false));
    feed.release();
    await page.waitForSelector("#uxChart rect.col");
    await page.waitForFunction(() => document.querySelectorAll("#uxRank .rk-b").length === 2);
    for (let i = 0; i < 30 && reads.length < 2; i++) await page.waitForTimeout(100);
    assert.equal(reads.length, 2, "the chart is re-read for the newly displayed totals");
    assert.equal(await page.evaluate(() => usage.calls), 20);
    assert.deepEqual(errors, []);
  });

  test(`${engine}: reduced motion finishes a running number at its actual value`, async (t) => {
    const feed = {};
    const { page, errors } = await open(t, engine, feed);
    await page.locator("#uxChart rect.col").first().waitFor();
    feed.factor = 1.1;
    await page.evaluate(() => refreshUsage(false));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(80);
    assert.equal(await page.locator("#stats .kpi b").first().textContent(), "1.1K");
    assert.equal(await page.locator("#view-usage .ux-delta:visible").count(), 0);
    assert.deepEqual(errors, []);
  });

  test(`${engine}: a failed chart read keeps the input/output timeline`, async (t) => {
    const feed = {};
    const { page, errors } = await open(t, engine, feed, { reducedMotion: "reduce", lang: "zh", theme: "dark" });
    await page.locator("#uxChart rect.col").first().waitFor();
    feed.bad = true;
    feed.factor = 2;
    await page.evaluate(() => refreshUsage(false));
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#chart .bar").count(), 2);
    assert.equal(await page.locator("#chart.ux-split").count(), 0);
    assert.deepEqual(errors, []);
  });

  test(`${engine}: account balances keep their identities and the overview fits`, async (t) => {
    const quotas = [{ provider: "demo", name: "Demo", icon: "generic", user: "first key", balance: "$12.00" }, { provider: "demo", name: "Demo", icon: "generic", user: "second key", balance: "$90.00" }];
    const { page, errors } = await open(t, engine, { quotas });
    await page.locator("#uxChart rect.col").first().waitFor();
    await page.evaluate(() => { quotas.reverse(); renderQuotas(); });
    assert.deepEqual(await page.locator("#subscriptionUsage .quota-balance > b").allTextContents(), ["$90.00", "$12.00"]);
    const shots = process.env.ARTIFACT_DIR;
    if (shots) await fs.mkdir(shots, { recursive: true });
    for (const [width, theme] of [[1180, "light"], [1180, "dark"], [560, "dark"], [390, "light"]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme; }, theme);
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px: no horizontal overflow`);
      const rect = await page.locator("#uxChart").boundingBox();
      assert(rect.width > 100 && rect.x >= 0 && rect.x + rect.width <= width, `${width}px: the chart fits`);
      if (shots) await page.screenshot({ path: path.join(shots, `${engine}-usage-${width}-${theme}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
  });

  test(`${engine}: leaving Usage finishes its numbers and starts no chart reads`, async (t) => {
    const feed = {};
    const { page, reads, errors } = await open(t, engine, feed);
    await page.locator("#uxChart rect.col").first().waitFor();
    feed.factor = 1.1;
    await page.evaluate(() => refreshUsage(false));
    await page.locator('#nav button[data-view="agents"]').click();
    const count = reads.length;
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#stats .kpi b").first().textContent(), "1.1K");
    await page.evaluate(() => renderUsage());
    assert.equal(reads.length, count, "rendering a cached summary while hidden starts no request");
    assert.deepEqual(errors, []);
  });
}
