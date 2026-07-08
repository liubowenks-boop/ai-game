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

runTest('default enemy tuning is slower and less punishing for readable mobile combat', () => {
  const model = new BattleMvpModel();
  const enemyConfigs = model.getEnemyConfigs();
  const fast = enemyConfigs.find((enemy) => enemy.kind === 'fast');
  const boss = enemyConfigs.find((enemy) => enemy.kind === 'boss');

  assert.equal(model.options.enemyBaseSpeed, 34);
  assert.equal(model.options.enemyDamage, 0.5);
  assert.equal(model.options.enemyBaseHp, 20);
  assert.equal(model.options.mainAttackDamage, 16);
  assert.equal(model.options.waveInterval, 3);
  assert.ok((fast?.speedMultiplier ?? 99) <= 1.12);
  assert.ok((boss?.damageMultiplier ?? 99) <= 4.5);
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
  const maxHeroes = model.build.summon.maxBoardHeroes;
  assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), true);
  assert.equal(model.build.summon.maxBoardHeroes, maxHeroes + 1);
});

runTest('fire build adds stackable burn and spread pressure', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 1,
    mainAttackInterval: 0.5,
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
  'summon build limits board growth then turns extra slots and hero attack into DPS gains',
  () => {
    const model = new BattleMvpModel({
      heroBaseDps: 5,
    });

    model.placeHero(0, '弓手');
    model.placeHero(1, '火药师');
    model.placeHero(2, '冰法师');

    assert.equal(model.getHeroes().length, 3);
    assert.equal(model.placeHero(3, '毒师'), undefined);

    const dpsBeforeCard = model.getTotalHeroDps();
    model.applyUpgradeCard('summon_slots_plus_1');
    assert.notEqual(model.placeHero(3, '毒师'), undefined);
    assert.ok(model.getTotalHeroDps() > dpsBeforeCard);

    const dpsBeforeDamageCard = model.getTotalHeroDps();
    model.applyUpgradeCard('summon_hero_damage_20');
    assert.ok(model.getTotalHeroDps() > dpsBeforeDamageCard);

    model.placeHero(4, '弓手');
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
  assert.equal(model.options.cityLineY, -210);
  assert.ok(model.options.cityLineY > model.slots[0].position.y);

  for (const slot of model.slots) {
    assert.ok(slot.position.x >= -halfWidth);
    assert.ok(slot.position.x <= halfWidth);
    assert.ok(slot.position.y >= -halfHeight);
    assert.ok(slot.position.y <= halfHeight);
  }
});
