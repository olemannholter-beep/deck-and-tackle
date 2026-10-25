import { Vector2 } from '../../engine/Vector2';
import { FishingSpot } from './FishingSpot';
import type { WaterZoneType } from './FishingSpot';
import type { SpeciesType } from '../battle/FishData';
import type { IslandCollider } from './OverworldMap';

export const GLOBAL_WHIRLPOOL_MIN = 6;
export const GLOBAL_WHIRLPOOL_MAX = 8;
export const LOCAL_WHIRLPOOL_MIN = 2;
export const LOCAL_WHIRLPOOL_MAX = 3;
export const LOCAL_BIAS_INNER_RADIUS = 600;
export const LOCAL_BIAS_OUTER_RADIUS = 1800;
export const PROXIMITY_LOCK_RADIUS = 120;

export interface ZoneEncounterProfile {
  zoneType: WaterZoneType;
  speciesType: SpeciesType;
  name: string;
  description: string;
  tier: number;
}

export class WhirlpoolSpawner {
  public whirlpools: FishingSpot[] = [];
  public islandColliders: IslandCollider[] = [];
  private nextSpotId: number = 1;

  constructor(islandColliders: IslandCollider[] = [], initialBoatPos: Vector2 = new Vector2(4000, 4000)) {
    this.islandColliders = islandColliders;
    this.initWhirlpools(initialBoatPos);
  }

  public setIslandColliders(colliders: IslandCollider[]): void {
    this.islandColliders = colliders;
  }

  /**
   * Authoritative Encounter Profile Binding:
   * Maps radial Euclidean distance from Central Safe Harbor (4000, 4000) to depth zone and fish species.
   * - Dist < 1200 px: Zone 1 (The Shallows) -> 'shallow', 'perch' (Innsmouth Perch)
   * - 1200 <= Dist < 2400 px: Zone 2 (The Foggy Banks) -> 'lake', 'pike' (Blighted Pike)
   * - 2400 <= Dist < 3600 px: Zone 3 (The Sunken Reefs) -> 'abyss', 'gar' (Abyssal Void-Gar)
   * - Dist >= 3600 px: Zone 4 (The Eldritch Trench) -> 'cave', 'dagon' (Apex Dagon)
   */
  public static getEncounterProfileForPosition(pos: Vector2): ZoneEncounterProfile {
    const dist = Math.hypot(pos.x - 4000, pos.y - 4000);
    return WhirlpoolSpawner.getEncounterProfileForDistance(dist);
  }

  public static getEncounterProfileForDistance(dist: number): ZoneEncounterProfile {
    if (dist < 1200) {
      return {
        zoneType: 'shallow',
        speciesType: 'perch',
        name: 'The Shallows (Coastal Shoals)',
        description: 'Murky brackish shallows choked with rotting eel-grass. Uncanny Innsmouth Perch lurk in the gloom.',
        tier: 1
      };
    } else if (dist < 2400) {
      return {
        zoneType: 'lake',
        speciesType: 'pike',
        name: 'The Foggy Banks (Sunken Sound)',
        description: 'Cold slate-grey waters shrouded in maritime mist. The vicious Blighted Pike patrols near sunken timbers.',
        tier: 2
      };
    } else if (dist < 3600) {
      return {
        zoneType: 'abyss',
        speciesType: 'gar',
        name: 'The Sunken Reefs (Devil’s Chasm)',
        description: 'A lightless abyss descending into sunken cyclopean ruins. The titanic Abyssal Void-Gar stirs below.',
        tier: 3
      };
    } else {
      return {
        zoneType: 'cave',
        speciesType: 'dagon',
        name: 'The Eldritch Trench (The Sunken Ruin of Dagon)',
        description: 'Cyclopean basalt ruins submerged in pitch black brine. The primordial monstrosity Apex Dagon slumbers here.',
        tier: 4
      };
    }
  }

  /**
   * Validates a candidate coordinate against all architectural constraints:
   * 1. Clamped within world boundary [200, 7800]
   * 2. Harbor exclusion zone (min 400px from (4000, 4000))
   * 3. Island colliders exclusion zone (collider radius + 100px)
   * 4. Minimum separation from other active whirlpools (350px)
   * 5. If isLocal, annular distance check [600, 1800] from boatPos
   */
  public isValidCandidate(x: number, y: number, isLocal: boolean = false, boatPos?: Vector2): boolean {
    // 1. World boundary check [200, 7800]
    if (x < 200 || x > 7800 || y < 200 || y > 7800) {
      return false;
    }

    // 2. Safe harbor exclusion zone (>= 400px from (4000, 4000))
    const distHarbor = Math.hypot(x - 4000, y - 4000);
    if (distHarbor < 400) {
      return false;
    }

    // 3. Island colliders exclusion zone (>= col.radius + 100px)
    for (const col of this.islandColliders) {
      const d = Math.hypot(x - col.x, y - col.y);
      if (d < col.radius + 100) {
        return false;
      }
    }

    // 4. Separation between concurrent active spots (>= 350px)
    for (const spot of this.whirlpools) {
      if (spot.isDead) continue;
      const d = Math.hypot(x - spot.position.x, y - spot.position.y);
      if (d < 350) {
        return false;
      }
    }

    // 5. Annular distance check from boatPos
    if (boatPos) {
      const distBoat = Math.hypot(x - boatPos.x, y - boatPos.y);
      if (isLocal) {
        if (distBoat < LOCAL_BIAS_INNER_RADIUS || distBoat > LOCAL_BIAS_OUTER_RADIUS) {
          return false;
        }
      } else {
        // Global candidate: if local quota already has >= 2 spots, avoid overcrowding local band
        if (distBoat >= LOCAL_BIAS_INNER_RADIUS && distBoat <= LOCAL_BIAS_OUTER_RADIUS) {
          if (this.getLocalWhirlpoolCount(boatPos) >= LOCAL_WHIRLPOOL_MIN) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Returns current count of non-dead whirlpools within local annular band [600, 1800] px of vessel.
   */
  public getLocalWhirlpoolCount(boatPos: Vector2): number {
    return this.whirlpools.filter(s => {
      if (s.isDead) return false;
      const d = s.position.distanceTo(boatPos);
      return d >= LOCAL_BIAS_INNER_RADIUS && d <= LOCAL_BIAS_OUTER_RADIUS;
    }).length;
  }

  /**
   * Spawns a candidate using rejection sampling (up to 35 attempts).
   */
  public spawnCandidate(isLocal: boolean, boatPos: Vector2, initialState: 'SPAWNING' | 'ACTIVE' = 'SPAWNING'): FishingSpot | null {
    const maxAttempts = 35;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let candX: number;
      let candY: number;

      if (isLocal) {
        // Annular band [600, 1800] around vessel
        const r = LOCAL_BIAS_INNER_RADIUS + Math.random() * (LOCAL_BIAS_OUTER_RADIUS - LOCAL_BIAS_INNER_RADIUS);
        
        // If near boundary, bias angle toward center (4000, 4000)
        let angle: number;
        const distFromCenter = Math.hypot(boatPos.x - 4000, boatPos.y - 4000);
        if (distFromCenter > 2500) {
          const centerAngle = Math.atan2(4000 - boatPos.y, 4000 - boatPos.x);
          angle = centerAngle + (Math.random() - 0.5) * Math.PI;
        } else {
          angle = Math.random() * Math.PI * 2;
        }

        candX = boatPos.x + Math.cos(angle) * r;
        candY = boatPos.y + Math.sin(angle) * r;
      } else {
        // Global candidate: if local quota is satisfied, spawn in deeper zones
        const localFull = this.getLocalWhirlpoolCount(boatPos) >= LOCAL_WHIRLPOOL_MIN;
        const zoneDists = localFull
          ? [2000 + Math.random() * 350, 2600 + Math.random() * 800, 3800 + Math.random() * 1000]
          : [800 + Math.random() * 350, 1400 + Math.random() * 800, 2600 + Math.random() * 800, 3800 + Math.random() * 1000];
        const targetDist = zoneDists[Math.floor(Math.random() * zoneDists.length)];
        const angle = Math.random() * Math.PI * 2;

        candX = 4000 + Math.cos(angle) * targetDist;
        candY = 4000 + Math.sin(angle) * targetDist;
      }

      if (this.isValidCandidate(candX, candY, isLocal, boatPos)) {
        const profile = WhirlpoolSpawner.getEncounterProfileForPosition(new Vector2(candX, candY));
        const spot = new FishingSpot({
          id: `whirlpool_${this.nextSpotId++}`,
          name: profile.name,
          position: new Vector2(candX, candY),
          zoneType: profile.zoneType,
          speciesType: profile.speciesType,
          description: profile.description,
          interactionRadius: PROXIMITY_LOCK_RADIUS,
          initialState: initialState
        });
        return spot;
      }
    }

    return null;
  }

  /**
   * Initializes initial whirlpool population across concentric zones and local vessel vicinity.
   */
  private initWhirlpools(boatPos: Vector2): void {
    this.whirlpools = [];

    // 1. Spawn 2 local spots in annular band [600, 1800]
    for (let i = 0; i < LOCAL_WHIRLPOOL_MIN; i++) {
      const spot = this.spawnCandidate(true, boatPos, 'ACTIVE');
      if (spot) {
        // Randomize initial timer for natural variation
        spot.timer = Math.random() * (spot.activeDuration * 0.4);
        this.whirlpools.push(spot);
      }
    }

    // 2. Spawn remaining global spots across outer radial zones
    const targetGlobalCount = 7;
    for (let i = 0; i < 20 && this.whirlpools.length < targetGlobalCount; i++) {
      const spot = this.spawnCandidate(false, boatPos, 'ACTIVE');
      if (spot) {
        spot.timer = Math.random() * (spot.activeDuration * 0.5);
        this.whirlpools.push(spot);
      }
    }

    // Ensure we meet minimum quota of 6
    while (this.whirlpools.length < GLOBAL_WHIRLPOOL_MIN) {
      const spot = this.spawnCandidate(false, boatPos, 'ACTIVE');
      if (spot) {
        this.whirlpools.push(spot);
      } else {
        break;
      }
    }
  }

  /**
   * Updates whirlpool lifecycles, enforces despawn locking, prunes dead spots, and replenishes quotas.
   */
  public update(dt: number, boatPos: Vector2, isFishing: boolean = false): void {
    if (dt <= 0) return;

    // 1. Update existing spots
    for (const spot of this.whirlpools) {
      if (isFishing && (spot.isPlayerNearby || spot.isFishingLocked)) {
        spot.isFishingLocked = true;
      }
      spot.update(dt, boatPos);
    }

    // 2. Prune dead whirlpools
    this.whirlpools = this.whirlpools.filter(s => !s.isDead);

    // 3. Count non-dead spots
    const totalActive = this.whirlpools.length;
    const localActive = this.whirlpools.filter(s => {
      const d = s.position.distanceTo(boatPos);
      return d >= LOCAL_BIAS_INNER_RADIUS && d <= LOCAL_BIAS_OUTER_RADIUS;
    }).length;

    // 4. Replenish local bias quota (maintain 2-3 in [600, 1800])
    if (localActive < LOCAL_WHIRLPOOL_MIN && totalActive < GLOBAL_WHIRLPOOL_MAX) {
      const needed = Math.min(LOCAL_WHIRLPOOL_MIN - localActive, GLOBAL_WHIRLPOOL_MAX - totalActive);
      for (let i = 0; i < needed; i++) {
        const spot = this.spawnCandidate(true, boatPos, 'SPAWNING');
        if (spot) {
          this.whirlpools.push(spot);
        }
      }
    }

    // 5. Replenish global quota (maintain 6-8 globally)
    while (this.whirlpools.length < GLOBAL_WHIRLPOOL_MIN) {
      const spot = this.spawnCandidate(false, boatPos, 'SPAWNING');
      if (spot) {
        this.whirlpools.push(spot);
      } else {
        break;
      }
    }
  }

  /**
   * Returns all active, non-dead whirlpools.
   */
  public getActiveWhirlpools(): FishingSpot[] {
    return this.whirlpools.filter(s => !s.isDead);
  }

  /**
   * Returns the whirlpool within interaction radius of the boat, or null.
   */
  public getNearbySpot(boatPos: Vector2): FishingSpot | null {
    for (const spot of this.whirlpools) {
      if (!spot.isDead) {
        const d = spot.position.distanceTo(boatPos);
        if (d <= spot.interactionRadius || spot.isPlayerNearby) {
          return spot;
        }
      }
    }
    return null;
  }

  /**
   * Post-Fishing Victory: triggers immediate despawn transition for the completed whirlpool.
   * Gracefully ignores non-existent or already despawning spots.
   */
  public onFishingVictory(completedSpotId: string): void {
    const spot = this.whirlpools.find(s => s.id === completedSpotId);
    if (spot) {
      spot.triggerDespawn();
    }
  }
}
