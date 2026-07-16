# Reference Fortress, Five-Hero Layout, and Hit VFX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current wall with an exact cutout of the approved reference, widen the near-wall battlefield, enlarge and align five heroes, reduce the portrait rail to five slots, and replace enemy hit feedback with four generated legendary particle families.

**Architecture:** Preserve the existing modular terrain, UI layout, attack event, and pooled VFX boundaries. The wall is processed deterministically into the existing back/front asset contracts, layout values remain centralized in `BattleTerrainConfig.ts` and `BattleUiLayout.ts`, and V3 hit assets extend the current UUID-driven `BattleVfxSystem` with authored V2 texture fallback only.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node/tsx tests, Python Pillow for deterministic wall extraction, `gpt-image-2` built-in image generation, Cocos `Sprite` and `ParticleSystem2D`, in-app browser visual verification.

---

## Execution Preconditions

- Execute from `/Users/hudaijin/Code/game/ai-game`.
- The current working tree contains uncommitted V2/V3 battle VFX improvements that this plan builds on. Do not reset, checkout, or overwrite those changes.
- If an isolated worktree is used, create it from the current working-tree state, not only from `HEAD`.
- Use Cocos Creator 3.8.8 for asset import and preview.
- Use the supplied references exactly:
  - Wall: `/Users/hudaijin/Downloads/ChatGPT Image 2026年7月12日 18_06_30.png`
  - Hit VFX style: `/Users/hudaijin/Downloads/ChatGPT Image 2026年7月12日 18_07_30.png`
- Before every task commit, stage only the task's listed files. Preserve unrelated user changes.

## File Map

### New files

- `tools/extract_reference_fortress.py`: connected-background extraction, uniform scale, and complementary back/front wall masks.
- `assets/bundles/ui/battle_fx_common/fx_v3_hit_fire_eruption.png`: authored fire hit body.
- `assets/bundles/ui/battle_fx_common/fx_v3_hit_thunder_crater.png`: authored thunder hit body.
- `assets/bundles/ui/battle_fx_common/fx_v3_hit_poison_talisman.png`: authored poison/curse hit body.
- `assets/bundles/ui/battle_fx_common/fx_v3_hit_gold_starburst.png`: authored physical/gold hit body.
- Four matching Cocos `.png.meta` files created by Creator 3.8.8.
- Browser verification screenshots under `docs/superpowers/verification/`.

### Modified files

- `assets/bundles/battle_common/battle_wall_back.png`: exact reference top/rear wall pixels on the existing 720x480 canvas.
- `assets/bundles/battle_common/battle_wall_front.png`: complementary reference facade pixels on the existing 720x340 canvas.
- `assets/scripts/data/BattleTerrainConfig.ts`: ruins X coordinates and required complete wall layers.
- `assets/scripts/data/CompanionConfig.ts`: 30% larger thunder mage display scale.
- `assets/scripts/ui/BattleUiLayout.ts`: enlarged formation bounds, lowered health bar, moved placement labels, and five portrait slots.
- `assets/scripts/battle/BattleController.ts`: five avatar views and 1.3 main-hero root scale.
- `assets/scripts/battle/GridPlacementSystem.ts`: 1.3 ordinary-hero portrait scale around a fixed wall baseline.
- `assets/scripts/data/BattleVfxConfig.ts`: four V3 texture IDs, fallback mapping, impact profiles, and preset mapping.
- `assets/scripts/battle/BattleVfxSystem.ts`: V3-to-V2 frame resolution and element-specific particle parameters.
- `assets/scripts/ui/UiArtManifest.ts`: Cocos image/texture UUID entries for four V3 textures.
- `tools/generate_ui_art_assets.py`: preserve authored V3 textures and support manifest-only generation.
- `docs/05_ui_art_asset_checklist.md`, generated UI manifest/prompt docs, `README.md`, and verification notes.
- `tools/terrain-system.test.ts`, `tools/ui-layout-v4.test.ts`, `tools/battle-hud-polish.test.ts`, `tools/animation-system.test.ts`, and `tools/vfx-system.test.ts`.

## Task 1: Extract the Exact Reference Wall and Move the Ruins

**Files:**
- Create: `tools/extract_reference_fortress.py`
- Modify: `assets/bundles/battle_common/battle_wall_back.png`
- Modify: `assets/bundles/battle_common/battle_wall_front.png`
- Preserve: `assets/bundles/battle_common/battle_wall_back.png.meta`
- Preserve: `assets/bundles/battle_common/battle_wall_front.png.meta`
- Modify: `assets/scripts/data/BattleTerrainConfig.ts`
- Test: `tools/terrain-system.test.ts`

- [ ] **Step 1: Write failing terrain layout and complete-wall tests**

Update the first terrain test with exact positions and require both wall layers:

```ts
assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'ruinsLeft')?.x, -237.6);
assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'ruinsRight')?.x, 237.6);
assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'wallBack')?.required, true);
assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'wallFront')?.required, true);
```

Extend the PNG validation so both wall assets contain transparency, non-empty visible pixels, and bounded coverage without assuming transparent corners (the approved wall naturally reaches both horizontal edges):

```ts
for (const filename of ['battle_wall_back.png', 'battle_wall_front.png']) {
  const png = parsePng(join(TERRAIN_DIR, filename));
  const alphas = Array.from({ length: png.width * png.height }, (_, index) =>
    png.alphaAt(index % png.width, Math.floor(index / png.width)),
  );
  const visibleRatio = alphas.filter((alpha) => alpha > 16).length / alphas.length;
  assert.ok(visibleRatio > 0.08 && visibleRatio < 0.9, `${filename} visible coverage drifted`);
  assert.ok(alphas.some((alpha) => alpha < 16), `${filename} needs transparent padding`);
  assert.ok(alphas.some((alpha) => alpha > 240), `${filename} needs opaque wall pixels`);
}
```

Update the atomic load-state expectations so an incomplete two-layer wall never enters modular mode:

```ts
const baseAndBackReady = { ...pending, base: 'ready', wallBack: 'ready' };
assert.equal(resolveBattleTerrainMode(baseAndBackReady, BATTLE_TERRAIN_LAYERS), 'loading');
assert.equal(
  resolveBattleTerrainMode({ ...baseAndBackReady, wallFront: 'ready' }, BATTLE_TERRAIN_LAYERS),
  'modular',
);
assert.equal(
  resolveBattleTerrainMode({ ...baseAndBackReady, wallFront: 'failed' }, BATTLE_TERRAIN_LAYERS),
  'fallback',
);
```

- [ ] **Step 2: Run the terrain test and verify RED**

Run:

```bash
npm run test:terrain
```

Expected: FAIL because ruins remain at `-180/180`, `wallFront.required` is false, and the wall pixels are still the previous assets.

- [ ] **Step 3: Create the deterministic wall extraction tool**

Create `tools/extract_reference_fortress.py` with this complete contract:

```python
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
    r, g, b, a = pixel
    return a > 0 and min(r, g, b) >= 235 and max(r, g, b) - min(r, g, b) <= 14


def remove_connected_background(source: Image.Image) -> Image.Image:
    image = source.convert('RGBA')
    width, height = image.size
    pixels = image.load()
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not is_connected_white(pixels[x, y]):
            continue
        visited.add((x, y))
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        if x > 0: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y > 0: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    return image


def write_layers(source_path: Path, output_dir: Path) -> None:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args = parser.parse_args()
    write_layers(args.source, args.output_dir)


if __name__ == '__main__':
    main()
```

The split is complementary: back rows `0..139` align to world Y `-160..-299`; front row `0` starts at world Y `-300`. Do not duplicate source pixels between outputs.

- [ ] **Step 4: Generate the two wall assets without touching their metadata**

Record the two `.meta` hashes, run extraction, and verify they are unchanged:

```bash
shasum -a 256 assets/bundles/battle_common/battle_wall_back.png.meta assets/bundles/battle_common/battle_wall_front.png.meta
python tools/extract_reference_fortress.py \
  --source '/Users/hudaijin/Downloads/ChatGPT Image 2026年7月12日 18_06_30.png' \
  --output-dir assets/bundles/battle_common
shasum -a 256 assets/bundles/battle_common/battle_wall_back.png.meta assets/bundles/battle_common/battle_wall_front.png.meta
```

Expected: the pre/post metadata hashes are identical; PNG dimensions are 720x480 and 720x340 with Alpha.

- [ ] **Step 5: Apply the terrain configuration**

Change only these fields in `BattleTerrainConfig.ts`:

```ts
// ruinsLeft
x: -237.6,

// ruinsRight
x: 237.6,

// wallFront
required: true,
```

Do not alter ruin Y/size, wall canvas sizes, wall anchors, city line, or enemy paths in this task.

- [ ] **Step 6: Run terrain verification and inspect the wall layers**

Run:

```bash
npm run test:terrain
npm run typecheck
git diff --check
```

Expected: all commands exit 0. Inspect both PNGs with `view_image`; stacked geometry must reconstruct the supplied wall without a seam.

- [ ] **Step 7: Commit the terrain asset task**

```bash
git add tools/extract_reference_fortress.py assets/bundles/battle_common/battle_wall_back.png assets/bundles/battle_common/battle_wall_front.png assets/scripts/data/BattleTerrainConfig.ts tools/terrain-system.test.ts
git commit -m "feat: replace battle wall with reference fortress"
```

## Task 2: Enlarge and Align the Five On-Wall Heroes

**Files:**
- Modify: `assets/scripts/data/BattleTerrainConfig.ts`
- Modify: `assets/scripts/data/CompanionConfig.ts`
- Modify: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Test: `tools/terrain-system.test.ts`
- Test: `tools/battle-hud-polish.test.ts`
- Test: `tools/animation-system.test.ts`

- [ ] **Step 1: Write failing scale and baseline tests**

Add the shared visual scale to terrain expectations:

```ts
assert.equal(BATTLE_WALL_LAYOUT.unitVisualScale, 1.3);
assert.equal(THUNDER_MAGE_COMPANION.displayScale, 0.286);
```

Update the formation rectangles to represent the 30% visual bounds while preserving centers:

```ts
assert.deepEqual(
  formation.map(({ x, y }) => ({ x, y })),
  [-240, -120, 0, 120, 240].map((x) => ({ x, y: BATTLE_WALL_LAYOUT.unitY })),
);
assert.equal(BattleUiV4Layout.mainHeroUnit.height, 146);
assert.ok(formation.every((rect) => rect.height >= 106));
```

Add source-contract checks:

```ts
assert.match(battleControllerSource, /BATTLE_WALL_LAYOUT\.unitVisualScale \* scale/);
assert.match(gridPlacementSource, /BATTLE_WALL_LAYOUT\.unitVisualScale \* focusScale/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm run test:terrain
npm run test:hud-polish
npm run test:animation
```

Expected: FAIL because no shared 1.3 scale exists and current thunder/main/ordinary visuals use their previous sizes.

- [ ] **Step 3: Centralize the visual scale**

Add to `BATTLE_WALL_LAYOUT`:

```ts
unitVisualScale: 1.3,
```

Update `CompanionConfig.ts`:

```ts
displayScale: 0.286, // 0.22 * 1.3
```

Update formation bounds in `BattleUiLayout.ts` while retaining the approved centers:

```ts
wallSlotThunderMage: fromCenter(-240, -320, 106, 106),
wallSlotOrdinary1: fromCenter(-120, -320, 106, 106),
mainHeroUnit: fromCenter(0, -320, 125, 146),
wallSlotOrdinary2: fromCenter(120, -320, 106, 106),
wallSlotOrdinary3: fromCenter(240, -320, 106, 106),
```

- [ ] **Step 4: Scale main and ordinary heroes around fixed roots**

In `BattleController.drawPlayerVisual`, preserve the root position and apply the shared scale once:

```ts
const focusScale = highlightStrength > 0 ? 1 + highlightStrength * 0.065 : 1;
const scale = BATTLE_WALL_LAYOUT.unitVisualScale * focusScale;
this.playerNode.setScale(scale * pose.scaleX, scale * pose.scaleY, 1);
```

Do not change `MainHeroAttackSpine`'s local `0.28` scale; the parent now supplies the 1.3 multiplier.

Import `BATTLE_WALL_LAYOUT` from `../data/BattleTerrainConfig` in both `BattleController.ts` and `GridPlacementSystem.ts` before using the shared scale.

In `GridPlacementSystem.updateAnimations`, keep the unit root at its slot and scale only portrait content:

```ts
const focusScale = highlighted ? 1.04 : 1;
const visualScale = BATTLE_WALL_LAYOUT.unitVisualScale * focusScale;
view.portraitNode.setScale(visualScale * pose.scaleX, visualScale * pose.scaleY, 1);
```

- [ ] **Step 5: Run scale tests and inspect a static formation**

Run:

```bash
npm run test:terrain
npm run test:hud-polish
npm run test:animation
npm run typecheck
```

Expected: all exit 0. In Cocos preview, verify all five feet share one line and non-transparent bodies do not overlap. If a Spine frame's feet drift, adjust only that renderer's local Y offset; do not change the shared world Y.

- [ ] **Step 6: Commit the five-hero scale task**

```bash
git add assets/scripts/data/BattleTerrainConfig.ts assets/scripts/data/CompanionConfig.ts assets/scripts/ui/BattleUiLayout.ts assets/scripts/battle/BattleController.ts assets/scripts/battle/GridPlacementSystem.ts tools/terrain-system.test.ts tools/battle-hud-polish.test.ts tools/animation-system.test.ts
git commit -m "feat: enlarge the five-hero wall formation"
```

## Task 3: Move the Wall Health Bar and Reduce the Portrait Rail to Five

**Files:**
- Modify: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Test: `tools/ui-layout-v4.test.ts`
- Test: `tools/battle-hud-polish.test.ts`

- [ ] **Step 1: Write failing five-slot and health-bar tests**

Replace the six-slot expectations with:

```ts
const portraitSlotKeys = [
  'heroAvatarSlot1',
  'heroAvatarSlot2',
  'heroAvatarSlot3',
  'heroAvatarSlot4',
  'heroAvatarSlot5',
] as const;
assert.deepEqual(portraitSlotKeys.map((key) => requireRect(key).x), [-136, -68, 0, 68, 136]);
assert.equal('heroAvatarSlot6' in BattleUiV4Layout, false);
assert.deepEqual(BattleUiV4Layout.cityHealthBar, { x: 0, y: -468, width: 430, height: 48 });
assert.equal(BattleUiV4Layout.placementTitle.y, -424);
assert.equal(BattleUiV4Layout.placementPending.y, -424);
```

Assert the 12px health-bar/rail gap:

```ts
const healthBottom = BattleUiV4Layout.cityHealthBar.y - BattleUiV4Layout.cityHealthBar.height / 2;
const railTop = BattleUiV4Layout.heroBar.y + BattleUiV4Layout.heroBar.height / 2;
assert.equal(healthBottom - railTop, 12);
```

Add a source assertion that the controller creates five views and contains no `heroAvatarSlot6` reference.

- [ ] **Step 2: Run UI tests and verify RED**

Run:

```bash
npm run test:ui-layout
npm run test:hud-polish
```

Expected: FAIL on old health-bar Y, old placement-label Y, six portrait slots, and old X positions.

- [ ] **Step 3: Apply the approved HUD coordinates**

Update `BattleUiLayout.ts`:

```ts
cityHealthBar: fromCenter(0, -468, 430, 48),
placementTitle: fromCenter(-126, -424, 210, 24),
placementPending: fromCenter(126, -424, 210, 24),
heroAvatarSlot1: fromCenter(-136, -552, 56, 72),
heroAvatarSlot2: fromCenter(-68, -552, 56, 72),
heroAvatarSlot3: fromCenter(0, -552, 56, 72),
heroAvatarSlot4: fromCenter(68, -552, 56, 72),
heroAvatarSlot5: fromCenter(136, -552, 56, 72),
```

Delete `heroAvatarSlot6` entirely.

- [ ] **Step 4: Create only five runtime avatar views**

Change `BattleController.createBottomHudLayer` to:

```ts
const avatarSlotRects = [
  BattleUiV4Layout.heroAvatarSlot1,
  BattleUiV4Layout.heroAvatarSlot2,
  BattleUiV4Layout.heroAvatarSlot3,
  BattleUiV4Layout.heroAvatarSlot4,
  BattleUiV4Layout.heroAvatarSlot5,
];
```

Before creating views, destroy any legacy scene child named `HeroAvatarSlot6` so old serialized scene nodes cannot remain visible:

```ts
this.bottomHudLayer.getChildByName('HeroAvatarSlot6')?.destroy();
```

- [ ] **Step 5: Run HUD tests and inspect all responsive bounds**

Run:

```bash
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run typecheck
```

Expected: all exit 0; five portraits are centered and the health-bar lower edge remains 12px above the rail.

- [ ] **Step 6: Commit the HUD task**

```bash
git add assets/scripts/ui/BattleUiLayout.ts assets/scripts/battle/BattleController.ts tools/ui-layout-v4.test.ts tools/battle-hud-polish.test.ts
git commit -m "feat: align the five-slot hero hud"
```

## Task 4: Generate and Register Four V3 Hit Textures

**Files:**
- Create: four `fx_v3_hit_*.png` files and matching `.meta` files
- Modify: `docs/05_ui_art_asset_checklist.md`
- Modify: `tools/generate_ui_art_assets.py`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `docs/ui_art_generated/ui_art_asset_manifest.json`
- Modify: `docs/ui_art_generated/ui_art_generation_prompts.md`
- Test: `tools/vfx-system.test.ts`

- [ ] **Step 1: Write failing V3 asset contract tests**

Add these rows to the authored texture test:

```ts
expected.set('fx_v3_hit_fire_eruption.png', [512, 512]);
expected.set('fx_v3_hit_thunder_crater.png', [512, 512]);
expected.set('fx_v3_hit_poison_talisman.png', [512, 512]);
expected.set('fx_v3_hit_gold_starburst.png', [512, 512]);
```

Extend the generator source test:

```ts
assert.match(generatorSource, /filename\.startswith\(\("fx_v2_", "fx_v3_"\)\)/);
assert.match(generatorSource, /--manifest-only/);
```

- [ ] **Step 2: Run the VFX test and verify RED**

Run:

```bash
npm run test:vfx
```

Expected: FAIL because the four files and manifest entries do not exist.

- [ ] **Step 3: Generate four isolated assets with built-in `gpt-image-2`**

Call the built-in image generation tool once per asset. Use the supplied hit reference as a style reference, not an edit target. Shared prompt prefix:

```text
Use case: stylized-concept
Asset type: production 2D Cocos Creator hit VFX sprite
Primary request: Create one isolated legendary fantasy enemy-hit explosion matching the supplied reference's sharp white-hot core, layered energy, radial shards, realistic high-end mobile game rendering, and readable silhouette.
Composition: centered single impact, generous padding, no cropping.
Constraints: no character, enemy, weapon, UI, text, border, watermark, pixel art, cartoon rendering, or multiple effects.
```

Append exactly one element block per call:

```text
Fire: red-orange ground eruption, upward flame plume, black-red rock shards, incandescent radial spikes. Perfectly flat #00ff00 background; no green in subject.
Thunder: vertical blue-white lightning bolt into a violet-blue crater burst, crystal fragments and branching arcs. Perfectly flat #00ff00 background; no green in subject.
Poison: neon green toxic burst, dark green shards, flying engraved talismans, short smoky plume. Perfectly flat #ff00ff background; no magenta in subject.
Gold: white-gold starburst, long sharp radial rays, circular shock ring and dark gold stone fragments. Perfectly flat #00ff00 background; no green in subject.
```

Move each returned image path to these exact intermediate paths:

```text
tmp/imagegen/fx_v3_hit_fire_eruption_source.png
tmp/imagegen/fx_v3_hit_thunder_crater_source.png
tmp/imagegen/fx_v3_hit_poison_talisman_source.png
tmp/imagegen/fx_v3_hit_gold_starburst_source.png
```

- [ ] **Step 4: Remove chroma keys and validate transparency**

Run once per source, changing only filenames:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input tmp/imagegen/fx_v3_hit_fire_eruption_source.png \
  --out assets/bundles/ui/battle_fx_common/fx_v3_hit_fire_eruption.png \
  --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Use the same command for thunder, poison, and gold. If any fringe remains, rerun only that image with `--edge-contract 1`. Resize final outputs to 512x512 with Pillow/LANCZOS only if imagegen returned another size. Inspect all four with `view_image` against a checkerboard.

- [ ] **Step 5: Add checklist rows and protect authored V3 files**

Add four 512x512 `battle_fx_common` rows to `docs/05_ui_art_asset_checklist.md`.

Change the authored-file guard in `generate_ui_art_assets.py`:

```python
if spec.filename.startswith(("fx_v2_", "fx_v3_")):
    if not target_path.exists():
        raise FileNotFoundError(f"missing authored VFX texture: {target_path}")
    continue
```

Add an argparse `--manifest-only` flag. Change `main` to accept the flag, skip the asset drawing loop and atlas preview writer when true, but still parse the checklist and write the JSON manifest, TS manifest, and prompt document:

```python
import argparse


def main(manifest_only: bool = False) -> None:
    specs = parse_checklist()
    RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)
    DOC_ROOT.mkdir(parents=True, exist_ok=True)

    if not manifest_only:
        for spec in specs:
            target_dir = RUNTIME_ROOT / spec.atlas
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / spec.filename
            if spec.filename.startswith(("fx_v2_", "fx_v3_")):
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
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest-only', action='store_true')
    args = parser.parse_args()
    main(manifest_only=args.manifest_only)
```

- [ ] **Step 6: Let Cocos import the assets and regenerate manifests only**

Open/reload the project in Creator 3.8.8. Wait until all four `.png.meta` files contain a top-level image UUID and texture subMeta UUID. Then run:

```bash
python tools/generate_ui_art_assets.py --manifest-only
```

Expected: four V3 entries appear in `UiArtManifest.ts` and JSON manifest with non-null `uuid` and `textureUuid`; no unrelated runtime PNG changes.

- [ ] **Step 7: Verify and commit authored V3 assets**

Run:

```bash
npm run test:vfx
npm run typecheck
git diff --check
```

Expected: all exit 0 and the four authored texture tests pass.

```bash
git add assets/bundles/ui/battle_fx_common/fx_v3_hit_*.png assets/bundles/ui/battle_fx_common/fx_v3_hit_*.png.meta assets/scripts/ui/UiArtManifest.ts docs/05_ui_art_asset_checklist.md docs/ui_art_generated/ui_art_asset_manifest.json docs/ui_art_generated/ui_art_generation_prompts.md tools/generate_ui_art_assets.py tools/vfx-system.test.ts
git commit -m "feat: add four legendary hit vfx textures"
```

## Task 5: Map V3 Hits and Preserve Authored V2 Fallback

**Files:**
- Modify: `assets/scripts/data/BattleVfxConfig.ts`
- Modify: `assets/scripts/battle/BattleVfxSystem.ts`
- Test: `tools/vfx-system.test.ts`

- [ ] **Step 1: Write failing mapping and fallback tests**

Import `BATTLE_VFX_TEXTURE_FALLBACKS` from `BattleVfxConfig.ts`, then add exact mapping assertions:

```ts
assert.equal(BATTLE_VFX_PRESETS.main_fire_gold.impactTexture, 'fireImpactV3');
assert.equal(BATTLE_VFX_PRESETS.fire_blast.impactTexture, 'fireImpactV3');
assert.equal(BATTLE_VFX_PRESETS.thunder.impactTexture, 'thunderImpactV3');
assert.equal(BATTLE_VFX_PRESETS.ice_shard.impactTexture, 'thunderImpactV3');
assert.equal(BATTLE_VFX_PRESETS.poison_wisp.impactTexture, 'poisonImpactV3');
assert.equal(BATTLE_VFX_PRESETS.curse_wisp.impactTexture, 'poisonImpactV3');
assert.equal(BATTLE_VFX_PRESETS.gold_arrow.impactTexture, 'goldImpactV3');
assert.equal(BATTLE_VFX_PRESETS.shield_impact.impactTexture, 'goldImpactV3');
assert.equal(BATTLE_VFX_PRESETS.warm_support.impactTexture, 'goldImpactV3');
assert.equal(BATTLE_VFX_PRESETS.healing_spirit.impactTexture, 'healOrb');
assert.equal(BATTLE_VFX_TEXTURE_FALLBACKS.fireImpactV3, 'hitStar');
assert.equal(BATTLE_VFX_TEXTURE_FALLBACKS.thunderImpactV3, 'thunderImpact');
assert.equal(BATTLE_VFX_TEXTURE_FALLBACKS.poisonImpactV3, 'poisonWisp');
assert.equal(BATTLE_VFX_TEXTURE_FALLBACKS.goldImpactV3, 'hitStar');
```

Add source assertions:

```ts
assert.match(vfxSource, /resolveFrame\(textureId/);
assert.equal(vfxSource.includes('addComponent(Graphics)'), false);
```

- [ ] **Step 2: Run `test:vfx` and verify RED**

Run:

```bash
npm run test:vfx
```

Expected: FAIL because V3 IDs, profiles, and fallback map are absent.

- [ ] **Step 3: Extend texture IDs, profiles, and fallback data**

Add to `BattleVfxTextureId`:

```ts
| 'fireImpactV3'
| 'thunderImpactV3'
| 'poisonImpactV3'
| 'goldImpactV3'
```

Add profile typing and preset field:

```ts
export type BattleVfxImpactProfile = 'fire' | 'thunder' | 'poison' | 'gold' | 'heal';
// in BattleVfxPreset
readonly impactProfile: BattleVfxImpactProfile;
```

Register texture filenames and fallback map:

```ts
fireImpactV3: 'fx_v3_hit_fire_eruption.png',
thunderImpactV3: 'fx_v3_hit_thunder_crater.png',
poisonImpactV3: 'fx_v3_hit_poison_talisman.png',
goldImpactV3: 'fx_v3_hit_gold_starburst.png',

export const BATTLE_VFX_TEXTURE_FALLBACKS: Partial<Record<BattleVfxTextureId, BattleVfxTextureId>> = {
  fireImpactV3: 'hitStar',
  thunderImpactV3: 'thunderImpact',
  poisonImpactV3: 'poisonWisp',
  goldImpactV3: 'hitStar',
};
```

Give `preset()` an `impactProfile` option defaulting to `gold`, then apply the exact mappings from Step 1. Keep all approved projectile `travelSeconds` unchanged.

- [ ] **Step 4: Resolve authored fallback frames without Graphics**

Import `BATTLE_VFX_TEXTURE_FALLBACKS` in `BattleVfxSystem.ts` and add:

```ts
private resolveFrame(textureId: BattleVfxTextureId): SpriteFrame | undefined {
  const fallbackTextureId = BATTLE_VFX_TEXTURE_FALLBACKS[textureId];
  return this.frames.get(textureId) ??
    (fallbackTextureId ? this.frames.get(fallbackTextureId) : undefined);
}
```

Use `resolveFrame()` for impact textures and source flashes. Projectile textures continue to require their direct frame. If both V3 and V2 are missing, return `false` without creating any procedural fallback node.

- [ ] **Step 5: Apply element-specific particle motion**

Define immutable particle profiles near the top of `BattleVfxSystem.ts`:

```ts
const IMPACT_PARTICLE_PROFILES = {
  fire: { speed: 128, speedVar: 74, gravityY: -62, angle: 90, angleVar: 150 },
  thunder: { speed: 156, speedVar: 86, gravityY: -18, angle: 90, angleVar: 180 },
  poison: { speed: 96, speedVar: 52, gravityY: 18, angle: 90, angleVar: 175 },
  gold: { speed: 142, speedVar: 68, gravityY: -48, angle: 90, angleVar: 180 },
  heal: { speed: 72, speedVar: 34, gravityY: 28, angle: 90, angleVar: 110 },
} as const;
```

In `playParticleBurst`, replace fixed speed/gravity/angle values with the selected profile while retaining particle budgets, additive blending, and the corrected full lifetime:

```ts
const profile = IMPACT_PARTICLE_PROFILES[preset.impactProfile];
particle.speed = critical ? profile.speed * 1.18 : profile.speed;
particle.speedVar = profile.speedVar;
particle.gravity = new Vec2(0, profile.gravityY);
particle.angle = profile.angle;
particle.angleVar = profile.angleVar;
```

- [ ] **Step 6: Run VFX and type verification**

Run:

```bash
npm run test:vfx
npm run test:animation
npm run typecheck
git diff --check
```

Expected: all exit 0; no `Graphics` hit fallback exists; projectile timing tests retain the approved slower durations.

- [ ] **Step 7: Commit V3 runtime mapping**

```bash
git add assets/scripts/data/BattleVfxConfig.ts assets/scripts/battle/BattleVfxSystem.ts tools/vfx-system.test.ts
git commit -m "feat: map combat hits to four elemental vfx"
```

## Task 6: Full Runtime and Visual Acceptance

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/verification/2026-07-12-commercial-terrain-vfx.md`
- Create: `docs/superpowers/verification/2026-07-12-reference-fortress-five-hero.png`
- Create: `docs/superpowers/verification/2026-07-12-four-element-hit-vfx.png`

- [ ] **Step 1: Run the complete automated matrix**

Run each command independently and require exit code 0:

```bash
npm run test:mvp
npm run test:spine-import
npm run test:thunder-mage-import
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:vfx
npm run typecheck
git diff --check
```

Expected: every suite prints only `pass:` lines and all commands exit 0.

- [ ] **Step 2: Verify the static battle layout in the in-app browser**

Reload `http://localhost:7456/` after Creator finishes recompiling. At 720x1280 design resolution verify:

- both near-wall ruins moved outward equally;
- wall fills the width and reconstructs the reference without seam or stretch;
- all five heroes are visibly 30% larger and share one foot line;
- front wall covers only shoes/lower legs;
- city health bar sits directly above the five-slot rail with a visible gap;
- no sixth portrait node or empty space is present.

Save a full clear frame to `docs/superpowers/verification/2026-07-12-reference-fortress-five-hero.png`.

- [ ] **Step 3: Verify all four hit families**

Exercise main fire, thunder mage, poison/curse, and physical/gold heroes. Capture frames showing at least one V3 body plus its particle shards. Confirm:

- fire is red-orange with rock fragments;
- thunder has a vertical blue-violet strike and crystalline burst;
- poison has green toxic energy and talisman fragments;
- physical/gold uses a white-gold starburst and shock ring;
- healing does not play an enemy hit explosion;
- there are no solid rectangles, `Graphics` rays, or full-screen flashes.

Save a representative composite or clear multi-effect frame to `docs/superpowers/verification/2026-07-12-four-element-hit-vfx.png`.

- [ ] **Step 4: Run a 30-second stress check**

Keep combat active for at least 30 seconds with multiple enemies and attacks. Verify the FPS display remains at the 60 target and read browser logs after the final successful load. Required final resource log:

```text
[BattleVfx] loaded 15/15; failed=none
```

No new warning/error may occur after that timestamp. Historical logs from earlier reloads are not counted.

- [ ] **Step 5: Update documentation**

Update README and verification notes with:

- exact reference-wall extraction and preserved UUIDs;
- ruins `±237.6` positions;
- five heroes at 1.3 visual scale;
- health bar `(0,-468)` and five portrait centers;
- four V3 hit filenames, `gpt-image-2`, profile mapping, and V2 fallback;
- the complete automated command matrix and two screenshots.

- [ ] **Step 6: Request code review and address findings**

Ask a read-only reviewer to inspect the task diff for wall-layer atomicity, Cocos UUID drift, five-slot cleanup, baseline-preserving scale, V3 fallback, particle lifetime, and missing tests. Fix all Critical/Important findings, then rerun Task 6 Step 1.

- [ ] **Step 7: Commit final verification**

```bash
git add README.md docs/superpowers/verification/2026-07-12-commercial-terrain-vfx.md docs/superpowers/verification/2026-07-12-reference-fortress-five-hero.png docs/superpowers/verification/2026-07-12-four-element-hit-vfx.png
git commit -m "docs: verify reference fortress and elemental hits"
```

## Completion Gate

The work is complete only when all of the following are true:

- exact reference wall pixels are visible in-game at the approved perspective and uniform scale;
- both wall layers are required and atomically fall back to the old full battle background;
- ruins are exactly at `-237.6/237.6`;
- five heroes are 30% larger, aligned, and unobstructed above the front parapet;
- city health bar and exactly five portrait slots match the approved coordinates;
- all four V3 hit families load by UUID and map to the approved roles;
- V3 failure uses authored V2 SpriteFrame fallback only;
- the complete test matrix, typecheck, diff check, 30-second 60 FPS stress run, and final log inspection pass.
