from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE_ROOT = Path("/Users/hudaijin/Downloads/icon")
DOWNLOADS_ROOT = Path("/Users/hudaijin/Downloads")
OUTPUT_ROOT = ROOT / "assets" / "bundles" / "ui" / "ui_hud_custom"
MANIFEST = ROOT / "assets" / "scripts" / "ui" / "UiArtManifest.ts"
PREVIEW = ROOT / "docs" / "ui_art_generated" / "atlas_previews" / "ui_hud_custom_preview.png"


@dataclass(frozen=True)
class HudAsset:
  source_path: Path
  filename: str
  maximum_edge: int


def icon_source(filename: str) -> Path:
  return ICON_SOURCE_ROOT / filename


def download_source(filename: str) -> Path:
  return DOWNLOADS_ROOT / filename


ASSETS = (
  HudAsset(icon_source("怪物波数显示.png"), "hud_wave_panel.png", 1024),
  HudAsset(icon_source("剩余敌人显示图标.png"), "hud_remaining_enemies.png", 768),
  HudAsset(icon_source("金币显示面板.png"), "hud_gold_panel.png", 1024),
  HudAsset(icon_source("首领显示图标.png"), "hud_boss_title.png", 768),
  HudAsset(
    download_source("ChatGPT Image 2026年7月14日 11_58_47.png"),
    "hud_boss_health_frame.png",
    1024,
  ),
  HudAsset(
    download_source("ChatGPT Image 2026年7月14日 11_45_20.png"),
    "hud_city_durability_frame.png",
    1024,
  ),
  # The source filenames and the depicted symbols are reversed. Runtime names
  # follow the depicted action: pause uses ||, resume uses the play triangle.
  HudAsset(icon_source("继续按钮标志.png"), "hud_pause_button.png", 768),
  HudAsset(icon_source("暂停按钮图标.png"), "hud_resume_button.png", 768),
  HudAsset(icon_source("自动图标设计.png"), "hud_auto_button_custom.png", 768),
  HudAsset(icon_source("羁绊徽章.png"), "hud_bond_button_custom.png", 768),
  HudAsset(icon_source("统计图标设计.png"), "hud_statistics_button.png", 768),
  HudAsset(icon_source("绝技徽章设计.png"), "hud_ultimate_badge_custom.png", 768),
)


def remove_connected_white_canvas(source: Image.Image) -> Image.Image:
  """Remove only near-white pixels connected to the source image border."""
  rgb = source.convert("RGB")
  marker = (1, 2, 3)
  corners = (
    (0, 0),
    (rgb.width - 1, 0),
    (0, rgb.height - 1),
    (rgb.width - 1, rgb.height - 1),
  )
  for corner in corners:
    color = rgb.getpixel(corner)
    if color == marker or min(color) < 210:
      continue
    ImageDraw.floodfill(rgb, corner, marker, thresh=38)

  hard_alpha = Image.new("L", rgb.size, 255)
  alpha_pixels = hard_alpha.load()
  rgb_pixels = rgb.load()
  for y in range(rgb.height):
    for x in range(rgb.width):
      if rgb_pixels[x, y] == marker:
        alpha_pixels[x, y] = 0

  # A very small feather removes the jagged white fringe without softening the art.
  feathered_alpha = hard_alpha.filter(ImageFilter.GaussianBlur(0.7))
  rgba = source.convert("RGBA")
  rgba.putalpha(feathered_alpha)

  visible_mask = feathered_alpha.point(lambda value: 255 if value > 2 else 0)
  bbox = visible_mask.getbbox()
  if bbox is None:
    raise ValueError("white-background removal produced an empty image")
  cropped = rgba.crop(bbox)
  padded = Image.new("RGBA", (cropped.width + 24, cropped.height + 24), (0, 0, 0, 0))
  padded.alpha_composite(cropped, (12, 12))
  return padded


def resize_for_runtime(image: Image.Image, maximum_edge: int) -> Image.Image:
  scale = min(1.0, maximum_edge / max(image.size))
  if scale >= 1:
    return image
  size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
  return image.resize(size, Image.Resampling.LANCZOS)


def write_directory_meta(path: Path) -> None:
  meta_path = path.with_suffix(".meta")
  if meta_path.exists():
    return
  data = {
    "ver": "1.2.0",
    "importer": "directory",
    "imported": True,
    "uuid": str(uuid.uuid4()),
    "files": [],
    "subMetas": {},
    "userData": {},
  }
  meta_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def write_image_meta(path: Path) -> tuple[str, str]:
  meta_path = path.with_suffix(path.suffix + ".meta")
  if meta_path.exists():
    data = json.loads(meta_path.read_text(encoding="utf-8"))
    return data["uuid"], data["subMetas"]["6c48a"]["uuid"]

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
          "wrapModeS": "clamp-to-edge",
          "wrapModeT": "clamp-to-edge",
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
      "fixAlphaTransparencyArtifacts": True,
      "hasAlpha": True,
      "redirect": texture_uuid,
    },
  }
  meta_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
  return image_uuid, texture_uuid


def update_manifest(rows: list[tuple[HudAsset, Image.Image, str, str]]) -> None:
  text = MANIFEST.read_text(encoding="utf-8")
  lines: list[str] = []
  for asset, image, image_uuid, texture_uuid in rows:
    text = re.sub(rf'\n  "{re.escape(asset.filename)}": \{{[^\n]+\}},', "", text)
    lines.append(
      f'  "{asset.filename}": {{ atlas: "ui_hud_custom", '
      f'path: "ui_hud_custom/{Path(asset.filename).stem}", uuid: "{image_uuid}", '
      f'textureUuid: "{texture_uuid}", width: {image.width}, height: {image.height}, '
      'nineSlice: null },'
    )
  insertion = "\n" + "\n".join(lines)
  text = text.replace("\n};", f"{insertion}\n}};", 1)
  MANIFEST.write_text(text, encoding="utf-8")


def create_preview(rows: list[tuple[HudAsset, Image.Image, str, str]]) -> None:
  tile_width = 240
  tile_height = 176
  columns = 3
  rows_count = (len(rows) + columns - 1) // columns
  preview = Image.new("RGBA", (tile_width * columns, tile_height * rows_count), (20, 16, 22, 255))
  draw = ImageDraw.Draw(preview)
  font = ImageFont.load_default()
  for index, (asset, image, _, _) in enumerate(rows):
    tile_x = (index % columns) * tile_width
    tile_y = (index // columns) * tile_height
    checker = Image.new("RGBA", (tile_width - 12, 134), (46, 42, 48, 255))
    checker_draw = ImageDraw.Draw(checker)
    for y in range(0, checker.height, 16):
      for x in range(0, checker.width, 16):
        if (x // 16 + y // 16) % 2:
          checker_draw.rectangle((x, y, x + 15, y + 15), fill=(61, 57, 64, 255))
    preview.alpha_composite(checker, (tile_x + 6, tile_y + 6))
    scale = min((tile_width - 28) / image.width, 112 / image.height)
    fitted = image.resize(
      (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
      Image.Resampling.LANCZOS,
    )
    preview.alpha_composite(
      fitted,
      (tile_x + (tile_width - fitted.width) // 2, tile_y + 12 + (112 - fitted.height) // 2),
    )
    draw.text((tile_x + 8, tile_y + 146), asset.filename, fill=(255, 232, 178, 255), font=font)

  PREVIEW.parent.mkdir(parents=True, exist_ok=True)
  preview.save(PREVIEW, optimize=True)


def main() -> None:
  missing = [str(asset.source_path) for asset in ASSETS if not asset.source_path.exists()]
  if missing:
    raise FileNotFoundError(f"missing HUD source images: {', '.join(missing)}")

  OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
  write_directory_meta(OUTPUT_ROOT)
  generated: list[tuple[HudAsset, Image.Image, str, str]] = []
  for asset in ASSETS:
    with Image.open(asset.source_path) as source:
      image = resize_for_runtime(remove_connected_white_canvas(source), asset.maximum_edge)
    output = OUTPUT_ROOT / asset.filename
    image.save(output, optimize=True)
    image_uuid, texture_uuid = write_image_meta(output)
    generated.append((asset, image, image_uuid, texture_uuid))

  update_manifest(generated)
  create_preview(generated)
  print(f"generated {len(generated)} custom battle HUD assets")


if __name__ == "__main__":
  main()
