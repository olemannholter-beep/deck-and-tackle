import { Vector2 } from '../../engine/Vector2';
import { DockVisualSocket } from '../sockets/DockVisualSocket';

export class HarborDock {
  public position: Vector2;
  public width: number = 130;
  public height: number = 44;
  public interactionRadius: number = 80;
  public isPlayerNearby: boolean = false;

  public visualSocket: DockVisualSocket;
  private time: number = 0;

  constructor(x: number, y: number) {
    this.position = new Vector2(x, y);
    this.visualSocket = new DockVisualSocket();
  }

  public update(dt: number, boatPosition: Vector2): void {
    this.time += dt;
    const dist = this.position.distanceTo(boatPosition);
    this.isPlayerNearby = dist <= this.interactionRadius;
  }

  /**
   * Collision check: prevents boat from sailing into the wooden pier structure.
   */
  public resolveCollision(boatPos: Vector2, boatRadius: number): Vector2 | null {
    const halfW = this.width / 2;
    const halfH = this.height / 2;

    const minX = this.position.x - halfW;
    const maxX = this.position.x + halfW;
    const minY = this.position.y - halfH;
    const maxY = this.position.y + halfH;

    // Closest point on pier AABB
    const clampX = Math.max(minX, Math.min(maxX, boatPos.x));
    const clampY = Math.max(minY, Math.min(maxY, boatPos.y));

    const dx = boatPos.x - clampX;
    const dy = boatPos.y - clampY;
    const distSq = dx * dx + dy * dy;

    if (distSq < boatRadius * boatRadius && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const overlap = boatRadius - dist;
      const normalX = dx / dist;
      const normalY = dy / dist;
      return new Vector2(boatPos.x + normalX * overlap, boatPos.y + normalY * overlap);
    }
    return null;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    this.visualSocket.render(ctx, {
      position: this.position,
      rotation: 0
    }, {
      time: this.time,
      isPlayerNearby: this.isPlayerNearby,
      dockWidth: this.width,
      dockHeight: this.height
    });
  }
}
