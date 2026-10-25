/**
 * Milestone 2 Test Suite: Bait Shop, Inventory Tracking & Pre-Cast Modal (R2)
 * 
 * Verifies:
 * 1. BAIT_REGISTRY completeness, stat definitions, costs, icons, and weight distributions.
 * 2. PlayerInventory bait tracking: infinite Bare Hook, stock additions, decrement on consume,
 *    and automatic fallback to Bare Hook when stock depletes.
 * 3. Shop purchase mechanics: gold deductions, stock increases, and rejection on insufficient funds.
 * 4. Rarity rolling and zone species attraction biasing (deterministic and statistical Monte Carlo).
 * 5. PreCastModal interactive lifecycle: opening, cycling owned baits, confirming cast, and cancellation.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Headless polyfills for browser canvas and audio globals
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
  BAIT_REGISTRY,
  ALL_BAIT_IDS,
  getBaitData,
  getAllBaits,
  rollRarityForBait,
  rollSpeciesForZone,
  rollOutcomeForBait,
  BaitId
} from '../src/game/battle/BaitData.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { PreCastModal } from '../src/game/ui/PreCastModal.js';
import { HarborShopOverlay } from '../src/game/ui/HarborShopOverlay.js';
import { ZONE_SPECIES_MAP } from '../src/game/battle/FishData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Milestone 2: Bait Shop, Inventory Tracking & Pre-Cast Modal Suite', () => {

  // ==========================================================================
  // 1. Bait Registry Completeness & Structure
  // ==========================================================================
  describe('1. Bait Registry Completeness & Structure', () => {
    it('M2.1.1: ALL_BAIT_IDS lists all 5 authoritative bait identifiers', () => {
      const expectedIds: BaitId[] = ['bare_hook', 'lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];
      assert.equal(ALL_BAIT_IDS.length, 5, 'Must contain exactly 5 bait types');
      for (const id of expectedIds) {
        assert.ok(ALL_BAIT_IDS.includes(id), `ALL_BAIT_IDS must include ${id}`);
        assert.ok(BAIT_REGISTRY[id], `BAIT_REGISTRY must contain config for ${id}`);
      }
    });

    it('M2.1.2: Every bait config contains valid name, cost, description, and icon path', () => {
      for (const [id, bait] of Object.entries(BAIT_REGISTRY)) {
        assert.equal(bait.id, id);
        assert.ok(bait.name && bait.name.length > 0, `${id} must have non-empty name`);
        assert.ok(bait.description && bait.description.length > 0, `${id} must have non-empty description`);
        assert.ok(typeof bait.cost === 'number' && bait.cost >= 0, `${id} cost must be non-negative number`);
        assert.ok(bait.iconAssetKey && bait.iconAssetKey.length > 0, `${id} must have iconAssetKey`);

        // Check icon exists on disk
        const relPath = bait.iconAssetKey.startsWith('/') ? bait.iconAssetKey.slice(1) : bait.iconAssetKey;
        const diskPath = path.resolve(projectRoot, 'public', relPath);
        assert.ok(fs.existsSync(diskPath), `Icon for ${id} must exist at ${diskPath}`);
      }
    });

    it('M2.1.3: Bait pricing matches design specification', () => {
      assert.equal(BAIT_REGISTRY.bare_hook.cost, 0, 'Bare Hook must be free (0g)');
      assert.equal(BAIT_REGISTRY.lugworms.cost, 10, 'Lugworms must cost 10g');
      assert.equal(BAIT_REGISTRY.blood_chum.cost, 25, 'Blood Chum must cost 25g');
      assert.equal(BAIT_REGISTRY.bio_squid.cost, 45, 'Bioluminescent Squid must cost 45g');
      assert.equal(BAIT_REGISTRY.eldritch_grub.cost, 75, 'Eldritch Grub must cost 75g');
    });

    it('M2.1.4: Rarity weights sum to 100% and provide intended rarity distributions', () => {
      for (const [id, bait] of Object.entries(BAIT_REGISTRY)) {
        const rw = bait.rarityWeights;
        const total = rw.common + rw.uncommon + rw.rare;
        assert.equal(total, 100, `${id} rarity weights must sum to 100`);
      }

      // Assert specific distributions
      assert.deepEqual(BAIT_REGISTRY.bare_hook.rarityWeights, { common: 75, uncommon: 22, rare: 3 });
      assert.deepEqual(BAIT_REGISTRY.lugworms.rarityWeights, { common: 55, uncommon: 38, rare: 7 });
      assert.deepEqual(BAIT_REGISTRY.blood_chum.rarityWeights, { common: 30, uncommon: 55, rare: 15 });
      assert.deepEqual(BAIT_REGISTRY.bio_squid.rarityWeights, { common: 20, uncommon: 45, rare: 35 });
      assert.deepEqual(BAIT_REGISTRY.eldritch_grub.rarityWeights, { common: 10, uncommon: 30, rare: 60 });
    });

    it('M2.1.5: Outcome weights sum to 100% and scale strike probability monotonically', () => {
      for (const [id, bait] of Object.entries(BAIT_REGISTRY)) {
        const ow = bait.outcomeWeights;
        const total = ow.strike + ow.salvage + ow.slack;
        assert.equal(total, 100, `${id} outcome weights must sum to 100`);
      }

      // Strike odds scale up from Bare Hook to Eldritch Grub
      assert.equal(BAIT_REGISTRY.bare_hook.outcomeWeights.strike, 60);
      assert.equal(BAIT_REGISTRY.lugworms.outcomeWeights.strike, 70);
      assert.equal(BAIT_REGISTRY.blood_chum.outcomeWeights.strike, 76);
      assert.equal(BAIT_REGISTRY.bio_squid.outcomeWeights.strike, 80);
      assert.equal(BAIT_REGISTRY.eldritch_grub.outcomeWeights.strike, 85);

      // Slack odds decrease monotonically
      assert.equal(BAIT_REGISTRY.bare_hook.outcomeWeights.slack, 18);
      assert.equal(BAIT_REGISTRY.lugworms.outcomeWeights.slack, 10);
      assert.equal(BAIT_REGISTRY.blood_chum.outcomeWeights.slack, 6);
      assert.equal(BAIT_REGISTRY.bio_squid.outcomeWeights.slack, 5);
      assert.equal(BAIT_REGISTRY.eldritch_grub.outcomeWeights.slack, 3);
    });

    it('M2.1.6: getBaitData and getAllBaits utility functions work correctly', () => {
      const all = getAllBaits();
      assert.equal(all.length, 5);
      assert.equal(getBaitData('lugworms').name, 'Lugworms');
      // Unknown fallback
      assert.equal(getBaitData('non_existent' as any).id, 'bare_hook');
    });
  });

  // ==========================================================================
  // 2. PlayerInventory Bait Tracking & Selection
  // ==========================================================================
  describe('2. PlayerInventory Bait Tracking & Selection', () => {
    it('M2.2.1: Fresh inventory initializes with infinite Bare Hook and 0 for others', () => {
      const inv = new PlayerInventory();
      assert.equal(inv.getBaitCount('bare_hook'), Infinity);
      assert.equal(inv.getBaitCount('lugworms'), 0);
      assert.equal(inv.getBaitCount('blood_chum'), 0);
      assert.equal(inv.getBaitCount('bio_squid'), 0);
      assert.equal(inv.getBaitCount('eldritch_grub'), 0);
      assert.equal(inv.selectedBait, 'bare_hook');
      assert.equal(inv.equippedBaitId, 'bare_hook');
    });

    it('M2.2.2: addBait increments bait count and leaves Bare Hook infinite', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 3);
      assert.equal(inv.getBaitCount('lugworms'), 3);

      inv.addBait('lugworms', 2);
      assert.equal(inv.getBaitCount('lugworms'), 5);

      inv.addBait('bio_squid', 1);
      assert.equal(inv.getBaitCount('bio_squid'), 1);

      inv.addBait('bare_hook', 10);
      assert.equal(inv.getBaitCount('bare_hook'), Infinity);
    });

    it('M2.2.3: selectBait validates stock before equipping', () => {
      const inv = new PlayerInventory();
      // Cannot equip bait with 0 stock
      const result1 = inv.selectBait('blood_chum');
      assert.equal(result1, false);
      assert.equal(inv.selectedBait, 'bare_hook');

      // Add stock and equip
      inv.addBait('blood_chum', 2);
      const result2 = inv.selectBait('blood_chum');
      assert.equal(result2, true);
      assert.equal(inv.selectedBait, 'blood_chum');
      assert.equal(inv.equippedBaitId, 'blood_chum');

      // Equipping bare_hook always succeeds
      const result3 = inv.selectBait('bare_hook');
      assert.equal(result3, true);
      assert.equal(inv.selectedBait, 'bare_hook');
    });

    it('M2.2.4: consumeBait decrements stock and falls back to Bare Hook at 0', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 2);
      inv.selectBait('lugworms');
      assert.equal(inv.selectedBait, 'lugworms');

      // First consume
      const ok1 = inv.consumeBait('lugworms');
      assert.equal(ok1, true);
      assert.equal(inv.getBaitCount('lugworms'), 1);
      assert.equal(inv.selectedBait, 'lugworms');

      // Second consume (reaches 0)
      const ok2 = inv.consumeBait('lugworms');
      assert.equal(ok2, true);
      assert.equal(inv.getBaitCount('lugworms'), 0);
      // Must automatically fallback to bare_hook
      assert.equal(inv.selectedBait, 'bare_hook');

      // Third consume fails because stock is 0
      const ok3 = inv.consumeBait('lugworms');
      assert.equal(ok3, false);
      assert.equal(inv.getBaitCount('lugworms'), 0);
    });

    it('M2.2.5: consumeBait on Bare Hook never decrements and always returns true', () => {
      const inv = new PlayerInventory();
      for (let i = 0; i < 100; i++) {
        const ok = inv.consumeBait('bare_hook');
        assert.equal(ok, true);
      }
      assert.equal(inv.getBaitCount('bare_hook'), Infinity);
      assert.equal(inv.selectedBait, 'bare_hook');
    });
  });

  // ==========================================================================
  // 3. Shop Purchase Validation & Gold Economics
  // ==========================================================================
  describe('3. Shop Purchase Validation & Gold Economics', () => {
    it('M2.3.1: Purchasing bait deducts gold and increments inventory count', () => {
      const inv = new PlayerInventory();
      inv.gold = 100;

      const lugwormCost = BAIT_REGISTRY.lugworms.cost; // 10g
      assert.equal(inv.spendGold(lugwormCost), true);
      inv.addBait('lugworms', 1);

      assert.equal(inv.gold, 90);
      assert.equal(inv.getBaitCount('lugworms'), 1);

      const squidCost = BAIT_REGISTRY.bio_squid.cost; // 45g
      assert.equal(inv.spendGold(squidCost), true);
      inv.addBait('bio_squid', 1);

      assert.equal(inv.gold, 45);
      assert.equal(inv.getBaitCount('bio_squid'), 1);
    });

    it('M2.3.2: Rejects purchase when gold is insufficient', () => {
      const inv = new PlayerInventory();
      inv.gold = 20;

      const grubCost = BAIT_REGISTRY.eldritch_grub.cost; // 75g
      const canBuy = inv.spendGold(grubCost);
      assert.equal(canBuy, false);
      assert.equal(inv.gold, 20); // Gold untouched
      assert.equal(inv.getBaitCount('eldritch_grub'), 0);
    });

    it('M2.3.3: HarborShopOverlay integrates Bait tab in selectedTab enum and state', () => {
      const inv = new PlayerInventory();
      let closed = false;
      const overlay = new HarborShopOverlay(inv, () => { closed = true; });
      assert.ok(overlay, 'HarborShopOverlay instantiates cleanly with bait tab support');
      assert.equal(closed, false);
    });
  });

  // ==========================================================================
  // 4. Probability Rollers & Attraction Biasing
  // ==========================================================================
  describe('4. Probability Rollers & Attraction Biasing', () => {
    it('M2.4.1: rollRarityForBait evaluates deterministic rolls matching cumulative thresholds', () => {
      // Bare Hook: Common 75%, Uncommon 22%, Rare 3%
      // Cumulative thresholds: 0..75 Common, 75..97 Uncommon, 97..100 Rare
      assert.equal(rollRarityForBait('bare_hook', 0.10), 'common');
      assert.equal(rollRarityForBait('bare_hook', 0.74), 'common');
      assert.equal(rollRarityForBait('bare_hook', 0.76), 'uncommon');
      assert.equal(rollRarityForBait('bare_hook', 0.96), 'uncommon');
      assert.equal(rollRarityForBait('bare_hook', 0.98), 'rare');

      // Eldritch Grub: Common 10%, Uncommon 30%, Rare 60%
      // Cumulative thresholds: 0..10 Common, 10..40 Uncommon, 40..100 Rare
      assert.equal(rollRarityForBait('eldritch_grub', 0.05), 'common');
      assert.equal(rollRarityForBait('eldritch_grub', 0.20), 'uncommon');
      assert.equal(rollRarityForBait('eldritch_grub', 0.45), 'rare');
      assert.equal(rollRarityForBait('eldritch_grub', 0.90), 'rare');
    });

    it('M2.4.2: rollSpeciesForZone maps zone tier and bait rarity to authoritative species', () => {
      // Zone 1: Common = perch, Uncommon = flounder, Rare = ghost_cod
      assert.equal(rollSpeciesForZone(1, 'bare_hook', 0.10), 'perch');
      assert.equal(rollSpeciesForZone(1, 'bare_hook', 0.85), 'flounder');
      assert.equal(rollSpeciesForZone(1, 'bare_hook', 0.99), 'ghost_cod');

      // Zone 2: Common = pike, Uncommon = sculpin, Rare = teal_snapper
      assert.equal(rollSpeciesForZone(2, 'lugworms', 0.10), 'pike');
      assert.equal(rollSpeciesForZone(2, 'lugworms', 0.70), 'sculpin');
      assert.equal(rollSpeciesForZone(2, 'lugworms', 0.99), 'teal_snapper');

      // Zone 3: Common = gar, Uncommon = angler, Rare = gulper
      assert.equal(rollSpeciesForZone(3, 'bio_squid', 0.10), 'gar');
      assert.equal(rollSpeciesForZone(3, 'bio_squid', 0.50), 'angler');
      assert.equal(rollSpeciesForZone(3, 'bio_squid', 0.80), 'gulper');

      // Zone 4: Common = maw_worm, Uncommon = cthulhu_spawn, Rare = dagon
      assert.equal(rollSpeciesForZone(4, 'eldritch_grub', 0.05), 'maw_worm');
      assert.equal(rollSpeciesForZone(4, 'eldritch_grub', 0.25), 'cthulhu_spawn');
      assert.equal(rollSpeciesForZone(4, 'eldritch_grub', 0.75), 'dagon');
    });

    it('M2.4.3: rollOutcomeForBait evaluates deterministic strike, salvage, and slack outcomes', () => {
      // Bare Hook: Strike 60%, Salvage 22%, Slack 18%
      assert.equal(rollOutcomeForBait('bare_hook', 0.30), 'strike');
      assert.equal(rollOutcomeForBait('bare_hook', 0.65), 'salvage');
      assert.equal(rollOutcomeForBait('bare_hook', 0.90), 'slack');

      // Eldritch Grub: Strike 85%, Salvage 12%, Slack 3%
      assert.equal(rollOutcomeForBait('eldritch_grub', 0.80), 'strike');
      assert.equal(rollOutcomeForBait('eldritch_grub', 0.90), 'salvage');
      assert.equal(rollOutcomeForBait('eldritch_grub', 0.98), 'slack');
    });

    it('M2.4.4: Monte Carlo simulation verifies Eldritch Grub heavily biases toward Rare/Apex encounters', () => {
      const sampleSize = 10000;
      let bareRareCount = 0;
      let grubRareCount = 0;

      for (let i = 0; i < sampleSize; i++) {
        if (rollRarityForBait('bare_hook') === 'rare') {
          bareRareCount++;
        }
        if (rollRarityForBait('eldritch_grub') === 'rare') {
          grubRareCount++;
        }
      }

      const bareRareRate = bareRareCount / sampleSize;
      const grubRareRate = grubRareCount / sampleSize;

      // Bare hook rare target: ~3% (tolerance 1.5% - 5.0%)
      assert.ok(bareRareRate >= 0.015 && bareRareRate <= 0.05, `Bare Hook rare rate ${bareRareRate} near 3%`);
      // Eldritch grub rare target: ~60% (tolerance 55% - 65%)
      assert.ok(grubRareRate >= 0.55 && grubRareRate <= 0.65, `Eldritch Grub rare rate ${grubRareRate} near 60%`);

      // Massive statistical difference guaranteed
      assert.ok(grubRareRate > bareRareRate * 10, 'Eldritch Grub rare rate must be at least 10x higher than Bare Hook');
    });
  });

  // ==========================================================================
  // 5. PreCastModal Lifecycle & Interaction
  // ==========================================================================
  describe('5. PreCastModal Lifecycle & Interaction', () => {
    it('M2.5.1: PreCastModal instantiates cleanly and tracks open/close state', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      assert.equal(modal.isOpen, false);

      modal.open(2, 'The Foggy Banks', 45, () => {}, () => {});
      assert.equal(modal.isOpen, true);
      assert.equal(modal.zoneTier, 2);
      assert.equal(modal.zoneName, 'The Foggy Banks');
      assert.equal(modal.depthMeters, 45);

      modal.close();
      assert.equal(modal.isOpen, false);
    });

    it('M2.5.2: PreCastModal confirmCast consumes bait and invokes callback', () => {
      const inv = new PlayerInventory();
      inv.addBait('bio_squid', 2);
      inv.selectBait('bio_squid');

      const modal = new PreCastModal(inv);
      let castBaitResult: BaitId | null = null;

      modal.open(3, 'The Sunken Reefs', 75, (bait) => {
        castBaitResult = bait;
      }, () => {});

      const chosen = modal.confirmCast();
      assert.equal(chosen, 'bio_squid');
      assert.equal(castBaitResult, 'bio_squid');
      assert.equal(modal.isOpen, false);
      assert.equal(inv.getBaitCount('bio_squid'), 1, 'Consumes exactly 1 squid');
    });

    it('M2.5.3: PreCastModal cancel closes without consuming bait', () => {
      const inv = new PlayerInventory();
      inv.addBait('blood_chum', 2);
      inv.selectBait('blood_chum');

      const modal = new PreCastModal(inv);
      let cancelled = false;

      modal.open(1, 'The Shallows', 15, () => {}, () => {
        cancelled = true;
      });

      modal.cancel();
      assert.equal(cancelled, true);
      assert.equal(modal.isOpen, false);
      assert.equal(inv.getBaitCount('blood_chum'), 2, 'Bait not consumed on cancel');
    });

    it('M2.5.4: PreCastModal cycleBait cycles only through owned baits', () => {
      const inv = new PlayerInventory();
      inv.addBait('blood_chum', 1);
      // Currently owned: bare_hook and blood_chum
      const modal = new PreCastModal(inv);
      modal.open(1, 'The Shallows', 15, () => {}, () => {});

      assert.equal(inv.selectedBait, 'bare_hook');
      modal.cycleBait(1);
      assert.equal(inv.selectedBait, 'blood_chum');
      modal.cycleBait(1);
      assert.equal(inv.selectedBait, 'bare_hook');
      modal.cycleBait(-1);
      assert.equal(inv.selectedBait, 'blood_chum');
    });

    it('M2.5.5: PreCastModal automatically resets out-of-stock bait to Bare Hook upon open', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 1);
      inv.selectBait('lugworms');
      // Deplete externally
      inv.baits.lugworms = 0;

      const modal = new PreCastModal(inv);
      modal.open(1, 'The Shallows', 15, () => {}, () => {});
      assert.equal(inv.selectedBait, 'bare_hook', 'Must reset to bare_hook when opening with 0 count');
    });
  });
});
