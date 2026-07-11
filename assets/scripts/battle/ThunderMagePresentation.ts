// @ts-nocheck
import {
  Color,
  Graphics,
  Node,
  UITransform,
  resources,
  sp,
  Vec3,
} from 'cc';

import {
  THUNDER_MAGE_ANIMATION_PROFILE,
  THUNDER_MAGE_SPINE_SOURCE_DURATION,
  getAnimationClipSpec,
  resolveThunderMageAttackAnimationTiming,
} from '../data/AnimationConfig';
import { THUNDER_MAGE_COMPANION } from '../data/CompanionConfig';
import { BattleTickResult } from './BattleMvpModel';

type SkeletonLoadState = 'idle' | 'loading' | 'loaded' | 'warned';

interface ThunderMageAttackState {
  elapsed: number;
  duration: number;
  speed: number;
  sourceDuration: number;
}

interface ThunderMageProjectileState {
  from: Vec3;
  to: Vec3;
  age: number;
  duration: number;
  hitSpawned: boolean;
}

interface ThunderMageBurstState {
  position: Vec3;
  age: number;
  duration: number;
}

const THUNDER_MAGE_PROJECTILE_COLOR = new Color(118, 224, 255, 255);
const THUNDER_MAGE_PROJECTILE_CORE = new Color(247, 252, 255, 255);
const THUNDER_MAGE_BURST_COLOR = new Color(118, 224, 255, 255);
const THUNDER_MAGE_BURST_CORE = new Color(247, 252, 255, 255);
const THUNDER_MAGE_RING_COLOR = new Color(161, 117, 58, 210);
const THUNDER_MAGE_RING_GLOW = new Color(231, 194, 109, 72);
const THUNDER_MAGE_STAFF_OFFSET = new Vec3(15, 40, 0);
const THUNDER_MAGE_PROJECTILE_MIN_DURATION = 0.16;
const THUNDER_MAGE_PROJECTILE_MAX_DURATION = 0.22;
const THUNDER_MAGE_BURST_DURATION = 0.2;
const THUNDER_MAGE_RING_RADIUS = 58;
const THUNDER_MAGE_RING_GLOW_RADIUS = 68;

export class ThunderMagePresentation {
  private readonly attackClip = getAnimationClipSpec(THUNDER_MAGE_ANIMATION_PROFILE, 'attack');
  private readonly rootNode: Node;
  private readonly ringNode: Node;
  private readonly ringGraphics: Graphics;
  private readonly attackSpineNode: Node;
  private readonly attackSpine: sp.Skeleton;
  private readonly effectsNode: Node;
  private readonly effectsGraphics: Graphics;
  private readonly projectiles: ThunderMageProjectileState[] = [];
  private readonly bursts: ThunderMageBurstState[] = [];
  private readonly setUiLayer: (node: Node) => void;
  private loadState: SkeletonLoadState = 'idle';
  private activeAttack: ThunderMageAttackState | undefined;
  private spineMode: 'hidden' | 'idle' | 'attack' = 'hidden';
  private spineFrameIndex = 0;

  public constructor(parent: Node, setUiLayer: (node: Node) => void) {
    this.setUiLayer = setUiLayer;

    this.rootNode = new Node('ThunderMageCompanion');
    this.setUiLayer(this.rootNode);
    this.rootNode.setPosition(THUNDER_MAGE_COMPANION.position.x, THUNDER_MAGE_COMPANION.position.y, 0);
    if (!this.rootNode.parent) {
      parent.addChild(this.rootNode);
    }

    this.ringNode = new Node('ThunderMageBronzeRing');
    this.setUiLayer(this.ringNode);
    this.ringNode.setPosition(0, 0, 0);
    this.rootNode.addChild(this.ringNode);
    this.ringGraphics = this.ringNode.addComponent(Graphics);
    this.drawBronzeRing();

    this.attackSpineNode = new Node('ThunderMageAttackSpine');
    this.setUiLayer(this.attackSpineNode);
    this.attackSpineNode.setPosition(0, 0, 0);
    this.attackSpineNode.setScale(
      THUNDER_MAGE_COMPANION.displayScale,
      THUNDER_MAGE_COMPANION.displayScale,
      1,
    );
    this.attackSpineNode.active = false;
    this.rootNode.addChild(this.attackSpineNode);
    this.attackSpine = this.attackSpineNode.getComponent(sp.Skeleton) ?? this.attackSpineNode.addComponent(sp.Skeleton);
    this.attackSpine.premultipliedAlpha = false;

    this.effectsNode = new Node('ThunderMageEffects');
    this.setUiLayer(this.effectsNode);
    const effectsTransform = this.effectsNode.getComponent(UITransform) ?? this.effectsNode.addComponent(UITransform);
    effectsTransform.setContentSize(720, 1280);
    this.effectsNode.setPosition(0, 0, 0);
    this.effectsGraphics = this.effectsNode.addComponent(Graphics);
    parent.addChild(this.effectsNode);
    this.effectsNode.setSiblingIndex(parent.children.length - 1);

    this.ensureSkeletonLoaded();
    this.applyIdlePose();
  }

  public handleTickResult(result: BattleTickResult, actualAttackInterval: number): void {
    const companionEvents = result.attackEvents.filter((event) => event.source === 'companion');

    if (companionEvents.length === 0) {
      return;
    }

    for (const event of companionEvents) {
      const timing = resolveThunderMageAttackAnimationTiming(actualAttackInterval);
      this.activeAttack = {
        elapsed: 0,
        duration: timing.animationDuration,
        speed: timing.spinePlaybackSpeed,
        sourceDuration: THUNDER_MAGE_SPINE_SOURCE_DURATION,
      };

      const from = this.getStaffOrigin();
      const to = new Vec3(event.enemyPosition.x, event.enemyPosition.y, 0);
      this.projectiles.push({
        from,
        to,
        age: 0,
        duration: this.resolveProjectileDuration(from, to),
        hitSpawned: false,
      });

      if (this.loadState === 'loaded') {
        this.beginAttackPose();
      }
    }

    if (this.loadState === 'loaded') {
      this.applyCurrentAttackFrame();
    }
  }

  public update(deltaTime: number): void {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    const presentationDelta = Math.min(deltaTime, 1 / 30);
    this.tickAttack(presentationDelta);
    this.tickProjectiles(presentationDelta);
    this.tickBursts(presentationDelta);
    this.drawEffects();
    this.pruneFinishedEffects();
  }

  public clear(): void {
    this.projectiles.length = 0;
    this.bursts.length = 0;
    this.effectsGraphics.clear();
    this.activeAttack = undefined;

    if (this.loadState === 'loaded') {
      this.applyIdlePose();
    }
  }

  private ensureSkeletonLoaded(): void {
    if (this.loadState !== 'idle') {
      return;
    }

    const attackClip = this.attackClip;
    if (attackClip.renderer !== 'spine' || !attackClip.spineAssetBase) {
      return;
    }

    this.loadState = 'loading';
    resources.load(attackClip.spineAssetBase, sp.SkeletonData, (error, skeletonData) => {
      if (!this.isLive()) {
        return;
      }

      if (error || !skeletonData) {
        if (this.loadState !== 'warned') {
          this.loadState = 'warned';
          console.warn(`Failed to load thunder mage Spine asset: ${attackClip.spineAssetBase}`, error);
        }
        return;
      }

      this.attackSpine.skeletonData = skeletonData;
      this.loadState = 'loaded';

      if (this.activeAttack) {
        this.beginAttackPose();
        this.applyCurrentAttackFrame();
      } else {
        this.applyIdlePose();
      }
    });
  }

  private tickAttack(deltaTime: number): void {
    if (!this.activeAttack) {
      if (this.loadState === 'loaded') {
        this.applyIdlePose();
      }
      return;
    }

    this.activeAttack.elapsed = Math.min(
      this.activeAttack.duration,
      this.activeAttack.elapsed + deltaTime,
    );

    if (this.loadState === 'loaded') {
      this.applyCurrentAttackFrame();
    }

    if (this.activeAttack.elapsed >= this.activeAttack.duration) {
      this.activeAttack = undefined;
      if (this.loadState === 'loaded') {
        this.applyIdlePose();
      }
    }
  }

  private tickProjectiles(deltaTime: number): void {
    for (const projectile of this.projectiles) {
      projectile.age += deltaTime;

      if (!projectile.hitSpawned && projectile.age >= projectile.duration) {
        projectile.hitSpawned = true;
        this.spawnBurst(projectile.to);
      }
    }
  }

  private tickBursts(deltaTime: number): void {
    for (const burst of this.bursts) {
      burst.age += deltaTime;
    }
  }

  private drawEffects(): void {
    this.effectsGraphics.clear();

    for (const projectile of this.projectiles) {
      this.drawProjectile(projectile);
    }

    for (const burst of this.bursts) {
      this.drawBurst(burst);
    }
  }

  private pruneFinishedEffects(): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      if (this.projectiles[index].age >= this.projectiles[index].duration) {
        this.projectiles.splice(index, 1);
      }
    }

    for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
      if (this.bursts[index].age >= this.bursts[index].duration) {
        this.bursts.splice(index, 1);
      }
    }
  }

  private beginAttackPose(): void {
    if (this.loadState !== 'loaded' || !this.isLive()) {
      return;
    }

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
    if (this.loadState !== 'loaded' || !this.isLive()) {
      return;
    }

    if (this.spineMode === 'idle' && this.attackSpineNode.active) {
      return;
    }

    this.spineMode = 'idle';
    this.spineFrameIndex = 0;
    this.attackSpineNode.active = true;
    this.attackSpine.clearTracks();
    this.attackSpine.setToSetupPose();
    this.attackSpine.paused = true;
    this.attackSpine.setAttachment('frame', 'frame_0');
  }

  private applyCurrentAttackFrame(): void {
    if (this.loadState !== 'loaded' || !this.activeAttack || !this.isLive()) {
      return;
    }

    if (this.spineMode !== 'attack') {
      this.beginAttackPose();
    }

    const progress =
      (this.activeAttack.elapsed * this.activeAttack.speed) / this.activeAttack.sourceDuration;
    const frameIndex = Math.min(7, Math.floor(progress * 8));
    if (this.spineFrameIndex !== frameIndex) {
      this.attackSpine.setAttachment('frame', `frame_${frameIndex}`);
      this.spineFrameIndex = frameIndex;
    }
  }

  private drawProjectile(projectile: ThunderMageProjectileState): void {
    const progress = Math.max(0, Math.min(1, projectile.age / projectile.duration));
    const eased = 1 - (1 - progress) * (1 - progress);
    const position = this.lerp(projectile.from, projectile.to, eased);
    const direction = this.normalize(projectile.from, projectile.to);
    const sway = Math.sin(progress * Math.PI * 3) * (1 - progress) * 16;
    const kink = new Vec3(
      position.x + direction.y * sway,
      position.y - direction.x * sway,
      0,
    );
    const mid = this.lerp(projectile.from, projectile.to, 0.54);

    this.effectsGraphics.strokeColor = new Color(
      THUNDER_MAGE_PROJECTILE_COLOR.r,
      THUNDER_MAGE_PROJECTILE_COLOR.g,
      THUNDER_MAGE_PROJECTILE_COLOR.b,
      Math.floor(110 * (1 - progress) + 60),
    );
    this.effectsGraphics.lineWidth = 6;
    this.effectsGraphics.moveTo(projectile.from.x, projectile.from.y);
    this.effectsGraphics.lineTo(mid.x, mid.y);
    this.effectsGraphics.lineTo(kink.x, kink.y);
    this.effectsGraphics.lineTo(projectile.to.x, projectile.to.y);
    this.effectsGraphics.stroke();

    this.effectsGraphics.strokeColor = new Color(
      THUNDER_MAGE_PROJECTILE_CORE.r,
      THUNDER_MAGE_PROJECTILE_CORE.g,
      THUNDER_MAGE_PROJECTILE_CORE.b,
      Math.floor(160 * (1 - progress) + 40),
    );
    this.effectsGraphics.lineWidth = 2;
    this.effectsGraphics.moveTo(projectile.from.x, projectile.from.y);
    this.effectsGraphics.lineTo(kink.x, kink.y);
    this.effectsGraphics.lineTo(projectile.to.x, projectile.to.y);
    this.effectsGraphics.stroke();

    this.effectsGraphics.fillColor = new Color(
      THUNDER_MAGE_PROJECTILE_CORE.r,
      THUNDER_MAGE_PROJECTILE_CORE.g,
      THUNDER_MAGE_PROJECTILE_CORE.b,
      Math.floor(120 * (1 - progress) + 28),
    );
    this.effectsGraphics.circle(position.x, position.y, 8 + (1 - progress) * 4);
    this.effectsGraphics.fill();

    this.effectsGraphics.fillColor = new Color(
      THUNDER_MAGE_PROJECTILE_COLOR.r,
      THUNDER_MAGE_PROJECTILE_COLOR.g,
      THUNDER_MAGE_PROJECTILE_COLOR.b,
      Math.floor(70 * (1 - progress)),
    );
    this.effectsGraphics.circle(projectile.from.x, projectile.from.y, 4 + (1 - progress) * 4);
    this.effectsGraphics.fill();
  }

  private drawBurst(burst: ThunderMageBurstState): void {
    const progress = Math.max(0, Math.min(1, burst.age / burst.duration));
    const fade = 1 - progress;
    const outerRadius = 14 + progress * 24;
    const innerRadius = 6 + progress * 5;

    this.effectsGraphics.strokeColor = new Color(
      THUNDER_MAGE_BURST_COLOR.r,
      THUNDER_MAGE_BURST_COLOR.g,
      THUNDER_MAGE_BURST_COLOR.b,
      Math.floor(180 * fade),
    );
    this.effectsGraphics.lineWidth = 4;
    this.effectsGraphics.circle(burst.position.x, burst.position.y, outerRadius);
    this.effectsGraphics.stroke();

    this.effectsGraphics.strokeColor = new Color(
      THUNDER_MAGE_BURST_CORE.r,
      THUNDER_MAGE_BURST_CORE.g,
      THUNDER_MAGE_BURST_CORE.b,
      Math.floor(120 * fade),
    );
    this.effectsGraphics.lineWidth = 2;
    this.effectsGraphics.circle(burst.position.x, burst.position.y, outerRadius - 8);
    this.effectsGraphics.stroke();

    this.effectsGraphics.fillColor = new Color(
      THUNDER_MAGE_BURST_CORE.r,
      THUNDER_MAGE_BURST_CORE.g,
      THUNDER_MAGE_BURST_CORE.b,
      Math.floor(88 * fade),
    );
    this.effectsGraphics.circle(burst.position.x, burst.position.y, innerRadius);
    this.effectsGraphics.fill();
  }

  private spawnBurst(position: Vec3): void {
    this.bursts.push({
      position: position.clone(),
      age: 0,
      duration: THUNDER_MAGE_BURST_DURATION,
    });
  }

  private drawBronzeRing(): void {
    this.ringGraphics.clear();
    this.ringGraphics.strokeColor = THUNDER_MAGE_RING_COLOR;
    this.ringGraphics.lineWidth = 5;
    this.ringGraphics.circle(0, 0, THUNDER_MAGE_RING_RADIUS);
    this.ringGraphics.stroke();
    this.ringGraphics.strokeColor = THUNDER_MAGE_RING_GLOW;
    this.ringGraphics.lineWidth = 2;
    this.ringGraphics.circle(0, 0, THUNDER_MAGE_RING_GLOW_RADIUS);
    this.ringGraphics.stroke();
  }

  private resolveProjectileDuration(from: Vec3, to: Vec3): number {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    return Math.max(
      THUNDER_MAGE_PROJECTILE_MIN_DURATION,
      Math.min(THUNDER_MAGE_PROJECTILE_MAX_DURATION, THUNDER_MAGE_PROJECTILE_MIN_DURATION + distance / 16000),
    );
  }

  private getStaffOrigin(): Vec3 {
    const origin = this.rootNode.position.clone();
    origin.x += THUNDER_MAGE_STAFF_OFFSET.x;
    origin.y += THUNDER_MAGE_STAFF_OFFSET.y;
    return origin;
  }

  private lerp(from: Vec3, to: Vec3, amount: number): Vec3 {
    return new Vec3(
      from.x + (to.x - from.x) * amount,
      from.y + (to.y - from.y) * amount,
      0,
    );
  }

  private normalize(from: Vec3, to: Vec3): Vec3 {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return new Vec3(dx / length, dy / length, 0);
  }

  private isLive(): boolean {
    return (
      this.rootNode.isValid &&
      this.ringNode.isValid &&
      this.attackSpineNode.isValid &&
      this.effectsNode.isValid &&
      this.attackSpine.isValid
    );
  }
}
