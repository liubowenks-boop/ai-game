import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { inflateSync } from 'node:zlib';

const root = process.cwd();
const assetDir = join(root, 'assets/resources/spine/hero_thunder_mage');
const assetName = 'hero_thunder_mage';
const requiredFiles = [`${assetName}.json`, `${assetName}.atlas`, `${assetName}.png`];

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
  alphaAt(x: number, y: number): number;
};

function requireFile(path: string): void {
  assert.ok(existsSync(path), `missing file: ${path}`);
}

function readJson(path: string): SpineSkeletonJson {
  return JSON.parse(readFileSync(path, 'utf8')) as SpineSkeletonJson;
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
    alphaAt(x: number, y: number): number {
      assert.ok(x >= 0 && x < width && y >= 0 && y < height, `pixel out of bounds: ${x},${y}`);
      return pixels[(y * width + x) * bytesPerPixel + 3];
    },
  };
}

for (const fileName of requiredFiles) {
  requireFile(join(assetDir, fileName));
}

const spineJson = readJson(join(assetDir, `${assetName}.json`));
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
for (const region of regions) {
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

for (const fileName of requiredFiles) {
  requireFile(join(assetDir, `${fileName}.meta`));
}
requireFile(`${assetDir}.meta`);

console.log(
  `pass: imported thunder mage Spine attack has ${regions.length} transparent atlas regions`,
);
