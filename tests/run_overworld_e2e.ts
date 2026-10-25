/**
 * Root Automated Headless Test Runner: 2D Top-Down Overworld 8000x8000 Expansion
 * Delegates directly to deck-and-tackle/tests/run_overworld_e2e.ts.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const deckAndTackleDir = path.resolve(__dirname, '..', 'deck-and-tackle');
const runnerScript = path.resolve(deckAndTackleDir, 'tests', 'run_overworld_e2e.ts');

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'tests/run_overworld_e2e.ts'],
  {
    cwd: deckAndTackleDir,
    shell: true,
    stdio: 'inherit'
  }
);

child.on('close', (code) => {
  process.exit(code ?? 0);
});
