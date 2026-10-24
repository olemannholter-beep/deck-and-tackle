import { Vector2 } from './Vector2';

export interface VisualTransform {
  position: Vector2;
  rotation: number;
  scale?: Vector2;
  alpha?: number;
}

export interface SpriteFrame {
  image: CanvasImageSource;
  sx?: number;
  sy?: number;
  sw?: number;
  sh?: number;
  pivotX?: number; // 0 to 1, default 0.5
  pivotY?: number; // 0 to 1, default 0.5
}

/**
 * Base Decoupled Visual Socket.
 * Allows entities (Boats, Fish, Water Ripples, Docks, Cards) to render clean
 * placeholder vector graphics OR swap in high-res sprites without touching
 * any underlying physics or game logic.
 */
export abstract class VisualSocket<TData = void> {
  public id: string;
  public offset: Vector2 = new Vector2(0, 0);
  public scale: Vector2 = new Vector2(1, 1);
  public rotationOffset: number = 0;
  public alpha: number = 1.0;
  public visible: boolean = true;

  // Optional custom high-res sprite attached to this socket
  protected customSprite: SpriteFrame | null = null;

  // Child sockets attached to this socket (e.g. Rod Socket on Boat, Wake Emitter Socket on Motor)
  protected childSockets: Map<string, VisualSocket<any>> = new Map();

  constructor(id: string) {
    this.id = id;
  }

  /**
   * Attach a high-resolution sprite or texture to replace placeholder vector rendering.
   */
  public setCustomSprite(sprite: SpriteFrame | null): void {
    this.customSprite = sprite;
  }

  public getCustomSprite(): SpriteFrame | null {
    return this.customSprite;
  }

  /**
   * Register a child visual socket attached to a local relative point.
   */
  public attachChild(name: string, child: VisualSocket<any>): void {
    this.childSockets.set(name, child);
  }

  public getChild<T extends VisualSocket<any>>(name: string): T | undefined {
    return this.childSockets.get(name) as T | undefined;
  }

  /**
   * Master render method: transforms coordinate space and delegates to either
   * custom sprite or clean placeholder vector shape.
   */
  public render(ctx: CanvasRenderingContext2D, transform: VisualTransform, data: TData): void {
    if (!this.visible || this.alpha <= 0.001) return;

    ctx.save();
    ctx.translate(transform.position.x + this.offset.x, transform.position.y + this.offset.y);
    ctx.rotate(transform.rotation + this.rotationOffset);
    const sx = (transform.scale ? transform.scale.x : 1) * this.scale.x;
    const sy = (transform.scale ? transform.scale.y : 1) * this.scale.y;
    ctx.scale(sx, sy);
    ctx.globalAlpha *= this.alpha * (transform.alpha !== undefined ? transform.alpha : 1.0);

    if (this.customSprite && this.customSprite.image) {
      this.renderCustomSprite(ctx, this.customSprite);
    } else {
      this.renderPlaceholder(ctx, data);
    }

    // Render any attached child sockets in local space
    for (const child of this.childSockets.values()) {
      child.render(ctx, { position: new Vector2(0, 0), rotation: 0 }, data);
    }

    ctx.restore();
  }

  protected renderCustomSprite(ctx: CanvasRenderingContext2D, sprite: SpriteFrame): void {
    const sw = sprite.sw ?? (sprite.image as HTMLImageElement).width ?? 64;
    const sh = sprite.sh ?? (sprite.image as HTMLImageElement).height ?? 64;
    const sx = sprite.sx ?? 0;
    const sy = sprite.sy ?? 0;
    const px = sprite.pivotX ?? 0.5;
    const py = sprite.pivotY ?? 0.5;

    ctx.drawImage(
      sprite.image,
      sx, sy, sw, sh,
      -sw * px, -sh * py, sw, sh
    );
  }

  /**
   * Implemented by specific socket types to render crisp, polished vector placeholders.
   */
  protected abstract renderPlaceholder(ctx: CanvasRenderingContext2D, data: TData): void;
}
