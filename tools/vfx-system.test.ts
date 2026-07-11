import assert from 'node:assert/strict';

import {
  BATTLE_VFX_BUDGET,
  BATTLE_VFX_PRESETS,
  BATTLE_VFX_TEXTURES,
} from '../assets/scripts/data/BattleVfxConfig';
import {
  BattleVfxLimiter,
  resolveAttackVfxPreset,
  resolveHeroVfxPreset,
} from '../assets/scripts/battle/BattleVfxLogic';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

runTest('vfx presets map every battle role to a distinct readable element', () => {
  assert.equal(resolveAttackVfxPreset({ source: 'main' }).id, 'main_fire_gold');
  assert.equal(resolveAttackVfxPreset({ source: 'companion' }).id, 'thunder');
  assert.equal(resolveHeroVfxPreset('弓手', 'single').id, 'gold_arrow');
  assert.equal(resolveHeroVfxPreset('火药师', 'area').id, 'fire_blast');
  assert.equal(resolveHeroVfxPreset('冰法师', 'slow').id, 'ice_shard');
  assert.equal(resolveHeroVfxPreset('毒师', 'poison').id, 'poison_wisp');
  assert.equal(resolveHeroVfxPreset('护卫', 'guard').id, 'shield_impact');
  assert.equal(resolveHeroVfxPreset('鼓手', 'aura').id, 'warm_support');
  assert.equal(resolveHeroVfxPreset('治疗师', 'heal').id, 'healing_spirit');
  assert.equal(resolveHeroVfxPreset('咒术师', 'debuff').id, 'curse_wisp');
  assert.equal(resolveHeroVfxPreset('未知英雄', 'single').id, 'gold_arrow');
});

runTest('vfx textures and presets stay inside the approved production budget', () => {
  assert.equal(Object.keys(BATTLE_VFX_TEXTURES).length, 10);
  assert.equal(Object.keys(BATTLE_VFX_PRESETS).length, 10);

  for (const preset of Object.values(BATTLE_VFX_PRESETS)) {
    assert.ok(preset.particleCount >= 40 && preset.particleCount <= 70);
    assert.ok(preset.criticalParticleCount >= 90 && preset.criticalParticleCount <= 140);
    assert.ok(preset.impactLife >= 0.18 && preset.impactLife <= 0.65);
    assert.ok(preset.criticalLife <= 0.9);
    assert.ok(preset.presentationInterval >= 0.65 && preset.presentationInterval <= 0.85);
  }
});

runTest('hero attack presentation throttles per hero and resets cleanly', () => {
  const limiter = new BattleVfxLimiter(BATTLE_VFX_BUDGET);
  assert.equal(limiter.tryStartHeroAttack(11, 0, 0.65), true);
  assert.equal(limiter.tryStartHeroAttack(11, 0.2, 0.65), false);
  assert.equal(limiter.tryStartHeroAttack(12, 0.2, 0.65), true);
  assert.equal(limiter.tryStartHeroAttack(11, 0.7, 0.65), true);
  limiter.reset();
  assert.equal(limiter.tryStartHeroAttack(11, 0.1, 0.65), true);
});

runTest('critical reservations evict only the oldest decorative effect', () => {
  const limiter = new BattleVfxLimiter({
    ...BATTLE_VFX_BUDGET,
    maxActiveImpacts: 2,
  });
  const essential = limiter.reserve('impact', 10, 'essential');
  const decorative = limiter.reserve('impact', 10, 'decorative');
  assert.ok(essential);
  assert.ok(decorative);

  const critical = limiter.reserve('impact', 90, 'critical');
  assert.ok(critical);
  assert.equal(limiter.isActive(essential!), true);
  assert.equal(limiter.isActive(decorative!), false);
  assert.deepEqual(limiter.drainEvictedReservations().map((item) => item.id), [decorative!.id]);

  limiter.release(essential!);
  limiter.release(essential!);
  limiter.release(critical!);
  assert.deepEqual(limiter.getSnapshot(), {
    activeProjectiles: 0,
    activeImpacts: 0,
    activeParticleSystems: 0,
    estimatedParticles: 0,
  });
});

