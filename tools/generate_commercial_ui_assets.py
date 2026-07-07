from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
UI_ROOT = ROOT / "assets" / "bundles" / "ui"
MANIFEST_TS = ROOT / "assets" / "scripts" / "ui" / "UiArtManifest.ts"


Color = tuple[int, int, int, int]


@dataclass(frozen=True)
class CommercialAsset:
  atlas: str
  filename: str
  width: int
  height: int
  nine_slice: dict[str, int] | None
  image: Image.Image


GOLD: Color = (255, 210, 105, 255)
GOLD_SOFT: Color = (255, 232, 162, 190)
DARK: Color = (18, 11, 7, 238)
BROWN: Color = (72, 39, 20, 242)
RED: Color = (126, 32, 18, 245)
BLUE: Color = (27, 76, 155, 245)
GREEN: Color = (38, 111, 52, 245)


def canvas(width: int, height: int) -> Image.Image:
  return Image.new("RGBA", (width, height), (0, 0, 0, 0))


def vertical_gradient(width: int, height: int, top: Color, bottom: Color) -> Image.Image:
  img = canvas(width, height)
  pixels = img.load()
  for y in range(height):
    t = y / max(1, height - 1)
    color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
    for x in range(width):
      pixels[x, y] = color
  return img


def alpha_mask(width: int, height: int, radius: int, pad = 0) -> Image.Image:
  mask = Image.new("L", (width, height), 0)
  ImageDraw.Draw(mask).rounded_rectangle(
    (pad, pad, width - pad - 1, height - pad - 1),
    radius=radius,
    fill=255,
  )
  return mask


def glow_shape(width: int, height: int, radius: int, color: Color, pad: int, blur: int) -> Image.Image:
  glow = canvas(width, height)
  draw = ImageDraw.Draw(glow, "RGBA")
  draw.rounded_rectangle(
    (pad, pad, width - pad - 1, height - pad - 1),
    radius=radius,
    outline=color,
    width=max(8, pad),
  )
  return glow.filter(ImageFilter.GaussianBlur(blur))


def draw_panel(width: int, height: int, fill: Color, radius: int, border = 5, glow = True) -> Image.Image:
  img = canvas(width, height)
  pad = border + 5
  if glow:
    img.alpha_composite(glow_shape(width, height, radius, GOLD, pad, max(8, min(width, height) // 18)))

  grad = vertical_gradient(width, height, tuple(min(255, int(c * 1.25)) if i < 3 else c for i, c in enumerate(fill)), DARK)
  mask = alpha_mask(width, height, radius, pad)
  img.alpha_composite(Image.composite(grad, canvas(width, height), mask))

  d = ImageDraw.Draw(img, "RGBA")
  box = (pad, pad, width - pad - 1, height - pad - 1)
  d.rounded_rectangle(box, radius=radius, outline=(74, 43, 20, 255), width=border + 3)
  d.rounded_rectangle(box, radius=radius, outline=GOLD, width=border)
  inner = (pad + border + 3, pad + border + 3, width - pad - border - 4, height - pad - border - 4)
  d.rounded_rectangle(inner, radius=max(2, radius - border - 3), outline=(255, 243, 180, 95), width=max(1, border // 2))
  d.line((pad + radius, pad + border, width - pad - radius, pad + border), fill=GOLD_SOFT, width=max(1, border // 2))
  return img


def draw_card(width: int, height: int, fill: Color, accent: Color) -> Image.Image:
  img = draw_panel(width, height, fill, radius=18, border=4, glow=True)
  d = ImageDraw.Draw(img, "RGBA")
  d.rounded_rectangle((24, 18, width - 24, 52), radius=12, fill=(30, 12, 8, 170), outline=accent, width=2)
  d.rounded_rectangle((34, 72, width - 34, 188), radius=14, fill=(0, 0, 0, 94), outline=(255, 232, 170, 80), width=2)
  d.ellipse((width // 2 - 48, 90, width // 2 + 48, 186), fill=tuple((*accent[:3], 62)))
  d.rounded_rectangle((38, height - 58, width - 38, height - 28), radius=15, fill=(28, 15, 8, 192), outline=accent, width=2)
  d.polygon([(18, 24), (42, 12), (66, 24), (42, 36)], fill=(255, 229, 140, 190))
  d.polygon([(width - 18, 24), (width - 42, 12), (width - 66, 24), (width - 42, 36)], fill=(255, 229, 140, 190))
  return img


def draw_frame(width: int, height: int) -> Image.Image:
  img = canvas(width, height)
  d = ImageDraw.Draw(img, "RGBA")
  img.alpha_composite(glow_shape(width, height, 24, GOLD, 10, 12))
  d.rounded_rectangle((12, 12, width - 13, height - 13), radius=24, outline=(92, 48, 20, 255), width=12)
  d.rounded_rectangle((16, 16, width - 17, height - 17), radius=22, outline=GOLD, width=5)
  d.rounded_rectangle((28, 28, width - 29, height - 29), radius=16, outline=(255, 244, 185, 120), width=2)
  return img


def radial_glow(width: int, height: int, color: Color, power = 2.0) -> Image.Image:
  img = canvas(width, height)
  cx, cy = width / 2, height / 2
  max_dist = (cx * cx + cy * cy) ** 0.5
  pixels = img.load()
  for y in range(height):
    for x in range(width):
      dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_dist
      alpha = max(0.0, 1.0 - dist) ** power
      pixels[x, y] = (color[0], color[1], color[2], round(color[3] * alpha))
  return img.filter(ImageFilter.GaussianBlur(max(2, min(width, height) // 48)))


def draw_ultimate(width: int, height: int) -> Image.Image:
  img = radial_glow(width, height, (255, 118, 20, 230), 1.35)
  d = ImageDraw.Draw(img, "RGBA")
  pad = 18
  d.ellipse((pad, pad, width - pad, height - pad), fill=(97, 23, 8, 245), outline=(255, 220, 112, 255), width=6)
  d.ellipse((pad + 11, pad + 11, width - pad - 11, height - pad - 11), fill=(218, 69, 14, 236), outline=(255, 246, 178, 150), width=3)
  d.arc((pad + 23, pad + 23, width - pad - 23, height - pad - 23), 210, 520, fill=(255, 246, 178, 220), width=8)
  return img


def draw_round_button(width: int, height: int, fill: Color) -> Image.Image:
  img = radial_glow(width, height, GOLD, 2.2)
  d = ImageDraw.Draw(img, "RGBA")
  pad = 12
  d.ellipse((pad, pad, width - pad, height - pad), fill=fill, outline=(82, 47, 20, 255), width=7)
  d.ellipse((pad + 5, pad + 5, width - pad - 5, height - pad - 5), outline=GOLD, width=4)
  d.ellipse((pad + 18, pad + 12, pad + 38, pad + 32), fill=(255, 248, 204, 90))
  return img


def write_meta(path: Path) -> tuple[str, str]:
  meta_path = path.with_suffix(path.suffix + ".meta")
  if meta_path.exists():
    data = json.loads(meta_path.read_text(encoding="utf-8"))
    image_uuid = data["uuid"]
    texture_uuid = data["subMetas"]["6c48a"]["uuid"]
    return image_uuid, texture_uuid

  image_uuid = str(uuid.uuid4())
  texture_uuid = f"{image_uuid}@6c48a"
  data = {
    "ver": "1.0.27",
    "importer": "image",
    "imported": True,
    "uuid": image_uuid,
    "files": [".json", ".png"],
    "subMetas": {
      "6c48a": {
        "importer": "texture",
        "uuid": texture_uuid,
        "displayName": path.stem,
        "id": "6c48a",
        "name": "texture",
        "userData": {
          "wrapModeS": "repeat",
          "wrapModeT": "repeat",
          "minfilter": "linear",
          "magfilter": "linear",
          "mipfilter": "none",
          "anisotropy": 0,
          "isUuid": True,
          "imageUuidOrDatabaseUri": image_uuid,
          "visible": False,
        },
        "ver": "1.0.22",
        "imported": True,
        "files": [".json"],
        "subMetas": {},
      }
    },
    "userData": {
      "type": "texture",
      "fixAlphaTransparencyArtifacts": False,
      "hasAlpha": True,
      "redirect": texture_uuid,
    },
  }
  meta_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
  return image_uuid, texture_uuid


def asset_line(asset: CommercialAsset, image_uuid: str, texture_uuid: str) -> str:
  path = f"{asset.atlas}/{asset.filename[:-4]}"
  if asset.nine_slice:
    ns = asset.nine_slice
    nine = f"{{ left: {ns['left']}, top: {ns['top']}, right: {ns['right']}, bottom: {ns['bottom']} }}"
  else:
    nine = "null"
  return (
    f'  "{asset.filename}": {{ atlas: "{asset.atlas}", path: "{path}", uuid: "{image_uuid}", '
    f'textureUuid: "{texture_uuid}", width: {asset.width}, height: {asset.height}, nineSlice: {nine} }},'
  )


def update_manifest(lines: list[str]) -> None:
  text = MANIFEST_TS.read_text(encoding="utf-8")
  for line in lines:
    filename = line.split('"')[1]
    text = re.sub(rf'\n  "{re.escape(filename)}": \{{[^\n]+\}},', "", text)
  insert = "\n" + "\n".join(lines)
  text = text.replace("\n};", f"{insert}\n}};")
  MANIFEST_TS.write_text(text, encoding="utf-8")


def main() -> None:
  assets = [
    CommercialAsset("ui_cards", "card_bg_fire_final.png", 220, 300, {"left": 28, "top": 32, "right": 28, "bottom": 32}, draw_card(220, 300, RED, (255, 112, 36, 255))),
    CommercialAsset("ui_cards", "card_bg_thunder_final.png", 220, 300, {"left": 28, "top": 32, "right": 28, "bottom": 32}, draw_card(220, 300, BLUE, (94, 174, 255, 255))),
    CommercialAsset("ui_cards", "card_bg_summon_final.png", 220, 300, {"left": 28, "top": 32, "right": 28, "bottom": 32}, draw_card(220, 300, GREEN, (118, 226, 93, 255))),
    CommercialAsset("ui_cards", "card_frame_legendary_final.png", 240, 320, {"left": 32, "top": 36, "right": 32, "bottom": 36}, draw_frame(240, 320)),
    CommercialAsset("ui_cards", "card_selected_glow_final.png", 280, 360, None, radial_glow(280, 360, (255, 162, 32, 230), 1.55)),
    CommercialAsset("ui_cards", "card_panel_bg_final.png", 680, 360, {"left": 40, "top": 36, "right": 40, "bottom": 36}, draw_panel(680, 360, BROWN, 22, 6, True)),
    CommercialAsset("ui_cards", "card_panel_title_final.png", 420, 72, {"left": 28, "top": 18, "right": 28, "bottom": 18}, draw_panel(420, 72, (84, 45, 19, 244), 18, 5, True)),
    CommercialAsset("ui_hud", "hud_right_action_button_final.png", 128, 128, None, draw_round_button(128, 128, (65, 35, 17, 245))),
    CommercialAsset("ui_hud", "hud_ultimate_button_final.png", 192, 192, None, draw_ultimate(192, 192)),
    CommercialAsset("ui_hud", "hud_bottom_hero_bar_final.png", 680, 116, {"left": 36, "top": 28, "right": 36, "bottom": 28}, draw_panel(680, 116, (42, 24, 14, 232), 18, 5, True)),
    CommercialAsset("ui_hud", "hud_tower_button_final.png", 128, 128, None, draw_round_button(128, 128, (78, 48, 18, 245))),
    CommercialAsset("ui_hud", "hud_oil_button_final.png", 128, 128, None, draw_round_button(128, 128, (107, 38, 14, 245))),
  ]

  manifest_lines: list[str] = []
  for asset in assets:
    output = UI_ROOT / asset.atlas / asset.filename
    output.parent.mkdir(parents=True, exist_ok=True)
    asset.image.save(output)
    image_uuid, texture_uuid = write_meta(output)
    manifest_lines.append(asset_line(asset, image_uuid, texture_uuid))

  update_manifest(manifest_lines)
  print("generated commercial ui assets")


if __name__ == "__main__":
  main()
