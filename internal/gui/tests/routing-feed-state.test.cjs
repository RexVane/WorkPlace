// Run with Node's test runner and Playwright on the module path; see README.md.
// The Routing page's header says what the live feed is doing, and says it as
// it is: while the trace answers, the dot is green and pulses and the line
// beside it reads "live, as the gateway decides"; a read that fails turns the
// dot amber, stops it pulsing and adds a line saying the feed isn't answering
// and that what is shown is the last it read — the page holds the numbers it
// already had, and a read that answers again takes the line away. Before this,
// a failed read was swallowed and the dot pulsed green over numbers that had
// stopped arriving.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");
const iso = (ms) => new Date(ms).toISOString();
const acct = (n) => ({ id: `acct-${n}`, provider: `prov${n}`, name: `Provider ${n}`, who: `user${n}@example.com`, kind: "account", model: `model-${n}`, known: true, used: 10 * n, plan: "Pro" });
const agentsOf = ["codex", "claude"];

function req(id) {
  const t0 = Date.now() - 60e3 + id * 100;
  const order = [acct(id % 3), acct((id + 1) % 3)];
  const tries = [{ id: order[0].id, model: order[0].model, start: iso(t0), done: true, ms: 300, status: 200 }];
  return { id, seq: id, time: iso(t0), agent: agentsOf[id % agentsOf.length], model: order[0].model, provider: order[0].provider, order, tries, done: true, status: 200, ms: 400, tokens: 900 };
}
const first = [1, 2, 3].map(req);

// feed.fail makes every read of the trace fail, as a backend that went away does
function serve(lang, feed) {
  const state = { agents: agentsOf.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), path: `/test/${id}`, fields: [] })), profiles: [], settings: { lang, theme: "light" } };
  return async (route) => {
    const url = new URL(route.request().url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state);
    if (url.pathname === "/api/plugins") return json({ plugins: [] });
    if (url.pathname === "/api/gateway/trace") {
      feed.reads++;
      if (feed.fail) return route.fulfill({ status: 503, contentType: "text/plain", body: "the gateway's trace is not here" });
      // answered at once, so a recovered feed is seen without a long wait
      return json({ mine: true, now: new Date().toISOString(), seq: first[first.length - 1].seq, totals: { requests: 3, rerouted: 0, errors: 0 }, routes: first });
    }
    if (url.pathname === "/api/gateway/history") return json({ cut: false, days: [], routes: [] });
    if (url.pathname === "/api/groups") return json({ models: [], groups: [], pools: [] });
    if (url.pathname === "/api/providers") return json({ providers: [], excluded: [], gateway: { running: true, window: true, url: "http://127.0.0.1:3999" } });
    if (url.pathname.startsWith("/api/")) return json({});
    const file = path.join(assets, url.pathname === "/" ? "index.html" : url.pathname);
    const contentType = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" }[path.extname(file)];
    await route.fulfill({ body: await fs.readFile(file), contentType });
  };
}

const words = {
  en: "The live feed isn't answering — retrying; what is shown is the last it read",
  zh: "实时数据没有应答 —— 正在重试；现在显示的是最后一次读到的内容",
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: the live feed's own state is told as it is`, async (t) => {
      const browser = await (engine === "webkit" ? webkit.launch() : chromium.launch({ channel: "chromium" }));
      const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const feed = { fail: false, reads: 0 };
      await page.route("**/*", serve(lang, feed));
      t.after(async () => {
        if (process.env.ARTIFACT_DIR) {
          await fs.mkdir(process.env.ARTIFACT_DIR, { recursive: true });
          await page.locator("#view-routing").screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-${lang}-feed-down.png`) });
        }
        await browser.close();
      });

      const feedState = () => page.evaluate(() => {
        const dot = document.querySelector("#rtLiveDot"), note = document.querySelector("#rtFeedNote");
        const cs = getComputedStyle(dot);
        return {
          down: dot.classList.contains("down"),
          colour: cs.backgroundColor,
          animation: cs.animationName,
          noteShown: !note.hidden,
          note: note.textContent,
        };
      });

      await page.goto("http://magpie.test/?view=routing");
      await page.locator("#rt .rt-node.rt-hub").waitFor();
      await page.waitForTimeout(400);

      // the feed answers: the dot is the live one and no line is added
      const live = await feedState();
      assert.equal(live.down, false, JSON.stringify(live));
      assert.equal(live.noteShown, false, JSON.stringify(live));
      assert.notEqual(live.animation, "none", "the live dot pulses");
      assert.notEqual(live.colour, "rgb(163, 95, 11)", "the live dot isn't the interrupted one");

      // the feed stops answering: the dot stops claiming live and the line says so
      feed.fail = true;
      await page.waitForFunction(() => document.querySelector("#rtLiveDot").classList.contains("down"));
      const down = await feedState();
      assert.equal(down.noteShown, true, JSON.stringify(down));
      assert.equal(down.note, words[lang], JSON.stringify(down));
      assert.equal(down.animation, "none", "an interrupted feed doesn't pulse");
      assert.notEqual(down.colour, live.colour, "it is drawn as not-live");

      // it answers again: the line goes and the dot is the live one once more
      feed.fail = false;
      await page.waitForFunction(() => !document.querySelector("#rtLiveDot").classList.contains("down"));
      const back = await feedState();
      assert.equal(back.noteShown, false, JSON.stringify(back));
      assert.equal(back.animation, live.animation, JSON.stringify(back));

      assert.deepEqual(errors, []);
      await context.close();
    });
  }
}
