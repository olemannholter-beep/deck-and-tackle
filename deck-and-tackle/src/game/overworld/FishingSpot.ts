import { Vector2 } from '../../engine/Vector2';
import { FishingSpotVisualSocket } from '../sockets/FishingSpotVisualSocket';
import type { SpeciesType } from '../battle/FishData';

export type WaterZoneType = 'shallow' | 'lake' | 'abyss' | 'cave';
export type FishingSpotState = 'SPAWNING' | 'ACTIVE' | 'DESPAWNING';

export interface FishingSpotConfig {
  id: string;
  name: string;
  position: Vector2;
  zoneType: WaterZoneType;
  interactionRadius?: number;
  speciesType: SpeciesType;
  description: string;
  initialState?: FishingSpotState;
  spawnDuration?: number;
  activeDuration?: number;
  despawnDuration?: number;
}

export class FishingSpot {
  public id: string;
  public name: string;
  public position: Vector2;
  public zoneType: WaterZoneType;
  public speciesType: SpeciesType;
  public description: string;
  public interactionRadius: number = 120;
  public isPlayerNearby: boolean = false;

  // 3-Phase State Machine & Lifecycle
  public state: FishingSpotState = 'SPAWNING';
  public timer: number = 0;
  public spawnDuration: number = 2.5;
  public activeDuration: number = 45.0;
  public despawnDuration: number = 3.0;
  public isFishingLocked: boolean = false;
  public isDead: boolean = false;

  // Visual scaling and opacity
  public alpha: number = 0.0;
  public scale: number = 0.2;

  // Decoupled Visual Socket
  public visualSocket: FishingSpotVisualSocket;
  public animationTime: number = 0;

  constructor(config: FishingSpotConfig) {
    this.id = config.id;
    this.name = config.name;
    this.position = config.position;
    this.zoneType = config.zoneType;
    this.speciesType = config.speciesType;
    this.description = config.description;
    this.interactionRadius = config.interactionRadius ?? 120;
    this.state = config.initialState ?? 'SPAWNING';
    this.spawnDuration = config.spawnDuration ?? 2.5;
    this.activeDuration = config.activeDuration ?? (35.0 + Math.random() * 20.0);
    this.despawnDuration = config.despawnDuration ?? 3.0;
    this.timer = 0;
    this.isDead = false;
    this.isFishingLocked = false;
    this.isPlayerNearby = false;

    if (this.state === 'SPAWNING') {
      this.alpha = 0.0;
      this.scale = 0.2;
    } else if (this.state === 'ACTIVE') {
      this.alpha = 1.0;
      this.scale = 1.0;
    } else if (this.state === 'DESPAWNING') {
      this.alpha = 1.0;
      this.scale = 1.0;
    }

    this.visualSocket = new FishingSpotVisualSocket();
  }

  public update(dt: number, boatPosition: Vector2): void {
    if (this.isDead) return;

    this.animationTime += dt;
    const dist = this.position.distanceTo(boatPosition);
    this.isPlayerNearby = dist <= this.interactionRadius;

    switch (this.state) {
      case 'SPAWNING': {
        this.timer += dt;
        const progress = Math.min(1.0, Math.max(0.0, this.timer / this.spawnDuration));
        this.alpha = progress;
        this.scale = 0.2 + 0.8 * progress;

        if (this.timer >= this.spawnDuration) {
          this.state = 'ACTIVE';
          this.timer = 0;
          this.alpha = 1.0;
          this.scale = 1.0;
        }
        break;
      }

      case 'ACTIVE': {
        this.alpha = 1.0;
        this.scale = 1.0;

        // Despawn Proximity & Fishing Lock:
        // When isPlayerNearby is true OR isFishingLocked is true, the active duration timer is frozen
        const isLocked = this.isPlayerNearby || this.isFishingLocked;
        if (!isLocked) {
          this.timer += dt;
          if (this.timer >= this.activeDuration) {
            this.state = 'DESPAWNING';
            this.timer = 0;
          }
        }
        break;
      }

      case 'DESPAWNING': {
        this.timer += dt;
        const progress = Math.min(1.0, Math.max(0.0, this.timer / this.despawnDuration));
        this.alpha = Math.max(0.0, 1.0 - progress);
        this.scale = Math.max(0.0, 1.0 - progress);

        if (this.timer >= this.despawnDuration) {
          this.isDead = true;
          this.alpha = 0.0;
          this.scale = 0.0;
        }
        break;
      }
    }
  }

  /**
   * Post-Fishing Despawn: transitions spot directly to DESPAWNING with a fresh 3.0s timer.
   * Idempotent: does not reset or corrupt timer if already despawning.
   */
  public triggerDespawn(): void {
    if (this.state !== 'DESPAWNING') {
      this.state = 'DESPAWNING';
      this.timer = 0;
      this.isFishingLocked = false;
      this.alpha = 1.0;
      this.scale = 1.0;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (this.isDead || this.alpha <= 0.001 || this.scale <= 0.001) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.alpha));
    ctx.translate(this.position.x, this.position.y);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.position.x, -this.position.y);

    this.visualSocket.render(ctx, {
      position: this.position,
      rotation: 0
    }, {
      time: this.animationTime,
      isPlayerNearby: this.isPlayerNearby,
      zoneType: this.zoneType === 'cave' ? 'abyss' : this.zoneType,
      spotRadius: this.interactionRadius
    });

    ctx.restore();
  }
}
