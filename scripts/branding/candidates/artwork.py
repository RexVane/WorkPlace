"""Original, editable SVG studies for WorkPlace. No fonts or external artwork."""

from pathlib import Path
from datetime import datetime
import math
import shutil


ROOT = Path(__file__).resolve().parents[3]
ASSETS = ROOT / "docs/assets/branding/candidates"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S-%f")


def save(path, content):
    path = path.resolve()
    if not path.is_relative_to(ASSETS.resolve()):
        raise ValueError("Output outside candidate folder")
    if path.exists():
        backup = ROOT / "backups" / ("workplace-candidates-" + STAMP) / path.relative_to(ASSETS)
        if not backup.resolve().is_relative_to((ROOT / "backups").resolve()):
            raise ValueError("Backup outside project")
        backup.parent.mkdir(parents=True, exist_ok=True)
        if backup.exists():
            backup = backup.with_name(backup.name + "-" + datetime.now().strftime("%H%M%S-%f"))
        shutil.move(str(path), str(backup))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content.encode("utf-8") if isinstance(content, str) else content)


def polygon(points):
    return "M" + " ".join(("L" if i else "") + f"{x:.2f},{y:.2f}" for i, (x, y) in enumerate(points)) + "Z"


def project(u, v, z=0):
    return (128 + (u - v) * .86, 139 + (u + v - 100) * .51 - z)


def rounded_polygon(points, radius=2):
    corners = []
    for i, point in enumerate(points):
        previous, following = points[i - 1], points[(i + 1) % len(points)]
        first, second = math.dist(previous, point), math.dist(point, following)
        distance = min(radius, first / 3, second / 3)
        before = tuple(point[j] + (previous[j] - point[j]) * distance / first for j in (0, 1))
        after = tuple(point[j] + (following[j] - point[j]) * distance / second for j in (0, 1))
        corners.append((before, point, after))
    result = "M%.2f %.2f" % corners[0][0]
    for before, point, after in corners:
        result += "L%.2f %.2fQ%.2f %.2f %.2f %.2f" % (*before, *point, *after)
    return result + "Z"


def block(points, material, z=21, depth=15):
    top = [project(u, v, z) for u, v in points]
    bottom = [(x, y + depth) for x, y in top]
    parts = [f'<path d="{rounded_polygon(bottom)}" fill="url(#{material}-side)"/>']
    for i, point in enumerate(top):
        following = top[(i + 1) % len(top)]
        parts.append(f'<path d="{polygon([point, following, (following[0], following[1] + depth), (point[0], point[1] + depth)])}" fill="url(#{material}-side)"/>')
    parts.append(f'<path d="{rounded_polygon(top, 2.5)}" fill="url(#{material}-top)" stroke="url(#{material}-edge)" stroke-width="1.15" stroke-linejoin="round"/>')
    return "".join(parts)


JOIN_LEFT = [(8, 0), (43, 0), (43, 33), (59, 33), (59, 67), (43, 67), (43, 100), (8, 100), (0, 92), (0, 8)]
JOIN_RIGHT = [(57, 0), (92, 0), (100, 8), (100, 92), (92, 100), (57, 100), (57, 81), (73, 81), (73, 19), (57, 19)]


def joinery():
    defs = """
      <linearGradient id="stone-top" x1=".15" y1="0" x2=".78" y2="1" gradientUnits="objectBoundingBox">
        <stop stop-color="#FFFAEB"/><stop offset=".45" stop-color="#E6E5D8"/><stop offset="1" stop-color="#B8C5BA"/>
      </linearGradient>
      <linearGradient id="stone-side" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#B4BDB3"/><stop offset=".58" stop-color="#768B7F"/><stop offset="1" stop-color="#516D5E"/></linearGradient>
      <linearGradient id="stone-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF" stop-opacity=".8"/><stop offset="1" stop-color="#B9C4B8" stop-opacity=".3"/></linearGradient>
      <linearGradient id="copper-top" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#FFE0B8"/><stop offset=".52" stop-color="#DDA572"/><stop offset="1" stop-color="#BA784C"/></linearGradient>
      <linearGradient id="copper-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#B9784B"/><stop offset=".7" stop-color="#77462F"/><stop offset="1" stop-color="#573925"/></linearGradient>
      <linearGradient id="copper-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFF0D0" stop-opacity=".8"/><stop offset="1" stop-color="#AC764C" stop-opacity=".2"/></linearGradient>
    """
    body = '<g filter="url(#object-shadow)">' + block(JOIN_LEFT, "stone") + block(JOIN_RIGHT, "copper") + "</g>"
    mark = "".join(f'<path d="{rounded_polygon([project(u, v, 14) for u, v in points], 2.5)}"/>' for points in (JOIN_LEFT, JOIN_RIGHT))
    return defs, body, mark


def harbor():
    # A continuous receiving platform: one open sweep, one resting core.
    bowl = "M198 110C206 123 208 139 198 155C184 179 148 192 116 186C85 181 57 161 54 138C51 116 67 93 91 81L104 102C87 110 79 123 83 135C88 150 106 159 125 162C148 166 169 158 175 146C179 138 178 131 174 124Z"
    core = "M135 73C153 71 167 79 169 92C171 105 159 118 142 121C124 124 109 115 108 102C107 88 118 76 135 73Z"
    defs = """
      <linearGradient id="bowl-top" x1=".1" y1=".1" x2=".85" y2="1"><stop stop-color="#C2F8F2"/><stop offset=".45" stop-color="#58B7D2"/><stop offset="1" stop-color="#367399"/></linearGradient>
      <linearGradient id="bowl-side" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#568DA5"/><stop offset=".5" stop-color="#285870"/><stop offset="1" stop-color="#152F49"/></linearGradient>
      <linearGradient id="bowl-edge" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#DDFFFA" stop-opacity=".95"/><stop offset=".65" stop-color="#89C6DD" stop-opacity=".2"/><stop offset="1" stop-color="#246080"/></linearGradient>
      <radialGradient id="core" cx=".3" cy=".12" r=".9"><stop stop-color="#FFFFFF"/><stop offset=".4" stop-color="#DEEFEE"/><stop offset="1" stop-color="#83B7C9"/></radialGradient>
      <linearGradient id="core-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#91B9C3"/><stop offset="1" stop-color="#426B81"/></linearGradient>
    """
    body = f"""
      <g filter="url(#object-shadow)">
        <path d="{bowl}" transform="translate(0 13)" fill="url(#bowl-side)"/>
        <path d="{core}" transform="translate(0 7)" fill="url(#core-side)"/>
        <path d="{core}" fill="url(#core)" stroke="#E8FCFA" stroke-opacity=".55" stroke-width="1"/>
        <path d="{bowl}" fill="url(#bowl-top)" stroke="url(#bowl-edge)" stroke-width="1.25"/>
        <path d="M64 139C68 159 94 175 119 180C148 186 181 174 191 157" fill="none" stroke="#B5DFE5" stroke-opacity=".28" stroke-width="1.2" stroke-linecap="round"/>
      </g>"""
    mark = f'<path d="{bowl}"/><path d="{core}"/>'
    return defs, body, mark


def beacon():
    # A carved alcove: the opening stays visible when light and material disappear.
    outer = "M70 116C70 78 88 52 119 43C151 33 181 53 181 88V166C181 176 175 184 165 187L104 205C84 211 70 201 70 182Z"
    opening = "M97 117C97 93 105 79 122 74C142 68 157 81 157 104V153C157 161 153 166 146 168L111 178C102 181 97 177 97 168Z"
    defs = """
      <linearGradient id="shell" x1="0" y1="0" x2="1" y2=".75"><stop stop-color="#FFF0CC"/><stop offset=".46" stop-color="#E4B96E"/><stop offset="1" stop-color="#A6753E"/></linearGradient>
      <linearGradient id="shell-side" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D8A562"/><stop offset=".65" stop-color="#795235"/><stop offset="1" stop-color="#563B2A"/></linearGradient>
      <linearGradient id="shell-edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFE6" stop-opacity=".9"/><stop offset=".5" stop-color="#FFD898" stop-opacity=".2"/><stop offset="1" stop-color="#AF783F" stop-opacity=".6"/></linearGradient>
      <linearGradient id="room" x1=".15" y1="0" x2=".8" y2="1"><stop stop-color="#59452B"/><stop offset=".45" stop-color="#2D3025"/><stop offset="1" stop-color="#70512C"/></linearGradient>
      <radialGradient id="room-light" cx=".45" cy=".83" r=".6"><stop stop-color="#FFDC88" stop-opacity=".6"/><stop offset=".65" stop-color="#D39739" stop-opacity=".12"/><stop offset="1" stop-color="#D39739" stop-opacity="0"/></radialGradient>
      <linearGradient id="light-core" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#FFF9DE"/><stop offset=".6" stop-color="#FFE1A1"/><stop offset="1" stop-color="#CC9D55"/></linearGradient>
      <clipPath id="opening"><path d="{opening}"/></clipPath>
    """.replace("{opening}", opening)
    body = f"""
      <g transform="translate(2 -1)" filter="url(#object-shadow)">
        <path d="{outer}" transform="translate(9 8)" fill="url(#shell-side)"/>
        <path d="{outer}" fill="url(#shell)" stroke="url(#shell-edge)" stroke-width="1.2"/>
        <path d="{opening}" fill="url(#room)" stroke="#775732" stroke-opacity=".45" stroke-width="1.2"/>
        <g clip-path="url(#opening)">
          <path d="M97 164L144 147L164 160L113 181Z" fill="#BC914A" opacity=".45"/>
          <path d="M110 174V117C110 95 119 84 133 81C146 78 158 89 160 107" fill="none" stroke="#151F1A" stroke-opacity=".4" stroke-width="5"/>
          <ellipse cx="132" cy="146" rx="44" ry="48" fill="url(#room-light)"/>
          <path d="M109 137L141 127L156 140L124 150Z" fill="url(#light-core)"/>
          <path d="M109 137V145L124 158V150Z" fill="#BB8B48"/>
          <path d="M124 150L156 140V148L124 158Z" fill="#E3BC77"/>
        </g>
        <path d="M80 113C80 83 94 62 122 54C140 48 156 55 163 65" fill="none" stroke="#FFFFEC" stroke-opacity=".37" stroke-width="1.3" stroke-linecap="round"/>
      </g>"""
    mark = f'<path fill-rule="evenodd" d="{outer}{opening}"/><path d="M109 137L141 127L156 140V148L124 158L109 145Z"/>'
    return defs, body, mark


STUDIES = {
    "joinery": {"label": "工坊榫接", "en": "Joinery", "base": "#111C18", "top": "#344037", "light": "#F0EFE7", "art": joinery},
    "harbor": {"label": "汇聚的泊位", "en": "Harbor", "base": "#0F1B27", "top": "#314959", "light": "#ECF1F2", "art": harbor},
    "beacon": {"label": "点亮的工位", "en": "Beacon", "base": "#241C15", "top": "#514A39", "light": "#F5EEE0", "art": beacon},
}


def svg(title, definitions, body, viewbox="0 0 256 256"):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" fill="none"><title>{title}</title><defs>{definitions}</defs>{body}</svg>\n'


def write_artwork():
    shared = '<filter id="object-shadow" x="-35%" y="-35%" width="170%" height="185%"><feDropShadow dx="0" dy="9" stdDeviation="5" flood-color="#020806" flood-opacity=".45"/></filter>'
    for slug, study in STUDIES.items():
        folder = ASSETS / slug
        definitions, body, mark = study["art"]()
        background = f'<radialGradient id="tile" cx=".38" cy=".12" r=".94"><stop stop-color="{study["top"]}"/><stop offset=".72" stop-color="{study["base"]}"/><stop offset="1" stop-color="{study["base"]}"/></radialGradient><linearGradient id="tile-rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF" stop-opacity=".22"/><stop offset=".5" stop-color="#FFFFFF" stop-opacity=".025"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".07"/></linearGradient>'
        tile = '<rect x="10" y="10" width="236" height="236" rx="53" fill="url(#tile)"/><rect x="10.7" y="10.7" width="234.6" height="234.6" rx="52.3" stroke="url(#tile-rim)" stroke-width="1.4"/>'
        title = "WorkPlace / " + study["en"]
        save(folder / "icon.svg", svg(title, shared + definitions + background, tile + body))
        light_tile = f'<rect x="10" y="10" width="236" height="236" rx="53" fill="{study["light"]}"/><rect x="10.7" y="10.7" width="234.6" height="234.6" rx="52.3" stroke="#514F45" stroke-opacity=".15" stroke-width="1.4"/>'
        save(folder / "icon-light.svg", svg(title + " / Light", shared + definitions, light_tile + body))
        save(folder / "foreground.svg", svg(title + " / Foreground", shared + definitions, body))
        save(folder / "background.svg", svg(title + " / Unmasked background", background, '<rect width="256" height="256" fill="url(#tile)"/>'))
        save(folder / "symbol.svg", svg(title + " / Monochrome", "", '<g fill="#18251F">' + mark + "</g>", "35 35 186 186"))
    print("SVG studies: joinery, harbor, beacon", flush=True)


if __name__ == "__main__":
    write_artwork()
