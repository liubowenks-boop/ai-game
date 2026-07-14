# Gem Health Bars and Widget Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the city and Boss frames with the supplied artwork, render rectangular gem-style health fills, and reorganize the top HUD with aligned remaining-enemy and right-side control groups.

**Architecture:** Keep the stable HUD asset filenames and UUIDs, but point the deterministic importer at the two new Downloads sources. Keep all editable geometry, colors, thresholds, and right-control spacing in `BattleHudConfig.ts`; let `BattleHudView.ts` build a Widget-anchored vertical Layout and draw layered rectangular fills from those configuration values.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `Graphics`/`Widget`/`Layout`, Node `assert` tests through `tsx`, Python 3 and Pillow for deterministic PNG preprocessing.

---

## File map

- Modify `tools/prepare-battle-hud-assets.py`: resolve per-asset source paths so only the city and Boss entries use the new Downloads images.
- Modify `tools/battle-hud-assets.test.py`: prove the new source mapping exists and the processed frame geometry/alpha is valid.
- Replace `assets/bundles/ui/ui_hud_custom/hud_boss_health_frame.png`: processed Boss artwork, preserving its existing `.meta` UUID.
- Replace `assets/bundles/ui/ui_hud_custom/hud_city_durability_frame.png`: processed city artwork, preserving its existing `.meta` UUID.
- Modify `assets/scripts/ui/UiArtManifest.ts`: update the two processed image dimensions while preserving UUID references.
- Modify `docs/ui_art_generated/atlas_previews/ui_hud_custom_preview.png`: regenerate the HUD contact sheet.
- Modify `assets/scripts/ui/BattleHudConfig.ts`: own new rectangles, right-stack parameters, track geometry, palettes, and pure palette/layout helpers.
- Modify `tools/battle-hud-logic.test.ts`: test the approved positions, alignment relationships, palette selection, and retained 50%-size rules.
- Modify `assets/scripts/ui/BattleHudView.ts`: build the Widget/Layout control stack and draw layered rectangular gem fills.
- Modify `tools/battle-hud-view.test.ts`: structurally verify Cocos Layout/Widget usage and prevent a return to round progress bars.
- Create `docs/superpowers/verification/2026-07-14-gem-health-bars-widget-layout.png`: final Cocos portrait verification screenshot.

The existing uncommitted changes in `BattleHudConfig.ts`, `BattleHudView.ts`, and `battle-hud-logic.test.ts` are the approved earlier 50% HUD scaling work. They must remain in place and be committed with Tasks 2 and 3; do not reset or overwrite them.

### Task 1: Import the two supplied frame images deterministically

**Files:**
- Modify: `tools/battle-hud-assets.test.py`
- Modify: `tools/prepare-battle-hud-assets.py`
- Modify: `assets/bundles/ui/ui_hud_custom/hud_boss_health_frame.png`
- Modify: `assets/bundles/ui/ui_hud_custom/hud_city_durability_frame.png`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `docs/ui_art_generated/atlas_previews/ui_hud_custom_preview.png`

- [ ] **Step 1: Write the failing source-mapping and aspect-ratio assertions**

Add these constants near the top of `tools/battle-hud-assets.test.py`:

```python
PREPARE = ROOT / "tools" / "prepare-battle-hud-assets.py"
NEW_SOURCE_NAMES = {
  "hud_city_durability_frame.png": "ChatGPT Image 2026年7月14日 11_45_20.png",
  "hud_boss_health_frame.png": "ChatGPT Image 2026年7月14日 11_58_47.png",
}
MINIMUM_ASPECT_RATIOS = {
  "hud_city_durability_frame.png": 7.5,
  "hud_boss_health_frame.png": 5.0,
}
```

Before the existing asset loop, add:

```python
prepare_text = PREPARE.read_text(encoding="utf-8")
for filename, source_name in NEW_SOURCE_NAMES.items():
  assert source_name in prepare_text, f"{filename} is not mapped to the supplied source"
```

Inside the existing `with Image.open(image_path) as image:` block, after the alpha assertions, add:

```python
    minimum_aspect = MINIMUM_ASPECT_RATIOS.get(filename)
    if minimum_aspect is not None:
      assert image.width / image.height >= minimum_aspect, (
        f"{filename} was not cropped to the supplied horizontal frame"
      )
```

- [ ] **Step 2: Run the asset test and verify it fails on the missing source mapping**

Run:

```bash
npm run test:hud-assets
```

Expected: FAIL with `hud_city_durability_frame.png is not mapped to the supplied source` before any project asset is regenerated.

- [ ] **Step 3: Give every HUD asset an explicit source path**

In `tools/prepare-battle-hud-assets.py`, replace the source-root declarations and `HudAsset` source field with:

```python
ICON_SOURCE_ROOT = Path("/Users/hudaijin/Downloads/icon")
DOWNLOADS_ROOT = Path("/Users/hudaijin/Downloads")


@dataclass(frozen=True)
class HudAsset:
  source_path: Path
  filename: str
  maximum_edge: int


def icon_source(filename: str) -> Path:
  return ICON_SOURCE_ROOT / filename


def download_source(filename: str) -> Path:
  return DOWNLOADS_ROOT / filename
```

Define `ASSETS` with the same ten retained icon mappings and these two replacements:

```python
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
  HudAsset(icon_source("继续按钮标志.png"), "hud_pause_button.png", 768),
  HudAsset(icon_source("暂停按钮图标.png"), "hud_resume_button.png", 768),
  HudAsset(icon_source("自动图标设计.png"), "hud_auto_button_custom.png", 768),
  HudAsset(icon_source("羁绊徽章.png"), "hud_bond_button_custom.png", 768),
  HudAsset(icon_source("统计图标设计.png"), "hud_statistics_button.png", 768),
  HudAsset(icon_source("绝技徽章设计.png"), "hud_ultimate_badge_custom.png", 768),
)
```

Update the two places that resolve source files:

```python
missing = [str(asset.source_path) for asset in ASSETS if not asset.source_path.exists()]
```

```python
with Image.open(asset.source_path) as source:
  image = resize_for_runtime(remove_connected_white_canvas(source), asset.maximum_edge)
```

Do not change `write_image_meta`; its existing early return is what preserves the current image and texture UUIDs.

- [ ] **Step 4: Regenerate the project-owned HUD resources**

Run:

```bash
npm run prepare:hud-assets
```

Expected: `generated 12 custom battle HUD assets`.

- [ ] **Step 5: Verify asset processing and stable metadata**

Run:

```bash
npm run test:hud-assets
git diff --check
git diff -- assets/bundles/ui/ui_hud_custom/hud_boss_health_frame.png.meta assets/bundles/ui/ui_hud_custom/hud_city_durability_frame.png.meta
```

Expected: the asset test prints `pass: custom battle HUD assets`; `git diff --check` is silent; the two `.meta` files have no diff.

Open both processed PNG files with image inspection. Expected: transparent corners, no large white canvas, intact Chinese city label and Boss crystal emblem, and no clipped glow or metal tips.

- [ ] **Step 6: Commit the asset replacement**

Run:

```bash
git add tools/prepare-battle-hud-assets.py tools/battle-hud-assets.test.py \
  assets/bundles/ui/ui_hud_custom/hud_boss_health_frame.png \
  assets/bundles/ui/ui_hud_custom/hud_city_durability_frame.png \
  assets/scripts/ui/UiArtManifest.ts \
  docs/ui_art_generated/atlas_previews/ui_hud_custom_preview.png
git commit -m "feat: replace battle health bar frames"
```

Expected: one commit containing the two replacement PNGs, deterministic source mapping, manifest dimensions, preview, and passing resource assertions; no `.meta` file is committed.

### Task 2: Centralize approved layout and gem palette configuration

**Files:**
- Modify: `tools/battle-hud-logic.test.ts`
- Modify: `assets/scripts/ui/BattleHudConfig.ts`

- [ ] **Step 1: Replace the old absolute-control assertions with the approved configuration tests**

Change the config import in `tools/battle-hud-logic.test.ts` to:

```ts
import {
  BattleHudConfig,
  getCityGemPaletteName,
  getRightControlRects,
  hudRectsOverlap,
} from '../assets/scripts/ui/BattleHudConfig';
```

Keep the existing wave/display-state tests. Replace the current `halfSizedHud`, old layout deep equality, separate right-edge checks, and `controls` construction with:

```ts
const halfSizedHud = {
  wave: { width: 150, height: 35 },
  gold: { width: 134, height: 35 },
  bossTitle: { width: 75, height: 30 },
  bond: { width: 55, height: 55 },
} as const;
for (const [name, expectedSize] of Object.entries(halfSizedHud)) {
  const actual = BattleHudConfig.layout[name as keyof typeof halfSizedHud];
  assert.equal(actual.width, expectedSize.width, `${name} width`);
  assert.equal(actual.height, expectedSize.height, `${name} height`);
}

assert.deepEqual(BattleHudConfig.layout.remainingEnemies, {
  x: 0,
  y: 45,
  width: 150,
  height: 60,
});
assert.equal(
  BattleHudConfig.layout.remainingEnemies.x + BattleHudConfig.layout.remainingEnemies.width,
  BattleHudConfig.layout.wave.x + BattleHudConfig.layout.wave.width,
);
assert.deepEqual(BattleHudConfig.layout.bossTitle, { x: 322.5, y: 34, width: 75, height: 30 });
assert.deepEqual(BattleHudConfig.layout.bossHealth, { x: 158, y: 66, width: 404, height: 76 });
assert.deepEqual(BattleHudConfig.layout.cityDurability, {
  x: 90,
  y: 1040,
  width: 540,
  height: 64,
});
assert.deepEqual(BattleHudConfig.layout.ultimate, { x: 590, y: 1130, width: 124, height: 124 });

assert.deepEqual(BattleHudConfig.rightControls, {
  right: 14,
  top: 92,
  itemWidth: 52,
  itemHeight: 52,
  spacing: 0,
  pauseSkinWidth: 48,
  pauseSkinHeight: 48,
});
const rightControls = getRightControlRects();
assert.deepEqual(rightControls, {
  pauseResume: { x: 654, y: 92, width: 52, height: 52 },
  auto: { x: 654, y: 144, width: 52, height: 52 },
  statistics: { x: 654, y: 196, width: 52, height: 52 },
});
assert.equal(rightControls.pauseResume.y + rightControls.pauseResume.height, rightControls.auto.y);
assert.equal(rightControls.auto.y + rightControls.auto.height, rightControls.statistics.y);

assert.equal(getCityGemPaletteName(1), 'emerald');
assert.equal(getCityGemPaletteName(0.55), 'topaz');
assert.equal(getCityGemPaletteName(0.28), 'ruby');
assert.equal(getCityGemPaletteName(-1), 'ruby');
assert.equal(getCityGemPaletteName(Number.NaN), 'ruby');
assert.equal(BattleHudConfig.gemPalettes.ruby.main[0], 214);
assert.equal(BattleHudConfig.gemPalettes.emerald.main[1], 189);
assert.equal(BattleHudConfig.gemPalettes.topaz.main[0], 235);

const controls = [
  ...Object.values(rightControls),
  BattleHudConfig.layout.bond,
  BattleHudConfig.layout.ultimate,
];
```

Change the in-bounds loop to check both ordinary layout entries and derived right controls:

```ts
for (const rect of [...Object.values(BattleHudConfig.layout), ...Object.values(rightControls)]) {
  assert.ok(rect.x >= 0 && rect.y >= 0);
  assert.ok(rect.x + rect.width <= BattleHudConfig.designWidth);
  assert.ok(rect.y + rect.height <= BattleHudConfig.designHeight);
}
```

Extend the value-label assertion to include the smaller remaining-enemy label:

```ts
assert.deepEqual(BattleHudConfig.valueLabels, {
  wave: { x: 0, y: 0, width: 150, height: 21 },
  remainingEnemies: { x: 0, y: -14, width: 100, height: 28 },
  gold: { x: 21, y: 0, width: 77, height: 20 },
});
assert.equal(BattleHudConfig.fontSizes.remainingEnemies, 22);
```

- [ ] **Step 2: Run the HUD logic test and verify the new exports/layout fail**

Run:

```bash
npm run test:hud-logic
```

Expected: FAIL because `getCityGemPaletteName` and `getRightControlRects` do not exist and the old remaining/Boss/city rectangles do not match.

- [ ] **Step 3: Implement pure layout geometry and palette configuration**

In `assets/scripts/ui/BattleHudConfig.ts`, add these types after `HudTrackSpec`:

```ts
export type HudColorTuple = readonly [number, number, number, number];
export type GemPaletteName = 'ruby' | 'emerald' | 'topaz';

export interface GemPaletteSpec {
  base: HudColorTuple;
  main: HudColorTuple;
  highlight: HudColorTuple;
  shadow: HudColorTuple;
  glint: HudColorTuple;
  facet: HudColorTuple;
}

export interface RightControlRects {
  pauseResume: HudRect;
  auto: HudRect;
  statistics: HudRect;
}
```

Retain the approved half-sized wave, gold, title, and bond values, but replace the layout and add right-stack configuration:

```ts
layout: {
  wave: rect(0, 4, 150, 35),
  remainingEnemies: rect(0, 45, 150, 60),
  gold: rect(574, 4, 134, 35),
  bossTitle: rect(322.5, 34, 75, 30),
  bossHealth: rect(158, 66, 404, 76),
  cityDurability: rect(90, 1040, 540, 64),
  bond: rect(10, 1197, 55, 55),
  ultimate: rect(590, 1130, 124, 124),
},
rightControls: {
  right: 14,
  top: 92,
  itemWidth: 52,
  itemHeight: 52,
  spacing: 0,
  pauseSkinWidth: 48,
  pauseSkinHeight: 48,
},
```

Use these label and track settings:

```ts
valueLabels: {
  wave: { x: 0, y: 0, width: 150, height: 21 },
  remainingEnemies: { x: 0, y: -14, width: 100, height: 28 },
  gold: { x: 21, y: 0, width: 77, height: 20 },
},
tracks: {
  boss: { x: 20, y: -2, width: 315, height: 22, radius: 0 },
  city: { x: 54, y: -1, width: 378, height: 24, radius: 0 },
} satisfies Record<string, HudTrackSpec>,
fontSizes: {
  wave: 12.5,
  remainingEnemies: 22,
  gold: 13,
  percent: 18,
  ultimate: 17,
},
cityThresholds: {
  healthy: 0.55,
  warning: 0.28,
},
```

Add the confirmed palettes to the config object:

```ts
gemPalettes: {
  ruby: {
    base: [72, 8, 17, 255],
    main: [214, 31, 57, 255],
    highlight: [255, 106, 64, 170],
    shadow: [87, 5, 24, 190],
    glint: [255, 235, 206, 190],
    facet: [255, 70, 70, 70],
  },
  emerald: {
    base: [5, 61, 47, 255],
    main: [24, 189, 132, 255],
    highlight: [91, 255, 200, 170],
    shadow: [1, 70, 55, 190],
    glint: [214, 255, 237, 190],
    facet: [76, 232, 174, 70],
  },
  topaz: {
    base: [89, 45, 4, 255],
    main: [235, 153, 26, 255],
    highlight: [255, 222, 92, 170],
    shadow: [117, 54, 3, 190],
    glint: [255, 250, 210, 190],
    facet: [255, 193, 55, 70],
  },
} satisfies Record<GemPaletteName, GemPaletteSpec>,
```

After the config object, add the pure helpers:

```ts
export function getRightControlRects(): RightControlRects {
  const config = BattleHudConfig.rightControls;
  const x = BattleHudConfig.designWidth - config.right - config.itemWidth;
  const step = config.itemHeight + config.spacing;
  return {
    pauseResume: rect(x, config.top, config.itemWidth, config.itemHeight),
    auto: rect(x, config.top + step, config.itemWidth, config.itemHeight),
    statistics: rect(x, config.top + step * 2, config.itemWidth, config.itemHeight),
  };
}

export function getCityGemPaletteName(ratio: number): GemPaletteName {
  const safeRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
  if (safeRatio > BattleHudConfig.cityThresholds.healthy) {
    return 'emerald';
  }
  if (safeRatio > BattleHudConfig.cityThresholds.warning) {
    return 'topaz';
  }
  return 'ruby';
}
```

- [ ] **Step 4: Run the focused layout/config test**

Run:

```bash
npm run test:hud-logic
```

Expected: `pass: battle HUD logic and layout`.

- [ ] **Step 5: Commit the approved configuration and retained 50% scaling**

Run:

```bash
git add assets/scripts/ui/BattleHudConfig.ts tools/battle-hud-logic.test.ts
git commit -m "feat: configure gem HUD layout and colors"
```

Expected: the commit contains the earlier approved half-size wave/gold/title/bond values plus the new remaining-enemy, Boss, city, right-stack, track, and palette configuration.

### Task 3: Build the Widget/Layout controls and rectangular gem renderer

**Files:**
- Modify: `tools/battle-hud-view.test.ts`
- Modify: `assets/scripts/ui/BattleHudView.ts`

- [ ] **Step 1: Add failing structural assertions for the new view architecture**

In `tools/battle-hud-view.test.ts`, replace the old `drawProgress` and inline threshold assertions with:

```ts
assert.match(view, /Layout/);
assert.match(view, /applyWidgetAlignment/);
assert.match(view, /new Node\('RightControlStack'\)/);
assert.match(view, /Layout\.Type\.VERTICAL/);
assert.match(view, /Layout\.ResizeMode\.CONTAINER/);
assert.match(view, /Layout\.VerticalDirection\.TOP_TO_BOTTOM/);
assert.match(view, /layout\.spacingY = BattleHudConfig\.rightControls\.spacing/);
assert.match(view, /private drawGemProgress\(/);
assert.match(view, /getCityGemPaletteName\(ratio\)/);
assert.match(view, /graphics\.rect\(/);
assert.doesNotMatch(view, /graphics\.roundRect\(/);
```

Also assert the three roots are parented to the shared stack rather than independently created on `topHudLayer`:

```ts
assert.match(view, /this\.createSizedRoot\(rightControlStack,\s*'PauseResumeHud'/s);
assert.match(view, /this\.createSizedRoot\(rightControlStack,\s*'AutoHud'/s);
assert.match(view, /this\.createSizedRoot\(rightControlStack,\s*'StatisticsHud'/s);
```

- [ ] **Step 2: Run the HUD view test and verify it fails**

Run:

```bash
npm run test:hud-view
```

Expected: FAIL because `RightControlStack`, `Layout.Type.VERTICAL`, and `drawGemProgress` are absent and the implementation still calls `graphics.roundRect`.

- [ ] **Step 3: Create a Widget-anchored vertical control stack**

Change the `cc` import and project imports in `assets/scripts/ui/BattleHudView.ts` to include `Layout`, the palette helper/types, and the existing Widget helper:

```ts
import { Button, Color, Graphics, Label, Layout, Node, UITransform } from 'cc';

import {
  BattleHudConfig,
  GemPaletteName,
  GemPaletteSpec,
  getCityGemPaletteName,
  HudColorTuple,
  HudRect,
  HudTrackSpec,
} from './BattleHudConfig';
import {
  applyWidgetAlignment,
  bindOrCreateLabel,
  bindOrCreateUiArtSkinNode,
  setUiArtSkinFilename,
  setUiLayer,
} from './BattleUiComponents';
```

Replace the three absolute control-root constructions in the constructor with:

```ts
const rightControlStack = this.createRightControlStack(topHudLayer);
const controlConfig = BattleHudConfig.rightControls;
const pauseResume = this.createSizedRoot(
  rightControlStack,
  'PauseResumeHud',
  controlConfig.itemWidth,
  controlConfig.itemHeight,
  HUD_ART.resume,
  controlConfig.pauseSkinWidth,
  controlConfig.pauseSkinHeight,
);
const auto = this.createSizedRoot(
  rightControlStack,
  'AutoHud',
  controlConfig.itemWidth,
  controlConfig.itemHeight,
  HUD_ART.auto,
);
const statistics = this.createSizedRoot(
  rightControlStack,
  'StatisticsHud',
  controlConfig.itemWidth,
  controlConfig.itemHeight,
  HUD_ART.statistics,
);
this.layoutRightControlStack(rightControlStack);
```

Add these helpers before `createRoot`:

```ts
private createRightControlStack(parent: Node): Node {
  const node = parent.getChildByName('RightControlStack') ?? new Node('RightControlStack');
  setUiLayer(node);
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(
    BattleHudConfig.rightControls.itemWidth,
    BattleHudConfig.rightControls.itemHeight * 3,
  );
  if (!node.parent) {
    parent.addChild(node);
  }
  return node;
}

private layoutRightControlStack(node: Node): void {
  const layout = node.getComponent(Layout) ?? node.addComponent(Layout);
  layout.type = Layout.Type.VERTICAL;
  layout.resizeMode = Layout.ResizeMode.CONTAINER;
  layout.verticalDirection = Layout.VerticalDirection.TOP_TO_BOTTOM;
  layout.spacingY = BattleHudConfig.rightControls.spacing;
  layout.paddingTop = 0;
  layout.paddingBottom = 0;
  layout.updateLayout(true);
  applyWidgetAlignment(node, {
    right: BattleHudConfig.rightControls.right,
    top: BattleHudConfig.rightControls.top,
    alignMode: 'onWindowResize',
  });
}

private createSizedRoot(
  parent: Node,
  name: string,
  width: number,
  height: number,
  filename: string,
  skinWidth = width,
  skinHeight = height,
): HudRoot {
  const node = parent.getChildByName(name) ?? new Node(name);
  setUiLayer(node);
  const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
  transform.setContentSize(width, height);
  node.setPosition(0, 0, 0);
  if (!node.parent) {
    parent.addChild(node);
  }
  const skin = bindOrCreateUiArtSkinNode(node, filename, skinWidth, skinHeight, 'HudSkin');
  return { node, skin };
}
```

Refactor `createRoot` to reuse `createSizedRoot` and then apply top-left design coordinates:

```ts
private createRoot(parent: Node, name: string, rect: HudRect, filename: string): HudRoot {
  const root = this.createSizedRoot(parent, name, rect.width, rect.height, filename);
  root.node.setPosition(
    rect.x + rect.width / 2 - BattleHudConfig.designWidth / 2,
    BattleHudConfig.designHeight / 2 - rect.y - rect.height / 2,
    0,
  );
  return root;
}
```

- [ ] **Step 4: Use the configured smaller remaining-enemy label**

Replace its hard-coded label geometry with:

```ts
this.remainingEnemiesLabel = this.createValueLabel(
  remainingEnemies.node,
  'RemainingEnemiesValue',
  BattleHudConfig.valueLabels.remainingEnemies.x,
  BattleHudConfig.valueLabels.remainingEnemies.y,
  BattleHudConfig.fontSizes.remainingEnemies,
  BattleHudConfig.valueLabels.remainingEnemies.width,
  BattleHudConfig.valueLabels.remainingEnemies.height,
);
```

- [ ] **Step 5: Replace the rounded solid fill with layered rectangular gem drawing**

Change the Boss refresh call to:

```ts
this.drawGemProgress(
  this.bossProgress,
  BattleHudConfig.tracks.boss,
  state.boss.ratio,
  'ruby',
);
```

Replace `drawCityProgress` and `drawProgress` with:

```ts
private drawCityProgress(ratio: number): void {
  this.drawGemProgress(
    this.cityProgress,
    BattleHudConfig.tracks.city,
    ratio,
    getCityGemPaletteName(ratio),
  );
}

private toColor(color: HudColorTuple): Color {
  return new Color(color[0], color[1], color[2], color[3]);
}

private fillRect(
  graphics: Graphics,
  color: HudColorTuple,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) {
    return;
  }
  graphics.fillColor = this.toColor(color);
  graphics.rect(x, y, width, height);
  graphics.fill();
}

private drawGemProgress(
  graphics: Graphics,
  track: HudTrackSpec,
  ratio: number,
  paletteName: GemPaletteName,
): void {
  const clampedRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const palette: GemPaletteSpec = BattleHudConfig.gemPalettes[paletteName];
  const left = track.x - track.width / 2;
  const bottom = track.y - track.height / 2;
  graphics.clear();
  this.fillRect(graphics, [20, 12, 10, 250], left, bottom, track.width, track.height);

  const inset = 2;
  const innerLeft = left + inset;
  const innerBottom = bottom + inset;
  const innerWidth = Math.max(0, track.width - inset * 2);
  const innerHeight = Math.max(0, track.height - inset * 2);
  const fillWidth = clampedRatio > 0 ? Math.max(1, innerWidth * clampedRatio) : 0;
  if (fillWidth <= 0 || innerHeight <= 0) {
    return;
  }

  this.fillRect(graphics, palette.base, innerLeft, innerBottom, fillWidth, innerHeight);
  const faceInset = Math.min(1, fillWidth / 3, innerHeight / 3);
  const faceLeft = innerLeft + faceInset;
  const faceBottom = innerBottom + faceInset;
  const faceWidth = Math.max(0, fillWidth - faceInset * 2);
  const faceHeight = Math.max(0, innerHeight - faceInset * 2);
  this.fillRect(graphics, palette.main, faceLeft, faceBottom, faceWidth, faceHeight);
  this.fillRect(
    graphics,
    palette.highlight,
    faceLeft,
    faceBottom + faceHeight * 0.68,
    faceWidth,
    faceHeight * 0.32,
  );
  this.fillRect(graphics, palette.shadow, faceLeft, faceBottom, faceWidth, faceHeight * 0.25);

  if (faceWidth > 6) {
    this.fillRect(
      graphics,
      palette.glint,
      faceLeft + 3,
      faceBottom + faceHeight - 3,
      Math.max(0, faceWidth - 6),
      1.5,
    );
  }

  const facetRight = faceLeft + faceWidth;
  for (let facetX = faceLeft + 18; facetX < facetRight; facetX += 24) {
    this.fillRect(
      graphics,
      palette.facet,
      facetX,
      faceBottom + 1,
      Math.min(5, facetRight - facetX),
      Math.max(0, faceHeight - 2),
    );
  }
}
```

The fixed ruby key in the Boss call enforces the approved B behavior. The city call is the only path that selects emerald/topaz/ruby by ratio.

- [ ] **Step 6: Run focused view and logic tests**

Run:

```bash
npm run test:hud-view
npm run test:hud-logic
npm run typecheck
```

Expected: the view test prints `pass: image-backed battle HUD view structure`, the logic test prints `pass: battle HUD logic and layout`, and TypeScript exits successfully.

- [ ] **Step 7: Commit the view implementation and retained label scaling**

Run:

```bash
git add assets/scripts/ui/BattleHudView.ts tools/battle-hud-view.test.ts
git commit -m "feat: render gem health bars with aligned controls"
```

Expected: one view commit with the earlier approved smaller wave/gold label geometry, the right-side Widget/Layout stack, smaller remaining label, and rectangular gem renderer.

### Task 4: Run regressions and verify the HUD in Cocos portrait preview

**Files:**
- Potentially modify: `assets/scripts/ui/BattleHudConfig.ts`
- Create: `docs/superpowers/verification/2026-07-14-gem-health-bars-widget-layout.png`

- [ ] **Step 1: Run the focused and adjacent automated regression suite**

Run:

```bash
npm run test:hud-assets && \
npm run test:hud-logic && \
npm run test:hud-view && \
npm run test:ui-layout && \
npm run test:scene && \
npm run test:mvp && \
npm run typecheck && \
git diff --check
```

Expected: every test prints its `pass:` line, TypeScript exits 0, and `git diff --check` is silent.

- [ ] **Step 2: Start or refresh the Cocos portrait preview**

Run the project’s portrait helper:

```bash
npm run preview:portrait
```

Open or reload `http://127.0.0.1:7456/`, start the battle, and wait until a Boss is visible. Keep the design canvas in portrait mode.

- [ ] **Step 3: Verify the approved visual invariants**

Inspect the preview at 720 × 1280 and confirm all of the following:

```text
City frame: no white canvas; 城门耐久 text and heart intact; fill stays inside right track.
Boss frame: no white canvas; red crystal emblem intact; ruby fill stays inside right track.
Boss placement: frame top is at design y=66 and title is above it without overlap.
Remaining enemies: 150px-wide root, visibly smaller than before, right edge equals wave right edge.
Right controls: pause, auto, statistics appear top-to-bottom with no visual gap and distinct hit areas.
Retained UI: wave/gold/title/bond remain at approved 50% size; ultimate, health values, hero portraits, and three-choice cards are unchanged in behavior.
```

Exercise city health through at least one available damage transition and confirm that healthy city fill is emerald. Boss fill must remain ruby at both high and low Boss health. If the preview cannot naturally reach the topaz/ruby city thresholds quickly, rely on the pure threshold test for those two deterministic states rather than changing battle balance.

- [ ] **Step 4: Calibrate only the documented configuration fields if the processed art requires it**

If a fill touches metalwork or text, change only these values in `BattleHudConfig.ts` and rerun `npm run test:hud-logic` after updating the matching expected values:

```ts
tracks: {
  boss: { x: 20, y: -2, width: 315, height: 22, radius: 0 },
  city: { x: 54, y: -1, width: 378, height: 24, radius: 0 },
}
```

If the three controls are not flush with the desired screen edge, change only `rightControls.right`, `rightControls.top`, or `rightControls.spacing`. Do not add per-button absolute coordinates. If the frame itself requires repositioning, change only the corresponding `layout.bossTitle`, `layout.bossHealth`, or `layout.cityDurability` rectangle and update its exact test expectation.

After any calibration, rerun the full command from Step 1. Expected: all tests still pass and no approved alignment relationship changes.

- [ ] **Step 5: Capture the accepted portrait preview**

Save the final 720 × 1280 preview screenshot to:

```text
docs/superpowers/verification/2026-07-14-gem-health-bars-widget-layout.png
```

The screenshot must show the Boss frame, remaining-enemy/wave alignment, right control stack, city frame, hero portrait rail, and ultimate control in one image.

- [ ] **Step 6: Commit verification evidence or calibration changes**

Run:

```bash
git add docs/superpowers/verification/2026-07-14-gem-health-bars-widget-layout.png
git add assets/scripts/ui/BattleHudConfig.ts tools/battle-hud-logic.test.ts
git diff --cached --check
git commit -m "test: verify gem battle HUD layout"
```

Expected: the commit contains the accepted screenshot and, only if visual calibration was necessary, the synchronized config/test adjustment. If the config and test are unchanged, Git stages only the screenshot.

## Final handoff

Report the final focused/regression test results and link the verification screenshot. Tell the user that the main adjustment file is `assets/scripts/ui/BattleHudConfig.ts`, with:

```text
layout.*                         ordinary element positions and sizes
rightControls.right/top         entire pause/auto/statistics group position
rightControls.itemWidth/height  control cell size
rightControls.spacing           connection gap
tracks.boss / tracks.city       fill position and size inside the art frames
gemPalettes                     ruby, emerald, and topaz colors
cityThresholds                  city color-change thresholds
```
