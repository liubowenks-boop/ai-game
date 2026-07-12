import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import {
  BATTLE_VFX_BUDGET,
  BATTLE_VFX_HIT_VISUAL_SCALE,
  BATTLE_VFX_PRESETS,
  BATTLE_VFX_TEXTURE_FALLBACKS,
  BATTLE_VFX_TEXTURES,
} from '../assets/scripts/data/BattleVfxConfig';
import {
  BattleVfxLimiter,
  resolveAttackVfxPreset,
  resolveHeroVfxPreset,
} from '../assets/scripts/battle/BattleVfxLogic';
import { UiArtAssets } from '../assets/scripts/ui/UiArtManifest';

function runTest(name: string, testBody: () => void): void {
  testBody();
  console.log(`pass: ${name}`);
}

function readPng(path: string): {
  width: number;
  height: number;
  colorType: number;
  alphaAt(x: number, y: number): number;
  transparentRatio(): number;
} {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  assert.equal(bitDepth, 8);
  assert.equal(colorType, 6);
  const bpp = 4;
  const stride = width * bpp;
  const inflated = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * bpp);
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
    for (let index = 0; index < stride; index += 1) {
      const rowStart = y * stride;
      const raw = inflated[sourceOffset + index];
      const left = index >= bpp ? pixels[rowStart + index - bpp] : 0;
      const up = y > 0 ? pixels[rowStart - stride + index] : 0;
      const upLeft = y > 0 && index >= bpp ? pixels[rowStart - stride + index - bpp] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else assert.equal(filter, 0);
      pixels[rowStart + index] = value & 0xff;
    }
    sourceOffset += stride;
  }
  return {
    width,
    height,
    colorType,
    alphaAt(x: number, y: number): number {
      return pixels[(y * width + x) * bpp + 3];
    },
    transparentRatio(): number {
      let transparent = 0;
      for (let index = 3; index < pixels.length; index += bpp) {
        if (pixels[index] < 16) transparent += 1;
      }
      return transparent / (width * height);
    },
  };
}

runTest('vfx presets map every battle role to a distinct readable element', () => {
  assert.equal(resolveAttackVfxPreset({ source: 'main' }).id, 'main_fire_gold');
  assert.equal(resolveAttackVfxPreset({ source: 'companion' }).id, 'thunder');
  assert.equal(resolveAttackVfxPreset({ source: 'qinglan_companion' }).id, 'qinglan_talisman');
  assert.equal(resolveHeroVfxPreset('弓手', 'single').id, 'gold_arrow');
  assert.equal(resolveHeroVfxPreset('火药师', 'area').id, 'fire_blast');
  assert.equal(resolveHeroVfxPreset('冰法师', 'slow').id, 'ice_shard');
  assert.equal(resolveHeroVfxPreset('毒师', 'poison').id, 'poison_wisp');
  assert.equal(resolveHeroVfxPreset('护卫', 'guard').id, 'shield_impact');
  assert.equal(resolveHeroVfxPreset('鼓手', 'aura').id, 'warm_support');
  assert.equal(resolveHeroVfxPreset('治疗师', 'heal').id, 'healing_spirit');
  assert.equal(resolveHeroVfxPreset('咒术师', 'debuff').id, 'curse_wisp');
  assert.equal(resolveHeroVfxPreset('未知英雄', 'single').id, 'gold_arrow');
});

runTest('vfx textures and presets stay inside the approved production budget', () => {
  assert.equal(BATTLE_VFX_HIT_VISUAL_SCALE, 0.7);
  assert.equal(Object.keys(BATTLE_VFX_TEXTURES).length, 16);
  assert.equal(Object.keys(BATTLE_VFX_PRESETS).length, 11);

  for (const preset of Object.values(BATTLE_VFX_PRESETS)) {
    assert.ok(preset.particleCount >= 40 && preset.particleCount <= 70);
    assert.ok(preset.criticalParticleCount >= 90 && preset.criticalParticleCount <= 140);
    assert.ok(preset.impactLife >= 0.18 && preset.impactLife <= 0.65);
    assert.ok(preset.criticalLife <= 0.9);
    assert.ok(preset.presentationInterval >= 0.65 && preset.presentationInterval <= 1.0);
    assert.ok(preset.projectileScale >= 0.55 && preset.projectileScale <= 1.2);
    assert.ok(preset.impactScale >= 0.45 && preset.impactScale <= 0.9);
    assert.ok(preset.glowScale >= 1.15 && preset.glowScale <= 1.8);
    assert.ok(preset.trailInterval >= 0.018 && preset.trailInterval <= 0.05);
    assert.ok(preset.travelSeconds >= 0.23 && preset.travelSeconds <= 0.42);
  }

  const qinglan = BATTLE_VFX_PRESETS.qinglan_talisman;
  assert.equal(qinglan.projectileTexture, 'qinglanTalisman');
  assert.equal(qinglan.impactTexture, 'poisonImpactV3');
  assert.equal(qinglan.impactProfile, 'poison');
  assert.equal(qinglan.travelSeconds, 0.42);
  assert.equal(qinglan.particleCount, 58);
  assert.equal(qinglan.criticalParticleCount, 118);
  assert.equal(qinglan.impactLife, 0.58);
  assert.equal(qinglan.presentationInterval, 1);
  assert.equal(qinglan.projectileScale, 0.74);
  assert.equal(qinglan.impactScale, 0.66);

  assert.ok(BATTLE_VFX_PRESETS.main_fire_gold.projectileScale >= 0.8);
  assert.ok(BATTLE_VFX_PRESETS.main_fire_gold.impactScale >= 0.65);
  assert.equal(BATTLE_VFX_PRESETS.main_fire_gold.travelSeconds, 0.38);
  assert.equal(BATTLE_VFX_PRESETS.thunder.travelSeconds, 0.31);
  assert.equal(BATTLE_VFX_PRESETS.gold_arrow.travelSeconds, 0.23);
  assert.equal(BATTLE_VFX_PRESETS.fire_blast.travelSeconds, 0.28);
  assert.equal(BATTLE_VFX_PRESETS.thunder.beam, true);
  assert.deepEqual(
    Object.fromEntries(
      Object.values(BATTLE_VFX_PRESETS).map((preset) => [
        preset.id,
        [preset.impactProfile, preset.impactTexture],
      ]),
    ),
    {
      main_fire_gold: ['fire', 'fireImpactV3'],
      thunder: ['thunder', 'thunderImpactV3'],
      gold_arrow: ['gold', 'goldImpactV3'],
      fire_blast: ['fire', 'fireImpactV3'],
      ice_shard: ['thunder', 'thunderImpactV3'],
      poison_wisp: ['poison', 'poisonImpactV3'],
      shield_impact: ['gold', 'goldImpactV3'],
      warm_support: ['gold', 'goldImpactV3'],
      healing_spirit: ['heal', 'healOrb'],
      curse_wisp: ['poison', 'poisonImpactV3'],
      qinglan_talisman: ['poison', 'poisonImpactV3'],
    },
  );
  assert.deepEqual(BATTLE_VFX_TEXTURE_FALLBACKS, {
    fireImpactV3: 'hitStar',
    thunderImpactV3: 'thunderImpact',
    poisonImpactV3: 'poisonWisp',
    goldImpactV3: 'hitStar',
  });
});

runTest('hero attack presentation throttles per hero and resets cleanly', () => {
  const limiter = new BattleVfxLimiter(BATTLE_VFX_BUDGET);
  assert.equal(limiter.tryStartHeroAttack(11, 0, 0.65), true);
  assert.equal(limiter.tryStartHeroAttack(11, 0.2, 0.65), false);
  assert.equal(limiter.tryStartHeroAttack(12, 0.2, 0.65), true);
  assert.equal(limiter.tryStartHeroAttack(11, 0.7, 0.65), true);
  limiter.reset();
  assert.equal(limiter.tryStartHeroAttack(11, 0.1, 0.65), true);
});

runTest('critical reservations evict only the oldest decorative effect', () => {
  const limiter = new BattleVfxLimiter({
    ...BATTLE_VFX_BUDGET,
    maxActiveImpacts: 2,
  });
  const essential = limiter.reserve('impact', 10, 'essential');
  const decorative = limiter.reserve('impact', 10, 'decorative');
  assert.ok(essential);
  assert.ok(decorative);

  const critical = limiter.reserve('impact', 90, 'critical');
  assert.ok(critical);
  assert.equal(limiter.isActive(essential!), true);
  assert.equal(limiter.isActive(decorative!), false);
  assert.deepEqual(
    limiter.drainEvictedReservations().map((item) => item.id),
    [decorative!.id],
  );

  limiter.release(essential!);
  limiter.release(essential!);
  limiter.release(critical!);
  assert.deepEqual(limiter.getSnapshot(), {
    activeProjectiles: 0,
    activeImpacts: 0,
    activeParticleSystems: 0,
    estimatedParticles: 0,
  });
});

runTest('authored v2 v3 and v4 textures keep alpha, metadata and manifest entries', () => {
  const directory = join(process.cwd(), 'assets', 'bundles', 'ui', 'battle_fx_common');
  const expected = new Map<string, readonly [number, number]>([
    ['fx_v2_gold_projectile.png', [512, 128]],
    ['fx_v2_fire_slash.png', [512, 256]],
    ['fx_v2_thunder_bolt.png', [512, 128]],
    ['fx_v2_thunder_impact.png', [512, 512]],
    ['fx_v2_ice_shard.png', [256, 128]],
    ['fx_v2_poison_wisp.png', [256, 256]],
    ['fx_v2_heal_orb.png', [256, 256]],
    ['fx_v2_shield_impact.png', [256, 256]],
    ['fx_v2_hit_star.png', [256, 256]],
    ['fx_v2_smoke_debris.png', [256, 256]],
    ['fx_v2_rune_marker.png', [256, 128]],
    ['fx_v3_hit_fire_eruption.png', [512, 512]],
    ['fx_v3_hit_thunder_crater.png', [512, 512]],
    ['fx_v3_hit_poison_talisman.png', [512, 512]],
    ['fx_v3_hit_gold_starburst.png', [512, 512]],
    ['fx_v4_qinglan_talisman.png', [128, 256]],
  ]);

  for (const [filename, size] of expected) {
    const imagePath = join(directory, filename);
    assert.ok(existsSync(imagePath), `missing ${filename}`);
    assert.ok(existsSync(`${imagePath}.meta`), `missing ${filename}.meta`);
    const png = readPng(imagePath);
    assert.deepEqual([png.width, png.height], size);
    assert.equal(png.colorType, 6);
    const minimumTransparentRatio = filename === 'fx_v4_qinglan_talisman.png' ? 0.65 : 0.35;
    assert.ok(
      png.transparentRatio() > minimumTransparentRatio,
      `${filename} needs transparent padding`,
    );
    const corners = [
      png.alphaAt(0, 0),
      png.alphaAt(png.width - 1, 0),
      png.alphaAt(0, png.height - 1),
      png.alphaAt(png.width - 1, png.height - 1),
    ];
    assert.ok(corners.filter((alpha) => alpha < 16).length >= 3);

    const manifest = UiArtAssets[filename];
    assert.ok(manifest, `missing manifest entry for ${filename}`);
    assert.equal(manifest.atlas, 'battle_fx_common');
    assert.equal(manifest.path, `battle_fx_common/${filename.replace('.png', '')}`);
    assert.deepEqual([manifest.width, manifest.height], size);
    assert.ok(manifest.uuid);
    assert.ok(manifest.textureUuid);

    const meta = JSON.parse(readFileSync(`${imagePath}.meta`, 'utf8'));
    const textureMeta = Object.values(meta.subMetas ?? {}).find(
      (entry: any) => entry.importer === 'texture',
    ) as any;
    assert.equal(meta.uuid, manifest.uuid);
    assert.equal(textureMeta?.uuid, manifest.textureUuid);
    assert.equal(textureMeta?.userData?.minfilter, 'linear');
    assert.equal(textureMeta?.userData?.magfilter, 'linear');
    assert.equal(textureMeta?.userData?.mipfilter, 'none');
    assert.equal(meta.userData?.hasAlpha, true);
  }

  const generatorSource = readFileSync('tools/generate_ui_art_assets.py', 'utf8');
  assert.ok(generatorSource.includes('spec.filename.startswith(("fx_v2_", "fx_v3_", "fx_v4_"))'));
  assert.ok(generatorSource.includes('missing authored VFX texture'));
  assert.ok(generatorSource.includes('"--manifest-only"'));

  const qinglanExtractor = readFileSync('tools/extract-qinglan-talisman.mjs', 'utf8');
  assert.ok(qinglanExtractor.includes("const FRAME_NAME = 'frame_0';"));
  const crop = /const CROP = \{ x: (\d+), y: (\d+), width: (\d+), height: (\d+) \};/.exec(
    qinglanExtractor,
  );
  assert.deepEqual(crop?.slice(1).map(Number), [44, 92, 45, 70]);
});

runTest('runtime vfx system owns pooled particle lifecycle and additive blending', () => {
  const source = readFileSync('assets/scripts/battle/BattleVfxSystem.ts', 'utf8');
  const bundleMeta = JSON.parse(readFileSync('assets/bundles/ui.meta', 'utf8'));
  assert.equal(bundleMeta.userData?.isBundle, true);
  assert.equal(bundleMeta.userData?.bundleName, 'ui');
  assert.match(source, /class BattleVfxSystem/);
  assert.match(source, /async preload\(\)/);
  assert.match(source, /playAttackEvent\(/);
  assert.match(source, /playWallImpact\(/);
  assert.match(source, /playEnemyDeath\(/);
  assert.match(source, /setPlacementMarkers\(/);
  assert.match(source, /resetSystem\(\)/);
  assert.match(source, /stopSystem\(\)/);
  assert.match(source, /gfx\.BlendFactor\.ONE/);
  assert.match(source, /assetManager\.loadBundle\('ui'/);
  assert.match(source, /bundle\.load\(spec\.path/);
  assert.equal(source.includes('assetManager.loadAny'), false);
  assert.match(source, /trailPool/);
  assert.match(source, /spawnTrailEcho\(/);
  assert.match(source, /playSourceFlash\(/);
  assert.match(source, /playLayeredImpact\(/);
  assert.match(source, /playShockRing\(/);
  assert.match(source, /this\.playShockRing\(preset, position, critical\)/);
  assert.match(source, /preset\.impactScale \* BATTLE_VFX_HIT_VISUAL_SCALE/);
  assert.match(source, /profile\.startSize \* BATTLE_VFX_HIT_VISUAL_SCALE/);
  assert.match(source, /profile\.endSize \* BATTLE_VFX_HIT_VISUAL_SCALE/);
  assert.match(source, /profile\.spread\[0\] \* BATTLE_VFX_HIT_VISUAL_SCALE/);
  assert.match(
    source,
    /preset\.impactScale \* BATTLE_VFX_HIT_VISUAL_SCALE \* \(critical \? 0\.7 : 0\.56\)/,
  );
  assert.match(source, /preset\.impactScale \* 0\.72/);
  assert.match(source, /handle\.duration = critical \? 0\.3 : 0\.22/);
  assert.match(
    source,
    /BATTLE_VFX_TEXTURE_FALLBACKS\[preset\.impactTexture\] \?\? preset\.impactTexture/,
  );
  assert.match(source, /resolveFrame\(/);
  assert.match(source, /BATTLE_VFX_TEXTURE_FALLBACKS/);
  assert.match(source, /resolveParticleFrame\(/);
  assert.equal(source.includes('fallbackSegments'), false);
  assert.equal(source.includes('fallbackBursts'), false);
  assert.equal(source.includes('BattleVfxGraphicsFallback'), false);
  assert.equal(source.includes('addComponent(Graphics)'), false);
  assert.equal(source.includes('lineWidth = 5'), false);
  assert.match(
    source,
    /this\.reclaimEvictedReservations\(\);\s*const handle = this\.acquireSprite/,
  );
  assert.match(
    source,
    /this\.reclaimEvictedReservations\(\);\s*const handle = this\.acquireParticle/,
  );
  assert.match(source, /available\.node\.parent !== parent/);
  assert.match(source, /particle\.duration \+ particle\.life \+ particle\.lifeVar/);
  assert.match(source, /spriteFrame = null;\s*handle\.particle\.stopSystem\(\)/);
  assert.match(source, /clear\(\)/);
  assert.match(source, /dispose\(\)/);
  assert.equal(source.includes('autoRemoveOnFinish = true'), false);
});

runTest('controller routes main companion and ordinary heroes through one vfx owner', () => {
  const controller = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');
  const player = readFileSync('assets/scripts/battle/PlayerAutoAttackSystem.ts', 'utf8');
  const fixedCompanion = readFileSync(
    'assets/scripts/battle/FixedSpineCompanionPresentation.ts',
    'utf8',
  );
  const thunder = readFileSync('assets/scripts/battle/ThunderMagePresentation.ts', 'utf8');
  const grid = readFileSync('assets/scripts/battle/GridPlacementSystem.ts', 'utf8');
  assert.equal((controller.match(/new BattleVfxSystem\(/g) ?? []).length, 1);
  assert.ok(controller.includes('this.battleVfx.update(vfxDelta)'));
  assert.ok(controller.includes('this.battleVfx.clear()'));
  assert.ok(controller.includes('this.battleVfx?.dispose()'));
  assert.equal((player.match(/this\.battleVfx\.playAttackEvent\(event\)/g) ?? []).length, 1);
  assert.equal(
    (fixedCompanion.match(/this\.battleVfx\.playAttackEvent\(event\)/g) ?? []).length,
    1,
  );
  assert.equal((grid.match(/this\.battleVfx\.playAttackEvent\(event\)/g) ?? []).length, 2);
  assert.match(
    grid,
    /if \(event\.impactKind === 'primary'\)[\s\S]*continue;[\s\S]*if \(event\.impactKind === 'splash'/,
  );
  assert.equal((thunder.match(/this\.battleVfx\.playAttackEvent\(event\)/g) ?? []).length, 0);
  assert.equal(player.includes('ParticleSystem2D'), false);
  assert.equal(fixedCompanion.includes('ParticleSystem2D'), false);
  assert.equal(thunder.includes('ParticleSystem2D'), false);
});

runTest('status death and fortress feedback avoid persistent enemy rings', () => {
  const controller = readFileSync('assets/scripts/battle/BattleController.ts', 'utf8');
  const system = readFileSync('assets/scripts/battle/BattleVfxSystem.ts', 'utf8');
  const enemies = readFileSync('assets/scripts/battle/EnemySystem.ts', 'utf8');
  assert.ok(controller.includes('this.battleVfx.playStatusImpact(event)'));
  assert.ok(
    controller.includes('this.battleVfx.playEnemyDeath(event.enemyPosition, event.targetKind)'),
  );
  assert.ok(controller.includes('this.battleVfx.playWallImpact({'));
  assert.ok(system.includes('Math.floor(this.nowSeconds * 10)'));
  assert.ok(system.includes('this.statusFeedbackBuckets.get(key) === bucket'));
  assert.equal(enemies.includes('size / 2 + 5'), false);
  assert.equal(enemies.includes('size / 2 + 9'), false);
});
