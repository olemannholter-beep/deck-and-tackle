import { Vector2 } from '../../engine/Vector2';
import { Camera } from '../../engine/Camera';
import { Boat } from './Boat';
import type { WaterZoneType, FishingSpot } from './FishingSpot';
import type { WorldLantern } from './OverworldMap';

export interface AtmosphereParameters {
  distanceToHarbor: number;
  zoneIndex: 1 | 2 | 3 | 4;
  zoneName: string;
  zoneType: WaterZoneType;

  // Water surface
  waterColor: string;
  waterColorRgb: [number, number, number];
  causticAlpha: number;

  // Lighting & Darkness
  darknessAlpha: number;
  lanternAmbientRadius: number;
  lanternBeamLength: number;
  lanternFlicker: number;

  // Volumetric Fog
  fogDensity: number;
  fogColorRgb: [number, number, number];

  // Vignette
  vignetteInnerRatio: number;
  vignetteOuterRatio: number;
  vignetteDarkness: number;

  // Weather & Special FX
  rainIntensity: number;
  miasmaIntensity: number;
}

interface RainStreak {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
}

interface MiasmaMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  baseAlpha: number;
  color: string;
}

interface AmbientSpore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export class AtmosphereManager {
  public static readonly HARBOR_CENTER: Vector2 = new Vector2(4000, 4000);

  // Keyframes for distance intervals: [0, 1200, 2400, 3600, 4800]
  private static readonly WATER_COLORS: [number, number, number][] = [
    [14, 52, 38], // Zone 1: Harbor Shallows (murky green)
    [11, 40, 36], // Zone 1 Outer
    [7, 25, 32],  // Zone 2: Foggy Banks (dark teal)
    [4, 9, 18],   // Zone 3: Sunken Reefs (abyssal slate)
    [1, 2, 4]     // Zone 4: Eldritch Trench (pitch-black void)
  ];

  private static readonly DARKNESS_ALPHAS = [0.45, 0.62, 0.80, 0.88, 0.94];
  private static readonly AMBIENT_RADII   = [195,  160,  135,  110,   85];
  private static readonly BEAM_LENGTHS    = [550,  490,  430,  360,  290];
  private static readonly FOG_DENSITIES   = [0.35, 0.60, 1.30, 0.85, 1.15];

  private static readonly FOG_COLORS: [number, number, number][] = [
    [32, 54, 46], // Pale sage grey
    [28, 48, 42],
    [18, 40, 36], // Cold murky teal
    [12, 18, 28], // Dark storm slate
    [6, 28, 24]   // Sickly cyan-tinted miasma
  ];

  private static readonly VIGNETTE_INNERS = [0.48, 0.38, 0.28, 0.20, 0.14];
  private static readonly VIGNETTE_OUTERS = [0.88, 0.80, 0.72, 0.65, 0.56];
  private static readonly VIGNETTE_DARKS  = [0.50, 0.72, 0.88, 0.95, 0.99];
  private static readonly RAIN_INTENSITIES   = [0.00, 0.00, 0.15, 1.00, 0.10];
  private static readonly MIASMA_INTENSITIES = [0.00, 0.00, 0.00, 0.15, 1.00];
  private static readonly CAUSTIC_ALPHAS     = [0.24, 0.18, 0.12, 0.06, 0.02];

  private time: number = 0;
  private currentParams: AtmosphereParameters;

  // Weather and FX Particle Systems
  private rainStreaks: RainStreak[] = [];
  private miasmaMotes: MiasmaMote[] = [];
  private spores: AmbientSpore[] = [];
  private stormLightningTimer: number = 0;
  private stormLightningAlpha: number = 0;
  private lastCamPos: Vector2 = new Vector2(4000, 4000);

  public getLastCameraPosition(): Vector2 {
    return this.lastCamPos;
  }

  constructor() {
    this.currentParams = AtmosphereManager.calculateAtmosphere(0);
    this.initSpores(1280, 720);
  }

  /**
   * Computes Euclidean distance from Harbor Center (4000, 4000).
   */
  public static getDistanceToHarbor(pos: Vector2): number {
    const dx = pos.x - AtmosphereManager.HARBOR_CENTER.x;
    const dy = pos.y - AtmosphereManager.HARBOR_CENTER.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Identifies concentric radial difficulty zone from position:
   * Zone 1: 0 to 1200 px -> 'shallow'
   * Zone 2: 1200 to 2400 px -> 'lake'
   * Zone 3: 2400 to 3600 px -> 'abyss'
   * Zone 4: 3600+ px -> 'cave'
   */
  public static getZoneAt(pos: Vector2): WaterZoneType {
    const dist = AtmosphereManager.getDistanceToHarbor(pos);
    if (dist < 1200) {
      return 'shallow';
    } else if (dist < 2400) {
      return 'lake';
    } else if (dist < 3600) {
      return 'abyss';
    }
    return 'cave';
  }

  public static getZoneIndex(distance: number): 1 | 2 | 3 | 4 {
    if (distance < 1200) return 1;
    if (distance < 2400) return 2;
    if (distance < 3600) return 3;
    return 4;
  }

  public static getZoneDisplayName(zone: WaterZoneType): string {
    switch (zone) {
      case 'shallow': return 'The Shallows (Zone 1)';
      case 'lake':    return 'The Foggy Banks (Zone 2)';
      case 'abyss':   return 'The Sunken Reefs (Zone 3)';
      case 'cave':    return 'The Eldritch Trench (Zone 4)';
    }
  }

  /**
   * Smoothstep interpolation factor t = u * u * (3 - 2 * u)
   */
  public static smoothstep(edge0: number, edge1: number, x: number): number {
    const u = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return u * u * (3 - 2 * u);
  }

  /**
   * Calculates continuous smoothly interpolated atmospheric parameters
   * across concentric radial distance keyframes [0, 1200, 2400, 3600, 4800].
   */
  public static calculateAtmosphere(distance: number, timeSec: number = 0): AtmosphereParameters {
    const dist = Math.max(0, distance);
    let span = 0;
    let u = 0;

    if (dist < 1200) {
      span = 0;
      u = dist / 1200;
    } else if (dist < 2400) {
      span = 1;
      u = (dist - 1200) / 1200;
    } else if (dist < 3600) {
      span = 2;
      u = (dist - 2400) / 1200;
    } else {
      span = 3;
      u = Math.min(1.0, (dist - 3600) / 1200);
    }

    // Continuous smoothstep interpolation factor: C1 continuity
    const t = u * u * (3 - 2 * u);

    // 1. Water Base Color RGB Lerp
    const c0 = AtmosphereManager.WATER_COLORS[span];
    const c1 = AtmosphereManager.WATER_COLORS[span + 1];
    const waterColorRgb: [number, number, number] = [
      Math.round(c0[0] + (c1[0] - c0[0]) * t),
      Math.round(c0[1] + (c1[1] - c0[1]) * t),
      Math.round(c0[2] + (c1[2] - c0[2]) * t)
    ];

    // 2. Fog Color RGB Lerp
    const fc0 = AtmosphereManager.FOG_COLORS[span];
    const fc1 = AtmosphereManager.FOG_COLORS[span + 1];
    const fogColorRgb: [number, number, number] = [
      Math.round(fc0[0] + (fc1[0] - fc0[0]) * t),
      Math.round(fc0[1] + (fc1[1] - fc0[1]) * t),
      Math.round(fc0[2] + (fc1[2] - fc0[2]) * t)
    ];

    // 3. Scalar Lerps
    const lerp = (arr: number[]) => arr[span] + (arr[span + 1] - arr[span]) * t;

    const darknessAlpha        = lerp(AtmosphereManager.DARKNESS_ALPHAS);
    const lanternAmbientRadius = lerp(AtmosphereManager.AMBIENT_RADII);
    const lanternBeamLength    = lerp(AtmosphereManager.BEAM_LENGTHS);
    const fogDensity           = lerp(AtmosphereManager.FOG_DENSITIES);
    const vignetteInnerRatio   = lerp(AtmosphereManager.VIGNETTE_INNERS);
    const vignetteOuterRatio   = lerp(AtmosphereManager.VIGNETTE_OUTERS);
    const vignetteDarkness     = lerp(AtmosphereManager.VIGNETTE_DARKS);
    const rainIntensity        = lerp(AtmosphereManager.RAIN_INTENSITIES);
    const miasmaIntensity      = lerp(AtmosphereManager.MIASMA_INTENSITIES);
    const causticAlpha         = lerp(AtmosphereManager.CAUSTIC_ALPHAS);

    // 4. Lantern instability flicker (increasing flutter in deeper zones)
    const baseFlicker = Math.sin(timeSec * 7.1) * 0.035 + Math.cos(timeSec * 19.3) * 0.015;
    const instabilityFactor = 0.8 + span * 0.55;
    const lanternFlicker = 1.0 + baseFlicker * instabilityFactor;

    // Discrete metadata
    const zoneIndex = AtmosphereManager.getZoneIndex(dist);
    let zoneType: WaterZoneType = 'shallow';
    if (zoneIndex === 2) zoneType = 'lake';
    else if (zoneIndex === 3) zoneType = 'abyss';
    else if (zoneIndex === 4) zoneType = 'cave';

    const zoneName = AtmosphereManager.getZoneDisplayName(zoneType);

    return {
      distanceToHarbor: dist,
      zoneIndex,
      zoneName,
      zoneType,
      waterColor: `rgb(${waterColorRgb[0]}, ${waterColorRgb[1]}, ${waterColorRgb[2]})`,
      waterColorRgb,
      causticAlpha,
      darknessAlpha,
      lanternAmbientRadius,
      lanternBeamLength,
      lanternFlicker,
      fogDensity,
      fogColorRgb,
      vignetteInnerRatio,
      vignetteOuterRatio,
      vignetteDarkness,
      rainIntensity,
      miasmaIntensity
    };
  }

  public update(dt: number, boatPos: Vector2, camPos: Vector2, width: number = 1280, height: number = 720): void {
    this.time += dt;
    this.lastCamPos.copy(camPos);
    const dist = AtmosphereManager.getDistanceToHarbor(boatPos);
    this.currentParams = AtmosphereManager.calculateAtmosphere(dist, this.time);

    // Update screen-space rain streaks (Zone 3 Tempest Squall)
    this.updateRain(dt, this.currentParams.rainIntensity, width, height);

    // Update screen-space miasma motes (Zone 4 Whispering Miasma)
    this.updateMiasma(dt, this.currentParams.miasmaIntensity, width, height);

    // Update screen-space ambient spores
    this.updateSpores(dt, width, height);

    // Update storm lightning timer in Zone 3
    if (this.currentParams.rainIntensity > 0.4) {
      this.stormLightningTimer -= dt;
      if (this.stormLightningTimer <= 0) {
        this.stormLightningTimer = 8 + Math.random() * 9;
        this.stormLightningAlpha = 0.28 * this.currentParams.rainIntensity;
      }
    } else {
      this.stormLightningTimer = 4;
    }

    if (this.stormLightningAlpha > 0) {
      this.stormLightningAlpha = Math.max(0, this.stormLightningAlpha - dt * 2.8);
    }
  }

  public getParameters(): AtmosphereParameters {
    return this.currentParams;
  }

  public calculateAtmosphere(distance: number): AtmosphereParameters {
    return AtmosphereManager.calculateAtmosphere(distance, this.time);
  }

  // =========================================================================
  // Screen-Space Weather & Particle Logic
  // =========================================================================

  private updateRain(dt: number, intensity: number, width: number, height: number): void {
    if (intensity <= 0.01) {
      this.rainStreaks = [];
      return;
    }

    const targetCount = Math.floor(100 * intensity);
    while (this.rainStreaks.length < targetCount) {
      this.rainStreaks.push({
        x: Math.random() * (width + 300) - 100,
        y: Math.random() * -60,
        speed: 750 + Math.random() * 400,
        length: 22 + Math.random() * 16,
        alpha: 0.20 + Math.random() * 0.25
      });
    }

    for (let i = this.rainStreaks.length - 1; i >= 0; i--) {
      const r = this.rainStreaks[i];
      r.y += r.speed * dt;
      r.x -= r.speed * 0.35 * dt; // Slanted storm trajectory

      if (r.y > height + 50 || r.x < -120) {
        if (this.rainStreaks.length > targetCount) {
          this.rainStreaks.splice(i, 1);
        } else {
          // Recycle
          r.x = Math.random() * (width + 300) - 50;
          r.y = Math.random() * -50;
        }
      }
    }
  }

  private renderRain(ctx: CanvasRenderingContext2D, intensity: number): void {
    if (intensity <= 0.01 || this.rainStreaks.length === 0) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    for (const r of this.rainStreaks) {
      const a = r.alpha * intensity;
      ctx.strokeStyle = `rgba(186, 230, 253, ${a})`;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 7, r.y + r.length);
      ctx.stroke();
    }
    ctx.restore();
  }

  private updateMiasma(dt: number, intensity: number, width: number, height: number): void {
    if (intensity <= 0.01) {
      this.miasmaMotes = [];
      return;
    }

    const targetCount = Math.floor(45 * intensity);
    while (this.miasmaMotes.length < targetCount) {
      this.miasmaMotes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 20,
        vy: -15 - Math.random() * 25,
        radius: 1.5 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        baseAlpha: 0.35 + Math.random() * 0.35,
        color: Math.random() > 0.3 ? '#2dd4bf' : '#5eead4' // Ethereal glowing cyan motes
      });
    }

    for (let i = this.miasmaMotes.length - 1; i >= 0; i--) {
      const m = this.miasmaMotes[i];
      m.phase += dt * 2.0;
      m.x += (m.vx + Math.sin(m.phase) * 22) * dt;
      m.y += (m.vy + Math.cos(m.phase * 0.7) * 12) * dt;

      if (m.y < -30 || m.x < -30 || m.x > width + 30) {
        if (this.miasmaMotes.length > targetCount) {
          this.miasmaMotes.splice(i, 1);
        } else {
          // Recycle at bottom
          m.x = Math.random() * width;
          m.y = height + 15;
          m.phase = Math.random() * Math.PI * 2;
        }
      }
    }
  }

  private renderMiasma(ctx: CanvasRenderingContext2D, intensity: number, width: number, height: number): void {
    if (intensity <= 0.01 || this.miasmaMotes.length === 0) return;

    ctx.save();
    for (const m of this.miasmaMotes) {
      const alpha = (m.baseAlpha + Math.sin(m.phase) * 0.18) * intensity;
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = 8;
      ctx.fillStyle = m.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Zone 4 Whispering Miasma Outer Vignette Smoke
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const miasmaSmoke = ctx.createRadialGradient(
      width / 2, height / 2, minDim * 0.22,
      width / 2, height / 2, maxDim * 0.65
    );
    miasmaSmoke.addColorStop(0, 'rgba(45, 212, 191, 0)');
    miasmaSmoke.addColorStop(0.70, `rgba(13, 148, 136, ${0.04 * intensity})`);
    miasmaSmoke.addColorStop(1, `rgba(15, 23, 42, ${0.30 * intensity})`);
    ctx.fillStyle = miasmaSmoke;
    ctx.fillRect(0, 0, width, height);

    ctx.restore();
  }

  private initSpores(width: number, height: number): void {
    this.spores = [];
    for (let i = 0; i < 35; i++) {
      this.spores.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 12 + 6,
        vy: -8 - Math.random() * 12,
        radius: 1.0 + Math.random() * 2.2,
        life: Math.random() * 5,
        maxLife: 5 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#2dd4bf' : (Math.random() > 0.5 ? '#6ee7b7' : '#a7f3d0')
      });
    }
  }

  private updateSpores(dt: number, width: number, height: number): void {
    for (let i = this.spores.length - 1; i >= 0; i--) {
      const s = this.spores[i];
      s.life += dt;
      s.x += (s.vx + Math.sin(s.life * 1.4) * 8) * dt;
      s.y += s.vy * dt;

      if (s.life >= s.maxLife || s.y < -30 || s.x > width + 60 || s.x < -60) {
        this.spores.splice(i, 1);
      }
    }

    while (this.spores.length < 40) {
      this.spores.push({
        x: Math.random() * (width + 120) - 60,
        y: height + 15 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 12 + 6,
        vy: -10 - Math.random() * 14,
        radius: 1.0 + Math.random() * 2.0,
        life: 0,
        maxLife: 6 + Math.random() * 5,
        color: Math.random() > 0.4 ? '#2dd4bf' : (Math.random() > 0.5 ? '#6ee7b7' : '#a7f3d0')
      });
    }
  }

  private renderSpores(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const spore of this.spores) {
      const lifeRatio = spore.life / spore.maxLife;
      const alpha = Math.sin(lifeRatio * Math.PI) * 0.85;
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = spore.color;
      ctx.fillStyle = spore.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(spore.x, spore.y, spore.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // =========================================================================
  // Background & Bathymetry Interface Contract Methods
  // =========================================================================

  public renderWaterBackground(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number): void {
    const camDist = cam.position.distanceTo(AtmosphereManager.HARBOR_CENTER);
    const params = this.calculateAtmosphere(camDist);
    const margin = Math.max(width, height) * 0.1 || 100;
    const bounds = cam.getViewportBounds(margin);

    ctx.save();
    // 1. Base dynamic water color fill
    ctx.fillStyle = params.waterColor;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

    // 2. Smooth concentric radial gradient centered at harbor
    const harborGrad = ctx.createRadialGradient(
      AtmosphereManager.HARBOR_CENTER.x, AtmosphereManager.HARBOR_CENTER.y, 80,
      AtmosphereManager.HARBOR_CENTER.x, AtmosphereManager.HARBOR_CENTER.y, 4800
    );
    harborGrad.addColorStop(0, '#0e3426');     // Calm emerald cove
    harborGrad.addColorStop(0.25, '#071920');  // 1200px (Foggy Banks)
    harborGrad.addColorStop(0.50, '#040912');  // 2400px (Sunken Reefs)
    harborGrad.addColorStop(0.75, '#010204');  // 3600px (Eldritch Trench)
    harborGrad.addColorStop(1.0, '#000102');   // Outer deep void

    ctx.fillStyle = harborGrad;
    ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.restore();
  }

  public renderConcentricBathymetryRings(ctx: CanvasRenderingContext2D, cam: Camera): void {
    const depthRings = [
      { radius: 600,  depth: '10m',  color: 'rgba(52, 211, 153, 0.22)', dash: [16, 14] },
      { radius: 1200, depth: '30m',  color: 'rgba(45, 212, 191, 0.25)', dash: [20, 12] },
      { radius: 1800, depth: '45m',  color: 'rgba(45, 212, 191, 0.18)', dash: [16, 14] },
      { radius: 2400, depth: '60m',  color: 'rgba(56, 189, 248, 0.22)', dash: [20, 12] },
      { radius: 3000, depth: '80m',  color: 'rgba(56, 189, 248, 0.16)', dash: [16, 14] },
      { radius: 3600, depth: '100m', color: 'rgba(129, 140, 248, 0.22)', dash: [24, 12] },
      { radius: 4200, depth: '150m', color: 'rgba(167, 139, 250, 0.18)', dash: [18, 14] },
      { radius: 4800, depth: '250m', color: 'rgba(192, 132, 252, 0.16)', dash: [24, 16] }
    ];

    const camDist = cam.position.distanceTo(AtmosphereManager.HARBOR_CENTER);
    const maxViewDist = Math.hypot(cam.viewportWidth / 2, cam.viewportHeight / 2) + 200;

    ctx.save();
    ctx.lineWidth = 1.6;

    for (const ring of depthRings) {
      if (Math.abs(ring.radius - camDist) > maxViewDist) {
        continue;
      }

      ctx.strokeStyle = ring.color;
      ctx.setLineDash(ring.dash);
      ctx.beginPath();
      ctx.arc(AtmosphereManager.HARBOR_CENTER.x, AtmosphereManager.HARBOR_CENTER.y, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = ring.color;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        const lx = AtmosphereManager.HARBOR_CENTER.x + Math.cos(theta) * ring.radius;
        const ly = AtmosphereManager.HARBOR_CENTER.y + Math.sin(theta) * ring.radius;
        ctx.fillText(ring.depth, lx, ly);
      }
    }
    ctx.restore();
  }

  public renderOpenWaterDriftCues(ctx: CanvasRenderingContext2D, cam: Camera, boatVelocity: Vector2): void {
    const speed = boatVelocity.magnitude();
    if (speed < 5) return;

    // Subtle directional wake streaks in camera space
    ctx.save();
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.15)';
    ctx.lineWidth = 1.2;
    const norm = boatVelocity.clone().normalize();

    const bounds = cam.getViewportBounds(50);
    const step = 250;
    const startX = Math.floor(bounds.minX / step) * step;
    const startY = Math.floor(bounds.minY / step) * step;

    for (let x = startX; x <= bounds.maxX; x += step) {
      for (let y = startY; y <= bounds.maxY; y += step) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - norm.x * 14, y - norm.y * 14);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // =========================================================================
  // Screen-Space Atmosphere & Dual-Canvas Lighting Pass
  // =========================================================================

  public renderLightingAndAtmosphere(
    ctx: CanvasRenderingContext2D,
    lightingCanvas: HTMLCanvasElement,
    lightingCtx: CanvasRenderingContext2D,
    cam: Camera,
    boat: Boat,
    worldLanterns: WorldLantern[],
    fishingSpots: FishingSpot[],
    width: number,
    height: number,
    dpr: number = 1
  ): void {
    const p = this.currentParams;
    const flicker = p.lanternFlicker;
    const boatLanternPos = boat.getLanternPosition();
    const boatScreen = cam.worldToScreen(boatLanternPos);
    const ambientRadius = p.lanternAmbientRadius * flicker;
    const beamLength = p.lanternBeamLength * flicker;
    const boatHeading = boat.heading;

    // -----------------------------------------------------------------------
    // Pass 1: Offscreen Dynamic Darkness Mask (destination-out Light Punching)
    // -----------------------------------------------------------------------
    lightingCtx.save();
    lightingCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightingCtx.clearRect(0, 0, width, height);

    // Dynamic base darkness alpha
    const darkAlpha = Math.max(0.15, p.darknessAlpha - this.stormLightningAlpha * 0.4);
    lightingCtx.fillStyle = `rgba(2, 6, 14, ${darkAlpha})`;
    lightingCtx.fillRect(0, 0, width, height);

    // Punch out holes for light sources
    lightingCtx.globalCompositeOperation = 'destination-out';

    // A. Player Boat Ambient Light Circle
    const ambientGrad = lightingCtx.createRadialGradient(
      boatScreen.x, boatScreen.y, 8,
      boatScreen.x, boatScreen.y, ambientRadius
    );
    ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    ambientGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.90)');
    ambientGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.50)');
    ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    lightingCtx.fillStyle = ambientGrad;
    lightingCtx.beginPath();
    lightingCtx.arc(boatScreen.x, boatScreen.y, ambientRadius, 0, Math.PI * 2);
    lightingCtx.fill();

    // B. Player Boat Forward Conical Searchlight Beam
    lightingCtx.save();
    lightingCtx.translate(boatScreen.x, boatScreen.y);
    lightingCtx.rotate(boatHeading);

    const conePasses = [
      { halfAngle: 0.76, lenFactor: 0.88, alpha: 0.22 },
      { halfAngle: 0.58, lenFactor: 0.95, alpha: 0.35 },
      { halfAngle: 0.40, lenFactor: 1.00, alpha: 0.60 },
      { halfAngle: 0.22, lenFactor: 1.03, alpha: 0.85 }
    ];

    for (const pass of conePasses) {
      const passLen = beamLength * pass.lenFactor;
      const cGrad = lightingCtx.createRadialGradient(0, 0, 10, 0, 0, passLen);
      cGrad.addColorStop(0, `rgba(0, 0, 0, ${pass.alpha})`);
      cGrad.addColorStop(0.25, `rgba(0, 0, 0, ${pass.alpha * 0.95})`);
      cGrad.addColorStop(0.60, `rgba(0, 0, 0, ${pass.alpha * 0.65})`);
      cGrad.addColorStop(0.85, `rgba(0, 0, 0, ${pass.alpha * 0.25})`);
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lightingCtx.fillStyle = cGrad;
      lightingCtx.beginPath();
      lightingCtx.moveTo(0, 0);
      lightingCtx.arc(0, 0, passLen, -pass.halfAngle, pass.halfAngle);
      lightingCtx.closePath();
      lightingCtx.fill();
    }
    lightingCtx.restore();

    // C. World Lanterns Light Pools
    for (const lantern of worldLanterns) {
      const lScreen = cam.worldToScreen(new Vector2(lantern.x, lantern.y));
      if (
        lScreen.x >= -lantern.radius &&
        lScreen.x <= width + lantern.radius &&
        lScreen.y >= -lantern.radius &&
        lScreen.y <= height + lantern.radius
      ) {
        const wGrad = lightingCtx.createRadialGradient(
          lScreen.x, lScreen.y, 8,
          lScreen.x, lScreen.y, lantern.radius
        );
        wGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        wGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.88)');
        wGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.50)');
        wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightingCtx.fillStyle = wGrad;
        lightingCtx.beginPath();
        lightingCtx.arc(lScreen.x, lScreen.y, lantern.radius, 0, Math.PI * 2);
        lightingCtx.fill();
      }
    }

    // D. Swirling Fishing Spots / Whirlpools Light Pools
    for (const spot of fishingSpots) {
      const sScreen = cam.worldToScreen(spot.position);
      const spotRadius = 145;
      if (
        sScreen.x >= -spotRadius &&
        sScreen.x <= width + spotRadius &&
        sScreen.y >= -spotRadius &&
        sScreen.y <= height + spotRadius
      ) {
        const sGrad = lightingCtx.createRadialGradient(
          sScreen.x, sScreen.y, 6,
          sScreen.x, sScreen.y, spotRadius
        );
        sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
        sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.32)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lightingCtx.fillStyle = sGrad;
        lightingCtx.beginPath();
        lightingCtx.arc(sScreen.x, sScreen.y, spotRadius, 0, Math.PI * 2);
        lightingCtx.fill();
      }
    }

    lightingCtx.restore();

    // -----------------------------------------------------------------------
    // Pass 2: Blit Darkness Mask to Main Canvas
    // -----------------------------------------------------------------------
    ctx.drawImage(lightingCanvas, 0, 0, width, height);

    // -----------------------------------------------------------------------
    // Pass 3: Colored Lantern Bloom & Halos (Lighter Composite Operation)
    // -----------------------------------------------------------------------
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Boat Ambient Halo
    const haloGrad = ctx.createRadialGradient(
      boatScreen.x, boatScreen.y, 4,
      boatScreen.x, boatScreen.y, ambientRadius * 0.95
    );
    haloGrad.addColorStop(0, `rgba(254, 240, 138, ${0.35 * flicker})`);
    haloGrad.addColorStop(0.35, `rgba(234, 179, 8, ${0.18 * flicker})`);
    haloGrad.addColorStop(0.70, `rgba(163, 230, 53, ${0.06 * flicker})`);
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(boatScreen.x, boatScreen.y, ambientRadius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Boat Searchlight Colored Conical Beam
    ctx.save();
    ctx.translate(boatScreen.x, boatScreen.y);
    ctx.rotate(boatHeading);

    const bloomPasses = [
      { halfAngle: 0.74, lenFactor: 0.88, color: '163, 230, 53', alpha: 0.05 * flicker },
      { halfAngle: 0.55, lenFactor: 0.95, color: '234, 179, 8',  alpha: 0.10 * flicker },
      { halfAngle: 0.36, lenFactor: 1.00, color: '254, 240, 138', alpha: 0.18 * flicker },
      { halfAngle: 0.18, lenFactor: 1.03, color: '254, 249, 195', alpha: 0.28 * flicker }
    ];

    for (const pass of bloomPasses) {
      const pLen = beamLength * pass.lenFactor;
      const bGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, pLen);
      bGrad.addColorStop(0, `rgba(${pass.color}, ${pass.alpha * 1.2})`);
      bGrad.addColorStop(0.20, `rgba(${pass.color}, ${pass.alpha * 0.95})`);
      bGrad.addColorStop(0.55, `rgba(${pass.color}, ${pass.alpha * 0.50})`);
      bGrad.addColorStop(0.85, `rgba(${pass.color}, ${pass.alpha * 0.15})`);
      bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, pLen, -pass.halfAngle, pass.halfAngle);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // World Lantern Blooms
    for (const lantern of worldLanterns) {
      const lScreen = cam.worldToScreen(new Vector2(lantern.x, lantern.y));
      if (
        lScreen.x >= -lantern.radius &&
        lScreen.x <= width + lantern.radius &&
        lScreen.y >= -lantern.radius &&
        lScreen.y <= height + lantern.radius
      ) {
        const lBloom = ctx.createRadialGradient(
          lScreen.x, lScreen.y, 4,
          lScreen.x, lScreen.y, lantern.radius * 0.85
        );
        lBloom.addColorStop(0, `${lantern.color}50`);
        lBloom.addColorStop(0.35, `${lantern.color}22`);
        lBloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lBloom;
        ctx.beginPath();
        ctx.arc(lScreen.x, lScreen.y, lantern.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // -----------------------------------------------------------------------
    // Pass 4: Volumetric Rolling Fog (Scaled by fogDensity and fogColorRgb)
    // -----------------------------------------------------------------------
    ctx.save();
    const camPos = cam.position;
    const fogColorStr = `${p.fogColorRgb[0]}, ${p.fogColorRgb[1]}, ${p.fogColorRgb[2]}`;
    const fogLayers = [
      { count: 7,  speed: 7,  parallax: 0.08, rx: 280, ry: 140, baseAlpha: 0.07 },
      { count: 9,  speed: 17, parallax: 0.16, rx: 200, ry: 105, baseAlpha: 0.09 },
      { count: 11, speed: 27, parallax: 0.24, rx: 140, ry: 75,  baseAlpha: 0.08 }
    ];

    for (const layer of fogLayers) {
      const wrapW = width + layer.rx * 2;
      const wrapH = height + layer.ry * 2;
      const alpha = layer.baseAlpha * p.fogDensity;

      for (let i = 0; i < layer.count; i++) {
        const seedX = i * 389.7 + i * i * 47.1;
        const seedY = i * 271.3 + i * 83.5;

        const rawX = seedX + this.time * layer.speed - camPos.x * layer.parallax;
        const rawY = seedY + Math.sin(this.time * 0.28 + i * 1.6) * 35 - camPos.y * layer.parallax;

        const px = ((rawX % wrapW) + wrapW) % wrapW - layer.rx;
        const py = ((rawY % wrapH) + wrapH) % wrapH - layer.ry;

        const fGrad = ctx.createRadialGradient(px, py, 10, px, py, layer.rx);
        fGrad.addColorStop(0, `rgba(${fogColorStr}, ${alpha})`);
        fGrad.addColorStop(0.55, `rgba(${fogColorStr}, ${alpha * 0.5})`);
        fGrad.addColorStop(1, `rgba(${fogColorStr}, 0)`);

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, layer.ry / layer.rx);
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.arc(0, 0, layer.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // -----------------------------------------------------------------------
    // Pass 5: Screen-Edge Vignette (Dynamically Tightened by Distance)
    // -----------------------------------------------------------------------
    ctx.save();
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const innerRad = minDim * p.vignetteInnerRatio;
    const outerRad = maxDim * p.vignetteOuterRatio;

    const vig = ctx.createRadialGradient(width / 2, height / 2, innerRad, width / 2, height / 2, outerRad);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.5, `rgba(2, 6, 12, ${p.vignetteDarkness * 0.42})`);
    vig.addColorStop(0.85, `rgba(1, 3, 8, ${p.vignetteDarkness * 0.85})`);
    vig.addColorStop(1, `rgba(0, 2, 5, ${p.vignetteDarkness})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // -----------------------------------------------------------------------
    // Pass 6: Zone 3 Tempest Squall Rain Streaks & Lightning Flash
    // -----------------------------------------------------------------------
    if (p.rainIntensity > 0.01) {
      this.renderRain(ctx, p.rainIntensity);

      // Lightning flash illumination
      if (this.stormLightningAlpha > 0.01) {
        ctx.save();
        ctx.fillStyle = `rgba(224, 242, 254, ${this.stormLightningAlpha})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }

    // -----------------------------------------------------------------------
    // Pass 7: Zone 4 Whispering Miasma Swirling Ethereal Motes
    // -----------------------------------------------------------------------
    if (p.miasmaIntensity > 0.01) {
      this.renderMiasma(ctx, p.miasmaIntensity, width, height);
    }

    // -----------------------------------------------------------------------
    // Pass 8: Drifting Bioluminescent Spores
    // -----------------------------------------------------------------------
    this.renderSpores(ctx);

    // -----------------------------------------------------------------------
    // Pass 9: Subtle Eldritch Film Grain / Miasma Dust
    // -----------------------------------------------------------------------
    ctx.save();
    ctx.fillStyle = 'rgba(167, 243, 208, 0.028)';
    for (let i = 0; i < 35; i++) {
      const gx = (i * 97.7 + this.time * 45) % width;
      const gy = (i * 53.3 - this.time * 30 + (i % 2 === 0 ? 0 : height)) % height;
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
    ctx.restore();
  }
}
