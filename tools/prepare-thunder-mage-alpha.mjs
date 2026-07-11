import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BYTES_PER_PIXEL = 4;
const MAX_PNG_FILE_BYTES = 64 * 1024 * 1024;
const MAX_CHUNK_BYTES = 32 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_DIMENSION = 16_384;
const MAX_PIXELS = 16_777_216;

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

function formatCrc(value) {
  return value.toString(16).padStart(8, '0');
}

function validateIhdr(ihdr) {
  assert(ihdr.length === 13, 'PNG IHDR must contain 13 bytes');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  assert(width > 0 && height > 0, `PNG dimensions must be positive, got ${width}x${height}`);
  assert(
    width <= MAX_DIMENSION && height <= MAX_DIMENSION,
    `PNG dimensions exceed safety limit: ${width}x${height} (max ${MAX_DIMENSION} per side)`,
  );
  assert(
    width * height <= MAX_PIXELS,
    `PNG pixel count exceeds safety limit: ${width * height} (max ${MAX_PIXELS})`,
  );
  assert(ihdr.readUInt8(8) === 8, 'expected 8-bit PNG');
  assert(ihdr.readUInt8(9) === 6, 'expected RGBA PNG');
  assert(ihdr.readUInt8(10) === 0, 'unsupported PNG compression method');
  assert(ihdr.readUInt8(11) === 0, 'unsupported PNG filter method');
  assert(ihdr.readUInt8(12) === 0, 'expected non-interlaced PNG');
  return { width, height };
}

function decodePngRgba(path) {
  const fileSize = statSync(path).size;
  assert(
    fileSize <= MAX_PNG_FILE_BYTES,
    `PNG file exceeds safety limit: ${fileSize} bytes (max ${MAX_PNG_FILE_BYTES})`,
  );
  const bytes = readFileSync(path);
  assert(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `expected PNG signature: ${path}`);

  let offset = 8;
  let ihdr;
  let width = 0;
  let height = 0;
  let compressedBytes = 0;
  let chunkIndex = 0;
  let sawIend = false;
  const idatChunks = [];

  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, `truncated PNG chunk header at byte ${offset}`);
    const length = bytes.readUInt32BE(offset);
    assert(
      length <= MAX_CHUNK_BYTES,
      `PNG chunk exceeds safety limit: ${length} bytes (max ${MAX_CHUNK_BYTES})`,
    );
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert(dataEnd + 4 <= bytes.length, `truncated PNG chunk ${type}`);
    const data = bytes.subarray(dataStart, dataEnd);
    const storedCrc = bytes.readUInt32BE(dataEnd);
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd));
    assert(
      storedCrc === actualCrc,
      `CRC mismatch for ${type}: stored ${formatCrc(storedCrc)}, calculated ${formatCrc(actualCrc)}`,
    );

    if (chunkIndex === 0) assert(type === 'IHDR', `first PNG chunk must be IHDR, got ${type}`);

    if (type === 'IHDR') {
      assert(!ihdr, 'PNG must contain exactly one IHDR chunk');
      ihdr = Buffer.from(data);
      ({ width, height } = validateIhdr(ihdr));
    } else {
      assert(ihdr, `PNG chunk ${type} appeared before IHDR`);
    }

    if (type === 'IDAT') {
      compressedBytes += length;
      assert(
        compressedBytes <= MAX_COMPRESSED_BYTES,
        `PNG compressed data exceeds safety limit: ${compressedBytes} bytes (max ${MAX_COMPRESSED_BYTES})`,
      );
      idatChunks.push(data);
    } else if (type === 'IEND') {
      assert(length === 0, 'PNG IEND chunk must be empty');
      sawIend = true;
    }

    offset = dataEnd + 4;
    chunkIndex += 1;
    if (sawIend) break;
  }

  assert(ihdr, 'missing PNG IHDR');
  assert(idatChunks.length > 0, 'missing PNG IDAT');
  assert(sawIend, 'missing PNG IEND');
  assert(
    offset === bytes.length,
    `unexpected trailing data after PNG IEND: ${bytes.length - offset} bytes`,
  );

  const stride = width * BYTES_PER_PIXEL;
  const expectedScanlineBytes = height * (stride + 1);
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks), {
      maxOutputLength: expectedScanlineBytes,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `PNG inflate failed or exceeded ${expectedScanlineBytes} output bytes: ${detail}`,
    );
  }
  assert(
    inflated.length === expectedScanlineBytes,
    `unexpected PNG scanline size: ${inflated.length} bytes (expected ${expectedScanlineBytes})`,
  );

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

function requireInputFile(path, label) {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    throw new Error(`${label} is not a file: ${path}`);
  }
  assert(stats.isFile(), `${label} is not a file: ${path}`);
  return stats;
}

function parseCliArgs(args) {
  assert(
    args.length === 3,
    'Usage: node tools/prepare-thunder-mage-alpha.mjs <source.png> <atlas> <output.png>',
  );
  const [sourceArgument, atlasArgument, outputArgument] = args;
  const sourcePath = resolve(sourceArgument);
  const atlasPath = resolve(atlasArgument);
  const outputPath = resolve(outputArgument);

  const sourceStats = requireInputFile(sourcePath, 'source PNG');
  requireInputFile(atlasPath, 'atlas');
  assert(sourcePath !== outputPath, 'source PNG and output PNG must use different paths');

  const outputDirectory = dirname(outputPath);
  let outputDirectoryStats;
  try {
    outputDirectoryStats = statSync(outputDirectory);
  } catch {
    throw new Error(`output directory is not a directory: ${outputDirectory}`);
  }
  assert(
    outputDirectoryStats.isDirectory(),
    `output directory is not a directory: ${outputDirectory}`,
  );
  if (existsSync(outputPath)) {
    const outputStats = requireInputFile(outputPath, 'output PNG');
    assert(
      sourceStats.dev !== outputStats.dev || sourceStats.ino !== outputStats.ino,
      'source PNG and output PNG must refer to different files',
    );
  }

  return { sourcePath, atlasPath, outputPath };
}

function main() {
  const { sourcePath, atlasPath, outputPath } = parseCliArgs(process.argv.slice(2));
  const image = decodePngRgba(sourcePath);
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
  console.log(
    `total: cleared ${totalCleared} pixels; output ${unchanged ? 'unchanged' : 'written'}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = 1;
}
