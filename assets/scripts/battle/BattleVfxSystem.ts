// @ts-nocheck
import {
  assetManager,
  Color,
  gfx,
  Graphics,
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
  BATTLE_VFX_TEXTURES,
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
}

interface ParticleHandle {
  readonly node: Node;
  readonly particle: ParticleSystem2D;
  active: boolean;
  age: number;
  duration: number;
  reservation?: VfxReservation;
}

interface FallbackSegment {
  from: Vec3;
  to: Vec3;
  color: Color;
  age: number;
  duration: number;
}

interface FallbackBurst {
  position: Vec3;
  color: Color;
  age: number;
  duration: number;
}

const textureFrameCache = new Map<string, Promise<SpriteFrame | null>>();

export class BattleVfxSystem {
  private readonly limiter = new BattleVfxLimiter(BATTLE_VFX_BUDGET);
  private readonly frames = new Map<BattleVfxTextureId, SpriteFrame>();
  private readonly failedTextures = new Set<BattleVfxTextureId>();
  private readonly warnedTextures = new Set<BattleVfxTextureId>();
  private readonly projectilePool: SpriteHandle[] = [];
  private readonly impactPool: SpriteHandle[] = [];
  private readonly particlePool: ParticleHandle[] = [];
  private readonly markerPool: SpriteHandle[] = [];
  private readonly fallbackNode: Node;
  private readonly fallbackGraphics: Graphics;
  private readonly fallbackSegments: FallbackSegment[] = [];
  private readonly fallbackBursts: FallbackBurst[] = [];
  private nowSeconds = 0;
  private preloadPromise?: Promise<void>;
  private disposed = false;

  public constructor(
    private readonly projectileRoot: Node,
    private readonly feedbackRoot: Node,
  ) {
    this.fallbackNode = new Node('BattleVfxGraphicsFallback');
    this.fallbackNode.layer = Layers.Enum.UI_2D;
    this.fallbackNode.addComponent(UITransform).setContentSize(720, 1280);
    this.fallbackGraphics = this.fallbackNode.addComponent(Graphics);
    this.feedbackRoot.addChild(this.fallbackNode);
  }

  public async preload(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    this.preloadPromise = Promise.all(
      Object.entries(BATTLE_VFX_TEXTURES).map(async ([textureId, filename]) => {
        const frame = await loadVfxSpriteFrame(filename);
        if (this.disposed) {
          return;
        }
        if (frame) {
          this.frames.set(textureId as BattleVfxTextureId, frame);
        } else {
          this.failedTextures.add(textureId as BattleVfxTextureId);
          this.warnMissingTexture(textureId as BattleVfxTextureId, filename);
        }
      }),
    ).then(() => undefined);
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

    const played = this.playImpact(
      preset,
      event.enemyPosition,
      Boolean(event.critical),
      event.killed ? 'critical' : event.impactKind === 'status' ? 'decorative' : 'essential',
    );
    return { played, presetId: preset.id };
  }

  public playStatusImpact(event: AttackEvent): void {
    if (event.impactKind === 'status') {
      this.playAttackEvent(event);
    }
  }

  public playEnemyDeath(position: BattlePoint, kind: EnemyKind): void {
    const preset = kind === 'boss' ? BATTLE_VFX_PRESETS.main_fire_gold : BATTLE_VFX_PRESETS.shield_impact;
    this.playImpact(preset, position, kind === 'boss', 'critical');
  }

  public playWallImpact(position: BattlePoint = { x: 0, y: -300 }): void {
    this.playImpact(BATTLE_VFX_PRESETS.shield_impact, position, false, 'essential', 'smokeDebris');
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
    this.updateParticles(delta);
    this.updateMarkers();
    this.updateFallback(delta);
  }

  public getDebugSnapshot(): {
    activeProjectiles: number;
    activeImpacts: number;
    activeParticleSystems: number;
    estimatedParticles: number;
    pooledNodes: number;
  } {
    const snapshot = this.limiter.getSnapshot();
    return {
      ...snapshot,
      pooledNodes:
        this.projectilePool.length +
        this.impactPool.length +
        this.particlePool.length +
        this.markerPool.length,
    };
  }

  public clear(): void {
    for (const handle of this.projectilePool) this.releaseSprite(handle);
    for (const handle of this.impactPool) this.releaseSprite(handle);
    for (const handle of this.markerPool) {
      handle.active = false;
      handle.node.active = false;
    }
    for (const handle of this.particlePool) this.releaseParticle(handle);
    this.fallbackSegments.length = 0;
    this.fallbackBursts.length = 0;
    this.fallbackGraphics.clear();
    this.limiter.reset();
    this.nowSeconds = 0;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.clear();
    this.disposed = true;
    for (const handle of [...this.projectilePool, ...this.impactPool, ...this.markerPool]) {
      handle.node.destroy();
    }
    for (const handle of this.particlePool) handle.node.destroy();
    this.fallbackNode.destroy();
    this.projectilePool.length = 0;
    this.impactPool.length = 0;
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
    const reservation = this.limiter.reserve('projectile', 0, 'essential');
    if (!reservation) {
      return false;
    }
    const frame = this.frames.get(preset.projectileTexture);
    const from = new Vec3(origin.x, origin.y + 36, 0);
    const to = new Vec3(target.x, target.y + 12, 0);
    if (!frame) {
      this.limiter.release(reservation);
      this.fallbackSegments.push({
        from,
        to,
        color: this.colorFromTuple(preset.trailColor),
        age: 0,
        duration: preset.travelSeconds,
      });
      this.playImpact(preset, target, Boolean(event.critical), 'essential');
      return true;
    }

    const handle = this.acquireSprite(this.projectilePool, 'VfxProjectile', this.projectileRoot, BATTLE_VFX_BUDGET.maxActiveProjectiles);
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
    handle.reservation = reservation;
    handle.node.active = true;
    handle.node.setPosition(from);
    const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
    handle.node.angle = angle;
    handle.node.setScale(event.critical ? 0.58 : 0.46, event.critical ? 0.58 : 0.46, 1);
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = Color.WHITE;
    return true;
  }

  private playImpact(
    preset: BattleVfxPreset,
    position: BattlePoint,
    critical: boolean,
    priority: 'decorative' | 'essential' | 'critical',
    textureOverride?: BattleVfxTextureId,
  ): boolean {
    const reservation = this.limiter.reserve('impact', 0, priority);
    if (!reservation) {
      return false;
    }
    const textureId = textureOverride ?? preset.impactTexture;
    const frame = this.frames.get(textureId);
    const color = this.colorFromTuple(preset.hitColor);
    if (!frame) {
      this.limiter.release(reservation);
      this.fallbackBursts.push({
        position: new Vec3(position.x, position.y + 10, 0),
        color,
        age: 0,
        duration: critical ? preset.criticalLife : preset.impactLife,
      });
      return true;
    }

    const handle = this.acquireSprite(this.impactPool, 'VfxImpact', this.feedbackRoot, BATTLE_VFX_BUDGET.maxActiveImpacts);
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
    handle.node.setScale(critical ? 0.18 : 0.11, critical ? 0.18 : 0.11, 1);
    handle.sprite.spriteFrame = frame;
    handle.sprite.color = Color.WHITE;
    this.playParticleBurst(preset, position, critical, frame, priority);
    return true;
  }

  private playParticleBurst(
    preset: BattleVfxPreset,
    position: BattlePoint,
    critical: boolean,
    frame: SpriteFrame,
    priority: 'decorative' | 'essential' | 'critical',
  ): void {
    const count = critical ? preset.criticalParticleCount : preset.particleCount;
    const reservation = this.limiter.reserve('particle', count, priority);
    if (!reservation) {
      return;
    }
    const handle = this.acquireParticle();
    if (!handle) {
      this.limiter.release(reservation);
      return;
    }
    const particle = handle.particle;
    handle.active = true;
    handle.age = 0;
    handle.duration = critical ? preset.criticalLife : preset.impactLife;
    handle.reservation = reservation;
    handle.node.active = true;
    handle.node.setPosition(position.x, position.y + 10, 0);
    particle.custom = true;
    particle.spriteFrame = frame;
    particle.totalParticles = count;
    particle.duration = 0.05;
    particle.emissionRate = count / 0.05;
    particle.life = Math.min(0.65, handle.duration);
    particle.lifeVar = 0.12;
    particle.speed = critical ? 150 : 105;
    particle.speedVar = critical ? 80 : 55;
    particle.angle = 90;
    particle.angleVar = 180;
    particle.startSize = critical ? 34 : 24;
    particle.startSizeVar = 12;
    particle.endSize = 4;
    particle.endSizeVar = 3;
    particle.gravity = new Vec2(0, -34);
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
      const progress = Math.min(1, handle.age / Math.max(0.001, handle.duration));
      const eased = 1 - (1 - progress) * (1 - progress);
      handle.node.setPosition(
        handle.from.x + (handle.to.x - handle.from.x) * eased,
        handle.from.y + (handle.to.y - handle.from.y) * eased,
        0,
      );
      if (progress >= 1) {
        const preset = handle.preset;
        const target = { x: handle.to.x, y: handle.to.y };
        const critical = handle.critical;
        this.releaseSprite(handle);
        this.playImpact(preset, target, critical, critical ? 'critical' : 'essential');
      }
    }
  }

  private updateImpacts(delta: number): void {
    for (const handle of this.impactPool) {
      if (!handle.active) continue;
      handle.age += delta;
      const progress = Math.min(1, handle.age / Math.max(0.001, handle.duration));
      const startScale = handle.critical ? 0.18 : 0.11;
      const scale = startScale * (0.82 + progress * 0.7);
      handle.node.setScale(scale, scale, 1);
      handle.sprite.color = new Color(255, 255, 255, Math.floor(255 * (1 - progress)));
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

  private updateFallback(delta: number): void {
    this.fallbackGraphics.clear();
    for (const segment of this.fallbackSegments) segment.age += delta;
    for (const burst of this.fallbackBursts) burst.age += delta;
    for (const segment of this.fallbackSegments) {
      const alpha = Math.max(0, 1 - segment.age / segment.duration);
      this.fallbackGraphics.strokeColor = new Color(segment.color.r, segment.color.g, segment.color.b, Math.floor(230 * alpha));
      this.fallbackGraphics.lineWidth = 5;
      this.fallbackGraphics.moveTo(segment.from.x, segment.from.y);
      this.fallbackGraphics.lineTo(segment.to.x, segment.to.y);
      this.fallbackGraphics.stroke();
    }
    for (const burst of this.fallbackBursts) {
      const progress = Math.min(1, burst.age / burst.duration);
      const alpha = Math.floor(240 * (1 - progress));
      const radius = 14 + progress * 24;
      this.fallbackGraphics.strokeColor = new Color(burst.color.r, burst.color.g, burst.color.b, alpha);
      this.fallbackGraphics.lineWidth = 3;
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = (Math.PI * 2 * ray) / 8;
        this.fallbackGraphics.moveTo(burst.position.x + Math.cos(angle) * 5, burst.position.y + Math.sin(angle) * 5);
        this.fallbackGraphics.lineTo(burst.position.x + Math.cos(angle) * radius, burst.position.y + Math.sin(angle) * radius);
      }
      this.fallbackGraphics.stroke();
    }
    for (let index = this.fallbackSegments.length - 1; index >= 0; index -= 1) {
      if (this.fallbackSegments[index].age >= this.fallbackSegments[index].duration) this.fallbackSegments.splice(index, 1);
    }
    for (let index = this.fallbackBursts.length - 1; index >= 0; index -= 1) {
      if (this.fallbackBursts[index].age >= this.fallbackBursts[index].duration) this.fallbackBursts.splice(index, 1);
    }
  }

  private acquireSprite(pool: SpriteHandle[], name: string, parent: Node, maximum: number): SpriteHandle | undefined {
    const available = pool.find((handle) => !handle.active);
    if (available) return available;
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
    handle.sprite.spriteFrame = null;
    handle.sprite.color = Color.WHITE;
    handle.node.angle = 0;
    handle.node.setScale(1, 1, 1);
    handle.node.active = false;
  }

  private releaseParticle(handle: ParticleHandle): void {
    if (handle.reservation) this.limiter.release(handle.reservation);
    handle.particle.stopSystem();
    handle.particle.spriteFrame = null;
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
    console.warn(`Battle VFX texture unavailable, using Graphics fallback: ${filename}`);
  }

  private colorFromTuple(tuple: readonly [number, number, number, number]): Color {
    return new Color(tuple[0], tuple[1], tuple[2], tuple[3]);
  }
}

function loadVfxSpriteFrame(filename: string): Promise<SpriteFrame | null> {
  const cached = textureFrameCache.get(filename);
  if (cached) return cached;
  const promise = new Promise<SpriteFrame | null>((resolve) => {
    const spec = getUiArtAsset(filename);
    if (!spec?.uuid) {
      resolve(null);
      return;
    }
    assetManager.loadAny(spec.uuid, (error, asset) => {
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
  textureFrameCache.set(filename, promise);
  return promise;
}
