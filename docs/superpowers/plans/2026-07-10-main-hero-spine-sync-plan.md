# Main Hero Spine Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the main hero as a transparent, label-free Spine character and make one Spine cycle complete exactly with the existing 0.7 second main attack interval.

**Architecture:** `AnimationConfig` defines the gameplay-aligned Spine duration and playback rate. `BattleController` uses the Spine setup pose for idle, plays the calibrated animation for attacks, removes legacy placeholder nodes, and draws restrained local combat accents. The existing `PlayerAutoAttackSystem` remains the projectile and impact owner; its event cadence is unchanged.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `sp.Skeleton`, Node `tsx` tests, in-app browser preview.

---

## File Structure

- Modify: `assets/scripts/data/AnimationConfig.ts` - define the 0.7 second main-hero attack contract and calibrated Spine playback speed.
- Modify: `assets/scripts/battle/BattleController.ts` - replace the blue tile, portrait, and label with the static Spine setup pose; run the attack animation and local accents.
- Modify: `tools/animation-system.test.ts` - assert the timing contract and absence of legacy player visual creation.
- Verify: `tools/spine-import.test.ts` - retain the imported 12 fps source and transparent atlas checks.

### Task 1: Lock the Attack Timing Contract

**Files:**
- Modify: `tools/animation-system.test.ts:1-55`
- Modify: `assets/scripts/data/AnimationConfig.ts:40-44,140-151`

- [ ] **Step 1: Write the failing configuration test**

Add the constants to the existing `AnimationConfig` import and add this test directly after `main hero attack uses imported Spine animation asset`:

```ts
runTest('main hero attack maps one Spine cycle to the gameplay attack interval', () => {
  const attackClip = PLAYER_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'attack');

  assert.ok(attackClip, 'main hero profile should define an attack clip');
  assert.equal(attackClip.duration, 0.7);
  assert.equal(attackClip.speed, 20 / 21);
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `npm run test:animation`

Expected: the new test fails because the current duration is `2 / 3` and `speed` is undefined.

- [ ] **Step 3: Define the calibrated configuration**

Replace the current attack duration constant with the following constants:

```ts
export const PLAYER_ATTACK_SPINE_SOURCE_DURATION = 2 / 3;
export const PLAYER_ATTACK_SPINE_DURATION = 0.7;
export const PLAYER_ATTACK_SPINE_SPEED =
  PLAYER_ATTACK_SPINE_SOURCE_DURATION / PLAYER_ATTACK_SPINE_DURATION;
```

Pass the speed through the `attack` clip options:

```ts
clip('attack', PLAYER_ATTACK_SPINE_DURATION, false, PLAYER_ATTACK_SPINE_CLIP_NAME, {
  renderer: 'spine',
  spineAssetBase: PLAYER_ATTACK_SPINE_ASSET_BASE,
  speed: PLAYER_ATTACK_SPINE_SPEED,
}),
```

`20 / 21` is intentional: the imported animation is 0.6667 seconds at 12 fps, and the game attack interval is 0.7 seconds.

- [ ] **Step 4: Re-run the timing test**

Run: `npm run test:animation`

Expected: the timing-contract test passes and every existing animation-system test remains green.

- [ ] **Step 5: Commit the isolated timing change**

Run:

```bash
git add assets/scripts/data/AnimationConfig.ts tools/animation-system.test.ts
git commit -m "feat: sync main hero Spine attack cadence"
```

### Task 2: Replace the Placeholder with a Persistent Spine Hero

**Files:**
- Modify: `tools/animation-system.test.ts:1-80`
- Modify: `assets/scripts/battle/BattleController.ts:1-115,938-1118,1363-1410`

- [ ] **Step 1: Write the failing main-hero visual test**

Add this test after the timing test:

```ts
runTest('main hero renders a persistent Spine setup pose without placeholder UI', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes("?? new Node('MainHeroBody')"), false);
  assert.equal(controllerSource.includes("'portrait_hero_archer.png'"), false);
  assert.equal(controllerSource.includes("bindOrCreateLabel(player, 'MainHeroLabel'"), false);
  assert.equal(controllerSource.includes('showPlayerIdleSpine'), true);
  assert.equal(controllerSource.includes('setToSetupPose()'), true);
  assert.equal(controllerSource.includes('this.playerAttackSpine.timeScale = attackClip.speed ?? 1'), true);
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `npm run test:animation`

Expected: the visual test fails because `BattleController` still creates the body, portrait, and `MainHeroLabel` nodes.

- [ ] **Step 3: Remove the legacy player visual fields and creation path**

Delete `playerBodyNode`, `playerPortraitNode`, and `playerGraphics` fields. Remove `bindOrCreateUiArtSkinNode` from the `BattleUiComponents` import only if no other call remains after this change.

In `createPlayerNode`, remove the `MainHeroBody`, `MainHeroPortrait`, and `bindOrCreateLabel(... 'MainHeroLabel' ...)` blocks. Before creating the aura and Spine nodes, clean up stale children when a previously authored scene template is reused:

```ts
for (const nodeName of ['MainHeroBody', 'MainHeroPortrait', 'MainHeroLabel']) {
  player.getChildByName(nodeName)?.destroy();
}
```

Keep `MainHeroAura` and its `Graphics` component. It is responsible for the ground shadow and selection rings only.

- [ ] **Step 4: Keep the Spine visible outside attacks**

Add this method next to `playPlayerAttackSpine`:

```ts
private showPlayerIdleSpine(): void {
  if (!this.playerAttackSpineLoaded) {
    return;
  }

  this.playerAttackSpine.timeScale = 0;
  this.playerAttackSpine.setToSetupPose();
  this.playerAttackSpineNode.active = true;
}
```

After successful `resources.load`, call `showPlayerIdleSpine()` before checking `pendingPlayerAttackSpine`.

Change `playPlayerAttackSpine` so the calibrated config is applied before starting the track:

```ts
this.pendingPlayerAttackSpine = false;
this.playerAttackSpineNode.active = true;
this.playerAttackSpine.timeScale = attackClip.speed ?? 1;
this.playerAttackSpine.setAnimation(0, attackClip.clipName, attackClip.loop);
```

Extend the animation-config import so `BattleController` can use `PLAYER_ATTACK_SPINE_DURATION` for local effect timing.

Change `syncPlayerAttackSpineVisibility` to leave the node visible for attacks and call `showPlayerIdleSpine()` after the runtime returns to idle:

```ts
if (this.isPlayerAttackSpineActive()) {
  this.playerAttackSpineNode.active = true;
  return;
}

this.pendingPlayerAttackSpine = false;
this.showPlayerIdleSpine();
```

- [ ] **Step 5: Draw only the spatial support around the Spine character**

In `drawPlayerVisual`, calculate `useSpineAttack` before choosing a pose. Use a neutral transform during a Spine attack so the procedural attack punch does not distort the imported artwork:

```ts
const useSpineAttack = this.isPlayerAttackSpineActive();
const pose = useSpineAttack
  ? { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0 }
  : computeProceduralAnimationPose(this.playerAnimation.currentState, this.playerAnimation.elapsed, 'hero');
```

Delete the blue-body drawing code and the body/portrait active toggles. Always draw the ground shadow first, then retain the existing focus aura logic:

```ts
this.playerAuraGraphics.clear();
this.playerAuraGraphics.fillColor = new Color(0, 0, 0, 88);
this.playerAuraGraphics.ellipse(0, -40, 31, 9);
this.playerAuraGraphics.fill();
```

The existing ring strokes follow this shadow and must remain conditional on `highlightStrength > 0`.

- [ ] **Step 6: Re-run the visual contract test**

Run: `npm run test:animation`

Expected: the placeholder-removal test passes and the imported Spine asset test remains green.

- [ ] **Step 7: Commit the persistent Spine hero**

Run:

```bash
git add assets/scripts/battle/BattleController.ts tools/animation-system.test.ts
git commit -m "feat: render main hero as idle Spine character"
```

### Task 3: Add Restrained Attack Polish Without Changing Combat Cadence

**Files:**
- Modify: `tools/animation-system.test.ts:1-110`
- Modify: `assets/scripts/battle/BattleController.ts:70-110,938-1040,1363-1410`

- [ ] **Step 1: Write the failing attack-polish test**

Add this test after the persistent-Spine test:

```ts
runTest('main hero attack adds local glow and follow-through accents', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('MainHeroAttackEffects'), true);
  assert.equal(controllerSource.includes('drawPlayerAttackAccent'), true);
  assert.equal(controllerSource.includes('PLAYER_ATTACK_SPINE_DURATION'), true);
  assert.equal(controllerSource.includes('255, 154, 54'), true);
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run: `npm run test:animation`

Expected: the attack-polish test fails because the effects node and accent renderer do not exist.

- [ ] **Step 3: Create a dedicated local effects layer**

Add a `playerAttackEffectsGraphics: Graphics` field. In `createPlayerNode`, create `MainHeroAttackEffects` as a `Graphics` child of `MainHeroPrefab`, set it to the UI layer, and place it behind `MainHeroAttackSpine`:

```ts
const attackEffectsNode = player.getChildByName('MainHeroAttackEffects') ?? new Node('MainHeroAttackEffects');
this.setUiLayer(attackEffectsNode);
if (!attackEffectsNode.parent) {
  player.addChild(attackEffectsNode);
}
this.playerAttackEffectsGraphics = attackEffectsNode.getComponent(Graphics) ?? attackEffectsNode.addComponent(Graphics);
attackEffectsNode.setSiblingIndex(Math.max(0, player.children.length - 1));
```

After calling `createPlayerAttackSpineNode(player)`, set the Spine node to the last sibling so the character remains above the glow.

- [ ] **Step 4: Draw the wind-up glow, release bloom, and follow-through trail**

Add this method and call it from `drawPlayerVisual` only while `useSpineAttack` is true:

```ts
private drawPlayerAttackAccent(): void {
  const progress = Math.min(
    1,
    this.playerAnimation.elapsed / PLAYER_ATTACK_SPINE_DURATION,
  );
  const windup = Math.max(0, Math.min(1, progress / 0.3));
  const release = Math.max(0, 1 - Math.abs(progress - 0.46) / 0.2);
  const followThrough = Math.max(0, 1 - Math.abs(progress - 0.74) / 0.24);

  this.playerAttackEffectsGraphics.fillColor = new Color(255, 154, 54, Math.floor(48 * windup));
  this.playerAttackEffectsGraphics.circle(8, 20, 18 + windup * 14);
  this.playerAttackEffectsGraphics.fill();

  this.playerAttackEffectsGraphics.strokeColor = new Color(255, 224, 136, Math.floor(180 * release));
  this.playerAttackEffectsGraphics.lineWidth = 4 + release * 7;
  this.playerAttackEffectsGraphics.moveTo(-28, 18);
  this.playerAttackEffectsGraphics.lineTo(34, 58);
  this.playerAttackEffectsGraphics.stroke();

  this.playerAttackEffectsGraphics.strokeColor = new Color(255, 106, 38, Math.floor(92 * followThrough));
  this.playerAttackEffectsGraphics.lineWidth = 12;
  this.playerAttackEffectsGraphics.moveTo(-12, 2);
  this.playerAttackEffectsGraphics.lineTo(26, 34);
  this.playerAttackEffectsGraphics.stroke();
}
```

Clear `playerAttackEffectsGraphics` at the beginning of `drawPlayerVisual` before drawing the current frame.

- [ ] **Step 5: Re-run the attack-polish test**

Run: `npm run test:animation`

Expected: all animation-system tests pass, including the source-level effect assertions.

- [ ] **Step 6: Commit the visual polish**

Run:

```bash
git add assets/scripts/battle/BattleController.ts tools/animation-system.test.ts
git commit -m "feat: polish main hero Spine attack"
```

### Task 4: Full Verification and Preview

**Files:**
- Verify: `assets/resources/spine/animation/animation.json`
- Verify: `assets/resources/spine/animation/animation.png`
- Verify: `assets/scripts/battle/BattleController.ts`

- [ ] **Step 1: Run static checks**

Run:

```bash
npm run typecheck
npm run test:animation
npm run test:spine-import
```

Expected: all commands exit with status 0. The Spine import test reports 8 transparent atlas regions.

- [ ] **Step 2: Run the Cocos preview in the in-app browser**

Open the existing Cocos preview, start a battle, and capture frames covering idle, wind-up, release, and follow-through. Confirm all of the following from the rendered canvas:

- the blue square and `main hero` label are absent;
- the idle hero is the transparent Spine setup pose;
- a single Spine cycle completes before the next 0.7 second main attack begins;
- weapon glow and afterimage render behind the Spine character;
- the golden projectile and target impact remain visible;
- no white rectangle, console error, or warning appears.

- [ ] **Step 3: Report the visual result**

Provide a concise summary of the validated appearance and include the captured preview image in the handoff.
