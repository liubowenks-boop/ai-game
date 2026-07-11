import assert from 'node:assert/strict';

import {
  BATTLE_TERRAIN_LAYERS,
  BATTLE_TERRAIN_RENDER_ROOTS,
  BATTLE_WALL_LAYOUT,
} from '../assets/scripts/data/BattleTerrainConfig';
import {
  createBattleTerrainLoadState,
  resolveBattleTerrainMode,
} from '../assets/scripts/battle/BattleTerrainLoadState';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

runTest('terrain config fixes the wall and five-unit formation coordinates', () => {
  assert.equal(BATTLE_WALL_LAYOUT.cityLineY, -290);
  assert.equal(BATTLE_WALL_LAYOUT.wallBackY, -365);
  assert.equal(BATTLE_WALL_LAYOUT.wallFrontY, -385);
  assert.equal(BATTLE_WALL_LAYOUT.unitY, -320);
  assert.deepEqual(BATTLE_WALL_LAYOUT.thunderMage, { x: -240, y: -320 });
  assert.deepEqual(BATTLE_WALL_LAYOUT.ordinarySlots, [
    { x: -120, y: -320 },
    { x: 120, y: -320 },
    { x: 240, y: -320 },
  ]);
  assert.deepEqual(BATTLE_WALL_LAYOUT.mainHero, { x: 0, y: -320 });
});

runTest('terrain config defines the seven modular assets and stable render roots', () => {
  assert.deepEqual(
    BATTLE_TERRAIN_LAYERS.map((layer) => ({
      id: layer.id,
      filename: layer.filename,
      size: [layer.width, layer.height],
      required: layer.required,
      expectsAlpha: layer.expectsAlpha,
    })),
    [
      {
        id: 'base',
        filename: 'battle_terrain_base_720x1280.png',
        size: [720, 1280],
        required: true,
        expectsAlpha: false,
      },
      {
        id: 'road',
        filename: 'battle_road_overlay.png',
        size: [720, 1280],
        required: false,
        expectsAlpha: true,
      },
      {
        id: 'ruinsLeft',
        filename: 'battle_ruins_left.png',
        size: [360, 900],
        required: false,
        expectsAlpha: true,
      },
      {
        id: 'ruinsRight',
        filename: 'battle_ruins_right.png',
        size: [360, 900],
        required: false,
        expectsAlpha: true,
      },
      {
        id: 'atmosphere',
        filename: 'battle_atmosphere.png',
        size: [720, 900],
        required: false,
        expectsAlpha: true,
      },
      {
        id: 'wallBack',
        filename: 'battle_wall_back.png',
        size: [720, 240],
        required: true,
        expectsAlpha: true,
      },
      {
        id: 'wallFront',
        filename: 'battle_wall_front.png',
        size: [720, 160],
        required: false,
        expectsAlpha: true,
      },
    ],
  );

  assert.ok(BATTLE_TERRAIN_LAYERS.every((layer) => layer.path.startsWith('battle_common/')));
  assert.deepEqual(BATTLE_TERRAIN_RENDER_ROOTS, {
    enemies: 'EnemiesLayer',
    unitBacking: 'WallUnitBackingRings',
    units: 'WallUnitsLayer',
    projectiles: 'PlayerAndCompanionProjectiles',
    feedback: 'BattleFeedbackLayer',
  });
});

runTest('required terrain layers switch atomically while optional failures degrade locally', () => {
  const pending = createBattleTerrainLoadState(BATTLE_TERRAIN_LAYERS);
  assert.equal(resolveBattleTerrainMode(pending, BATTLE_TERRAIN_LAYERS), 'loading');

  assert.equal(
    resolveBattleTerrainMode(
      { ...pending, base: 'ready', wallBack: 'ready' },
      BATTLE_TERRAIN_LAYERS,
    ),
    'modular',
  );
  assert.equal(
    resolveBattleTerrainMode({ ...pending, base: 'failed' }, BATTLE_TERRAIN_LAYERS),
    'legacy',
  );
  assert.equal(
    resolveBattleTerrainMode(
      { ...pending, base: 'ready', wallBack: 'ready', road: 'failed' },
      BATTLE_TERRAIN_LAYERS,
    ),
    'modular',
  );
});
