import assert from 'node:assert/strict';

import { BattleHudConfig, hudRectsOverlap } from '../assets/scripts/ui/BattleHudConfig';
import {
  clampHudRatio,
  createBattleHudDisplayState,
  formatHudInteger,
  getDisplayWave,
} from '../assets/scripts/ui/BattleHudLogic';

assert.equal(BattleHudConfig.totalWaves, 50);
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
  BattleHudConfig.layout.pauseResume,
  BattleHudConfig.layout.auto,
  BattleHudConfig.layout.statistics,
  BattleHudConfig.layout.bond,
  BattleHudConfig.layout.ultimate,
];
for (const rect of Object.values(BattleHudConfig.layout)) {
  assert.ok(rect.x >= 0 && rect.y >= 0);
  assert.ok(rect.x + rect.width <= 720);
  assert.ok(rect.y + rect.height <= 1280);
}
for (let left = 0; left < controls.length; left += 1) {
  for (let right = left + 1; right < controls.length; right += 1) {
    assert.equal(hudRectsOverlap(controls[left], controls[right]), false);
  }
}

assert.equal(
  hudRectsOverlap(BattleHudConfig.layout.bossTitle, BattleHudConfig.layout.bossHealth),
  true,
);
assert.equal(
  hudRectsOverlap(BattleHudConfig.layout.remainingEnemies, BattleHudConfig.layout.bossHealth),
  false,
);

console.log('pass: battle HUD logic and layout');
