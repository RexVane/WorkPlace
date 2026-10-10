// Run with Node's test runner and Playwright on the module path; see README.md.
// The range an agent's model list is narrowed to (settings' Visible, as
// `magpie visible <agent> <name>…` writes it, @RexVane): the "Range" button
// opens a sheet of every family, provider id and routing group id the catalog
// offers, all of them ticked; unticking one saves the range at once, and the
// list is drawn from the narrowed catalog it answers with.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");

// the catalog: a provider tagged "fast", a plain provider, and a routing
// group — the three kinds of name a range can hold
const catalog = () => [
  { id: "group/fast", name: "Fast", group: "Routing groups", icons: ["openai"], candidates: ["fa", "group/fast"] },
  ...["m1", "m2"].map((m) => ({ id: "relay/" + m, name: m.toUpperCase(), group: "Relay", icon: "openai", candidates: ["fa", "relay"] })),
  { id: "other/m1", name: "OTHER1", group: "Other", icon: "generic", candidates: ["other"] },
];

function fixture(lang) {
  const all = [
    { name: "fa", kind: "family", entries: 3 },
    { name: "group/fast", kind: "group", label: "Fast", icon: "openai", entries: 1 },
    { name: "relay", kind: "provider", entries: 2 },
    { name: "other", kind: "provider", entries: 1 },
  ];
  let names = [];
  // the gateway narrows the catalog by the range; an agent with none is
  // shown every entry
  const listed = () => names.length ? catalog().filter((m) => m.candidates.some((c) => names.some((n) => n.toLowerCase() === c.toLowerCase()))) : catalog();
  const count = () => ({ shown: listed().length, listed: listed().length, by: [] });
  const state = () => ({
    agents: [{
      id: "codex", name: "Codex", path: "/test/config.toml", icon: "codex-color", wired: true,
      fields: [{ key: "model", label: "model", value: "magpie/relay/m1", options: [{ value: "magpie/relay/m1", label: "M1", ref: "relay/m1" }] }],
      models: count(),
    }],
    profiles: [], settings: { lang, theme: "light" },
  });
  const scope = () => ({ scope: { agent: "codex", names, all }, used: { shown: listed().length, catalog: catalog().length, names: names.length } });
  async function serve(route) {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data) => route.fulfill({ json: data });
    if (url.pathname === "/boot.js") return route.fulfill({ contentType: "text/javascript", body: `window.bootPrefs = {lang:"${lang}",theme:"light",web:true};` });
    if (url.pathname === "/wails/runtime.js") return route.fulfill({ contentType: "text/javascript", body: "export const Window = {};" });
    if (url.pathname === "/api/state") return json(state());
    if (url.pathname === "/api/agent-scope/codex") {
      if (req.method() === "POST") {
        names = req.postDataJSON().names;
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
  return { serve, saved: () => names };
}

// the button's own words, and the head's count, in the language under test
const RANGE = {
  en: { all: "Range: all models", at: (n) => `Range: ${n}`, of: (n, all) => `${n} of ${all}` },
  zh: { all: "范围：全部模型", at: (n) => `范围：${n} 个名称`, of: (n, all) => `${n} / ${all}` },
};

const W = {
  en: {
    title: "Scope", families: "Families", providers: "Providers", routes: "Routing groups",
    note: /^Tick the providers, families and routing groups Codex is shown/,
    foot: "New models are shown", scopedFoot: "New models are shown, except where the range keeps them out",
    first: "3 models",
  },
  zh: {
    title: "范围", families: "系列", providers: "供应商", routes: "路由组",
    note: /^勾选 Codex 能显示的供应商、系列和路由组/,
    foot: "新模型会显示", scopedFoot: "新模型会显示，除非范围把它挡在外面",
    first: "3 个模型",
  },
};

for (const engine of (process.env.BROWSER ? [process.env.BROWSER] : ["chromium", "webkit"])) {
  for (const lang of ["en", "zh"]) {
    test(`${engine} ${lang}: an agent's range sheet`, async (t) => {
      const w = W[lang], r = RANGE[lang];
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
          await page.screenshot({ path: path.join(process.env.ARTIFACT_DIR, `${engine}-${lang}-range.png`) });
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

      // no range: every model of every provider, the button saying so
      const scopeBtn = pop.locator(".am-scope");
      assert.equal(await scopeBtn.innerText(), r.all);
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 4);
      assert.equal(await pop.locator(".am-mr.out").count(), 0);

      // the sheet: every name the catalog offers, all ticked, and the list
      // gives way to it
      await scopeBtn.click();
      const sheet = pop.locator(".am-sheet");
      await sheet.waitFor();
      assert.equal(await pop.locator(".am-g .gn").allInnerTexts().then((s) => s.join(" ")), [w.families, w.providers, w.routes].join(" "));
      assert.match(await sheet.locator(".am-d").innerText(), w.note);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), r.of(4, 4));
      assert.equal(await sheet.locator(".am-sr").count(), 4);
      assert.equal(await sheet.locator('.am-sr[aria-checked="true"]').count(), 4);
      assert.equal(await sheet.locator(".am-sr .am-sc-n").first().innerText(), w.first);
      // a routing group is listed by its own name, with the id the range holds
      const route = sheet.locator(".am-sr", { hasText: "Fast" }).first();
      assert.equal(await route.locator(".am-id").innerText(), "group/fast");
      assert.equal(await pop.locator(".am-search").isVisible(), false, "the sheet takes the list's tools");

      // unticking the plain provider saves at once
      await sheet.locator(".am-sr", { hasText: "other" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, r.at(3));
      assert.deepEqual(fx.saved(), ["fa", "group/fast", "relay"]);
      assert.equal(await sheet.locator(".am-sh .c").innerText(), r.of(3, 4));
      assert.equal(await sheet.locator('.am-sr[aria-checked="false"]').count(), 1);
      assert.equal(await sheet.locator('.am-sr[aria-checked="false"] .n').innerText(), "other");

      // closing it: the list is the narrowed catalog, the foot saying what
      // the range does to what comes later
      await scopeBtn.click();
      await sheet.waitFor({ state: "detached" });
      assert.equal(await scopeBtn.innerText(), r.at(3));
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 3);
      assert.equal(await pop.locator(".am-mr.out").count(), 0, "a model out of the range is not listed at all");
      const foot = await pop.locator(".am-foot").innerText();
      assert.ok(foot.includes(w.scopedFoot), foot);

      // and it holds: the sheet opens on the range as saved, every name
      // still offered — the one it leaves out stays there, to be ticked
      // back — so unticking the tagged provider leaves the family and the
      // group
      await scopeBtn.click();
      await sheet.waitFor();
      assert.equal(await sheet.locator(".am-sh .c").innerText(), r.of(3, 4));
      assert.equal(await sheet.locator('.am-sr[aria-checked="false"] .n').innerText(), "other");
      await sheet.locator(".am-sr", { hasText: "relay" }).first().click();
      await page.waitForFunction((want) => document.querySelector(".am-scope")?.textContent === want, r.at(2));
      assert.deepEqual(fx.saved(), ["fa", "group/fast"]);
      await scopeBtn.click();
      await sheet.waitFor({ state: "detached" });
      assert.equal(await pop.locator(".am-mr:not(.am-sr)").count(), 3, "the family's models and the group's");
      await scopeBtn.click();
      await sheet.waitFor();
      assert.equal(await sheet.locator(".am-sh .c").innerText(), r.of(2, 4));
      assert.equal(await sheet.locator('.am-sr[aria-checked="false"]').count(), 2, "the two names the range left out are offered still");
      assert.deepEqual(errors, []);
    });
  }
}
