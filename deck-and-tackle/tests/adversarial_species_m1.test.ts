/**
 * Empirical Adversarial Stress Test Suite: Milestone 1 Species & Visual Sockets
 * 
 * Verifies and stresses:
 * 1. Monotonicity & Boundary Invariants (Distance, Line Power, Market Value)
 * 2. Intent Pattern Cycling & State Simulation (100-turn stress cycle, no nulls/NaNs)
 * 3. Socket Mapping & Canvas Rendering Robustness (Asset existence, mouth offsets, extreme thrash values)
 * 4. Zone Mapping Permutations & Precedence Invariants (ZoneTier resolution under adversarial input)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Headless polyfills for node environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    AudioContext: class {
      state = 'suspended';
      currentTime = 0;
      resume() { return Promise.resolve(); }
      createGain() {
        return {
          connect: () => {},
          gain: {
            value: 1,
            setValueAtTime: () => {},
            setTargetAtTime: () => {},
            linearRampToValueAtTime: () => {}
          }
        };
      }

      destination = {};
    },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
}
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({ getContext: () => null })
  };
}
if (typeof (globalThis as any).Audio === 'undefined') {
  (globalThis as any).Audio = class MockAudio {
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
  };
}
if (typeof (globalThis as any).Image === 'undefined') {
  (globalThis as any).Image = class {

    src: string = '';
    complete: boolean = true;
    naturalWidth: number = 200;
    naturalHeight: number = 100;
  };
}

import {
  FISH_REGISTRY,
  ALL_SPECIES_TYPES,
  ZONE_SPECIES_MAP,
  getSpeciesForZone,
  getFishData,
  getAllFishForZone,
  SpeciesType
} from '../src/game/battle/FishData.js';
import { FishVisualSocket, FishRenderData } from '../src/game/sockets/FishVisualSocket.js';
import { resolveZoneTier, ZONE_PROFILES, ZoneTier } from '../src/game/sideview/ZoneProfiles.js';
import { BattleEngine } from '../src/game/battle/BattleEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Challenger M1: Adversarial Stress Test Suite', () => {

  // --------------------------------------------------------------------------
  // 1. STAT MONOTONICITY & BOUNDARY INVARIANTS
  // --------------------------------------------------------------------------
  describe('1. Stat Monotonicity & Boundary Invariants', () => {
    it('ADV1.1: Starting distances have non-overlapping strict zone ordering', () => {
      const zoneDistances: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };

      for (const sp of ALL_SPECIES_TYPES) {
        const fish = FISH_REGISTRY[sp];
        assert.ok(Number.isFinite(fish.startingDistance), `${sp} startingDistance must be finite`);
        assert.ok(fish.startingDistance > 0, `${sp} startingDistance must be positive`);
        assert.equal(fish.startingDistance, Math.round(fish.startingDistance), `${sp} distance must be integer`);
        zoneDistances[fish.zoneTier].push(fish.startingDistance);
      }

      // Zone 1 vs Zone 2 vs Zone 3 vs Zone 4
      const maxZ1 = Math.max(...zoneDistances[1]);
      const minZ2 = Math.min(...zoneDistances[2]);
      const maxZ2 = Math.max(...zoneDistances[2]);
      const minZ3 = Math.min(...zoneDistances[3]);
      const maxZ3 = Math.max(...zoneDistances[3]);
      const minZ4 = Math.min(...zoneDistances[4]);

      assert.ok(minZ2 > maxZ1, `Strict monotonicity violated: min Z2 (${minZ2}) <= max Z1 (${maxZ1})`);
      assert.ok(minZ3 > maxZ2, `Strict monotonicity violated: min Z3 (${minZ3}) <= max Z2 (${maxZ2})`);
      assert.ok(minZ4 > maxZ3, `Strict monotonicity violated: min Z4 (${minZ4}) <= max Z3 (${maxZ3})`);
    });

    it('ADV1.2: Line power strictly increases by zone tier bounds', () => {
      const zonePowers: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [] };

      for (const sp of ALL_SPECIES_TYPES) {
        const fish = FISH_REGISTRY[sp];
        assert.equal(fish.lineDamagePower, fish.linePower, `${sp} lineDamagePower must match linePower`);
        assert.ok(Number.isFinite(fish.linePower), `${sp} linePower must be finite`);
        assert.ok(fish.linePower > 0, `${sp} linePower must be > 0`);
        zonePowers[fish.zoneTier].push(fish.linePower);
      }

      const maxZ1 = Math.max(...zonePowers[1]);
      const minZ2 = Math.min(...zonePowers[2]);
      const maxZ2 = Math.max(...zonePowers[2]);
      const minZ3 = Math.min(...zonePowers[3]);
      const maxZ3 = Math.max(...zonePowers[3]);
      const minZ4 = Math.min(...zonePowers[4]);

      assert.ok(minZ2 > maxZ1, `Line power monotonicity violated: min Z2 (${minZ2}) <= max Z1 (${maxZ1})`);
      assert.ok(minZ3 > maxZ2, `Line power monotonicity violated: min Z3 (${minZ3}) <= max Z2 (${maxZ2})`);
      assert.ok(minZ4 > maxZ3, `Line power monotonicity violated: min Z4 (${minZ4}) <= max Z3 (${maxZ3})`);
    });

    it('ADV1.3: Market value intra-zone tier progression is strictly monotonic (common < uncommon < rare)', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const commonSp = ZONE_SPECIES_MAP[tier as ZoneTier].common;
        const uncommonSp = ZONE_SPECIES_MAP[tier as ZoneTier].uncommon;
        const rareSp = ZONE_SPECIES_MAP[tier as ZoneTier].rare;

        const commonVal = FISH_REGISTRY[commonSp].marketValue;
        const uncommonVal = FISH_REGISTRY[uncommonSp].marketValue;
        const rareVal = FISH_REGISTRY[rareSp].marketValue;

        assert.ok(commonVal > 0, `Zone ${tier} common value must be positive`);
        assert.ok(uncommonVal > commonVal, `Zone ${tier} uncommon (${uncommonVal}) must exceed common (${commonVal})`);
        assert.ok(rareVal > uncommonVal, `Zone ${tier} rare (${rareVal}) must exceed uncommon (${uncommonVal})`);
      }
    });

    it('ADV1.4: Legacy sellValue safety check prevents NaN or breaking regressions', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const fish = FISH_REGISTRY[sp];
        assert.ok(Number.isInteger(fish.sellValue), `${sp} sellValue must be integer`);
        assert.ok(fish.sellValue > 0, `${sp} sellValue must be positive`);
        assert.ok(Number.isInteger(fish.marketValue), `${sp} marketValue must be integer`);
        assert.ok(fish.marketValue >= fish.sellValue, `${sp} marketValue should be >= sellValue`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. INTENT PATTERN CYCLING & STATE SIMULATION
  // --------------------------------------------------------------------------
  describe('2. Intent Pattern Cycling & State Simulation', () => {
    it('ADV2.1: 100-turn simulation of intent cycling for all 12 species executes without nulls or NaNs', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const fish = FISH_REGISTRY[sp];
        const loopLen = fish.intentPattern.length;
        assert.equal(loopLen, 4, `${sp} loop length must be exactly 4`);

        let totalThrashDamage = 0;
        let totalDeepDiveMeters = 0;
        let restCount = 0;

        for (let turn = 0; turn < 100; turn++) {
          const stepIndex = turn % loopLen;
          const intent = fish.intentPattern[stepIndex];

          assert.ok(intent !== null && intent !== undefined, `${sp} turn ${turn} intent must not be null/undefined`);
          assert.ok(typeof intent.name === 'string' && intent.name.length > 0, `${sp} turn ${turn} name must be valid string`);
          assert.ok(typeof intent.description === 'string' && intent.description.length > 0, `${sp} turn ${turn} description must be valid string`);

          if (intent.type === 'Thrash') {
            assert.ok(intent.value > 0, `${sp} Thrash damage must be > 0`);
            assert.ok(Number.isFinite(intent.value), `${sp} Thrash damage must be finite`);
            totalThrashDamage += intent.value;
          } else if (intent.type === 'DeepDive') {
            assert.ok(intent.value > 0, `${sp} DeepDive meters must be > 0`);
            assert.ok(Number.isFinite(intent.value), `${sp} DeepDive meters must be finite`);
            totalDeepDiveMeters += intent.value;
          } else if (intent.type === 'Rest') {
            assert.equal(intent.value, 0, `${sp} Rest value must be 0`);
            restCount++;
          } else {
            assert.fail(`Invalid intent type: ${(intent as any).type}`);
          }
        }

        // Over 100 turns, each species must deal significant damage
        assert.ok(totalThrashDamage > 0, `${sp} must deal thrash damage over 100 turns`);
      }
    });

    it('ADV2.2: DeepDive and Thrash ratios provide tactical differentiation per species', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const fish = FISH_REGISTRY[sp];
        const thrashIntents = fish.intentPattern.filter(i => i.type === 'Thrash');
        const deepDiveIntents = fish.intentPattern.filter(i => i.type === 'DeepDive');

        // Every fish has at least one attack (Thrash)
        assert.ok(thrashIntents.length >= 1, `${sp} must have at least 1 Thrash intent`);
        // Max 3 thrashes to allow diversity (Rest or DeepDive)
        assert.ok(thrashIntents.length <= 3, `${sp} must not be 100% Thrash, allowing player tactical counterplay`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. SOCKET MAPPING & RENDERING ROBUSTNESS
  // --------------------------------------------------------------------------
  describe('3. Socket Mapping & Rendering Robustness', () => {
    it('ADV3.1: All 12 sprite assets exist with non-zero file sizes on disk', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const cfg = FishVisualSocket.SPECIES_VISUAL_CONFIGS[sp];
        assert.ok(cfg, `Config for ${sp} exists`);

        const diskPath = path.resolve(projectRoot, 'public', cfg.spritePath.replace(/^\//, ''));
        assert.ok(fs.existsSync(diskPath), `Sprite file exists at ${diskPath}`);

        const stats = fs.statSync(diskPath);
        assert.ok(stats.size > 500, `Sprite ${cfg.spritePath} size (${stats.size}b) must be non-empty image file`);
      }
    });

    it('ADV3.2: Mouth socket offsets are ergonomically positioned inside or on the perimeter', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const cfg = FishVisualSocket.SPECIES_VISUAL_CONFIGS[sp];
        // Width and height positive
        assert.ok(cfg.w > 0 && cfg.h > 0, `${sp} dimensions must be positive`);
        // Mouth X is toward the head (left side, mouthX < 0)
        assert.ok(cfg.mouthX < 0, `${sp} mouthX must be negative`);
        // Mouth socket must be within reasonable bounds of half-width
        assert.ok(Math.abs(cfg.mouthX) <= cfg.w, `${sp} mouthX (${cfg.mouthX}) within width (${cfg.w})`);
        assert.ok(Math.abs(cfg.mouthY) <= cfg.h / 2 + 10, `${sp} mouthY (${cfg.mouthY}) within vertical bounds`);
      }
    });

    it('ADV3.3: Mock Canvas rendering handles extreme and boundary thrashAmount values (0, 0.5, 1.0, 10.0, -1.0)', () => {
      // Mock Canvas 2D Context
      const mockCtx: any = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        ellipse: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        fill: () => {},
        stroke: () => {},
        fillRect: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        shadowColor: '#000',
        shadowBlur: 0
      };

      const socket = new FishVisualSocket();
      const testThrashAmounts = [0, 0.5, 1.0, 10.0, -1.0, NaN, undefined];

      for (const sp of ALL_SPECIES_TYPES) {
        for (const thrash of testThrashAmounts) {
          const renderData: FishRenderData = {
            time: 1.25,
            speciesType: sp,
            depthMeters: 50,
            thrashAmount: thrash as any
          };

          // Must not throw or crash on placeholder / sprite render
          assert.doesNotThrow(() => {
            (socket as any).renderPlaceholder(mockCtx, renderData);
          }, `renderPlaceholder crashed on ${sp} with thrash ${thrash}`);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. ZONE MAPPING PERMUTATIONS & PRECEDENCE INVARIANTS
  // --------------------------------------------------------------------------
  describe('4. Zone Mapping Permutations & Precedence Invariants', () => {
    it('ADV4.1: Species tier always overrides conflicting zoneType and depth arguments', () => {
      // Zone 4 species forced into shallow zoneType and 0 depth
      for (const sp of ['maw_worm', 'cthulhu_spawn', 'dagon'] as SpeciesType[]) {
        assert.equal(resolveZoneTier('shallow', sp, 0), 4, `${sp} in shallow at 0m must still resolve to Tier 4`);
      }

      // Zone 3 species forced into cave zoneType
      // Note: Cave zoneType is tier 4, so species tier 3 vs cave zoneType:
      // Let's verify priority: Tier 4 check includes zoneType === 'cave'.
      // If species is 'gar' but zoneType is 'cave', rule 1 triggers because zoneType === 'cave'.
      assert.equal(resolveZoneTier('cave', 'gar', 0), 4, `cave zoneType takes precedence as Tier 4 environment`);

      // Zone 2 species in shallow zoneType at 0m
      for (const sp of ['pike', 'sculpin', 'teal_snapper'] as SpeciesType[]) {
        assert.equal(resolveZoneTier('shallow', sp, 0), 2, `${sp} in shallow at 0m must resolve to Tier 2`);
      }

      // Zone 1 species in shallow zoneType at 0m
      for (const sp of ['perch', 'flounder', 'ghost_cod'] as SpeciesType[]) {
        assert.equal(resolveZoneTier('shallow', sp, 0), 1, `${sp} in shallow at 0m must resolve to Tier 1`);
      }
    });

    it('ADV4.2: Depth threshold boundaries resolve accurately when speciesType is undefined', () => {
      const boundaryCases: [number, ZoneTier][] = [
        [0, 1],
        [29, 1],
        [30, 2],
        [59, 2],
        [60, 3],
        [99, 3],
        [100, 4],
        [150, 4],
        [9999, 4]
      ];

      for (const [depth, expectedTier] of boundaryCases) {
        const resolved = resolveZoneTier('shallow', undefined, depth);
        assert.equal(resolved, expectedTier, `Depth ${depth}m must resolve to Tier ${expectedTier}`);
      }
    });

    it('ADV4.3: Unknown or invalid species fall back gracefully to zoneType / depth without crash', () => {
      assert.doesNotThrow(() => {
        const tier = resolveZoneTier('shallow', 'unknown_mutant' as any, 10);
        assert.equal(tier, 1, 'Unknown species with shallow/10m resolves to Tier 1');
      });
      assert.doesNotThrow(() => {
        const tier = resolveZoneTier('shallow', 'unknown_mutant' as any, 80);
        assert.equal(tier, 3, 'Unknown species with depth 80m resolves to Tier 3');
      });
    });
  });

  // --------------------------------------------------------------------------
  // 5. BATTLE ENGINE CYCLE & STRESS
  // --------------------------------------------------------------------------
  describe('5. Battle Engine Cycle & Stress', () => {
    it('ADV5.1: Initializing and resetting BattleEngine across all 12 species maintains line HP integrity', () => {
      const engine = new BattleEngine('perch');

      for (const sp of ALL_SPECIES_TYPES) {
        engine.reset(sp);
        assert.equal(engine.fish.speciesType, sp);
        assert.equal(engine.distanceToBoat, FISH_REGISTRY[sp].startingDistance);
        assert.equal(engine.lineSlack, 0, 'Line slack resets to 0');
        assert.equal(engine.lineIntegrity, engine.maxLineIntegrity, 'Line integrity resets to maxLineIntegrity');
        assert.equal(engine.status, 'player_turn', 'Status is player_turn');
      }
    });
  });
});
