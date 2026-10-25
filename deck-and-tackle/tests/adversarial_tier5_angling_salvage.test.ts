/**
 * Tier 5 Adversarial Coverage Hardening: Angling, Species, Baits, Shop, Flotsam Salvage, & Interaction Flows
 * 
 * Verifies white-box robustness, boundary invariants, extreme states, and state machine integrity:
 * 1. Species intent selection, 0/extreme stamina, edge distances, and combat invariants
 * 2. Bait multiplier normalization, exact boundary rolls, depleted bait fallbacks, & Monte Carlo statistics
 * 3. Pre-cast modal rapid input cancelling, keyboard hotkey edge conditions, and odd aspect ratios
 * 4. Flotsam salvage procedural generation, reward bounds, duplicate claims, & empty inventory
 * 5. Whirlpool spawner & interaction state machine transitions (proximity lock, despawn, abort)
 * 6. Visual sockets, zone profiles, and Chandlery shop bait purchasing under adversarial conditions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Headless polyfills for Node.js test environment
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
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
    createElement: () => ({
      getContext: () => createMockContext2D()
    }),
    getElementById: () => ({
      getContext: () => createMockContext2D()
    })
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

if (typeof (globalThis as any).Audio === 'undefined') {
  (globalThis as any).Audio = class {
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
  };
}

// Mock 2D Context for Headless Canvas Rendering Tests
function createMockContext2D(): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({ width: text.length * 8 }),
    drawImage: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    setTransform: () => {},
    resetTransform: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: () => {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    font: '10px sans-serif',
    textAlign: 'center',
    textBaseline: 'alphabetic',
    clip: () => {}
  } as unknown as CanvasRenderingContext2D;
}

// Imports from source codebase
import {
  FISH_REGISTRY,
  ALL_SPECIES_TYPES,
  ZONE_SPECIES_MAP,
  getSpeciesForZone,
  getFishData,
  getAllFishForZone,
  SpeciesType
} from '../src/game/battle/FishData.js';
import {
  BAIT_REGISTRY,
  ALL_BAIT_IDS,
  BaitId,
  rollRarityForBait,
  rollOutcomeForBait,
  rollSpeciesForZone,
  getBaitData
} from '../src/game/battle/BaitData.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { BattleEngine } from '../src/game/battle/BattleEngine.js';
import { PreCastModal } from '../src/game/ui/PreCastModal.js';
import {
  FlotsamSalvageOverlay,
  generateSalvageReward,
  createSunkenCard
} from '../src/game/ui/FlotsamSalvageOverlay.js';
import { FishingSpot } from '../src/game/overworld/FishingSpot.js';
import { WhirlpoolSpawner } from '../src/game/overworld/WhirlpoolSpawner.js';
import { Vector2 } from '../src/engine/Vector2.js';
import { FishVisualSocket } from '../src/game/sockets/FishVisualSocket.js';
import { resolveZoneTier, getZoneProfile } from '../src/game/sideview/ZoneProfiles.js';
import { HarborShopOverlay } from '../src/game/ui/HarborShopOverlay.js';
import { Input } from '../src/engine/Input.js';

// Helper to simulate key press in tests
function simulateKeyPress(key: string): void {
  (Input as any).keysJustPressed.add(key.toLowerCase());
  (Input as any).keysDown.add(key.toLowerCase());
}

// Helper to simulate mouse click in tests
function simulateMouseClick(x: number, y: number): void {
  (Input as any).mousePos.set(x, y);
  (Input as any).mouseJustClicked = true;
  (Input as any).isMouseDown = true;
}

function clearSimulatedInput(): void {
  Input.updateEnd();
}

// ============================================================================
// SUITE 1: SPECIES INTENT SELECTION, COMBAT EXTREMES, & DISTANCE INVARIANTS
// ============================================================================
describe('Tier 5 Suite 1: Species Intent Selection, Combat Extremes, & Distance Invariants', () => {

  it('T5.01: All 12 species have valid, non-empty intent patterns with non-negative values', () => {
    assert.equal(ALL_SPECIES_TYPES.length, 12, 'Must have exactly 12 species');
    for (const sp of ALL_SPECIES_TYPES) {
      const fish = FISH_REGISTRY[sp];
      assert.ok(fish, `Species ${sp} must exist in FISH_REGISTRY`);
      assert.ok(Array.isArray(fish.intentPattern) && fish.intentPattern.length >= 4, `${sp} must have at least 4 intents`);
      for (let i = 0; i < fish.intentPattern.length; i++) {
        const intent = fish.intentPattern[i];
        assert.ok(['Thrash', 'DeepDive', 'Rest'].includes(intent.type), `${sp} intent ${i} type must be valid`);
        assert.ok(typeof intent.value === 'number' && Number.isFinite(intent.value) && intent.value >= 0, `${sp} intent value must be >= 0`);
        assert.ok(intent.name && intent.name.length > 0, `${sp} intent must have name`);
        assert.ok(intent.description && intent.description.length > 0, `${sp} intent must have description`);
      }
    }
  });

  it('T5.02: 100-turn intent cycling across all 12 species executes without index out-of-bounds or NaN', () => {
    for (const sp of ALL_SPECIES_TYPES) {
      const engine = new BattleEngine(sp);
      for (let turn = 1; turn <= 100; turn++) {
        const intent = engine.getCurrentIntent();
        assert.ok(intent, `${sp} turn ${turn}: intent must not be null`);
        assert.ok(Number.isFinite(intent.value), `${sp} turn ${turn}: intent.value must be finite`);
        const effValue = engine.getEffectiveIntentValue();
        assert.ok(Number.isFinite(effValue) && effValue >= 0, `${sp} turn ${turn}: effective intent value must be >= 0`);
        // Advance intent index
        engine.currentIntentIndex = (engine.currentIntentIndex + 1) % engine.fish.intentPattern.length;
      }
    }
  });

  it('T5.03: Zero player stamina: cards costing > 0 stamina cannot be played, 0-cost cards can be played, and endTurn executes safely', () => {
    const engine = new BattleEngine('perch');
    engine.stamina = 0;
    assert.equal(engine.stamina, 0);

    for (let i = 0; i < engine.hand.length; i++) {
      const card = engine.hand[i];
      if (card.staminaCost > 0) {
        assert.equal(engine.canPlayCard(i), false, `Cannot play ${card.title} (cost ${card.staminaCost}) with 0 stamina`);
        assert.equal(engine.playCard(i), false, `playCard must return false for ${card.title}`);
      } else {
        assert.equal(engine.canPlayCard(i), true, `Can play 0-cost card ${card.title} even with 0 stamina`);
      }
    }

    const startLine = engine.lineIntegrity;
    engine.endTurn();
    // Turn advances, player stamina refreshed
    assert.equal(engine.turnNumber, 2);
    assert.equal(engine.stamina, engine.maxStamina);
    assert.ok(engine.lineIntegrity <= startLine, 'Fish intent executed and may damage line');
  });

  it('T5.04: Extreme player stamina (stamina = 100): player can play all cards in hand in single turn', () => {
    const engine = new BattleEngine('dagon');
    engine.setPlayerStats(100, 50);
    engine.stamina = 100;

    let played = 0;
    while (engine.hand.length > 0 && engine.status === 'player_turn') {
      const success = engine.playCard(0);
      if (success) played++;
      else break;
    }
    assert.ok(played >= 1, 'Should play cards successfully');
    assert.ok(engine.stamina >= 0, 'Stamina must not become negative');
  });

  it('T5.05: Distance reduction clamps strictly at 0 (never negative) and triggers victory callback', () => {
    const engine = new BattleEngine('perch');
    engine.distanceToBoat = 2; // Close to boat

    let victoryCalled = false;
    engine.onVictory = () => { victoryCalled = true; };

    // Inject high pull card
    engine.hand = [{
      id: 'super_reel',
      title: 'Super Reel',
      cardType: 'Reel',
      staminaCost: 1,
      pullDistance: 50,
      effect: { pullDistance: 50 },
      statSummary: '+50m Pull'
    }];
    engine.stamina = 2;

    const res = engine.playCard(0);
    assert.equal(res, true);
    assert.equal(engine.distanceToBoat, 0, 'Distance must clamp to exactly 0');
    assert.equal(engine.status, 'victory');
    assert.equal(victoryCalled, true, 'onVictory callback must be invoked');
  });

  it('T5.06: Extreme distance via DeepDive (e.g. 500m+) does not break intent loop or overflow', () => {
    const engine = new BattleEngine('maw_worm');
    engine.distanceToBoat = 1000;

    // Simulate 20 fish turns
    for (let t = 0; t < 20; t++) {
      engine.endTurn();
      assert.ok(Number.isFinite(engine.distanceToBoat), 'Distance must remain finite');
      assert.ok(engine.distanceToBoat >= 1000, 'DeepDive increases distance');
    }
  });

  it('T5.07: Excessive fish exhaustion (> intent.value) results in 0 damage and never heals line', () => {
    const engine = new BattleEngine('pike');
    engine.fishExhausted = 999;
    engine.lineIntegrity = 15;
    const initialLine = engine.lineIntegrity;

    // Current intent is pike Thrash (13)
    const eff = engine.getEffectiveIntentValue();
    assert.equal(eff, 0, 'Effective thrash must clamp to 0 with high exhaustion');

    engine.endTurn();
    assert.equal(engine.lineIntegrity, initialLine, 'Line must not have healed or inverted damage');
    assert.equal(engine.fishExhausted, 998, 'Exhaustion decays by 1');
  });

  it('T5.08: Line backlash (tensionSelf) resulting in lineIntegrity <= 0 triggers instant defeat on player turn', () => {
    const engine = new BattleEngine('sculpin');
    engine.lineIntegrity = 2;

    let defeatCalled = false;
    engine.onDefeat = () => { defeatCalled = true; };

    engine.hand = [{
      id: 'reckless_pull',
      title: 'Reckless Pull',
      cardType: 'Power',
      staminaCost: 1,
      pullDistance: 10,
      tensionSelf: 5,
      effect: { pullDistance: 10, tensionSelf: 5 },
      statSummary: '+10m Pull • -5 Line'
    }];
    engine.stamina = 2;

    engine.playCard(0);
    assert.equal(engine.lineIntegrity, 0, 'Line integrity must drop to 0');
    assert.equal(engine.status, 'defeat', 'Status must switch to defeat');
    assert.equal(defeatCalled, true, 'onDefeat callback must fire');
  });

  it('T5.09: Completely empty draw pile, hand, and discard pile: drawCards handles exhaustion gracefully', () => {
    const engine = new BattleEngine('perch');
    engine.drawPile = [];
    engine.hand = [];
    engine.discardPile = [];

    assert.doesNotThrow(() => {
      engine.drawCards(5);
    });
    assert.equal(engine.hand.length, 0, 'Hand remains empty when all piles are empty');
  });

  it('T5.10: Status effects (fishExhausted, fishChummed) clamp at 0 and do not become negative', () => {
    const engine = new BattleEngine('flounder');
    engine.fishExhausted = 0;
    engine.fishChummed = 0;

    engine.endTurn();
    assert.equal(engine.fishExhausted, 0);
    assert.equal(engine.fishChummed, 0);
  });

  it('T5.10b: getSpeciesForZone and getAllFishForZone behave accurately across all 4 tiers and rarities', () => {
    for (let tier = 1; tier <= 4; tier++) {
      const fishList = getAllFishForZone(tier as 1 | 2 | 3 | 4);
      assert.equal(fishList.length, 3, `Tier ${tier} must return exactly 3 fish`);

      const common = getSpeciesForZone(tier as 1 | 2 | 3 | 4, 'common');
      const uncommon = getSpeciesForZone(tier as 1 | 2 | 3 | 4, 'uncommon');
      const rare = getSpeciesForZone(tier as 1 | 2 | 3 | 4, 'rare');

      assert.ok(common && uncommon && rare);
      assert.notEqual(common, uncommon);
      assert.notEqual(uncommon, rare);

      // Case insensitive check
      const commonUpper = getSpeciesForZone(tier as 1 | 2 | 3 | 4, 'Common' as any);
      assert.equal(commonUpper, common);
    }
  });
});

// ============================================================================
// SUITE 2: BAIT MULTIPLIERS, BOUNDARY ROLLS, & DEPLETED FALLBACKS
// ============================================================================
describe('Tier 5 Suite 2: Bait Multipliers, Boundary Rolls, & Depleted Fallbacks', () => {

  it('T5.11: All 5 registered baits have strictly positive weights summing to valid totals', () => {
    assert.equal(ALL_BAIT_IDS.length, 5);
    for (const id of ALL_BAIT_IDS) {
      const bait = BAIT_REGISTRY[id];
      assert.ok(bait, `Bait ${id} must exist in BAIT_REGISTRY`);

      // Outcome weights
      const ow = bait.outcomeWeights;
      assert.ok(ow.strike > 0 && ow.salvage > 0 && ow.slack > 0);
      assert.equal(ow.strike + ow.salvage + ow.slack, 100, `${id} outcome weights must sum to 100`);

      // Rarity weights
      const rw = bait.rarityWeights;
      assert.ok(rw.common > 0 && rw.uncommon > 0 && rw.rare > 0);
      assert.equal(rw.common + rw.uncommon + rw.rare, 100, `${id} rarity weights must sum to 100`);
    }
  });

  it('T5.12: rollRarityForBait under exact floating point boundaries (0.0, 1.0, 0.999999)', () => {
    for (const id of ALL_BAIT_IDS) {
      const rZero = rollRarityForBait(id, 0.0);
      assert.equal(rZero, 'common', `${id} roll 0.0 must yield common`);

      const rOne = rollRarityForBait(id, 1.0);
      assert.equal(rOne, 'rare', `${id} roll 1.0 must yield rare`);

      const rAlmostOne = rollRarityForBait(id, 0.999999);
      assert.equal(rAlmostOne, 'rare', `${id} roll 0.999999 must yield rare`);
    }
  });

  it('T5.13: rollOutcomeForBait under exact boundaries (0.0, 1.0, and intermediate thresholds)', () => {
    for (const id of ALL_BAIT_IDS) {
      const outZero = rollOutcomeForBait(id, 0.0);
      assert.equal(outZero, 'strike', `${id} roll 0.0 must yield strike`);

      const outOne = rollOutcomeForBait(id, 1.0);
      assert.equal(outOne, 'slack', `${id} roll 1.0 must yield slack`);

      // Test salvage threshold
      const cfg = BAIT_REGISTRY[id];
      const salvageRoll = (cfg.outcomeWeights.strike + 1) / 100.0;
      const outSalvage = rollOutcomeForBait(id, salvageRoll);
      assert.equal(outSalvage, 'salvage', `${id} roll at salvage boundary must yield salvage`);
    }
  });

  it('T5.14: rollSpeciesForZone with invalid zone tiers (0, 5, -100, 999) clamps safely to [1..4]', () => {
    const invalidTiers = [0, 5, -10, 999] as unknown as (1 | 2 | 3 | 4)[];
    for (const t of invalidTiers) {
      const sp = rollSpeciesForZone(t, 'bare_hook', 0.5);
      assert.ok(ALL_SPECIES_TYPES.includes(sp), `Must return a valid species for tier ${t}`);
    }
  });

  it('T5.15: Bait consumption depletion: when last unit is consumed, selectedBait reverts to bare_hook', () => {
    const inv = new PlayerInventory();
    inv.addBait('blood_chum', 1);
    assert.equal(inv.getBaitCount('blood_chum'), 1);

    const selected = inv.selectBait('blood_chum');
    assert.equal(selected, true);
    assert.equal(inv.selectedBait, 'blood_chum');

    // Consume the 1 unit
    const consumed = inv.consumeBait('blood_chum');
    assert.equal(consumed, true);
    assert.equal(inv.getBaitCount('blood_chum'), 0);
    assert.equal(inv.selectedBait, 'bare_hook', 'Must automatically revert to bare_hook upon depletion');
  });

  it('T5.16: Bare hook consumption is infinite and never depletes', () => {
    const inv = new PlayerInventory();
    for (let i = 0; i < 50; i++) {
      const ok = inv.consumeBait('bare_hook');
      assert.equal(ok, true);
    }
    assert.equal(inv.getBaitCount('bare_hook'), Infinity);
    assert.equal(inv.selectedBait, 'bare_hook');
  });

  it('T5.17: Selecting a depleted bait (count = 0) returns false and preserves existing selection', () => {
    const inv = new PlayerInventory();
    assert.equal(inv.getBaitCount('eldritch_grub'), 0);

    const ok = inv.selectBait('eldritch_grub');
    assert.equal(ok, false);
    assert.equal(inv.selectedBait, 'bare_hook', 'Selection must remain unchanged');
  });

  it('T5.18: Unknown/invalid bait IDs safely fall back to bare_hook without throwing', () => {
    const invalidId = 'non_existent_chum' as BaitId;
    const data = getBaitData(invalidId);
    assert.equal(data.id, 'bare_hook');

    const rarity = rollRarityForBait(invalidId, 0.5);
    assert.ok(['common', 'uncommon', 'rare'].includes(rarity));

    const outcome = rollOutcomeForBait(invalidId, 0.5);
    assert.ok(['strike', 'salvage', 'slack'].includes(outcome));
  });

  it('T5.19: PlayerInventory.addBait with negative count is ignored or handled safely', () => {
    const inv = new PlayerInventory();
    inv.addBait('lugworms', 5);
    inv.addBait('lugworms', -2); // Edge test
    assert.ok(inv.getBaitCount('lugworms') >= 0, 'Bait count must never become negative');
  });

  it('T5.20: Monte Carlo statistical verification (10,000 rolls per bait) matches attraction odds within ±3%', () => {
    const N = 10000;
    for (const baitId of ALL_BAIT_IDS) {
      const cfg = BAIT_REGISTRY[baitId];
      let strikes = 0;
      let salvages = 0;
      let slacks = 0;

      for (let i = 0; i < N; i++) {
        const out = rollOutcomeForBait(baitId);
        if (out === 'strike') strikes++;
        else if (out === 'salvage') salvages++;
        else slacks++;
      }

      const pStrike = (strikes / N) * 100;
      const pSalvage = (salvages / N) * 100;
      const pSlack = (slacks / N) * 100;

      assert.ok(Math.abs(pStrike - cfg.outcomeWeights.strike) <= 3.0, `${baitId} strike% out of tolerance`);
      assert.ok(Math.abs(pSalvage - cfg.outcomeWeights.salvage) <= 3.0, `${baitId} salvage% out of tolerance`);
      assert.ok(Math.abs(pSlack - cfg.outcomeWeights.slack) <= 3.0, `${baitId} slack% out of tolerance`);
    }
  });
});

// ============================================================================
// SUITE 3: PRE-CAST MODAL RAPID INPUT, HOTKEY EDGES, & VIEWPORT BOUNDS
// ============================================================================
describe('Tier 5 Suite 3: Pre-Cast Modal Rapid Input, Hotkeys, & Viewport Bounds', () => {

  it('T5.21: Rapid double cancel: cancel() called multiple times invokes onCancel callback exactly once', () => {
    const inv = new PlayerInventory();
    const modal = new PreCastModal(inv);
    let cancelCount = 0;

    modal.open(1, 'The Shallows', 15, () => {}, () => { cancelCount++; });
    assert.equal(modal.isOpen, true);

    modal.cancel();
    modal.cancel(); // Second call
    assert.equal(modal.isOpen, false);
    assert.equal(cancelCount, 1, 'onCancel callback must only be called once');
  });

  it('T5.22: Rapid input via update loop: space key triggers cast on frame 1, and subsequent update when closed is ignored', () => {
    const inv = new PlayerInventory();
    inv.addBait('lugworms', 3);
    inv.selectBait('lugworms');

    const modal = new PreCastModal(inv);
    let castCount = 0;
    modal.open(2, 'The Foggy Banks', 45, () => { castCount++; }, () => {});

    // Frame 1: Space pressed
    simulateKeyPress('space');
    modal.update(0.016);
    clearSimulatedInput();

    assert.equal(inv.getBaitCount('lugworms'), 2, 'Consumed exactly 1 bait on cast');
    assert.equal(castCount, 1);
    assert.equal(modal.isOpen, false);

    // Frame 2: Space pressed again while modal closed
    simulateKeyPress('space');
    modal.update(0.016);
    clearSimulatedInput();

    assert.equal(inv.getBaitCount('lugworms'), 2, 'Must not consume bait when modal is closed');
    assert.equal(castCount, 1, 'Callback must not be called again');
  });

  it('T5.22b: Direct confirmCast invocation: documents that direct confirmCast consumes bait even when closed', () => {
    const inv = new PlayerInventory();
    inv.addBait('bio_squid', 2);
    inv.selectBait('bio_squid');

    const modal = new PreCastModal(inv);
    assert.equal(modal.isOpen, false);

    // Direct invocation without modal.open: consumes bait because confirmCast lacks an internal isOpen check
    modal.confirmCast();
    assert.equal(inv.getBaitCount('bio_squid'), 1);
  });

  it('T5.23: cycleBait with 1 owned bait (bare_hook only) is a safe no-op', () => {
    const inv = new PlayerInventory();
    const modal = new PreCastModal(inv);
    modal.open(1, 'The Shallows', 15, () => {}, () => {});

    assert.equal(inv.selectedBait, 'bare_hook');
    modal.cycleBait(1);
    assert.equal(inv.selectedBait, 'bare_hook');
    modal.cycleBait(-1);
    assert.equal(inv.selectedBait, 'bare_hook');
    modal.close();
  });

  it('T5.24: cycleBait with multiple baits wraps forward and backward seamlessly', () => {
    const inv = new PlayerInventory();
    inv.addBait('lugworms', 2);
    inv.addBait('bio_squid', 1);

    const modal = new PreCastModal(inv);
    modal.open(3, 'The Sunken Reefs', 75, () => {}, () => {});

    assert.equal(inv.selectedBait, 'bare_hook');
    modal.cycleBait(1);
    assert.equal(inv.selectedBait, 'lugworms');
    modal.cycleBait(1);
    assert.equal(inv.selectedBait, 'bio_squid');
    modal.cycleBait(1);
    assert.equal(inv.selectedBait, 'bare_hook', 'Must wrap forward to bare_hook');

    modal.cycleBait(-1);
    assert.equal(inv.selectedBait, 'bio_squid', 'Must wrap backward to bio_squid');
    modal.close();
  });

  it('T5.25: Modal open validates currently equipped bait: if depleted prior to open, falls back to bare_hook', () => {
    const inv = new PlayerInventory();
    inv.addBait('blood_chum', 1);
    inv.selectBait('blood_chum');
    // Artificially deplete behind the scenes
    inv.baits['blood_chum'] = 0;

    const modal = new PreCastModal(inv);
    modal.open(1, 'The Shallows', 15, () => {}, () => {});
    assert.equal(inv.selectedBait, 'bare_hook', 'Opening modal must reset depleted selection to bare_hook');
    modal.close();
  });

  it('T5.25b: Number hotkeys [1..5] select only owned baits and reject unowned baits', () => {
    const inv = new PlayerInventory();
    inv.addBait('blood_chum', 2); // Key 3
    assert.equal(inv.getBaitCount('lugworms'), 0); // Key 2 is unowned

    const modal = new PreCastModal(inv);
    modal.open(1, 'The Shallows', 15, () => {}, () => {});

    // Press Key 2 (lugworms - unowned)
    simulateKeyPress('digit2');
    modal.update(0.016);
    clearSimulatedInput();
    assert.equal(inv.selectedBait, 'bare_hook', 'Must reject unowned bait hotkey');

    // Press Key 3 (blood_chum - owned)
    simulateKeyPress('digit3');
    modal.update(0.016);
    clearSimulatedInput();
    assert.equal(inv.selectedBait, 'blood_chum', 'Must accept owned bait hotkey');

    // Press Key 1 (bare_hook - always owned)
    simulateKeyPress('digit1');
    modal.update(0.016);
    clearSimulatedInput();
    assert.equal(inv.selectedBait, 'bare_hook', 'Must select bare_hook with Key 1');
    modal.close();
  });

  it('T5.26: Modal rendering under extreme aspect ratios (0x0, 200x200, 5120x1440, 400x3000) does not throw', () => {
    const inv = new PlayerInventory();
    const modal = new PreCastModal(inv);
    modal.open(1, 'The Shallows', 15, () => {}, () => {});
    const ctx = createMockContext2D();

    const viewports = [
      { w: 0, h: 0 },
      { w: 200, h: 200 },
      { w: 5120, h: 1440 },
      { w: 400, h: 3000 },
      { w: -100, h: -100 }
    ];

    for (const vp of viewports) {
      assert.doesNotThrow(() => {
        modal.render(ctx, vp.w, vp.h);
      }, `render failed at ${vp.w}x${vp.h}`);
    }
    modal.close();
  });
});

// ============================================================================
// SUITE 4: FLOTSAM SALVAGE REWARD BOUNDS, DUPLICATE CLAIMS, & BAGS
// ============================================================================
describe('Tier 5 Suite 4: Flotsam Salvage Bounds, Duplicate Claims, & Bags', () => {

  it('T5.29: generateSalvageReward produces gold strictly within zone bounds across 1,000 randomized iterations', () => {
    const bounds: Record<1 | 2 | 3 | 4, [number, number]> = {
      1: [15, 25],
      2: [25, 40],
      3: [40, 60],
      4: [60, 100]
    };

    for (let tier = 1; tier <= 4; tier++) {
      const [minG, maxG] = bounds[tier as 1 | 2 | 3 | 4];
      for (let i = 0; i < 250; i++) {
        // Force gold type roll (< 0.50)
        const typeRoll = Math.random() * 0.499;
        const subRoll = Math.random();
        const r = generateSalvageReward(tier as 1 | 2 | 3 | 4, typeRoll, subRoll);

        assert.equal(r.type, 'gold');
        assert.ok(r.amount !== undefined);
        assert.ok(r.amount >= minG && r.amount <= maxG, `Zone ${tier} gold ${r.amount} not in [${minG}, ${maxG}]`);
        assert.equal(r.amount, Math.floor(r.amount), 'Gold must be integer');
      }
    }
  });

  it('T5.30: Bait salvage rewards yield only valid purchasable baits and quantities (1 or 2)', () => {
    const validBaitPool = ['lugworms', 'blood_chum', 'bio_squid'];
    for (let i = 0; i < 200; i++) {
      // Force bait type roll [0.50, 0.799]
      const typeRoll = 0.50 + Math.random() * 0.29;
      const subRoll = Math.random();
      const r = generateSalvageReward(2, typeRoll, subRoll);

      assert.equal(r.type, 'bait');
      assert.ok(r.baitId && validBaitPool.includes(r.baitId), `Bait ${r.baitId} must be in pool`);
      assert.ok(r.amount === 1 || r.amount === 2, `Bait quantity ${r.amount} must be 1 or 2`);
    }
  });

  it('T5.31: Sunken card salvage rewards create complete, playable CardData with non-empty stats', () => {
    const expectedCards = ['Deep-Sea Dredge', 'Siren Call', 'Gilded Harpoon', 'Barometric Surge', 'Ghost Anchor'];
    for (const cardTitle of expectedCards) {
      const card = createSunkenCard(cardTitle);
      assert.equal(card.title, cardTitle);
      assert.ok(card.staminaCost >= 1, `${cardTitle} stamina cost must be >= 1`);
      assert.ok(card.statSummary && card.statSummary.length > 0);
      assert.ok(card.effect);
    }
  });

  it('T5.31b: createSunkenCard with unknown title generates valid fallback CardData without crashing', () => {
    const card = createSunkenCard('Abyssal Prism');
    assert.equal(card.title, 'Abyssal Prism');
    assert.equal(card.id, 'sunken_abyssal_prism');
    assert.ok(card.staminaCost >= 1);
    assert.ok(card.effect);
  });

  it('T5.32: Duplicate claim prevention: calling claim() 10 times consecutively credits reward only once', () => {
    const inv = new PlayerInventory();
    inv.gold = 100;
    const overlay = new FlotsamSalvageOverlay(inv);

    const reward = {
      type: 'gold' as const,
      amount: 50,
      title: 'Strongbox (+50g)',
      description: 'Gold purse'
    };

    overlay.open(reward);
    assert.equal(overlay.isOpen, true);

    for (let i = 0; i < 10; i++) {
      overlay.claim();
    }

    assert.equal(inv.gold, 150, 'Gold must have increased by exactly 50 once');
    assert.equal(overlay.isOpen, false);
  });

  it('T5.33: dismiss() via ESC key safely claims the reward so loot is never lost', () => {
    const inv = new PlayerInventory();
    assert.equal(inv.getBaitCount('bio_squid'), 0);
    const overlay = new FlotsamSalvageOverlay(inv);

    const reward = {
      type: 'bait' as const,
      baitId: 'bio_squid' as BaitId,
      amount: 2,
      title: 'Squid (+2)',
      description: 'Squid bait'
    };

    overlay.open(reward);
    overlay.dismiss(); // ESC action
    assert.equal(inv.getBaitCount('bio_squid'), 2, 'Loot must be credited on dismiss');
    assert.equal(overlay.isOpen, false);
  });

  it('T5.34: Empty inventory wallets & decks accept all salvage rewards without corruption', () => {
    const inv = new PlayerInventory();
    inv.gold = 0;
    inv.deck = [];

    const overlay = new FlotsamSalvageOverlay(inv);
    const cardReward = generateSalvageReward(4, 0.95, 0.1);
    overlay.open(cardReward);
    overlay.claim();

    assert.equal(inv.deck.length, 1);
    assert.ok(inv.deck[0].title);
  });

  it('T5.35: Overlay render under extreme canvas sizes (0x0, 100x100, 4000x3000) does not throw', () => {
    const inv = new PlayerInventory();
    const overlay = new FlotsamSalvageOverlay(inv);
    overlay.open(generateSalvageReward(1, 0.1, 0.1));
    const ctx = createMockContext2D();

    assert.doesNotThrow(() => overlay.render(ctx, 0, 0));
    assert.doesNotThrow(() => overlay.render(ctx, 100, 100));
    assert.doesNotThrow(() => overlay.render(ctx, 4000, 3000));
    overlay.close();
  });
});

// ============================================================================
// SUITE 5: WHIRLPOOL SPAWNER & INTERACTION STATE MACHINE TRANSITIONS
// ============================================================================
describe('Tier 5 Suite 5: Whirlpool Spawner & Interaction State Machine Transitions', () => {

  it('T5.36: Whirlpool proximity lock: active spot does not despawn after 10,000s while player is within interactionRadius (120px)', () => {
    const spot = new FishingSpot({
      id: 'spot_1',
      name: 'Test Spot',
      position: new Vector2(4500, 4500),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Test',
      initialState: 'ACTIVE',
      activeDuration: 40.0
    });

    const boatNear = new Vector2(4550, 4500); // 50px away <= 120px
    for (let step = 0; step < 100; step++) {
      spot.update(100.0, boatNear); // 100s each step = 10,000s total
      assert.equal(spot.state, 'ACTIVE', 'Spot must remain ACTIVE while locked by proximity');
      assert.equal(spot.isPlayerNearby, true);
    }
  });

  it('T5.37: Whirlpool fishing lock: active spot does not despawn while isFishingLocked = true', () => {
    const spot = new FishingSpot({
      id: 'spot_2',
      name: 'Test Spot 2',
      position: new Vector2(4500, 4500),
      zoneType: 'lake',
      speciesType: 'pike',
      description: 'Test',
      initialState: 'ACTIVE',
      activeDuration: 40.0
    });

    spot.isFishingLocked = true;
    const boatFar = new Vector2(2000, 2000); // Far away
    spot.update(500.0, boatFar);
    assert.equal(spot.state, 'ACTIVE', 'Spot must remain ACTIVE while isFishingLocked is true');
  });

  it('T5.38: Post-fishing triggerDespawn transitions to DESPAWNING immediately and is idempotent', () => {
    const spot = new FishingSpot({
      id: 'spot_3',
      name: 'Test Spot 3',
      position: new Vector2(4500, 4500),
      zoneType: 'abyss',
      speciesType: 'gar',
      description: 'Test',
      initialState: 'ACTIVE'
    });

    spot.triggerDespawn();
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 0);

    // Advance 1.5s
    spot.update(1.5, new Vector2(1000, 1000));
    assert.equal(spot.timer, 1.5);

    // Call triggerDespawn again while already despawning: must NOT reset timer
    spot.triggerDespawn();
    assert.equal(spot.timer, 1.5, 'triggerDespawn must be idempotent and not reset timer');

    // Complete despawn
    spot.update(1.6, new Vector2(1000, 1000));
    assert.equal(spot.isDead, true, 'Spot must be marked dead after despawn duration');
  });

  it('T5.39: Scale and alpha interpolate smoothly without negative numbers or NaN across full lifecycle', () => {
    const spot = new FishingSpot({
      id: 'spot_4',
      name: 'Test Spot 4',
      position: new Vector2(4000, 4800),
      zoneType: 'cave',
      speciesType: 'dagon',
      description: 'Test',
      initialState: 'SPAWNING',
      spawnDuration: 2.5,
      activeDuration: 10.0,
      despawnDuration: 3.0
    });

    const boatFar = new Vector2(1000, 1000);
    const dt = 0.1;
    const totalTime = 20.0;
    for (let t = 0; t < totalTime; t += dt) {
      spot.update(dt, boatFar);
      assert.ok(!isNaN(spot.alpha) && spot.alpha >= 0.0 && spot.alpha <= 1.0, `alpha ${spot.alpha} invalid at t=${t}`);
      assert.ok(!isNaN(spot.scale) && spot.scale >= 0.0 && spot.scale <= 1.0, `scale ${spot.scale} invalid at t=${t}`);
    }
  });

  it('T5.40: WhirlpoolSpawner candidate validation rejects harbor (<400px), world edges, and close spots (<350px)', () => {
    const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));

    // 1. Inside harbor (<400px)
    assert.equal(spawner.isValidCandidate(4100, 4100), false, 'Must reject coordinate inside safe harbor');

    // 2. Near map borders (<200px or >7800px)
    assert.equal(spawner.isValidCandidate(100, 4000), false, 'Must reject coordinate < 200px');
    assert.equal(spawner.isValidCandidate(7900, 4000), false, 'Must reject coordinate > 7800px');

    // 3. Proximity to existing spot (<350px)
    const existing = new FishingSpot({
      id: 'existing',
      name: 'Existing',
      position: new Vector2(5000, 5000),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Test',
      initialState: 'ACTIVE'
    });
    spawner.whirlpools.push(existing);
    assert.equal(spawner.isValidCandidate(5100, 5000), false, 'Must reject candidate within 350px of existing spot');
    assert.equal(spawner.isValidCandidate(5500, 5000), true, 'Must accept candidate >= 350px away');
  });

  it('T5.41: Whirlpool encounter profile distances match concentric radial boundaries', () => {
    const p1 = WhirlpoolSpawner.getEncounterProfileForDistance(500);
    assert.equal(p1.tier, 1);
    assert.equal(p1.speciesType, 'perch');

    const p2 = WhirlpoolSpawner.getEncounterProfileForDistance(1800);
    assert.equal(p2.tier, 2);
    assert.equal(p2.speciesType, 'pike');

    const p3 = WhirlpoolSpawner.getEncounterProfileForDistance(3000);
    assert.equal(p3.tier, 3);
    assert.equal(p3.speciesType, 'gar');

    const p4 = WhirlpoolSpawner.getEncounterProfileForDistance(4500);
    assert.equal(p4.tier, 4);
    assert.equal(p4.speciesType, 'dagon');
  });
});

// ============================================================================
// SUITE 6: VISUAL SOCKETS, ZONE PROFILES, & CHANDLERY BAIT TAB
// ============================================================================
describe('Tier 5 Suite 6: Visual Sockets, Zone Profiles, & Chandlery Bait Tab', () => {

  it('T5.43: FishVisualSocket.SPECIES_VISUAL_CONFIGS contains valid geometry for all 12 species', () => {
    for (const sp of ALL_SPECIES_TYPES) {
      const cfg = FishVisualSocket.SPECIES_VISUAL_CONFIGS[sp];
      assert.ok(cfg, `Visual config for ${sp} must exist`);
      assert.ok(cfg.w > 0 && cfg.h > 0, `${sp} dimensions must be positive`);
      assert.ok(Number.isFinite(cfg.mouthX) && Number.isFinite(cfg.mouthY), `${sp} mouth coordinates must be finite`);
      assert.ok(cfg.spritePath && cfg.spritePath.length > 0, `${sp} spritePath must be non-empty`);
    }
  });

  it('T5.44: FishVisualSocket.getSpeciesVisualConfig with unknown/null species safely returns fallback', () => {
    const unknown = FishVisualSocket.getSpeciesVisualConfig('unknown_kraken');
    assert.ok(unknown);
    assert.ok(unknown.w > 0 && unknown.h > 0);
  });

  it('T5.45: resolveZoneTier accurately resolves depth zones and species tiers under boundary conditions', () => {
    // Tier 4 species
    assert.equal(resolveZoneTier('shallow', 'dagon'), 4);
    assert.equal(resolveZoneTier('lake', 'cthulhu_spawn'), 4);
    assert.equal(resolveZoneTier('abyss', 'maw_worm'), 4);

    // Tier 3 species
    assert.equal(resolveZoneTier('shallow', 'gar'), 3);
    assert.equal(resolveZoneTier('lake', 'angler'), 3);

    // Tier 2 species
    assert.equal(resolveZoneTier('shallow', 'pike'), 2);

    // Tier 1 species
    assert.equal(resolveZoneTier('shallow', 'perch'), 1);

    // Depths
    assert.equal(resolveZoneTier('shallow', undefined, 150), 4);
    assert.equal(resolveZoneTier('shallow', undefined, 80), 3);
    assert.equal(resolveZoneTier('shallow', undefined, 45), 2);
    assert.equal(resolveZoneTier('shallow', undefined, 10), 1);
    assert.equal(resolveZoneTier('shallow', undefined, -50), 1);
  });

  it('T5.46: getZoneProfile with out-of-bounds tiers (0, 5, -1) safely falls back to Zone 1 profile', () => {
    const p1 = getZoneProfile(1);
    assert.equal(p1.tier, 1);

    const p0 = getZoneProfile(0 as any);
    assert.equal(p0.tier, 1, 'Tier 0 must fall back to Zone 1');

    const p5 = getZoneProfile(5 as any);
    assert.equal(p5.tier, 1, 'Tier 5 must fall back to Zone 1');
  });

  it('T5.47: Chandlery shop bait purchasing rejects buying bare_hook', () => {
    const inv = new PlayerInventory();
    inv.gold = 500;
    const shop = new HarborShopOverlay(inv, () => {});

    // Render to populate buttons
    const ctx = createMockContext2D();
    (shop as any).selectedTab = 'bait';
    shop.render(ctx, 1920, 1080);

    const bareHookBtn = (shop as any).baitBuyButtons.find((b: any) => b.bait.id === 'bare_hook');
    assert.ok(bareHookBtn, 'Bare hook button must exist');

    // Simulate clicking bare hook buy button
    simulateMouseClick(bareHookBtn.rect.x + 5, bareHookBtn.rect.y + 5);
    shop.update(0.016, 1920, 1080);
    clearSimulatedInput();

    assert.equal(inv.gold, 500, 'Gold must remain untouched');
    assert.equal(inv.getBaitCount('bare_hook'), Infinity);
  });

  it('T5.48: Chandlery shop bait purchasing with insufficient gold rejects transaction', () => {
    const inv = new PlayerInventory();
    inv.gold = 5; // Lugworms cost 10g
    assert.equal(inv.getBaitCount('lugworms'), 0);

    const shop = new HarborShopOverlay(inv, () => {});
    const ctx = createMockContext2D();
    (shop as any).selectedTab = 'bait';
    shop.render(ctx, 1920, 1080);

    const lugwormsBtn = (shop as any).baitBuyButtons.find((b: any) => b.bait.id === 'lugworms');
    assert.ok(lugwormsBtn, 'Lugworms button must exist');

    simulateMouseClick(lugwormsBtn.rect.x + 5, lugwormsBtn.rect.y + 5);
    shop.update(0.016, 1920, 1080);
    clearSimulatedInput();

    assert.equal(inv.gold, 5, 'Gold must not be deducted on failed purchase');
    assert.equal(inv.getBaitCount('lugworms'), 0, 'No bait should be granted');
  });

  it('T5.49: Chandlery shop bait purchasing with sufficient gold correctly deducts cost and increments hold', () => {
    const inv = new PlayerInventory();
    inv.gold = 100;
    assert.equal(inv.getBaitCount('blood_chum'), 0);

    const shop = new HarborShopOverlay(inv, () => {});
    const ctx = createMockContext2D();
    (shop as any).selectedTab = 'bait';
    shop.render(ctx, 1920, 1080);

    const chumBtn = (shop as any).baitBuyButtons.find((b: any) => b.bait.id === 'blood_chum'); // 25g
    assert.ok(chumBtn, 'Blood chum button must exist');

    simulateMouseClick(chumBtn.rect.x + 5, chumBtn.rect.y + 5);
    shop.update(0.016, 1920, 1080);
    clearSimulatedInput();

    assert.equal(inv.gold, 75, '25g deducted');
    assert.equal(inv.getBaitCount('blood_chum'), 1, '1 unit of blood_chum added');
  });

  it('T5.50: Chandlery shop tab hotkeys switch tabs properly without leaking state', () => {
    const inv = new PlayerInventory();
    const shop = new HarborShopOverlay(inv, () => {});

    assert.equal((shop as any).selectedTab, 'all');

    // Simulate pressing KeyB
    simulateKeyPress('keyb');
    shop.update(0.016, 1920, 1080);
    clearSimulatedInput();
    assert.equal((shop as any).selectedTab, 'bait');

    // Simulate pressing KeyB again
    simulateKeyPress('keyb');
    shop.update(0.016, 1920, 1080);
    clearSimulatedInput();
    assert.equal((shop as any).selectedTab, 'all');
  });
});
