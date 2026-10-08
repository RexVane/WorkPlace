"""Apply the selected WorkPlace art to the shared GUI and Windows resources.

The macOS bundle's compiled asset catalog is outside this Windows deployment.
Run this after generating workplace.py, before regenerating Windows .syso.
"""

from datetime import datetime
from io import BytesIO
from pathlib import Path
import math
import re
import shutil

from PIL import Image
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "docs/assets/branding/workplace"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
BACKUP = ROOT / "backups" / ("workplace-runtime-icons-" + STAMP)


def retire(path):
    path = path.resolve()
    if not path.is_relative_to(ROOT) or path.is_relative_to((ROOT / "backups").resolve()):
        raise ValueError("Unexpected source path")
    target = (BACKUP / path.relative_to(ROOT)).resolve()
    if not target.is_relative_to((ROOT / "backups").resolve()):
        raise ValueError("Unexpected backup path")
    if path.exists():
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(path), str(target))


def write(path, data):
    data = data.encode("utf-8") if isinstance(data, str) else data
    if path.exists() and path.read_bytes() == data:
        return
    retire(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def png(picture):
    stream = BytesIO()
    picture.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def render(page, source, size):
    page.set_viewport_size({"width": size, "height": size})
    page.set_content('<style>html,body{margin:0;background:transparent}svg{width:100vw;height:100vh;display:block}</style>' + source)
    return Image.open(BytesIO(page.screenshot(omit_background=True))).convert("RGBA")


def main():
    small = (ART / "icon-small.svg").read_text(encoding="utf-8")
    mono = (ART / "symbol-small.svg").read_text(encoding="utf-8").replace("#18251F", "#000000")
    images = {size: (ART / f"exports/dark/icon-{size}.png").read_bytes() for size in (16, 24, 32, 48, 64, 128, 256, 1024)}
    with sync_playwright() as p:
        with p.chromium.launch() as browser:
            page = browser.new_page(device_scale_factor=1)
            tray_colour = render(page, small, 256).resize((64, 64), Image.Resampling.LANCZOS)
            glyph = render(page, mono, 288).resize((36, 36), Image.Resampling.LANCZOS)
            glyph.putalpha(glyph.getchannel("A").point(lambda a: 0 if a <= 2 else a))
            tray = Image.new("RGBA", (44, 44))
            tray.paste(glyph, (4, 4))
            page.close()
    write(ROOT / "internal/gui/icon.png", png(tray_colour))
    write(ROOT / "internal/gui/icon-1024.png", images[1024])
    write(ROOT / "internal/gui/tray.png", png(tray))
    # Retain the existing click animation's duration and frame names, using
    # a gentle lift of the new mark instead of changing back into a bird.
    frames = ROOT / "internal/gui/trayflap"
    retire(frames)
    frames.mkdir(parents=True)
    for frame in range(1, 31):
        offset = 0 if frame == 30 else 1.2 * math.sin(math.pi * frame / 30) ** 2
        picture = tray.transform(tray.size, Image.Transform.AFFINE, (1, 0, 0, 0, 1, offset), resample=Image.Resampling.BICUBIC)
        picture.putalpha(picture.getchannel("A").point(lambda a: 0 if a <= 2 else a))
        write(frames / f"flap-{frame:02d}.png", png(picture))
    for size in (16, 24, 32, 48, 64, 128, 256):
        write(ROOT / f"build/windows/icon-{size}.png", images[size])
    write(ROOT / "internal/gui/assets/icons/favicon.svg", small)

    # Prefix the inline gradients so a provider's SVG cannot reuse their IDs.
    # The adjacent wordmark already names this decorative inline image.
    inline = small.strip().replace("<title>WorkPlace</title>", "", 1)
    for identifier in re.findall(r'\bid="([^"]+)"', small):
        inline = inline.replace('id="' + identifier + '"', 'id="wp-' + identifier + '"').replace('url(#' + identifier + ')', 'url(#wp-' + identifier + ')')
    inline = inline.replace('<svg ', '<svg width="20" height="20" ', 1)
    html_path = ROOT / "internal/gui/assets/index.html"
    html = html_path.read_bytes().decode("utf-8")
    html, changed = re.subn(r'(<span class="logo" aria-hidden="true">).*?(</span>)', lambda m: m[1] + inline + m[2], html, count=1, flags=re.DOTALL)
    if changed != 1:
        raise ValueError("Cannot locate the header logo")
    html = html.replace('<title>magpie</title>', '<title>WorkPlace</title>').replace('<span>magpie</span>', '<span>WorkPlace</span>', 1)
    html = html.replace('>Open magpie</button>', '>Open WorkPlace</button>')
    write(html_path, html)
    print("Applied WorkPlace: GUI icons, header, favicon, tray frames and Windows PNGs.")
    print("Previous assets: " + str(BACKUP))


if __name__ == "__main__":
    main()
