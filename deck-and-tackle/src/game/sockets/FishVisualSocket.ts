import { VisualSocket } from '../../engine/VisualSocket';
import { Vector2 } from '../../engine/Vector2';
import type { SpeciesType } from '../battle/FishData';

export interface FishRenderData {
  time: number;
  speciesType: SpeciesType | 'generic';
  depthMeters: number;
  thrashAmount?: number; // 0 to 1
  swimSpeed?: number;
}

export class FishVisualSocket extends VisualSocket<FishRenderData> {
  // Mouth hook socket in local coordinates (facing left toward boat: mouth is at -X)
  public mouthSocket: Vector2 = new Vector2(-36, 0);

  // Static Image Cache for Sliced Sprites
  private static spriteMap: Map<string, HTMLImageElement> = new Map();
  private static spritesLoaded: boolean = false;

  constructor() {
    super('fish_visual_socket');
    FishVisualSocket.initSprites();
  }

  public static readonly SPECIES_VISUAL_CONFIGS: Record<SpeciesType, {
    w: number;
    h: number;
    mouthX: number;
    mouthY: number;
    spritePath: string;
    glowColor?: string;
  }> = {
    // Zone 1
    perch: {
      w: 140,
      h: 70,
      mouthX: -58,
      mouthY: 2,
      spritePath: '/assets/sprites/fishing/fish_shadowy_perch_s6.png'
    },
    flounder: {
      w: 150,
      h: 80,
      mouthX: -65,
      mouthY: 4,
      spritePath: '/assets/sprites/fishing/fish_flounder_benthic.png'
    },
    ghost_cod: {
      w: 160,
      h: 80,
      mouthX: -70,
      mouthY: 0,
      spritePath: '/assets/sprites/fishing/fish_gray_cod.png',
      glowColor: 'rgba(226, 232, 240, 0.40)'
    },

    // Zone 2
    pike: {
      w: 180,
      h: 90,
      mouthX: -76,
      mouthY: 2,
      spritePath: '/assets/sprites/fishing/fish_brown_mutant.png'
    },
    sculpin: {
      w: 170,
      h: 95,
      mouthX: -72,
      mouthY: 5,
      spritePath: '/assets/sprites/fishing/fish_spiky_sculpin.png'
    },
    teal_snapper: {
      w: 180,
      h: 95,
      mouthX: -78,
      mouthY: -2,
      spritePath: '/assets/sprites/fishing/fish_teal_snapper.png',
      glowColor: 'rgba(45, 212, 191, 0.65)'
    },

    // Zone 3
    gar: {
      w: 220,
      h: 110,
      mouthX: -94,
      mouthY: -2,
      spritePath: '/assets/sprites/fishing/fish_abyssal_eel.png',
      glowColor: 'rgba(56, 189, 248, 0.60)'
    },
    angler: {
      w: 210,
      h: 130,
      mouthX: -90,
      mouthY: 6,
      spritePath: '/assets/sprites/fishing/fish_angler_pale_lure.png',
      glowColor: 'rgba(254, 240, 138, 0.65)'
    },
    gulper: {
      w: 230,
      h: 120,
      mouthX: -100,
      mouthY: 4,
      spritePath: '/assets/sprites/fishing/fish_visceral_gut_swollen.png',
      glowColor: 'rgba(244, 63, 94, 0.50)'
    },

    // Zone 4
    maw_worm: {
      w: 260,
      h: 140,
      mouthX: -115,
      mouthY: 0,
      spritePath: '/assets/sprites/fishing/leviathan_abyssal_maw_worm.png',
      glowColor: 'rgba(249, 115, 22, 0.60)'
    },
    cthulhu_spawn: {
      w: 280,
      h: 160,
      mouthX: -120,
      mouthY: 8,
      spritePath: '/assets/sprites/fishing/fish_cthulhu_tentacled.png',
      glowColor: 'rgba(168, 85, 247, 0.70)'
    },
    dagon: {
      w: 340,
      h: 220,
      mouthX: -145,
      mouthY: 14,
      spritePath: '/assets/sprites/fishing/leviathan_apex_dagon.png',
      glowColor: 'rgba(56, 189, 248, 0.75)'
    }
  };

  public static getSprite(species: string): HTMLImageElement | undefined {
    return FishVisualSocket.spriteMap.get(species);
  }

  public static getSpeciesVisualConfig(species: SpeciesType | string) {
    if (species in FishVisualSocket.SPECIES_VISUAL_CONFIGS) {
      return FishVisualSocket.SPECIES_VISUAL_CONFIGS[species as SpeciesType];
    }
    return {
      w: 140,
      h: 70,
      mouthX: -58,
      mouthY: 2,
      spritePath: '/assets/sprites/fishing/fish_shadowy_perch_s6.png'
    };
  }

  private static initSprites(): void {
    if (FishVisualSocket.spritesLoaded) return;
    FishVisualSocket.spritesLoaded = true;

    for (const [key, cfg] of Object.entries(FishVisualSocket.SPECIES_VISUAL_CONFIGS)) {
      const img = new Image();
      img.src = cfg.spritePath;
      FishVisualSocket.spriteMap.set(key, img);
    }
  }

  protected renderPlaceholder(ctx: CanvasRenderingContext2D, data: FishRenderData): void {
    const t = data ? data.time : 0;
    const species = data ? data.speciesType : 'generic';
    const thrash = data ? (data.thrashAmount ?? 0) : 0;

    // Tail wave frequency and amplitude scale with thrashing
    const tailFreq = 5.5 + thrash * 14;
    const tailAmp = 6 + thrash * 15;

    // Multi-harmonic articulated spine calculations (head, mid-body, caudal, tail)
    const spineWave1 = Math.sin(t * tailFreq) * tailAmp;
    const spineWave2 = Math.sin(t * tailFreq - 1.2) * (tailAmp * 0.7);
    const spineWave3 = Math.sin(t * tailFreq - 2.3) * (tailAmp * 0.35);

    // Nervous fin twitching (occasional rapid spasms)
    const finJitter = Math.sin(t * 26) * (thrash > 0.5 ? 4.5 : 1.8) + (Math.random() < 0.08 ? (Math.random() - 0.5) * 5 : 0);

    // Eerie bioluminescent pulse
    const bioPulse = 0.5 + 0.5 * Math.sin(t * 3.5);

    // Check if high-resolution sliced sprite is loaded
    const spriteImg = FishVisualSocket.spriteMap.get(species);
    if (spriteImg && spriteImg.complete && spriteImg.naturalWidth > 0) {
      ctx.save();

      // Configure dimensions and mouth socket per species
      const visualConfig = FishVisualSocket.getSpeciesVisualConfig(species);
      const w = visualConfig.w;
      const h = visualConfig.h;
      this.mouthSocket.set(visualConfig.mouthX, visualConfig.mouthY);

      // Swimming undulating body oscillation
      const bodySway = Math.sin(t * 3.0) * (thrash > 0.5 ? 8 : 3.5);
      const bodyTilt = Math.cos(t * 2.5) * (thrash > 0.5 ? 0.12 : 0.04);
      ctx.translate(0, bodySway);
      ctx.rotate(bodyTilt);

      // Bioluminescent glow aura
      if (visualConfig.glowColor) {
        ctx.shadowColor = visualConfig.glowColor;
        ctx.shadowBlur = 18 * bioPulse;
      }

      // Sprite faces left toward boat
      ctx.scale(-1, 1);
      ctx.drawImage(spriteImg, -w / 2, -h / 2, w, h);

      ctx.restore();
      return;
    }

    ctx.save();

    if (species === 'perch') {
      this.renderInnsmouthPerch(ctx, t, thrash, spineWave1, spineWave2, spineWave3, finJitter, bioPulse);
    } else if (species === 'pike') {
      this.renderBlightedPike(ctx, t, thrash, spineWave1, spineWave2, spineWave3, finJitter, bioPulse);
    } else if (species === 'gar' || species === 'dagon') {
      this.renderAbyssalVoidGar(ctx, t, thrash, spineWave1, spineWave2, spineWave3, finJitter, bioPulse);
    } else {
      this.renderGenericEldritch(ctx, t, thrash, spineWave1, spineWave2, bioPulse);
    }

    ctx.restore();
  }

  /**
   * Innsmouth Perch: Grotesque hunched beast with jagged venomous spines,
   * multiple uncanny human-like bulbous eyes along its flank, writhing chin barbels, and razor teeth.
   */
  private renderInnsmouthPerch(
    ctx: CanvasRenderingContext2D,
    t: number,
    thrash: number,
    w1: number,
    w2: number,
    w3: number,
    finJitter: number,
    bioPulse: number
  ): void {
    const length = 44;
    const height = 24;
    this.mouthSocket.set(-length * 0.85, 4);

    const bodyBase = '#1c2818'; // Sickly dark marsh green
    const bodyBelly = '#82916b'; // Pale cadaverous bile-yellow
    const finDark = '#3d341b'; // Tarnished muddy brown

    // 1. Writhing Chin Barbels / Tentacle feelers under jaw
    ctx.strokeStyle = '#5a6b47';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      const barbelPhase = t * 4 + i * 1.5;
      const bEndX = -length * 0.75 - i * 4 + Math.sin(barbelPhase) * 6;
      const bEndY = 12 + i * 4 + Math.cos(barbelPhase) * 5;
      ctx.beginPath();
      ctx.moveTo(-length * 0.75 + i * 3, 5);
      ctx.quadraticCurveTo(-length * 0.7, 10, bEndX, bEndY);
      ctx.stroke();
    }

    // 2. Venomous Spiny Dorsal Fin (Jagged, torn webbing between toxic quills)
    ctx.fillStyle = finDark;
    ctx.strokeStyle = '#121a10';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-length * 0.15, -height * 0.65 + w3 * 0.3);
    const spines = [
      { x: -length * 0.05, h: -height * 1.6 },
      { x: length * 0.12, h: -height * 1.1 },
      { x: length * 0.28, h: -height * 1.8 },
      { x: length * 0.42, h: -height * 1.2 },
      { x: length * 0.58, h: -height * 1.5 },
      { x: length * 0.68, h: -height * 0.7 }
    ];
    for (const sp of spines) {
      ctx.lineTo(sp.x, sp.h + finJitter);
    }
    ctx.lineTo(length * 0.72, -height * 0.3 + w2 * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Toxic spine tips (sickly bile green glowing tips)
    ctx.fillStyle = '#bef264';
    for (const sp of spines) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.h + finJitter, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Pelvic & Anal Fins
    ctx.fillStyle = finDark;
    ctx.beginPath();
    ctx.moveTo(length * 0.05, height * 0.55 + w3 * 0.3);
    ctx.lineTo(length * 0.18, height * 1.25 + finJitter);
    ctx.lineTo(length * 0.35, height * 0.4 + w2 * 0.4);
    ctx.closePath();
    ctx.fill();

    // 4. Hunched Asymmetrical Body with Articulated Spine Flex
    ctx.beginPath();
    ctx.moveTo(-length * 0.85, 3); // Underhung snout / jaw
    // Hunched humpback curve
    ctx.bezierCurveTo(-length * 0.45, -height * 1.25 + w3 * 0.3, length * 0.2, -height * 1.1 + w2, length * 0.7, -height * 0.25 + w1 * 0.6);
    // Caudal peduncle to tail base
    ctx.lineTo(length * 0.95, w1);
    ctx.lineTo(length * 0.7, height * 0.25 + w1 * 0.6);
    // Distended, bloated belly
    ctx.bezierCurveTo(length * 0.2, height * 1.1 + w2, -length * 0.4, height * 1.2 + w3 * 0.3, -length * 0.85, 3);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(0, -height, 0, height);
    bodyGrad.addColorStop(0, '#10170e');
    bodyGrad.addColorStop(0.4, bodyBase);
    bodyGrad.addColorStop(1, bodyBelly);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#090d08';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Caudal Tail Fin (Torn, asymmetrical Victorian Innsmouth tail)
    ctx.fillStyle = finDark;
    ctx.beginPath();
    ctx.moveTo(length * 0.95, w1);
    ctx.lineTo(length * 1.35, w1 - 16 + finJitter);
    ctx.lineTo(length * 1.15, w1);
    ctx.lineTo(length * 1.4, w1 + 18 + finJitter);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. Innsmouth Perch Tiger Camouflage & Muted Slime Spots
    ctx.strokeStyle = 'rgba(16, 26, 14, 0.75)';
    ctx.lineWidth = 2.5;
    const stripes = [-length * 0.4, -length * 0.15, length * 0.1, length * 0.35];
    for (const sx of stripes) {
      ctx.beginPath();
      ctx.moveTo(sx, -height * 0.5 + w2 * 0.3);
      ctx.quadraticCurveTo(sx + 4, 0, sx - 2, height * 0.5 + w2 * 0.3);
      ctx.stroke();
    }

    // 6. Gaping Maw & Jagged Razor Teeth
    const jawGape = thrash * 5;
    ctx.fillStyle = '#0f1710';
    ctx.beginPath();
    ctx.moveTo(-length * 0.85, 3);
    ctx.lineTo(-length * 0.65, 5 + jawGape * 0.5);
    ctx.lineTo(-length * 0.8, 8 + jawGape);
    ctx.closePath();
    ctx.fill();

    // Needle teeth
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-length * 0.82, 3);
    ctx.lineTo(-length * 0.80, 5.5);
    ctx.moveTo(-length * 0.75, 4);
    ctx.lineTo(-length * 0.73, 6.5);
    ctx.moveTo(-length * 0.69, 5);
    ctx.lineTo(-length * 0.71, 7);
    ctx.stroke();

    // 7. Multiple Uncanny Bulbous Human-like Eyes along head & flank
    // Primary large glassy eye with uncanny iris
    const eye1X = -length * 0.62;
    const eye1Y = -height * 0.15;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#450a0a'; // Bloodshot rim
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Dilated slit pupil that pulses
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(eye1X, eye1Y, 1.8 + bioPulse * 0.8, 4.2, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Glassy glint
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(eye1X - 2, eye1Y - 2.5, 1.5, 1.5);

    // Secondary mutated eye #2 (above primary)
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(eye1X + 8, eye1Y - 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eye1X + 8, eye1Y - 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Tertiary mutated blind ocular pustule #3 (behind eye)
    ctx.fillStyle = `rgba(190, 242, 100, ${0.4 + bioPulse * 0.5})`;
    ctx.beginPath();
    ctx.arc(eye1X + 16, eye1Y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Blighted Pike: Skeletal, elongated serpentine nightmare.
   * Exposed rib bones and spine vertebrae protruding through decayed flesh,
   * rows of oversized fangs, pulsing pale emerald sensory dots along the lateral line.
   */
  private renderBlightedPike(
    ctx: CanvasRenderingContext2D,
    t: number,
    thrash: number,
    w1: number,
    w2: number,
    w3: number,
    finJitter: number,
    bioPulse: number
  ): void {
    const length = 58;
    const height = 15;
    this.mouthSocket.set(-length * 0.92, 0);

    const bodyDark = '#1e242b'; // Slate-ash decaying flesh
    const bodyPale = '#64748b'; // Cold drowned grey

    // 1. Spasmodic Dorsal & Anal fins set far back near the tail
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(length * 0.45, -height * 0.5 + w2 * 0.4);
    ctx.lineTo(length * 0.65, -height * 1.5 + finJitter);
    ctx.lineTo(length * 0.78, -height * 0.3 + w1 * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(length * 0.45, height * 0.5 + w2 * 0.4);
    ctx.lineTo(length * 0.65, height * 1.5 + finJitter);
    ctx.lineTo(length * 0.78, height * 0.3 + w1 * 0.5);
    ctx.closePath();
    ctx.fill();

    // 2. Elongated Serpentine Body with Rib Cage Cavity
    ctx.beginPath();
    ctx.moveTo(-length * 0.92, 0); // Narrow duckbill snout
    // Top spine profile
    ctx.bezierCurveTo(-length * 0.5, -height * 0.9 + w3 * 0.2, length * 0.1, -height * 0.8 + w2 * 0.6, length * 0.85, w1 * 0.8);
    // Forked Caudal Tail
    ctx.lineTo(length * 1.3, w1 - 15 + finJitter);
    ctx.lineTo(length * 1.05, w1);
    ctx.lineTo(length * 1.3, w1 + 15 + finJitter);
    ctx.lineTo(length * 0.85, w1 * 0.8);
    // Belly profile with sunken skeletal cavity
    ctx.bezierCurveTo(length * 0.1, height * 0.8 + w2 * 0.6, -length * 0.5, height * 0.85 + w3 * 0.2, -length * 0.92, 0);
    ctx.closePath();

    const pikeGrad = ctx.createLinearGradient(0, -height, 0, height);
    pikeGrad.addColorStop(0, '#090d12');
    pikeGrad.addColorStop(0.5, bodyDark);
    pikeGrad.addColorStop(1, bodyPale);
    ctx.fillStyle = pikeGrad;
    ctx.fill();
    ctx.strokeStyle = '#04070a';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 3. Exposed Ribs & Vertebrae Protruding along the Flank
    ctx.strokeStyle = '#cbd5e1'; // Bleached bone
    ctx.lineWidth = 1.5;
    for (let rx = -length * 0.35; rx <= length * 0.3; rx += 7) {
      const ribH = height * 0.55;
      const flexY = (rx / length) * w2 * 0.4;
      ctx.beginPath();
      ctx.moveTo(rx, -ribH + flexY);
      ctx.quadraticCurveTo(rx + 3, flexY, rx - 1, ribH + flexY);
      ctx.stroke();

      // Exposed bone tip breaking through back flesh
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(rx - 1, -ribH + flexY - 2, 2, 2.5);
    }

    // 4. Bioluminescent Sensory Pustules along Lateral Line (Pulsing sickly pale emerald)
    for (let lx = -length * 0.55; lx <= length * 0.65; lx += 8) {
      const ly = (lx / length) * w2 * 0.5;
      ctx.fillStyle = `rgba(110, 231, 183, ${0.45 + bioPulse * 0.55})`;
      ctx.beginPath();
      ctx.arc(lx, ly, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Vicious Needle-Sharp Fangs protruding from Duckbill Jaw (Thrashing vibration)
    const fangJitter = Math.sin(t * 28) * thrash * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    for (let tx = -length * 0.88; tx <= -length * 0.45; tx += 4.5) {
      ctx.beginPath();
      ctx.moveTo(tx, -1);
      ctx.lineTo(tx + 1.2, 5 + (tx % 3) + fangJitter); // Jagged protruding lower teeth
      ctx.stroke();
    }

    // 6. Dead Cold Eye (Milky cataract orb with tiny pinprick center)
    const pikeEyeX = -length * 0.72;
    const pikeEyeY = -height * 0.22;
    ctx.fillStyle = '#e2e8f0'; // Cataract milk white
    ctx.beginPath();
    ctx.arc(pikeEyeX, pikeEyeY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(pikeEyeX, pikeEyeY, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Abyssal Void-Gar: Titanic cyclopean obsidian predator.
   * Geometric obsidian scutes etched with pulsating cyan runes (#38bdf8),
   * glowing vertical slit eye, writhing deep-sea tendrils extending from gill plates.
   */
  private renderAbyssalVoidGar(
    ctx: CanvasRenderingContext2D,
    t: number,
    thrash: number,
    w1: number,
    w2: number,
    w3: number,
    finJitter: number,
    bioPulse: number
  ): void {
    const length = 68;
    const height = 17;
    this.mouthSocket.set(-length * 0.95, 0);

    // 1. Writhing Abyssal Deep-Sea Tendrils from Ventral & Gills (Eldritch Tentacles lash violently on thrash)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const tenPhase = t * (3.2 + thrash * 5) + i * 1.8;
      const startX = -length * 0.3 + i * 14;
      const startY = height * 0.5;
      const tendrilSpread = 12 + thrash * 10;
      const endX = startX - 18 + Math.sin(tenPhase) * tendrilSpread;
      const endY = startY + 22 + Math.cos(tenPhase) * tendrilSpread;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(startX - 5, startY + 10, endX + 8, endY - 6, endX, endY);
      ctx.stroke();

      // Glowing eldritch tip
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(endX, endY, 2 + thrash * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Heavy Armored Obsidian Hull Body (Diamond Ganoid Scales)
    ctx.beginPath();
    ctx.moveTo(-length * 0.95, 0); // Extended beak snout
    // Armored dorsal ridge
    ctx.bezierCurveTo(-length * 0.5, -height + w3 * 0.2, length * 0.2, -height * 0.85 + w2 * 0.5, length * 0.85, w1 * 0.7);
    // Asymmetric Abyssal Caudal Fin (Heterocercal shark/gar tail)
    ctx.lineTo(length * 1.35, w1 - 22 + finJitter);
    ctx.lineTo(length * 1.1, w1 - 2);
    ctx.lineTo(length * 1.25, w1 + 14 + finJitter);
    ctx.lineTo(length * 0.85, w1 * 0.7);
    // Heavy ventral belly
    ctx.bezierCurveTo(length * 0.2, height * 0.85 + w2 * 0.5, -length * 0.5, height + w3 * 0.2, -length * 0.95, 0);
    ctx.closePath();

    ctx.fillStyle = '#030712'; // Pitch obsidian black
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 3. Segmented Obsidian Scute Plates (Armor plating)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1;
    for (let sx = -length * 0.6; sx <= length * 0.6; sx += 12) {
      const scuteFlex = (sx / length) * w2 * 0.4;
      ctx.beginPath();
      ctx.moveTo(sx, -height * 0.75 + scuteFlex);
      ctx.lineTo(sx + 6, scuteFlex);
      ctx.lineTo(sx, height * 0.75 + scuteFlex);
      ctx.stroke();
    }

    // 4. Glowing Abyssal Cyan Runes Carved into Scutes (Breathing Glow)
    ctx.strokeStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8 + bioPulse * 12;
    ctx.lineWidth = 1.8;

    const runes = [
      { x: -length * 0.35, y: -4 },
      { x: -length * 0.1, y: 3 },
      { x: length * 0.15, y: -3 },
      { x: length * 0.4, y: 2 }
    ];

    for (const r of runes) {
      const flex = (r.x / length) * w2 * 0.4;
      ctx.beginPath();
      ctx.moveTo(r.x - 3, r.y + flex - 4);
      ctx.lineTo(r.x + 3, r.y + flex);
      ctx.lineTo(r.x - 2, r.y + flex + 5);
      ctx.moveTo(r.x - 4, r.y + flex);
      ctx.lineTo(r.x + 4, r.y + flex);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // 5. Beak Lined with Obsidian Needles
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.3;
    for (let bx = -length * 0.92; bx <= -length * 0.55; bx += 3.8) {
      ctx.beginPath();
      ctx.moveTo(bx, -1);
      ctx.lineTo(bx + 1, 3.5);
      ctx.stroke();
    }

    // 6. Glowing Vertical Slit Eye (Eldritch Void Eye)
    const garEyeX = -length * 0.74;
    const garEyeY = -height * 0.15;
    ctx.fillStyle = '#0284c7';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(garEyeX, garEyeY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(garEyeX, garEyeY, 1, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  private renderGenericEldritch(
    ctx: CanvasRenderingContext2D,
    _t: number,
    _thrash: number,
    w1: number,
    w2: number,
    _bioPulse: number
  ): void {
    const length = 45;
    const height = 18;
    this.mouthSocket.set(-length * 0.8, 0);

    ctx.beginPath();
    ctx.moveTo(-length * 0.8, 0);
    ctx.bezierCurveTo(-length * 0.3, -height + w2, length * 0.3, -height * 0.8 + w1, length, w1);
    ctx.bezierCurveTo(length * 0.3, height * 0.8 + w1, -length * 0.3, height + w2, -length * 0.8, 0);
    ctx.closePath();
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
