import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ENEMY_ANIMATION_PROFILES,
  HERO_ANIMATION_PROFILES,
  PLAYER_ANIMATION_PROFILE,
  REQUIRED_ENEMY_ANIMATION_STATES,
  REQUIRED_HERO_ANIMATION_STATES,
  SPINE_ASSET_REQUIREMENTS,
  getEnemyAnimationProfile,
  getHeroAnimationProfile,
} from '../assets/scripts/data/AnimationConfig';
import {
  computeProceduralAnimationPose,
  createUnitAnimationRuntime,
  isUnitAnimationComplete,
  requestUnitAnimation,
  resolveEnemyAnimationState,
  tickUnitAnimation,
} from '../assets/scripts/battle/UnitAnimationSystem';

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
  tickUnitAnimation(runtime, 1);
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

runTest('player attacks render golden projectiles with 2d particle hit bursts', () => {
  const autoAttackSource = readFileSync('assets/scripts/battle/PlayerAutoAttackSystem.ts', 'utf8');

  assert.equal(autoAttackSource.includes('ParticleSystem2D'), true);
  assert.equal(autoAttackSource.includes('projectiles'), true);
  assert.equal(autoAttackSource.includes('hitBursts'), true);
  assert.equal(autoAttackSource.includes('spawnGoldenArrowProjectile'), true);
  assert.equal(autoAttackSource.includes('drawGoldenArrowProjectile'), true);
  assert.equal(autoAttackSource.includes('spawnHitParticleBurst'), true);
  assert.equal(autoAttackSource.includes('configureHitParticleSystem'), true);
  assert.equal(autoAttackSource.includes('builtinResMgr'), true);
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
  assert.equal(autoAttackSource.includes("loadBundle('ui'"), false);
});
