# Enemy Remote Run Animation and Health Increase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every enemy use the pulled black-red monster atlas while running, keep the legacy portrait visible until that atlas is ready, and increase every default enemy archetype's health by 50%.

**Architecture:** `EnemyVideoPresentation` remains the sole owner of atlas loading, slicing, and animation-state-to-frame mapping; `EnemySystem` supplies its existing portrait as a loading/error fallback. The health increase stays centralized by changing `BattleMvpModel`'s default `enemyBaseHp` from 24 to 36, so all existing type and wave multipliers continue to apply exactly once.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `resources`/`SpriteFrame`, Node `assert`, `tsx` test scripts.

---

## File Map

- Modify `assets/scripts/battle/EnemyVideoPresentation.ts`: name the remote animation frame ranges and hide the fallback portrait only after the atlas is ready.
- Modify `assets/scripts/battle/EnemySystem.ts`: keep the legacy portrait active during asynchronous loading and pass it to `EnemyVideoPresentation`.
- Modify `assets/scripts/battle/BattleMvpModel.ts`: raise the centralized default enemy base health from 24 to 36.
- Modify `tools/animation-system.test.ts`: lock the atlas path, walk range, 24 FPS mapping, and loading fallback contract.
- Modify `tools/mvp-model.test.ts`: lock the 50% health increase for all five enemy archetypes and retain an eventual-kill pacing check.
- Preserve without staging `assets/scripts/ui/BattleHudConfig.ts`, `assets/scripts/ui/BattleHudView.ts`, and `tools/battle-hud-logic.test.ts`: these are the user's current HUD scaling changes.

### Task 1: Remote Running Animation With a Visible Loading Fallback

**Files:**
- Modify: `tools/animation-system.test.ts`
- Modify: `assets/scripts/battle/EnemyVideoPresentation.ts`
- Modify: `assets/scripts/battle/EnemySystem.ts`

- [x] **Step 1: Write the failing animation contract test**

Append this focused test before the final controller lifecycle test in `tools/animation-system.test.ts`:

```ts
runTest('enemy video uses the remote run frames and keeps a portrait until ready', () => {
  const videoSource = readFileSync(
    'assets/scripts/battle/EnemyVideoPresentation.ts',
    'utf8',
  );
  const enemySystemSource = readFileSync('assets/scripts/battle/EnemySystem.ts', 'utf8');

  assert.match(videoSource, /enemy_video\/black_red_monster_atlas\/texture/);
  assert.match(videoSource, /const SOURCE_FPS = 24/);
  assert.match(videoSource, /const WALK_FIRST_FRAME = 18/);
  assert.match(videoSource, /const WALK_LAST_FRAME = 44/);
  assert.match(
    videoSource,
    /loopingFrame\(\s*animation\.elapsed,\s*phase,\s*WALK_FIRST_FRAME,\s*WALK_LAST_FRAME,?\s*\)/s,
  );
  assert.match(videoSource, /private readonly fallbackNode: Node/);
  assert.match(videoSource, /this\.fallbackNode\.active = false/);
  assert.match(enemySystemSource, /portrait\.active = true/);
  assert.match(
    enemySystemSource,
    /new EnemyVideoPresentation\([\s\S]*?enemy\.kind === 'boss',[\s\S]*?portrait,?[\s\S]*?\)/,
  );
});
```

- [x] **Step 2: Run the animation test and verify the expected failure**

Run: `npm run test:animation`

Expected: FAIL because `WALK_FIRST_FRAME`, `WALK_LAST_FRAME`, `fallbackNode`, and `portrait.active = true` are not yet present.

- [x] **Step 3: Give the remote walk range explicit constants**

In `assets/scripts/battle/EnemyVideoPresentation.ts`, add:

```ts
const SOURCE_FPS = 24;
const WALK_FIRST_FRAME = 18;
const WALK_LAST_FRAME = 44;
const IDLE_FRAME = WALK_FIRST_FRAME;
```

Replace the walk state mapping with:

```ts
case 'walk':
  frameIndex = loopingFrame(
    animation.elapsed,
    phase,
    WALK_FIRST_FRAME,
    WALK_LAST_FRAME,
  );
  break;
```

- [x] **Step 4: Keep the legacy portrait until atlas frames are ready**

Change the constructor signature:

```ts
public constructor(
  parent: Node,
  setUiLayer: (node: Node) => void,
  isBoss: boolean,
  private readonly fallbackNode: Node,
) {
```

Change the successful atlas callback to:

```ts
loadSharedFrames((frames) => {
  if (!this.node.isValid) return;
  this.frames = frames;
  this.showFrame(IDLE_FRAME);
  this.fallbackNode.active = false;
});
```

The resource-load error branch must keep the existing warning and must not hide the fallback.

- [x] **Step 5: Pass the fallback portrait from EnemySystem**

In `assets/scripts/battle/EnemySystem.ts`, use:

```ts
portrait.active = true;
portrait.setSiblingIndex(1);

const video = new EnemyVideoPresentation(
  node,
  (child) => this.setUiLayer(child),
  enemy.kind === 'boss',
  portrait,
);
```

The video node remains sibling index 0, so the portrait covers it only while loading.

- [x] **Step 6: Run focused checks and verify green**

```bash
npm run test:animation
npm run typecheck
npx prettier --check assets/scripts/battle/EnemyVideoPresentation.ts assets/scripts/battle/EnemySystem.ts tools/animation-system.test.ts
git diff --check
```

Expected: all commands exit 0 and the new animation contract test passes.

- [x] **Step 7: Commit only the animation work**

```bash
git add assets/scripts/battle/EnemyVideoPresentation.ts assets/scripts/battle/EnemySystem.ts tools/animation-system.test.ts
git diff --cached --check
git commit -m "feat: use remote enemy run animation"
```

Expected: the commit excludes all three HUD scaling files.

### Task 2: Raise Every Default Enemy Archetype's Health by 50%

**Files:**
- Modify: `tools/mvp-model.test.ts`
- Modify: `assets/scripts/battle/BattleMvpModel.ts`

- [x] **Step 1: Write the failing health test**

Add before the default enemy tuning test in `tools/mvp-model.test.ts`:

```ts
runTest('all default enemy archetypes have fifty percent more health', () => {
  const model = new BattleMvpModel({ waveInterval: 99 });
  const expectedHealth = {
    normal: 32.4,
    fast: 21.6,
    tank: 64.8,
    ranged: 34.2,
    boss: 252,
  } as const;

  assert.equal(model.options.enemyBaseHp, 36);
  for (const [kind, expectedHp] of Object.entries(expectedHealth)) {
    const enemy = model.spawnEnemy({
      kind: kind as keyof typeof expectedHealth,
      speed: 0,
    });
    assert.ok(Math.abs(enemy.hp - expectedHp) < 0.000001, kind);
    assert.ok(Math.abs(enemy.maxHp - expectedHp) < 0.000001, kind);
  }
});
```

- [x] **Step 2: Run the model test and verify the expected failure**

Run: `npm run test:mvp`

Expected: FAIL with `24 !== 36` for the new base-health assertion.

- [x] **Step 3: Raise the central default base health**

In `assets/scripts/battle/BattleMvpModel.ts`, change only:

```ts
enemyBaseHp: 36,
```

Do not change `ENEMY_CONFIGS`, `spawnEnemy`, `spawnWaveEnemy`, early-wave scaling, or explicit `hp` overrides.

- [x] **Step 4: Update existing approved balance expectations**

In the default tuning test use:

```ts
assert.equal(model.options.enemyBaseHp, 36);
```

In the opening-wave pacing test replace the fixed third-pulse kill assertion with:

```ts
let killedEnemies = 0;
for (let pulse = 0; pulse < 8 && killedEnemies === 0; pulse += 1) {
  killedEnemies += model.tick(model.options.mainAttackInterval).killedEnemyIds.length;
}

assert.ok(killedEnemies >= 1);
```

Keep the first two pulse assertions unchanged so the opening wave remains durable rather than instantly defeated.

- [x] **Step 5: Run focused checks and verify green**

```bash
npm run test:mvp
npm run typecheck
npx prettier --check assets/scripts/battle/BattleMvpModel.ts tools/mvp-model.test.ts
git diff --check
```

Expected: all commands exit 0; all five archetype values pass and explicit `hp` fixtures remain unchanged.

- [x] **Step 6: Commit only the health work**

```bash
git add assets/scripts/battle/BattleMvpModel.ts tools/mvp-model.test.ts
git diff --cached --check
git commit -m "balance: increase enemy health by fifty percent"
```

Expected: the commit excludes all three HUD scaling files.

### Task 3: Integration Verification and Cocos Portrait Preview

**Files:**
- Verify: `assets/resources/enemy_video/black_red_monster_atlas.json`
- Verify: `assets/resources/enemy_video/black_red_monster_atlas.png`
- Preserve: `assets/scripts/ui/BattleHudConfig.ts`
- Preserve: `assets/scripts/ui/BattleHudView.ts`
- Preserve: `tools/battle-hud-logic.test.ts`

- [x] **Step 1: Run the full regression matrix**

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
npx prettier --check assets/scripts/battle/EnemyVideoPresentation.ts assets/scripts/battle/EnemySystem.ts assets/scripts/battle/BattleMvpModel.ts tools/animation-system.test.ts tools/mvp-model.test.ts
git diff --check
```

Expected: all commands exit 0 with no failed assertions or TypeScript errors.

- [x] **Step 2: Refresh the Cocos portrait preview**

Run: `npm run preview:portrait`

In Cocos Creator 3.8.8 choose `项目 → 刷新预览`, reload `http://127.0.0.1:7456/`, and wait for the 720×1280 canvas to stabilize.

Expected visual checks:

- New enemies show the legacy portrait only during initial atlas loading.
- Moving enemies continuously loop the pulled black-red run animation without blank frames.
- Multiple enemies do not run in perfect frame lock because their phase values differ.
- Normal base maximum health is 32.4 and Boss base maximum health is 252 before wave multipliers.
- The current HUD scaling changes still render and remain uncommitted.

- [x] **Step 3: Audit commits and working-tree boundaries**

```bash
git log -3 --oneline
git status --short
git diff --name-only --diff-filter=U
```

Expected: no unmerged files; the two implementation commits exclude the three pre-existing HUD scaling files.
