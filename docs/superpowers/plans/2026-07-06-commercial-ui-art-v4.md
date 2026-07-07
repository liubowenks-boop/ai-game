# Commercial UI Art v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current prototype-like battle presentation with the approved A+C v4 commercial UI art pass while preserving existing gameplay logic.

**Architecture:** Keep the existing Cocos Creator 3.8 TypeScript structure. Add small visual/layout helpers in existing `assets/scripts/ui`, generate workspace-bound raster assets under existing bundles, and update current UI components to use the v4 safe-zone layout.

**Tech Stack:** Cocos Creator 3.8, TypeScript, PNG assets, Python/Pillow post-processing, existing Node-based tests and `tsc`.

---

## Files

- Create: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `assets/scripts/ui/BattleUiComponents.ts`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `assets/scripts/roguelike/UpgradeCardSystem.ts`
- Create: `tools/generate_commercial_ui_assets.py`
- Create: `tools/ui-layout-v4.test.ts`
- Modify: `package.json`
- Create: `assets/bundles/battle_common/battle_bg_sandgate_720x1280.png`
- Create: `assets/bundles/ui/ui_cards/card_bg_fire_final.png`
- Create: `assets/bundles/ui/ui_cards/card_bg_thunder_final.png`
- Create: `assets/bundles/ui/ui_cards/card_bg_summon_final.png`
- Create: `assets/bundles/ui/ui_cards/card_frame_legendary_final.png`
- Create: `assets/bundles/ui/ui_cards/card_selected_glow_final.png`
- Create: `assets/bundles/ui/ui_cards/card_panel_bg_final.png`
- Create: `assets/bundles/ui/ui_cards/card_panel_title_final.png`
- Create: `assets/bundles/ui/ui_hud/hud_right_action_button_final.png`
- Create: `assets/bundles/ui/ui_hud/hud_ultimate_button_final.png`
- Create: `assets/bundles/ui/ui_hud/hud_bottom_hero_bar_final.png`
- Create: `assets/bundles/ui/ui_hud/hud_tower_button_final.png`
- Create: `assets/bundles/ui/ui_hud/hud_oil_button_final.png`

## Task 1: Lock v4 Layout Constants

**Files:**
- Create: `assets/scripts/ui/BattleUiLayout.ts`
- Create: `tools/ui-layout-v4.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add layout constants**

Create `assets/scripts/ui/BattleUiLayout.ts`:

```ts
export interface RectSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const BattleUiDesign = {
  width: 720,
  height: 1280,
  halfWidth: 360,
  halfHeight: 640,
} as const;

function fromTopLeft(x: number, y: number, width: number, height: number): RectSpec {
  return {
    x: x - BattleUiDesign.halfWidth + width / 2,
    y: BattleUiDesign.halfHeight - y - height / 2,
    width,
    height,
  };
}

export const BattleUiV4Layout = {
  topHud: fromTopLeft(16, 16, 688, 87),
  battleArea: fromTopLeft(0, 102, 720, 768),
  cityHp: fromTopLeft(180, 835, 360, 40),
  towerButton: fromTopLeft(22, 820, 76, 90),
  oilButton: fromTopLeft(622, 820, 76, 90),
  upgradePanel: fromTopLeft(29, 922, 576, 198),
  rightActionRail: fromTopLeft(626, 922, 72, 326),
  autoButton: fromTopLeft(626, 979, 76, 76),
  heroBar: fromTopLeft(108, 1144, 439, 96),
  ultimateButton: fromTopLeft(576, 1134, 123, 123),
  bottomStatus: fromTopLeft(180, 1248, 360, 28),
} as const;

export function rectsOverlap(a: RectSpec, b: RectSpec): boolean {
  const ax0 = a.x - a.width / 2;
  const ax1 = a.x + a.width / 2;
  const ay0 = a.y - a.height / 2;
  const ay1 = a.y + a.height / 2;
  const bx0 = b.x - b.width / 2;
  const bx1 = b.x + b.width / 2;
  const by0 = b.y - b.height / 2;
  const by1 = b.y + b.height / 2;
  return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
}
```

- [ ] **Step 2: Add a layout overlap test**

Create `tools/ui-layout-v4.test.ts`:

```ts
import { BattleUiV4Layout, rectsOverlap } from '../assets/scripts/ui/BattleUiLayout';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main(): void {
  const layout = BattleUiV4Layout;
  assert(!rectsOverlap(layout.upgradePanel, layout.autoButton), 'auto button overlaps upgrade panel');
  assert(!rectsOverlap(layout.upgradePanel, layout.ultimateButton), 'ultimate button overlaps upgrade panel');
  assert(!rectsOverlap(layout.heroBar, layout.ultimateButton), 'ultimate button overlaps hero bar');
  assert(!rectsOverlap(layout.upgradePanel, layout.towerButton), 'tower button overlaps upgrade panel');
  assert(!rectsOverlap(layout.upgradePanel, layout.oilButton), 'oil button overlaps upgrade panel');
  console.log('pass: v4 UI safe zones do not overlap');
}

main();
```

- [ ] **Step 3: Add the script**

Add this script to `package.json`:

```json
"test:ui-layout": "tsx tools/ui-layout-v4.test.ts"
```

- [ ] **Step 4: Verify the test**

Run:

```bash
npm run test:ui-layout --silent
```

Expected output:

```text
pass: v4 UI safe zones do not overlap
```

## Task 2: Generate Workspace-Bound Commercial Assets

**Files:**
- Create: `tools/generate_commercial_ui_assets.py`
- Create/overwrite final PNG assets listed in the Files section.
- Modify: `assets/scripts/ui/UiArtManifest.ts`

- [ ] **Step 1: Generate the battlefield background with built-in image generation**

Use the reference image only as style guidance. Save the selected output to:

```text
assets/bundles/battle_common/battle_bg_sandgate_720x1280.png
```

Prompt:

```text
Use case: stylized-concept
Asset type: vertical mobile tower defense battle background
Primary request: 720x1280 polished commercial mobile game battlefield background for a lightweight legendary desert siege tower defense game.
Input images: reference image is style and layout reference only, do not copy characters or UI.
Scene/backdrop: desert city gate defense, stone wall across the lower-middle, ruined sandy battlefield above the wall, enemy tide depth in the distance, warm dramatic spotlight where a boss will stand.
Style/medium: high-end Chinese fantasy mobile game concept art, 2.5D angled top-down view, detailed but readable.
Composition/framing: reserve the top 8% for HUD, reserve y 72%-87.5% for upgrade cards, reserve the right edge for action buttons, leave no text in the image.
Lighting/mood: warm red-gold desert light, dramatic boss pressure, strong readability.
Color palette: dark sand brown base, red-gold highlights, restrained blue/green accent room for runtime effects.
Constraints: no UI text, no logos, no watermark, no visible copyrighted characters, no card panel, no buttons.
Avoid: blurry stock art, horizontal composition, text baked into the image, overly dark bottom area.
```

- [ ] **Step 2: Create deterministic final UI kit generator**

Create `tools/generate_commercial_ui_assets.py` with Pillow drawing helpers for nine-slice-ready panels, cards, buttons, and glows. The script must write exact filenames and sizes, then update `UiArtManifest.ts` entries for new assets using `uuid: null` so the runtime loader can fall back to bundle paths later if Cocos meta UUIDs are not available yet.

- [ ] **Step 3: Run the generator**

Run:

```bash
python3 tools/generate_commercial_ui_assets.py
```

Expected output:

```text
generated commercial ui assets
```

- [ ] **Step 4: Validate assets**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
from PIL import Image
paths = [
  'assets/bundles/battle_common/battle_bg_sandgate_720x1280.png',
  'assets/bundles/ui/ui_cards/card_bg_fire_final.png',
  'assets/bundles/ui/ui_cards/card_bg_thunder_final.png',
  'assets/bundles/ui/ui_cards/card_bg_summon_final.png',
  'assets/bundles/ui/ui_cards/card_panel_bg_final.png',
  'assets/bundles/ui/ui_hud/hud_ultimate_button_final.png',
]
for raw in paths:
    path = Path(raw)
    img = Image.open(path)
    assert img.width > 0 and img.height > 0, raw
    print(raw, img.size, img.mode)
PY
```

Expected: every listed asset prints a non-zero size.

## Task 3: Update Runtime Loaders For Final Assets

**Files:**
- Modify: `assets/scripts/ui/BattleUiComponents.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `assets/scripts/roguelike/UpgradeCardSystem.ts`

- [ ] **Step 1: Add bundle-path fallback for UI sprites**

Update `loadUiSpriteFrame` in `BattleUiComponents.ts` so if a manifest entry has no UUID, it attempts:

```ts
assetManager.loadBundle('ui', (bundleError, bundle) => {
  if (bundleError || !bundle) {
    done(null);
    return;
  }
  bundle.load(spec.path, SpriteFrame, (spriteError, frame) => {
    done(spriteError || !frame ? null : frame);
  });
});
```

- [ ] **Step 2: Add a battle background helper**

Add `createBundleSpriteNode(parent, bundleName, path, width, height, name)` in `BattleUiComponents.ts` using the same `assetManager.loadBundle(...).load(..., SpriteFrame)` pattern.

- [ ] **Step 3: Replace the programmatic battle backdrop**

In `BattleController.ts`, create a background sprite using:

```ts
createBundleSpriteNode(this.battleLayer, 'battle_common', 'battle_bg_sandgate_720x1280', 720, 1280, 'CommercialBattleBackground');
```

Keep existing Graphics fallback under the sprite so the preview still runs if the asset is unavailable.

- [ ] **Step 4: Apply v4 safe-zone positions**

Use `BattleUiV4Layout` constants for:

- Top HUD frame.
- Upgrade panel.
- Auto button.
- Hero avatar bar.
- Ultimate button.
- Tower and oil side buttons if currently represented.

## Task 4: Upgrade Card Text And Final Card Skins

**Files:**
- Modify: `assets/scripts/ui/BattleUiComponents.ts`
- Modify: `assets/scripts/roguelike/UpgradeCardSystem.ts`
- Modify: `assets/scripts/data/BattleConfig.ts`

- [ ] **Step 1: Switch card skins**

Map schools to final assets:

```ts
const finalCardSkins = {
  fire: 'card_bg_fire_final.png',
  thunder: 'card_bg_thunder_final.png',
  summon: 'card_bg_summon_final.png',
};
```

- [ ] **Step 2: Enforce fixed text grid**

Set card internal positions:

```text
title y +58, height 24
icon/art y +16, size 64
description y -34, height 36
stars y -68, height 18
tag y -88, height 20
```

- [ ] **Step 3: Use short commercial copy**

Update upgrade card display text to:

```ts
烈焰火墙+
连锁闪电+
召唤灵兽+
```

Descriptions should remain two short lines.

## Task 5: Verify In Cocos Preview

**Files:**
- No source file changes unless verification reveals an overlap bug.

- [ ] **Step 1: Run checks**

Run:

```bash
npm run typecheck --silent
npm run test:mvp --silent
npm run test:ui-layout --silent
```

Expected:

- Typecheck exits `0`.
- MVP tests pass.
- UI layout test prints `pass: v4 UI safe zones do not overlap`.

- [ ] **Step 2: Open Cocos preview**

Use the existing preview at:

```text
http://127.0.0.1:7456/
```

Reload with a cache-busting query string.

- [ ] **Step 3: Capture runtime screenshots**

Save screenshots under:

```text
docs/ui_art_generated/runtime_checks/commercial_ui_v4_idle.png
docs/ui_art_generated/runtime_checks/commercial_ui_v4_upgrade.png
```

Acceptance:

- Desert battlefield background is visible.
- Cards use final fire/thunder/summon skins.
- Auto and ultimate no longer overlap cards.
- Hero portraits do not overlap ultimate.
- Tower/oil side actions do not enter the card panel.
