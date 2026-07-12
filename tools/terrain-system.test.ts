import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import {
  BATTLE_TERRAIN_LAYERS,
  BATTLE_TERRAIN_RENDER_ROOTS,
  BATTLE_WALL_LAYOUT,
} from '../assets/scripts/data/BattleTerrainConfig';
import { BATTLE_TERRAIN_ASSET_UUIDS } from '../assets/scripts/data/BattleTerrainAssets.generated';
import {
  createBattleTerrainLoadState,
  resolveBattleTerrainMode,
} from '../assets/scripts/battle/BattleTerrainLoadState';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

interface PngPixels {
  width: number;
  height: number;
  colorType: number;
  alphaAt(x: number, y: number): number;
}

function readPngPixels(path: string): PngPixels {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${path} must be a PNG`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8, `${path} must use 8-bit channels`);
  assert.ok(colorType === 2 || colorType === 6, `${path} must be RGB or RGBA`);
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;

  const paeth = (left: number, up: number, upLeft: number): number => {
    const prediction = left + up - upLeft;
    const leftDistance = Math.abs(prediction - left);
    const upDistance = Math.abs(prediction - up);
    const upLeftDistance = Math.abs(prediction - upLeft);
    if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
    return upDistance <= upLeftDistance ? up : upLeft;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;

    for (let byteIndex = 0; byteIndex < stride; byteIndex += 1) {
      const raw = inflated[sourceOffset + byteIndex];
      const left = byteIndex >= bytesPerPixel ? pixels[rowStart + byteIndex - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowStart - stride + byteIndex] : 0;
      const upLeft =
        y > 0 && byteIndex >= bytesPerPixel
          ? pixels[rowStart - stride + byteIndex - bytesPerPixel]
          : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else assert.equal(filter, 0, `${path} contains unsupported PNG filter ${filter}`);
      pixels[rowStart + byteIndex] = value & 0xff;
    }

    sourceOffset += stride;
  }

  return {
    width,
    height,
    colorType,
    alphaAt(x: number, y: number): number {
      if (colorType === 2) return 255;
      return pixels[(y * width + x) * bytesPerPixel + 3];
    },
  };
}

runTest('terrain config fixes the wall and five-unit formation coordinates', () => {
  assert.equal(BATTLE_WALL_LAYOUT.cityLineY, -235);
  assert.equal(BATTLE_WALL_LAYOUT.wallBackY, -400);
  assert.equal(BATTLE_WALL_LAYOUT.wallFrontY, -470);
  assert.equal(BATTLE_WALL_LAYOUT.unitY, -320);
  assert.equal(BATTLE_WALL_LAYOUT.unitVisualScale, 1.3);
  assert.equal(BATTLE_WALL_LAYOUT.cityLineY - BATTLE_WALL_LAYOUT.unitY, 85);
  assert.deepEqual(BATTLE_WALL_LAYOUT.thunderMage, { x: -240, y: -320 });
  assert.deepEqual(BATTLE_WALL_LAYOUT.ordinarySlots, [
    { x: -120, y: -320 },
    { x: 120, y: -320 },
    { x: 240, y: -320 },
  ]);
  assert.deepEqual(BATTLE_WALL_LAYOUT.mainHero, { x: 0, y: -320 });
});

runTest('terrain config defines the seven modular assets and stable render roots', () => {
  assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'ruinsLeft')?.x, -237.6);
  assert.equal(BATTLE_TERRAIN_LAYERS.find((layer) => layer.id === 'ruinsRight')?.x, 237.6);
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
        size: [720, 480],
        required: true,
        expectsAlpha: true,
      },
      {
        id: 'wallFront',
        filename: 'battle_wall_front.png',
        size: [720, 340],
        required: true,
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

  const baseAndBackReady = { ...pending, base: 'ready' as const, wallBack: 'ready' as const };
  assert.equal(
    resolveBattleTerrainMode(baseAndBackReady, BATTLE_TERRAIN_LAYERS),
    'loading',
  );
  assert.equal(
    resolveBattleTerrainMode(
      { ...baseAndBackReady, wallFront: 'ready' },
      BATTLE_TERRAIN_LAYERS,
    ),
    'modular',
  );
  assert.equal(
    resolveBattleTerrainMode(
      { ...baseAndBackReady, wallFront: 'failed' },
      BATTLE_TERRAIN_LAYERS,
    ),
    'legacy',
  );
  assert.equal(
    resolveBattleTerrainMode({ ...pending, base: 'failed' }, BATTLE_TERRAIN_LAYERS),
    'legacy',
  );
  assert.equal(
    resolveBattleTerrainMode(
      { ...baseAndBackReady, wallFront: 'ready', road: 'failed' },
      BATTLE_TERRAIN_LAYERS,
    ),
    'modular',
  );
});

runTest('terrain asset files, alpha, metadata and generated UUID manifest agree', () => {
  const assetDirectory = join(process.cwd(), 'assets', 'bundles', 'battle_common');
  const manifest = BATTLE_TERRAIN_ASSET_UUIDS as Record<string, string>;

  for (const spec of BATTLE_TERRAIN_LAYERS) {
    const imagePath = join(assetDirectory, spec.filename);
    const metaPath = `${imagePath}.meta`;
    assert.ok(existsSync(imagePath), `missing terrain image ${spec.filename}`);
    assert.ok(existsSync(metaPath), `missing Cocos metadata ${spec.filename}.meta`);

    const png = readPngPixels(imagePath);
    assert.deepEqual(
      { width: png.width, height: png.height },
      { width: spec.width, height: spec.height },
      `${spec.filename} has unexpected dimensions`,
    );

    const cornerAlphas = [
      png.alphaAt(0, 0),
      png.alphaAt(png.width - 1, 0),
      png.alphaAt(0, png.height - 1),
      png.alphaAt(png.width - 1, png.height - 1),
    ];
    if (spec.expectsAlpha) {
      assert.equal(png.colorType, 6, `${spec.filename} must contain RGBA pixels`);
      if (spec.id === 'wallBack' || spec.id === 'wallFront') {
        let transparentPixels = 0;
        let opaquePixels = 0;
        for (let y = 0; y < png.height; y += 1) {
          for (let x = 0; x < png.width; x += 1) {
            const alpha = png.alphaAt(x, y);
            if (alpha < 16) transparentPixels += 1;
            if (alpha > 240) opaquePixels += 1;
          }
        }
        const visibleRatio = 1 - transparentPixels / (png.width * png.height);
        assert.ok(visibleRatio > 0.08 && visibleRatio < 0.9, `${spec.filename} visible coverage drifted`);
        assert.ok(transparentPixels > 0, `${spec.filename} needs transparent padding`);
        assert.ok(opaquePixels > 0, `${spec.filename} needs opaque wall pixels`);
      } else {
        assert.ok(
          cornerAlphas.filter((alpha) => alpha < 16).length >= 3,
          `${spec.filename} must not contain a solid rectangular background`,
        );
      }
    } else {
      assert.ok(
        cornerAlphas.every((alpha) => alpha === 255),
        `${spec.filename} must be opaque`,
      );
    }

    const metadata = JSON.parse(readFileSync(metaPath, 'utf8')) as { uuid?: string };
    assert.equal(typeof metadata.uuid, 'string', `${spec.filename}.meta needs a UUID`);
    assert.equal(manifest[spec.filename], metadata.uuid, `${spec.filename} manifest UUID drifted`);
  }

  assert.deepEqual(
    Object.keys(manifest).sort(),
    BATTLE_TERRAIN_LAYERS.map((spec) => spec.filename).sort(),
  );
  assert.equal(new Set(Object.values(manifest)).size, BATTLE_TERRAIN_LAYERS.length);
});

runTest('terrain presentation owns atomic fallback and stable render roots', () => {
  const presentationPath = join(
    process.cwd(),
    'assets',
    'scripts',
    'battle',
    'BattleTerrainPresentation.ts',
  );
  assert.ok(existsSync(presentationPath), 'BattleTerrainPresentation.ts must exist');
  const source = readFileSync(presentationPath, 'utf8');

  assert.match(source, /BATTLE_TERRAIN_ASSET_UUIDS/);
  assert.match(source, /assetManager\.loadAny/);
  assert.match(source, /createBattleTerrainLoadState/);
  assert.match(source, /resolveBattleTerrainMode/);
  assert.match(source, /LegacyBattleBackground/);
  assert.match(source, /private loadGeneration = 0;/);
  assert.match(source, /private readonly warnedFailures = new Set<string>\(\);/);
  assert.match(source, /generation !== this\.loadGeneration/);
  assert.match(source, /isValid\(this\.root, true\)/);
  assert.match(source, /this\.legacyBackground\.active = mode !== 'modular';/);
  assert.match(source, /spec\.required \? 'required' : 'optional'/);

  const renderOrder = [
    'TerrainBase',
    'TerrainRoad',
    'TerrainRuinsLeft',
    'TerrainRuinsRight',
    'TerrainAtmosphereBack',
    'CityWallBack',
    'EnemiesLayer',
    'WallUnitBackingRings',
    'WallUnitsLayer',
    'CityWallFront',
    'PlayerAndCompanionProjectiles',
    'BattleFeedbackLayer',
  ];
  let previousIndex = -1;
  for (const nodeName of renderOrder) {
    const sourceIndex = source.indexOf(`'${nodeName}'`);
    assert.ok(sourceIndex > previousIndex, `${nodeName} must follow the configured render order`);
    previousIndex = sourceIndex;
  }
});

runTest('battle controller routes combat visuals through terrain render layers', () => {
  const controllerSource = readFileSync(
    join(process.cwd(), 'assets', 'scripts', 'battle', 'BattleController.ts'),
    'utf8',
  );
  const thunderMageSource = readFileSync(
    join(process.cwd(), 'assets', 'scripts', 'battle', 'ThunderMagePresentation.ts'),
    'utf8',
  );

  assert.match(controllerSource, /private terrainPresentation!: BattleTerrainPresentation;/);
  assert.match(controllerSource, /new BattleTerrainPresentation\(/);
  assert.match(controllerSource, /this\.terrainPresentation\.preload\(\);/);
  assert.match(
    controllerSource,
    /this\.feedbackLayer = this\.terrainPresentation\.layers\.feedback;/,
  );
  assert.match(
    controllerSource,
    /this\.terrainPresentation\.layers\.enemies\.addChild\(enemyTemplate\);/,
  );
  assert.match(
    controllerSource,
    /this\.terrainPresentation\.layers\.units\.addChild\(existingPlayer\);/,
  );
  assert.match(controllerSource, /existingCityLine\?\.destroy\(\);/);
  assert.equal(controllerSource.includes('drawCityLine('), false);
  assert.equal(controllerSource.includes('redrawCityLine('), false);
  assert.match(
    controllerSource,
    /this\.createPlayerNode\(this\.terrainPresentation\.layers\.units\)/,
  );
  assert.match(
    controllerSource,
    /new PlayerAutoAttackSystem\(this\.battleVfx\)/,
  );
  assert.match(
    controllerSource,
    /new GridPlacementSystem\(\s*this\.terrainPresentation\.layers\.unitBacking,\s*this\.terrainPresentation\.layers\.units,\s*this\.model,\s*this\.battleVfx,\s*\)/s,
  );
  assert.equal(controllerSource.includes('this.drawBackground(this.battleLayer)'), false);
  assert.equal(
    controllerSource.includes(
      'this.feedbackLayer.setSiblingIndex(this.battleLayer.children.length - 1)',
    ),
    false,
  );
  assert.match(controllerSource, /this\.terrainPresentation\?\.dispose\(\);/);
  assert.match(
    thunderMageSource,
    /public constructor\(\s*unitParent: Node,\s*setUiLayer: \(node: Node\) => void,\s*private readonly battleVfx: BattleVfxSystem,/s,
  );
  assert.match(thunderMageSource, /unitParent\.addChild\(this\.rootNode\);/);
  assert.equal(thunderMageSource.includes('effectParent.addChild'), false);
  assert.match(thunderMageSource, /this\.battleVfx\.playAttackEvent\(event\);/);
});
