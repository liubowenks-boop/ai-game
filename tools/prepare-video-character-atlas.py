#!/usr/bin/env python3
"""Convert the comparison MP4 into a compact alpha sprite-sheet for Cocos."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frame-width", type=int, default=240)
    parser.add_argument("--frame-height", type=int, default=320)
    parser.add_argument("--columns", type=int, default=10)
    parser.add_argument("--padding", type=int, default=4)
    return parser.parse_args()


def remove_connected_white_background(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    # Kling adds a small watermark in the lower-right corner. It is outside the
    # character silhouette, so erase it before computing the matte.
    frame[int(height * 0.945) : height, int(width * 0.78) : width] = 255

    bgr_min = frame.min(axis=2)
    bgr_max = frame.max(axis=2)
    # The generated spell briefly washes the nominally white backdrop in pale
    # blue. Treat that connected low-saturation bloom as background too, while
    # retaining saturated lightning and enclosed white robe panels.
    white_candidate = ((bgr_min >= 182) & ((bgr_max - bgr_min) <= 92)).astype(np.uint8)

    flood_source = white_candidate.copy()
    flood_source = cv2.copyMakeBorder(flood_source, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=1)
    flood_mask = np.zeros((height + 4, width + 4), dtype=np.uint8)
    cv2.floodFill(flood_source, flood_mask, (0, 0), 2)
    connected_background = flood_source[1:-1, 1:-1] == 2

    foreground = (~connected_background).astype(np.uint8)
    foreground = cv2.morphologyEx(foreground, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha = np.clip(cv2.distanceTransform(foreground, cv2.DIST_L2, 3) * 110, 0, 255).astype(
        np.uint8
    )

    rgba = cv2.cvtColor(frame, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha
    return rgba


def main() -> None:
    args = parse_args()
    capture = cv2.VideoCapture(str(args.input))
    if not capture.isOpened():
        raise SystemExit(f"Unable to open {args.input}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 24.0
    frames: list[Image.Image] = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        rgba = remove_connected_white_background(frame)
        image = Image.fromarray(rgba)
        image.thumbnail((args.frame_width, args.frame_height), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (args.frame_width, args.frame_height))
        cell.alpha_composite(
            image,
            ((args.frame_width - image.width) // 2, (args.frame_height - image.height) // 2),
        )
        frames.append(cell)
    capture.release()

    if not frames:
        raise SystemExit("The input video contained no frames")

    rows = math.ceil(len(frames) / args.columns)
    cell_width = args.frame_width + args.padding * 2
    cell_height = args.frame_height + args.padding * 2
    atlas = Image.new("RGBA", (args.columns * cell_width, rows * cell_height))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(
            frame,
            (
                (index % args.columns) * cell_width + args.padding,
                (index // args.columns) * cell_height + args.padding,
            ),
        )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(args.output, optimize=True)
    metadata = {
        "frameCount": len(frames),
        "fps": fps,
        "frameWidth": args.frame_width,
        "frameHeight": args.frame_height,
        "padding": args.padding,
        "cellWidth": cell_width,
        "cellHeight": cell_height,
        "columns": args.columns,
        "duration": len(frames) / fps,
    }
    args.output.with_suffix(".json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata))


if __name__ == "__main__":
    main()
