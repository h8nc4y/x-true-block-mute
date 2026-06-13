import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { deflateRaw as zlibDeflateRaw } from 'node:zlib';

export const ALLOWLIST = [
  'manifest.json',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'src/shared/constants.js',
  'src/storage/storage.js',
  'src/sync/sync-capture.js',
  'src/sync/sync-hook.js',
  'src/sync/sync-bridge.js',
  'src/content/content-script.js',
  'src/content/content-script.css',
  'src/popup/popup.html',
  'src/popup/popup.css',
  'src/popup/popup.js',
  'src/options/options.html',
  'src/options/options.css',
  'src/options/options.js',
];

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const VERSION_NEEDED = 20;
const DOS_TIME = 0;
const DOS_DATE = 0x0021;
const deflateRaw = promisify(zlibDeflateRaw);

const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function assertZip32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(`${label} does not fit in ZIP32: ${value}`);
  }
}

function filePathFor(entryName) {
  return path.join(REPO_ROOT, ...entryName.split('/'));
}

async function readManifestVersion() {
  const manifestPath = path.join(REPO_ROOT, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error('manifest.json must contain a non-empty version string');
  }

  return manifest.version;
}

async function makeZipBuffer() {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entryName of ALLOWLIST) {
    const nameBytes = Buffer.from(entryName, 'utf8');
    const fileBytes = await readFile(filePathFor(entryName));
    const compressed = await deflateRaw(fileBytes, { level: 9 });
    const checksum = crc32(fileBytes);
    const localOffset = offset;

    assertZip32(fileBytes.length, `${entryName} uncompressed size`);
    assertZip32(compressed.length, `${entryName} compressed size`);
    assertZip32(localOffset, `${entryName} local header offset`);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(DOS_TIME, 10);
    localHeader.writeUInt16LE(DOS_DATE, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(fileBytes.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBytes, compressed);
    offset += localHeader.length + nameBytes.length + compressed.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(VERSION_NEEDED, 4);
    centralHeader.writeUInt16LE(VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(DOS_TIME, 12);
    centralHeader.writeUInt16LE(DOS_DATE, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(fileBytes.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(centralHeader, nameBytes);
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;

  assertZip32(centralDirectory.length, 'central directory size');
  assertZip32(centralDirectoryOffset, 'central directory offset');

  if (ALLOWLIST.length > 0xffff) {
    throw new RangeError(`Too many ZIP entries: ${ALLOWLIST.length}`);
  }

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(ALLOWLIST.length, 8);
  endOfCentralDirectory.writeUInt16LE(ALLOWLIST.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

export async function buildPackage() {
  const version = await readManifestVersion();
  const zipName = `TrueBlock-Mute-v${version}.zip`;
  const zipPath = `dist/${zipName}`;
  const zipAbsolutePath = path.join(DIST_DIR, zipName);
  const zipBuffer = await makeZipBuffer();

  await mkdir(DIST_DIR, { recursive: true });
  await writeFile(zipAbsolutePath, zipBuffer);

  const { size } = await stat(zipAbsolutePath);

  return {
    zipPath,
    entries: ALLOWLIST.length,
    bytes: size,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await buildPackage();
  console.log(result);
}
