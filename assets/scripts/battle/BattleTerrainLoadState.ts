import {
  BattleTerrainLayerId,
  BattleTerrainLayerSpec,
} from '../data/BattleTerrainConfig';

export type BattleTerrainLayerStatus = 'pending' | 'ready' | 'failed';
export type BattleTerrainMode = 'loading' | 'modular' | 'legacy';
export type BattleTerrainLoadState = Record<BattleTerrainLayerId, BattleTerrainLayerStatus>;

export function createBattleTerrainLoadState(
  specs: readonly BattleTerrainLayerSpec[],
): BattleTerrainLoadState {
  return Object.fromEntries(specs.map((spec) => [spec.id, 'pending'])) as BattleTerrainLoadState;
}

export function resolveBattleTerrainMode(
  state: BattleTerrainLoadState,
  specs: readonly BattleTerrainLayerSpec[],
): BattleTerrainMode {
  const requiredSpecs = specs.filter((spec) => spec.required);

  if (requiredSpecs.some((spec) => state[spec.id] === 'failed')) {
    return 'legacy';
  }

  if (requiredSpecs.every((spec) => state[spec.id] === 'ready')) {
    return 'modular';
  }

  return 'loading';
}
