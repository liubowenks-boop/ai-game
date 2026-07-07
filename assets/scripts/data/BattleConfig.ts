export type BuildSchool = 'fire' | 'thunder' | 'summon';

export type UpgradeCardId =
  | 'fire_burn_damage_30'
  | 'fire_spread_plus_1'
  | 'thunder_chain_plus_1'
  | 'thunder_crit_plus_10'
  | 'summon_slots_plus_1'
  | 'summon_hero_damage_20';

export type EnemyKind = 'normal' | 'fast' | 'tank' | 'ranged' | 'boss';

export type HeroRole = 'single' | 'area' | 'slow' | 'poison' | 'guard' | 'aura' | 'heal' | 'debuff';

export interface HeroConfig {
  name: string;
  role: HeroRole;
  description: string;
  dpsScale: number;
  radius?: number;
  slowMultiplier?: number;
  slowDuration?: number;
  poisonDps?: number;
  healPerSecond?: number;
  auraAttackSpeed?: number;
  vulnerability?: number;
}

export interface EnemyConfig {
  kind: EnemyKind;
  label: string;
  hpMultiplier: number;
  speedMultiplier: number;
  damageMultiplier: number;
  armor: number;
  radius: number;
  rangedBleedDps?: number;
}

export interface UpgradeCardConfig {
  id: UpgradeCardId;
  school: BuildSchool;
  title: string;
  description: string;
}

export const HERO_CONFIGS: HeroConfig[] = [
  {
    name: '弓手',
    role: 'single',
    description: '稳定单体输出',
    dpsScale: 1,
  },
  {
    name: '火药师',
    role: 'area',
    description: '范围爆破',
    dpsScale: 0.85,
    radius: 110,
  },
  {
    name: '冰法师',
    role: 'slow',
    description: '减速控场',
    dpsScale: 0.7,
    slowMultiplier: 0.58,
    slowDuration: 1.6,
  },
  {
    name: '毒师',
    role: 'poison',
    description: '中毒持续伤害',
    dpsScale: 0.65,
    poisonDps: 2.4,
  },
  {
    name: '护卫',
    role: 'guard',
    description: '阻挡并减速近城敌人',
    dpsScale: 0.55,
    slowMultiplier: 0.48,
    slowDuration: 1.2,
  },
  {
    name: '鼓手',
    role: 'aura',
    description: '提高全队输出节奏',
    dpsScale: 0.35,
    auraAttackSpeed: 0.12,
  },
  {
    name: '治疗师',
    role: 'heal',
    description: '缓慢回复城池',
    dpsScale: 0.25,
    healPerSecond: 1.1,
  },
  {
    name: '咒术师',
    role: 'debuff',
    description: '破防增伤',
    dpsScale: 0.65,
    vulnerability: 0.18,
  },
];

export const ENEMY_CONFIGS: EnemyConfig[] = [
  {
    kind: 'normal',
    label: '普通',
    hpMultiplier: 0.9,
    speedMultiplier: 0.9,
    damageMultiplier: 1,
    armor: 0,
    radius: 26,
  },
  {
    kind: 'fast',
    label: '快速',
    hpMultiplier: 0.68,
    speedMultiplier: 1.18,
    damageMultiplier: 0.9,
    armor: 0,
    radius: 23,
  },
  {
    kind: 'tank',
    label: '厚血',
    hpMultiplier: 2.25,
    speedMultiplier: 0.52,
    damageMultiplier: 1.15,
    armor: 1.2,
    radius: 30,
  },
  {
    kind: 'ranged',
    label: '远程',
    hpMultiplier: 1.15,
    speedMultiplier: 0.68,
    damageMultiplier: 0.95,
    armor: 0.35,
    radius: 27,
    rangedBleedDps: 0.25,
  },
  {
    kind: 'boss',
    label: 'Boss',
    hpMultiplier: 8.5,
    speedMultiplier: 0.34,
    damageMultiplier: 5.5,
    armor: 1.8,
    radius: 46,
  },
];

export const UPGRADE_CARD_CONFIGS: UpgradeCardConfig[] = [
  {
    id: 'fire_burn_damage_30',
    school: 'fire',
    title: '烈焰火墙+',
    description: '灼烧伤害+30%\n火势更猛',
  },
  {
    id: 'fire_spread_plus_1',
    school: 'fire',
    title: '火焰扩散+',
    description: '额外点燃+1\n压制怪潮',
  },
  {
    id: 'thunder_chain_plus_1',
    school: 'thunder',
    title: '连锁闪电+',
    description: '弹射次数+1\n清场更快',
  },
  {
    id: 'thunder_crit_plus_10',
    school: 'thunder',
    title: '雷霆暴击+',
    description: '暴击率+10%\n爆发提高',
  },
  {
    id: 'summon_slots_plus_1',
    school: 'summon',
    title: '召唤灵兽+',
    description: '上阵英雄+1\n阵容变厚',
  },
  {
    id: 'summon_hero_damage_20',
    school: 'summon',
    title: '灵兽攻击+',
    description: '英雄攻击+20%\n输出成长',
  },
];
