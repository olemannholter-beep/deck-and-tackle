/**
 * Root Adversarial Engine Stress Test Runner (Matching dispatch instructions)
 * Runs deck-and-tackle/tests/adversarial_engine_stress.test.ts using node:test and tsx.
 */

import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const deckAndTackleDir = path.resolve(__dirname, '..', 'deck-and-tackle');

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', '--test', 'tests/adversarial_engine_stress.test.ts'],
  {
    cwd: deckAndTackleDir,
    shell: true,
    stdio: 'inherit'
  }
);

child.on('close', (code) => {
  process.exit(code ?? 0);
});
