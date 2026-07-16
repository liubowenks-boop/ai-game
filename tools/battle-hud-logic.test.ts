import assert from 'node:assert/strict';

import {
  BattleHudConfig,
  getCityGemPaletteName,
  getRightControlRects,
  hudRectsOverlap,
} from '../assets/scripts/ui/BattleHudConfig';
import {
  clampHudRatio,
  createBattleHudDisplayState,
  formatHudInteger,
  getDisplayWave,
} from '../assets/scripts/ui/BattleHudLogic';

assert.equal(BattleHudConfig.totalWaves, 50);

const halfSizedHud = {
  wave: { width: 150, height: 35 },
  gold: { width: 134, height: 35 },
  bossTitle: { width: 75, height: 30 },
  bond: { width: 55, height: 55 },
} as const;
for (const [name, expectedSize] of Object.entries(halfSizedHud)) {
  const actual = BattleHudConfig.layout[name as keyof typeof halfSizedHud];
  assert.equal(actual.width, expectedSize.width, `${name} width`);
  assert.equal(actual.height, expectedSize.height, `${name} height`);
}

assert.deepEqual(BattleHudConfig.layout.remainingEnemies, {
  x: 0,
  y: 45,
  width: 150,
  height: 60,
});
assert.equal(
  BattleHudConfig.layout.remainingEnemies.x + BattleHudConfig.layout.remainingEnemies.width,
  BattleHudConfig.layout.wave.x + BattleHudConfig.layout.wave.width,
);
assert.deepEqual(BattleHudConfig.layout.bossTitle, { x: 322.5, y: 34, width: 75, height: 30 });
assert.deepEqual(BattleHudConfig.layout.bossHealth, { x: 158, y: 66, width: 404, height: 76 });
assert.deepEqual(BattleHudConfig.layout.cityDurability, {
  x: 90,
  y: 1040,
  width: 540,
  height: 64,
});
assert.deepEqual(BattleHudConfig.layout.ultimate, {
  x: 590,
  y: 1130,
  width: 124,
  height: 124,
});
assert.equal(BattleHudConfig.layout.wave.x, 0);
assert.equal(BattleHudConfig.layout.wave.y, 4);
assert.equal(BattleHudConfig.layout.gold.x + BattleHudConfig.layout.gold.width, 708);
assert.equal(BattleHudConfig.layout.gold.y, 4);
assert.equal(BattleHudConfig.layout.bond.x, 10);
assert.equal(BattleHudConfig.layout.bond.y + BattleHudConfig.layout.bond.height, 1252);
assert.equal(BattleHudConfig.layout.bossTitle.x + BattleHudConfig.layout.bossTitle.width / 2, 360);
assert.deepEqual(BattleHudConfig.valueLabels, {
  wave: { x: 0, y: 0, width: 150, height: 21 },
  remainingEnemies: { x: 0, y: -14, width: 100, height: 28 },
  gold: { x: 21, y: 0, width: 77, height: 20 },
});
assert.equal(BattleHudConfig.fontSizes.wave, 12.5);
assert.equal(BattleHudConfig.fontSizes.remainingEnemies, 22);
assert.equal(BattleHudConfig.fontSizes.gold, 13);

assert.deepEqual(BattleHudConfig.rightControls, {
  right: 14,
  top: 92,
  itemWidth: 52,
  itemHeight: 52,
  spacing: 0,
  pauseSkinWidth: 48,
  pauseSkinHeight: 48,
});
const rightControls = getRightControlRects();
assert.deepEqual(rightControls, {
  pauseResume: { x: 654, y: 92, width: 52, height: 52 },
  auto: { x: 654, y: 144, width: 52, height: 52 },
  statistics: { x: 654, y: 196, width: 52, height: 52 },
});
assert.equal(rightControls.pauseResume.y + rightControls.pauseResume.height, rightControls.auto.y);
assert.equal(rightControls.auto.y + rightControls.auto.height, rightControls.statistics.y);

assert.equal(getCityGemPaletteName(1), 'emerald');
assert.equal(getCityGemPaletteName(0.55), 'topaz');
assert.equal(getCityGemPaletteName(0.28), 'ruby');
assert.equal(getCityGemPaletteName(-1), 'ruby');
assert.equal(getCityGemPaletteName(Number.NaN), 'ruby');
assert.equal(BattleHudConfig.gemPalettes.ruby.main[0], 214);
assert.equal(BattleHudConfig.gemPalettes.emerald.main[1], 189);
assert.equal(BattleHudConfig.gemPalettes.topaz.main[0], 235);
assert.equal(getDisplayWave(0), 0);
assert.equal(getDisplayWave(1), 1);
assert.equal(getDisplayWave(50), 50);
assert.equal(getDisplayWave(51), 1);
assert.equal(getDisplayWave(101), 1);
assert.equal(clampHudRatio(-1), 0);
assert.equal(clampHudRatio(Number.NaN), 0);
assert.equal(clampHudRatio(0.75), 0.75);
assert.equal(clampHudRatio(2), 1);
assert.equal(formatHudInteger(1280.9), '1,280');

const state = createBattleHudDisplayState({
  wave: 51,
  remainingEnemies: 7,
  cityHealth: 48,
  cityMaxHealth: 100,
  bossHealth: 75,
  bossMaxHealth: 100,
  gold: 0,
  ultimate: 0,
  paused: false,
  running: true,
  gameOver: false,
});
assert.equal(state.waveText, '第 1 / 50 波');
assert.equal(state.remainingEnemiesText, '7');
assert.equal(state.goldText, '0');
assert.equal(state.ultimateText, '0 / 100');
assert.equal(state.cityPercentText, '48%');
assert.equal(state.boss?.percentText, '75%');
assert.equal(state.controlImage, 'hud_pause_button.png');

const invalidState = createBattleHudDisplayState({
  wave: Number.NaN,
  remainingEnemies: -3,
  cityHealth: Number.NaN,
  cityMaxHealth: 0,
  gold: Number.NaN,
  ultimate: Number.NaN,
  paused: true,
  running: true,
  gameOver: false,
});
assert.equal(invalidState.waveText, '第 0 / 50 波');
assert.equal(invalidState.remainingEnemiesText, '0');
assert.equal(invalidState.ultimateText, '0 / 100');
assert.equal(invalidState.cityRatio, 0);
assert.equal(invalidState.boss, null);
assert.equal(invalidState.controlImage, 'hud_resume_button.png');

const controls = [
  ...Object.values(rightControls),
  BattleHudConfig.layout.bond,
  BattleHudConfig.layout.ultimate,
];
for (const rect of [...Object.values(BattleHudConfig.layout), ...Object.values(rightControls)]) {
  assert.ok(rect.x >= 0 && rect.y >= 0);
  assert.ok(rect.x + rect.width <= BattleHudConfig.designWidth);
  assert.ok(rect.y + rect.height <= BattleHudConfig.designHeight);
}
for (let left = 0; left < controls.length; left += 1) {
  for (let right = left + 1; right < controls.length; right += 1) {
    assert.equal(hudRectsOverlap(controls[left], controls[right]), false);
  }
}

assert.equal(
  hudRectsOverlap(BattleHudConfig.layout.bossTitle, BattleHudConfig.layout.bossHealth),
  false,
);
assert.equal(
  hudRectsOverlap(BattleHudConfig.layout.remainingEnemies, BattleHudConfig.layout.bossHealth),
  false,
);

console.log('pass: battle HUD logic and layout');
