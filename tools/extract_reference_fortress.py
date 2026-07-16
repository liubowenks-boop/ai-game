from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


TARGET_WIDTH = 720
BACK_SIZE = (720, 480)
FRONT_SIZE = (720, 340)
SPLIT_Y = 140


def is_connected_white(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 0
        and min(red, green, blue) >= 220
        and max(red, green, blue) - min(red, green, blue) <= 18
    )


def remove_connected_background(source: Image.Image) -> Image.Image:
    image = source.convert('RGBA')
    width, height = image.size
    pixels = image.load()
    queue: deque[tuple[int, int]] = deque()
    background: set[tuple[int, int]] = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in background or not is_connected_white(pixels[x, y]):
            continue
        background.add((x, y))
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    for x, y in background:
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)

    original = source.convert('RGBA')
    original_pixels = original.load()
    for y in range(height):
        for x in range(width):
            if (x, y) in background:
                continue
            neighbors = ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            if not any(neighbor in background for neighbor in neighbors):
                continue
            red, green, blue, alpha = original_pixels[x, y]
            minimum = min(red, green, blue)
            chroma = max(red, green, blue) - minimum
            if minimum < 180 or chroma > 24:
                continue
            edge_alpha = max(0, min(255, round((255 - minimum) * 255 / 75)))
            pixels[x, y] = (red, green, blue, min(alpha, edge_alpha))

    return image


def write_layers(source_path: Path, output_dir: Path) -> tuple[int, int]:
    extracted = remove_connected_background(Image.open(source_path))
    alpha_box = extracted.getchannel('A').getbbox()
    if alpha_box is None:
        raise ValueError('reference wall has no visible subject')

    subject = extracted.crop(alpha_box)
    target_height = round(subject.height * TARGET_WIDTH / subject.width)
    if target_height <= SPLIT_Y or target_height - SPLIT_Y > FRONT_SIZE[1]:
        raise ValueError(f'wall height {target_height} does not fit the approved canvases')
    subject = subject.resize((TARGET_WIDTH, target_height), Image.Resampling.LANCZOS)

    back = Image.new('RGBA', BACK_SIZE, (0, 0, 0, 0))
    front = Image.new('RGBA', FRONT_SIZE, (0, 0, 0, 0))
    back.alpha_composite(subject.crop((0, 0, TARGET_WIDTH, SPLIT_Y)), (0, 0))
    front.alpha_composite(subject.crop((0, SPLIT_Y, TARGET_WIDTH, target_height)), (0, 0))

    output_dir.mkdir(parents=True, exist_ok=True)
    back.save(output_dir / 'battle_wall_back.png', optimize=True)
    front.save(output_dir / 'battle_wall_front.png', optimize=True)
    return subject.size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    width, height = write_layers(args.source, args.output_dir)
    print(f'Extracted reference fortress at {width}x{height}, split at y={SPLIT_Y}.')


if __name__ == '__main__':
    main()
