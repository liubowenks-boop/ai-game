from __future__ import annotations

import argparse
import json
import math
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CHECKLIST = ROOT / "docs" / "05_ui_art_asset_checklist.md"
RUNTIME_ROOT = ROOT / "assets" / "bundles" / "ui"
DOC_ROOT = ROOT / "docs" / "ui_art_generated"
PREVIEW_ROOT = DOC_ROOT / "atlas_previews"
TS_MANIFEST = ROOT / "assets" / "scripts" / "ui" / "UiArtManifest.ts"


PALETTE = {
    "red": (188, 43, 30, 255),
    "red_dark": (86, 18, 12, 245),
    "gold": (255, 211, 103, 255),
    "gold_dark": (141, 88, 34, 255),
    "panel": (31, 20, 14, 232),
    "panel_dark": (13, 10, 8, 232),
    "brown": (74, 45, 25, 235),
    "blue": (66, 126, 255, 255),
    "purple": (142, 72, 236, 255),
    "green": (48, 202, 132, 255),
    "cyan": (67, 231, 218, 255),
    "white": (255, 246, 222, 255),
    "danger": (245, 64, 50, 255),
    "black": (0, 0, 0, 255),
}


@dataclass
class AssetSpec:
    atlas: str
    filename: str
    width: int
    height: int
    display: str
    usage: str
    nine_slice: dict[str, int] | None
    notes: str


AUTHORED_VFX_SPECS = (
    AssetSpec(
        atlas="battle_fx_common",
        filename="fx_v4_qinglan_talisman.png",
        width=128,
        height=256,
        display="Qinglan talisman projectile",
        usage="Qinglan companion attack projectile",
        nine_slice=None,
        notes="Authored extraction from hero_qinglan frame_0",
    ),
)


def parse_nine_slice(text: str) -> dict[str, int] | None:
    if "不做九宫格" in text:
        return None
    match = re.search(r"`?(\d+)/(\d+)/(\d+)/(\d+)`?", text)
    if not match:
        return None
    left, top, right, bottom = (int(part) for part in match.groups())
    return {"left": left, "top": top, "right": right, "bottom": bottom}


def parse_checklist() -> list[AssetSpec]:
    specs: list[AssetSpec] = []
    atlas = ""

    for raw_line in CHECKLIST.read_text(encoding="utf-8").splitlines():
        section = re.match(r"## `([^`]+)` 图集", raw_line)
        if section:
            atlas = section.group(1)
            continue

        if not atlas or not raw_line.startswith("| `"):
            continue

        cells = [cell.strip() for cell in raw_line.strip().strip("|").split("|")]
        if len(cells) < 6:
            continue

        filename = cells[0].strip("`")
        size_match = re.search(r"`?(\d+)x(\d+)`?", cells[1])
        if not filename.endswith(".png") or not size_match:
            continue

        specs.append(
            AssetSpec(
                atlas=atlas,
                filename=filename,
                width=int(size_match.group(1)),
                height=int(size_match.group(2)),
                display=cells[2].replace("`", ""),
                usage=cells[3],
                nine_slice=parse_nine_slice(cells[4]),
                notes=cells[5],
            )
        )

    specs.extend(AUTHORED_VFX_SPECS)
    return specs


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def canvas(width: int, height: int) -> Image.Image:
    return Image.new("RGBA", (width, height), (0, 0, 0, 0))


def add_glow(
    img: Image.Image,
    draw_fn: Callable[[ImageDraw.ImageDraw], None],
    blur: int,
    alpha: int = 150,
) -> None:
    glow = canvas(*img.size)
    g = ImageDraw.Draw(glow, "RGBA")
    draw_fn(g)
    glow = glow.filter(ImageFilter.GaussianBlur(blur))
    if alpha < 255:
        channel = glow.getchannel("A").point(lambda value: min(value, alpha))
        glow.putalpha(channel)
    img.alpha_composite(glow)


def rounded_gradient(
    img: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    top: tuple[int, int, int, int],
    bottom: tuple[int, int, int, int],
) -> None:
    x0, y0, x1, y1 = box
    width = max(1, x1 - x0)
    height = max(1, y1 - y0)
    gradient = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    px = gradient.load()
    for y in range(height):
        t = y / max(1, height - 1)
        color = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        for x in range(width):
            px[x, y] = color

    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=radius, fill=255)
    img.alpha_composite(gradient, (x0, y0))
    img.putalpha(Image.composite(img.getchannel("A"), img.getchannel("A"), Image.new("L", img.size, 255)))
    # Re-apply transparent outside the rounded gradient by clearing with the mask shape.
    clipped = canvas(*img.size)
    clipped.alpha_composite(gradient, (x0, y0))
    outside = Image.new("L", img.size, 0)
    outside.paste(mask, (x0, y0))
    current = img.getchannel("A")
    img.putalpha(Image.composite(current, current, Image.new("L", img.size, 255)))


def draw_panel(
    width: int,
    height: int,
    fill: tuple[int, int, int, int] = PALETTE["panel"],
    edge: tuple[int, int, int, int] = PALETTE["gold"],
    radius: int = 24,
    border: int = 4,
    glow: bool = False,
    alpha_scale: float = 1.0,
) -> Image.Image:
    img = canvas(width, height)
    d = ImageDraw.Draw(img, "RGBA")
    pad = max(border + 2, 4)
    box = (pad, pad, width - pad - 1, height - pad - 1)

    if glow:
        add_glow(
            img,
            lambda gd: gd.rounded_rectangle(box, radius=radius, outline=edge, width=max(border * 2, 8)),
            blur=max(8, min(width, height) // 14),
            alpha=140,
        )

    fill_top = tuple(min(255, int(c * 1.22)) if i < 3 else int(c * alpha_scale) for i, c in enumerate(fill))
    fill_bottom = tuple(max(0, int(c * 0.58)) if i < 3 else int(c * alpha_scale) for i, c in enumerate(fill))
    d.rounded_rectangle(box, radius=radius, fill=fill_bottom)
    inner = (box[0] + border, box[1] + border, box[2] - border, box[3] - border)
    d.rounded_rectangle(inner, radius=max(1, radius - border), fill=fill)
    d.rounded_rectangle(box, radius=radius, outline=(61, 35, 20, 240), width=border + 2)
    d.rounded_rectangle(box, radius=radius, outline=edge, width=border)
    d.line((box[0] + radius, box[1] + border, box[2] - radius, box[1] + border), fill=(255, 235, 155, 130), width=max(1, border // 2))
    return img


def draw_border(width: int, height: int, color: tuple[int, int, int, int], glow: bool = False) -> Image.Image:
    img = canvas(width, height)
    d = ImageDraw.Draw(img, "RGBA")
    box = (8, 8, width - 9, height - 9)
    radius = max(12, min(width, height) // 4)
    if glow:
        add_glow(img, lambda gd: gd.rounded_rectangle(box, radius=radius, outline=color, width=10), 9, 155)
    d.rounded_rectangle(box, radius=radius, outline=(73, 42, 19, 235), width=8)
    d.rounded_rectangle(box, radius=radius, outline=color, width=4)
    d.rounded_rectangle((box[0] + 5, box[1] + 5, box[2] - 5, box[3] - 5), radius=max(4, radius - 5), outline=(255, 247, 190, 110), width=2)
    return img


def draw_button(width: int, height: int, color: tuple[int, int, int, int], state: str = "normal") -> Image.Image:
    if state == "disabled":
        color = (88, 82, 76, 210)
        edge = (164, 142, 112, 180)
    else:
        edge = PALETTE["gold"]
    if state == "pressed":
        color = tuple(max(0, int(c * 0.68)) if i < 3 else c for i, c in enumerate(color))

    img = draw_panel(width, height, color, edge, radius=max(16, height // 3), border=5, glow=state == "normal")
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((width * 0.08, height * 0.18, width * 0.22, height * 0.48), fill=(255, 248, 202, 76))
    d.line((width * 0.2, height * 0.82, width * 0.8, height * 0.82), fill=(0, 0, 0, 95), width=max(2, height // 18))
    return img


def radial_glow(width: int, height: int, color: tuple[int, int, int, int], core: float = 0.2) -> Image.Image:
    img = canvas(width, height)
    cx, cy = width / 2, height / 2
    max_dist = math.hypot(cx, cy)
    px = img.load()
    for y in range(height):
        for x in range(width):
            dist = math.hypot(x - cx, y - cy) / max_dist
            alpha = max(0, 1 - dist)
            alpha = alpha ** 2
            if dist < core:
                alpha = 1
            px[x, y] = (color[0], color[1], color[2], int(color[3] * alpha))
    return img.filter(ImageFilter.GaussianBlur(max(1, min(width, height) // 42)))


def draw_simple_icon(name: str, width: int, height: int) -> Image.Image:
    img = canvas(width, height)
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = width // 2, height // 2
    r = int(min(width, height) * 0.34)

    def circle(fill: tuple[int, int, int, int], outline: tuple[int, int, int, int] = PALETTE["gold"]) -> None:
        add_glow(img, lambda gd: gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill), 8, 120)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill, outline=outline, width=max(3, width // 32))

    if "gold" in name:
        circle((230, 155, 35, 255))
        d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), outline=(255, 246, 172, 240), width=max(3, width // 34))
    elif "spirit_stone" in name:
        points = [(cx, cy - r), (cx + r, cy - r // 4), (cx + r // 2, cy + r), (cx - r // 2, cy + r), (cx - r, cy - r // 4)]
        add_glow(img, lambda gd: gd.polygon(points, fill=PALETTE["blue"]), 8, 150)
        d.polygon(points, fill=(58, 194, 255, 245), outline=(210, 248, 255, 255))
        d.line((cx - r // 2, cy - r // 4, cx + r // 2, cy + r // 3), fill=(255, 255, 255, 150), width=3)
    elif "pause" in name:
        circle((56, 39, 26, 230))
        bar_w = max(6, width // 10)
        d.rounded_rectangle((cx - bar_w * 2, cy - r // 2, cx - bar_w, cy + r // 2), radius=bar_w // 2, fill=PALETTE["gold"])
        d.rounded_rectangle((cx + bar_w, cy - r // 2, cx + bar_w * 2, cy + r // 2), radius=bar_w // 2, fill=PALETTE["gold"])
    elif "speed" in name:
        circle((56, 39, 26, 230))
        d.polygon([(cx - r // 2, cy - r // 2), (cx + r // 8, cy), (cx - r // 2, cy + r // 2)], fill=PALETTE["gold"])
        d.polygon([(cx, cy - r // 2), (cx + r // 2, cy), (cx, cy + r // 2)], fill=PALETTE["gold"])
    elif "auto" in name:
        circle(PALETTE["blue"])
        d.arc((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), 30, 310, fill=PALETTE["white"], width=5)
        d.polygon([(cx + r // 2, cy - 3), (cx + r // 2 + 12, cy - 8), (cx + r // 2 + 5, cy + 7)], fill=PALETTE["white"])
    elif "bond" in name:
        circle(PALETTE["green"])
        for dx in (-r // 3, r // 3):
            d.ellipse((cx + dx - r // 5, cy - r // 3, cx + dx + r // 5, cy + r // 10), fill=PALETTE["white"])
        d.arc((cx - r // 2, cy - r // 6, cx + r // 2, cy + r // 2), 200, 340, fill=PALETTE["white"], width=5)
    elif "ultimate" in name:
        circle(PALETTE["red"])
        d.polygon([(cx, cy - r), (cx + r // 4, cy - r // 8), (cx + r, cy), (cx + r // 4, cy + r // 8), (cx, cy + r), (cx - r // 4, cy + r // 8), (cx - r, cy), (cx - r // 4, cy - r // 8)], fill=(255, 235, 120, 255))
    elif "school_fire" in name:
        draw_flame(img, (cx, cy), r, PALETTE["red"])
    elif "school_thunder" in name:
        draw_lightning(img, (cx, cy), r, PALETTE["blue"])
    elif "school_summon" in name:
        circle(PALETTE["green"])
        d.arc((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), 20, 320, fill=PALETTE["white"], width=5)
        d.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=PALETTE["white"])
    elif "warning" in name:
        add_glow(img, lambda gd: gd.polygon([(cx, cy - r), (cx + r, cy + r), (cx - r, cy + r)], fill=PALETTE["danger"]), 8, 150)
        d.polygon([(cx, cy - r), (cx + r, cy + r), (cx - r, cy + r)], fill=PALETTE["danger"], outline=PALETTE["gold"])
        d.line((cx, cy - r // 2, cx, cy + r // 4), fill=PALETTE["white"], width=max(5, width // 18))
        d.ellipse((cx - 4, cy + r // 2 - 5, cx + 4, cy + r // 2 + 3), fill=PALETTE["white"])
    elif "boss" in name:
        circle(PALETTE["danger"])
        d.polygon([(cx - r, cy + r // 4), (cx - r // 2, cy - r), (cx, cy + r // 4), (cx + r // 2, cy - r), (cx + r, cy + r // 4)], fill=PALETTE["gold"])
    elif "lock" in name:
        circle((72, 62, 54, 225))
        d.rounded_rectangle((cx - r // 2, cy - r // 8, cx + r // 2, cy + r // 2), radius=8, fill=PALETTE["gold"])
        d.arc((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 4), 180, 360, fill=PALETTE["gold"], width=8)

    return img


def draw_flame(img: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int, int]) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = center
    add_glow(
        img,
        lambda gd: gd.polygon(
            [(cx, cy - radius), (cx + radius * 0.65, cy + radius * 0.1), (cx + radius * 0.25, cy + radius), (cx - radius * 0.55, cy + radius * 0.35)],
            fill=color,
        ),
        max(6, radius // 5),
        160,
    )
    outer = [(cx, cy - radius), (cx + int(radius * 0.72), cy + int(radius * 0.12)), (cx + int(radius * 0.25), cy + radius), (cx - int(radius * 0.58), cy + int(radius * 0.35))]
    inner = [(cx + radius // 8, cy - radius // 2), (cx + radius // 3, cy + radius // 4), (cx, cy + radius // 2), (cx - radius // 4, cy + radius // 6)]
    d.polygon(outer, fill=(234, 67, 26, 235), outline=(255, 214, 88, 245))
    d.polygon(inner, fill=(255, 229, 89, 245))


def draw_lightning(img: Image.Image, center: tuple[int, int], radius: int, color: tuple[int, int, int, int]) -> None:
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = center
    points = [
        (cx + radius // 5, cy - radius),
        (cx - radius // 3, cy),
        (cx + radius // 8, cy),
        (cx - radius // 5, cy + radius),
        (cx + radius // 2, cy - radius // 8),
        (cx + radius // 8, cy - radius // 8),
    ]
    add_glow(img, lambda gd: gd.polygon(points, fill=color), max(6, radius // 5), 180)
    d.polygon(points, fill=(168, 222, 255, 255), outline=color)


def draw_portrait(name: str, width: int, height: int) -> Image.Image:
    img = canvas(width, height)
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = width // 2, height // 2
    r = int(min(width, height) * 0.42)
    colors = {
        "archer": (95, 134, 78, 255),
        "gunner": (160, 82, 40, 255),
        "ice_mage": (102, 178, 232, 255),
        "poisoner": (67, 174, 86, 255),
        "guard": (158, 137, 98, 255),
        "drummer": (205, 80, 44, 255),
        "healer": (76, 205, 170, 255),
        "warlock": (130, 73, 194, 255),
        "boss": (205, 58, 44, 255),
        "fast": (80, 132, 220, 255),
        "tank": (122, 100, 76, 255),
        "ranged": (156, 84, 48, 255),
        "normal": (120, 118, 106, 255),
    }
    key = next((part for part in colors if part in name), "normal")
    base = colors[key]
    add_glow(img, lambda gd: gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=base), 14, 120)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(30, 24, 21, 235), outline=PALETTE["gold"], width=max(5, width // 32))
    d.ellipse((cx - r // 2, cy - r // 2, cx + r // 2, cy + r // 2), fill=(226, 178, 132, 255))
    d.pieslice((cx - r // 2, cy - r // 2 - 10, cx + r // 2, cy + r // 2), 190, 350, fill=base)
    d.rounded_rectangle((cx - r // 2, cy + r // 5, cx + r // 2, cy + r), radius=r // 5, fill=base)
    d.ellipse((cx - r // 4, cy - r // 8, cx - r // 4 + 5, cy - r // 8 + 5), fill=PALETTE["black"])
    d.ellipse((cx + r // 4 - 5, cy - r // 8, cx + r // 4, cy - r // 8 + 5), fill=PALETTE["black"])

    if "boss" in name:
        d.polygon([(cx - r, cy - r // 2), (cx - r // 2, cy - r), (cx, cy - r // 3), (cx + r // 2, cy - r), (cx + r, cy - r // 2)], fill=PALETTE["gold"])
    elif "guard" in name or "tank" in name:
        d.arc((cx - r // 2, cy - r, cx + r // 2, cy), 180, 360, fill=(218, 208, 180, 255), width=max(8, width // 16))
    elif "ice_mage" in name:
        d.polygon([(cx, cy - r), (cx + r // 2, cy - r // 4), (cx - r // 2, cy - r // 4)], fill=(210, 244, 255, 230))
    elif "archer" in name:
        d.arc((cx - r, cy - r, cx + r, cy + r), 280, 70, fill=PALETTE["gold"], width=max(4, width // 40))
    elif "drummer" in name:
        d.ellipse((cx - r // 3, cy + r // 2, cx + r // 3, cy + r), fill=(120, 58, 30, 255), outline=PALETTE["gold"], width=3)
    elif "healer" in name:
        d.ellipse((cx - r // 2, cy - r - 8, cx + r // 2, cy - r + 10), outline=(176, 255, 224, 230), width=4)
    elif "warlock" in name:
        d.polygon([(cx - r // 2, cy - r // 2), (cx - r, cy - r), (cx - r // 4, cy - r // 3)], fill=(96, 52, 130, 255))
        d.polygon([(cx + r // 2, cy - r // 2), (cx + r, cy - r), (cx + r // 4, cy - r // 3)], fill=(96, 52, 130, 255))

    return img


def draw_fx(name: str, width: int, height: int) -> Image.Image:
    if "glow_gold" in name:
        return radial_glow(width, height, PALETTE["gold"], 0.05)
    if "glow_red" in name:
        return radial_glow(width, height, PALETTE["danger"], 0.04)
    if "glow_blue" in name:
        return radial_glow(width, height, PALETTE["blue"], 0.04)
    if "glow_green" in name:
        return radial_glow(width, height, PALETTE["green"], 0.04)

    img = canvas(width, height)
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = width // 2, height // 2
    r = min(width, height) // 3

    if "hit_flash" in name:
        return radial_glow(width, height, (255, 255, 255, 230), 0.02)
    if "warning_banner" in name:
        add_glow(img, lambda gd: gd.rounded_rectangle((20, 24, width - 20, height - 24), radius=height // 4, fill=PALETTE["danger"]), 18, 130)
        d.rounded_rectangle((26, 32, width - 26, height - 32), radius=height // 5, outline=PALETTE["gold"], width=5, fill=(118, 25, 18, 170))
    elif "fire_small" in name:
        draw_flame(img, (cx, cy), r, PALETTE["red"])
    elif "thunder_line" in name:
        points = [(8, height // 2), (width // 3, height // 4), (width // 2, height // 2), (width - 8, height // 3)]
        add_glow(img, lambda gd: gd.line(points, fill=PALETTE["blue"], width=10), 8, 180)
        d.line(points, fill=(190, 232, 255, 255), width=5)
    elif "poison_dot" in name:
        add_glow(img, lambda gd: gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PALETTE["green"]), 8, 170)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(84, 222, 72, 210))
        d.ellipse((cx - r // 3, cy - r // 2, cx, cy - r // 6), fill=(225, 255, 194, 180))
    elif "heal_plus" in name:
        add_glow(img, lambda gd: gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PALETTE["green"]), 8, 140)
        d.rounded_rectangle((cx - 8, cy - r, cx + 8, cy + r), radius=4, fill=(216, 255, 224, 255))
        d.rounded_rectangle((cx - r, cy - 8, cx + r, cy + 8), radius=4, fill=(216, 255, 224, 255))
    elif "slow_snowflake" in name:
        for angle in range(0, 180, 30):
            rad = math.radians(angle)
            x = math.cos(rad) * r
            y = math.sin(rad) * r
            d.line((cx - x, cy - y, cx + x, cy + y), fill=(188, 238, 255, 245), width=4)
        add_glow(img, lambda gd: gd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=PALETTE["blue"], width=4), 8, 130)
    elif "vulnerable_break" in name:
        add_glow(img, lambda gd: gd.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=PALETTE["purple"]), 9, 145)
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], outline=PALETTE["purple"], width=5)
        d.line((cx - r // 2, cy - r // 2, cx + r // 4, cy, cx - r // 6, cy + r // 2, cx + r // 2, cy + r // 3), fill=PALETTE["white"], width=4)
    return img


def draw_asset(spec: AssetSpec) -> Image.Image:
    name = spec.filename
    width, height = spec.width, spec.height

    if spec.atlas == "ui_common":
        if "panel_dark_gold" in name:
            return draw_panel(width, height, PALETTE["panel"], PALETTE["gold"], 28, 5, True)
        if "panel_dark_translucent" in name:
            return draw_panel(width, height, (14, 12, 11, 185), (161, 118, 68, 160), 28, 4, False)
        if "panel_card_inner" in name:
            return draw_panel(width, height, (36, 24, 20, 230), (145, 86, 45, 190), 24, 4, False)
        if "border_gold_thin" in name:
            return draw_border(width, height, PALETTE["gold"], False)
        if "border_gold_glow" in name:
            return draw_border(width, height, PALETTE["gold"], True)
        if "divider" in name:
            img = canvas(width, height)
            d = ImageDraw.Draw(img, "RGBA")
            d.line((10, height // 2, width - 10, height // 2), fill=PALETTE["gold"], width=max(3, height // 4))
            d.line((40, height // 2 + 4, width - 40, height // 2 + 4), fill=(255, 247, 190, 90), width=2)
            return img
        if "shadow" in name:
            img = canvas(width, height)
            d = ImageDraw.Draw(img, "RGBA")
            d.ellipse((width * 0.12, height * 0.18, width * 0.88, height * 0.82), fill=(0, 0, 0, 150))
            return img.filter(ImageFilter.GaussianBlur(width // 11))
        if "mask_dim" in name:
            return Image.new("RGBA", (width, height), (0, 0, 0, 150))
        if "button_red" in name:
            state = "pressed" if "pressed" in name else "disabled" if "disabled" in name else "normal"
            return draw_button(width, height, PALETTE["red"], state)
        if "button_blue" in name:
            return draw_button(width, height, PALETTE["blue"], "normal")
        if "button_green" in name:
            return draw_button(width, height, PALETTE["green"], "normal")
        if "badge_round_dark" in name:
            return draw_simple_icon("pause", width, height)
        if "badge_round_gold" in name:
            return draw_simple_icon("gold", width, height)

    if spec.atlas == "ui_hud":
        if "hp_fill_green" in name:
            return draw_button(width, height, PALETTE["green"], "normal")
        if "hp_fill_yellow" in name:
            return draw_button(width, height, PALETTE["gold"], "normal")
        if "hp_fill_red" in name or "boss_hp_fill" in name:
            return draw_button(width, height, PALETTE["danger"], "normal")
        if "flash" in name or "ready_glow" in name or "burst_glow" in name:
            color = PALETTE["danger"] if "boss" in name else PALETTE["gold"]
            return radial_glow(width, height, color, 0.03)
        if "ultimate_button_bg" in name:
            return draw_simple_icon("ultimate", width, height)
        if "ultimate_button_disabled" in name:
            return draw_button(width, height, (82, 76, 68, 210), "disabled")
        if "ultimate_energy_ring" in name:
            img = canvas(width, height)
            d = ImageDraw.Draw(img, "RGBA")
            pad = width // 9
            add_glow(img, lambda gd: gd.ellipse((pad, pad, width - pad, height - pad), outline=PALETTE["gold"], width=10), 8, 150)
            d.ellipse((pad, pad, width - pad, height - pad), outline=PALETTE["gold"], width=8)
            return img
        if "avatar_slot_empty" in name or "avatar_frame_normal" in name or "avatar_frame_focus" in name:
            return draw_panel(width, height, (28, 22, 18, 185), PALETTE["gold"], 16, 4, "focus" in name)
        if "level_badge" in name:
            return draw_panel(width, height, PALETTE["red"], PALETTE["gold"], 12, 3, False)
        if "auto_button" in name:
            return draw_button(width, height, PALETTE["blue"], "normal")
        if "bond_button" in name:
            return draw_button(width, height, PALETTE["green"], "normal")
        return draw_panel(width, height, PALETTE["panel"], PALETTE["gold"], max(14, min(width, height) // 4), 4, "boss" in name)

    if spec.atlas == "ui_cards":
        if "bg_fire" in name:
            return draw_panel(width, height, (83, 20, 13, 232), (255, 117, 45, 255), 24, 5, True)
        if "bg_thunder" in name:
            return draw_panel(width, height, (26, 22, 82, 232), (128, 102, 255, 255), 24, 5, True)
        if "bg_summon" in name:
            return draw_panel(width, height, (18, 72, 49, 232), (74, 239, 174, 255), 24, 5, True)
        if "frame_normal" in name:
            return draw_border(width, height, PALETTE["gold"], False)
        if "frame_rare" in name:
            return draw_border(width, height, PALETTE["blue"], True)
        if "frame_epic" in name:
            return draw_border(width, height, PALETTE["purple"], True)
        if "frame_legendary" in name:
            return draw_border(width, height, (255, 203, 58, 255), True)
        if "selected_glow" in name:
            return radial_glow(width, height, PALETTE["gold"], 0.02)
        if "icon_slot" in name:
            return draw_panel(width, height, (18, 12, 10, 205), PALETTE["gold"], 14, 3, False)
        if "tag_fire" in name:
            return draw_button(width, height, PALETTE["red"], "normal")
        if "tag_thunder" in name:
            return draw_button(width, height, PALETTE["purple"], "normal")
        if "tag_summon" in name:
            return draw_button(width, height, PALETTE["green"], "normal")
        return draw_panel(width, height, PALETTE["panel"], PALETTE["gold"], 28, 5, True)

    if spec.atlas == "ui_icons":
        return draw_simple_icon(name, width, height)

    if spec.atlas == "ui_portraits":
        return draw_portrait(name, width, height)

    if spec.atlas == "battle_fx_common":
        return draw_fx(name, width, height)

    return draw_panel(width, height)


def write_previews(specs: list[AssetSpec]) -> None:
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, list[AssetSpec]] = {}
    for spec in specs:
        grouped.setdefault(spec.atlas, []).append(spec)

    label_font = font(18)
    for atlas, atlas_specs in grouped.items():
        cell = 210
        cols = 4
        rows = math.ceil(len(atlas_specs) / cols)
        preview = Image.new("RGBA", (cols * cell, rows * cell), (18, 14, 12, 255))
        d = ImageDraw.Draw(preview, "RGBA")
        for index, spec in enumerate(atlas_specs):
            x = (index % cols) * cell
            y = (index // cols) * cell
            asset = Image.open(RUNTIME_ROOT / atlas / spec.filename).convert("RGBA")
            scale = min((cell - 40) / spec.width, (cell - 56) / spec.height, 1)
            size = (max(1, int(spec.width * scale)), max(1, int(spec.height * scale)))
            asset = asset.resize(size, Image.Resampling.LANCZOS)
            preview.alpha_composite(asset, (x + (cell - size[0]) // 2, y + 14))
            d.text((x + 8, y + cell - 32), spec.filename, fill=(255, 235, 190, 255), font=label_font)
        preview.convert("RGB").save(PREVIEW_ROOT / f"{atlas}_preview.png", optimize=True)


def write_prompts(specs: list[AssetSpec]) -> None:
    grouped: dict[str, list[AssetSpec]] = {}
    for spec in specs:
        grouped.setdefault(spec.atlas, []).append(spec)

    lines = [
        "# UI Art Generation Prompts",
        "",
        "这些提示词用于生成分图集美术参考，不用于生成整屏 UI。最终运行资源以 `assets/bundles/ui/**` 下逐张透明 PNG 为准。",
        "",
    ]
    for atlas, atlas_specs in grouped.items():
        lines.append(f"## {atlas}")
        names = ", ".join(spec.filename for spec in atlas_specs)
        lines.append(
            "Create a transparent-background mobile game UI sprite-sheet reference for the atlas "
            f"`{atlas}` only. Do not create a full game screen. Each item must be isolated, centered, "
            "front-facing, with no labels baked into the art unless it is an icon symbol. Style: red-gold "
            "commercial fantasy tower-defense roguelike, deep dark-brown panels, gold bevels, high contrast, "
            "large readable shapes. Output separated assets matching these filenames and proportions: "
            f"{names}."
        )
        lines.append("")
    (DOC_ROOT / "ui_art_generation_prompts.md").write_text("\n".join(lines), encoding="utf-8")


def write_ts_manifest(rows: list[dict]) -> None:
    def ts_value(row: dict) -> str:
        bundle_path = row["path"].replace("assets/bundles/ui/", "").replace(".png", "")
        nine_slice = row["nine_slice"]
        nine_slice_text = "null"
        if nine_slice:
            nine_slice_text = (
                "{ "
                f"left: {nine_slice['left']}, "
                f"top: {nine_slice['top']}, "
                f"right: {nine_slice['right']}, "
                f"bottom: {nine_slice['bottom']} "
                "}"
            )
        return (
            "  "
            + json.dumps(row["filename"])
            + ": { "
            + f"atlas: {json.dumps(row['atlas'])}, "
            + f"path: {json.dumps(bundle_path)}, "
            + f"uuid: {json.dumps(row.get('uuid'))}, "
            + f"textureUuid: {json.dumps(row.get('texture_uuid'))}, "
            + f"width: {row['width']}, height: {row['height']}, "
            + f"nineSlice: {nine_slice_text} "
            + "},"
        )

    content = [
        "// @ts-nocheck",
        "// Generated by tools/generate_ui_art_assets.py. Do not edit by hand.",
        "",
        "export interface UiArtNineSlice {",
        "  left: number;",
        "  top: number;",
        "  right: number;",
        "  bottom: number;",
        "}",
        "",
        "export interface UiArtAssetSpec {",
        "  atlas: string;",
        "  path: string;",
        "  uuid: string | null;",
        "  textureUuid: string | null;",
        "  width: number;",
        "  height: number;",
        "  nineSlice: UiArtNineSlice | null;",
        "}",
        "",
        "export const UiArtAssets: Record<string, UiArtAssetSpec> = {",
        *[ts_value(row) for row in rows],
        "};",
        "",
        "export function getUiArtAsset(filename: string): UiArtAssetSpec | undefined {",
        "  return UiArtAssets[filename];",
        "}",
        "",
    ]
    TS_MANIFEST.write_text("\n".join(content), encoding="utf-8")


def read_cocos_meta_ids(path: Path) -> tuple[str | None, str | None]:
    meta_path = Path(str(path) + ".meta")
    if not meta_path.exists():
        return None, None

    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None, None

    texture_uuid = None
    for sub_meta in meta.get("subMetas", {}).values():
        if sub_meta.get("importer") == "texture":
            texture_uuid = sub_meta.get("uuid")
            break

    return meta.get("uuid"), texture_uuid


def main(manifest_only: bool = False) -> None:
    specs = parse_checklist()
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    DOC_ROOT.mkdir(parents=True, exist_ok=True)

    if not manifest_only:
        for spec in specs:
            target_dir = RUNTIME_ROOT / spec.atlas
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / spec.filename
            if spec.filename.startswith(("fx_v2_", "fx_v3_", "fx_v4_")):
                if not target_path.exists():
                    raise FileNotFoundError(f"missing authored VFX texture: {target_path}")
                continue
            img = draw_asset(spec)
            if img.size != (spec.width, spec.height):
                img = img.resize((spec.width, spec.height), Image.Resampling.LANCZOS)
            img.save(target_path, optimize=True)

    manifest = []
    for spec in specs:
        runtime_path = RUNTIME_ROOT / spec.atlas / spec.filename
        uuid, texture_uuid = read_cocos_meta_ids(runtime_path)
        row = asdict(spec)
        row["path"] = str(runtime_path.relative_to(ROOT))
        row["uuid"] = uuid
        row["texture_uuid"] = texture_uuid
        row["transparent_png"] = True
        row["nine_slice_ready"] = spec.nine_slice is not None
        manifest.append(row)

    (DOC_ROOT / "ui_art_asset_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_ts_manifest(manifest)
    if not manifest_only:
        write_previews(specs)
    write_prompts(specs)

    print(
        json.dumps(
            {
                "generated_assets": len(specs),
                "runtime_root": str(RUNTIME_ROOT.relative_to(ROOT)),
                "manifest": str((DOC_ROOT / "ui_art_asset_manifest.json").relative_to(ROOT)),
                "ts_manifest": str(TS_MANIFEST.relative_to(ROOT)),
                "preview_root": str(PREVIEW_ROOT.relative_to(ROOT)),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate UI art assets and manifests.")
    parser.add_argument(
        "--manifest-only",
        action="store_true",
        help="Refresh manifests without redrawing runtime textures or atlas previews.",
    )
    args = parser.parse_args()
    main(manifest_only=args.manifest_only)
