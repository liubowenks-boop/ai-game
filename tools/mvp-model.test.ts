import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BattleMvpModel, type BattleMvpOptions } from '../assets/scripts/battle/BattleMvpModel';
import {
  FIXED_COMPANIONS,
  type FixedCompanionAttackSource,
} from '../assets/scripts/data/CompanionConfig';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

const FIXED_COMPANION_CASES = FIXED_COMPANIONS.map((companion) => ({
  id: companion.id,
  name: companion.name,
  source: companion.attackSource,
  damage: companion.attackDamage,
  interval: companion.attackInterval,
  damageOptionKey: companion.runtimeOptionKeys.damage,
  intervalOptionKey: companion.runtimeOptionKeys.interval,
}));

function isolatedCompanionOptions(
  companion: (typeof FIXED_COMPANION_CASES)[number],
  overrides: Partial<BattleMvpOptions> = {},
): Partial<BattleMvpOptions> {
  return {
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 0,
    qinglanAttackDamage: 0,
    [companion.damageOptionKey]: companion.damage,
    [companion.intervalOptionKey]: companion.interval,
    ...overrides,
  };
}

function companionEvents(
  model: BattleMvpModel,
  deltaSeconds: number,
  source: FixedCompanionAttackSource,
) {
  return model.tick(deltaSeconds).attackEvents.filter((event) => event.source === source);
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
    qinglanAttackDamage: 0,
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
    qinglanAttackDamage: 0,
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

runTest('fixed companions reserve both outer wall slots outside the ordinary hero count', () => {
  const model = new BattleMvpModel();
  const companion = model.getFixedCompanion();

  assert.deepEqual(companion, {
    id: 'hero_thunder_mage',
    name: '雷法师',
    description: '雷电速攻支援',
    slotIndex: 2,
    position: { x: -215, y: -205 },
    attackSource: 'companion',
    attackDamage: 7,
    attackInterval: 0.85,
    runtimeOptionKeys: {
      damage: 'companionAttackDamage',
      interval: 'companionAttackInterval',
    },
    animationProfileId: 'hero_thunder_mage',
    vfxPresetId: 'thunder',
    spineSourceDuration: 1,
    displayScale: 0.286,
    spineAssetBase: 'spine/hero_thunder_mage/hero_thunder_mage',
    rootNodeName: 'ThunderMageCompanion',
    spineNodeName: 'ThunderMageAttackSpine',
  });
  companion.position.x = 999;
  assert.deepEqual(model.getFixedCompanion().position, { x: -215, y: -205 });

  assert.deepEqual(
    model.getFixedCompanions().map(({ id, name, slotIndex, attackDamage, attackInterval }) => ({
      id,
      name,
      slotIndex,
      attackDamage,
      attackInterval,
    })),
    [
      {
        id: 'hero_thunder_mage',
        name: '雷法师',
        slotIndex: 2,
        attackDamage: 7,
        attackInterval: 0.85,
      },
      {
        id: 'hero_qinglan',
        name: '灵符道君·青岚',
        slotIndex: 3,
        attackDamage: 8,
        attackInterval: 1,
      },
    ],
  );

  assert.equal(model.slots[2].reservedBy, 'fixed_companion');
  assert.equal(model.slots[2].fixedCompanionId, 'hero_thunder_mage');
  assert.equal(model.slots[3].reservedBy, 'fixed_companion');
  assert.equal(model.slots[3].fixedCompanionId, 'hero_qinglan');
  assert.equal(model.placeHero(2, '弓手'), undefined);
  assert.equal(model.placeHero(3, '弓手'), undefined);

  assert.ok(model.placeHero(0, '弓手'));
  assert.ok(model.placeHero(1, '火药师'));
  assert.equal(model.getHeroes().length, 2);
});

runTest('five-person wall formation caps ordinary board heroes at two', () => {
  const model = new BattleMvpModel();

  assert.deepEqual(
    model.slots.map((slot) => slot.index),
    [0, 1, 2, 3],
  );
  assert.deepEqual(
    model.slots.slice(0, 2).map((slot) => slot.position),
    [
      { x: -120, y: -270 },
      { x: 120, y: -270 },
    ],
  );
  assert.deepEqual(model.playerPosition, { x: 0, y: -250 });
  assert.equal(model.options.cityLineY, -235);

  assert.ok(model.placeHero(0, '弓手'));
  assert.ok(model.placeHero(1, '火药师'));
  assert.equal(model.placeHero(2, '冰法师'), undefined);
  assert.equal(model.placeHero(3, '冰法师'), undefined);
  assert.equal(model.getHeroes().length, 2);
  assert.equal(model.build.summon.maxBoardHeroes, 2);
  assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
  assert.equal(model.placeHero(3, '护卫'), undefined);
  assert.equal(model.placeHero(4, '护卫'), undefined);
  assert.equal(model.getHeroes().length, 2);
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

runTest('ordinary wall slots are adjacent and exclude both companion slots', () => {
  const model = new BattleMvpModel();

  assert.deepEqual(model.getAdjacentSlotIndexes(0), [1]);
  assert.deepEqual(model.getAdjacentSlotIndexes(1), [0]);
  assert.deepEqual(model.getAdjacentSlotIndexes(2), []);
  assert.deepEqual(model.getAdjacentSlotIndexes(3), []);
  assert.equal(model.getAdjacentSlotIndexes(0).includes(2), false);
});

runTest('fixed companion slots timers and options are derived from the shared registry', () => {
  const source = readFileSync('assets/scripts/battle/BattleMvpModel.ts', 'utf8');
  assert.equal(source.includes("companion.id === 'hero_thunder_mage'"), false);
  assert.equal(source.includes("fixedCompanionId: 'hero_thunder_mage'"), false);
  assert.equal(source.includes("fixedCompanionId: 'hero_qinglan'"), false);
  assert.match(source, /FIXED_COMPANIONS\.map\(\(companion\) => \[companion\.id, 0\]\)/);
  assert.match(source, /this\.options\[companion\.runtimeOptionKeys\.damage\]/);
  assert.match(source, /this\.options\[companion\.runtimeOptionKeys\.interval\]/);
});

runTest('qinglan attacks independently once per configured interval', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 0,
    qinglanAttackDamage: 8,
    qinglanAttackInterval: 1,
  });

  model.startBattle();
  model.spawnEnemy({ hp: 100, speed: 0 });

  const first = model
    .tick(0.01)
    .attackEvents.filter((event) => event.source === 'qinglan_companion');
  assert.equal(first.length, 1);
  assert.equal(first[0].damage, 8);
  assert.deepEqual(first[0].originPosition, { x: 215, y: -205 });
  assert.equal(first[0].heroName, '灵符道君·青岚');

  assert.equal(
    model.tick(0.98).attackEvents.some((event) => event.source === 'qinglan_companion'),
    false,
  );
  assert.equal(
    model.tick(0.02).attackEvents.some((event) => event.source === 'qinglan_companion'),
    true,
  );
});

runTest('fixed companions attack independently and reset their timers on restart', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(
      isolatedCompanionOptions(companion, {
        [companion.intervalOptionKey]: 0.6,
      }),
    );

    model.spawnEnemy({ hp: 100, speed: 0 });
    assert.equal(model.tick(1).attackEvents.length, 0, companion.id);

    model.startBattle();
    const target = model.spawnEnemy({ hp: 100, speed: 0 });
    const first = companionEvents(model, 0.01, companion.source);

    assert.equal(first.length, 1, companion.id);
    assert.equal(first[0].damage, companion.damage, companion.id);
    assert.equal(model.findEnemy(target.id)?.hp, 100 - companion.damage, companion.id);
    assert.equal(companionEvents(model, 0.58, companion.source).length, 0, companion.id);
    assert.equal(companionEvents(model, 0.02, companion.source).length, 1, companion.id);

    model.startBattle();
    model.spawnEnemy({ hp: 100, speed: 0 });
    assert.equal(companionEvents(model, 0.01, companion.source).length, 1, companion.id);
  }
});

runTest('battle tick ignores non-finite and non-positive deltas without polluting state', () => {
  const invalidDeltas = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, -0.1];

  for (const deltaSeconds of invalidDeltas) {
    const model = new BattleMvpModel({
      waveInterval: 99,
      mainAttackDamage: 0,
      heroBaseDps: 0,
      qinglanAttackDamage: 0,
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

runTest('fixed companions do not attack after game over even when running remains true', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(isolatedCompanionOptions(companion));
    model.startBattle();
    const target = model.spawnEnemy({ hp: 100, speed: 0 });
    model.gameOver = true;
    model.running = true;

    assert.equal(companionEvents(model, 1, companion.source).length, 0, companion.id);
    assert.equal(target.hp, 100, companion.id);
  }
});

runTest('thunder mage preserves large-frame overshoot without attacking twice in one tick', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 7,
    companionAttackInterval: 0.6,
    qinglanAttackDamage: 0,
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

runTest('fixed companions stay ready while no living target exists', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(isolatedCompanionOptions(companion));
    model.startBattle();
    assert.equal(companionEvents(model, 2, companion.source).length, 0, companion.id);

    model.spawnEnemy({ hp: 100, speed: 0 });
    assert.equal(companionEvents(model, 0.01, companion.source).length, 1, companion.id);
    assert.equal(companionEvents(model, 0.01, companion.source).length, 0, companion.id);
  }
});

runTest('fixed companions target the living enemy closest to the city wall', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(isolatedCompanionOptions(companion));
    model.startBattle();
    const fartherFromWall = model.spawnEnemy({ x: 0, y: 0, hp: 100, speed: 0 });
    const closerToWall = model.spawnEnemy({ x: 300, y: -190, hp: 100, speed: 0 });
    const events = companionEvents(model, 0.01, companion.source);

    assert.equal(events[0].enemyId, closerToWall.id, companion.id);
    assert.equal(model.findEnemy(closerToWall.id)?.hp, 100 - companion.damage, companion.id);
    assert.equal(model.findEnemy(fartherFromWall.id)?.hp, 100, companion.id);
  }
});

runTest('drummer aura shortens every fixed companion actual attack cadence', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(
      isolatedCompanionOptions(companion, {
        [companion.intervalOptionKey]: 0.6,
      }),
    );
    model.placeHero(0, '鼓手');
    assert.ok(model.getFixedCompanionAttackInterval(companion.id) < 0.6, companion.id);

    model.startBattle();
    model.spawnEnemy({ hp: 100, speed: 0 });
    assert.equal(companionEvents(model, 0.01, companion.source).length, 1, companion.id);
    assert.equal(companionEvents(model, 0.52, companion.source).length, 0, companion.id);
    assert.equal(companionEvents(model, 0.02, companion.source).length, 1, companion.id);
  }
});

runTest('fixed companion intervals ignore an invalid drummer aura', () => {
  for (const companion of FIXED_COMPANION_CASES) {
    const model = new BattleMvpModel(
      isolatedCompanionOptions(companion, {
        [companion.intervalOptionKey]: 0.6,
      }),
    );
    const drummer = model.placeHero(0, '鼓手');
    assert.ok(drummer, companion.id);
    drummer.level = Number.POSITIVE_INFINITY;
    assert.equal(model.getFixedCompanionAttackInterval(companion.id), 0.6, companion.id);
  }
});

runTest('fixed companions fall back to their configured base interval before valid aura', () => {
  const invalidIntervals = [Number.NaN, Number.POSITIVE_INFINITY, 0, -0.6];
  for (const companion of FIXED_COMPANION_CASES) {
    for (const invalidInterval of invalidIntervals) {
      const model = new BattleMvpModel(
        isolatedCompanionOptions(companion, {
          [companion.intervalOptionKey]: invalidInterval,
        }),
      );
      model.placeHero(0, '鼓手');
      const expectedInterval = companion.interval / 1.12;
      assert.ok(
        Math.abs(model.getFixedCompanionAttackInterval(companion.id) - expectedInterval) < 0.000001,
        companion.id,
      );
    }
  }
});

runTest('qinglan attacks remain single-target and apply no status effects', () => {
  const qinglan = FIXED_COMPANION_CASES.find((companion) => companion.id === 'hero_qinglan');
  assert.ok(qinglan);
  const model = new BattleMvpModel(isolatedCompanionOptions(qinglan, { random: () => 0 }));
  model.startBattle();
  model.applyUpgradeCard('fire_spread_plus_1');
  model.applyUpgradeCard('thunder_chain_plus_1');
  const primary = model.spawnEnemy({ x: 0, y: -190, hp: 100, speed: 0 });
  const secondary = model.spawnEnemy({ x: 20, y: -180, hp: 100, speed: 0 });
  const events = companionEvents(model, 0.01, qinglan.source);

  assert.equal(events.length, 1);
  assert.equal(events[0].impactKind, 'primary');
  assert.equal(
    events.some((event) => event.impactKind === 'splash'),
    false,
  );
  assert.equal(primary.burnStacks, 0);
  assert.equal(primary.poisonStacks, 0);
  assert.equal(primary.slowMultiplier, 1);
  assert.equal(secondary.hp, 100);
});

runTest('thunder mage damage applies vulnerability before subtracting armor', () => {
  const model = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
    companionAttackDamage: 7,
    qinglanAttackDamage: 0,
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
    qinglanAttackDamage: 0,
    random: () => 0,
  });

  model.startBattle();
  model.applyUpgradeCard('thunder_chain_plus_1');
  const primary = model.spawnEnemy({ x: 0, y: -190, hp: 100, speed: 0 });
  const secondary = model.spawnEnemy({ x: 20, y: -180, hp: 100, speed: 0 });
  const tick = model.tick(0.01);

  assert.deepEqual(
    tick.attackEvents.map((event) => event.source),
    ['companion'],
  );
  assert.equal(primary.burnStacks, 0);
  assert.equal(secondary.hp, 100);
});

runTest('default enemy tuning is slower and less punishing for readable mobile combat', () => {
  const model = new BattleMvpModel();
  const enemyConfigs = model.getEnemyConfigs();
  const fast = enemyConfigs.find((enemy) => enemy.kind === 'fast');
  const boss = enemyConfigs.find((enemy) => enemy.kind === 'boss');

  assert.equal(model.options.enemyBaseSpeed, 30);
  assert.equal(model.options.enemyDamage, 0.5);
  assert.equal(model.options.enemyBaseHp, 24);
  assert.equal(model.options.cityLineY, -235);
  assert.equal(model.options.companionAttackInterval, 0.85);
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
    qinglanAttackDamage: 0,
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
    qinglanAttackDamage: 0,
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
    qinglanAttackDamage: 0,
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
    qinglanAttackDamage: 0,
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

runTest('raises only waves 1-3 enemy health by fifteen percent', () => {
  const waveModel = new BattleMvpModel({ enemyBaseHp: 100 });
  const directSpawnModel = new BattleMvpModel({ enemyBaseHp: 100 });

  const wave1 = waveModel.spawnWave();
  const wave2 = waveModel.spawnWave();
  const wave3 = waveModel.spawnWave();
  const wave4 = waveModel.spawnWave();
  const wave5 = waveModel.spawnWave();
  const wave6 = waveModel.spawnWave();

  assert.equal(wave1[0].maxHp, 100 * 0.9 * 0.65 * 1.15);
  assert.equal(wave1[0].hp, wave1[0].maxHp);
  assert.equal(wave2[0].maxHp, 100 * 0.9 * 0.7 * 1.15);
  assert.equal(wave2[1].maxHp, 100 * 0.6 * 0.7 * 1.15);
  assert.equal(wave2[1].hp, wave2[1].maxHp);
  assert.equal(wave3[0].maxHp, 100 * 0.9 * 0.75 * 1.15);
  assert.equal(wave3[1].maxHp, 100 * 0.6 * 0.75 * 1.15);
  assert.equal(wave3[1].hp, wave3[1].maxHp);
  assert.equal(wave3[2].maxHp, 100 * 1.8 * 0.75 * 1.15);
  assert.equal(wave3[2].hp, wave3[2].maxHp);
  assert.equal(wave4[0].maxHp, 100 * 1.8 * 0.8);
  assert.equal(wave5[0].maxHp, 100 * 7);
  assert.equal(wave5[0].hp, wave5[0].maxHp);
  assert.equal(wave6[0].maxHp, 100 * 0.9 * 0.81);
  assert.equal(wave6[0].hp, wave6[0].maxHp);
  assert.equal(directSpawnModel.spawnEnemy({ kind: 'normal' }).maxHp, 90);
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

runTest('summon build keeps two ordinary slots and turns its card into DPS gains', () => {
  const model = new BattleMvpModel({
    heroBaseDps: 5,
  });

  model.placeHero(0, '弓手');
  model.placeHero(1, '火药师');

  assert.equal(model.getHeroes().length, 2);
  assert.equal(model.placeHero(3, '毒师'), undefined);

  assert.equal(model.applyUpgradeCard('summon_slots_plus_1'), false);
  assert.equal(model.placeHero(4, '毒师'), undefined);
  assert.equal(model.getHeroes().length, 2);

  const dpsBeforeDamageCard = model.getTotalHeroDps();
  model.applyUpgradeCard('summon_hero_damage_20');
  assert.ok(model.getTotalHeroDps() > dpsBeforeDamageCard);

  model.placeHero(0, '弓手');

  const archer = model.getHeroes().find((hero) => hero.name === '弓手');
  assert.equal(archer?.level, 2);
});

runTest('default prototype coordinates fit the Cocos 720x1280 portrait preview viewport', () => {
  const model = new BattleMvpModel();
  const halfWidth = 360;
  const halfHeight = 640;

  assert.ok(model.options.enemyStartY <= halfHeight);
  assert.ok(model.options.cityLineY >= -halfHeight);
  assert.ok(model.playerPosition.y >= -halfHeight);
  assert.equal(model.options.cityLineY, -235);
  assert.ok(model.options.cityLineY > model.slots[0].position.y);

  for (const slot of model.slots) {
    assert.ok(slot.position.x >= -halfWidth);
    assert.ok(slot.position.x <= halfWidth);
    assert.ok(slot.position.y >= -halfHeight);
    assert.ok(slot.position.y <= halfHeight);
  }
});

runTest('attack events expose stable presentation metadata for every attacker', () => {
  const mainModel = new BattleMvpModel({
    waveInterval: 99,
    heroBaseDps: 0,
    companionAttackDamage: 0,
    qinglanAttackDamage: 0,
    random: () => 1,
  });
  mainModel.startBattle();
  const mainTarget = mainModel.spawnEnemy({ x: 36, y: -150, hp: 5, speed: 0 });
  const mainEvent = mainModel.tick(0.01).attackEvents[0];
  assert.deepEqual(mainEvent.originPosition, mainModel.playerPosition);
  assert.equal(mainEvent.impactKind, 'primary');
  assert.equal(mainEvent.targetKind, mainTarget.kind);
  assert.equal(mainEvent.killed, true);

  const companionModel = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    heroBaseDps: 0,
  });
  companionModel.startBattle();
  companionModel.spawnEnemy({ hp: 100, speed: 0 });
  const companionEvent = companionModel.tick(0.01).attackEvents[0];
  assert.equal(companionEvent.heroName, '雷法师');
  assert.deepEqual(companionEvent.originPosition, companionModel.getFixedCompanion().position);
  assert.equal(companionEvent.impactKind, 'primary');

  const heroModel = new BattleMvpModel({
    waveInterval: 99,
    mainAttackDamage: 0,
    companionAttackDamage: 0,
    qinglanAttackDamage: 0,
    heroBaseDps: 20,
  });
  const hero = heroModel.placeHero(0, '火药师');
  assert.ok(hero);
  heroModel.startBattle();
  heroModel.spawnEnemy({ x: -15, y: -180, hp: 100, speed: 0 });
  heroModel.spawnEnemy({ x: 5, y: -175, hp: 100, speed: 0 });
  const heroEvents = heroModel
    .tick(0.1)
    .attackEvents.filter((event) => event.source === 'hero_dps');
  const primary = heroEvents.find((event) => event.impactKind === 'primary');
  const splash = heroEvents.find((event) => event.impactKind === 'splash');
  assert.equal(primary?.heroId, hero?.id);
  assert.equal(primary?.heroName, '火药师');
  assert.equal(primary?.heroRole, 'area');
  assert.deepEqual(primary?.originPosition, heroModel.slots[0].position);
  assert.equal(splash?.heroId, hero?.id);
  assert.equal(splash?.impactKind, 'splash');
});
