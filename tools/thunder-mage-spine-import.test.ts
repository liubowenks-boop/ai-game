import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = process.cwd();
const assetDir = join(root, 'assets/resources/spine/hero_thunder_mage');
const assetName = 'hero_thunder_mage';
const requiredFiles = [`${assetName}.json`, `${assetName}.atlas`, `${assetName}.png`];
const prepareScriptPath = join(root, 'tools/prepare-thunder-mage-alpha.mjs');

type AttachmentKey = {
  time?: number;
  name?: string;
};

type SpineAnimation = {
  slots?: Record<string, { attachment?: AttachmentKey[] }>;
};

type SpineSkeletonJson = {
  skeleton?: {
    spine?: string;
    images?: string;
  };
  skins?:
    | Record<string, Record<string, Record<string, unknown>>>
    | Array<{
        attachments?: Record<string, Record<string, unknown>>;
      }>;
  animations?: Record<string, SpineAnimation>;
};

type AtlasRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PngRgbaImage = {
  width: number;
  height: number;
  rgba: Buffer;
  alphaAt(x: number, y: number): number;
};

type CocosMeta = {
  importer?: string;
  imported?: boolean;
  uuid?: string;
  files?: string[];
  subMetas?: Record<string, CocosSubMeta>;
  userData?: {
    atlasUuid?: string;
    type?: string;
    hasAlpha?: boolean;
    redirect?: string;
  };
};

type CocosSubMeta = {
  importer?: string;
  imported?: boolean;
  uuid?: string;
  displayName?: string;
  id?: string;
  name?: string;
  files?: string[];
  userData?: {
    wrapModeS?: string;
    wrapModeT?: string;
    minfilter?: string;
    magfilter?: string;
    mipfilter?: string;
    isUuid?: boolean;
    imageUuidOrDatabaseUri?: string;
  };
};

function requireFile(path: string): void {
  assert.ok(existsSync(path), `missing file: ${path}`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function atlasRegions(path: string): AtlasRegion[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const regions: AtlasRegion[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].trim();
    const nextLine = lines[index + 1]?.trim() ?? '';
    if (!name || !nextLine.startsWith('rotate:')) continue;

    const xyLine = lines[index + 2]?.trim() ?? '';
    const sizeLine = lines[index + 3]?.trim() ?? '';
    const xyMatch = /^xy:\s*(\d+),\s*(\d+)$/.exec(xyLine);
    const sizeMatch = /^size:\s*(\d+),\s*(\d+)$/.exec(sizeLine);
    assert.ok(xyMatch, `missing xy for atlas region ${name}`);
    assert.ok(sizeMatch, `missing size for atlas region ${name}`);
    regions.push({
      name,
      x: Number(xyMatch[1]),
      y: Number(xyMatch[2]),
      width: Number(sizeMatch[1]),
      height: Number(sizeMatch[2]),
    });
  }

  return regions;
}

function attachmentNames(json: SpineSkeletonJson): string[] {
  const skins = Array.isArray(json.skins)
    ? json.skins.map((skin) => skin.attachments ?? {})
    : Object.values(json.skins ?? {});
  return skins.flatMap((skin) =>
    Object.values(skin).flatMap((slotAttachments) => Object.keys(slotAttachments)),
  );
}

function readPngRgba(path: string): PngRgbaImage {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', 'expected a PNG image');

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
    assert.ok(dataEnd + 4 <= bytes.length, `truncated PNG chunk ${type}`);
    const data = bytes.subarray(dataStart, dataEnd);
    assert.equal(
      bytes.readUInt32BE(dataEnd),
      crc32(bytes.subarray(offset + 4, dataEnd)),
      `invalid CRC for PNG chunk ${type}`,
    );

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

  assert.equal(bitDepth, 8, 'expected 8-bit PNG');
  assert.equal(colorType, 6, 'expected RGBA PNG');

  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;

  function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  }

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let xByte = 0; xByte < stride; xByte += 1) {
      const raw = inflated[sourceOffset + xByte];
      const left = xByte >= bytesPerPixel ? pixels[rowStart + xByte - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[previousRowStart + xByte] : 0;
      const upLeft =
        y > 0 && xByte >= bytesPerPixel ? pixels[previousRowStart + xByte - bytesPerPixel] : 0;

      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else assert.equal(filter, 0, `unsupported PNG filter ${filter}`);

      pixels[rowStart + xByte] = value & 0xff;
    }

    sourceOffset += stride;
  }

  return {
    width,
    height,
    rgba: pixels,
    alphaAt(x: number, y: number): number {
      assert.ok(x >= 0 && x < width && y >= 0 && y < height, `pixel out of bounds: ${x},${y}`);
      return pixels[(y * width + x) * bytesPerPixel + 3];
    },
  };
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function runPrepare(args: string[]) {
  return spawnSync(process.execPath, [prepareScriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function assertUuid(uuid: string | undefined, label: string): asserts uuid is string {
  assert.match(
    uuid ?? '',
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    `${label} must use a unique UUID v4`,
  );
}

for (const fileName of requiredFiles) {
  requireFile(join(assetDir, fileName));
}

const spineJson = readJson<SpineSkeletonJson>(join(assetDir, `${assetName}.json`));
assert.equal(spineJson.skeleton?.spine, '3.8.75');
assert.equal(spineJson.skeleton?.images, './');

const expectedAttachments = Array.from({ length: 8 }, (_, index) => `frame_${index}`);
assert.deepEqual(attachmentNames(spineJson), expectedAttachments);

const animationNames = Object.keys(spineJson.animations ?? {});
assert.deepEqual(animationNames, ['attack']);
const attack = spineJson.animations?.attack;
assert.ok(attack, 'missing attack animation');
assert.deepEqual(Object.keys(attack.slots ?? {}), ['frame']);
const attachmentTimeline = attack.slots?.frame?.attachment;
assert.ok(attachmentTimeline, 'missing frame attachment timeline');
assert.deepEqual(
  attachmentTimeline.map((key) => key.time ?? 0),
  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
);
assert.deepEqual(
  attachmentTimeline.map((key) => key.name),
  [...expectedAttachments, 'frame_0'],
);

const atlasPath = join(assetDir, `${assetName}.atlas`);
const atlasText = readFileSync(atlasPath, 'utf8');
assert.equal(atlasText.split(/\r?\n/, 1)[0], `${assetName}.png`);
assert.equal(basename(join(assetDir, `${assetName}.png`)), `${assetName}.png`);

const regions = atlasRegions(atlasPath);
assert.equal(regions.length, 8);
assert.deepEqual(regions.map((region) => region.name).sort(), expectedAttachments);

const png = readPngRgba(join(assetDir, `${assetName}.png`));
assert.equal(png.width, 3492);
assert.equal(png.height, 442);
assert.equal(
  createHash('sha256')
    .update(readFileSync(join(assetDir, `${assetName}.png`)))
    .digest('hex'),
  'a72150d1aac31ac1653539110311e09519c8bb3e2500124cb8efa276efc35a18',
);
assert.equal(
  createHash('sha256').update(png.rgba).digest('hex'),
  '5a87a7b71504fc391087bfa20813ae202e3a419f72f543ff672386b212f92dbb',
);

const expectedRegionPixels: Record<string, { transparent: number; visible: number }> = {
  frame_0: { transparent: 71227, visible: 60821 },
  frame_1: { transparent: 78126, visible: 56033 },
  frame_2: { transparent: 82755, visible: 58719 },
  frame_3: { transparent: 89131, visible: 61814 },
  frame_4: { transparent: 64120, visible: 47219 },
  frame_5: { transparent: 72131, visible: 58194 },
  frame_6: { transparent: 58022, visible: 43208 },
  frame_7: { transparent: 59950, visible: 52719 },
};

for (const region of regions) {
  let transparent = 0;
  let visible = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const alpha = png.alphaAt(x, y);
      if (alpha === 0) transparent += 1;
      else visible += 1;
    }
  }
  assert.deepEqual({ transparent, visible }, expectedRegionPixels[region.name]);

  const centerX = region.x + Math.floor(region.width / 2);
  const centerY = region.y + Math.floor(region.height / 2);
  assert.ok(
    png.alphaAt(centerX, centerY) > 0,
    `${region.name} character center should remain visible at ${centerX},${centerY}`,
  );

  for (const [x, y] of [
    [region.x + 8, region.y + 8],
    [region.x + region.width - 9, region.y + 8],
    [region.x + 8, region.y + region.height - 9],
    [region.x + region.width - 9, region.y + region.height - 9],
  ]) {
    assert.equal(
      png.alphaAt(x, y),
      0,
      `${region.name} background should be transparent at ${x},${y}`,
    );
  }
}

const directoryMeta = readJson<CocosMeta>(`${assetDir}.meta`);
const atlasMeta = readJson<CocosMeta>(join(assetDir, `${assetName}.atlas.meta`));
const skeletonMeta = readJson<CocosMeta>(join(assetDir, `${assetName}.json.meta`));
const imageMeta = readJson<CocosMeta>(join(assetDir, `${assetName}.png.meta`));

assert.equal(directoryMeta.importer, 'directory');
assert.equal(atlasMeta.importer, '*');
assert.equal(skeletonMeta.importer, 'spine-data');
assert.equal(imageMeta.importer, 'image');
for (const [label, meta] of [
  ['directory', directoryMeta],
  ['atlas', atlasMeta],
  ['skeleton', skeletonMeta],
  ['image', imageMeta],
] as const) {
  assert.equal(meta.imported, true, `${label} meta must be imported`);
  assertUuid(meta.uuid, label);
}

const metaUuids = [directoryMeta.uuid, atlasMeta.uuid, skeletonMeta.uuid, imageMeta.uuid];
assert.equal(new Set(metaUuids).size, metaUuids.length, 'asset meta UUIDs must be unique');
assert.deepEqual(atlasMeta.files, ['.atlas', '.json']);
assert.deepEqual(skeletonMeta.files, ['.json']);
assert.equal(skeletonMeta.userData?.atlasUuid, atlasMeta.uuid);
assert.deepEqual(imageMeta.files, ['.json', '.png']);
assert.equal(imageMeta.userData?.type, 'texture');
assert.equal(imageMeta.userData?.hasAlpha, true);

const textureEntries = Object.entries(imageMeta.subMetas ?? {});
assert.equal(textureEntries.length, 1, 'image meta must have one texture subMeta');
const [textureId, textureMeta] = textureEntries[0];
assert.equal(textureMeta.importer, 'texture');
assert.equal(textureMeta.imported, true);
assert.equal(textureMeta.id, textureId);
assert.equal(textureMeta.name, 'texture');
assert.equal(textureMeta.displayName, assetName);
assert.equal(textureMeta.uuid, `${imageMeta.uuid}@${textureId}`);
assert.deepEqual(textureMeta.files, ['.json']);
assert.equal(textureMeta.userData?.isUuid, true);
assert.equal(textureMeta.userData?.imageUuidOrDatabaseUri, imageMeta.uuid);
assert.equal(textureMeta.userData?.wrapModeS, 'repeat');
assert.equal(textureMeta.userData?.wrapModeT, 'repeat');
assert.equal(textureMeta.userData?.minfilter, 'linear');
assert.equal(textureMeta.userData?.magfilter, 'linear');
assert.equal(textureMeta.userData?.mipfilter, 'none');
assert.equal(imageMeta.userData?.redirect, textureMeta.uuid);

const missingArgs = runPrepare([]);
assert.notEqual(missingArgs.status, 0, 'prepare script must reject missing CLI arguments');
assert.match(missingArgs.stderr, /Usage:/);

const tempDir = mkdtempSync(join(tmpdir(), 'thunder-mage-alpha-'));
try {
  const pngBytes = readFileSync(join(assetDir, `${assetName}.png`));
  const outputPath = join(tempDir, 'output.png');

  const missingSource = runPrepare([join(tempDir, 'missing.png'), atlasPath, outputPath]);
  assert.notEqual(missingSource.status, 0);
  assert.match(missingSource.stderr, /source PNG.*not a file/);

  const corruptCrc = Buffer.from(pngBytes);
  corruptCrc[32] ^= 0xff;
  const corruptPath = join(tempDir, 'corrupt-crc.png');
  writeFileSync(corruptPath, corruptCrc);
  const corruptResult = runPrepare([corruptPath, atlasPath, outputPath]);
  assert.notEqual(corruptResult.status, 0);
  assert.match(corruptResult.stderr, /CRC mismatch for IHDR/);

  const oversized = Buffer.from(pngBytes);
  oversized.writeUInt32BE(100_000, 16);
  oversized.writeUInt32BE(crc32(oversized.subarray(12, 29)), 29);
  const oversizedPath = join(tempDir, 'oversized.png');
  writeFileSync(oversizedPath, oversized);
  const oversizedResult = runPrepare([oversizedPath, atlasPath, outputPath]);
  assert.notEqual(oversizedResult.status, 0);
  assert.match(oversizedResult.stderr, /PNG dimensions exceed safety limit/);

  const validResult = runPrepare([join(assetDir, `${assetName}.png`), atlasPath, outputPath]);
  assert.equal(validResult.status, 0, validResult.stderr);
  assert.equal(
    createHash('sha256').update(readFileSync(outputPath)).digest('hex'),
    'a72150d1aac31ac1653539110311e09519c8bb3e2500124cb8efa276efc35a18',
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log(
  `pass: imported thunder mage Spine attack has ${regions.length} transparent atlas regions`,
);
