/**
 * Milestone 1 Test Suite: 12 Catchable Fish Species Across 4 Radial Zones & Visual Sockets
 * 
 * Verifies:
 * 1. FISH_REGISTRY contains all 12 species across 4 radial zones (3 per zone: common, uncommon, rare/aberrant).
 * 2. Every species has valid starting distance, line tension damage power, market value, and zoneTier.
 * 3. Every species possesses a tailored 4-step intent pattern with valid types (Thrash, DeepDive, Rest).
 * 4. Sliced sprite asset paths exist on disk and are registered in FishVisualSocket with accurate dimensions and mouth sockets.
 * 5. ZONE_SPECIES_MAP and lookup helpers correctly map zones and rarities to species.
 * 6. resolveZoneTier correctly maps all 12 species to tiers 1–4.
 * 7. BattleEngine initializes seamlessly for all 12 species.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Headless polyfills for browser globals if needed
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    AudioContext: class MockAudioContext {
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
      createBufferSource() {
        return {
          connect: () => {},
          start: () => {},
          stop: () => {}
        };
      }
      createOscillator() {
        return {
          connect: () => {},
          start: () => {},
          stop: () => {},
          frequency: { setValueAtTime: () => {} }
        };
      }
      destination = {};
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
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
  (globalThis as any).Image = class MockImage {
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
import { FishVisualSocket } from '../src/game/sockets/FishVisualSocket.js';
import { resolveZoneTier, ZONE_PROFILES, ZoneTier } from '../src/game/sideview/ZoneProfiles.js';
import { BattleEngine } from '../src/game/battle/BattleEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Milestone 1: 12 Catchable Fish Species & Visual Sockets Suite', () => {

  // ==========================================================================
  // 1. Registry Completeness & Structure
  // ==========================================================================
  describe('1. Registry Completeness & Structure', () => {
    it('M1.1.1: ALL_SPECIES_TYPES lists exactly 12 unique species keys', () => {
      assert.equal(ALL_SPECIES_TYPES.length, 12, 'Must list exactly 12 species');
      const uniqueKeys = new Set(ALL_SPECIES_TYPES);
      assert.equal(uniqueKeys.size, 12, 'All 12 species keys must be distinct');
    });

    it('M1.1.2: FISH_REGISTRY contains an entry for all 12 species', () => {
      const expectedSpecies: SpeciesType[] = [
        'perch', 'flounder', 'ghost_cod',
        'pike', 'sculpin', 'teal_snapper',
        'gar', 'angler', 'gulper',
        'maw_worm', 'cthulhu_spawn', 'dagon'
      ];

      for (const sp of expectedSpecies) {
        const fish = FISH_REGISTRY[sp];
        assert.ok(fish, `Species ${sp} must exist in FISH_REGISTRY`);
        assert.equal(fish.speciesType, sp);
        assert.ok(fish.id && fish.id.length > 0, `${sp} must have non-empty id`);
        assert.ok(fish.speciesName && fish.speciesName.length > 0, `${sp} must have non-empty speciesName`);
        assert.ok(fish.name && fish.name.length > 0, `${sp} must have non-empty name`);
        assert.ok(fish.description && fish.description.length > 0, `${sp} must have non-empty description`);
      }
    });

    it('M1.1.3: Exactly 3 species exist in each of the 4 radial depth zones', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const fishesInZone = getAllFishForZone(tier as ZoneTier);
        assert.equal(fishesInZone.length, 3, `Zone tier ${tier} must have exactly 3 species`);

        const zoneMap = ZONE_SPECIES_MAP[tier as ZoneTier];
        assert.ok(zoneMap.common, `Zone ${tier} must have a Common species`);
        assert.ok(zoneMap.uncommon, `Zone ${tier} must have an Uncommon species`);
        assert.ok(zoneMap.rare, `Zone ${tier} must have a Rare species`);
      }
    });

    it('M1.1.4: ZONE_SPECIES_MAP maps each zone to its authoritative species', () => {
      // Zone 1
      assert.equal(ZONE_SPECIES_MAP[1].common, 'perch');
      assert.equal(ZONE_SPECIES_MAP[1].uncommon, 'flounder');
      assert.equal(ZONE_SPECIES_MAP[1].rare, 'ghost_cod');

      // Zone 2
      assert.equal(ZONE_SPECIES_MAP[2].common, 'pike');
      assert.equal(ZONE_SPECIES_MAP[2].uncommon, 'sculpin');
      assert.equal(ZONE_SPECIES_MAP[2].rare, 'teal_snapper');

      // Zone 3
      assert.equal(ZONE_SPECIES_MAP[3].common, 'gar');
      assert.equal(ZONE_SPECIES_MAP[3].uncommon, 'angler');
      assert.equal(ZONE_SPECIES_MAP[3].rare, 'gulper');

      // Zone 4
      assert.equal(ZONE_SPECIES_MAP[4].common, 'maw_worm');
      assert.equal(ZONE_SPECIES_MAP[4].uncommon, 'cthulhu_spawn');
      assert.equal(ZONE_SPECIES_MAP[4].rare, 'dagon');
      assert.equal(ZONE_SPECIES_MAP[4].aberrant, 'dagon');
    });

    it('M1.1.5: getSpeciesForZone and getFishData resolve correct records', () => {
      assert.equal(getSpeciesForZone(1, 'common'), 'perch');
      assert.equal(getSpeciesForZone(1, 'uncommon'), 'flounder');
      assert.equal(getSpeciesForZone(1, 'rare'), 'ghost_cod');
      assert.equal(getSpeciesForZone(2, 'common'), 'pike');
      assert.equal(getSpeciesForZone(2, 'uncommon'), 'sculpin');
      assert.equal(getSpeciesForZone(2, 'rare'), 'teal_snapper');
      assert.equal(getSpeciesForZone(3, 'common'), 'gar');
      assert.equal(getSpeciesForZone(3, 'uncommon'), 'angler');
      assert.equal(getSpeciesForZone(3, 'rare'), 'gulper');
      assert.equal(getSpeciesForZone(4, 'common'), 'maw_worm');
      assert.equal(getSpeciesForZone(4, 'uncommon'), 'cthulhu_spawn');
      assert.equal(getSpeciesForZone(4, 'rare'), 'dagon');
      assert.equal(getSpeciesForZone(4, 'aberrant'), 'dagon');

      const perchData = getFishData('perch');
      assert.equal(perchData.speciesName, 'Innsmouth Perch');
      assert.equal(perchData.zoneTier, 1);
    });
  });

  // ==========================================================================
  // 2. Combat Stats & Economic Values
  // ==========================================================================
  describe('2. Combat Stats & Economic Values', () => {
    it('M1.2.1: Starting distance (HP) increases monotonically across depth zones', () => {
      const z1Distances = [
        FISH_REGISTRY.perch.startingDistance,
        FISH_REGISTRY.flounder.startingDistance,
        FISH_REGISTRY.ghost_cod.startingDistance
      ];
      const z2Distances = [
        FISH_REGISTRY.pike.startingDistance,
        FISH_REGISTRY.sculpin.startingDistance,
        FISH_REGISTRY.teal_snapper.startingDistance
      ];
      const z3Distances = [
        FISH_REGISTRY.gar.startingDistance,
        FISH_REGISTRY.angler.startingDistance,
        FISH_REGISTRY.gulper.startingDistance
      ];
      const z4Distances = [
        FISH_REGISTRY.maw_worm.startingDistance,
        FISH_REGISTRY.cthulhu_spawn.startingDistance,
        FISH_REGISTRY.dagon.startingDistance
      ];

      // Zone 1 range: 30 - 50m
      for (const d of z1Distances) {
        assert.ok(d >= 30 && d <= 50, `Z1 distance ${d} in [30, 50]`);
      }
      // Zone 2 range: 52 - 70m
      for (const d of z2Distances) {
        assert.ok(d >= 52 && d <= 70, `Z2 distance ${d} in [52, 70]`);
      }
      // Zone 3 range: 75 - 98m
      for (const d of z3Distances) {
        assert.ok(d >= 75 && d <= 98, `Z3 distance ${d} in [75, 98]`);
      }
      // Zone 4 range: 105 - 140m
      for (const d of z4Distances) {
        assert.ok(d >= 105 && d <= 140, `Z4 distance ${d} in [105, 140]`);
      }

      // Strict inter-tier monotonicity
      assert.ok(Math.min(...z2Distances) > Math.max(...z1Distances), 'Z2 min dist > Z1 max dist');
      assert.ok(Math.min(...z3Distances) > Math.max(...z2Distances), 'Z3 min dist > Z2 max dist');
      assert.ok(Math.min(...z4Distances) > Math.max(...z3Distances), 'Z4 min dist > Z3 max dist');
    });

    it('M1.2.2: Line tension damage power scales appropriately per zone tier', () => {
      for (const fish of Object.values(FISH_REGISTRY)) {
        assert.equal(fish.lineDamagePower, fish.linePower, `${fish.speciesType} lineDamagePower matches linePower alias`);
        if (fish.zoneTier === 1) {
          assert.ok(fish.lineDamagePower >= 8 && fish.lineDamagePower <= 14, `Z1 ${fish.speciesType} linePower in 8-14`);
        } else if (fish.zoneTier === 2) {
          assert.ok(fish.lineDamagePower >= 15 && fish.lineDamagePower <= 20, `Z2 ${fish.speciesType} linePower in 15-20`);
        } else if (fish.zoneTier === 3) {
          assert.ok(fish.lineDamagePower >= 22 && fish.lineDamagePower <= 28, `Z3 ${fish.speciesType} linePower in 22-28`);
        } else if (fish.zoneTier === 4) {
          assert.ok(fish.lineDamagePower >= 30 && fish.lineDamagePower <= 40, `Z4 ${fish.speciesType} linePower in 30-40`);
        }
      }
    });

    it('M1.2.3: Market value provides positive economic scaling matching rarity and depth danger', () => {
      // Zone 1
      assert.equal(FISH_REGISTRY.perch.marketValue, 15);
      assert.equal(FISH_REGISTRY.flounder.marketValue, 32);
      assert.equal(FISH_REGISTRY.ghost_cod.marketValue, 55);

      // Zone 2
      assert.equal(FISH_REGISTRY.pike.marketValue, 40);
      assert.equal(FISH_REGISTRY.sculpin.marketValue, 65);
      assert.equal(FISH_REGISTRY.teal_snapper.marketValue, 95);

      // Zone 3
      assert.equal(FISH_REGISTRY.gar.marketValue, 90);
      assert.equal(FISH_REGISTRY.angler.marketValue, 135);
      assert.equal(FISH_REGISTRY.gulper.marketValue, 185);

      // Zone 4
      assert.equal(FISH_REGISTRY.maw_worm.marketValue, 160);
      assert.equal(FISH_REGISTRY.cthulhu_spawn.marketValue, 225);
      assert.equal(FISH_REGISTRY.dagon.marketValue, 350);

      // Within every zone, common < uncommon < rare/aberrant
      for (let tier = 1; tier <= 4; tier++) {
        const common = FISH_REGISTRY[ZONE_SPECIES_MAP[tier as ZoneTier].common];
        const uncommon = FISH_REGISTRY[ZONE_SPECIES_MAP[tier as ZoneTier].uncommon];
        const rare = FISH_REGISTRY[ZONE_SPECIES_MAP[tier as ZoneTier].rare];

        assert.ok(common.marketValue < uncommon.marketValue, `Zone ${tier}: Common < Uncommon market value`);
        assert.ok(uncommon.marketValue < rare.marketValue, `Zone ${tier}: Uncommon < Rare market value`);
      }
    });

    it('M1.2.4: Backward compatibility of sellValue is preserved for legacy test suites', () => {
      assert.equal(FISH_REGISTRY.perch.sellValue, 15);
      assert.equal(FISH_REGISTRY.pike.sellValue, 40);
      assert.equal(FISH_REGISTRY.gar.sellValue, 90);
      assert.equal(FISH_REGISTRY.dagon.sellValue, 250);

      const legacySum =
        FISH_REGISTRY.perch.sellValue +
        FISH_REGISTRY.pike.sellValue +
        FISH_REGISTRY.gar.sellValue +
        FISH_REGISTRY.dagon.sellValue;
      assert.equal(legacySum, 395, 'Legacy test assertion 15 + 40 + 90 + 250 = 395 must strictly hold');
    });
  });

  // ==========================================================================
  // 3. 4-Step Intent Patterns & Behaviors
  // ==========================================================================
  describe('3. 4-Step Intent Patterns & Behaviors', () => {
    it('M1.3.1: Every species has exactly 4 intent steps in its loop', () => {
      for (const [key, fish] of Object.entries(FISH_REGISTRY)) {
        assert.equal(fish.intentPattern.length, 4, `${key} intentPattern must have length 4`);
        assert.equal(fish.intents.length, 4, `${key} intents alias must have length 4`);
        assert.deepEqual(fish.intentPattern, fish.intents, `${key} intents must equal intentPattern`);
      }
    });

    it('M1.3.2: Every intent has a valid type, positive or zero value, and descriptive text', () => {
      for (const [key, fish] of Object.entries(FISH_REGISTRY)) {
        for (let i = 0; i < fish.intentPattern.length; i++) {
          const intent = fish.intentPattern[i];
          assert.ok(
            ['Thrash', 'DeepDive', 'Rest'].includes(intent.type),
            `${key} step ${i} intent type ${intent.type} must be valid`
          );

          if (intent.type === 'Rest') {
            assert.equal(intent.value, 0, `${key} step ${i} Rest intent value must be 0`);
          } else {
            assert.ok(intent.value > 0, `${key} step ${i} ${intent.type} intent value must be > 0`);
          }

          assert.ok(intent.name && intent.name.length > 0, `${key} step ${i} intent name must not be empty`);
          assert.ok(intent.description && intent.description.length > 0, `${key} step ${i} intent description must not be empty`);
        }
      }
    });

    it('M1.3.3: Every species exercises unique move names matching its thematic lore', () => {
      const allMoveNames = new Set<string>();
      let totalMoves = 0;

      for (const fish of Object.values(FISH_REGISTRY)) {
        for (const intent of fish.intentPattern) {
          totalMoves++;
          allMoveNames.add(intent.name);
        }
      }

      // Ensure high distinctiveness across species moves
      assert.equal(totalMoves, 48, '12 species x 4 intents = 48 total intents');
      assert.ok(allMoveNames.size >= 40, `Move diversity should be high (${allMoveNames.size} distinct names out of 48)`);
    });
  });

  // ==========================================================================
  // 4. Visual Sockets & Sliced Sprites
  // ==========================================================================
  describe('4. Visual Sockets & Sliced Sprites', () => {
    it('M1.4.1: Sliced sprite PNG files exist on disk for all 12 species', () => {
      for (const [key, fish] of Object.entries(FISH_REGISTRY)) {
        assert.ok(fish.spriteAssetKey, `${key} must define spriteAssetKey`);
        // spriteAssetKey may have leading slash e.g. /assets/sprites/fishing/...
        const relativePath = fish.spriteAssetKey.startsWith('/') ? fish.spriteAssetKey.slice(1) : fish.spriteAssetKey;
        const diskPath = path.resolve(projectRoot, 'public', relativePath);
        assert.ok(fs.existsSync(diskPath), `Sprite asset for ${key} must exist on disk at ${diskPath}`);
      }
    });

    it('M1.4.2: FishVisualSocket.SPECIES_VISUAL_CONFIGS registers all 12 species with proportional dimensions', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const cfg = FishVisualSocket.SPECIES_VISUAL_CONFIGS[sp];
        assert.ok(cfg, `FishVisualSocket must configure ${sp}`);
        assert.ok(cfg.w >= 140 && cfg.w <= 340, `${sp} width ${cfg.w} in [140, 340]`);
        assert.ok(cfg.h >= 70 && cfg.h <= 220, `${sp} height ${cfg.h} in [70, 220]`);
        assert.ok(cfg.mouthX < 0, `${sp} mouthX (${cfg.mouthX}) must be negative (facing left toward boat)`);
      }
    });

    it('M1.4.3: FishVisualSocket.getSpeciesVisualConfig provides accurate fallback and lookup', () => {
      const perchCfg = FishVisualSocket.getSpeciesVisualConfig('perch');
      assert.equal(perchCfg.w, 140);
      assert.equal(perchCfg.h, 70);
      assert.equal(perchCfg.mouthX, -58);

      const dagonCfg = FishVisualSocket.getSpeciesVisualConfig('dagon');
      assert.equal(dagonCfg.w, 340);
      assert.equal(dagonCfg.h, 220);
      assert.equal(dagonCfg.mouthX, -145);

      const unknownCfg = FishVisualSocket.getSpeciesVisualConfig('non_existent' as any);
      assert.ok(unknownCfg.w > 0, 'Unknown species must return valid fallback dimensions');
    });

    it('M1.4.4: FishVisualSocket loads sprites into cache without errors', () => {
      const socket = new FishVisualSocket();
      for (const sp of ALL_SPECIES_TYPES) {
        const sprite = FishVisualSocket.getSprite(sp);
        assert.ok(sprite, `FishVisualSocket must hold cached image element for ${sp}`);
      }
    });
  });

  // ==========================================================================
  // 5. Zone Tier Resolution
  // ==========================================================================
  describe('5. Zone Tier Resolution (ZoneProfiles)', () => {
    it('M1.5.1: resolveZoneTier maps each of the 12 species to their respective zone tier (1..4)', () => {
      // Zone 1
      assert.equal(resolveZoneTier('shallow', 'perch'), 1);
      assert.equal(resolveZoneTier('shallow', 'flounder'), 1);
      assert.equal(resolveZoneTier('shallow', 'ghost_cod'), 1);

      // Zone 2
      assert.equal(resolveZoneTier('lake', 'pike'), 2);
      assert.equal(resolveZoneTier('lake', 'sculpin'), 2);
      assert.equal(resolveZoneTier('lake', 'teal_snapper'), 2);

      // Zone 3
      assert.equal(resolveZoneTier('abyss', 'gar'), 3);
      assert.equal(resolveZoneTier('abyss', 'angler'), 3);
      assert.equal(resolveZoneTier('abyss', 'gulper'), 3);

      // Zone 4
      assert.equal(resolveZoneTier('cave', 'maw_worm'), 4);
      assert.equal(resolveZoneTier('cave', 'cthulhu_spawn'), 4);
      assert.equal(resolveZoneTier('cave', 'dagon'), 4);
    });

    it('M1.5.2: Species precedence overrides neutral zoneType when provided', () => {
      // Even in a shallow zoneType, an abyssal creature maps to its species tier
      assert.equal(resolveZoneTier('shallow', 'dagon'), 4);
      assert.equal(resolveZoneTier('shallow', 'gar'), 3);
      assert.equal(resolveZoneTier('shallow', 'pike'), 2);
    });

    it('M1.5.3: Depth meters fallback functions accurately when species is unspecified', () => {
      assert.equal(resolveZoneTier('shallow', undefined, 120), 4);
      assert.equal(resolveZoneTier('shallow', undefined, 80), 3);
      assert.equal(resolveZoneTier('shallow', undefined, 45), 2);
      assert.equal(resolveZoneTier('shallow', undefined, 15), 1);
    });

    it('M1.5.4: ZoneProfiles ambient fish sprites list contains new species for each zone', () => {
      assert.ok(ZONE_PROFILES[1].ambientFishSprites.includes('fish_flounder_benthic.png'));
      assert.ok(ZONE_PROFILES[1].ambientFishSprites.includes('fish_gray_cod.png'));
      assert.ok(ZONE_PROFILES[2].ambientFishSprites.includes('fish_teal_snapper.png'));
      assert.ok(ZONE_PROFILES[3].ambientFishSprites.includes('fish_visceral_gut_swollen.png'));
      assert.ok(ZONE_PROFILES[4].ambientFishSprites.includes('fish_cthulhu_tentacled.png'));
    });
  });

  // ==========================================================================
  // 6. BattleEngine Seamless Integration
  // ==========================================================================
  describe('6. BattleEngine Integration', () => {
    it('M1.6.1: BattleEngine instantiates cleanly for all 12 species without errors', () => {
      for (const sp of ALL_SPECIES_TYPES) {
        const engine = new BattleEngine(sp);
        assert.equal(engine.fish.speciesType, sp);
        assert.equal(engine.distanceToBoat, engine.fish.startingDistance);
        assert.equal(engine.maxStartingDistance, engine.fish.startingDistance);
        assert.equal(engine.status, 'player_turn');
        assert.ok(engine.hand.length > 0, 'Hand dealt cards on turn start');
      }
    });

    it('M1.6.2: BattleEngine reset switches to any of the 12 species correctly', () => {
      const engine = new BattleEngine('perch');
      assert.equal(engine.fish.speciesType, 'perch');

      engine.reset('angler');
      assert.equal(engine.fish.speciesType, 'angler');
      assert.equal(engine.distanceToBoat, 86);

      engine.reset('dagon');
      assert.equal(engine.fish.speciesType, 'dagon');
      assert.equal(engine.distanceToBoat, 140);
    });
  });
});
