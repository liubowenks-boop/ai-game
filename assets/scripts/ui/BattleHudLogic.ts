import { BattleHudConfig } from './BattleHudConfig';

export interface BattleHudStateInput {
  wave: number;
  remainingEnemies: number;
  cityHealth: number;
  cityMaxHealth: number;
  bossHealth?: number;
  bossMaxHealth?: number;
  gold: number;
  ultimate: number;
  paused: boolean;
  running: boolean;
  gameOver: boolean;
}

export function clampHudRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

export function getDisplayWave(wave: number): number {
  if (!Number.isFinite(wave) || wave <= 0) {
    return 0;
  }
  const normalizedWave = Math.floor(wave);
  return ((normalizedWave - 1) % BattleHudConfig.totalWaves) + 1;
}

export function formatHudInteger(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return safeValue.toLocaleString('en-US');
}

function toPercentText(ratio: number): string {
  return `${Math.round(clampHudRatio(ratio) * 100)}%`;
}

export function createBattleHudDisplayState(input: BattleHudStateInput) {
  const displayWave = getDisplayWave(input.wave);
  const cityRatio = clampHudRatio(
    input.cityMaxHealth > 0 ? input.cityHealth / input.cityMaxHealth : 0,
  );
  const ultimate = Number.isFinite(input.ultimate)
    ? Math.min(BattleHudConfig.maximumUltimate, Math.max(0, Math.floor(input.ultimate)))
    : 0;
  const hasBoss =
    typeof input.bossHealth === 'number' &&
    Number.isFinite(input.bossHealth) &&
    typeof input.bossMaxHealth === 'number' &&
    Number.isFinite(input.bossMaxHealth) &&
    input.bossMaxHealth > 0;
  const bossRatio = hasBoss
    ? clampHudRatio((input.bossHealth as number) / (input.bossMaxHealth as number))
    : 0;

  return {
    waveText: `第 ${displayWave} / ${BattleHudConfig.totalWaves} 波`,
    remainingEnemiesText: formatHudInteger(input.remainingEnemies),
    goldText: formatHudInteger(input.gold),
    ultimateText: `${formatHudInteger(ultimate)} / ${BattleHudConfig.maximumUltimate}`,
    cityRatio,
    cityPercentText: toPercentText(cityRatio),
    boss: hasBoss
      ? {
          ratio: bossRatio,
          percentText: toPercentText(bossRatio),
        }
      : null,
    controlImage:
      input.running && !input.paused && !input.gameOver
        ? 'hud_pause_button.png'
        : 'hud_resume_button.png',
  };
}

export type BattleHudDisplayState = ReturnType<typeof createBattleHudDisplayState>;
