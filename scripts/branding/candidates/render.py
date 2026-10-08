"""Rasterize the WorkPlace candidates and produce comparable review boards."""

from io import BytesIO
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

from artwork import ASSETS, STUDIES, save, write_artwork


PNG_SIZES = (16, 24, 32, 48, 64, 128, 256, 512, 1024)
MONO_SIZES = (16, 20, 24, 32, 48)
FONT_ROOT = Path("C:/Windows/Fonts")


def font(size, bold=False, latin=False):
    file = "segoeuib.ttf" if latin and bold else "segoeui.ttf" if latin else "msyhbd.ttc" if bold else "msyh.ttc"
    return ImageFont.truetype(str(FONT_ROOT / file), size)


def png(image):
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def raster(page, source, size):
    page.set_viewport_size({"width": size, "height": size})
    page.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + source.read_text(encoding="utf-8"))
    return Image.open(BytesIO(page.screenshot(omit_background=True))).convert("RGBA")


def export(browser):
    page = browser.new_page(device_scale_factor=1)
    for slug in STUDIES:
        folder = ASSETS / slug
        master = raster(page, folder / "icon.svg", 1024)
        for size in PNG_SIZES:
            save(folder / f"exports/icons/icon-{size}.png", png(master.resize((size, size), Image.Resampling.LANCZOS)))
        light = raster(page, folder / "icon-light.svg", 1024)
        for size in PNG_SIZES:
            save(folder / f"exports/light/icon-{size}.png", png(light.resize((size, size), Image.Resampling.LANCZOS)))
        foreground = raster(page, folder / "foreground.svg", 512)
        save(folder / "exports/foreground/art-512.png", png(foreground))
        icon_stream = BytesIO()
        ico_sizes = [(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]
        master.save(icon_stream, format="ICO", sizes=ico_sizes)
        ico = Image.open(BytesIO(icon_stream.getvalue()))
        assert ico.ico.sizes() == set(ico_sizes)
        save(folder / "exports/icons/app.ico", icon_stream.getvalue())
        symbol = raster(page, folder / "symbol.svg", 384)
        save(folder / "exports/mono/symbol-384.png", png(symbol))
        for size in MONO_SIZES:
            alpha = symbol.resize((size, size), Image.Resampling.LANCZOS).getchannel("A")
            for suffix, color in (("", "#18251F"), ("-light", "#F2F3E9")):
                mono = Image.new("RGBA", (size, size), color)
                mono.putalpha(alpha)
                save(folder / f"exports/mono/symbol-{size}{suffix}.png", png(mono))
        assert master.getpixel((0, 0))[3] == 0
        print(f"Exported {slug}", flush=True)
    page.close()


def paste_fit(board, file, box, maximum=None):
    image = Image.open(file).convert("RGBA")
    width, height = box[2] - box[0], box[3] - box[1]
    size = min(width, height) if maximum is None else min(maximum, width, height)
    image.thumbnail((size, size), Image.Resampling.LANCZOS)
    board.paste(image, (box[0] + (width - image.width) // 2, box[1] + (height - image.height) // 2), image)


def overview():
    board = Image.new("RGB", (1600, 1100), "#F1EFE7")
    draw = ImageDraw.Draw(board)
    ink, muted, line = "#26362B", "#6C7468", "#D8DCCE"
    draw.text((65, 39), "WorkPlace", font=font(36, bold=True, latin=True), fill=ink)
    draw.text((1240, 55), "ICON STUDIES / 01", font=font(14, latin=True), fill=muted)
    draw.line((65, 106, 1535, 106), fill=line, width=2)
    draw.text((65, 139), "为自己的创作，找一个形象。", font=font(30, bold=True), fill=ink)
    draw.text((65, 194), "三个方向 · 同尺寸对照 · 下方均为对应图形的单色与实际像素效果", font=font(17), fill=muted)
    descriptions = [
        ("两件工具，接成一处工坊。", "陶瓷白 × 暖铜 / 精密、可靠"),
        ("把不同能力，汇聚到同一处。", "冰蓝 × 银白 / 连接、流动"),
        ("点亮工作台，进入创作状态。", "暖金 × 石墨 / 个人、专注"),
    ]
    for index, (slug, study) in enumerate(STUDIES.items()):
        x = 65 + index * 495
        draw.rounded_rectangle((x, 252, x + 475, 1007), radius=20, fill="#FCFBF6", outline=line)
        draw.text((x + 26, 278), chr(65 + index) + " / " + study["en"].upper(), font=font(13, latin=True), fill=muted)
        paste_fit(board, ASSETS / slug / "exports/icons/icon-512.png", (x + 35, 311, x + 440, 684), maximum=336)
        draw.text((x + 28, 699), study["label"], font=font(24, bold=True), fill=ink)
        draw.text((x + 28, 741), descriptions[index][0], font=font(16), fill=muted)
        draw.text((x + 28, 776), descriptions[index][1], font=font(13), fill=muted)
        draw.line((x + 28, 819, x + 447, 819), fill=line)
        draw.text((x + 28, 843), "MONO", font=font(11, latin=True), fill=muted)
        paste_fit(board, ASSETS / slug / "exports/mono/symbol-384.png", (x + 26, 866, x + 106, 949), maximum=70)
        draw.text((x + 147, 843), "ACTUAL PIXELS", font=font(11, latin=True), fill=muted)
        for small_index, size in enumerate((16, 24, 32, 48)):
            image = Image.open(ASSETS / slug / f"exports/icons/icon-{size}.png").convert("RGBA")
            center_x = x + 164 + small_index * 78
            board.paste(image, (center_x - size // 2, 912 - size), image)
            draw.text((center_x - 7, 934), str(size), font=font(11, latin=True), fill=muted)
    draw.text((65, 1044), "原创图形探索。名称固定为 WorkPlace；图标方向待选择。", font=font(14), fill=muted)
    save(ASSETS / "previews/overview.png", png(board))


def detail(slug):
    study = STUDIES[slug]
    board = Image.new("RGB", (1440, 1050), "#F1EFE7")
    draw = ImageDraw.Draw(board)
    draw.text((55, 36), "WorkPlace / " + study["en"], font=font(31, bold=True, latin=True), fill="#26362B")
    draw.text((55, 95), study["label"] + "  ·  大图、单色、实际像素与放大检查", font=font(18), fill="#6C7468")
    panels = [(55, 155, 697, 725, "#E4E8DE"), (743, 155, 1385, 725, "#1D2621")]
    for x0, y0, x1, y1, color in panels:
        draw.rounded_rectangle((x0, y0, x1, y1), radius=18, fill=color)
    paste_fit(board, ASSETS / slug / "exports/light/icon-512.png", (55, 155, 697, 725), maximum=420)
    paste_fit(board, ASSETS / slug / "exports/icons/icon-512.png", (743, 155, 1385, 725), maximum=420)
    draw.text((55, 762), "彩色 · 实际尺寸", font=font(15), fill="#6C7468")
    draw.text((473, 762), "单色 · 实际尺寸", font=font(15), fill="#6C7468")
    draw.text((928, 762), "16 PX · 8× 放大", font=font(15), fill="#6C7468")
    for index, size in enumerate((16, 24, 32, 48)):
        x = 85 + index * 87
        image = Image.open(ASSETS / slug / f"exports/icons/icon-{size}.png").convert("RGBA")
        board.paste(image, (x - size // 2, 863 - size), image)
        draw.text((x - 6, 882), str(size), font=font(12, latin=True), fill="#6C7468")
        symbol = Image.open(ASSETS / slug / f"exports/mono/symbol-{size}.png").convert("RGBA")
        board.paste(symbol, (x + 418 - size // 2, 863 - size), symbol)
        draw.text((x + 412, 882), str(size), font=font(12, latin=True), fill="#6C7468")
    for offset, source in ((0, "icons/icon-16.png"), (165, "mono/symbol-16.png")):
        image = Image.open(ASSETS / slug / "exports" / source).convert("RGBA").resize((128, 128), Image.Resampling.NEAREST)
        board.paste(image, (928 + offset, 800), image)
    draw.text((55, 983), "主体轮廓保持一致。单色版本去除材质；放大像素图使用最近邻，不补画不存在的细节。", font=font(14), fill="#6C7468")
    save(ASSETS / "previews" / f"{slug}.png", png(board))


def reference_thumbnail():
    # The official Cursor presentation has a large uniform margin.
    source = ASSETS.parent / "research/references/cursor/official.png"
    original = Image.open(source).convert("RGBA")
    rgb = original.convert("RGB")
    background = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    difference = ImageChops.difference(rgb, background).convert("L")
    bounds = difference.point(lambda value: 255 if value > 15 else 0).getbbox()
    if bounds is None:
        raise ValueError("Cursor reference has no visible foreground")
    x0, y0, x1, y1 = bounds
    picture = original.crop((max(0, x0 - 45), max(0, y0 - 45), min(original.width, x1 + 45), min(original.height, y1 + 45)))
    picture.thumbnail((256, 256), Image.Resampling.LANCZOS)
    save(ASSETS / "previews/references/cursor.png", png(picture))


def main():
    write_artwork()
    with sync_playwright() as playwright:
        with playwright.chromium.launch() as browser:
            export(browser)
    overview()
    for slug in STUDIES:
        detail(slug)
    reference_thumbnail()
    print(f"Overview: {ASSETS / 'previews/overview.png'}", flush=True)


if __name__ == "__main__":
    main()
