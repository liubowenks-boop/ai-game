import assert from 'node:assert/strict';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

runTest('starts battle and spawned enemies wait at the wall before damaging the city', () => {
  const model = new BattleMvpModel({
    cityMaxHealth: 1,
    enemyDamage: 1,
    enemyStartY: 40,
    cityLineY: 0,
    enemyBaseSpeed: 30,
    waveInterval: 99,
    mainAttackDamage: 0,
    companionAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();
  model.spawnEnemy({ y: 40, speed: 30, damage: 1, hp: 100 });

  const firstTick = model.tick(2);

  assert.equal(firstTick.cityDamage, 0);
  assert.equal(model.cityHealth, 1);
  assert.equal(model.gameOver, false);
  assert.equal(model.enemies.length, 1);
  assert.ok(model.enemies.every((enemy) => enemy.position.y === model.options.cityLineY));

  const secondTick = model.tick(2.9);

  assert.equal(secondTick.cityDamage, 0);
  assert.equal(model.cityHealth, 1);
  assert.equal(model.enemies.length, 1);

  const thirdTick = model.tick(0.1);

  assert.equal(thirdTick.cityDamage, 1);
  assert.equal(model.cityHealth, 0);
  assert.equal(model.gameOver, true);
});

runTest('main hero attacks the nearest enemy first', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 10,
    mainAttackInterval: 1,
    companionAttackDamage: 0,
    heroBaseDps: 0,
    random: () => 1,
  });

  model.startBattle();
  const farEnemy = model.spawnEnemy({ x: 200, y: 200, hp: 30, speed: 0 });
  const nearEnemy = model.spawnEnemy({ x: 0, y: -220, hp: 30, speed: 0 });

  const tick = model.tick(1);

  assert.equal(tick.attackEvents.length, 1);
  assert.equal(tick.attackEvents[0].enemyId, nearEnemy.id);
  assert.equal(model.findEnemy(nearEnemy.id)?.hp, 20);
  assert.equal(model.findEnemy(farEnemy.id)?.hp, 30);
});

runTest('v0.2 config exposes the requested hero and enemy archetypes', () => {
  const model = new BattleMvpModel();

  assert.deepEqual(
    model.getHeroConfigs().map((hero) => hero.name),
    ['弓手', '火药师', '冰法师', '毒师', '护卫', '鼓手', '治疗师', '咒术师'],
  );

  assert.deepEqual(
    model.getEnemyConfigs().map((enemy) => enemy.kind),
    ['normal', 'fast', 'tank', 'ranged', 'boss'],
  );
});

runTest('thunder mage permanently reserves the far-left wall slot outside the ordinary hero count', () => {
  const model = new BattleMvpModel();
  const companion = model.getFixedCompanion();

  assert.deepEqual(companion, {
    id: 'hero_thunder_mage',
    name: '雷法师',
    description: '雷电速攻支援',
    slotIndex: 3,
    position: { x: -240, y: -320 },
    attackDamage: 7,
    attackInterval: 0.6,
    displayScale: 0.22,
    spineAssetBase: 'spine/hero_thunder_mage/hero_thunder_mage',
  });
  companion.position.x = 999;
  assert.deepEqual(model.getFixedCompanion().position, { x: -240, y: -320 });

  assert.equal(model.slots[3].reservedBy, 'fixed_companion');
  assert.equal(model.placeHero(3, '弓手'), undefined);
  assert.equal(model.slots[3].hero, undefined);

  assert.ok(model.placeHero(0, '弓手'));
  assert.ok(model.placeHero(1, '火药师'));
  assert.ok(model.placeHero(2, '冰法师'));
  assert.equal(model.getHeroes().length, 3);
});

runTest('five-unit wall formation caps ordinary board heroes at three', () => {
  const model = new BattleMvpModel();

  assert.deepEqual(model.slots.map((slot) => slot.index), [0, 1, 2, 3]);
  assert.deepEqual(model.slots.slice(0, 3).map((slot) => slot.position), [
    { x: -120, y: -320 },
    { x: 120, y: -320 },
    { x: 240, y: -320 },
  ]);
  assert.deepEqual(model.slots[3], {
    index: 3,
    label: '',
    row: 'wall',
    position: { x: -240, y: -320 },
    reservedBy: 'fixed_companion',
  });
  assert.deepEqual(model.playerPosition, { x: 0, y: -320 });
  assert.equal(model.options.cityLineY, -290);

  assert.ok(model.placeHero(0, '弓手'));
  assert.ok(model.placeHero(1, '火药师'));
  assert.ok(model.placeHero(2, '冰法师'));
  assert.equal(model.getHeroes().length, 3);
  assert.equal(model.build.summon.maxBoardHeroes, 3);
  assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
  assert.equal(model.placeHero(3, '护卫'), undefined);
  assert.equal(model.placeHero(4, '护卫'), undefined);
  assert.equal(model.getHeroes().length, 3);
});

runTest('upgrade rotation never offers the retired slot expansion card', () => {
  const model = new BattleMvpModel();

  const firstOfferIds = model.offerUpgradeCards().map((card) => card.id);
  const secondOfferIds = model.offerUpgradeCards().map((card) => card.id);

  assert.equal(firstOfferIds.includes('summon_slots_plus_1'), false);
  assert.equal(secondOfferIds.includes('summon_slots_plus_1'), false);
  assert.equal(firstOfferIds.includes('summon_hero_damage_20'), true);
  assert.equal(secondOfferIds.includes('summon_hero_damage_20'), true);
  assert.equal(new Set(firstOfferIds).size, 3);
  assert.equal(new Set(secondOfferIds).size, 3);
});

runTest('ordinary wall slots use linear adjacency and exclude the companion slot', () => {
  const model = new BattleMvpModel();

  assert.deepEqual(model.getAdjacentSlotIndexes(0), [1]);
  assert.deepEqual(model.getAdjacentSlotIndexes(1), [0, 2]);
  assert.deepEqual(model.getAdjacentSlotIndexes(2), [1]);
  assert.deepEqual(model.getAdjacentSlotIndexes(3), []);
  assert.equal(model.getAdjacentSlotIndexes(0).includes(2), false);
});

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

  assert.deepEqual(first.attackEvents.map((event) => event.source), ['companion']);
  assert.equal(first.attackEvents[0].damage, 7);
  assert.equal(model.findEnemy(target.id)?.hp, 93);
  assert.equal(
    model.tick(0.58).attackEvents.some((event) => event.source === 'companion'),
    false,
  );
  assert.equal(
    model.tick(0.02).attackEvents.some((event) => event.source === 'companion'),
    true,
  );

  model.startBattle();
  model.spawnEnemy({ hp: 100, speed: 0 });
  assert.equal(model.tick(0.01).attackEvents[0].source, 'companion');
});

runTest('battle tick ignores non-finite and non-positive deltas without polluting state', () => {
  const invalidDeltas = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0.1];

  for (const deltaSeconds of invalidDeltas) {
    const model = new BattleMvpModel({
      waveInterval: 99,
      mainAttackDamage: 0,
      heroBaseDps: 0,
    });

    model.startBattle();
    const target = model.spawnEnemy({ x: 10, y: 100, hp: 100, speed: 10 });
    const positionBeforeTick = { ...target.position };
    const invalidTick = model.tick(deltaSeconds);

    assert.equal(invalidTick.attackEvents.length, 0);
    assert.deepEqual(target.position, positionBeforeTick);
    assert.equal(target.hp, 100);
    assert.equal(model.wave, 0);
    assert.equal(model.tick(0.01).attackEvents[0].source, 'companion');
  }
});

runTest('thunder mage does not attack after game over even when running remains true', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();
  const target = model.spawnEnemy({ hp: 100, speed: 0 });
  model.gameOver = true;
  model.running = true;

  assert.equal(model.tick(1).attackEvents.length, 0);
  assert.equal(target.hp, 100);
});

runTest('thunder mage preserves large-frame overshoot without attacking twice in one tick', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 7,
    companionAttackInterval: 0.6,
  });

  model.startBattle();
  const target = model.spawnEnemy({ hp: 100, speed: 0 });
  const ticks = [model.tick(0.4), model.tick(0.4), model.tick(0.4)];

  assert.deepEqual(
    ticks.map((tick) => tick.attackEvents.filter((event) => event.source === 'companion').length),
    [1, 1, 1],
  );
  assert.equal(target.hp, 79);
});

runTest('thunder mage stays ready while no living target exists', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();
  assert.equal(model.tick(2).attackEvents.length, 0);

  model.spawnEnemy({ hp: 100, speed: 0 });
  assert.equal(model.tick(0.01).attackEvents[0].source, 'companion');
  assert.equal(model.tick(0.01).attackEvents.length, 0);
});

runTest('thunder mage targets the living enemy closest to the city wall', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();
  const fartherFromWall = model.spawnEnemy({ x: 0, y: 0, hp: 100, speed: 0 });
  const closerToWall = model.spawnEnemy({ x: 300, y: -190, hp: 100, speed: 0 });
  const tick = model.tick(0.01);

  assert.equal(tick.attackEvents[0].enemyId, closerToWall.id);
  assert.equal(model.findEnemy(closerToWall.id)?.hp, 93);
  assert.equal(model.findEnemy(fartherFromWall.id)?.hp, 100);
});

runTest('drummer aura shortens the thunder mage actual attack cadence', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackInterval: 0.6,
  });

  model.placeHero(0, '鼓手');
  assert.ok(model.getCompanionAttackInterval() < 0.6);

  model.startBattle();
  model.spawnEnemy({ hp: 100, speed: 0 });
  assert.equal(model.tick(0.01).attackEvents[0].source, 'companion');
  assert.equal(model.tick(0.52).attackEvents.length, 0);
  assert.equal(model.tick(0.02).attackEvents[0].source, 'companion');
});

runTest('thunder mage interval falls back to one when drummer aura is invalid', () => {
  const model = new BattleMvpModel({ companionAttackInterval: 0.6 });
  const drummer = model.placeHero(0, '鼓手');

  assert.ok(drummer);
  drummer.level = Number.POSITIVE_INFINITY;
  assert.equal(model.getCompanionAttackInterval(), 0.6);
});

runTest('thunder mage falls back to default base interval before applying valid aura', () => {
  const invalidIntervals = [Number.NaN, Number.POSITIVE_INFINITY, 0, -0.6];
  const expectedInterval = 0.6 / 1.12;

  for (const companionAttackInterval of invalidIntervals) {
    const model = new BattleMvpModel({ companionAttackInterval });
    model.placeHero(0, '鼓手');

    assert.ok(Math.abs(model.getCompanionAttackInterval() - expectedInterval) < 0.000001);
  }
});

runTest('thunder mage damage applies vulnerability before subtracting armor', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 7,
  });

  model.startBattle();
  const target = model.spawnEnemy({ hp: 100, speed: 0, armor: 2 });
  target.vulnerableMultiplier = 1.5;
  target.vulnerableTimeLeft = 10;

  const tick = model.tick(0.01);

  assert.equal(tick.attackEvents[0].source, 'companion');
  assert.equal(tick.attackEvents[0].damage, 8.5);
  assert.equal(target.hp, 91.5);
});

runTest('thunder mage attacks do not trigger main hero fire or thunder effects', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    random: () => 0,
  });

  model.startBattle();
  model.applyUpgradeCard('thunder_chain_plus_1');
  const primary = model.spawnEnemy({ x: 0, y: -190, hp: 100, speed: 0 });
  const secondary = model.spawnEnemy({ x: 20, y: -180, hp: 100, speed: 0 });
  const tick = model.tick(0.01);

  assert.deepEqual(tick.attackEvents.map((event) => event.source), ['companion']);
  assert.equal(primary.burnStacks, 0);
  assert.equal(secondary.hp, 100);
});

runTest('default enemy tuning is slower and less punishing for readable mobile combat', () => {
  const model = new BattleMvpModel();
  const enemyConfigs = model.getEnemyConfigs();
  const fast = enemyConfigs.find((enemy) => enemy.kind === 'fast');
  const boss = enemyConfigs.find((enemy) => enemy.kind === 'boss');

  assert.equal(model.options.enemyBaseSpeed, 34);
  assert.equal(model.options.enemyDamage, 0.5);
  assert.equal(model.options.enemyBaseHp, 20);
  assert.equal(model.options.mainAttackDamage, 11);
  assert.equal(model.options.waveInterval, 3);
  assert.ok((fast?.speedMultiplier ?? 99) <= 1.12);
  assert.ok((boss?.damageMultiplier ?? 99) <= 4.5);
});

runTest('default main attack softens the opening wave without making it toothless', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    heroBaseDps: 0,
    companionAttackDamage: 0,
    random: () => 1,
  });

  model.startBattle();
  const wave = model.spawnWave();

  assert.equal(wave.length, 3);

  const firstHit = model.tick(model.options.mainAttackInterval);

  assert.equal(firstHit.killedEnemyIds.length, 0);
  assert.ok(wave.some((enemy) => enemy.alive && enemy.hp < enemy.maxHp));

  const secondPulse = model.tick(model.options.mainAttackInterval);

  assert.ok(secondPulse.killedEnemyIds.length >= 1);
});

runTest('upgrade cards are always tied to fire, thunder, or summon builds', () => {
  const model = new BattleMvpModel({
    upgradeInterval: 3,
  });

  model.startBattle();

  const tick = model.tick(3);

  assert.equal(tick.upgradeOffered, true);
  assert.equal(model.pendingUpgradeCards.length, 3);
  assert.deepEqual(
    model.pendingUpgradeCards.map((card) => card.school),
    ['fire', 'thunder', 'summon'],
  );

  const burnDamage = model.build.fire.burnDamageMultiplier;
  assert.equal(model.applyUpgradeCard('fire_burn_damage_30'), true);
  assert.equal(model.build.fire.burnDamageMultiplier, burnDamage * 1.3);
  assert.equal(model.pendingUpgradeCards.length, 0);

  model.offerUpgradeCards();
  const chainTargets = model.build.thunder.chainTargets;
  assert.equal(model.applyUpgradeCard('thunder_chain_plus_1'), true);
  assert.equal(model.build.thunder.chainTargets, chainTargets + 1);

  model.offerUpgradeCards();
  const heroDamageMultiplier = model.build.summon.heroDamageMultiplier;
  assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
  assert.equal(model.applyUpgradeCard('summon_hero_damage_20'), true);
  assert.equal(model.build.summon.heroDamageMultiplier, heroDamageMultiplier * 1.2);
});

runTest('fire build adds stackable burn and spread pressure', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 1,
    mainAttackInterval: 0.5,
    companionAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();
  model.applyUpgradeCard('fire_spread_plus_1');

  const primary = model.spawnEnemy({ x: 0, y: -230, hp: 80, speed: 0 });
  const spread = model.spawnEnemy({ x: 80, y: -230, hp: 80, speed: 0 });

  model.tick(0.5);

  assert.equal(primary.burnStacks, 1);
  assert.equal(spread.burnStacks, 1);

  const spreadHpAfterIgnite = spread.hp;
  model.tick(0.5);

  assert.ok((primary.burnStacks ?? 0) >= 2);
  assert.ok(spread.hp < spreadHpAfterIgnite);
});

runTest('thunder build can crit and chain to extra enemies', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 10,
    mainAttackInterval: 1,
    companionAttackDamage: 0,
    heroBaseDps: 0,
    random: () => 0,
  });

  model.startBattle();
  model.applyUpgradeCard('thunder_chain_plus_1');
  model.applyUpgradeCard('thunder_crit_plus_10');

  const primary = model.spawnEnemy({ x: 0, y: -230, hp: 100, speed: 0 });
  const chained = model.spawnEnemy({ x: 80, y: -230, hp: 100, speed: 0 });

  const tick = model.tick(1);

  const mainHit = tick.attackEvents.find((event) => event.source === 'main');
  const chainHit = tick.attackEvents.find((event) => event.source === 'thunder_chain');

  assert.equal(mainHit?.enemyId, primary.id);
  assert.equal(mainHit?.critical, true);
  assert.equal(chainHit?.enemyId, chained.id);
  assert.ok((model.findEnemy(chained.id)?.hp ?? 100) < 100);
});

runTest('wave rhythm produces tutorial waves, elite wave, and a pressure boss on wave 5', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    companionAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();

  const wave1 = model.spawnWave();
  model.spawnWave();
  model.spawnWave();
  const wave4 = model.spawnWave();
  const wave5 = model.spawnWave();

  assert.equal(model.getWavePhase(1), 'tutorial');
  assert.equal(model.getWavePhase(4), 'elite');
  assert.equal(model.getWavePhase(5), 'boss');
  assert.ok(wave1.every((enemy) => enemy.kind === 'normal' || enemy.kind === 'fast'));
  assert.ok(wave4.some((enemy) => enemy.kind === 'tank' || enemy.kind === 'ranged'));
  assert.equal(wave5.length, 1);
  assert.equal(wave5[0].kind, 'boss');
  assert.ok(wave5[0].maxHp >= model.options.enemyBaseHp * 7);
  assert.ok(wave5[0].damage > model.options.enemyDamage);
});

runTest('recruited adjacent same-name heroes merge up to level 4', () => {
  const model = new BattleMvpModel({
    heroBaseDps: 5,
  });

  model.placeHero(0, '弓手');
  model.placeHero(1, '弓手');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 2);
  assert.equal(model.getTotalHeroDps(), 10);

  const mergedSlot = model.getHeroes()[0].slotIndex;
  const adjacentEmptySlot = model.getAdjacentSlotIndexes(mergedSlot).find((slotIndex) => {
    return !model.slots[slotIndex].hero;
  });

  assert.equal(typeof adjacentEmptySlot, 'number');
  model.placeHero(adjacentEmptySlot as number, '弓手');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 3);

  const nextEmptySlot = model
    .getAdjacentSlotIndexes(model.getHeroes()[0].slotIndex)
    .find((slotIndex) => {
      return !model.slots[slotIndex].hero;
    });

  assert.equal(typeof nextEmptySlot, 'number');
  model.placeHero(nextEmptySlot as number, '弓手');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 4);

  const cappedSlot = model
    .getAdjacentSlotIndexes(model.getHeroes()[0].slotIndex)
    .find((slotIndex) => {
      return !model.slots[slotIndex].hero;
    });

  assert.equal(typeof cappedSlot, 'number');
  model.placeHero(cappedSlot as number, '弓手');

  assert.equal(
    model.getHeroes().some((hero) => hero.level > 4),
    false,
  );
});

runTest(
  'summon build keeps three ordinary slots and turns its card into DPS gains',
  () => {
    const model = new BattleMvpModel({
      heroBaseDps: 5,
    });

    model.placeHero(0, '弓手');
    model.placeHero(1, '火药师');
    model.placeHero(2, '冰法师');

    assert.equal(model.getHeroes().length, 3);
    assert.equal(model.placeHero(3, '毒师'), undefined);

    assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
    assert.equal(model.placeHero(4, '毒师'), undefined);
    assert.equal(model.getHeroes().length, 3);

    const dpsBeforeDamageCard = model.getTotalHeroDps();
    model.applyUpgradeCard('summon_hero_damage_20');
    assert.ok(model.getTotalHeroDps() > dpsBeforeDamageCard);

    model.placeHero(0, '弓手');

    const archer = model.getHeroes().find((hero) => hero.name === '弓手');
    assert.equal(archer?.level, 2);
  },
);

runTest('default prototype coordinates fit the Cocos 720x1280 portrait preview viewport', () => {
  const model = new BattleMvpModel();
  const halfWidth = 360;
  const halfHeight = 640;

  assert.ok(model.options.enemyStartY <= halfHeight);
  assert.ok(model.options.cityLineY >= -halfHeight);
  assert.ok(model.playerPosition.y >= -halfHeight);
  assert.equal(model.options.cityLineY, -290);
  assert.ok(model.options.cityLineY > model.slots[0].position.y);

  for (const slot of model.slots) {
    assert.ok(slot.position.x >= -halfWidth);
    assert.ok(slot.position.x <= halfWidth);
    assert.ok(slot.position.y >= -halfHeight);
    assert.ok(slot.position.y <= halfHeight);
  }
});
