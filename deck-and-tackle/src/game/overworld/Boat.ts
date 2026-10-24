import { Vector2 } from '../../engine/Vector2';
import { Input } from '../../engine/Input';
import { BoatVisualSocket } from '../sockets/BoatVisualSocket';

export interface WakeParticle {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export class Boat {
  public position: Vector2;
  public velocity: Vector2 = new Vector2(0, 0);
  public heading: number = 0; // In radians (0 = pointing +X / East)
  public angularVelocity: number = 0;

  // Hydrodynamic parameters (tuned for smooth, controlled nautical exploration)
  public forwardThrust: number = 145; // Acceleration forward (comfortably paced)
  public reverseThrust: number = 75; // Acceleration reverse
  public maxSpeed: number = 125; // Controlled cruising speed (slowed down as requested)
  public maxReverseSpeed: number = 45;
  public turnSpeed: number = 2.5; // Radians per sec
  public linearDrag: number = 0.90; // Forward glide drag
  public lateralDrag: number = 4.8; // Transverse drag prevents excessive sliding
  public angularDrag: number = 5.2; // Angular damping

  // Collision
  public radius: number = 18;

  // Decoupled Visual Socket
  public visualSocket: BoatVisualSocket;

  // Wake particle trail
  private wakeParticles: WakeParticle[] = [];
  private wakeEmitTimer: number = 0;

  // Freeze state for transitions or modals
  public isFrozen: boolean = false;

  public getLanternPosition(): Vector2 {
    const bowOffset = Vector2.fromAngle(this.heading, 24);
    return this.position.clone().add(bowOffset);
  }

  constructor(startX: number, startY: number, startHeading: number = 0) {
    this.position = new Vector2(startX, startY);
    this.heading = startHeading;
    this.visualSocket = new BoatVisualSocket();
  }

  public update(dt: number): void {
    // Always update existing wake particles
    this.updateWakeParticles(dt);

    if (this.isFrozen) {
      // Gently coast down to stop when frozen
      this.velocity.multiply(Math.max(0, 1 - 4 * dt));
      this.angularVelocity *= Math.max(0, 1 - 5 * dt);
      return;
    }

    // 1. Gather player inputs
    let throttleInput = 0; // +1 forward, -1 reverse
    let steerInput = 0;    // -1 port (left), +1 starboard (right)

    if (Input.isDown('KeyW') || Input.isDown('ArrowUp')) {
      throttleInput += 1;
    }
    if (Input.isDown('KeyS') || Input.isDown('ArrowDown')) {
      throttleInput -= 1;
    }
    if (Input.isDown('KeyA') || Input.isDown('ArrowLeft')) {
      steerInput -= 1;
    }
    if (Input.isDown('KeyD') || Input.isDown('ArrowRight')) {
      steerInput += 1;
    }

    // 2. Heading & Angular Velocity (Rudder)
    // Steering authority is higher when moving, but a small base turning exists via propeller wash
    const currentSpeed = this.velocity.magnitude();
    const speedRatio = Math.min(1.0, currentSpeed / this.maxSpeed);
    const forwardDir = Vector2.fromAngle(this.heading);
    const forwardSpeed = this.velocity.dot(forwardDir);
    const isMovingForward = forwardSpeed >= -5;

    // Invert steering when reversing realistically
    const steerDir = isMovingForward ? steerInput : -steerInput;
    const rudderAuthority = 0.4 + 0.6 * speedRatio;

    if (steerInput !== 0) {
      this.angularVelocity += steerDir * this.turnSpeed * rudderAuthority * dt * 8;
    }
    // Angular Drag
    this.angularVelocity -= this.angularVelocity * this.angularDrag * dt;
    this.heading += this.angularVelocity * dt;

    // Keep heading in [-PI, PI]
    while (this.heading > Math.PI) this.heading -= Math.PI * 2;
    while (this.heading < -Math.PI) this.heading += Math.PI * 2;

    // Recompute forward and right directions after steering
    const newForward = Vector2.fromAngle(this.heading);
    const newRight = new Vector2(-newForward.y, newForward.x);

    // 3. Throttle & Thrust
    if (throttleInput > 0) {
      this.velocity.add(newForward.clone().multiply(this.forwardThrust * dt));
    } else if (throttleInput < 0) {
      this.velocity.add(newForward.clone().multiply(-this.reverseThrust * dt));
    }

    // 4. Hydrodynamic Drag & Drift Decomposition
    // Project velocity into forward and lateral components
    const vForward = this.velocity.dot(newForward);
    const vLateral = this.velocity.dot(newRight);

    // Apply linear drag to forward speed and stronger drag to lateral speed (creating realistic boat drift)
    const dampForward = Math.max(0, 1 - this.linearDrag * dt);
    const dampLateral = Math.max(0, 1 - this.lateralDrag * dt);

    const newVForward = vForward * dampForward;
    const newVLateral = vLateral * dampLateral;

    // Clamp speed limits
    const clampedVForward = Math.max(-this.maxReverseSpeed, Math.min(this.maxSpeed, newVForward));

    // Recombine velocity vector
    this.velocity = newForward.clone().multiply(clampedVForward)
      .add(newRight.clone().multiply(newVLateral));

    // Apply position integration
    this.position.add(this.velocity.clone().multiply(dt));

    // 5. Emit Wake Particles from stern motor
    if (currentSpeed > 10 || throttleInput !== 0) {
      this.wakeEmitTimer += dt;
      const emitInterval = Math.max(0.04, 0.15 - speedRatio * 0.1);
      if (this.wakeEmitTimer >= emitInterval) {
        this.wakeEmitTimer = 0;
        this.emitWakeParticle();
      }
    }
  }

  private emitWakeParticle(): void {
    // Stern motor position behind boat
    const sternOffset = Vector2.fromAngle(this.heading, -24);
    const pPos = this.position.clone().add(sternOffset);

    // Slight lateral dispersion
    const right = new Vector2(-Math.sin(this.heading), Math.cos(this.heading));
    const spread = (Math.random() - 0.5) * 8;
    pPos.add(right.clone().multiply(spread));

    // Wake particle drifts backward slowly and expands
    const pVel = this.velocity.clone().multiply(-0.15);
    pVel.add(right.clone().multiply((Math.random() - 0.5) * 12));

    this.wakeParticles.push({
      position: pPos,
      velocity: pVel,
      radius: 3 + Math.random() * 2,
      maxRadius: 10 + Math.random() * 8,
      life: 0,
      maxLife: 1.2 + Math.random() * 0.6,
      alpha: 0.6
    });
  }

  private updateWakeParticles(dt: number): void {
    for (let i = this.wakeParticles.length - 1; i >= 0; i--) {
      const p = this.wakeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.wakeParticles.splice(i, 1);
        continue;
      }
      p.position.add(p.velocity.clone().multiply(dt));
      const progress = p.life / p.maxLife;
      p.radius = 3 + (p.maxRadius - 3) * progress;
      p.alpha = 0.6 * (1 - progress);
    }
  }

  public renderWake(ctx: CanvasRenderingContext2D): void {
    if (this.wakeParticles.length === 0) return;

    ctx.save();
    for (const p of this.wakeParticles) {
      // Churning dark agitated water disturbance
      ctx.fillStyle = `rgba(6, 16, 26, ${p.alpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Pale grey-green frothy foam ring
      ctx.strokeStyle = `rgba(167, 243, 208, ${p.alpha * 0.65})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const currentSpeed = this.velocity.magnitude();
    const speedRatio = Math.min(1.0, currentSpeed / this.maxSpeed);
    const forwardDir = Vector2.fromAngle(this.heading);
    const isReversing = this.velocity.dot(forwardDir) < -2;

    // Render boat via decoupled visual socket
    this.visualSocket.render(ctx, {
      position: this.position,
      rotation: this.heading
    }, {
      speedRatio,
      isReversing,
      throttle: currentSpeed
    });
  }
}
