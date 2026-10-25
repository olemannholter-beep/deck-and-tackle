/**
 * Adversarial Challenger Stress Test Suite: Flotsam Salvage & Tripartite Outcome System
 * 
 * Verifies under high adversarial stress:
 * 1. Procedural generation bounds across zones 1-4 (1,000+ rolls per zone, bounds, valid purchasable baits, valid cards)
 * 2. Tripartite probability distribution empirical convergence (50% Gold / 30% Bait / 20% Card)
 * 3. Idempotency stress (100 sequential claim calls on a single overlay instance for Gold, Bait, Card, callbacks)
 * 4. Negative and extreme zoneTier inputs (0, 5, -1, 999, NaN) clamp safety without unhandled exceptions
 * 5. Deterministic floating-point boundary conditions (0.0, 0.499999, 0.5, 0.799999, 0.8, 1.0)
 * 6. Repeated canvas render and lifecycle stress under rapid simulation
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/challenger_salvage_stress.test.ts
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  FlotsamSalvageOverlay,
  generateSalvageReward,
  createSunkenCard,
  SalvageReward
} from '../src/game/ui/FlotsamSalvageOverlay.js';

import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import {
  rollOutcomeForBait,
  rollSpeciesForZone,
  rollRarityForBait,
  BAIT_REGISTRY,
  ALL_BAIT_IDS,
  BaitId,
  FishingOutcomeType
} from '../src/game/battle/BaitData.js';
import {
  MockCanvas,
  MockCanvasRenderingContext2D
} from './test_helpers.js';

// Polyfills for headless testing environment
if (typeof globalThis.window !== 'undefined') {
  (globalThis as any).window.AudioContext = class MockAudioContext {
    state = 'suspended';
    currentTime = 0;
    resume() { return Promise.resolve(); }
    createGain() {
      return {
        connect: () => {},
        gain: {
          value: 1,
          setTargetAtTime: () => {}
        }
      };
    }
    destination = {};
  };
}
if (!(MockCanvasRenderingContext2D.prototype as any).roundRect) {
  (MockCanvasRenderingContext2D.prototype as any).roundRect = function (...args: any[]) {
    this.operations.push({ name: 'roundRect', args });
  };
}

describe('Challenger Stress: Procedural Salvage Generation Bounds & Integrity', () => {
  const ZONE_GOLD_BRACKETS: Record<1 | 2 | 3 | 4, [number, number]> = {
    1: [15, 25],
    2: [25, 40],
    3: [40, 60],
    4: [60, 100]
  };

  const VALID_PURCHASABLE_BAITS: BaitId[] = ['lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];
  const VALID_SUNKEN_CARD_TITLES = new Set([
    'Deep-Sea Dredge',
    'Siren Call',
    'Gilded Harpoon',
    'Barometric Surge',
    'Ghost Anchor'
  ]);

  for (const zone of [1, 2, 3, 4] as const) {
    test(`CHALLENGE 1.${zone}: 1,000 rolls of generateSalvageReward in Zone ${zone} strictly respect bracket constraints`, () => {
      const [expectedMinGold, expectedMaxGold] = ZONE_GOLD_BRACKETS[zone];
      let goldCount = 0;
      let baitCount = 0;
      let cardCount = 0;

      for (let i = 0; i < 1000; i++) {
        const reward = generateSalvageReward(zone);

        assert.ok(reward, `Iteration ${i}: Reward must be returned`);
        assert.ok(['gold', 'bait', 'card'].includes(reward.type), `Iteration ${i}: Unexpected reward type ${reward.type}`);
        assert.ok(typeof reward.title === 'string' && reward.title.length > 0, `Iteration ${i}: Title must be non-empty`);
        assert.ok(typeof reward.description === 'string' && reward.description.length > 0, `Iteration ${i}: Description must be non-empty`);

        if (reward.type === 'gold') {
          goldCount++;
          assert.ok(typeof reward.amount === 'number', `Iteration ${i}: Gold amount must be a number`);
          assert.ok(Number.isInteger(reward.amount), `Iteration ${i}: Gold amount must be an integer: ${reward.amount}`);
          assert.ok(
            reward.amount >= expectedMinGold && reward.amount <= expectedMaxGold,
            `Iteration ${i}: Zone ${zone} gold ${reward.amount} outside bracket [${expectedMinGold}, ${expectedMaxGold}]`
          );
        } else if (reward.type === 'bait') {
          baitCount++;
          assert.ok(reward.baitId, `Iteration ${i}: Bait reward must have baitId`);
          assert.ok(
            VALID_PURCHASABLE_BAITS.includes(reward.baitId),
            `Iteration ${i}: Bait ${reward.baitId} must be a valid purchasable bait`
          );
          assert.ok(
            reward.amount === 1 || reward.amount === 2,
            `Iteration ${i}: Bait amount must be 1 or 2, received ${reward.amount}`
          );
          const baitData = BAIT_REGISTRY[reward.baitId];
          assert.ok(baitData, `Iteration ${i}: Bait registry must contain ${reward.baitId}`);
          assert.ok(baitData.cost > 0, `Iteration ${i}: Bait must be purchasable (cost > 0)`);
        } else if (reward.type === 'card') {
          cardCount++;
          assert.ok(reward.cardTitle, `Iteration ${i}: Card reward must specify cardTitle`);
          assert.ok(
            VALID_SUNKEN_CARD_TITLES.has(reward.cardTitle),
            `Iteration ${i}: Unknown card title ${reward.cardTitle}`
          );
          assert.ok(reward.cardData, `Iteration ${i}: Card reward must contain cardData`);
          assert.equal(reward.amount, 1, `Iteration ${i}: Sunken card reward amount must be 1`);
          assert.ok(reward.cardData.pullDistance >= 0, `Iteration ${i}: Card pullDistance must be >= 0`);
          assert.ok(reward.cardData.staminaCost >= 0, `Iteration ${i}: Card staminaCost must be >= 0`);
          assert.ok(reward.cardData.slackGain >= 0, `Iteration ${i}: Card slackGain must be >= 0`);
        }
      }

      // Verify that across 1,000 rolls all three reward types were generated
      assert.ok(goldCount > 0, `Zone ${zone}: Gold rewards should have been generated`);
      assert.ok(baitCount > 0, `Zone ${zone}: Bait rewards should have been generated`);
      assert.ok(cardCount > 0, `Zone ${zone}: Card rewards should have been generated`);
    });
  }

  test('CHALLENGE 2: Empirical Tripartite Probability Convergence across 10,000 rolls', () => {
    // 50% Gold, 30% Bait, 20% Card
    const TOTAL_ROLLS = 10000;
    const counts = { gold: 0, bait: 0, card: 0 };

    for (let i = 0; i < TOTAL_ROLLS; i++) {
      const reward = generateSalvageReward(1);
      counts[reward.type]++;
    }

    const goldRatio = counts.gold / TOTAL_ROLLS;
    const baitRatio = counts.bait / TOTAL_ROLLS;
    const cardRatio = counts.card / TOTAL_ROLLS;

    // With 10,000 samples, standard deviation is ~0.005. Allow ±3.5% tolerance.
    assert.ok(
      goldRatio >= 0.465 && goldRatio <= 0.535,
      `Gold ratio ${goldRatio.toFixed(3)} outside expected ~0.50 (±0.035)`
    );
    assert.ok(
      baitRatio >= 0.265 && baitRatio <= 0.335,
      `Bait ratio ${baitRatio.toFixed(3)} outside expected ~0.30 (±0.035)`
    );
    assert.ok(
      cardRatio >= 0.165 && cardRatio <= 0.235,
      `Card ratio ${cardRatio.toFixed(3)} outside expected ~0.20 (±0.035)`
    );
  });
});

describe('Challenger Stress: Idempotency of Reward Crediting', () => {
  test('CHALLENGE 3: Calling claim() 100 times in a loop credits Gold exactly ONCE', () => {
    const inventory = new PlayerInventory();
    const START_GOLD = 50;
    inventory.gold = START_GOLD;

    const overlay = new FlotsamSalvageOverlay(inventory);
    const reward: SalvageReward = {
      type: 'gold',
      amount: 40,
      title: 'Strongbox (+40 Sovereigns)',
      description: 'Gold sovereigns recovered.'
    };

    let callbackFired = 0;
    overlay.open(reward, () => {
      callbackFired++;
    });

    assert.equal(overlay.isOpen, true);
    assert.equal(overlay.isClaimed, false);

    // Stress: 100 consecutive claim calls on the single overlay instance
    for (let i = 0; i < 100; i++) {
      overlay.claim();
    }

    // Gold must be credited exactly ONCE: 50 + 40 = 90
    assert.equal(inventory.gold, START_GOLD + 40, `Gold must be credited once; expected 90, got ${inventory.gold}`);
    assert.equal(callbackFired, 1, `Callback must be fired exactly once; fired ${callbackFired} times`);
    assert.equal(overlay.isOpen, false);
    assert.equal(overlay.isClaimed, true);
  });

  test('CHALLENGE 4: Calling claim() 100 times in a loop credits Bait exactly ONCE', () => {
    const inventory = new PlayerInventory();
    assert.equal(inventory.getBaitCount('blood_chum'), 0);

    const overlay = new FlotsamSalvageOverlay(inventory);
    const reward: SalvageReward = {
      type: 'bait',
      baitId: 'blood_chum',
      amount: 2,
      title: 'Waterproof Bait Cask (+2 Blood Chum)',
      description: '+2x Blood Chum!'
    };

    let callbackFired = 0;
    overlay.open(reward, () => {
      callbackFired++;
    });

    for (let i = 0; i < 100; i++) {
      overlay.claim();
    }

    assert.equal(inventory.getBaitCount('blood_chum'), 2, 'Bait must be credited exactly once (2 units)');
    assert.equal(callbackFired, 1, 'Callback must fire exactly once');
  });

  test('CHALLENGE 5: Calling claim() 100 times in a loop adds Card to deck exactly ONCE', () => {
    const inventory = new PlayerInventory();
    const initialDeckCount = inventory.deck.length;

    const overlay = new FlotsamSalvageOverlay(inventory);
    const reward: SalvageReward = {
      type: 'card',
      cardTitle: 'Ghost Anchor',
      amount: 1,
      title: 'Sunken Grimoire Page (+1 [Ghost Anchor])',
      description: 'Card added!'
    };

    let callbackFired = 0;
    overlay.open(reward, () => {
      callbackFired++;
    });

    for (let i = 0; i < 100; i++) {
      overlay.claim();
    }

    assert.equal(inventory.deck.length, initialDeckCount + 1, 'Deck size must increase by exactly 1');
    const matches = inventory.deck.filter(c => c.title === 'Ghost Anchor');
    assert.equal(matches.length, 1, 'Ghost Anchor must appear exactly once');
    assert.equal(callbackFired, 1, 'Callback must fire exactly once');
  });

  test('CHALLENGE 6: Interleaving claim() and dismiss() 100 times still credits exactly ONCE', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 100;

    const overlay = new FlotsamSalvageOverlay(inventory);
    overlay.open({
      type: 'gold',
      amount: 25,
      title: 'Strongbox (+25)',
      description: '+25 Gold'
    });

    for (let i = 0; i < 50; i++) {
      overlay.claim();
      overlay.dismiss();
    }

    assert.equal(inventory.gold, 125, 'Interleaved claim/dismiss must not double-credit');
  });

  test('CHALLENGE 7: Multi-session sequential opening and claiming maintains strict per-reward single credit', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 0;
    const overlay = new FlotsamSalvageOverlay(inventory);

    // Session 1: 15 gold
    overlay.open({ type: 'gold', amount: 15, title: 'Gold 1', description: 'G1' });
    overlay.claim();
    assert.equal(inventory.gold, 15);

    // Session 2: 30 gold
    overlay.open({ type: 'gold', amount: 30, title: 'Gold 2', description: 'G2' });
    overlay.claim();
    assert.equal(inventory.gold, 45);

    // Session 3: 2 lugworms
    overlay.open({ type: 'bait', baitId: 'lugworms', amount: 2, title: 'Bait', description: 'B' });
    overlay.claim();
    assert.equal(inventory.getBaitCount('lugworms'), 2);

    // Attempting further claims while closed must do nothing
    overlay.claim();
    overlay.dismiss();
    assert.equal(inventory.gold, 45);
    assert.equal(inventory.getBaitCount('lugworms'), 2);
  });
});

describe('Challenger Stress: Boundary Values, Clamp Safety & Extreme Inputs', () => {
  test('CHALLENGE 8: ZoneTier = 0 does not throw unhandled exception and yields valid reward', () => {
    assert.doesNotThrow(() => {
      const reward = generateSalvageReward(0 as any);
      assert.ok(reward);
      assert.ok(['gold', 'bait', 'card'].includes(reward.type));
      if (reward.type === 'gold') {
        assert.ok(reward.amount! >= 15 && reward.amount! <= 25, 'Zone 0 gold should safely clamp to fallback Z1');
      }
    });
  });

  test('CHALLENGE 9: ZoneTier = 5 does not throw unhandled exception and yields valid reward', () => {
    assert.doesNotThrow(() => {
      const reward = generateSalvageReward(5 as any);
      assert.ok(reward);
      assert.ok(['gold', 'bait', 'card'].includes(reward.type));
      if (reward.type === 'gold') {
        assert.ok(reward.amount! >= 15, 'Zone 5 gold should produce a valid positive amount');
      }
    });
  });

  test('CHALLENGE 10: Extreme negative, very large, and NaN zone tiers do not crash', () => {
    const testTiers = [-1, -999, 99999, NaN, undefined as any];

    for (const badTier of testTiers) {
      assert.doesNotThrow(() => {
        const reward = generateSalvageReward(badTier);
        assert.ok(reward, `Reward must exist for bad tier: ${badTier}`);
        assert.ok(['gold', 'bait', 'card'].includes(reward.type));
        if (reward.type === 'gold') {
          assert.ok(Number.isFinite(reward.amount));
          assert.ok(reward.amount! > 0);
        }
      }, `Tier ${badTier} must not throw`);
    }
  });

  test('CHALLENGE 11: Floating-point roll boundary extremes (0.0, 0.499999, 0.50, 0.799999, 0.80, 1.0)', () => {
    // 0.0 -> Gold
    const r0 = generateSalvageReward(1, 0.0, 0.0);
    assert.equal(r0.type, 'gold');
    assert.equal(r0.amount, 15); // min gold in Z1

    // 0.4999999 -> Gold
    const rGoldMax = generateSalvageReward(1, 0.4999999, 0.999999);
    assert.equal(rGoldMax.type, 'gold');
    assert.equal(rGoldMax.amount, 25); // max gold in Z1

    // 0.50 -> Bait
    const rBaitMin = generateSalvageReward(1, 0.50, 0.0);
    assert.equal(rBaitMin.type, 'bait');
    assert.equal(rBaitMin.baitId, 'lugworms');
    assert.equal(rBaitMin.amount, 1);

    // 0.50 with subRoll = 0.999999 -> Bait with amount 2
    const rBaitMax = generateSalvageReward(1, 0.50, 0.999999);
    assert.equal(rBaitMax.type, 'bait');
    assert.equal(rBaitMax.amount, 2);

    // 0.7999999 -> Bait
    const rBaitEdge = generateSalvageReward(1, 0.7999999, 0.5);
    assert.equal(rBaitEdge.type, 'bait');

    // 0.80 -> Card
    const rCardMin = generateSalvageReward(1, 0.80, 0.0);
    assert.equal(rCardMin.type, 'card');
    assert.equal(rCardMin.cardTitle, 'Deep-Sea Dredge');

    // 0.80 with subRoll = 0.999999 -> Card (Ghost Anchor)
    const rCardMax = generateSalvageReward(1, 0.80, 0.999999);
    assert.equal(rCardMax.type, 'card');
    assert.equal(rCardMax.cardTitle, 'Ghost Anchor');

    // 1.0 (subRoll = 1.0) -> Card (Ghost Anchor) without out-of-bounds error
    const rCardOver = generateSalvageReward(1, 1.0, 1.0);
    assert.equal(rCardOver.type, 'card');
    assert.ok(rCardOver.cardData);
  });
});

describe('Challenger Stress: Bait Outcome Resolution Stability', () => {
  test('CHALLENGE 12: 5,000 rolls across all 5 baits strictly produce valid outcome types', () => {
    for (const baitId of ALL_BAIT_IDS) {
      for (let i = 0; i < 1000; i++) {
        const outcome = rollOutcomeForBait(baitId);
        assert.ok(
          outcome === 'strike' || outcome === 'salvage' || outcome === 'slack',
          `Bait ${baitId} roll produced invalid outcome: ${outcome}`
        );
      }
    }
  });

  test('CHALLENGE 13: Deterministic boundary rolls for rollOutcomeForBait', () => {
    // Bare hook: strike: 60, salvage: 22, slack: 18 (total 100)
    assert.equal(rollOutcomeForBait('bare_hook', 0.0), 'strike');
    assert.equal(rollOutcomeForBait('bare_hook', 0.599), 'strike');
    assert.equal(rollOutcomeForBait('bare_hook', 0.601), 'salvage');
    assert.equal(rollOutcomeForBait('bare_hook', 0.819), 'salvage');
    assert.equal(rollOutcomeForBait('bare_hook', 0.821), 'slack');
    assert.equal(rollOutcomeForBait('bare_hook', 1.0), 'slack');
  });
});

describe('Challenger Stress: Overlay Canvas Render & Lifecycle Robustness', () => {
  test('CHALLENGE 14: 100 consecutive render cycles with animation updates maintain stability', () => {
    const inventory = new PlayerInventory();
    const overlay = new FlotsamSalvageOverlay(inventory);
    const canvas = new MockCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;

    overlay.open({
      type: 'card',
      cardTitle: 'Siren Call',
      amount: 1,
      title: 'Sunken Grimoire Page (+1 [Siren Call])',
      description: 'Card added'
    });

    assert.doesNotThrow(() => {
      for (let f = 0; f < 100; f++) {
        overlay.update(0.016, 1280, 720);
        overlay.render(ctx as any, 1280, 720);
      }
    });

    assert.ok(ctx.operations.length > 500, 'Render operations should have been recorded across frames');
  });
});
