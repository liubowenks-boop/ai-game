import type { EnemyKind } from './BattleConfig';
import {
  FIXED_COMPANIONS,
  QINGLAN_COMPANION,
  THUNDER_MAGE_COMPANION,
  type FixedCompanionConfig,
  type FixedCompanionAnimationProfileId,
} from './CompanionConfig';

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
  renderer?: UnitAnimationRenderer;
  spineAssetBase?: string;
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
export const PLAYER_ATTACK_SPINE_ASSET_BASE = 'spine/animation/animation';
export const PLAYER_ATTACK_SPINE_CLIP_NAME = 'attack';
export const PLAYER_ATTACK_SPINE_SOURCE_DURATION = 2 / 3;
export const PLAYER_ATTACK_ANIMATION_BASE_DURATION = 0.7;
export const PLAYER_ATTACK_ANIMATION_MIN_DURATION = 0.22;
export const PLAYER_ATTACK_ANIMATION_MAX_DURATION = 1.4;
export const PLAYER_ATTACK_SPINE_DURATION = PLAYER_ATTACK_ANIMATION_BASE_DURATION;
export const PLAYER_ATTACK_SPINE_SPEED =
  PLAYER_ATTACK_SPINE_SOURCE_DURATION / PLAYER_ATTACK_ANIMATION_BASE_DURATION;

export const THUNDER_MAGE_SPINE_SOURCE_DURATION = 1;
export const QINGLAN_SPINE_SOURCE_DURATION = 1;
export const THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION = THUNDER_MAGE_COMPANION.attackInterval;
export const THUNDER_MAGE_ATTACK_ANIMATION_MIN_DURATION = 0.24;
export const THUNDER_MAGE_ATTACK_ANIMATION_MAX_DURATION = 1.2;

export interface FixedCompanionAttackAnimationTiming {
  animationDuration: number;
  spinePlaybackSpeed: number;
}

export type ThunderMageAttackAnimationTiming = FixedCompanionAttackAnimationTiming;

export function resolveFixedCompanionAttackAnimationTiming(
  currentInterval: number,
  sourceDuration = 1,
): FixedCompanionAttackAnimationTiming {
  const safeInterval =
    Number.isFinite(currentInterval) && currentInterval > 0 ? currentInterval : sourceDuration;
  const animationDuration = Math.min(1.2, Math.max(0.24, safeInterval));
  return { animationDuration, spinePlaybackSpeed: sourceDuration / animationDuration };
}

export function resolveThunderMageAttackAnimationTiming(
  currentInterval: number,
): ThunderMageAttackAnimationTiming {
  const safeInterval =
    Number.isFinite(currentInterval) && currentInterval > 0
      ? currentInterval
      : THUNDER_MAGE_ATTACK_ANIMATION_BASE_DURATION;
  return resolveFixedCompanionAttackAnimationTiming(
    safeInterval,
    THUNDER_MAGE_SPINE_SOURCE_DURATION,
  );
}

export interface PlayerAttackAnimationTiming {
  attackSpeedMultiplier: number;
  animationDuration: number;
  spinePlaybackSpeed: number;
}

export function resolvePlayerAttackAnimationTiming(
  baseAttackInterval: number,
  currentAttackInterval: number,
): PlayerAttackAnimationTiming {
  const safeBaseInterval =
    Number.isFinite(baseAttackInterval) && baseAttackInterval > 0
      ? baseAttackInterval
      : PLAYER_ATTACK_ANIMATION_BASE_DURATION;
  const safeCurrentInterval =
    Number.isFinite(currentAttackInterval) && currentAttackInterval > 0
      ? currentAttackInterval
      : safeBaseInterval;
  const attackSpeedMultiplier = safeBaseInterval / safeCurrentInterval;
  const unclampedDuration = PLAYER_ATTACK_ANIMATION_BASE_DURATION / attackSpeedMultiplier;
  const animationDuration = Math.min(
    PLAYER_ATTACK_ANIMATION_MAX_DURATION,
    Math.max(PLAYER_ATTACK_ANIMATION_MIN_DURATION, unclampedDuration),
  );

  return {
    attackSpeedMultiplier,
    animationDuration,
    spinePlaybackSpeed: PLAYER_ATTACK_SPINE_SOURCE_DURATION / animationDuration,
  };
}

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
  options: Partial<Pick<UnitAnimationClipSpec, 'renderer' | 'spineAssetBase' | 'speed'>> = {},
): UnitAnimationClipSpec {
  return {
    state,
    clipName,
    loop,
    duration,
    priority: UNIT_ANIMATION_PRIORITY[state],
    interruptible: state !== 'death',
    ...options,
  };
}

function enemyProfile(
  id: string,
  displayName: string,
  subject: UnitAnimationSubject,
): UnitAnimationProfile {
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

function playerProfile(): UnitAnimationProfile {
  return {
    ...heroProfile('hero_main', '主角'),
    clips: [
      clip('idle', 0.9, true),
      clip('attack', PLAYER_ATTACK_SPINE_DURATION, false, PLAYER_ATTACK_SPINE_CLIP_NAME, {
        renderer: 'spine',
        spineAssetBase: PLAYER_ATTACK_SPINE_ASSET_BASE,
        speed: PLAYER_ATTACK_SPINE_SPEED,
      }),
      clip('cast', 0.52),
      clip('hit', 0.18),
      clip('death', 0.58),
      clip('victory', 0.85, true),
    ],
  };
}

export const PLAYER_ANIMATION_PROFILE: UnitAnimationProfile = playerProfile();

function fixedCompanionProfile(companion: FixedCompanionConfig): UnitAnimationProfile {
  const sourceDuration = companion.spineSourceDuration;
  return {
    id: companion.animationProfileId,
    displayName: companion.name,
    subject: 'hero',
    renderer: 'spine',
    spineAssetBase: companion.spineAssetBase,
    clips: [
      clip('idle', sourceDuration, true, 'attack', {
        renderer: 'spine',
        spineAssetBase: companion.spineAssetBase,
        speed: 0,
      }),
      clip('attack', companion.attackInterval, false, 'attack', {
        renderer: 'spine',
        spineAssetBase: companion.spineAssetBase,
        speed: sourceDuration / companion.attackInterval,
      }),
    ],
  };
}

export const FIXED_COMPANION_ANIMATION_PROFILES: Readonly<
  Record<FixedCompanionAnimationProfileId, UnitAnimationProfile>
> = Object.fromEntries(
  FIXED_COMPANIONS.map((companion) => [
    companion.animationProfileId,
    fixedCompanionProfile(companion),
  ]),
) as Record<FixedCompanionAnimationProfileId, UnitAnimationProfile>;

export function getFixedCompanionAnimationProfile(
  profileId: FixedCompanionAnimationProfileId,
): UnitAnimationProfile {
  const profile = FIXED_COMPANION_ANIMATION_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Missing fixed companion animation profile: ${profileId}`);
  }
  return profile;
}

export const THUNDER_MAGE_ANIMATION_PROFILE: UnitAnimationProfile =
  getFixedCompanionAnimationProfile(THUNDER_MAGE_COMPANION.animationProfileId);

export const QINGLAN_ANIMATION_PROFILE: UnitAnimationProfile = getFixedCompanionAnimationProfile(
  QINGLAN_COMPANION.animationProfileId,
);

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
