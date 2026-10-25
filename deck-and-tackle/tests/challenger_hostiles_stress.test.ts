/**
 * challenger_hostiles_stress.test.ts
 * Adversarial Challenger Stress Test Suite for Milestone 4 (R4):
 * - Searchlight cone boundary fuzzing (+- 0.0001 rad, 399.9 vs 400.1 px, behind source, multi-heading wrap)
 * - Ambush breach charge physics (<= 150px trigger, sprint velocity <= 140 px/s, 2.5s timer expiry, re-submerge)
 * - Population invariance (1,000 updates, strictly [4, 6] hostiles, distance >= 1200px from harbor center)
 * - Proximity engagement trigger (<= 45px combat engagement at all approach angles and zero distance)
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

// Node.js test environment polyfills (DOM window, AudioContext, Canvas)
import './test_helpers.js';

import {
  RoamingHostileManager,
  HostileEntity,
  checkConeDetection,
  AUTHORITATIVE_HOSTILE_ROSTER,
  HOSTILE_CONE_ANGLE_RAD,
  HOSTILE_CONE_DISTANCE,
  BEAST_GROAN_RADIUS,
  BEAST_BREACH_RADIUS,
  COMBAT_ENGAGE_RADIUS,
  HARBOR_CENTER_X,
  HARBOR_CENTER_Y,
  HARBOR_SAFE_RADIUS,
  MAP_WIDTH,
  MAP_HEIGHT
} from '../src/game/overworld/RoamingHostileManager.js';

describe('Adversarial Challenger: Roaming Hostiles AI, Spawning & Cone Detection Stress', () => {

  // ==========================================================================
  // SUITE 1: Searchlight Cone Boundary Fuzzing
  // ==========================================================================
  describe('Suite 1: Searchlight Cone Boundary Fuzzing', () => {

    test('Angle limits fuzzing (+- 0.0001 rad) along cardinal and non-cardinal headings', () => {
      const srcX = 4000;
      const srcY = 3000;
      const distance = 250;
      const halfAngle = HOSTILE_CONE_ANGLE_RAD / 2;
      const epsilon = 0.0001;

      // Test multiple headings: 0 (East), PI/2 (South), PI (West), -PI/2 (North), 1.15 rad (arbitrary)
      const testHeadings = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.15, -2.1];

      for (const heading of testHeadings) {
        // 1. Center of cone: must detect
        const centerX = srcX + Math.cos(heading) * distance;
        const centerY = srcY + Math.sin(heading) * distance;
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, centerX, centerY),
          true,
          `Centerline must detect for heading ${heading}`
        );

        // 2. Inside positive limit (heading + halfAngle - epsilon): must detect
        const insidePosAngle = heading + halfAngle - epsilon;
        const inPosX = srcX + Math.cos(insidePosAngle) * distance;
        const inPosY = srcY + Math.sin(insidePosAngle) * distance;
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, inPosX, inPosY),
          true,
          `Inside positive boundary (-0.0001 rad) must detect for heading ${heading}`
        );

        // 3. Outside positive limit (heading + halfAngle + epsilon): must NOT detect
        const outsidePosAngle = heading + halfAngle + epsilon;
        const outPosX = srcX + Math.cos(outsidePosAngle) * distance;
        const outPosY = srcY + Math.sin(outsidePosAngle) * distance;
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, outPosX, outPosY),
          false,
          `Outside positive boundary (+0.0001 rad) must NOT detect for heading ${heading}`
        );

        // 4. Inside negative limit (heading - halfAngle + epsilon): must detect
        const insideNegAngle = heading - halfAngle + epsilon;
        const inNegX = srcX + Math.cos(insideNegAngle) * distance;
        const inNegY = srcY + Math.sin(insideNegAngle) * distance;
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, inNegX, inNegY),
          true,
          `Inside negative boundary (+0.0001 rad) must detect for heading ${heading}`
        );

        // 5. Outside negative limit (heading - halfAngle - epsilon): must NOT detect
        const outsideNegAngle = heading - halfAngle - epsilon;
        const outNegX = srcX + Math.cos(outsideNegAngle) * distance;
        const outNegY = srcY + Math.sin(outsideNegAngle) * distance;
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, outNegX, outNegY),
          false,
          `Outside negative boundary (-0.0001 rad) must NOT detect for heading ${heading}`
        );
      }
    });

    test('Distance threshold fuzzing: 399.9 px vs 400.0 px vs 400.1 px', () => {
      const srcX = 4000;
      const srcY = 3000;
      const heading = Math.PI / 4; // 45 degrees
      const halfAngle = HOSTILE_CONE_ANGLE_RAD / 2;

      // 1. Centerline: 399.9 px -> true
      const insideX = srcX + Math.cos(heading) * 399.9;
      const insideY = srcY + Math.sin(heading) * 399.9;
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, insideX, insideY),
        true,
        'Distance 399.9px on centerline must be detected'
      );

      // 2. Centerline: 400.1 px -> false (exceeds cone length 400px)
      const outsideX = srcX + Math.cos(heading) * 400.1;
      const outsideY = srcY + Math.sin(heading) * 400.1;
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, outsideX, outsideY),
        false,
        'Distance 400.1px on centerline must NOT be detected'
      );

      // 4. Boundary angle (halfAngle - 0.0001 rad): 399.9 px -> true; 400.1 px -> false
      const nearBoundAngle = heading + halfAngle - 0.0001;
      const boundInX = srcX + Math.cos(nearBoundAngle) * 399.9;
      const boundInY = srcY + Math.sin(nearBoundAngle) * 399.9;
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, boundInX, boundInY),
        true,
        'Near-boundary angle at 399.9px must be detected'
      );

      const boundOutX = srcX + Math.cos(nearBoundAngle) * 400.1;
      const boundOutY = srcY + Math.sin(nearBoundAngle) * 400.1;
      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, boundOutX, boundOutY),
        false,
        'Near-boundary angle at 400.1px must NOT be detected'
      );
    });

    test('Detection directly behind source (180° opposite) and perpendicular (90°)', () => {
      const srcX = 4000;
      const srcY = 3000;
      const heading = 0; // East (+X)

      // Directly behind source (West, -X): 10px, 100px, 399.9px, 400.1px
      for (const dist of [10, 50, 100, 399.9, 400.1]) {
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, srcX - dist, srcY),
          false,
          `Target directly behind at dist ${dist}px must NOT be detected`
        );
      }

      // Perpendicular to heading (North, -Y and South, +Y)
      for (const dist of [50, 150, 350]) {
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, srcX, srcY - dist),
          false,
          `Target perpendicular North at dist ${dist}px must NOT be detected`
        );
        assert.equal(
          checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, srcX, srcY + dist),
          false,
          `Target perpendicular South at dist ${dist}px must NOT be detected`
        );
      }
    });

    test('Seam handling across +/- PI boundary wrapping', () => {
      const srcX = 4000;
      const srcY = 3000;
      const distance = 200;
      const halfAngle = HOSTILE_CONE_ANGLE_RAD / 2;

      // Heading slightly less than PI: e.g. PI - 0.05
      const heading = Math.PI - 0.05;

      // Target wrapped across the seam into negative PI: e.g. -PI + 0.05
      // Angular diff = 0.1 rad, which is < halfAngle (~0.48 rad)
      const targetAngle = -Math.PI + 0.05;
      const targetX = srcX + Math.cos(targetAngle) * distance;
      const targetY = srcY + Math.sin(targetAngle) * distance;

      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, targetX, targetY),
        true,
        'Cone detection must handle angle wrapping across +/- PI seam'
      );

      // Now target slightly outside the cone across the seam:
      // Angular diff = halfAngle + 0.01 rad
      const outsideSeamAngle = -Math.PI + (0.05 + halfAngle + 0.01);
      const outX = srcX + Math.cos(outsideSeamAngle) * distance;
      const outY = srcY + Math.sin(outsideSeamAngle) * distance;

      assert.equal(
        checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, outX, outY),
        false,
        'Cone detection must reject targets outside angle limit across +/- PI seam'
      );
    });

    test('360-degree mathematical angular sweep oracle verification', () => {
      const srcX = 4000;
      const srcY = 3000;
      const heading = 1.25; // arbitrary heading
      const distance = 250;
      const halfAngle = HOSTILE_CONE_ANGLE_RAD / 2;

      for (let deg = 0; deg < 360; deg++) {
        const rad = (deg * Math.PI) / 180;
        const tx = srcX + Math.cos(rad) * distance;
        const ty = srcY + Math.sin(rad) * distance;

        // Ground truth mathematical condition
        let trueDiff = Math.abs(rad - heading);
        while (trueDiff > Math.PI) trueDiff = Math.abs(trueDiff - 2 * Math.PI);
        const expected = trueDiff <= halfAngle;

        const actual = checkConeDetection(srcX, srcY, heading, HOSTILE_CONE_DISTANCE, HOSTILE_CONE_ANGLE_RAD, tx, ty);
        assert.equal(actual, expected, `Angle sweep mismatch at ${deg} degrees (rad: ${rad.toFixed(4)})`);
      }
    });
  });

  // ==========================================================================
  // SUITE 2: Ambush Breach Charge Physics
  // ==========================================================================
  describe('Suite 2: Ambush Sea Beast Breach Charge Physics', () => {

    test('Breach trigger activates strictly within 150px (boundary at 150.1 vs 150.0 vs 149.9 px)', () => {
      const template = AUTHORITATIVE_HOSTILE_ROSTER.mutated_whale;

      // Case A: 150.1 px away -> remains submerged_lurk
      const beastFar = new HostileEntity(template, 4000, 2000, 0);
      assert.equal(beastFar.alertState, 'submerged_lurk');
      beastFar.update(0.1, { x: 4000, y: 2000 + 150.1 });
      assert.equal(beastFar.alertState, 'submerged_lurk', '150.1px must NOT trigger breach charge');

      // Case B: 150.0 px away -> triggers breach_charge
      const beastExact = new HostileEntity(template, 4000, 2000, 0);
      assert.equal(beastExact.alertState, 'submerged_lurk');
      beastExact.update(0.1, { x: 4000, y: 2000 + 150.0 });
      assert.equal(beastExact.alertState, 'breach_charge', '150.0px must trigger breach charge');
      assert.equal(beastExact.chargeTimer, 2.5, 'chargeTimer must initialize to 2.5s');

      // Case C: 149.9 px away -> triggers breach_charge
      const beastNear = new HostileEntity(template, 4000, 2000, 0);
      assert.equal(beastNear.alertState, 'submerged_lurk');
      beastNear.update(0.1, { x: 4000, y: 2000 + 149.9 });
      assert.equal(beastNear.alertState, 'breach_charge', '149.9px must trigger breach charge');
      assert.equal(beastNear.chargeTimer, 2.5);
    });

    test('Creature groan warning audio trigger activates within 350px (350.1 vs 349.9 px)', () => {
      const template = AUTHORITATIVE_HOSTILE_ROSTER.kelp_leviathan;

      // 350.1 px away: groanPlayed remains false
      const beastFar = new HostileEntity(template, 4000, 2000, 0);
      beastFar.update(0.1, { x: 4000, y: 2000 + 350.1 });
      assert.equal(beastFar.groanPlayed, false, '350.1px must NOT trigger groan cue');

      // 349.9 px away: groanPlayed becomes true
      const beastNear = new HostileEntity(template, 4000, 2000, 0);
      beastNear.update(0.1, { x: 4000, y: 2000 + 349.9 });
      assert.equal(beastNear.groanPlayed, true, '349.9px must trigger groan cue');

      // Retreating to 360px resets groanPlayed to false
      beastNear.update(0.1, { x: 4000, y: 2000 + 360.0 });
      assert.equal(beastNear.groanPlayed, false, 'Retreating past 350px resets groanPlayed');
    });

    test('Breach charge sprint velocity is capped up to 140 px/s across all species', () => {
      const speciesList = [
        { key: 'mutated_whale', expectedSpeed: 85 },
        { key: 'kelp_leviathan', expectedSpeed: 110 },
        { key: 'giant_sea_serpent', expectedSpeed: 130 },
        { key: 'cthulhu_colossus', expectedSpeed: 140 }
      ];

      for (const { key, expectedSpeed } of speciesList) {
        const template = AUTHORITATIVE_HOSTILE_ROSTER[key];
        const beast = new HostileEntity(template, 4000, 2000, 0);

        // Trigger breach charge
        beast.update(0.1, { x: 4000, y: 2100 });
        assert.equal(beast.alertState, 'breach_charge');

        // Advance one frame in breach charge state to execute sprint physics
        beast.update(0.1, { x: 4000, y: 2100 });

        const speed = Math.hypot(beast.velocity.x, beast.velocity.y);
        assert.ok(
          Math.abs(speed - expectedSpeed) < 0.5,
          `${key} sprint speed (${speed.toFixed(2)}) must match expected (${expectedSpeed})`
        );
      }

      // Over-spec beast with 250 px/s base speed must clamp strictly to 140 px/s
      const overspecTemplate = {
        ...AUTHORITATIVE_HOSTILE_ROSTER.cthulhu_colossus,
        id: 'hostile_beast_overspec',
        speed: 250
      };
      const overspecBeast = new HostileEntity(overspecTemplate, 4000, 2000, 0);
      overspecBeast.update(0.1, { x: 4000, y: 2100 });
      assert.equal(overspecBeast.alertState, 'breach_charge');
      overspecBeast.update(0.1, { x: 4000, y: 2100 });

      const clampedSpeed = Math.hypot(overspecBeast.velocity.x, overspecBeast.velocity.y);
      assert.ok(
        clampedSpeed <= 140.01,
        `Overspec speed (${clampedSpeed.toFixed(2)}) must clamp to 140 px/s max`
      );
    });

    test('Breach charge 2.5s timer expiry and re-submerging if dodged', () => {
      const template = AUTHORITATIVE_HOSTILE_ROSTER.giant_sea_serpent;
      const beast = new HostileEntity(template, 4000, 2000, 0);

      // Trigger charge at boat (4000, 2100)
      beast.update(0.1, { x: 4000, y: 2100 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.equal(beast.chargeTimer, 2.5);

      // Step 1: 1.0s elapsed -> chargeTimer = 1.5, still charging
      beast.update(1.0, { x: 4000, y: 2100 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.ok(Math.abs(beast.chargeTimer - 1.5) < 0.01);

      // Step 2: 1.0s elapsed -> chargeTimer = 0.5, still charging
      beast.update(1.0, { x: 4000, y: 2100 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.ok(Math.abs(beast.chargeTimer - 0.5) < 0.01);

      // Step 3: 0.45s elapsed -> chargeTimer = 0.05, still charging
      beast.update(0.45, { x: 4000, y: 2100 });
      assert.equal(beast.alertState, 'breach_charge');
      assert.ok(Math.abs(beast.chargeTimer - 0.05) < 0.01);

      // Step 4: 0.1s elapsed -> chargeTimer expires (<= 0) -> transitions to submerged_lurk
      beast.update(0.1, { x: 4000, y: 2100 });
      assert.equal(beast.alertState, 'submerged_lurk', 'Beast must re-submerge when 2.5s charge expires');
      assert.equal(beast.groanPlayed, false, 'groanPlayed resets on re-submerging');

      // Player has dodged and is now at 250px distance
      beast.update(0.2, { x: 4000, y: 2250 });
      assert.equal(beast.alertState, 'submerged_lurk', 'Beast stays in submerged_lurk when player is at 250px');

      // Velocity must drop back to slow lurk swimming (speed * 0.4 = 130 * 0.4 = 52 px/s)
      const lurkSpeed = Math.hypot(beast.velocity.x, beast.velocity.y);
      assert.ok(
        Math.abs(lurkSpeed - 52) < 1.0,
        `Lurk speed (${lurkSpeed.toFixed(2)}) must be ~52 px/s (0.4 * 130)`
      );
    });
  });

  // ==========================================================================
  // SUITE 3: Population Invariance & Spatial Boundaries
  // ==========================================================================
  describe('Suite 3: Population Invariance & Spatial Boundaries', () => {

    test('Stationary vessel: simulate 1,000 updates maintaining [4, 6] hostiles strictly outside harbor (>1200px)', () => {
      const manager = new RoamingHostileManager();
      const boatPos = { x: HARBOR_CENTER_X, y: HARBOR_CENTER_Y };
      const dt = 0.1;

      for (let step = 0; step < 1000; step++) {
        manager.update(dt, boatPos);
        const hostiles = manager.getHostiles();

        // 1. Invariant: count strictly in [4, 6]
        assert.ok(
          hostiles.length >= 4 && hostiles.length <= 6,
          `Step ${step}: Hostile count (${hostiles.length}) must be in [4, 6]`
        );

        // 2. Invariant: distance >= 1200px from harbor center (with 1e-4 float tolerance)
        for (const h of hostiles) {
          const dx = h.position.x - HARBOR_CENTER_X;
          const dy = h.position.y - HARBOR_CENTER_Y;
          const dist = Math.hypot(dx, dy);
          assert.ok(
            dist >= HARBOR_SAFE_RADIUS - 1e-4,
            `Step ${step}: Hostile ${h.name} distance (${dist.toFixed(2)}) must be >= ${HARBOR_SAFE_RADIUS}px`
          );

          // 3. Invariant: inside map boundaries [100, 7900]
          assert.ok(
            h.position.x >= 100 && h.position.x <= MAP_WIDTH - 100,
            `Step ${step}: Hostile X (${h.position.x}) out of bounds`
          );
          assert.ok(
            h.position.y >= 100 && h.position.y <= MAP_HEIGHT - 100,
            `Step ${step}: Hostile Y (${h.position.y}) out of bounds`
          );
        }
      }
    });

    test('Navigating vessel: simulate 1,000 updates with spiral trajectory across Zones 1-4', () => {
      const manager = new RoamingHostileManager();
      const dt = 0.1;

      for (let step = 0; step < 1000; step++) {
        const time = step * dt;
        // Spiral path moving outward from 1300px to 3800px
        const currentRadius = 1300 + (step / 1000) * 2500;
        const boatPos = {
          x: HARBOR_CENTER_X + Math.cos(time * 0.2) * currentRadius,
          y: HARBOR_CENTER_Y + Math.sin(time * 0.2) * currentRadius
        };

        manager.update(dt, boatPos);
        const hostiles = manager.getHostiles();

        assert.ok(hostiles.length >= 4 && hostiles.length <= 6);

        for (const h of hostiles) {
          const dist = Math.hypot(h.position.x - HARBOR_CENTER_X, h.position.y - HARBOR_CENTER_Y);
          assert.ok(dist >= HARBOR_SAFE_RADIUS - 1e-4);
        }
      }
    });

    test('Defeat recovery: active population restores to >= 4 upon hostile removal', () => {
      const manager = new RoamingHostileManager();
      assert.equal(manager.getHostiles().length, 5);

      // Simulate defeating 2 hostiles
      const removed1 = manager.getHostiles()[0].id;
      manager.removeHostile(removed1);
      assert.equal(manager.getHostiles().length, 4);

      const removed2 = manager.getHostiles()[0].id;
      manager.removeHostile(removed2);
      assert.equal(manager.getHostiles().length, 3);

      // Next update must immediately detect count < 4 and respawn
      manager.update(0.1, { x: 4000, y: 4000 });
      assert.ok(manager.getHostiles().length >= 4, 'Population must restore to at least 4 after defeat');
    });

    test('Spawning stress: consecutive spawns strictly cap active hostiles at 6', () => {
      const manager = new RoamingHostileManager();

      // Trigger 15 spawns
      for (let i = 0; i < 15; i++) {
        manager.spawnHostile();
        const count = manager.getHostiles().length;
        assert.ok(count <= 6, `Spawn ${i}: Population (${count}) must not exceed 6`);
      }

      assert.equal(manager.getHostiles().length, 6);
    });

    test('Physical pushback physics: hostile placed inside harbor is ejected to 1200px boundary', () => {
      const template = AUTHORITATIVE_HOSTILE_ROSTER.galleon_raider;
      // Hostile placed inside harbor at (4000, 4500) -> dist 500px from (4000, 4000)
      const hostile = new HostileEntity(template, 4000, 4500, 0);
      assert.ok(Math.hypot(hostile.position.x - 4000, hostile.position.y - 4000) === 500);

      // Update hostile
      hostile.update(0.01, { x: 4000, y: 4000 });

      // Hostile must be pushed radially outside to at least 1200px
      const newDist = Math.hypot(hostile.position.x - 4000, hostile.position.y - 4000);
      assert.ok(
        newDist >= 1200 - 1e-3,
        `Ejected distance (${newDist.toFixed(2)}) must be >= 1200px`
      );
      assert.ok(
        Math.abs(newDist - 1200) < 1.0,
        `Ejected distance (${newDist.toFixed(2)}) must be closely pinned to 1200px perimeter`
      );
    });
  });

  // ==========================================================================
  // SUITE 4: Proximity Engagement Trigger
  // ==========================================================================
  describe('Suite 4: Proximity Engagement Trigger', () => {

    test('Combat engagement triggers at exact 45.0px boundary (45.1 vs 45.0 vs 44.9 px)', () => {
      const manager = new RoamingHostileManager();
      const hostile = manager.getHostiles()[0];

      // Test with static position (dt = 0) so dynamic velocity integration does not shift entity during measurement
      const testEngage = (boatDistance: number) => {
        hostile.position.x = 4000;
        hostile.position.y = 2000;
        hostile.velocity.x = 0;
        hostile.velocity.y = 0;
        return manager.update(0, { x: 4000, y: 2000 + boatDistance });
      };

      // Distance 45.1px: No combat engagement (> 45px)
      const resFar = testEngage(45.1);
      assert.equal(resFar, null, '45.1px must NOT trigger combat');

      // Distance 45.0px: Combat triggers (<= 45px)
      const resExact = testEngage(45.0);
      assert.ok(resExact !== null, '45.0px must trigger combat');
      assert.equal(resExact?.id, hostile.id);

      // Distance 44.9px: Combat triggers (< 45px)
      const resNear = testEngage(44.9);
      assert.ok(resNear !== null, '44.9px must trigger combat');
      assert.equal(resNear?.id, hostile.id);
    });

    test('Multi-directional 45.0px engagement verification across 8 cardinal & ordinal compass points', () => {
      const manager = new RoamingHostileManager();
      const hostile = manager.getHostiles()[0];

      // 8 compass directions
      const angles = [
        0,                  // East
        Math.PI / 4,        // SE
        Math.PI / 2,        // South
        (3 * Math.PI) / 4,  // SW
        Math.PI,            // West
        (-3 * Math.PI) / 4, // NW
        -Math.PI / 2,       // North
        -Math.PI / 4        // NE
      ];

      for (const angle of angles) {
        // Reset position and zero velocity for static boundary testing
        hostile.position.x = 4000;
        hostile.position.y = 2000;
        hostile.velocity.x = 0;
        hostile.velocity.y = 0;

        // At 45.0px: must trigger
        const inX = 4000 + Math.cos(angle) * 45.0;
        const inY = 2000 + Math.sin(angle) * 45.0;
        const engaged = manager.update(0, { x: inX, y: inY });
        assert.ok(
          engaged !== null,
          `Combat must engage at 45.0px in direction ${(angle * 180 / Math.PI).toFixed(0)}°`
        );

        // Reset position
        hostile.position.x = 4000;
        hostile.position.y = 2000;
        hostile.velocity.x = 0;
        hostile.velocity.y = 0;

        // At 45.2px: must NOT trigger
        const outX = 4000 + Math.cos(angle) * 45.2;
        const outY = 2000 + Math.sin(angle) * 45.2;
        const notEngaged = manager.update(0, { x: outX, y: outY });
        assert.equal(
          notEngaged,
          null,
          `Combat must NOT engage at 45.2px in direction ${(angle * 180 / Math.PI).toFixed(0)}°`
        );
      }
    });

    test('Zero distance (exact collision coordinate) triggers engagement without singularity or NaN', () => {
      const manager = new RoamingHostileManager();
      const hostile = manager.getHostiles()[0];
      hostile.position.x = 3500;
      hostile.position.y = 2500;

      const engaged = manager.update(0.01, { x: 3500, y: 2500 });
      assert.ok(engaged !== null, 'Exact coordinate collision must trigger combat');
      assert.equal(engaged?.id, hostile.id);
      assert.ok(!Number.isNaN(hostile.position.x) && !Number.isNaN(hostile.position.y));
    });

    test('Both Patrol Vessels and Ambush Beasts trigger proximity engagement properly', () => {
      const manager = new RoamingHostileManager();
      manager.clear();

      // Add a vessel
      const vessel = manager.spawnHostile('crazed_trawler', 1);
      vessel.position.x = 4000;
      vessel.position.y = 2000;
      vessel.velocity.x = 0;
      vessel.velocity.y = 0;

      const engagedVessel = manager.update(0, { x: 4000, y: 2030 });
      assert.equal(engagedVessel?.category, 'vessel');
      assert.equal(engagedVessel?.id, vessel.id);

      manager.clear();

      // Add a beast
      const beast = manager.spawnHostile('mutated_whale', 1);
      beast.position.x = 4000;
      beast.position.y = 2000;
      beast.velocity.x = 0;
      beast.velocity.y = 0;

      const engagedBeast = manager.update(0, { x: 4000, y: 2030 });
      assert.equal(engagedBeast?.category, 'beast');
      assert.equal(engagedBeast?.id, beast.id);
    });
  });
});
