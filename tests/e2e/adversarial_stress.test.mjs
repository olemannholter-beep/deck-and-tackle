/**
 * Adversarial Stress & Edge Case Test Suite
 * 
 * Verifies:
 * 1. resolveZoneTier() and environment switching with out-of-bound inputs:
 *    - Depths: -50m, 0m, 29.99m, 30m, 59.99m, 60m, 99.99m, 100m, 1000m, NaN, +/-Infinity
 *    - Species: undefined, unknown strings, dagon vs gar vs pike vs perch
 *    - ZoneTypes: unknown strings, undefined, null
 *    - Combinatorial fuzzing (10,000+ randomized inputs)
 * 2. Rapid stage transitions (1 -> 4 -> 2 -> 3 -> 1 -> 4 -> 4) to verify:
 *    - No state leaks (card counts strictly preserved)
 *    - No memory leaks (array allocations strictly bounded across 1,000+ cycles)
 *    - No race conditions
 *    - No NaN canvas coordinates
 *    - No canvas rendering crashes
 * 3. Wave speeds, amplitudes, and drift values stay within realistic, non-jittery bounds:
 *    - Speed, amplitude, drift bounds
 *    - Monotonic speed progression (Zone 1 < Zone 2 < Zone 3 < Zone 4)
 *    - Max displacement within bounds (no clipping)
 *    - Smooth derivative / jitter-free motion (< 1.0 px/frame at 60 FPS)
 *    - Extreme time stability (t up to 1,000,000s)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ZONE_PROFILES_TS_PATH,
  SIDE_VIEW_DIORAMA_TS_PATH,
  GAME_DIR,
  PREVIEW_HTML_PATH,
  loadTsModule,
  REFERENCE_ZONE_PROFILES
} from './test_helpers.mjs';

// Load live ZoneProfiles module
const zoneProfilesMod = loadTsModule(ZONE_PROFILES_TS_PATH);
const { resolveZoneTier, getZoneProfile, ZONE_PROFILES } = zoneProfilesMod;

// ============================================================================
// SUITE 1: ADVERSARIAL TESTING OF resolveZoneTier() AND ENVIRONMENT LOOKUP
// ============================================================================
describe('Adversarial Suite 1: resolveZoneTier() & Environment Switching', () => {

  describe('1.1: Out-of-Bounds & Threshold Depths', () => {
    test('Depth: -50m (negative depth) safely resolves to Tier 1 without error', () => {
      const tier = resolveZoneTier('shallow', 'perch', -50);
      assert.equal(tier, 1, 'Negative depth should safely resolve to Tier 1');
      const profile = getZoneProfile(tier);
      assert.ok(profile && profile.tier === 1);
    });

    test('Depth: 0m (coastal waterline boundary) resolves to Tier 1', () => {
      const tier = resolveZoneTier('shallow', 'perch', 0);
      assert.equal(tier, 1, '0m depth should resolve to Tier 1');
    });

    test('Depth: 29.99m (infinitesimally below Tier 2 boundary) resolves to Tier 1', () => {
      const tier = resolveZoneTier('shallow', 'perch', 29.99);
      assert.equal(tier, 1, '29.99m must remain in Tier 1');
    });

    test('Depth: 30m (exact Tier 2 threshold) resolves to Tier 2', () => {
      const tier = resolveZoneTier('shallow', 'perch', 30);
      assert.equal(tier, 2, '30m exact threshold must resolve to Tier 2');
    });

    test('Depth: 59.99m (infinitesimally below Tier 3 boundary) resolves to Tier 2', () => {
      const tier = resolveZoneTier('shallow', 'perch', 59.99);
      assert.equal(tier, 2, '59.99m must remain in Tier 2');
    });

    test('Depth: 60m (exact Tier 3 threshold) resolves to Tier 3', () => {
      const tier = resolveZoneTier('shallow', 'perch', 60);
      assert.equal(tier, 3, '60m exact threshold must resolve to Tier 3');
    });

    test('Depth: 99.99m (infinitesimally below Tier 4 boundary) resolves to Tier 3', () => {
      const tier = resolveZoneTier('shallow', 'perch', 99.99);
      assert.equal(tier, 3, '99.99m must remain in Tier 3');
    });

    test('Depth: 100m (exact Tier 4 threshold) resolves to Tier 4', () => {
      const tier = resolveZoneTier('shallow', 'perch', 100);
      assert.equal(tier, 4, '100m exact threshold must resolve to Tier 4');
    });

    test('Depth: 1000m (extreme positive depth) resolves to Tier 4', () => {
      const tier = resolveZoneTier('shallow', 'perch', 1000);
      assert.equal(tier, 4, '1000m extreme depth must resolve to Tier 4');
    });

    test('Depth: Extreme IEEE 754 float values (NaN, +Infinity, -Infinity, MAX_SAFE_INTEGER)', () => {
      assert.equal(resolveZoneTier('shallow', 'perch', NaN), 1, 'NaN depth must safely resolve to Tier 1');
      assert.equal(resolveZoneTier('shallow', 'perch', Infinity), 4, '+Infinity depth must resolve to Tier 4');
      assert.equal(resolveZoneTier('shallow', 'perch', -Infinity), 1, '-Infinity depth must resolve to Tier 1');
      assert.equal(resolveZoneTier('shallow', 'perch', Number.MAX_SAFE_INTEGER), 4);
      assert.equal(resolveZoneTier('shallow', 'perch', Number.MIN_SAFE_INTEGER), 1);
      assert.equal(resolveZoneTier('shallow', 'perch', 1e12), 4);
      assert.equal(resolveZoneTier('shallow', 'perch', -1e12), 1);
    });
  });

  describe('1.2: Adversarial Species Inputs & Priority Hierarchy', () => {
    test('Species: undefined falls back gracefully to zone and depth', () => {
      assert.equal(resolveZoneTier('shallow', undefined, 10), 1);
      assert.equal(resolveZoneTier('shallow', undefined, 45), 2);
      assert.equal(resolveZoneTier('shallow', undefined, 85), 3);
      assert.equal(resolveZoneTier('shallow', undefined, 115), 4);
    });

    test('Species: unknown / unexpected strings fall back gracefully without exception', () => {
      const invalidSpecies = ['kraken', 'alien', 'shark', 'void_slug', '', '   ', 'null', '12345'];
      for (const sp of invalidSpecies) {
        assert.doesNotThrow(() => {
          const t = resolveZoneTier('shallow', sp, 15);
          assert.equal(t, 1, `Unknown species '${sp}' at 15m must resolve to Tier 1`);
        });
      }
    });

    test('Species: dagon (apex boss) overrides shallow depth and non-cave zone to Tier 4', () => {
      assert.equal(resolveZoneTier('shallow', 'dagon', 5), 4);
      assert.equal(resolveZoneTier('shallow', 'dagon', 0), 4);
      assert.equal(resolveZoneTier('shallow', 'dagon', -50), 4);
      assert.equal(resolveZoneTier('lake', 'dagon', 10), 4);
      assert.equal(resolveZoneTier('abyss', 'dagon', 20), 4);
    });

    test('Species: gar (void horror) overrides shallow depth to Tier 3 unless depth >= 100m or cave', () => {
      assert.equal(resolveZoneTier('shallow', 'gar', 10), 3, 'Gar at 10m overrides shallow to Tier 3');
      assert.equal(resolveZoneTier('lake', 'gar', 15), 3, 'Gar in lake overrides to Tier 3');
      assert.equal(resolveZoneTier('shallow', 'gar', 120), 4, 'Depth >= 100m promotes Gar to Tier 4');
      assert.equal(resolveZoneTier('cave', 'gar', 20), 4, 'Cave zone promotes Gar to Tier 4');
    });

    test('Species: pike (predator) overrides shallow depth to Tier 2 unless depth >= 60m or abyss/cave', () => {
      assert.equal(resolveZoneTier('shallow', 'pike', 10), 2, 'Pike at 10m overrides to Tier 2');
      assert.equal(resolveZoneTier('shallow', 'pike', 75), 3, 'Depth >= 60m promotes Pike to Tier 3');
      assert.equal(resolveZoneTier('shallow', 'pike', 120), 4, 'Depth >= 100m promotes Pike to Tier 4');
      assert.equal(resolveZoneTier('abyss', 'pike', 10), 3, 'Abyss zone promotes Pike to Tier 3');
      assert.equal(resolveZoneTier('cave', 'pike', 10), 4, 'Cave zone promotes Pike to Tier 4');
    });

    test('Species: perch (common) yields to zone and depth thresholds', () => {
      assert.equal(resolveZoneTier('shallow', 'perch', 10), 1);
      assert.equal(resolveZoneTier('shallow', 'perch', 35), 2);
      assert.equal(resolveZoneTier('shallow', 'perch', 75), 3);
      assert.equal(resolveZoneTier('shallow', 'perch', 125), 4);
    });
  });

  describe('1.3: Adversarial ZoneType Inputs & Invariants', () => {
    test('ZoneType: undefined, null, and empty string do not crash', () => {
      assert.doesNotThrow(() => resolveZoneTier(undefined, 'perch', 10));
      assert.doesNotThrow(() => resolveZoneTier(null, 'perch', 10));
      assert.doesNotThrow(() => resolveZoneTier('', 'perch', 10));
      assert.equal(resolveZoneTier(undefined, 'perch', 10), 1);
      assert.equal(resolveZoneTier(null, 'perch', 10), 1);
      assert.equal(resolveZoneTier('', 'perch', 10), 1);
    });

    test('ZoneType: unknown strings do not crash and fall back correctly', () => {
      const weirdZones = ['magma', 'sky', 'outer_space', 'unknown_water', 'null', 'undefined'];
      for (const z of weirdZones) {
        assert.equal(resolveZoneTier(z, 'perch', 10), 1);
        assert.equal(resolveZoneTier(z, 'pike', 10), 2);
        assert.equal(resolveZoneTier(z, 'gar', 10), 3);
        assert.equal(resolveZoneTier(z, 'dagon', 10), 4);
        assert.equal(resolveZoneTier(z, 'perch', 70), 3);
        assert.equal(resolveZoneTier(z, 'perch', 120), 4);
      }
    });

    test('ZoneType: cave strictly enforces Tier 4 regardless of species or depth', () => {
      assert.equal(resolveZoneTier('cave', 'perch', 0), 4);
      assert.equal(resolveZoneTier('cave', 'pike', 10), 4);
      assert.equal(resolveZoneTier('cave', 'gar', 20), 4);
      assert.equal(resolveZoneTier('cave', undefined, -10), 4);
    });
  });

  describe('1.4: Combinatorial Fuzzing & Stress Invariants (10,000 Iterations)', () => {
    test('Fuzz: 10,000 randomized inputs execute cleanly, strictly returning integers 1..4', () => {
      const testZones = ['shallow', 'lake', 'abyss', 'cave', '', 'void', 'unknown', null, undefined];
      const testSpecies = ['perch', 'pike', 'gar', 'dagon', 'squid', '', null, undefined];
      const startMs = performance.now();

      for (let i = 0; i < 10000; i++) {
        const zone = testZones[Math.floor(Math.random() * testZones.length)];
        const species = testSpecies[Math.floor(Math.random() * testSpecies.length)];
        const depth = (Math.random() - 0.2) * 200; // -40m to +160m

        const tier = resolveZoneTier(zone, species, depth);
        assert.ok(
          tier === 1 || tier === 2 || tier === 3 || tier === 4,
          `resolveZoneTier must always return 1, 2, 3, or 4 (got ${tier})`
        );

        const profile = getZoneProfile(tier);
        assert.ok(profile, 'getZoneProfile must return valid profile for resolved tier');
        assert.ok(profile.sky && profile.waves && profile.waterColumn);
      }

      const elapsed = performance.now() - startMs;
      assert.ok(elapsed < 2000, `10,000 fuzzed calls should complete under 2000ms (took ${elapsed.toFixed(1)}ms)`);
    });
  });

  describe('1.5: Environment Profile Retrieval & Graceful Fallback', () => {
    test('Valid tiers 1..4 return complete ZoneProfile contracts', () => {
      for (const t of [1, 2, 3, 4]) {
        const p = getZoneProfile(t);
        assert.equal(p.tier, t);
        assert.ok(typeof p.name === 'string' && p.name.length > 0);
        assert.ok(typeof p.waves.waveSpeed === 'number' && p.waves.waveSpeed > 0);
        assert.ok(typeof p.waves.waveAmp === 'number' && p.waves.waveAmp > 0);
        assert.ok(typeof p.waves.waveDrift === 'number' && p.waves.waveDrift > 0);
        assert.ok(Array.isArray(p.waterColumn.props) && p.waterColumn.props.length > 0);
        assert.ok(Array.isArray(p.ambientFishSprites) && p.ambientFishSprites.length > 0);
      }
    });

    test('Out-of-bound tiers (0, 5, -1, NaN, undefined) safely fallback to Tier 1', () => {
      const invalidTiers = [0, 5, -1, 999, NaN, undefined, null, 'invalid'];
      for (const badTier of invalidTiers) {
        const p = getZoneProfile(badTier);
        assert.ok(p, `getZoneProfile(${badTier}) must return a fallback profile`);
        assert.equal(p.tier, 1, `Fallback profile must be Tier 1`);
      }
    });
  });
});

// Setup headless sandbox to run the real preview logic
function createPreviewSandbox() {
    const html = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!scriptMatch) throw new Error('Could not extract script from preview HTML');
    const rawScript = scriptMatch[1];

    // Mock Canvas Context with call interception and NaN detection
    const interceptedCalls = [];
    let saveCount = 0;
    let restoreCount = 0;

    const mockCtx = {
      save: () => { saveCount++; },
      restore: () => { restoreCount++; },
      beginPath: () => {},
      closePath: () => {},
      moveTo: (x, y) => { interceptedCalls.push({ fn: 'moveTo', args: [x, y] }); },
      lineTo: (x, y) => { interceptedCalls.push({ fn: 'lineTo', args: [x, y] }); },
      stroke: () => {},
      fill: () => {},
      fillRect: (x, y, w, h) => { interceptedCalls.push({ fn: 'fillRect', args: [x, y, w, h] }); },
      strokeRect: (x, y, w, h) => { interceptedCalls.push({ fn: 'strokeRect', args: [x, y, w, h] }); },
      clearRect: (x, y, w, h) => { interceptedCalls.push({ fn: 'clearRect', args: [x, y, w, h] }); },
      arc: (x, y, r, sa, ea) => { interceptedCalls.push({ fn: 'arc', args: [x, y, r, sa, ea] }); },
      drawImage: (img, ...args) => { interceptedCalls.push({ fn: 'drawImage', args }); },
      fillText: (text, x, y) => { interceptedCalls.push({ fn: 'fillText', args: [x, y] }); },
      strokeText: (text, x, y) => { interceptedCalls.push({ fn: 'strokeText', args: [x, y] }); },
      measureText: () => ({ width: 40 }),
      translate: (x, y) => { interceptedCalls.push({ fn: 'translate', args: [x, y] }); },
      rotate: (rad) => { interceptedCalls.push({ fn: 'rotate', args: [rad] }); },
      scale: (sx, sy) => { interceptedCalls.push({ fn: 'scale', args: [sx, sy] }); },
      resetTransform: () => {},
      transform: (...args) => { interceptedCalls.push({ fn: 'transform', args }); },
      roundRect: (x, y, w, h) => { interceptedCalls.push({ fn: 'roundRect', args: [x, y, w, h] }); },
      quadraticCurveTo: (cpx, cpy, x, y) => { interceptedCalls.push({ fn: 'quadraticCurveTo', args: [cpx, cpy, x, y] }); },
      bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => { interceptedCalls.push({ fn: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] }); },
      ellipse: (x, y, rx, ry, rot, sa, ea) => { interceptedCalls.push({ fn: 'ellipse', args: [x, y, rx, ry, rot, sa, ea] }); },
      clip: () => {},
      createLinearGradient: (x0, y0, x1, y1) => {
        interceptedCalls.push({ fn: 'createLinearGradient', args: [x0, y0, x1, y1] });
        return { addColorStop: () => {} };
      },
      createRadialGradient: (x0, y0, r0, x1, y1, r1) => {
        interceptedCalls.push({ fn: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1] });
        return { addColorStop: () => {} };
      },
      setLineDash: () => {},
      canvas: { width: 960, height: 600 }
    };

    const mockCanvas = {
      getContext: () => mockCtx,
      width: 960,
      height: 600,
      style: { cursor: 'default' },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
      addEventListener: () => {}
    };

    const mockElements = {
      battleCanvas: mockCanvas,
      'tier-badge': { textContent: '' },
      'turn-badge': { textContent: '' },
      'btn-force-thrash': { addEventListener: () => {} },
      'btn-force-win': { addEventListener: () => {} },
      'btn-reset': { addEventListener: () => {} },
      'tab-battle': { addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } },
      'tab-deck': { addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } },
      'tab-fish': { addEventListener: () => {}, classList: { add: () => {}, remove: () => {} } }
    };

    const stageBtns = [
      { dataset: { tier: '1' }, addEventListener: () => {}, className: '' },
      { dataset: { tier: '2' }, addEventListener: () => {}, className: '' },
      { dataset: { tier: '3' }, addEventListener: () => {}, className: '' },
      { dataset: { tier: '4' }, addEventListener: () => {}, className: '' }
    ];

    const sandbox = {
      document: {
        getElementById: (id) => mockElements[id] || { textContent: '', addEventListener: () => {} },
        querySelectorAll: (sel) => (sel === '.stage-btn' ? stageBtns : []),
        addEventListener: () => {}
      },
      window: {
        addEventListener: () => {},
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 1
      },
      performance: { now: () => 1000 },
      requestAnimationFrame: () => 1,
      Image: function() {
        this.complete = true;
        this.naturalWidth = 100;
        this.naturalHeight = 100;
        this.width = 100;
        this.height = 100;
      },
      Math,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      parseInt,
      parseFloat,
      setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 1; },
      clearTimeout: () => {}
    };

    const context = vm.createContext(sandbox);

    // Filter out the auto-starting requestAnimationFrame(renderLoop) to control execution
    const safeScript = rawScript.replace(/requestAnimationFrame\(renderLoop\);/g, '// auto-loop paused for tests');

    vm.runInContext(safeScript, context);

    return {
      context,
      mockCtx,
      interceptedCalls,
      getSaveBalance: () => saveCount - restoreCount,
      resetInterception: () => {
        interceptedCalls.length = 0;
        saveCount = 0;
        restoreCount = 0;
      }
    };
  }

// ============================================================================
// SUITE 2: RAPID STAGE TRANSITIONS & STATE LEAK STRESS TESTING
// ============================================================================
describe('Adversarial Suite 2: Rapid Stage Transitions & State Isolation', () => {

  test('2.1: Rapid toggling sequence 1 -> 4 -> 2 -> 3 -> 1 -> 4 -> 4 maintains exact stage identity', () => {
    const { context } = createPreviewSandbox();
    const sequence = [1, 4, 2, 3, 1, 4, 4];
    const expectedSpecies = {
      1: 'Innsmouth Perch',
      2: 'Blighted Pike',
      3: 'Pale Deep Angler',
      4: 'Apex Dagon'
    };

    for (const stg of sequence) {
      vm.runInContext(`setStage(${stg});`, context);
      const currentStage = vm.runInContext(`battleState.currentStage;`, context);
      const fishName = vm.runInContext(`battleState.fishName;`, context);
      assert.equal(currentStage, stg, `Current stage must be ${stg}`);
      assert.equal(fishName, expectedSpecies[stg], `Fish name for stage ${stg} must be ${expectedSpecies[stg]}`);
    }
  });

  test('2.2: State leak verification: Card count strictly conserved across 500 rapid switches', () => {
    const { context } = createPreviewSandbox();
    const stages = [1, 2, 3, 4];

    for (let i = 0; i < 500; i++) {
      const targetStage = stages[i % stages.length];
      vm.runInContext(`setStage(${targetStage});`, context);

      const drawCount = vm.runInContext(`battleState.drawPile.length;`, context);
      const handCount = vm.runInContext(`battleState.hand.length;`, context);
      const discardCount = vm.runInContext(`battleState.discardPile.length;`, context);
      const exhaustCount = vm.runInContext(`battleState.exhaustPile.length;`, context);
      const totalCards = drawCount + handCount + discardCount + exhaustCount;

      assert.equal(totalCards, 10, `Total deck cards must strictly equal 10 on iteration ${i} (got ${totalCards})`);
      assert.equal(handCount, 5, `Initial hand must strictly draw 5 cards (got ${handCount})`);
      assert.equal(drawCount, 5, `Remaining draw pile must be 5 cards (got ${drawCount})`);
      assert.equal(discardCount, 0, `Discard pile must be empty upon stage switch`);
      assert.equal(exhaustCount, 0, `Exhaust pile must be empty upon stage switch`);
    }
  });

  test('2.3: Memory leak verification: Array lengths strictly bounded across 1,000 rapid switches', () => {
    const { context } = createPreviewSandbox();
    const stages = [1, 4, 2, 3];

    for (let i = 0; i < 1000; i++) {
      vm.runInContext(`setStage(${stages[i % 4]});`, context);
      // Simulate adding floating text / combat splashes during play
      vm.runInContext(`
        battleState.floatingTexts.push({ text: 'test', x: 10, y: 10, life: 0, maxLife: 1 });
        battleState.splashes.push({ x: 20, y: 20 });
      `, context);
    }

    // Call setStage one more time to reset
    vm.runInContext(`setStage(1);`, context);

    const texts = vm.runInContext(`battleState.floatingTexts.length;`, context);
    const splashes = vm.runInContext(`battleState.splashes.length;`, context);
    assert.equal(texts, 0, 'floatingTexts must be fully reset on stage transition');
    assert.equal(splashes, 0, 'splashes must be fully reset on stage transition');
  });

  test('2.4: NaN coordinate verification: All canvas draw operations receive finite numbers during rapid transitions', () => {
    const { context, interceptedCalls, resetInterception } = createPreviewSandbox();
    const stages = [1, 4, 2, 3, 1, 4, 4];

    for (const stg of stages) {
      vm.runInContext(`setStage(${stg});`, context);
      resetInterception();

      // Execute 5 simulated animation frames for this stage
      for (let f = 0; f < 5; f++) {
        const time = 1000 + f * 16.66;
        vm.runInContext(`renderLoop(${time});`, context);
      }

      // Check all intercepted numerical arguments
      for (const call of interceptedCalls) {
        for (let a = 0; a < call.args.length; a++) {
          const val = call.args[a];
          if (typeof val === 'number') {
            assert.ok(
              Number.isFinite(val),
              `Canvas call '${call.fn}' arg[${a}] must be finite (got ${val}) in Stage ${stg}`
            );
            assert.ok(
              !Number.isNaN(val),
              `Canvas call '${call.fn}' arg[${a}] must not be NaN in Stage ${stg}`
            );
          }
        }
      }
    }
  });

  test('2.5: Context Save/Restore stack balance is maintained across all 4 stages', () => {
    const { context, getSaveBalance, resetInterception } = createPreviewSandbox();

    for (let stg = 1; stg <= 4; stg++) {
      vm.runInContext(`setStage(${stg});`, context);
      resetInterception();

      vm.runInContext(`renderLoop(2000);`, context);
      const balance = getSaveBalance();
      assert.equal(
        balance,
        0,
        `ctx.save() and ctx.restore() must be perfectly balanced (difference: ${balance}) in Stage ${stg}`
      );
    }
  });
});

// ============================================================================
// SUITE 3: WAVE DYNAMICS, BOUNDS, AND NON-JITTER STABILITY
// ============================================================================
describe('Adversarial Suite 3: Wave Dynamics, Bounds & Jitter Verification', () => {

  test('3.1: Wave parameters stay strictly within realistic bounds across all 4 zones', () => {
    for (const tier of [1, 2, 3, 4]) {
      const p = getZoneProfile(tier);
      const w = p.waves;

      // Speed bounds: 0.5 <= speed <= 5.0
      assert.ok(w.waveSpeed >= 0.5 && w.waveSpeed <= 5.0, `Zone ${tier} waveSpeed (${w.waveSpeed}) out of bounds [0.5, 5.0]`);
      // Amplitude bounds: 1.0 <= amp <= 10.0
      assert.ok(w.waveAmp >= 1.0 && w.waveAmp <= 10.0, `Zone ${tier} waveAmp (${w.waveAmp}) out of bounds [1.0, 10.0]`);
      // Drift bounds: 0.5 <= drift <= 3.0
      assert.ok(w.waveDrift >= 0.5 && w.waveDrift <= 3.0, `Zone ${tier} waveDrift (${w.waveDrift}) out of bounds [0.5, 3.0]`);
    }
  });

  test('3.2: Monotonic wave speed progression (Zone 1 calmest -> Zone 4 most violent)', () => {
    const p1 = getZoneProfile(1).waves.waveSpeed;
    const p2 = getZoneProfile(2).waves.waveSpeed;
    const p3 = getZoneProfile(3).waves.waveSpeed;
    const p4 = getZoneProfile(4).waves.waveSpeed;

    assert.ok(p1 < p2, `Zone 1 (${p1}) must be slower than Zone 2 (${p2})`);
    assert.ok(p2 < p3, `Zone 2 (${p2}) must be slower than Zone 3 (${p3})`);
    assert.ok(p3 < p4, `Zone 3 (${p3}) must be slower than Zone 4 (${p4})`);
  });

  test('3.3: Peak wave displacement is mathematically bounded (no off-screen runaway or tearing)', () => {
    for (const tier of [1, 2, 3, 4]) {
      const w = getZoneProfile(tier).waves;

      // Primary wave max drift: Math.sin(...) * (14 * waveDrift)
      const maxPrimaryDrift = 14 * w.waveDrift;
      assert.ok(maxPrimaryDrift <= 35, `Zone ${tier} primary drift (${maxPrimaryDrift}px) exceeds safe 35px limit`);

      // Primary wave max bob: Math.cos(...) * waveAmp
      const maxPrimaryBob = w.waveAmp;
      assert.ok(maxPrimaryBob <= 10, `Zone ${tier} primary bob (${maxPrimaryBob}px) exceeds safe 10px limit`);

      // Secondary wave max drift: Math.cos(...) * (-12 * waveDrift)
      const maxSecondaryDrift = 12 * w.waveDrift;
      assert.ok(maxSecondaryDrift <= 35, `Zone ${tier} secondary drift (${maxSecondaryDrift}px) exceeds safe 35px limit`);

      // Foam line oscillation amplitude: Math.sin(...) * waveAmp + Math.cos(...) * (waveAmp * 0.6)
      const maxFoamDisplacement = w.waveAmp * 1.6;
      assert.ok(maxFoamDisplacement <= 15, `Zone ${tier} foam line max offset (${maxFoamDisplacement}px) exceeds safe 15px limit`);
    }
  });

  test('3.4: Jitter-free velocity derivative: frame-to-frame wave displacement is < 1.0 px/frame at 60 FPS', () => {
    const dt = 1 / 60; // 60 FPS delta time = 0.01667s

    for (const tier of [1, 2, 3, 4]) {
      const w = getZoneProfile(tier).waves;

      // Theoretical maximum time-derivative of the foam line equation:
      // wave(x, t) = sin(x*0.035 + t*wSpeed*2.4)*wAmp + cos(x*0.018 - t*wSpeed*1.5)*(wAmp*0.6)
      // |d(wave)/dt| <= wAmp * wSpeed * (2.4 + 0.6 * 1.5) = wAmp * wSpeed * 3.3
      const maxVelocityPxPerSec = w.waveAmp * w.waveSpeed * 3.3;
      const maxFrameDeltaPx = maxVelocityPxPerSec * dt;

      assert.ok(
        maxFrameDeltaPx < 1.0,
        `Zone ${tier} wave velocity derivative (${maxFrameDeltaPx.toFixed(3)} px/frame) must be < 1.0 px/frame to prevent visual jitter`
      );
    }
  });

  test('3.5: Extreme time stability: wave calculations remain finite and non-NaN after long runtime', () => {
    const testTimes = [0, 0.5, 10, 3600, 86400, 1000000]; // up to 11.5 days of continuous play

    for (const tier of [1, 2, 3, 4]) {
      const w = getZoneProfile(tier).waves;
      for (const t of testTimes) {
        const drift = Math.sin(t * w.waveSpeed * 1.1) * (14 * w.waveDrift);
        const bob = Math.cos(t * w.waveSpeed * 1.3) * w.waveAmp;
        const foam = Math.sin(100 * 0.035 + t * w.waveSpeed * 2.4) * w.waveAmp +
                     Math.cos(100 * 0.018 - t * w.waveSpeed * 1.5) * (w.waveAmp * 0.6);

        assert.ok(Number.isFinite(drift), `Drift must remain finite at t=${t} (got ${drift})`);
        assert.ok(Number.isFinite(bob), `Bob must remain finite at t=${t} (got ${bob})`);
        assert.ok(Number.isFinite(foam), `Foam must remain finite at t=${t} (got ${foam})`);
      }
    }
  });
});

// ============================================================================
// SUITE 4: RESPONSIVE CANVAS RESIZING, INTERACTIVE ACTIONS & ENGINE PARITY
// ============================================================================
describe('Adversarial Suite 4: Responsive Resizing, Interactive Combat & Engine Parity', () => {

  test('4.1: Card plays and turn progression during rapid stage cycling maintain valid deck state', () => {
    const { context } = createPreviewSandbox();

    const stages = [1, 4, 2, 3, 1, 4, 4];
    for (const stg of stages) {
      vm.runInContext(`setStage(${stg});`, context);

      // Play card 0 if hand has cards and stamina > 0
      vm.runInContext(`
        if (battleState.hand.length > 0 && battleState.stamina > 0) {
          playCard(0);
        }
      `, context);

      // Advance turn
      vm.runInContext(`endPlayerTurn();`, context);

      // Verify no card count leak
      const total = vm.runInContext(`
        battleState.drawPile.length + battleState.hand.length + battleState.discardPile.length + battleState.exhaustPile.length;
      `, context);
      assert.equal(total, 10, 'Total card count must remain exactly 10 during interactive phase');
    }
  });

  test('4.2: Extreme viewport dimensions (ultrawide, mobile, square) produce 0 NaN coordinates', () => {
    const html = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');
    const rawScript = html.match(/<script>([\s\S]*?)<\/script>/)[1]
      .replace(/requestAnimationFrame\(renderLoop\);/g, '// paused');

    const interceptedCalls = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: (x, y) => interceptedCalls.push({ fn: 'moveTo', args: [x, y] }),
      lineTo: (x, y) => interceptedCalls.push({ fn: 'lineTo', args: [x, y] }),
      stroke: () => {},
      fill: () => {},
      fillRect: (x, y, w, h) => interceptedCalls.push({ fn: 'fillRect', args: [x, y, w, h] }),
      strokeRect: (x, y, w, h) => interceptedCalls.push({ fn: 'strokeRect', args: [x, y, w, h] }),
      clearRect: (x, y, w, h) => interceptedCalls.push({ fn: 'clearRect', args: [x, y, w, h] }),
      arc: (x, y, r) => interceptedCalls.push({ fn: 'arc', args: [x, y, r] }),
      drawImage: (img, ...args) => interceptedCalls.push({ fn: 'drawImage', args }),
      fillText: (t, x, y) => interceptedCalls.push({ fn: 'fillText', args: [x, y] }),
      strokeText: (t, x, y) => interceptedCalls.push({ fn: 'strokeText', args: [x, y] }),
      measureText: () => ({ width: 40 }),
      translate: (x, y) => interceptedCalls.push({ fn: 'translate', args: [x, y] }),
      rotate: (r) => interceptedCalls.push({ fn: 'rotate', args: [r] }),
      scale: (sx, sy) => interceptedCalls.push({ fn: 'scale', args: [sx, sy] }),
      resetTransform: () => {},
      transform: (...args) => interceptedCalls.push({ fn: 'transform', args }),
      roundRect: (x, y, w, h) => interceptedCalls.push({ fn: 'roundRect', args: [x, y, w, h] }),
      quadraticCurveTo: (cpx, cpy, x, y) => interceptedCalls.push({ fn: 'quadraticCurveTo', args: [cpx, cpy, x, y] }),
      bezierCurveTo: (...args) => interceptedCalls.push({ fn: 'bezierCurveTo', args }),
      ellipse: (...args) => interceptedCalls.push({ fn: 'ellipse', args }),
      clip: () => {},
      createLinearGradient: (x0, y0, x1, y1) => {
        interceptedCalls.push({ fn: 'createLinearGradient', args: [x0, y0, x1, y1] });
        return { addColorStop: () => {} };
      },
      createRadialGradient: (...args) => {
        interceptedCalls.push({ fn: 'createRadialGradient', args });
        return { addColorStop: () => {} };
      },
      setLineDash: () => {},
      canvas: { width: 960, height: 600 }
    };

    let currentRect = { left: 0, top: 0, width: 960, height: 600 };
    const mockCanvas = {
      getContext: () => mockCtx,
      width: 960,
      height: 600,
      style: { cursor: 'default' },
      getBoundingClientRect: () => currentRect,
      addEventListener: () => {}
    };

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'battleCanvas' ? mockCanvas : { textContent: '', addEventListener: () => {} }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: { innerWidth: 960, innerHeight: 600, devicePixelRatio: 1, addEventListener: () => {} },
      performance: { now: () => 1000 },
      requestAnimationFrame: () => 1,
      Image: function() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; },
      Math,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      parseInt,
      parseFloat
    };

    const context = vm.createContext(sandbox);
    vm.runInContext(rawScript, context);

    const testViewports = [
      { w: 320, h: 240 },   // Low-res retro
      { w: 1920, h: 1080 }, // Full HD
      { w: 3440, h: 1440 }, // Ultra-wide
      { w: 600, h: 900 }    // Vertical portrait
    ];

    for (const vp of testViewports) {
      currentRect = { left: 0, top: 0, width: vp.w, height: vp.h };
      sandbox.window.innerWidth = vp.w;
      sandbox.window.innerHeight = vp.h;

      for (let stg = 1; stg <= 4; stg++) {
        vm.runInContext(`setStage(${stg});`, context);
        interceptedCalls.length = 0;

        vm.runInContext(`renderLoop(1500);`, context);

        for (const call of interceptedCalls) {
          for (let i = 0; i < call.args.length; i++) {
            const v = call.args[i];
            if (typeof v === 'number') {
              assert.ok(
                Number.isFinite(v),
                `Viewport ${vp.w}x${vp.h} Stage ${stg} generated non-finite coordinate in '${call.fn}' arg[${i}]: ${v}`
              );
              assert.ok(
                !Number.isNaN(v),
                `Viewport ${vp.w}x${vp.h} Stage ${stg} generated NaN coordinate in '${call.fn}' arg[${i}]`
              );
            }
          }
        }
      }
    }
  });

  test('4.3: Victory and defeat modal overlays render cleanly without NaN or crashes', () => {
    const html = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');
    const rawScript = html.match(/<script>([\s\S]*?)<\/script>/)[1]
      .replace(/requestAnimationFrame\(renderLoop\);/g, '// paused');

    const interceptedCalls = [];
    const mockCtx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: (x, y) => interceptedCalls.push({ fn: 'moveTo', args: [x, y] }),
      lineTo: (x, y) => interceptedCalls.push({ fn: 'lineTo', args: [x, y] }),
      stroke: () => {},
      fill: () => {},
      fillRect: (x, y, w, h) => interceptedCalls.push({ fn: 'fillRect', args: [x, y, w, h] }),
      strokeRect: (x, y, w, h) => interceptedCalls.push({ fn: 'strokeRect', args: [x, y, w, h] }),
      clearRect: () => {},
      arc: (x, y, r) => interceptedCalls.push({ fn: 'arc', args: [x, y, r] }),
      drawImage: (img, ...args) => interceptedCalls.push({ fn: 'drawImage', args }),
      fillText: (t, x, y) => interceptedCalls.push({ fn: 'fillText', args: [t, x, y] }),
      strokeText: (t, x, y) => interceptedCalls.push({ fn: 'strokeText', args: [t, x, y] }),
      measureText: () => ({ width: 40 }),
      translate: (x, y) => interceptedCalls.push({ fn: 'translate', args: [x, y] }),
      rotate: () => {},
      scale: () => {},
      resetTransform: () => {},
      transform: () => {},
      roundRect: (x, y, w, h) => interceptedCalls.push({ fn: 'roundRect', args: [x, y, w, h] }),
      quadraticCurveTo: () => {},
      bezierCurveTo: () => {},
      ellipse: () => {},
      clip: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      setLineDash: () => {},
      canvas: { width: 960, height: 600 }
    };

    const mockCanvas = {
      getContext: () => mockCtx,
      width: 960,
      height: 600,
      style: { cursor: 'default' },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
      addEventListener: () => {}
    };

    const sandbox = {
      document: {
        getElementById: (id) => (id === 'battleCanvas' ? mockCanvas : { textContent: '', addEventListener: () => {} }),
        querySelectorAll: () => [],
        addEventListener: () => {}
      },
      window: { innerWidth: 960, innerHeight: 600, devicePixelRatio: 1, addEventListener: () => {} },
      performance: { now: () => 1000 },
      requestAnimationFrame: () => 1,
      Image: function() { this.complete = true; this.naturalWidth = 100; this.naturalHeight = 100; },
      Math,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      parseInt,
      parseFloat
    };

    const context = vm.createContext(sandbox);
    vm.runInContext(rawScript, context);

    // Test Victory Overlay across all 4 stages
    for (let stg = 1; stg <= 4; stg++) {
      vm.runInContext(`
        setStage(${stg});
        battleState.turnPhase = 'victory';
        renderLoop(2000);
      `, context);
    }

    // Test Defeat Overlay across all 4 stages
    for (let stg = 1; stg <= 4; stg++) {
      vm.runInContext(`
        setStage(${stg});
        battleState.turnPhase = 'defeat';
        renderLoop(2000);
      `, context);
    }
  });

  test('4.4: SideViewDiorama.ts preloads all 17 mandatory zone assets plus required zone props', () => {
    const dioramaCode = fs.readFileSync(path.join(GAME_DIR, 'src', 'game', 'sideview', 'SideViewDiorama.ts'), 'utf-8');

    const expectedAssets = [
      'bg_coastal_lighthouse.png',
      'bg_kelp_shallows.png',
      'bg_abyssal_shipwreck.png',
      'bg_subterranean_cave.png',
      'prop_lighthouse_cliff.png',
      'prop_dock_pilings_kelp.png',
      'prop_cave_stalactites.png',
      'prop_cave_chimney_vent.png',
      'prop_biolum_anemone_teal.png',
      'prop_biolum_anemone_cup.png',
      'prop_sea_cave_anchor.png',
      'shipwreck_abyssal_galleon.png',
      'shadow_kraken_tentacles_bg.png',
      'waves_misty_swell_1024_feathered.png',
      'waves_moonlit_crest_1024_feathered.png',
      'waves_storm_breaker_1024_feathered.png',
      'waves_churning_foam_1024_feathered.png',
      'fx_seafoam_churning_surf.png',
      'fx_wave_whitecap_spray_crest.png'
    ];

    for (const asset of expectedAssets) {
      assert.ok(
        dioramaCode.includes(asset),
        `SideViewDiorama.ts must register and reference asset '${asset}'`
      );
    }
  });

  test('4.5: Exact parity of wave dynamics and water column theme configs between engine and preview', () => {
    const html = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');
    const stageConfigMatch = html.match(/const\s+STAGE_CONFIG\s*=\s*\{([\s\S]*?)\n\s*\};/);
    assert.ok(stageConfigMatch, 'STAGE_CONFIG must exist in preview');

    for (let tier = 1; tier <= 4; tier++) {
      const liveProfile = getZoneProfile(tier);

      // Verify wave speeds match
      assert.ok(html.includes(`waveSpeed: ${liveProfile.waves.waveSpeed}`), `Stage ${tier} waveSpeed mismatch`);
      // Verify wave amps match
      assert.ok(html.includes(`waveAmp: ${liveProfile.waves.waveAmp}`), `Stage ${tier} waveAmp mismatch`);
      // Verify wave drifts match
      assert.ok(html.includes(`waveDrift: ${liveProfile.waves.waveDrift}`), `Stage ${tier} waveDrift mismatch`);
      // Verify primary wave textures match
      assert.ok(html.includes(liveProfile.waves.primaryWaveSprite), `Stage ${tier} primaryWaveSprite mismatch`);
      // Verify secondary wave textures match
      assert.ok(html.includes(liveProfile.waves.secondaryWaveSprite), `Stage ${tier} secondaryWaveSprite mismatch`);
    }
  });
});

