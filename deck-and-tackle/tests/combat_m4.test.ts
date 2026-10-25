/**
 * combat_m4.test.ts
 * Unit and integration tests for Milestone 4 (R4):
 * - NavalCardData catalog & starter deck
 * - PlayerInventory navalDeck integration
 * - RoamingHostileManager & HostileEntity AI & cone detection
 * - NavalBattleEngine side-angle broadside combat
 * - MonsterStandoffEngine 2-phase beast combat
 * - HarborShopOverlay dual-deck inspection view
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHORITATIVE_NAVAL_CARDS,
  createStarterNavalDeck
} from '../src/game/battle/NavalCardData.js';

import { PlayerInventory } from '../src/game/player/PlayerInventory.js';

import {
  RoamingHostileManager,
  HostileEntity,
  AUTHORITATIVE_HOSTILE_ROSTER,
  checkConeDetection,
  HOSTILE_CONE_ANGLE_RAD,
  HOSTILE_CONE_DISTANCE,
  BEAST_GROAN_RADIUS,
  BEAST_BREACH_RADIUS,
  COMBAT_ENGAGE_RADIUS,
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y
} from '../src/game/overworld/RoamingHostileManager.js';

import { NavalBattleEngine } from '../src/game/battle/NavalBattleEngine.js';
import { MonsterStandoffEngine } from '../src/game/battle/MonsterStandoffEngine.js';
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

// Headless polyfills for Image and canvas operations in Node.js test runner
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
if (typeof (MockCanvasRenderingContext2D.prototype as any).roundRect !== 'function') {
  (MockCanvasRenderingContext2D.prototype as any).roundRect = function(...args: any[]) {
    this.operations.push({ name: 'roundRect', args });
  };
}

import { HarborShopOverlay } from '../src/game/ui/HarborShopOverlay.js';

describe('Milestone 4: Enemies, Naval Combat & Dual Deck Tests', () => {

  // ==========================================================================
  // 1. NavalCardData & Starter Deck
  // ==========================================================================
  describe('1. NavalCardData & Deck Creation', () => {
    test('Authoritative naval cards have defined costs, damage, armor, repair, dodge, and stun values', () => {
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.swivel_gun.damage, 12);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.swivel_gun.staminaCost, 1);

      assert.equal(AUTHORITATIVE_NAVAL_CARDS.broadside.damage, 28);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.broadside.staminaCost, 3);

      assert.equal(AUTHORITATIVE_NAVAL_CARDS.hull_bracing.armorGain, 15);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.hull_bracing.staminaCost, 1);

      assert.equal(AUTHORITATIVE_NAVAL_CARDS.evasive_tacking.dodgeChance, 0.50);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.evasive_tacking.staminaCost, 2);

      assert.equal(AUTHORITATIVE_NAVAL_CARDS.bilge_patch.hullRepair, 18);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.bilge_patch.staminaCost, 2);

      assert.equal(AUTHORITATIVE_NAVAL_CARDS.harpoon_snare.damage, 8);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.harpoon_snare.stunTurns, 1);
      assert.equal(AUTHORITATIVE_NAVAL_CARDS.harpoon_snare.staminaCost, 2);
    });

    test('createStarterNavalDeck produces 8 initial cards with copies of essential battle actions', () => {
      const deck = createStarterNavalDeck();
      assert.equal(deck.length, 8);
      assert.ok(deck.some(c => c.id === 'naval_swivel_gun'));
      assert.ok(deck.some(c => c.id === 'naval_broadside'));
      assert.ok(deck.some(c => c.id === 'naval_hull_bracing'));
      assert.ok(deck.some(c => c.id === 'naval_evasive_tack'));
      assert.ok(deck.some(c => c.id === 'naval_bilge_patch'));
      assert.ok(deck.some(c => c.id === 'naval_harpoon_snare'));
    });
  });

  // ==========================================================================
  // 2. PlayerInventory Naval Deck Integration
  // ==========================================================================
  describe('2. PlayerInventory Naval Deck Tracking', () => {
    test('PlayerInventory initializes with starter navalDeck and provides independent copy', () => {
      const inv = new PlayerInventory();
      assert.equal(inv.navalDeck.length, 8);
      assert.equal(inv.hullHp, 60);
      assert.equal(inv.maxHullHp, 60);

      const copy = inv.getNavalDeckCopy();
      assert.equal(copy.length, 8);
      copy.pop();
      assert.equal(inv.navalDeck.length, 8, 'Original navalDeck unmodified by copy mutation');
    });

    test('addNavalCard successfully appends cards to navalDeck', () => {
      const inv = new PlayerInventory();
      inv.addNavalCard({ ...AUTHORITATIVE_NAVAL_CARDS.broadside });
      assert.equal(inv.navalDeck.length, 9);
      assert.equal(inv.navalDeck[8].id, 'naval_broadside');
    });
  });

  // ==========================================================================
  // 3. RoamingHostileManager & HostileEntity AI
  // ==========================================================================
  describe('3. Roaming Hostiles Spawning & Behavior', () => {
    test('Hostile manager spawns and maintains 4-6 hostiles outside safe harbor (>1200px)', () => {
      const manager = new RoamingHostileManager();
      const hostiles = manager.getHostiles();
      assert.ok(hostiles.length >= 4 && hostiles.length <= 6);

      for (const h of hostiles) {
        const dx = h.position.x - HARBOR_CENTER_X;
        const dy = h.position.y - HARBOR_CENTER_Y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        assert.ok(dist >= 1200, `Hostile ${h.name} distance (${dist}) must be >= 1200px`);
      }
    });

    test('Searchlight cone detection math accurately detects targets inside cone and rejects outside', () => {
      // Source at (4000, 2000), facing south (Math.PI / 2)
      const srcX = 4000;
      const srcY = 2000;
      const heading = Math.PI / 2;

      // Inside cone: 200px ahead
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, 4000, 2200),
        true
      );

      // Outside cone: 405px ahead (> 400px)
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, 4000, 2405),
        false
      );

      // Outside cone: behind vessel (angle 180°)
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, 4000, 1900),
        false
      );
    });

    test('Patrol vessel transitions from patrol to alert to pursuit when player is in cone', () => {
      const trawlerTemplate = AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler;
      const vessel = new HostileEntity(trawlerTemplate, 4000, 2000, Math.PI / 2);
      assert.equal(vessel.alertState, 'patrol');

      // Player in cone at (4000, 2150)
      vessel.update(0.1, { x: 4000, y: 2150 });
      assert.equal(vessel.alertState, 'alert');
      assert.equal(vessel.alertTimer, 1.0);

      // Wait 1.0s in cone
      vessel.update(1.0, { x: 4000, y: 2150 });
      assert.equal(vessel.alertState, 'pursuit');
    });

    test('Ambush beast lurks submerged and breach-charges when player approaches within 150px', () => {
      const whaleTemplate = AUTHORITATIVE_HOSTILE_ROSTER.mutated_whale;
      const beast = new HostileEntity(whaleTemplate, 4000, 2000, 0);
      assert.equal(beast.alertState, 'submerged_lurk');

      // Player at 300px distance triggers groan check
      beast.update(0.1, { x: 4000, y: 2300 });
      assert.equal(beast.groanPlayed, true);
      assert.equal(beast.alertState, 'submerged_lurk');

      // Player at 120px distance triggers breach charge
      beast.update(0.1, { x: 4000, y: 2120 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.equal(beast.chargeTimer, 2.5);
    });

    test('Combat engagement triggers when boat is within 45px', () => {
      const manager = new RoamingHostileManager();
      // Set hostile at (4000, 2000)
      const h = manager.getHostiles()[0];
      h.position.x = 4000;
      h.position.y = 2000;

      // Player at 40px away
      const engaged = manager.update(0.1, { x: 4000, y: 2040 });
      assert.ok(engaged !== null);
      assert.equal(engaged?.id, h.id);
    });
  });

  // ==========================================================================
  // 4. NavalBattleEngine Side-Angle Broadside Combat
  // ==========================================================================
  describe('4. NavalBattleEngine Warship Combat', () => {
    test('Naval battle initializes with 4 hand cards, full stamina, and opposing warship stats', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { name: 'Raider Frigate', maxHp: 80, armor: 20 });
      engine.init();

      assert.equal(engine.hand.length, 4);
      assert.equal(engine.playerStamina, 3);
      assert.equal(engine.enemyHull, 80);
      assert.equal(engine.enemyArmor, 20);
      assert.equal(engine.isFinished(), false);
    });

    test('Playing broadside card deducts 3 stamina and inflicts 28 damage (absorbed by armor first)', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { name: 'Raider Frigate', maxHp: 80, armor: 20 });
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];
      engine.playerStamina = 3;

      const played = engine.playCard(0);
      assert.equal(played, true);
      assert.equal(engine.playerStamina, 0);
      assert.equal(engine.enemyArmor, 0); // 20 absorbed
      assert.equal(engine.enemyHull, 72); // 88 - 8 = 72
    });

    test('Harpoon snare card stuns enemy, skipping their attack on subsequent turn', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { name: 'Raider Frigate', maxHp: 80, armor: 0, baseDamage: 20 });
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }];
      engine.playerStamina = 2;

      engine.playCard(0);
      assert.equal(engine.enemyStunnedTurns, 1);

      // End turn triggers enemy phase
      engine.endTurn();
      assert.equal(engine.isPlayerTurn, false);

      // Advance enemy turn timer
      engine.update(1.1);
      // Enemy attack skipped due to stun
      assert.equal(engine.playerHull, 60, 'Player hull unharmed while enemy is stunned');
      assert.equal(engine.enemyStunnedTurns, 0);
      assert.equal(engine.isPlayerTurn, true);
    });

    test('Reducing enemy warship hull to 0 resolves in victory and awards gold', () => {
      const inv = new PlayerInventory();
      const initialGold = inv.gold;
      const engine = new NavalBattleEngine(inv, { name: 'Raider Frigate', maxHp: 20, armor: 0, goldReward: 50 });
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }];
      engine.playerStamina = 3;

      engine.playCard(0);
      assert.equal(engine.enemyHull, 0);
      assert.equal(engine.isFinished(), true);
      assert.equal(engine.getResult(), 'victory');
      assert.equal(inv.gold, initialGold + 50);
    });
  });

  // ==========================================================================
  // 5. MonsterStandoffEngine 2-Phase Standoff
  // ==========================================================================
  describe('5. MonsterStandoffEngine 2-Phase Standoff', () => {
    test('Monster standoff starts in Phase 1: Harpoon Tethering', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { name: 'Kelp Leviathan', maxHp: 130 });
      engine.init();

      assert.equal(engine.phase, 1);
      assert.equal(engine.tetherMeter, 0);
      assert.equal(engine.harpoonsAnchored, 0);
      assert.equal(engine.isFinished(), false);
    });

    test('Firing harpoon increases tether meter and tension, triggering Phase 2 when anchored', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { name: 'Kelp Leviathan', maxHp: 130 });
      engine.init();

      engine.fireHarpoon();
      assert.equal(engine.harpoonsAnchored, 1);
      assert.equal(engine.tetherMeter, 35);
      assert.equal(engine.phase, 1);

      engine.fireHarpoon();
      assert.equal(engine.harpoonsAnchored, 2);
      assert.equal(engine.phase, 2, '2 harpoons anchored transitions battle to Phase 2: Weak Points');
    });

    test('Tension exceeding 100% causes cable snap and -10 hull damage backlash', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { name: 'Kelp Leviathan', maxHp: 130 });
      engine.init();
      engine.lineTension = 90;

      engine.fireHarpoon(); // +20 tension -> 110%
      assert.equal(engine.cableSnapped, true);
      assert.equal(engine.lineTension, 0);
      assert.equal(engine.playerHull, 50, 'Cable snap inflicts 10 hull damage');
    });

    test('Phase 2 critical weak point strike deals 2.0x base damage', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { name: 'Kelp Leviathan', maxHp: 130 });
      engine.init();
      engine.phase = 2;

      const baseDmg = 28;
      const critDmg = engine.attackTarget(baseDmg, true);
      assert.equal(critDmg, 56);
      assert.equal(engine.beastHp, 130 - 56);
    });

    test('Reducing beast HP to 0 resolves in victory and awards apex rewards', () => {
      const inv = new PlayerInventory();
      const initialGold = inv.gold;
      const engine = new MonsterStandoffEngine(inv, { name: 'Kelp Leviathan', maxHp: 40, goldReward: 70 });
      engine.init();
      engine.phase = 2;

      engine.attackTarget(25, true); // 50 damage
      assert.equal(engine.beastHp, 0);
      assert.equal(engine.isFinished(), true);
      assert.equal(engine.getResult(), 'victory');
      assert.equal(inv.gold, initialGold + 70);
      assert.equal(inv.getBaitCount('bio_squid'), 1);
    });
  });

  // ==========================================================================
  // 6. HarborShopOverlay Dual Deck Spread
  // ==========================================================================
  describe('6. HarborShopOverlay Dual Deck Spread', () => {
    test('HarborShopOverlay renders dual-page spread with Tackle Deck on left and Naval Armory on right', () => {
      const inv = new PlayerInventory();
      let closed = false;
      const shop = new HarborShopOverlay(inv, () => { closed = true; });

      // Toggle to deck view mode
      (shop as any).toggleViewMode();
      assert.equal((shop as any).viewMode, 'deck_view');

      // Mock canvas render pass
      const canvas = new MockCanvas(1280, 720);
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;

      shop.render(ctx as any, 1280, 720);
      assert.ok(ctx.hasOperation('fillText'));

      // Close shop cleanly
      (shop as any).onClose();
      assert.equal(closed, true);
    });

    test('Rendering empty naval deck displays placeholder "No Armory Cards Fitted"', () => {
      const inv = new PlayerInventory();
      inv.navalDeck = []; // empty armory

      const shop = new HarborShopOverlay(inv, () => {});
      (shop as any).toggleViewMode();

      const canvas = new MockCanvas(1280, 720);
      const ctx = canvas.getContext('2d') as MockCanvasRenderingContext2D;

      shop.render(ctx as any, 1280, 720);
      const textOps = ctx.operations.filter(op => op.name === 'fillText');
      const hasPlaceholder = textOps.some(op => op.args[0] === 'No Armory Cards Fitted');
      assert.equal(hasPlaceholder, true);
    });
  });
});
