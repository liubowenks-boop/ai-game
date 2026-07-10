# Player Attack Speed Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the main hero Spine attack duration configurable and dynamically proportional to the current gameplay attack-speed multiplier.

**Architecture:** `AnimationConfig` will expose the approved timing constants and a pure resolver that derives attack-speed multiplier, clamped animation duration, and Spine playback speed from the model's base and current attack intervals. `BattleController` will resolve timing at the start of each main attack, apply it to the animation runtime, and use the same timing for deterministic frame mapping and local glow progress. `BattleMvpModel` and `PlayerAutoAttackSystem` retain their current ownership and behavior.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `sp.Skeleton`, Node `tsx` tests, in-app browser preview.

---

## File Structure

- Modify: `assets/scripts/data/AnimationConfig.ts` - define timing constants, result type, and pure timing resolver.
- Modify: `assets/scripts/battle/BattleController.ts` - apply current attack speed to each Spine attack runtime.
- Modify: `tools/animation-system.test.ts` - cover timing math and controller integration.
- Verify: `tools/mvp-model.test.ts` - confirm gameplay attack cadence remains unchanged.
- Verify: `tools/spine-import.test.ts` - confirm imported Spine source duration and transparency remain valid.

### Task 1: Add the Dynamic Timing Resolver

**Files:**
- Modify: `tools/animation-system.test.ts`
- Modify: `assets/scripts/data/AnimationConfig.ts`

- [ ] **Step 1: Write the failing timing tests**

Extend the `AnimationConfig` import in `tools/animation-system.test.ts` with:

```ts
PLAYER_ATTACK_ANIMATION_BASE_DURATION,
PLAYER_ATTACK_ANIMATION_MIN_DURATION,
PLAYER_ATTACK_ANIMATION_MAX_DURATION,
resolvePlayerAttackAnimationTiming,
```

Replace the fixed `1.2` second readability test with:

```ts
runTest('main hero attack duration follows the gameplay attack-speed multiplier', () => {
  assert.equal(PLAYER_ATTACK_ANIMATION_BASE_DURATION, 0.7);
  assert.equal(PLAYER_ATTACK_ANIMATION_MIN_DURATION, 0.22);
  assert.equal(PLAYER_ATTACK_ANIMATION_MAX_DURATION, 1.4);

  const halfSpeed = resolvePlayerAttackAnimationTiming(0.7, 1.4);
  const baseSpeed = resolvePlayerAttackAnimationTiming(0.7, 0.7);
  const oneAndHalfSpeed = resolvePlayerAttackAnimationTiming(0.7, 0.7 / 1.5);
  const doubleSpeed = resolvePlayerAttackAnimationTiming(0.7, 0.35);
  const tripleSpeed = resolvePlayerAttackAnimationTiming(0.7, 0.7 / 3);

  assert.equal(halfSpeed.attackSpeedMultiplier, 0.5);
  assert.equal(halfSpeed.animationDuration, 1.4);
  assert.equal(baseSpeed.attackSpeedMultiplier, 1);
  assert.equal(baseSpeed.animationDuration, 0.7);
  assert.ok(Math.abs(oneAndHalfSpeed.animationDuration - 0.7 / 1.5) < 0.00001);
  assert.equal(doubleSpeed.attackSpeedMultiplier, 2);
  assert.equal(doubleSpeed.animationDuration, 0.35);
  assert.ok(Math.abs(tripleSpeed.animationDuration - 0.7 / 3) < 0.00001);
});

runTest('main hero attack timing clamps extremes and rejects invalid intervals', () => {
  assert.equal(resolvePlayerAttackAnimationTiming(0.7, 10).animationDuration, 1.4);
  assert.equal(resolvePlayerAttackAnimationTiming(0.7, 0.01).animationDuration, 0.22);
  assert.equal(resolvePlayerAttackAnimationTiming(0.7, 0).animationDuration, 0.7);
  assert.equal(resolvePlayerAttackAnimationTiming(0.7, Number.NaN).animationDuration, 0.7);
  assert.equal(resolvePlayerAttackAnimationTiming(-1, 0.7).animationDuration, 0.7);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:animation`

Expected: TypeScript execution fails because the new constants and resolver are not exported yet.

- [ ] **Step 3: Implement the timing constants and resolver**

In `assets/scripts/data/AnimationConfig.ts`, replace the fixed duration declarations with:

```ts
export const PLAYER_ATTACK_SPINE_SOURCE_DURATION = 2 / 3;
export const PLAYER_ATTACK_ANIMATION_BASE_DURATION = 0.7;
export const PLAYER_ATTACK_ANIMATION_MIN_DURATION = 0.22;
export const PLAYER_ATTACK_ANIMATION_MAX_DURATION = 1.4;
export const PLAYER_ATTACK_SPINE_DURATION = PLAYER_ATTACK_ANIMATION_BASE_DURATION;
export const PLAYER_ATTACK_SPINE_SPEED =
  PLAYER_ATTACK_SPINE_SOURCE_DURATION / PLAYER_ATTACK_ANIMATION_BASE_DURATION;

export interface PlayerAttackAnimationTiming {
  attackSpeedMultiplier: number;
  animationDuration: number;
  spinePlaybackSpeed: number;
}

export function resolvePlayerAttackAnimationTiming(
  baseAttackInterval: number,
  currentAttackInterval: number,
): PlayerAttackAnimationTiming {
  const safeBaseInterval =
    Number.isFinite(baseAttackInterval) && baseAttackInterval > 0
      ? baseAttackInterval
      : PLAYER_ATTACK_ANIMATION_BASE_DURATION;
  const safeCurrentInterval =
    Number.isFinite(currentAttackInterval) && currentAttackInterval > 0
      ? currentAttackInterval
      : safeBaseInterval;
  const attackSpeedMultiplier = safeBaseInterval / safeCurrentInterval;
  const unclampedDuration = PLAYER_ATTACK_ANIMATION_BASE_DURATION / attackSpeedMultiplier;
  const animationDuration = Math.min(
    PLAYER_ATTACK_ANIMATION_MAX_DURATION,
    Math.max(PLAYER_ATTACK_ANIMATION_MIN_DURATION, unclampedDuration),
  );

  return {
    attackSpeedMultiplier,
    animationDuration,
    spinePlaybackSpeed: PLAYER_ATTACK_SPINE_SOURCE_DURATION / animationDuration,
  };
}
```

Keep the player attack clip configured with `PLAYER_ATTACK_SPINE_DURATION` and `PLAYER_ATTACK_SPINE_SPEED`; these values represent the 1.0x baseline used when the runtime is created.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:animation`

Expected: both new timing tests pass, including all multiplier and clamp cases.

### Task 2: Apply Dynamic Timing to Each Main Attack

**Files:**
- Modify: `tools/animation-system.test.ts`
- Modify: `assets/scripts/battle/BattleController.ts`

- [ ] **Step 1: Write the failing controller integration test**

Add this source-contract test after the timing tests:

```ts
runTest('main hero applies current gameplay attack speed to each Spine cycle', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('resolvePlayerAttackAnimationTiming'), true);
  assert.equal(controllerSource.includes('this.model.options.mainAttackInterval'), true);
  assert.equal(controllerSource.includes('this.model.mainAttackInterval'), true);
  assert.equal(controllerSource.includes('this.playerAnimation.duration = timing.animationDuration'), true);
  assert.equal(controllerSource.includes('this.playerAttackSpinePlaybackSpeed = timing.spinePlaybackSpeed'), true);
  assert.equal(controllerSource.includes('this.playerAnimation.elapsed / this.playerAnimation.duration'), true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test:animation`

Expected: the new controller integration test fails because `BattleController` still uses fixed clip timing.

- [ ] **Step 3: Add the dynamic playback field and timing application**

Import `resolvePlayerAttackAnimationTiming` in `BattleController.ts` and add this field beside the other Spine fields:

```ts
private playerAttackSpinePlaybackSpeed = PLAYER_ATTACK_SPINE_SPEED;
```

In `requestPlayerAnimationFromResult`, after `requestUnitAnimation` succeeds and before `playPlayerAttackSpine`, apply the latest model timing:

```ts
const timing = resolvePlayerAttackAnimationTiming(
  this.model.options.mainAttackInterval,
  this.model.mainAttackInterval,
);
this.playerAnimation.duration = timing.animationDuration;
this.playerAttackSpinePlaybackSpeed = timing.spinePlaybackSpeed;
this.playPlayerAttackSpine();
```

- [ ] **Step 4: Use the dynamic duration for frame and local-effect progress**

Replace the fixed-duration progress in `drawPlayerAttackAccent` with:

```ts
const progress = Math.min(1, this.playerAnimation.elapsed / this.playerAnimation.duration);
```

Replace the fixed clip-speed calculation in `applyPlayerAttackSpineFrame` with:

```ts
const progress = Math.min(
  1,
  (this.playerAnimation.elapsed * this.playerAttackSpinePlaybackSpeed) /
    PLAYER_ATTACK_SPINE_SOURCE_DURATION,
);
```

This remains equivalent to `elapsed / animationDuration` while retaining the explicit Spine source-speed relationship.

- [ ] **Step 5: Run animation tests and verify GREEN**

Run: `npm run test:animation`

Expected: all animation tests pass, including dynamic controller integration and the existing rectangular-accent regression.

### Task 3: Verify Gameplay and Imported Assets Remain Stable

**Files:**
- Verify: `tools/mvp-model.test.ts`
- Verify: `tools/spine-import.test.ts`
- Verify: `assets/scripts/data/AnimationConfig.ts`
- Verify: `assets/scripts/battle/BattleController.ts`

- [ ] **Step 1: Run the complete automated verification set**

Run each command independently:

```bash
npm run test:animation
npm run test:mvp
npm run test:spine-import
npm run typecheck
git diff --check
```

Expected: every command exits with status 0; the gameplay attack cadence tests still use `mainAttackInterval`, the Spine import test still reports eight transparent atlas regions, and TypeScript reports no errors.

- [ ] **Step 2: Reload the Cocos preview**

Open or reload `http://127.0.0.1:7456/` in the in-app browser after Cocos recompiles the TypeScript changes.

Expected: the main hero remains visible with a transparent Spine texture, and browser logs contain no warnings or errors.

- [ ] **Step 3: Verify the default 1.0x attack cycle visually**

Start a wave and capture a main-hero attack frame.

Expected: one Spine attack completes in approximately `0.7` seconds, the local circular glow remains, no rectangular head stroke returns, and golden projectile/hit effects remain visible.

- [ ] **Step 4: Review the final diff**

Run: `git diff -- assets/scripts/data/AnimationConfig.ts assets/scripts/battle/BattleController.ts tools/animation-system.test.ts`

Expected: the diff contains only timing constants/resolver, dynamic controller timing, and focused tests; it does not modify `BattleMvpModel` or `PlayerAutoAttackSystem`.
