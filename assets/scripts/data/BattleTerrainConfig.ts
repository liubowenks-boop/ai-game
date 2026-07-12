export type BattleTerrainLayerId =
  'base' | 'road' | 'ruinsLeft' | 'ruinsRight' | 'atmosphere' | 'wallBack' | 'wallFront';

export interface BattleTerrainPoint {
  readonly x: number;
  readonly y: number;
}

export interface BattleTerrainLayerSpec {
  readonly id: BattleTerrainLayerId;
  readonly nodeName: string;
  readonly filename: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly required: boolean;
  readonly expectsAlpha: boolean;
}

export const BATTLE_WALL_LAYOUT = {
  cityLineY: -235,
  wallBackY: -400,
  wallFrontY: -470,
  unitY: -320,
  unitVisualScale: 1.3,
  thunderMage: { x: -240, y: -320 },
  ordinarySlots: [
    { x: -120, y: -320 },
    { x: 120, y: -320 },
    { x: 240, y: -320 },
  ],
  mainHero: { x: 0, y: -320 },
} as const;

export const BATTLE_TERRAIN_LAYERS: readonly BattleTerrainLayerSpec[] = [
  {
    id: 'base',
    nodeName: 'TerrainBase',
    filename: 'battle_terrain_base_720x1280.png',
    path: 'battle_common/battle_terrain_base_720x1280',
    width: 720,
    height: 1280,
    x: 0,
    y: 0,
    required: true,
    expectsAlpha: false,
  },
  {
    id: 'road',
    nodeName: 'TerrainRoad',
    filename: 'battle_road_overlay.png',
    path: 'battle_common/battle_road_overlay',
    width: 720,
    height: 1280,
    x: 0,
    y: 0,
    required: false,
    expectsAlpha: true,
  },
  {
    id: 'ruinsLeft',
    nodeName: 'TerrainRuinsLeft',
    filename: 'battle_ruins_left.png',
    path: 'battle_common/battle_ruins_left',
    width: 360,
    height: 900,
    x: -237.6,
    y: 55,
    required: false,
    expectsAlpha: true,
  },
  {
    id: 'ruinsRight',
    nodeName: 'TerrainRuinsRight',
    filename: 'battle_ruins_right.png',
    path: 'battle_common/battle_ruins_right',
    width: 360,
    height: 900,
    x: 237.6,
    y: 55,
    required: false,
    expectsAlpha: true,
  },
  {
    id: 'atmosphere',
    nodeName: 'TerrainAtmosphereBack',
    filename: 'battle_atmosphere.png',
    path: 'battle_common/battle_atmosphere',
    width: 720,
    height: 900,
    x: 0,
    y: 80,
    required: false,
    expectsAlpha: true,
  },
  {
    id: 'wallBack',
    nodeName: 'CityWallBack',
    filename: 'battle_wall_back.png',
    path: 'battle_common/battle_wall_back',
    width: 720,
    height: 480,
    x: 0,
    y: BATTLE_WALL_LAYOUT.wallBackY,
    required: true,
    expectsAlpha: true,
  },
  {
    id: 'wallFront',
    nodeName: 'CityWallFront',
    filename: 'battle_wall_front.png',
    path: 'battle_common/battle_wall_front',
    width: 720,
    height: 340,
    x: 0,
    y: BATTLE_WALL_LAYOUT.wallFrontY,
    required: true,
    expectsAlpha: true,
  },
] as const;

export const BATTLE_TERRAIN_RENDER_ROOTS = {
  enemies: 'EnemiesLayer',
  unitBacking: 'WallUnitBackingRings',
  units: 'WallUnitsLayer',
  projectiles: 'PlayerAndCompanionProjectiles',
  feedback: 'BattleFeedbackLayer',
} as const;
