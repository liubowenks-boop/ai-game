import { resolveFixedCompanionFrameIndex } from './FixedCompanionPresentationLogic';

export {
  FixedCompanionSkeletonLoadCoordinator as ThunderMageSkeletonLoadCoordinator,
} from './FixedCompanionPresentationLogic';
export type {
  FixedCompanionSkeletonLoadResult as ThunderMageSkeletonLoadResult,
  FixedCompanionSkeletonLoadState as ThunderMageSkeletonLoadState,
} from './FixedCompanionPresentationLogic';

export interface ThunderMageProjectileTiming {
  age: number;
  complete: boolean;
}

export function resolveThunderMageAttackFrameIndex(
  elapsed: number,
  speed: number,
  sourceDuration: number,
): number {
  return resolveFixedCompanionFrameIndex(elapsed, speed, sourceDuration);
}

export function advanceThunderMageProjectile(
  age: number,
  duration: number,
  deltaTime: number,
): ThunderMageProjectileTiming {
  const safeAge = Number.isFinite(age) && age > 0 ? age : 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return { age: safeAge, complete: true };
  }

  if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
    const clampedAge = Math.min(duration, safeAge);
    return { age: clampedAge, complete: clampedAge >= duration };
  }

  const nextAge = Math.min(duration, safeAge + deltaTime);
  return { age: nextAge, complete: nextAge >= duration };
}
