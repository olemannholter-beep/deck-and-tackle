export class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  public set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  public clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  public copy(other: Vector2): this {
    this.x = other.x;
    this.y = other.y;
    return this;
  }

  public add(other: Vector2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  public sub(other: Vector2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  public multiply(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  public magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  public magnitudeSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  public normalize(): this {
    const mag = this.magnitude();
    if (mag > 0.00001) {
      this.x /= mag;
      this.y /= mag;
    } else {
      this.x = 0;
      this.y = 0;
    }
    return this;
  }

  public dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  public distanceTo(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public distanceSqTo(other: Vector2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  public angle(): number {
    return Math.atan2(this.y, this.x);
  }

  public static fromAngle(angle: number, length: number = 1): Vector2 {
    return new Vector2(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  public static lerp(a: Vector2, b: Vector2, t: number): Vector2 {
    return new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }
}
