import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 4;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');
const sourcePath = '/Users/hudaijin/Downloads/attack 2/attack 2.png';
const assetDir = join(root, 'assets/resources/spine/hero_thunder_mage');
const atlasPath = join(assetDir, 'hero_thunder_mage.atlas');
const outputPath = join(assetDir, 'hero_thunder_mage.png');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePngRgba(path) {
  const bytes = readFileSync(path);
  assert(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `expected PNG signature: ${path}`);

  let offset = 8;
  let ihdr;
  const idatChunks = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert(dataEnd + 4 <= bytes.length, `truncated PNG chunk ${type}`);
    const data = bytes.subarray(dataStart, dataEnd);

    if (type === 'IHDR') ihdr = Buffer.from(data);
    else if (type === 'IDAT') idatChunks.push(data);
    else if (type === 'IEND') break;

    offset = dataEnd + 4;
  }

  assert(ihdr?.length === 13, 'missing PNG IHDR');
  assert(idatChunks.length > 0, 'missing PNG IDAT');

  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  assert(ihdr.readUInt8(8) === 8, 'expected 8-bit PNG');
  assert(ihdr.readUInt8(9) === 6, 'expected RGBA PNG');
  assert(ihdr.readUInt8(10) === 0, 'unsupported PNG compression method');
  assert(ihdr.readUInt8(11) === 0, 'unsupported PNG filter method');
  assert(ihdr.readUInt8(12) === 0, 'expected non-interlaced PNG');

  const stride = width * BYTES_PER_PIXEL;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  assert(inflated.length === height * (stride + 1), 'unexpected PNG scanline size');

  const pixels = Buffer.alloc(width * height * BYTES_PER_PIXEL);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let xByte = 0; xByte < stride; xByte += 1) {
      const raw = inflated[sourceOffset + xByte];
      const left = xByte >= BYTES_PER_PIXEL ? pixels[rowStart + xByte - BYTES_PER_PIXEL] : 0;
      const up = y > 0 ? pixels[previousRowStart + xByte] : 0;
      const upLeft =
        y > 0 && xByte >= BYTES_PER_PIXEL ? pixels[previousRowStart + xByte - BYTES_PER_PIXEL] : 0;

      let value = raw;
      if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upLeft);
      else assert(filter === 0, `unsupported PNG filter ${filter}`);

      pixels[rowStart + xByte] = value & 0xff;
    }

    sourceOffset += stride;
  }

  return { width, height, ihdr, pixels };
}

function parseAtlasRegions(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const regions = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index].trim();
    const nextLine = lines[index + 1]?.trim() ?? '';
    if (!name || !nextLine.startsWith('rotate:')) continue;

    const xyMatch = /^xy:\s*(\d+),\s*(\d+)$/.exec(lines[index + 2]?.trim() ?? '');
    const sizeMatch = /^size:\s*(\d+),\s*(\d+)$/.exec(lines[index + 3]?.trim() ?? '');
    assert(xyMatch, `missing xy for atlas region ${name}`);
    assert(sizeMatch, `missing size for atlas region ${name}`);
    regions.push({
      name,
      x: Number(xyMatch[1]),
      y: Number(xyMatch[2]),
      width: Number(sizeMatch[1]),
      height: Number(sizeMatch[2]),
    });
  }

  assert(regions.length === 8, `expected 8 atlas regions, got ${regions.length}`);
  return regions;
}

function isNearWhite(pixels, pixelIndex) {
  const offset = pixelIndex * BYTES_PER_PIXEL;
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  return (
    red >= 245 &&
    green >= 245 &&
    blue >= 245 &&
    Math.max(red, green, blue) - Math.min(red, green, blue) <= 10
  );
}

function clearBoundaryConnectedBackground(image, region, clearedMask) {
  const { width: imageWidth, height: imageHeight, pixels } = image;
  assert(region.x >= 0 && region.y >= 0, `${region.name} starts outside the image`);
  assert(
    region.x + region.width <= imageWidth && region.y + region.height <= imageHeight,
    `${region.name} extends outside the image`,
  );

  const regionPixelCount = region.width * region.height;
  const visited = new Uint8Array(regionPixelCount);
  const queue = new Int32Array(regionPixelCount);
  let head = 0;
  let tail = 0;

  function enqueue(localX, localY) {
    const localIndex = localY * region.width + localX;
    if (visited[localIndex]) return;
    visited[localIndex] = 1;
    const pixelIndex = (region.y + localY) * imageWidth + region.x + localX;
    if (!isNearWhite(pixels, pixelIndex)) return;
    queue[tail] = localIndex;
    tail += 1;
  }

  for (let x = 0; x < region.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, region.height - 1);
  }
  for (let y = 1; y < region.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(region.width - 1, y);
  }

  let cleared = 0;
  while (head < tail) {
    const localIndex = queue[head];
    head += 1;
    const localX = localIndex % region.width;
    const localY = Math.floor(localIndex / region.width);
    const globalX = region.x + localX;
    const globalY = region.y + localY;
    const pixelIndex = globalY * imageWidth + globalX;
    const alphaOffset = pixelIndex * BYTES_PER_PIXEL + 3;
    clearedMask[pixelIndex] = 1;

    if (pixels[alphaOffset] !== 0) {
      pixels[alphaOffset] = 0;
      cleared += 1;
    }

    if (localX > 0) enqueue(localX - 1, localY);
    if (localX + 1 < region.width) enqueue(localX + 1, localY);
    if (localY > 0) enqueue(localX, localY - 1);
    if (localY + 1 < region.height) enqueue(localX, localY + 1);
  }

  return cleared;
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), data.length + 8);
  return chunk;
}

function encodePngRgba(image) {
  const stride = image.width * BYTES_PER_PIXEL;
  const scanlines = Buffer.alloc(image.height * (stride + 1));

  for (let y = 0; y < image.height; y += 1) {
    const targetOffset = y * (stride + 1);
    scanlines[targetOffset] = 0;
    image.pixels.copy(scanlines, targetOffset + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', image.ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function verifyOnlyConnectedAlphaChanged(originalPixels, pixels, clearedMask) {
  const pixelCount = pixels.length / BYTES_PER_PIXEL;
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * BYTES_PER_PIXEL;
    assert(pixels[offset] === originalPixels[offset], `red changed at pixel ${pixelIndex}`);
    assert(
      pixels[offset + 1] === originalPixels[offset + 1],
      `green changed at pixel ${pixelIndex}`,
    );
    assert(
      pixels[offset + 2] === originalPixels[offset + 2],
      `blue changed at pixel ${pixelIndex}`,
    );
    if (!clearedMask[pixelIndex]) {
      assert(
        pixels[offset + 3] === originalPixels[offset + 3],
        `alpha changed at pixel ${pixelIndex}`,
      );
    }
  }
}

const image = decodePngRgba(sourcePath);
assert(image.width === 3492 && image.height === 442, 'unexpected source PNG dimensions');
const originalPixels = Buffer.from(image.pixels);
const regions = parseAtlasRegions(atlasPath);
const clearedMask = new Uint8Array(image.width * image.height);
const stats = regions.map((region) => ({
  name: region.name,
  cleared: clearBoundaryConnectedBackground(image, region, clearedMask),
}));

verifyOnlyConnectedAlphaChanged(originalPixels, image.pixels, clearedMask);
const output = encodePngRgba(image);
const unchanged = existsSync(outputPath) && readFileSync(outputPath).equals(output);
if (!unchanged) writeFileSync(outputPath, output);

const totalCleared = stats.reduce((sum, stat) => sum + stat.cleared, 0);
console.log(`prepared ${outputPath}`);
for (const stat of stats) console.log(`${stat.name}: cleared ${stat.cleared} background pixels`);
console.log(`total: cleared ${totalCleared} pixels; output ${unchanged ? 'unchanged' : 'written'}`);
