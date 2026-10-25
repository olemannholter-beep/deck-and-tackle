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
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

describe('Milestone 3: Dynamic Ephemeral Whirlpool Spawner Suite', () => {

  // ==========================================================================
  // 1. FishingSpot: 3-Phase State Machine & Transformations
  // ==========================================================================
  describe('1. FishingSpot 3-Phase State Machine', () => {
    test('Initializes in SPAWNING state with alpha = 0 and scale = 0.2', () => {
      const spot = new FishingSpot({
        id: 'test_spot_1',
        name: 'Test Spot',
        position: new Vector2(3000, 3000),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test description'
      });

      assert.equal(spot.state, 'SPAWNING');
      assert.equal(spot.alpha, 0.0);
      assert.equal(spot.scale, 0.2);
      assert.equal(spot.spawnDuration, 2.5);
      assert.equal(spot.despawnDuration, 3.0);
      assert.ok(spot.activeDuration >= 35.0 && spot.activeDuration <= 55.0);
      assert.equal(spot.isDead, false);
      assert.equal(spot.isFishingLocked, false);
    });

    test('SPAWNING state scales alpha (0.0 -> 1.0) and scale (0.2 -> 1.0) over 2.5s', () => {
      const spot = new FishingSpot({
        id: 'test_spot_2',
        name: 'Test Spot',
        position: new Vector2(3000, 3000),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test description'
      });

      // Halfway through spawn (1.25s)
      spot.update(1.25, new Vector2(0, 0));
      assert.equal(spot.state, 'SPAWNING');
      assert.ok(Math.abs(spot.alpha - 0.5) < 0.01, `Alpha at half-spawn should be ~0.5, got ${spot.alpha}`);
      assert.ok(Math.abs(spot.scale - 0.6) < 0.01, `Scale at half-spawn should be ~0.6, got ${spot.scale}`);

      // Reaching 2.5s -> transitions to ACTIVE
      spot.update(1.25, new Vector2(0, 0));
      assert.equal(spot.state, 'ACTIVE');
      assert.equal(spot.alpha, 1.0);
      assert.equal(spot.scale, 1.0);
      assert.equal(spot.timer, 0);
    });

    test('ACTIVE state counts down and transitions to DESPAWNING when unlocked', () => {
      const spot = new FishingSpot({
        id: 'test_spot_3',
        name: 'Test Spot',
        position: new Vector2(3000, 3000),
        zoneType: 'lake',
        speciesType: 'pike',
        description: 'Test description',
        initialState: 'ACTIVE',
        activeDuration: 40.0
      });

      assert.equal(spot.state, 'ACTIVE');
      spot.update(20.0, new Vector2(0, 0));
      assert.equal(spot.state, 'ACTIVE');
      assert.equal(spot.alpha, 1.0);
      assert.equal(spot.scale, 1.0);

      // Advance past remaining duration
      spot.update(20.1, new Vector2(0, 0));
      assert.equal(spot.state, 'DESPAWNING');
      assert.equal(spot.timer, 0);
    });

    test('DESPAWNING state shrinks and fades out over 3.0s, marking isDead = true at end', () => {
      const spot = new FishingSpot({
        id: 'test_spot_4',
        name: 'Test Spot',
        position: new Vector2(3000, 3000),
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'Test description',
        initialState: 'DESPAWNING',
        despawnDuration: 3.0
      });

      assert.equal(spot.state, 'DESPAWNING');

      // Halfway through despawn (1.5s)
      spot.update(1.5, new Vector2(0, 0));
      assert.equal(spot.state, 'DESPAWNING');
      assert.ok(Math.abs(spot.alpha - 0.5) < 0.01);
      assert.ok(Math.abs(spot.scale - 0.5) < 0.01);
      assert.equal(spot.isDead, false);

      // Complete despawn (additional 1.5s)
      spot.update(1.5, new Vector2(0, 0));
      assert.equal(spot.isDead, true);
      assert.equal(spot.alpha, 0.0);
      assert.equal(spot.scale, 0.0);
    });
  });

  // ==========================================================================
  // 2. Proximity & Fishing Despawn Locking
  // ==========================================================================
  describe('2. Proximity & Fishing Despawn Locking', () => {
    test('Proximity lock freezes timer when vessel is within interaction distance (<= 120px)', () => {
      const spotPos = new Vector2(2500, 2500);
      const spot = new FishingSpot({
        id: 'spot_lock_1',
        name: 'Locked Spot',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });

      // Vessel at 80px distance (inside 120px threshold)
      const nearbyBoat = new Vector2(2500 + 80, 2500);
      spot.update(10.0, nearbyBoat);

      assert.equal(spot.isPlayerNearby, true);
      assert.equal(spot.timer, 0, 'Active timer must freeze while vessel is nearby');
      assert.equal(spot.state, 'ACTIVE');

      // Advance 100 seconds while nearby: spot must never despawn
      for (let s = 0; s < 100; s++) {
        spot.update(1.0, nearbyBoat);
      }
      assert.equal(spot.state, 'ACTIVE', 'Locked whirlpool must never despawn');
      assert.equal(spot.timer, 0);
    });

    test('Releasing proximity lock resumes countdown', () => {
      const spotPos = new Vector2(2500, 2500);
      const spot = new FishingSpot({
        id: 'spot_lock_2',
        name: 'Unlocked Spot',
        position: spotPos,
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });

      // Vessel moves away to 300px
      const distantBoat = new Vector2(2500 + 300, 2500);
      spot.update(10.0, distantBoat);

      assert.equal(spot.isPlayerNearby, false);
      assert.equal(spot.timer, 10.0, 'Timer should advance when vessel is away');
    });

    test('isFishingLocked freezes timer regardless of boat distance', () => {
      const spot = new FishingSpot({
        id: 'spot_lock_3',
        name: 'Fishing Locked Spot',
        position: new Vector2(2000, 2000),
        zoneType: 'cave',
        speciesType: 'dagon',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 35.0
      });

      spot.isFishingLocked = true;
      const distantBoat = new Vector2(5000, 5000); // 4242 px away
      spot.update(25.0, distantBoat);

      assert.equal(spot.isPlayerNearby, false);
      assert.equal(spot.timer, 0, 'Timer must freeze when fishing is locked');
      assert.equal(spot.state, 'ACTIVE');
    });

    test('triggerDespawn() transitions spot immediately to DESPAWNING with 3.0s timer', () => {
      const spot = new FishingSpot({
        id: 'spot_victory_1',
        name: 'Victory Despawn Spot',
        position: new Vector2(2000, 2000),
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'Test',
        initialState: 'ACTIVE',
        activeDuration: 50.0
      });

      spot.triggerDespawn();
      assert.equal(spot.state, 'DESPAWNING');
      assert.equal(spot.timer, 0);
      assert.equal(spot.despawnDuration, 3.0);
      assert.equal(spot.isFishingLocked, false);
    });

    test('triggerDespawn() is idempotent and does not reset timer if already DESPAWNING', () => {
      const spot = new FishingSpot({
        id: 'spot_victory_2',
        name: 'Idempotent Spot',
        position: new Vector2(2000, 2000),
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'Test',
        initialState: 'ACTIVE'
      });

      spot.triggerDespawn();
      spot.update(1.2, new Vector2(0, 0));
      assert.equal(spot.state, 'DESPAWNING');
      assert.ok(spot.timer >= 1.1);

      // Trigger despawn again
      const recordedTimer = spot.timer;
      spot.triggerDespawn();
      assert.equal(spot.timer, recordedTimer, 'Idempotent trigger must not reset elapsed despawn timer');
    });

    test('render() scales and fades with alpha without errors', () => {
      const canvas = new MockCanvas(800, 600);
      const ctx = canvas.ctx as unknown as CanvasRenderingContext2D;

      const spot = new FishingSpot({
        id: 'render_spot',
        name: 'Render Spot',
        position: new Vector2(400, 300),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Test'
      });

      assert.doesNotThrow(() => {
        spot.render(ctx);
        spot.update(1.25, new Vector2(400, 300));
        spot.render(ctx);
        spot.triggerDespawn();
        spot.render(ctx);
      });
    });
  });

  // ==========================================================================
  // 3. WhirlpoolSpawner: Quota, Bias & Rejection Sampling
  // ==========================================================================
  describe('3. WhirlpoolSpawner Quota & Rejection Sampling', () => {
    test('Maintains between 6 and 8 active whirlpools globally upon initialization', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const whirlpools = spawner.getActiveWhirlpools();

      assert.ok(
        whirlpools.length >= GLOBAL_WHIRLPOOL_MIN && whirlpools.length <= GLOBAL_WHIRLPOOL_MAX,
        `Whirlpool count must be between 6 and 8, got ${whirlpools.length}`
      );
    });

    test('Maintains 2 to 3 whirlpools within annular band [600, 1800] px of player vessel', () => {
      const boatPos = new Vector2(4000, 4000);
      const spawner = new WhirlpoolSpawner([], boatPos);
      const whirlpools = spawner.getActiveWhirlpools();

      const localSpots = whirlpools.filter(s => {
        const d = s.position.distanceTo(boatPos);
        return d >= LOCAL_BIAS_INNER_RADIUS && d <= LOCAL_BIAS_OUTER_RADIUS;
      });

      assert.ok(
        localSpots.length >= LOCAL_WHIRLPOOL_MIN && localSpots.length <= LOCAL_WHIRLPOOL_MAX,
        `Local whirlpools count must be 2-3, got ${localSpots.length}`
      );
    });

    test('Rejects candidates inside Central Safe Harbor (< 400px)', () => {
      const spawner = new WhirlpoolSpawner();
      // Points inside safe harbor
      assert.equal(spawner.isValidCandidate(4000, 4000), false);
      assert.equal(spawner.isValidCandidate(4100, 4100), false); // dist = 141 px
      assert.equal(spawner.isValidCandidate(4000, 4350), false); // dist = 350 px

      // Points outside safe harbor (>= 400px)
      assert.equal(spawner.isValidCandidate(4000, 4450), true); // dist = 450 px
    });

    test('Rejects candidates outside world boundaries [200, 7800]', () => {
      const spawner = new WhirlpoolSpawner();
      assert.equal(spawner.isValidCandidate(150, 4000), false);
      assert.equal(spawner.isValidCandidate(4000, 7850), false);
      assert.equal(spawner.isValidCandidate(-50, 4000), false);
      assert.equal(spawner.isValidCandidate(4000, 8100), false);
      assert.equal(spawner.isValidCandidate(250, 250), true);
    });

    test('Rejects candidates colliding with island colliders (collider radius + 100px)', () => {
      const colliders = [
        { x: 3000, y: 3000, radius: 80, type: 'rock' as const }
      ];
      const spawner = new WhirlpoolSpawner(colliders);

      // dist = 120 < 80 + 100 (180px) -> reject
      assert.equal(spawner.isValidCandidate(3000, 3120), false);
      // dist = 220 >= 180px -> accept
      assert.equal(spawner.isValidCandidate(3000, 3220), true);
    });

    test('Rejection sampling preserves minimum 350px spacing between whirlpools', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const spots = spawner.getActiveWhirlpools();

      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const d = spots[i].position.distanceTo(spots[j].position);
          assert.ok(d >= 350, `Spots ${spots[i].id} and ${spots[j].id} too close: ${d.toFixed(1)}px`);
        }
      }
    });

    test('Annular candidate generator handles corner boat coordinates cleanly', () => {
      const cornerBoat = new Vector2(100, 100);
      const spawner = new WhirlpoolSpawner([], cornerBoat);
      const candidate = spawner.spawnCandidate(true, cornerBoat);

      assert.ok(candidate !== null, 'Candidate generation at corner must succeed');
      assert.ok(candidate.position.x >= 200 && candidate.position.x <= 7800);
      assert.ok(candidate.position.y >= 200 && candidate.position.y <= 7800);
      const dist = cornerBoat.distanceTo(candidate.position);
      assert.ok(dist >= LOCAL_BIAS_INNER_RADIUS && dist <= LOCAL_BIAS_OUTER_RADIUS);
    });
  });

  // ==========================================================================
  // 4. Radial Zone Encounter Profile Binding
  // ==========================================================================
  describe('4. Radial Zone Encounter Profile Binding', () => {
    test('Distance < 1200 px binds to Zone 1: shallow / perch', () => {
      const p1 = WhirlpoolSpawner.getEncounterProfileForDistance(800);
      assert.equal(p1.tier, 1);
      assert.equal(p1.zoneType, 'shallow');
      assert.equal(p1.speciesType, 'perch');
      assert.equal(p1.name, 'The Shallows (Coastal Shoals)');
    });

    test('1200 <= Distance < 2400 px binds to Zone 2: lake / pike', () => {
      const p2 = WhirlpoolSpawner.getEncounterProfileForDistance(1800);
      assert.equal(p2.tier, 2);
      assert.equal(p2.zoneType, 'lake');
      assert.equal(p2.speciesType, 'pike');
      assert.equal(p2.name, 'The Foggy Banks (Sunken Sound)');
    });

    test('2400 <= Distance < 3600 px binds to Zone 3: abyss / gar', () => {
      const p3 = WhirlpoolSpawner.getEncounterProfileForDistance(3000);
      assert.equal(p3.tier, 3);
      assert.equal(p3.zoneType, 'abyss');
      assert.equal(p3.speciesType, 'gar');
      assert.equal(p3.name, 'The Sunken Reefs (Devil’s Chasm)');
    });

    test('Distance >= 3600 px binds to Zone 4: cave / dagon', () => {
      const p4 = WhirlpoolSpawner.getEncounterProfileForDistance(4500);
      assert.equal(p4.tier, 4);
      assert.equal(p4.zoneType, 'cave');
      assert.equal(p4.speciesType, 'dagon');
      assert.equal(p4.name, 'The Eldritch Trench (The Sunken Ruin of Dagon)');
    });

    test('Position lookup correctly calculates distance and returns encounter profile', () => {
      // Boat at (4000, 5800) -> dy = 1800 -> Zone 2 (lake / pike)
      const p = WhirlpoolSpawner.getEncounterProfileForPosition(new Vector2(4000, 5800));
      assert.equal(p.tier, 2);
      assert.equal(p.speciesType, 'pike');
    });
  });

  // ==========================================================================
  // 5. Lifecycle Updates, Replenishment & Victory Trigger
  // ==========================================================================
  describe('5. Lifecycle Updates, Replenishment & Victory Trigger', () => {
    test('Spawner dt = 0 update tick is a no-op', () => {
      const spawner = new WhirlpoolSpawner();
      const countBefore = spawner.whirlpools.length;
      spawner.update(0, new Vector2(4000, 4000));
      assert.equal(spawner.whirlpools.length, countBefore);
    });

    test('Massive time warp (dt = 300s) recovers to exact 6-8 quota without exceeding max 8', () => {
      const spawner = new WhirlpoolSpawner();
      const boatPos = new Vector2(4000, 4000);

      // Advance by 300 seconds: all initial spots will expire and replenish
      spawner.update(300, boatPos);

      const active = spawner.getActiveWhirlpools();
      assert.ok(active.length >= GLOBAL_WHIRLPOOL_MIN && active.length <= GLOBAL_WHIRLPOOL_MAX);
    });

    test('getNearbySpot returns whirlpool when within interaction distance and null otherwise', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const spots = spawner.getActiveWhirlpools();
      assert.ok(spots.length > 0);

      const firstSpot = spots[0];
      // Boat right on top of first spot
      const nearby = spawner.getNearbySpot(new Vector2(firstSpot.position.x, firstSpot.position.y));
      assert.equal(nearby?.id, firstSpot.id);

      // Boat far away at (0, 0)
      const farNearby = spawner.getNearbySpot(new Vector2(0, 0));
      assert.equal(farNearby, null);
    });

    test('onFishingVictory triggers despawn on matching whirlpool ID', () => {
      const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
      const targetSpot = spawner.getActiveWhirlpools()[0];

      spawner.onFishingVictory(targetSpot.id);
      assert.equal(targetSpot.state, 'DESPAWNING');
      assert.equal(targetSpot.despawnDuration, 3.0);
    });

    test('onFishingVictory with non-existent ID fails gracefully without error', () => {
      const spawner = new WhirlpoolSpawner();
      assert.doesNotThrow(() => {
        spawner.onFishingVictory('non_existent_id_9999');
      });
    });
  });

  // ==========================================================================
  // 6. OverworldMap Integration
  // ==========================================================================
  describe('6. OverworldMap Integration', () => {
    test('OverworldMap instantiates WhirlpoolSpawner and exposes active spots in fishingSpots', () => {
      const map = new OverworldMap();
      assert.ok(map.whirlpoolSpawner instanceof WhirlpoolSpawner);
      assert.ok(map.fishingSpots.length >= GLOBAL_WHIRLPOOL_MIN);
      assert.ok(map.fishingSpots.length <= GLOBAL_WHIRLPOOL_MAX);
    });

    test('OverworldMap update advances WhirlpoolSpawner and maintains active spots', () => {
      const map = new OverworldMap();
      const boatPos = new Vector2(4000, 4000);

      map.update(0.016, boatPos, false);
      assert.ok(map.fishingSpots.length >= GLOBAL_WHIRLPOOL_MIN);
      assert.ok(map.fishingSpots.length <= GLOBAL_WHIRLPOOL_MAX);
    });

    test('OverworldMap onFishingVictory forwards trigger to WhirlpoolSpawner', () => {
      const map = new OverworldMap();
      const firstSpot = map.fishingSpots[0];
      const spotId = firstSpot.id;

      map.onFishingVictory(spotId);
      assert.equal(firstSpot.state, 'DESPAWNING');
    });

    test('OverworldMap getNearbyFishingSpot finds nearby whirlpool', () => {
      const map = new OverworldMap();
      const targetSpot = map.fishingSpots[0];

      const found = map.getNearbyFishingSpot(targetSpot.position);
      assert.equal(found?.id, targetSpot.id);
    });
  });
});
