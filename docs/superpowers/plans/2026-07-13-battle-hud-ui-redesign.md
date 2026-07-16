# Battle HUD UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent battle HUD with the twelve approved image-backed components, live values, dynamic health fills, and a centralized 720 × 1280 layout configuration while retaining hero portraits and the three-choice upgrade panel.

**Architecture:** Preprocess the supplied PNGs into transparent, cropped project assets and register them in the existing UI bundle. Keep layout and pure formatting/clamping rules independent of Cocos, render the HUD through one `BattleHudView`, and make `BattleController` the sole adapter from the battle model to HUD display state and pause/resume actions.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript ES2020, Node/tsx tests, Python 3 with Pillow for deterministic image preprocessing.

---

## File Map

- Create `assets/scripts/ui/BattleHudConfig.ts`: approved rectangles, track geometry, font sizes, colors, and fixed display total.
- Create `assets/scripts/ui/BattleHudLogic.ts`: pure wave, number, percentage, and HUD-state helpers.
- Create `assets/scripts/ui/BattleHudView.ts`: Cocos nodes, sprites, labels, progress rendering, and button events.
- Create matching `.meta` files for the three TypeScript modules.
- Create `tools/prepare-battle-hud-assets.py`: transparent-background conversion, cropping, resizing, Cocos metadata, and manifest registration.
- Create `tools/battle-hud-assets.test.py`: processed PNG and metadata verification.
- Create `tools/battle-hud-logic.test.ts`: pure HUD behavior and layout tests.
- Create `tools/battle-hud-view.test.ts`: source-structure integration checks for the Cocos HUD view and controller.
- Create `assets/bundles/ui/ui_hud_custom/`: twelve processed PNGs and Cocos `.meta` files.
- Modify `assets/scripts/ui/UiArtManifest.ts`: register the twelve runtime textures.
- Modify `assets/scripts/battle/BattleController.ts`: replace legacy persistent HUD construction, derive display state, and handle start/pause/resume/restart.
- Delete `assets/scripts/battle/CityHealthSystem.ts` and its `.meta`: its only caller is the legacy HUD.
- Delete `assets/scripts/battle/WaveSystem.ts` and its `.meta`: its only caller is the legacy HUD.
- Modify `assets/scripts/ui/BattleUiComponents.ts`: retain shared helpers and hero/upgrade views; remove the identified HUD-only legacy classes.
- Modify `tools/battle-hud-polish.test.ts`: keep formation, hero portrait, and upgrade assertions while replacing legacy HUD assertions.
- Modify `tools/ui-layout-v4.test.ts`: validate the retained battlefield/portrait layout only and delegate new HUD rectangles to the new test.
- Modify `tools/scene-structure.test.ts`: stop requiring obsolete legacy HUD children; continue requiring the canvas, layers, hero hosts, and upgrade hosts.
- Modify `package.json`: add focused HUD asset, logic, and view test commands.
- Modify `README.md`: document the new configuration entry point and asset command.

### Task 1: Pure HUD Configuration and Display Logic

**Files:**

- Create: `assets/scripts/ui/BattleHudConfig.ts`
- Create: `assets/scripts/ui/BattleHudLogic.ts`
- Create: `assets/scripts/ui/BattleHudConfig.ts.meta`
- Create: `assets/scripts/ui/BattleHudLogic.ts.meta`
- Create: `tools/battle-hud-logic.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write the failing pure-logic and layout test**

Create `tools/battle-hud-logic.test.ts` with explicit assertions:

```ts
import assert from 'node:assert/strict';

import { BattleHudConfig, hudRectsOverlap } from '../assets/scripts/ui/BattleHudConfig';
import {
  clampHudRatio,
  createBattleHudDisplayState,
  formatHudInteger,
  getDisplayWave,
} from '../assets/scripts/ui/BattleHudLogic';

assert.equal(BattleHudConfig.totalWaves, 50);
assert.equal(getDisplayWave(0), 0);
assert.equal(getDisplayWave(1), 1);
assert.equal(getDisplayWave(50), 50);
assert.equal(getDisplayWave(51), 1);
assert.equal(getDisplayWave(101), 1);
assert.equal(clampHudRatio(-1), 0);
assert.equal(clampHudRatio(Number.NaN), 0);
assert.equal(clampHudRatio(0.75), 0.75);
assert.equal(clampHudRatio(2), 1);
assert.equal(formatHudInteger(1280.9), '1,280');

const state = createBattleHudDisplayState({
  wave: 51,
  remainingEnemies: 7,
  cityHealth: 48,
  cityMaxHealth: 100,
  bossHealth: 75,
  bossMaxHealth: 100,
  gold: 0,
  ultimate: 0,
  paused: false,
  running: true,
  gameOver: false,
});
assert.equal(state.waveText, '第 1 / 50 波');
assert.equal(state.remainingEnemiesText, '7');
assert.equal(state.goldText, '0');
assert.equal(state.ultimateText, '0 / 100');
assert.equal(state.cityPercentText, '48%');
assert.equal(state.boss?.percentText, '75%');
assert.equal(state.controlImage, 'hud_pause_button.png');

const controls = [
  BattleHudConfig.layout.pauseResume,
  BattleHudConfig.layout.auto,
  BattleHudConfig.layout.statistics,
  BattleHudConfig.layout.bond,
  BattleHudConfig.layout.ultimate,
];
for (const rect of Object.values(BattleHudConfig.layout)) {
  assert.ok(rect.x >= 0 && rect.y >= 0);
  assert.ok(rect.x + rect.width <= 720);
  assert.ok(rect.y + rect.height <= 1280);
}
for (let left = 0; left < controls.length; left += 1) {
  for (let right = left + 1; right < controls.length; right += 1) {
    assert.equal(hudRectsOverlap(controls[left], controls[right]), false);
  }
}

console.log('pass: battle HUD logic and layout');
```

- [x] **Step 2: Add the focused test command and verify failure**

Add to `package.json`:

```json
"test:hud-logic": "tsx tools/battle-hud-logic.test.ts"
```

Run: `npm run test:hud-logic`
Expected: FAIL because `BattleHudConfig` and `BattleHudLogic` do not exist.

- [x] **Step 3: Implement the configuration and pure helpers**

Create `BattleHudConfig.ts` with `HudRect`, `HudTrackSpec`, `fromTopLeft`, the approved rectangles,
font metrics, progress-track offsets, and `hudRectsOverlap`. The required configuration values are:

```ts
export const BattleHudConfig = {
  designWidth: 720,
  designHeight: 1280,
  totalWaves: 50,
  maximumUltimate: 100,
  layout: {
    wave: fromTopLeft(0, 4, 300, 70),
    remainingEnemies: fromTopLeft(0, 78, 190, 76),
    gold: fromTopLeft(440, 4, 268, 70),
    bossTitle: fromTopLeft(310, 76, 150, 60),
    bossHealth: fromTopLeft(196, 126, 380, 92),
    pauseResume: fromTopLeft(610, 84, 96, 96),
    auto: fromTopLeft(602, 292, 104, 104),
    statistics: fromTopLeft(602, 410, 104, 104),
    cityDurability: fromTopLeft(145, 1024, 430, 96),
    bond: fromTopLeft(10, 1142, 110, 110),
    ultimate: fromTopLeft(590, 1130, 124, 124),
  },
  tracks: {
    boss: { x: 70, y: -3, width: 276, height: 24, radius: 12 },
    city: { x: 8, y: -1, width: 266, height: 30, radius: 15 },
  },
  font: { wave: 25, remainingEnemies: 25, gold: 26, percent: 22, ultimate: 17 },
} as const;
```

Create `BattleHudLogic.ts` with finite-value guards and a complete state factory:

```ts
import { BattleHudConfig } from './BattleHudConfig';

export interface BattleHudStateInput {
  wave: number;
  remainingEnemies: number;
  cityHealth: number;
  cityMaxHealth: number;
  bossHealth?: number;
  bossMaxHealth?: number;
  gold: number;
  ultimate: number;
  paused: boolean;
  running: boolean;
  gameOver: boolean;
}

export function clampHudRatio(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function getDisplayWave(wave: number): number {
  if (!Number.isFinite(wave) || wave <= 0) return 0;
  return ((Math.floor(wave) - 1) % BattleHudConfig.totalWaves) + 1;
}

export function formatHudInteger(value: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return safe.toLocaleString('en-US');
}

export function createBattleHudDisplayState(input: BattleHudStateInput) {
  const cityRatio = clampHudRatio(input.cityHealth / Math.max(1, input.cityMaxHealth));
  const bossVisible =
    typeof input.bossHealth === 'number' &&
    typeof input.bossMaxHealth === 'number' &&
    Number.isFinite(input.bossHealth) &&
    Number.isFinite(input.bossMaxHealth);
  const bossRatio = bossVisible
    ? clampHudRatio((input.bossHealth ?? 0) / Math.max(1, input.bossMaxHealth ?? 1))
    : 0;
  const wave = getDisplayWave(input.wave);
  const ultimate = Number.isFinite(input.ultimate)
    ? Math.min(BattleHudConfig.maximumUltimate, Math.max(0, Math.floor(input.ultimate)))
    : 0;
  return {
    waveText: `第 ${wave} / ${BattleHudConfig.totalWaves} 波`,
    remainingEnemiesText: formatHudInteger(input.remainingEnemies),
    goldText: formatHudInteger(input.gold),
    ultimateText: `${ultimate} / ${BattleHudConfig.maximumUltimate}`,
    cityRatio,
    cityPercentText: `${Math.round(cityRatio * 100)}%`,
    boss: bossVisible ? { ratio: bossRatio, percentText: `${Math.round(bossRatio * 100)}%` } : null,
    controlImage:
      input.running && !input.paused && !input.gameOver
        ? 'hud_pause_button.png'
        : 'hud_resume_button.png',
  };
}

export type BattleHudDisplayState = ReturnType<typeof createBattleHudDisplayState>;
```

Create TypeScript `.meta` files using the same Cocos TypeScript metadata schema as neighboring UI
modules, each with a new UUID.

- [x] **Step 4: Run the focused test**

Run: `npm run test:hud-logic`
Expected: `pass: battle HUD logic and layout`.

- [x] **Step 5: Commit the pure foundation**

```bash
git add package.json tools/battle-hud-logic.test.ts assets/scripts/ui/BattleHudConfig.ts assets/scripts/ui/BattleHudConfig.ts.meta assets/scripts/ui/BattleHudLogic.ts assets/scripts/ui/BattleHudLogic.ts.meta
git commit -m "feat: add configurable battle hud state"
```

### Task 2: Process and Import the Twelve HUD Assets

**Files:**

- Create: `tools/prepare-battle-hud-assets.py`
- Create: `tools/battle-hud-assets.test.py`
- Create: `assets/bundles/ui/ui_hud_custom.meta`
- Create: `assets/bundles/ui/ui_hud_custom/*.png`
- Create: `assets/bundles/ui/ui_hud_custom/*.png.meta`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `package.json`

- [x] **Step 1: Write the failing asset test**

The test must open every expected output with Pillow and verify RGBA data, transparent corners,
nonempty visible bounds, practical dimensions, valid Cocos metadata, and manifest registration:

```py
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/bundles/ui/ui_hud_custom"
NAMES = [
    "hud_wave_panel.png", "hud_remaining_enemies.png", "hud_gold_panel.png",
    "hud_boss_title.png", "hud_boss_health_frame.png", "hud_city_durability_frame.png",
    "hud_pause_button.png", "hud_resume_button.png", "hud_auto_button_custom.png",
    "hud_bond_button_custom.png", "hud_statistics_button.png", "hud_ultimate_badge_custom.png",
]
manifest = (ROOT / "assets/scripts/ui/UiArtManifest.ts").read_text(encoding="utf-8")
for name in NAMES:
    path = OUT / name
    assert path.exists(), name
    image = Image.open(path).convert("RGBA")
    assert image.getchannel("A").getbbox() is not None
    assert max(image.size) <= 1024
    for point in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)):
        assert image.getpixel(point)[3] == 0, (name, point)
    meta = json.loads(Path(f"{path}.meta").read_text(encoding="utf-8"))
    assert meta["importer"] == "image"
    assert meta["userData"]["hasAlpha"] is True
    assert name in manifest
print("pass: custom battle HUD assets")
```

- [x] **Step 2: Add commands and verify the asset test fails**

Add:

```json
"prepare:hud-assets": "python3 tools/prepare-battle-hud-assets.py",
"test:hud-assets": "python3 tools/battle-hud-assets.test.py"
```

Run: `npm run test:hud-assets`
Expected: FAIL because `ui_hud_custom` outputs do not exist.

- [x] **Step 3: Implement deterministic preprocessing**

The script must use the approved source-to-target map, `ImageDraw.floodfill` from all four corners
with a unique marker and threshold 28, multiply the resulting foreground mask into alpha, feather
with `GaussianBlur(0.65)`, crop with 10 pixels of glow-safe padding, resize the long edge to 1024
for panels or 768 for badges, and preserve existing UUIDs on repeat runs. Use this complete mapping:

```py
ASSETS = {
    "怪物波数显示.png": ("hud_wave_panel.png", 1024),
    "剩余敌人显示图标.png": ("hud_remaining_enemies.png", 768),
    "金币显示面板.png": ("hud_gold_panel.png", 1024),
    "首领显示图标.png": ("hud_boss_title.png", 768),
    "首领血条显示.png": ("hud_boss_health_frame.png", 1024),
    "城门耐久状态条.png": ("hud_city_durability_frame.png", 1024),
    "暂停按钮图标.png": ("hud_pause_button.png", 768),
    "继续按钮标志.png": ("hud_resume_button.png", 768),
    "自动图标设计.png": ("hud_auto_button_custom.png", 768),
    "羁绊徽章.png": ("hud_bond_button_custom.png", 768),
    "统计图标设计.png": ("hud_statistics_button.png", 768),
    "绝技徽章设计.png": ("hud_ultimate_badge_custom.png", 768),
}
```

Reuse the `write_meta` schema from `tools/generate_commercial_ui_assets.py`. Register each output
as atlas `ui_hud_custom`, bundle path `ui_hud_custom/<stem>`, its real pixel dimensions, and no
nine-slice data. Make the manifest update idempotent by removing any existing line for the filename
before inserting the regenerated line before `};`.

- [x] **Step 4: Generate assets and visually inspect the contact sheet**

Run: `npm run prepare:hud-assets`
Expected: twelve PNGs, twelve PNG metadata files, a directory metadata file, manifest entries, and
`docs/ui_art_generated/atlas_previews/ui_hud_custom_preview.png`.

Open the preview and verify that there is no opaque white rectangle, Chinese text is preserved, and
no outer glow is clipped.

- [x] **Step 5: Run the asset test**

Run: `npm run test:hud-assets`
Expected: `pass: custom battle HUD assets`.

- [x] **Step 6: Commit imported assets**

```bash
git add package.json tools/prepare-battle-hud-assets.py tools/battle-hud-assets.test.py assets/bundles/ui/ui_hud_custom.meta assets/bundles/ui/ui_hud_custom assets/scripts/ui/UiArtManifest.ts docs/ui_art_generated/atlas_previews/ui_hud_custom_preview.png
git commit -m "feat: import custom battle hud artwork"
```

### Task 3: Build the Image-Backed BattleHudView

**Files:**

- Create: `assets/scripts/ui/BattleHudView.ts`
- Create: `assets/scripts/ui/BattleHudView.ts.meta`
- Create: `tools/battle-hud-view.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write a failing view-structure test**

Read `BattleHudView.ts` as source and assert that it exposes `BattleHudView`, consumes
`BattleHudDisplayState`, binds all twelve filenames, creates `Button` components only for the five
interactive/future-control nodes, draws boss/city fills with `Graphics`, hides both boss nodes when
`state.boss` is null, and changes the pause/resume `SpriteFrame` through a public refresh path.
Also assert that the view does not reference the old HUD filenames.

Use these concrete source assertions:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('assets/scripts/ui/BattleHudView.ts', 'utf8');
const controller = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');
assert.match(view, /export class BattleHudView/);
assert.match(view, /BattleHudDisplayState/);
for (const filename of [
  'hud_wave_panel.png',
  'hud_remaining_enemies.png',
  'hud_gold_panel.png',
  'hud_boss_title.png',
  'hud_boss_health_frame.png',
  'hud_city_durability_frame.png',
  'hud_pause_button.png',
  'hud_resume_button.png',
  'hud_auto_button_custom.png',
  'hud_bond_button_custom.png',
  'hud_statistics_button.png',
  'hud_ultimate_badge_custom.png',
])
  assert.ok(view.includes(filename), filename);
assert.match(view, /new Node\('BossProgressOverlay'\)/);
assert.match(view, /new Node\('CityProgressOverlay'\)/);
assert.match(view, /state\.boss === null/);
assert.match(view, /this\.bossTitleNode\.active = bossVisible/);
assert.match(view, /this\.bossHealthNode\.active = bossVisible/);
assert.match(view, /setUiArtSkinFilename\(this\.pauseResumeSkin, state\.controlImage\)/);
assert.doesNotMatch(view, /hud_(?:top_frame|resource_chip|boss_hp_bg|city_hp_bg|combo_plate)/);
assert.match(controller, /BattleHudView/);
console.log('pass: image-backed battle HUD view structure');
```

- [x] **Step 2: Add the test command and verify failure**

Add:

```json
"test:hud-view": "tsx tools/battle-hud-view.test.ts"
```

Run: `npm run test:hud-view`
Expected: FAIL because `BattleHudView.ts` does not exist.

- [x] **Step 3: Implement the view root and static image panels**

Create `BattleHudView` with a constructor accepting `topHudLayer`, `midStatusLayer`, and
`bottomHudLayer`. Use `bindOrCreateUiArtSkinNode`, `bindOrCreateLabel`, `Button`, `Graphics`,
`Sprite`, and `UITransform`. Convert each top-left config rectangle to the centered Cocos position,
set the node size from the rectangle, and create these named roots:

```ts
(WaveHud,
  RemainingEnemiesHud,
  GoldHud,
  BossTitleHud,
  BossHealthHud,
  PauseResumeHud,
  AutoHud,
  StatisticsHud,
  CityDurabilityHud,
  BondHud,
  UltimateHud);
```

Bind the approved filename to each root. Labels must be children above the artwork, use the config
font sizes, center alignment, the existing HUD font role, a dark outline, and these placements:

- wave centered in `WaveHud`;
- remaining count under the baked title inside `RemainingEnemiesHud`;
- gold value in the right two-thirds of `GoldHud`;
- boss percent over the runtime track;
- city percent over the runtime track;
- ultimate text centered in the badge's lower bar.

- [x] **Step 4: Implement reusable progress rendering**

Create `BossProgressOverlay` and `CityProgressOverlay` child nodes after their artwork nodes and
before their value labels, each with its own `Graphics` component. Add a private `drawProgress`
helper that clears the overlay `Graphics`, draws an opaque dark rounded track over the baked bar,
then draws the clamped fill and a four-pixel white sheen. Boss uses red shades. City uses green above
55%, gold from 28–55%, and red at or below 28%. `refresh(state)` must set both boss nodes inactive
when `state.boss` is null and must never leave the baked city `98.1%` visible.

- [x] **Step 5: Implement control image switching and callbacks**

Expose:

```ts
public onPauseResume(handler: () => void): void
public refresh(state: BattleHudDisplayState): void
```

`onPauseResume` binds `Button.EventType.CLICK`. `refresh` selects `hud_pause_button.png` or
`hud_resume_button.png` using the state's `controlImage`. Add this shared setter to
`BattleUiComponents.ts` rather than duplicating bundle-loading logic:

```ts
export function setUiArtSkinFilename(node: Node, filename: string): void {
  const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
  const spec = getUiArtAsset(filename);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.type = spec?.nineSlice ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
  loadUiSpriteFrame(filename, (frame) => {
    if (frame && node.isValid) sprite.spriteFrame = frame;
  });
}
```

Auto, Statistics, Bond, and Ultimate receive `Button` hit targets but no gameplay callbacks.

- [x] **Step 6: Run the focused view test**

Run: `npm run test:hud-view`
Expected: PASS for all required nodes, assets, labels, progress rendering, and boss visibility.

- [x] **Step 7: Commit the standalone HUD view**

```bash
git add package.json tools/battle-hud-view.test.ts assets/scripts/ui/BattleHudView.ts assets/scripts/ui/BattleHudView.ts.meta assets/scripts/ui/BattleUiComponents.ts
git commit -m "feat: render image-backed battle hud"
```

### Task 4: Integrate HUD State and Pause/Resume in BattleController

**Files:**

- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `tools/battle-hud-view.test.ts`

- [x] **Step 1: Extend the failing controller integration test**

Assert the controller imports and owns `BattleHudView`, creates it once with the three retained UI
layers, calls `refreshBattleHud()` after initialization and every UI refresh, binds
`onPauseResume`, and gates battle ticks with `!this.battlePaused`. Assert it no longer constructs
`BossHealthBarView`, `CityHealthBarView`, `ResourceChipView`, `UltimateButtonView`, or the old
pause/speed/auto/bond button views.

Append these assertions to `tools/battle-hud-view.test.ts`:

```ts
assert.match(controller, /private battleHudView!: BattleHudView;/);
assert.match(controller, /private battlePaused = false;/);
assert.match(controller, /new BattleHudView\(/);
assert.match(controller, /this\.battleHudView\.onPauseResume\(/);
assert.match(controller, /private refreshBattleHud\(\): void/);
assert.match(controller, /this\.model\.enemies\.filter\(\(enemy\) => enemy\.alive\)\.length/);
assert.match(controller, /this\.model\.running && !this\.model\.gameOver && !this\.battlePaused/);
for (const legacy of [
  'BossHealthBarView',
  'CityHealthBarView',
  'ResourceChipView',
  'UltimateButtonView',
  'CityHealthSystem',
  'WaveSystem',
  'TopHudFrame',
  'StoneChipPrefab',
  'SpeedButtonPrefab',
])
  assert.equal(controller.includes(legacy), false, legacy);
```

- [x] **Step 2: Run the test to verify failure**

Run: `npm run test:hud-view`
Expected: FAIL on the missing controller integration assertions.

- [x] **Step 3: Replace legacy fields and construction**

Remove legacy persistent-HUD fields and add:

```ts
private battleHudView!: BattleHudView;
private battlePaused = false;
private hudGold = 0;
private hudUltimate = 0;
```

Construct `BattleHudView` after the top/mid/bottom layers exist, keep `createBottomHudLayer()` only
for the five existing `HeroAvatarSlotView` nodes, and stop constructing the top frame, spirit stone,
speed button, combo panel, status label, build label, and legacy health/resource/button views.

- [x] **Step 4: Add the state adapter**

Implement:

```ts
private refreshBattleHud(): void {
  const boss = this.model.enemies.find((enemy) => enemy.alive && enemy.kind === 'boss');
  this.battleHudView.refresh(createBattleHudDisplayState({
    wave: this.model.wave,
    remainingEnemies: this.model.enemies.filter((enemy) => enemy.alive).length,
    cityHealth: this.model.cityHealth,
    cityMaxHealth: this.model.options.cityMaxHealth,
    bossHealth: boss?.hp,
    bossMaxHealth: boss?.maxHp,
    gold: this.hudGold,
    ultimate: this.hudUltimate,
    paused: this.battlePaused,
    running: this.model.running,
    gameOver: this.model.gameOver,
  }));
}
```

Call it from initialization, `refreshUi`, after each battle tick result, after boss damage, and after
pause/resume state changes.

Remove `refreshBossBar` and the legacy `comboView` refresh. Replace `refreshComboLabel(deltaTime)`
with an `updateComboTimer(deltaTime)` method that only decrements `comboTimeLeft`, preserving the
approved floating combo feedback without recreating a persistent combo panel.

- [x] **Step 5: Implement start/pause/resume/restart behavior**

Bind the button once:

```ts
this.battleHudView.onPauseResume(() => {
  if (!this.model.running || this.model.gameOver) {
    this.battlePaused = false;
    this.startBattle();
  } else {
    this.battlePaused = !this.battlePaused;
    this.refreshBattleHud();
  }
});
```

Add `!this.battlePaused` to the model tick condition. Do not call `director.pause()`. Reset
`battlePaused`, `hudGold`, and `hudUltimate` in `startBattle()`.

- [x] **Step 6: Run controller and model tests**

Run:

```bash
npm run test:hud-view
npm run test:mvp
npm run typecheck
```

Expected: all PASS; pausing changes only controller presentation state and does not modify the pure
battle model.

- [x] **Step 7: Commit controller integration**

```bash
git add assets/scripts/battle/BattleController.ts tools/battle-hud-view.test.ts
git commit -m "feat: connect battle hud and pause controls"
```

### Task 5: Remove Legacy HUD-Only Code and Update Existing Tests

**Files:**

- Modify: `assets/scripts/ui/BattleUiComponents.ts`
- Delete: `assets/scripts/battle/CityHealthSystem.ts`
- Delete: `assets/scripts/battle/CityHealthSystem.ts.meta`
- Delete: `assets/scripts/battle/WaveSystem.ts`
- Delete: `assets/scripts/battle/WaveSystem.ts.meta`
- Modify: `tools/battle-hud-polish.test.ts`
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/scene-structure.test.ts`

- [x] **Step 1: Run the existing UI tests and record expected failures**

Run:

```bash
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
```

Expected: FAIL where tests still require legacy city, boss, resource, speed, combo, status, or button
implementations.

- [x] **Step 2: Remove now-unreferenced HUD-only implementations**

Delete `UiButtonView`, `ResourceChipView`, `BossHealthBarView`, `CityHealthBarView`, `ComboView`, and
`UltimateButtonView` from `BattleUiComponents.ts`; the repository reference scan shows that their
only remaining callers are the legacy controller HUD and `UltimateButtonView` itself. Delete
`CityHealthSystem.ts`, `CityHealthSystem.ts.meta`, `WaveSystem.ts`, and `WaveSystem.ts.meta`; their
only caller is the legacy controller HUD. Preserve sprite loading, labels, upgrade cards, and
`HeroAvatarSlotView` behavior.

- [x] **Step 3: Rewrite legacy HUD assertions around the new contract**

Keep the existing formation, hero portrait, invisible placement target, upgrade panel, and
animation assertions. Replace legacy city/boss/chip assertions with checks that:

- `BattleHudView` owns wave, enemy, gold, boss, city, control, and ultimate visuals;
- `BattleController` does not create `TopHudFrame`, spirit stone, speed, combo, status, or build HUD;
- `HeroAvatarSlot1` through `HeroAvatarSlot5` remain unchanged;
- the upgrade panel stays centered and does not depend on `BattleHudView`.

Delete scene-test assertions that require obsolete prefab children. Continue to require
`BattleMainCanvas`, the four UI layers, the five hero slot hosts, and the upgrade panel hosts; the
runtime HUD explicitly destroys or disables any serialized legacy child it encounters.

- [x] **Step 4: Run all focused UI tests**

Run:

```bash
npm run test:hud-assets
npm run test:hud-logic
npm run test:hud-view
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
```

Expected: all PASS.

- [x] **Step 5: Commit legacy cleanup and test migration**

```bash
git add assets/scripts/ui/BattleUiComponents.ts assets/scripts/battle/CityHealthSystem.ts assets/scripts/battle/CityHealthSystem.ts.meta assets/scripts/battle/WaveSystem.ts assets/scripts/battle/WaveSystem.ts.meta tools/battle-hud-polish.test.ts tools/ui-layout-v4.test.ts tools/scene-structure.test.ts
git commit -m "refactor: remove legacy persistent battle hud"
```

### Task 6: Documentation and Full Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-13-battle-hud-ui-redesign.md` only to check completed boxes during execution

- [x] **Step 1: Document resource generation and UI adjustment**

Add a README subsection naming:

- `assets/scripts/ui/BattleHudConfig.ts` as the position/size entry point;
- `x` and `y` as top-left portrait coordinates;
- `width` and `height` as visible size and hit-target size;
- `BattleHudConfig.tracks` as the inner health-fill adjustment entry point;
- `npm run prepare:hud-assets` as the deterministic re-import command;
- `assets/bundles/ui/ui_hud_custom/` as the runtime resource directory.

- [x] **Step 2: Run formatting only on touched text/code files**

Run Prettier on the changed TypeScript, JSON, and Markdown paths. Do not run repository-wide format,
which could rewrite unrelated user files.

- [x] **Step 3: Run the complete verification suite**

Run:

```bash
npm run test:hud-assets
npm run test:hud-logic
npm run test:hud-view
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:mvp
npm run test:animation
npm run test:terrain
npm run test:vfx
npm run typecheck
git diff --check
```

Expected: every command exits 0. Existing unrelated edits to
`assets/scripts/battle/VideoCharacterPresentation.ts` and `tools/animation-system.test.ts` must
remain unstaged and unchanged by this implementation.

- [x] **Step 4: Run Cocos portrait preview verification**

Run `npm run preview:portrait`, open `assets/scenes/BattleMain.scene` in Cocos Creator 3.8.8, and
capture these states at 720 × 1280:

1. before battle, showing the resume/start image;
2. normal wave, showing wave, remaining count, gold, city durability, and controls;
3. paused, showing the resume image while input remains responsive;
4. boss wave, showing the boss title above the dynamic boss bar;
5. three-choice upgrade overlay, confirming the retained panel stays above the HUD.

Verify no white rectangles, no clipped glow, readable live values, and no overlap with hero
portraits or the upgrade panel.

- [x] **Step 5: Commit documentation and any visual-only tuning**

```bash
git add README.md assets/scripts/ui/BattleHudConfig.ts docs/superpowers/plans/2026-07-13-battle-hud-ui-redesign.md
git commit -m "docs: explain battle hud customization"
```

- [x] **Step 6: Final status audit**

Run: `git status --short`
Expected: only the user's pre-existing modifications remain unstaged; all HUD implementation files
are committed and the branch is ready for handoff.
