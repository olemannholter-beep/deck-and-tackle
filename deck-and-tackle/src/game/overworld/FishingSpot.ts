import { Vector2 } from '../../engine/Vector2';
import { FishingSpotVisualSocket } from '../sockets/FishingSpotVisualSocket';
import type { SpeciesType } from '../battle/FishData';

export type WaterZoneType = 'shallow' | 'lake' | 'abyss' | 'cave';

export interface FishingSpotConfig {
  id: string;
  name: string;
  position: Vector2;
  zoneType: WaterZoneType;
  interactionRadius?: number;
  speciesType: SpeciesType;
  description: string;
}

export class FishingSpot {
  public id: string;
  public name: string;
  public position: Vector2;
  public zoneType: WaterZoneType;
  public speciesType: SpeciesType;
  public description: string;
  public interactionRadius: number = 65;
  public isPlayerNearby: boolean = false;

  // Decoupled Visual Socket
  public visualSocket: FishingSpotVisualSocket;
  private animationTime: number = 0;

  constructor(config: FishingSpotConfig) {
    this.id = config.id;
    this.name = config.name;
    this.position = config.position;
    this.zoneType = config.zoneType;
    this.speciesType = config.speciesType;
    this.description = config.description;
    this.interactionRadius = config.interactionRadius ?? 65;
    this.visualSocket = new FishingSpotVisualSocket();
  }

  public update(dt: number, boatPosition: Vector2): void {
    this.animationTime += dt;
    const dist = this.position.distanceTo(boatPosition);
    this.isPlayerNearby = dist <= this.interactionRadius;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.visualSocket.render(ctx, {
      position: this.position,
      rotation: 0
    }, {
      time: this.animationTime,
      isPlayerNearby: this.isPlayerNearby,
      zoneType: this.zoneType === 'cave' ? 'abyss' : this.zoneType,
      spotRadius: this.interactionRadius
    });
  }
}
