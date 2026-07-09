import {
  ENEMY_ANIMATION_PROFILES,
  PLAYER_ANIMATION_PROFILE,
  UNIT_ANIMATION_PRIORITY,
  UnitAnimationProfile,
  UnitAnimationState,
  getAnimationClipSpec,
  getEnemyAnimationProfile,
} from '../data/AnimationConfig';

export interface UnitAnimationRuntime {
  profile: UnitAnimationProfile;
  currentState: UnitAnimationState;
  elapsed: number;
  duration: number;
  loop: boolean;
  locked: boolean;
}

export interface UnitAnimationPose {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export interface EnemyAnimationSnapshot {
  kind: keyof typeof ENEMY_ANIMATION_PROFILES | string;
  alive: boolean;
  hp: number;
  maxHp: number;
  speed: number;
  wallHoldTimeLeft: number;
  position: {
    x: number;
    y: number;
  };
}

export interface EnemyAnimationResolveContext {
  previousHp?: number;
  newlySpawned?: boolean;
  cityLineY?: number;
}

export function createUnitAnimationRuntime(
  profileOrId: UnitAnimationProfile | string = PLAYER_ANIMATION_PROFILE,
): UnitAnimationRuntime {
  const profile =
    typeof profileOrId === 'string'
      ? findProfileById(profileOrId) ?? PLAYER_ANIMATION_PROFILE
      : profileOrId;
  const idle = getAnimationClipSpec(profile, 'idle');

  return {
    profile,
    currentState: idle.state,
    elapsed: 0,
    duration: idle.duration,
    loop: idle.loop,
    locked: false,
  };
}

export function requestUnitAnimation(
  runtime: UnitAnimationRuntime,
  nextState: UnitAnimationState,
): boolean {
  if (runtime.currentState === nextState && runtime.loop) {
    return false;
  }

  const currentSpec = getAnimationClipSpec(runtime.profile, runtime.currentState);
  const nextSpec = getAnimationClipSpec(runtime.profile, nextState);
  const currentPriority = currentSpec.priority ?? UNIT_ANIMATION_PRIORITY[currentSpec.state];
  const nextPriority = nextSpec.priority ?? UNIT_ANIMATION_PRIORITY[nextSpec.state];

  if (runtime.locked || (!currentSpec.interruptible && !isUnitAnimationComplete(runtime))) {
    return false;
  }

  if (!isUnitAnimationComplete(runtime) && nextPriority < currentPriority) {
    return false;
  }

  runtime.currentState = nextSpec.state;
  runtime.elapsed = 0;
  runtime.duration = nextSpec.duration;
  runtime.loop = nextSpec.loop;
  runtime.locked = nextSpec.state === 'death';
  return true;
}

export function tickUnitAnimation(runtime: UnitAnimationRuntime, deltaSeconds: number): void {
  if (deltaSeconds <= 0) {
    return;
  }

  runtime.elapsed += deltaSeconds;

  if (runtime.loop && runtime.duration > 0) {
    runtime.elapsed %= runtime.duration;
  }
}

export function isUnitAnimationComplete(runtime: UnitAnimationRuntime): boolean {
  return !runtime.loop && runtime.elapsed >= runtime.duration;
}

export function resolveEnemyAnimationState(
  enemy: EnemyAnimationSnapshot,
  context: EnemyAnimationResolveContext = {},
): UnitAnimationState {
  if (!enemy.alive || enemy.hp <= 0) {
    return 'death';
  }

  if (context.newlySpawned) {
    return enemy.kind === 'boss' ? 'boss_intro' : 'spawn';
  }

  if (typeof context.previousHp === 'number' && enemy.hp < context.previousHp) {
    return 'hit';
  }

  if (enemy.wallHoldTimeLeft > 0) {
    return enemy.kind === 'boss' ? 'boss_attack' : 'attack_city';
  }

  const cityLineY = context.cityLineY ?? -210;
  if (enemy.speed > 0 && enemy.position.y > cityLineY) {
    return 'walk';
  }

  return 'idle';
}

export function computeProceduralAnimationPose(
  state: UnitAnimationState,
  elapsed: number,
  subject: 'hero' | 'enemy' | 'boss' = 'enemy',
): UnitAnimationPose {
  const time = Math.max(0, elapsed);
  const bossScale = subject === 'boss' ? 1.08 : 1;

  if (state === 'walk') {
    const sway = Math.sin(time * 12);
    return {
      scaleX: bossScale * (1 + Math.abs(sway) * 0.018),
      scaleY: 1 - Math.abs(sway) * 0.018,
      offsetX: sway * (subject === 'boss' ? 1.2 : 1.8),
      offsetY: Math.abs(sway) * (subject === 'boss' ? 2 : 3),
      rotation: sway * 1.5,
    };
  }

  if (state === 'attack' || state === 'cast' || state === 'attack_city' || state === 'boss_attack') {
    const progress = Math.min(1, time / (state === 'boss_attack' ? 0.45 : 0.22));
    const punch = Math.sin(progress * Math.PI);
    return {
      scaleX: bossScale * (1 + punch * (subject === 'boss' ? 0.12 : 0.08)),
      scaleY: 1 - punch * 0.035,
      offsetX: 0,
      offsetY: punch * (subject === 'hero' ? 5 : -3),
      rotation: 0,
    };
  }

  if (state === 'hit') {
    const recoil = Math.max(0, 1 - time / 0.16);
    return {
      scaleX: bossScale * (1 + recoil * 0.12),
      scaleY: 1 + recoil * 0.08,
      offsetX: recoil * (subject === 'hero' ? -3 : 3),
      offsetY: recoil * 3,
      rotation: recoil * (subject === 'hero' ? -2 : 2),
    };
  }

  if (state === 'death') {
    const progress = Math.min(1, time / (subject === 'boss' ? 0.9 : 0.42));
    return {
      scaleX: bossScale * (1 + progress * 0.12),
      scaleY: Math.max(0.15, 1 - progress * 0.82),
      offsetX: 0,
      offsetY: -18 * progress,
      rotation: subject === 'boss' ? 0 : -8 * progress,
    };
  }

  if (state === 'spawn' || state === 'boss_intro') {
    const progress = Math.min(1, time / (state === 'boss_intro' ? 1.1 : 0.34));
    const scale = 0.72 + progress * 0.28;
    return {
      scaleX: bossScale * scale,
      scaleY: scale,
      offsetX: 0,
      offsetY: (1 - progress) * 18,
      rotation: 0,
    };
  }

  const breathe = Math.sin(time * 4) * 0.018;
  return {
    scaleX: bossScale * (1 + breathe),
    scaleY: 1 - breathe,
    offsetX: 0,
    offsetY: Math.sin(time * 3) * (subject === 'boss' ? 1.5 : 1),
    rotation: 0,
  };
}

function findProfileById(profileId: string): UnitAnimationProfile | undefined {
  if (PLAYER_ANIMATION_PROFILE.id === profileId) {
    return PLAYER_ANIMATION_PROFILE;
  }

  for (const profile of Object.values(ENEMY_ANIMATION_PROFILES)) {
    if (profile.id === profileId) {
      return profile;
    }
  }

  return undefined;
}
