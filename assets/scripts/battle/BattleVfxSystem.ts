// @ts-nocheck
import {
  assetManager,
  Color,
  gfx,
  ImageAsset,
  Layers,
  Node,
  ParticleSystem2D,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';

import {
  BATTLE_VFX_BUDGET,
  BATTLE_VFX_PRESETS,
  BATTLE_VFX_TEXTURE_FALLBACKS,
  BATTLE_VFX_TEXTURES,
  BattleVfxImpactProfile,
  BattleVfxPreset,
  BattleVfxPresetId,
  BattleVfxTextureId,
} from '../data/BattleVfxConfig';
import { getUiArtAsset } from '../ui/UiArtManifest';
import { AttackEvent, BattlePoint, EnemyKind } from './BattleMvpModel';
import { BattleVfxLimiter, VfxReservation, resolveAttackVfxPreset } from './BattleVfxLogic';

interface BattleVfxPlayResult {
  readonly played: boolean;
  readonly presetId: BattleVfxPresetId;
}

interface SpriteHandle {
  readonly node: Node;
  readonly sprite: Sprite;
  active: boolean;
  age: number;
  duration: number;
  from: Vec3;
  to: Vec3;
  preset?: BattleVfxPreset;
  reservation?: VfxReservation;
  critical: boolean;
  baseScale: number;
  growth: number;
  startAlpha: number;
  trailTimer: number;
  beam: boolean;
}

interface ParticleHandle {
  readonly node: Node;
  readonly particle: ParticleSystem2D;
  active: boolean;
  age: number;
  duration: number;
  reservation?: VfxReservation;
}

interface ImpactParticleProfile {
  readonly texture: BattleVfxTextureId;
  readonly speed: number;
  readonly speedVar: number;
  readonly angle: number;
  readonly angleVar: number;
  readonly gravity: readonly [number, number];
  readonly startSize: number;
  readonly startSizeVar: number;
  readonly endSize: number;
  readonly lifeScale: number;
  readonly spread: readonly [number, number];
}

const IMPACT_PARTICLE_PROFILES: Readonly<Record<BattleVfxImpactProfile, ImpactParticleProfile>> = {
  fire: {
    texture: 'smokeDebris',
    speed: 148,
    speedVar: 76,
    angle: 90,
    angleVar: 132,
    gravity: [0, -92],
    startSize: 18,
    startSizeVar: 9,
    endSize: 3,
    lifeScale: 0.92,
    spread: [15, 8],
  },
  thunder: {
    texture: 'hitStar',
    speed: 190,
    speedVar: 94,
    angle: 90,
    angleVar: 180,
    gravity: [0, -18],
    startSize: 13,
    startSizeVar: 7,
    endSize: 1,
    lifeScale: 0.62,
    spread: [10, 7],
  },
  poison: {
    texture: 'poisonWisp',
    speed: 82,
    speedVar: 46,
    angle: 90,
    angleVar: 68,
    gravity: [0, 34],
    startSize: 20,
    startSizeVar: 10,
    endSize: 7,
    lifeScale: 1.12,
    spread: [18, 9],
  },
  gold: {
    texture: 'hitStar',
    speed: 168,
    speedVar: 88,
    angle: 90,
    angleVar: 180,
    gravity: [0, -36],
    startSize: 12,
    startSizeVar: 7,
    endSize: 2,
    lifeScale: 0.72,
    spread: [10, 8],
  },
  heal: {
    texture: 'healOrb',
    speed: 72,
    speedVar: 38,
    angle: 90,
    angleVar: 52,
    gravity: [0, 28],
    startSize: 16,
    startSizeVar: 8,
    endSize: 5,
    lifeScale: 1.08,
    spread: [20, 10],
  },
};

export class BattleVfxSystem {
  private readonly limiter = new BattleVfxLimiter(BATTLE_VFX_BUDGET);
  private readonly frames = new Map<BattleVfxTextureId, SpriteFrame>();
  private readonly failedTextures = new Set<BattleVfxTextureId>();
  private readonly warnedTextures = new Set<BattleVfxTextureId>();
  private readonly projectilePool: SpriteHandle[] = [];
  private readonly impactPool: SpriteHandle[] = [];
  private readonly trailPool: SpriteHandle[] = [];
  private readonly particlePool: ParticleHandle[] = [];
  private readonly markerPool: SpriteHandle[] = [];
  private readonly statusFeedbackBuckets = new Map<string, number>();
  private nowSeconds = 0;
  private preloadPromise?: Promise<void>;
  private disposed = false;

  public constructor(
    private readonly projectileRoot: Node,
    private readonly feedbackRoot: Node,
  ) {}

  public async preload(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = loadBattleVfxBundle().then(async (bundle) => {
      if (this.disposed) return;
      await Promise.all(
        Object.entries(BATTLE_VFX_TEXTURES).map(async ([textureId, filename]) => {
          const frame = bundle ? await loadVfxSpriteFrame(bundle, filename) : null;
          if (this.disposed) return;
          if (frame) {
            this.frames.set(textureId as BattleVfxTextureId, frame);
          } else {
            this.failedTextures.add(textureId as BattleVfxTextureId);
            this.warnMissingTexture(textureId as BattleVfxTextureId, filename);
          }
        }),
      );
      console.info(
        `[BattleVfx] loaded ${this.frames.size}/${Object.keys(BATTLE_VFX_TEXTURES).length}; failed=${Array.from(this.failedTextures).join(',') || 'none'}`,
      );
    });
    return this.preloadPromise;
  }

  public playAttackEvent(event: AttackEvent): BattleVfxPlayResult {
    const preset = resolveAttackVfxPreset(event);
    if (this.disposed) {
      return { played: false, presetId: preset.id };
    }
    if (
      event.source === 'hero_dps' &&
      event.impactKind === 'primary' &&
      (!event.heroId ||
        !this.limiter.tryStartHeroAttack(
          event.heroId,
          this.nowSeconds,
          preset.presentationInterval,
        ))
    ) {
      return { played: false, presetId: preset.id };
    }

    if (event.impactKind === 'primary' && event.originPosition) {
      const played = this.playProjectile(preset, event.originPosition, event.enemyPosition, event);
      return { played, presetId: preset.id };
    }

    const played = this.playLayeredImpact(
      preset,
      event.enemyPosition,
      Boolean(event.critical),
      event.killed ? 'critical' : event.impactKind === 'status' ? 'decorative' : 'essential',
    );
    return { played, presetId: preset.id };
  }

  public playStatusImpact(event: AttackEvent): void {
    if (event.impactKind !== 'status') return;
    const bucket = Math.floor(this.nowSeconds * 10);
    const key = `${event.enemyId}:${event.source}`;
    if (this.statusFeedbackBuckets.get(key) === bucket) return;
    this.statusFeedbackBuckets.set(key, bucket);
    if (this.statusFeedbackBuckets.size > 128) {
      for (const [storedKey, storedBucket] of this.statusFeedbackBuckets) {
        if (storedBucket < bucket - 2) this.statusFeedbackBuckets.delete(storedKey);
      }
    }
    this.playAttackEvent(event);
  }

  public playEnemyDeath(position: BattlePoint, kind: EnemyKind): void {
    const preset =
      kind === 'boss' ? BATTLE_VFX_PRESETS.main_fire_gold : BATTLE_VFX_PRESETS.shield_impact;
    this.playLayeredImpact(preset, position, kind === 'boss', 'critical');
  }

  public playWallImpact(position: BattlePoint = { x: 0, y: -300 }): void {
    this.playLayeredImpact(
      BATTLE_VFX_PRESETS.shield_impact,
      position,
      false,
      'essential',
      'smokeDebris',
    );
  }

  public setPlacementMarkers(points: readonly BattlePoint[]): void {
    const visiblePoints = points.slice(0, BATTLE_VFX_BUDGET.maxPlacementMarkers);
    while (this.markerPool.length < visiblePoints.length) {
      this.markerPool.push(this.createSpriteHandle('PlacementMarker', this.feedbackRoot));
    }
    for (let index = 0; index < this.markerPool.length; index += 1) {
      const handle = this.markerPool[index];
      const point = visiblePoints[index];
      if (!point) {
        handle.active = false;
        handle.node.active = false;
        continue;
      }
      handle.active = true;
      handle.node.active = true;
      handle.node.setPosition(point.x, point.y - 22, 0);
      handle.node.setScale(0.42, 0.42, 1);
      handle.sprite.spriteFrame = this.frames.get('runeMarker') ?? null;
      handle.sprite.color = new Color(255, 235, 153, 210);
    }
  }

  public update(deltaSeconds: number): void {
    if (this.disposed || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    const delta = Math.min(deltaSeconds, 1 / 20);
    this.nowSeconds += delta;
    this.reclaimEvictedReservations();
    this.updateProjectiles(delta);
    this.updateImpacts(delta);
    this.updateTrails(delta);
    this.updateParticles(delta);
    this.updateMarkers();
  }

  public getDebugSnapshot(): {
    activeProjectiles: number;
    activeImpacts: number;
    activeParticleSystems: number;
    estimatedParticles: number;
    pooledNodes: number;
    loadedTextures: number;
    failedTextures: number;
  } {
    const snapshot = this.limiter.getSnapshot();
    return {
      ...snapshot,
      loadedTextures: this.frames.size,
      failedTextures: this.failedTextures.size,
      pooledNodes:
        this.projectilePool.length +
        this.impactPool.length +
        this.trailPool.length +
        this.particlePool.length +
        this.markerPool.length,
    };
  }

  public clear(): void {
    for (const handle of this.projectilePool) this.releaseSprite(handle);
    for (const handle of this.impactPool) this.releaseSprite(handle);
    for (const handle of this.trailPool) this.releaseSprite(handle);
    for (const handle of this.markerPool) {
      handle.active = false;
      handle.node.active = false;
    }
    for (const handle of this.particlePool) this.releaseParticle(handle);
    this.statusFeedbackBuckets.clear();
    this.limiter.reset();
    this.nowSeconds = 0;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.clear();
    this.disposed = true;
    for (const handle of [
      ...this.projectilePool,
      ...this.impactPool,
      ...this.trailPool,
      ...this.markerPool,
    ]) {
      handle.node.destroy();
    }
    for (const handle of this.particlePool) handle.node.destroy();
    this.projectilePool.length = 0;
    this.impactPool.length = 0;
    this.trailPool.length = 0;
    this.markerPool.length = 0;
    this.particlePool.length = 0;
    this.frames.clear();
  }

  private playProjectile(
    preset: BattleVfxPreset,
    origin: BattlePoint,
    target: BattlePoint,
    event: AttackEvent,
  ): boolean {
    const frame = this.resolveFrame(preset.projectileTexture);
    if (!frame) {
      return false;
    }
    const reservation = this.limiter.reserve('projectile', 0, 'essential');
    if (!reservation) {
      return false;
    }
    const from = new Vec3(origin.x, origin.y + 36, 0);
    const to = new Vec3(target.x, target.y + 12, 0);

    const handle = this.acquireSprite(
      this.projectilePool,
      'VfxProjectile',
      this.projectileRoot,
      BATTLE_VFX_BUDGET.maxActiveProjectiles,
    );
    if (!handle) {
      this.limiter.release(reservation);
      return false;
    }
    handle.active = true;
    handle.age = 0;
    handle.duration = preset.travelSeconds;
    handle.from = from;
    handle.to = to;
    handle.preset = preset;
    handle.critical = Boolean(event.critical);
    handle.baseScale = preset.projectileScale * (event.critical ? 1.15 : 1);
    handle.trailTimer = preset.trailInterval;
    handle.beam = preset.beam;
    handle.reservation = reservation;
    handle.node.active = true;
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    handle.node.angle = angle;
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = Color.WHITE;
    this.playSourceFlash(preset, from);
    if (preset.beam) {
      const distance = Math.max(120, Math.hypot(to.x - from.x, to.y - from.y));
      handle.node
        .getComponent(UITransform)
        ?.setContentSize(distance, Math.min(118, Math.max(72, distance * 0.16)));
      handle.node.setPosition((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
      handle.node.setScale(1, handle.baseScale, 1);
      this.spawnTrailEcho(
        frame,
        handle.node.position,
        angle,
        1.04,
        preset.trailColor,
        0.16,
        this.projectileRoot,
        0.12,
      );
    } else {
      this.fitSpriteToFrame(handle.node, frame, 320);
      handle.node.setPosition(from);
      handle.node.setScale(handle.baseScale, handle.baseScale, 1);
      this.spawnTrailEcho(
        frame,
        from,
        angle,
        handle.baseScale * 0.78,
        preset.trailColor,
        0.18,
        this.projectileRoot,
        0.22,
      );
    }
    return true;
  }

  private playLayeredImpact(
    preset: BattleVfxPreset,
    position: BattlePoint,
    critical: boolean,
    priority: 'decorative' | 'essential' | 'critical',
    textureOverride?: BattleVfxTextureId,
  ): boolean {
    const textureId = textureOverride ?? preset.impactTexture;
    const frame = this.resolveFrame(textureId);
    if (!frame) {
      return false;
    }
    const reservation = this.limiter.reserve('impact', 0, priority);
    if (!reservation) {
      return false;
    }
    this.reclaimEvictedReservations();
    const handle = this.acquireSprite(
      this.impactPool,
      'VfxImpact',
      this.feedbackRoot,
      BATTLE_VFX_BUDGET.maxActiveImpacts,
    );
    if (!handle) {
      this.limiter.release(reservation);
      return false;
    }
    handle.active = true;
    handle.age = 0;
    handle.duration = critical ? preset.criticalLife : preset.impactLife;
    handle.critical = critical;
    handle.preset = preset;
    handle.reservation = reservation;
    handle.node.active = true;
    handle.node.setPosition(position.x, position.y + 10, 0);
    handle.node.angle = 0;
    handle.baseScale = preset.impactScale * (critical ? 1.24 : 1);
    this.fitSpriteToFrame(handle.node, frame, 270);
    handle.node.setScale(handle.baseScale, handle.baseScale, 1);
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = Color.WHITE;
    this.spawnTrailEcho(
      frame,
      handle.node.position,
      critical ? -18 : -10,
      handle.baseScale * preset.glowScale,
      preset.hitColor,
      handle.duration * 0.9,
      this.feedbackRoot,
      0.34,
    );
    this.playShockRing(preset, position, critical);
    this.playParticleBurst(preset, position, critical, priority);
    return true;
  }

  private playParticleBurst(
    preset: BattleVfxPreset,
    position: BattlePoint,
    critical: boolean,
    priority: 'decorative' | 'essential' | 'critical',
  ): void {
    const profile = IMPACT_PARTICLE_PROFILES[preset.impactProfile];
    const frame = this.resolveParticleFrame(preset);
    if (!frame) {
      return;
    }
    const count = critical ? preset.criticalParticleCount : preset.particleCount;
    const reservation = this.limiter.reserve('particle', count, priority);
    if (!reservation) {
      return;
    }
    this.reclaimEvictedReservations();
    const handle = this.acquireParticle();
    if (!handle) {
      this.limiter.release(reservation);
      return;
    }
    const particle = handle.particle;
    handle.active = true;
    handle.age = 0;
    handle.reservation = reservation;
    handle.node.active = true;
    handle.node.setPosition(position.x, position.y + 10, 0);
    particle.custom = true;
    particle.spriteFrame = frame;
    particle.totalParticles = count;
    particle.duration = 0.05;
    particle.emissionRate = count / 0.05;
    particle.life = Math.min(
      0.72,
      (critical ? preset.criticalLife : preset.impactLife) * profile.lifeScale,
    );
    particle.lifeVar = 0.12;
    handle.duration = particle.duration + particle.life + particle.lifeVar;
    particle.speed = profile.speed * (critical ? 1.24 : 1);
    particle.speedVar = profile.speedVar * (critical ? 1.12 : 1);
    particle.angle = profile.angle;
    particle.angleVar = profile.angleVar;
    particle.posVar = new Vec2(profile.spread[0], profile.spread[1]);
    particle.startSize = profile.startSize * (critical ? 1.28 : 1);
    particle.startSizeVar = profile.startSizeVar;
    particle.endSize = profile.endSize;
    particle.endSizeVar = 2;
    particle.gravity = new Vec2(profile.gravity[0], profile.gravity[1]);
    particle.startSpin = 0;
    particle.startSpinVar = 180;
    particle.endSpin = critical ? 240 : 160;
    particle.endSpinVar = 180;
    particle.startColor = this.colorFromTuple(preset.hitColor);
    particle.endColor = new Color(preset.hitColor[0], preset.hitColor[1], preset.hitColor[2], 0);
    particle.srcBlendFactor = gfx.BlendFactor.SRC_ALPHA;
    particle.dstBlendFactor = gfx.BlendFactor.ONE;
    particle.resetSystem();
  }

  private updateProjectiles(delta: number): void {
    for (const handle of this.projectilePool) {
      if (!handle.active || !handle.preset) continue;
      handle.age += delta;
      handle.trailTimer += delta;
      const progress = Math.min(1, handle.age / Math.max(0.001, handle.duration));
      const eased = 1 - (1 - progress) * (1 - progress);
      if (handle.beam) {
        const alpha = Math.floor(255 * Math.sin(Math.PI * Math.max(0.08, progress)));
        handle.sprite.color = new Color(255, 255, 255, alpha);
        handle.node.setScale(1, handle.baseScale * (0.74 + Math.sin(Math.PI * progress) * 0.42), 1);
      } else {
        handle.node.setPosition(
          handle.from.x + (handle.to.x - handle.from.x) * eased,
          handle.from.y + (handle.to.y - handle.from.y) * eased,
          0,
        );
        if (handle.trailTimer >= handle.preset.trailInterval) {
          handle.trailTimer = 0;
          this.spawnTrailEcho(
            handle.sprite.spriteFrame,
            handle.node.position,
            handle.node.angle,
            handle.baseScale * 0.7,
            handle.preset.trailColor,
            0.16,
            this.projectileRoot,
            0.18,
          );
        }
      }
      if (progress >= 1) {
        const preset = handle.preset;
        const target = { x: handle.to.x, y: handle.to.y };
        const critical = handle.critical;
        this.releaseSprite(handle);
        this.playLayeredImpact(preset, target, critical, critical ? 'critical' : 'essential');
      }
    }
  }

  private updateImpacts(delta: number): void {
    for (const handle of this.impactPool) {
      if (!handle.active) continue;
      handle.age += delta;
      const progress = Math.min(1, handle.age / Math.max(0.001, handle.duration));
      const scale =
        handle.baseScale * (0.76 + Math.sin(Math.PI * progress) * 0.54 + progress * 0.18);
      handle.node.setScale(scale, scale, 1);
      handle.sprite.color = new Color(255, 255, 255, Math.floor(255 * (1 - progress)));
      if (progress >= 1) this.releaseSprite(handle);
    }
  }

  private updateTrails(delta: number): void {
    for (const handle of this.trailPool) {
      if (!handle.active) continue;
      handle.age += delta;
      const progress = Math.min(1, handle.age / Math.max(0.001, handle.duration));
      const scale = handle.baseScale * (1 + progress * handle.growth);
      handle.node.setScale(scale, scale, 1);
      const color = handle.sprite.color;
      handle.sprite.color = new Color(
        color.r,
        color.g,
        color.b,
        Math.floor(handle.startAlpha * (1 - progress)),
      );
      if (progress >= 1) this.releaseSprite(handle);
    }
  }

  private updateParticles(delta: number): void {
    for (const handle of this.particlePool) {
      if (!handle.active) continue;
      handle.age += delta;
      if (handle.age >= handle.duration) this.releaseParticle(handle);
    }
  }

  private updateMarkers(): void {
    const pulse = 0.94 + Math.sin(this.nowSeconds * 4.2) * 0.06;
    for (const handle of this.markerPool) {
      if (handle.active) handle.node.setScale(0.42 * pulse, 0.42 * pulse, 1);
    }
  }

  private spawnTrailEcho(
    frame: SpriteFrame | null,
    position: Readonly<Vec3>,
    angle: number,
    scale: number,
    colorTuple: readonly [number, number, number, number],
    duration: number,
    parent: Node,
    growth: number,
  ): void {
    if (!frame) return;
    const handle = this.acquireSprite(
      this.trailPool,
      'VfxTrail',
      parent,
      BATTLE_VFX_BUDGET.maxActiveTrails,
    );
    if (!handle) return;
    handle.active = true;
    handle.age = 0;
    handle.duration = duration;
    handle.baseScale = scale;
    handle.growth = growth;
    handle.startAlpha = 145;
    handle.node.active = true;
    handle.node.setPosition(position.x, position.y, 0);
    handle.node.angle = angle;
    this.fitSpriteToFrame(handle.node, frame, 320);
    handle.node.setScale(handle.baseScale, handle.baseScale, 1);
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = new Color(colorTuple[0], colorTuple[1], colorTuple[2], 145);
  }

  private playSourceFlash(preset: BattleVfxPreset, position: BattlePoint): void {
    const sourceTextureId =
      BATTLE_VFX_TEXTURE_FALLBACKS[preset.impactTexture] ?? preset.impactTexture;
    const frame = this.resolveFrame(sourceTextureId);
    if (!frame) return;
    this.spawnTrailEcho(
      frame,
      new Vec3(position.x, position.y + 30, 0),
      (this.nowSeconds * 210) % 360,
      preset.impactScale * 0.72,
      preset.hitColor,
      Math.min(0.28, preset.travelSeconds),
      this.feedbackRoot,
      0.26,
    );
  }

  private playShockRing(preset: BattleVfxPreset, position: BattlePoint, critical: boolean): void {
    const frame = this.resolveFrame('runeMarker');
    if (!frame) return;
    const handle = this.acquireSprite(
      this.trailPool,
      'VfxShockRing',
      this.feedbackRoot,
      BATTLE_VFX_BUDGET.maxActiveTrails,
    );
    if (!handle) return;
    handle.active = true;
    handle.age = 0;
    handle.duration = critical ? 0.3 : 0.22;
    handle.baseScale = preset.impactScale * (critical ? 0.7 : 0.56);
    handle.growth = critical ? 1.15 : 0.92;
    handle.startAlpha = critical ? 225 : 190;
    handle.node.active = true;
    handle.node.setPosition(position.x, position.y + 6, 0);
    handle.node.angle = 0;
    this.fitSpriteToFrame(handle.node, frame, 240);
    handle.node.setScale(handle.baseScale, handle.baseScale, 1);
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = new Color(
      preset.hitColor[0],
      preset.hitColor[1],
      preset.hitColor[2],
      handle.startAlpha,
    );
  }

  private fitSpriteToFrame(node: Node, frame: SpriteFrame, maxLongSide: number): void {
    const size = frame.originalSize;
    const width = Math.max(1, size?.width ?? maxLongSide);
    const height = Math.max(1, size?.height ?? maxLongSide);
    const ratio = maxLongSide / Math.max(width, height);
    node.getComponent(UITransform)?.setContentSize(width * ratio, height * ratio);
  }

  private resolveFrame(textureId: BattleVfxTextureId): SpriteFrame | undefined {
    const primary = this.frames.get(textureId);
    if (primary) {
      return primary;
    }
    const fallbackId = BATTLE_VFX_TEXTURE_FALLBACKS[textureId];
    return fallbackId ? this.frames.get(fallbackId) : undefined;
  }

  private resolveParticleFrame(preset: BattleVfxPreset): SpriteFrame | undefined {
    return this.resolveFrame(IMPACT_PARTICLE_PROFILES[preset.impactProfile].texture);
  }

  private acquireSprite(
    pool: SpriteHandle[],
    name: string,
    parent: Node,
    maximum: number,
  ): SpriteHandle | undefined {
    const available = pool.find((handle) => !handle.active);
    if (available) {
      if (available.node.parent !== parent) available.node.setParent(parent);
      return available;
    }
    if (pool.length >= maximum) return undefined;
    const handle = this.createSpriteHandle(name, parent);
    pool.push(handle);
    return handle;
  }

  private createSpriteHandle(name: string, parent: Node): SpriteHandle {
    const node = new Node(`${name}${parent.children.length}`);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(256, 256);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    node.active = false;
    parent.addChild(node);
    return {
      node,
      sprite,
      active: false,
      age: 0,
      duration: 0,
      from: new Vec3(),
      to: new Vec3(),
      critical: false,
      baseScale: 1,
      growth: 0.28,
      startAlpha: 145,
      trailTimer: 0,
      beam: false,
    };
  }

  private acquireParticle(): ParticleHandle | undefined {
    const available = this.particlePool.find((handle) => !handle.active);
    if (available) return available;
    if (this.particlePool.length >= BATTLE_VFX_BUDGET.maxActiveParticleSystems) return undefined;
    const node = new Node(`VfxParticle${this.particlePool.length}`);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(128, 128);
    const particle = node.addComponent(ParticleSystem2D);
    particle.autoRemoveOnFinish = false;
    node.active = false;
    this.feedbackRoot.addChild(node);
    const handle = { node, particle, active: false, age: 0, duration: 0 };
    this.particlePool.push(handle);
    return handle;
  }

  private releaseSprite(handle: SpriteHandle): void {
    if (handle.reservation) this.limiter.release(handle.reservation);
    handle.active = false;
    handle.age = 0;
    handle.duration = 0;
    handle.preset = undefined;
    handle.reservation = undefined;
    handle.critical = false;
    handle.baseScale = 1;
    handle.growth = 0.28;
    handle.startAlpha = 145;
    handle.trailTimer = 0;
    handle.beam = false;
    handle.sprite.spriteFrame = null;
    handle.sprite.color = Color.WHITE;
    handle.node.angle = 0;
    handle.node.setScale(1, 1, 1);
    handle.node.active = false;
  }

  private releaseParticle(handle: ParticleHandle): void {
    if (handle.reservation) this.limiter.release(handle.reservation);
    handle.particle.spriteFrame = null;
    handle.particle.stopSystem();
    handle.active = false;
    handle.age = 0;
    handle.duration = 0;
    handle.reservation = undefined;
    handle.node.active = false;
  }

  private reclaimEvictedReservations(): void {
    const evictedIds = new Set(this.limiter.drainEvictedReservations().map((item) => item.id));
    if (evictedIds.size === 0) return;
    for (const handle of [...this.projectilePool, ...this.impactPool]) {
      if (handle.reservation && evictedIds.has(handle.reservation.id)) this.releaseSprite(handle);
    }
    for (const handle of this.particlePool) {
      if (handle.reservation && evictedIds.has(handle.reservation.id)) this.releaseParticle(handle);
    }
  }

  private warnMissingTexture(textureId: BattleVfxTextureId, filename: string): void {
    if (this.warnedTextures.has(textureId)) return;
    this.warnedTextures.add(textureId);
    console.warn(`Battle VFX texture unavailable, skipping authored effect: ${filename}`);
  }

  private colorFromTuple(tuple: readonly [number, number, number, number]): Color {
    return new Color(tuple[0], tuple[1], tuple[2], tuple[3]);
  }
}

function loadBattleVfxBundle(): Promise<unknown | null> {
  return new Promise((resolve) => {
    assetManager.loadBundle('ui', (error, bundle) => resolve(error ? null : bundle));
  });
}

function loadVfxSpriteFrame(bundle: any, filename: string): Promise<SpriteFrame | null> {
  return new Promise((resolve) => {
    const spec = getUiArtAsset(filename);
    if (!spec?.path) {
      resolve(null);
      return;
    }
    bundle.load(spec.path, (error, asset) => {
      if (error || !asset) {
        resolve(null);
        return;
      }
      if (asset instanceof SpriteFrame) {
        resolve(asset);
        return;
      }
      if (asset instanceof ImageAsset) {
        resolve(SpriteFrame.createWithImage(asset));
        return;
      }
      if (asset instanceof Texture2D) {
        const frame = new SpriteFrame();
        frame.texture = asset;
        resolve(frame);
        return;
      }
      resolve(null);
    });
  });
}
