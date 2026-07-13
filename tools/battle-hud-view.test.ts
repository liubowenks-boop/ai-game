import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('assets/scripts/ui/BattleHudView.ts', 'utf8');
const sharedComponents = readFileSync('assets/scripts/ui/BattleUiComponents.ts', 'utf8');

assert.match(view, /export class BattleHudView/);
assert.match(view, /BattleHudDisplayState/);
for (const filename of [
  'hud_wave_panel.png',
  'hud_remaining_enemies.png',
  'hud_gold_panel.png',
  'hud_boss_title.png',
  'hud_boss_health_frame.png',
  'hud_city_durability_frame.png',
  'hud_pause_button.png',
  'hud_resume_button.png',
  'hud_auto_button_custom.png',
  'hud_bond_button_custom.png',
  'hud_statistics_button.png',
  'hud_ultimate_badge_custom.png',
]) {
  assert.ok(view.includes(filename), filename);
}
assert.match(view, /new Node\('BossProgressOverlay'\)/);
assert.match(view, /new Node\('CityProgressOverlay'\)/);
assert.match(view, /state\.boss === null/);
assert.match(view, /this\.bossTitleNode\.active = bossVisible/);
assert.match(view, /this\.bossHealthNode\.active = bossVisible/);
assert.match(view, /setUiArtSkinFilename\(this\.pauseResumeSkin, state\.controlImage\)/);
assert.match(view, /private drawProgress\(/);
assert.match(view, /ratio > 0\.55/);
assert.match(view, /ratio > 0\.28/);
assert.match(view, /Button\.EventType\.CLICK/);
assert.match(
  view,
  /\[\s*this\.pauseResumeNode,\s*this\.autoNode,\s*this\.statisticsNode,\s*this\.bondNode,\s*this\.ultimateNode,?\s*\]/s,
);
assert.match(sharedComponents, /export function setUiArtSkinFilename\(/);
assert.doesNotMatch(view, /hud_(?:top_frame|resource_chip|boss_hp_bg|city_hp_bg|combo_plate)/);

console.log('pass: image-backed battle HUD view structure');
