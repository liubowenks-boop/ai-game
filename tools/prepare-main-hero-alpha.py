from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


LEAK_SEEDS: dict[str, tuple[tuple[int, int], ...]] = {
    "frame_0": ((167, 242), (281, 237), (302, 269), (333, 252)),
    "frame_2": ((212, 236), (252, 220)),
    "frame_5": ((147, 246), (257, 243), (110, 275)),
    "frame_7": ((141, 221), (243, 222), (259, 254), (299, 236)),
}

PRESERVED_HIGHLIGHTS: dict[str, tuple[tuple[int, int], ...]] = {
    "frame_0": ((365, 88),),
    "frame_2": ((318, 92),),
    "frame_5": ((58, 219), (238, 45)),
}

NEUTRAL_MINIMUM = 180
NEUTRAL_SPREAD = 45


def parse_atlas_regions(atlas_path: Path) -> dict[str, tuple[int, int, int, int]]:
    lines = atlas_path.read_text(encoding="utf-8").splitlines()
    regions: dict[str, tuple[int, int, int, int]] = {}

    for index, raw_name in enumerate(lines):
        name = raw_name.strip()
        next_line = lines[index + 1].strip() if index + 1 < len(lines) else ""
        if not name or not next_line.startswith("rotate:"):
            continue

        xy_line = lines[index + 2].strip()
        size_line = lines[index + 3].strip()
        if not xy_line.startswith("xy:") or not size_line.startswith("size:"):
            raise ValueError(f"invalid atlas region {name}")

        x, y = (int(value.strip()) for value in xy_line.removeprefix("xy:").split(","))
        width, height = (
            int(value.strip()) for value in size_line.removeprefix("size:").split(",")
        )
        regions[name] = (x, y, width, height)

    return regions


def is_leaked_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 0
        and min(red, green, blue) >= NEUTRAL_MINIMUM
        and max(red, green, blue) - min(red, green, blue) <= NEUTRAL_SPREAD
    )


def clear_seeded_region(
    image: Image.Image,
    region: tuple[int, int, int, int],
    local_seed: tuple[int, int],
) -> int:
    region_x, region_y, region_width, region_height = region
    seed_x, seed_y = local_seed
    if not (0 <= seed_x < region_width and 0 <= seed_y < region_height):
        raise ValueError(f"seed {local_seed} is outside atlas region")

    pixels = image.load()
    queue: deque[tuple[int, int]] = deque([(region_x + seed_x, region_y + seed_y)])
    visited: set[tuple[int, int]] = set()
    cleared = 0

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        if not (
            region_x <= x < region_x + region_width
            and region_y <= y < region_y + region_height
        ):
            continue

        pixel = pixels[x, y]
        if not is_leaked_background(pixel):
            continue

        red, green, blue, _ = pixel
        pixels[x, y] = (red, green, blue, 0)
        cleared += 1
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    return cleared


def prepare_alpha(source_path: Path, atlas_path: Path, output_path: Path) -> int:
    image = Image.open(source_path).convert("RGBA")
    regions = parse_atlas_regions(atlas_path)
    total_cleared = 0

    for region_name, seeds in LEAK_SEEDS.items():
        region = regions.get(region_name)
        if region is None:
            raise ValueError(f"missing atlas region {region_name}")
        for seed in seeds:
            total_cleared += clear_seeded_region(image, region, seed)

    pixels = image.load()
    for region_name, samples in PRESERVED_HIGHLIGHTS.items():
        region = regions.get(region_name)
        if region is None:
            raise ValueError(f"missing atlas region {region_name}")
        region_x, region_y, _, _ = region
        for local_x, local_y in samples:
            if pixels[region_x + local_x, region_y + local_y][3] == 0:
                raise ValueError(
                    f"protected fire highlight became transparent: "
                    f"{region_name} {local_x},{local_y}"
                )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True, compress_level=9)
    return total_cleared


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--atlas", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    cleared = prepare_alpha(args.source, args.atlas, args.output)
    print(f"prepared {args.output}: cleared {cleared} leaked background pixels")


if __name__ == "__main__":
    main()
