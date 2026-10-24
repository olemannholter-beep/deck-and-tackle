import { Vector2 } from '../../engine/Vector2';
import { FishingSpot } from './FishingSpot';
import type { WaterZoneType } from './FishingSpot';
import { HarborDock } from './HarborDock';
import { AudioManager } from '../../engine/AudioManager';

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

export class OverworldMap {
  public readonly width: number = 2400;
  public readonly height: number = 1800;

  public harborDock: HarborDock;
  public fishingSpots: FishingSpot[] = [];
  public islandColliders: IslandCollider[] = [];

  // Precomputed organic island geometries (completely replaces flat circular primitives)
  private organicIslands: OrganicIsland[] = [];

  // Submerged deep-water horror silhouettes (tentacles writhing in the abyss)
  private submergedTentacles: SubmergedTentacle[] = [];

  // World lanterns that cast dynamic light pools into the darkness
  public readonly worldLanterns: WorldLantern[] = [
    { x: 356, y: 1450, radius: 180, color: '#fef08a' }, // Harbor Dock Gas Lantern
    { x: 1060, y: 930, radius: 170, color: '#6ee7b7' }, // Central Pine Island Shrine Lantern
    { x: 1940, y: 640, radius: 160, color: '#38bdf8' }, // East Rocky Spire Beacon
    { x: 480, y: 1540, radius: 150, color: '#f59e0b' }  // Quayside Shore Outpost Lantern
  ];

  private time: number = 0;

  constructor() {
    // 1. Setup Harbor Dock at a sheltered bay in the south-west
    this.harborDock = new HarborDock(400, 1450);

    // 2. Setup Islands and Shoreline Colliders
    this.setupColliders();

    // 3. Generate organic jagged island geometry & decorations
    this.generateOrganicIslands();

    // 4. Setup deep-water submerged tentacle silhouettes
    this.setupSubmergedTentacles();

    // 5. Setup Fishing Spots across the 3 distinct depth zones
    this.setupFishingSpots();
  }

  private setupColliders(): void {
    // Colliders keep physics smooth while matching the organic jagged visual footprints
    this.islandColliders = [
      // Harbor mainland peninsula coast colliders
      { x: 200, y: 1550, radius: 160, type: 'island' },
      { x: 400, y: 1620, radius: 140, type: 'island' },
      { x: 600, y: 1560, radius: 150, type: 'island' },

      // Central Pine Island
      { x: 1050, y: 950, radius: 120, type: 'island' },
      { x: 1180, y: 920, radius: 95, type: 'island' },
      { x: 1130, y: 1040, radius: 85, type: 'island' },

      // North-West Reed Sandbar islets
      { x: 450, y: 450, radius: 75, type: 'sandbar' },
      { x: 620, y: 350, radius: 60, type: 'sandbar' },
      { x: 300, y: 580, radius: 80, type: 'sandbar' },

      // East Rocky Spire
      { x: 1950, y: 650, radius: 90, type: 'rock' },
      { x: 2050, y: 720, radius: 70, type: 'rock' },

      // Trench Barrier Reef (South-East)
      { x: 1600, y: 1350, radius: 80, type: 'rock' },
      { x: 1720, y: 1460, radius: 75, type: 'rock' }
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
      { baseX: 1800, baseY: 1250, length: 140, phaseOffset: 0, baseAngle: -0.4 },
      { baseX: 1980, baseY: 1520, length: 160, phaseOffset: 2.1, baseAngle: 0.6 },
      { baseX: 1480, baseY: 920, length: 120, phaseOffset: 4.3, baseAngle: -1.2 },
      { baseX: 1650, baseY: 1400, length: 135, phaseOffset: 1.4, baseAngle: 1.8 }
    ];
  }

  private setupFishingSpots(): void {
    // Spot 1: Innsmouth Shoals (North-West)
    this.fishingSpots.push(
      new FishingSpot({
        id: 'spot_shallow_1',
        name: 'Innsmouth Shoals (Shallow Shoals)',
        position: new Vector2(520, 520),
        zoneType: 'shallow',
        speciesType: 'perch',
        description: 'Murky brackish shallows choked with rotting eel-grass. Uncanny Innsmouth Perch lurk in the gloom.'
      })
    );

    // Spot 2: The Drowned Sound (Central / North-East)
    this.fishingSpots.push(
      new FishingSpot({
        id: 'spot_lake_1',
        name: 'The Drowned Sound (Foggy Waters)',
        position: new Vector2(1450, 780),
        zoneType: 'lake',
        speciesType: 'pike',
        description: 'Cold slate-grey waters shrouded in maritime mist. The vicious Blighted Pike patrols near sunken timbers.'
      })
    );

    // Spot 3: Devil’s Reef Chasm (South-East)
    this.fishingSpots.push(
      new FishingSpot({
        id: 'spot_abyss_1',
        name: 'Devil’s Reef Chasm (Sunken Abyss)',
        position: new Vector2(1950, 1400),
        zoneType: 'abyss',
        speciesType: 'gar',
        description: 'A lightless abyss descending into sunken cyclopean ruins. The titanic Abyssal Void-Gar stirs below.'
      })
    );

    // Spot 4: The Sunken Ruin of Dagon (Boss Chasm)
    this.fishingSpots.push(
      new FishingSpot({
        id: 'spot_abyss_2',
        name: 'The Sunken Ruin of Dagon (Boss Chasm)',
        position: new Vector2(2150, 850),
        zoneType: 'cave',
        speciesType: 'dagon',
        description: 'Cyclopean basalt ruins submerged in pitch black brine. The primordial monstrosity Apex Dagon slumbers here.'
      })
    );
  }

  public getZoneAt(pos: Vector2): WaterZoneType {
    if (pos.x < 900 && pos.y < 900) {
      return 'shallow';
    } else if (pos.x > 1450 && pos.y > 1050) {
      return 'abyss';
    }
    return 'lake';
  }

  public getZoneDisplayName(zone: WaterZoneType): string {
    switch (zone) {
      case 'shallow': return 'Innsmouth Shoals (Tier 1)';
      case 'lake': return 'The Drowned Sound (Tier 2)';
      case 'abyss': return 'Devil’s Reef Chasm (Tier 3)';
      case 'cave': return 'The Sunken Ruin of Dagon (Tier 4)';
    }
  }

  public update(dt: number, boatPos: Vector2): void {
    this.time += dt;

    // Update dock
    this.harborDock.update(dt, boatPos);

    // Update fishing spots
    for (const spot of this.fishingSpots) {
      spot.update(dt, boatPos);
    }
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

  public render(ctx: CanvasRenderingContext2D, _cameraPos: Vector2, _viewWidth: number, _viewHeight: number): void {
    // 1. Base Abyssal Water, Depth Zones & Caustic Drift
    this.renderWaterZones(ctx);

    // 2. Submerged Horrors (Writhing Tentacles & Bioluminescent Kelp Beds)
    this.renderSubmergedHorrors(ctx);

    // 3. Procedural Jagged Organic Shorelines & Landmasses
    this.renderOrganicIslands(ctx);

    // 4. Harbor Dock
    this.harborDock.render(ctx);

    // 5. Interactive Fishing Spots (Swirling Eldritch Vortexes)
    for (const spot of this.fishingSpots) {
      spot.render(ctx);
    }
  }

  private renderWaterZones(ctx: CanvasRenderingContext2D): void {
    // 1. Base Midnight-Abyss Navy (#040914)
    ctx.fillStyle = '#040914';
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Innsmouth Shoals (North-West) - Shallow turquoise-scum edges fading into dark water
    const shallowGrad = ctx.createRadialGradient(260, 260, 60, 520, 520, 850);
    shallowGrad.addColorStop(0, '#0e2b24'); // Shallow murky turquoise scum
    shallowGrad.addColorStop(0.45, '#091c18');
    shallowGrad.addColorStop(0.85, '#061313');
    shallowGrad.addColorStop(1, 'rgba(4, 9, 20, 0)');
    ctx.fillStyle = shallowGrad;
    ctx.fillRect(0, 0, 1150, 1150);

    // 3. Devil's Reef Chasm (South-East) - Pitch-black abyssal core (#010307)
    const abyssGrad = ctx.createRadialGradient(1950, 1450, 60, 1950, 1450, 820);
    abyssGrad.addColorStop(0, '#010307'); // Lightless void core
    abyssGrad.addColorStop(0.5, '#020610');
    abyssGrad.addColorStop(0.85, '#040a17');
    abyssGrad.addColorStop(1, 'rgba(4, 9, 20, 0)');
    ctx.fillStyle = abyssGrad;
    ctx.fillRect(1150, 800, 1250, 1000);

    // 4. Trench Bathymetry Contour Lines with Eldritch dashed runes
    ctx.save();
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)'; // Eerie cyan-green bathymetry
    ctx.lineWidth = 1.6;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.ellipse(1950, 1420, 440, 310, 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(1950, 1420, 290, 200, 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(1950, 1420, 155, 110, 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 5. Animated Caustic Drift (Subtle, winding wave highlight lines with alpha 0.15–0.25)
    ctx.save();
    const t = this.time;
    for (let c = 0; c < 5; c++) {
      const cAlpha = 0.14 + 0.08 * Math.sin(t * 0.8 + c * 1.5);
      ctx.strokeStyle = c % 2 === 0
        ? `rgba(94, 234, 212, ${cAlpha})`
        : `rgba(148, 163, 184, ${cAlpha * 0.85})`;
      ctx.lineWidth = 1.6;

      const driftY = ((c * 340 + t * 14) % (this.height + 200)) - 100;
      ctx.beginPath();
      for (let x = 0; x <= this.width; x += 60) {
        const wave =
          Math.sin(x * 0.008 + t * 0.6 + c) * 22 +
          Math.cos(x * 0.018 - t * 0.4 + c * 2) * 12;
        const y = driftY + wave;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderSubmergedHorrors(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Glowing Bioluminescent Kelp Patches beneath the water
    const kelpClusters = [
      { x: 420, y: 720, r: 65, color: '#10b981' },
      { x: 780, y: 480, r: 55, color: '#2dd4bf' },
      { x: 1350, y: 580, r: 70, color: '#10b981' },
      { x: 1720, y: 1050, r: 80, color: '#38bdf8' },
      { x: 1480, y: 1250, r: 60, color: '#2dd4bf' }
    ];

    for (const kc of kelpClusters) {
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

  private renderOrganicIslands(ctx: CanvasRenderingContext2D): void {
    // 1. Lake Outer Edge Shoreline Border (Craggy dark rock & decaying salt grass)
    ctx.save();
    ctx.strokeStyle = '#0b1210';
    ctx.lineWidth = 34;
    ctx.strokeRect(17, 17, this.width - 34, this.height - 34);

    ctx.strokeStyle = '#1d2b24'; // Murky shoreline fringe
    ctx.lineWidth = 14;
    ctx.strokeRect(32, 32, this.width - 64, this.height - 64);
    ctx.restore();

    // 2. Procedural Jagged Multi-Band Islands & Coastlines
    for (const island of this.organicIslands) {
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

    // 3. Innsmouth Shoals Dead Reeds & Rotting Eel-Grass Beds (North-West)
    ctx.save();
    const reedClusters = [
      { x: 380, y: 390 }, { x: 420, y: 560 }, { x: 580, y: 410 },
      { x: 680, y: 510 }, { x: 320, y: 480 }, { x: 490, y: 640 }
    ];

    for (const c of reedClusters) {
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
