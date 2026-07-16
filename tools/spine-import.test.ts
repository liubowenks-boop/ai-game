import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { strict as assert } from 'node:assert';
import { inflateSync } from 'node:zlib';

const root = process.cwd();
const assetDir = join(root, 'assets/resources/spine/animation');
const requiredFiles = ['animation.json', 'animation.atlas', 'animation.png'];

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

type SpineAnimation = {
  slots?: Record<
    string,
    {
      attachment?: Array<{
        time?: number;
        name?: string;
      }>;
    }
  >;
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
    const line = lines[index].trim();
    const nextLine = lines[index + 1]?.trim() ?? '';
    if (line && nextLine.startsWith('rotate:')) {
      const xyLine = lines[index + 2]?.trim() ?? '';
      const sizeLine = lines[index + 3]?.trim() ?? '';
      const xyMatch = /^xy:\s*(\d+),\s*(\d+)$/.exec(xyLine);
      const sizeMatch = /^size:\s*(\d+),\s*(\d+)$/.exec(sizeLine);
      assert.ok(xyMatch, `missing xy for atlas region ${line}`);
      assert.ok(sizeMatch, `missing size for atlas region ${line}`);
      regions.push({
        name: line,
        x: Number(xyMatch[1]),
        y: Number(xyMatch[2]),
        width: Number(sizeMatch[1]),
        height: Number(sizeMatch[2]),
      });
    }
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
      const upLeft = y > 0 && xByte >= bytesPerPixel ? pixels[previousRowStart + xByte - bytesPerPixel] : 0;

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

function firstAttachmentTimeline(animation: SpineAnimation): Array<{ time?: number; name?: string }> {
  const timelines = Object.values(animation.slots ?? {}).flatMap((slot) => slot.attachment ?? []);
  assert.ok(timelines.length > 0, 'expected an attachment timeline');
  return timelines;
}

for (const fileName of requiredFiles) {
  requireFile(join(assetDir, fileName));
}

const spineJson = readJson(join(assetDir, 'animation.json'));
assert.ok(
  spineJson.skeleton?.spine?.startsWith('3.8.'),
  `expected Spine 3.8 data, got ${spineJson.skeleton?.spine ?? 'unknown'}`,
);
assert.equal(spineJson.skeleton.images, './');
assert.equal(Array.isArray(spineJson.skins), false, 'Spine 3.8 skins must use a keyed object');
assert.ok(!Array.isArray(spineJson.skins) && spineJson.skins?.default?.frame, 'missing default frame skin');

const animationNames = Object.keys(spineJson.animations ?? {});
assert.ok(animationNames.length > 0, 'expected at least one Spine animation');
assert.deepEqual(animationNames, ['attack'], 'expected a portable attack animation name');
const animation = spineJson.animations?.[animationNames[0]];
assert.ok(animation, `missing animation ${animationNames[0]}`);
const attachmentTimeline = firstAttachmentTimeline(animation);
const frameDuration = 1 / 12;
for (let index = 0; index < attachmentTimeline.length; index += 1) {
  assert.ok(
    Math.abs((attachmentTimeline[index].time ?? -1) - index * frameDuration) < 0.00001,
    `animation frame ${index} should be keyed at ${(index * frameDuration).toFixed(5)}s`,
  );
}

const atlasText = readFileSync(join(assetDir, 'animation.atlas'), 'utf8');
assert.ok(atlasText.includes('animation.png'), 'atlas must reference animation.png');
assert.equal(basename(join(assetDir, 'animation.png')), 'animation.png');

const regions = atlasRegions(join(assetDir, 'animation.atlas'));
assert.ok(regions.length > 0, 'expected atlas regions');
const regionNames = new Set(regions.map((region) => region.name));
for (const attachmentName of attachmentNames(spineJson)) {
  assert.ok(regionNames.has(attachmentName), `attachment missing atlas region: ${attachmentName}`);
}

const png = readPngRgba(join(assetDir, 'animation.png'));
for (const region of regions) {
  for (const [x, y] of [
    [region.x + 8, region.y + 8],
    [region.x + region.width - 9, region.y + 8],
    [region.x + 8, region.y + region.height - 9],
    [region.x + region.width - 9, region.y + region.height - 9],
  ]) {
    assert.equal(png.alphaAt(x, y), 0, `${region.name} background should be transparent at ${x},${y}`);
  }
}

const regionByName = new Map(regions.map((region) => [region.name, region]));
const leakedBackgroundSamples: Readonly<Record<string, readonly [number, number][]>> = {
  frame_0: [
    [167, 242],
    [281, 237],
    [302, 269],
    [333, 252],
  ],
  frame_2: [
    [212, 236],
    [252, 220],
  ],
  frame_5: [
    [147, 246],
    [257, 243],
    [110, 275],
  ],
  frame_7: [
    [141, 221],
    [243, 222],
    [259, 254],
    [299, 236],
  ],
};

for (const [regionName, samples] of Object.entries(leakedBackgroundSamples)) {
  const region = regionByName.get(regionName);
  assert.ok(region, `missing atlas region ${regionName}`);
  for (const [localX, localY] of samples) {
    assert.equal(
      png.alphaAt(region.x + localX, region.y + localY),
      0,
      `${regionName} enclosed white background should be transparent at ${localX},${localY}`,
    );
  }
}

const preservedFireHighlights: Readonly<Record<string, readonly [number, number][]>> = {
  frame_0: [[365, 88]],
  frame_2: [[318, 92]],
  frame_5: [
    [58, 219],
    [238, 45],
  ],
};

for (const [regionName, samples] of Object.entries(preservedFireHighlights)) {
  const region = regionByName.get(regionName);
  assert.ok(region, `missing atlas region ${regionName}`);
  for (const [localX, localY] of samples) {
    assert.ok(
      png.alphaAt(region.x + localX, region.y + localY) > 0,
      `${regionName} fire highlight should remain visible at ${localX},${localY}`,
    );
  }
}

for (const fileName of requiredFiles) {
  requireFile(join(assetDir, `${fileName}.meta`));
}
requireFile(`${assetDir}.meta`);

console.log(`pass: imported Spine asset ${animationNames.join(', ')} has ${regions.length} transparent atlas regions`);
