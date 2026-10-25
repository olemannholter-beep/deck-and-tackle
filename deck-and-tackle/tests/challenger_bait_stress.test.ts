/**
 * Challenger Adversarial Stress Test Suite: Milestone 2 Bait & Inventory Subsystem
 * 
 * Verifies empirical robustness across:
 * 1. Extreme boundary cases: rapid purchases, 1,000,000 gold vs 0 gold, negative & non-finite inputs.
 * 2. Stock exhaustion sequences: acquire, equip, consume to zero, verify fallback to Bare Hook;
 *    consume Bare Hook 500 times, verifying infinite stock invariant without memory leak or crash.
 * 3. Monte Carlo statistical validation (1,000 iterations per test):
 *    - rollOutcomeForBait strike/salvage/slack probability ratios within 99.9% confidence bounds.
 *    - rollRarityForBait common/uncommon/rare distribution within 99.9% confidence bounds.
 *    - rollSpeciesForZone integrity across all 4 radial zones and all 12 species.
 * 4. Fuzzing & edge-case resiliency: out-of-range zone tiers, unowned bait selection attempts,
 *    and PreCastModal state consistency under rapid interaction.
 */

import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Headless polyfills for browser globals (for PreCastModal and HarborShopOverlay)
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
import { ALL_SPECIES_TYPES, ZONE_SPECIES_MAP } from '../src/game/battle/FishData.js';

describe('Adversarial Bait & Inventory Stress Suite (Challenger M2)', () => {

  // ==========================================================================
  // SUITE 1: Extreme Boundary Cases: Rapid Purchases, Huge Wallet & Zero/Negative Gold
  // ==========================================================================
  describe('Suite 1: Extreme Boundary Cases & Gold Economics', () => {

    it('CH.1.1: Rapid purchases with large gold pool (1,000,000g) maintains exact accounting', () => {
      const inventory = new PlayerInventory();
      inventory.gold = 1_000_000;

      const purchaseCount = 5_000;
      const grubCost = BAIT_REGISTRY.eldritch_grub.cost; // 75g

      for (let i = 0; i < purchaseCount; i++) {
        const spent = inventory.spendGold(grubCost);
        assert.equal(spent, true, `Purchase ${i} should succeed`);
        inventory.addBait('eldritch_grub', 1);
      }

      const expectedSpent = purchaseCount * grubCost; // 375,000g
      const expectedRemaining = 1_000_000 - expectedSpent; // 625,000g

      assert.equal(inventory.gold, expectedRemaining, 'Remaining gold must match exact integer arithmetic');
      assert.equal(inventory.getBaitCount('eldritch_grub'), purchaseCount, 'Inventory count must match purchased total');
      assert.equal(inventory.getBaitCount('bare_hook'), Infinity, 'Bare hook must remain Infinity');
    });

    it('CH.1.2: Zero-gold boundary cleanly rejects all paid bait purchases while permitting free Bare Hook', () => {
      const inventory = new PlayerInventory();
      inventory.gold = 0;

      const paidBaits: BaitId[] = ['lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];

      for (const baitId of paidBaits) {
        const cost = BAIT_REGISTRY[baitId].cost;
        assert.ok(cost > 0, `${baitId} cost must be > 0`);
        const canSpend = inventory.spendGold(cost);
        assert.equal(canSpend, false, `Must reject purchase of ${baitId} when wallet has 0g`);
        assert.equal(inventory.gold, 0, 'Wallet gold must remain exactly 0');
        assert.equal(inventory.getBaitCount(baitId), 0, `Count for ${baitId} must remain 0`);
      }

      // Bare Hook costs 0g
      const bareCost = BAIT_REGISTRY.bare_hook.cost;
      assert.equal(bareCost, 0, 'Bare hook cost is 0g');
      const spendBare = inventory.spendGold(bareCost);
      assert.equal(spendBare, true, 'spendGold(0) succeeds');
      inventory.addBait('bare_hook', 1);
      assert.equal(inventory.gold, 0, 'Wallet gold stays 0 after 0g deduction');
      assert.equal(inventory.getBaitCount('bare_hook'), Infinity, 'Bare hook stays Infinity');
    });

    it('CH.1.3: Insufficient gold boundary with 1g shortfall rejects transaction atomically', () => {
      const inventory = new PlayerInventory();

      for (const [id, bait] of Object.entries(BAIT_REGISTRY)) {
        if (bait.cost === 0) continue;
        inventory.gold = bait.cost - 1; // 1 gold shortfall

        const spent = inventory.spendGold(bait.cost);
        assert.equal(spent, false, `Purchase of ${id} with cost ${bait.cost} must fail with ${inventory.gold}g`);
        assert.equal(inventory.gold, bait.cost - 1, 'Gold must remain untouched on failed purchase');
      }
    });

    it('CH.1.4: Handling negative amounts in addGold and spendGold does not throw or corrupt state', () => {
      const inventory = new PlayerInventory();
      inventory.gold = 100;

      // Negative addGold
      inventory.addGold(-30);
      assert.equal(inventory.gold, 70, 'addGold with negative value decrements gold cleanly');

      // Negative spendGold: gold >= amount check when amount is negative is mathematically true
      // Verifying stability: it completes without exception
      const spentNegative = inventory.spendGold(-10);
      assert.equal(spentNegative, true);
      assert.equal(inventory.gold, 80, 'spendGold(-10) computes 70 - (-10) = 80 cleanly without NaN');

      // Negative addBait: ensure stock doesn't crash getters or selectBait
      inventory.addBait('lugworms', -5);
      assert.ok(inventory.getBaitCount('lugworms') <= 0, 'Negative addBait yields non-positive count');
      assert.equal(inventory.selectBait('lugworms'), false, 'selectBait rejects bait with non-positive count');
      assert.equal(inventory.consumeBait('lugworms'), false, 'consumeBait rejects bait with non-positive count');
    });

    it('CH.1.5: Handling non-existent and malformed bait IDs falls back safely', () => {
      const inventory = new PlayerInventory();

      // getBaitData with unknown ID falls back to bare_hook
      const fallbackData = getBaitData('unknown_bait_xyz' as BaitId);
      assert.equal(fallbackData.id, 'bare_hook', 'Unknown bait ID falls back to bare_hook');

      // getBaitCount with unknown ID returns 0
      assert.equal(inventory.getBaitCount('unknown_bait_xyz' as BaitId), 0);

      // selectBait with unknown ID returns false
      assert.equal(inventory.selectBait('unknown_bait_xyz' as BaitId), false);

      // consumeBait with unknown ID returns false
      assert.equal(inventory.consumeBait('unknown_bait_xyz' as BaitId), false);
    });
  });

  // ==========================================================================
  // SUITE 2: Stock Exhaustion Sequences & Infinite Bare Hook Invariant
  // ==========================================================================
  describe('Suite 2: Stock Exhaustion Sequences & Bare Hook Invariant', () => {

    it('CH.2.1: Buy 1, equip, consume 1 -> stock drops to 0 and auto-reverts to Bare Hook', () => {
      const consumableBaits: BaitId[] = ['lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];

      for (const baitId of consumableBaits) {
        const inventory = new PlayerInventory();
        assert.equal(inventory.selectedBait, 'bare_hook');

        // 1. Buy 1
        inventory.addBait(baitId, 1);
        assert.equal(inventory.getBaitCount(baitId), 1);

        // 2. Equip
        const selected = inventory.selectBait(baitId);
        assert.equal(selected, true, `Should successfully equip ${baitId}`);
        assert.equal(inventory.selectedBait, baitId);
        assert.equal(inventory.equippedBaitId, baitId);

        // 3. Consume 1
        const consumed = inventory.consumeBait(baitId);
        assert.equal(consumed, true, `Should successfully consume ${baitId}`);
        assert.equal(inventory.getBaitCount(baitId), 0, `Count of ${baitId} must now be 0`);

        // 4. Fallback verification
        assert.equal(inventory.selectedBait, 'bare_hook', `Must auto-revert to bare_hook after consuming last ${baitId}`);
        assert.equal(inventory.equippedBaitId, 'bare_hook');

        // 5. Subsequent consume fails
        const consumedAgain = inventory.consumeBait(baitId);
        assert.equal(consumedAgain, false, `Consuming ${baitId} at 0 stock must fail`);
        assert.equal(inventory.getBaitCount(baitId), 0);

        // 6. Cannot re-select depleted bait
        const reselected = inventory.selectBait(baitId);
        assert.equal(reselected, false, `Cannot select ${baitId} at 0 stock`);
        assert.equal(inventory.selectedBait, 'bare_hook');
      }
    });

    it('CH.2.2: Consuming Bare Hook 500 times preserves Infinity count with 0 crashes', () => {
      const inventory = new PlayerInventory();
      assert.equal(inventory.getBaitCount('bare_hook'), Infinity);

      for (let i = 0; i < 500; i++) {
        const consumed = inventory.consumeBait('bare_hook');
        assert.equal(consumed, true, `Bare hook consume #${i + 1} must return true`);
        assert.equal(inventory.getBaitCount('bare_hook'), Infinity, `Bare hook count must stay Infinity at step ${i}`);
        assert.equal(inventory.selectedBait, 'bare_hook', 'Selected bait must remain bare_hook');
      }

      // Add bait to bare_hook has no effect on Infinity
      inventory.addBait('bare_hook', 10);
      assert.equal(inventory.getBaitCount('bare_hook'), Infinity, 'Bare hook count remains Infinity after addBait');
    });

    it('CH.2.3: Consuming other bait does NOT reset selectedBait if a different bait is equipped', () => {
      const inventory = new PlayerInventory();
      inventory.addBait('lugworms', 1);
      inventory.addBait('blood_chum', 1);

      // Equip blood_chum
      inventory.selectBait('blood_chum');
      assert.equal(inventory.selectedBait, 'blood_chum');

      // Consume lugworms in background
      const consumed = inventory.consumeBait('lugworms');
      assert.equal(consumed, true);
      assert.equal(inventory.getBaitCount('lugworms'), 0);

      // Selected bait should STILL be blood_chum, not bare_hook!
      assert.equal(inventory.selectedBait, 'blood_chum', 'Selected bait must remain blood_chum when unequipped bait depletes');
    });

    it('CH.2.4: Rapid interleaved add/consume operations maintain consistent state', () => {
      const inventory = new PlayerInventory();

      for (let i = 0; i < 1_000; i++) {
        inventory.addBait('bio_squid', 2);
        assert.equal(inventory.consumeBait('bio_squid'), true);
        assert.equal(inventory.getBaitCount('bio_squid'), i + 1);
      }

      assert.equal(inventory.getBaitCount('bio_squid'), 1_000);
      inventory.selectBait('bio_squid');

      // Drain all 1,000
      for (let i = 0; i < 1_000; i++) {
        assert.equal(inventory.consumeBait('bio_squid'), true);
      }

      assert.equal(inventory.getBaitCount('bio_squid'), 0);
      assert.equal(inventory.selectedBait, 'bare_hook', 'Reverts to bare_hook once all 1000 are consumed');
    });
  });

  // ==========================================================================
  // SUITE 3: Monte Carlo Statistical Validation (1,000 Iterations per Test, <1s runtime)
  // ==========================================================================
  describe('Suite 3: Monte Carlo Statistical Validation', () => {

    /**
     * Statistical bounds helper:
     * For N trials with probability p, mean = N*p, stdDev = sqrt(N*p*(1-p)).
     * For 99.9% statistical confidence (two-tailed), Z = 3.29.
     * With Bonferroni margin for multiple checks, we use Z = 3.6.
     */
    function getConfidenceBounds(trials: number, prob: number, z: number = 3.6): { min: number; max: number } {
      const mean = trials * prob;
      const sigma = Math.sqrt(trials * prob * (1 - prob));
      const margin = z * sigma;
      return {
        min: Math.floor(Math.max(0, mean - margin)),
        max: Math.ceil(Math.min(trials, mean + margin))
      };
    }

    it('CH.3.1: rollOutcomeForBait matches expected strike/salvage/slack probability within 99.9% CI (1000 iterations each)', () => {
      const N = 1_000;
      const startTime = Date.now();

      for (const baitId of ALL_BAIT_IDS) {
        const bait = BAIT_REGISTRY[baitId];
        const counts = { strike: 0, salvage: 0, slack: 0 };

        for (let i = 0; i < N; i++) {
          const outcome = rollOutcomeForBait(baitId);
          counts[outcome]++;
        }

        assert.equal(counts.strike + counts.salvage + counts.slack, N, 'Outcome sum must equal N');

        // Check each outcome against confidence bounds
        const pStrike = bait.outcomeWeights.strike / 100;
        const pSalvage = bait.outcomeWeights.salvage / 100;
        const pSlack = bait.outcomeWeights.slack / 100;

        const strikeBounds = getConfidenceBounds(N, pStrike);
        const salvageBounds = getConfidenceBounds(N, pSalvage);
        const slackBounds = getConfidenceBounds(N, pSlack);

        assert.ok(
          counts.strike >= strikeBounds.min && counts.strike <= strikeBounds.max,
          `${baitId} strike count ${counts.strike} must be within [${strikeBounds.min}, ${strikeBounds.max}] (expected ~${Math.round(N * pStrike)})`
        );
        assert.ok(
          counts.salvage >= salvageBounds.min && counts.salvage <= salvageBounds.max,
          `${baitId} salvage count ${counts.salvage} must be within [${salvageBounds.min}, ${salvageBounds.max}] (expected ~${Math.round(N * pSalvage)})`
        );
        assert.ok(
          counts.slack >= slackBounds.min && counts.slack <= slackBounds.max,
          `${baitId} slack count ${counts.slack} must be within [${slackBounds.min}, ${slackBounds.max}] (expected ~${Math.round(N * pSlack)})`
        );
      }

      const elapsed = Date.now() - startTime;
      assert.ok(elapsed < 1000, `Monte Carlo rollOutcome took ${elapsed}ms, must run in <1000ms`);
    });

    it('CH.3.2: rollOutcomeForBait exhibits monotonic strike progression and slack reduction across tiers', () => {
      // Deterministic evaluation at key points to verify monotonic curve
      const baitsInAscendingTier: BaitId[] = ['bare_hook', 'lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];

      let prevStrikeWeight = -1;
      let prevSlackWeight = 999;

      for (const id of baitsInAscendingTier) {
        const bait = BAIT_REGISTRY[id];
        assert.ok(
          bait.outcomeWeights.strike > prevStrikeWeight,
          `${id} strike weight (${bait.outcomeWeights.strike}) must exceed prior tier (${prevStrikeWeight})`
        );
        assert.ok(
          bait.outcomeWeights.slack < prevSlackWeight,
          `${id} slack weight (${bait.outcomeWeights.slack}) must be lower than prior tier (${prevSlackWeight})`
        );
        prevStrikeWeight = bait.outcomeWeights.strike;
        prevSlackWeight = bait.outcomeWeights.slack;
      }
    });

    it('CH.3.3: rollRarityForBait generates common/uncommon/rare distribution within 99.9% CI (1000 iterations each)', () => {
      const N = 1_000;
      const startTime = Date.now();

      for (const baitId of ALL_BAIT_IDS) {
        const bait = BAIT_REGISTRY[baitId];
        const counts = { common: 0, uncommon: 0, rare: 0 };

        for (let i = 0; i < N; i++) {
          const rarity = rollRarityForBait(baitId);
          counts[rarity]++;
        }

        assert.equal(counts.common + counts.uncommon + counts.rare, N, 'Rarity sum must equal N');

        const pCommon = bait.rarityWeights.common / 100;
        const pUncommon = bait.rarityWeights.uncommon / 100;
        const pRare = bait.rarityWeights.rare / 100;

        const commonBounds = getConfidenceBounds(N, pCommon);
        const uncommonBounds = getConfidenceBounds(N, pUncommon);
        const rareBounds = getConfidenceBounds(N, pRare);

        assert.ok(
          counts.common >= commonBounds.min && counts.common <= commonBounds.max,
          `${baitId} common count ${counts.common} must be in [${commonBounds.min}, ${commonBounds.max}] (expected ~${Math.round(N * pCommon)})`
        );
        assert.ok(
          counts.uncommon >= uncommonBounds.min && counts.uncommon <= uncommonBounds.max,
          `${baitId} uncommon count ${counts.uncommon} must be in [${uncommonBounds.min}, ${uncommonBounds.max}] (expected ~${Math.round(N * pUncommon)})`
        );
        assert.ok(
          counts.rare >= rareBounds.min && counts.rare <= rareBounds.max,
          `${baitId} rare count ${counts.rare} must be in [${rareBounds.min}, ${rareBounds.max}] (expected ~${Math.round(N * pRare)})`
        );
      }

      const elapsed = Date.now() - startTime;
      assert.ok(elapsed < 1000, `Monte Carlo rollRarity took ${elapsed}ms, must run in <1000ms`);
    });

    it('CH.3.4: rollSpeciesForZone always returns valid species across all 4 zone tiers for all rarities (1000 rolls/zone)', () => {
      const N = 1_000;
      const zoneTiers: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

      for (const zoneTier of zoneTiers) {
        const zoneConfig = ZONE_SPECIES_MAP[zoneTier];
        const validSpeciesInZone = [zoneConfig.common, zoneConfig.uncommon, zoneConfig.rare];

        for (const baitId of ALL_BAIT_IDS) {
          for (let i = 0; i < N / 4; i++) { // 250 rolls per bait per zone = 1000 rolls per zone
            const species = rollSpeciesForZone(zoneTier, baitId);

            // 1. Must be recognized species type
            assert.ok(ALL_SPECIES_TYPES.includes(species), `Species ${species} must be in ALL_SPECIES_TYPES`);

            // 2. Must strictly belong to this zone tier's pool
            assert.ok(
              validSpeciesInZone.includes(species),
              `Species ${species} rolled in zone ${zoneTier} must belong to ${JSON.stringify(validSpeciesInZone)}`
            );
          }
        }
      }
    });

    it('CH.3.5: Eldritch Grub yields ~60% apex/rare catches in Zone 4 (Dagon) compared to Bare Hook ~3%', () => {
      const N = 1_000;

      let dagonWithGrub = 0;
      let dagonWithBareHook = 0;

      for (let i = 0; i < N; i++) {
        if (rollSpeciesForZone(4, 'eldritch_grub') === 'dagon') dagonWithGrub++;
        if (rollSpeciesForZone(4, 'bare_hook') === 'dagon') dagonWithBareHook++;
      }

      // Grub rare expected ~600 [540, 660]
      assert.ok(dagonWithGrub >= 530 && dagonWithGrub <= 670, `Grub Dagon count ${dagonWithGrub} must be ~600`);

      // Bare hook rare expected ~30 [10, 55]
      assert.ok(dagonWithBareHook >= 10 && dagonWithBareHook <= 60, `Bare hook Dagon count ${dagonWithBareHook} must be ~30`);

      // Grub must produce vastly more apex catches
      assert.ok(
        dagonWithGrub > dagonWithBareHook * 8,
        `Eldritch Grub (${dagonWithGrub}) must produce >8x more apex encounters than Bare Hook (${dagonWithBareHook})`
      );
    });
  });

  // ==========================================================================
  // SUITE 4: Boundary Fuzzing & Defensive Robustness
  // ==========================================================================
  describe('Suite 4: Boundary Fuzzing & Defensive Robustness', () => {

    it('CH.4.1: rollSpeciesForZone clamps out-of-range zone tiers safely (0, -10, 5, 999)', () => {
      // Zone 0 should clamp to Zone 1 species (perch, flounder, ghost_cod)
      const sp0 = rollSpeciesForZone(0 as any, 'bare_hook', 0.1);
      assert.equal(sp0, 'perch', 'Zone 0 must clamp to zone 1 common (perch)');

      // Negative zone should clamp to Zone 1
      const spNeg = rollSpeciesForZone(-10 as any, 'bare_hook', 0.1);
      assert.equal(spNeg, 'perch', 'Negative zone must clamp to zone 1');

      // Zone 5 should clamp to Zone 4 species (maw_worm, cthulhu_spawn, dagon)
      const sp5 = rollSpeciesForZone(5 as any, 'eldritch_grub', 0.99);
      assert.equal(sp5, 'dagon', 'Zone 5 must clamp to zone 4 rare (dagon)');

      // Zone 999 should clamp to Zone 4
      const sp999 = rollSpeciesForZone(999 as any, 'bare_hook', 0.1);
      assert.equal(sp999, 'maw_worm', 'Zone 999 must clamp to zone 4 common (maw_worm)');
    });

    it('CH.4.2: Deterministic roll boundary checks in rollRarityForBait (0.0, 1.0, and edge boundaries)', () => {
      // 0.0 roll must yield common
      for (const baitId of ALL_BAIT_IDS) {
        assert.equal(rollRarityForBait(baitId, 0.0), 'common', `${baitId} at roll 0.0 must be common`);
      }

      // Exact boundary tests for Eldritch Grub (common: 10, uncommon: 30, rare: 60)
      // roll = 0.09 -> common (9 < 10)
      assert.equal(rollRarityForBait('eldritch_grub', 0.09), 'common');
      // roll = 0.10 -> uncommon (10 is not < 10, but < 40)
      assert.equal(rollRarityForBait('eldritch_grub', 0.10), 'uncommon');
      // roll = 0.39 -> uncommon (39 < 40)
      assert.equal(rollRarityForBait('eldritch_grub', 0.39), 'uncommon');
      // roll = 0.40 -> rare (40 is not < 40)
      assert.equal(rollRarityForBait('eldritch_grub', 0.40), 'rare');
      // roll = 1.0 -> rare
      assert.equal(rollRarityForBait('eldritch_grub', 1.0), 'rare');
    });

    it('CH.4.3: Deterministic roll boundary checks in rollOutcomeForBait (0.0, 1.0, exact cutoffs)', () => {
      // Bare Hook: strike: 60, salvage: 22, slack: 18
      assert.equal(rollOutcomeForBait('bare_hook', 0.0), 'strike');
      assert.equal(rollOutcomeForBait('bare_hook', 0.59), 'strike');
      assert.equal(rollOutcomeForBait('bare_hook', 0.60), 'salvage');
      assert.equal(rollOutcomeForBait('bare_hook', 0.81), 'salvage');
      assert.equal(rollOutcomeForBait('bare_hook', 0.82), 'slack');
      assert.equal(rollOutcomeForBait('bare_hook', 1.0), 'slack');
    });

    it('CH.4.4: PreCastModal handles zero-stock baits and prevents illegal casts', () => {
      const inventory = new PlayerInventory();
      // Only Bare Hook has stock (Infinity); other baits have 0

      let castTriggered = false;
      let castBaitId: BaitId | null = null;

      const modal = new PreCastModal(inventory);

      // Open at Zone 2
      modal.open(2, 'The Foggy Banks', 45, (bait) => {
        castTriggered = true;
        castBaitId = bait;
      }, () => {});

      assert.equal(modal.isOpen, true);

      // Verify initial bait is Bare Hook
      assert.equal(inventory.selectedBait, 'bare_hook');

      // Cycle forward: since no other bait has stock, cycleBait must stay on bare_hook
      modal.cycleBait(1);
      assert.equal(inventory.selectedBait, 'bare_hook', 'Cycling when no other bait owned must stay on bare_hook');

      modal.cycleBait(-1);
      assert.equal(inventory.selectedBait, 'bare_hook');

      // Confirm cast with Bare Hook
      const chosen = modal.confirmCast();
      assert.equal(chosen, 'bare_hook');
      assert.equal(castTriggered, true);
      assert.equal(castBaitId, 'bare_hook');
      assert.equal(modal.isOpen, false);
      assert.equal(inventory.getBaitCount('bare_hook'), Infinity);
    });

    it('CH.4.5: PreCastModal dismiss via cancel closes cleanly without consuming any bait', () => {
      const inventory = new PlayerInventory();
      inventory.addBait('blood_chum', 3);
      inventory.selectBait('blood_chum');

      let castTriggered = false;
      let cancelTriggered = false;
      const modal = new PreCastModal(inventory);

      modal.open(3, 'The Sunken Reefs', 75, () => {
        castTriggered = true;
      }, () => {
        cancelTriggered = true;
      });

      assert.equal(modal.isOpen, true);

      modal.cancel();
      assert.equal(modal.isOpen, false);
      assert.equal(cancelTriggered, true, 'Cancel callback must fire');
      assert.equal(castTriggered, false, 'Cancel must not trigger onCastCallback');
      assert.equal(inventory.getBaitCount('blood_chum'), 3, 'Bait count must not decrement on cancel');
      assert.equal(inventory.selectedBait, 'blood_chum', 'Equipped bait remains intact');
    });

    it('CH.4.6: Fuzzing non-finite numbers (NaN, Infinity, -Infinity) in roll functions does not throw', () => {
      const nonFinites = [NaN, Infinity, -Infinity];

      for (const val of nonFinites) {
        // rollRarityForBait
        for (const baitId of ALL_BAIT_IDS) {
          assert.doesNotThrow(() => {
            const rarity = rollRarityForBait(baitId, val);
            assert.ok(['common', 'uncommon', 'rare'].includes(rarity));
          }, `rollRarityForBait must handle ${val} without error`);
        }

        // rollOutcomeForBait
        for (const baitId of ALL_BAIT_IDS) {
          assert.doesNotThrow(() => {
            const outcome = rollOutcomeForBait(baitId, val);
            assert.ok(['strike', 'salvage', 'slack'].includes(outcome));
          }, `rollOutcomeForBait must handle ${val} without error`);
        }

        // rollSpeciesForZone
        assert.doesNotThrow(() => {
          const sp = rollSpeciesForZone(val as any, 'bare_hook', val);
          assert.ok(ALL_SPECIES_TYPES.includes(sp));
        }, `rollSpeciesForZone must handle zoneTier=${val} without error`);
      }
    });

    it('CH.4.7: PreCastModal bidirectional cycling wraps cleanly across multiple owned baits', () => {
      const inventory = new PlayerInventory();
      inventory.addBait('lugworms', 5);
      inventory.addBait('eldritch_grub', 2);
      // Owned baits: bare_hook, lugworms, eldritch_grub

      const modal = new PreCastModal(inventory);
      modal.open(1, 'The Shallows', 15, () => {}, () => {});

      assert.equal(inventory.selectedBait, 'bare_hook');

      // Forward cycle
      modal.cycleBait(1);
      assert.equal(inventory.selectedBait, 'lugworms');
      modal.cycleBait(1);
      assert.equal(inventory.selectedBait, 'eldritch_grub');
      modal.cycleBait(1);
      assert.equal(inventory.selectedBait, 'bare_hook', 'Should wrap around back to bare_hook');

      // Reverse cycle
      modal.cycleBait(-1);
      assert.equal(inventory.selectedBait, 'eldritch_grub', 'Reverse cycle wraps to last owned bait');
      modal.cycleBait(-1);
      assert.equal(inventory.selectedBait, 'lugworms');
      modal.cycleBait(-1);
      assert.equal(inventory.selectedBait, 'bare_hook');
    });

    it('CH.4.8: PreCastModal automatically resets unowned or corrupted selectedBait to Bare Hook on open', () => {
      const inventory = new PlayerInventory();
      // Force selectedBait to a paid bait with 0 count
      inventory.selectedBait = 'bio_squid';
      assert.equal(inventory.getBaitCount('bio_squid'), 0);

      const modal = new PreCastModal(inventory);
      modal.open(2, 'The Foggy Banks', 45, () => {}, () => {});

      assert.equal(
        inventory.selectedBait,
        'bare_hook',
        'PreCastModal.open() must sanitize and reset 0-stock bait to bare_hook'
      );
    });
  });
});

