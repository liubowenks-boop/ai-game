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
const FRAME_NAME = 'frame_0';
const CROP = { x: 48, y: 75, width: 40, height: 70 };
const OUTPUT_SIZE = { width: 128, height: 256 };
const ALPHA_THRESHOLD = 16;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function paeth(a, b, c) {
  const prediction = a + b - c;
  const distanceA = Math.abs(prediction - a);
  const distanceB = Math.abs(prediction - b);
  const distanceC = Math.abs(prediction - c);
  if (distanceA <= distanceB && distanceA <= distanceC) return a;
  return distanceB <= distanceC ? b : c;
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

function validateIhdr(ihdr) {
  assert(ihdr.length === 13, 'PNG IHDR must contain 13 bytes');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  assert(width > 0 && height > 0, `PNG dimensions must be positive, got ${width}x${height}`);
  assert(
    width <= MAX_DIMENSION && height <= MAX_DIMENSION,
    `PNG dimensions exceed safety limit: ${width}x${height}`,
  );
  assert(width * height <= MAX_PIXELS, `PNG pixel count exceeds safety limit: ${width * height}`);
  assert(ihdr.readUInt8(8) === 8, 'expected 8-bit PNG');
  assert(ihdr.readUInt8(9) === 6, 'expected RGBA PNG');
  assert(ihdr.readUInt8(10) === 0, 'unsupported PNG compression method');
  assert(ihdr.readUInt8(11) === 0, 'unsupported PNG filter method');
  assert(ihdr.readUInt8(12) === 0, 'expected non-interlaced PNG');
  return { width, height };
}

function decodePngRgba(path) {
  const fileSize = statSync(path).size;
  assert(fileSize <= MAX_PNG_FILE_BYTES, `PNG file exceeds safety limit: ${fileSize} bytes`);
  const bytes = readFileSync(path);
  assert(bytes.subarray(0, 8).equals(PNG_SIGNATURE), `expected PNG signature: ${path}`);

  let offset = 8;
  let width = 0;
  let height = 0;
  let compressedBytes = 0;
  let chunkIndex = 0;
  let sawIhdr = false;
  let sawIend = false;
  const idatChunks = [];

  while (offset < bytes.length) {
    assert(offset + 8 <= bytes.length, `truncated PNG chunk header at byte ${offset}`);
    const length = bytes.readUInt32BE(offset);
    assert(length <= MAX_CHUNK_BYTES, `PNG chunk exceeds safety limit: ${length} bytes`);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    assert(dataEnd + 4 <= bytes.length, `truncated PNG chunk ${type}`);
    const data = bytes.subarray(dataStart, dataEnd);
    const storedCrc = bytes.readUInt32BE(dataEnd);
    const actualCrc = crc32(bytes.subarray(offset + 4, dataEnd));
    assert(storedCrc === actualCrc, `CRC mismatch for ${type}`);
    if (chunkIndex === 0) assert(type === 'IHDR', `first PNG chunk must be IHDR, got ${type}`);

    if (type === 'IHDR') {
      assert(!sawIhdr, 'PNG must contain exactly one IHDR chunk');
      sawIhdr = true;
      ({ width, height } = validateIhdr(data));
    } else {
      assert(sawIhdr, `PNG chunk ${type} appeared before IHDR`);
    }

    if (type === 'IDAT') {
      compressedBytes += length;
      assert(
        compressedBytes <= MAX_COMPRESSED_BYTES,
        `PNG compressed data exceeds safety limit: ${compressedBytes} bytes`,
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

  assert(sawIhdr, 'missing PNG IHDR');
  assert(idatChunks.length > 0, 'missing PNG IDAT');
  assert(sawIend, 'missing PNG IEND');
  assert(offset === bytes.length, `unexpected trailing data after PNG IEND`);

  const stride = width * BYTES_PER_PIXEL;
  const expectedScanlineBytes = height * (stride + 1);
  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(idatChunks), { maxOutputLength: expectedScanlineBytes });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`PNG inflate failed or exceeded ${expectedScanlineBytes} bytes: ${detail}`);
  }
  assert(
    inflated.length === expectedScanlineBytes,
    `unexpected PNG scanline size: ${inflated.length} bytes`,
  );

  const pixels = Buffer.alloc(width * height * BYTES_PER_PIXEL);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rowStart = y * stride;
    for (let byteIndex = 0; byteIndex < stride; byteIndex += 1) {
      const raw = inflated[sourceOffset + byteIndex];
      const left = byteIndex >= BYTES_PER_PIXEL ? pixels[rowStart + byteIndex - 4] : 0;
      const up = y > 0 ? pixels[rowStart - stride + byteIndex] : 0;
      const upLeft = y > 0 && byteIndex >= 4 ? pixels[rowStart - stride + byteIndex - 4] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upLeft);
      else assert(filter === 0, `unsupported PNG filter ${filter}`);
      pixels[rowStart + byteIndex] = value & 0xff;
    }
    sourceOffset += stride;
  }
  return { width, height, pixels };
}

function parseFrameRegion(path) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const regionIndex = lines.findIndex((line) => line.trim() === FRAME_NAME);
  assert(regionIndex >= 0, `missing atlas region ${FRAME_NAME}`);
  assert(lines[regionIndex + 1]?.trim() === 'rotate: false', `${FRAME_NAME} must not be rotated`);
  const xy = /^xy:\s*(\d+),\s*(\d+)$/.exec(lines[regionIndex + 2]?.trim() ?? '');
  const size = /^size:\s*(\d+),\s*(\d+)$/.exec(lines[regionIndex + 3]?.trim() ?? '');
  assert(xy && size, `invalid atlas geometry for ${FRAME_NAME}`);
  return {
    x: Number(xy[1]),
    y: Number(xy[2]),
    width: Number(size[1]),
    height: Number(size[2]),
  };
}

function cropFrame(image, frame) {
  assert(CROP.x + CROP.width <= frame.width, 'crop exceeds frame width');
  assert(CROP.y + CROP.height <= frame.height, 'crop exceeds frame height');
  assert(frame.x + frame.width <= image.width, 'atlas frame exceeds source width');
  assert(frame.y + frame.height <= image.height, 'atlas frame exceeds source height');

  const pixels = Buffer.alloc(CROP.width * CROP.height * BYTES_PER_PIXEL);
  for (let y = 0; y < CROP.height; y += 1) {
    for (let x = 0; x < CROP.width; x += 1) {
      const sourceOffset =
        ((frame.y + CROP.y + y) * image.width + frame.x + CROP.x + x) * BYTES_PER_PIXEL;
      const targetOffset = (y * CROP.width + x) * BYTES_PER_PIXEL;
      image.pixels.copy(pixels, targetOffset, sourceOffset, sourceOffset + BYTES_PER_PIXEL);
      if (pixels[targetOffset + 3] < ALPHA_THRESHOLD) pixels.fill(0, targetOffset, targetOffset + 4);
    }
  }
  return { width: CROP.width, height: CROP.height, pixels };
}

function bilinearPixel(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, x - x0));
  const ty = Math.max(0, Math.min(1, y - y0));
  const samples = [
    [x0, y0, (1 - tx) * (1 - ty)],
    [x1, y0, tx * (1 - ty)],
    [x0, y1, (1 - tx) * ty],
    [x1, y1, tx * ty],
  ];
  let alpha = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (const [sampleX, sampleY, weight] of samples) {
    const offset = (sampleY * image.width + sampleX) * BYTES_PER_PIXEL;
    const sampleAlpha = image.pixels[offset + 3] / 255;
    alpha += sampleAlpha * weight;
    red += image.pixels[offset] * sampleAlpha * weight;
    green += image.pixels[offset + 1] * sampleAlpha * weight;
    blue += image.pixels[offset + 2] * sampleAlpha * weight;
  }
  if (alpha * 255 < ALPHA_THRESHOLD) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round(alpha * 255),
  ];
}

function scaleCentered(image) {
  const scale = Math.min(OUTPUT_SIZE.width / image.width, OUTPUT_SIZE.height / image.height);
  const scaledWidth = Math.round(image.width * scale);
  const scaledHeight = Math.round(image.height * scale);
  const offsetX = Math.floor((OUTPUT_SIZE.width - scaledWidth) / 2);
  const offsetY = Math.floor((OUTPUT_SIZE.height - scaledHeight) / 2);
  const pixels = Buffer.alloc(OUTPUT_SIZE.width * OUTPUT_SIZE.height * BYTES_PER_PIXEL);

  for (let y = 0; y < scaledHeight; y += 1) {
    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = (x + 0.5) / scale - 0.5;
      const sourceY = (y + 0.5) / scale - 0.5;
      const targetOffset =
        ((offsetY + y) * OUTPUT_SIZE.width + offsetX + x) * BYTES_PER_PIXEL;
      const pixel = bilinearPixel(image, sourceX, sourceY);
      for (let channel = 0; channel < BYTES_PER_PIXEL; channel += 1) {
        pixels[targetOffset + channel] = pixel[channel];
      }
    }
  }
  return { ...OUTPUT_SIZE, pixels };
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
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = image.width * BYTES_PER_PIXEL;
  const scanlines = Buffer.alloc(image.height * (stride + 1));
  for (let y = 0; y < image.height; y += 1) {
    const targetOffset = y * (stride + 1);
    scanlines[targetOffset] = 0;
    image.pixels.copy(scanlines, targetOffset + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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
    'Usage: node tools/extract-qinglan-talisman.mjs <source.png> <atlas> <output.png>',
  );
  const [sourceArgument, atlasArgument, outputArgument] = args;
  const sourcePath = resolve(sourceArgument);
  const atlasPath = resolve(atlasArgument);
  const outputPath = resolve(outputArgument);
  const sourceStats = requireInputFile(sourcePath, 'source PNG');
  requireInputFile(atlasPath, 'atlas');
  assert(sourcePath !== outputPath, 'source PNG and output PNG must use different paths');
  const outputDirectory = dirname(outputPath);
  const outputDirectoryStats = statSync(outputDirectory);
  assert(outputDirectoryStats.isDirectory(), `output directory is not a directory: ${outputDirectory}`);
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
  const source = decodePngRgba(sourcePath);
  const frame = parseFrameRegion(atlasPath);
  const output = encodePngRgba(scaleCentered(cropFrame(source, frame)));
  const unchanged = existsSync(outputPath) && readFileSync(outputPath).equals(output);
  if (!unchanged) writeFileSync(outputPath, output);
  console.log(`extracted ${FRAME_NAME} talisman to ${outputPath} (${unchanged ? 'unchanged' : 'written'})`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = 1;
}
