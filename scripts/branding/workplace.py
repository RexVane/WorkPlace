"""Export the selected WorkPlace identity and optically adjusted small icons.

The approved large geometry comes from the original Joinery study. Its full
size artwork stays unchanged; only the 16/20/24px variants widen the joint.
"""

from datetime import datetime
from io import BytesIO
from pathlib import Path
import shutil
import zipfile

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

from candidates.artwork import JOIN_LEFT, JOIN_RIGHT, block, joinery, project, rounded_polygon, svg


ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / "docs/assets/branding"
OUT = BRAND / "workplace"
SOURCE = BRAND / "candidates/joinery"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
SIZES = (16, 20, 24, 32, 48, 64, 128, 256, 512, 1024)
MONO_SIZES = (16, 20, 24, 32, 48, 64, 256)
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)


def save(path, content):
    path = path.resolve()
    if not path.is_relative_to(OUT.resolve()):
        raise ValueError("Output must remain in the WorkPlace asset folder")
    if path.exists():
        backup = ROOT / "backups" / ("workplace-selected-" + STAMP) / path.relative_to(OUT)
        if not backup.resolve().is_relative_to((ROOT / "backups").resolve()):
            raise ValueError("Backup must remain in project backups")
        backup.parent.mkdir(parents=True, exist_ok=True)
        if backup.exists():
            backup = backup.with_name(backup.name + "-" + datetime.now().strftime("%H%M%S-%f"))
        shutil.move(str(path), str(backup))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode("utf-8") if isinstance(content, str) else content)


def sources():
    for name in ("icon.svg", "icon-light.svg", "foreground.svg", "background.svg", "symbol.svg"):
        save(OUT / name, (SOURCE / name).read_text(encoding="utf-8").replace("WorkPlace / Joinery", "WorkPlace"))
    # Keep the outer footprint and the single interlocking detail. At small
    # sizes, open the 14-unit joint to 18 units and reduce the side depth.
    left = [(u - 2 if u in (43, 59) else u, v) for u, v in JOIN_LEFT]
    right = [(u + 2 if u in (57, 73) else u, v) for u, v in JOIN_RIGHT]
    body = '<g transform="translate(-17.92 -20.48) scale(1.14 1.16)" filter="url(#object-shadow)">'
    body += block(left, "stone", depth=12) + block(right, "copper", depth=12) + "</g>"
    original_body = joinery()[1]
    for name in ("icon", "icon-light"):
        original = (OUT / (name + ".svg")).read_text(encoding="utf-8")
        if original_body not in original:
            raise ValueError("Approved artwork no longer matches its geometry source")
        small = original.replace(original_body, body).replace('dy="9" stdDeviation="5"', 'dy="2" stdDeviation="2"')
        save(OUT / (name + "-small.svg"), small)
    mark = "".join('<path d="' + rounded_polygon([project(u, v, 14) for u, v in points], 2.5) + '"/>' for points in (left, right))
    save(OUT / "symbol-small.svg", svg("WorkPlace / Small monochrome", "", '<g fill="#18251F" transform="translate(0 -23.04) scale(1 1.18)">' + mark + "</g>", "35 35 186 186"))
    for name in ("symbol", "symbol-small"):
        save(OUT / (name + "-light.svg"), (OUT / (name + ".svg")).read_text(encoding="utf-8").replace("#18251F", "#F2F3E9"))


def png(picture):
    stream = BytesIO()
    picture.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def raster(page, source, size):
    page.set_viewport_size({"width": size, "height": size})
    page.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + source.read_text(encoding="utf-8"))
    return Image.open(BytesIO(page.screenshot(omit_background=True))).convert("RGBA")


def resized(picture, size):
    result = picture.resize((size, size), Image.Resampling.LANCZOS)
    # Remove negligible alpha ringing outside the icon after downsampling.
    result.putalpha(result.getchannel("A").point(lambda value: 0 if value <= 2 else value))
    return result


def export(browser):
    page = browser.new_page(device_scale_factor=1)
    for theme, filename in (("dark", "icon"), ("light", "icon-light")):
        master = raster(page, OUT / (filename + ".svg"), 1024)
        small = raster(page, OUT / (filename + "-small.svg"), 1024)
        frames = {}
        for size in SIZES:
            frames[size] = resized(small if size <= 24 else master, size)
            save(OUT / "exports" / theme / f"icon-{size}.png", png(frames[size]))
        stream = BytesIO()
        frames[256].save(stream, format="ICO", sizes=[(s, s) for s in ICO_SIZES], append_images=[frames[s] for s in ICO_SIZES if s != 256])
        with Image.open(BytesIO(stream.getvalue())) as ico:
            assert ico.ico.sizes() == {(s, s) for s in ICO_SIZES}
            for size in ICO_SIZES:
                assert ico.ico.getimage((size, size)).convert("RGBA").tobytes() == frames[size].tobytes()
        save(OUT / "exports/windows" / ("WorkPlace.ico" if theme == "dark" else "WorkPlace-light.ico"), stream.getvalue())
    for theme, suffix in (("mono-dark", ""), ("mono-light", "-light")):
        master = raster(page, OUT / ("symbol" + suffix + ".svg"), 512)
        small = raster(page, OUT / ("symbol-small" + suffix + ".svg"), 512)
        for size in MONO_SIZES:
            save(OUT / "exports" / theme / f"symbol-{size}.png", png(resized(small if size <= 24 else master, size)))
    save(OUT / "exports/foreground/art-1024.png", png(raster(page, OUT / "foreground.svg", 1024)))
    page.close()


def font(size, bold=False, latin=False):
    name = "segoeuib.ttf" if latin and bold else "segoeui.ttf" if latin else "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype("C:/Windows/Fonts/" + name, size)


def paste(board, path, x, y, size):
    picture = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    board.paste(picture, (x, y), picture)


def boards():
    board = Image.new("RGB", (1280, 820), "#F2F0E9")
    draw = ImageDraw.Draw(board)
    ink, muted = "#26362B", "#6C7468"
    draw.text((65, 43), "WORKPLACE / SELECTED IDENTITY", font=font(13, latin=True), fill=muted)
    draw.line((65, 91, 1215, 91), fill="#D8DCCE", width=2)
    paste(board, OUT / "exports/dark/icon-512.png", 74, 137, 425)
    draw.text((580, 226), "WorkPlace", font=font(69, bold=True, latin=True), fill=ink)
    draw.text((583, 337), "工坊榫接 · 已选定", font=font(26, bold=True), fill=ink)
    draw.text((583, 391), "你的个人 AI 编程工作台", font=font(21), fill=muted)
    draw.text((583, 442), "陶瓷白 × 暖铜 × 深石墨", font=font(16), fill=muted)
    draw.line((65, 599, 1215, 599), fill="#D8DCCE", width=2)
    for index, (label, file) in enumerate((("深色", "dark/icon-128.png"), ("浅色", "light/icon-128.png"), ("单色", "mono-dark/symbol-64.png"))):
        x = 79 + index * 145
        paste(board, OUT / "exports" / file, x, 639, 64)
        draw.text((x + 16, 722), label, font=font(14), fill=muted)
    draw.text((582, 642), "16 / 20 / 24 / 32 / 48 px", font=font(14, latin=True), fill=muted)
    for index, size in enumerate((16, 20, 24, 32, 48)):
        x = 586 + index * 101
        paste(board, OUT / f"exports/dark/icon-{size}.png", x, 735 - size, size)
    save(OUT / "previews/identity.png", png(board))

    proof = Image.new("RGB", (1100, 600), "#F2F0E9")
    draw = ImageDraw.Draw(proof)
    draw.text((40, 22), "WorkPlace / Small-size refinement", font=font(25, bold=True, latin=True), fill=ink)
    draw.text((40, 82), "候选稿", font=font(16), fill=muted)
    draw.text((40, 326), "小尺寸版", font=font(16), fill=muted)
    for index, size in enumerate((16, 24)):
        x = 190 + index * 430
        for y, base in ((88, SOURCE), (332, OUT)):
            for offset, file in ((0, f"exports/icons/icon-{size}.png" if base == SOURCE else f"exports/dark/icon-{size}.png"), (205, f"exports/mono/symbol-{size}.png" if base == SOURCE else f"exports/mono-dark/symbol-{size}.png")):
                original = Image.open(base / file).convert("RGBA")
                zoom = original.resize((size * 7, size * 7), Image.Resampling.NEAREST)
                proof.paste(zoom, (x + offset, y), zoom)
                proof.paste(original, (x + offset, y + 180), original)
        draw.text((x, 550), f"{size} px · 7× + actual pixels", font=font(13, latin=True), fill=muted)
    save(OUT / "previews/small-sizes.png", png(proof))


def package():
    stream = BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for source in sorted(OUT.glob("*.svg")):
            bundle.write(source, "WorkPlace/" + source.name)
        for source in sorted((OUT / "exports").rglob("*")):
            if source.is_file() and source.suffix in (".png", ".ico"):
                bundle.write(source, "WorkPlace/" + source.relative_to(OUT).as_posix())
        bundle.writestr("WorkPlace/README.txt", "WorkPlace / Joinery\nSelected by the user on 2026-10-09.\n\nDefault app icon: exports/windows/WorkPlace.ico\nPNG: exports/dark/ and exports/light/\nSmall icons (16/20/24 px) use optically adjusted geometry.\nMonochrome: exports/mono-dark/ and exports/mono-light/\nSVG: icon.svg, icon-light.svg, symbol.svg, plus small variants.\nForeground and unmasked background are retained for platform adaptation.\nThis package contains artwork only; it does not install or rename the app.\n")
    with zipfile.ZipFile(BytesIO(stream.getvalue())) as bundle:
        assert bundle.testzip() is None
    save(OUT / "exports/package/WorkPlace-icons.zip", stream.getvalue())


def main():
    sources()
    with sync_playwright() as playwright:
        with playwright.chromium.launch() as browser:
            export(browser)
    boards()
    package()
    print(f"Selected WorkPlace assets: {OUT}", flush=True)
    print("ICO entries match the exported PNGs, including the small variants.", flush=True)


if __name__ == "__main__":
    main()
