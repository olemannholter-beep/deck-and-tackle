import { Vector2 } from '../../engine/Vector2';
import { FishingSpot } from './FishingSpot';
import type { WaterZoneType } from './FishingSpot';
import { HarborDock } from './HarborDock';
import { AudioManager } from '../../engine/AudioManager';
import { AtmosphereManager } from './AtmosphereManager';
import { WhirlpoolSpawner } from './WhirlpoolSpawner';

export interface IslandCollider {
  x: number;
  y: number;
  radius: number;
  type: 'rock' | 'island' | 'sandbar';
  color?: string;
}

export interface WorldLantern {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface OrganicIsland {
  center: Vector2;
  radius: number;
  type: 'rock' | 'island' | 'sandbar';
  shelfPoints: Vector2[];
  foamAngles: number[];
  mudPoints: Vector2[];
  rockPoints: Vector2[];
  crevices: { start: Vector2; end: Vector2 }[];
  decorations: {
    type: 'tree' | 'plank' | 'lantern' | 'monolith' | 'barnacles';
    x: number;
    y: number;
    rotation: number;
    scale: number;
  }[];
}

interface SubmergedTentacle {
  baseX: number;
  baseY: number;
  length: number;
  phaseOffset: number;
  baseAngle: number;
}

interface DriftParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  seed: number;
}

export class OverworldMap {
  public readonly width: number = 8000;
  public readonly height: number = 8000;

  public harborDock: HarborDock;
  public whirlpoolSpawner!: WhirlpoolSpawner;
  public fishingSpots: FishingSpot[] = [];
  public islandColliders: IslandCollider[] = [];

  // Precomputed organic island geometries (completely replaces flat circular primitives)
  private organicIslands: OrganicIsland[] = [];

  // Submerged deep-water horror silhouettes (tentacles writhing in the abyss)
  private submergedTentacles: SubmergedTentacle[] = [];

  // Camera-anchored toroidal drift particles
  private driftParticles: DriftParticle[] = [];

  // World lanterns that cast dynamic light pools into the darkness
  public readonly worldLanterns: WorldLantern[] = [
    { x: 4000, y: 4070, radius: 240, color: '#fef08a' }, // Central Safe Harbor Gas Lantern
    { x: 3200, y: 3100, radius: 180, color: '#6ee7b7' }, // Pine Island Shrine Lantern
    { x: 5500, y: 2800, radius: 200, color: '#38bdf8' }, // East Rocky Spire Beacon
    { x: 4000, y: 4220, radius: 160, color: '#f59e0b' }  // Harbor South Watchtower Lantern
  ];

  private time: number = 0;
  private atmosphereManager?: AtmosphereManager;

  public setAtmosphereManager(atmo: AtmosphereManager): void {
    this.atmosphereManager = atmo;
  }

  public getAtmosphereManager(): AtmosphereManager | undefined {
    return this.atmosphereManager;
  }

  constructor() {
    // 1. Setup Central Safe Harbor Dock at (4000, 4070)
    this.harborDock = new HarborDock(4000, 4070);

    // 2. Setup Islands and Shoreline Colliders
    this.setupColliders();

    // 3. Generate organic jagged island geometry & decorations
    this.generateOrganicIslands();

    // 4. Setup deep-water submerged tentacle silhouettes
    this.setupSubmergedTentacles();

    // 5. Setup Fishing Spots across the 4 concentric depth zones
    this.setupFishingSpots();

    // 6. Initialize camera-anchored toroidal drift particles
    this.initDriftParticles();
  }

  private initDriftParticles(): void {
    this.driftParticles = [];
    for (let i = 0; i < 160; i++) {
      this.driftParticles.push({
        x: 4000 + (Math.random() - 0.5) * 2600,
        y: 4000 + (Math.random() - 0.5) * 2200,
        radius: 1.0 + Math.random() * 2.0,
        alpha: 0.20 + Math.random() * 0.45,
        speed: 5 + Math.random() * 8,
        seed: Math.random() * 100
      });
    }
  }

  private setupColliders(): void {
    // Colliders keep physics smooth while matching the organic jagged visual footprints
    this.islandColliders = [
      // Central Safe Harbor sheltered cove & breakwater
      { x: 4000, y: 4220, radius: 130, type: 'island' },
      { x: 3870, y: 4140, radius: 80, type: 'rock' },
      { x: 4130, y: 4140, radius: 80, type: 'rock' },

      // Zone 1 & 2 Archipelago Islets (The Shallows & Foggy Banks)
      { x: 3200, y: 3100, radius: 120, type: 'island' },
      { x: 3330, y: 3020, radius: 90, type: 'island' },
      { x: 4800, y: 3400, radius: 95, type: 'sandbar' },
      { x: 4950, y: 3500, radius: 75, type: 'sandbar' },
      { x: 3100, y: 4900, radius: 80, type: 'sandbar' },

      // Zone 3 Sunken Reefs (Rocky Crags & Spires)
      { x: 5500, y: 2800, radius: 100, type: 'rock' },
      { x: 5650, y: 2920, radius: 80, type: 'rock' },
      { x: 2300, y: 5200, radius: 95, type: 'rock' },
      { x: 2450, y: 5350, radius: 85, type: 'rock' },
      { x: 2100, y: 2400, radius: 90, type: 'rock' },

      // Zone 4 Eldritch Monoliths (Abyssal Void Outcrops)
      { x: 1400, y: 1600, radius: 110, type: 'rock' },
      { x: 6700, y: 6500, radius: 120, type: 'rock' },
      { x: 1600, y: 6600, radius: 100, type: 'rock' },
      { x: 6600, y: 1500, radius: 105, type: 'rock' }
    ];
  }

  private generateOrganicIslands(): void {
    this.organicIslands = [];

    this.islandColliders.forEach((col, index) => {
      const numPoints = 36;
      const seed = (index + 1) * 47.19;

      const shelfPoints: Vector2[] = [];
      const foamAngles: number[] = [];
      const mudPoints: Vector2[] = [];
      const rockPoints: Vector2[] = [];
      const crevices: { start: Vector2; end: Vector2 }[] = [];
      const decorations: OrganicIsland['decorations'] = [];

      for (let j = 0; j < numPoints; j++) {
        const theta = (j / numPoints) * Math.PI * 2;
        foamAngles.push(theta);

        // Multi-frequency harmonic perturbation for jagged natural erosion
        const jagged =
          Math.sin(theta * 3 + seed) * 0.22 +
          Math.cos(theta * 5 - seed * 1.6) * 0.14 +
          Math.sin(theta * 7 + seed * 2.3) * 0.08 +
          Math.cos(theta * 11 + 1.2) * 0.05;

        const baseR = col.radius * (1 + jagged);

        // 1. Submerged shelf outline (outer murky water transition)
        const shelfR = baseR + 20;
        shelfPoints.push(new Vector2(col.x + Math.cos(theta) * shelfR, col.y + Math.sin(theta) * shelfR));

        // 2. Wet mud / slime transition band
        const mudR = baseR + 4;
        mudPoints.push(new Vector2(col.x + Math.cos(theta) * mudR, col.y + Math.sin(theta) * mudR));

        // 3. Main craggy rock interior
        const rockR = Math.max(10, baseR - 6);
        rockPoints.push(new Vector2(col.x + Math.cos(theta) * rockR, col.y + Math.sin(theta) * rockR));
      }

      // Internal stone fissures and shadow crevices
      const numCrevices = col.type === 'rock' ? 4 : 2;
      for (let c = 0; c < numCrevices; c++) {
        const cAng = ((c * 1.7 + seed) % 6.28);
        const r1 = col.radius * 0.25;
        const r2 = col.radius * 0.75;
        crevices.push({
          start: new Vector2(col.x + Math.cos(cAng) * r1, col.y + Math.sin(cAng) * r1),
          end: new Vector2(col.x + Math.cos(cAng + 0.3) * r2, col.y + Math.sin(cAng + 0.3) * r2)
        });
      }

      // Island Decorations
      if (col.type === 'island') {
        // Gnarled dead pine trees
        const treeCount = Math.floor(col.radius / 30);
        for (let t = 0; t < treeCount; t++) {
          const tDist = Math.random() * (col.radius * 0.55);
          const tAngle = Math.random() * Math.PI * 2;
          decorations.push({
            type: 'tree',
            x: col.x + Math.cos(tAngle) * tDist,
            y: col.y + Math.sin(tAngle) * tDist,
            rotation: Math.random() * Math.PI * 2,
            scale: 0.8 + Math.random() * 0.5
          });
        }
        // Rotting shore planks & collapsed timbers
        for (let p = 0; p < 2; p++) {
          const pAngle = (index + p * 2.1) % (Math.PI * 2);
          decorations.push({
            type: 'plank',
            x: col.x + Math.cos(pAngle) * (col.radius * 0.85),
            y: col.y + Math.sin(pAngle) * (col.radius * 0.85),
            rotation: pAngle + Math.PI / 2,
            scale: 1.0
          });
        }
      } else if (col.type === 'rock') {
        // Sunken cyclopean monolith / basalt stone ruin
        decorations.push({
          type: 'monolith',
          x: col.x - col.radius * 0.2,
          y: col.y - col.radius * 0.2,
          rotation: (seed % 1.5) - 0.75,
          scale: col.radius / 70
        });
        // Barnacle specks
        decorations.push({
          type: 'barnacles',
          x: col.x,
          y: col.y,
          rotation: 0,
          scale: 1.0
        });
      }

      this.organicIslands.push({
        center: new Vector2(col.x, col.y),
        radius: col.radius,
        type: col.type,
        shelfPoints,
        foamAngles,
        mudPoints,
        rockPoints,
        crevices,
        decorations
      });
    });
  }

  private setupSubmergedTentacles(): void {
    this.submergedTentacles = [
      { baseX: 2300, baseY: 5200, length: 150, phaseOffset: 0, baseAngle: -0.4 },
      { baseX: 5500, baseY: 2800, length: 160, phaseOffset: 2.1, baseAngle: 0.6 },
      { baseX: 1400, baseY: 1600, length: 170, phaseOffset: 4.3, baseAngle: -1.2 },
      { baseX: 6700, baseY: 6500, length: 180, phaseOffset: 1.4, baseAngle: 1.8 }
    ];
  }

  private setupFishingSpots(): void {
    // Dynamic Whirlpool Spawner: maintains 6-8 global spots with 2-3 local bias
    this.whirlpoolSpawner = new WhirlpoolSpawner(this.islandColliders, new Vector2(4000, 4000));
    this.fishingSpots = this.whirlpoolSpawner.getActiveWhirlpools();
  }

  public getZoneAt(pos: Vector2): WaterZoneType {
    return AtmosphereManager.getZoneAt(pos);
  }

  public getZoneDisplayName(zone: WaterZoneType): string {
    return AtmosphereManager.getZoneDisplayName(zone);
  }

  public update(dt: number, boatPos: Vector2, isFishing: boolean = false): void {
    this.time += dt;

    // Update dock
    this.harborDock.update(dt, boatPos);

    // Update dynamic whirlpool spawner and synchronize active spots
    this.whirlpoolSpawner.update(dt, boatPos, isFishing);
    this.fishingSpots = this.whirlpoolSpawner.getActiveWhirlpools();
  }

  public getNearbyFishingSpot(boatPos: Vector2): FishingSpot | null {
    return this.whirlpoolSpawner.getNearbySpot(boatPos);
  }

  public onFishingVictory(spotId: string): void {
    this.whirlpoolSpawner.onFishingVictory(spotId);
    this.fishingSpots = this.whirlpoolSpawner.getActiveWhirlpools();
  }

  /**
   * Shoreline collision detection & resolution for the boat.
   * Slides the boat smoothly along boundaries and rocky shores.
   */
  public resolveCollisions(boatPos: Vector2, boatRadius: number, boatSpeed: number = 0): void {
    // 1. Lake Outer Boundary Walls
    const margin = 50;
    if (boatPos.x < margin + boatRadius) boatPos.x = margin + boatRadius;
    if (boatPos.x > this.width - margin - boatRadius) boatPos.x = this.width - margin - boatRadius;
    if (boatPos.y < margin + boatRadius) boatPos.y = margin + boatRadius;
    if (boatPos.y > this.height - margin - boatRadius) boatPos.y = this.height - margin - boatRadius;

    // 2. Harbor Pier AABB collision
    const dockResolved = this.harborDock.resolveCollision(boatPos, boatRadius);
    if (dockResolved) {
      boatPos.copy(dockResolved);
      if (boatSpeed > 10) {
        AudioManager.getInstance().playDockBump();
      }
    }

    // 3. Islands & Rocks Smooth Circle Colliders
    for (const island of this.islandColliders) {
      const dx = boatPos.x - island.x;
      const dy = boatPos.y - island.y;
      const minDist = island.radius + boatRadius;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        boatPos.x += nx * overlap;
        boatPos.y += ny * overlap;
        if (boatSpeed > 15) {
          AudioManager.getInstance().playDockBump();
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraPos: Vector2, viewWidth: number, viewHeight: number): void {
    // 1. Calculate camera visible AABB with 200px margin for culling
    const margin = 200;
    const halfW = viewWidth / 2 + margin;
    const halfH = viewHeight / 2 + margin;
    const minX = Math.max(0, cameraPos.x - halfW);
    const maxX = Math.min(this.width, cameraPos.x + halfW);
    const minY = Math.max(0, cameraPos.y - halfH);
    const maxY = Math.min(this.height, cameraPos.y + halfH);

    // 2. Update camera-anchored toroidal drift particles
    this.updateDriftParticles(0.016, cameraPos, viewWidth, viewHeight);

    // 3. Base Abyssal Water, Depth Zones, Bathymetry & Wave Crest Ribbons
    this.renderWaterZones(ctx, cameraPos, minX, maxX, minY, maxY, viewWidth, viewHeight);

    // 4. Camera-Anchored Toroidal Drift Particles (Velocity cues in open water)
    this.renderDriftParticles(ctx, minX, maxX, minY, maxY);

    // 5. Submerged Horrors (Writhing Tentacles & Bioluminescent Kelp Beds) with Viewport Culling
    this.renderSubmergedHorrors(ctx, minX, maxX, minY, maxY);

    // 6. Procedural Jagged Organic Shorelines & Landmasses with Viewport Culling
    this.renderOrganicIslands(ctx, minX, maxX, minY, maxY);

    // 7. Harbor Dock with Viewport Culling
    if (
      this.harborDock.position.x + 120 >= minX &&
      this.harborDock.position.x - 120 <= maxX &&
      this.harborDock.position.y + 120 >= minY &&
      this.harborDock.position.y - 120 <= maxY
    ) {
      this.harborDock.render(ctx);
    }

    // 8. Interactive Fishing Spots with Viewport Culling
    for (const spot of this.fishingSpots) {
      if (
        spot.position.x + 140 >= minX &&
        spot.position.x - 140 <= maxX &&
        spot.position.y + 140 >= minY &&
        spot.position.y - 140 <= maxY
      ) {
        spot.render(ctx);
      }
    }
  }

  private updateDriftParticles(dt: number, cameraPos: Vector2, viewWidth: number, viewHeight: number): void {
    const wrapW = viewWidth + 300;
    const wrapH = viewHeight + 300;

    for (const p of this.driftParticles) {
      // Ambient slow oceanic drift
      p.x += Math.cos(p.seed + this.time * 0.12) * p.speed * dt;
      p.y += (Math.sin(p.seed + this.time * 0.12) * 2 - 5) * dt;

      // Toroidal wrap around camera position
      const dx = p.x - cameraPos.x;
      if (dx < -wrapW / 2) {
        p.x += wrapW;
      } else if (dx > wrapW / 2) {
        p.x -= wrapW;
      }

      const dy = p.y - cameraPos.y;
      if (dy < -wrapH / 2) {
        p.y += wrapH;
      } else if (dy > wrapH / 2) {
        p.y -= wrapH;
      }
    }
  }

  private renderDriftParticles(
    ctx: CanvasRenderingContext2D,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    ctx.save();
    for (const p of this.driftParticles) {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        ctx.fillStyle = `rgba(186, 230, 253, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Directional motion tail for larger particles
        if (p.radius > 1.8) {
          ctx.strokeStyle = `rgba(147, 197, 253, ${p.alpha * 0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4, p.y + 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  private renderWaterZones(
    ctx: CanvasRenderingContext2D,
    cameraPos: Vector2,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    viewWidth: number,
    viewHeight: number
  ): void {
    // 1. Base Dynamic Water Fill across visible viewport rect derived from AtmosphereManager
    const camDist = Math.hypot(cameraPos.x - 4000, cameraPos.y - 4000);
    const atmoParams = this.atmosphereManager
      ? this.atmosphereManager.calculateAtmosphere(camDist)
      : AtmosphereManager.calculateAtmosphere(camDist);

    ctx.fillStyle = atmoParams.waterColor;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // 2. Concentric Radial Shallows to Abyss Gradient centered at Harbor (4000, 4000)
    const harborGrad = ctx.createRadialGradient(4000, 4000, 100, 4000, 4000, 4800);
    harborGrad.addColorStop(0, 'rgb(14, 52, 38)');     // Zone 1: Harbor Shallows (murky green)
    harborGrad.addColorStop(0.25, 'rgb(11, 40, 36)');  // Zone 1 Outer
    harborGrad.addColorStop(0.50, 'rgb(7, 25, 32)');   // Zone 2: Foggy Banks (dark teal)
    harborGrad.addColorStop(0.75, 'rgb(4, 9, 18)');    // Zone 3: Sunken Reefs (abyssal slate)
    harborGrad.addColorStop(1.0, 'rgb(1, 2, 4)');      // Zone 4: Eldritch Trench (pitch-black void)
    ctx.fillStyle = harborGrad;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // 3. Concentric Bathymetric Depth Contour Lines with Nautical Depth Markings
    this.renderBathymetryContours(ctx, cameraPos, minX, maxX, minY, maxY, viewWidth, viewHeight);

    // 4. Animated Sinusoidal Wave Crest Ribbons with Foam Caps
    this.renderWaveCrestRibbons(ctx, minX, maxX, minY, maxY);
  }

  private renderBathymetryContours(
    ctx: CanvasRenderingContext2D,
    cameraPos: Vector2,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    viewWidth: number,
    viewHeight: number
  ): void {
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

    const camDist = Math.hypot(cameraPos.x - 4000, cameraPos.y - 4000);
    const maxViewDist = Math.hypot(viewWidth / 2, viewHeight / 2) + 200;

    ctx.save();
    ctx.lineWidth = 1.6;

    for (const ring of depthRings) {
      // Viewport culling for concentric circles
      if (Math.abs(ring.radius - camDist) > maxViewDist) {
        continue;
      }

      // Draw dashed bathymetric isoline
      ctx.strokeStyle = ring.color;
      ctx.setLineDash(ring.dash);
      ctx.beginPath();
      ctx.arc(4000, 4000, ring.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Render nautical depth markings at 8 compass bearings
      ctx.setLineDash([]);
      ctx.fillStyle = ring.color;
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        const lx = 4000 + Math.cos(theta) * ring.radius;
        const ly = 4000 + Math.sin(theta) * ring.radius;

        if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(theta + Math.PI / 2);
          ctx.fillText(`— ${ring.depth} —`, 0, 0);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  private renderWaveCrestRibbons(
    ctx: CanvasRenderingContext2D,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    ctx.save();
    const t = this.time;
    const waveSpacing = 160;

    const startY = Math.floor(minY / waveSpacing) * waveSpacing - waveSpacing;
    const endY = Math.ceil(maxY / waveSpacing) * waveSpacing + waveSpacing;

    for (let wy = startY; wy <= endY; wy += waveSpacing) {
      const waveIdx = Math.round(wy / waveSpacing);
      const driftY = wy + ((t * 18 + waveIdx * 43) % waveSpacing);

      if (driftY < minY - 30 || driftY > maxY + 30) continue;

      const cAlpha = 0.12 + 0.06 * Math.sin(t * 0.9 + waveIdx * 1.3);
      ctx.strokeStyle = waveIdx % 2 === 0
        ? `rgba(94, 234, 212, ${cAlpha})`
        : `rgba(148, 163, 184, ${cAlpha * 0.85})`;
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      let firstPoint = true;

      for (let x = minX; x <= maxX; x += 40) {
        const wave =
          Math.sin(x * 0.007 + t * 0.8 + waveIdx * 1.5) * 16 +
          Math.cos(x * 0.016 - t * 0.5 + waveIdx) * 8;
        const y = driftY + wave;

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Render foam caps at sinusoidal wave peaks
      for (let x = minX + 20; x <= maxX - 20; x += 90) {
        const peakPhase = Math.sin(x * 0.007 + t * 0.8 + waveIdx * 1.5);
        if (peakPhase > 0.65) {
          const wave =
            peakPhase * 16 +
            Math.cos(x * 0.016 - t * 0.5 + waveIdx) * 8;
          const y = driftY + wave;
          const foamAlpha = ((peakPhase - 0.65) / 0.35) * 0.38;

          ctx.fillStyle = `rgba(204, 251, 241, ${foamAlpha})`;
          ctx.beginPath();
          ctx.ellipse(x, y - 1, 10, 2.4, 0.06, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${foamAlpha * 0.8})`;
          ctx.beginPath();
          ctx.ellipse(x, y - 1, 5, 1.2, 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private renderSubmergedHorrors(
    ctx: CanvasRenderingContext2D,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    ctx.save();

    // 1. Glowing Bioluminescent Kelp Patches beneath the water
    const kelpClusters = [
      { x: 3800, y: 3700, r: 65, color: '#10b981' },
      { x: 4250, y: 3600, r: 55, color: '#2dd4bf' },
      { x: 3400, y: 3200, r: 70, color: '#10b981' },
      { x: 4700, y: 4400, r: 80, color: '#38bdf8' },
      { x: 3600, y: 4500, r: 60, color: '#2dd4bf' }
    ];

    for (const kc of kelpClusters) {
      if (kc.x + kc.r < minX || kc.x - kc.r > maxX || kc.y + kc.r < minY || kc.y - kc.r > maxY) {
        continue;
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 1.8 + kc.x * 0.01);
      const kGrad = ctx.createRadialGradient(kc.x, kc.y, 4, kc.x, kc.y, kc.r);
      kGrad.addColorStop(0, `rgba(45, 212, 191, ${0.22 + pulse * 0.15})`);
      kGrad.addColorStop(0.5, `rgba(16, 185, 129, ${0.12 + pulse * 0.08})`);
      kGrad.addColorStop(1, 'rgba(4, 9, 20, 0)');
      ctx.fillStyle = kGrad;
      ctx.beginPath();
      ctx.arc(kc.x, kc.y, kc.r, 0, Math.PI * 2);
      ctx.fill();

      // Undulating submerged kelp fronds
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.35 + pulse * 0.25})`;
      ctx.lineWidth = 2.2;
      for (let f = 0; f < 5; f++) {
        const fx = kc.x - kc.r * 0.4 + f * (kc.r * 0.2);
        const fSway = Math.sin(this.time * 2.0 + fx * 0.05) * 14;
        ctx.beginPath();
        ctx.moveTo(fx, kc.y + 12);
        ctx.quadraticCurveTo(fx + fSway * 0.5, kc.y - 12, fx + fSway, kc.y - 28);
        ctx.stroke();
      }
    }

    // 2. Submerged Tentacle Silhouettes (Eldritch Horrors writhing in the abyss)
    for (const ten of this.submergedTentacles) {
      if (
        ten.baseX + ten.length * 1.5 < minX ||
        ten.baseX - ten.length * 1.5 > maxX ||
        ten.baseY + ten.length * 1.5 < minY ||
        ten.baseY - ten.length * 1.5 > maxY
      ) {
        continue;
      }
      const tProgress = this.time * 1.2 + ten.phaseOffset;
      const sway1 = Math.sin(tProgress) * 35;
      const sway2 = Math.cos(tProgress * 0.7) * 25;

      const startX = ten.baseX;
      const startY = ten.baseY;
      const midX = startX + Math.cos(ten.baseAngle) * (ten.length * 0.5) + sway1;
      const midY = startY + Math.sin(ten.baseAngle) * (ten.length * 0.5) + sway2;
      const tipX = startX + Math.cos(ten.baseAngle) * ten.length + sway1 * 1.5;
      const tipY = startY + Math.sin(ten.baseAngle) * ten.length + sway2 * 1.5;

      // Dark abyssal silhouette
      ctx.strokeStyle = 'rgba(2, 6, 12, 0.65)';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Inner faint bioluminescent spine glow along tentacle
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Suction cup dots along tentacle flank
      ctx.fillStyle = 'rgba(45, 212, 191, 0.25)';
      for (let s = 1; s <= 4; s++) {
        const st = s / 5;
        const sx = (1 - st) * (1 - st) * startX + 2 * (1 - st) * st * midX + st * st * tipX;
        const sy = (1 - st) * (1 - st) * startY + 2 * (1 - st) * st * midY + st * st * tipY;
        ctx.beginPath();
        ctx.arc(sx + 5, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderOrganicIslands(
    ctx: CanvasRenderingContext2D,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    // 1. Lake Outer Edge Shoreline Border (Craggy dark rock & decaying salt grass)
    // Only rendered if visible viewport overlaps the outer boundary
    if (minX <= 70 || maxX >= this.width - 70 || minY <= 70 || maxY >= this.height - 70) {
      ctx.save();
      ctx.strokeStyle = '#0b1210';
      ctx.lineWidth = 34;
      ctx.strokeRect(17, 17, this.width - 34, this.height - 34);

      ctx.strokeStyle = '#1d2b24'; // Murky shoreline fringe
      ctx.lineWidth = 14;
      ctx.strokeRect(32, 32, this.width - 64, this.height - 64);
      ctx.restore();
    }

    // 2. Procedural Jagged Multi-Band Islands & Coastlines with Viewport Culling
    for (const island of this.organicIslands) {
      // Cull island if outside visible viewport + margin
      if (
        island.center.x + island.radius * 1.3 < minX ||
        island.center.x - island.radius * 1.3 > maxX ||
        island.center.y + island.radius * 1.3 < minY ||
        island.center.y - island.radius * 1.3 > maxY
      ) {
        continue;
      }

      ctx.save();

      // Band A: Outer Submerged Shelf (Deep murky algae wash)
      ctx.fillStyle = island.type === 'sandbar' ? 'rgba(18, 36, 28, 0.65)' : 'rgba(5, 10, 16, 0.75)';
      ctx.beginPath();
      island.shelfPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();

      // Band B: Animated Pulsating Foam Outline lapping against the coast
      ctx.strokeStyle = 'rgba(167, 243, 208, 0.45)'; // Pale sea-scum foam
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      island.foamAngles.forEach((theta, idx) => {
        const pulse = Math.sin(this.time * 2.6 + theta * 5 + island.center.x * 0.01) * 3.5;
        const r = island.radius + 8 + pulse;
        const fx = island.center.x + Math.cos(theta) * r;
        const fy = island.center.y + Math.sin(theta) * r;
        if (idx === 0) ctx.moveTo(fx, fy);
        else ctx.lineTo(fx, fy);
      });
      ctx.closePath();
      ctx.stroke();

      // Band C: Mossy / Slimy Wet Mud Transition Ring
      ctx.fillStyle = island.type === 'sandbar' ? '#323d2b' : '#1e2b20';
      ctx.beginPath();
      island.mudPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();

      // Band D: Main Craggy Rock Interior (Jagged Basalt / Peat Core)
      if (island.type === 'sandbar') {
        ctx.fillStyle = '#3d4734'; // Murky peat sandbar
      } else if (island.type === 'rock') {
        ctx.fillStyle = '#161c22'; // Dark basalt crags
      } else {
        ctx.fillStyle = '#12171c'; // Innsmouth peninsula rock core
      }
      ctx.beginPath();
      island.rockPoints.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();

      // Band E: Rock Crest bevel / highlight
      ctx.strokeStyle = island.type === 'sandbar' ? '#4d5942' : '#28333c';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Internal Stone Fissures & Shadow Crevices
      ctx.strokeStyle = 'rgba(4, 8, 12, 0.75)';
      ctx.lineWidth = 2.0;
      for (const crev of island.crevices) {
        ctx.beginPath();
        ctx.moveTo(crev.start.x, crev.start.y);
        ctx.lineTo(crev.end.x, crev.end.y);
        ctx.stroke();
      }

      // Render Island Decorations (Trees, Monoliths, Planks, Barnacles)
      for (const dec of island.decorations) {
        ctx.save();
        ctx.translate(dec.x, dec.y);
        ctx.rotate(dec.rotation);
        ctx.scale(dec.scale, dec.scale);

        if (dec.type === 'tree') {
          // Gnarled dead pine tree with crooked twisted branches & shadow
          ctx.fillStyle = 'rgba(2, 5, 8, 0.55)'; // Drop shadow
          ctx.beginPath();
          ctx.arc(4, 5, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#08110b'; // Deep dark pine canopy
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#112217'; // Inner foliage highlight
          ctx.beginPath();
          ctx.arc(-3, -3, 10, 0, Math.PI * 2);
          ctx.fill();

          // Twisted dead branch sticking out
          ctx.strokeStyle = '#2b1c11';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(18, -12);
          ctx.lineTo(24, -9);
          ctx.stroke();
        } else if (dec.type === 'plank') {
          // Rotting jetty planks & collapsed driftwood
          ctx.fillStyle = '#261e16';
          ctx.fillRect(-12, -3.5, 24, 7);
          ctx.strokeStyle = '#140f0b';
          ctx.lineWidth = 1;
          ctx.strokeRect(-12, -3.5, 24, 7);
          // Rusted iron nail dots
          ctx.fillStyle = '#b45309';
          ctx.fillRect(-8, -1, 1.5, 1.5);
          ctx.fillRect(7, -1, 1.5, 1.5);
        } else if (dec.type === 'monolith') {
          // Sunken Cyclopean Basalt Monolith / Ruin Pillar with Glowing Runes
          ctx.fillStyle = '#080d14';
          ctx.beginPath();
          ctx.moveTo(-12, 18);
          ctx.lineTo(-6, -26);
          ctx.lineTo(10, -26);
          ctx.lineTo(14, 18);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#182430';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // Glowing eldritch runes carved into the basalt
          ctx.strokeStyle = '#2dd4bf';
          ctx.shadowColor = '#2dd4bf';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -18);
          ctx.lineTo(4, -8);
          ctx.lineTo(-2, 4);
          ctx.moveTo(-5, -6);
          ctx.lineTo(7, -6);
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (dec.type === 'barnacles') {
          // Salt-crusted barnacle specks along rock crest
          ctx.fillStyle = '#cbd5e1';
          for (let b = 0; b < 6; b++) {
            const bx = Math.sin(b * 1.8) * (island.radius * 0.45);
            const by = Math.cos(b * 2.3) * (island.radius * 0.45);
            ctx.beginPath();
            ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      ctx.restore();
    }

    // 3. Shallows Dead Reeds & Rotting Eel-Grass Beds
    ctx.save();
    const reedClusters = [
      { x: 3600, y: 3800 }, { x: 3700, y: 3900 }, { x: 4200, y: 3800 },
      { x: 4300, y: 3950 }, { x: 3800, y: 3600 }, { x: 4150, y: 3650 }
    ];

    for (const c of reedClusters) {
      if (c.x < minX || c.x > maxX || c.y < minY || c.y > maxY) {
        continue;
      }
      const sway = Math.sin(this.time * 2.2 + c.x * 0.05) * 4.5;
      ctx.strokeStyle = '#2b3d28'; // Decaying swamp reed green
      ctx.lineWidth = 2.4;

      for (let i = -3; i <= 3; i++) {
        const rx = c.x + i * 5;
        const ry = c.y + Math.abs(i) * 3;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.quadraticCurveTo(rx + sway * (i + 1) * 0.3, ry - 14, rx + sway, ry - 24);
        ctx.stroke();

        // Dark decayed reed head
        ctx.fillStyle = '#1c150e';
        ctx.fillRect(rx + sway - 1.5, ry - 22, 3, 6);
      }
    }
    ctx.restore();
  }
}
