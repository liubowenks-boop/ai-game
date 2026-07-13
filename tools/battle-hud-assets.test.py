from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "bundles" / "ui" / "ui_hud_custom"
MANIFEST = ROOT / "assets" / "scripts" / "ui" / "UiArtManifest.ts"

EXPECTED = {
  "hud_wave_panel.png",
  "hud_remaining_enemies.png",
  "hud_gold_panel.png",
  "hud_boss_title.png",
  "hud_boss_health_frame.png",
  "hud_city_durability_frame.png",
  "hud_pause_button.png",
  "hud_resume_button.png",
  "hud_auto_button_custom.png",
  "hud_bond_button_custom.png",
  "hud_statistics_button.png",
  "hud_ultimate_badge_custom.png",
}


assert OUTPUT.is_dir(), f"missing generated asset directory: {OUTPUT}"
manifest_text = MANIFEST.read_text(encoding="utf-8")

for filename in sorted(EXPECTED):
  image_path = OUTPUT / filename
  assert image_path.exists(), f"missing generated image: {filename}"
  with Image.open(image_path) as image:
    assert image.mode == "RGBA", f"{filename} must be RGBA"
    assert max(image.size) <= 1024, f"{filename} is larger than the runtime limit"
    alpha = image.getchannel("A")
    assert alpha.getbbox() is not None, f"{filename} has no visible content"
    corners = (
      alpha.getpixel((0, 0)),
      alpha.getpixel((image.width - 1, 0)),
      alpha.getpixel((0, image.height - 1)),
      alpha.getpixel((image.width - 1, image.height - 1)),
    )
    assert corners == (0, 0, 0, 0), f"{filename} still has an opaque white canvas"
    assert alpha.getextrema() == (0, 255), f"{filename} should contain transparent and opaque pixels"

  meta_path = image_path.with_suffix(".png.meta")
  meta = json.loads(meta_path.read_text(encoding="utf-8"))
  assert meta["importer"] == "image"
  assert meta["userData"]["hasAlpha"] is True
  assert meta["subMetas"]["6c48a"]["importer"] == "texture"
  expected_manifest_path = f'path: "ui_hud_custom/{image_path.stem}"'
  assert f'"{filename}"' in manifest_text, f"{filename} missing from UI manifest"
  assert expected_manifest_path in manifest_text, f"wrong manifest path for {filename}"

preview = ROOT / "docs" / "ui_art_generated" / "atlas_previews" / "ui_hud_custom_preview.png"
assert preview.exists(), "missing custom HUD contact sheet"

print("pass: custom battle HUD assets")
