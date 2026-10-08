"use strict";

const modes = {
  dark: { label: "深色底座", svg: "icon.svg", folder: "dark", prefix: "icon", size: 1024 },
  light: { label: "浅色底座", svg: "icon-light.svg", folder: "light", prefix: "icon", size: 1024 },
  mono: { label: "单色轮廓", svg: "symbol.svg", folder: "mono-dark", prefix: "symbol", size: 256 },
};

function show(mode) {
  const selected = modes[mode];
  if (!selected) return;
  document.documentElement.dataset.appearance = mode;
  const main = document.querySelector("#main-icon");
  main.src = selected.svg;
  main.alt = `WorkPlace 工坊榫接 · ${selected.label}`;
  for (const icon of document.querySelectorAll(".pixel-strip img")) {
    icon.src = `exports/${selected.folder}/${selected.prefix}-${icon.dataset.size}.png`;
    icon.alt = `WorkPlace · ${selected.label} · ${icon.dataset.size} 像素`;
  }
  const svg = document.querySelector("#svg-download");
  const png = document.querySelector("#png-download");
  svg.href = selected.svg;
  svg.download = `WorkPlace-${mode}.svg`;
  png.href = `exports/${selected.folder}/${selected.prefix}-${selected.size}.png`;
  png.download = `WorkPlace-${mode}.png`;
}

const controls = document.querySelector("fieldset");
controls.addEventListener("change", (event) => {
  if (event.target.name === "appearance") show(event.target.value);
});
show(controls.querySelector(":checked").value);
controls.hidden = false;
