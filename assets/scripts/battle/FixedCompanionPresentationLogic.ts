export type FixedCompanionSkeletonLoadState = 'idle' | 'loading' | 'loaded' | 'warned';

export type FixedCompanionSkeletonLoadResult<T> =
  { state: 'loaded'; value: T } | { state: 'warned' };

type FixedCompanionSkeletonLoadComplete<T> = (error?: unknown, value?: T) => void;
type FixedCompanionSkeletonLoader<T> = (complete: FixedCompanionSkeletonLoadComplete<T>) => void;
type FixedCompanionSkeletonConsumer<T> = (result: FixedCompanionSkeletonLoadResult<T>) => void;

export function advanceFixedCompanionAttackElapsed(
  elapsed: number,
  duration: number,
  deltaTime: number,
): number {
  const safeElapsed = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return safeElapsed;
  }
  if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
    return Math.min(duration, safeElapsed);
  }
  return Math.min(duration, safeElapsed + deltaTime);
}

export function resolveFixedCompanionFrameIndex(
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

export class FixedCompanionSkeletonLoadCoordinator<T> {
  private state: FixedCompanionSkeletonLoadState = 'idle';
  private loadedValue: T | undefined;
  private readonly consumers = new Set<FixedCompanionSkeletonConsumer<T>>();

  public get loadState(): FixedCompanionSkeletonLoadState {
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
    loader: FixedCompanionSkeletonLoader<T>,
    consumer: FixedCompanionSkeletonConsumer<T>,
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
    const complete: FixedCompanionSkeletonLoadComplete<T> = (error, value) => {
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
