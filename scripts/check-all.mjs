import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const checks = [
  'verify-phase1-static',
  'verify-docs-consistency',
  'audit-operational-alignment',
  'verify-f1a-observation-safety',
  'verify-f1a-main-hook-simulator',
  'verify-sync-extraction',
  'verify-sync-hook',
  'verify-sync-bridge',
  'verify-storage-sync-schema',
  'verify-package',
];

function checkPath(name) {
  return path.join('tests', 'scripts', `${name}.mjs`);
}

function printUsage() {
  console.log('Usage: node scripts/check-all.mjs [--list]');
  console.log('Runs the static 10-check validation set in order. verify-package runs last and writes dist/.');
}

function runCheck(name, index) {
  return new Promise((resolve) => {
    const scriptPath = checkPath(name);
    const startedAt = Date.now();
    console.log(`\n[check-all] ${index + 1}/${checks.length} ${scriptPath}`);

    // 各検証は既存の終了保証付き Node script として分離し、失敗時はそこで停止する。
    const child = spawn(process.execPath, [scriptPath], {
      cwd: repoRoot,
      stdio: 'inherit',
      windowsHide: true,
    });

    let settled = false;
    child.on('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ name, scriptPath, ok: false, error, elapsedMs: Date.now() - startedAt });
    });

    child.on('close', (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ name, scriptPath, ok: code === 0, code, signal, elapsedMs: Date.now() - startedAt });
    });
  });
}

const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
  printUsage();
  process.exit(0);
}

if (args.length === 1 && args[0] === '--list') {
  for (const name of checks) {
    console.log(checkPath(name));
  }
  process.exit(0);
}

if (args.length > 0) {
  console.error(`[check-all] Unknown argument(s): ${args.join(' ')}`);
  printUsage();
  process.exit(2);
}

const startedAt = Date.now();
for (const [index, name] of checks.entries()) {
  const result = await runCheck(name, index);
  if (!result.ok) {
    if (result.error) {
      console.error(`[check-all] ERROR: ${result.scriptPath} could not start: ${result.error.message}`);
    } else {
      console.error(
        `[check-all] FAIL: ${result.scriptPath} exited with code ${result.code}` +
          `${result.signal ? ` signal ${result.signal}` : ''}`,
      );
    }
    console.error('[check-all] Stop after first failing check. No remaining checks were run.');
    process.exit(result.code ?? 1);
  }
  console.log(`[check-all] PASS: ${result.scriptPath} (${result.elapsedMs} ms)`);
}

console.log(`\n[check-all] PASS: ${checks.length} checks completed in ${Date.now() - startedAt} ms`);