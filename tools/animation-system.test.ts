import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as AnimationConfig from '../assets/scripts/data/AnimationConfig';
import { THUNDER_MAGE_COMPANION } from '../assets/scripts/data/CompanionConfig';
import {
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  resolveEnemyAnimationState,
  tickUnitAnimation,
} from '../assets/scripts/battle/UnitAnimationSystem';
import {
  ThunderMageSkeletonLoadCoordinator,
  advanceThunderMageProjectile,
  resolveThunderMageAttackFrameIndex,
} from '../assets/scripts/battle/ThunderMagePresentationLogic';

const {
  ENEMY_ANIMATION_PROFILES,
  HERO_ANIMATION_PROFILES,
  PLAYER_ATTACK_ANIMATION_BASE_DURATION,
  PLAYER_ATTACK_ANIMATION_MAX_DURATION,
  PLAYER_ATTACK_ANIMATION_MIN_DURATION,
  PLAYER_ANIMATION_PROFILE,
  REQUIRED_ENEMY_ANIMATION_STATES,
  REQUIRED_HERO_ANIMATION_STATES,
  SPINE_ASSET_REQUIREMENTS,
  THUNDER_MAGE_ANIMATION_PROFILE,
  THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION,
  THUNDER_MAGE_ATTACK_ANIMATION_MAX_DURATION,
  THUNDER_MAGE_ATTACK_ANIMATION_MIN_DURATION,
  resolveThunderMageAttackAnimationTiming,
  getEnemyAnimationProfile,
  getHeroAnimationProfile,
  resolvePlayerAttackAnimationTiming,
} = AnimationConfig;

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

runTest('animation profiles cover required hero and enemy states', () => {
  assert.deepEqual(SPINE_ASSET_REQUIREMENTS, ['.json/.skel', '.png', '.txt/.atlas']);

  for (const profile of Object.values(ENEMY_ANIMATION_PROFILES)) {
    for (const state of REQUIRED_ENEMY_ANIMATION_STATES) {
      assert.ok(
        profile.clips.some((clip) => clip.state === state),
        `${profile.id} missing ${state}`,
      );
    }
  }

  for (const profile of Object.values(HERO_ANIMATION_PROFILES)) {
    for (const state of REQUIRED_HERO_ANIMATION_STATES) {
      assert.ok(
        profile.clips.some((clip) => clip.state === state),
        `${profile.id} missing ${state}`,
      );
    }
  }

  assert.equal(
    getEnemyAnimationProfile('boss').clips.some((clip) => clip.state === 'boss_intro'),
    true,
  );
  assert.equal(
    getEnemyAnimationProfile('boss').clips.some((clip) => clip.state === 'boss_attack'),
    true,
  );
  assert.equal(getHeroAnimationProfile('弓手').id, 'hero_archer');
  assert.equal(
    PLAYER_ANIMATION_PROFILE.clips.some((clip) => clip.state === 'attack'),
    true,
  );
});

runTest('thunder mage attack timing clamps to the configured source duration', () => {
  assert.equal(THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION, 0.85);
  assert.equal(resolveThunderMageAttackAnimationTiming(0.85).spinePlaybackSpeed, 1 / 0.85);
  assert.ok(
    resolveThunderMageAttackAnimationTiming(0.5).spinePlaybackSpeed >
      resolveThunderMageAttackAnimationTiming(0.85).spinePlaybackSpeed,
  );
  assert.ok(
    resolveThunderMageAttackAnimationTiming(1.1).spinePlaybackSpeed <
      resolveThunderMageAttackAnimationTiming(0.85).spinePlaybackSpeed,
  );
  assert.equal(THUNDER_MAGE_ATTACK_ANIMATION_MIN_DURATION, 0.25);
  assert.equal(THUNDER_MAGE_ATTACK_ANIMATION_MAX_DURATION, 1.2);

  const base = resolveThunderMageAttackAnimationTiming(0.6);
  const fast = resolveThunderMageAttackAnimationTiming(0.3);
  const clampLow = resolveThunderMageAttackAnimationTiming(0.01);
  const clampHigh = resolveThunderMageAttackAnimationTiming(10);
  const fallbackZero = resolveThunderMageAttackAnimationTiming(0);
  const fallbackNegative = resolveThunderMageAttackAnimationTiming(-1);
  const fallbackNaN = resolveThunderMageAttackAnimationTiming(Number.NaN);
  const fallbackInfinity = resolveThunderMageAttackAnimationTiming(Number.POSITIVE_INFINITY);

  assert.equal(base.animationDuration, 0.6);
  assert.equal(base.spinePlaybackSpeed, 1 / 0.6);
  assert.equal(fast.animationDuration, 0.3);
  assert.equal(fast.spinePlaybackSpeed, 1 / 0.3);
  assert.equal(clampLow.animationDuration, 0.25);
  assert.equal(clampLow.spinePlaybackSpeed, 1 / 0.25);
  assert.equal(clampHigh.animationDuration, 1.2);
  assert.equal(clampHigh.spinePlaybackSpeed, 1 / 1.2);
  assert.equal(fallbackZero.animationDuration, 0.85);
  assert.equal(fallbackNegative.animationDuration, 0.85);
  assert.equal(fallbackNaN.animationDuration, 0.85);
  assert.equal(fallbackInfinity.animationDuration, 0.85);
});

runTest('thunder mage frame mapping clamps progress across frame 0 through 7', () => {
  assert.equal(resolveThunderMageAttackFrameIndex(0, 1, 1), 0);
  assert.equal(resolveThunderMageAttackFrameIndex(-1, 1, 1), 0);
  assert.equal(resolveThunderMageAttackFrameIndex(Number.NaN, 1, 1), 0);
  assert.equal(resolveThunderMageAttackFrameIndex(0, Number.POSITIVE_INFINITY, 1), 0);

  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    const elapsed = (frameIndex + 0.01) / 8;
    assert.equal(resolveThunderMageAttackFrameIndex(elapsed, 1, 1), frameIndex);
  }

  assert.equal(resolveThunderMageAttackFrameIndex(1, 1, 1), 7);
  assert.equal(resolveThunderMageAttackFrameIndex(10, 1, 1), 7);
});

runTest('thunder mage projectile advances once per delta and reports completion', () => {
  const firstStep = advanceThunderMageProjectile(0, 0.2, 0.1);
  assert.deepEqual(firstStep, { age: 0.1, complete: false });

  const finalStep = advanceThunderMageProjectile(firstStep.age, 0.2, 0.1);
  assert.deepEqual(finalStep, { age: 0.2, complete: true });
});

runTest('thunder mage shared skeleton loading broadcasts failure and retries later', () => {
  const coordinator = new ThunderMageSkeletonLoadCoordinator<{ id: string }>();
  const firstResults: string[] = [];
  let loadCalls = 0;
  let warningCalls = 0;
  let finishFirstLoad: ((error?: unknown, value?: { id: string }) => void) | undefined;

  coordinator.request(
    (complete) => {
      loadCalls += 1;
      finishFirstLoad = complete;
    },
    (result) => firstResults.push(result.state),
    () => {
      warningCalls += 1;
    },
  );
  coordinator.request(
    () => {
      loadCalls += 1;
    },
    (result) => firstResults.push(result.state),
    () => {
      warningCalls += 1;
    },
  );

  assert.equal(loadCalls, 1);
  assert.equal(coordinator.loadState, 'loading');
  finishFirstLoad?.(new Error('first load failed'));
  assert.deepEqual(firstResults, ['warned', 'warned']);
  assert.equal(warningCalls, 1);
  assert.equal(coordinator.loadState, 'idle');

  const retryResults: string[] = [];
  coordinator.request(
    (complete) => {
      loadCalls += 1;
      complete(undefined, { id: 'loaded-on-retry' });
    },
    (result) => retryResults.push(result.state),
    () => {
      warningCalls += 1;
    },
  );

  assert.equal(loadCalls, 2);
  assert.deepEqual(retryResults, ['loaded']);
  assert.equal(coordinator.loadState, 'loaded');
  assert.equal(warningCalls, 1);
});

runTest('thunder mage profile uses the portable attack Spine asset', () => {
  const idleClip = THUNDER_MAGE_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'idle');
  const attackClip = THUNDER_MAGE_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'attack');

  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.id, 'hero_thunder_mage');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.displayName, '雷法师');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.subject, 'hero');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.renderer, 'spine');
  assert.equal(
    THUNDER_MAGE_ANIMATION_PROFILE.spineAssetBase,
    THUNDER_MAGE_COMPANION.spineAssetBase,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(HERO_ANIMATION_PROFILES, '雷法师'), false);
  assert.ok(idleClip, 'thunder mage should define an idle clip');
  assert.ok(attackClip, 'thunder mage should define an attack clip');
  assert.equal(idleClip?.duration, 1);
  assert.equal(idleClip?.loop, true);
  assert.equal(idleClip?.clipName, 'attack');
  assert.equal(idleClip?.renderer, 'spine');
  assert.equal(idleClip?.spineAssetBase, THUNDER_MAGE_COMPANION.spineAssetBase);
  assert.equal(idleClip?.speed, 0);
  assert.equal(attackClip?.clipName, 'attack');
  assert.equal(attackClip?.loop, false);
  assert.equal(attackClip?.duration, 0.85);
  assert.equal(attackClip?.renderer, 'spine');
  assert.equal(attackClip?.spineAssetBase, THUNDER_MAGE_COMPANION.spineAssetBase);
});

runTest('main hero attack uses imported Spine animation asset', () => {
  const attackClip = PLAYER_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'attack');
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.ok(attackClip, 'main hero profile should define an attack clip');
  assert.equal(attackClip.renderer, 'spine');
  assert.equal(attackClip.spineAssetBase, 'spine/animation/animation');
  assert.equal(attackClip.clipName, 'attack');
  assert.equal(attackClip.duration, 0.7);
  assert.equal(controllerSource.includes('resources.load('), true);
  assert.equal(controllerSource.includes('sp.SkeletonData'), true);
  assert.equal(controllerSource.includes('playPlayerAttackSpine'), true);
  assert.equal(controllerSource.includes('MainHeroAttackSpine'), true);
});

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

runTest('main hero applies current gameplay attack speed to each Spine cycle', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('resolvePlayerAttackAnimationTiming'), true);
  assert.equal(controllerSource.includes('this.model.options.mainAttackInterval'), true);
  assert.equal(controllerSource.includes('this.model.mainAttackInterval'), true);
  assert.equal(
    controllerSource.includes('this.playerAnimation.duration = timing.animationDuration'),
    true,
  );
  assert.equal(
    controllerSource.includes('this.playerAttackSpinePlaybackSpeed = timing.spinePlaybackSpeed'),
    true,
  );
});

runTest('main hero does not restart Spine playback before the current attack completes', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('!this.isPlayerAttackInProgress()'), true);
  assert.equal(controllerSource.includes('private isPlayerAttackInProgress(): boolean'), true);
});

runTest('main hero attack presentation survives long simulation frames', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(
    controllerSource.includes('const presentationDelta = Math.min(deltaTime, 1 / 30);'),
    true,
  );
  assert.equal(controllerSource.includes('private applyPlayerAttackSpineFrame(): void'), true);
  assert.equal(controllerSource.includes('this.applyPlayerAttackSpineFrame();'), true);
});

runTest('main hero resumes a cleared Spine track for each attack', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('this.playerAttackSpine.paused = true'), true);
  assert.equal(controllerSource.includes('this.playerAttackSpine.clearTracks()'), true);
});

runTest('main hero maps the Spine attack slot across all source frames', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(
    controllerSource.includes(
      "this.playerAttackSpine.setAttachment('frame', `frame_${frameIndex}`);",
    ),
    true,
  );
  assert.equal(
    controllerSource.includes('const frameIndex = Math.min(7, Math.floor(progress * 8));'),
    true,
  );
});

runTest('main hero renders a persistent Spine setup pose without placeholder UI', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes("?? new Node('MainHeroBody')"), false);
  assert.equal(controllerSource.includes("'portrait_hero_archer.png'"), false);
  assert.equal(controllerSource.includes("bindOrCreateLabel(player, 'MainHeroLabel'"), false);
  assert.equal(controllerSource.includes('showPlayerIdleSpine'), true);
  assert.equal(controllerSource.includes('setToSetupPose()'), true);
  assert.equal(controllerSource.includes('this.playerAttackSpine.setAttachment'), true);
});

runTest('main hero attack leaves round accents to the shared vfx layer', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes("new Node('MainHeroAttackEffects')"), false);
  assert.equal(controllerSource.includes('drawPlayerAttackAccent'), false);
  assert.equal(controllerSource.includes('playerAttackEffectsGraphics'), false);
  assert.equal(controllerSource.includes('PLAYER_ATTACK_SPINE_DURATION'), false);
  assert.equal(controllerSource.includes('this.playerAuraGraphics.circle('), false);
  assert.equal(controllerSource.includes('this.playerAuraGraphics.ellipse('), false);
});

runTest('battle layer remains scale-stable during focus readability events', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('pulseScale'), false);
  assert.equal(controllerSource.includes('Math.sin(progress * Math.PI) * 0.035'), false);
  assert.equal(controllerSource.includes('this.battleLayer.setScale(scale, scale, 1);'), false);
});

runTest('animation priority allows hit over walk but protects death', () => {
  const runtime = createUnitAnimationRuntime('enemy_normal');

  assert.equal(runtime.currentState, 'idle');
  assert.equal(requestUnitAnimation(runtime, 'walk'), true);
  assert.equal(runtime.currentState, 'walk');
  assert.equal(requestUnitAnimation(runtime, 'hit'), true);
  assert.equal(runtime.currentState, 'hit');
  assert.equal(requestUnitAnimation(runtime, 'walk'), false);
  assert.equal(runtime.currentState, 'hit');
  assert.equal(requestUnitAnimation(runtime, 'death'), true);
  assert.equal(runtime.currentState, 'death');
  assert.equal(requestUnitAnimation(runtime, 'hit'), false);
  assert.equal(runtime.currentState, 'death');
});

runTest('procedural animation poses make attack hit death visually distinct', () => {
  const idle = computeProceduralAnimationPose('idle', 0.2, 'hero');
  const attack = computeProceduralAnimationPose('attack', 0.08, 'hero');
  const hit = computeProceduralAnimationPose('hit', 0.04, 'enemy');
  const death = computeProceduralAnimationPose('death', 0.3, 'enemy');

  assert.ok(attack.scaleX > idle.scaleX, 'attack should lunge wider than idle');
  assert.ok(hit.scaleX > 1, 'hit should briefly pop larger');
  assert.ok(death.scaleY < 1, 'death should collapse vertically');
  assert.ok(death.offsetY < idle.offsetY, 'death should sink toward the ground');
});

runTest('enemy animation resolver maps wall hold damage and boss spawn states', () => {
  const walkingEnemy = {
    kind: 'normal',
    alive: true,
    hp: 10,
    maxHp: 10,
    speed: 30,
    position: { x: 0, y: 10 },
    wallHoldTimeLeft: 0,
  };

  assert.equal(
    resolveEnemyAnimationState(walkingEnemy, { previousHp: 10, newlySpawned: false }),
    'walk',
  );
  assert.equal(resolveEnemyAnimationState({ ...walkingEnemy, hp: 8 }, { previousHp: 10 }), 'hit');
  assert.equal(
    resolveEnemyAnimationState(
      { ...walkingEnemy, position: { x: 0, y: -210 }, wallHoldTimeLeft: 2 },
      { previousHp: 10 },
    ),
    'attack_city',
  );
  assert.equal(
    resolveEnemyAnimationState({ ...walkingEnemy, kind: 'boss' }, { newlySpawned: true }),
    'boss_intro',
  );
  assert.equal(resolveEnemyAnimationState({ ...walkingEnemy, alive: false, hp: 0 }, {}), 'death');
});

runTest('finite animation runtime completes non-looping clips', () => {
  const runtime = createUnitAnimationRuntime('hero_archer');

  requestUnitAnimation(runtime, 'attack');
  tickUnitAnimation(runtime, 0.12);
  assert.equal(isUnitAnimationComplete(runtime), false);
  tickUnitAnimation(runtime, runtime.duration);
  assert.equal(isUnitAnimationComplete(runtime), true);
});

runTest('battle presentation systems call the shared animation driver', () => {
  const enemySource = readFileSync('assets/scripts/battle/EnemySystem.ts', 'utf8');
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');
  const gridSource = readFileSync('assets/scripts/battle/GridPlacementSystem.ts', 'utf8');

  assert.equal(enemySource.includes('resolveEnemyAnimationState'), true);
  assert.equal(enemySource.includes("requestUnitAnimation(view.animation, 'death')"), true);
  assert.equal(controllerSource.includes('requestPlayerAnimationFromResult'), true);
  assert.equal(controllerSource.includes('updatePlayerAnimation'), true);
  assert.equal(gridSource.includes('updateAnimations(deltaSeconds'), true);
  assert.equal(gridSource.includes('getHeroAnimationProfile'), true);
  assert.equal(gridSource.includes('computeProceduralAnimationPose'), true);
});

runTest('player attack adapter routes main and thunder chain events to shared vfx', () => {
  const autoAttackSource = readFileSync('assets/scripts/battle/PlayerAutoAttackSystem.ts', 'utf8');

  assert.equal(autoAttackSource.includes('BattleVfxSystem'), true);
  assert.equal(autoAttackSource.includes("event.source === 'main'"), true);
  assert.equal(autoAttackSource.includes("event.source === 'thunder_chain'"), true);
  assert.equal(autoAttackSource.includes('this.battleVfx.playAttackEvent(event)'), true);
  assert.equal(autoAttackSource.includes('ParticleSystem2D'), false);
  assert.equal(autoAttackSource.includes('Graphics'), false);
  assert.equal(autoAttackSource.includes('assetManager'), false);
});

runTest('thunder mage presentation owns its spine and delegates electric effects', () => {
  assert.equal(THUNDER_MAGE_COMPANION.displayScale, 0.286);
  const presentationSource = readFileSync(
    'assets/scripts/battle/ThunderMagePresentation.ts',
    'utf8',
  );

  assert.equal(presentationSource.includes('THUNDER_MAGE_ANIMATION_PROFILE'), true);
  assert.equal(presentationSource.includes('getAnimationClipSpec'), true);
  assert.equal(presentationSource.includes('resolveThunderMageAttackAnimationTiming'), true);
  assert.equal(
    presentationSource.includes("unitParent.getChildByName('ThunderMageCompanion')"),
    true,
  );
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.position.x'), true);
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.position.y'), true);
  assert.equal(
    presentationSource.includes("this.rootNode.getChildByName('ThunderMageAttackSpine')"),
    true,
  );
  assert.equal(presentationSource.includes('BattleVfxSystem'), true);
  assert.equal(presentationSource.includes('this.battleVfx.playAttackEvent(event)'), true);
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.displayScale'), true);
  assert.equal(presentationSource.includes('premultipliedAlpha = false'), true);
  assert.equal(
    presentationSource.includes('resources.load(attackClip.spineAssetBase, sp.SkeletonData'),
    true,
  );
  assert.equal(presentationSource.includes("event.source === 'companion'"), true);
  assert.equal(presentationSource.includes('loading'), true);
  assert.equal(presentationSource.includes('loaded'), true);
  assert.equal(presentationSource.includes('warned'), true);
  assert.equal(presentationSource.includes('console.warn'), true);
  assert.equal(presentationSource.includes("setAttachment('frame', 'frame_0')"), true);
  assert.equal(presentationSource.includes("setAttachment('frame', `frame_${frameIndex}`)"), true);
  assert.equal(presentationSource.includes('resolveThunderMageAttackFrameIndex'), true);
  assert.equal(presentationSource.includes('advanceThunderMageProjectile'), false);
  assert.equal(presentationSource.includes('Graphics'), false);
  assert.equal(presentationSource.includes('projectiles'), false);
  assert.equal(presentationSource.includes('roundRect('), false);
  assert.equal(presentationSource.includes('fillRect('), false);
  assert.equal(presentationSource.includes('Sprite'), false);
});

runTest('thunder mage presentation reuses nodes and shares one skeleton load', () => {
  const presentationSource = readFileSync(
    'assets/scripts/battle/ThunderMagePresentation.ts',
    'utf8',
  );
  const resourceLoadCalls = presentationSource.match(/resources\.load\(/g) ?? [];
  const clearSource = presentationSource.slice(
    presentationSource.indexOf('public clear(): void'),
    presentationSource.indexOf('private ensureSkeletonLoaded(): void'),
  );

  assert.equal(presentationSource.includes('new Vec3(-210, -370, 0)'), false);
  assert.equal(presentationSource.includes('THUNDER_MAGE_STAFF_OFFSET'), false);
  assert.equal(presentationSource.includes('ThunderMageBronzeRing'), false);
  assert.equal(presentationSource.includes('drawBronzeRing'), false);
  assert.equal(presentationSource.includes('THUNDER_MAGE_RING_'), false);
  assert.equal(presentationSource.includes('ThunderMageSkeletonLoadCoordinator'), true);
  assert.equal(presentationSource.includes("result.state === 'warned'"), true);
  assert.equal(presentationSource.includes("this.loadState = 'warned'"), true);
  assert.equal(presentationSource.includes('projectile.age += deltaTime'), false);
  assert.equal(presentationSource.includes('thunderMagePresentationOwners'), true);
  assert.equal(presentationSource.includes('removeDuplicateNamedChildren'), true);
  assert.equal(presentationSource.includes('if (!this.attackSpineNode.parent)'), true);
  assert.equal(clearSource.includes("if (this.loadState === 'warned')"), true);
  assert.equal(clearSource.includes("this.loadState = 'idle'"), true);
  assert.equal(clearSource.includes('this.ensureSkeletonLoaded()'), true);
  assert.equal(
    presentationSource.includes("this.loadState === 'loading' || this.loadState === 'loaded'"),
    true,
  );
  assert.equal(resourceLoadCalls.length, 1);
});

runTest('battle controller delegates thunder mage presentation lifecycle', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('ThunderMagePresentation'), true);
  assert.equal(controllerSource.includes('thunderMagePresentation'), true);
  assert.match(
    controllerSource,
    /new ThunderMagePresentation\(\s*this\.terrainPresentation\.layers\.units,\s*\(node\) => this\.setUiLayer\(node\),\s*this\.battleVfx,\s*\)/s,
  );
  assert.equal(
    controllerSource.includes(
      'this.thunderMagePresentation.handleTickResult(result, this.model.getCompanionAttackInterval())',
    ),
    true,
  );
  assert.equal(
    controllerSource.includes('this.thunderMagePresentation.update(presentationDelta)'),
    true,
  );
  assert.equal(controllerSource.includes('this.thunderMagePresentation.clear()'), true);
  assert.equal(controllerSource.includes("event.source === 'companion'"), false);
  assert.equal(controllerSource.includes('resolveThunderMageAttackAnimationTiming'), false);
  assert.equal(controllerSource.includes('ThunderMageCompanion'), false);
});
