import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

type SpineSkeleton = {
  skeleton?: { spine?: string };
  skins?: Array<{
    attachments?: Record<string, Record<string, unknown>>;
  }>;
  animations?: Record<string, {
    slots?: Record<string, { attachment?: Array<{ time?: number }> }>;
  }>;
};

type AtlasRegion = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type CocosMeta = {
  importer?: string;
  imported?: boolean;
  uuid?: string;
  files?: string[];
  subMetas?: Record<string, { importer?: string; uuid?: string }>;
  userData?: { atlasUuid?: string; hasAlpha?: boolean };
};

const root = process.cwd();
const assetName = 'hero_qinglan';
const assetDir = join(root, 'assets/resources/spine', assetName);

function atlasRegions(path: string): AtlasRegion[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const regions: AtlasRegion[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].trim();
    if (!name || !lines[index + 1]?.trim().startsWith('rotate:')) continue;

    const xy = /^xy:\s*(\d+),\s*(\d+)$/.exec(lines[index + 2]?.trim() ?? '');
    const size = /^size:\s*(\d+),\s*(\d+)$/.exec(lines[index + 3]?.trim() ?? '');
    assert.ok(xy, `missing xy for atlas region ${name}`);
    assert.ok(size, `missing size for atlas region ${name}`);
    regions.push({
      name,
      x: Number(xy[1]),
      y: Number(xy[2]),
      width: Number(size[1]),
      height: Number(size[2]),
    });
  }

  return regions;
}

function attachmentNames(skeleton: SpineSkeleton): string[] {
  return (skeleton.skins ?? []).flatMap((skin) =>
    Object.values(skin.attachments ?? {}).flatMap((attachments) => Object.keys(attachments)),
  );
}

function animationDuration(animation: NonNullable<SpineSkeleton['animations']>[string]): number {
  return Math.max(
    0,
    ...Object.values(animation.slots ?? {}).flatMap((slot) =>
      (slot.attachment ?? []).map((key) => key.time ?? 0),
    ),
  );
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readRgbaPng(path: string): { alphaAt(x: number, y: number): number } {
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
    assert.equal(bytes.readUInt32BE(dataEnd), crc32(bytes.subarray(offset + 4, dataEnd)));
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }

  assert.equal(bitDepth, 8, 'expected 8-bit PNG');
  assert.equal(colorType, 6, 'expected RGBA PNG');
  const stride = width * 4;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);
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
    const filter = inflated[sourceOffset++];
    const rowStart = y * stride;
    for (let xByte = 0; xByte < stride; xByte += 1) {
      const raw = inflated[sourceOffset++];
      const left = xByte >= 4 ? rgba[rowStart + xByte - 4] : 0;
      const up = y > 0 ? rgba[rowStart + xByte - stride] : 0;
      const upLeft = y > 0 && xByte >= 4 ? rgba[rowStart + xByte - stride - 4] : 0;
      if (filter === 0) rgba[rowStart + xByte] = raw;
      else if (filter === 1) rgba[rowStart + xByte] = (raw + left) & 0xff;
      else if (filter === 2) rgba[rowStart + xByte] = (raw + up) & 0xff;
      else if (filter === 3) rgba[rowStart + xByte] = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) rgba[rowStart + xByte] = (raw + paeth(left, up, upLeft)) & 0xff;
      else assert.fail(`unsupported PNG filter ${filter}`);
    }
  }

  return {
    alphaAt(x: number, y: number): number {
      assert.ok(x >= 0 && x < width && y >= 0 && y < height, `pixel out of bounds: ${x},${y}`);
      return rgba[(y * width + x) * 4 + 3];
    },
  };
}

function readMeta(path: string): CocosMeta {
  return JSON.parse(readFileSync(path, 'utf8')) as CocosMeta;
}

for (const extension of ['json', 'atlas', 'png']) {
  assert.ok(existsSync(join(assetDir, `${assetName}.${extension}`)));
}

const skeleton = JSON.parse(readFileSync(join(assetDir, `${assetName}.json`), 'utf8')) as SpineSkeleton;
assert.equal(skeleton.skeleton?.spine, '3.8.75');
assert.deepEqual(Object.keys(skeleton.animations ?? {}), ['attack']);
assert.deepEqual(attachmentNames(skeleton), [
  'frame_0', 'frame_1', 'frame_2', 'frame_3',
  'frame_4', 'frame_5', 'frame_6', 'frame_7',
]);
assert.equal(animationDuration(skeleton.animations?.attack ?? {}), 1);

const atlasPath = join(assetDir, `${assetName}.atlas`);
assert.match(readFileSync(atlasPath, 'utf8'), /^hero_qinglan\.png/m);
const regions = atlasRegions(atlasPath);
assert.equal(regions.length, 8);
assert.deepEqual(regions.map((region) => region.name), [
  'frame_0', 'frame_1', 'frame_2', 'frame_3',
  'frame_4', 'frame_5', 'frame_6', 'frame_7',
]);
const image = readRgbaPng(join(assetDir, `${assetName}.png`));
for (const region of regions) {
  assert.equal(image.alphaAt(region.x, region.y), 0);
  assert.equal(image.alphaAt(region.x + region.width - 1, region.y + region.height - 1), 0);
}

const directoryMeta = readMeta(`${assetDir}.meta`);
const jsonMeta = readMeta(join(assetDir, `${assetName}.json.meta`));
const atlasMeta = readMeta(join(assetDir, `${assetName}.atlas.meta`));
const pngMeta = readMeta(join(assetDir, `${assetName}.png.meta`));
assert.equal(directoryMeta.importer, 'directory');
assert.equal(jsonMeta.importer, 'spine-data');
assert.equal(atlasMeta.importer, '*');
assert.equal(pngMeta.importer, 'image');
assert.equal(pngMeta.userData?.hasAlpha, true);
assert.equal(jsonMeta.userData?.atlasUuid, atlasMeta.uuid);
for (const meta of [directoryMeta, jsonMeta, atlasMeta, pngMeta]) {
  assert.equal(meta.imported, true);
  assert.match(meta.uuid ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
}
assert.equal(new Set([directoryMeta.uuid, jsonMeta.uuid, atlasMeta.uuid, pngMeta.uuid]).size, 4);

console.log(`pass: imported Qinglan Spine attack has ${regions.length} transparent atlas regions`);
