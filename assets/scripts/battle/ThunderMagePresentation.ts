// @ts-nocheck
import { Node, resources, sp } from 'cc';

import {
  THUNDER_MAGE_ANIMATION_PROFILE,
  THUNDER_MAGE_SPINE_SOURCE_DURATION,
  getAnimationClipSpec,
  resolveThunderMageAttackAnimationTiming,
} from '../data/AnimationConfig';
import { THUNDER_MAGE_COMPANION } from '../data/CompanionConfig';
import { BattleTickResult } from './BattleMvpModel';
import { BattleVfxSystem } from './BattleVfxSystem';
import {
  ThunderMageSkeletonLoadCoordinator,
  resolveThunderMageAttackFrameIndex,
} from './ThunderMagePresentationLogic';
import type { ThunderMageSkeletonLoadState } from './ThunderMagePresentationLogic';

interface ThunderMageAttackState {
  elapsed: number;
  duration: number;
  speed: number;
  sourceDuration: number;
}

const thunderMageSkeletonLoader = new ThunderMageSkeletonLoadCoordinator<sp.SkeletonData>();
const thunderMagePresentationOwners = new WeakMap<Node, ThunderMagePresentation>();

export class ThunderMagePresentation {
  private readonly attackClip = getAnimationClipSpec(THUNDER_MAGE_ANIMATION_PROFILE, 'attack');
  private readonly rootNode: Node;
  private readonly attackSpineNode: Node;
  private readonly attackSpine: sp.Skeleton;
  private readonly setUiLayer: (node: Node) => void;
  private loadState: ThunderMageSkeletonLoadState = 'idle';
  private activeAttack: ThunderMageAttackState | undefined;
  private spineMode: 'hidden' | 'idle' | 'attack' = 'hidden';
  private spineFrameIndex = 0;

  public constructor(
    unitParent: Node,
    setUiLayer: (node: Node) => void,
    private readonly battleVfx: BattleVfxSystem,
  ) {
    this.setUiLayer = setUiLayer;
    this.rootNode =
      unitParent.getChildByName('ThunderMageCompanion') ?? new Node('ThunderMageCompanion');
    this.removeDuplicateNamedChildren(unitParent, this.rootNode);
    this.setUiLayer(this.rootNode);
    this.rootNode.setPosition(
      THUNDER_MAGE_COMPANION.position.x,
      THUNDER_MAGE_COMPANION.position.y,
      0,
    );
    if (!this.rootNode.parent) {
      unitParent.addChild(this.rootNode);
    }

    this.attackSpineNode =
      this.rootNode.getChildByName('ThunderMageAttackSpine') ?? new Node('ThunderMageAttackSpine');
    this.removeDuplicateNamedChildren(this.rootNode, this.attackSpineNode);
    this.removeChildrenExcept(this.rootNode, this.attackSpineNode);
    this.setUiLayer(this.attackSpineNode);
    this.attackSpineNode.setPosition(0, 0, 0);
    this.attackSpineNode.setScale(
      THUNDER_MAGE_COMPANION.displayScale,
      THUNDER_MAGE_COMPANION.displayScale,
      1,
    );
    this.attackSpineNode.active = false;
    if (!this.attackSpineNode.parent) {
      this.rootNode.addChild(this.attackSpineNode);
    }
    this.attackSpine =
      this.attackSpineNode.getComponent(sp.Skeleton) ??
      this.attackSpineNode.addComponent(sp.Skeleton);
    this.attackSpine.premultipliedAlpha = false;

    thunderMagePresentationOwners.set(this.rootNode, this);
    this.ensureSkeletonLoaded();
  }

  public handleTickResult(result: BattleTickResult, actualAttackInterval: number): void {
    if (!this.isLive()) {
      return;
    }
    const companionEvents = result.attackEvents.filter((event) => event.source === 'companion');
    for (const event of companionEvents) {
      const timing = resolveThunderMageAttackAnimationTiming(actualAttackInterval);
      this.activeAttack = {
        elapsed: 0,
        duration: timing.animationDuration,
        speed: timing.spinePlaybackSpeed,
        sourceDuration: THUNDER_MAGE_SPINE_SOURCE_DURATION,
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
    this.tickAttack(Math.min(deltaTime, 1 / 30));
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
      thunderMageSkeletonLoader.publish(existingSkeletonData);
      this.loadState = 'loaded';
      this.applyIdlePose();
      return;
    }
    this.loadState = 'loading';
    thunderMageSkeletonLoader.request(
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
          `Failed to load thunder mage Spine asset: ${attackClip.spineAssetBase}`,
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
    this.activeAttack.elapsed = Math.min(
      this.activeAttack.duration,
      this.activeAttack.elapsed + deltaTime,
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
    const frameIndex = resolveThunderMageAttackFrameIndex(
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
      thunderMagePresentationOwners.get(this.rootNode) === this
    );
  }
}
