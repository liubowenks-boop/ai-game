import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const PREVIEW_PROFILE_PATH = join(
  homedir(),
  '.CocosCreator',
  'profiles',
  'v2',
  'packages',
  'preview.json',
);

const DEVICE_PROFILE_PATH = join(
  homedir(),
  '.CocosCreator',
  'profiles',
  'v2',
  'packages',
  'device.json',
);

const PORTRAIT_DEVICE = {
  name: 'Sandgate Portrait 720x1280',
  width: 720,
  height: 1280,
  ratio: 1,
};

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function configureProfiles() {
  const previewProfile = await readJson(PREVIEW_PROFILE_PATH, { __version__: '1.0.1' });
  previewProfile.__version__ = previewProfile.__version__ ?? '1.0.1';
  previewProfile.preview = {
    ...(previewProfile.preview ?? {}),
    rotate: false,
    device: 'WebpageFullScreen',
    showFps: false,
  };
  await writeJson(PREVIEW_PROFILE_PATH, previewProfile);

  const deviceProfile = await readJson(DEVICE_PROFILE_PATH, { __version__: '1.0.1' });
  deviceProfile.__version__ = deviceProfile.__version__ ?? '1.0.1';
  const custom = Array.isArray(deviceProfile.custom) ? deviceProfile.custom : [];
  const others = custom.filter((device) => device.name !== PORTRAIT_DEVICE.name);
  deviceProfile.custom = [PORTRAIT_DEVICE, ...others];
  deviceProfile.enableDevice = {
    ...(deviceProfile.enableDevice ?? {}),
    [PORTRAIT_DEVICE.name]: true,
  };
  await writeJson(DEVICE_PROFILE_PATH, deviceProfile);
}

async function socketIoEmit(eventName, ...args) {
  const baseUrl = 'http://127.0.0.1:7456/socket.io/';
  const query = new URLSearchParams({
    EIO: '4',
    transport: 'polling',
    t: String(Date.now()),
  });

  const handshakeResponse = await fetch(`${baseUrl}?${query}`);
  if (!handshakeResponse.ok) {
    throw new Error(`Socket.IO handshake failed: ${handshakeResponse.status}`);
  }

  const handshakeText = await handshakeResponse.text();
  const sidMatch = handshakeText.match(/"sid":"([^"]+)"/);
  if (!sidMatch) {
    throw new Error('Socket.IO session id not found.');
  }

  const packet = `42${JSON.stringify([eventName, ...args])}`;
  const payload = `${packet.length}:${packet}`;
  const postQuery = new URLSearchParams({
    EIO: '4',
    transport: 'polling',
    sid: sidMatch[1],
    t: String(Date.now() + 1),
  });

  const postResponse = await fetch(`${baseUrl}?${postQuery}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    body: payload,
  });
  if (!postResponse.ok) {
    throw new Error(`Socket.IO emit failed: ${postResponse.status}`);
  }
}

async function configureRunningPreview() {
  try {
    await socketIoEmit('changeOption', 'rotate', false);
    await socketIoEmit('changeOption', 'device', 'WebpageFullScreen');
    return true;
  } catch {
    return false;
  }
}

await configureProfiles();
const updatedRunningPreview = await configureRunningPreview();

console.log('Cocos preview default set to WebpageFullScreen with rotate=false.');
console.log(`Custom device available: ${PORTRAIT_DEVICE.name}.`);
if (!updatedRunningPreview) {
  console.log('No running Cocos preview service detected on 127.0.0.1:7456.');
}
