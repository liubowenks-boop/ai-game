import type { HeroRole } from './BattleConfig';

export type BattleVfxTextureId =
  | 'goldProjectile'
  | 'fireSlash'
  | 'thunderBolt'
  | 'thunderImpact'
  | 'iceShard'
  | 'poisonWisp'
  | 'healOrb'
  | 'shieldImpact'
  | 'hitStar'
  | 'smokeDebris'
  | 'runeMarker'
  | 'fireImpactV3'
  | 'thunderImpactV3'
  | 'poisonImpactV3'
  | 'goldImpactV3';

export type BattleVfxImpactProfile = 'fire' | 'thunder' | 'poison' | 'gold' | 'heal';

export type BattleVfxPresetId =
  | 'main_fire_gold'
  | 'thunder'
  | 'gold_arrow'
  | 'fire_blast'
  | 'ice_shard'
  | 'poison_wisp'
  | 'shield_impact'
  | 'warm_support'
  | 'healing_spirit'
  | 'curse_wisp';

export interface BattleVfxPreset {
  readonly id: BattleVfxPresetId;
  readonly projectileTexture: BattleVfxTextureId;
  readonly impactTexture: BattleVfxTextureId;
  readonly impactProfile: BattleVfxImpactProfile;
  readonly trailColor: readonly [number, number, number, number];
  readonly hitColor: readonly [number, number, number, number];
  readonly travelSeconds: number;
  readonly particleCount: number;
  readonly criticalParticleCount: number;
  readonly impactLife: number;
  readonly criticalLife: number;
  readonly presentationInterval: number;
  readonly projectileScale: number;
  readonly impactScale: number;
  readonly glowScale: number;
  readonly trailInterval: number;
  readonly beam: boolean;
}

export interface BattleVfxBudget {
  readonly maxActiveProjectiles: number;
  readonly maxActiveImpacts: number;
  readonly maxActiveParticleSystems: number;
  readonly maxActiveTrails: number;
  readonly maxEstimatedParticles: number;
  readonly maxPlacementMarkers: number;
}

export const BATTLE_VFX_HIT_VISUAL_SCALE = 0.7;

export const BATTLE_VFX_TEXTURES: Readonly<Record<BattleVfxTextureId, string>> = {
  goldProjectile: 'fx_v2_gold_projectile.png',
  fireSlash: 'fx_v2_fire_slash.png',
  thunderBolt: 'fx_v2_thunder_bolt.png',
  thunderImpact: 'fx_v2_thunder_impact.png',
  iceShard: 'fx_v2_ice_shard.png',
  poisonWisp: 'fx_v2_poison_wisp.png',
  healOrb: 'fx_v2_heal_orb.png',
  shieldImpact: 'fx_v2_shield_impact.png',
  hitStar: 'fx_v2_hit_star.png',
  smokeDebris: 'fx_v2_smoke_debris.png',
  runeMarker: 'fx_v2_rune_marker.png',
  fireImpactV3: 'fx_v3_hit_fire_eruption.png',
  thunderImpactV3: 'fx_v3_hit_thunder_crater.png',
  poisonImpactV3: 'fx_v3_hit_poison_talisman.png',
  goldImpactV3: 'fx_v3_hit_gold_starburst.png',
};

export const BATTLE_VFX_TEXTURE_FALLBACKS: Readonly<
  Partial<Record<BattleVfxTextureId, BattleVfxTextureId>>
> = {
  fireImpactV3: 'hitStar',
  thunderImpactV3: 'thunderImpact',
  poisonImpactV3: 'poisonWisp',
  goldImpactV3: 'hitStar',
};

function preset(
  id: BattleVfxPresetId,
  projectileTexture: BattleVfxTextureId,
  impactTexture: BattleVfxTextureId,
  trailColor: BattleVfxPreset['trailColor'],
  hitColor: BattleVfxPreset['hitColor'],
  options: Partial<
    Pick<
      BattleVfxPreset,
      | 'travelSeconds'
      | 'impactProfile'
      | 'particleCount'
      | 'criticalParticleCount'
      | 'impactLife'
      | 'criticalLife'
      | 'presentationInterval'
      | 'projectileScale'
      | 'impactScale'
      | 'glowScale'
      | 'trailInterval'
      | 'beam'
    >
  > = {},
): BattleVfxPreset {
  return {
    id,
    projectileTexture,
    impactTexture,
    impactProfile: options.impactProfile ?? 'gold',
    trailColor,
    hitColor,
    travelSeconds: options.travelSeconds ?? 0.28,
    particleCount: options.particleCount ?? 56,
    criticalParticleCount: options.criticalParticleCount ?? 118,
    impactLife: options.impactLife ?? 0.42,
    criticalLife: options.criticalLife ?? 0.78,
    presentationInterval: options.presentationInterval ?? 0.72,
    projectileScale: options.projectileScale ?? 0.68,
    impactScale: options.impactScale ?? 0.58,
    glowScale: options.glowScale ?? 1.42,
    trailInterval: options.trailInterval ?? 0.034,
    beam: options.beam ?? false,
  };
}

export const BATTLE_VFX_PRESETS: Readonly<Record<BattleVfxPresetId, BattleVfxPreset>> = {
  main_fire_gold: preset(
    'main_fire_gold',
    'fireSlash',
    'fireImpactV3',
    [255, 151, 42, 255],
    [255, 230, 126, 255],
    {
      impactProfile: 'fire',
      travelSeconds: 0.38,
      particleCount: 68,
      criticalParticleCount: 140,
      impactLife: 0.55,
      criticalLife: 0.9,
      presentationInterval: 0.7,
      projectileScale: 0.84,
      impactScale: 0.72,
      glowScale: 1.55,
      trailInterval: 0.024,
    },
  ),
  thunder: preset(
    'thunder',
    'thunderBolt',
    'thunderImpactV3',
    [107, 148, 255, 255],
    [235, 247, 255, 255],
    {
      impactProfile: 'thunder',
      travelSeconds: 0.31,
      particleCount: 64,
      criticalParticleCount: 132,
      impactLife: 0.5,
      criticalLife: 0.82,
      presentationInterval: 0.85,
      projectileScale: 0.82,
      impactScale: 0.7,
      glowScale: 1.65,
      trailInterval: 0.022,
      beam: true,
    },
  ),
  gold_arrow: preset(
    'gold_arrow',
    'goldProjectile',
    'goldImpactV3',
    [255, 208, 82, 255],
    [255, 246, 194, 255],
    {
      impactProfile: 'gold',
      travelSeconds: 0.23,
      particleCount: 44,
      criticalParticleCount: 100,
      impactLife: 0.3,
      criticalLife: 0.62,
      presentationInterval: 0.65,
    },
  ),
  fire_blast: preset(
    'fire_blast',
    'fireSlash',
    'fireImpactV3',
    [255, 94, 31, 255],
    [255, 190, 74, 255],
    {
      impactProfile: 'fire',
      particleCount: 70,
      criticalParticleCount: 138,
      impactLife: 0.65,
      criticalLife: 0.9,
      presentationInterval: 0.78,
    },
  ),
  ice_shard: preset(
    'ice_shard',
    'iceShard',
    'thunderImpactV3',
    [109, 211, 255, 255],
    [225, 250, 255, 255],
    {
      impactProfile: 'thunder',
      travelSeconds: 0.26,
      particleCount: 52,
      criticalParticleCount: 112,
      impactLife: 0.48,
      criticalLife: 0.72,
      presentationInterval: 0.72,
    },
  ),
  poison_wisp: preset(
    'poison_wisp',
    'poisonWisp',
    'poisonImpactV3',
    [112, 236, 103, 255],
    [182, 255, 126, 255],
    {
      impactProfile: 'poison',
      travelSeconds: 0.35,
      particleCount: 48,
      criticalParticleCount: 96,
      impactLife: 0.6,
      criticalLife: 0.86,
      presentationInterval: 0.82,
    },
  ),
  shield_impact: preset(
    'shield_impact',
    'shieldImpact',
    'goldImpactV3',
    [223, 197, 139, 255],
    [255, 239, 191, 255],
    {
      impactProfile: 'gold',
      travelSeconds: 0.29,
      particleCount: 58,
      criticalParticleCount: 120,
      impactLife: 0.52,
      criticalLife: 0.8,
      presentationInterval: 0.85,
    },
  ),
  warm_support: preset(
    'warm_support',
    'goldProjectile',
    'goldImpactV3',
    [255, 187, 72, 255],
    [255, 231, 153, 255],
    {
      impactProfile: 'gold',
      travelSeconds: 0.33,
      particleCount: 42,
      criticalParticleCount: 90,
      impactLife: 0.45,
      criticalLife: 0.7,
      presentationInterval: 0.8,
    },
  ),
  healing_spirit: preset(
    'healing_spirit',
    'healOrb',
    'healOrb',
    [85, 241, 169, 255],
    [207, 255, 225, 255],
    {
      impactProfile: 'heal',
      travelSeconds: 0.38,
      particleCount: 46,
      criticalParticleCount: 94,
      impactLife: 0.58,
      criticalLife: 0.84,
      presentationInterval: 0.8,
    },
  ),
  curse_wisp: preset(
    'curse_wisp',
    'poisonWisp',
    'poisonImpactV3',
    [155, 86, 238, 255],
    [224, 178, 255, 255],
    {
      impactProfile: 'poison',
      travelSeconds: 0.35,
      particleCount: 54,
      criticalParticleCount: 110,
      impactLife: 0.62,
      criticalLife: 0.88,
      presentationInterval: 0.82,
    },
  ),
};

export const HERO_VFX_PRESET_BY_NAME: Readonly<Record<string, BattleVfxPresetId>> = {
  弓手: 'gold_arrow',
  火药师: 'fire_blast',
  冰法师: 'ice_shard',
  毒师: 'poison_wisp',
  护卫: 'shield_impact',
  鼓手: 'warm_support',
  治疗师: 'healing_spirit',
  咒术师: 'curse_wisp',
};

export const HERO_VFX_PRESET_BY_ROLE: Readonly<Record<HeroRole, BattleVfxPresetId>> = {
  single: 'gold_arrow',
  area: 'fire_blast',
  slow: 'ice_shard',
  poison: 'poison_wisp',
  guard: 'shield_impact',
  aura: 'warm_support',
  heal: 'healing_spirit',
  debuff: 'curse_wisp',
};

export const BATTLE_VFX_BUDGET: BattleVfxBudget = {
  maxActiveProjectiles: 18,
  maxActiveImpacts: 14,
  maxActiveParticleSystems: 10,
  maxActiveTrails: 32,
  maxEstimatedParticles: 620,
  maxPlacementMarkers: 5,
};
