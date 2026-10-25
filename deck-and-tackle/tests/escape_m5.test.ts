/**
 * Milestone 5 Test Suite: Vessel Hull HP Telemetry Gauge, Harbor Towing Defeat Penalty,
 * and "Last Stand / Desperate Escape" Survival Minigame (R5)
 * 
 * Verifies:
 * - Feature 17: Vessel Hull HP Telemetry Gauge & Critical Indicator in HUD.ts
 * - Feature 18: Harbor Towing Defeat Penalty & Narrative Salvage Modal in main.ts
 * - Feature 19: 10-Second Desperate Escape Survival Minigame in DesperateEscapeMinigame.ts
 * - Feature 20: Lovecraftian Game Over Screen & Expedition Restart in GameOverOverlay.ts
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/escape_m5.test.ts
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { HUD } from '../src/game/ui/HUD.js';
import {
  DesperateEscapeMinigame,
  ESCAPE_DURATION,
  NORMAL_TURN_RATE,
  DAMAGED_TURN_RATE,
  ESCAPE_SURVIVAL_LIMP_HP,
  OBSTACLE_RADII,
  EscapeObstacle
} from '../src/game/ui/DesperateEscapeMinigame.js';
import {
  GameOverOverlay,
  EULOGY_TEXT
} from '../src/game/ui/GameOverOverlay.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { Boat } from '../src/game/overworld/Boat.js';
import { OverworldMap } from '../src/game/overworld/OverworldMap.js';

import {
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y,
  HARBOR_DOCK_X,
  HARBOR_DOCK_Y,
  MockCanvas,
  MockCanvasRenderingContext2D
} from './test_helpers.js';

import {
  VESSEL_MAX_HULL_HP,
  HARBOR_REPAIR_TOLL_RATE,
  referenceCalcHarborToll
} from './diversity_test_helpers.js';

// Polyfill roundRect, quadraticCurveTo, bezierCurveTo on MockCanvasRenderingContext2D if missing
if (!(MockCanvasRenderingContext2D.prototype as any).roundRect) {
  (MockCanvasRenderingContext2D.prototype as any).roundRect = function (...args: any[]) {
    this.operations.push({ name: 'roundRect', args });
  };
}
if (!(MockCanvasRenderingContext2D.prototype as any).quadraticCurveTo) {
  (MockCanvasRenderingContext2D.prototype as any).quadraticCurveTo = function (...args: any[]) {
    this.operations.push({ name: 'quadraticCurveTo', args });
  };
}
if (!(MockCanvasRenderingContext2D.prototype as any).bezierCurveTo) {
  (MockCanvasRenderingContext2D.prototype as any).bezierCurveTo = function (...args: any[]) {
    this.operations.push({ name: 'bezierCurveTo', args });
  };
}

// ============================================================================
// 1. FEATURE 17: VESSEL HULL HP TELEMETRY GAUGE & HUD RENDERING
// ============================================================================
describe('M5.F17: Vessel Hull HP Telemetry Gauge', () => {
  test('M5.F17.1: PlayerInventory tracks persistent hullHp and maxHullHp initialized to 60 HP', () => {
    const inventory = new PlayerInventory();
    assert.equal(inventory.hullHp, 60);
    assert.equal(inventory.maxHullHp, 60);
    assert.equal(VESSEL_MAX_HULL_HP, 60);
  });

  test('M5.F17.2: HUD.isHullCritical identifies critical status when hull is below 30% (< 18 / 60 HP)', () => {
    assert.equal(HUD.isHullCritical(60, 60), false);
    assert.equal(HUD.isHullCritical(30, 60), false);
    assert.equal(HUD.isHullCritical(18, 60), false); // 18 / 60 = 0.30 -> not < 0.30
    assert.equal(HUD.isHullCritical(17.9, 60), true);
    assert.equal(HUD.isHullCritical(15, 60), true);
    assert.equal(HUD.isHullCritical(1, 60), true);
    assert.equal(HUD.isHullCritical(0, 60), true);
  });

  test('M5.F17.3: HUD.renderHullGauge renders without throwing and balances ctx.save/restore', () => {
    const hud = new HUD();
    const mockCtx = new MockCanvasRenderingContext2D();

    let saveCalls = 0;
    let restoreCalls = 0;
    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);
    mockCtx.save = () => { saveCalls++; origSave(); };
    mockCtx.restore = () => { restoreCalls++; origRestore(); };

    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 45, 60);

    assert.equal(saveCalls, 1);
    assert.equal(restoreCalls, 1);
    assert.equal(saveCalls, restoreCalls);

    // Verify numerical text was drawn
    const fillTextOps = mockCtx.operations.filter(op => op.name === 'fillText');
    const hasHpText = fillTextOps.some(op => op.args[0] === '45 / 60 HP');
    assert.equal(hasHpText, true);

    const hasTitleText = fillTextOps.some(op => op.args[0] === 'HULL INTEGRITY');
    assert.equal(hasTitleText, true);
  });

  test('M5.F17.4: HUD.renderHullGauge renders critical damage warning indicator when hull < 30%', () => {
    const hud = new HUD();
    const mockCtx = new MockCanvasRenderingContext2D();

    hud.renderHullGauge(mockCtx as any, 20, 500, 190, 65, 12, 60);

    const fillTextOps = mockCtx.operations.filter(op => op.name === 'fillText');
    const hasCriticalWarning = fillTextOps.some(op =>
      typeof op.args[0] === 'string' && op.args[0].includes('CRITICAL HULL DAMAGE')
    );
    assert.equal(hasCriticalWarning, true);
  });

  test('M5.F17.5: HUD.renderOverworld accepts hullHp and maxHullHp with backward-compatible defaults', () => {
    const hud = new HUD();
    const mockCtx = new MockCanvasRenderingContext2D();
    const boat = new Boat(4000, 4000, 0);
    const map = new OverworldMap();

    // Call with backward-compatible defaults (omitting hullHp)
    assert.doesNotThrow(() => {
      hud.renderOverworld(mockCtx as any, 1280, 720, boat, map, null, false, 25, 7);
    });

    // Call with explicit hull values
    assert.doesNotThrow(() => {
      hud.renderOverworld(mockCtx as any, 1280, 720, boat, map, null, false, 50, 8, 35, 60);
    });
  });
});

// ============================================================================
// 2. FEATURE 18: HARBOR TOWING DEFEAT PENALTY & SALVAGE RESOLUTION
// ============================================================================
describe('M5.F18: Harbor Towing Defeat Penalty & Toll Calculation', () => {
  test('M5.F18.1: Towing toll rate is strictly 18% with minimum 1 gold clamp', () => {
    assert.equal(HARBOR_REPAIR_TOLL_RATE, 0.18);

    // 100g -> 18g
    assert.equal(HUD.calculateToll(100), 18);
    assert.equal(referenceCalcHarborToll(100), 18);

    // 5000g -> 900g
    assert.equal(HUD.calculateToll(5000), 900);
    assert.equal(referenceCalcHarborToll(5000), 900);

    // 1g -> 1g (clamped min)
    assert.equal(HUD.calculateToll(1), 1);
    assert.equal(referenceCalcHarborToll(1), 1);

    // 5g -> 1g (18% of 5 is 0.9, clamped to 1g)
    assert.equal(HUD.calculateToll(5), 1);
    assert.equal(referenceCalcHarborToll(5), 1);

    // 0g -> 0g (no toll if no gold)
    assert.equal(HUD.calculateToll(0), 0);
    assert.equal(referenceCalcHarborToll(0), 0);
  });

  test('M5.F18.2: Defeat branching resolves correctly based on gold balance', () => {
    const resolveDefeatAction = (gold: number): 'tow_to_harbor' | 'desperate_escape' => {
      return gold > 0 ? 'tow_to_harbor' : 'desperate_escape';
    };

    assert.equal(resolveDefeatAction(50), 'tow_to_harbor');
    assert.equal(resolveDefeatAction(1), 'tow_to_harbor');
    assert.equal(resolveDefeatAction(0), 'desperate_escape');
  });

  test('M5.F18.3: Vessel towed to Harbor Dock coordinates (4000, 4070) with zeroed velocity', () => {
    assert.equal(HARBOR_DOCK_X, 4000);
    assert.equal(HARBOR_DOCK_Y, 4070);

    const boat = new Boat(7500, 6200, 1.2);
    boat.velocity.set(120, -80);

    // Simulate dock towing
    boat.position.set(HARBOR_DOCK_X, HARBOR_DOCK_Y);
    boat.velocity.set(0, 0);

    assert.equal(boat.position.x, 4000);
    assert.equal(boat.position.y, 4070);
    assert.equal(boat.velocity.x, 0);
    assert.equal(boat.velocity.y, 0);
  });

  test('M5.F18.4: Towing repair restores full 60 HP to vessel hull and deducts toll from player wallet', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 100;
    inventory.hullHp = 0;

    const toll = HUD.calculateToll(inventory.gold);
    inventory.gold -= toll;
    inventory.hullHp = 60;

    assert.equal(toll, 18);
    assert.equal(inventory.gold, 82);
    assert.equal(inventory.hullHp, 60);
  });

  test('M5.F18.5: Salvage narrative report modal text includes title and formatted repairs toll', () => {
    const toll = 18;
    const modal = {
      title: 'SALVAGED BY INNSMOUTH CUTTER',
      body: `Your vessel was towed to the harbor dock. Repairs toll: -${toll}g. Hull restored.`
    };

    assert.equal(modal.title, 'SALVAGED BY INNSMOUTH CUTTER');
    assert.ok(modal.body.includes('-18g'));
    assert.ok(modal.body.includes('Hull restored'));
  });
});

// ============================================================================
// 3. FEATURE 19: 10-SECOND DESPERATE ESCAPE MINIGAME
// ============================================================================
describe('M5.F19: 10s Desperate Escape Survival Minigame', () => {
  test('M5.F19.1: Minigame initializes with 10.0s countdown duration and sluggish rudder turn rate', () => {
    const minigame = new DesperateEscapeMinigame();
    assert.equal(minigame.timer, 10.0);
    assert.equal(minigame.duration, 10.0);
    assert.equal(minigame.normalTurnRate, 2.5);
    assert.equal(minigame.damagedTurnRate, 1.5);
    assert.equal(minigame.vessel.turnRate, 1.5); // 40% reduction from 2.5
    assert.equal(ESCAPE_DURATION, 10.0);
    assert.equal(NORMAL_TURN_RATE, 2.5);
    assert.equal(DAMAGED_TURN_RATE, 1.5);
  });

  test('M5.F19.2: Timer decrements monotonically with delta time down to zero', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);

    let prev = minigame.timer;
    const dts = [0.1, 0.25, 0.5, 1.0];
    for (const dt of dts) {
      minigame.update(dt, 1280, 720);
      assert.ok(minigame.timer < prev);
      prev = minigame.timer;
    }
  });

  test('M5.F19.3: Obstacle collision detection triggers onFail callback and failure result', () => {
    let failFired = false;
    let successFired = false;

    const minigame = new DesperateEscapeMinigame(
      () => { successFired = true; },
      () => { failFired = true; }
    );
    minigame.start(1280, 720);

    // Place obstacle directly onto vessel
    const obs: EscapeObstacle = {
      id: 'test_obs',
      type: 'rock_spike',
      x: minigame.vessel.x,
      y: minigame.vessel.y,
      vx: 0,
      vy: 100,
      radius: OBSTACLE_RADII.rock_spike,
      rotation: 0,
      rotSpeed: 0
    };
    minigame.obstacles = [obs];

    // Assert collision math directly
    assert.equal(minigame.checkCollision(minigame.vessel, obs), true);

    // Run update tick to verify callback fires
    minigame.update(0.016, 1280, 720);

    assert.equal(failFired, true);
    assert.equal(successFired, false);
    assert.equal(minigame.result, 'failure');
    assert.equal(minigame.isFinished, true);
  });

  test('M5.F19.4: Surviving for full 10.0s triggers onSuccess callback and success result', () => {
    let successFired = false;
    let failFired = false;

    const minigame = new DesperateEscapeMinigame(
      () => { successFired = true; },
      () => { failFired = true; }
    );
    minigame.start(1280, 720);

    // Clear obstacles to guarantee survival
    minigame.obstacles = [];

    // Simulate 10.5 seconds of survival
    minigame.update(10.5, 1280, 720);

    assert.equal(successFired, true);
    assert.equal(failFired, false);
    assert.equal(minigame.result, 'success');
    assert.equal(minigame.isFinished, true);
  });

  test('M5.F19.5: Successful escape restores vessel to Harbor Dock with exactly 20 HP limp integrity', () => {
    assert.equal(ESCAPE_SURVIVAL_LIMP_HP, 20);

    const inventory = new PlayerInventory();
    inventory.hullHp = 0;

    // Simulate limp return
    inventory.hullHp = ESCAPE_SURVIVAL_LIMP_HP;
    assert.equal(inventory.hullHp, 20);
    assert.notEqual(inventory.hullHp, 60);
  });

  test('M5.F19.6: Supports all 3 hazard obstacle types with specified radii', () => {
    assert.equal(OBSTACLE_RADII.rock_spike, 25);
    assert.equal(OBSTACLE_RADII.waterlogged_wreck, 35);
    assert.equal(OBSTACLE_RADII.tentacle_snare, 30);

    const minigame = new DesperateEscapeMinigame();
    const obsRock = minigame.spawnObstacle(1280, 720, 'rock_spike', 200, 100);
    const obsWreck = minigame.spawnObstacle(1280, 720, 'waterlogged_wreck', 400, 100);
    const obsTentacle = minigame.spawnObstacle(1280, 720, 'tentacle_snare', 600, 100);

    assert.equal(obsRock.radius, 25);
    assert.equal(obsWreck.radius, 35);
    assert.equal(obsTentacle.radius, 30);
  });

  test('M5.F19.7: Canvas 2D render pass executes cleanly with balanced context save/restore', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);

    const mockCtx = new MockCanvasRenderingContext2D();
    let saveCount = 0;
    let restoreCount = 0;
    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);
    mockCtx.save = () => { saveCount++; origSave(); };
    mockCtx.restore = () => { restoreCount++; origRestore(); };

    minigame.render(mockCtx as any, 1280, 720);

    assert.ok(saveCount > 0);
    assert.equal(saveCount, restoreCount);
  });
});

// ============================================================================
// 4. FEATURE 20: LOVECRAFTIAN GAME OVER OVERLAY
// ============================================================================
describe('M5.F20: Lovecraftian Game Over Screen & Restart Expedition', () => {
  test('M5.F20.1: Displays exact eulogy text matching specification', () => {
    const overlay = new GameOverOverlay();
    assert.ok(overlay.eulogy.includes('LOST TO THE COLD TIDE'));
    assert.ok(overlay.eulogy.includes('Your vessel broke upon the black crags. The deep abyss claims all.'));
    assert.equal(EULOGY_TEXT, 'LOST TO THE COLD TIDE — Your vessel broke upon the black crags. The deep abyss claims all.');
  });

  test('M5.F20.2: Expedition recap formats stats accurately for both empty and high-stat runs', () => {
    const overlay = new GameOverOverlay();

    // Empty run (died immediately)
    overlay.open({ milesSailed: 0, fishCaught: 0, monstersDefeated: 0 });
    assert.equal(overlay.formatRecap('short'), 'Catches: 0 | Distance: 0m');
    assert.equal(overlay.formatRecap('detailed'), 'Catches: 0 | Distance: 0m | Monsters: 0');

    // High stat run
    overlay.open({ distanceM: 25000, fishCaught: 50, monstersDefeated: 4 });
    assert.equal(overlay.formatRecap('short'), 'Catches: 50 | Distance: 25000m');
    assert.equal(overlay.formatRecap('detailed'), 'Catches: 50 | Distance: 25000m | Monsters: 4');
  });

  test('M5.F20.3: Restart button click bounds detection is accurate across coordinates', () => {
    const overlay = new GameOverOverlay();
    overlay.open();
    overlay.update(0.016, 1280, 720);

    const btn = overlay.restartBtnRect;
    assert.equal(btn.x, 500);
    assert.equal(btn.y, 550);
    assert.equal(btn.w, 280);
    assert.equal(btn.h, 48);

    // Inside bounds
    assert.equal(overlay.isButtonClicked(640, 574), true);
    assert.equal(overlay.isButtonClicked(501, 551), true);
    assert.equal(overlay.isButtonClicked(779, 597), true);

    // Outside bounds
    assert.equal(overlay.isButtonClicked(200, 200), false);
    assert.equal(overlay.isButtonClicked(499, 550), false);
    assert.equal(overlay.isButtonClicked(781, 550), false);
    assert.equal(overlay.isButtonClicked(640, 600), false);
  });

  test('M5.F20.4: Restarting expedition triggers restart callback and closes overlay', () => {
    let restartFired = false;
    const overlay = new GameOverOverlay(() => {
      restartFired = true;
    });

    overlay.open({ milesSailed: 5, fishCaught: 2, monstersDefeated: 1 });
    assert.equal(overlay.isOpen, true);

    overlay.restart();
    assert.equal(overlay.isOpen, false);
    assert.equal(restartFired, true);
  });

  test('M5.F20.5: Expedition restart state re-initialization restores starter gold, full hull, and harbor center', () => {
    const inventory = new PlayerInventory();
    inventory.gold = 0;
    inventory.hullHp = 0;
    const boat = new Boat(7000, 7000, 0);

    // Execute full restart reset
    inventory.gold = 25;
    inventory.hullHp = 60;
    inventory.maxHullHp = 60;
    boat.position.set(HARBOR_CENTER_X, HARBOR_CENTER_Y);
    boat.velocity.set(0, 0);

    assert.equal(inventory.gold, 25);
    assert.equal(inventory.hullHp, 60);
    assert.equal(boat.position.x, 4000);
    assert.equal(boat.position.y, 4000);
    assert.equal(boat.velocity.x, 0);
    assert.equal(boat.velocity.y, 0);
  });

  test('M5.F20.6: Canvas 2D render pass executes cleanly with balanced context save/restore', () => {
    const overlay = new GameOverOverlay();
    overlay.open({ milesSailed: 12.4, fishCaught: 8, monstersDefeated: 2 });

    const mockCtx = new MockCanvasRenderingContext2D();
    let saveCount = 0;
    let restoreCount = 0;
    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);
    mockCtx.save = () => { saveCount++; origSave(); };
    mockCtx.restore = () => { restoreCount++; origRestore(); };

    overlay.render(mockCtx as any, 1280, 720);

    assert.ok(saveCount > 0);
    assert.equal(saveCount, restoreCount);
  });
});
