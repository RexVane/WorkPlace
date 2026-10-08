// Run with Node's test runner and Playwright on the module path; see README.md.
// Code text on Windows (#690): every monospace text in the GUI takes --code,
// and on Windows (html.win) --code is Cascadia Mono / Consolas with YaHei UI
// for Chinese, never the generic monospace alone, which a Chinese Windows
// draws in SimSun (thin, unhinted at 11px). Elsewhere --code stays the Mac's.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const assets = path.resolve(__dirname, "../assets");
const sheets = ["app.css", "library.css", "routing.css", "sessions.css", "plugins.css"];

test("no stylesheet names a monospace stack of its own", async () => {
  for (const f of sheets) {
    const css = await fs.readFile(path.join(assets, f), "utf8");
    const lines = css.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => /monospace/.test(l) && !/--code:/.test(l));
    assert.deepEqual(lines, [], `${f} has a monospace stack of its own`);
  }
});

test("code text on Windows is Cascadia Mono / Consolas with YaHei UI", async () => {
  const css = (await Promise.all(sheets.map((f) => fs.readFile(path.join(assets, f), "utf8")))).join("\n");
  const browser = await (process.env.BROWSER === "webkit" ? webkit : chromium).launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style>
      <span class="mk-badge">远程 · 需登录</span><span class="mk-id">atlassian</span>
      <div class="rt-accts"><b><code class="mdl">gpt-6.1-sol</code></b></div>
      <div class="signing"><div class="signlink"><code>https://x</code></div></div>`);
    const fams = () => page.evaluate(() => [".mk-badge", ".mk-id", ".rt-accts code.mdl", ".signing .signlink code"].map((s) => getComputedStyle(document.querySelector(s)).fontFamily));
    for (const f of await fams()) assert.match(f, /^ui-monospace, "?SF Mono"?, Menlo/, "the Mac's stack off Windows");
    await page.evaluate(() => document.documentElement.classList.add("win"));
    for (const f of await fams()) assert.match(f, /^"?Cascadia Mono"?, Consolas, "?Microsoft YaHei UI"?/, "Windows' stack");
  } finally {
    await browser.close();
  }
});

// The interface is set in the code face too (--font is --code): its text,
// a row's name and a section's label, on Windows and off it. A face chosen
// in Settings (--ui-font, fonts.js) still comes first.
test("interface text is the code face, a chosen face first", async () => {
  const css = (await Promise.all(sheets.map((f) => fs.readFile(path.join(assets, f), "utf8")))).join("\n");
  const browser = await (process.env.BROWSER === "webkit" ? webkit : chromium).launch();
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style>
      <div class="row"><div class="who"><div class="name">DeepSeek 深度求索</div></div></div><span class="label">模型</span>`);
    const fams = () => page.evaluate(() => ["body", ".row .name", ".label"].map((s) => getComputedStyle(document.querySelector(s)).fontFamily));
    for (const f of await fams()) assert.match(f, /^ui-monospace, "?SF Mono"?, Menlo/, "the Mac's code stack off Windows");
    await page.evaluate(() => document.documentElement.classList.add("win"));
    for (const f of await fams()) assert.match(f, /^"?Cascadia Mono"?, Consolas, "?Microsoft YaHei UI"?/, "Windows' code stack");
    await page.evaluate(() => document.documentElement.style.setProperty("--ui-font", '"Maple Mono Normal NF CN", var(--font)'));
    for (const f of await fams()) assert.match(f, /^"?Maple Mono Normal NF CN"?, "?Cascadia Mono"?/, "the chosen face, then the code stack");
  } finally {
    await browser.close();
  }
});
