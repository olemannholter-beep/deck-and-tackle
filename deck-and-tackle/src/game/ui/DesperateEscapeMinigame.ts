import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';

export type ObstacleType = 'rock_spike' | 'waterlogged_wreck' | 'tentacle_snare';

export interface EscapeObstacle {
  id: string;
  type: ObstacleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
  rotSpeed: number;
}

export interface EscapeMinigameCallbacks {
  onSuccess?: () => void;
  onFail?: () => void;
}

export const ESCAPE_DURATION = 10.0;
export const NORMAL_TURN_RATE = 2.5; // rad/s
export const DAMAGED_TURN_RATE = 1.5; // rad/s (2.5 * 0.6)
export const ESCAPE_SURVIVAL_LIMP_HP = 20;

export const OBSTACLE_RADII: Record<ObstacleType, number> = {
  rock_spike: 25,
  waterlogged_wreck: 35,
  tentacle_snare: 30
};

/**
 * Pure Canvas 2D interactive 10-second survival obstacle course minigame.
 * Triggered when Vessel Hull reaches 0 HP and the player has 0 gold.
 * Surviving limps the battered vessel to harbor with 20 HP. Crashing transitions to Game Over.
 */
export class DesperateEscapeMinigame {
  public timer: number = ESCAPE_DURATION;
  public readonly duration: number = ESCAPE_DURATION;
  public isRunning: boolean = false;
  public isFinished: boolean = false;
  public result: 'running' | 'success' | 'failure' = 'running';

  public normalTurnRate: number = NORMAL_TURN_RATE;
  public damagedTurnRate: number = DAMAGED_TURN_RATE;

  public vessel = {
    x: 640,
    y: 520,
    heading: -Math.PI / 2, // Pointing upwards
    speed: 170,
    radius: 18,
    turnRate: DAMAGED_TURN_RATE
  };

  public obstacles: EscapeObstacle[] = [];
  public onSuccessCallback: (() => void) | null = null;
  public onFailCallback: (() => void) | null = null;

  private spawnCooldown: number = 0;
  private time: number = 0;
  private lightningTimer: number = 0;
  private lightningAlpha: number = 0;
  private smokeParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }> = [];
  private rainDrops: Array<{ x: number; y: number; speed: number; len: number }> = [];

  constructor(
    onSuccessOrCallback?: (() => void) | EscapeMinigameCallbacks,
    onFail?: () => void
  ) {
    if (typeof onSuccessOrCallback === 'function') {
      this.onSuccessCallback = onSuccessOrCallback;
      this.onFailCallback = onFail ?? null;
    } else if (onSuccessOrCallback && typeof onSuccessOrCallback === 'object') {
      this.onSuccessCallback = onSuccessOrCallback.onSuccess ?? null;
      this.onFailCallback = onSuccessOrCallback.onFail ?? null;
    }

    // Pre-populate rain drops
    for (let i = 0; i < 70; i++) {
      this.rainDrops.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        speed: 550 + Math.random() * 250,
        len: 14 + Math.random() * 16
      });
    }

    this.reset();
  }

  public reset(width: number = 1280, height: number = 720): void {
    this.timer = ESCAPE_DURATION;
    this.isRunning = false;
    this.isFinished = false;
    this.result = 'running';
    this.obstacles = [];
    this.smokeParticles = [];
    this.spawnCooldown = 0.4;
    this.time = 0;
    this.lightningTimer = 2.5;
    this.lightningAlpha = 0;

    this.vessel.x = width / 2;
    this.vessel.y = height * 0.75;
    this.vessel.heading = -Math.PI / 2;
    this.vessel.turnRate = this.damagedTurnRate;

    // Seed 2 initial obstacles drifting in the distance
    this.spawnObstacle(width, height, 'rock_spike', width * 0.35, -20);
    this.spawnObstacle(width, height, 'waterlogged_wreck', width * 0.65, -120);
  }

  public start(width: number = 1280, height: number = 720): void {
    this.reset(width, height);
    this.isRunning = true;
    try {
      AudioManager.getInstance().playLineWarning();
    } catch {
      // Audio fallback in tests/headless
    }
  }

  public spawnObstacle(
    width: number,
    _height?: number,
    forceType?: ObstacleType,
    forceX?: number,
    forceY?: number
  ): EscapeObstacle {
    const types: ObstacleType[] = ['rock_spike', 'waterlogged_wreck', 'tentacle_snare'];
    const chosenType = forceType ?? types[Math.floor(Math.random() * types.length)];
    const radius = OBSTACLE_RADII[chosenType];

    const margin = radius + 40;
    const spawnX = forceX ?? (margin + Math.random() * (width - margin * 2));
    const spawnY = forceY ?? (-radius - 20);

    const baseSpeed = 160 + (ESCAPE_DURATION - this.timer) * 8; // Speeds up slightly as storm intensifies
    const vy = baseSpeed + (Math.random() - 0.5) * 30;
    const vx = (Math.random() - 0.5) * 45;

    const obstacle: EscapeObstacle = {
      id: `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: chosenType,
      x: spawnX,
      y: spawnY,
      vx,
      vy,
      radius,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.2
    };

    this.obstacles.push(obstacle);
    return obstacle;
  }

  public checkCollision(
    vessel: { x: number; y: number; radius: number },
    obstacle: EscapeObstacle
  ): boolean {
    const dx = vessel.x - obstacle.x;
    const dy = vessel.y - obstacle.y;
    const distSq = dx * dx + dy * dy;
    const hitRadius = vessel.radius + obstacle.radius;
    return distSq < hitRadius * hitRadius;
  }

  public update(dt: number, width: number = 1280, height: number = 720): void {
    if (!this.isRunning || this.isFinished) return;

    this.time += dt;

    // 1. Decrement Countdown Clock Monotonically
    const prevTimer = this.timer;
    this.timer = Math.max(0, this.timer - dt);

    // Periodic urgency sound every second when low
    if (Math.floor(prevTimer) !== Math.floor(this.timer) && this.timer <= 4 && this.timer > 0) {
      try {
        AudioManager.getInstance().playLineWarning();
      } catch {
        // Safe audio
      }
    }

    // 2. Handle Damaged Sluggish Steering
    let steerDir = 0;
    if (Input.isDown('keya') || Input.isDown('arrowleft')) {
      steerDir -= 1;
    }
    if (Input.isDown('keyd') || Input.isDown('arrowright')) {
      steerDir += 1;
    }

    this.vessel.heading += steerDir * this.vessel.turnRate * dt;

    // Constrain heading to keep vessel heading upwards into the storm
    const minHeading = -Math.PI * 0.82; // ~-147 deg
    const maxHeading = -Math.PI * 0.18; // ~-32 deg
    if (this.vessel.heading < minHeading) this.vessel.heading = minHeading;
    if (this.vessel.heading > maxHeading) this.vessel.heading = maxHeading;

    // Lateral and vertical vessel physics
    const forwardX = Math.cos(this.vessel.heading) * this.vessel.speed;
    const forwardY = Math.sin(this.vessel.heading) * this.vessel.speed + 70; // Opposing current drift

    this.vessel.x += forwardX * dt;
    this.vessel.y += forwardY * dt;

    // Clamp vessel position to canvas margins
    const pad = this.vessel.radius + 20;
    if (this.vessel.x < pad) this.vessel.x = pad;
    if (this.vessel.x > width - pad) this.vessel.x = width - pad;
    if (this.vessel.y < height * 0.25) this.vessel.y = height * 0.25;
    if (this.vessel.y > height - 50) this.vessel.y = height - 50;

    // 3. Smoke Particles from Damaged Engine
    if (Math.random() < 0.6) {
      this.smokeParticles.push({
        x: this.vessel.x - Math.cos(this.vessel.heading) * 16 + (Math.random() - 0.5) * 6,
        y: this.vessel.y - Math.sin(this.vessel.heading) * 16 + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20,
        vy: 40 + Math.random() * 30,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        size: 5 + Math.random() * 7
      });
    }

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 8;
      if (p.life >= p.maxLife) {
        this.smokeParticles.splice(i, 1);
      }
    }

    // 4. Update Rain
    for (const r of this.rainDrops) {
      r.y += r.speed * dt;
      r.x += (r.speed * 0.15) * dt;
      if (r.y > height) {
        r.y = -20;
        r.x = Math.random() * (width + 200) - 100;
      }
    }

    // 5. Lightning Timer & Flashes
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this.lightningAlpha = 0.55;
      this.lightningTimer = 3.0 + Math.random() * 4.0;
    }
    if (this.lightningAlpha > 0) {
      this.lightningAlpha = Math.max(0, this.lightningAlpha - dt * 2.2);
    }

    // 6. Spawn Obstacles dynamically
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnObstacle(width, height);
      this.spawnCooldown = 0.75 + Math.random() * 0.45;
    }

    // 7. Update Obstacles and Check Collision
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x += obs.vx * dt;
      obs.y += obs.vy * dt;
      obs.rotation += obs.rotSpeed * dt;

      // Check collision
      if (this.checkCollision(this.vessel, obs)) {
        this.triggerFailure();
        return;
      }

      // Despawn off bottom
      if (obs.y > height + obs.radius + 40) {
        this.obstacles.splice(i, 1);
      }
    }

    // 8. Check 10s Survival Victory
    if (this.timer <= 0) {
      this.triggerSuccess();
    }
  }

  public triggerFailure(): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.isRunning = false;
    this.result = 'failure';

    try {
      AudioManager.getInstance().playLineSnap();
      AudioManager.getInstance().playDockBump();
    } catch {
      // Audio fallback
    }

    if (this.onFailCallback) {
      this.onFailCallback();
    }
  }

  public triggerSuccess(): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.isRunning = false;
    this.result = 'success';

    try {
      AudioManager.getInstance().playCatchVictory();
    } catch {
      // Audio fallback
    }

    if (this.onSuccessCallback) {
      this.onSuccessCallback();
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Churning Stormy Sea Background
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#020617'); // Abyssal midnight
    oceanGrad.addColorStop(0.5, '#082f49'); // Churning deep teal
    oceanGrad.addColorStop(1, '#030712'); // Dark trough
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Churning Wave Currents rushing down
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1.5;
    const waveOffset = (this.time * 220) % 80;
    for (let y = -80 + waveOffset; y < height + 80; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 120) {
        if (typeof (ctx as any).quadraticCurveTo === 'function') {
          ctx.quadraticCurveTo(x + 60, y + Math.sin((x + this.time * 100) * 0.02) * 14, x + 120, y);
        } else {
          ctx.lineTo(x + 120, y);
        }
      }
      ctx.stroke();
    }

    // 3. Lightning Flash Pass
    if (this.lightningAlpha > 0) {
      ctx.fillStyle = `rgba(224, 242, 254, ${this.lightningAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }

    // 4. Render Drifting Obstacles
    for (const obs of this.obstacles) {
      this.renderObstacle(ctx, obs);
    }

    // 5. Smoke Particles from Vessel Engine
    for (const p of this.smokeParticles) {
      const alpha = Math.max(0, 1 - (p.life / p.maxLife)) * 0.6;
      ctx.fillStyle = `rgba(30, 41, 59, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Glowing ember spark in center
      if (Math.random() < 0.25) {
        ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 1.5})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Render Damaged Player Vessel
    this.renderDamagedVessel(ctx);

    // 7. Rain Streaks Over Scene
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const r of this.rainDrops) {
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.len * 0.25, r.y + r.len);
    }
    ctx.stroke();

    // 8. Dark Vignette Edge Framing
    const vigGrad = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.35,
      width / 2, height / 2, Math.max(width, height) * 0.75
    );
    vigGrad.addColorStop(0, 'transparent');
    vigGrad.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, width, height);

    // 9. Countdown Timer & Survival Header Banner
    this.renderHeaderBanner(ctx, width);

    // 10. Bottom Controls Guidance
    this.renderControlsFooter(ctx, width, height);

    ctx.restore();
  }

  private renderObstacle(ctx: CanvasRenderingContext2D, obs: EscapeObstacle): void {
    ctx.save();
    ctx.translate(obs.x, obs.y);
    ctx.rotate(obs.rotation);

    if (obs.type === 'rock_spike') {
      // 1. Rock Spike: Jagged Obsidian Spire
      // Foam ring around base
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius + 5, 0, Math.PI * 2);
      ctx.stroke();

      // Jagged basalt rock body
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -obs.radius);
      ctx.lineTo(obs.radius * 0.8, -obs.radius * 0.3);
      ctx.lineTo(obs.radius, obs.radius * 0.7);
      ctx.lineTo(obs.radius * 0.2, obs.radius);
      ctx.lineTo(-obs.radius * 0.7, obs.radius * 0.8);
      ctx.lineTo(-obs.radius, -obs.radius * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sharp crag ridges & razor highlight
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -obs.radius);
      ctx.lineTo(obs.radius * 0.2, obs.radius * 0.4);
      ctx.moveTo(0, -obs.radius);
      ctx.lineTo(-obs.radius * 0.4, obs.radius * 0.3);
      ctx.stroke();
    } else if (obs.type === 'waterlogged_wreck') {
      // 2. Waterlogged Wreck: Rotting Shipwreck Timbers & Broken Ribs
      ctx.fillStyle = '#291e14';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.2;

      // Shattered keel plate
      ctx.beginPath();
      ctx.ellipse(0, 0, obs.radius, obs.radius * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Broken wooden ribs jutting out
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const rx = i * (obs.radius * 0.35);
        ctx.beginPath();
        ctx.moveTo(rx, -obs.radius * 0.6);
        ctx.lineTo(rx + 4, obs.radius * 0.6);
        ctx.stroke();
      }

      // Barnacles / rotting green moss
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(-obs.radius * 0.4, -obs.radius * 0.1, 4, 0, Math.PI * 2);
      ctx.arc(obs.radius * 0.3, obs.radius * 0.2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 3. Tentacle Snare: Writhing Eldritch Cephalopod Limb
      ctx.fillStyle = '#3b0764'; // Deep dark purple
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(0, 0, obs.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Curled barbed tip
      ctx.beginPath();
      ctx.moveTo(-obs.radius * 0.5, obs.radius * 0.6);
      if (typeof (ctx as any).bezierCurveTo === 'function') {
        (ctx as any).bezierCurveTo(
          obs.radius * 0.6, obs.radius * 0.8,
          obs.radius * 0.8, -obs.radius * 0.5,
          obs.radius * 0.2, -obs.radius
        );
      } else {
        ctx.lineTo(obs.radius * 0.2, -obs.radius);
      }
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Glowing bioluminescent suction cups
      ctx.fillStyle = '#ec4899';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 2.5) {
        const sx = Math.cos(a) * (obs.radius * 0.55);
        const sy = Math.sin(a) * (obs.radius * 0.55);
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderDamagedVessel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.vessel.x, this.vessel.y);
    ctx.rotate(this.vessel.heading + Math.PI / 2); // Orient so +Y is vessel front

    // Stern foam wake
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 16);
    ctx.lineTo(-18, 32);
    ctx.moveTo(10, 16);
    ctx.lineTo(18, 32);
    ctx.stroke();

    // Vessel Hull: Battered Innsmouth Skiff
    ctx.fillStyle = '#451a03'; // Dark oak timber
    ctx.strokeStyle = '#ef4444'; // Red crack indicators of critical failure
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, -22); // Bow
    ctx.lineTo(14, 0);
    ctx.lineTo(11, 20); // Starboard stern
    ctx.lineTo(-11, 20); // Port stern
    ctx.lineTo(-14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gunwales and deck planking
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(9, 0);
    ctx.lineTo(8, 16);
    ctx.lineTo(-8, 16);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();

    // Scorched fractured hull cracks
    ctx.strokeStyle = '#f97316'; // Glowing orange breach
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(2, 8);
    ctx.lineTo(-3, 14);
    ctx.stroke();

    // Stern lantern / smoky engine hatch
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, 8, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Collision warning ring (subtle)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, this.vessel.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  private renderHeaderBanner(ctx: CanvasRenderingContext2D, width: number): void {
    const bannerW = Math.min(640, width - 40);
    const bannerH = 76;
    const bannerX = Math.floor((width - bannerW) / 2);
    const bannerY = 22;

    const isUrgent = this.timer <= 3.0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * (isUrgent ? 14 : 6));

    // Dark parchment/iron plate
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = isUrgent
      ? `rgba(239, 68, 68, ${0.7 + pulse * 0.3})`
      : '#eab308';
    ctx.lineWidth = isUrgent ? 2.5 : 1.8;

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    } else {
      ctx.rect(bannerX, bannerY, bannerW, bannerH);
    }
    ctx.fill();
    ctx.stroke();

    // Urgency glow banner text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 13px "Cinzel", "Georgia", serif';
    ctx.fillStyle = isUrgent ? '#f87171' : '#fde047';
    ctx.fillText(
      isUrgent ? '⚡ DESPERATE ESCAPE • REEF OF CRAGS (CLOSING FAST!) ⚡' : '⚡ DESPERATE ESCAPE • SURVIVE THE BLACK CRAGS ⚡',
      bannerX + bannerW / 2,
      bannerY + 22
    );

    // Large Countdown Timer
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = isUrgent ? '#ef4444' : '#ffffff';
    ctx.fillText(`${this.timer.toFixed(1)}s REMAINING`, bannerX + bannerW / 2, bannerY + 48);

    // Progress bar beneath timer
    const barW = bannerW - 60;
    const barH = 6;
    const barX = bannerX + 30;
    const barY = bannerY + 56;
    const progress = Math.max(0, Math.min(1.0, this.timer / ESCAPE_DURATION));

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = isUrgent ? '#ef4444' : '#38bdf8';
    ctx.fillRect(barX, barY, Math.round(barW * progress), barH);
  }

  private renderControlsFooter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const footW = Math.min(540, width - 40);
    const footH = 32;
    const footX = Math.floor((width - footW) / 2);
    const footY = height - 44;

    ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(footX, footY, footW, footH, 6);
    } else {
      ctx.rect(footX, footY, footW, footH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      'STEER: [A / D] or [← / →] (Sluggish Rudder) • Avoid Crags, Wrecks & Tentacles!',
      footX + footW / 2,
      footY + footH / 2
    );
  }
}
