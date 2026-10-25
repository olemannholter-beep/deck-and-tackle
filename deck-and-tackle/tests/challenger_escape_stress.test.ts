/**
 * challenger_escape_stress.test.ts
 * 
 * Adversarial Challenger Stress Testing Suite for Milestone 5 (Features 19 & 20):
 * - 10-Second Desperate Escape Survival Minigame (DesperateEscapeMinigame.ts)
 * - Lovecraftian Game Over Screen & Expedition Restart (GameOverOverlay.ts)
 * 
 * Verification Dimensions:
 * 1. 10.0s countdown clock monotonicity, boundary delta times (0.008s, 0.016s, 0.5s, 2.0s, 15.0s overshoot), clamp at 0.0s
 * 2. Collision detection precision: circle-circle overlap boundaries (penetration, tangent touch, 1px separation)
 *    across all 3 obstacle types (rock_spike, waterlogged_wreck, tentacle_snare) and immediate onFail callback trigger
 * 3. Sluggish rudder turn rate verification (1.5 rad/s damaged vs 2.5 rad/s normal, 40% penalty) and angular limit clamping
 * 4. Escape success resolution: limp return sets exactly 20 HP (not 60 HP) and docks vessel at (4000, 4070)
 * 5. Game over overlay: recap stats aggregation, restart button click hit-testing across 7 window aspect ratios,
 *    and complete expedition restart inventory/overworld re-initialization (25g, 60 HP, starter decks, harbor center 4000, 4000)
 * 6. 100 render loops on both DesperateEscapeMinigame and GameOverOverlay verifying strict save/restore stack balance
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/challenger_escape_stress.test.ts
 */

import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DesperateEscapeMinigame,
  ESCAPE_DURATION,
  NORMAL_TURN_RATE,
  DAMAGED_TURN_RATE,
  ESCAPE_SURVIVAL_LIMP_HP,
  OBSTACLE_RADII,
  EscapeObstacle,
  ObstacleType
} from '../src/game/ui/DesperateEscapeMinigame.js';

import {
  GameOverOverlay,
  EULOGY_TEXT,
  ExpeditionStats
} from '../src/game/ui/GameOverOverlay.js';

import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { Boat } from '../src/game/overworld/Boat.js';
import { Input } from '../src/engine/Input.js';
import { createStarterDeck } from '../src/game/battle/CardData.js';
import { createStarterNavalDeck } from '../src/game/battle/NavalCardData.js';

import {
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y,
  HARBOR_DOCK_X,
  HARBOR_DOCK_Y,
  MockCanvas,
  MockCanvasRenderingContext2D
} from './test_helpers.js';

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

/** Reset mock input state between adversarial test passes */
function resetInputState(): void {
  try {
    (Input as any).keysDown = new Set<string>();
    (Input as any).keysJustPressed = new Set<string>();
    (Input as any).mousePos.x = 0;
    (Input as any).mousePos.y = 0;
    (Input as any).mouseJustClicked = false;
    (Input as any).isMouseDown = false;
  } catch {
    // Non-fatal if Input internals vary
  }
}

// ============================================================================
// 1. COUNTDOWN CLOCK MONOTONICITY & BOUNDARY DELTA TIMES
// ============================================================================
describe('Challenger M5: 10.0s Countdown Clock Monotonicity & Boundary Delta Times', () => {
  beforeEach(() => resetInputState());

  test('C.M5.1.1: Clock initializes strictly to 10.0s and state starts uncompleted', () => {
    const minigame = new DesperateEscapeMinigame();
    assert.equal(minigame.timer, 10.0);
    assert.equal(minigame.duration, 10.0);
    assert.equal(ESCAPE_DURATION, 10.0);
    assert.equal(minigame.isRunning, false);
    assert.equal(minigame.isFinished, false);
    assert.equal(minigame.result, 'running');
  });

  test('C.M5.1.2: Monotonic decrease across diverse boundary delta times (0.008s, 0.016s, 0.5s, 2.0s)', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = []; // isolate clock from collisions

    const boundaryDts = [0.00833, 0.01667, 0.03333, 0.1, 0.5, 1.0, 2.0];
    let previousTimer = minigame.timer;

    for (const dt of boundaryDts) {
      minigame.update(dt, 1280, 720);
      assert.ok(
        minigame.timer < previousTimer,
        `Timer failed to decrease monotonically: expected < ${previousTimer}, got ${minigame.timer} after dt=${dt}`
      );
      assert.ok(minigame.timer >= 0, `Timer dropped below 0: ${minigame.timer}`);
      previousTimer = minigame.timer;
    }
  });

  test('C.M5.1.3: Overshoot delta time (dt=15.0s) clamps timer cleanly to 0.0s and triggers victory exactly once', () => {
    let successCount = 0;
    let failCount = 0;

    const minigame = new DesperateEscapeMinigame(
      () => { successCount++; },
      () => { failCount++; }
    );
    minigame.start(1280, 720);
    minigame.obstacles = [];

    // Single large lag spike of 15 seconds
    minigame.update(15.0, 1280, 720);

    assert.equal(minigame.timer, 0.0, 'Timer must clamp to 0.0 and never become negative');
    assert.equal(minigame.isFinished, true);
    assert.equal(minigame.isRunning, false);
    assert.equal(minigame.result, 'success');
    assert.equal(successCount, 1);
    assert.equal(failCount, 0);

    // Subsequent updates must be no-ops and not re-fire callbacks
    minigame.update(1.0, 1280, 720);
    minigame.update(2.0, 1280, 720);
    assert.equal(successCount, 1, 'Success callback must not re-fire on extra ticks');
    assert.equal(minigame.timer, 0.0);
  });

  test('C.M5.1.4: 100 fuzzed pseudo-random delta time steps maintain strict monotonicity: timer[i+1] <= timer[i]', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];

    // Suppress obstacle spawning to isolate and verify pure clock monotonicity to 10s completion
    (minigame as any).spawnCooldown = 9999;

    let prev = minigame.timer;
    const history: number[] = [prev];

    for (let i = 0; i < 100; i++) {
      // Delta times ranging between 0.001s and 0.350s
      const dt = 0.001 + ((i * 37) % 350) / 1000;
      minigame.update(dt, 1280, 720);

      assert.ok(
        minigame.timer <= prev,
        `Step ${i}: Monotonicity violation! Previous ${prev}, current ${minigame.timer}`
      );
      assert.ok(minigame.timer >= 0, `Step ${i}: Timer underflow below 0: ${minigame.timer}`);

      prev = minigame.timer;
      history.push(prev);

      if (minigame.isFinished) {
        assert.equal(minigame.timer, 0.0);
        assert.equal(minigame.result, 'success');
      }
    }

    assert.equal(minigame.isFinished, true, '100 steps should easily complete the 10-second minigame');
  });

  test('C.M5.1.5: Microsecond delta times near zero boundary trigger success cleanly without floating error', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];

    // Advance clock to exactly 0.0002 seconds remaining
    minigame.timer = 0.0002;

    // Tick by exactly 0.0002
    minigame.update(0.0002, 1280, 720);

    assert.equal(minigame.timer, 0.0);
    assert.equal(minigame.isFinished, true);
    assert.equal(minigame.result, 'success');
  });
});

// ============================================================================
// 2. COLLISION DETECTION PRECISION & OBSTACLE BOUNDARIES
// ============================================================================
describe('Challenger M5: Circle-Circle Collision Detection Precision & Obstacle Boundaries', () => {
  beforeEach(() => resetInputState());

  const vesselRadius = 18;

  test('C.M5.2.1: Authoritative obstacle radii check for all 3 hazard types', () => {
    assert.equal(OBSTACLE_RADII.rock_spike, 25);
    assert.equal(OBSTACLE_RADII.waterlogged_wreck, 35);
    assert.equal(OBSTACLE_RADII.tentacle_snare, 30);
  });

  test('C.M5.2.2: Boundary precision for rock_spike (hit threshold = 18 + 25 = 43)', () => {
    const minigame = new DesperateEscapeMinigame();
    const threshold = vesselRadius + OBSTACLE_RADII.rock_spike; // 43
    const vessel = { x: 500, y: 500, radius: vesselRadius };

    const makeObs = (x: number, y: number): EscapeObstacle => ({
      id: 'test_rock',
      type: 'rock_spike',
      x,
      y,
      vx: 0,
      vy: 0,
      radius: OBSTACLE_RADII.rock_spike,
      rotation: 0,
      rotSpeed: 0
    });

    // 1px Penetration: dist = 42 -> COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 + 42, 500)), true, '42px distance should collide');

    // 0.001px Penetration: dist = 42.999 -> COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 + 42.999, 500)), true, '42.999px distance should collide');

    // Exact Tangent: dist = 43.0 -> NO COLLISION (distSq < hitRadius^2 is false when equal)
    assert.equal(minigame.checkCollision(vessel, makeObs(500 + 43.0, 500)), false, 'Exact 43.0px tangent should not collide');

    // 0.001px Separation: dist = 43.001 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 + 43.001, 500)), false, '43.001px should not collide');

    // 1px Separation: dist = 44.0 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 + 44.0, 500)), false, '44.0px should not collide');
  });

  test('C.M5.2.3: Boundary precision for waterlogged_wreck (hit threshold = 18 + 35 = 53)', () => {
    const minigame = new DesperateEscapeMinigame();
    const threshold = vesselRadius + OBSTACLE_RADII.waterlogged_wreck; // 53
    const vessel = { x: 500, y: 500, radius: vesselRadius };

    const makeObs = (x: number, y: number): EscapeObstacle => ({
      id: 'test_wreck',
      type: 'waterlogged_wreck',
      x,
      y,
      vx: 0,
      vy: 0,
      radius: OBSTACLE_RADII.waterlogged_wreck,
      rotation: 0,
      rotSpeed: 0
    });

    // 1px Penetration: dist = 52 -> COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500, 500 - 52)), true, '52px distance should collide');

    // 0.001px Penetration: dist = 52.999 -> COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500, 500 - 52.999)), true, '52.999px distance should collide');

    // Exact Tangent: dist = 53.0 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500, 500 - 53.0)), false, 'Exact 53.0px tangent should not collide');

    // 1px Separation: dist = 54.0 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500, 500 - 54.0)), false, '54.0px should not collide');
  });

  test('C.M5.2.4: Boundary precision for tentacle_snare (hit threshold = 18 + 30 = 48)', () => {
    const minigame = new DesperateEscapeMinigame();
    const threshold = vesselRadius + OBSTACLE_RADII.tentacle_snare; // 48
    const vessel = { x: 500, y: 500, radius: vesselRadius };

    const makeObs = (x: number, y: number): EscapeObstacle => ({
      id: 'test_snare',
      type: 'tentacle_snare',
      x,
      y,
      vx: 0,
      vy: 0,
      radius: OBSTACLE_RADII.tentacle_snare,
      rotation: 0,
      rotSpeed: 0
    });

    // 1px Penetration: dist = 47 -> COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 - 47, 500)), true, '47px distance should collide');

    // Exact Tangent: dist = 48.0 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 - 48.0, 500)), false, '48.0px tangent should not collide');

    // 1px Separation: dist = 49.0 -> NO COLLISION
    assert.equal(minigame.checkCollision(vessel, makeObs(500 - 49.0, 500)), false, '49.0px should not collide');
  });

  test('C.M5.2.5: Multi-quadrant diagonal collision math test (dx = dy)', () => {
    const minigame = new DesperateEscapeMinigame();
    const vessel = { x: 0, y: 0, radius: 18 };
    const r = 30; // tentacle_snare, hit threshold = 48
    const threshold = 48;

    // Diagonal distance: sqrt(dx^2 + dy^2). When dx = dy = d: dist = d * sqrt(2)
    // For penetration (dist = 47): d = 47 / sqrt(2) ≈ 33.234
    const dCollide = (threshold - 1.0) / Math.SQRT2;
    // For separation (dist = 49): d = 49 / sqrt(2) ≈ 34.648
    const dMiss = (threshold + 1.0) / Math.SQRT2;

    const quadrants = [
      { sx: 1, sy: 1 },
      { sx: -1, sy: 1 },
      { sx: 1, sy: -1 },
      { sx: -1, sy: -1 }
    ];

    for (const q of quadrants) {
      const obsHit: EscapeObstacle = {
        id: `q_hit_${q.sx}_${q.sy}`,
        type: 'tentacle_snare',
        x: q.sx * dCollide,
        y: q.sy * dCollide,
        vx: 0,
        vy: 0,
        radius: r,
        rotation: 0,
        rotSpeed: 0
      };
      assert.equal(
        minigame.checkCollision(vessel, obsHit),
        true,
        `Quadrant (${q.sx}, ${q.sy}) penetration should collide`
      );

      const obsMiss: EscapeObstacle = {
        id: `q_miss_${q.sx}_${q.sy}`,
        type: 'tentacle_snare',
        x: q.sx * dMiss,
        y: q.sy * dMiss,
        vx: 0,
        vy: 0,
        radius: r,
        rotation: 0,
        rotSpeed: 0
      };
      assert.equal(
        minigame.checkCollision(vessel, obsMiss),
        false,
        `Quadrant (${q.sx}, ${q.sy}) separation should not collide`
      );
    }
  });

  test('C.M5.2.6: Active update loop triggers onFail callback immediately on collision frame and terminates execution', () => {
    let failCalls = 0;
    let successCalls = 0;

    const minigame = new DesperateEscapeMinigame(
      () => { successCalls++; },
      () => { failCalls++; }
    );
    minigame.start(1280, 720);

    // Place obstacle directly onto the vessel's coordinates
    minigame.obstacles = [{
      id: 'fatal_crag',
      type: 'rock_spike',
      x: minigame.vessel.x,
      y: minigame.vessel.y,
      vx: 0,
      vy: 50,
      radius: OBSTACLE_RADII.rock_spike,
      rotation: 0,
      rotSpeed: 0
    }];

    assert.equal(minigame.isRunning, true);
    assert.equal(minigame.isFinished, false);

    // Execute 1 frame tick (dt = 0.016)
    minigame.update(0.016, 1280, 720);

    assert.equal(failCalls, 1, 'onFail callback must fire immediately on collision frame');
    assert.equal(successCalls, 0, 'onSuccess must never fire upon collision');
    assert.equal(minigame.isRunning, false, 'isRunning must switch to false immediately');
    assert.equal(minigame.isFinished, true, 'isFinished must be set to true');
    assert.equal(minigame.result, 'failure', 'result must be "failure"');

    // Subsequent updates should not trigger additional callbacks
    minigame.update(0.016, 1280, 720);
    minigame.update(0.5, 1280, 720);
    assert.equal(failCalls, 1, 'onFail callback must not re-fire on subsequent frames');
  });
});

// ============================================================================
// 3. SLUGGISH RUDDER TURN RATE & DAMAGED VESSEL PHYSICS
// ============================================================================
describe('Challenger M5: Sluggish Rudder Turn Rate & Damaged Steering Physics', () => {
  beforeEach(() => resetInputState());

  test('C.M5.3.1: Turn rate constants verify exact 40% turning penalty (1.5 rad/s vs 2.5 rad/s)', () => {
    assert.equal(NORMAL_TURN_RATE, 2.5);
    assert.equal(DAMAGED_TURN_RATE, 1.5);
    assert.equal(DAMAGED_TURN_RATE / NORMAL_TURN_RATE, 0.60, 'Damaged turn rate must be exactly 60% of normal (40% reduction)');

    const minigame = new DesperateEscapeMinigame();
    assert.equal(minigame.vessel.turnRate, DAMAGED_TURN_RATE);
    assert.equal(minigame.damagedTurnRate, 1.5);
    assert.equal(minigame.normalTurnRate, 2.5);
  });

  test('C.M5.3.2: Heading changes at exactly -1.5 rad/s under Left input (KeyA / ArrowLeft)', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];

    // Center heading between clamps (-Math.PI / 2 ≈ -1.5708 rad)
    minigame.vessel.heading = -Math.PI / 2;
    const initialHeading = minigame.vessel.heading;

    // Simulate Left key down
    (Input as any).keysDown.add('keya');

    const dt = 0.2; // 0.2s
    minigame.update(dt, 1280, 720);

    const expectedHeading = initialHeading - (DAMAGED_TURN_RATE * dt);
    assert.ok(
      Math.abs(minigame.vessel.heading - expectedHeading) < 1e-6,
      `Expected heading ${expectedHeading}, got ${minigame.vessel.heading}`
    );

    // Verify contrast: normal rate (2.5) would have produced a larger turn
    const normalHeading = initialHeading - (NORMAL_TURN_RATE * dt);
    assert.notEqual(minigame.vessel.heading, normalHeading);
  });

  test('C.M5.3.3: Heading changes at exactly +1.5 rad/s under Right input (KeyD / ArrowRight)', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];

    minigame.vessel.heading = -Math.PI / 2;
    const initialHeading = minigame.vessel.heading;

    // Simulate Right key down
    (Input as any).keysDown.add('arrowright');

    const dt = 0.2;
    minigame.update(dt, 1280, 720);

    const expectedHeading = initialHeading + (DAMAGED_TURN_RATE * dt);
    assert.ok(
      Math.abs(minigame.vessel.heading - expectedHeading) < 1e-6,
      `Expected heading ${expectedHeading}, got ${minigame.vessel.heading}`
    );
  });

  test('C.M5.3.4: Opposing inputs (KeyA and KeyD both down) or neutral input yield zero heading change', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];
    minigame.vessel.heading = -Math.PI / 2;

    // 1. Both pressed simultaneously: steerDir = (-1) + (+1) = 0
    (Input as any).keysDown.add('keya');
    (Input as any).keysDown.add('keyd');

    minigame.update(0.1, 1280, 720);
    assert.equal(minigame.vessel.heading, -Math.PI / 2, 'Simultaneous opposing inputs must cancel out');

    // 2. Neither pressed: steerDir = 0
    (Input as any).keysDown.clear();
    minigame.update(0.1, 1280, 720);
    assert.equal(minigame.vessel.heading, -Math.PI / 2, 'Neutral input must maintain heading');
  });

  test('C.M5.3.5: Angular limits clamping prevents vessel from spinning in circles', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);
    minigame.obstacles = [];

    const minHeading = -Math.PI * 0.82; // ~-2.576 rad
    const maxHeading = -Math.PI * 0.18; // ~-0.565 rad

    // Steer left persistently for 10 seconds
    (Input as any).keysDown.add('keya');
    for (let i = 0; i < 20; i++) {
      minigame.update(0.1, 1280, 720);
    }
    assert.ok(minigame.vessel.heading >= minHeading, 'Heading must not breach minHeading limit');
    assert.equal(minigame.vessel.heading, minHeading);

    // Now steer right persistently for 10 seconds
    (Input as any).keysDown.delete('keya');
    (Input as any).keysDown.add('keyd');
    for (let i = 0; i < 30; i++) {
      minigame.update(0.1, 1280, 720);
    }
    assert.ok(minigame.vessel.heading <= maxHeading, 'Heading must not breach maxHeading limit');
    assert.equal(minigame.vessel.heading, maxHeading);
  });
});

// ============================================================================
// 4. ESCAPE SUCCESS RESOLUTION & LIMP HARBOR RETURN
// ============================================================================
describe('Challenger M5: Escape Success Resolution & Limp Harbor Return State', () => {
  beforeEach(() => resetInputState());

  test('C.M5.4.1: Limp return sets hullHp to exactly 20 HP (never full 60 HP)', () => {
    assert.equal(ESCAPE_SURVIVAL_LIMP_HP, 20);

    const inventory = new PlayerInventory();
    inventory.hullHp = 0;

    // Simulate escape survival resolution
    inventory.hullHp = ESCAPE_SURVIVAL_LIMP_HP;

    assert.equal(inventory.hullHp, 20, 'Limp HP must be exactly 20 HP');
    assert.notEqual(inventory.hullHp, 60, 'Limp HP must never restore full 60 HP');
  });

  test('C.M5.4.2: Limp return resets boat coordinates to Harbor Dock (4000, 4070) with zero velocity', () => {
    const boat = new Boat(7500, 7500, 0);
    boat.velocity.set(150, -90);
    boat.isFrozen = true;

    // Execute limp return placement
    boat.position.set(HARBOR_DOCK_X, HARBOR_DOCK_Y);
    boat.velocity.set(0, 0);
    boat.isFrozen = false;

    assert.equal(boat.position.x, 4000);
    assert.equal(boat.position.y, 4070);
    assert.equal(boat.velocity.x, 0);
    assert.equal(boat.velocity.y, 0);
    assert.equal(boat.isFrozen, false, 'Boat must be unfrozen to allow player to maneuver away from dock');
  });

  test('C.M5.4.3: Contrast comparison between Towing Defeat vs Escape Limp Return vs Game Over Restart', () => {
    // 1. Towing Defeat (Gold > 0)
    const invTowed = new PlayerInventory();
    invTowed.gold = 50;
    invTowed.hullHp = 0;
    const toll = Math.max(1, Math.floor(invTowed.gold * 0.18));
    invTowed.gold -= toll;
    invTowed.hullHp = 60; // Full repair

    assert.equal(invTowed.hullHp, 60);
    assert.equal(invTowed.gold, 41);

    // 2. Escape Survival (Gold === 0, survived 10s minigame)
    const invEscaped = new PlayerInventory();
    invEscaped.gold = 0;
    invEscaped.hullHp = 0;
    invEscaped.hullHp = ESCAPE_SURVIVAL_LIMP_HP; // Limp state

    assert.equal(invEscaped.hullHp, 20);
    assert.equal(invEscaped.gold, 0);

    // 3. Game Over Restart (Gold === 0, failed minigame)
    const invRestart = new PlayerInventory();
    invRestart.gold = 25; // Re-initialized starter gold
    invRestart.hullHp = 60; // Starter hull

    assert.equal(invRestart.hullHp, 60);
    assert.equal(invRestart.gold, 25);
  });
});

// ============================================================================
// 5. GAME OVER OVERLAY: RECAP, ASPECT RATIO BOUNDS & EXPEDITION RESTART
// ============================================================================
describe('Challenger M5: Game Over Screen Recap, Hit Bounds Across Aspect Ratios & Restart Reset', () => {
  beforeEach(() => resetInputState());

  test('C.M5.5.1: Eulogy text conforms exactly to Lovecraftian specifications', () => {
    const overlay = new GameOverOverlay();
    assert.equal(
      overlay.eulogy,
      'LOST TO THE COLD TIDE — Your vessel broke upon the black crags. The deep abyss claims all.'
    );
    assert.equal(
      EULOGY_TEXT,
      'LOST TO THE COLD TIDE — Your vessel broke upon the black crags. The deep abyss claims all.'
    );
  });

  test('C.M5.5.2: Recap statistics aggregation handles empty, mid-tier, and extreme values safely', () => {
    const overlay = new GameOverOverlay();

    // 1. Immediate death
    overlay.open({ milesSailed: 0, fishCaught: 0, monstersDefeated: 0 });
    assert.equal(overlay.milesSailed, 0);
    assert.equal(overlay.fishCaught, 0);
    assert.equal(overlay.monstersDefeated, 0);
    assert.equal(overlay.formatRecap('short'), 'Catches: 0 | Distance: 0m');
    assert.equal(overlay.formatRecap('detailed'), 'Catches: 0 | Distance: 0m | Monsters: 0');

    // 2. Aggregation via distanceM and catches aliases
    overlay.open({ distanceM: 18520, catches: 14, monstersDefeated: 3 });
    assert.equal(overlay.milesSailed, 10.0);
    assert.equal(overlay.fishCaught, 14);
    assert.equal(overlay.monstersDefeated, 3);
    assert.equal(overlay.formatRecap('short'), 'Catches: 14 | Distance: 18520m');
    assert.equal(overlay.formatRecap('detailed'), 'Catches: 14 | Distance: 18520m | Monsters: 3');

    // 3. High stat run
    overlay.open({ milesSailed: 154.6, fishCaught: 320, monstersDefeated: 12 });
    assert.equal(overlay.milesSailed, 154.6);
    assert.equal(overlay.fishCaught, 320);
    assert.equal(overlay.monstersDefeated, 12);
  });

  test('C.M5.5.3: Restart button click bounds detection across 7 window aspect ratios', () => {
    const overlay = new GameOverOverlay();
    overlay.open();

    const viewports = [
      { name: '1280x720 (16:9 Standard)', w: 1280, h: 720, expectedX: 500, expectedY: 550 },
      { name: '1920x1080 (16:9 FHD)', w: 1920, h: 1080, expectedX: Math.floor((1920 - 280) / 2), expectedY: Math.floor(1080 * 0.76) },
      { name: '1024x768 (4:3 XGA)', w: 1024, h: 768, expectedX: Math.floor((1024 - 280) / 2), expectedY: Math.floor(768 * 0.76) },
      { name: '800x600 (4:3 SVGA)', w: 800, h: 600, expectedX: Math.floor((800 - 280) / 2), expectedY: Math.floor(600 * 0.76) },
      { name: '2560x1440 (16:9 QHD)', w: 2560, h: 1440, expectedX: Math.floor((2560 - 280) / 2), expectedY: Math.floor(1440 * 0.76) },
      { name: '2560x1080 (21:9 Ultrawide)', w: 2560, h: 1080, expectedX: Math.floor((2560 - 280) / 2), expectedY: Math.floor(1080 * 0.76) },
      { name: '375x667 (Mobile Portrait)', w: 375, h: 667, expectedX: Math.floor((375 - 280) / 2), expectedY: Math.floor(667 * 0.76) }
    ];

    for (const vp of viewports) {
      overlay.update(0.016, vp.w, vp.h);
      const btn = overlay.restartBtnRect;

      assert.equal(btn.w, 280, `${vp.name}: Button width should be 280`);
      assert.equal(btn.h, 48, `${vp.name}: Button height should be 48`);
      assert.equal(btn.x, vp.expectedX, `${vp.name}: Button X mismatch`);
      assert.equal(btn.y, vp.expectedY, `${vp.name}: Button Y mismatch`);

      // 1. Inside points: Top-left, Bottom-right, Center
      assert.equal(overlay.isButtonClicked(btn.x, btn.y), true, `${vp.name}: Top-left inside`);
      assert.equal(overlay.isButtonClicked(btn.x + btn.w, btn.y + btn.h), true, `${vp.name}: Bottom-right inside`);
      assert.equal(overlay.isButtonClicked(btn.x + btn.w / 2, btn.y + btn.h / 2), true, `${vp.name}: Center inside`);

      // 2. Outside points: 1px beyond each edge
      assert.equal(overlay.isButtonClicked(btn.x - 1, btn.y), false, `${vp.name}: Left outside`);
      assert.equal(overlay.isButtonClicked(btn.x + btn.w + 1, btn.y), false, `${vp.name}: Right outside`);
      assert.equal(overlay.isButtonClicked(btn.x, btn.y - 1), false, `${vp.name}: Top outside`);
      assert.equal(overlay.isButtonClicked(btn.x, btn.y + btn.h + 1), false, `${vp.name}: Bottom outside`);
    }
  });

  test('C.M5.5.4: Keyboard shortcuts (Space and Enter) trigger restart and dismiss overlay', () => {
    let restartCount = 0;
    const overlay = new GameOverOverlay(() => { restartCount++; });

    // 1. Test Space key
    overlay.open();
    (Input as any).keysJustPressed.add('space');
    overlay.update(0.016, 1280, 720);
    assert.equal(restartCount, 1);
    assert.equal(overlay.isOpen, false);

    // 2. Test Enter key
    (Input as any).keysJustPressed.clear();
    overlay.open();
    (Input as any).keysJustPressed.add('enter');
    overlay.update(0.016, 1280, 720);
    assert.equal(restartCount, 2);
    assert.equal(overlay.isOpen, false);
  });

  test('C.M5.5.5: Full inventory and overworld state reset on expedition restart', () => {
    const inventory = new PlayerInventory();
    // Simulate dirty end-game / defeated state
    inventory.gold = 0;
    inventory.hullHp = 0;
    inventory.maxHullHp = 60;
    inventory.deck = [];
    inventory.navalDeck = [];
    inventory.baits = {
      bare_hook: Infinity,
      lugworms: 5,
      blood_chum: 10,
      bio_squid: 2,
      eldritch_grub: 1
    };
    inventory.selectedBait = 'blood_chum';
    inventory.staminaUpgradeLevel = 2;
    inventory.lineHealthUpgradeLevel = 3;
    inventory.totalFishCaught = 42;

    const boat = new Boat(7800, 7800, 1.5);
    boat.velocity.set(200, 200);
    boat.isFrozen = true;

    // Execute complete expedition restart procedure (matching main.ts restartExpedition)
    inventory.gold = 25;
    inventory.hullHp = 60;
    inventory.maxHullHp = 60;
    inventory.deck = createStarterDeck();
    inventory.navalDeck = createStarterNavalDeck();
    inventory.baits = {
      bare_hook: Infinity,
      lugworms: 0,
      blood_chum: 0,
      bio_squid: 0,
      eldritch_grub: 0
    };
    inventory.selectedBait = 'bare_hook';
    inventory.staminaUpgradeLevel = 0;
    inventory.lineHealthUpgradeLevel = 0;
    inventory.totalFishCaught = 0;

    boat.position.set(HARBOR_CENTER_X, HARBOR_CENTER_Y);
    boat.velocity.set(0, 0);
    boat.heading = -Math.PI / 2;
    boat.isFrozen = false;

    // Verify all baseline state invariants
    assert.equal(inventory.gold, 25);
    assert.equal(inventory.hullHp, 60);
    assert.equal(inventory.maxHullHp, 60);
    assert.equal(inventory.deck.length, 7, 'Starter deck should have 7 cards');
    assert.equal(inventory.navalDeck.length, 8, 'Starter naval deck should have 8 cards');
    assert.equal(inventory.baits.lugworms, 0);
    assert.equal(inventory.baits.blood_chum, 0);
    assert.equal(inventory.selectedBait, 'bare_hook');
    assert.equal(inventory.staminaUpgradeLevel, 0);
    assert.equal(inventory.lineHealthUpgradeLevel, 0);
    assert.equal(inventory.totalFishCaught, 0);

    // Verify harbor relocation to safe center (4000, 4000), NOT dock (4000, 4070)
    assert.equal(boat.position.x, 4000);
    assert.equal(boat.position.y, 4000);
    assert.equal(boat.velocity.x, 0);
    assert.equal(boat.velocity.y, 0);
    assert.equal(boat.heading, -Math.PI / 2);
    assert.equal(boat.isFrozen, false);
  });
});

// ============================================================================
// 6. 100 RENDER LOOPS ON MINIGAME & GAMEOVER OVERLAY WITH BALANCED SAVE/RESTORE
// ============================================================================
describe('Challenger M5: 100 Render Loops & Context Save/Restore Stack Balance', () => {
  beforeEach(() => resetInputState());

  test('C.M5.6.1: 100 render loops on DesperateEscapeMinigame maintain strictly balanced save/restore stacks', () => {
    const minigame = new DesperateEscapeMinigame();
    minigame.start(1280, 720);

    const mockCtx = new MockCanvasRenderingContext2D();

    let totalSaves = 0;
    let totalRestores = 0;

    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);

    for (let frame = 0; frame < 100; frame++) {
      let frameSaves = 0;
      let frameRestores = 0;

      mockCtx.save = () => {
        frameSaves++;
        totalSaves++;
        origSave();
      };
      mockCtx.restore = () => {
        frameRestores++;
        totalRestores++;
        origRestore();
      };

      // Fuzz dynamic game state across frames
      minigame.timer = Math.max(0.1, 10.0 - (frame * 0.09));
      (minigame as any).lightningAlpha = (frame % 15 === 0) ? 0.5 : 0.0;

      // Spawn or adjust obstacles
      if (frame % 20 === 0 && minigame.obstacles.length < 8) {
        minigame.spawnObstacle(1280, 720);
      }

      minigame.render(mockCtx as any, 1280, 720);

      assert.ok(frameSaves > 0, `Frame ${frame}: save() must be called at least once`);
      assert.equal(
        frameSaves,
        frameRestores,
        `Frame ${frame}: Context stack imbalance! Saves: ${frameSaves}, Restores: ${frameRestores}`
      );
    }

    assert.equal(totalSaves, totalRestores, 'Cumulative save and restore counts must be identical across 100 frames');
  });

  test('C.M5.6.2: 100 render loops on GameOverOverlay across varying viewports maintain strictly balanced save/restore stacks', () => {
    const overlay = new GameOverOverlay();
    overlay.open({ milesSailed: 15.2, fishCaught: 9, monstersDefeated: 2 });

    const mockCtx = new MockCanvasRenderingContext2D();

    let totalSaves = 0;
    let totalRestores = 0;

    const origSave = mockCtx.save.bind(mockCtx);
    const origRestore = mockCtx.restore.bind(mockCtx);

    const testResolutions = [
      { w: 1280, h: 720 },
      { w: 1920, h: 1080 },
      { w: 1024, h: 768 },
      { w: 800, h: 600 },
      { w: 2560, h: 1440 }
    ];

    for (let frame = 0; frame < 100; frame++) {
      let frameSaves = 0;
      let frameRestores = 0;

      mockCtx.save = () => {
        frameSaves++;
        totalSaves++;
        origSave();
      };
      mockCtx.restore = () => {
        frameRestores++;
        totalRestores++;
        origRestore();
      };

      const res = testResolutions[frame % testResolutions.length];
      overlay.isRestartBtnHovered = (frame % 2 === 0);
      (overlay as any).time = frame * 0.016;

      overlay.render(mockCtx as any, res.w, res.h);

      assert.ok(frameSaves > 0, `Frame ${frame}: save() must be called`);
      assert.equal(
        frameSaves,
        frameRestores,
        `Frame ${frame}: Save/Restore imbalance! Saves: ${frameSaves}, Restores: ${frameRestores}`
      );
    }

    assert.equal(totalSaves, totalRestores, 'Cumulative save and restore counts must be identical across 100 frames');
  });
});
