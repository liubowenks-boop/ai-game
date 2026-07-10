// @ts-nocheck
import {
  assetManager,
  Color,
  Graphics,
  ImageAsset,
  Layers,
  Node,
  ParticleSystem2D,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';

import { getUiArtAsset } from '../ui/UiArtManifest';
import { BattleMvpModel, BattleTickResult } from './BattleMvpModel';

type AutoAttackSource = 'main' | 'thunder_chain';

interface EffectSegment {
  from: Vec3;
  to: Vec3;
  color: Color;
  width: number;
  age: number;
  duration: number;
}

interface AttackProjectile {
  from: Vec3;
  to: Vec3;
  age: number;
  duration: number;
  critical: boolean;
  source: AutoAttackSource;
  hitSpawned: boolean;
}

interface HitBurst {
  position: Vec3;
  age: number;
  duration: number;
  critical: boolean;
  fire: boolean;
}

const fxSpriteFrameCache = new Map<string, SpriteFrame>();
const FX_SPRITE_FILENAMES: Record<'gold' | 'fire', string> = {
  gold: 'fx_glow_gold_soft.png',
  fire: 'fx_fire_small.png',
};

export class PlayerAutoAttackSystem {
  private readonly effectNode: Node;
  private readonly graphics: Graphics;
  private readonly segments: EffectSegment[] = [];
  private readonly projectiles: AttackProjectile[] = [];
  private readonly hitBursts: HitBurst[] = [];

  public constructor(
    effectLayer: Node,
    private readonly playerNode: Node,
  ) {
    this.effectNode = new Node('AutoAttackEffect');
    this.effectNode.layer = Layers.Enum.UI_2D;
    const transform = this.effectNode.addComponent(UITransform);
    transform.setContentSize(720, 1280);
    this.graphics = this.effectNode.addComponent(Graphics);
    effectLayer.addChild(this.effectNode);
    loadFxSpriteFrame('gold', () => undefined);
    loadFxSpriteFrame('fire', () => undefined);
  }

  public refresh(result: BattleTickResult, model: BattleMvpModel): void {
    const attackEvents = result.attackEvents.filter(
      (event) => event.source === 'main' || event.source === 'thunder_chain',
    );

    if (attackEvents.length === 0) {
      return;
    }

    this.segments.length = 0;

    for (const event of attackEvents) {
      if (event.source === 'main') {
        this.spawnGoldenArrowProjectile(event);
        continue;
      }

      this.segments.push({
        from: this.playerNode.position.clone(),
        to: new Vec3(event.enemyPosition.x, event.enemyPosition.y, 0),
        color: new Color(100, 230, 255, 230),
        width: 4,
        age: 0,
        duration: 0.12,
      });
    }

    this.draw(model);
  }

  public update(deltaSeconds: number, model: BattleMvpModel): void {
    if (!this.hasActiveEffects()) {
      return;
    }

    for (const segment of this.segments) {
      segment.age += deltaSeconds;
    }

    for (const projectile of this.projectiles) {
      projectile.age += deltaSeconds;

      if (!projectile.hitSpawned && projectile.age >= projectile.duration) {
        projectile.hitSpawned = true;
        this.spawnHitBurst(projectile);
      }
    }

    for (const burst of this.hitBursts) {
      burst.age += deltaSeconds;
    }

    this.pruneFinishedEffects();
    this.draw(model);
  }

  public clear(): void {
    this.segments.length = 0;
    this.projectiles.length = 0;
    this.hitBursts.length = 0;
    this.graphics.clear();
  }

  private spawnGoldenArrowProjectile(event: BattleTickResult['attackEvents'][number]): void {
    const from = this.playerNode.position.clone();
    from.y += 44;
    const to = new Vec3(event.enemyPosition.x, event.enemyPosition.y + 18, 0);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = Math.max(0.28, Math.min(0.56, distance / 1000));

    this.projectiles.push({
      from,
      to,
      age: 0,
      duration,
      critical: Boolean(event.critical),
      source: 'main',
      hitSpawned: false,
    });
  }

  private spawnHitBurst(projectile: AttackProjectile): void {
    this.hitBursts.push({
      position: projectile.to.clone(),
      age: 0,
      duration: projectile.critical ? 0.34 : 0.24,
      critical: projectile.critical,
      fire: false,
    });
    this.spawnHitParticleBurst(projectile.to, projectile.critical);

    if (projectile.critical) {
      this.criticalFireBurst(projectile.to);
    }
  }

  private criticalFireBurst(position: Vec3): void {
    this.hitBursts.push({
      position: position.clone(),
      age: 0,
      duration: 0.42,
      critical: true,
      fire: true,
    });
    this.spawnHitParticleBurst(position, true);
  }

  private draw(model: BattleMvpModel): void {
    this.graphics.clear();

    const crowded = model.enemies.length >= 10;

    for (const segment of this.segments) {
      const mutedAlpha = crowded && segment.width <= 5 ? 120 : segment.color.a;
      const color = new Color(segment.color.r, segment.color.g, segment.color.b, mutedAlpha);
      const lineWidth = Math.max(segment.width, model.mainAttackDamage >= 20 ? 7 : segment.width);
      const lifeRatio = Math.max(0, 1 - segment.age / segment.duration);
      const lineColor = new Color(color.r, color.g, color.b, Math.floor(color.a * lifeRatio));

      this.graphics.strokeColor = new Color(
        lineColor.r,
        lineColor.g,
        lineColor.b,
        Math.floor(lineColor.a * 0.32),
      );
      this.graphics.lineWidth = lineWidth + 8;
      this.graphics.moveTo(segment.from.x, segment.from.y);
      this.graphics.lineTo(segment.to.x, segment.to.y);
      this.graphics.stroke();

      if (segment.width <= 4) {
        this.graphics.strokeColor = new Color(
          lineColor.r,
          lineColor.g,
          lineColor.b,
          Math.floor(lineColor.a * 0.55),
        );
        this.graphics.lineWidth = 2;
        this.graphics.moveTo(segment.from.x - 4, segment.from.y + 2);
        this.graphics.lineTo(segment.to.x - 4, segment.to.y + 2);
        this.graphics.stroke();
        this.graphics.moveTo(segment.from.x + 4, segment.from.y - 2);
        this.graphics.lineTo(segment.to.x + 4, segment.to.y - 2);
        this.graphics.stroke();
      }

      this.graphics.strokeColor = lineColor;
      this.graphics.lineWidth = lineWidth;
      this.graphics.moveTo(segment.from.x, segment.from.y);
      this.graphics.lineTo(segment.to.x, segment.to.y);
      this.graphics.stroke();
    }

    for (const projectile of this.projectiles) {
      this.drawGoldenArrowProjectile(projectile);
    }

    for (const burst of this.hitBursts) {
      this.drawHitBurst(burst);
    }
  }

  private drawGoldenArrowProjectile(projectile: AttackProjectile): void {
    const progress = Math.max(0, Math.min(1, projectile.age / projectile.duration));
    const eased = 1 - Math.pow(1 - progress, 2);
    const position = this.lerp(projectile.from, projectile.to, eased);
    const direction = this.normalized(projectile.from, projectile.to);
    const perpendicular = new Vec3(-direction.y, direction.x, 0);
    const trailLength = projectile.critical ? 116 : 92;
    const arrowLength = projectile.critical ? 28 : 22;
    const arrowWidth = projectile.critical ? 13 : 9;
    const alpha = Math.floor((projectile.critical ? 255 : 230) * Math.sin(Math.max(0.12, progress) * Math.PI));
    const tail = new Vec3(
      position.x - direction.x * trailLength,
      position.y - direction.y * trailLength,
      0,
    );
    const base = new Vec3(
      position.x - direction.x * arrowLength,
      position.y - direction.y * arrowLength,
      0,
    );
    const sideA = new Vec3(
      base.x + perpendicular.x * arrowWidth,
      base.y + perpendicular.y * arrowWidth,
      0,
    );
    const sideB = new Vec3(
      base.x - perpendicular.x * arrowWidth,
      base.y - perpendicular.y * arrowWidth,
      0,
    );

    this.drawProjectileLightBloom(position, tail, perpendicular, projectile.critical, alpha);

    this.graphics.strokeColor = new Color(255, 185, 52, Math.floor(alpha * 0.28));
    this.graphics.lineWidth = projectile.critical ? 20 : 15;
    this.graphics.moveTo(tail.x, tail.y);
    this.graphics.lineTo(position.x, position.y);
    this.graphics.stroke();

    this.graphics.strokeColor = new Color(255, 229, 118, Math.floor(alpha * 0.72));
    this.graphics.lineWidth = projectile.critical ? 9 : 6;
    this.graphics.moveTo(tail.x, tail.y);
    this.graphics.lineTo(position.x, position.y);
    this.graphics.stroke();

    this.graphics.strokeColor = new Color(255, 255, 226, alpha);
    this.graphics.lineWidth = projectile.critical ? 3 : 2;
    this.graphics.moveTo(
      tail.x + perpendicular.x * 2,
      tail.y + perpendicular.y * 2,
    );
    this.graphics.lineTo(position.x, position.y);
    this.graphics.stroke();

    this.graphics.fillColor = new Color(255, 239, 150, alpha);
    this.graphics.moveTo(position.x, position.y);
    this.graphics.lineTo(sideA.x, sideA.y);
    this.graphics.lineTo(sideB.x, sideB.y);
    this.graphics.close();
    this.graphics.fill();
  }

  private drawProjectileLightBloom(
    position: Vec3,
    tail: Vec3,
    perpendicular: Vec3,
    critical: boolean,
    alpha: number,
  ): void {
    this.graphics.strokeColor = new Color(255, 214, 82, Math.floor(alpha * 0.18));
    this.graphics.lineWidth = critical ? 30 : 24;
    this.graphics.moveTo(tail.x, tail.y);
    this.graphics.lineTo(position.x, position.y);
    this.graphics.stroke();

    this.graphics.fillColor = new Color(255, 232, 118, Math.floor(alpha * 0.24));
    this.graphics.circle(position.x, position.y, critical ? 22 : 17);
    this.graphics.fill();

    this.graphics.fillColor = new Color(255, 255, 232, Math.floor(alpha * 0.58));
    this.graphics.circle(position.x, position.y, critical ? 7 : 5);
    this.graphics.fill();

    const sparkleCount = critical ? 4 : 3;
    for (let index = 1; index <= sparkleCount; index += 1) {
      const ratio = index / (sparkleCount + 1);
      const side = index % 2 === 0 ? 1 : -1;
      const sparkleX = tail.x + (position.x - tail.x) * ratio + perpendicular.x * side * (7 + index * 2);
      const sparkleY = tail.y + (position.y - tail.y) * ratio + perpendicular.y * side * (7 + index * 2);
      this.graphics.fillColor = new Color(255, 248, 174, Math.floor(alpha * (0.2 + ratio * 0.18)));
      this.graphics.circle(sparkleX, sparkleY, critical ? 4 : 3);
      this.graphics.fill();
    }
  }

  private drawHitBurst(burst: HitBurst): void {
    const progress = Math.max(0, Math.min(1, burst.age / burst.duration));
    const alpha = Math.floor(255 * (1 - progress));
    const radius = (burst.fire ? 30 : burst.critical ? 24 : 17) + progress * (burst.fire ? 34 : 24);
    const coreColor = burst.fire
      ? new Color(255, 96, 32, alpha)
      : burst.critical
        ? new Color(255, 184, 54, alpha)
        : new Color(255, 236, 142, alpha);
    const glowColor = burst.fire
      ? new Color(255, 68, 20, Math.floor(alpha * 0.32))
      : new Color(255, 214, 88, Math.floor(alpha * 0.28));

    this.graphics.fillColor = glowColor;
    this.graphics.circle(burst.position.x, burst.position.y, radius);
    this.graphics.fill();

    this.drawImpactGlowHalo(burst, progress, alpha, radius);

    this.graphics.strokeColor = coreColor;
    this.graphics.lineWidth = burst.fire ? 5 : burst.critical ? 4 : 3;
    const rayCount = burst.fire ? 14 : 10;
    for (let index = 0; index < rayCount; index += 1) {
      const angle = (Math.PI * 2 * index) / rayCount + progress * 0.6;
      const inner = radius * 0.22;
      const outer = radius * (burst.fire ? 0.9 : 0.72);
      this.graphics.moveTo(
        burst.position.x + Math.cos(angle) * inner,
        burst.position.y + Math.sin(angle) * inner,
      );
      this.graphics.lineTo(
        burst.position.x + Math.cos(angle) * outer,
        burst.position.y + Math.sin(angle) * outer,
      );
    }
    this.graphics.stroke();
  }

  private drawImpactGlowHalo(burst: HitBurst, progress: number, alpha: number, radius: number): void {
    const haloAlpha = Math.floor(alpha * (burst.fire ? 0.48 : 0.34));
    const haloColor = burst.fire
      ? new Color(255, 126, 42, haloAlpha)
      : new Color(255, 238, 128, haloAlpha);

    this.graphics.strokeColor = haloColor;
    this.graphics.lineWidth = burst.fire ? 7 : burst.critical ? 6 : 4;
    this.graphics.circle(
      burst.position.x,
      burst.position.y,
      radius + 10 + progress * (burst.fire ? 24 : 16),
    );
    this.graphics.stroke();

    this.graphics.fillColor = burst.fire
      ? new Color(255, 82, 22, Math.floor(alpha * 0.2))
      : new Color(255, 230, 112, Math.floor(alpha * 0.18));
    this.graphics.circle(burst.position.x, burst.position.y, radius * 0.62);
    this.graphics.fill();
  }

  private spawnHitParticleBurst(position: Vec3, critical: boolean): void {
    const node = new Node(critical ? 'CriticalFireHitParticles' : 'GoldenArrowHitParticles');
    node.layer = Layers.Enum.UI_2D;
    node.setPosition(position.x, position.y, 0);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(96, 96);
    this.effectNode.addChild(node);

    const particle = node.addComponent(ParticleSystem2D);
    this.configureHitParticleSystem(particle, critical);
    loadFxSpriteFrame(critical ? 'fire' : 'gold', (frame) => {
      if (!node.isValid) {
        return;
      }

      if (!frame) {
        node.destroy();
        return;
      }

      particle.spriteFrame = frame;
      particle.resetSystem();
    });
  }

  private configureHitParticleSystem(particle: ParticleSystem2D, critical: boolean): void {
    particle.custom = true;
    particle.playOnLoad = false;
    particle.autoRemoveOnFinish = true;
    particle.duration = critical ? 0.24 : 0.18;
    particle.emissionRate = critical ? 440 : 280;
    particle.life = critical ? 0.46 : 0.32;
    particle.lifeVar = critical ? 0.16 : 0.1;
    particle.totalParticles = critical ? 84 : 52;
    particle.startColor = critical
      ? new Color(255, 96, 32, 245)
      : new Color(255, 236, 142, 230);
    particle.startColorVar = critical
      ? new Color(20, 42, 10, 0)
      : new Color(8, 18, 8, 0);
    particle.endColor = critical
      ? new Color(255, 48, 16, 0)
      : new Color(255, 210, 88, 0);
    particle.angle = 90;
    particle.angleVar = critical ? 190 : 150;
    particle.startSize = critical ? 26 : 18;
    particle.startSizeVar = critical ? 11 : 7;
    particle.endSize = 0;
    particle.endSizeVar = 0;
    particle.posVar = critical ? new Vec2(26, 20) : new Vec2(18, 13);
    particle.positionType = ParticleSystem2D.PositionType.FREE;
    particle.emitterMode = ParticleSystem2D.EmitterMode.GRAVITY;
    particle.gravity = critical ? new Vec2(0, -210) : new Vec2(0, -110);
    particle.speed = critical ? 190 : 126;
    particle.speedVar = critical ? 78 : 48;
    particle.tangentialAccel = critical ? 110 : 54;
    particle.tangentialAccelVar = critical ? 56 : 26;
    particle.radialAccel = critical ? 68 : 32;
    particle.radialAccelVar = critical ? 34 : 16;
    particle.rotationIsDir = true;
  }

  private hasActiveEffects(): boolean {
    return (
      this.segments.length > 0 ||
      this.projectiles.length > 0 ||
      this.hitBursts.length > 0
    );
  }

  private pruneFinishedEffects(): void {
    this.pruneArray(this.segments, (segment) => segment.age <= segment.duration);
    this.pruneArray(
      this.projectiles,
      (projectile) => projectile.age <= projectile.duration + 0.08,
    );
    this.pruneArray(this.hitBursts, (burst) => burst.age <= burst.duration);

    if (!this.hasActiveEffects()) {
      this.graphics.clear();
    }
  }

  private pruneArray<T>(items: T[], keep: (item: T) => boolean): void {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (!keep(items[index])) {
        items.splice(index, 1);
      }
    }
  }

  private lerp(from: Vec3, to: Vec3, progress: number): Vec3 {
    return new Vec3(
      from.x + (to.x - from.x) * progress,
      from.y + (to.y - from.y) * progress,
      0,
    );
  }

  private normalized(from: Vec3, to: Vec3): Vec3 {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    return new Vec3(dx / length, dy / length, 0);
  }
}

function loadFxSpriteFrame(variant: 'gold' | 'fire', done: (frame: SpriteFrame | null) => void): void {
  const filename = FX_SPRITE_FILENAMES[variant];
  const cached = fxSpriteFrameCache.get(filename);
  if (cached) {
    done(cached);
    return;
  }

  const spec = getUiArtAsset(filename);
  if (!spec) {
    done(null);
    return;
  }

  assetManager.loadAny(spec.uuid, (error, asset) => {
    if (error || !asset) {
      done(null);
      return;
    }

    let frame: SpriteFrame | null = null;
    if (asset instanceof SpriteFrame) {
      frame = asset;
    } else if (asset instanceof ImageAsset) {
      frame = SpriteFrame.createWithImage(asset);
    } else if (asset instanceof Texture2D) {
      frame = new SpriteFrame();
      frame.texture = asset;
    }

    if (!frame) {
      done(null);
      return;
    }

    fxSpriteFrameCache.set(filename, frame);
    done(frame);
  });
}
