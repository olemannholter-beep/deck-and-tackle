import { Vector2 } from './Vector2';

export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class Camera {
  public position: Vector2 = new Vector2(0, 0);
  public target: Vector2 = new Vector2(0, 0);
  public zoom: number = 1.0;
  public targetZoom: number = 1.0;
  public smoothFactor: number = 5.0; // lerp speed
  public bounds: CameraBounds | null = null;

  public viewportWidth: number = 1280;
  public viewportHeight: number = 720;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public setBounds(bounds: CameraBounds): void {
    this.bounds = bounds;
  }

  public snapTo(pos: Vector2): void {
    this.target.copy(pos);
    this.position.copy(pos);
    this.clamp();
  }

  public update(dt: number): void {
    // Lerp position toward target
    const t = Math.min(1.0, this.smoothFactor * dt);
    this.position.x += (this.target.x - this.position.x) * t;
    this.position.y += (this.target.y - this.position.y) * t;

    // Lerp zoom
    this.zoom += (this.targetZoom - this.zoom) * t;

    this.clamp();
  }

  private clamp(): void {
    if (!this.bounds) return;

    const halfW = (this.viewportWidth / 2) / this.zoom;
    const halfH = (this.viewportHeight / 2) / this.zoom;

    // Clamp camera center so viewport stays inside bounds if possible
    if (this.bounds.maxX - this.bounds.minX > halfW * 2) {
      this.position.x = Math.max(this.bounds.minX + halfW, Math.min(this.bounds.maxX - halfW, this.position.x));
    } else {
      this.position.x = (this.bounds.minX + this.bounds.maxX) / 2;
    }

    if (this.bounds.maxY - this.bounds.minY > halfH * 2) {
      this.position.y = Math.max(this.bounds.minY + halfH, Math.min(this.bounds.maxY - halfH, this.position.y));
    } else {
      this.position.y = (this.bounds.minY + this.bounds.maxY) / 2;
    }
  }

  public applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    // Center of screen
    ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.position.x, -this.position.y);
  }

  public restoreTransform(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  public screenToWorld(screenPos: Vector2): Vector2 {
    const centeredX = screenPos.x - this.viewportWidth / 2;
    const centeredY = screenPos.y - this.viewportHeight / 2;
    const worldX = this.position.x + centeredX / this.zoom;
    const worldY = this.position.y + centeredY / this.zoom;
    return new Vector2(worldX, worldY);
  }

  public worldToScreen(worldPos: Vector2): Vector2 {
    const centeredX = (worldPos.x - this.position.x) * this.zoom;
    const centeredY = (worldPos.y - this.position.y) * this.zoom;
    return new Vector2(this.viewportWidth / 2 + centeredX, this.viewportHeight / 2 + centeredY);
  }
}
