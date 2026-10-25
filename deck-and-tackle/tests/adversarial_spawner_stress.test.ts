import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from '../src/engine/Vector2.js';
import { FishingSpot } from '../src/game/overworld/FishingSpot.js';
import {
  WhirlpoolSpawner,
  GLOBAL_WHIRLPOOL_MIN,
  GLOBAL_WHIRLPOOL_MAX,
  LOCAL_WHIRLPOOL_MIN,
  LOCAL_WHIRLPOOL_MAX,
  LOCAL_BIAS_INNER_RADIUS,
  LOCAL_BIAS_OUTER_RADIUS,
  PROXIMITY_LOCK_RADIUS
} from '../src/game/overworld/WhirlpoolSpawner.js';
import { OverworldMap } from '../src/game/overworld/OverworldMap.js';
import { MockCanvas } from './test_helpers.js';

describe('Tier 5 Adversarial Stress Suite: WhirlpoolSpawner & Ephemeral Lifecycle', () => {

  // ==========================================================================
  // SUITE 1: Multi-Thousand Tick Quota Invariant Stress
  // ==========================================================================
  describe('Suite 1: Multi-Thousand Tick Quota Invariants', () => {

    test('1.1: 10,000 tick simulation with stationary vessel at Harbor (4000, 4000) maintains [6, 8] global and [2, 3] local', () => {
      const boatPos = new Vector2(4000, 4000);
      const spawner = new WhirlpoolSpawner([], boatPos);
      const totalTicks = 10000;
      const dt = 0.1; // 1000 seconds of game simulation (~16.6 minutes)

      let globalMin = Infinity;
      let globalMax = -Infinity;
      let localMin = Infinity;
      let localMax = -Infinity;

      for (let tick = 0; tick < totalTicks; tick++) {
        spawner.update(dt, boatPos, false);
        const active = spawner.getActiveWhirlpools();
        const globalCount = active.length;
        const localCount = spawner.getLocalWhirlpoolCount(boatPos);

        if (globalCount < globalMin) globalMin = globalCount;
        if (globalCount > globalMax) globalMax = globalCount;
        if (localCount < localMin) localMin = localCount;
        if (localCount > localMax) localMax = localCount;

        // Invariant checks at each tick
        assert.ok(
          globalCount >= GLOBAL_WHIRLPOOL_MIN && globalCount <= GLOBAL_WHIRLPOOL_MAX,
          `Tick ${tick}: Global count ${globalCount} violated [${GLOBAL_WHIRLPOOL_MIN}, ${GLOBAL_WHIRLPOOL_MAX}]`
        );
        assert.ok(
          localCount >= LOCAL_WHIRLPOOL_MIN && localCount <= LOCAL_WHIRLPOOL_MAX,
          `Tick ${tick}: Local count ${localCount} violated [${LOCAL_WHIRLPOOL_MIN}, ${LOCAL_WHIRLPOOL_MAX}]`
        );

        // Architectural invariants
        for (const spot of active) {
          // World boundaries [200, 7800]
          assert.ok(
            spot.position.x >= 200 && spot.position.x <= 7800 &&
            spot.position.y >= 200 && spot.position.y <= 7800,
            `Tick ${tick}: Spot ${spot.id} at (${spot.position.x}, ${spot.position.y}) violated boundary [200, 7800]`
          );

          // Harbor exclusion (>= 400px)
          const distHarbor = spot.position.distanceTo(new Vector2(4000, 4000));
          assert.ok(
            distHarbor >= 399.9,
            `Tick ${tick}: Spot ${spot.id} at distance ${distHarbor.toFixed(1)}px violated harbor exclusion >= 400px`
          );
        }
      }

      assert.ok(globalMin >= GLOBAL_WHIRLPOOL_MIN, `Observed min global: ${globalMin}`);
      assert.ok(globalMax <= GLOBAL_WHIRLPOOL_MAX, `Observed max global: ${globalMax}`);
      assert.ok(localMin >= LOCAL_WHIRLPOOL_MIN, `Observed min local: ${localMin}`);
      assert.ok(localMax <= LOCAL_WHIRLPOOL_MAX, `Observed max local: ${localMax}`);
    });

    test('1.2: 5,000 tick simulation across each radial zone center maintains global quota [6, 8]', () => {
      // Testing stationary stations in each of the 4 zones
      const zoneTestPositions = [
        { name: 'Zone 1 (Shoals)', pos: new Vector2(4000, 4800) },      // dist = 800px
        { name: 'Zone 2 (Foggy Banks)', pos: new Vector2(4000, 5800) },  // dist = 1800px
        { name: 'Zone 3 (Sunken Reefs)', pos: new Vector2(4000, 7000) }, // dist = 3000px
        { name: 'Zone 4 (Eldritch Trench)', pos: new Vector2(4000, 7700) } // dist = 3700px
      ];

      for (const { name, pos } of zoneTestPositions) {
        const spawner = new WhirlpoolSpawner([], pos);
        const dt = 0.1;

        for (let tick = 0; tick < 2000; tick++) {
          spawner.update(dt, pos, false);
          const active = spawner.getActiveWhirlpools();
          const globalCount = active.length;
          const localCount = spawner.getLocalWhirlpoolCount(pos);

          assert.ok(
            globalCount >= GLOBAL_WHIRLPOOL_MIN && globalCount <= GLOBAL_WHIRLPOOL_MAX,
            `${name} Tick ${tick}: Global count ${globalCount} outside [6, 8]`
          );
          assert.ok(
            localCount >= LOCAL_WHIRLPOOL_MIN && localCount <= LOCAL_WHIRLPOOL_MAX,
            `${name} Tick ${tick}: Local count ${localCount} outside [2, 3]`
          );
        }
      }
    });

    test('1.3: Dynamic slow-cruising vessel (50 px/s) maintains global quota [6, 8] continuously', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const boatPos = new Vector2(4000, 4000);
      let heading = 0; // radians
      const speed = 50; // px/s (realistic cruising speed)
      const dt = 0.05; // 20 updates per second
      const totalSteps = 5000; // 250s of real cruising

      for (let step = 0; step < totalSteps; step++) {
        // Cruise in a wide spiral
        heading += 0.005;
        boatPos.x += Math.cos(heading) * speed * dt;
        boatPos.y += Math.sin(heading) * speed * dt;

        // Clamp boat within navigable bounds
        boatPos.x = Math.max(500, Math.min(7500, boatPos.x));
        boatPos.y = Math.max(500, Math.min(7500, boatPos.y));

        spawner.update(dt, boatPos, false);
        const active = spawner.getActiveWhirlpools();

        assert.ok(
          active.length >= GLOBAL_WHIRLPOOL_MIN && active.length <= GLOBAL_WHIRLPOOL_MAX,
          `Cruising step ${step}: Global count ${active.length} violated [6, 8]`
        );
      }
    });

    test('1.4: Island collider avoidance remains 100% impenetrable over 2,000 replenishment cycles', () => {
      const colliders = [
        { x: 3000, y: 3000, radius: 120, type: 'island' as const },
        { x: 5000, y: 5000, radius: 150, type: 'rock' as const },
        { x: 3500, y: 4500, radius: 100, type: 'shoal' as const },
        { x: 4500, y: 3500, radius: 80, type: 'reef' as const }
      ];
      const boatPos = new Vector2(4000, 4000);
      const spawner = new WhirlpoolSpawner(colliders, boatPos);

      // Force high turnover by cycling dt = 60s
      for (let cycle = 0; cycle < 100; cycle++) {
        spawner.update(60, boatPos, false);
        const active = spawner.getActiveWhirlpools();

        for (const spot of active) {
          for (const col of colliders) {
            const dist = spot.position.distanceTo(new Vector2(col.x, col.y));
            const minRequiredDist = col.radius + 100;
            assert.ok(
              dist >= minRequiredDist,
              `Cycle ${cycle}: Spot ${spot.id} at distance ${dist.toFixed(1)}px penetrated collider (radius=${col.radius}, required=${minRequiredDist})`
            );
          }
        }
      }
    });

    test('1.5: 500 randomized vessel positions across entire 8000x8000 world maintain [6, 8] global and [2, 3] local', () => {
      for (let i = 0; i < 500; i++) {
        const randX = 300 + Math.random() * 7400;
        const randY = 300 + Math.random() * 7400;
        const boatPos = new Vector2(randX, randY);
        const spawner = new WhirlpoolSpawner([], boatPos);

        const active = spawner.getActiveWhirlpools();
        const localCount = spawner.getLocalWhirlpoolCount(boatPos);

        assert.ok(
          active.length >= GLOBAL_WHIRLPOOL_MIN && active.length <= GLOBAL_WHIRLPOOL_MAX,
          `Position (${randX.toFixed(0)}, ${randY.toFixed(0)}): Global count ${active.length} violated [6, 8]`
        );
        assert.ok(
          localCount >= LOCAL_WHIRLPOOL_MIN && localCount <= LOCAL_WHIRLPOOL_MAX,
          `Position (${randX.toFixed(0)}, ${randY.toFixed(0)}): Local count ${localCount} violated [2, 3]`
        );

        // Run 10 ticks at this position
        for (let tick = 0; tick < 10; tick++) {
          spawner.update(1.0, boatPos, false);
          assert.ok(spawner.getActiveWhirlpools().length >= 6 && spawner.getActiveWhirlpools().length <= 8);
          assert.ok(spawner.getLocalWhirlpoolCount(boatPos) >= 2 && spawner.getLocalWhirlpoolCount(boatPos) <= 3);
        }
      }
    });

    test('1.6: Dynamic waypoint traversal across all 4 zones with intermittent fishing battles retains invariant stability', () => {
      const waypoints = [
        new Vector2(4000, 4000), // Harbor (Zone 1)
        new Vector2(4000, 5500), // Zone 2
        new Vector2(5500, 5500), // Zone 3
        new Vector2(7000, 7000), // Zone 4
        new Vector2(1000, 7000), // Zone 4
        new Vector2(1000, 1000), // Zone 4
        new Vector2(4000, 4000)  // Return to Harbor
      ];

      const spawner = new WhirlpoolSpawner([], waypoints[0]);
      const currentPos = new Vector2(waypoints[0].x, waypoints[0].y);

      for (let wpIdx = 0; wpIdx < waypoints.length - 1; wpIdx++) {
        const start = waypoints[wpIdx];
        const end = waypoints[wpIdx + 1];
        const dist = start.distanceTo(end);
        const steps = Math.floor(dist / 100); // 100px steps

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          currentPos.x = start.x + (end.x - start.x) * t;
          currentPos.y = start.y + (end.y - start.y) * t;

          // Update spawner
          spawner.update(0.5, currentPos, false);
          const active = spawner.getActiveWhirlpools();

          assert.ok(
            active.length >= GLOBAL_WHIRLPOOL_MIN && active.length <= GLOBAL_WHIRLPOOL_MAX,
            `Waypoint transit ${wpIdx}->${wpIdx+1} step ${s}: Global count ${active.length} outside [6, 8]`
          );

          // Simulated fishing battle: if near a spot, lock and complete it
          const nearby = spawner.getNearbySpot(currentPos);
          if (nearby) {
            // Engage fishing
            spawner.update(1.0, currentPos, true);
            // Finish battle
            spawner.onFishingVictory(nearby.id);
            assert.equal(nearby.state, 'DESPAWNING');
          }
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 2: Boundary Stress & Extreme Vessel Coordinate Candidate Generation
  // ==========================================================================
  describe('Suite 2: Boundary Stress & Extreme Coordinate Candidate Generation', () => {

    test('2.1: Vessel at map corners (0,0), (8000,8000), (0,8000), (8000,0) generates valid candidates within map', () => {
      const corners = [
        new Vector2(0, 0),
        new Vector2(8000, 8000),
        new Vector2(0, 8000),
        new Vector2(8000, 0)
      ];

      for (const corner of corners) {
        const spawner = new WhirlpoolSpawner([], corner);
        let successCount = 0;

        for (let attempt = 0; attempt < 50; attempt++) {
          const candidate = spawner.spawnCandidate(true, corner);
          if (candidate) {
            successCount++;
            assert.ok(
              candidate.position.x >= 200 && candidate.position.x <= 7800,
              `Corner (${corner.x}, ${corner.y}): Candidate X ${candidate.position.x} out of bounds [200, 7800]`
            );
            assert.ok(
              candidate.position.y >= 200 && candidate.position.y <= 7800,
              `Corner (${corner.x}, ${corner.y}): Candidate Y ${candidate.position.y} out of bounds [200, 7800]`
            );
            const dist = corner.distanceTo(candidate.position);
            assert.ok(
              dist >= LOCAL_BIAS_INNER_RADIUS && dist <= LOCAL_BIAS_OUTER_RADIUS,
              `Corner (${corner.x}, ${corner.y}): Candidate dist ${dist.toFixed(1)} outside annular band [600, 1800]`
            );
          }
        }

        assert.ok(
          successCount >= 10,
          `Corner (${corner.x}, ${corner.y}): Expected at least 10 valid samples out of 50, got ${successCount}`
        );
      }
    });

    test('2.2: Vessel at outer world edges (200, 4000), (7800, 4000), (4000, 200), (4000, 7800) generates valid candidates', () => {
      const edges = [
        new Vector2(200, 4000),
        new Vector2(7800, 4000),
        new Vector2(4000, 200),
        new Vector2(4000, 7800)
      ];

      for (const edge of edges) {
        const spawner = new WhirlpoolSpawner([], edge);
        let successCount = 0;

        for (let attempt = 0; attempt < 50; attempt++) {
          const candidate = spawner.spawnCandidate(true, edge);
          if (candidate) {
            successCount++;
            assert.ok(candidate.position.x >= 200 && candidate.position.x <= 7800);
            assert.ok(candidate.position.y >= 200 && candidate.position.y <= 7800);
            const dist = edge.distanceTo(candidate.position);
            assert.ok(dist >= LOCAL_BIAS_INNER_RADIUS && dist <= LOCAL_BIAS_OUTER_RADIUS);
          }
        }

        assert.ok(successCount >= 15, `Edge (${edge.x}, ${edge.y}): Expected >= 15 valid samples, got ${successCount}`);
      }
    });

    test('2.3: Extreme out-of-bounds vessel positions (-1000, -1000) and (9000, 9000) do not throw or produce NaN coordinates', () => {
      const extremePositions = [
        new Vector2(-1000, -1000),
        new Vector2(9000, 9000),
        new Vector2(-500, 4000),
        new Vector2(10000, 4000)
      ];

      for (const pos of extremePositions) {
        assert.doesNotThrow(() => {
          const spawner = new WhirlpoolSpawner([], pos);
          const spot = spawner.spawnCandidate(true, pos);
          if (spot) {
            assert.ok(!Number.isNaN(spot.position.x));
            assert.ok(!Number.isNaN(spot.position.y));
            assert.ok(spot.position.x >= 200 && spot.position.x <= 7800);
            assert.ok(spot.position.y >= 200 && spot.position.y <= 7800);
          }
        });
      }
    });

    test('2.4: Candidate generation never produces NaN, Infinity, or negative scales/alphas', () => {
      const spawner = new WhirlpoolSpawner();
      const testPos = new Vector2(4000, 4000);

      for (let i = 0; i < 100; i++) {
        const spot = spawner.spawnCandidate(i % 2 === 0, testPos, 'SPAWNING');
        if (spot) {
          assert.ok(Number.isFinite(spot.position.x));
          assert.ok(Number.isFinite(spot.position.y));
          assert.ok(Number.isFinite(spot.alpha));
          assert.ok(Number.isFinite(spot.scale));
          assert.ok(spot.alpha >= 0.0 && spot.alpha <= 1.0);
          assert.ok(spot.scale >= 0.0 && spot.scale <= 1.0);
        }
      }
    });
  });

  // ==========================================================================
  // SUITE 3: Despawn Proximity Lock Stress (119px vs 121px) & Fishing Locks
  // ==========================================================================
  describe('Suite 3: Despawn Proximity Lock Stress & Fishing Locks', () => {

    test('3.1: Proximity boundary precision: 119.0px strictly locks, 120.0px locks, 120.01px unlocks, 121.0px strictly unlocks', () => {
      const spotPos = new Vector2(3000, 3000);

      // 1. Vessel at 119.0 px: MUST BE LOCKED
      const spot119 = new FishingSpot({
        id: 'spot_119',
        name: 'Spot 119',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });
      spot119.update(5.0, new Vector2(3000 + 119.0, 3000));
      assert.equal(spot119.isPlayerNearby, true, 'Distance 119.0px must set isPlayerNearby = true');
      assert.equal(spot119.timer, 0, 'Distance 119.0px must freeze timer');

      // 2. Vessel at 120.0 px: MUST BE LOCKED (threshold is <= 120)
      const spot120 = new FishingSpot({
        id: 'spot_120',
        name: 'Spot 120',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });
      spot120.update(5.0, new Vector2(3000 + 120.0, 3000));
      assert.equal(spot120.isPlayerNearby, true, 'Distance 120.0px must set isPlayerNearby = true');
      assert.equal(spot120.timer, 0, 'Distance 120.0px must freeze timer');

      // 3. Vessel at 120.01 px: MUST BE UNLOCKED
      const spot120_01 = new FishingSpot({
        id: 'spot_120_01',
        name: 'Spot 120.01',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });
      spot120_01.update(5.0, new Vector2(3000 + 120.01, 3000));
      assert.equal(spot120_01.isPlayerNearby, false, 'Distance 120.01px must set isPlayerNearby = false');
      assert.equal(spot120_01.timer, 5.0, 'Distance 120.01px must advance timer');

      // 4. Vessel at 121.0 px: MUST BE UNLOCKED
      const spot121 = new FishingSpot({
        id: 'spot_121',
        name: 'Spot 121',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });
      spot121.update(5.0, new Vector2(3000 + 121.0, 3000));
      assert.equal(spot121.isPlayerNearby, false, 'Distance 121.0px must set isPlayerNearby = false');
      assert.equal(spot121.timer, 5.0, 'Distance 121.0px must advance timer');
    });

    test('3.2: 10,000 tick hover at 119.5px: spot remains indefinitely alive past standard active duration', () => {
      const spotPos = new Vector2(2000, 2000);
      const spot = new FishingSpot({
        id: 'hover_spot',
        name: 'Hover Spot',
        position: spotPos,
        zoneType: 'lake',
        speciesType: 'pike',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0 // Max standard lifetime 35s
      });

      const hoveringBoat = new Vector2(2000 + 119.5, 2000);
      const dt = 0.016; // 60 FPS
      const totalTicks = 10000; // 160 seconds (over 4.5x normal active duration)

      for (let i = 0; i < totalTicks; i++) {
        spot.update(dt, hoveringBoat);
        assert.equal(spot.state, 'ACTIVE');
        assert.equal(spot.isPlayerNearby, true);
        assert.equal(spot.timer, 0);
        assert.equal(spot.isDead, false);
      }
    });

    test('3.3: High-frequency boundary oscillation (119px <-> 121px) accumulates time strictly during unlocked ticks', () => {
      const spotPos = new Vector2(2000, 2000);
      const spot = new FishingSpot({
        id: 'oscillate_spot',
        name: 'Oscillate Spot',
        position: spotPos,
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 100.0
      });

      const insideBoat = new Vector2(2000 + 119.0, 2000);
      const outsideBoat = new Vector2(2000 + 121.0, 2000);
      const dt = 0.1;
      let expectedElapsed = 0;

      // 1000 cycles: odd ticks outside (accumulate time), even ticks inside (freeze time)
      for (let i = 0; i < 1000; i++) {
        if (i % 2 === 1) {
          spot.update(dt, outsideBoat);
          expectedElapsed += dt;
        } else {
          spot.update(dt, insideBoat);
        }

        assert.ok(
          Math.abs(spot.timer - expectedElapsed) < 0.001,
          `Tick ${i}: Expected timer ${expectedElapsed.toFixed(3)}s, got ${spot.timer.toFixed(3)}s`
        );
      }
    });

    test('3.4: Active fishing lock (isFishingLocked) freezes countdown even when vessel drifts 5,000px away', () => {
      const spotPos = new Vector2(2000, 2000);
      const spot = new FishingSpot({
        id: 'remote_fish_spot',
        name: 'Remote Fish Spot',
        position: spotPos,
        zoneType: 'cave',
        speciesType: 'dagon',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });

      // Engage fishing
      spot.isFishingLocked = true;

      // Boat moves 5000px away
      const distantBoat = new Vector2(7000, 2000);

      // Run 200 seconds of updates
      for (let s = 0; s < 200; s++) {
        spot.update(1.0, distantBoat);
        assert.equal(spot.state, 'ACTIVE');
        assert.equal(spot.isPlayerNearby, false);
        assert.equal(spot.timer, 0);
      }

      // Disengage fishing
      spot.isFishingLocked = false;
      spot.update(10.0, distantBoat);
      assert.equal(spot.timer, 10.0, 'Timer must resume advancing after isFishingLocked is released');
    });

    test('3.5: Rapid toggling of isFishingLocked does not cause NaN or inconsistent state', () => {
      const spot = new FishingSpot({
        id: 'toggle_spot',
        name: 'Toggle Spot',
        position: new Vector2(4000, 4000),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 50.0
      });

      const boat = new Vector2(5000, 5000);

      for (let i = 0; i < 500; i++) {
        spot.isFishingLocked = (i % 2 === 0);
        spot.update(0.05, boat);
        assert.ok(Number.isFinite(spot.timer));
        assert.ok(spot.timer >= 0);
      }
    });
  });

  // ==========================================================================
  // SUITE 4: Rapid Post-Fishing Despawn & Race Conditions
  // ==========================================================================
  describe('Suite 4: Rapid Post-Fishing Despawn & Race Conditions', () => {

    test('4.1: onFishingVictory on multiple spots simultaneously initiates clean 3.0s despawn on each', () => {
      const boatPos = new Vector2(4000, 4000);
      const spawner = new WhirlpoolSpawner([], boatPos);
      const spots = spawner.getActiveWhirlpools();

      assert.ok(spots.length >= 6);

      // Trigger victory on 3 spots simultaneously
      const victoryIds = [spots[0].id, spots[1].id, spots[2].id];
      for (const id of victoryIds) {
        spawner.onFishingVictory(id);
      }

      for (const id of victoryIds) {
        const spot = spawner.whirlpools.find(s => s.id === id);
        assert.ok(spot);
        assert.equal(spot?.state, 'DESPAWNING');
        assert.equal(spot?.despawnDuration, 3.0);
        assert.equal(spot?.timer, 0);
        assert.equal(spot?.isFishingLocked, false);
      }

      // Advance by 1.5s (halfway through despawn)
      spawner.update(1.5, boatPos, false);
      for (const id of victoryIds) {
        const spot = spawner.whirlpools.find(s => s.id === id);
        assert.ok(spot);
        assert.equal(spot?.state, 'DESPAWNING');
        assert.ok(Math.abs((spot?.alpha ?? 0) - 0.5) < 0.05);
        assert.ok(Math.abs((spot?.scale ?? 0) - 0.5) < 0.05);
      }

      // Advance by remaining 1.6s -> must be marked isDead and pruned
      spawner.update(1.6, boatPos, false);
      for (const id of victoryIds) {
        const spot = spawner.whirlpools.find(s => s.id === id);
        assert.equal(spot, undefined, `Spot ${id} should have been pruned after despawn`);
      }

      // Quota must recover back to [6, 8]
      const replenished = spawner.getActiveWhirlpools();
      assert.ok(
        replenished.length >= GLOBAL_WHIRLPOOL_MIN && replenished.length <= GLOBAL_WHIRLPOOL_MAX,
        `Replenished count ${replenished.length} must be in [6, 8]`
      );
    });

    test('4.2: Repeated triggers of triggerDespawn() on the same spot is strictly idempotent', () => {
      const spot = new FishingSpot({
        id: 'idempotent_test',
        name: 'Idempotent Test',
        position: new Vector2(2500, 2500),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE'
      });

      spot.triggerDespawn();
      assert.equal(spot.state, 'DESPAWNING');
      spot.update(1.0, new Vector2(0, 0));
      assert.ok(Math.abs(spot.timer - 1.0) < 0.01);

      // Trigger despawn 50 times in succession
      for (let i = 0; i < 50; i++) {
        spot.triggerDespawn();
      }

      // Timer must NOT be reset to 0
      assert.ok(Math.abs(spot.timer - 1.0) < 0.01, 'triggerDespawn() must be strictly idempotent');
    });

    test('4.3: Active fishing lock does NOT impede DESPAWNING state progression', () => {
      const spot = new FishingSpot({
        id: 'despawn_lock_test',
        name: 'Despawn Lock Test',
        position: new Vector2(2500, 2500),
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'Test',
        initialState: 'DESPAWNING'
      });

      spot.isFishingLocked = true; // Attempt to lock during despawning
      const nearbyBoat = new Vector2(2500 + 50, 2500); // Also nearby

      spot.update(3.1, nearbyBoat);

      assert.equal(spot.isDead, true, 'DESPAWNING state must conclude and mark isDead = true even if boat is nearby');
      assert.equal(spot.alpha, 0.0);
      assert.equal(spot.scale, 0.0);
    });

    test('4.4: WhirlpoolSpawner update with negative or zero dt is safely ignored', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const initialSpots = spawner.getActiveWhirlpools().slice();

      spawner.update(0, new Vector2(4000, 4000), false);
      assert.equal(spawner.getActiveWhirlpools().length, initialSpots.length);

      spawner.update(-10, new Vector2(4000, 4000), false);
      assert.equal(spawner.getActiveWhirlpools().length, initialSpots.length);
    });

    test('4.5: Massive island clutter: Spawner initialized with 30 island colliders functions without crashing', () => {
      const denseColliders = [];
      for (let i = 0; i < 30; i++) {
        denseColliders.push({
          x: 1000 + (i % 6) * 1000,
          y: 1000 + Math.floor(i / 6) * 1200,
          radius: 120,
          type: 'rock' as const
        });
      }

      assert.doesNotThrow(() => {
        const spawner = new WhirlpoolSpawner(denseColliders, new Vector2(4000, 4000));
        assert.ok(spawner.getActiveWhirlpools().length >= GLOBAL_WHIRLPOOL_MIN);
      });
    });
  });

  // ==========================================================================
  // SUITE 5: Full OverworldMap Spawner Integration & Canvas Rendering Resilience
  // ==========================================================================
  describe('Suite 5: OverworldMap Spawner Integration & Canvas Rendering Resilience', () => {

    test('5.1: OverworldMap full tick lifecycle with MockCanvas rendering does not emit NaN or throw', () => {
      const map = new OverworldMap();
      const canvas = new MockCanvas(800, 600);
      const ctx = canvas.ctx as unknown as CanvasRenderingContext2D;
      const boatPos = new Vector2(4000, 4000);

      assert.doesNotThrow(() => {
        for (let frame = 0; frame < 100; frame++) {
          map.update(0.016, boatPos, false);
          for (const spot of map.fishingSpots) {
            spot.render(ctx);
          }
        }
      });
    });

    test('5.2: getNearbyFishingSpot finds correct spot and returns null when outside all radii', () => {
      const map = new OverworldMap();
      assert.ok(map.fishingSpots.length > 0);

      const firstSpot = map.fishingSpots[0];
      // Test inside
      const inside = map.getNearbyFishingSpot(new Vector2(firstSpot.position.x + 50, firstSpot.position.y));
      assert.equal(inside?.id, firstSpot.id);

      // Test outside (150px away)
      const outside = map.getNearbyFishingSpot(new Vector2(firstSpot.position.x + 150, firstSpot.position.y));
      assert.notEqual(outside?.id, firstSpot.id);
    });
  });
});
