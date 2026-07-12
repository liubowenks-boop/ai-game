// @ts-nocheck
import { Node, resources, sp } from 'cc';

import {
  UnitAnimationProfile,
  getAnimationClipSpec,
  resolveFixedCompanionAttackAnimationTiming,
} from '../data/AnimationConfig';
import { FixedCompanionConfig, FixedCompanionId } from '../data/CompanionConfig';
import { BattleTickResult } from './BattleMvpModel';
import { BattleVfxSystem } from './BattleVfxSystem';
import {
  advanceFixedCompanionAttackElapsed,
  FixedCompanionSkeletonLoadCoordinator,
  resolveFixedCompanionFrameIndex,
} from './FixedCompanionPresentationLogic';
import type { FixedCompanionSkeletonLoadState } from './FixedCompanionPresentationLogic';

interface FixedCompanionAttackState {
  elapsed: number;
  duration: number;
  speed: number;
  sourceDuration: number;
}

const companionSkeletonLoaders = new Map<
  string,
  FixedCompanionSkeletonLoadCoordinator<sp.SkeletonData>
>();
const fixedCompanionPresentationOwners = new WeakMap<Node, FixedSpineCompanionPresentation>();

function getCompanionSkeletonLoader(
  companion: FixedCompanionConfig,
): FixedCompanionSkeletonLoadCoordinator<sp.SkeletonData> {
  const existing = companionSkeletonLoaders.get(companion.spineAssetBase);
  if (existing) {
    return existing;
  }
  const loader = new FixedCompanionSkeletonLoadCoordinator<sp.SkeletonData>();
  companionSkeletonLoaders.set(companion.spineAssetBase, loader);
  return loader;
}

export class FixedSpineCompanionPresentation {
  private readonly attackClip;
  private readonly sourceDuration: number;
  private readonly rootNode: Node;
  private readonly attackSpineNode: Node;
  private readonly attackSpine: sp.Skeleton;
  private readonly setUiLayer: (node: Node) => void;
  private readonly skeletonLoader: FixedCompanionSkeletonLoadCoordinator<sp.SkeletonData>;
  private loadState: FixedCompanionSkeletonLoadState = 'idle';
  private activeAttack: FixedCompanionAttackState | undefined;
  private spineMode: 'hidden' | 'idle' | 'attack' = 'hidden';
  private spineFrameIndex = 0;

  public constructor(
    unitParent: Node,
    setUiLayer: (node: Node) => void,
    private readonly battleVfx: BattleVfxSystem,
    private readonly companion: FixedCompanionConfig,
    animationProfile: UnitAnimationProfile,
  ) {
    this.setUiLayer = setUiLayer;
    this.attackClip = getAnimationClipSpec(animationProfile, 'attack');
    this.sourceDuration = getAnimationClipSpec(animationProfile, 'idle').duration;
    this.skeletonLoader = getCompanionSkeletonLoader(companion);

    this.rootNode =
      unitParent.getChildByName(companion.rootNodeName) ?? new Node(companion.rootNodeName);
    this.removeDuplicateNamedChildren(unitParent, this.rootNode);
    this.setUiLayer(this.rootNode);
    this.rootNode.setPosition(companion.position.x, companion.position.y, 0);
    if (!this.rootNode.parent) {
      unitParent.addChild(this.rootNode);
    }

    this.attackSpineNode =
      this.rootNode.getChildByName(companion.spineNodeName) ?? new Node(companion.spineNodeName);
    this.removeDuplicateNamedChildren(this.rootNode, this.attackSpineNode);
    this.removeChildrenExcept(this.rootNode, this.attackSpineNode);
    this.setUiLayer(this.attackSpineNode);
    this.attackSpineNode.setPosition(0, 0, 0);
    this.attackSpineNode.setScale(companion.displayScale, companion.displayScale, 1);
    this.attackSpineNode.active = false;
    if (!this.attackSpineNode.parent) {
      this.rootNode.addChild(this.attackSpineNode);
    }
    this.attackSpine =
      this.attackSpineNode.getComponent(sp.Skeleton) ??
      this.attackSpineNode.addComponent(sp.Skeleton);
    this.attackSpine.premultipliedAlpha = false;

    fixedCompanionPresentationOwners.set(this.rootNode, this);
    this.ensureSkeletonLoaded();
  }

  public get companionId(): FixedCompanionId {
    return this.companion.id;
  }

  public handleTickResult(result: BattleTickResult, actualAttackInterval: number): void {
    if (!this.isLive()) {
      return;
    }
    const companionEvents = result.attackEvents.filter(
      (event) => event.source === this.companion.attackSource,
    );
    for (const event of companionEvents) {
      const timing = resolveFixedCompanionAttackAnimationTiming(
        actualAttackInterval,
        this.sourceDuration,
      );
      this.activeAttack = {
        elapsed: 0,
        duration: timing.animationDuration,
        speed: timing.spinePlaybackSpeed,
        sourceDuration: this.sourceDuration,
      };
      this.battleVfx.playAttackEvent(event);
      if (this.loadState === 'loaded') {
        this.beginAttackPose();
      }
    }
    if (companionEvents.length > 0 && this.loadState === 'loaded') {
      this.applyCurrentAttackFrame();
    }
  }

  public update(deltaTime: number): void {
    if (!this.isLive() || !Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }
    this.tickAttack(deltaTime);
  }

  public clear(): void {
    this.activeAttack = undefined;
    if (!this.isLive()) {
      return;
    }
    if (this.loadState === 'loaded') {
      this.applyIdlePose();
    }
    if (this.loadState === 'warned') {
      this.loadState = 'idle';
      this.ensureSkeletonLoaded();
    }
  }

  private ensureSkeletonLoaded(): void {
    if (this.loadState === 'loading' || this.loadState === 'loaded') {
      return;
    }
    const attackClip = this.attackClip;
    if (attackClip.renderer !== 'spine' || !attackClip.spineAssetBase) {
      return;
    }
    const existingSkeletonData = this.attackSpine.skeletonData;
    if (existingSkeletonData) {
      this.skeletonLoader.publish(existingSkeletonData);
      this.loadState = 'loaded';
      this.applyIdlePose();
      return;
    }
    this.loadState = 'loading';
    this.skeletonLoader.request(
      (complete) => {
        resources.load(attackClip.spineAssetBase, sp.SkeletonData, (error, skeletonData) => {
          complete(error, skeletonData);
        });
      },
      (result) => {
        if (!this.isLive()) return;
        if (result.state === 'warned') {
          this.loadState = 'warned';
          return;
        }
        this.attackSpine.skeletonData = result.value;
        this.loadState = 'loaded';
        if (this.activeAttack) {
          this.beginAttackPose();
          this.applyCurrentAttackFrame();
        } else {
          this.applyIdlePose();
        }
      },
      (error) => {
        console.warn(
          `Failed to load fixed companion Spine asset: ${attackClip.spineAssetBase}`,
          error,
        );
      },
    );
  }

  private tickAttack(deltaTime: number): void {
    if (!this.activeAttack) {
      if (this.loadState === 'loaded') this.applyIdlePose();
      return;
    }
    this.activeAttack.elapsed = advanceFixedCompanionAttackElapsed(
      this.activeAttack.elapsed,
      this.activeAttack.duration,
      deltaTime,
    );
    if (this.loadState === 'loaded') this.applyCurrentAttackFrame();
    if (this.activeAttack.elapsed >= this.activeAttack.duration) {
      this.activeAttack = undefined;
      if (this.loadState === 'loaded') this.applyIdlePose();
    }
  }

  private beginAttackPose(): void {
    if (this.loadState !== 'loaded' || !this.isLive()) return;
    this.spineMode = 'attack';
    this.spineFrameIndex = 0;
    this.attackSpineNode.active = true;
    this.attackSpine.clearTracks();
    this.attackSpine.setToSetupPose();
    this.attackSpine.setAnimation(0, this.attackClip.clipName, this.attackClip.loop);
    this.attackSpine.paused = true;
    this.attackSpine.setAttachment('frame', 'frame_0');
  }

  private applyIdlePose(): void {
    if (this.loadState !== 'loaded' || !this.isLive()) return;
    if (this.spineMode === 'idle' && this.attackSpineNode.active) return;
    this.spineMode = 'idle';
    this.spineFrameIndex = 0;
    this.attackSpineNode.active = true;
    this.attackSpine.clearTracks();
    this.attackSpine.setToSetupPose();
    this.attackSpine.paused = true;
    this.attackSpine.setAttachment('frame', 'frame_0');
  }

  private applyCurrentAttackFrame(): void {
    if (this.loadState !== 'loaded' || !this.activeAttack || !this.isLive()) return;
    if (this.spineMode !== 'attack') this.beginAttackPose();
    const frameIndex = resolveFixedCompanionFrameIndex(
      this.activeAttack.elapsed,
      this.activeAttack.speed,
      this.activeAttack.sourceDuration,
    );
    if (this.spineFrameIndex !== frameIndex) {
      this.attackSpine.setAttachment('frame', `frame_${frameIndex}`);
      this.spineFrameIndex = frameIndex;
    }
  }

  private removeDuplicateNamedChildren(parent: Node, retainedNode: Node): void {
    for (const child of [...parent.children]) {
      if (child !== retainedNode && child.name === retainedNode.name) {
        child.removeFromParent();
        child.destroy();
      }
    }
  }

  private removeChildrenExcept(parent: Node, retainedNode?: Node): void {
    for (const child of [...parent.children]) {
      if (child !== retainedNode) {
        child.removeFromParent();
        child.destroy();
      }
    }
  }

  private isLive(): boolean {
    return (
      this.rootNode.isValid &&
      this.attackSpineNode.isValid &&
      this.attackSpine.isValid &&
      fixedCompanionPresentationOwners.get(this.rootNode) === this
    );
  }
}
