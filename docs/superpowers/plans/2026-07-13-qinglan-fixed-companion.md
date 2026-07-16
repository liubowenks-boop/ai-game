# Qinglan Fixed Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import `灵符道君·青岚` as the symmetric right-side fixed Spine companion, keep the battlefield at five characters, add a dedicated talisman projectile and impact preset, and raise waves 1-3 enemy HP by 15%.

**Architecture:** Convert the Thunder Mage-only companion path into a data-driven fixed-companion collection with independent model timers and reusable Spine presenters. Keep resource normalization, battle rules, Cocos presentation, and VFX registration in separate files so each layer can fail and be tested independently.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Spine 3.8 JSON/atlas, Node.js PNG tooling, tsx tests.

## Global Constraints

- Keep exactly five visible combatants: Thunder Mage, two ordinary heroes, main hero, and Qinglan.
- Keep Thunder Mage at `(-215, -205)` and place Qinglan at `(215, -205)`.
- Qinglan deals `8` base damage every `1.0` second and adds no status or splash damage.
- Qinglan uses Spine 3.8, eight frames, a one-second `attack` clip, and `displayScale: 0.255`.
- Waves 1-3 receive exactly `1.15` HP and max-HP scaling; wave 4 onward is unchanged.
- Reuse the existing VFX pool and global `BATTLE_VFX_HIT_VISUAL_SCALE = 0.7`.
- Do not add a sixth bottom HUD slot or permanent VFX nodes.

---

### Task 1: Normalize And Import Qinglan Spine

**Files:**
- Create: `tools/qinglan-spine-import.test.ts`
- Create: `tools/prepare-qinglan-alpha.mjs`
- Create: `assets/resources/spine/hero_qinglan.meta`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.json`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.json.meta`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.atlas`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.atlas.meta`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.png`
- Create: `assets/resources/spine/hero_qinglan/hero_qinglan.png.meta`
- Modify: `package.json`

**Interfaces:**
- Consumes: `/Users/hudaijin/Downloads/attack 3/attack 3.{json,atlas,png}`.
- Produces: resource base `spine/hero_qinglan/hero_qinglan`, clip `attack`, attachments `frame_0` through `frame_7`.

- [ ] **Step 1: Add the failing import test and package script**

Create assertions that require the normalized files, exact skeleton version, clip, regions, source duration, and transparent boundaries:

```ts
const assetDir = join(process.cwd(), 'assets/resources/spine/hero_qinglan');
for (const extension of ['json', 'atlas', 'png']) {
  assert.ok(existsSync(join(assetDir, `hero_qinglan.${extension}`)));
}
const skeleton = JSON.parse(readFileSync(join(assetDir, 'hero_qinglan.json'), 'utf8'));
assert.equal(skeleton.skeleton.spine, '3.8.75');
assert.deepEqual(Object.keys(skeleton.animations), ['attack']);
assert.deepEqual(attachmentNames(skeleton), [
  'frame_0', 'frame_1', 'frame_2', 'frame_3',
  'frame_4', 'frame_5', 'frame_6', 'frame_7',
]);
assert.equal(animationDuration(skeleton.animations.attack), 1);
assert.match(readFileSync(join(assetDir, 'hero_qinglan.atlas'), 'utf8'), /^hero_qinglan\.png/m);
for (const region of atlasRegions(join(assetDir, 'hero_qinglan.atlas'))) {
  assert.equal(image.alphaAt(region.x, region.y), 0);
  assert.equal(image.alphaAt(region.x + region.width - 1, region.y + region.height - 1), 0);
}
```

Add:

```json
"test:qinglan-import": "tsx tools/qinglan-spine-import.test.ts"
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:qinglan-import`

Expected: FAIL because `assets/resources/spine/hero_qinglan` does not exist.

- [ ] **Step 3: Implement deterministic resource preparation**

Copy `tools/prepare-thunder-mage-alpha.mjs` into a Qinglan-specific script and retain its guarded PNG decode, atlas-region flood fill, CRC validation, RGB-preservation assertion, and deterministic encoding. Use this CLI contract:

```text
node tools/prepare-qinglan-alpha.mjs <source.png> <atlas> <output.png>
```

Normalize the source files before preparation:

```ts
const sourceJson = JSON.parse(readFileSync('/Users/hudaijin/Downloads/attack 3/attack 3.json', 'utf8'));
const originalClip = Object.keys(sourceJson.animations)[0];
sourceJson.animations = { attack: sourceJson.animations[originalClip] };
writeFileSync('assets/resources/spine/hero_qinglan/hero_qinglan.json', `${JSON.stringify(sourceJson)}\n`);

const atlas = readFileSync('/Users/hudaijin/Downloads/attack 3/attack 3.atlas', 'utf8')
  .replace(/^attack 3\.png$/m, 'hero_qinglan.png');
writeFileSync('assets/resources/spine/hero_qinglan/hero_qinglan.atlas', atlas);
```

Generate Cocos metadata using unique UUIDs and the same importer schemas as `hero_thunder_mage`: `spine-data` for JSON, `*` for atlas, and `image` with `hasAlpha: true` for PNG.

- [ ] **Step 4: Run the import tests and verify GREEN**

Run:

```bash
npm run test:qinglan-import
npm run test:thunder-mage-import
npm run typecheck
```

Expected: all pass; the Qinglan test reports eight transparent atlas regions.

- [ ] **Step 5: Commit the normalized asset**

```bash
git add package.json tools/qinglan-spine-import.test.ts tools/prepare-qinglan-alpha.mjs assets/resources/spine/hero_qinglan.meta assets/resources/spine/hero_qinglan
git commit -m "feat: import qinglan spine animation"
```

---

### Task 2: Add Data-Driven Dual Fixed Companions And Five-Person Formation

**Files:**
- Modify: `assets/scripts/data/BattleTerrainConfig.ts`
- Modify: `assets/scripts/data/CompanionConfig.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`
- Modify: `assets/scripts/battle/GridPlacementSystem.ts`
- Modify: `assets/scripts/ui/BattleUiLayout.ts`
- Modify: `tools/mvp-model.test.ts`
- Modify: `tools/terrain-system.test.ts`
- Modify: `tools/ui-layout-v4.test.ts`
- Modify: `tools/battle-hud-polish.test.ts`

**Interfaces:**
- Produces: `FixedCompanionId`, `FixedCompanionAttackSource`, `FIXED_COMPANIONS`, `getFixedCompanions()`, and `getFixedCompanionAttackInterval(id)`.
- Preserves: `THUNDER_MAGE_COMPANION`, `getFixedCompanion()`, and `getCompanionAttackInterval()` as compatibility APIs.

- [ ] **Step 1: Write failing formation and Qinglan attack tests**

Assert the exact layout and configs:

```ts
assert.deepEqual(BATTLE_WALL_LAYOUT.thunderMage, { x: -215, y: -205 });
assert.deepEqual(BATTLE_WALL_LAYOUT.qinglan, { x: 215, y: -205 });
assert.deepEqual(BATTLE_WALL_LAYOUT.ordinarySlots, [
  { x: -120, y: -270 },
  { x: 120, y: -270 },
]);

const companions = model.getFixedCompanions();
assert.deepEqual(companions.map(({ id, name, slotIndex, attackDamage, attackInterval }) => ({
  id, name, slotIndex, attackDamage, attackInterval,
})), [
  { id: 'hero_thunder_mage', name: '雷法师', slotIndex: 2, attackDamage: 7, attackInterval: 0.85 },
  { id: 'hero_qinglan', name: '灵符道君·青岚', slotIndex: 3, attackDamage: 8, attackInterval: 1 },
]);
assert.equal(model.build.summon.maxBoardHeroes, 2);
assert.equal(model.placeHero(2, '弓手'), undefined);
assert.equal(model.placeHero(3, '弓手'), undefined);
```

Add a combat test with main, ordinary, and Thunder damage disabled. Spawn one stationary enemy, tick `0.01`, and assert one `qinglan_companion` event with damage `8`, Qinglan origin, and hero name `灵符道君·青岚`. Tick again before one second and assert no Qinglan event; tick through one second and assert the next event.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm run test:mvp
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
```

Expected: FAIL because Qinglan config and the second reserved slot do not exist.

- [ ] **Step 3: Add fixed-companion configuration**

Define:

```ts
export type FixedCompanionId = 'hero_thunder_mage' | 'hero_qinglan';
export type FixedCompanionAttackSource = 'companion' | 'qinglan_companion';

export interface FixedCompanionConfig {
  id: FixedCompanionId;
  name: '雷法师' | '灵符道君·青岚';
  description: string;
  slotIndex: 2 | 3;
  position: { x: number; y: number };
  attackSource: FixedCompanionAttackSource;
  attackDamage: number;
  attackInterval: number;
  displayScale: number;
  spineAssetBase: string;
  rootNodeName: string;
  spineNodeName: string;
}
```

Keep Thunder's values except `slotIndex: 2` and add:

```ts
export const QINGLAN_COMPANION: FixedCompanionConfig = {
  id: 'hero_qinglan',
  name: '灵符道君·青岚',
  description: '青岚灵符单体支援',
  slotIndex: 3,
  position: { ...BATTLE_WALL_LAYOUT.qinglan },
  attackSource: 'qinglan_companion',
  attackDamage: 8,
  attackInterval: 1,
  displayScale: 0.255,
  spineAssetBase: 'spine/hero_qinglan/hero_qinglan',
  rootNodeName: 'QinglanCompanion',
  spineNodeName: 'QinglanAttackSpine',
};
export const FIXED_COMPANIONS = [THUNDER_MAGE_COMPANION, QINGLAN_COMPANION] as const;
```

- [ ] **Step 4: Generalize model timers and reserved slots**

Extend `AttackEvent['source']` with `qinglan_companion`. Add `qinglanAttackDamage` and `qinglanAttackInterval` to `BattleMvpOptions` for deterministic tests, and initialize them from `QINGLAN_COMPANION`.

Store timers by id:

```ts
private readonly fixedCompanionAttackTimers: Record<FixedCompanionId, number> = {
  hero_thunder_mage: 0,
  hero_qinglan: 0,
};
```

Replace `tickCompanionAttack` with a loop over `FIXED_COMPANIONS`. Resolve each configured damage/interval, target `findEnemyClosestToCityWall()`, emit the configured source and origin, and update only that companion's timer. Reset both timers in `startBattle()`.

Create two ordinary slots and two reserved slots. Use adjacency `{ 0: [1], 1: [0], 2: [], 3: [] }`. Keep `reservedBy: 'fixed_companion'` and add `fixedCompanionId` to reserved slot state so presentation and tests can identify each reservation.

- [ ] **Step 5: Update Cocos placement and UI layout mappings**

Use these visual rects:

```ts
wallSlotThunderMage: fromCenter(-215, -205, 106, 106),
wallSlotOrdinary1: fromCenter(-120, -270, 106, 106),
mainHeroUnit: fromCenter(0, -250, 125, 146),
wallSlotOrdinary2: fromCenter(120, -270, 106, 106),
wallSlotQinglan: fromCenter(215, -205, 106, 106),
```

Map model slots `0/1/2/3` to ordinary-left, ordinary-right, Thunder, and Qinglan. Both fixed slots stay invisible and reject placement. Remove all references to `wallSlotOrdinary3`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the four focused commands from Step 2 plus `npm run typecheck`.

Expected: all pass with two ordinary slots, two fixed slots, and independent Qinglan attacks.

- [ ] **Step 7: Commit the model and formation**

```bash
git add assets/scripts/data/BattleTerrainConfig.ts assets/scripts/data/CompanionConfig.ts assets/scripts/battle/BattleMvpModel.ts assets/scripts/battle/GridPlacementSystem.ts assets/scripts/ui/BattleUiLayout.ts tools/mvp-model.test.ts tools/terrain-system.test.ts tools/ui-layout-v4.test.ts tools/battle-hud-polish.test.ts
git commit -m "feat: add qinglan fixed companion model"
```

---

### Task 3: Raise Waves 1-3 Health By Fifteen Percent

**Files:**
- Modify: `assets/scripts/battle/BattleMvpModel.ts`
- Modify: `tools/mvp-model.test.ts`

**Interfaces:**
- Produces: `EARLY_WAVE_HP_MULTIPLIER = 1.15` applied only by `spawnWaveEnemy()` when absolute wave number is 1, 2, or 3.

- [ ] **Step 1: Write the failing exact multiplier test**

Create two identical models with `enemyBaseHp: 100`. For each of waves 1-4, calculate expected HP from the existing kind multiplier and power formula. Assert wave 1-3 enemies equal `baseExpected * 1.15` and wave 4 equals `baseExpected`. Also assert `spawnEnemy({ kind: 'normal' })` remains `90`.

```ts
assert.equal(wave1[0].maxHp, 100 * 0.9 * 0.65 * 1.15);
assert.equal(wave2[0].maxHp, 100 * 0.9 * 0.7 * 1.15);
assert.equal(wave3[0].maxHp, 100 * 0.9 * 0.75 * 1.15);
assert.equal(wave4[0].maxHp, 100 * 1.8 * 0.8);
assert.equal(new BattleMvpModel({ enemyBaseHp: 100 }).spawnEnemy({ kind: 'normal' }).maxHp, 90);
```

- [ ] **Step 2: Run the model test and verify RED**

Run: `npm run test:mvp`

Expected: FAIL because waves 1-3 still use the unmodified HP formula.

- [ ] **Step 3: Implement the wave-only multiplier**

```ts
const EARLY_WAVE_HP_MULTIPLIER = 1.15;

private spawnWaveEnemy(kind: EnemyKind, x: number, power: number): EnemyState {
  const config = this.getEnemyConfig(kind);
  const earlyWaveHpMultiplier = this.wave >= 1 && this.wave <= 3
    ? EARLY_WAVE_HP_MULTIPLIER
    : 1;
  const hp = this.options.enemyBaseHp * config.hpMultiplier * power * earlyWaveHpMultiplier;
  // Keep speed, damage, and armor formulas unchanged.
}
```

- [ ] **Step 4: Run the model test and verify GREEN**

Run: `npm run test:mvp`

Expected: all model tests pass, including direct-spawn behavior.

- [ ] **Step 5: Commit the balance change**

```bash
git add assets/scripts/battle/BattleMvpModel.ts tools/mvp-model.test.ts
git commit -m "balance: raise early wave enemy health"
```

---

### Task 4: Generalize Fixed Spine Companion Presentation

**Files:**
- Create: `assets/scripts/battle/FixedCompanionPresentationLogic.ts`
- Create: `assets/scripts/battle/FixedCompanionPresentationLogic.ts.meta`
- Create: `assets/scripts/battle/FixedSpineCompanionPresentation.ts`
- Create: `assets/scripts/battle/FixedSpineCompanionPresentation.ts.meta`
- Modify: `assets/scripts/battle/ThunderMagePresentation.ts`
- Modify: `assets/scripts/battle/BattleController.ts`
- Modify: `assets/scripts/data/AnimationConfig.ts`
- Modify: `tools/animation-system.test.ts`
- Modify: `tools/terrain-system.test.ts`

**Interfaces:**
- Produces: `resolveFixedCompanionAttackAnimationTiming(interval, sourceDuration)`, `resolveFixedCompanionFrameIndex(elapsed, speed, sourceDuration)`, `FixedSpineCompanionPresentation`.
- Preserves: Thunder timing/frame exports as wrappers for existing callers.

- [ ] **Step 1: Write failing generic presentation tests**

Assert:

```ts
assert.equal(QINGLAN_ANIMATION_PROFILE.id, 'hero_qinglan');
assert.equal(getAnimationClipSpec(QINGLAN_ANIMATION_PROFILE, 'attack').clipName, 'attack');
assert.equal(resolveFixedCompanionAttackAnimationTiming(1, 1).animationDuration, 1);
assert.equal(resolveFixedCompanionFrameIndex(0.999, 1, 1), 7);
```

Source-contract assertions must require one `FixedSpineCompanionPresentation` class, one `resources.load` call in that class, per-config node names and display scale, `premultipliedAlpha = false`, frame-0 idle, dynamic frame attachments, and controller construction from `FIXED_COMPANIONS`. Assert the controller no longer owns a single `thunderMagePresentation` field.

- [ ] **Step 2: Run animation and terrain tests and verify RED**

Run:

```bash
npm run test:animation
npm run test:terrain
```

Expected: FAIL because generic presentation and Qinglan profile do not exist.

- [ ] **Step 3: Add generic timing and Qinglan profile**

Add:

```ts
export const QINGLAN_SPINE_SOURCE_DURATION = 1;
export const QINGLAN_ANIMATION_PROFILE: UnitAnimationProfile = fixedCompanionProfile(QINGLAN_COMPANION);

export function resolveFixedCompanionAttackAnimationTiming(
  currentInterval: number,
  sourceDuration = 1,
): FixedCompanionAttackAnimationTiming {
  const safeInterval = Number.isFinite(currentInterval) && currentInterval > 0 ? currentInterval : sourceDuration;
  const animationDuration = Math.min(1.2, Math.max(0.24, safeInterval));
  return { animationDuration, spinePlaybackSpeed: sourceDuration / animationDuration };
}
```

Have `resolveThunderMageAttackAnimationTiming()` delegate to the generic helper so existing behavior remains covered.

- [ ] **Step 4: Implement the reusable presenter**

Move node ownership, Spine loading, attack state, idle/attack frame attachment, duplicate cleanup, and warn-once loading from `ThunderMagePresentation` into `FixedSpineCompanionPresentation`. Its constructor receives:

```ts
constructor(
  unitParent: Node,
  setUiLayer: (node: Node) => void,
  battleVfx: BattleVfxSystem,
  companion: FixedCompanionConfig,
  animationProfile: UnitAnimationProfile,
)
```

Filter attack events by `event.source === companion.attackSource`. Key shared skeleton-load coordinators by `companion.spineAssetBase`, and key owners by root node. Keep gameplay VFX playback before checking whether Spine data loaded so animation failure cannot suppress attacks.

Reduce `ThunderMagePresentation` to a compatibility wrapper that calls the generic class with Thunder config/profile.

- [ ] **Step 5: Integrate both presenters in the controller**

Replace the single field with:

```ts
private readonly fixedCompanionPresentations: FixedSpineCompanionPresentation[] = [];
```

After VFX construction, instantiate one presenter for each config using a profile map keyed by fixed companion id. On every tick call each presenter's `handleTickResult(result, model.getFixedCompanionAttackInterval(id))`, call `update()` for all presenters, and call `clear()` for all on restart.

- [ ] **Step 6: Run animation, terrain, model, and type checks**

Run:

```bash
npm run test:animation
npm run test:terrain
npm run test:mvp
npm run typecheck
```

Expected: all pass, and Thunder remains compatible while Qinglan animates independently.

- [ ] **Step 7: Commit the generic presentation**

```bash
git add assets/scripts/battle/FixedCompanionPresentationLogic.ts assets/scripts/battle/FixedCompanionPresentationLogic.ts.meta assets/scripts/battle/FixedSpineCompanionPresentation.ts assets/scripts/battle/FixedSpineCompanionPresentation.ts.meta assets/scripts/battle/ThunderMagePresentation.ts assets/scripts/battle/BattleController.ts assets/scripts/data/AnimationConfig.ts tools/animation-system.test.ts tools/terrain-system.test.ts
git commit -m "refactor: generalize fixed companion presentation"
```

---

### Task 5: Add Qinglan Talisman Projectile And Impact Preset

**Files:**
- Create: `tools/extract-qinglan-talisman.mjs`
- Create: `assets/bundles/ui/battle_fx_common/fx_v4_qinglan_talisman.png`
- Create: `assets/bundles/ui/battle_fx_common/fx_v4_qinglan_talisman.png.meta`
- Modify: `assets/scripts/data/BattleVfxConfig.ts`
- Modify: `assets/scripts/battle/BattleVfxLogic.ts`
- Modify: `assets/scripts/ui/UiArtManifest.ts`
- Modify: `tools/generate_ui_art_assets.py`
- Modify: `tools/vfx-system.test.ts`

**Interfaces:**
- Produces: texture id `qinglanTalisman`, preset id `qinglan_talisman`, source routing from `qinglan_companion`.

- [ ] **Step 1: Write failing VFX routing and asset tests**

```ts
assert.equal(resolveAttackVfxPreset({ source: 'qinglan_companion' }).id, 'qinglan_talisman');
const qinglan = BATTLE_VFX_PRESETS.qinglan_talisman;
assert.equal(qinglan.projectileTexture, 'qinglanTalisman');
assert.equal(qinglan.impactTexture, 'poisonImpactV3');
assert.equal(qinglan.impactProfile, 'poison');
assert.equal(qinglan.travelSeconds, 0.42);
assert.equal(qinglan.particleCount, 58);
assert.equal(qinglan.criticalParticleCount, 118);
assert.equal(qinglan.impactLife, 0.58);
assert.equal(qinglan.presentationInterval, 1);
assert.equal(qinglan.projectileScale, 0.74);
assert.equal(qinglan.impactScale, 0.66);
```

Add `fx_v4_qinglan_talisman.png` at `128x256` to the authored texture map and require RGBA, transparent corners, transparent ratio over `0.65`, metadata, and a matching `UiArtManifest` entry.

- [ ] **Step 2: Run the VFX test and verify RED**

Run: `npm run test:vfx`

Expected: FAIL because the new source, texture, and preset are missing.

- [ ] **Step 3: Extract the transparent talisman projectile**

Implement a guarded PNG tool using the same CRC/filter decoder as the alpha preparation script. Crop local frame-0 rectangle `{ x: 44, y: 92, width: 70, height: 130 }` from atlas region `frame_0`, remove pixels with alpha below 16, scale the crop into a centered `128x256` transparent canvas with bilinear sampling, and encode deterministic RGBA PNG output.

CLI:

```text
node tools/extract-qinglan-talisman.mjs assets/resources/spine/hero_qinglan/hero_qinglan.png assets/resources/spine/hero_qinglan/hero_qinglan.atlas assets/bundles/ui/battle_fx_common/fx_v4_qinglan_talisman.png
```

Create Cocos image metadata with a unique UUID, linear filtering, `hasAlpha: true`, and no mip filtering. Register the asset in the generator source and generated `UiArtManifest`.

- [ ] **Step 4: Register and route the preset**

Add `qinglanTalisman` and `qinglan_talisman` to the unions and maps. Configure:

```ts
qinglan_talisman: preset(
  'qinglan_talisman',
  'qinglanTalisman',
  'poisonImpactV3',
  [74, 238, 170, 255],
  [238, 255, 198, 255],
  {
    impactProfile: 'poison',
    travelSeconds: 0.42,
    particleCount: 58,
    criticalParticleCount: 118,
    impactLife: 0.58,
    criticalLife: 0.84,
    presentationInterval: 1,
    projectileScale: 0.74,
    impactScale: 0.66,
    glowScale: 1.55,
    trailInterval: 0.026,
  },
),
```

Update the expected texture count from `15` to `16` and preset count from `10` to `11`. Add Qinglan to the exact impact-profile snapshot, raise the generic travel-time upper bound from `0.38` to `0.42`, and raise the presentation-interval upper bound from `0.85` to `1.0`; keep every exact assertion for existing presets unchanged.

- [ ] **Step 5: Run VFX, model, and type checks**

Run:

```bash
npm run test:vfx
npm run test:mvp
npm run typecheck
```

Expected: all pass and Qinglan resolves only to the jade talisman preset.

- [ ] **Step 6: Commit the VFX work**

```bash
git add tools/extract-qinglan-talisman.mjs assets/bundles/ui/battle_fx_common/fx_v4_qinglan_talisman.png assets/bundles/ui/battle_fx_common/fx_v4_qinglan_talisman.png.meta assets/scripts/data/BattleVfxConfig.ts assets/scripts/battle/BattleVfxLogic.ts assets/scripts/ui/UiArtManifest.ts tools/generate_ui_art_assets.py tools/vfx-system.test.ts
git commit -m "feat: add qinglan talisman combat effects"
```

---

### Task 6: Full Cocos Integration And Visual Verification

**Files:**
- Modify if required by Cocos import: metadata files created or refreshed for Qinglan assets.
- Verify: `http://localhost:7456/`.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a visually verified five-person battle with Qinglan attacking from the right.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm run typecheck
npm run test:mvp
npm run test:spine-import
npm run test:thunder-mage-import
npm run test:qinglan-import
npm run test:terrain
npm run test:ui-layout
npm run test:hud-polish
npm run test:scene
npm run test:animation
npm run test:vfx
git diff --check
```

Expected: every command exits 0 with no warnings or assertion failures.

- [ ] **Step 2: Refresh Cocos asset compilation**

Bring Cocos Creator to the foreground, wait until the preview chunks for `BattleController`, `BattleMvpModel`, and `BattleVfxConfig` have modification times newer than their source files, then reload the existing `http://localhost:7456/` tab.

- [ ] **Step 3: Verify the pre-battle formation visually**

Confirm Thunder Mage is at far left, Qinglan is at far right, their positions are symmetric, the main hero remains centered, there are two inner ordinary slots, no unit overlaps the wall or bottom HUD, and Qinglan has no white rectangular matte.

- [ ] **Step 4: Verify live attacks and runtime logs**

Start battle, observe at least two Qinglan attacks, and confirm the one-second animation cadence, jade talisman projectile, green rune impact, enemy damage, and independent Thunder attacks. Read browser warnings/errors and require an empty list.

- [ ] **Step 5: Commit any Cocos metadata refresh only when changed**

```bash
git status --short
git diff --check
```

If Cocos changed tracked metadata, inspect and commit only Qinglan/VFX-related metadata with `git commit -m "chore: finalize qinglan cocos metadata"`. Otherwise do not create an empty commit.
