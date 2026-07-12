import { BATTLE_WALL_LAYOUT } from './BattleTerrainConfig';

export type FixedCompanionId = 'hero_thunder_mage' | 'hero_qinglan';
export type FixedCompanionAttackSource = 'companion' | 'qinglan_companion';

export interface FixedCompanionConfig {
  id: FixedCompanionId;
  name: '雷法师' | '灵符道君·青岚';
  description: string;
  slotIndex: 2 | 3;
  position: { x: number; y: number };
  attackSource: FixedCompanionAttackSource;
  attackDamage: number;
  attackInterval: number;
  displayScale: number;
  spineAssetBase: string;
  rootNodeName: string;
  spineNodeName: string;
}

export const THUNDER_MAGE_COMPANION: FixedCompanionConfig = {
  id: 'hero_thunder_mage',
  name: '雷法师',
  description: '雷电速攻支援',
  slotIndex: 2,
  position: { ...BATTLE_WALL_LAYOUT.thunderMage },
  attackSource: 'companion',
  attackDamage: 7,
  attackInterval: 0.85,
  displayScale: 0.286,
  spineAssetBase: 'spine/hero_thunder_mage/hero_thunder_mage',
  rootNodeName: 'ThunderMageCompanion',
  spineNodeName: 'ThunderMageAttackSpine',
};

export const QINGLAN_COMPANION: FixedCompanionConfig = {
  id: 'hero_qinglan',
  name: '灵符道君·青岚',
  description: '青岚灵符单体支援',
  slotIndex: 3,
  position: { ...BATTLE_WALL_LAYOUT.qinglan },
  attackSource: 'qinglan_companion',
  attackDamage: 8,
  attackInterval: 1,
  displayScale: 0.255,
  spineAssetBase: 'spine/hero_qinglan/hero_qinglan',
  rootNodeName: 'QinglanCompanion',
  spineNodeName: 'QinglanAttackSpine',
};

export const FIXED_COMPANIONS = [THUNDER_MAGE_COMPANION, QINGLAN_COMPANION] as const;
