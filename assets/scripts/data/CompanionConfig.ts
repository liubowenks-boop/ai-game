import { BATTLE_WALL_LAYOUT } from './BattleTerrainConfig';
import type { BattleVfxPresetId } from './BattleVfxConfig';

export type FixedCompanionId = 'hero_thunder_mage' | 'hero_qinglan';
export type FixedCompanionAttackSource = 'companion' | 'qinglan_companion';
export type FixedCompanionDamageOptionKey = 'companionAttackDamage' | 'qinglanAttackDamage';
export type FixedCompanionIntervalOptionKey = 'companionAttackInterval' | 'qinglanAttackInterval';
export type FixedCompanionAnimationProfileId = FixedCompanionId;

export interface FixedCompanionConfig {
  id: FixedCompanionId;
  name: '雷法师' | '灵符道君·青岚';
  description: string;
  slotIndex: 2 | 3;
  position: { x: number; y: number };
  attackSource: FixedCompanionAttackSource;
  attackDamage: number;
  attackInterval: number;
  runtimeOptionKeys: {
    damage: FixedCompanionDamageOptionKey;
    interval: FixedCompanionIntervalOptionKey;
  };
  animationProfileId: FixedCompanionAnimationProfileId;
  vfxPresetId: BattleVfxPresetId;
  spineSourceDuration: number;
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
  runtimeOptionKeys: {
    damage: 'qinglanAttackDamage',
    interval: 'qinglanAttackInterval',
  },
  animationProfileId: 'hero_qinglan',
  vfxPresetId: 'qinglan_talisman',
  spineSourceDuration: 1,
  displayScale: 0.255,
  spineAssetBase: 'spine/hero_qinglan/hero_qinglan',
  rootNodeName: 'QinglanCompanion',
  spineNodeName: 'QinglanAttackSpine',
};

export const FIXED_COMPANIONS = [THUNDER_MAGE_COMPANION, QINGLAN_COMPANION] as const;

function assertUniqueRegistration(label: string, values: readonly (string | number)[]): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Duplicate fixed companion ${label} registration`);
  }
}

assertUniqueRegistration(
  'id',
  FIXED_COMPANIONS.map((companion) => companion.id),
);
assertUniqueRegistration(
  'slot',
  FIXED_COMPANIONS.map((companion) => companion.slotIndex),
);
assertUniqueRegistration(
  'attack source',
  FIXED_COMPANIONS.map((companion) => companion.attackSource),
);
assertUniqueRegistration(
  'damage option',
  FIXED_COMPANIONS.map((companion) => companion.runtimeOptionKeys.damage),
);
assertUniqueRegistration(
  'interval option',
  FIXED_COMPANIONS.map((companion) => companion.runtimeOptionKeys.interval),
);
assertUniqueRegistration(
  'animation profile',
  FIXED_COMPANIONS.map((companion) => companion.animationProfileId),
);

export function getFixedCompanionConfig(id: FixedCompanionId): FixedCompanionConfig {
  const companion = FIXED_COMPANIONS.find((candidate) => candidate.id === id);
  if (!companion) {
    throw new Error(`Missing fixed companion config: ${id}`);
  }
  return companion;
}

export function getFixedCompanionByAttackSource(
  source: FixedCompanionAttackSource,
): FixedCompanionConfig {
  const companion = findFixedCompanionByAttackSource(source);
  if (!companion) {
    throw new Error(`Missing fixed companion VFX registration: ${source}`);
  }
  return companion;
}

export function findFixedCompanionByAttackSource(source: string): FixedCompanionConfig | undefined {
  return FIXED_COMPANIONS.find((candidate) => candidate.attackSource === source);
}
