/**
 * Adversarial Challenger Stress Test Suite: Milestone 5 (R5)
 * Focus: Harbor Towing Defeat Penalty & Vessel Hull HP Telemetry Gauge (Features 17 & 18)
 * 
 * Verifies:
 * 1. Toll calculations across varied gold balances: 0g (not towed), 1g (min 1g clamp),
 *    2-5g (1g clamp), 10g (1g), 100g (18g), 999g (179g), 1,000,000g (180,000g), plus fuzzed balances.
 * 2. Defeat branching consistency: gold > 0 strictly routes to harbor dock & salvage modal (never escape minigame);
 *    gold == 0 strictly routes to 10s escape minigame (never salvage modal).
 * 3. Position & velocity resets: boat coordinates strictly set to (4000, 4070) with vx=0, vy=0 across extreme conditions.
 * 4. Hull restoration: exactly 60 HP restored upon harbor salvage regardless of overkill damage.
 * 5. HUD Hull Gauge rendering across health intervals (100%, 75%, 35%, 29% critical, 1 HP, 0 HP)
 *    with color thresholds, warning banner, and strictly balanced context save/restore state.
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/challenger_towing_stress.test.ts
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// 0. Headless DOM & Audio Mock Environment (Must precede Game import)
// ---------------------------------------------------------------------------
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

class ExtendedMockContext extends MockCanvasRenderingContext2D {
  public strokeStylesUsed: string[] = [];
  public fillStylesUsed: string[] = [];

  public stroke(): void {
    super.stroke();
    this.strokeStylesUsed.push(this.strokeStyle);
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'fillRect', args: [x, y, w, h] });
    this.fillStylesUsed.push(this.fillStyle);
  }

  public fillText(text: string, x: number, y: number, maxWidth?: number): void {
    super.fillText(text, x, y, maxWidth);
    this.fillStylesUsed.push(this.fillStyle);
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

  public createLinearGradient(x0: number, y0: number, x1: number, y1: number): any {
    return {
      addColorStop: (offset: number, color: string) => {
        this.operations.push({ name: 'addColorStop', args: [offset, color] });
      }
    };
  }

  public createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
    return {
      addColorStop: (offset: number, color: string) => {
        this.operations.push({ name: 'addColorStop', args: [offset, color] });
      }
    };
  }

  public quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.operations.push({ name: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
  }

  public bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.operations.push({ name: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }
}

class ExtendedMockCanvas extends MockCanvas {
  public style: Record<string, string> = { cursor: 'default' };
  private listeners: Map<string, Function[]> = new Map();

  constructor(width = 1280, height = 720) {
    super(width, height);
    this.ctx = new ExtendedMockContext() as any;
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
      const idx = list.indexOf(fn);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  public dispatchEvent(evt: { type: string }): boolean {
    const list = this.listeners.get(evt.type);
    if (list) {
      for (const fn of list) fn(evt);
    }
    return true;
  }
}

const primaryCanvas = new ExtendedMockCanvas(1280, 720);

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
    return new ExtendedMockCanvas(1280, 720);
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
    naturalWidth: 200;
    naturalHeight: 100;
  };
}

(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => 1;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { Game } from '../src/main.js';
import { HUD } from '../src/game/ui/HUD.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { Boat } from '../src/game/overworld/Boat.js';
import { OverworldMap } from '../src/game/overworld/OverworldMap.js';
import {
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y,
  HARBOR_DOCK_X,
  HARBOR_DOCK_Y
} from './test_helpers.js';
import {
  VESSEL_MAX_HULL_HP,
  HARBOR_REPAIR_TOLL_RATE,
  ESCAPE_SURVIVAL_LIMP_HP,
  referenceCalcHarborToll
} from './diversity_test_helpers.js';

// ============================================================================
// SUITE 1: TOLL CALCULATIONS ACROSS VARIED GOLD BALANCES
// ============================================================================
describe('Challenger Stress 1: Toll Calculations Across Varied Gold Balances', () => {
  test('CS1.1: 0g gold balance yields strictly 0g toll (not towed / ineligible for salvage toll)', () => {
    assert.equal(HUD.calculateToll(0), 0);
    assert.equal(referenceCalcHarborToll(0), 0);
  });

  test('CS1.2: 1g balance incurs minimum clamp of 1g toll (100% wallet fee)', () => {
    // 1 * 0.18 = 0.18 -> Math.floor = 0 -> clamped to 1g
    assert.equal(HUD.calculateToll(1), 1);
    assert.equal(referenceCalcHarborToll(1), 1);
  });

  test('CS1.3: 2g through 5g balances strictly clamp to 1g minimum toll', () => {
    // 2 * 0.18 = 0.36 -> floor 0 -> 1
    assert.equal(HUD.calculateToll(2), 1);
    assert.equal(referenceCalcHarborToll(2), 1);

    // 3 * 0.18 = 0.54 -> floor 0 -> 1
    assert.equal(HUD.calculateToll(3), 1);
    assert.equal(referenceCalcHarborToll(3), 1);

    // 4 * 0.18 = 0.72 -> floor 0 -> 1
    assert.equal(HUD.calculateToll(4), 1);
    assert.equal(referenceCalcHarborToll(4), 1);

    // 5 * 0.18 = 0.90 -> floor 0 -> 1
    assert.equal(HUD.calculateToll(5), 1);
    assert.equal(referenceCalcHarborToll(5), 1);
  });

  test('CS1.4: 10g balance yields exactly 1g toll (floor(1.8) = 1g)', () => {
    // 10 * 0.18 = 1.8 -> floor = 1
    assert.equal(HUD.calculateToll(10), 1);
    assert.equal(referenceCalcHarborToll(10), 1);

    // Boundary check: 11g * 0.18 = 1.98 -> floor = 1
    assert.equal(HUD.calculateToll(11), 1);
    // Boundary check: 12g * 0.18 = 2.16 -> floor = 2
    assert.equal(HUD.calculateToll(12), 2);
  });

  test('CS1.5: 100g balance yields exactly 18g toll (18% flat)', () => {
    assert.equal(HUD.calculateToll(100), 18);
    assert.equal(referenceCalcHarborToll(100), 18);
  });

  test('CS1.6: 999g balance yields exactly 179g toll (floor(179.82) = 179g)', () => {
    // 999 * 0.18 = 179.82 -> Math.floor = 179
    assert.equal(HUD.calculateToll(999), 179);
    assert.equal(referenceCalcHarborToll(999), 179);
  });

  test('CS1.7: 1,000,000g high-wealth balance yields exactly 180,000g toll', () => {
    // 1,000,000 * 0.18 = 180,000
    assert.equal(HUD.calculateToll(1000000), 180000);
    assert.equal(referenceCalcHarborToll(1000000), 180000);
  });

  test('CS1.8: Negative or zero balances never produce negative toll or NaN', () => {
    assert.equal(HUD.calculateToll(-1), 0);
    assert.equal(HUD.calculateToll(-100), 0);
    assert.equal(HUD.calculateToll(-999999), 0);
    assert.equal(referenceCalcHarborToll(-50), 0);
  });

  test('CS1.9: Property-based fuzzing across 1,000 random gold balances (1 to 500,000g)', () => {
    for (let i = 0; i < 1000; i++) {
      const g = Math.floor(Math.random() * 500000) + 1;
      const toll = HUD.calculateToll(g);
      const refToll = referenceCalcHarborToll(g);

      // Invariants
      assert.equal(toll, refToll, `Discrepancy at ${g}g`);
      assert.ok(Number.isInteger(toll), `Toll must be an integer: ${toll}`);
      assert.ok(toll >= 1, `Toll must be at least 1g when gold > 0: ${toll}`);
      assert.ok(toll <= g, `Toll (${toll}g) cannot exceed total gold (${g}g)`);
      assert.ok(g - toll >= 0, `Remaining balance cannot be negative`);
    }
  });
});

// ============================================================================
// SUITE 2: DEFEAT BRANCHING CONSISTENCY & TRANSITION INVARIANTS
// ============================================================================
describe('Challenger Stress 2: Defeat Branching Consistency', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
  });

  test('CS2.1: Vessel defeat with gold > 0 strictly opens salvage modal and NEVER triggers escape minigame', () => {
    game.inventory.gold = 50;
    game.inventory.hullHp = 0;

    assert.equal(game.escapeMinigame.isRunning, false);
    assert.equal(game.salvageReportModal, null);

    game.handleVesselDefeat();

    // Must route to harbor dock salvage
    assert.ok(game.salvageReportModal !== null);
    assert.equal(game.salvageReportModal.isOpen, true);
    assert.equal(game.salvageReportModal.toll, 9); // floor(50 * 0.18) = 9
    assert.equal(game.inventory.gold, 41);

    // Must NOT route to escape minigame
    assert.equal(game.escapeMinigame.isRunning, false);
    assert.equal(game.gameOverOverlay.isOpen, false);
  });

  test('CS2.2: Vessel defeat with gold == 0 strictly launches escape minigame and NEVER opens salvage modal', () => {
    game.inventory.gold = 0;
    game.inventory.hullHp = 0;

    assert.equal(game.escapeMinigame.isRunning, false);
    assert.equal(game.salvageReportModal, null);

    game.handleVesselDefeat();

    // Must route to escape minigame
    assert.equal(game.escapeMinigame.isRunning, true);
    assert.equal(game.escapeMinigame.timer, 10.0);

    // Must NOT have salvage report modal
    assert.equal(game.salvageReportModal, null);
  });

  test('CS2.3: Boundary gold == 1g triggers salvage (leaving 0g) and does NOT trigger escape minigame', () => {
    game.inventory.gold = 1;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.ok(game.salvageReportModal !== null);
    assert.equal(game.salvageReportModal.isOpen, true);
    assert.equal(game.salvageReportModal.toll, 1);
    assert.equal(game.inventory.gold, 0); // 1g - 1g = 0g
    assert.equal(game.escapeMinigame.isRunning, false);
  });

  test('CS2.4: Sequential defeats correctly transition from harbor towing to desperate escape when gold hits 0', () => {
    game.inventory.gold = 3;
    game.inventory.hullHp = 0;

    // First defeat with 3g
    game.handleVesselDefeat();
    assert.equal(game.salvageReportModal?.isOpen, true);
    assert.equal(game.salvageReportModal?.toll, 1);
    assert.equal(game.inventory.gold, 2);
    assert.equal(game.escapeMinigame.isRunning, false);

    // Dismiss modal & take fatal damage again (now 2g)
    game.dismissSalvageReport();
    game.inventory.hullHp = 0;
    game.handleVesselDefeat();
    assert.equal(game.salvageReportModal?.isOpen, true);
    assert.equal(game.salvageReportModal?.toll, 1);
    assert.equal(game.inventory.gold, 1);
    assert.equal(game.escapeMinigame.isRunning, false);

    // Dismiss modal & take fatal damage again (now 1g)
    game.dismissSalvageReport();
    game.inventory.hullHp = 0;
    game.handleVesselDefeat();
    assert.equal(game.salvageReportModal?.isOpen, true);
    assert.equal(game.salvageReportModal?.toll, 1);
    assert.equal(game.inventory.gold, 0); // Wallet exhausted
    assert.equal(game.escapeMinigame.isRunning, false);

    // Dismiss modal & take fatal damage again (now 0g) -> MUST trigger escape minigame!
    game.dismissSalvageReport();
    assert.equal(game.salvageReportModal, null);
    game.inventory.hullHp = 0;
    game.handleVesselDefeat();

    assert.equal(game.escapeMinigame.isRunning, true);
    assert.equal(game.salvageReportModal, null);
  });

  test('CS2.5: Re-entrancy protection: calling handleVesselDefeat while salvage modal is open does nothing', () => {
    game.inventory.gold = 100;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();
    assert.equal(game.inventory.gold, 82); // Deducted 18g once

    // Call again while modal is open
    game.handleVesselDefeat();
    assert.equal(game.inventory.gold, 82); // No second deduction
    assert.equal(game.escapeMinigame.isRunning, false);
  });
});

// ============================================================================
// SUITE 3: VESSEL POSITION & KINEMATIC VELOCITY RESETS
// ============================================================================
describe('Challenger Stress 3: Vessel Position & Kinematic Velocity Resets', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
  });

  test('CS3.1: Harbor towing strictly resets boat coordinates to (4000, 4070) from extreme outer trench', () => {
    // Place boat at far edge of map with high velocity
    game.boat.position.set(7950, 7820);
    game.boat.velocity.set(280, -310);
    game.inventory.gold = 200;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.equal(game.boat.position.x, 4000);
    assert.equal(game.boat.position.y, 4070);
    assert.equal(game.boat.position.x, HARBOR_DOCK_X);
    assert.equal(game.boat.position.y, HARBOR_DOCK_Y);
  });

  test('CS3.2: Harbor towing strictly zeroes linear velocity (vx = 0, vy = 0, speed = 0)', () => {
    game.boat.position.set(200, 300);
    game.boat.velocity.set(-450, 600);
    assert.notEqual(game.boat.velocity.magnitude(), 0);

    game.inventory.gold = 50;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.equal(game.boat.velocity.x, 0);
    assert.equal(game.boat.velocity.y, 0);
    assert.equal(game.boat.velocity.magnitude(), 0);
  });

  test('CS3.3: Boat is frozen during salvage modal display and unfreezes when dismissed', () => {
    game.inventory.gold = 100;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();
    assert.equal(game.boat.isFrozen, true);

    game.dismissSalvageReport();
    assert.equal(game.boat.isFrozen, false);
  });

  test('CS3.4: Camera immediately snaps and targets harbor dock coordinates (4000, 4070)', () => {
    game.boat.position.set(1000, 1000);
    game.camera.target.set(1000, 1000);
    game.inventory.gold = 25;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.equal(game.camera.target.x, 4000);
    assert.equal(game.camera.target.y, 4070);
  });

  test('CS3.5: Contrast test: Successful escape also relocates boat to (4000, 4070) with 0 velocity', () => {
    game.boat.position.set(6500, 6500);
    game.boat.velocity.set(300, 300);

    game.handleEscapeSuccess();

    assert.equal(game.boat.position.x, HARBOR_DOCK_X);
    assert.equal(game.boat.position.y, HARBOR_DOCK_Y);
    assert.equal(game.boat.velocity.x, 0);
    assert.equal(game.boat.velocity.y, 0);
    assert.equal(game.boat.isFrozen, false);
  });

  test('CS3.6: Contrast test: Expedition restart relocates boat to central harbor (4000, 4000), NOT dock (4000, 4070)', () => {
    game.boat.position.set(7000, 7000);
    game.boat.velocity.set(100, -100);

    game.restartExpedition();

    assert.equal(game.boat.position.x, HARBOR_CENTER_X);
    assert.equal(game.boat.position.y, HARBOR_CENTER_Y);
    assert.equal(game.boat.position.x, 4000);
    assert.equal(game.boat.position.y, 4000);
    assert.equal(game.boat.velocity.x, 0);
    assert.equal(game.boat.velocity.y, 0);
  });
});

// ============================================================================
// SUITE 4: VESSEL HULL RESTORATION INVARIANTS (SALVAGE VS ESCAPE)
// ============================================================================
describe('Challenger Stress 4: Vessel Hull Restoration Invariants', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
  });

  test('CS4.1: Exactly 60 HP restored upon harbor salvage when hull is 0 HP', () => {
    game.inventory.gold = 100;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.equal(game.inventory.hullHp, 60);
    assert.equal(game.inventory.hullHp, VESSEL_MAX_HULL_HP);
  });

  test('CS4.2: Exactly 60 HP restored even under massive negative overkill hull damage (-999 HP)', () => {
    game.inventory.gold = 100;
    game.inventory.hullHp = -999;

    game.handleVesselDefeat();

    assert.equal(game.inventory.hullHp, 60);
    assert.equal(game.inventory.maxHullHp, 60);
  });

  test('CS4.3: Contrast invariant: Escape success restores exactly 20 HP (limp), NOT 60 HP', () => {
    game.inventory.hullHp = 0;

    game.handleEscapeSuccess();

    assert.equal(game.inventory.hullHp, 20);
    assert.equal(game.inventory.hullHp, ESCAPE_SURVIVAL_LIMP_HP);
    assert.notEqual(game.inventory.hullHp, VESSEL_MAX_HULL_HP);
  });

  test('CS4.4: Salvage modal narrative text explicitly contains "Hull restored." and toll amount', () => {
    game.inventory.gold = 1000;
    game.inventory.hullHp = 0;

    game.handleVesselDefeat();

    assert.ok(game.salvageReportModal !== null);
    assert.equal(game.salvageReportModal.title, 'SALVAGED BY INNSMOUTH CUTTER');
    assert.ok(game.salvageReportModal.body.includes('-180g'));
    assert.ok(game.salvageReportModal.body.includes('Hull restored.'));
  });
});

// ============================================================================
// SUITE 5: HUD HULL GAUGE RENDERING ACROSS HEALTH INTERVALS & CANVAS ISOLATION
// ============================================================================
describe('Challenger Stress 5: HUD Hull Gauge Health Intervals & Canvas Isolation', () => {
  let hud: HUD;
  let mockCtx: ExtendedMockContext;

  beforeEach(() => {
    hud = new HUD();
    mockCtx = new ExtendedMockContext();
  });

  test('CS5.1: 100% Health Interval (60 / 60 HP) renders green bar and healthy bulkhead subtext', () => {
    let saveCount = 0;
    let restoreCount = 0;
    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);
    mockCtx.save = () => { saveCount++; origSave(); };
    mockCtx.restore = () => { restoreCount++; origRestore(); };

    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 60, 60);

    // Context balance
    assert.equal(saveCount, 1);
    assert.equal(restoreCount, 1);
    assert.equal(saveCount, restoreCount);

    // Text & Color
    assert.equal(HUD.isHullCritical(60, 60), false);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '60 / 60 HP'));
    assert.ok(fillTexts.some(op => op.args[0] === 'Reinforced Oak Bulkhead'));
    assert.ok(!fillTexts.some(op => String(op.args[0]).includes('CRITICAL')));

    // Bar fill color: green (#22c55e)
    assert.ok(mockCtx.fillStylesUsed.includes('#22c55e'));
  });

  test('CS5.2: 75% Health Interval (45 / 60 HP) renders green bar without critical warning', () => {
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 45, 60);

    assert.equal(HUD.isHullCritical(45, 60), false);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '45 / 60 HP'));
    assert.ok(!fillTexts.some(op => String(op.args[0]).includes('CRITICAL')));

    // >= 60% ratio (45/60 = 0.75) -> green (#22c55e)
    assert.ok(mockCtx.fillStylesUsed.includes('#22c55e'));
  });

  test('CS5.3: 35% Health Interval (21 / 60 HP) renders amber bar without critical warning', () => {
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 21, 60);

    assert.equal(HUD.isHullCritical(21, 60), false);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '21 / 60 HP'));
    assert.ok(!fillTexts.some(op => String(op.args[0]).includes('CRITICAL')));

    // 30% <= ratio < 60% (21/60 = 0.35) -> amber (#eab308)
    assert.ok(mockCtx.fillStylesUsed.includes('#eab308'));
    assert.ok(!mockCtx.fillStylesUsed.includes('#ef4444')); // Red must not be used for bar
  });

  test('CS5.4: 29% Critical Health Interval (17.4 / 60 HP) renders red bar and critical warning', () => {
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 17, 60);

    // 17 / 60 = 0.2833 < 0.30 -> critical
    assert.equal(HUD.isHullCritical(17, 60), true);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '17 / 60 HP'));
    assert.ok(fillTexts.some(op => String(op.args[0]).includes('CRITICAL HULL DAMAGE')));

    // < 30% ratio -> red (#ef4444)
    assert.ok(mockCtx.fillStylesUsed.includes('#ef4444'));
  });

  test('CS5.5: 1 HP Extreme Interval (1 / 60 HP) renders red bar and critical warning', () => {
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 1, 60);

    assert.equal(HUD.isHullCritical(1, 60), true);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '1 / 60 HP'));
    assert.ok(fillTexts.some(op => String(op.args[0]).includes('CRITICAL HULL DAMAGE')));

    // Bar fill width should be positive
    const fillRectOps = mockCtx.operations.filter(op => op.name === 'fillRect');
    // Track rect + bar fill rect
    assert.ok(fillRectOps.length >= 2);
    const barFill = fillRectOps[fillRectOps.length - 1];
    assert.ok(barFill.args[2] >= 0, 'Fill width must not be negative');
  });

  test('CS5.6: 0 HP Depleted Interval (0 / 60 HP) renders red bar with 0 fill width and critical warning', () => {
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 0, 60);

    assert.equal(HUD.isHullCritical(0, 60), true);
    const fillTexts = mockCtx.operations.filter(op => op.name === 'fillText');
    assert.ok(fillTexts.some(op => op.args[0] === '0 / 60 HP'));
    assert.ok(fillTexts.some(op => String(op.args[0]).includes('CRITICAL HULL DAMAGE')));

    const fillRectOps = mockCtx.operations.filter(op => op.name === 'fillRect');
    assert.ok(fillRectOps.length >= 2);
    const barFill = fillRectOps[fillRectOps.length - 1];
    assert.equal(barFill.args[2], 0, 'Fill width must be exactly 0 at 0 HP');
  });

  test('CS5.7: Threshold boundary stress at exactly 30% (18 HP) vs 29.9% (17.9 HP)', () => {
    // Exactly 18 HP: 18 / 60 = 0.30 -> NOT critical (< 0.30 condition)
    assert.equal(HUD.isHullCritical(18, 60), false);
    mockCtx.operations = [];
    mockCtx.fillStylesUsed = [];
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 18, 60);
    assert.ok(mockCtx.fillStylesUsed.includes('#eab308'), '18 HP should be amber');

    // 17.9 HP: 17.9 / 60 = 0.2983 -> IS critical
    assert.equal(HUD.isHullCritical(17.9, 60), true);
    mockCtx.operations = [];
    mockCtx.fillStylesUsed = [];
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 17.9, 60);
    assert.ok(mockCtx.fillStylesUsed.includes('#ef4444'), '17.9 HP should be red');
  });

  test('CS5.8: Threshold boundary stress at exactly 60% (36 HP) vs 59.9% (35.9 HP)', () => {
    // Exactly 36 HP: 36 / 60 = 0.60 -> green
    mockCtx.operations = [];
    mockCtx.fillStylesUsed = [];
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 36, 60);
    assert.ok(mockCtx.fillStylesUsed.includes('#22c55e'), '36 HP should be green');

    // 35.9 HP: 35.9 / 60 = 0.5983 -> amber
    mockCtx.operations = [];
    mockCtx.fillStylesUsed = [];
    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 35.9, 60);
    assert.ok(mockCtx.fillStylesUsed.includes('#eab308'), '35.9 HP should be amber');
  });

  test('CS5.9: Canvas state isolation stress over 100 consecutive frames with alternating health states', () => {
    let saveCount = 0;
    let restoreCount = 0;
    mockCtx.save = () => { saveCount++; };
    mockCtx.restore = () => { restoreCount++; };

    for (let frame = 0; frame < 100; frame++) {
      const hp = (frame % 61); // 0 to 60 HP
      hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, hp, 60);
    }

    assert.equal(saveCount, 100);
    assert.equal(restoreCount, 100);
    assert.equal(saveCount, restoreCount);
  });

  test('CS5.10: Edge case robustness: negative hull and overheal clamped safely without throwing', () => {
    let saveCount = 0;
    let restoreCount = 0;
    mockCtx.save = () => { saveCount++; };
    mockCtx.restore = () => { restoreCount++; };

    // Negative hull (-25 HP)
    assert.doesNotThrow(() => {
      hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, -25, 60);
    });

    // Overheal (120 HP)
    assert.doesNotThrow(() => {
      hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 120, 60);
    });

    // Zero maxHullHp (fallback safeMax)
    assert.doesNotThrow(() => {
      hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 20, 0);
    });

    assert.equal(saveCount, 3);
    assert.equal(restoreCount, 3);
  });

  test('CS5.11: Overworld HUD integration: renderOverworld executes hull gauge with balanced save/restore', () => {
    let saveCount = 0;
    let restoreCount = 0;
    mockCtx.save = () => { saveCount++; };
    mockCtx.restore = () => { restoreCount++; };

    const boat = new Boat(4000, 4000, 0);
    const map = new OverworldMap();

    hud.renderOverworld(
      mockCtx as any,
      1280,
      720,
      boat,
      map,
      null,
      false,
      50,
      7,
      15, // critical hull
      60
    );

    assert.ok(saveCount > 0);
    assert.equal(saveCount, restoreCount, 'Total save and restore calls across renderOverworld must balance');
  });
});
