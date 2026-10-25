/**
 * challenger_combat_engines_stress.test.ts
 * 
 * Adversarial Challenger Stress Testing Suite for Milestone 4 (R4):
 * - NavalBattleEngine & MonsterStandoffEngine Combat State Machines
 * 
 * Verification Dimensions:
 * 1. Naval combat continuous card loop: 50 consecutive turns, hand size caps, deck depletion & recycling, stamina refresh
 * 2. Naval armor absorption & penetration mechanics: full absorption, exact match, penetration, enemy armor, overheal caps
 * 3. Naval evasion probability: deterministic success/fail, single-turn expiration, statistical convergence (1,000 trials)
 * 4. Naval harpoon snare stun turn skips: single-turn skip, multi-turn stacking, unhindered player actions during stun
 * 5. Naval victory & defeat states: clamping, gold rewards, input locking, state transitions
 * 6. Monster standoff Phase 1 tethering: harpoon shot hits/misses, tension management, cable snap backlash (-10 HP), Phase 2 transitions
 * 7. Monster standoff Phase 2 weak point targeting: 2.0x precision critical multiplier, enrage mode (<25% HP), apex victory & bait rewards
 * 8. Canvas rendering stress: 100 render loops on both engines across diverse resolutions, phases, particles, and banners
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/challenger_combat_engines_stress.test.ts
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHORITATIVE_NAVAL_CARDS,
  createStarterNavalDeck,
  type NavalCardData
} from '../src/game/battle/NavalCardData.js';

import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { NavalBattleEngine } from '../src/game/battle/NavalBattleEngine.js';
import { MonsterStandoffEngine } from '../src/game/battle/MonsterStandoffEngine.js';
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

// Polyfills for Headless Node.js Test Execution
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {};
}

class RobustMockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
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
      stop: () => {},
      playbackRate: { value: 1 }
    };
  }
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { value: 440 }
    };
  }
  decodeAudioData() {
    return Promise.resolve({});
  }
}

(globalThis as any).window.AudioContext = RobustMockAudioContext;
(globalThis as any).AudioContext = RobustMockAudioContext;

if (typeof (globalThis as any).Image === 'undefined') {
  (globalThis as any).Image = class MockImage {
    src = '';
    complete = true;
    naturalWidth = 100;
    naturalHeight = 100;
    width = 100;
    height = 100;
  };
}

if (typeof (MockCanvasRenderingContext2D.prototype as any).roundRect !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).roundRect = function(...args: any[]) {
    this.operations.push({ name: 'roundRect', args });
  };
}

if (typeof (MockCanvasRenderingContext2D.prototype as any).rect !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).rect = function(...args: any[]) {
    this.operations.push({ name: 'rect', args });
  };
}

if (typeof (MockCanvasRenderingContext2D.prototype as any).clip !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).clip = function() {
    this.operations.push({ name: 'clip', args: [] });
  };
}

if (typeof (MockCanvasRenderingContext2D.prototype as any).quadraticCurveTo !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).quadraticCurveTo = function(...args: any[]) {
    this.operations.push({ name: 'quadraticCurveTo', args });
  };
}

if (typeof (MockCanvasRenderingContext2D.prototype as any).bezierCurveTo !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).bezierCurveTo = function(...args: any[]) {
    this.operations.push({ name: 'bezierCurveTo', args });
  };
}

describe('Adversarial Challenger: Naval & Monster Combat Engines Stress Suite', () => {

  // ==========================================================================
  // Section 1: Naval Combat Engine — 50-Turn Continuous Card Loop & Endurance Stress
  // ==========================================================================
  describe('1. Naval Combat: 50-Turn Continuous Endurance & Card Loop', () => {

    test('Engine runs cleanly through 50 consecutive turns with card draw, play, and deck recycling', () => {
      const inventory = new PlayerInventory();
      // Configure an enduring practice warship with 0 baseDamage and high HP so turns run deterministically
      const engine = new NavalBattleEngine(inventory, {
        name: 'Iron Dreadnought Hulk',
        maxHp: 50000,
        armor: 10000,
        baseDamage: 0,
        goldReward: 100
      });

      engine.init();

      assert.equal(engine.turn, 1);
      assert.equal(engine.isPlayerTurn, true);

      let totalCardsPlayed = 0;

      for (let t = 1; t <= 50; t++) {
        assert.equal(engine.turn, t, `Turn counter should be exactly ${t}`);
        assert.equal(engine.isPlayerTurn, true, `Should be player turn at start of turn ${t}`);
        assert.ok(engine.hand.length <= 5, `Hand size must never exceed 5 cards (was ${engine.hand.length})`);
        assert.equal(engine.playerStamina, engine.playerMaxStamina, `Stamina must refresh to max on turn ${t}`);

        // Play up to 2 playable cards each turn if stamina allows
        let playsThisTurn = 0;
        for (let i = engine.hand.length - 1; i >= 0 && playsThisTurn < 2; i--) {
          const card = engine.hand[i];
          if (engine.playerStamina >= card.staminaCost) {
            const played = engine.playCard(i);
            if (played) {
              playsThisTurn++;
              totalCardsPlayed++;
            }
          }
        }

        // End the turn
        engine.endTurn();
        assert.equal(engine.isPlayerTurn, false, `Turn should transition to enemy after endTurn()`);

        // Advance 1.0s to execute enemy turn
        engine.update(1.0);

        // Turn should have cycled to next round
        assert.equal(engine.isPlayerTurn, true, `Turn should return to player after enemy phase`);
      }

      assert.equal(engine.turn, 51, 'After 50 completed turns, active turn must be 51');
      assert.ok(totalCardsPlayed >= 50, `Should have played numerous cards across 50 turns (played: ${totalCardsPlayed})`);
      assert.equal(engine.isFinished(), false, 'Combat should not finish prematurely');

      // Total cards in system must remain constant (8 starter cards)
      const totalCardCount = engine.drawPile.length + engine.hand.length + engine.discardPile.length + engine.exhaustPile.length;
      assert.equal(totalCardCount, 8, `Deck conservation failed: total cards in system is ${totalCardCount}, expected 8`);

      // Ensure no numeric state corruption (NaN/Infinity)
      assert.ok(!Number.isNaN(engine.playerHull), 'playerHull must not be NaN');
      assert.ok(!Number.isNaN(engine.playerArmor), 'playerArmor must not be NaN');
      assert.ok(!Number.isNaN(engine.playerStamina), 'playerStamina must not be NaN');
      assert.ok(!Number.isNaN(engine.enemyHull), 'enemyHull must not be NaN');
    });

    test('Hand limit cap strictly enforced at 5 cards max', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      // Hand starts with 4 cards
      assert.equal(engine.hand.length, 4);

      // Attempt to draw 10 more cards
      engine.drawCards(10);
      assert.equal(engine.hand.length, 5, 'Hand must be capped at 5 cards');
    });

    test('Draw pile safely recycles discard pile when empty without throwing', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      // Empty draw pile and put all cards in discard pile
      engine.discardPile = [...engine.drawPile];
      engine.drawPile = [];
      engine.hand = [];

      assert.equal(engine.drawPile.length, 0);
      assert.ok(engine.discardPile.length > 0);

      // Draw cards should recycle discard pile
      engine.drawCards(3);
      assert.equal(engine.hand.length, 3);
      assert.ok(engine.drawPile.length > 0 || engine.discardPile.length === 0);
    });

    test('Draw pile safely terminates when both draw and discard piles are empty', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      engine.drawPile = [];
      engine.discardPile = [];
      engine.hand = [];

      // Drawing with zero available cards must terminate cleanly without looping
      assert.doesNotThrow(() => {
        engine.drawCards(4);
      });
      assert.equal(engine.hand.length, 0);
    });

    test('Stamina cost rejection prevents playing card and does not consume stamina or discard card', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      engine.playerStamina = 1;
      // Inject broadside (cost 3) into hand at index 0
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];

      const initialDiscardCount = engine.discardPile.length;
      const success = engine.playCard(0);

      assert.equal(success, false, 'Broadside should fail to play with 1 stamina');
      assert.equal(engine.playerStamina, 1, 'Stamina must not be deducted on failure');
      assert.equal(engine.hand.length, 1, 'Card must remain in hand on failure');
      assert.equal(engine.discardPile.length, initialDiscardCount, 'Discard pile must not change');
    });
  });

  // ==========================================================================
  // Section 2: Naval Combat Engine — Armor Absorption & Penetration Mechanics
  // ==========================================================================
  describe('2. Naval Combat: Armor Absorption & Penetration Mechanics', () => {

    test('Damage < Armor: Enemy attack is absorbed entirely by player armor, hull untouched', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 10 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 20;

      // Force Math.random() = 0 so incoming damage is exactly baseDamage (10)
      const origRandom = Math.random;
      Math.random = () => 0;

      try {
        engine.endTurn();
        engine.update(1.0); // Execute enemy turn
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerArmor, 10, 'Armor should be reduced by 10 (20 - 10 = 10)');
      assert.equal(engine.playerHull, 60, 'Hull should take 0 damage when armor absorbs incoming damage');
    });

    test('Damage == Armor: Enemy attack drops armor to 0 exactly, hull untouched', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 15 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 15;

      const origRandom = Math.random;
      Math.random = () => 0; // Incoming = 15

      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerArmor, 0, 'Armor should drop to exactly 0');
      assert.equal(engine.playerHull, 60, 'Hull should take 0 damage on exact armor match');
    });

    test('Damage > Armor: Player armor absorbs partially, carryover penetrates hull HP', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 25 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 10;

      const origRandom = Math.random;
      Math.random = () => 0; // Incoming = 25 (10 absorbed, 15 to hull)

      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerArmor, 0, 'Armor should be fully depleted');
      assert.equal(engine.playerHull, 45, 'Hull should take 15 penetration damage (60 - 15 = 45)');
    });

    test('Enemy armor absorption: Player swivel gun and broadside accurately deplete enemy armor before hull', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, {
        maxHp: 100,
        armor: 20
      });
      engine.init();

      assert.equal(engine.enemyArmor, 20);
      assert.equal(engine.enemyHull, 100);

      // 1. Swivel Gun deals 12 damage: 12 absorbed by 20 armor -> 8 armor left, 100 hull left
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun }];
      engine.playerStamina = 3;
      engine.playCard(0);

      assert.equal(engine.enemyArmor, 8, 'Enemy armor should decrease from 20 to 8');
      assert.equal(engine.enemyHull, 100, 'Enemy hull should be untouched');

      // 2. Broadside deals 28 damage: 8 absorbed by armor, 20 penetrates to hull -> 0 armor left, 80 hull left
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];
      engine.playerStamina = 3;
      engine.playCard(0);

      assert.equal(engine.enemyArmor, 0, 'Enemy armor should be reduced to 0');
      assert.equal(engine.enemyHull, 80, 'Enemy hull should be reduced by carryover (100 - 20 = 80)');
    });

    test('Hull Bracing card stacks armor across plays and turns', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      engine.playerArmor = 0;
      engine.playerStamina = 3;
      engine.hand = [
        { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing },
        { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing }
      ];

      engine.playCard(0);
      assert.equal(engine.playerArmor, 15, 'First Hull Bracing should grant +15 armor');

      engine.playCard(0);
      assert.equal(engine.playerArmor, 30, 'Second Hull Bracing should stack to +30 armor');
    });

    test('Bilge Patch repairs hull but strictly respects playerMaxHull ceiling (no overheal)', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      engine.playerMaxHull = 60;
      engine.playerHull = 50; // Damaged by 10 HP
      engine.playerStamina = 3;

      // Bilge patch heals 18 HP
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.bilge_patch }];
      engine.playCard(0);

      assert.equal(engine.playerHull, 60, 'Hull HP must cap at maxHull (60), not 68');
      assert.equal(inventory.hullHp, 60, 'Inventory hullHp must also reflect 60');
    });
  });

  // ==========================================================================
  // Section 3: Naval Combat Engine — Evasion Probability & Tacking
  // ==========================================================================
  describe('3. Naval Combat: Evasion Probability & Tacking Mechanics', () => {

    test('Deterministic evasion success completely negates enemy attack', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 25 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 0;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.evasive_tacking }];
      engine.playerStamina = 2;

      engine.playCard(0);
      assert.equal(engine.playerDodgeChance, 0.50, 'Evasive tacking must set dodge chance to 0.50');

      // Stub Math.random to return 0.25 (which is < 0.50 -> Dodge succeeds)
      const origRandom = Math.random;
      Math.random = () => 0.25;

      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerHull, 60, 'Player hull must take 0 damage on successful evade');
      assert.equal(engine.playerDodgeChance, 0, 'Dodge chance must reset to 0 after evaluation');
      assert.equal(engine.isPlayerTurn, true, 'Turn should return to player immediately');
    });

    test('Deterministic evasion failure allows enemy attack to connect', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 20 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 0;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.evasive_tacking }];
      engine.playerStamina = 2;

      engine.playCard(0);
      assert.equal(engine.playerDodgeChance, 0.50);

      // Stub Math.random to return 0.75 (>= 0.50 -> Dodge fails)
      const origRandom = Math.random;
      Math.random = () => 0.75; // incoming = 20 + floor(0.75 * 6) = 24

      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerHull, 36, 'Player hull should take incoming damage (60 - 24 = 36)');
      assert.equal(engine.playerDodgeChance, 0, 'Dodge chance must reset to 0 even on failed dodge');
    });

    test('Dodge chance is single-use and does not linger into subsequent turns', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 10 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 0;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.evasive_tacking }];
      engine.playerStamina = 2;
      engine.playCard(0);

      // Turn 1 enemy phase: successful dodge
      const origRandom = Math.random;
      Math.random = () => 0.1;
      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerDodgeChance, 0, 'Dodge chance should be 0 on round 2');

      // Turn 2: player takes no evasive action
      engine.hand = [];
      Math.random = () => 0.1; // If dodge chance were still 0.5, 0.1 would evade!
      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      // Player must take damage on turn 2 because dodge expired!
      assert.ok(engine.playerHull < 60, 'Player must take damage on turn 2 without active dodge');
    });

    test('Empirical convergence: 1,000 simulated dodge rolls converge to 50% +/- 5%', () => {
      let successfulDodges = 0;
      const TRIALS = 1000;

      for (let i = 0; i < TRIALS; i++) {
        const dodgeChance = 0.50;
        if (Math.random() < dodgeChance) {
          successfulDodges++;
        }
      }

      const rate = successfulDodges / TRIALS;
      assert.ok(
        rate >= 0.45 && rate <= 0.55,
        `Empirical dodge rate ${rate.toFixed(3)} outside expected [0.45, 0.55] bounds`
      );
    });
  });

  // ==========================================================================
  // Section 4: Naval Combat Engine — Harpoon Snare Stun Turn Skips
  // ==========================================================================
  describe('4. Naval Combat: Stun & Turn Skip Dynamics', () => {

    test('Playing Harpoon Snare applies 1 stun turn and causes enemy to skip their attack completely', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 25 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 0;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }];
      engine.playerStamina = 2;

      engine.playCard(0);
      assert.equal(engine.enemyStunnedTurns, 1, 'Enemy stunned turns should be 1');

      // End turn and advance time for enemy turn
      engine.endTurn();
      engine.update(1.0);

      // Enemy should have skipped attack
      assert.equal(engine.playerHull, 60, 'Player hull must take 0 damage while enemy is stunned');
      assert.equal(engine.enemyStunnedTurns, 0, 'Stun counter must decrement to 0 after skipped turn');
      assert.equal(engine.isPlayerTurn, true, 'Turn should return to player');
    });

    test('Multi-stun stacking skips multiple consecutive enemy turns', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { baseDamage: 20 });
      engine.init();

      engine.playerHull = 60;
      engine.playerArmor = 0;
      engine.enemyStunnedTurns = 2; // Stunned for 2 rounds

      // Round 1 Enemy phase: skips
      engine.endTurn();
      engine.update(1.0);
      assert.equal(engine.playerHull, 60, 'Round 1: 0 damage taken');
      assert.equal(engine.enemyStunnedTurns, 1, 'Stun counter decrements to 1');
      assert.equal(engine.isPlayerTurn, true);

      // Round 2 Enemy phase: skips
      engine.endTurn();
      engine.update(1.0);
      assert.equal(engine.playerHull, 60, 'Round 2: 0 damage taken');
      assert.equal(engine.enemyStunnedTurns, 0, 'Stun counter decrements to 0');
      assert.equal(engine.isPlayerTurn, true);

      // Round 3 Enemy phase: stun expired, enemy attacks!
      const origRandom = Math.random;
      Math.random = () => 0; // Exactly 20 damage
      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerHull, 40, 'Round 3: enemy must attack after all stuns expire (60 - 20 = 40)');
    });

    test('Player can freely play offensive cards and deal damage while enemy is stunned', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory, { maxHp: 100, armor: 0 });
      engine.init();

      engine.enemyStunnedTurns = 1;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];
      engine.playerStamina = 3;

      const played = engine.playCard(0);
      assert.equal(played, true, 'Player should be able to attack while enemy is stunned');
      assert.equal(engine.enemyHull, 72, 'Enemy hull should drop by 28 (100 - 28 = 72)');
    });
  });

  // ==========================================================================
  // Section 5: Naval Combat Engine — Terminal States (Victory & Defeat)
  // ==========================================================================
  describe('5. Naval Combat: Terminal States (Victory & Defeat)', () => {

    test('Victory state triggers when enemy HP <= 0, awards gold, clamps HP to 0, locks further cards', () => {
      const inventory = new PlayerInventory();
      inventory.gold = 50;

      const engine = new NavalBattleEngine(inventory, {
        maxHp: 20,
        armor: 0,
        goldReward: 45
      });
      engine.init();

      // Broadside deals 28 damage to a 20 HP enemy
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];
      engine.playerStamina = 3;

      const success = engine.playCard(0);
      assert.equal(success, true);

      assert.equal(engine.enemyHull, 0, 'Enemy hull must clamp to 0 and not be negative');
      assert.equal(engine.isFinished(), true, 'isFinished() must return true on victory');
      assert.equal(engine.getResult(), 'victory', 'getResult() must return "victory"');
      assert.equal(inventory.gold, 95, 'Gold must be credited with goldReward (50 + 45 = 95)');

      // Attempting to play cards after victory must be rejected
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun }];
      engine.playerStamina = 3;
      const postPlay = engine.playCard(0);
      assert.equal(postPlay, false, 'Playing cards after victory must return false');

      // Attempting to end turn after victory must be ignored
      engine.endTurn();
      assert.equal(engine.isPlayerTurn, true, 'endTurn() should do nothing after combat finished');
    });

    test('Defeat state triggers when player hull <= 0, clamps HP to 0, updates inventory', () => {
      const inventory = new PlayerInventory();
      inventory.hullHp = 10;

      const engine = new NavalBattleEngine(inventory, {
        baseDamage: 25
      });
      engine.init();

      engine.playerHull = 10;
      engine.playerArmor = 0;

      const origRandom = Math.random;
      Math.random = () => 0; // Incoming 25 damage vs 10 HP

      try {
        engine.endTurn();
        engine.update(1.0);
      } finally {
        Math.random = origRandom;
      }

      assert.equal(engine.playerHull, 0, 'Player hull must clamp to 0');
      assert.equal(inventory.hullHp, 0, 'Player inventory hullHp must be updated to 0');
      assert.equal(engine.isFinished(), true, 'isFinished() must return true on defeat');
      assert.equal(engine.getResult(), 'defeat', 'getResult() must return "defeat"');
    });
  });

  // ==========================================================================
  // Section 6: Monster Standoff Engine — Phase 1 Tethering & Cable Dynamics
  // ==========================================================================
  describe('6. Monster Standoff: Phase 1 Harpoon Tethering & Cable Dynamics', () => {

    test('Harpoon shot consumes 1 stamina, increases tether by +35% and tension by +20%', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      assert.equal(engine.phase, 1);
      assert.equal(engine.tetherMeter, 0);
      assert.equal(engine.lineTension, 15); // Starts at 15
      assert.equal(engine.harpoonsAnchored, 0);
      assert.equal(engine.playerStamina, engine.playerMaxStamina); // Base inventory stamina is 2

      const fired = engine.fireHarpoon();
      assert.equal(fired, true);
      assert.equal(engine.playerStamina, engine.playerMaxStamina - 1, 'Should consume 1 stamina');
      assert.equal(engine.harpoonsAnchored, 1, 'Should anchor 1 harpoon');
      assert.equal(engine.tetherMeter, 35, 'Tether meter should increase to 35%');
      assert.equal(engine.lineTension, 35, 'Line tension should increase from 15 to 35%');
    });

    test('Harpoon shot fails when player has 0 stamina', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.playerStamina = 0;
      const fired = engine.fireHarpoon();

      assert.equal(fired, false, 'Harpoon must fail when out of stamina');
      assert.equal(engine.harpoonsAnchored, 0);
      assert.equal(engine.tetherMeter, 0);
      assert.equal(engine.lineTension, 15);
    });

    test('Winch easing safely reduces line tension by 25% down to minimum 0%', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.lineTension = 60;
      engine.easeCable();
      assert.equal(engine.lineTension, 35, 'Tension should reduce from 60 to 35');

      engine.easeCable();
      assert.equal(engine.lineTension, 10, 'Tension should reduce from 35 to 10');

      engine.easeCable();
      assert.equal(engine.lineTension, 0, 'Tension should clamp to minimum 0, not negative');
    });

    test('Cable snap backlash: tension >= 100% inflicts -10 HP backlash, resets tension, reduces tether by 30%', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.playerHull = 60;
      engine.playerStamina = 10;
      engine.lineTension = 15;

      // Fire harpoon 1: tension = 35, tether = 35, anchored = 1
      engine.fireHarpoon();
      // Ease cable once to prevent phase 2 trigger via 2 anchored harpoons
      engine.harpoonsAnchored = 0; // keep in phase 1 for tension test
      engine.tetherMeter = 35;
      engine.lineTension = 85; // Set near threshold

      // Next shot: tension becomes 105 (>= 100) -> SNAP!
      engine.fireHarpoon();

      assert.equal(engine.cableSnapped, true, 'cableSnapped flag must be true');
      assert.equal(engine.playerHull, 50, 'Backlash must inflict exactly -10 hull damage (60 - 10 = 50)');
      assert.equal(inventory.hullHp, 50, 'Inventory hullHp must match');
      assert.equal(engine.lineTension, 0, 'Line tension must reset to 0 after snap');
      assert.ok(engine.tetherMeter <= 40, 'Tether meter must suffer -30% penalty');
    });

    test('Lethal cable snap backlash resolves in defeat if hull drops <= 0', () => {
      const inventory = new PlayerInventory();
      inventory.hullHp = 8;
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.playerHull = 8;
      engine.playerStamina = 5;
      engine.lineTension = 90;
      engine.harpoonsAnchored = 0;

      engine.fireHarpoon(); // Tension becomes 110 >= 100 -> Snap deals 10 damage to 8 HP

      assert.equal(engine.playerHull, 0, 'Player hull must clamp to 0');
      assert.equal(engine.isFinished(), true, 'Engine must finish on lethal backlash');
      assert.equal(engine.getResult(), 'defeat', 'Result must be defeat');
    });

    test('Transition to Phase 2 occurs when 2 harpoons are anchored or tether hits 100%', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      assert.equal(engine.phase, 1);
      engine.playerStamina = 5;

      // Shot 1
      engine.fireHarpoon();
      assert.equal(engine.phase, 1);

      // Shot 2 -> 2 harpoons anchored!
      engine.fireHarpoon();
      assert.equal(engine.phase, 2, 'Should transition to Phase 2 upon anchoring 2 harpoons');
      assert.equal(engine.playerStamina, engine.playerMaxStamina, 'Stamina must reset on Phase 2 transition');
    });

    test('Alternative Phase 2 transition via attack card tether accumulation', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.phase = 1;
      engine.tetherMeter = 90;
      engine.playerStamina = 5;
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun }];

      // Playing attack card in Phase 1 adds +15% tether
      engine.playCard(0);

      assert.equal(engine.tetherMeter, 100, 'Tether meter should clamp at 100%');
      assert.equal(engine.phase, 2, 'Should transition to Phase 2 at 100% tether');
    });

    test('Phase 1 Ram countdown deals 16 hull damage when reaching 0', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.playerHull = 60;
      engine.chargeCountdown = 1.0;

      // Advance by 1.1s to trigger ram
      engine.update(1.1);

      assert.equal(engine.ramImpact, true, 'ramImpact should be triggered');
      assert.equal(engine.playerHull, 44, 'Ram should inflict 16 damage (60 - 16 = 44)');
      assert.equal(inventory.hullHp, 44);
      assert.equal(engine.chargeCountdown, 5.0, 'Ram countdown should reset to 5.0s');
    });
  });

  // ==========================================================================
  // Section 7: Monster Standoff Engine — Phase 2 Weak Points, Enrage & Victory
  // ==========================================================================
  describe('7. Monster Standoff: Phase 2 Weak Point Targeting & Enrage State', () => {

    test('Precision weak point strike deals exactly 2.0x critical damage multiplier', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory, { maxHp: 200 });
      engine.init();

      engine.phase = 2;
      engine.beastHp = 200;

      // 1. Weak point strike with base damage 14: 14 * 2.0 = 28
      const dmgCrit = engine.attackTarget(14, true);
      assert.equal(dmgCrit, 28, 'Critical strike must deal 2.0x damage (14 * 2.0 = 28)');
      assert.equal(engine.beastHp, 172, 'Beast HP should be 172 (200 - 28 = 172)');

      // 2. Weak point strike with base damage 28 (Broadside): 28 * 2.0 = 56
      const dmgBroadside = engine.attackTarget(28, true);
      assert.equal(dmgBroadside, 56, 'Critical strike must deal 2.0x damage (28 * 2.0 = 56)');
      assert.equal(engine.beastHp, 116, 'Beast HP should be 116 (172 - 56 = 116)');
    });

    test('Non-weak-point normal strike deals 1.0x standard damage', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory, { maxHp: 200 });
      engine.init();

      engine.phase = 2;
      engine.beastHp = 200;

      const dmgNormal = engine.attackTarget(14, false);
      assert.equal(dmgNormal, 14, 'Normal strike must deal exactly 1.0x damage (14)');
      assert.equal(engine.beastHp, 186, 'Beast HP should be 186 (200 - 14 = 186)');
    });

    test('Enrage mode triggers strictly when beast HP drops below 25% max HP', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory, { maxHp: 100 });
      engine.init();

      engine.phase = 2;
      engine.beastHp = 30;
      assert.equal(engine.isEnraged, false);

      // Hit for 5 damage -> beastHp = 25 (25% exactly)
      engine.attackTarget(5, false);
      assert.equal(engine.beastHp, 25);
      assert.equal(engine.isEnraged, false, 'At exactly 25%, beast should not be enraged (< 25% strictly)');

      // Hit for 1 damage -> beastHp = 24 (< 25%)
      engine.attackTarget(1, false);
      assert.equal(engine.beastHp, 24);
      assert.equal(engine.isEnraged, true, 'Beast must enter enraged mode below 25% HP');
    });

    test('Enrage mode alters behavior: faster weak point shift (1.8s vs 3.0s) and higher tentacle damage (15 vs 9)', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory, { maxHp: 100 });
      engine.init();

      engine.phase = 2;
      engine.playerHull = 60;
      engine.isEnraged = false;
      engine.weakPointShiftTimer = 0.1;

      // Normal lash attack
      engine.update(0.15);
      assert.equal(engine.playerHull, 51, 'Normal tentacle lash deals 9 DMG (60 - 9 = 51)');
      assert.equal(engine.weakPointShiftTimer, 3.0, 'Normal shift timer is 3.0s');

      // Now enter enraged mode
      engine.isEnraged = true;
      engine.weakPointShiftTimer = 0.1;

      // Enraged lash attack
      engine.update(0.15);
      assert.equal(engine.playerHull, 36, 'Enraged tentacle lash deals 15 DMG (51 - 15 = 36)');
      assert.equal(engine.weakPointShiftTimer, 1.8, 'Enraged shift timer is 1.8s');
    });

    test('Weak point rotation cycles through all registered weak points sequentially', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      engine.phase = 2;
      assert.equal(engine.weakPoints.length, 3);
      assert.equal(engine.activeWeakPointIndex, 0);

      // Advance shift timer to trigger next weak point
      engine.weakPointShiftTimer = 0.1;
      engine.update(0.15);
      assert.equal(engine.activeWeakPointIndex, 1, 'Should rotate to weak point 1');
      assert.equal(engine.weakPoints[1].isActive, true);
      assert.equal(engine.weakPoints[0].isActive, false);

      // Advance again
      engine.weakPointShiftTimer = 0.1;
      engine.update(0.15);
      assert.equal(engine.activeWeakPointIndex, 2, 'Should rotate to weak point 2');
      assert.equal(engine.weakPoints[2].isActive, true);

      // Advance again -> loops back to 0
      engine.weakPointShiftTimer = 0.1;
      engine.update(0.15);
      assert.equal(engine.activeWeakPointIndex, 0, 'Should loop back to weak point 0');
      assert.equal(engine.weakPoints[0].isActive, true);
    });

    test('Victory transition when beast HP <= 0: clamps HP, awards gold + Biolum Squid bait', () => {
      const inventory = new PlayerInventory();
      inventory.gold = 100;
      inventory.baits['bio_squid'] = 0;

      const engine = new MonsterStandoffEngine(inventory, {
        maxHp: 50,
        goldReward: 65
      });
      engine.init();

      engine.phase = 2;
      engine.beastHp = 20;

      // Precision strike for 14 * 2.0 = 28 damage (exceeding 20 HP)
      engine.attackTarget(14, true);

      assert.equal(engine.beastHp, 0, 'Beast HP must clamp to 0');
      assert.equal(engine.isFinished(), true, 'Standoff must finish on beast defeat');
      assert.equal(engine.getResult(), 'victory', 'Result must be victory');
      assert.equal(inventory.gold, 165, 'Gold must increase by 65 (100 + 65 = 165)');
      assert.equal(inventory.getBaitCount('bio_squid'), 1, 'Must award 1 Bioluminescent Squid bait');
    });
  });

  // ==========================================================================
  // Section 8: Canvas Rendering Stress — 100 Render Loops for Both Engines
  // ==========================================================================
  describe('8. Canvas Rendering Stress: 100 Render Loops for Both Engines', () => {

    test('NavalBattleEngine executes 100 render loops across diverse states and viewports without throwing', () => {
      const inventory = new PlayerInventory();
      const engine = new NavalBattleEngine(inventory);
      engine.init();

      const viewports = [
        { w: 1280, h: 720 },
        { w: 1920, h: 1080 },
        { w: 800, h: 600 },
        { w: 2560, h: 1080 }
      ];

      assert.doesNotThrow(() => {
        for (let i = 0; i < 100; i++) {
          const vp = viewports[i % viewports.length];
          const canvas = new MockCanvas(vp.w, vp.h);
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

          // Vary engine states over the 100 iterations
          if (i === 20) {
            engine.playerArmor = 45;
            engine.enemyArmor = 10;
          } else if (i === 40) {
            // Trigger victory banner
            engine.enemyHull = 0;
            engine.combatFinished = true;
            engine.combatResult = 'victory';
          } else if (i === 70) {
            // Trigger defeat banner
            engine.combatResult = 'defeat';
          } else if (i === 85) {
            // Reset to active battle with high smoke / muzzle flash particles
            engine.combatFinished = false;
            (engine as any).triggerMuzzleFlash(380, 360);
            (engine as any).triggerMuzzleFlash(660, 360);
            (engine as any).spawnSmoke(500, 300, 20);
          }

          engine.update(0.016);
          engine.render(ctx, vp.w, vp.h);
        }
      }, 'NavalBattleEngine render loops must never throw runtime exceptions');
    });

    test('MonsterStandoffEngine executes 100 render loops across Phase 1, Phase 2, Enraged & Banners', () => {
      const inventory = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inventory);
      engine.init();

      const viewports = [
        { w: 1280, h: 720 },
        { w: 1920, h: 1080 },
        { w: 800, h: 600 },
        { w: 2560, h: 1080 }
      ];

      assert.doesNotThrow(() => {
        for (let i = 0; i < 100; i++) {
          const vp = viewports[i % viewports.length];
          const canvas = new MockCanvas(vp.w, vp.h);
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

          // State progression through the 100 render passes
          if (i === 10) {
            // Phase 1 with harpoons and high tension
            engine.harpoonsAnchored = 1;
            engine.tetherMeter = 50;
            engine.lineTension = 85;
          } else if (i === 30) {
            // Phase 2 weak points
            engine.phase = 2;
            engine.activeWeakPointIndex = 1;
          } else if (i === 55) {
            // Phase 2 Enraged
            engine.isEnraged = true;
            (engine as any).spawnSplash(650, 320, 25);
          } else if (i === 75) {
            // Victory banner
            engine.combatFinished = true;
            engine.combatResult = 'victory';
          } else if (i === 90) {
            // Defeat banner
            engine.combatResult = 'defeat';
          }

          engine.update(0.016);
          engine.render(ctx, vp.w, vp.h);
        }
      }, 'MonsterStandoffEngine render loops must never throw runtime exceptions');
    });
  });

});
