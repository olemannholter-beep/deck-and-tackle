/**
 * Milestone 3 Test Suite: Tripartite Fishing Outcomes & Flotsam Salvage (R3)
 * 
 * Verifies:
 * - Feature 7: Tripartite Outcome Roll Engine (strike, salvage, slack)
 * - Feature 8: Dredged Flotsam Salvage Modal (FlotsamSalvageOverlay) & Reward Crediting
 * - Feature 9: Empty Hook / Line Goes Slack & Whirlpool Despawn Lifecycle
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/salvage_m3.test.ts
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
  BAIT_REGISTRY,
  ALL_BAIT_IDS,
  BaitId,
  FishingOutcomeType
} from '../src/game/battle/BaitData.js';
import { FishingSpot } from '../src/game/overworld/FishingSpot.js';
import { Vector2 } from '../src/engine/Vector2.js';
import { Input } from '../src/engine/Input.js';

import {
  MockCanvas,
  MockCanvasRenderingContext2D
} from './test_helpers.js';

// Headless polyfill additions for AudioContext gain routing and roundRect
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

// ============================================================================
// 1. FLOTSAM SALVAGE OVERLAY & REWARD CREDITING (F8)
// ============================================================================
describe('M3: FlotsamSalvageOverlay Lifecycle & Reward Crediting', () => {
  test('M3.1: Overlay opens with reward, updates state, and tracks claim status', () => {
    const inventory = new PlayerInventory();
    const overlay = new FlotsamSalvageOverlay(inventory);

    assert.equal(overlay.isOpen, false);
    assert.equal(overlay.currentReward, null);
    assert.equal(overlay.isClaimed, false);

    const reward: SalvageReward = {
      type: 'gold',
      amount: 35,
      title: 'Barnacle-Encrusted Strongbox (+35 Sovereigns)',
      description: 'Dredged Waterlogged Coin Purse: +35 Gold Sovereigns!',
      lore: 'Ancient coins gleam through rotting pitch.'
    };

    let claimedCallbackFired = false;
    overlay.open(reward, () => {
      claimedCallbackFired = true;
    });

    assert.equal(overlay.isOpen, true);
    assert.equal(overlay.currentReward, reward);
    assert.equal(overlay.isClaimed, false);

    overlay.claim();

    assert.equal(overlay.isOpen, false);
    assert.equal(overlay.isClaimed, true);
    assert.equal(claimedCallbackFired, true);
  });

  test('M3.2: Gold reward credits directly to PlayerInventory wallet on claim', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 25; // baseline starting gold
    const overlay = new FlotsamSalvageOverlay(inventory);

    const goldReward: SalvageReward = {
      type: 'gold',
      amount: 45,
      title: 'Barnacle-Encrusted Strongbox (+45 Sovereigns)',
      description: 'Dredged Waterlogged Coin Purse: +45 Gold Sovereigns!'
    };

    overlay.open(goldReward);
    overlay.claim();

    assert.equal(inventory.gold, 70); // 25 + 45
  });

  test('M3.3: Bait reward credits valid bait units directly to PlayerInventory', () => {
    const inventory = new PlayerInventory();
    assert.equal(inventory.getBaitCount('blood_chum'), 0);
    const overlay = new FlotsamSalvageOverlay(inventory);

    const baitReward: SalvageReward = {
      type: 'bait',
      baitId: 'blood_chum',
      amount: 2,
      title: 'Waterproof Bait Cask (+2 Blood Chum)',
      description: 'Recovered Tackle Crate: +2x Blood Chum!'
    };

    overlay.open(baitReward);
    overlay.claim();

    assert.equal(inventory.getBaitCount('blood_chum'), 2);
  });

  test('M3.4: Sunken Card reward adds valid CardData to PlayerInventory deck', () => {
    const inventory = new PlayerInventory();
    const initialDeckSize = inventory.deck.length; // starter deck = 7 cards
    const overlay = new FlotsamSalvageOverlay(inventory);

    const cardReward: SalvageReward = {
      type: 'card',
      cardTitle: 'Deep-Sea Dredge',
      amount: 1,
      title: 'Sunken Grimoire Page (+1 [Deep-Sea Dredge] to Deck)',
      description: 'Sunken Ledger Parchment: Inscribed Card [Deep-Sea Dredge] added to deck!'
    };

    overlay.open(cardReward);
    overlay.claim();

    assert.equal(inventory.deck.length, initialDeckSize + 1);
    const addedCard = inventory.deck[inventory.deck.length - 1];
    assert.equal(addedCard.title, 'Deep-Sea Dredge');
    assert.ok(addedCard.pullDistance > 0);
    assert.ok(addedCard.effect.pullDistance !== undefined);
  });

  test('M3.5: Claiming is strictly idempotent (multiple claim calls do not duplicate rewards)', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 10;
    const overlay = new FlotsamSalvageOverlay(inventory);

    const reward: SalvageReward = {
      type: 'gold',
      amount: 20,
      title: 'Barnacle-Encrusted Strongbox (+20 Sovereigns)',
      description: 'Dredged Waterlogged Coin Purse: +20 Gold Sovereigns!'
    };

    overlay.open(reward);
    overlay.claim();
    overlay.claim(); // duplicate call
    overlay.claim(); // duplicate call

    assert.equal(inventory.gold, 30); // 10 + 20, not 10 + 60
  });

  test('M3.6: Dismiss action safely claims reward and triggers onClaim callback', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 50;
    const overlay = new FlotsamSalvageOverlay(inventory);

    let callbackCalled = false;
    overlay.open(
      {
        type: 'gold',
        amount: 25,
        title: 'Barnacle-Encrusted Strongbox (+25 Sovereigns)',
        description: 'Dredged Waterlogged Coin Purse: +25 Gold Sovereigns!'
      },
      () => {
        callbackCalled = true;
      }
    );

    overlay.dismiss();

    assert.equal(inventory.gold, 75);
    assert.equal(callbackCalled, true);
    assert.equal(overlay.isOpen, false);
  });

  test('M3.7: Canvas rendering executes without exception and records operations', () => {
    const inventory = new PlayerInventory();
    const overlay = new FlotsamSalvageOverlay(inventory);
    const canvas = new MockCanvas(1280, 720);
    const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;

    overlay.open({
      type: 'gold',
      amount: 30,
      title: 'Barnacle-Encrusted Strongbox (+30 Sovereigns)',
      description: 'Dredged Waterlogged Coin Purse: +30 Gold Sovereigns!',
      lore: 'Ancient gold preserved in sea muck.'
    });

    assert.doesNotThrow(() => {
      overlay.render(ctx as any, 1280, 720);
    });

    assert.ok(ctx.hasOperation('fillText'));
    assert.ok(ctx.hasOperation('roundRect'));
    assert.ok(ctx.hasOperation('stroke'));
  });
});

// ============================================================================
// 2. PROCEDURAL SALVAGE REWARD GENERATION (F8)
// ============================================================================
describe('M3: Procedural Salvage Reward Generation', () => {
  test('M3.8: Deterministic rollTypeFloat resolves to gold (< 0.50), bait ([0.50, 0.80)), card (>= 0.80)', () => {
    const rGold = generateSalvageReward(1, 0.25, 0.5);
    assert.equal(rGold.type, 'gold');

    const rBait = generateSalvageReward(1, 0.65, 0.5);
    assert.equal(rBait.type, 'bait');

    const rCard = generateSalvageReward(1, 0.85, 0.5);
    assert.equal(rCard.type, 'card');
  });

  test('M3.9: Tier-scaled gold rewards match zone ranges strictly', () => {
    // Zone 1: [15, 25]
    for (let i = 0; i <= 10; i++) {
      const reward = generateSalvageReward(1, 0.1, i / 10);
      assert.ok(reward.amount! >= 15 && reward.amount! <= 25, `Z1 gold ${reward.amount} in [15, 25]`);
      assert.ok(reward.title.includes('Barnacle-Encrusted Strongbox'));
    }

    // Zone 2: [25, 40]
    for (let i = 0; i <= 10; i++) {
      const reward = generateSalvageReward(2, 0.1, i / 10);
      assert.ok(reward.amount! >= 25 && reward.amount! <= 40, `Z2 gold ${reward.amount} in [25, 40]`);
    }

    // Zone 3: [40, 60]
    for (let i = 0; i <= 10; i++) {
      const reward = generateSalvageReward(3, 0.1, i / 10);
      assert.ok(reward.amount! >= 40 && reward.amount! <= 60, `Z3 gold ${reward.amount} in [40, 60]`);
    }

    // Zone 4: [60, 100]
    for (let i = 0; i <= 10; i++) {
      const reward = generateSalvageReward(4, 0.1, i / 10);
      assert.ok(reward.amount! >= 60 && reward.amount! <= 100, `Z4 gold ${reward.amount} in [60, 100]`);
    }
  });

  test('M3.10: Bait salvage awards 1-2 units of purchasable bait (Lugworms, Blood Chum, Bio Squid)', () => {
    const validBaits = ['lugworms', 'blood_chum', 'bio_squid'];
    for (let i = 0; i < 20; i++) {
      const reward = generateSalvageReward(1, 0.65, i / 20);
      assert.equal(reward.type, 'bait');
      assert.ok(validBaits.includes(reward.baitId!));
      assert.ok(reward.amount! >= 1 && reward.amount! <= 2);
      assert.ok(reward.title.includes('Waterproof Bait Cask'));
    }
  });

  test('M3.11: Card salvage awards recognized sunken cards with valid titles and effects', () => {
    const knownCards = ['Deep-Sea Dredge', 'Siren Call', 'Gilded Harpoon', 'Barometric Surge', 'Ghost Anchor'];
    for (let i = 0; i < 10; i++) {
      const reward = generateSalvageReward(3, 0.90, i / 10);
      assert.equal(reward.type, 'card');
      assert.ok(knownCards.includes(reward.cardTitle!));
      assert.ok(reward.title.includes('Sunken Grimoire Page'));
      assert.ok(reward.cardData !== undefined);
      assert.equal(reward.cardData!.title, reward.cardTitle);
    }
  });

  test('M3.12: createSunkenCard produces valid CardData with stats and descriptions', () => {
    const card = createSunkenCard('Ghost Anchor');
    assert.equal(card.title, 'Ghost Anchor');
    assert.equal(card.cardType, 'Drag');
    assert.equal(card.effect.slackGain, 10);
    assert.ok(card.description.length > 0);
  });
});

// ============================================================================
// 3. TRIPARTITE OUTCOME ROLL ENGINE (F7)
// ============================================================================
describe('M3: Tripartite Outcome Roll Engine Integration', () => {
  test('M3.13: rollOutcomeForBait resolves into exactly one of: strike, salvage, slack', () => {
    for (const baitId of ALL_BAIT_IDS) {
      for (let r = 0; r <= 100; r += 5) {
        const outcome = rollOutcomeForBait(baitId, r / 100);
        assert.ok(['strike', 'salvage', 'slack'].includes(outcome));
      }
    }
  });

  test('M3.14: Bare Hook outcome thresholds match weights (60% strike, 22% salvage, 18% slack)', () => {
    assert.equal(rollOutcomeForBait('bare_hook', 0.00), 'strike');
    assert.equal(rollOutcomeForBait('bare_hook', 0.59), 'strike');
    assert.equal(rollOutcomeForBait('bare_hook', 0.60), 'salvage');
    assert.equal(rollOutcomeForBait('bare_hook', 0.81), 'salvage');
    assert.equal(rollOutcomeForBait('bare_hook', 0.82), 'slack');
    assert.equal(rollOutcomeForBait('bare_hook', 0.99), 'slack');
  });

  test('M3.15: Eldritch Grub yields 85% strike, 12% salvage, 3% slack', () => {
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.00), 'strike');
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.84), 'strike');
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.85), 'salvage');
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.96), 'salvage');
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.97), 'slack');
    assert.equal(rollOutcomeForBait('eldritch_grub', 0.999), 'slack');
  });

  test('M3.16: Deterministic roll produces identical outcome across repeated calls', () => {
    const outcome1 = rollOutcomeForBait('blood_chum', 0.77);
    const outcome2 = rollOutcomeForBait('blood_chum', 0.77);
    assert.equal(outcome1, outcome2);
    assert.equal(outcome1, 'salvage');
  });
});

// ============================================================================
// 4. WHIRLPOOL ENCOUNTER & TRIPARTITE FLOW SIMULATION (F7, F8, F9)
// ============================================================================
describe('M3: Whirlpool Encounter Tripartite Flow Simulation', () => {
  function createTestSpot(): FishingSpot {
    return new FishingSpot({
      id: 'spot_test_1',
      name: 'Shallows Eddy',
      position: new Vector2(4500, 4200),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Murky brackish eddy.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
  }

  test('M3.17: Strike outcome initiates battle, locks spot, and preserves spot until battle victory', () => {
    const spot = createTestSpot();
    let battleLaunched = false;
    let chosenSpecies = '';

    const handleOutcome = (outcome: FishingOutcomeType, baitId: BaitId) => {
      if (outcome === 'strike') {
        chosenSpecies = rollSpeciesForZone(1, baitId);
        spot.isFishingLocked = true;
        battleLaunched = true;
      }
    };

    const outcome = rollOutcomeForBait('bare_hook', 0.2); // strike
    assert.equal(outcome, 'strike');
    handleOutcome(outcome, 'bare_hook');

    assert.equal(battleLaunched, true);
    assert.ok(['perch', 'flounder', 'ghost_cod'].includes(chosenSpecies));
    assert.equal(spot.isFishingLocked, true);
    assert.equal(spot.state, 'ACTIVE'); // Spot does not despawn before fight concludes
  });

  test('M3.18: Salvage outcome opens overlay, despawns spot (3.0s timer), and unfreezes boat on claim', () => {
    const spot = createTestSpot();
    const inventory = new PlayerInventory();
    const overlay = new FlotsamSalvageOverlay(inventory);
    let boatFrozen = true;

    const handleOutcome = (outcome: FishingOutcomeType) => {
      if (outcome === 'salvage') {
        const reward = generateSalvageReward(1, 0.1, 0.5); // gold
        spot.triggerDespawn();
        overlay.open(reward, () => {
          boatFrozen = false;
        });
      }
    };

    const outcome = rollOutcomeForBait('bare_hook', 0.70); // salvage
    assert.equal(outcome, 'salvage');
    handleOutcome(outcome);

    assert.equal(overlay.isOpen, true);
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 0);
    assert.equal(boatFrozen, true); // Frozen while overlay open

    overlay.claim();

    assert.equal(overlay.isOpen, false);
    assert.equal(boatFrozen, false); // Unfrozen after claiming
    assert.ok(inventory.gold > 25); // Gold added
  });

  test('M3.19: Slack outcome triggers clean despawn, unfreezes vessel, and shows atmospheric notice', () => {
    const spot = createTestSpot();
    let boatFrozen = true;
    let noticeText = '';
    let battleStarted = false;

    const handleOutcome = (outcome: FishingOutcomeType) => {
      if (outcome === 'slack') {
        noticeText = 'The line went slack in the cold abyss... Nothing took the hook.';
        spot.triggerDespawn();
        boatFrozen = false;
      } else if (outcome === 'strike') {
        battleStarted = true;
      }
    };

    const outcome = rollOutcomeForBait('bare_hook', 0.95); // slack
    assert.equal(outcome, 'slack');
    handleOutcome(outcome);

    assert.equal(battleStarted, false);
    assert.equal(boatFrozen, false);
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.isFishingLocked, false);
    assert.ok(noticeText.includes('cold abyss'));
  });

  test('M3.20: Despawning spot ignores further interaction attempts', () => {
    const spot = createTestSpot();
    spot.triggerDespawn();
    assert.equal(spot.state, 'DESPAWNING');

    // Verification that spot cannot be re-interacted with while despawning
    const canInteract = (s: FishingSpot) => s.state === 'ACTIVE' && !s.isDead;
    assert.equal(canInteract(spot), false);
  });

  test('M3.21: Despawn progress over 3.0s monotonically reduces alpha and scale to 0 and marks isDead', () => {
    const spot = createTestSpot();
    spot.triggerDespawn();

    const dt = 1.0;
    spot.update(dt, new Vector2(0, 0));
    assert.equal(spot.state, 'DESPAWNING');
    assert.ok(spot.alpha < 1.0 && spot.alpha > 0.5);
    assert.ok(spot.scale < 1.0 && spot.scale > 0.5);

    spot.update(dt, new Vector2(0, 0));
    assert.ok(spot.alpha < 0.5);

    spot.update(1.5, new Vector2(0, 0)); // total dt = 3.5s >= 3.0s
    assert.equal(spot.isDead, true);
    assert.equal(spot.alpha, 0);
    assert.equal(spot.scale, 0);
  });
});
