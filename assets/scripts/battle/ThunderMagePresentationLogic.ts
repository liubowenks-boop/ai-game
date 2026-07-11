export type ThunderMageSkeletonLoadState = 'idle' | 'loading' | 'loaded' | 'warned';

export type ThunderMageSkeletonLoadResult<T> =
  | { state: 'loaded'; value: T }
  | { state: 'warned' };

type ThunderMageSkeletonLoadComplete<T> = (error?: unknown, value?: T) => void;
type ThunderMageSkeletonLoader<T> = (complete: ThunderMageSkeletonLoadComplete<T>) => void;
type ThunderMageSkeletonConsumer<T> = (result: ThunderMageSkeletonLoadResult<T>) => void;

export interface ThunderMageProjectileTiming {
  age: number;
  complete: boolean;
}

export function resolveThunderMageAttackFrameIndex(
  elapsed: number,
  speed: number,
  sourceDuration: number,
): number {
  if (
    Number.isNaN(elapsed) ||
    Number.isNaN(speed) ||
    !Number.isFinite(sourceDuration) ||
    sourceDuration <= 0
  ) {
    return 0;
  }

  const sourceProgress = (elapsed * speed) / sourceDuration;
  if (Number.isNaN(sourceProgress)) {
    return 0;
  }
  const progress = Math.max(0, Math.min(1, sourceProgress));
  return Math.min(7, Math.floor(progress * 8));
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

export class ThunderMageSkeletonLoadCoordinator<T> {
  private state: ThunderMageSkeletonLoadState = 'idle';
  private loadedValue: T | undefined;
  private readonly consumers = new Set<ThunderMageSkeletonConsumer<T>>();

  public get loadState(): ThunderMageSkeletonLoadState {
    return this.state;
  }

  public publish(value: T): void {
    this.loadedValue = value;
    this.state = 'loaded';

    const consumers = Array.from(this.consumers);
    this.consumers.clear();
    for (const consumer of consumers) {
      consumer({ state: 'loaded', value });
    }
  }

  public request(
    loader: ThunderMageSkeletonLoader<T>,
    consumer: ThunderMageSkeletonConsumer<T>,
    reportFailure: (error?: unknown) => void,
  ): void {
    if (this.loadedValue !== undefined) {
      consumer({ state: 'loaded', value: this.loadedValue });
      return;
    }

    this.consumers.add(consumer);
    if (this.state === 'loading') {
      return;
    }

    this.state = 'loading';
    let settled = false;
    const complete: ThunderMageSkeletonLoadComplete<T> = (error, value) => {
      if (settled) {
        return;
      }
      settled = true;

      if (error || value === undefined) {
        const consumers = Array.from(this.consumers);
        this.consumers.clear();
        this.state = 'warned';
        reportFailure(error);
        for (const pendingConsumer of consumers) {
          pendingConsumer({ state: 'warned' });
        }
        this.state = 'idle';
        return;
      }

      this.publish(value);
    };

    try {
      loader(complete);
    } catch (error) {
      complete(error);
    }
  }
}
