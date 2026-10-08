"use strict";

const appearances = {
  dark: { label: "深色底座", svg: "icon.svg", folder: "icons", prefix: "icon", size: 1024 },
  light: { label: "浅色底座", svg: "icon-light.svg", folder: "light", prefix: "icon", size: 1024 },
  mono: { label: "单色轮廓", svg: "symbol.svg", folder: "mono", prefix: "symbol", size: 384 },
};

function setAppearance(appearance) {
  const selected = appearances[appearance];
  if (!selected) return;
  document.documentElement.dataset.appearance = appearance;
  for (const card of document.querySelectorAll(".candidate")) {
    const { slug, title } = card.dataset;
    const mainIcon = card.querySelector(".main-icon");
    mainIcon.src = `${slug}/${selected.svg}`;
    mainIcon.alt = `${title} · ${selected.label}`;
    for (const icon of card.querySelectorAll(".pixel-strip img")) {
      icon.src = `${slug}/exports/${selected.folder}/${selected.prefix}-${icon.dataset.size}.png`;
      icon.alt = `${title} · ${selected.label} · ${icon.dataset.size} 像素`;
    }
    const svgLink = card.querySelector(".svg-download");
    const pngLink = card.querySelector(".png-download");
    svgLink.href = `${slug}/${selected.svg}`;
    pngLink.href = `${slug}/exports/${selected.folder}/${selected.prefix}-${selected.size}.png`;
    svgLink.download = `WorkPlace-${slug}-${appearance}.svg`;
    pngLink.download = `WorkPlace-${slug}-${appearance}.png`;
  }
}

const controls = document.querySelector(".appearance-control");
controls.addEventListener("change", (event) => {
  if (event.target.name === "appearance") setAppearance(event.target.value);
});
setAppearance(controls.querySelector(":checked").value);
controls.hidden = false;
