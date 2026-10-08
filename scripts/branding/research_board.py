"""Render a local board of official references, without changing their artwork."""

from datetime import datetime
from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT / "docs/assets/branding/research"
FONT = Path("C:/Windows/Fonts/msyh.ttc")
FONT_BOLD = Path("C:/Windows/Fonts/msyhbd.ttc")
FONT_LATIN = Path("C:/Windows/Fonts/segoeui.ttf")
INK = "#24362B"
MUTED = "#677366"
PAPER = "#F3F1E9"


def font(size, bold=False, latin=False):
    source = FONT_LATIN if latin else FONT_BOLD if bold else FONT
    if not source.is_file():
        raise FileNotFoundError(f"Font needed for the reference board: {source}")
    return ImageFont.truetype(str(source), size)


def save(image, target):
    target = target.resolve()
    if not target.is_relative_to(RESEARCH.resolve()):
        raise ValueError("Output must remain in the research folder")
    if target.exists():
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup = ROOT / "backups" / ("branding-research-" + stamp) / target.relative_to(RESEARCH)
        if not backup.resolve().is_relative_to((ROOT / "backups").resolve()):
            raise ValueError("Backup must remain in project backups")
        backup.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(target), str(backup))
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, optimize=True)


def cursor_icon(image):
    """Remove the uniform margin of the official presentation, keeping the icon."""
    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    difference = ImageChops.difference(rgb, background).convert("L")
    bounds = difference.point(lambda value: 255 if value > 15 else 0).getbbox()
    if bounds is None:
        raise ValueError("Cursor reference has no visible foreground")
    margin = 45
    x0, y0, x1, y1 = bounds
    return image.crop((max(0, x0 - margin), max(0, y0 - margin),
                       min(image.width, x1 + margin), min(image.height, y1 + margin)))


def main():
    board = Image.new("RGB", (1600, 990), PAPER)
    draw = ImageDraw.Draw(board)
    draw.text((60, 45), "WorkPlace / Icon research", font=font(37, latin=True), fill=INK)
    draw.text((1305, 62), "09 OCT 2026", font=font(15, latin=True), fill=MUTED)
    draw.line((60, 113, 1540, 113), fill="#D7DCCF", width=2)
    draw.text((60, 144), "先找到值得记住的形体，再决定它的材质。", font=font(30, bold=True), fill=INK)
    draw.text((60, 197), "官方图标参考 · 产品含义、主体轮廓、桌面质感与小尺寸识别", font=font(18), fill=MUTED)

    references = [
        ("cursor", "Cursor", "空间构造", ["一个主体，少量明暗。", "平面标志与桌面图标分工。"], "cursor.com/brand"),
        ("linear", "Linear", "几何与留白", ["一个切口，形成记忆点。", "材质丰富，主体仍然简单。"], "linear.app/brand"),
        ("raycast", "Raycast", "工具入口的气质", ["容器、光照与材质很突出。", "大图效果需另做小尺寸校验。"], "raycast.com/press"),
        ("obsidian", "Obsidian", "有故事的物象", ["从产品价值找到具体形象。", "单色轮廓依然有识别度。"], "obsidian.md/brand"),
    ]
    for index, (slug, name, theme, notes, source) in enumerate(references):
        left = 60 + index * 375
        draw.rounded_rectangle((left, 253, left + 355, 760), radius=17,
                               fill="#FFFEFA", outline="#D8DDCF", width=1)
        draw.text((left + 24, 277), "0" + str(index + 1), font=font(13, latin=True), fill=MUTED)
        draw.text((left + 24, 306), name, font=font(27, latin=True), fill=INK)
        original = Image.open(RESEARCH / "references" / slug / "official.png").convert("RGBA")
        picture = cursor_icon(original) if slug == "cursor" else original
        picture.thumbnail((218, 218), Image.Resampling.LANCZOS)
        x = left + (355 - picture.width) // 2
        y = 357 + (224 - picture.height) // 2
        board.paste(picture, (x, y), picture)
        draw.text((left + 24, 600), theme, font=font(20, bold=True), fill=INK)
        for line, note in enumerate(notes):
            draw.text((left + 24, 638 + line * 28), note, font=font(15), fill=MUTED)
        draw.text((left + 24, 715), source, font=font(13, latin=True), fill=MUTED)

    draw.text((60, 808), "WorkPlace 的下一步", font=font(22, bold=True), fill=INK)
    draw.text((60, 849), "探索：工坊榫接 / 汇聚的泊位 / 点亮的工位。先比较形体，再看 16–48px 的实际效果。",
              font=font(20), fill=MUTED)
    draw.text((60, 923), "参考品牌仅作分析。这里展示的不是 WorkPlace 候选图标。完整依据见调研文档。",
              font=font(14), fill=MUTED)
    target = RESEARCH / "previews/reference-board.png"
    save(board, target)
    print(f"Reference board: {target}")


if __name__ == "__main__":
    main()
