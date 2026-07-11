# Fixed Thunder Mage Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the new Spine attack asset and add `雷法师` as a permanent, independently attacking companion at `后1`.

**Architecture:** `CompanionConfig.ts` owns immutable identity, combat, placement, and Spine constants. `BattleMvpModel` owns the reserved slot and deterministic attack timer. `ThunderMagePresentation.ts` owns the companion node, Spine lifecycle, frame mapping, and blue-white projectile effects; `BattleController` only connects tick results to that presentation.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Spine 3.8 JSON/atlas assets, Node `tsx` contract tests.

---

## File Map

- Create `assets/scripts/data/CompanionConfig.ts` - fixed Thunder Mage identity, combat tuning, position, and display constants.
- Create `assets/scripts/battle/ThunderMagePresentation.ts` - Spine loading/playback and companion lightning effects.
- Create `assets/resources/spine/hero_thunder_mage/*` - normalized Spine asset and Cocos metadata.
- Create `tools/thunder-mage-spine-import.test.ts` - asset integrity and transparency checks.
- Modify `assets/scripts/battle/BattleMvpModel.ts` - reserved slot, attack timer, attack event, and public interval/state accessors.
- Modify `assets/scripts/data/AnimationConfig.ts` - Thunder Mage profile and timing resolver.
- Modify `assets/scripts/battle/GridPlacementSystem.ts` - non-interactive reserved circle with no empty label.
- Modify `assets/scripts/battle/BattleController.ts` - create, update, trigger, and clear the presentation.
- Modify `tools/mvp-model.test.ts` - model behavior contracts.
- Modify `tools/animation-system.test.ts` - animation/presentation integration contracts.
- Modify `tools/battle-hud-polish.test.ts` - reserved-slot visual contract.
- Modify `package.json` and `README.md` - test script and asset documentation.

---

### Task 1: Normalize And Validate The Spine Asset

**Files:**
- Create: `assets/resources/spine/hero_thunder_mage/hero_thunder_mage.json`
- Create: `assets/resources/spine/hero_thunder_mage/hero_thunder_mage.atlas`
- Create: `assets/resources/spine/hero_thunder_mage/hero_thunder_mage.png`
- Create: `tools/thunder-mage-spine-import.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing asset-import test**

Create a test based on the structured JSON/atlas/PNG helpers in `tools/spine-import.test.ts`. Its final assertions must include:

```ts
const assetDir = join(root, 'assets/resources/spine/hero_thunder_mage');
const requiredFiles = [
  'hero_thunder_mage.json',
  'hero_thunder_mage.atlas',
  'hero_thunder_mage.png',
];

for (const fileName of requiredFiles) requireFile(join(assetDir, fileName));

const json = readJson(join(assetDir, 'hero_thunder_mage.json'));
assert.ok(json.skeleton?.spine?.startsWith('3.8.'));
assert.equal(json.skeleton?.images, './');
assert.deepEqual(Object.keys(json.animations ?? {}), ['attack']);
assert.deepEqual(attachmentNames(json), [
  'frame_0', 'frame_1', 'frame_2', 'frame_3',
  'frame_4', 'frame_5', 'frame_6', 'frame_7',
]);

const timeline = firstAttachmentTimeline(json.animations?.attack ?? {});
assert.deepEqual(timeline.map((key) => key.time ?? 0), [
  0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1,
]);
assert.equal(timeline.at(-1)?.name, 'frame_0');

const atlas = readFileSync(join(assetDir, 'hero_thunder_mage.atlas'), 'utf8');
assert.ok(atlas.includes('hero_thunder_mage.png'));
assert.equal(atlasRegions(join(assetDir, 'hero_thunder_mage.atlas')).length, 8);
```

Reuse the PNG decoder to assert that every atlas region has transparent corner samples. Also require `.meta` files after Cocos imports the assets.

- [ ] **Step 2: Add the test command and verify RED**

Add:

```json
"test:thunder-mage-import": "tsx tools/thunder-mage-spine-import.test.ts"
```

Run:

```bash
npm run test:thunder-mage-import
```

Expected: FAIL because `assets/resources/spine/hero_thunder_mage` does not exist.

- [ ] **Step 3: Copy and normalize the asset**

Copy the three source files, then apply these structured changes:

```ts
const sourceAnimationName = 'ChatGPT Image 2026年7月10日 15_04_52 (1)';
json.animations = { attack: json.animations[sourceAnimationName] };
json.skeleton.images = './';
```

Rename the atlas page line from `attack 2.png` to `hero_thunder_mage.png`. Do not alter attachment coordinates or image pixels.

- [ ] **Step 4: Let Cocos Creator import metadata**

Open or refresh the project in Cocos Creator 3.8.8 and wait until the asset database creates:

```text
assets/resources/spine/hero_thunder_mage.meta
assets/resources/spine/hero_thunder_mage/hero_thunder_mage.json.meta
assets/resources/spine/hero_thunder_mage/hero_thunder_mage.atlas.meta
assets/resources/spine/hero_thunder_mage/hero_thunder_mage.png.meta
```

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm run test:thunder-mage-import
npm run test:spine-import
git diff --check
```

Expected: both tests PASS.

Commit:

```bash
git add assets/resources/spine/hero_thunder_mage assets/resources/spine/hero_thunder_mage.meta tools/thunder-mage-spine-import.test.ts package.json
git commit -m "feat: import thunder mage Spine animation"
```

---

### Task 2: Add Fixed Companion Combat State

**Files:**
- Create: `assets/scripts/data/CompanionConfig.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`
- Modify: `tools/mvp-model.test.ts`

- [ ] **Step 1: Write failing identity and reservation tests**

Add tests:

```ts
runTest('thunder mage permanently reserves back slot one without using recruit capacity', () => {
  const model = new BattleMvpModel();
  const companion = model.getFixedCompanion();

  assert.equal(companion.name, '雷法师');
  assert.equal(companion.id, 'hero_thunder_mage');
  assert.equal(companion.slotIndex, 3);
  assert.deepEqual(companion.position, { x: -210, y: -410 });
  assert.equal(model.slots[3].reservedBy, 'fixed_companion');
  assert.equal(model.placeHero(3, '弓手'), undefined);

  assert.ok(model.placeHero(0, '弓手'));
  assert.ok(model.placeHero(1, '火药师'));
  assert.ok(model.placeHero(2, '冰法师'));
  assert.equal(model.getHeroes().length, 3);
});
```

- [ ] **Step 2: Write failing cadence and lifecycle tests**

```ts
runTest('thunder mage attacks independently and resets its timer on restart', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 7,
    companionAttackInterval: 0.6,
  });

  model.spawnEnemy({ hp: 100, speed: 0 });
  assert.equal(model.tick(1).attackEvents.length, 0);

  model.startBattle();
  const target = model.spawnEnemy({ hp: 100, speed: 0 });
  const first = model.tick(0.01);
  assert.equal(first.attackEvents[0].source, 'companion');
  assert.equal(model.findEnemy(target.id)?.hp, 93);
  assert.equal(model.tick(0.58).attackEvents.some((event) => event.source === 'companion'), false);
  assert.equal(model.tick(0.02).attackEvents.some((event) => event.source === 'companion'), true);

  model.startBattle();
  model.spawnEnemy({ hp: 100, speed: 0 });
  assert.equal(model.tick(0.01).attackEvents[0].source, 'companion');
});
```

Add a separate test that places `鼓手`, verifies `getCompanionAttackInterval()` is shorter than `0.6`, and verifies the companion emits an event at that shortened cadence.

- [ ] **Step 3: Run tests to verify RED**

Run:

```bash
npm run test:mvp
```

Expected: FAIL because the fixed companion API and attack event source do not exist.

- [ ] **Step 4: Add the immutable companion config**

Create:

```ts
export interface FixedCompanionConfig {
  id: 'hero_thunder_mage';
  name: '雷法师';
  description: string;
  slotIndex: 3;
  position: { x: number; y: number };
  attackDamage: number;
  attackInterval: number;
  displayScale: number;
  spineAssetBase: string;
}

export const THUNDER_MAGE_COMPANION: FixedCompanionConfig = {
  id: 'hero_thunder_mage',
  name: '雷法师',
  description: '雷电速攻支援',
  slotIndex: 3,
  position: { x: -210, y: -410 },
  attackDamage: 7,
  attackInterval: 0.6,
  displayScale: 0.22,
  spineAssetBase: 'spine/hero_thunder_mage/hero_thunder_mage',
};
```

- [ ] **Step 5: Implement reserved-slot and attack timing**

Extend the model contracts:

```ts
export interface GridSlotState {
  // existing fields
  reservedBy?: 'fixed_companion';
}

export interface AttackEvent {
  // existing fields
  source: 'main' | 'companion' | 'hero_dps' | 'burn' | 'poison' | 'thunder_chain';
}
```

Add `companionAttackDamage` and `companionAttackInterval` options with defaults from `THUNDER_MAGE_COMPANION`, a `companionAttackTimer`, and:

```ts
public getFixedCompanion(): FixedCompanionConfig {
  return { ...THUNDER_MAGE_COMPANION, position: { ...THUNDER_MAGE_COMPANION.position } };
}

public getCompanionAttackInterval(): number {
  const aura = Number.isFinite(this.getHeroAuraMultiplier())
    ? Math.max(0.1, this.getHeroAuraMultiplier())
    : 1;
  return this.options.companionAttackInterval / aura;
}

private tickCompanionAttack(deltaSeconds: number, result: BattleTickResult): void {
  this.companionAttackTimer -= deltaSeconds;
  if (this.companionAttackTimer > 0 || this.options.companionAttackDamage <= 0) return;

  const target = this.findNearestEnemy();
  if (!target) return;

  this.damageEnemy(target, this.options.companionAttackDamage, 'companion', result);
  this.companionAttackTimer += this.getCompanionAttackInterval();
}
```

Reset the timer to `0` in `startBattle()`, call `tickCompanionAttack()` after the main attack, mark slot `3` reserved, and reject reserved slots at the start of `placeHero()`.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm run test:mvp
npm run typecheck
git diff --check
```

Commit:

```bash
git add assets/scripts/data/CompanionConfig.ts assets/scripts/battle/BattleMvpModel.ts tools/mvp-model.test.ts
git commit -m "feat: add fixed thunder mage combat"
```

---

### Task 3: Define Thunder Mage Animation Timing

**Files:**
- Modify: `assets/scripts/data/AnimationConfig.ts`
- Modify: `tools/animation-system.test.ts`

- [ ] **Step 1: Write failing profile and timing tests**

```ts
runTest('thunder mage uses its one-second Spine attack at the combat interval', () => {
  const attack = THUNDER_MAGE_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'attack');
  assert.equal(attack?.renderer, 'spine');
  assert.equal(attack?.spineAssetBase, 'spine/hero_thunder_mage/hero_thunder_mage');
  assert.equal(attack?.clipName, 'attack');
  assert.equal(THUNDER_MAGE_SPINE_SOURCE_DURATION, 1);

  const base = resolveThunderMageAttackAnimationTiming(0.6);
  const fast = resolveThunderMageAttackAnimationTiming(0.3);
  assert.equal(base.animationDuration, 0.6);
  assert.equal(base.spinePlaybackSpeed, 1 / 0.6);
  assert.equal(fast.animationDuration, 0.3);
  assert.equal(fast.spinePlaybackSpeed, 1 / 0.3);
  assert.equal(resolveThunderMageAttackAnimationTiming(0.01).animationDuration, 0.25);
  assert.equal(resolveThunderMageAttackAnimationTiming(99).animationDuration, 1.2);
  assert.equal(resolveThunderMageAttackAnimationTiming(Number.NaN).animationDuration, 0.6);
});
```

- [ ] **Step 2: Run test to verify RED**

Run `npm run test:animation`.

Expected: FAIL because the profile and resolver are missing.

- [ ] **Step 3: Implement the profile and resolver**

Add exported constants:

```ts
export const THUNDER_MAGE_SPINE_SOURCE_DURATION = 1;
export const THUNDER_MAGE_ANIMATION_BASE_DURATION = 0.6;
export const THUNDER_MAGE_ANIMATION_MIN_DURATION = 0.25;
export const THUNDER_MAGE_ANIMATION_MAX_DURATION = 1.2;

export function resolveThunderMageAttackAnimationTiming(currentInterval: number) {
  const safeInterval = Number.isFinite(currentInterval) && currentInterval > 0
    ? currentInterval
    : THUNDER_MAGE_ANIMATION_BASE_DURATION;
  const animationDuration = Math.min(
    THUNDER_MAGE_ANIMATION_MAX_DURATION,
    Math.max(THUNDER_MAGE_ANIMATION_MIN_DURATION, safeInterval),
  );
  return {
    animationDuration,
    spinePlaybackSpeed: THUNDER_MAGE_SPINE_SOURCE_DURATION / animationDuration,
  };
}

export const THUNDER_MAGE_ANIMATION_PROFILE: UnitAnimationProfile = {
  id: 'hero_thunder_mage',
  displayName: '雷法师',
  subject: 'hero',
  renderer: 'spine',
  spineAssetBase: THUNDER_MAGE_COMPANION.spineAssetBase,
  clips: [
    clip('idle', 1, true, 'attack', {
      renderer: 'spine',
      spineAssetBase: THUNDER_MAGE_COMPANION.spineAssetBase,
      speed: 0,
    }),
    clip('attack', 0.6, false, 'attack', {
      renderer: 'spine',
      spineAssetBase: THUNDER_MAGE_COMPANION.spineAssetBase,
    }),
  ],
};
```

- [ ] **Step 4: Verify GREEN and commit**

Run `npm run test:animation && npm run typecheck && git diff --check`.

Commit:

```bash
git add assets/scripts/data/AnimationConfig.ts tools/animation-system.test.ts
git commit -m "feat: configure thunder mage animation timing"
```

---

### Task 4: Reserve The Visual Formation Slot

**Files:**
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Modify: `tools/battle-hud-polish.test.ts`

- [ ] **Step 1: Write failing reserved-slot source contracts**

```ts
runTest('fixed companion slot stays circular, unlabeled, and non-interactive', () => {
  const source = readFileSync('assets/scripts/battle/GridPlacementSystem.ts', 'utf8');
  assert.ok(source.includes("slot.reservedBy === 'fixed_companion'"));
  assert.ok(source.includes("return slot.hero || slot.reservedBy ? '' : slot.label;"));
  assert.ok(source.includes('button.interactable = !slot.reservedBy'));
});
```

- [ ] **Step 2: Run test to verify RED**

Run `npm run test:hud-polish`.

Expected: FAIL because `reservedBy` is not handled.

- [ ] **Step 3: Implement reserved rendering and input**

In slot creation, set the button non-interactive when reserved and return early from the click handler. Change the empty text helper to:

```ts
private getSlotText(slot: GridSlotState): string {
  return slot.hero || slot.reservedBy ? '' : slot.label;
}
```

Keep `drawSlotButton()` unchanged so the approved bronze circle remains visible behind the Spine artwork.

- [ ] **Step 4: Verify GREEN and commit**

Run `npm run test:hud-polish && npm run test:mvp && npm run typecheck`.

Commit:

```bash
git add assets/scripts/battle/GridPlacementSystem.ts tools/battle-hud-polish.test.ts
git commit -m "feat: reserve back slot for thunder mage"
```

---

### Task 5: Render Spine And Lightning Effects

**Files:**
- Create: `assets/scripts/battle/ThunderMagePresentation.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `tools/animation-system.test.ts`

- [ ] **Step 1: Write failing presentation contracts**

Add assertions that the new presentation:

```ts
const source = readFileSync('assets/scripts/battle/ThunderMagePresentation.ts', 'utf8');
const controller = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

assert.ok(source.includes("new Node('ThunderMageCompanion')"));
assert.ok(source.includes('node.setPosition(-210, -410, 0)'));
assert.ok(source.includes('spineNode.setScale(0.22, 0.22, 1)'));
assert.ok(source.includes('resources.load('));
assert.ok(source.includes('sp.SkeletonData'));
assert.ok(source.includes("setAttachment('frame', `frame_${frameIndex}`)"));
assert.ok(source.includes('const frameIndex = Math.min(7, Math.floor(progress * 8))'));
assert.ok(source.includes('new Color(118, 224, 255'));
assert.ok(source.includes('event.source === \'companion\''));
assert.ok(controller.includes('new ThunderMagePresentation('));
assert.ok(controller.includes('this.thunderMagePresentation.handleTickResult('));
assert.ok(controller.includes('this.thunderMagePresentation.update('));
assert.ok(controller.includes('this.thunderMagePresentation.clear()'));
```

Also retain all existing main-hero source contracts.

- [ ] **Step 2: Run test to verify RED**

Run `npm run test:animation`.

Expected: FAIL because the presentation file and controller wiring do not exist.

- [ ] **Step 3: Implement the focused presentation class**

The class API is:

```ts
export class ThunderMagePresentation {
  public constructor(parent: Node, setUiLayer: (node: Node) => void);
  public handleTickResult(result: BattleTickResult, actualAttackInterval: number): void;
  public update(deltaTime: number): void;
  public clear(): void;
}
```

Constructor behavior:

```ts
this.node = parent.getChildByName('ThunderMageCompanion') ?? new Node('ThunderMageCompanion');
setUiLayer(this.node);
this.node.setPosition(-210, -410, 0);

this.spineNode = new Node('ThunderMageAttackSpine');
this.spineNode.setScale(0.22, 0.22, 1);
this.spine = this.spineNode.addComponent(sp.Skeleton);
this.spine.premultipliedAlpha = false;
```

Load `THUNDER_MAGE_COMPANION.spineAssetBase` once. Hold `frame_0` after loading and after attacks. Ignore late callbacks when nodes are invalid.

For each `companion` event, create an attack runtime using the resolved actual interval, restart the Spine clip, and enqueue one projectile from `(-210, -370)` to `event.enemyPosition`.

During update:

```ts
const progress = Math.min(1, attackElapsed / attackDuration);
const sourceProgress = Math.min(
  1,
  (attackElapsed * spinePlaybackSpeed) / THUNDER_MAGE_SPINE_SOURCE_DURATION,
);
const frameIndex = Math.min(7, Math.floor(sourceProgress * 8));
this.spine.setAttachment('frame', `frame_${frameIndex}`);
```

Draw a narrow blue-white bolt and transparent circular hit burst with `Graphics`. Do not create any opaque rectangle or backing sprite.

- [ ] **Step 4: Wire the controller**

Create the presentation after `battleLayer` exists. In the tick result consumption path call:

```ts
this.thunderMagePresentation.handleTickResult(
  result,
  this.model.getCompanionAttackInterval(),
);
```

Update it with presentation delta every frame, and clear it when starting/restarting or clearing readability feedback.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm run test:animation
npm run test:mvp
npm run test:hud-polish
npm run typecheck
git diff --check
```

Commit:

```bash
git add assets/scripts/battle/ThunderMagePresentation.ts assets/scripts/battle/BattleController.ts tools/animation-system.test.ts
git commit -m "feat: render thunder mage companion attacks"
```

---

### Task 6: Documentation And End-To-End Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the fixed companion**

Add a concise section stating:

```markdown
### 固定副将：雷法师

- Spine 资源：`assets/resources/spine/hero_thunder_mage/`
- 固定阵位：`后1`
- 基础攻击：7 点伤害 / 0.6 秒
- 动画播放时长跟随实际攻速，普通英雄不能覆盖该阵位
```

Add `npm run test:thunder-mage-import` to the verification commands.

- [ ] **Step 2: Run the full automated suite**

Run independently:

```bash
npm run test:thunder-mage-import
npm run test:spine-import
npm run test:mvp
npm run test:animation
npm run test:hud-polish
npm run test:ui-layout
npm run test:scene
npm run typecheck
git diff --check
git status --short
```

Expected: all commands exit `0`; status contains only intentional README changes before commit.

- [ ] **Step 3: Verify in Cocos Creator 3.8.8**

Restart Cocos Creator to force a clean script/asset import, open `BattleMain.scene`, and run the portrait preview at `http://localhost:7456/`.

Verify the idle screen:

- Thunder Mage frame zero is visible over the bronze `后1` circle.
- `后1` empty text is absent.
- Character height is approximately `86px` and does not overlap the formation summary or portrait rail.
- Main hero remains at the center back position.

Start battle and capture at least one frame where both characters are attacking. Verify blue-white companion lightning remains distinct from the main hero's golden projectile and hit burst.

- [ ] **Step 4: Inspect logs and regressions**

Confirm the browser has no new error or warning logs. Attempt to recruit/place a hero into `后1` and confirm it is rejected without losing the pending recruit.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md
git commit -m "docs: document thunder mage companion"
```

---

## Final Review Checklist

- [ ] Spec requirements map to implemented tests and code.
- [ ] No source asset remains named `attack 2` inside project resources.
- [ ] No `TBD`, `TODO`, placeholder label, opaque debug rectangle, or duplicate Spine load remains.
- [ ] `后1` remains reserved after restart and upgrade choices.
- [ ] Main hero Spine timing and golden effects remain unchanged.
- [ ] Worktree is clean and the final reviewer reports no findings.
