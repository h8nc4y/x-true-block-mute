import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWLIST, buildPackage } from '../../scripts/build-package.mjs';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const allowlistSet = new Set(ALLOWLIST);
const forbiddenPatterns = [
  /^src\/research\//,
  /^src\/background\//,
  /^tests\//,
  /^docs\//,
  /^scripts\//,
  /\.md$/,
  /\.svg$/,
  /^\.git(?:\/|$)/,
  /^tmp\//,
  /^dist\//,
];

let checks = 0;
let failures = 0;

function check(condition, message) {
  checks += 1;

  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

function repoPathFor(relativePath) {
  return path.join(REPO_ROOT, ...relativePath.split('/'));
}

function normalizeRepoPath(reference, baseDir = '') {
  const withoutFragment = reference.split('#')[0];
  const withoutQuery = withoutFragment.split('?')[0];
  const normalizedReference = withoutQuery.replace(/\\/g, '/');

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedReference)) {
    return normalizedReference;
  }

  const joined = normalizedReference.startsWith('/')
    ? normalizedReference.slice(1)
    : path.posix.join(baseDir, normalizedReference);

  return path.posix.normalize(joined).replace(/^\.\//, '');
}

function collectIconReferences(value, references) {
  if (typeof value === 'string') {
    references.add(normalizeRepoPath(value));
    return;
  }

  if (value && typeof value === 'object') {
    for (const iconPath of Object.values(value)) {
      if (typeof iconPath === 'string') {
        references.add(normalizeRepoPath(iconPath));
      }
    }
  }
}

function collectManifestReferences(manifest) {
  const references = new Set();

  for (const contentScript of manifest.content_scripts ?? []) {
    for (const scriptPath of contentScript.js ?? []) {
      references.add(normalizeRepoPath(scriptPath));
    }

    for (const cssPath of contentScript.css ?? []) {
      references.add(normalizeRepoPath(cssPath));
    }
  }

  if (typeof manifest.action?.default_popup === 'string') {
    references.add(normalizeRepoPath(manifest.action.default_popup));
  }

  collectIconReferences(manifest.action?.default_icon, references);
  collectIconReferences(manifest.icons, references);

  if (typeof manifest.options_ui?.page === 'string') {
    references.add(normalizeRepoPath(manifest.options_ui.page));
  }

  return references;
}

function collectHtmlReferences(html, baseDir) {
  const references = new Set();
  const scriptPattern = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  const linkPattern = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    references.add(normalizeRepoPath(match[1], baseDir));
  }

  for (const match of html.matchAll(linkPattern)) {
    references.add(normalizeRepoPath(match[1], baseDir));
  }

  return references;
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(repoPathFor(relativePath), 'utf8'));
}

async function main() {
  const manifest = await readJson('manifest.json');
  const referencedFiles = collectManifestReferences(manifest);
  const popupHtml = await readFile(repoPathFor('src/popup/popup.html'), 'utf8');
  const optionsHtml = await readFile(repoPathFor('src/options/options.html'), 'utf8');

  for (const reference of collectHtmlReferences(popupHtml, 'src/popup')) {
    referencedFiles.add(reference);
  }

  for (const reference of collectHtmlReferences(optionsHtml, 'src/options')) {
    referencedFiles.add(reference);
  }

  for (const reference of referencedFiles) {
    check(allowlistSet.has(reference), `manifest/html reference is missing from ALLOWLIST: ${reference}`);
  }

  for (const allowlistedPath of ALLOWLIST) {
    const matchedPattern = forbiddenPatterns.find((pattern) => pattern.test(allowlistedPath));
    check(!matchedPattern, `ALLOWLIST must not include forbidden path: ${allowlistedPath}`);
  }

  for (const allowlistedPath of ALLOWLIST) {
    try {
      await access(repoPathFor(allowlistedPath));
      check(true, `ALLOWLIST file exists: ${allowlistedPath}`);
    } catch {
      check(false, `ALLOWLIST file does not exist: ${allowlistedPath}`);
    }
  }

  const result = await buildPackage();
  const zipBytes = await readFile(repoPathFor(result.zipPath));
  const localHeaderSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const endOfCentralDirectorySignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdOffset = zipBytes.lastIndexOf(endOfCentralDirectorySignature);

  check(zipBytes.subarray(0, 4).equals(localHeaderSignature), 'zip starts with local file header signature');
  check(eocdOffset >= 0, 'zip contains end-of-central-directory record');

  if (eocdOffset >= 0 && eocdOffset + 22 <= zipBytes.length) {
    const centralDirectoryRecords = zipBytes.readUInt16LE(eocdOffset + 10);
    check(
      centralDirectoryRecords === ALLOWLIST.length,
      `zip central directory record count is ${ALLOWLIST.length}`,
    );
  } else {
    check(false, 'zip end-of-central-directory record is complete');
  }

  check(result.entries === ALLOWLIST.length, `buildPackage returned ${ALLOWLIST.length} entries`);

  if (failures > 0) {
    console.error(`verify-package: FAIL (${failures}/${checks} checks failed)`);
    process.exit(1);
  }

  console.log(`verify-package: PASS (${checks} checks)`);
}

main().catch((error) => {
  console.error('verify-package: ERROR');
  console.error(error);
  process.exit(1);
});
