import type { HeroRole } from '../data/BattleConfig';
import {
  findFixedCompanionByAttackSource,
  type FixedCompanionAttackSource,
} from '../data/CompanionConfig';
import {
  BATTLE_VFX_PRESETS,
  BattleVfxBudget,
  BattleVfxPreset,
  HERO_VFX_PRESET_BY_NAME,
  HERO_VFX_PRESET_BY_ROLE,
} from '../data/BattleVfxConfig';

export interface AttackVfxDescriptor {
  readonly source:
    'main' | FixedCompanionAttackSource | 'hero_dps' | 'burn' | 'poison' | 'thunder_chain';
  readonly heroName?: string;
  readonly heroRole?: HeroRole;
}

export type VfxReservationKind = 'projectile' | 'impact' | 'particle';
export type VfxReservationPriority = 'decorative' | 'essential' | 'critical';

export interface VfxReservation {
  readonly id: number;
  readonly kind: VfxReservationKind;
  readonly estimate: number;
  readonly priority: VfxReservationPriority;
}

export interface BattleVfxBudgetSnapshot {
  readonly activeProjectiles: number;
  readonly activeImpacts: number;
  readonly activeParticleSystems: number;
  readonly estimatedParticles: number;
}

export function resolveHeroVfxPreset(heroName: string, role: HeroRole): BattleVfxPreset {
  const presetId = HERO_VFX_PRESET_BY_NAME[heroName] ?? HERO_VFX_PRESET_BY_ROLE[role];
  return BATTLE_VFX_PRESETS[presetId] ?? BATTLE_VFX_PRESETS.gold_arrow;
}

export function resolveAttackVfxPreset(input: AttackVfxDescriptor): BattleVfxPreset {
  if (input.source === 'main') {
    return BATTLE_VFX_PRESETS.main_fire_gold;
  }
  const companion = findFixedCompanionByAttackSource(input.source);
  if (companion) {
    const preset = BATTLE_VFX_PRESETS[companion.vfxPresetId];
    if (!preset) {
      throw new Error(`Missing fixed companion VFX preset: ${companion.vfxPresetId}`);
    }
    return preset;
  }
  if (input.source === 'thunder_chain') {
    return BATTLE_VFX_PRESETS.thunder;
  }
  if (input.heroRole) {
    return resolveHeroVfxPreset(input.heroName ?? '', input.heroRole);
  }
  if (input.source === 'burn') {
    return BATTLE_VFX_PRESETS.fire_blast;
  }
  if (input.source === 'poison') {
    return BATTLE_VFX_PRESETS.poison_wisp;
  }
  return BATTLE_VFX_PRESETS.gold_arrow;
}

export class BattleVfxLimiter {
  private nextReservationId = 1;
  private readonly active = new Map<number, VfxReservation>();
  private readonly evicted: VfxReservation[] = [];
  private readonly nextHeroPresentationTime = new Map<number, number>();

  public constructor(private readonly budget: BattleVfxBudget) {}

  public tryStartHeroAttack(heroId: number, nowSeconds: number, intervalSeconds: number): boolean {
    if (!Number.isFinite(heroId) || heroId <= 0 || !Number.isFinite(nowSeconds)) {
      return false;
    }
    const interval =
      Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 0.72;
    const nextAllowed = this.nextHeroPresentationTime.get(heroId) ?? Number.NEGATIVE_INFINITY;
    if (nowSeconds + 0.000001 < nextAllowed) {
      return false;
    }
    this.nextHeroPresentationTime.set(heroId, nowSeconds + interval);
    return true;
  }

  public reserve(
    kind: VfxReservationKind,
    estimate: number,
    priority: VfxReservationPriority,
  ): VfxReservation | undefined {
    const safeEstimate = Number.isFinite(estimate) ? Math.max(0, Math.floor(estimate)) : 0;
    if (!this.canFit(kind, safeEstimate) && priority === 'critical') {
      this.evictDecorativeUntilFit(kind, safeEstimate);
    }
    if (!this.canFit(kind, safeEstimate)) {
      return undefined;
    }

    const reservation: VfxReservation = {
      id: this.nextReservationId,
      kind,
      estimate: safeEstimate,
      priority,
    };
    this.nextReservationId += 1;
    this.active.set(reservation.id, reservation);
    return reservation;
  }

  public release(reservation: VfxReservation): void {
    this.active.delete(reservation.id);
  }

  public isActive(reservation: VfxReservation): boolean {
    return this.active.has(reservation.id);
  }

  public drainEvictedReservations(): VfxReservation[] {
    return this.evicted.splice(0, this.evicted.length);
  }

  public getSnapshot(): BattleVfxBudgetSnapshot {
    let activeProjectiles = 0;
    let activeImpacts = 0;
    let activeParticleSystems = 0;
    let estimatedParticles = 0;
    for (const reservation of this.active.values()) {
      if (reservation.kind === 'projectile') activeProjectiles += 1;
      if (reservation.kind === 'impact') activeImpacts += 1;
      if (reservation.kind === 'particle') activeParticleSystems += 1;
      estimatedParticles += reservation.estimate;
    }
    return { activeProjectiles, activeImpacts, activeParticleSystems, estimatedParticles };
  }

  public reset(): void {
    this.active.clear();
    this.evicted.length = 0;
    this.nextHeroPresentationTime.clear();
    this.nextReservationId = 1;
  }

  private canFit(kind: VfxReservationKind, estimate: number): boolean {
    const snapshot = this.getSnapshot();
    if (snapshot.estimatedParticles + estimate > this.budget.maxEstimatedParticles) {
      return false;
    }
    if (kind === 'projectile') {
      return snapshot.activeProjectiles < this.budget.maxActiveProjectiles;
    }
    if (kind === 'impact') {
      return snapshot.activeImpacts < this.budget.maxActiveImpacts;
    }
    return snapshot.activeParticleSystems < this.budget.maxActiveParticleSystems;
  }

  private evictDecorativeUntilFit(kind: VfxReservationKind, estimate: number): void {
    while (!this.canFit(kind, estimate)) {
      const candidate = Array.from(this.active.values()).find(
        (reservation) => reservation.priority === 'decorative',
      );
      if (!candidate) {
        return;
      }
      this.active.delete(candidate.id);
      this.evicted.push(candidate);
    }
  }
}
