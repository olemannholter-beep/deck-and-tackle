/**
 * RoamingHostileManager.ts
 * Manages 4-6 overworld hostile entities (Patrol Vessels and Ambush Sea Beasts).
 * Implements Milestone 4 (ORIGINAL_REQUEST §R4, PROJECT.md Features 10, 11, 12).
 */

import { Camera } from '../../engine/Camera';
import { AudioManager } from '../../engine/AudioManager';
import { Vector2 } from '../../engine/Vector2';

declare module '../../engine/AudioManager' {
  interface AudioManager {
    playHornAlert(): void;
    playCreatureGroan(): void;
  }
}

// Ensure AudioManager has playHornAlert and playCreatureGroan methods
if (typeof (AudioManager.prototype as any).playHornAlert !== 'function') {
  (AudioManager.prototype as any).playHornAlert = function() {
    try {
      if (typeof this.play === 'function') {
        this.play('sfx_foghorn', 0.85);
      }
    } catch {
      // Headless AudioContext fallback
    }
  };
}
if (typeof (AudioManager.prototype as any).playCreatureGroan !== 'function') {
  (AudioManager.prototype as any).playCreatureGroan = function() {
    try {
      if (typeof this.play === 'function') {
        this.play('sfx_fish_deep_dive', 0.80);
      }
    } catch {
      // Headless AudioContext fallback
    }
  };
}

export type HostileCategory = 'vessel' | 'beast';
export type HostileAlertState = 'patrol' | 'alert' | 'pursuit' | 'submerged_lurk' | 'breach_charge';

export interface HostileTemplate {
  id: string;
  name: string;
  category: HostileCategory;
  zoneTier: 1 | 2 | 3 | 4;
  speed: number;
  maxHp: number;
  detectionRadius: number;
  audioCue: string;
  spriteAssetKey: string;
}

export const HOSTILE_CONE_ANGLE_RAD = Math.PI / 3.27; // ~55 degrees (0.9607 rad)
export const HOSTILE_CONE_DISTANCE = 400; // px
export const BEAST_GROAN_RADIUS = 350; // px
export const BEAST_BREACH_RADIUS = 150; // px
export const COMBAT_ENGAGE_RADIUS = 45; // px

export const HARBOR_CENTER_X = 4000;
export const HARBOR_CENTER_Y = 4000;
export const MAP_WIDTH = 8000;
export const MAP_HEIGHT = 8000;
export const HARBOR_SAFE_RADIUS = 1200;

export const AUTHORITATIVE_HOSTILE_ROSTER: Record<string, HostileTemplate> = {
  crazed_trawler: {
    id: 'hostile_vessel_crazed_trawler',
    name: 'Crazed Trawler',
    category: 'vessel',
    zoneTier: 1,
    speed: 95,
    maxHp: 80,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'boat_trawler_derelict.png'
  },
  ghost_skiff: {
    id: 'hostile_vessel_ghost_skiff',
    name: 'Ghost Skiff',
    category: 'vessel',
    zoneTier: 2,
    speed: 105,
    maxHp: 110,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'rowboat_fisherman_lantern.png'
  },
  galleon_raider: {
    id: 'hostile_vessel_galleon_raider',
    name: 'Galleon Raider',
    category: 'vessel',
    zoneTier: 3,
    speed: 115,
    maxHp: 160,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'shipwreck_abyssal_galleon.png'
  },
  cursed_black_frigate: {
    id: 'hostile_vessel_black_frigate',
    name: 'Cursed Black Frigate',
    category: 'vessel',
    zoneTier: 4,
    speed: 120,
    maxHp: 220,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'shipwreck_wooden_hull.png'
  },
  mutated_whale: {
    id: 'hostile_beast_mutated_whale',
    name: 'Mutated Whale',
    category: 'beast',
    zoneTier: 1,
    speed: 85,
    maxHp: 90,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'fish_visceral_gut_swollen.png'
  },
  kelp_leviathan: {
    id: 'hostile_beast_kelp_leviathan',
    name: 'Kelp Leviathan',
    category: 'beast',
    zoneTier: 2,
    speed: 110,
    maxHp: 130,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'fish_z2_tentacle_sculpin_sheet.png'
  },
  giant_sea_serpent: {
    id: 'hostile_beast_giant_serpent',
    name: 'Giant Sea Serpent',
    category: 'beast',
    zoneTier: 3,
    speed: 130,
    maxHp: 180,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'shadow_giant_sea_serpent.png'
  },
  cthulhu_colossus: {
    id: 'hostile_beast_cthulhu_colossus',
    name: 'Cthulhu Colossus',
    category: 'beast',
    zoneTier: 4,
    speed: 140,
    maxHp: 260,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'leviathan_kraken_worm_colossus.png'
  }
};

/**
 * Checks whether a target point falls within a directional detection cone.
 */
export function checkConeDetection(
  sourceX: number,
  sourceY: number,
  headingRad: number,
  coneLength: number,
  coneAngleRad: number,
  targetX: number,
  targetY: number
): boolean {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > coneLength) return false;

  const angleToTarget = Math.atan2(dy, dx);
  let diff = Math.abs(angleToTarget - headingRad);
  while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);

  return diff <= coneAngleRad / 2;
}

const HOSTILE_SPRITE_CACHE: Map<string, HTMLImageElement> = new Map();

function getHostileSprite(assetKey: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = HOSTILE_SPRITE_CACHE.get(assetKey);
  if (!img) {
    try {
      img = new Image();
      img.src = `./assets/sprites/fishing/${assetKey}`;
      HOSTILE_SPRITE_CACHE.set(assetKey, img);
    } catch {
      return null;
    }
  }
  if (img && img.complete && img.naturalWidth > 0) {
    return img;
  }
  return null;
}

export class HostileEntity {
  public id: string;
  public name: string;
  public category: HostileCategory;
  public type: HostileCategory;
  public zoneTier: 1 | 2 | 3 | 4;
  public position: { x: number; y: number };
  public velocity: { x: number; y: number };
  public heading: number;
  public speed: number;
  public maxHp: number;
  public currentHp: number;
  public detectionRadius: number;
  public spriteAssetKey: string;
  public alertState: HostileAlertState;

  // Timers and internal state
  public alertTimer: number = 0;
  public decayTimer: number = 2.0;
  public chargeTimer: number = 0;
  public groanPlayed: boolean = false;
  public hornPlayed: boolean = false;
  public wanderAngle: number = 0;
  public animTime: number = 0;

  constructor(template: HostileTemplate, spawnX: number, spawnY: number, heading: number = 0) {
    this.id = `${template.id}_${Math.random().toString(36).slice(2, 7)}`;
    this.name = template.name;
    this.category = template.category;
    this.type = template.category;
    this.zoneTier = template.zoneTier;
    this.speed = template.speed;
    this.maxHp = template.maxHp;
    this.currentHp = template.maxHp;
    this.detectionRadius = template.detectionRadius;
    this.spriteAssetKey = template.spriteAssetKey;

    this.position = { x: spawnX, y: spawnY };
    this.heading = heading;
    this.velocity = {
      x: Math.cos(heading) * (template.speed * 0.5),
      y: Math.sin(heading) * (template.speed * 0.5)
    };
    this.wanderAngle = heading;

    this.alertState = this.category === 'vessel' ? 'patrol' : 'submerged_lurk';
    this.animTime = Math.random() * 10;
  }

  public update(dt: number, boatPos: { x: number; y: number }): void {
    this.animTime += dt;
    const dx = boatPos.x - this.position.x;
    const dy = boatPos.y - this.position.y;
    const distToPlayer = Math.sqrt(dx * dx + dy * dy);

    if (this.category === 'vessel') {
      this.updateVessel(dt, boatPos, distToPlayer);
    } else {
      this.updateBeast(dt, boatPos, distToPlayer);
    }

    // Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Maintain boundaries & harbor avoidance
    this.enforceBoundaries();
  }

  private updateVessel(dt: number, boatPos: { x: number; y: number }, distToPlayer: number): void {
    const inCone = checkConeDetection(
      this.position.x,
      this.position.y,
      this.heading,
      HOSTILE_CONE_DISTANCE,
      HOSTILE_CONE_ANGLE_RAD,
      boatPos.x,
      boatPos.y
    );

    if (this.alertState === 'patrol') {
      if (inCone || distToPlayer <= 135) {
        this.alertState = distToPlayer <= 110 ? 'pursuit' : 'alert';
        this.alertTimer = 1.0;
        this.decayTimer = 2.0;
        if (!this.hornPlayed) {
          AudioManager.getInstance().playHornAlert();
          this.hornPlayed = true;
        }
      } else {
        this.hornPlayed = false;
        // Normal patrol wandering
        this.wander(dt, this.speed * 0.5);
      }
    } else if (this.alertState === 'alert') {
      if (inCone || distToPlayer <= 135) {
        this.alertTimer = Math.max(0, this.alertTimer - dt);
        if (this.alertTimer <= 0 || distToPlayer <= 110) {
          this.alertState = 'pursuit';
        }
      } else {
        this.decayTimer -= dt;
        if (this.decayTimer <= 0) {
          this.alertState = 'patrol';
          this.hornPlayed = false;
        }
      }
      // Steer slightly towards player while in alert
      const targetHeading = Math.atan2(boatPos.y - this.position.y, boatPos.x - this.position.x);
      this.smoothRotate(targetHeading, dt * 1.5);
      this.velocity.x = Math.cos(this.heading) * (this.speed * 0.6);
      this.velocity.y = Math.sin(this.heading) * (this.speed * 0.6);
    } else if (this.alertState === 'pursuit') {
      // Disengage if player outruns beyond 600px
      if (distToPlayer > 600) {
        this.alertState = 'patrol';
        this.hornPlayed = false;
        return;
      }

      const targetHeading = Math.atan2(boatPos.y - this.position.y, boatPos.x - this.position.x);
      this.smoothRotate(targetHeading, dt * 2.5);
      this.velocity.x = Math.cos(this.heading) * this.speed;
      this.velocity.y = Math.sin(this.heading) * this.speed;
    }
  }

  private updateBeast(dt: number, boatPos: { x: number; y: number }, distToPlayer: number): void {
    if (this.alertState === 'submerged_lurk') {
      // Groan cue when within 350px
      if (distToPlayer <= BEAST_GROAN_RADIUS) {
        if (!this.groanPlayed) {
          AudioManager.getInstance().playCreatureGroan();
          this.groanPlayed = true;
        }
      } else {
        this.groanPlayed = false;
      }

      // Breach charge trigger when within 150px
      if (distToPlayer <= BEAST_BREACH_RADIUS) {
        this.alertState = 'breach_charge';
        this.chargeTimer = 2.5;
        this.heading = Math.atan2(boatPos.y - this.position.y, boatPos.x - this.position.x);
      } else {
        // Slow lurk swimming
        this.wander(dt, this.speed * 0.4);
      }
    } else if (this.alertState === 'breach_charge') {
      this.chargeTimer -= dt;
      if (this.chargeTimer <= 0) {
        this.alertState = 'submerged_lurk';
        this.groanPlayed = false;
        return;
      }

      // Direct charge towards target player
      const targetHeading = Math.atan2(boatPos.y - this.position.y, boatPos.x - this.position.x);
      this.smoothRotate(targetHeading, dt * 3.0);
      const chargeSpeed = Math.min(140, this.speed);
      this.velocity.x = Math.cos(this.heading) * chargeSpeed;
      this.velocity.y = Math.sin(this.heading) * chargeSpeed;
    }
  }

  private wander(dt: number, speed: number): void {
    this.wanderAngle += (Math.random() - 0.5) * 1.5 * dt;
    this.smoothRotate(this.wanderAngle, dt * 0.8);
    this.velocity.x = Math.cos(this.heading) * speed;
    this.velocity.y = Math.sin(this.heading) * speed;
  }

  private smoothRotate(targetAngle: number, rate: number): void {
    let diff = targetAngle - this.heading;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.heading += Math.max(-rate, Math.min(rate, diff));
  }

  private enforceBoundaries(): void {
    // 1. Avoid safe harbor (4000, 4000) radius < 1200px
    const dx = this.position.x - HARBOR_CENTER_X;
    const dy = this.position.y - HARBOR_CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < HARBOR_SAFE_RADIUS) {
      const pushAngle = Math.atan2(dy, dx);
      this.heading = pushAngle;
      this.position.x = HARBOR_CENTER_X + Math.cos(pushAngle) * HARBOR_SAFE_RADIUS;
      this.position.y = HARBOR_CENTER_Y + Math.sin(pushAngle) * HARBOR_SAFE_RADIUS;
      this.velocity.x = Math.cos(pushAngle) * this.speed;
      this.velocity.y = Math.sin(pushAngle) * this.speed;
    }

    // 2. Clamp inside map bounds (100 to 7900)
    if (this.position.x < 100) {
      this.position.x = 100;
      this.velocity.x = Math.abs(this.velocity.x);
      this.heading = Math.atan2(this.velocity.y, this.velocity.x);
    } else if (this.position.x > MAP_WIDTH - 100) {
      this.position.x = MAP_WIDTH - 100;
      this.velocity.x = -Math.abs(this.velocity.x);
      this.heading = Math.atan2(this.velocity.y, this.velocity.x);
    }

    if (this.position.y < 100) {
      this.position.y = 100;
      this.velocity.y = Math.abs(this.velocity.y);
      this.heading = Math.atan2(this.velocity.y, this.velocity.x);
    } else if (this.position.y > MAP_HEIGHT - 100) {
      this.position.y = MAP_HEIGHT - 100;
      this.velocity.y = -Math.abs(this.velocity.y);
      this.heading = Math.atan2(this.velocity.y, this.velocity.x);
    }

    // Clamp speed to maximum
    const currentSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
    const maxAllowed = Math.min(140, this.speed);
    if (currentSpeed > maxAllowed && currentSpeed > 0) {
      this.velocity.x = (this.velocity.x / currentSpeed) * maxAllowed;
      this.velocity.y = (this.velocity.y / currentSpeed) * maxAllowed;
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const screen = camera.worldToScreen(new Vector2(this.position.x, this.position.y));

    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.rotate(this.heading);

    if (this.category === 'vessel') {
      this.renderVessel(ctx);
    } else {
      this.renderBeast(ctx);
    }

    ctx.restore();
  }

  private renderVessel(ctx: CanvasRenderingContext2D): void {
    // Pulsing hostile contact aura ring
    const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 4.5);
    ctx.strokeStyle = this.alertState === 'pursuit'
      ? `rgba(239, 68, 68, ${0.45 + pulse * 0.35})`
      : `rgba(245, 158, 11, ${0.22 + pulse * 0.18})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 34 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Hull silhouette
    ctx.fillStyle = this.alertState === 'pursuit' ? '#7f1d1d' : (this.alertState === 'alert' ? '#78350f' : '#1f2937');
    ctx.strokeStyle = this.alertState === 'pursuit' ? '#ef4444' : '#9ca3af';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(-18, -13);
    ctx.lineTo(-24, 0);
    ctx.lineTo(-18, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw sprite overlay if loaded
    const sprite = getHostileSprite(this.spriteAssetKey);
    if (sprite && typeof ctx.drawImage === 'function') {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(sprite, -30, -22, 60, 44);
      ctx.restore();
    }

    // Mast and deck lantern
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Upright nameplate & alert indicator
    ctx.save();
    ctx.rotate(-this.heading);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px "Cinzel", Georgia, serif';
    ctx.fillStyle = this.alertState === 'pursuit' ? '#fca5a5' : '#fde68a';
    ctx.fillText(this.name, 0, 32);

    if (this.alertState === 'alert' || this.alertState === 'pursuit') {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = this.alertState === 'pursuit' ? '#ef4444' : '#f59e0b';
      ctx.fillText(this.alertState === 'pursuit' ? '⚔ RAM / ENGAGE!' : '?', 0, -26);
    }
    ctx.restore();
  }

  private renderBeast(ctx: CanvasRenderingContext2D): void {
    const shadowOffset = Math.sin(this.animTime * 2.0) * 10;
    const isBreaching = this.alertState === 'breach_charge';
    const pulse = 0.5 + 0.5 * Math.sin(this.animTime * 5.0);

    // Pulsing beast contact ring
    ctx.strokeStyle = isBreaching
      ? `rgba(239, 68, 68, ${0.50 + pulse * 0.35})`
      : `rgba(52, 211, 153, ${0.28 + pulse * 0.20})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 36 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();

    if (isBreaching) {
      // Breached monster
      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const sprite = getHostileSprite(this.spriteAssetKey);
      if (sprite && typeof ctx.drawImage === 'function') {
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(sprite, -32, -22, 64, 44);
        ctx.restore();
      }

      // Glowing eldritch eye
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(14, -5, 3.2, 0, Math.PI * 2);
      ctx.arc(14, 5, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Thrashing foam ripples
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, 34 + Math.sin(this.animTime * 6) * 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Submerged murky shadow
      ctx.save();
      ctx.translate(shadowOffset, 0);
      ctx.fillStyle = 'rgba(6, 30, 25, 0.78)';
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Serpent/tail undulation
      ctx.beginPath();
      ctx.ellipse(-26, Math.sin(this.animTime * 3) * 6, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Upright nameplate
    ctx.save();
    ctx.rotate(-this.heading);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px "Cinzel", Georgia, serif';
    ctx.fillStyle = isBreaching ? '#fca5a5' : '#6ee7b7';
    ctx.fillText(this.name, 0, 34);
    if (isBreaching) {
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('🦑 BREACH!', 0, -28);
    }
    ctx.restore();
  }
}

export class RoamingHostileManager {
  private hostiles: HostileEntity[] = [];

  constructor() {
    this.spawnInitialHostiles();
  }

  public getHostiles(): HostileEntity[] {
    return this.hostiles;
  }

  public spawnInitialHostiles(): void {
    this.hostiles = [];

    // Spawn 5 hostiles across zones (maintaining 4-6)
    const initialKeys = [
      'crazed_trawler',
      'mutated_whale',
      'ghost_skiff',
      'galleon_raider',
      'kelp_leviathan'
    ];

    for (const key of initialKeys) {
      const template = AUTHORITATIVE_HOSTILE_ROSTER[key];
      if (template) {
        this.spawnHostileFromTemplate(template);
      }
    }
  }

  public spawnHostile(templateKey?: string, zoneTier?: number): HostileEntity {
    let template: HostileTemplate;
    if (templateKey && AUTHORITATIVE_HOSTILE_ROSTER[templateKey]) {
      template = AUTHORITATIVE_HOSTILE_ROSTER[templateKey];
    } else if (zoneTier) {
      const matches = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).filter(h => h.zoneTier === zoneTier);
      template = matches[Math.floor(Math.random() * matches.length)];
    } else {
      const all = Object.values(AUTHORITATIVE_HOSTILE_ROSTER);
      template = all[Math.floor(Math.random() * all.length)];
    }

    return this.spawnHostileFromTemplate(template);
  }

  private spawnHostileFromTemplate(template: HostileTemplate): HostileEntity {
    // Determine radial spawn distance based on zoneTier
    const zoneRanges: Record<number, [number, number]> = {
      1: [1300, 2200],
      2: [2300, 3400],
      3: [3500, 4600],
      4: [4700, 5600]
    };
    const [minR, maxR] = zoneRanges[template.zoneTier] || [1400, 2400];
    const angle = Math.random() * Math.PI * 2;
    const dist = minR + Math.random() * (maxR - minR);

    const x = Math.max(200, Math.min(MAP_WIDTH - 200, HARBOR_CENTER_X + Math.cos(angle) * dist));
    const y = Math.max(200, Math.min(MAP_HEIGHT - 200, HARBOR_CENTER_Y + Math.sin(angle) * dist));
    const heading = angle + Math.PI / 2 + (Math.random() - 0.5);

    const hostile = new HostileEntity(template, x, y, heading);
    this.hostiles.push(hostile);

    // Keep active count within 4-6
    while (this.hostiles.length > 6) {
      this.hostiles.shift();
    }

    return hostile;
  }

  public update(dt: number, boatPos: { x: number; y: number }): HostileEntity | null {
    // Maintain active count invariant: 4-6
    if (this.hostiles.length < 4) {
      this.spawnHostile();
    }

    let engagedHostile: HostileEntity | null = null;

    for (let i = this.hostiles.length - 1; i >= 0; i--) {
      const h = this.hostiles[i];
      h.update(dt, boatPos);

      // Check combat engage radius: <= 45px
      const dx = boatPos.x - h.position.x;
      const dy = boatPos.y - h.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= COMBAT_ENGAGE_RADIUS) {
        engagedHostile = h;
      }
    }

    return engagedHostile;
  }

  /**
   * Hull-to-hull touch collision check between the player boat (bow, center, stern)
   * and any roaming hostile entity's hull/body so touching any part of the enemy
   * immediately initiates combat.
   */
  public checkBoatCollision(boat: { position: { x: number; y: number }; heading?: number; radius?: number }): HostileEntity | null {
    const bx = boat.position.x;
    const by = boat.position.y;
    const bHeading = boat.heading ?? 0;
    const bCos = Math.cos(bHeading);
    const bSin = Math.sin(bHeading);

    const boatPoints = [
      { x: bx, y: by },
      { x: bx + bCos * 25, y: by + bSin * 25 },
      { x: bx - bCos * 25, y: by - bSin * 25 }
    ];

    for (const h of this.hostiles) {
      const hx = h.position.x;
      const hy = h.position.y;
      const centerDist = Math.hypot(bx - hx, by - hy);
      if (centerDist <= 68) {
        return h;
      }

      const hCos = Math.cos(h.heading);
      const hSin = Math.sin(h.heading);
      const hostilePoints = [
        { x: hx, y: hy },
        { x: hx + hCos * 24, y: hy + hSin * 24 },
        { x: hx - hCos * 24, y: hy - hSin * 24 }
      ];

      for (const bp of boatPoints) {
        for (const hp of hostilePoints) {
          if (Math.hypot(bp.x - hp.x, bp.y - hp.y) <= 52) {
            return h;
          }
        }
      }
    }

    return null;
  }

  public renderWorld(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const h of this.hostiles) {
      h.render(ctx, camera);
    }
  }

  public renderLighting(lightingCtx: CanvasRenderingContext2D, camera: Camera, _dpr: number = 1): void {
    for (const h of this.hostiles) {
      const screen = camera.worldToScreen(new Vector2(h.position.x, h.position.y));

      lightingCtx.save();
      lightingCtx.translate(screen.x, screen.y);
      lightingCtx.globalCompositeOperation = 'destination-out';

      // Ambient visibility halo around every hostile entity
      const haloGrad = lightingCtx.createRadialGradient(0, 0, 6, 0, 0, 110);
      haloGrad.addColorStop(0, 'rgba(0, 0, 0, 0.80)');
      haloGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.40)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightingCtx.fillStyle = haloGrad;
      lightingCtx.beginPath();
      lightingCtx.arc(0, 0, 110, 0, Math.PI * 2);
      lightingCtx.fill();

      if (h.category === 'vessel') {
        lightingCtx.rotate(h.heading);

        // Punch forward searchlight cone out of darkness mask
        const coneGrad = lightingCtx.createRadialGradient(0, 0, 10, 0, 0, HOSTILE_CONE_DISTANCE);
        coneGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        coneGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.65)');
        coneGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.35)');
        coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        lightingCtx.fillStyle = coneGrad;
        lightingCtx.beginPath();
        lightingCtx.moveTo(0, 0);
        lightingCtx.arc(
          0,
          0,
          HOSTILE_CONE_DISTANCE,
          -HOSTILE_CONE_ANGLE_RAD / 2,
          HOSTILE_CONE_ANGLE_RAD / 2
        );
        lightingCtx.closePath();
        lightingCtx.fill();
      }

      lightingCtx.restore();
    }
  }

  public renderSearchlights(ctx: CanvasRenderingContext2D, camera: Camera): void {
    // Visible light beam bloom pass
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const h of this.hostiles) {
      if (h.category === 'vessel') {
        const screen = camera.worldToScreen(new Vector2(h.position.x, h.position.y));

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(h.heading);

        const beamGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, HOSTILE_CONE_DISTANCE);
        const alertColor = h.alertState === 'pursuit' ? '239, 68, 68' : (h.alertState === 'alert' ? '245, 158, 11' : '254, 240, 138');
        beamGrad.addColorStop(0, `rgba(${alertColor}, 0.28)`);
        beamGrad.addColorStop(0.5, `rgba(${alertColor}, 0.12)`);
        beamGrad.addColorStop(1, `rgba(${alertColor}, 0)`);

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(
          0,
          0,
          HOSTILE_CONE_DISTANCE,
          -HOSTILE_CONE_ANGLE_RAD / 2,
          HOSTILE_CONE_ANGLE_RAD / 2
        );
        ctx.closePath();
        ctx.fill();

        ctx.restore();
      }
    }

    ctx.restore();
  }

  public removeHostile(id: string): void {
    this.hostiles = this.hostiles.filter(h => h.id !== id);
  }

  public clear(): void {
    this.hostiles = [];
  }
}
