/**
 * Adversarial Coverage Hardening (Tier 5): Combat, Defeat, Escape, and Lifecycle Balance
 * 
 * Target Systems:
 * - RoamingHostileManager.ts & HostileEntity (Collision bounds, searchlights, breach charges, harbor clamping)
 * - NavalCardData.ts & NavalBattleEngine.ts (Armor depletion, multi-turn stun, dodge, reshuffle, negative clamp)
 * - MonsterStandoffEngine.ts (Tension snap, weak point multipliers, enrage, ramming impact, phase transitions)
 * - main.ts & HUD.ts (Defeat branching, 18% towing tolls, re-entrancy, escape divergence, restart reinitialization)
 * - DesperateEscapeMinigame.ts & GameOverOverlay.ts (Obstacle collision geometry, sluggish rudder, recap formatting)
 * - Canvas 2D Lifecycle (Save/restore stack balance across long simulation runs)
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/adversarial_tier5_combat_defeat.test.ts
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Extended Mock Canvas & Context for Canvas 2D Stack Auditing
// ---------------------------------------------------------------------------
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

class AuditingMockContext extends MockCanvasRenderingContext2D {
  public saveCount: number = 0;
  public restoreCount: number = 0;

  public save(): void {
    super.save();
    this.saveCount++;
  }

  public restore(): void {
    super.restore();
    this.restoreCount++;
  }

  public roundRect(x: number, y: number, w: number, h: number, radii?: any): void {
    this.operations.push({ name: 'roundRect', args: [x, y, w, h, radii] });
  }

  public rect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'rect', args: [x, y, w, h] });
  }

  public clip(): void {
    this.operations.push({ name: 'clip', args: [] });
  }

  public quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.operations.push({ name: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
  }

  public bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.operations.push({ name: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }

  public resetAudit(): void {
    this.reset();
    this.saveCount = 0;
    this.restoreCount = 0;
  }
}

class AuditingMockCanvas extends MockCanvas {
  public style: Record<string, string> = { cursor: 'default' };
  private listeners: Map<string, Function[]> = new Map();

  constructor(width = 1280, height = 720) {
    super(width, height);
    this.ctx = new AuditingMockContext() as any;
  }

  public getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  public addEventListener(evt: string, fn: Function): void {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(fn);
  }

  public removeEventListener(evt: string, fn: Function): void {
    const list = this.listeners.get(evt);
    if (list) {
      this.listeners.set(evt, list.filter(f => f !== fn));
    }
  }
}

// ---------------------------------------------------------------------------
// Headless DOM & Audio Polyfills
// ---------------------------------------------------------------------------
const primaryCanvas = new AuditingMockCanvas(1280, 720);

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
} else {
  (globalThis as any).window.innerWidth = 1280;
  (globalThis as any).window.innerHeight = 720;
  (globalThis as any).window.devicePixelRatio = 1;
}

(globalThis as any).window.AudioContext = class MockAudioContext {
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
      stop: () => {},
      playbackRate: { value: 1 }
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
};

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {};
}

(globalThis as any).document.getElementById = (id: string) => {
  if (id === 'game-canvas') return primaryCanvas;
  return null;
};

(globalThis as any).document.createElement = (tag: string) => {
  if (tag === 'canvas') {
    return new AuditingMockCanvas(1280, 720);
  }
  if (tag === 'video') {
    return {
      src: '',
      autoplay: false,
      loop: false,
      muted: false,
      playsInline: false,
      preload: '',
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      play: () => Promise.resolve(),
      pause: () => {}
    };
  }
  return {
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
};

(globalThis as any).document.body = {
  appendChild: () => {},
  removeChild: () => {}
};

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
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
  };
}

(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => 1;

// ---------------------------------------------------------------------------
// Imports under Test
// ---------------------------------------------------------------------------
import {
  RoamingHostileManager,
  HostileEntity,
  checkConeDetection,
  COMBAT_ENGAGE_RADIUS,
  HOSTILE_CONE_DISTANCE,
  HOSTILE_CONE_ANGLE_RAD,
  BEAST_GROAN_RADIUS,
  BEAST_BREACH_RADIUS,
  HARBOR_SAFE_RADIUS,
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y,
  AUTHORITATIVE_HOSTILE_ROSTER
} from '../src/game/overworld/RoamingHostileManager.js';

import {
  AUTHORITATIVE_NAVAL_CARDS,
  createStarterNavalDeck
} from '../src/game/battle/NavalCardData.js';

import { NavalBattleEngine } from '../src/game/battle/NavalBattleEngine.js';
import { MonsterStandoffEngine } from '../src/game/battle/MonsterStandoffEngine.js';
import { HUD, calculateCompassBearing, formatMetricDistance } from '../src/game/ui/HUD.js';
import {
  DesperateEscapeMinigame,
  OBSTACLE_RADII,
  ESCAPE_DURATION,
  ESCAPE_SURVIVAL_LIMP_HP,
  NORMAL_TURN_RATE,
  DAMAGED_TURN_RATE
} from '../src/game/ui/DesperateEscapeMinigame.js';
import { GameOverOverlay, EULOGY_TEXT } from '../src/game/ui/GameOverOverlay.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { Game, HARBOR_DOCK_X, HARBOR_DOCK_Y } from '../src/main.js';
import { Camera } from '../src/engine/Camera.js';
import { Vector2 } from '../src/engine/Vector2.js';
import { Boat } from '../src/game/overworld/Boat.js';

// ============================================================================
// SUITE 1: ROAMING HOSTILE GEOMETRY & COLLISION BOUNDARIES
// ============================================================================
describe('Adversarial Suite 1: Roaming Hostile Geometry & Collision Boundaries', () => {

  describe('1.1 Combat Engagement Distance (45px Radius)', () => {
    test('ADV.1.1.1: Exact tangent touch at 45.000px engages combat', () => {
      const manager = new RoamingHostileManager();
      manager.clear();
      const entity = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, 1000, 1000, 0);
      entity.velocity = { x: 0, y: 0 };
      (manager as any).hostiles.push(entity);

      // Boat at exactly 45px distance (1000 + 45, 1000)
      const engaged = manager.update(0, { x: 1045, y: 1000 });
      assert.ok(engaged !== null, 'Tangent touch at exactly 45px must engage combat');
      assert.equal(engaged?.id, entity.id);
    });

    test('ADV.1.1.2: Infinitesimal displacement outside 45px (45.001px) does NOT engage', () => {
      const manager = new RoamingHostileManager();
      manager.clear();
      const entity = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, 1000, 1000, 0);
      entity.velocity = { x: 0, y: 0 };
      (manager as any).hostiles.push(entity);

      const engaged = manager.update(0, { x: 1045.001, y: 1000 });
      assert.equal(engaged, null, 'Entity at 45.001px must not engage');
    });

    test('ADV.1.1.3: Infinitesimal displacement inside 45px (44.999px) reliably engages', () => {
      const manager = new RoamingHostileManager();
      manager.clear();
      const entity = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, 1000, 1000, 0);
      entity.velocity = { x: 0, y: 0 };
      (manager as any).hostiles.push(entity);

      const engaged = manager.update(0, { x: 1044.999, y: 1000 });
      assert.ok(engaged !== null, 'Entity at 44.999px must engage');
    });

    test('ADV.1.1.4: Dead-center coincident collision (0px distance) engages without division-by-zero error', () => {
      const manager = new RoamingHostileManager();
      manager.clear();
      const entity = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, 1000, 1000, 0);
      entity.velocity = { x: 0, y: 0 };
      (manager as any).hostiles.push(entity);

      const engaged = manager.update(0, { x: 1000, y: 1000 });
      assert.ok(engaged !== null, 'Dead-center touch must engage cleanly');
    });
  });

  describe('1.2 Searchlight Cone Boundary Conditions (400px, 55° Angle)', () => {
    const heading = 0; // Pointing along positive X-axis
    const halfAngle = HOSTILE_CONE_ANGLE_RAD / 2;

    test('ADV.1.2.1: Target exactly at cone apex (400.000px, 0 rad) is detected', () => {
      const detected = checkConeDetection(0, 0, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, 400, 0);
      assert.equal(detected, true, 'Target at exactly 400px length must be detected');
    });

    test('ADV.1.2.2: Target immediately past apex (400.001px, 0 rad) is NOT detected', () => {
      const detected = checkConeDetection(0, 0, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, 400.001, 0);
      assert.equal(detected, false, 'Target at 400.001px must fall outside detection cone');
    });

    test('ADV.1.2.3: Target exactly on starboard boundary (dist=200px, angle=+halfAngle - 0.0001) is detected', () => {
      const nearStarboard = halfAngle - 0.0001;
      const tx = 200 * Math.cos(nearStarboard);
      const ty = 200 * Math.sin(nearStarboard);
      const detected = checkConeDetection(0, 0, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, tx, ty);
      assert.equal(detected, true, 'Target on starboard cone ray must be detected');
    });

    test('ADV.1.2.4: Target 0.001 rad outside starboard boundary is NOT detected', () => {
      const angle = halfAngle + 0.001;
      const tx = 200 * Math.cos(angle);
      const ty = 200 * Math.sin(angle);
      const detected = checkConeDetection(0, 0, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, tx, ty);
      assert.equal(detected, false, 'Target outside starboard cone ray must not be detected');
    });

    test('ADV.1.2.5: Target exactly on port boundary (dist=200px, angle=-halfAngle + 0.0001) is detected', () => {
      const nearPort = -halfAngle + 0.0001;
      const tx = 200 * Math.cos(nearPort);
      const ty = 200 * Math.sin(nearPort);
      const detected = checkConeDetection(0, 0, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, tx, ty);
      assert.equal(detected, true, 'Target on port cone ray must be detected');
    });

    test('ADV.1.2.6: Angular wraparound across branch cut (+π to -π) calculates difference without discontinuity', () => {
      // Hostile heading exactly west (π), target slightly north of west (e.g. -3.10 rad)
      const hostileHeading = Math.PI;
      const targetAngle = -Math.PI + 0.1; // ~0.1 rad difference
      const dist = 250;
      const tx = dist * Math.cos(targetAngle);
      const ty = dist * Math.sin(targetAngle);

      const detected = checkConeDetection(0, 0, hostileHeading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, tx, ty);
      assert.equal(detected, true, 'Branch cut wraparound must preserve true angular difference');
    });

    test('ADV.1.2.7: Target directly astern (180° away from heading) is NOT detected', () => {
      const detected = checkConeDetection(0, 0, 0, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, -200, 0);
      assert.equal(detected, false, 'Target behind searchlight must not be detected');
    });
  });

  describe('1.3 Ambush Sea Beast Range Transitions (Groan & Breach)', () => {
    test('ADV.1.3.1: Submerged sea beast triggers groan cue at exactly 350px distance', () => {
      const beast = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan, 2000, 2000, 0);
      assert.equal(beast.alertState, 'submerged_lurk');
      assert.equal(beast.groanPlayed, false);

      // Update at 350.0px distance
      beast.update(0.016, { x: 2350, y: 2000 });
      assert.equal(beast.groanPlayed, true, 'Groan cue must trigger at <= 350px');
    });

    test('ADV.1.3.2: Sea beast does NOT trigger groan cue at 350.1px distance', () => {
      const beast = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan, 2000, 2000, 0);
      beast.update(0.016, { x: 2350.1, y: 2000 });
      assert.equal(beast.groanPlayed, false, 'Groan cue must not trigger past 350px');
    });

    test('ADV.1.3.3: Sea beast triggers breach charge at exactly 150px distance', () => {
      const beast = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan, 2000, 2000, 0);
      beast.update(0.016, { x: 2150, y: 2000 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.equal(beast.chargeTimer, 2.5);
    });

    test('ADV.1.3.4: Sea beast does NOT breach at 150.1px distance', () => {
      const beast = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan, 2000, 2000, 0);
      beast.update(0.016, { x: 2150.1, y: 2000 });
      assert.equal(beast.alertState, 'submerged_lurk');
    });

    test('ADV.1.3.5: Breach charge timer decays and resets to submerged lurk when charge expires', () => {
      const beast = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan, 2000, 2000, 0);
      beast.update(0.016, { x: 2140, y: 2000 }); // triggers breach charge
      assert.equal(beast.alertState, 'breach_charge');

      // Advance time by 2.6 seconds while player moves away (>150px)
      beast.update(2.6, { x: 3000, y: 3000 });
      assert.equal(beast.alertState, 'submerged_lurk', 'Charge must expire back to submerged lurk');
    });
  });

  describe('1.4 Harbor Safe Zone Clamping (1200px Exclusion Zone)', () => {
    test('ADV.1.4.1: Hostile displaced inside harbor safe zone (<1200px) is clamped radially to 1200px', () => {
      // Spawn at harbor center + 600px along X
      const hostile = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, HARBOR_CENTER_X + 600, HARBOR_CENTER_Y, 0);
      // Run update to trigger boundary enforcement
      hostile.update(0.016, { x: 100, y: 100 });

      const dist = Math.sqrt((hostile.position.x - HARBOR_CENTER_X) ** 2 + (hostile.position.y - HARBOR_CENTER_Y) ** 2);
      assert.ok(dist >= HARBOR_SAFE_RADIUS - 0.001, `Distance (${dist}) must be >= 1200px`);
    });

    test('ADV.1.4.2: Hostile at exact harbor center (dist = 0px) resolves outward push without NaN', () => {
      const hostile = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, HARBOR_CENTER_X, HARBOR_CENTER_Y, 0);
      hostile.update(0.016, { x: 100, y: 100 });

      assert.ok(!Number.isNaN(hostile.position.x) && !Number.isNaN(hostile.position.y));
      assert.ok(!Number.isNaN(hostile.velocity.x) && !Number.isNaN(hostile.velocity.y));
      const dist = Math.sqrt((hostile.position.x - HARBOR_CENTER_X) ** 2 + (hostile.position.y - HARBOR_CENTER_Y) ** 2);
      assert.ok(dist >= HARBOR_SAFE_RADIUS - 0.001);
    });

    test('ADV.1.4.3: Hostile just outside harbor safe zone (1200.01px) is not pushed inwards', () => {
      const hostile = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, HARBOR_CENTER_X + 1200.01, HARBOR_CENTER_Y, 0);
      const prevX = hostile.position.x;
      hostile.update(0.001, { x: 7000, y: 7000 });

      const dist = Math.sqrt((hostile.position.x - HARBOR_CENTER_X) ** 2 + (hostile.position.y - HARBOR_CENTER_Y) ** 2);
      assert.ok(dist >= 1200, 'Hostile must remain outside harbor safe zone');
    });

    test('ADV.1.4.4: Map boundaries (100 to 7900) reflect velocities when bumped', () => {
      const hostile = new HostileEntity(AUTHORITATIVE_HOSTILE_ROSTER.crazed_trawler, 50, 1000, Math.PI); // Facing west
      hostile.update(0.016, { x: 5000, y: 5000 });

      assert.ok(hostile.position.x >= 100, 'X must clamp to 100 minimum');
      assert.ok(hostile.velocity.x > 0, 'Velocity must bounce eastward upon hitting west border');
    });
  });
});

// ============================================================================
// SUITE 2: NAVAL CARD COMBAT TURN RESOLUTION & STATUS MECHANICS
// ============================================================================
describe('Adversarial Suite 2: Naval Combat Turn Resolution & Status Mechanics', () => {

  describe('2.1 Armor Depletion & Damage Carryover', () => {
    test('ADV.2.1.1: Attack damage strictly less than enemy armor depletes armor with 0 hull damage', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 20 });
      engine.init();

      engine.applyDamageToEnemy(12, 'Swivel Gun');
      assert.equal(engine.enemyArmor, 8, 'Armor should be reduced from 20 to 8');
      assert.equal(engine.enemyHull, 80, 'Hull should take 0 damage while armor remains');
    });

    test('ADV.2.1.2: Attack damage strictly equal to enemy armor shatters armor with 0 carryover', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 20 });
      engine.init();

      engine.applyDamageToEnemy(20, 'Test Salvo');
      assert.equal(engine.enemyArmor, 0, 'Armor should be exactly depleted to 0');
      assert.equal(engine.enemyHull, 80, 'Hull should take 0 damage');
    });

    test('ADV.2.1.3: Attack damage exceeding armor carries remainder directly into hull', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 10 });
      engine.init();

      engine.applyDamageToEnemy(28, 'Broadside Cannons');
      assert.equal(engine.enemyArmor, 0, 'Armor depleted to 0');
      assert.equal(engine.enemyHull, 62, 'Hull takes 18 carryover (80 - 18 = 62)');
    });

    test('ADV.2.1.4: Direct hit with 0 armor transfers 100% of damage to hull', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 0 });
      engine.init();

      engine.applyDamageToEnemy(12, 'Swivel Gun');
      assert.equal(engine.enemyArmor, 0);
      assert.equal(engine.enemyHull, 68);
    });

    test('ADV.2.1.5: Zero damage attack does not alter armor or hull values', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 15 });
      engine.init();

      engine.applyDamageToEnemy(0, 'Blank Shot');
      assert.equal(engine.enemyArmor, 15);
      assert.equal(engine.enemyHull, 80);
    });

    test('ADV.2.1.6: Overkill damage clamps enemy hull at 0 without going negative', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 0 });
      engine.init();
      engine.enemyHull = 10;

      engine.applyDamageToEnemy(50, 'Overwhelming Salvo');
      assert.equal(engine.enemyHull, 0, 'Enemy hull must clamp to 0');
    });
  });

  describe('2.2 Multi-Turn Stun Accumulation & Consumption', () => {
    test('ADV.2.2.1: Harpoon Snare card increments enemyStunnedTurns by 1', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 20 });
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }];
      engine.playerStamina = 3;

      assert.equal(engine.enemyStunnedTurns, 0);
      engine.playCard(0);
      assert.equal(engine.enemyStunnedTurns, 1, 'Single snare must set stun to 1');
    });

    test('ADV.2.2.2: Playing two snare cards accumulates multi-turn stun (2 turns)', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 20 });
      engine.init();
      engine.hand = [
        { ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare },
        { ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }
      ];
      engine.playerStamina = 5;

      engine.playCard(0);
      engine.playCard(0);
      assert.equal(engine.enemyStunnedTurns, 2, 'Two snares must accumulate 2 stun turns');
    });

    test('ADV.2.2.3: Multi-turn stun decrements turn-by-turn and blocks enemy attacks until 0', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv, { maxHp: 80, armor: 20, baseDamage: 20 });
      engine.init();
      engine.enemyStunnedTurns = 2;
      const initialPlayerHull = engine.playerHull;

      // End Turn 1: Enemy turn triggers, consumes 1 stun, skips attack
      engine.endTurn();
      assert.equal(engine.isPlayerTurn, false);
      (engine as any).executeEnemyTurn();

      assert.equal(engine.enemyStunnedTurns, 1, 'Stun should decrement to 1');
      assert.equal(engine.playerHull, initialPlayerHull, 'Player should take 0 damage while stunned');
      assert.equal(engine.isPlayerTurn, true, 'Turn should return to player');

      // End Turn 2: Enemy turn triggers, consumes last stun, skips attack
      engine.endTurn();
      (engine as any).executeEnemyTurn();

      assert.equal(engine.enemyStunnedTurns, 0, 'Stun should decrement to 0');
      assert.equal(engine.playerHull, initialPlayerHull, 'Player should still take 0 damage');
      assert.equal(engine.isPlayerTurn, true);

      // End Turn 3: Stun is 0, enemy attacks!
      engine.endTurn();
      (engine as any).executeEnemyTurn();

      assert.ok(engine.playerHull < initialPlayerHull, 'Enemy should attack once stun reaches 0');
    });
  });

  describe('2.3 Evasive Tacking & Single-Use Dodge Resolution', () => {
    test('ADV.2.3.1: Evasive Tacking sets 50% dodge chance', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.evasive_tacking }];
      engine.playerStamina = 3;

      assert.equal(engine.playerDodgeChance, 0);
      engine.playCard(0);
      assert.equal(engine.playerDodgeChance, 0.50);
    });

    test('ADV.2.3.2: Dodge chance resets to 0 after enemy turn regardless of outcome', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.playerDodgeChance = 0.50;

      // Force execute enemy turn
      engine.isPlayerTurn = false;
      (engine as any).executeEnemyTurn();

      assert.equal(engine.playerDodgeChance, 0, 'Dodge chance must reset after enemy turn');
    });
  });

  describe('2.4 Draw Pile Reshuffling & Hand Limit Constraints', () => {
    test('ADV.2.4.1: Hand size is strictly capped at 5 cards max', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();

      assert.equal(engine.hand.length, 4);
      // Attempt to draw 10 cards
      engine.drawCards(10);
      assert.equal(engine.hand.length, 5, 'Hand size must not exceed 5');
    });

    test('ADV.2.4.2: Draw pile reshuffles from discard pile when empty', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();

      // Empty draw pile and put cards in discard
      engine.drawPile = [];
      engine.discardPile = [
        { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
        { ...AUTHORITATIVE_NAVAL_CARDS.broadside }
      ];
      engine.hand = [];

      engine.drawCards(2);
      assert.equal(engine.hand.length, 2);
      assert.equal(engine.discardPile.length, 0, 'Discard pile must be cleared upon reshuffle');
    });

    test('ADV.2.4.3: Drawing when both draw and discard piles are empty breaks cleanly without errors', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();

      engine.drawPile = [];
      engine.discardPile = [];
      engine.hand = [];

      assert.doesNotThrow(() => {
        engine.drawCards(4);
      });
      assert.equal(engine.hand.length, 0);
    });
  });

  describe('2.5 Bilge Patch HP Clamping & Illegal Card Guard', () => {
    test('ADV.2.5.1: Bilge Patch clamps playerHull at maxHullHp (60) without overflow', () => {
      const inv = new PlayerInventory();
      inv.hullHp = 55;
      inv.maxHullHp = 60;
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.bilge_patch }];
      engine.playerStamina = 3;

      engine.playCard(0);
      assert.equal(engine.playerHull, 60, 'Player hull must clamp at 60');
      assert.equal(inv.hullHp, 60, 'PlayerInventory must remain in sync');
    });

    test('ADV.2.5.2: Playing card with insufficient stamina fails cleanly', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.hand = [{ ...AUTHORITATIVE_NAVAL_CARDS.broadside }]; // 3 stamina
      engine.playerStamina = 2; // only 2 available

      const success = engine.playCard(0);
      assert.equal(success, false, 'Card play with insufficient stamina must return false');
      assert.equal(engine.hand.length, 1, 'Card must remain in hand');
    });

    test('ADV.2.5.3: Playing card during enemy turn fails cleanly', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.isPlayerTurn = false;

      const success = engine.playCard(0);
      assert.equal(success, false, 'Playing card during enemy turn must return false');
    });

    test('ADV.2.5.4: Playing card after combat has finished fails cleanly', () => {
      const inv = new PlayerInventory();
      const engine = new NavalBattleEngine(inv);
      engine.init();
      engine.combatFinished = true;

      const success = engine.playCard(0);
      assert.equal(success, false, 'Playing card after combat ends must return false');
    });
  });
});

// ============================================================================
// SUITE 3: MONSTER STANDOFF PHASE TRANSITIONS & TENSION MECHANICS
// ============================================================================
describe('Adversarial Suite 3: Monster Standoff Phase Transitions & Tension Mechanics', () => {

  describe('3.1 Cable Tension Snap under Rapid Harpooning', () => {
    test('ADV.3.1.1: Firing harpoons increases tension by +20% and tether by +35%', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      assert.equal(engine.lineTension, 15);
      assert.equal(engine.tetherMeter, 0);
      assert.equal(engine.harpoonsAnchored, 0);

      const fired = engine.fireHarpoon();
      assert.equal(fired, true);
      assert.equal(engine.lineTension, 35);
      assert.equal(engine.tetherMeter, 35);
      assert.equal(engine.harpoonsAnchored, 1);
    });

    test('ADV.3.1.2: Cable tension reaching >=100% snaps cable, damages hull (-10 HP), and resets tension', () => {
      const inv = new PlayerInventory();
      inv.hullHp = 60;
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.lineTension = 85; // One more shot pushes to 105% (>=100)
      engine.playerStamina = 5;

      engine.fireHarpoon();
      assert.equal(engine.cableSnapped, true, 'Cable snap flag must be set');
      assert.equal(engine.playerHull, 50, 'Hull takes 10 snap damage (60 - 10 = 50)');
      assert.equal(engine.lineTension, 0, 'Tension resets to 0 after snap');
      assert.equal(engine.harpoonsAnchored, 0, 'Anchored harpoons decremented by 1');
    });

    test('ADV.3.1.3: Fatal cable snap when hull <= 10 HP triggers defeat cleanly', () => {
      const inv = new PlayerInventory();
      inv.hullHp = 8; // Less than 10 HP
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.playerHull = 8;
      engine.lineTension = 90;
      engine.playerStamina = 5;

      engine.fireHarpoon();
      assert.equal(engine.playerHull, 0, 'Hull clamped at 0');
      assert.equal(engine.combatFinished, true);
      assert.equal(engine.combatResult, 'defeat');
    });

    test('ADV.3.1.4: Ease cable winch safely reduces tension by 25% clamped at 0% minimum', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.lineTension = 20;

      engine.easeCable();
      assert.equal(engine.lineTension, 0, 'Tension must clamp at 0 minimum');

      engine.lineTension = 60;
      engine.easeCable();
      assert.equal(engine.lineTension, 35, '60 - 25 = 35%');
    });
  });

  describe('3.2 Phase 1 to Phase 2 State Continuity', () => {
    test('ADV.3.2.1: Reaching 2 anchored harpoons immediately triggers Phase 2 transition', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.playerStamina = 5;

      engine.fireHarpoon(); // 1 anchored
      assert.equal(engine.phase, 1);
      engine.fireHarpoon(); // 2 anchored
      assert.equal(engine.phase, 2, '2 anchored harpoons must transition to Phase 2');
    });

    test('ADV.3.2.2: Reaching 100% tether meter triggers Phase 2 transition', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.tetherMeter = 90;
      engine.playerStamina = 5;

      engine.fireHarpoon(); // tether becomes min(100, 90 + 35) = 100%
      assert.equal(engine.phase, 2, '100% tether must transition to Phase 2');
    });

    test('ADV.3.2.3: Phase 2 transition replenishes player stamina to max', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.playerStamina = 0;

      (engine as any).transitionToPhase2();
      assert.equal(engine.phase, 2);
      assert.equal(engine.playerStamina, engine.playerMaxStamina);
    });
  });

  describe('3.3 Weak Point Targeting & Critical Multiplier (2.0x)', () => {
    test('ADV.3.3.1: Attacking active weak point applies exactly 2.0x rounded damage multiplier', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { maxHp: 130 });
      engine.init();
      (engine as any).transitionToPhase2();

      const initialBeastHp = engine.beastHp;
      const dmgDealt = engine.attackTarget(14, true); // base 14 * 2.0 = 28
      assert.equal(dmgDealt, 28);
      assert.equal(engine.beastHp, initialBeastHp - 28);
    });

    test('ADV.3.3.2: Non-weak point attack deals standard 1.0x damage', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { maxHp: 130 });
      engine.init();
      (engine as any).transitionToPhase2();

      const initialBeastHp = engine.beastHp;
      const dmgDealt = engine.attackTarget(14, false); // base 14 * 1.0 = 14
      assert.equal(dmgDealt, 14);
      assert.equal(engine.beastHp, initialBeastHp - 14);
    });

    test('ADV.3.3.3: Sea beast enrages when HP drops below 25% of max HP', () => {
      const inv = new PlayerInventory();
      const engine = new MonsterStandoffEngine(inv, { maxHp: 100 });
      engine.init();
      (engine as any).transitionToPhase2();
      assert.equal(engine.isEnraged, false);

      // Deal 76 damage -> 24 HP remaining (<25%)
      engine.attackTarget(76, false);
      assert.equal(engine.isEnraged, true, 'Beast must enrage below 25% max HP');
    });

    test('ADV.3.3.4: Slaying sea beast (HP = 0) awards gold sovereign reward and Biolum Squid bait', () => {
      const inv = new PlayerInventory();
      const initialGold = inv.gold;
      const engine = new MonsterStandoffEngine(inv, { maxHp: 50, goldReward: 65 });
      engine.init();
      (engine as any).transitionToPhase2();

      engine.attackTarget(50, false);
      assert.equal(engine.beastHp, 0);
      assert.equal(engine.combatFinished, true);
      assert.equal(engine.combatResult, 'victory');
      assert.equal(inv.gold, initialGold + 65, 'Gold reward credited');
      assert.equal(inv.getBaitCount('bio_squid'), 1, 'Biolum squid awarded');
    });
  });

  describe('3.4 Phase 1 Ram Impact Countdown', () => {
    test('ADV.3.4.1: Ramming countdown reaching <=0 inflicts 16 ram damage to hull', () => {
      const inv = new PlayerInventory();
      inv.hullHp = 60;
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      assert.equal(engine.chargeCountdown, 5.0);

      // Advance by 5.1 seconds
      engine.update(5.1);
      assert.equal(engine.playerHull, 44, '60 - 16 = 44 HP');
      assert.equal(engine.ramImpact, true);
      assert.equal(engine.chargeCountdown, 5.0, 'Timer must reset to 5.0s');
    });

    test('ADV.3.4.2: Fatal ram impact when hull <= 16 triggers defeat', () => {
      const inv = new PlayerInventory();
      inv.hullHp = 15;
      const engine = new MonsterStandoffEngine(inv);
      engine.init();
      engine.playerHull = 15;

      engine.update(5.1);
      assert.equal(engine.playerHull, 0);
      assert.equal(engine.combatFinished, true);
      assert.equal(engine.combatResult, 'defeat');
    });
  });
});

// ============================================================================
// SUITE 4: DEFEAT BRANCHING, TOWING TOLLS & ESCAPE MINIGAME
// ============================================================================
describe('Adversarial Suite 4: Defeat Branching, Towing Tolls & Escape Minigame', () => {

  describe('4.1 Defeat Towing Toll Calculations across Gold Extremes', () => {
    test('ADV.4.1.1: Gold = 0 triggers Desperate Escape minigame (0g branch)', () => {
      const game = new Game();
      game.inventory.gold = 0;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.escapeMinigame.isRunning, true, 'Penniless captain must launch escape minigame');
      assert.equal(game.salvageReportModal, null, 'Towing modal must not open for 0g');
    });

    test('ADV.4.1.2: Gold = 1 deducts minimum 1g toll (18% of 1 is 0.18 -> 1g minimum)', () => {
      const game = new Game();
      game.inventory.gold = 1;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.ok(game.salvageReportModal !== null);
      assert.equal(game.salvageReportModal?.toll, 1);
      assert.equal(game.inventory.gold, 0, '1g - 1g = 0g remaining');
      assert.equal(game.inventory.hullHp, 60, 'Hull restored to 60');
      assert.equal(game.boat.position.x, HARBOR_DOCK_X);
      assert.equal(game.boat.position.y, HARBOR_DOCK_Y);
    });

    test('ADV.4.1.3: Gold = 5 deducts minimum 1g toll (18% of 5 is 0.90 -> 1g minimum)', () => {
      const game = new Game();
      game.inventory.gold = 5;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.salvageReportModal?.toll, 1);
      assert.equal(game.inventory.gold, 4);
    });

    test('ADV.4.1.4: Gold = 6 deducts 1g toll (18% of 6 is 1.08 -> floor 1g)', () => {
      const game = new Game();
      game.inventory.gold = 6;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.salvageReportModal?.toll, 1);
      assert.equal(game.inventory.gold, 5);
    });

    test('ADV.4.1.5: Gold = 100 deducts exactly 18g toll (18% of 100)', () => {
      const game = new Game();
      game.inventory.gold = 100;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.salvageReportModal?.toll, 18);
      assert.equal(game.inventory.gold, 82);
    });

    test('ADV.4.1.6: Gold = 1,000,000 deducts 180,000g toll without numerical overflow', () => {
      const game = new Game();
      game.inventory.gold = 1_000_000;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.salvageReportModal?.toll, 180_000);
      assert.equal(game.inventory.gold, 820_000);
    });
  });

  describe('4.2 Re-Entrant Defeat Guards', () => {
    test('ADV.4.2.1: Calling handleVesselDefeat while salvageReportModal is open is a no-op', () => {
      const game = new Game();
      game.inventory.gold = 100;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.inventory.gold, 82);

      // Immediate second call while modal is open
      game.handleVesselDefeat();
      assert.equal(game.inventory.gold, 82, 'Second defeat call must be ignored while modal is open');
    });

    test('ADV.4.2.2: Calling handleVesselDefeat while escape minigame is running is a no-op', () => {
      const game = new Game();
      game.inventory.gold = 0;
      game.inventory.hullHp = 0;

      game.handleVesselDefeat();
      assert.equal(game.escapeMinigame.isRunning, true);
      const timerBefore = game.escapeMinigame.timer;

      game.handleVesselDefeat();
      assert.equal(game.escapeMinigame.timer, timerBefore, 'Escape minigame must not be restarted while active');
    });

    test('ADV.4.2.3: Calling handleVesselDefeat while gameOverOverlay is open is a no-op', () => {
      const game = new Game();
      game.gameOverOverlay.open();

      game.handleVesselDefeat();
      assert.equal(game.salvageReportModal, null);
      assert.equal(game.escapeMinigame.isRunning, false);
    });
  });

  describe('4.3 Desperate Escape Obstacle Collision Geometry', () => {
    test('ADV.4.3.1: Vessel (radius 18) vs Rock Spike (radius 25) collides at sum-radius - 0.01px', () => {
      const escape = new DesperateEscapeMinigame();
      const vessel = { x: 500, y: 500, radius: 18 };
      const obs = {
        id: 'rock1',
        type: 'rock_spike' as const,
        x: 500 + (18 + 25) - 0.1, // 542.9px
        y: 500,
        vx: 0,
        vy: 0,
        radius: 25,
        rotation: 0,
        rotSpeed: 0
      };

      assert.equal(escape.checkCollision(vessel, obs), true, '42.9px distance < 43px sum must collide');
    });

    test('ADV.4.3.2: Vessel vs Rock Spike does NOT collide at sum-radius + 0.1px', () => {
      const escape = new DesperateEscapeMinigame();
      const vessel = { x: 500, y: 500, radius: 18 };
      const obs = {
        id: 'rock2',
        type: 'rock_spike' as const,
        x: 500 + (18 + 25) + 0.1, // 543.1px
        y: 500,
        vx: 0,
        vy: 0,
        radius: 25,
        rotation: 0,
        rotSpeed: 0
      };

      assert.equal(escape.checkCollision(vessel, obs), false, '43.1px distance > 43px sum must not collide');
    });

    test('ADV.4.3.3: Vessel vs Waterlogged Wreck (radius 35) collides within 53px', () => {
      const escape = new DesperateEscapeMinigame();
      const vessel = { x: 500, y: 500, radius: 18 };
      const obs = {
        id: 'wreck1',
        type: 'waterlogged_wreck' as const,
        x: 500,
        y: 500 + 52.9,
        vx: 0,
        vy: 0,
        radius: 35,
        rotation: 0,
        rotSpeed: 0
      };

      assert.equal(escape.checkCollision(vessel, obs), true);
    });

    test('ADV.4.3.4: Rudder steering turn rate is sluggish damaged rate (1.5 rad/s vs 2.5 rad/s)', () => {
      const escape = new DesperateEscapeMinigame();
      assert.equal(escape.damagedTurnRate, 1.5);
      assert.equal(escape.vessel.turnRate, 1.5);
      assert.equal(escape.normalTurnRate, 2.5);
    });
  });

  describe('4.4 Escape Minigame Survival vs Failure Branching', () => {
    test('ADV.4.4.1: Escape survival limps into harbor dock with exactly 20 HP', () => {
      const game = new Game();
      game.inventory.gold = 0;
      game.inventory.hullHp = 0;

      game.handleEscapeSuccess();
      assert.equal(game.inventory.hullHp, ESCAPE_SURVIVAL_LIMP_HP, 'Surviving limps vessel with 20 HP');
      assert.equal(game.boat.position.x, HARBOR_DOCK_X);
      assert.equal(game.boat.position.y, HARBOR_DOCK_Y);
      assert.equal(game.boat.isFrozen, false, 'Boat controls must be unfrozen');
      assert.ok(game.escapeNoticeTimer > 0, 'Escape notice banner must be visible');
    });

    test('ADV.4.4.2: Escape failure transitions to Lovecraftian GameOverOverlay with stats recap', () => {
      const game = new Game();
      game.inventory.totalFishCaught = 7;
      game.monstersDefeated = 2;
      game.totalDistanceTraveled = 3704; // 2 NM

      game.handleEscapeFailure();
      assert.equal(game.gameOverOverlay.isOpen, true, 'Game over overlay must open');
      assert.equal(game.gameOverOverlay.fishCaught, 7);
      assert.equal(game.gameOverOverlay.monstersDefeated, 2);
      assert.equal(game.gameOverOverlay.milesSailed, 2);
      assert.equal(game.boat.isFrozen, true);
    });

    test('ADV.4.4.3: Restart expedition reinitializes state cleanly to pristine start', () => {
      const game = new Game();
      game.inventory.gold = 0;
      game.inventory.hullHp = 0;
      game.inventory.totalFishCaught = 15;
      game.monstersDefeated = 4;
      game.boat.position.set(200, 200);

      game.restartExpedition();
      assert.equal(game.inventory.gold, 25, 'Starting gold reset to 25');
      assert.equal(game.inventory.hullHp, 60, 'Starting hull reset to 60');
      assert.equal(game.inventory.deck.length, 7, 'Starter tackle deck restored');
      assert.equal(game.inventory.navalDeck.length, 8, 'Starter naval deck restored');
      assert.equal(game.boat.position.x, HARBOR_CENTER_X);
      assert.equal(game.boat.position.y, HARBOR_CENTER_Y);
      assert.equal(game.boat.isFrozen, false);
      assert.equal(game.totalDistanceTraveled, 0);
      assert.equal(game.monstersDefeated, 0);
    });
  });
});

// ============================================================================
// SUITE 5: CANVAS 2D SAVE/RESTORE LIFECYCLE BALANCE ACROSS LONG SIMULATIONS
// ============================================================================
describe('Adversarial Suite 5: Canvas 2D Lifecycle Balance Across Long Simulation Runs', () => {

  const camera = new Camera(1280, 720);

  test('ADV.5.1.1: RoamingHostileManager.renderWorld() balances save() and restore() across 100 simulation passes', () => {
    const mockCtx = new AuditingMockContext();
    const manager = new RoamingHostileManager();

    for (let frame = 0; frame < 100; frame++) {
      manager.update(0.016, { x: 4000, y: 4000 });
      manager.renderWorld(mockCtx as any, camera);
    }

    assert.ok(mockCtx.saveCount > 0, 'Must perform save operations');
    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `renderWorld save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match exactly`
    );
  });

  test('ADV.5.1.2: RoamingHostileManager.renderLighting() balances save() and restore() across 100 simulation passes', () => {
    const mockCtx = new AuditingMockContext();
    const manager = new RoamingHostileManager();

    for (let frame = 0; frame < 100; frame++) {
      manager.update(0.016, { x: 4000, y: 4000 });
      manager.renderLighting(mockCtx as any, camera, 1);
    }

    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `renderLighting save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match exactly`
    );
  });

  test('ADV.5.1.3: RoamingHostileManager.renderSearchlights() balances save() and restore() across 100 simulation passes', () => {
    const mockCtx = new AuditingMockContext();
    const manager = new RoamingHostileManager();

    for (let frame = 0; frame < 100; frame++) {
      manager.update(0.016, { x: 4000, y: 4000 });
      manager.renderSearchlights(mockCtx as any, camera);
    }

    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `renderSearchlights save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match exactly`
    );
  });

  test('ADV.5.1.4: NavalBattleEngine.render() maintains perfect stack balance across 50 frames', () => {
    const mockCtx = new AuditingMockContext();
    const inv = new PlayerInventory();
    const engine = new NavalBattleEngine(inv);
    engine.init();

    for (let frame = 0; frame < 50; frame++) {
      engine.update(0.016);
      engine.render(mockCtx as any, 1280, 720);
    }

    assert.ok(mockCtx.saveCount > 0);
    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `NavalBattleEngine render save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match`
    );
  });

  test('ADV.5.1.5: MonsterStandoffEngine.render() maintains stack balance in both Phase 1 and Phase 2', () => {
    const mockCtx = new AuditingMockContext();
    const inv = new PlayerInventory();
    const engine = new MonsterStandoffEngine(inv);
    engine.init();

    // 25 frames Phase 1
    for (let frame = 0; frame < 25; frame++) {
      engine.update(0.016);
      engine.render(mockCtx as any, 1280, 720);
    }
    assert.equal(mockCtx.saveCount, mockCtx.restoreCount, 'Phase 1 stack must be balanced');

    // Transition to Phase 2 and render 25 frames
    (engine as any).transitionToPhase2();
    for (let frame = 0; frame < 25; frame++) {
      engine.update(0.016);
      engine.render(mockCtx as any, 1280, 720);
    }
    assert.equal(mockCtx.saveCount, mockCtx.restoreCount, 'Phase 2 stack must be balanced');
  });

  test('ADV.5.1.6: DesperateEscapeMinigame.render() maintains stack balance with active obstacles and particles', () => {
    const mockCtx = new AuditingMockContext();
    const escape = new DesperateEscapeMinigame();
    escape.start(1280, 720);

    for (let frame = 0; frame < 60; frame++) {
      escape.update(0.016, 1280, 720);
      escape.render(mockCtx as any, 1280, 720);
    }

    assert.ok(mockCtx.saveCount > 0);
    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `DesperateEscape save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match`
    );
  });

  test('ADV.5.1.7: GameOverOverlay.render() balances save() and restore()', () => {
    const mockCtx = new AuditingMockContext();
    const overlay = new GameOverOverlay();
    overlay.open({ milesSailed: 5, fishCaught: 10, monstersDefeated: 3 });

    for (let frame = 0; frame < 20; frame++) {
      overlay.update(0.016, 1280, 720);
      overlay.render(mockCtx as any, 1280, 720);
    }

    assert.ok(mockCtx.saveCount > 0);
    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `GameOverOverlay save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match`
    );
  });

  test('ADV.5.1.8: HUD.renderOverworld() maintains exact save() and restore() balance', () => {
    const mockCtx = new AuditingMockContext();
    const hud = new HUD();
    const boat = new Boat(4000, 4000, 0);
    const map = {
      getZoneAt: () => 'shallow',
      getZoneDisplayName: () => 'The Shallows',
      harborDock: { isPlayerNearby: false }
    } as any;

    for (let frame = 0; frame < 30; frame++) {
      hud.update(0.016);
      hud.renderOverworld(mockCtx as any, 1280, 720, boat, map, null, false, 25, 7, 60, 60);
    }

    assert.ok(mockCtx.saveCount > 0);
    assert.equal(
      mockCtx.saveCount,
      mockCtx.restoreCount,
      `HUD save (${mockCtx.saveCount}) and restore (${mockCtx.restoreCount}) must match`
    );
  });
});
