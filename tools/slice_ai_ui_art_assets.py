from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "ui_art_generated" / "ui_art_asset_manifest.json"
SOURCE_ROOT = ROOT / "docs" / "ui_art_generated" / "ai_source_sheets"
RUNTIME_ROOT = ROOT / "assets" / "bundles" / "ui"
PREVIEW_ROOT = ROOT / "docs" / "ui_art_generated" / "atlas_previews"
REPORT = SOURCE_ROOT / "ai_slice_report.json"


@dataclass(frozen=True)
class GridSpec:
    source: str
    cols: int
    rows: int
    force_equal_bounds: bool = False


GRID_SPECS: dict[str, GridSpec] = {
    "ui_common": GridSpec("ui_common_ai_sheet.png", 4, 4),
    "ui_hud": GridSpec("ui_hud_ai_sheet.png", 6, 5),
    "ui_cards": GridSpec("ui_cards_ai_sheet.png", 4, 4),
    "ui_icons": GridSpec("ui_icons_ai_sheet.png", 4, 4),
    "ui_portraits": GridSpec("ui_portraits_ai_sheet.png", 4, 4),
    "battle_fx_common": GridSpec("battle_fx_common_ai_sheet.png", 4, 3, True),
}


def cluster_lines(candidates: list[int]) -> list[int]:
    if not candidates:
        return []

    clusters: list[list[int]] = [[candidates[0]]]
    for value in candidates[1:]:
        if value - clusters[-1][-1] <= 3:
            clusters[-1].append(value)
        else:
            clusters.append([value])

    return [round(sum(cluster) / len(cluster)) for cluster in clusters]


def equal_grid_bounds(width: int, height: int, cols: int, rows: int) -> tuple[list[int], list[int]]:
    return (
        [round(width * index / cols) for index in range(cols + 1)],
        [round(height * index / rows) for index in range(rows + 1)],
    )


def detect_grid_bounds(
    img: Image.Image,
    cols: int,
    rows: int,
    force_equal_bounds = False,
) -> tuple[list[int], list[int]]:
    rgb = img.convert("RGB")
    width, height = rgb.size
    if force_equal_bounds:
        return equal_grid_bounds(width, height, cols, rows)

    pixels = rgb.load()

    vertical: list[int] = []
    for x in range(width):
        white_count = 0
        for y in range(height):
            r, g, b = pixels[x, y]
            if r > 238 and g > 238 and b > 238:
                white_count += 1
        if white_count >= height * 0.28:
            vertical.append(x)

    horizontal: list[int] = []
    for y in range(height):
        white_count = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            if r > 238 and g > 238 and b > 238:
                white_count += 1
        if white_count >= width * 0.28:
            horizontal.append(y)

    x_lines = [line for line in cluster_lines(vertical) if 8 < line < width - 8]
    y_lines = [line for line in cluster_lines(horizontal) if 8 < line < height - 8]

    if len(x_lines) != cols - 1:
        x_bounds = equal_grid_bounds(width, height, cols, rows)[0]
    else:
        x_bounds = [0, *x_lines, width]

    if len(y_lines) != rows - 1:
        y_bounds = equal_grid_bounds(width, height, cols, rows)[1]
    else:
        y_bounds = [0, *y_lines, height]

    return x_bounds, y_bounds


def key_magenta_to_alpha(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            is_magenta = r > 170 and b > 145 and g < 120 and r - g > 75 and b - g > 55
            is_white_grid_edge = (
                (x < 6 or y < 6 or x >= width - 6 or y >= height - 6)
                and r > 238
                and g > 238
                and b > 238
            )
            if is_magenta or is_white_grid_edge:
                pixels[x, y] = (r, g, b, 0)

    return rgba


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = img.getchannel("A")
    return alpha.getbbox()


def fit_subject_to_target(src: Image.Image, target_width: int, target_height: int, is_frame: bool) -> Image.Image:
    transparent = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
    bbox = alpha_bbox(src)
    if not bbox:
        return transparent

    subject = src.crop(bbox)
    margin_ratio = 0.02 if is_frame else 0.08
    max_width = max(1, round(target_width * (1 - margin_ratio)))
    max_height = max(1, round(target_height * (1 - margin_ratio)))
    scale = min(max_width / subject.width, max_height / subject.height)
    out_size = (max(1, round(subject.width * scale)), max(1, round(subject.height * scale)))
    subject = subject.resize(out_size, Image.Resampling.LANCZOS)
    x = (target_width - out_size[0]) // 2
    y = (target_height - out_size[1]) // 2
    transparent.alpha_composite(subject, (x, y))
    return transparent


def crop_cell(sheet: Image.Image, x_bounds: list[int], y_bounds: list[int], index: int, cols: int) -> Image.Image:
    col = index % cols
    row = index // cols
    inset = 8
    x0 = min(x_bounds[col] + inset, x_bounds[col + 1])
    y0 = min(y_bounds[row] + inset, y_bounds[row + 1])
    x1 = max(x0, x_bounds[col + 1] - inset)
    y1 = max(y0, y_bounds[row + 1] - inset)
    return sheet.crop((x0, y0, x1, y1))


def is_frame_like(filename: str, nine_slice: dict[str, int] | None) -> bool:
    if nine_slice:
        return True

    keywords = ("frame", "panel", "button", "bg", "bar", "plate", "card", "slot", "chip", "badge")
    return any(keyword in filename for keyword in keywords)


def make_preview(atlas: str, specs: list[dict[str, object]]) -> None:
    thumbs: list[tuple[str, Image.Image]] = []
    for spec in specs:
        path = ROOT / str(spec["path"])
        img = Image.open(path).convert("RGBA")
        thumb = Image.new("RGBA", (150, 124), (24, 18, 14, 255))
        ratio = min(126 / img.width, 84 / img.height)
        size = (max(1, round(img.width * ratio)), max(1, round(img.height * ratio)))
        resized = img.resize(size, Image.Resampling.LANCZOS)
        thumb.alpha_composite(resized, ((150 - size[0]) // 2, 8 + (84 - size[1]) // 2))
        thumbs.append((str(spec["filename"]), thumb))

    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    preview = Image.new("RGBA", (cols * 150, rows * 124), (16, 12, 10, 255))
    draw = ImageDraw.Draw(preview)
    font = ImageFont.load_default()

    for index, (filename, thumb) in enumerate(thumbs):
        x = (index % cols) * 150
        y = (index // cols) * 124
        preview.alpha_composite(thumb, (x, y))
        draw.text((x + 6, y + 98), filename[:24], fill=(255, 234, 174, 255), font=font)

    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    preview.save(PREVIEW_ROOT / f"{atlas}_preview.png")


def main() -> None:
    manifest: list[dict[str, object]] = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_atlas: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in manifest:
        by_atlas[str(row["atlas"])].append(row)

    report: dict[str, object] = {"source": "ai_source_sheets", "atlases": {}}

    for atlas, specs in by_atlas.items():
        grid = GRID_SPECS[atlas]
        source_path = SOURCE_ROOT / grid.source
        sheet = Image.open(source_path).convert("RGBA")
        x_bounds, y_bounds = detect_grid_bounds(sheet, grid.cols, grid.rows, grid.force_equal_bounds)

        atlas_report: dict[str, object] = {
            "source": str(source_path.relative_to(ROOT)),
            "source_size": list(sheet.size),
            "grid": {"cols": grid.cols, "rows": grid.rows, "x_bounds": x_bounds, "y_bounds": y_bounds},
            "assets": [],
        }

        for index, spec in enumerate(specs):
            target_width = int(spec["width"])
            target_height = int(spec["height"])
            raw = crop_cell(sheet, x_bounds, y_bounds, index, grid.cols)
            keyed = key_magenta_to_alpha(raw)
            output = fit_subject_to_target(
                keyed,
                target_width,
                target_height,
                is_frame_like(str(spec["filename"]), spec.get("nine_slice")),
            )

            output_path = ROOT / str(spec["path"])
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output.save(output_path)
            atlas_report["assets"].append(
                {
                    "filename": spec["filename"],
                    "size": [target_width, target_height],
                    "source_cell": index,
                    "alpha_bbox": alpha_bbox(output),
                }
            )

        make_preview(atlas, specs)
        report["atlases"][atlas] = atlas_report

    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"AI sliced {len(manifest)} assets from {len(by_atlas)} atlases.")
    print(f"Report: {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
