import type { EnemyKind } from './BattleConfig';

export type UnitAnimationState =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'cast'
  | 'hit'
  | 'death'
  | 'spawn'
  | 'attack_city'
  | 'boss_intro'
  | 'boss_attack'
  | 'victory';

export type UnitAnimationRenderer = 'procedural' | 'spine';
export type UnitAnimationSubject = 'hero' | 'enemy' | 'boss';

export interface UnitAnimationClipSpec {
  state: UnitAnimationState;
  clipName: string;
  loop: boolean;
  duration: number;
  priority: number;
  interruptible: boolean;
  speed?: number;
}

export interface UnitAnimationProfile {
  id: string;
  displayName: string;
  subject: UnitAnimationSubject;
  renderer: UnitAnimationRenderer;
  spineAssetBase?: string;
  clips: UnitAnimationClipSpec[];
}

export const SPINE_ASSET_REQUIREMENTS = ['.json/.skel', '.png', '.txt/.atlas'] as const;
export const SUPPORTED_SPINE_VERSION = '3.8';

export const REQUIRED_ENEMY_ANIMATION_STATES: UnitAnimationState[] = [
  'idle',
  'spawn',
  'walk',
  'attack_city',
  'hit',
  'death',
];

export const REQUIRED_HERO_ANIMATION_STATES: UnitAnimationState[] = [
  'idle',
  'attack',
  'cast',
  'hit',
  'death',
  'victory',
];

export const UNIT_ANIMATION_PRIORITY: Record<UnitAnimationState, number> = {
  idle: 0,
  walk: 1,
  spawn: 2,
  victory: 2,
  attack_city: 3,
  attack: 4,
  cast: 4,
  boss_attack: 5,
  boss_intro: 6,
  hit: 7,
  death: 10,
};

function clip(
  state: UnitAnimationState,
  duration: number,
  loop = false,
  clipName: string = state,
): UnitAnimationClipSpec {
  return {
    state,
    clipName,
    loop,
    duration,
    priority: UNIT_ANIMATION_PRIORITY[state],
    interruptible: state !== 'death',
  };
}

function enemyProfile(id: string, displayName: string, subject: UnitAnimationSubject): UnitAnimationProfile {
  const clips = [
    clip('idle', subject === 'boss' ? 1.1 : 0.8, true),
    clip('spawn', subject === 'boss' ? 0.72 : 0.34),
    clip('walk', 0.7, true),
    clip('attack_city', subject === 'boss' ? 0.95 : 0.55, true),
    clip('hit', 0.16),
    clip('death', subject === 'boss' ? 0.9 : 0.42),
  ];

  if (subject === 'boss') {
    clips.push(clip('boss_intro', 1.1, false, 'intro'));
    clips.push(clip('boss_attack', 1.05, true, 'attack'));
  }

  return {
    id,
    displayName,
    subject,
    renderer: 'procedural',
    spineAssetBase: `spine/${id}/${id}`,
    clips,
  };
}

function heroProfile(id: string, displayName: string): UnitAnimationProfile {
  return {
    id,
    displayName,
    subject: 'hero',
    renderer: 'procedural',
    spineAssetBase: `spine/${id}/${id}`,
    clips: [
      clip('idle', 0.9, true),
      clip('attack', 0.34),
      clip('cast', 0.52),
      clip('hit', 0.18),
      clip('death', 0.58),
      clip('victory', 0.85, true),
    ],
  };
}

export const PLAYER_ANIMATION_PROFILE: UnitAnimationProfile = heroProfile('hero_main', '主角');

export const HERO_ANIMATION_PROFILES: Record<string, UnitAnimationProfile> = {
  弓手: heroProfile('hero_archer', '弓手'),
  火药师: heroProfile('hero_gunner', '火药师'),
  冰法师: heroProfile('hero_ice_mage', '冰法师'),
  毒师: heroProfile('hero_poisoner', '毒师'),
  护卫: heroProfile('hero_guard', '护卫'),
  鼓手: heroProfile('hero_drummer', '鼓手'),
  治疗师: heroProfile('hero_healer', '治疗师'),
  咒术师: heroProfile('hero_warlock', '咒术师'),
};

export const ENEMY_ANIMATION_PROFILES: Record<EnemyKind, UnitAnimationProfile> = {
  normal: enemyProfile('enemy_normal', '普通', 'enemy'),
  fast: enemyProfile('enemy_fast', '快速', 'enemy'),
  tank: enemyProfile('enemy_tank', '厚血', 'enemy'),
  ranged: enemyProfile('enemy_ranged', '远程', 'enemy'),
  boss: enemyProfile('enemy_boss_sandlord', '沙漠魔君', 'boss'),
};

export function getEnemyAnimationProfile(kind: EnemyKind): UnitAnimationProfile {
  return ENEMY_ANIMATION_PROFILES[kind] ?? ENEMY_ANIMATION_PROFILES.normal;
}

export function getHeroAnimationProfile(heroName: string): UnitAnimationProfile {
  return HERO_ANIMATION_PROFILES[heroName] ?? PLAYER_ANIMATION_PROFILE;
}

export function getAnimationClipSpec(
  profile: UnitAnimationProfile,
  state: UnitAnimationState,
): UnitAnimationClipSpec {
  return (
    profile.clips.find((clipSpec) => clipSpec.state === state) ??
    profile.clips.find((clipSpec) => clipSpec.state === 'idle') ??
    profile.clips[0]
  );
}
