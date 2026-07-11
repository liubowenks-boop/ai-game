import { BATTLE_WALL_LAYOUT } from './BattleTerrainConfig';

export interface FixedCompanionConfig {
  id: 'hero_thunder_mage';
  name: '雷法师';
  description: string;
  slotIndex: 3;
  position: { x: number; y: number };
  attackDamage: number;
  attackInterval: number;
  displayScale: number;
  spineAssetBase: string;
}

export const THUNDER_MAGE_COMPANION: FixedCompanionConfig = {
  id: 'hero_thunder_mage',
  name: '雷法师',
  description: '雷电速攻支援',
  slotIndex: 3,
  position: { ...BATTLE_WALL_LAYOUT.thunderMage },
  attackDamage: 7,
  attackInterval: 0.85,
  displayScale: 0.22,
  spineAssetBase: 'spine/hero_thunder_mage/hero_thunder_mage',
};
