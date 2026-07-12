# Thunder Mage Position And Hit VFX Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the thunder mage 20 px onto the wall walkway and reduce the complete enemy hit-effect composition to 70% of its current visual size.

**Architecture:** Keep wall placement centralized in `BattleTerrainConfig.ts` and mirrored by `BattleUiLayout.ts`. Add one exported impact-only scale constant in `BattleVfxConfig.ts`, then consume it at the main impact, shock ring, and particle size/spread sites in `BattleVfxSystem.ts`; source flashes and projectile rendering remain untouched.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Node/tsx assertion tests, in-app browser preview.

---

## File Map

- Modify `assets/scripts/data/BattleTerrainConfig.ts`: set the thunder mage world position to `y = -250`.
- Modify `assets/scripts/ui/BattleUiLayout.ts`: mirror the thunder mage visual slot at `y = -250`.
- Modify `assets/scripts/data/BattleVfxConfig.ts`: export the shared `0.7` hit visual scale.
- Modify `assets/scripts/battle/BattleVfxSystem.ts`: apply the scale only to resolved hit visuals.
- Modify `tools/terrain-system.test.ts`, `tools/ui-layout-v4.test.ts`, `tools/battle-hud-polish.test.ts`, and `tools/mvp-model.test.ts`: lock the staggered mage position while preserving all other wall positions.
- Modify `tools/vfx-system.test.ts`: lock the impact scale and its consumers while guarding source flash/projectile behavior.
- Create `docs/superpowers/verification/2026-07-12-thunder-mage-position-hit-vfx-scale.png`: final browser evidence.

## Task 1: Raise The Thunder Mage Wall Slot

**Files:**
- Modify: `tools/terrain-system.test.ts`
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/battle-hud-polish.test.ts`
- Modify: `tools/mvp-model.test.ts`
- Modify: `assets/scripts/data/BattleTerrainConfig.ts`
- Modify: `assets/scripts/ui/BattleUiLayout.ts`

- [ ] **Step 1: Write the failing position assertions**

Change only the thunder mage expectations to `-250`. Preserve `unitY`, ordinary slots, and main hero at `-270`:

```ts
assert.deepEqual(BATTLE_WALL_LAYOUT.thunderMage, { x: -240, y: -250 });
assert.equal(wallSlotThunderMage.y, -250);
assert.deepEqual(
  formation.map((rect) => rect.y),
  [-250, -270, -270, -270, -270],
);
assert.deepEqual(model.getFixedCompanion().position, { x: -240, y: -250 });
```

Update the reserved companion slot expectations in `battle-hud-polish.test.ts` and `mvp-model.test.ts` to the same coordinate. Do not alter ordinary slot or player expectations.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:mvp
```

Expected: each affected position assertion fails with actual `y = -270` and expected `y = -250`.

- [ ] **Step 3: Apply the minimal position change**

In `BattleTerrainConfig.ts`:

```ts
thunderMage: { x: -240, y: -250 },
```

In `BattleUiLayout.ts`:

```ts
wallSlotThunderMage: fromCenter(-240, -250, 106, 106),
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the four commands from Step 2. Expected: all pass, including the assertions that the main hero remains at `y = -270`.

## Task 2: Scale The Complete Hit Composition To 70%

**Files:**
- Modify: `tools/vfx-system.test.ts`
- Modify: `assets/scripts/data/BattleVfxConfig.ts`
- Modify: `assets/scripts/battle/BattleVfxSystem.ts`

- [ ] **Step 1: Write the failing impact-scale contract**

Import and assert the new configuration value:

```ts
import {
  BATTLE_VFX_HIT_VISUAL_SCALE,
  // existing imports
} from '../assets/scripts/data/BattleVfxConfig';

assert.equal(BATTLE_VFX_HIT_VISUAL_SCALE, 0.7);
```

Extend the runtime source assertions so the test requires the multiplier at the three impact branches:

```ts
assert.match(source, /preset\.impactScale \* BATTLE_VFX_HIT_VISUAL_SCALE/);
assert.match(source, /profile\.startSize \* BATTLE_VFX_HIT_VISUAL_SCALE/);
assert.match(source, /profile\.endSize \* BATTLE_VFX_HIT_VISUAL_SCALE/);
assert.match(source, /profile\.spread\[0\] \* BATTLE_VFX_HIT_VISUAL_SCALE/);
assert.match(
  source,
  /preset\.impactScale \* BATTLE_VFX_HIT_VISUAL_SCALE \* \(critical \? 0\.7 : 0\.56\)/,
);
assert.match(source, /preset\.impactScale \* 0\.72/);
```

The final assertion protects the source flash from the hit-only multiplier.

- [ ] **Step 2: Run the VFX test and verify RED**

Run:

```bash
npm run test:vfx
```

Expected: TypeScript reports that `BATTLE_VFX_HIT_VISUAL_SCALE` is not exported.

- [ ] **Step 3: Add the shared scale and apply it to impact visuals**

Export from `BattleVfxConfig.ts`:

```ts
export const BATTLE_VFX_HIT_VISUAL_SCALE = 0.7;
```

Import it in `BattleVfxSystem.ts`. Multiply the main impact and shock-ring base scales by it. Multiply particle `startSize`, `startSizeVar`, `endSize`, `endSizeVar`, and both `posVar` components by it so the burst body and emission footprint shrink together. Keep particle count, life, speed, colors, source flash scale, projectile scale, trail dimensions, damage, and timing unchanged.

- [ ] **Step 4: Run the VFX test and verify GREEN**

Run `npm run test:vfx`. Expected: all VFX assertions pass.

## Task 3: Regression And Browser Verification

**Files:**
- Create: `docs/superpowers/verification/2026-07-12-thunder-mage-position-hit-vfx-scale.png`

- [ ] **Step 1: Run static and full automated verification**

Run:

```bash
npm run typecheck
for script in test:mvp test:spine-import test:thunder-mage-import test:terrain test:ui-layout test:hud-polish test:scene test:animation test:vfx; do npm run "$script"; done
git diff --check
```

Expected: every command exits `0` with no TypeScript errors or whitespace errors.

- [ ] **Step 2: Refresh Cocos Creator and capture runtime evidence**

Open `http://localhost:7456/`, reload the preview, start combat, and capture a frame containing the wall formation and an enemy hit. Save it to the verification path above.

- [ ] **Step 3: Visually inspect the result**

Confirm all of the following:

- Thunder mage feet rest on the wall-top paving and are 20 px above the main hero baseline.
- Thunder mage and main hero do not overlap the city health bar or portrait rail.
- Main impact, glow, shock ring, and particle footprint are visibly smaller.
- Projectile size, projectile travel, source flash, attack timing, and damage presentation remain unchanged.
