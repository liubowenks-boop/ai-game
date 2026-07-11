#!/usr/bin/env python3

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "assets" / "bundles" / "battle_common"


def generate_road_overlay() -> None:
    width, height = 720, 1280
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    worn = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(worn)
    randomizer = random.Random(7201280)

    lane_centers = (225, 360, 495)
    for lane_center in lane_centers:
        for offset in (-32, 32):
            points = []
            for y in range(-40, height + 80, 48):
                drift = math.sin(y / 115 + lane_center) * 3
                drift += randomizer.uniform(-2.5, 2.5)
                points.append((lane_center + offset + drift, y))
            draw.line(points, fill=(80, 48, 26, 24), width=9, joint="curve")
            draw.line(points, fill=(226, 175, 101, 13), width=2, joint="curve")

    for _ in range(220):
        lane_center = randomizer.choice(lane_centers)
        x = lane_center + randomizer.uniform(-52, 52)
        y = randomizer.uniform(50, height - 80)
        length = randomizer.uniform(4, 18)
        alpha = randomizer.randint(8, 20)
        draw.line(
            (x - length / 2, y, x + length / 2, y + randomizer.uniform(-3, 3)),
            fill=(72, 45, 28, alpha),
            width=randomizer.choice((1, 1, 2)),
        )

    worn = worn.filter(ImageFilter.GaussianBlur(1.4))
    image.alpha_composite(worn)
    image.save(ASSET_DIR / "battle_road_overlay.png")


def generate_atmosphere_overlay() -> None:
    width, height = 720, 900
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    dust = Image.new("RGBA", image.size, (0, 0, 0, 0))
    dust_draw = ImageDraw.Draw(dust)
    randomizer = random.Random(7200900)

    for side in (0, 1):
        edge_x = 28 if side == 0 else width - 28
        for _ in range(18):
            x = edge_x + randomizer.uniform(-75, 90) * (1 if side == 0 else -1)
            y = randomizer.uniform(30, height - 50)
            radius_x = randomizer.uniform(35, 105)
            radius_y = randomizer.uniform(12, 42)
            alpha = randomizer.randint(5, 15)
            dust_draw.ellipse(
                (x - radius_x, y - radius_y, x + radius_x, y + radius_y),
                fill=(112, 82, 57, alpha),
            )

    dust = dust.filter(ImageFilter.GaussianBlur(28))
    image.alpha_composite(dust)
    ember_draw = ImageDraw.Draw(image)
    for _ in range(54):
        side = randomizer.choice((0, 1))
        x = randomizer.uniform(8, 155) if side == 0 else randomizer.uniform(width - 155, width - 8)
        y = randomizer.uniform(40, height - 40)
        radius = randomizer.choice((1, 1, 1, 2))
        ember_draw.ellipse(
            (x - radius, y - radius, x + radius, y + radius),
            fill=(255, randomizer.randint(126, 184), 60, randomizer.randint(45, 105)),
        )

    image.save(ASSET_DIR / "battle_atmosphere.png")


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    generate_road_overlay()
    generate_atmosphere_overlay()
    print("generated battle_road_overlay.png and battle_atmosphere.png")


if __name__ == "__main__":
    main()
