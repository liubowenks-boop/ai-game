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
      assert.ok(profile.clips.some((clip) => clip.state === state), `${profile.id} missing ${state}`);
    }
  }

  for (const profile of Object.values(HERO_ANIMATION_PROFILES)) {
    for (const state of REQUIRED_HERO_ANIMATION_STATES) {
      assert.ok(profile.clips.some((clip) => clip.state === state), `${profile.id} missing ${state}`);
    }
  }

  assert.equal(getEnemyAnimationProfile('boss').clips.some((clip) => clip.state === 'boss_intro'), true);
  assert.equal(getEnemyAnimationProfile('boss').clips.some((clip) => clip.state === 'boss_attack'), true);
  assert.equal(getHeroAnimationProfile('弓手').id, 'hero_archer');
  assert.equal(PLAYER_ANIMATION_PROFILE.clips.some((clip) => clip.state === 'attack'), true);
});

runTest('thunder mage attack timing clamps to the configured source duration', () => {
  assert.equal(THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION, 0.6);
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
  assert.equal(fallbackZero.animationDuration, 0.6);
  assert.equal(fallbackNegative.animationDuration, 0.6);
  assert.equal(fallbackNaN.animationDuration, 0.6);
  assert.equal(fallbackInfinity.animationDuration, 0.6);
});

runTest('thunder mage profile uses the portable attack Spine asset', () => {
  const idleClip = THUNDER_MAGE_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'idle');
  const attackClip = THUNDER_MAGE_ANIMATION_PROFILE.clips.find((clip) => clip.state === 'attack');

  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.id, 'hero_thunder_mage');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.displayName, '雷法师');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.subject, 'hero');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.renderer, 'spine');
  assert.equal(THUNDER_MAGE_ANIMATION_PROFILE.spineAssetBase, THUNDER_MAGE_COMPANION.spineAssetBase);
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
  assert.equal(attackClip?.duration, 0.6);
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
  assert.equal(controllerSource.includes('this.playerAnimation.duration = timing.animationDuration'), true);
  assert.equal(
    controllerSource.includes('this.playerAttackSpinePlaybackSpeed = timing.spinePlaybackSpeed'),
    true,
  );
  assert.equal(
    controllerSource.includes('this.playerAnimation.elapsed / this.playerAnimation.duration'),
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

  assert.equal(controllerSource.includes('const presentationDelta = Math.min(deltaTime, 1 / 30);'), true);
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

  assert.equal(controllerSource.includes("this.playerAttackSpine.setAttachment('frame', `frame_${frameIndex}`);"), true);
  assert.equal(controllerSource.includes('const frameIndex = Math.min(7, Math.floor(progress * 8));'), true);
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

runTest('main hero attack keeps its local glow without rectangular head strokes', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('MainHeroAttackEffects'), true);
  assert.equal(controllerSource.includes('drawPlayerAttackAccent'), true);
  assert.equal(controllerSource.includes('playerAttackEffectsGraphics'), true);
  assert.equal(controllerSource.includes('PLAYER_ATTACK_SPINE_DURATION'), false);
  assert.equal(controllerSource.includes('this.playerAnimation.elapsed / this.playerAnimation.duration'), true);
  assert.equal(controllerSource.includes('255, 154, 54'), true);
  assert.equal(controllerSource.includes('this.playerAttackEffectsGraphics.circle('), true);
  assert.equal(controllerSource.includes('this.playerAttackEffectsGraphics.lineTo('), false);
  assert.equal(controllerSource.includes('this.playerAttackEffectsGraphics.lineWidth = 12'), false);
  assert.equal(controllerSource.includes('new Color(255, 106, 38'), false);
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

  assert.equal(resolveEnemyAnimationState(walkingEnemy, { previousHp: 10, newlySpawned: false }), 'walk');
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

runTest('player attacks render golden projectiles with transparent 2d particle hit bursts', () => {
  const autoAttackSource = readFileSync('assets/scripts/battle/PlayerAutoAttackSystem.ts', 'utf8');

  assert.equal(autoAttackSource.includes('ParticleSystem2D'), true);
  assert.equal(autoAttackSource.includes('projectiles'), true);
  assert.equal(autoAttackSource.includes('hitBursts'), true);
  assert.equal(autoAttackSource.includes('spawnGoldenArrowProjectile'), true);
  assert.equal(autoAttackSource.includes('drawGoldenArrowProjectile'), true);
  assert.equal(autoAttackSource.includes('spawnHitParticleBurst'), true);
  assert.equal(autoAttackSource.includes('configureHitParticleSystem'), true);
  assert.equal(autoAttackSource.includes('getUiArtAsset'), true);
  assert.equal(autoAttackSource.includes('assetManager.loadAny(spec.uuid'), true);
  assert.equal(autoAttackSource.includes("assetManager.loadBundle('ui'"), false);
  assert.equal(autoAttackSource.includes('fx_glow_gold_soft.png'), true);
  assert.equal(autoAttackSource.includes('fx_fire_small.png'), true);
  assert.equal(autoAttackSource.includes('builtinResMgr'), false);
  assert.equal(autoAttackSource.includes('white-texture'), false);
  assert.equal(autoAttackSource.includes('particle.custom = true'), true);
  assert.equal(autoAttackSource.includes('particle.autoRemoveOnFinish = true'), true);
  assert.equal(autoAttackSource.includes('particle.resetSystem()'), true);
  assert.equal(autoAttackSource.includes('criticalFireBurst'), true);
  assert.equal(autoAttackSource.includes('drawProjectileLightBloom'), true);
  assert.equal(autoAttackSource.includes('drawImpactGlowHalo'), true);
  assert.equal(autoAttackSource.includes('particle.totalParticles = critical ? 84 : 52'), true);
  assert.equal(autoAttackSource.includes('particle.emissionRate = critical ? 440 : 280'), true);
  assert.equal(autoAttackSource.includes('new Color(255, 96, 32'), true);
  assert.equal(autoAttackSource.includes('distance / 1000'), true);
});

runTest('thunder mage presentation owns its companion spine and electric effects', () => {
  const presentationSource = readFileSync('assets/scripts/battle/ThunderMagePresentation.ts', 'utf8');

  assert.equal(presentationSource.includes('THUNDER_MAGE_ANIMATION_PROFILE'), true);
  assert.equal(presentationSource.includes('getAnimationClipSpec'), true);
  assert.equal(presentationSource.includes('resolveThunderMageAttackAnimationTiming'), true);
  assert.equal(presentationSource.includes("new Node('ThunderMageCompanion')"), true);
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.position.x'), true);
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.position.y'), true);
  assert.equal(presentationSource.includes("new Node('ThunderMageAttackSpine')"), true);
  assert.equal(presentationSource.includes('THUNDER_MAGE_COMPANION.displayScale'), true);
  assert.equal(presentationSource.includes('0.22'), true);
  assert.equal(presentationSource.includes('premultipliedAlpha = false'), true);
  assert.equal(presentationSource.includes("resources.load(attackClip.spineAssetBase, sp.SkeletonData"), true);
  assert.equal(presentationSource.includes("event.source === 'companion'"), true);
  assert.equal(presentationSource.includes('loading'), true);
  assert.equal(presentationSource.includes('loaded'), true);
  assert.equal(presentationSource.includes('warned'), true);
  assert.equal(presentationSource.includes('console.warn'), true);
  assert.equal(presentationSource.includes("setAttachment('frame', 'frame_0')"), true);
  assert.equal(presentationSource.includes("setAttachment('frame', `frame_${frameIndex}`)"), true);
  assert.equal(presentationSource.includes('Math.min(7, Math.floor(progress * 8))'), true);
  assert.equal(presentationSource.includes('new Color(118, 224, 255'), true);
  assert.equal(presentationSource.includes('new Color(247, 252, 255'), true);
  assert.equal(presentationSource.includes('roundRect('), false);
  assert.equal(presentationSource.includes('fillRect('), false);
  assert.equal(presentationSource.includes('Sprite'), false);
});

runTest('battle controller delegates thunder mage presentation lifecycle', () => {
  const controllerSource = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');

  assert.equal(controllerSource.includes('ThunderMagePresentation'), true);
  assert.equal(controllerSource.includes('thunderMagePresentation'), true);
  assert.equal(
    controllerSource.includes('new ThunderMagePresentation(this.battleLayer, (node) => this.setUiLayer(node))'),
    true,
  );
  assert.equal(
    controllerSource.includes(
      'this.thunderMagePresentation.handleTickResult(result, this.model.getCompanionAttackInterval())',
    ),
    true,
  );
  assert.equal(controllerSource.includes('this.thunderMagePresentation.update(presentationDelta)'), true);
  assert.equal(controllerSource.includes('this.thunderMagePresentation.clear()'), true);
  assert.equal(controllerSource.includes("event.source === 'companion'"), false);
  assert.equal(controllerSource.includes('resolveThunderMageAttackAnimationTiming'), false);
  assert.equal(controllerSource.includes('ThunderMageCompanion'), false);
});
