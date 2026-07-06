import assert from 'node:assert/strict';

import { BattleMvpModel } from '../assets/scripts/battle/BattleMvpModel';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

runTest('starts battle, spawns waves every 2 seconds, and damages city at the bottom line', () => {
  const model = new BattleMvpModel({
    cityMaxHealth: 3,
    enemyDamage: 1,
    enemyStartY: 40,
    cityLineY: 0,
    enemyBaseSpeed: 30,
    mainAttackDamage: 0,
    heroBaseDps: 0,
  });

  model.startBattle();

  const firstTick = model.tick(2);

  assert.equal(model.wave, 1);
  assert.equal(firstTick.spawnedEnemyIds.length, 3);
  assert.equal(model.enemies.length, 3);

  const secondTick = model.tick(2);

  assert.equal(secondTick.cityDamage, 3);
  assert.equal(model.cityHealth, 0);
  assert.equal(model.gameOver, true);
});

runTest('main hero attacks the nearest enemy first', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 10,
    mainAttackInterval: 1,
    heroBaseDps: 0,
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

runTest('upgrade cards apply attack power, attack speed, and city healing immediately', () => {
  const model = new BattleMvpModel({
    cityMaxHealth: 100,
    upgradeInterval: 3,
  });

  model.startBattle();
  model.cityHealth = 50;

  const tick = model.tick(3);

  assert.equal(tick.upgradeOffered, true);
  assert.deepEqual(
    model.pendingUpgradeCards.map((card) => card.id),
    ['attack_power_20', 'attack_speed_20', 'city_heal'],
  );

  const baseDamage = model.mainAttackDamage;
  model.applyUpgradeCard('attack_power_20');
  assert.equal(model.mainAttackDamage, baseDamage * 1.2);
  assert.equal(model.pendingUpgradeCards.length, 0);

  const baseInterval = model.mainAttackInterval;
  model.offerUpgradeCards();
  model.applyUpgradeCard('attack_speed_20');
  assert.equal(model.mainAttackInterval, baseInterval / 1.2);

  model.cityHealth = 50;
  model.offerUpgradeCards();
  model.applyUpgradeCard('city_heal');
  assert.equal(model.cityHealth, 80);
});

runTest('recruited adjacent same-name heroes merge up to level 4', () => {
  const model = new BattleMvpModel({
    heroBaseDps: 5,
  });

  model.placeHero(0, '战士');
  model.placeHero(1, '战士');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 2);
  assert.equal(model.getTotalHeroDps(), 10);

  const mergedSlot = model.getHeroes()[0].slotIndex;
  const adjacentEmptySlot = model.getAdjacentSlotIndexes(mergedSlot).find((slotIndex) => {
    return !model.slots[slotIndex].hero;
  });

  assert.equal(typeof adjacentEmptySlot, 'number');
  model.placeHero(adjacentEmptySlot as number, '战士');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 3);

  const nextEmptySlot = model.getAdjacentSlotIndexes(model.getHeroes()[0].slotIndex).find((slotIndex) => {
    return !model.slots[slotIndex].hero;
  });

  assert.equal(typeof nextEmptySlot, 'number');
  model.placeHero(nextEmptySlot as number, '战士');

  assert.equal(model.getHeroes().length, 1);
  assert.equal(model.getHeroes()[0].level, 4);

  const cappedSlot = model.getAdjacentSlotIndexes(model.getHeroes()[0].slotIndex).find((slotIndex) => {
    return !model.slots[slotIndex].hero;
  });

  assert.equal(typeof cappedSlot, 'number');
  model.placeHero(cappedSlot as number, '战士');

  assert.equal(model.getHeroes().some((hero) => hero.level > 4), false);
});

runTest('default prototype coordinates fit the Cocos 1280x720 preview viewport', () => {
  const model = new BattleMvpModel();
  const halfWidth = 640;
  const halfHeight = 360;

  assert.ok(model.options.enemyStartY <= halfHeight);
  assert.ok(model.options.cityLineY >= -halfHeight);
  assert.ok(model.playerPosition.y >= -halfHeight);

  for (const slot of model.slots) {
    assert.ok(slot.position.x >= -halfWidth);
    assert.ok(slot.position.x <= halfWidth);
    assert.ok(slot.position.y >= -halfHeight);
    assert.ok(slot.position.y <= halfHeight);
  }
});
