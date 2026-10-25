import { Vector2 } from '../../engine/Vector2';
import { Input } from '../../engine/Input';
import { FishVisualSocket } from '../sockets/FishVisualSocket';
import { CardVisualSocket } from '../sockets/CardVisualSocket';
import type { WaterZoneType } from '../overworld/FishingSpot';
import { BattleEngine } from '../battle/BattleEngine';
import { BobberMinigame } from '../minigame/BobberMinigame';
import { PlayerInventory } from '../player/PlayerInventory';
import { AudioManager } from '../../engine/AudioManager';
import type { SpeciesType } from '../battle/FishData';
import {
  type ZoneTier,
  type ZoneProfile,
  ZONE_PROFILES,
  resolveZoneTier,
  getZoneProfile
} from './ZoneProfiles';

export type DioramaStage = 'bobber' | 'battle';

export interface BattleDioramaConfig {
  zoneType: WaterZoneType;
  spotName: string;
  speciesType: SpeciesType;
  inventory: PlayerInventory;
  onReturnToOverworld: () => void;
}

export interface AmbientFish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  spriteName: string;
  alpha: number;
  tailPhase: number;
  tailSpeed: number;
  glowColor?: string;
  schoolId?: number;
  kind?: 'minnow' | 'midwater' | 'bottom_dweller' | 'jellyfish';
}

export interface CombatVFX {
  type: 'slash' | 'ink_splash' | 'ward_sigil';
  x: number;
  y: number;
  life: number;
  maxLife: number;
  vx?: number;
  vy?: number;
  radius?: number;
  color?: string;
  angle?: number;
  length?: number;
}

export class SideViewDiorama {
  public stage: DioramaStage = 'bobber';
  public zoneType: WaterZoneType = 'lake';
  public spotName: string = 'Open Lake';
  public speciesType: SpeciesType = 'pike';
  public inventory: PlayerInventory;
  public onReturn: () => void;

  public get encounterSpecies(): SpeciesType {
    return this.speciesType;
  }
  public set encounterSpecies(val: SpeciesType) {
    this.speciesType = val;
  }
  public get encounterDistance(): number {
    const rawDist = this.battle?.fish?.startingDistance ?? this.battle?.distanceToBoat ?? 15;
    if (this.zoneType === 'shallow') {
      return 15;
    }
    return rawDist;
  }
  public get fishDepth(): number {
    return this.encounterDistance;
  }

  public get activeTier(): ZoneTier {
    if (this.zoneType === 'shallow') {
      return 1;
    }
    return resolveZoneTier(this.zoneType, this.encounterSpecies, this.fishDepth || this.encounterDistance);
  }

  public get activeProfile(): ZoneProfile {
    return ZONE_PROFILES[this.activeTier] ?? getZoneProfile(this.activeTier);
  }

  private lastActiveTier: ZoneTier = 1;

  // Static Image Cache for Side-View Sliced Assets
  private static images: Map<string, HTMLImageElement> = new Map();
  private static imagesInitialized: boolean = false;
  public static firstAreaVideo: HTMLVideoElement | null = null;
  public static isFirstAreaVideoReady: boolean = false;
  public static secondAreaVideo: HTMLVideoElement | null = null;
  public static isSecondAreaVideoReady: boolean = false;

  public static initImages(): void {
    if (this.imagesInitialized) return;
    this.imagesInitialized = true;

    const spriteNames = [
      'bg_fishing_clean_environment.png',
      // Zone 1-4 Backdrops & Ceilings
      'bg_coastal_lighthouse.png',
      'bg_kelp_shallows.png',
      'bg_abyssal_shipwreck.png',
      'bg_subterranean_cave.png',
      // Zone 1-4 Atmospheric Props & Seabed Structures
      'prop_lighthouse_cliff.png',
      'prop_dock_pilings_kelp.png',
      'prop_cave_stalactites.png',
      'prop_cave_chimney_vent.png',
      'prop_biolum_anemone_teal.png',
      'prop_biolum_anemone_cup.png',
      'prop_sea_cave_anchor.png',
      'shipwreck_abyssal_galleon.png',
      'shadow_kraken_tentacles_bg.png',
      'kelp_dense_cluster.png',
      'pier_breakwater_beam.png',
      'pier_piling_pair.png',
      'wood_piling_stump.png',
      'fish_school_minnows.png',
      'leviathan_abyssal_maw_worm.png',
      // Boat & Angler
      'boat_trawler_lit.png',
      'fisherman_sitting_crate.png',
      'fisherman_reeling_pull.png',
      'fisherman_casting_rod.png',
      'fisherman_holding_lantern.png',
      'tackle_hook_bone.png',
      'tackle_hook_iron.png',
      'fx_water_ripple.png',
      'fx_water_splash.png',
      'kelp_slender_bush.png',
      'shadow_giant_sea_serpent.png',
      'ui_power_tension_gauge.png',
      'ui_depth_gauge.png',
      'ui_btn_flee.png',
      'ui_frame_corner_bottom_left.png',
      'parchment_item_plate.png',
      'fish_shadowy_perch_s6.png',
      'fish_cod_large.png',
      'fish_spiky_sculpin.png',
      'fish_angler_pale_lure.png',
      'leviathan_apex_dagon.png',
      // Modular small fish sprites & animated Zone 1 + Zone 2 sheets
      'fish_animated_minnow_sheet.png',
      'fish_animated_flatfish_sheet.png',
      'fish_animated_school_sheet.png',
      'fish_animated_school_alt_sheet.png',
      'prop_animated_kelp_sheet.png',
      'fish_z2_tentacle_sculpin_sheet.png',
      'fish_z2_dark_rockfish_sheet.png',
      'fish_z2_spotted_mutant_sheet.png',
      'fish_z2_shadow_medium_sheet.png',
      'prop_z2_ocean_kelp_sheet.png',
      'prop_z2_sea_kelp_sheet.png',
      'fish_animated_minnow.png',
      'fish_shadowy_minnow_tiny1.png',
      'fish_shadowy_minnow_tiny2.png',
      'fish_shadowy_minnow_tiny3.png',
      'fish_shadowy_mackerel_s1.png',
      'fish_shadowy_trout_s2.png',
      'fish_shadowy_smelt_s3.png',
      'fish_shadowy_bass_s4.png',
      'fish_shadowy_shad_s5.png',
      'fish_shadowy_haddock_s7.png',
      'fish_shadowy_flounder_s.png',
      'fish_shadowy_flounder_m.png',
      'fish_shadowy_cod_m.png',
      'fish_gray_cod.png',
      'fish_teal_snapper.png',
      'fish_mutant_tiny_luminescent.png',
      'fish_mutant_biolum_spots.png',
      'fish_mutant_spiny_whiskers.png',
      'fish_mutant_amber_glow_eye.png',
      // Modular Waves & Water FX
      'waves_moonlit_crest_1024_feathered.png',
      'waves_storm_breaker_1024_feathered.png',
      'waves_misty_swell_1024_feathered.png',
      'waves_churning_foam_1024_feathered.png',
      'waves_moonlit_crest_1024.png',
      'waves_storm_breaker_1024.png',
      'waves_misty_swell_1024.png',
      'waves_churning_foam_1024.png',
      'waves_moonlit_crest_strip.png',
      'waves_storm_breaker_strip.png',
      'waves_misty_swell_strip.png',
      'waves_churning_foam_strip.png',
      'fx_wave_crashing_breaker_left.png',
      'fx_wave_claw_surge_right.png',
      'fx_wave_moonlit_curl.png',
      'fx_wave_whitecap_spray_crest.png',
      'fx_seafoam_patch_heavy.png',
      'fx_seafoam_churning_surf.png',
      'fx_calm_misty_swell.png',
      'fx_wave_crest_line.png'
    ];

    for (const name of spriteNames) {
      const img = new Image();
      img.src = `/assets/sprites/fishing/${name}`;
      this.images.set(name, img);
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function' && !this.firstAreaVideo) {
      try {
        const vid = document.createElement('video');
        vid.src = '/video/first_area.mp4';
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        if (vid.style) {
          vid.style.position = 'fixed';
          vid.style.top = '-9999px';
          vid.style.left = '-9999px';
          vid.style.opacity = '0';
          vid.style.pointerEvents = 'none';
          vid.style.width = '1px';
          vid.style.height = '1px';
        }
        if (document.body && typeof document.body.appendChild === 'function') {
          document.body.appendChild(vid);
        }
        if (typeof vid.addEventListener === 'function') {
          vid.addEventListener('canplay', () => {
            this.isFirstAreaVideoReady = true;
          });
          vid.addEventListener('loadeddata', () => {
            this.isFirstAreaVideoReady = true;
          });
        }
        if (typeof vid.play === 'function') {
          const playPromise = vid.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                const playOnGesture = () => {
                  vid.play().catch(() => {});
                  window.removeEventListener('click', playOnGesture);
                  window.removeEventListener('keydown', playOnGesture);
                };
                window.addEventListener('click', playOnGesture, { once: true });
                window.addEventListener('keydown', playOnGesture, { once: true });
              }
            });
          }
        }
        this.firstAreaVideo = vid;
      } catch {
        this.firstAreaVideo = null;
      }
    }

    if (typeof document !== 'undefined' && typeof document.createElement === 'function' && !this.secondAreaVideo) {
      try {
        const vid2 = document.createElement('video');
        vid2.src = '/video/second_area.mp4';
        vid2.autoplay = true;
        vid2.loop = true;
        vid2.muted = true;
        vid2.playsInline = true;
        vid2.preload = 'auto';
        if (vid2.style) {
          vid2.style.position = 'fixed';
          vid2.style.top = '-9999px';
          vid2.style.left = '-9999px';
          vid2.style.opacity = '0';
          vid2.style.pointerEvents = 'none';
          vid2.style.width = '1px';
          vid2.style.height = '1px';
        }
        if (document.body && typeof document.body.appendChild === 'function') {
          document.body.appendChild(vid2);
        }
        if (typeof vid2.addEventListener === 'function') {
          vid2.addEventListener('canplay', () => {
            this.isSecondAreaVideoReady = true;
          });
          vid2.addEventListener('loadeddata', () => {
            this.isSecondAreaVideoReady = true;
          });
        }
        if (typeof vid2.play === 'function') {
          const playPromise2 = vid2.play();
          if (playPromise2 && typeof playPromise2.catch === 'function') {
            playPromise2.catch(() => {
              if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                const playOnGesture2 = () => {
                  vid2.play().catch(() => {});
                  window.removeEventListener('click', playOnGesture2);
                  window.removeEventListener('keydown', playOnGesture2);
                };
                window.addEventListener('click', playOnGesture2, { once: true });
                window.addEventListener('keydown', playOnGesture2, { once: true });
              }
            });
          }
        }
        this.secondAreaVideo = vid2;
      } catch {
        this.secondAreaVideo = null;
      }
    }
  }

  public static getImage(name: string): HTMLImageElement | undefined {
    let img = this.images.get(name);
    if (!img && typeof Image !== 'undefined') {
      img = new Image();
      img.src = `/assets/sprites/fishing/${name}`;
      this.images.set(name, img);
    }
    return img;
  }

  // Decoupled Visual Sockets
  public fishSocket: FishVisualSocket;
  public cardSocket: CardVisualSocket;

  // Sub-systems
  public bobberMinigame: BobberMinigame;
  public battle: BattleEngine;

  // Animation & simulation timers
  private time: number = 0;
  public hoveredCardIndex: number = -1;

  // Dynamic Autonomous Fish Simulation
  public fishPos: Vector2 = new Vector2(0, 0);
  public fishVelocity: Vector2 = new Vector2(0, 0);
  public fishAngle: number = 0;
  private fishWanderTimer: number = 0;
  private fishWanderOffset: Vector2 = new Vector2(0, 0);
  private fishBubbles: { x: number; y: number; r: number; alpha: number; vy: number }[] = [];

  // Ambient Underwater Fish Fauna
  private ambientFish: AmbientFish[] = [];
  private ambientInitWidth: number = 0;

  // Gold awarded flag to prevent multi-granting on victory frame
  private goldAwarded: boolean = false;

  // Combat Juice & Visceral Feedback
  private screenShakeIntensity: number = 0;
  private damageFlashAlpha: number = 0;
  private lastLineIntegrity: number = 20;
  private combatEffects: CombatVFX[] = [];
  private lineWaterSplashes: { x: number; y: number; r: number; alpha: number; vx: number; vy: number }[] = [];

  // UI button bounds (in CSS pixels)
  private returnBtnRect = { x: 20, y: 16, w: 180, h: 42 };
  private endTurnBtnRect = { x: 0, y: 0, w: 145, h: 54 };
  private victoryReturnBtnRect = { x: 0, y: 0, w: 280, h: 46 };

  private isReturnBtnHovered: boolean = false;
  private isEndTurnBtnHovered: boolean = false;
  private isVictoryBtnHovered: boolean = false;

  constructor(config: BattleDioramaConfig) {
    SideViewDiorama.initImages();
    this.zoneType = config.zoneType;
    this.spotName = config.spotName;
    this.speciesType = config.speciesType;
    this.inventory = config.inventory;
    this.onReturn = config.onReturnToOverworld;

    this.fishSocket = new FishVisualSocket();
    this.cardSocket = new CardVisualSocket();

    this.bobberMinigame = new BobberMinigame({
      zoneType: this.zoneType,
      speciesType: this.speciesType,
      onHookedSuccess: () => this.onFishHooked()
    });

    this.battle = new BattleEngine(
      this.speciesType,
      this.inventory.getDeckCopy(),
      {
        maxStamina: this.inventory.maxStamina,
        maxLineIntegrity: this.inventory.maxLineIntegrity
      }
    );
  }

  public setEncounter(zoneType: WaterZoneType, spotName: string, speciesType: SpeciesType): void {
    this.stage = 'bobber';
    this.zoneType = zoneType;
    this.spotName = spotName;
    this.speciesType = speciesType;
    this.goldAwarded = false;

    this.bobberMinigame.zoneType = zoneType;
    this.bobberMinigame.speciesType = speciesType;
    this.bobberMinigame.reset();

    this.battle.reset(
      speciesType,
      this.inventory.getDeckCopy(),
      {
        maxStamina: this.inventory.maxStamina,
        maxLineIntegrity: this.inventory.maxLineIntegrity
      }
    );
    this.ambientInitWidth = 0; // Trigger ambient fish re-init

    this.lastLineIntegrity = this.battle.lineIntegrity;
    this.damageFlashAlpha = 0;
    this.screenShakeIntensity = 0;
    this.combatEffects = [];
    this.lineWaterSplashes = [];
  }

  private initAmbientFish(width: number, height: number, waterLevelY: number): void {
    this.ambientFish = [];
    const underwaterH = height - waterLevelY;
    const tier = this.activeTier;
    const profile = this.activeProfile;

    // Zone 1 (Innsmouth Shoals): Spawn a varied mix of animated fish sheets (minnows, stationary full-animation schools, flatfish)
    if (tier === 1) {
      const zone1FishSpecs: Array<{
        spriteName: string;
        xRatio: number;
        depthRatio: number;
        w: number;
        aspect: number;
        speed: number;
        isLeft: boolean;
        alpha: number;
        kind: 'minnow' | 'midwater' | 'bottom_dweller';
      }> = [
        {
          spriteName: 'fish_animated_school_sheet.png',
          xRatio: 0.30,
          depthRatio: 0.34,
          w: 240,
          aspect: 144 / 256,
          speed: 0,
          isLeft: false,
          alpha: 0.88,
          kind: 'minnow'
        },
        {
          spriteName: 'fish_animated_minnow_sheet.png',
          xRatio: 0.22,
          depthRatio: 0.38,
          w: 102,
          aspect: 116 / 240,
          speed: 30,
          isLeft: true,
          alpha: 0.88,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_animated_school_alt_sheet.png',
          xRatio: 0.72,
          depthRatio: 0.50,
          w: 230,
          aspect: 144 / 256,
          speed: 0,
          isLeft: false,
          alpha: 0.86,
          kind: 'minnow'
        },
        {
          spriteName: 'fish_animated_minnow_sheet.png',
          xRatio: 0.62,
          depthRatio: 0.58,
          w: 114,
          aspect: 116 / 240,
          speed: 28,
          isLeft: false,
          alpha: 0.86,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_animated_flatfish_sheet.png',
          xRatio: 0.38,
          depthRatio: 0.72,
          w: 122,
          aspect: 140 / 240,
          speed: 18,
          isLeft: false,
          alpha: 0.88,
          kind: 'bottom_dweller'
        },
        {
          spriteName: 'fish_animated_flatfish_sheet.png',
          xRatio: 0.78,
          depthRatio: 0.81,
          w: 134,
          aspect: 140 / 240,
          speed: 16,
          isLeft: true,
          alpha: 0.90,
          kind: 'bottom_dweller'
        }
      ];

      for (let i = 0; i < zone1FishSpecs.length; i++) {
        const spec = zone1FishSpecs[i];
        const fishW = spec.w;
        const fishH = Math.round(fishW * spec.aspect);
        const isStationarySchool = spec.speed === 0;
        this.ambientFish.push({
          x: width * spec.xRatio,
          y: waterLevelY + underwaterH * spec.depthRatio,
          vx: isStationarySchool ? 0 : (spec.isLeft ? -1 : 1) * (spec.speed + (i % 3) * 3),
          vy: isStationarySchool ? 0 : spec.kind === 'bottom_dweller' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 4,
          w: fishW,
          h: fishH,
          spriteName: spec.spriteName,
          alpha: spec.alpha,
          tailPhase: isStationarySchool ? i * 36 : i * 1.3 + Math.random() * 0.4,
          tailSpeed: isStationarySchool ? 0 : 4 + Math.random() * 2,
          schoolId: i,
          kind: spec.kind
        });
      }
      return;
    }

    // Zone 2 (The Foggy Banks / Kelp Shallows): ONLY spawn the new Zone 2 animated fish sheets and remove all old static fish
    if (tier === 2) {
      const zone2FishSpecs: Array<{
        spriteName: string;
        xRatio: number;
        depthRatio: number;
        w: number;
        aspect: number;
        speed: number;
        isLeft: boolean;
        alpha: number;
        kind: 'minnow' | 'midwater' | 'bottom_dweller';
      }> = [
        {
          spriteName: 'fish_z2_shadow_medium_sheet.png',
          xRatio: 0.24,
          depthRatio: 0.24,
          w: 98,
          aspect: 64 / 180,
          speed: 26,
          isLeft: false,
          alpha: 0.44,
          kind: 'minnow'
        },
        {
          spriteName: 'fish_z2_shadow_medium_sheet.png',
          xRatio: 0.68,
          depthRatio: 0.32,
          w: 88,
          aspect: 64 / 180,
          speed: 24,
          isLeft: true,
          alpha: 0.40,
          kind: 'minnow'
        },
        {
          spriteName: 'fish_z2_dark_rockfish_sheet.png',
          xRatio: 0.18,
          depthRatio: 0.40,
          w: 128,
          aspect: 125 / 220,
          speed: 20,
          isLeft: false,
          alpha: 0.48,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_z2_spotted_mutant_sheet.png',
          xRatio: 0.56,
          depthRatio: 0.48,
          w: 142,
          aspect: 116 / 230,
          speed: 22,
          isLeft: true,
          alpha: 0.48,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_z2_dark_rockfish_sheet.png',
          xRatio: 0.80,
          depthRatio: 0.56,
          w: 118,
          aspect: 125 / 220,
          speed: 19,
          isLeft: true,
          alpha: 0.46,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_z2_tentacle_sculpin_sheet.png',
          xRatio: 0.34,
          depthRatio: 0.65,
          w: 148,
          aspect: 140 / 220,
          speed: 16,
          isLeft: false,
          alpha: 0.50,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_z2_spotted_mutant_sheet.png',
          xRatio: 0.72,
          depthRatio: 0.72,
          w: 132,
          aspect: 116 / 230,
          speed: 18,
          isLeft: false,
          alpha: 0.44,
          kind: 'midwater'
        },
        {
          spriteName: 'fish_z2_tentacle_sculpin_sheet.png',
          xRatio: 0.50,
          depthRatio: 0.80,
          w: 156,
          aspect: 140 / 220,
          speed: 15,
          isLeft: true,
          alpha: 0.52,
          kind: 'bottom_dweller'
        }
      ];

      for (let i = 0; i < zone2FishSpecs.length; i++) {
        const spec = zone2FishSpecs[i];
        const fishW = spec.w;
        const fishH = Math.round(fishW * spec.aspect);
        this.ambientFish.push({
          x: width * spec.xRatio,
          y: waterLevelY + underwaterH * spec.depthRatio,
          vx: (spec.isLeft ? -1 : 1) * (spec.speed + (i % 3) * 2),
          vy: spec.kind === 'bottom_dweller' ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 3.5,
          w: fishW,
          h: fishH,
          spriteName: spec.spriteName,
          alpha: spec.alpha,
          tailPhase: i * 1.4 + Math.random() * 0.4,
          tailSpeed: 4 + Math.random() * 2,
          schoolId: i,
          kind: spec.kind
        });
      }
      return;
    }

    // 1. Primary school of fish in midwater (Zones 2-4)
    const schoolBaseY = waterLevelY + underwaterH * 0.28;
    const minnowSprites = [
      'fish_shadowy_minnow_tiny1.png',
      'fish_shadowy_minnow_tiny2.png',
      'fish_shadowy_minnow_tiny3.png'
    ];
    const schoolSprites = minnowSprites;

    const schoolCount = tier === 4 ? 6 : 10;
    for (let i = 0; i < schoolCount; i++) {
      const offsetX = (Math.random() - 0.5) * 180;
      const offsetY = (Math.random() - 0.5) * 45;
      const spr = schoolSprites[i % schoolSprites.length];
      this.ambientFish.push({
        x: width * 0.45 + offsetX,
        y: schoolBaseY + offsetY,
        vx: 26 + Math.random() * 20,
        vy: (Math.random() - 0.5) * 6,
        w: 26 + Math.random() * 8,
        h: 10 + Math.random() * 4,
        spriteName: spr,
        alpha: 0.35 + Math.random() * 0.25,
        tailPhase: Math.random() * Math.PI * 2,
        tailSpeed: 8 + Math.random() * 5,
        schoolId: 1,
        kind: 'minnow'
      });
    }

    // 2. Zone-specific midwater fauna from profile (Zones 2-4)
    const zoneFauna = profile.ambientFishSprites;
    for (let i = 0; i < 7; i++) {
      const isLeft = Math.random() < 0.5;
      const depthRatio = 0.20 + Math.random() * 0.58;
      const spr = zoneFauna[i % zoneFauna.length];
      const isMawWorm = spr.includes('maw_worm');
      const isAngler = spr.includes('angler');
      const isSculpin = spr.includes('sculpin');

      let fishW = 48 + Math.random() * 16;
      let fishH = 22 + Math.random() * 8;
      let glowColor: string | undefined = undefined;

      if (isMawWorm) {
        fishW = 120;
        fishH = 75;
        glowColor = '#f97316';
      } else if (isAngler) {
        fishW = 85;
        fishH = 58;
        glowColor = '#38bdf8';
      } else if (isSculpin) {
        fishW = 65;
        fishH = 42;
      }

      this.ambientFish.push({
        x: Math.random() * width,
        y: waterLevelY + underwaterH * depthRatio,
        vx: (isLeft ? -1 : 1) * (18 + Math.random() * 18),
        vy: (Math.random() - 0.5) * 6,
        w: fishW,
        h: fishH,
        spriteName: spr,
        alpha: 0.42 + Math.random() * 0.25,
        glowColor,
        tailPhase: Math.random() * Math.PI * 2,
        tailSpeed: 4 + Math.random() * 3,
        kind: 'midwater'
      });
    }

    // 3. Bottom-dwelling benthic fish (Flounders & scavengers)
    const benthicSprites = [
      'fish_shadowy_flounder_s.png',
      'fish_shadowy_flounder_m.png',
      'fish_mutant_spiny_whiskers.png'
    ];

    for (let i = 0; i < 4; i++) {
      const isLeft = Math.random() < 0.5;
      const spr = benthicSprites[i % benthicSprites.length];

      this.ambientFish.push({
        x: Math.random() * width,
        y: height - 38 + (Math.random() - 0.5) * 10,
        vx: (isLeft ? -1 : 1) * (14 + Math.random() * 12),
        vy: 0,
        w: 52 + Math.random() * 16,
        h: 26 + Math.random() * 8,
        spriteName: spr,
        alpha: 0.38 + Math.random() * 0.22,
        tailPhase: Math.random() * Math.PI * 2,
        tailSpeed: 4 + Math.random() * 3,
        kind: 'bottom_dweller'
      });
    }

    // 4. Extra zone atmospheric fauna
    if (tier === 3) {
      // Bioluminescent abyssal mutants in Trench
      const abyssSprites = [
        'fish_mutant_tiny_luminescent.png',
        'fish_mutant_biolum_spots.png',
        'fish_mutant_amber_glow_eye.png'
      ];
      for (let i = 0; i < 4; i++) {
        const spr = abyssSprites[i % abyssSprites.length];
        this.ambientFish.push({
          x: width * 0.2 + Math.random() * (width * 0.65),
          y: waterLevelY + underwaterH * (0.35 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 14,
          vy: -6 - Math.random() * 6,
          w: 44 + Math.random() * 14,
          h: 22 + Math.random() * 8,
          spriteName: spr,
          alpha: 0.55 + Math.random() * 0.20,
          glowColor: '#38bdf8',
          tailPhase: Math.random() * Math.PI * 2,
          tailSpeed: 3 + Math.random() * 2,
          kind: 'midwater'
        });
      }
    } else if (tier === 4) {
      // Sulfurous amber-eyed mutants in Cave
      for (let i = 0; i < 3; i++) {
        this.ambientFish.push({
          x: width * 0.15 + Math.random() * (width * 0.70),
          y: waterLevelY + underwaterH * (0.30 + Math.random() * 0.55),
          vx: (Math.random() - 0.5) * 12,
          vy: -4 - Math.random() * 4,
          w: 46 + Math.random() * 12,
          h: 24 + Math.random() * 6,
          spriteName: 'fish_mutant_amber_glow_eye.png',
          alpha: 0.60 + Math.random() * 0.20,
          glowColor: '#f59e0b',
          tailPhase: Math.random() * Math.PI * 2,
          tailSpeed: 3 + Math.random() * 2,
          kind: 'midwater'
        });
      }
    }
  }

  private onFishHooked(): void {
    this.stage = 'battle';
    this.battle.reset(this.speciesType, this.inventory.getDeckCopy());
    this.fishPos.set(0, 0);
    this.fishBubbles = [];
    this.lastLineIntegrity = this.battle.lineIntegrity;
    this.damageFlashAlpha = 0;
    this.screenShakeIntensity = 12; // Heavy strike hit-stop & shake on hooking!
    this.combatEffects = [];
    this.lineWaterSplashes = [];
  }

  public update(dt: number, viewportWidth: number, viewportHeight: number): void {
    this.time += dt;

    // Decay Screen Shake & Damage Flash
    this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - dt * 26);
    this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 2.2);

    // Detect Line Integrity damage & trigger crimson damage flash
    if (this.stage === 'battle') {
      if (this.battle.lineIntegrity < this.lastLineIntegrity) {
        const drop = this.lastLineIntegrity - this.battle.lineIntegrity;
        this.damageFlashAlpha = Math.min(1.0, 0.45 + (drop / 20) * 0.55);
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 12 + drop * 0.6);
        this.lastLineIntegrity = this.battle.lineIntegrity;
      } else if (this.battle.lineIntegrity > this.lastLineIntegrity) {
        this.lastLineIntegrity = this.battle.lineIntegrity;
      }
    }

    // Update active combat visual effects
    for (let i = this.combatEffects.length - 1; i >= 0; i--) {
      const vfx = this.combatEffects[i];
      vfx.life += dt;
      if (vfx.vx) vfx.x += vfx.vx * dt;
      if (vfx.vy) vfx.y += vfx.vy * dt;
      if (vfx.life >= vfx.maxLife) {
        this.combatEffects.splice(i, 1);
      }
    }

    // Update line cut water splashes
    for (let i = this.lineWaterSplashes.length - 1; i >= 0; i--) {
      const sp = this.lineWaterSplashes[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.alpha -= dt * 2.5;
      sp.r += dt * 3.5;
      if (sp.alpha <= 0) {
        this.lineWaterSplashes.splice(i, 1);
      }
    }

    const mousePos = Input.getMousePosition();
    const waterLevelY = Math.floor(viewportHeight * 0.28);

    // Initialize ambient fish when viewport dimensions or zone tier change
    const currentTier = this.activeTier;
    const needsShoalRefresh =
      (currentTier === 1 || currentTier === 2) &&
      (this.ambientFish.length === 0 ||
        this.ambientFish.some((f) => !f.spriteName.endsWith('_sheet.png')));
    if (this.ambientInitWidth !== viewportWidth || this.lastActiveTier !== currentTier || needsShoalRefresh) {
      this.ambientInitWidth = viewportWidth;
      this.lastActiveTier = currentTier;
      this.initAmbientFish(viewportWidth, viewportHeight, waterLevelY);
    }

    // Update ambient fish
    this.updateAmbientFish(dt, viewportWidth, viewportHeight, waterLevelY);

    // 1. Check Return to Overworld via ESC
    if (Input.isJustPressed('escape')) {
      Input.setCursor('default');
      this.onReturn();
      return;
    }


    // 2. Return button hover & click
    this.isReturnBtnHovered =
      mousePos.x >= this.returnBtnRect.x &&
      mousePos.x <= this.returnBtnRect.x + this.returnBtnRect.w &&
      mousePos.y >= this.returnBtnRect.y &&
      mousePos.y <= this.returnBtnRect.y + this.returnBtnRect.h;

    if (this.isReturnBtnHovered && Input.isMouseClicked()) {
      Input.setCursor('default');
      AudioManager.getInstance().playButtonClick();
      this.onReturn();
      return;
    }


    // 3. Stage: Bobber Minigame
    if (this.stage === 'bobber') {
      this.bobberMinigame.update(dt, viewportWidth, waterLevelY);
      Input.setCursor(this.isReturnBtnHovered ? 'pointer' : 'default');
      return;
    }


    // 4. Stage: Card Battle
    this.battle.update(dt);

    // Update dynamic autonomous fish swimming simulation
    this.updateFishSimulation(dt, viewportWidth, viewportHeight, waterLevelY);

    // Check Victory gold award
    if (this.battle.status === 'victory' && !this.goldAwarded) {
      this.goldAwarded = true;
      this.inventory.addGold(this.battle.fish.sellValue);
      this.inventory.totalFishCaught++;
      AudioManager.getInstance().playGoldCoins();
    }

    // Victory / Defeat Overlay interactions
    if (this.battle.status === 'victory' || this.battle.status === 'defeat') {
      const modalW = Math.min(680, viewportWidth - 40);
      const modalH = Math.min(470, viewportHeight - 40);
      const modalX = (viewportWidth - modalW) / 2;
      const modalY = (viewportHeight - modalH) / 2;

      this.victoryReturnBtnRect.w = 280;
      this.victoryReturnBtnRect.h = 46;
      this.victoryReturnBtnRect.x = modalX + (modalW - this.victoryReturnBtnRect.w) / 2;
      this.victoryReturnBtnRect.y = modalY + modalH - 58;

      this.isVictoryBtnHovered =
        mousePos.x >= this.victoryReturnBtnRect.x &&
        mousePos.x <= this.victoryReturnBtnRect.x + this.victoryReturnBtnRect.w &&
        mousePos.y >= this.victoryReturnBtnRect.y &&
        mousePos.y <= this.victoryReturnBtnRect.y + this.victoryReturnBtnRect.h;

      if ((this.isVictoryBtnHovered && Input.isMouseClicked()) || Input.isJustPressed('space') || Input.isJustPressed('enter')) {
        Input.setCursor('default');
        AudioManager.getInstance().playButtonClick();
        if (this.battle.status === 'defeat') {
          // Re-rig tackle and retry encounter
          this.battle.reset(
            this.speciesType,
            this.inventory.getDeckCopy(),
            {
              maxStamina: this.inventory.maxStamina,
              maxLineIntegrity: this.inventory.maxLineIntegrity
            }
          );
        } else {
          this.onReturn();
        }
      }

      Input.setCursor(this.isVictoryBtnHovered ? 'pointer' : 'default');
      return;
    }


    // End Turn Button hover, click, and Spacebar trigger
    this.endTurnBtnRect.x = viewportWidth - this.endTurnBtnRect.w - 32;
    this.endTurnBtnRect.y = Math.min(viewportHeight * 0.55, viewportHeight - 210);

    this.isEndTurnBtnHovered =
      mousePos.x >= this.endTurnBtnRect.x &&
      mousePos.x <= this.endTurnBtnRect.x + this.endTurnBtnRect.w &&
      mousePos.y >= this.endTurnBtnRect.y &&
      mousePos.y <= this.endTurnBtnRect.y + this.endTurnBtnRect.h;

    if ((this.isEndTurnBtnHovered && Input.isMouseClicked()) || Input.isJustPressed('space') || Input.isJustPressed('enter')) {
      AudioManager.getInstance().playButtonClick();
      this.battle.endTurn();
      return;
    }


    // Number key shortcuts to play cards (1-5)
    for (let i = 0; i < this.battle.hand.length; i++) {
      const digitKey = `digit${i + 1}`;
      const numpadKey = `numpad${i + 1}`;
      if (Input.isJustPressed(digitKey) || Input.isJustPressed(numpadKey)) {
        if (this.battle.canPlayCard(i)) {
          this.triggerCardPlayJuice(i);
          this.battle.playCard(i);
          return;
        }
      }
    }

    // Card Hand hover & play interaction (Curved Hand Arc Layout)
    const hand = this.battle.hand;
    const cardCount = hand.length;
    const scale = this.getCardScale(viewportWidth);
    const cardW = CardVisualSocket.CARD_WIDTH * scale;
    const cardH = CardVisualSocket.CARD_HEIGHT * scale;
    const maxHandSpan = Math.min(viewportWidth - 260, cardCount * (cardW + 16));
    const startX = (viewportWidth - maxHandSpan) / 2 + cardW / 2;
    const spacing = cardCount > 1 ? (maxHandSpan - cardW) / (cardCount - 1) : 0;
    const baseY = viewportHeight - cardH / 2 - 14;
    const centerIndex = (cardCount - 1) / 2;

    this.hoveredCardIndex = -1;

    for (let i = cardCount - 1; i >= 0; i--) {
      const centerDist = i - centerIndex;
      const cx = cardCount === 1 ? viewportWidth / 2 : startX + i * spacing;
      const arcDrop = Math.pow(centerDist, 2) * 5;
      const cy = baseY + arcDrop;
      const halfW = cardW / 2;
      const halfH = cardH / 2;

      if (
        mousePos.x >= cx - halfW &&
        mousePos.x <= cx + halfW &&
        mousePos.y >= cy - halfH - 45 &&
        mousePos.y <= cy + halfH + 20
      ) {
        this.hoveredCardIndex = i;
        break;
      }
    }

    // Click to play hovered card
    if (this.hoveredCardIndex !== -1 && Input.isMouseClicked()) {
      if (this.battle.canPlayCard(this.hoveredCardIndex)) {
        this.triggerCardPlayJuice(this.hoveredCardIndex);
        this.battle.playCard(this.hoveredCardIndex);
      }
    }

    // Update cursor feedback
    const isInteractive =
      this.isReturnBtnHovered ||
      this.isEndTurnBtnHovered ||
      (this.hoveredCardIndex !== -1 && this.battle.canPlayCard(this.hoveredCardIndex));

    Input.setCursor(isInteractive ? 'pointer' : 'default');
  }

  private updateAmbientFish(dt: number, width: number, height: number, waterLevelY: number): void {
    const isFishThrashing = this.stage === 'battle' && (this.battle.status === 'fish_turn' || this.battle.getCurrentIntent().type === 'Thrash');

    for (const f of this.ambientFish) {
      f.tailPhase += dt * f.tailSpeed;

      if (
        f.spriteName === 'fish_animated_school_sheet.png' ||
        f.spriteName === 'fish_animated_school_alt_sheet.png'
      ) {
        // Stationary full-animation fish schools play in one fixed spot
        continue;
      }

      if (f.kind === 'jellyfish') {
        // Jellyfish pulse upwards on contraction, drift down gently on relaxation
        const pulse = Math.sin(f.tailPhase);
        f.vy = pulse > 0.4 ? -16 : -4;
        f.vx = Math.sin(this.time * 0.8 + f.y * 0.05) * 6;

        f.x += f.vx * dt;
        f.y += f.vy * dt;

        // If jellyfish reaches near surface, wrap to bottom of trench
        if (f.y < waterLevelY + 35) {
          f.y = height - 40;
          f.x = width * 0.2 + Math.random() * (width * 0.65);
        }
        continue;
      }

      if (f.kind === 'bottom_dweller') {
        // Skim horizontally across the lakebed
        f.x += f.vx * dt;
        f.y = height - 38 + Math.sin(this.time * 1.8 + f.x * 0.03) * 6;

        if (f.vx > 0 && f.x > width + 40) {
          f.x = -40;
        } else if (f.vx < 0 && f.x < -40) {
          f.x = width + 40;
        }
        continue;
      }

      // Schooling minnows undulate together
      if (f.schoolId === 1 || f.schoolId === 2) {
        f.vy = Math.sin(this.time * 2.2 + f.x * 0.02) * (f.schoolId === 2 ? 16 : 10);
      }

      // Scatter away if battle fish is violently thrashing nearby
      if (isFishThrashing) {
        const dx = f.x - this.fishPos.x;
        const dy = f.y - this.fishPos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 170 * 170 && distSq > 1) {
          f.vx += (dx > 0 ? 1 : -1) * dt * 85;
        }
      }

      f.x += f.vx * dt;
      f.y += f.vy * dt;

      // Wrap around horizontal boundaries with padding
      if (f.vx > 0 && f.x > width + 40) {
        f.x = -40;
      } else if (f.vx < 0 && f.x < -40) {
        f.x = width + 40;
      }

      // Clamp vertical space within underwater bounds
      if (f.y < waterLevelY + 25) {
        f.y = waterLevelY + 25;
        f.vy *= -1;
      } else if (f.y > height - 40) {
        f.y = height - 40;
        f.vy *= -1;
      }
    }
  }

  private getCardScale(width: number): number {
    return Math.min(1.0, Math.max(0.72, width / 1280));
  }

  private updateFishSimulation(dt: number, width: number, height: number, waterLevelY: number): void {
    const maxDist = Math.max(30, this.battle.maxStartingDistance);
    const distRatio = Math.max(0, Math.min(1.0, this.battle.distanceToBoat / maxDist));
    const anchorX = width * (0.28 + distRatio * 0.48);
    const depthUnderwater = (height - waterLevelY);
    const anchorY = waterLevelY + depthUnderwater * 0.42;

    if (this.fishPos.x === 0 && this.fishPos.y === 0) {
      this.fishPos.set(anchorX, anchorY);
    }

    // Wander waypoint updates
    this.fishWanderTimer += dt;
    if (this.fishWanderTimer > 1.6) {
      this.fishWanderTimer = 0;
      this.fishWanderOffset.x = (Math.random() - 0.5) * 80;
      this.fishWanderOffset.y = (Math.random() - 0.5) * 60;
    }

    // Dynamic behavioral surges based on fish intent
    let surgeX = 0;
    let surgeY = 0;
    const currentIntent = this.battle.getCurrentIntent();

    if (this.battle.status === 'fish_turn' || currentIntent.type === 'Thrash') {
      surgeX = Math.sin(this.time * 16) * 36 + Math.cos(this.time * 10) * 18;
      surgeY = Math.sin(this.time * 13) * 28 + Math.cos(this.time * 7) * 14;
    } else if (currentIntent.type === 'DeepDive') {
      surgeX = 35 + Math.sin(this.time * 3) * 15;
      surgeY = 55 + Math.cos(this.time * 4) * 20;
    } else if (currentIntent.type === 'Rest') {
      surgeY = 16 + Math.sin(this.time * 1.5) * 8;
      surgeX = Math.cos(this.time * 1.2) * 12;
    } else {
      surgeX = Math.cos(this.time * 2.2) * 20;
      surgeY = Math.sin(this.time * 2.6) * 18;
    }

    const targetX = Math.max(width * 0.22, Math.min(width * 0.88, anchorX + this.fishWanderOffset.x + surgeX));
    const targetY = Math.max(waterLevelY + 38, Math.min(height - 65, anchorY + this.fishWanderOffset.y + surgeY));

    const prevX = this.fishPos.x;
    const prevY = this.fishPos.y;

    const lerpSpeed = currentIntent.type === 'Thrash' ? 5.5 : 3.8;
    this.fishPos.x += (targetX - this.fishPos.x) * Math.min(1.0, dt * lerpSpeed);
    this.fishPos.y += (targetY - this.fishPos.y) * Math.min(1.0, dt * lerpSpeed);

    this.fishVelocity.set((this.fishPos.x - prevX) / Math.max(0.001, dt), (this.fishPos.y - prevY) / Math.max(0.001, dt));

    const targetAngle = Math.atan2(this.fishVelocity.y, -Math.abs(this.fishVelocity.x) - 45) * 0.55;
    this.fishAngle += (targetAngle - this.fishAngle) * Math.min(1.0, dt * 6);

    // Trailing underwater bubbles
    if (Math.random() < 0.45) {
      this.fishBubbles.push({
        x: this.fishPos.x + (Math.random() - 0.5) * 12,
        y: this.fishPos.y + (Math.random() - 0.5) * 8,
        r: 1.5 + Math.random() * 2.5,
        alpha: 0.7,
        vy: -22 - Math.random() * 25
      });
    }

    for (let i = this.fishBubbles.length - 1; i >= 0; i--) {
      const b = this.fishBubbles[i];
      b.y += b.vy * dt;
      b.alpha -= dt * 0.55;
      if (b.y <= waterLevelY || b.alpha <= 0) {
        this.fishBubbles.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const waterLevelY = Math.floor(height * 0.28);

    ctx.save();

    // 0. Screen Shake Impact translation
    if (this.screenShakeIntensity > 0.1) {
      const shakeX = (Math.random() - 0.5) * this.screenShakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.screenShakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    const profile = this.activeProfile;

    // 1. Zone-Specific Skybox or Subterranean Cavern Ceiling
    this.renderDetailedSky(ctx, width, waterLevelY, profile);

    // 2. Zone-Specific Underwater Column, Lighting & Atmospheric Props
    this.renderDetailedUnderwater(ctx, width, height, waterLevelY, profile);

    // 3. Render Background Ambient Fish Fauna
    this.renderAmbientFish(ctx);

    // 4. Detailed Water Surface Wave Line
    this.renderDetailedWaterSurface(ctx, width, waterLevelY, profile);

    // 5. Detailed Boat & Seated Angler
    const boatX = width * 0.16;
    const boatWaveOffset = Math.sin(this.time * 2.2) * 4;
    const boatAngle = Math.cos(this.time * 2.0) * 0.035;
    const boatY = waterLevelY + boatWaveOffset;
    const rodTip = this.renderDetailedBoat(ctx, boatX, boatY, boatAngle);

    // 5b. Foreground Wave Breakers & Seafoam Splash around boat hull
    this.renderForegroundWaterBreakers(ctx, width, waterLevelY, boatX, boatY, profile);

    // 6. Stage Specific Rendering
    if (this.stage === 'bobber') {
      this.bobberMinigame.render(ctx, width, waterLevelY, rodTip);
    } else {
      this.renderBattleScene(ctx, width, height, waterLevelY, rodTip);
    }

    // 7. Diorama Frame & Brass Bathymetry Gauge
    this.renderDetailedDioramaFrame(ctx, width, height, waterLevelY);

    ctx.restore(); // Restore screen shake translation before screen-space post-processing

    // 8. Heavy Claustrophobic Vignette & Subtle Film Grain
    this.renderSideViewPostProcessing(ctx, width, height);

    // 9. Violent Crimson Screen-Edge Damage Flash when Line Integrity drops
    if (this.damageFlashAlpha > 0.01) {
      ctx.save();
      const minDim = Math.min(width, height);
      const maxDim = Math.max(width, height);
      const dmgVig = ctx.createRadialGradient(width / 2, height / 2, minDim * 0.28, width / 2, height / 2, maxDim * 0.72);
      dmgVig.addColorStop(0, 'rgba(239, 68, 68, 0)');
      dmgVig.addColorStop(0.55, `rgba(220, 38, 38, ${this.damageFlashAlpha * 0.35})`);
      dmgVig.addColorStop(1, `rgba(185, 28, 28, ${this.damageFlashAlpha * 0.92})`);
      ctx.fillStyle = dmgVig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // 10. Top Navigation & Flee button
    this.renderTopNav(ctx);

    // 11. Victory or Defeat Modal
    if (this.stage === 'battle' && (this.battle.status === 'victory' || this.battle.status === 'defeat')) {
      this.renderEndGameModal(ctx, width, height);
    }
  }

  private renderSideViewPostProcessing(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    // Claustrophobic Vignette
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const vig = ctx.createRadialGradient(width / 2, height / 2, minDim * 0.35, width / 2, height / 2, maxDim * 0.74);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.55, 'rgba(2, 6, 8, 0.42)');
    vig.addColorStop(0.85, 'rgba(1, 4, 6, 0.78)');
    vig.addColorStop(1, 'rgba(0, 2, 4, 0.96)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric dust / film grain
    ctx.fillStyle = 'rgba(167, 243, 208, 0.025)';
    for (let i = 0; i < 30; i++) {
      const gx = (i * 103.1 + this.time * 50) % width;
      const gy = (i * 61.7 - this.time * 35 + (i % 2 === 0 ? 0 : height)) % height;
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
    ctx.restore();
  }

  private renderBattleScene(ctx: CanvasRenderingContext2D, width: number, height: number, waterLevelY: number, rodTip: Vector2): void {
    const fishX = this.fishPos.x;
    const fishY = this.fishPos.y;
    const fishAngle = this.fishAngle;

    // Render Fish Trailing Bubbles
    ctx.save();
    for (const b of this.fishBubbles) {
      ctx.fillStyle = `rgba(200, 240, 255, ${Math.max(0, b.alpha)})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Render Fish using decoupled FishVisualSocket
    const thrashIntensity = this.battle.status === 'fish_turn' || this.battle.getCurrentIntent().type === 'Thrash' ? 0.9 : 0.35;
    this.fishSocket.render(ctx, {
      position: new Vector2(fishX, fishY),
      rotation: fishAngle
    }, {
      time: this.time,
      speciesType: this.speciesType,
      depthMeters: this.battle.distanceToBoat,
      thrashAmount: thrashIntensity
    });

    // Mouth position for line
    const mouthLocal = this.fishSocket.mouthSocket;
    const mouthX = fishX + mouthLocal.x * Math.cos(fishAngle) - mouthLocal.y * Math.sin(fishAngle);
    const mouthY = fishY + mouthLocal.x * Math.sin(fishAngle) + mouthLocal.y * Math.cos(fishAngle);

    // Visual Fishing Line
    this.renderFishingLine(ctx, rodTip, new Vector2(mouthX, mouthY), waterLevelY);

    // Render Combat Visual Effects (Iron Hook Slashes, Ink Bursts, Ward Waves)
    this.renderCombatEffects(ctx);

    // Fish Intent Telegraph
    this.renderFishIntent(ctx, fishX, Math.max(waterLevelY + 25, fishY - 50));

    // Combat Telemetry & Player HUD
    this.renderCombatHUD(ctx, width);

    // Hand Cards
    this.renderHand(ctx, width, height);

    // End Turn Button
    this.renderEndTurnButton(ctx);

    // Floating Feedback Texts
    this.renderFloatingTexts(ctx, width, height);
  }

  private renderAmbientFish(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    for (const f of this.ambientFish) {
      const isStationarySchool =
        f.spriteName === 'fish_animated_school_sheet.png' ||
        f.spriteName === 'fish_animated_school_alt_sheet.png';
      const isFacingRight = f.vx >= 0;
      const sway = isStationarySchool ? 0 : Math.sin(f.tailPhase) * 2.2;
      const tilt = isStationarySchool ? 0 : Math.cos(f.tailPhase) * 0.06;

      ctx.save();
      ctx.translate(f.x, f.y + sway);
      ctx.rotate(tilt);

      // Atmospheric depth alpha
      ctx.globalAlpha = f.alpha ?? 0.45;

      // Bioluminescent glow aura if applicable
      if (f.glowColor) {
        ctx.shadowColor = f.glowColor;
        ctx.shadowBlur = 12;
      }

      const img = SideViewDiorama.getImage(f.spriteName);
      if (img && img.complete && img.naturalWidth > 0) {
        // Native sliced sprites face RIGHT.
        // If moving LEFT (vx < 0), flip horizontally (except stationary full-animation schools).
        if (!isFacingRight && !isStationarySchool) {
          ctx.scale(-1, 1);
        }
        if (isStationarySchool) {
          // Full 240-frame (15x16) native 24fps animation covering 100% of the video in one fixed spot
          // with sub-frame crossfade for silky 60fps+ playback
          const cols = 15;
          const cellW = 240;
          const cellH = 135;
          const totalFrames = 240;
          const exactFrame = (this.time * 24 + f.tailPhase) % totalFrames;
          const frameIdx = Math.floor(exactFrame);
          const nextFrameIdx = (frameIdx + 1) % totalFrames;
          const frac = exactFrame - frameIdx;

          const col0 = frameIdx % cols;
          const row0 = Math.floor(frameIdx / cols);
          ctx.drawImage(
            img,
            col0 * cellW,
            row0 * cellH,
            cellW,
            cellH,
            -f.w / 2,
            -f.h / 2,
            f.w,
            f.h
          );

          if (frac > 0.05) {
            const col1 = nextFrameIdx % cols;
            const row1 = Math.floor(nextFrameIdx / cols);
            ctx.save();
            ctx.globalAlpha = (f.alpha ?? 0.86) * frac;
            ctx.drawImage(
              img,
              col1 * cellW,
              row1 * cellH,
              cellW,
              cellH,
              -f.w / 2,
              -f.h / 2,
              f.w,
              f.h
            );
            ctx.restore();
          }
        } else if (f.spriteName.endsWith('_sheet.png')) {
          let cols = 6;
          let cellW = 240;
          let cellH = 116;
          let nFrames = 24;
          let fps = 24;
          if (f.spriteName === 'fish_animated_flatfish_sheet.png') {
            cols = 8;
            cellW = 240;
            cellH = 140;
            nFrames = 56;
          } else if (f.spriteName === 'fish_z2_tentacle_sculpin_sheet.png') {
            cols = 12;
            cellW = 220;
            cellH = 140;
            nFrames = 144;
          } else if (f.spriteName === 'fish_z2_dark_rockfish_sheet.png') {
            cols = 12;
            cellW = 220;
            cellH = 125;
            nFrames = 144;
          } else if (f.spriteName === 'fish_z2_spotted_mutant_sheet.png') {
            cols = 12;
            cellW = 230;
            cellH = 116;
            nFrames = 144;
          } else if (f.spriteName === 'fish_z2_shadow_medium_sheet.png') {
            cols = 6;
            cellW = 180;
            cellH = 64;
            nFrames = 24;
            fps = 16;
          }
          const cycleLen = nFrames * 2 - 2; // Seamless ping-pong across all frames
          const constOffset = (f.schoolId ?? 0) * 19;
          const exactRaw = (this.time * fps + constOffset) % cycleLen;
          const rawIdx = Math.floor(exactRaw);
          const nextRawIdx = (rawIdx + 1) % cycleLen;
          const frac = exactRaw - rawIdx;

          const frameIdx = rawIdx < nFrames ? rawIdx : cycleLen - rawIdx;
          const nextFrameIdx = nextRawIdx < nFrames ? nextRawIdx : cycleLen - nextRawIdx;

          const col = frameIdx % cols;
          const row = Math.floor(frameIdx / cols);
          ctx.drawImage(
            img,
            col * cellW,
            row * cellH,
            cellW,
            cellH,
            -f.w / 2,
            -f.h / 2,
            f.w,
            f.h
          );

          if (frac > 0.05 && nextFrameIdx !== frameIdx) {
            const col1 = nextFrameIdx % cols;
            const row1 = Math.floor(nextFrameIdx / cols);
            ctx.save();
            ctx.globalAlpha = (f.alpha ?? 0.86) * frac;
            ctx.drawImage(
              img,
              col1 * cellW,
              row1 * cellH,
              cellW,
              cellH,
              -f.w / 2,
              -f.h / 2,
              f.w,
              f.h
            );
            ctx.restore();
          }
        } else {
          ctx.drawImage(img, -f.w / 2, -f.h / 2, f.w, f.h);
        }
      }
      ctx.restore();
    }

    ctx.restore();
  }

  private renderDetailedSky(
    ctx: CanvasRenderingContext2D,
    width: number,
    waterLevelY: number,
    profile: ZoneProfile = this.activeProfile
  ): void {
    const tier = profile.tier;

    // =========================================================================
    // ZONE 4: SUBTERRANEAN SEA CAVE (Dagon Abyssal Lair - 100m+)
    // STRICT INVARIANT: Enclosed subterranean cavern rock vault ceiling.
    // STRICTLY NO OPEN SKY, NO CELESTIAL MOON, NO BIRDS, NO CHURCH SPIRE.
    // =========================================================================
    if (tier === 4 || profile.sky.type === 'cave_ceiling') {
      ctx.save();

      // 1. Cavern Basalt Ceiling Gradient
      const caveGrad = ctx.createLinearGradient(0, 0, 0, waterLevelY);
      caveGrad.addColorStop(0, profile.sky.skyTop); // #0d0705
      caveGrad.addColorStop(1, profile.sky.skyBottom); // #1c100a
      ctx.fillStyle = caveGrad;
      ctx.fillRect(0, 0, width, waterLevelY);

      // 2. Subterranean Cave Backdrop
      const caveBg = SideViewDiorama.getImage('bg_subterranean_cave.png');
      if (caveBg && caveBg.complete && caveBg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(caveBg, 0, 0, width, waterLevelY);
        ctx.restore();
      }

      // 3. Volcanic Amber Glow along the lower cavern crevices & vents
      const amberGlow = ctx.createLinearGradient(0, waterLevelY - 45, 0, waterLevelY);
      amberGlow.addColorStop(0, 'rgba(234, 88, 12, 0)');
      amberGlow.addColorStop(0.5, 'rgba(249, 115, 22, 0.20)');
      amberGlow.addColorStop(1, 'rgba(245, 158, 11, 0.45)');
      ctx.fillStyle = amberGlow;
      ctx.fillRect(0, waterLevelY - 45, width, 45);

      // 4. Upper Cavern Hydrothermal Chimney Vents (Emitting sulfurous steam and embers)
      const ventImg = SideViewDiorama.getImage('prop_cave_chimney_vent.png');
      const ventPositions = [
        { x: width * 0.12, w: 75, h: 90 },
        { x: width * 0.85, w: 80, h: 95 }
      ];
      for (const vp of ventPositions) {
        if (ventImg && ventImg.complete && ventImg.naturalWidth > 0) {
          ctx.drawImage(ventImg, vp.x - vp.w / 2, waterLevelY - vp.h * 0.75, vp.w, vp.h);
        }
        // Thermal steam & sulfurous smoke rising to cavern ceiling
        ctx.save();
        ctx.fillStyle = 'rgba(180, 83, 9, 0.20)';
        for (let s = 0; s < 4; s++) {
          const sp = (this.time * 0.5 + s * 0.25) % 1;
          const sx = vp.x + Math.sin(this.time * 1.5 + s) * 12;
          const sy = waterLevelY - 20 - sp * (waterLevelY * 0.7);
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + sp * 20, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 5. Rising Volcanic Sparks / Thermal Embers towards ceiling
      ctx.save();
      for (let i = 0; i < 18; i++) {
        const seed = i * 47.3;
        const pPhase = (this.time * 0.6 + i * 0.12) % 1;
        const px = (seed * 11 + Math.sin(this.time * 2.0 + i) * 15) % width;
        const py = waterLevelY - pPhase * waterLevelY;
        const sparkAlpha = Math.sin(pPhase * Math.PI) * 0.85;
        ctx.fillStyle = i % 2 === 0 ? `rgba(251, 146, 60, ${sparkAlpha})` : `rgba(253, 224, 71, ${sparkAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (i % 2) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 6. Hanging Cavern Stalactites Vault (prop_cave_stalactites.png anchored at ceiling y=0)
      const stalImg = SideViewDiorama.getImage('prop_cave_stalactites.png');
      if (stalImg && stalImg.complete && stalImg.naturalWidth > 0) {
        ctx.save();
        const stalW = 420;
        const stalH = Math.min(85, waterLevelY * 0.70);
        for (let sx = 0; sx < width; sx += stalW - 20) {
          ctx.drawImage(stalImg, sx, 0, stalW, stalH);
        }
        ctx.restore();
      }

      // 7. Cavern Atmospheric Fog / Haze
      if (profile.sky.fogColor) {
        ctx.fillStyle = profile.sky.fogColor;
        ctx.fillRect(0, 0, width, waterLevelY);
      }

      ctx.restore();
      return; // STRICT INVARIANT: DO NOT render any open sky, moon, or celestial elements!
    }

    // =========================================================================
    // OPEN SKY ENVIRONMENTS (ZONES 1, 2, 3)
    // =========================================================================
    ctx.save();

    // 1. Sky Gradient from Profile
    const skyGrad = ctx.createLinearGradient(0, 0, 0, waterLevelY);
    skyGrad.addColorStop(0, profile.sky.skyTop);
    skyGrad.addColorStop(1, profile.sky.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, waterLevelY);

    // 2. Zone-Specific Backdrop Video (Tiers 1-2) or Backdrop Sprite (Tier 3)
    const targetAspect = waterLevelY / Math.max(1, width);
    if (tier === 1) {
      const vid = SideViewDiorama.firstAreaVideo;
      if (vid && vid.paused && typeof vid.play === 'function') {
        vid.play().catch(() => {});
      }
      if (vid && (vid.readyState >= 2 || SideViewDiorama.isFirstAreaVideoReady)) {
        const vw = vid.videoWidth || 1920;
        const vh = vid.videoHeight || 1080;
        const sy = Math.floor(vh * 0.225);
        const sh = Math.floor(Math.max(vh * 0.34, Math.min(vh - sy, vw * targetAspect * 1.25)));
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.drawImage(vid, 0, sy, vw, sh, 0, 0, width, waterLevelY);
        ctx.restore();
      } else if (profile.sky.backdropSprite) {
        const bgImg = SideViewDiorama.getImage(profile.sky.backdropSprite);
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          const iw = bgImg.naturalWidth;
          const ih = bgImg.naturalHeight;
          const sy = Math.floor(ih * 0.225);
          const sh = Math.floor(Math.max(ih * 0.34, Math.min(ih - sy, iw * targetAspect * 1.25)));
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.drawImage(bgImg, 0, sy, iw, sh, 0, 0, width, waterLevelY);
          ctx.restore();
        }
      }
    } else if (tier === 2) {
      const vid2 = SideViewDiorama.secondAreaVideo;
      if (vid2 && vid2.paused && typeof vid2.play === 'function') {
        vid2.play().catch(() => {});
      }
      if (vid2 && (vid2.readyState >= 2 || SideViewDiorama.isSecondAreaVideoReady)) {
        const vw = vid2.videoWidth || 1920;
        const vh = vid2.videoHeight || 1080;
        const sy = Math.floor(vh * 0.375);
        const sh = Math.floor(Math.max(vh * 0.36, Math.min(vh - sy, vw * targetAspect * 1.25)));
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.drawImage(vid2, 0, sy, vw, sh, 0, 0, width, waterLevelY);
        ctx.restore();
      } else if (profile.sky.backdropSprite) {
        const bgImg = SideViewDiorama.getImage(profile.sky.backdropSprite);
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
          const iw = bgImg.naturalWidth;
          const ih = bgImg.naturalHeight;
          const sy = Math.floor(ih * 0.375);
          const sh = Math.floor(Math.max(ih * 0.36, Math.min(ih - sy, iw * targetAspect * 1.25)));
          ctx.save();
          ctx.globalAlpha = 1.0;
          ctx.drawImage(bgImg, 0, sy, iw, sh, 0, 0, width, waterLevelY);
          ctx.restore();
        }
      }
    } else if (profile.sky.backdropSprite) {
      const bgImg = SideViewDiorama.getImage(profile.sky.backdropSprite);
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        const iw = bgImg.naturalWidth;
        const ih = bgImg.naturalHeight;
        const sh = Math.floor(Math.max(ih * 0.38, Math.min(ih, iw * targetAspect * 1.35)));
        const sy = Math.floor((ih - sh) * 0.45);
        ctx.save();
        ctx.globalAlpha = 0.60;
        ctx.drawImage(bgImg, 0, sy, iw, sh, 0, 0, width, waterLevelY);
        ctx.restore();
      }
    }

    // 3. Celestial Elements (Storm Obscured for Zone 3)
    if (profile.sky.celestialType === 'moon' && tier !== 1) {
      const celestialX = width * 0.74;
      const celestialY = waterLevelY * 0.30;

      ctx.save();
      const glow = ctx.createRadialGradient(celestialX, celestialY, 6, celestialX, celestialY, 70);
      glow.addColorStop(0, 'rgba(217, 249, 157, 0.50)');
      glow.addColorStop(0.5, 'rgba(167, 243, 208, 0.16)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 70, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (profile.sky.celestialType === 'fog_moon' && tier !== 2) {
      const celestialX = width * 0.70;
      const celestialY = waterLevelY * 0.35;

      ctx.save();
      const glow = ctx.createRadialGradient(celestialX, celestialY, 8, celestialX, celestialY, 85);
      glow.addColorStop(0, 'rgba(94, 234, 212, 0.38)');
      glow.addColorStop(0.5, 'rgba(20, 44, 28, 0.22)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 85, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(204, 251, 241, 0.60)';
      ctx.beginPath();
      ctx.arc(celestialX, celestialY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (profile.sky.celestialType === 'storm_obscured') {
      // Zone 3: Pitch-black tempest squall - moon completely obscured, distant thunder flashes
      const flash = Math.sin(this.time * 0.8) > 0.97 ? 0.20 : 0;
      if (flash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(186, 230, 253, ${flash})`;
        ctx.fillRect(0, 0, width, waterLevelY);
        ctx.restore();
      }
    }

    // 4. Distant Coastal Headland / Horizon Props
    if (tier === 1) {
      // Zone 1 background is driven by the animated first_area.mp4 video
      // Keep only subtle horizon bell buoy rocking on the waterline
      this.drawBellBuoy(ctx, width * 0.48, waterLevelY);

    } else if (tier === 2) {
      // Zone 2 background is driven by the animated second_area.mp4 video
      // Keep only subtle horizon bell buoy rocking on the waterline
      this.drawBellBuoy(ctx, width * 0.52, waterLevelY);

    } else if (tier === 3) {
      // Zone 3: Pitch-black tempest squall with heavy driving rain haze
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.28)';
      ctx.lineWidth = 1.4;
      for (let d = 0; d < 75; d++) {
        const rx = (d * 31 + this.time * 120) % width;
        const ry = (d * 19 + this.time * 280) % waterLevelY;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 12, ry + 22);
        ctx.stroke();
      }

      // Heavy rolling tempest thunderclouds
      ctx.fillStyle = 'rgba(8, 13, 26, 0.70)';
      const cloud1X = ((this.time * 14) % (width + 260)) - 130;
      this.drawCloud(ctx, cloud1X, waterLevelY * 0.32, 85);
      const cloud2X = (((this.time * 10) + 400) % (width + 260)) - 130;
      this.drawCloud(ctx, cloud2X, waterLevelY * 0.20, 110);

      // Bell buoy tossing violently
      this.drawBellBuoy(ctx, width * 0.54, waterLevelY, 2.5);
    }

    // Atmospheric Fog
    if (profile.sky.fogColor) {
      ctx.fillStyle = profile.sky.fogColor;
      ctx.fillRect(0, 0, width, waterLevelY);
    }

    ctx.restore();
  }

  private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.arc(x + r * 0.4, y - r * 0.2, r * 0.6, 0, Math.PI * 2);
    ctx.arc(x + r * 0.8, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBellBuoy(ctx: CanvasRenderingContext2D, buoyX: number, waterLevelY: number, violentMultiplier: number = 1.0): void {
    const buoyWave = Math.sin(this.time * (2.8 * violentMultiplier)) * (3 * violentMultiplier);
    const buoyAngle = Math.cos(this.time * (2.5 * violentMultiplier)) * (0.12 * violentMultiplier);
    const buoyY = waterLevelY + buoyWave - 4;

    ctx.save();
    ctx.translate(buoyX, buoyY);
    ctx.rotate(buoyAngle);

    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(0, -18);
    ctx.lineTo(7, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#78350f'; // Rusted cage
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Tolling brass bell
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderDetailedUnderwater(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    waterLevelY: number,
    profile: ZoneProfile = this.activeProfile
  ): void {
    const tier = profile.tier;
    const waterCol = profile.waterColumn;

    // 1. Water Column Gradient dynamically bound to profile
    const waterGrad = ctx.createLinearGradient(0, waterLevelY, 0, height);
    waterGrad.addColorStop(0, waterCol.midColor);
    waterGrad.addColorStop(0.65, waterCol.deepColor);
    waterGrad.addColorStop(1, waterCol.bedColor);
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterLevelY, width, height - waterLevelY);

    // 2. Underwater Lighting & Caustics / Rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (tier === 1) {
      // Zone 1: Moonbeams piercing slate-green shallows
      for (let i = 0; i < 4; i++) {
        const rayPhase = this.time * 0.25 + i * 1.5;
        const rayX = width * (0.2 + i * 0.22) + Math.sin(rayPhase) * 28;
        const rayWidth = 45 + Math.sin(rayPhase * 1.4) * 18;

        const rayGrad = ctx.createLinearGradient(rayX, waterLevelY, rayX + 60, height);
        rayGrad.addColorStop(0, waterCol.lightRayColor || 'rgba(167, 243, 208, 0.08)');
        rayGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.03)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(rayX, waterLevelY);
        ctx.lineTo(rayX + rayWidth, waterLevelY);
        ctx.lineTo(rayX + rayWidth + 120, height);
        ctx.lineTo(rayX - 30, height);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tier === 2) {
      // Zone 2: Phosphorescent emerald-teal caustics bloom
      for (let i = 0; i < 5; i++) {
        const rayPhase = this.time * 0.35 + i * 1.2;
        const rayX = width * (0.15 + i * 0.20) + Math.sin(rayPhase) * 32;
        const rayWidth = 55 + Math.sin(rayPhase * 1.6) * 22;

        const rayGrad = ctx.createLinearGradient(rayX, waterLevelY, rayX + 50, height);
        rayGrad.addColorStop(0, waterCol.causticsColor || 'rgba(94, 234, 212, 0.22)');
        rayGrad.addColorStop(0.4, waterCol.lightRayColor || 'rgba(94, 234, 212, 0.12)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(rayX, waterLevelY);
        ctx.lineTo(rayX + rayWidth, waterLevelY);
        ctx.lineTo(rayX + rayWidth + 100, height);
        ctx.lineTo(rayX - 25, height);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tier === 3) {
      // Zone 3: Faint cyan bioluminescent caustics in abyssal gloom
      for (let i = 0; i < 3; i++) {
        const rayPhase = this.time * 0.2 + i * 2.0;
        const rayX = width * (0.25 + i * 0.28) + Math.sin(rayPhase) * 20;
        const rayWidth = 40 + Math.sin(rayPhase * 15);

        const rayGrad = ctx.createLinearGradient(rayX, waterLevelY, rayX + 40, height);
        rayGrad.addColorStop(0, waterCol.causticsColor || 'rgba(56, 189, 248, 0.12)');
        rayGrad.addColorStop(0.3, waterCol.lightRayColor || 'rgba(56, 189, 248, 0.05)');
        rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(rayX, waterLevelY);
        ctx.lineTo(rayX + rayWidth, waterLevelY);
        ctx.lineTo(rayX + rayWidth + 80, height);
        ctx.lineTo(rayX - 20, height);
        ctx.closePath();
        ctx.fill();
      }
    } else if (tier === 4) {
      // Zone 4: Hydrothermal magma under-glow & thermal shimmer rising from vents
      const magmaGlow = ctx.createLinearGradient(0, height, 0, waterLevelY);
      magmaGlow.addColorStop(0, 'rgba(249, 115, 22, 0.24)');
      magmaGlow.addColorStop(0.45, 'rgba(245, 158, 11, 0.12)');
      magmaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = magmaGlow;
      ctx.fillRect(0, waterLevelY, width, height - waterLevelY);
    }
    ctx.restore();

    // 3. Water Column Particles & Rising Bubbles / Sparks
    ctx.save();
    if (waterCol.particleType === 'vent_sparks') {
      // Zone 4: Volcanic heat bubbles and rising magma sparks
      for (let b = 0; b < 24; b++) {
        const bPhase = (this.time * 30 + b * 45) % (height - waterLevelY);
        const by = height - 35 - bPhase;
        const bx = (b * 93.7 + Math.sin(this.time * 3.0 + b) * 18) % width;
        const alpha = Math.sin((bPhase / (height - waterLevelY)) * Math.PI) * 0.85;
        ctx.fillStyle = b % 2 === 0 ? `rgba(249, 115, 22, ${alpha})` : `rgba(253, 224, 71, ${alpha})`;
        ctx.beginPath();
        ctx.arc(bx, by, 2 + (b % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Plankton & standard bubbles
      for (let i = 0; i < 20; i++) {
        const seed = i * 137.5;
        const pX = (seed * 9 + this.time * 10) % width;
        const pY = waterLevelY + ((seed * 7 - this.time * 16) % (height - waterLevelY - 40) + (height - waterLevelY - 40)) % (height - waterLevelY - 40);
        ctx.fillStyle = 'rgba(224, 242, 254, 0.35)';
        ctx.beginPath();
        ctx.arc(pX, pY, 1.2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      for (let b = 0; b < 12; b++) {
        const bPhase = (this.time * 20 + b * 55) % (height - waterLevelY);
        const by = height - 40 - bPhase;
        const bx = (b * 149.3 + Math.sin(this.time * 2.2 + b) * 14) % width;
        ctx.fillStyle = 'rgba(3, 8, 14, 0.70)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.20)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(bx, by, 2 + (b % 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

    // 4. Seabed Topography Gradient & Contour
    ctx.save();
    const bedBaseY = height - 55;
    const bedGrad = ctx.createLinearGradient(0, bedBaseY - 20, 0, height);
    bedGrad.addColorStop(0, waterCol.bedColor);
    bedGrad.addColorStop(1, '#020406');
    ctx.fillStyle = bedGrad;

    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 25) {
      let bedH = 45 + Math.sin(x * 0.008) * 18 + Math.cos(x * 0.02) * 10;
      if (tier === 3 && x > width * 0.55) {
        // Abyssal trench deep drop-off cliff on right side
        const trenchT = (x - width * 0.55) / (width * 0.45);
        bedH = Math.max(12, bedH - trenchT * 35);
      }
      ctx.lineTo(x, height - bedH);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 5. Zone-Specific Props & Atmospheric Features
    if (tier === 1) {
      // Zone 1: Submerged pier breakwater timber, pilings, and animated swaying sea kelp
      const pBeam = SideViewDiorama.getImage('pier_breakwater_beam.png');
      if (pBeam && pBeam.complete && pBeam.naturalWidth > 0) {
        ctx.drawImage(pBeam, width * 0.15 - 45, height - 165, 90, 150);
      }
      const pPair = SideViewDiorama.getImage('pier_piling_pair.png');
      if (pPair && pPair.complete && pPair.naturalWidth > 0) {
        ctx.drawImage(pPair, width * 0.82 - 25, height - 175, 50, 172);
      }
      const pStump = SideViewDiorama.getImage('wood_piling_stump.png');
      if (pStump && pStump.complete && pStump.naturalWidth > 0) {
        ctx.drawImage(pStump, width * 0.75 - 23, height - 155, 46, 150);
      }

      const kelpSheet = SideViewDiorama.getImage('prop_animated_kelp_sheet.png');
      if (kelpSheet && kelpSheet.complete && kelpSheet.naturalWidth > 0) {
        const kelpClusters = [
          { x: width * 0.08, y: height - 150, w: 145, h: 145, phase: 0, flip: false, alpha: 0.88 },
          { x: width * 0.34, y: height - 132, w: 125, h: 125, phase: 9, flip: true, alpha: 0.82 },
          { x: width * 0.64, y: height - 142, w: 138, h: 138, phase: 18, flip: false, alpha: 0.86 },
          { x: width * 0.89, y: height - 155, w: 150, h: 150, phase: 27, flip: true, alpha: 0.90 }
        ];
        const cols = 10;
        const cellW = 200;
        const cellH = 200;
        const nFrames = 50;
        const cycleLen = nFrames * 2 - 2; // 50 frames ping-pong (0..49..1) at native 24fps
        for (const kc of kelpClusters) {
          const rawIdx = Math.floor((this.time * 24 + kc.phase) % cycleLen);
          const frameIdx = rawIdx < nFrames ? rawIdx : cycleLen - rawIdx;
          const col = frameIdx % cols;
          const row = Math.floor(frameIdx / cols);
          ctx.save();
          ctx.globalAlpha = kc.alpha;
          ctx.translate(kc.x, kc.y);
          if (kc.flip) {
            ctx.scale(-1, 1);
          }
          ctx.drawImage(
            kelpSheet,
            col * cellW,
            row * cellH,
            cellW,
            cellH,
            -kc.w / 2,
            0,
            kc.w,
            kc.h
          );
          ctx.restore();
        }
      }

    } else if (tier === 2) {
      // Zone 2: Phosphorescent emerald-teal water, animated swaying kelp forest, dock pilings
      const pilings = SideViewDiorama.getImage('prop_dock_pilings_kelp.png');
      if (pilings && pilings.complete && pilings.naturalWidth > 0) {
        ctx.drawImage(pilings, width * 0.18 - 60, height - 190, 120, 183);
      }

      const oceanKelpSheet = SideViewDiorama.getImage('prop_z2_ocean_kelp_sheet.png');
      const seaKelpSheet = SideViewDiorama.getImage('prop_z2_sea_kelp_sheet.png');
      const z2KelpPlacements = [
        { sheet: seaKelpSheet, cols: 12, cw: 150, ch: 210, nFrames: 96, x: width * 0.08, y: height - 185, w: 130, h: 182, phase: 0, flip: false, alpha: 0.90 },
        { sheet: oceanKelpSheet, cols: 12, cw: 200, ch: 168, nFrames: 96, x: width * 0.36, y: height - 155, w: 170, h: 143, phase: 24, flip: false, alpha: 0.86 },
        { sheet: oceanKelpSheet, cols: 12, cw: 200, ch: 168, nFrames: 96, x: width * 0.76, y: height - 165, w: 185, h: 155, phase: 48, flip: true, alpha: 0.90 },
        { sheet: seaKelpSheet, cols: 12, cw: 150, ch: 210, nFrames: 96, x: width * 0.89, y: height - 190, w: 138, h: 193, phase: 72, flip: true, alpha: 0.92 }
      ];

      for (const kp of z2KelpPlacements) {
        if (kp.sheet && kp.sheet.complete && kp.sheet.naturalWidth > 0) {
          const cycleLen = kp.nFrames * 2 - 2;
          const rawIdx = Math.floor((this.time * 24 + kp.phase) % cycleLen);
          const frameIdx = rawIdx < kp.nFrames ? rawIdx : cycleLen - rawIdx;
          const col = frameIdx % kp.cols;
          const row = Math.floor(frameIdx / kp.cols);
          ctx.save();
          ctx.globalAlpha = kp.alpha;
          ctx.translate(kp.x, kp.y);
          if (kp.flip) {
            ctx.scale(-1, 1);
          }
          ctx.drawImage(
            kp.sheet,
            col * kp.cw,
            row * kp.ch,
            kp.cw,
            kp.ch,
            -kp.w / 2,
            0,
            kp.w,
            kp.h
          );
          ctx.restore();
        }
      }

    } else if (tier === 3) {
      // Zone 3: Sunken Galleon wreck, glowing cyan anemones, kraken silhouette
      // Kraken silhouette in deep background
      const kraken = SideViewDiorama.getImage('shadow_kraken_tentacles_bg.png');
      if (kraken && kraken.complete && kraken.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        const kx = width * 0.50 - 110 + Math.sin(this.time * 0.8) * 15;
        const ky = waterLevelY + (height - waterLevelY) * 0.45 + Math.cos(this.time * 1.1) * 8;
        ctx.drawImage(kraken, kx, ky, 220, 95);
        ctx.restore();
      }

      // Sunken galleon wreck resting on the abyssal bed
      const galleon = SideViewDiorama.getImage('shipwreck_abyssal_galleon.png');
      if (galleon && galleon.complete && galleon.naturalWidth > 0) {
        ctx.drawImage(galleon, width * 0.72 - 200, height - 195, 400, 195);
      }

      // Bioluminescent anemones with luminous cyan glow
      const anemoneTeal = SideViewDiorama.getImage('prop_biolum_anemone_teal.png');
      if (anemoneTeal && anemoneTeal.complete && anemoneTeal.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = '#2dd4bf';
        ctx.shadowBlur = 16;
        ctx.drawImage(anemoneTeal, width * 0.22 - 58, height - 95, 115, 88);
        ctx.restore();
      }

      const anemoneCup = SideViewDiorama.getImage('prop_biolum_anemone_cup.png');
      if (anemoneCup && anemoneCup.complete && anemoneCup.naturalWidth > 0) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.drawImage(anemoneCup, width * 0.35 - 40, height - 80, 80, 73);
        ctx.restore();
      }

    } else if (tier === 4) {
      // Zone 4: Hydrothermal chimney vents, cyclopean anchor, stalactites
      const ventImg = SideViewDiorama.getImage('prop_cave_chimney_vent.png');
      if (ventImg && ventImg.complete && ventImg.naturalWidth > 0) {
        // Vent 1 (left)
        ctx.save();
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 18;
        ctx.drawImage(ventImg, width * 0.18 - 40, height - 105, 80, 98);
        // Vent 2 (right)
        ctx.drawImage(ventImg, width * 0.82 - 40, height - 105, 80, 98);
        ctx.restore();
      }

      // Cyclopean Sea Cave Anchor
      const anchorImg = SideViewDiorama.getImage('prop_sea_cave_anchor.png');
      if (anchorImg && anchorImg.complete && anchorImg.naturalWidth > 0) {
        ctx.drawImage(anchorImg, width * 0.38 - 58, height - 90, 115, 83);
      }

      // Cave stalactites reaching down along upper water column perimeter
      const stalImg = SideViewDiorama.getImage('prop_cave_stalactites.png');
      if (stalImg && stalImg.complete && stalImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.50;
        ctx.drawImage(stalImg, width * 0.50 - 210, waterLevelY - 10, 420, 85);
        ctx.restore();
      }
    }
  }

  private renderDetailedWaterSurface(
    ctx: CanvasRenderingContext2D,
    width: number,
    waterLevelY: number,
    profile: ZoneProfile = this.activeProfile
  ): void {
    ctx.save();
    const waves = profile.waves;
    const waveSpeed = waves.waveSpeed;
    const waveAmp = waves.waveAmp;
    const waveDrift = waves.waveDrift;

    // 1. Primary Wave Swell Layer (Zone Specific)
    const wavePrimary = SideViewDiorama.getImage(waves.primaryWaveSprite);
    if (wavePrimary && wavePrimary.complete && wavePrimary.naturalWidth > 0) {
      ctx.save();
      const primaryDrift = Math.sin(this.time * waveSpeed * 1.1) * (14 * waveDrift);
      const primaryBob = Math.cos(this.time * waveSpeed * 1.3) * waveAmp;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(wavePrimary, -25 + primaryDrift, waterLevelY - 32 + primaryBob, width + 50, 115);
      ctx.restore();
    }

    // 2. Secondary Wave / Surf / Curl Layer (Opposite Parallax Phase)
    const waveSecondary = SideViewDiorama.getImage(waves.secondaryWaveSprite);
    if (waveSecondary && waveSecondary.complete && waveSecondary.naturalWidth > 0) {
      ctx.save();
      const secondaryDrift = Math.cos(this.time * waveSpeed * 0.9) * (-12 * waveDrift);
      const secondaryBob = Math.sin(this.time * waveSpeed * 1.2 + 1.2) * (waveAmp * 0.65);
      ctx.globalAlpha = profile.tier === 4 ? 0.70 : 0.45;
      ctx.drawImage(waveSecondary, -30 + secondaryDrift, waterLevelY - 26 + secondaryBob, width + 60, 105);
      ctx.restore();
    }

    // 3. Zone-Specific Wave Crest Overlays / Spray / Boiling Froth
    if (profile.tier === 3) {
      // Zone 3: Modular Whitecap Spray Crests in Open Water
      const whitecap = SideViewDiorama.getImage('fx_wave_whitecap_spray_crest.png');
      if (whitecap && whitecap.complete && whitecap.naturalWidth > 0) {
        ctx.save();
        const capX = width * 0.68 + Math.sin(this.time * 1.2) * 22;
        const capY = waterLevelY - 22 + Math.cos(this.time * 2.2) * 4;
        ctx.globalAlpha = 0.65 + Math.sin(this.time * 2.5) * 0.2;
        ctx.drawImage(whitecap, capX, capY, 125, 82);
        ctx.restore();
      }
    } else if (profile.tier === 4) {
      // Zone 4: Churning boiling froth patches and thermal bubbling
      const froth = SideViewDiorama.getImage('fx_seafoam_churning_surf.png');
      if (froth && froth.complete && froth.naturalWidth > 0) {
        ctx.save();
        const frothX = width * 0.62 + Math.sin(this.time * 2.4) * 20;
        const frothY = waterLevelY - 24 + Math.cos(this.time * 2.8) * 3;
        ctx.globalAlpha = 0.75 + Math.sin(this.time * 3.2) * 0.15;
        ctx.drawImage(froth, frothX, frothY, 140, 75);
        ctx.restore();
      }
    } else if (profile.tier === 2) {
      // Zone 2: Moonlit curling wave edge
      const curl = SideViewDiorama.getImage('fx_wave_moonlit_curl.png');
      if (curl && curl.complete && curl.naturalWidth > 0) {
        ctx.save();
        const curlX = width * 0.65 + Math.sin(this.time * 1.4) * 16;
        const curlY = waterLevelY - 20 + Math.cos(this.time * 1.8) * 3;
        ctx.globalAlpha = 0.55 + Math.sin(this.time * 2.0) * 0.15;
        ctx.drawImage(curl, curlX, curlY, 110, 70);
        ctx.restore();
      }
    }
    // Zone 1 features pristine, calm full-width swells without floating patch overlays

    // 4. Dynamically Colored & Softly Blended Foam Crest Highlight
    ctx.strokeStyle = waves.foamColor || 'rgba(167, 243, 208, 0.35)';
    ctx.lineWidth = profile.tier >= 3 ? 1.8 : 1.2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const wave =
        Math.sin(x * 0.035 + this.time * waveSpeed * 2.4) * waveAmp +
        Math.cos(x * 0.018 - this.time * waveSpeed * 1.5) * (waveAmp * 0.6);
      const y = waterLevelY + wave;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
  }

  private renderForegroundWaterBreakers(
    ctx: CanvasRenderingContext2D,
    width: number,
    waterLevelY: number,
    boatX: number,
    _boatY: number,
    profile: ZoneProfile = this.activeProfile
  ): void {
    // Crashing breakers only surge in stormy/abyssal waters (Tier 3 & 4)
    if (profile.tier < 3 || !profile.waves.foregroundBreakerSprite) {
      return;
    }


    ctx.save();
    const breaker = SideViewDiorama.getImage(profile.waves.foregroundBreakerSprite);
    if (breaker && breaker.complete && breaker.naturalWidth > 0) {
      const surgeOffset = Math.sin(this.time * profile.waves.waveSpeed * 1.5) * 6;
      ctx.globalAlpha = 0.50 + Math.sin(this.time * 1.9) * 0.15;
      ctx.drawImage(breaker, boatX + 240 + surgeOffset, waterLevelY - 24, 115, 80);
    }

    if (profile.waves.foamPatchSprite) {
      const foam = SideViewDiorama.getImage(profile.waves.foamPatchSprite);
      if (foam && foam.complete && foam.naturalWidth > 0) {
        const fx = (width * 0.42 + this.time * 12) % (width + 240) - 120;
        ctx.globalAlpha = 0.30 + Math.sin(this.time * 1.5) * 0.10;
        ctx.drawImage(foam, fx, waterLevelY - 12, 125, 62);
      }
    }
    ctx.restore();
  }

  private renderDetailedBoat(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): Vector2 {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const currentIntent = this.stage === 'battle' ? this.battle.getCurrentIntent() : { type: 'Rest', value: 0 };
    const isThrashing = this.stage === 'battle' && (this.battle.status === 'fish_turn' || currentIntent.type === 'Thrash');
    const intentThreat = isThrashing ? this.battle.getEffectiveIntentValue() : 0;
    const distPulled = this.battle ? (this.battle.maxStartingDistance - this.battle.distanceToBoat) : 0;
    const tensionRatio = Math.min(1.0, Math.max(0, (intentThreat * 3 + distPulled) / 45));
    const strainLean = -(tensionRatio * 5.5 + (isThrashing ? 4 : 0)); // Angler strains and leans violently back into pull

    // Check if boat_trawler_lit sprite is loaded
    const boatImg = SideViewDiorama.getImage('boat_trawler_lit.png');
    if (boatImg && boatImg.complete && boatImg.naturalWidth > 0) {
      const bw = 240;
      const bh = 179;
      // Hull rests naturally with waterline
      ctx.drawImage(boatImg, -bw * 0.42, -bh * 0.88, bw, bh);

      // Fisherman character on stern deck
      const fmImg = (isThrashing || tensionRatio > 0.4)
        ? SideViewDiorama.getImage('fisherman_reeling_pull.png')
        : (this.stage === 'bobber'
            ? SideViewDiorama.getImage('fisherman_casting_rod.png')
            : SideViewDiorama.getImage('fisherman_sitting_crate.png'));

      const fmW = 60;
      const fmH = 76;
      const fmX = bw * 0.14;
      const fmY = -bh * 0.52;

      if (fmImg && fmImg.complete && fmImg.naturalWidth > 0) {
        ctx.drawImage(fmImg, fmX, fmY, fmW, fmH);
      }

      // Rod tip coordinate in world space
      const localTipX = fmX + fmW * 0.94;
      const localTipY = fmY + fmH * 0.18;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const worldTipX = x + localTipX * cosA - localTipY * sinA;
      const worldTipY = y + localTipX * sinA + localTipY * cosA;
      ctx.restore();
      return new Vector2(worldTipX, worldTipY);
    }

    // Fallback Procedural Boat Hull
    // 1. Boat Waterline Reflection & Shadow
    ctx.fillStyle = 'rgba(0, 20, 40, 0.4)';
    ctx.beginPath();
    ctx.ellipse(3, 11, 62, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Weathered Dory Boat Hull (Two-Tone Clinker Planking)
    // Lower Hull (Anti-fouling Navy / Dark Teal with algae scum line)
    ctx.fillStyle = '#162836';
    ctx.beginPath();
    ctx.moveTo(-58, 2);
    ctx.lineTo(-52, 13);
    ctx.bezierCurveTo(-15, 20, 20, 20, 56, 11);
    ctx.lineTo(72, -9);
    ctx.lineTo(66, 2);
    ctx.lineTo(-58, 2);
    ctx.closePath();
    ctx.fill();

    // Waterline scum / subtle green algae staining
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-54, 3);
    ctx.bezierCurveTo(-15, 11, 20, 11, 64, 1);
    ctx.stroke();

    // Upper Freeboard (Weathered off-white / bone with chipped paint)
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(-58, -5);
    ctx.lineTo(-58, 2);
    ctx.lineTo(66, 2);
    ctx.lineTo(72, -9);
    ctx.lineTo(66, -5);
    ctx.lineTo(-58, -5);
    ctx.closePath();
    ctx.fill();

    // Chipped paint patches exposing worn timber underneath
    ctx.fillStyle = '#78350f'; // Raw wood beneath peeled paint
    ctx.fillRect(-38, -3, 8, 2.5);
    ctx.fillRect(15, -4, 6, 2);
    ctx.fillRect(44, -2, 7, 3);

    // Lapstrake plank seam shadow lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Seam 1
    ctx.moveTo(-56, -1);
    ctx.bezierCurveTo(-15, 6, 20, 6, 68, -4);
    // Seam 2
    ctx.moveTo(-54, 6);
    ctx.bezierCurveTo(-15, 13, 20, 13, 60, 5);
    ctx.stroke();

    // Clinker plank copper rivets
    ctx.fillStyle = '#b45309';
    for (let rx = -44; rx <= 52; rx += 16) {
      ctx.beginPath();
      ctx.arc(rx, 5, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Metal repair patch plate on hull side (riveted tin plate with rust streaks)
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-12, 1, 14, 8);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-12, 1, 14, 8);
    // Rivets on patch plate
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(-10, 3, 0.8, 0, Math.PI * 2);
    ctx.arc(0, 3, 0.8, 0, Math.PI * 2);
    ctx.arc(-10, 7, 0.8, 0, Math.PI * 2);
    ctx.arc(0, 7, 0.8, 0, Math.PI * 2);
    ctx.fill();
    // Rust trickle running down into water
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, 9);
    ctx.lineTo(-4, 15);
    ctx.stroke();

    // Hull Outline & Sturdy Oak Rub Rail
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-58, -5);
    ctx.lineTo(-52, 13);
    ctx.bezierCurveTo(-15, 20, 20, 20, 56, 11);
    ctx.lineTo(72, -9);
    ctx.stroke();

    // Weathered wooden rub rail with scuffs
    ctx.strokeStyle = '#92582b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-57, -4);
    ctx.lineTo(69, -7);
    ctx.stroke();

    // Bow Chock & hanging frayed mooring rope
    ctx.fillStyle = '#b45309';
    ctx.fillRect(66, -11, 4, 3);
    ctx.strokeStyle = '#d4b483';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(68, -8);
    ctx.quadraticCurveTo(73, 2, 70, 8);
    ctx.stroke();

    // Flickering Yellow-Green Oil Lantern on Bow Stanchion Post
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(68, -18, 3, 9); // Iron post
    ctx.fillStyle = '#451a03'; // Lantern cage
    ctx.fillRect(66, -26, 7, 9);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1;
    ctx.strokeRect(66, -26, 7, 9);
    const lanternFlicker = 0.85 + 0.15 * Math.sin(this.time * 8.5) * Math.cos(this.time * 13.2);
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#bef264';
    ctx.shadowBlur = 12 * lanternFlicker;
    ctx.beginPath();
    ctx.arc(69.5, -21.5, 2.5 * lanternFlicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Transom stern board & Outboard Motor
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-59, -7, 3, 16);

    // Weathered Vintage Outboard Motor
    // Motor mount & shaft
    ctx.fillStyle = '#334155';
    ctx.fillRect(-64, -2, 6, 16);
    // Lower unit & skeg
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-66, 11, 9, 7);
    // Motor Cowling (Engine Hood with scratch marks)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-68, -16, 14, 15, [4, 4, 1, 1]);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Vintage engine brand stripe & scratch
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-67, -11, 12, 2.5);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-65, -14);
    ctx.lineTo(-59, -9);
    ctx.stroke();
    // Tiller steering arm
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-58, -12);
    ctx.lineTo(-48, -12);
    ctx.stroke();
    ctx.fillStyle = '#0f172a'; // Rubber grip
    ctx.fillRect(-50, -13, 4, 2.5);

    // 3. Equipment on Deck
    // Vintage Red Metal Tackle Box (Chipped paint & latch)
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(-29, -13, 14, 9);
    ctx.fillStyle = '#64748b'; // Scratched corner
    ctx.fillRect(-29, -13, 2, 2);
    ctx.fillStyle = '#f87171'; // Metal handle
    ctx.fillRect(-26, -15, 8, 2);
    ctx.fillStyle = '#fbbf24'; // Brass clasp
    ctx.fillRect(-23, -9, 2, 2);

    // Aerated Galvanized Bait Bucket
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(-11, -5);
    ctx.lineTo(-13, -15);
    ctx.lineTo(-3, -15);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Metal bucket handle
    ctx.strokeStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(-8, -15, 4, Math.PI, 0);
    ctx.stroke();
    // Aeration bubble froth
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-10, -14, 2, 2);
    ctx.fillRect(-7, -13, 1.5, 1.5);

    // Landing Net leaning at stern with mesh weave
    ctx.strokeStyle = '#92582b'; // Wooden net handle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-40, -5);
    ctx.lineTo(-51, -26);
    ctx.stroke();
    // Net ring & mesh pocket
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-57, -34, 12, 12);
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-57, -28);
    ctx.lineTo(-45, -28);
    ctx.moveTo(-51, -34);
    ctx.lineTo(-51, -22);
    ctx.stroke();

    // 4. Detailed Player Character (Angler in Fishing Gear)
    ctx.save();
    const ax = 9 + strainLean;
    const ay = -6;

    // Legs / Bib Trousers & Sea Boots
    ctx.fillStyle = '#1c1917'; // Heavy dark sea boots
    ctx.fillRect(ax + 3, ay - 1, 7, 5);
    ctx.fillStyle = '#a16207'; // Foul-weather waterproof bib overalls
    ctx.beginPath();
    ctx.moveTo(ax - 5, ay - 2);
    ctx.lineTo(ax + 8, ay - 2);
    ctx.lineTo(ax + 6, ay - 9);
    ctx.lineTo(ax - 6, ay - 9);
    ctx.closePath();
    ctx.fill();

    // Torso: Dark Victorian Woolen Sweater under Oilskin Angler Vest
    ctx.fillStyle = '#0f172a'; // Charcoal cable-knit sweater base
    ctx.fillRect(ax - 7, ay - 19, 13, 11);

    // Weathered Woolen Muffler / Scarf wrapped around neck with ends fluttering in cold drizzle
    ctx.fillStyle = '#991b1b'; // Dark tartan crimson
    ctx.fillRect(ax - 6, ay - 21, 12, 4);
    // Fluttering scarf tail
    const scarfFlap = Math.sin(this.time * 6) * 4;
    ctx.beginPath();
    ctx.moveTo(ax - 6, ay - 19);
    ctx.quadraticCurveTo(ax - 14, ay - 17 + scarfFlap, ax - 18, ay - 14 + scarfFlap * 1.5);
    ctx.lineTo(ax - 17, ay - 11 + scarfFlap * 1.5);
    ctx.quadraticCurveTo(ax - 12, ay - 15 + scarfFlap, ax - 5, ay - 17);
    ctx.closePath();
    ctx.fill();

    // Dark Bottle-Green Angler Utility Vest
    ctx.fillStyle = '#1e3a24';
    ctx.beginPath();
    ctx.roundRect(ax - 6, ay - 18, 11, 10, [2, 2, 0, 0]);
    ctx.fill();
    // Vest breast pockets & brass buttons
    ctx.fillStyle = '#142919';
    ctx.fillRect(ax - 4.5, ay - 16, 4, 3);
    ctx.fillRect(ax + 0.5, ay - 16, 4, 3);
    // Brass vest buttons
    ctx.fillStyle = '#b45309';
    ctx.fillRect(ax - 0.5, ay - 15, 1.2, 1.2);
    ctx.fillRect(ax - 0.5, ay - 11, 1.2, 1.2);
    ctx.fill();

    // Angler Face & Scruffy Beard Profile
    ctx.fillStyle = '#e2b197'; // Weathered skin tone
    ctx.beginPath();
    ctx.arc(ax - 0.5, ay - 23, 5.5, 0, Math.PI * 2); // Head
    ctx.fill();
    // Scruffy sailor beard & sideburn
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(ax - 2, ay - 23);
    ctx.lineTo(ax + 4.5, ay - 21);
    ctx.lineTo(ax + 3, ay - 18);
    ctx.lineTo(ax - 2, ay - 18);
    ctx.closePath();
    ctx.fill();
    // Nose & focused eye
    ctx.fillStyle = '#d4977a';
    ctx.beginPath();
    ctx.moveTo(ax + 4.5, ay - 24);
    ctx.lineTo(ax + 6.5, ay - 22.5);
    ctx.lineTo(ax + 4.5, ay - 22);
    ctx.fill();
    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(ax + 2.5, ay - 24, 1.5, 1.2);

    // Classic Yellow Sou'wester Fisherman's Rain Hat
    // Sloping rear neck shield
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.moveTo(ax - 6, ay - 23);
    ctx.lineTo(ax - 7, ay - 16);
    ctx.lineTo(ax - 2, ay - 19);
    ctx.closePath();
    ctx.fill();
    // Hat dome
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.ellipse(ax - 0.5, ay - 26, 6, 4, 0, Math.PI, 0);
    ctx.fill();
    // Turned-up front brim
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(ax - 3, ay - 25);
    ctx.lineTo(ax + 7, ay - 25.5);
    ctx.lineTo(ax + 7.5, ay - 28);
    ctx.lineTo(ax + 4.5, ay - 27);
    ctx.closePath();
    ctx.fill();

    // Angler Arms & Hands (Gripping Rod)
    ctx.strokeStyle = '#365314'; // Vest sleeve
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(ax - 2, ay - 16);
    ctx.lineTo(ax + 6, ay - 12);
    ctx.lineTo(ax + 12, ay - 13);
    ctx.stroke();

    // Sailor hands holding rod grip
    ctx.fillStyle = '#e2b197';
    ctx.beginPath();
    ctx.arc(ax + 12, ay - 13, 2, 0, Math.PI * 2);
    ctx.arc(ax + 15, ay - 14, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 5. Flexed Fishing Rod & Reel (Bends violently under Line Tension)
    const rodBaseX = 18 + strainLean;
    const rodBaseY = -19;
    const rodTipX = 66;

    // Line tension vibration and deep flex arc
    const tensionVibe = Math.sin(this.time * (32 + tensionRatio * 22)) * (1.5 + tensionRatio * 5.5);
    const rodFlex = tensionRatio * 20 + (isThrashing ? 12 : 0);
    const rodTipY = -37 + rodFlex + tensionVibe + Math.sin(this.time * 3.5) * 2;

    // Cork Rod Grip
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(rodBaseX - 3, rodBaseY - 2, 9, 3.5);

    // Spinning Reel (Mounted under rod)
    ctx.fillStyle = '#334155';
    ctx.fillRect(rodBaseX + 2, rodBaseY + 1.5, 3, 4); // Reel foot
    ctx.fillStyle = '#e2e8f0'; // Metallic spool
    ctx.beginPath();
    ctx.roundRect(rodBaseX + 1, rodBaseY + 5.5, 6, 6, 2);
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Graphite Rod Blank (Deep violent curve under tension)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rodBaseX + 6, rodBaseY);
    ctx.quadraticCurveTo(38, -32 + rodFlex * 0.7 + tensionVibe * 0.4, rodTipX, rodTipY);
    ctx.stroke();

    // Chrome Rod Guide Rings along blank
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(32, -26 + rodFlex * 0.35, 1.5, 0, Math.PI * 2);
    ctx.arc(48, -31 + rodFlex * 0.65, 1.3, 0, Math.PI * 2);
    ctx.stroke();

    // Fluorescent Red High-Visibility Rod Tip with tension spray
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(rodTipX, rodTipY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Flying water spray droplets from rod tip under high tension
    if (tensionRatio > 0.4 || isThrashing) {
      ctx.fillStyle = 'rgba(203, 213, 225, 0.75)';
      for (let s = 0; s < 3; s++) {
        const sx = rodTipX + Math.sin(this.time * 20 + s) * 8;
        const sy = rodTipY + Math.cos(this.time * 24 + s) * 6;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Water spray foam at hull waterline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(52, 11, 3.5, 0, Math.PI * 2);
    ctx.arc(-42, 11, 3, 0, Math.PI * 2);
    ctx.arc(10, 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      x + rodTipX * cos - rodTipY * sin,
      y + rodTipX * sin + rodTipY * cos
    );
  }

  private renderFishingLine(ctx: CanvasRenderingContext2D, rodTip: Vector2, fishMouth: Vector2, waterY: number): void {
    ctx.save();
    const lineVibrate = Math.sin(this.time * 35) * 0.7;
    const midX = (rodTip.x + fishMouth.x) / 2;
    const midY = (rodTip.y + fishMouth.y) / 2 + 8 + lineVibrate;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rodTip.x, rodTip.y);
    ctx.quadraticCurveTo(midX, midY, fishMouth.x, fishMouth.y);
    ctx.stroke();

    // Entry ripple splash where line enters water surface
    const tEntry = (waterY - rodTip.y) / (fishMouth.y - rodTip.y);
    if (tEntry > 0 && tEntry < 1) {
      const entryX = rodTip.x + (fishMouth.x - rodTip.x) * tEntry;
      ctx.strokeStyle = 'rgba(167, 243, 208, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(entryX, waterY, 8 + Math.sin(this.time * 9) * 3, 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Emit continuous dark water & foam spray particles where line cuts surface
      if (Math.random() < 0.5) {
        this.lineWaterSplashes.push({
          x: entryX + (Math.random() - 0.5) * 6,
          y: waterY - 1,
          r: 1.2 + Math.random() * 2,
          alpha: 0.85,
          vx: (Math.random() - 0.5) * 25,
          vy: -18 - Math.random() * 20
        });
      }
    }

    // Render active line water splash particles
    for (const sp of this.lineWaterSplashes) {
      ctx.fillStyle = `rgba(167, 243, 208, ${Math.max(0, sp.alpha * 0.8)})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private triggerCardPlayJuice(cardIndex: number): void {
    const card = this.battle.hand[cardIndex];
    if (!card) return;

    const isTechnique = this.battle.isCardTechnique(card);
    if (isTechnique) {
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 18);
      this.damageFlashAlpha = 0.85;
      this.spawnOccultTechniqueBurst(this.fishPos.x, this.fishPos.y);
      if (card.effect.pullDistance && card.effect.pullDistance > 0) {
        this.spawnHookSlash(this.fishPos.x, this.fishPos.y);
        this.spawnInkBurst(this.fishPos.x, this.fishPos.y);
      }
    } else if (card.cardType === 'Reel') {
      const pull = card.effect.pullDistance || 10;
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 8 + pull * 0.7);
      this.spawnHookSlash(this.fishPos.x, this.fishPos.y);
      this.spawnInkBurst(this.fishPos.x, this.fishPos.y);
    } else if (card.cardType === 'Drag') {
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 5);
      this.spawnWardSigil(this.fishPos.x, this.fishPos.y);
    } else {
      this.screenShakeIntensity = Math.max(this.screenShakeIntensity, 7);
      this.spawnWardSigil(this.fishPos.x, this.fishPos.y);
    }
  }

  private spawnOccultTechniqueBurst(x: number, y: number): void {
    for (let i = 0; i < 22; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 120;
      this.combatEffects.push({
        type: 'ink_splash',
        x,
        y,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 25,
        radius: 3 + Math.random() * 4,
        color: Math.random() < 0.6 ? '#c084fc' : '#a855f7'
      });
    }
    this.combatEffects.push({
      type: 'ward_sigil',
      x,
      y,
      life: 0,
      maxLife: 0.6,
      radius: 36,
      color: '#e9d5ff'
    });
  }

  private spawnHookSlash(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      this.combatEffects.push({
        type: 'slash',
        x: x + (Math.random() - 0.5) * 24,
        y: y + (Math.random() - 0.5) * 24,
        life: 0,
        maxLife: 0.28,
        angle: (Math.random() - 0.5) * 0.8 - Math.PI / 4,
        length: 50 + Math.random() * 32,
        color: i === 0 ? '#ffffff' : '#f43f5e'
      });
    }
  }

  private spawnInkBurst(x: number, y: number): void {
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 35 + Math.random() * 95;
      this.combatEffects.push({
        type: 'ink_splash',
        x,
        y,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 22,
        radius: 2 + Math.random() * 3.5,
        color: Math.random() < 0.7 ? '#04070c' : '#1e293b'
      });
    }
  }

  private spawnWardSigil(x: number, y: number): void {
    this.combatEffects.push({
      type: 'ward_sigil',
      x,
      y,
      life: 0,
      maxLife: 0.45,
      radius: 16,
      color: '#38bdf8'
    });
  }

  private renderCombatEffects(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const vfx of this.combatEffects) {
      const progress = vfx.life / vfx.maxLife;
      const alpha = Math.max(0, 1 - progress);

      if (vfx.type === 'slash') {
        const len = (vfx.length || 60) * (0.8 + progress * 0.4);
        ctx.save();
        ctx.translate(vfx.x, vfx.y);
        ctx.rotate(vfx.angle || 0);
        ctx.strokeStyle = vfx.color || '#f43f5e';
        ctx.lineWidth = 3.5 * alpha;
        ctx.shadowColor = vfx.color || '#f43f5e';
        ctx.shadowBlur = 12 * alpha;
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(-len / 6, (Math.random() - 0.5) * 4);
        ctx.lineTo(len / 6, (Math.random() - 0.5) * 4);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.restore();
      } else if (vfx.type === 'ink_splash') {
        ctx.fillStyle = vfx.color || '#04070c';
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, (vfx.radius || 3) * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fill();
      } else if (vfx.type === 'ward_sigil') {
        const r = (vfx.radius || 16) + progress * 55;
        ctx.strokeStyle = vfx.color || '#38bdf8';
        ctx.lineWidth = 2.5 * alpha;
        ctx.shadowColor = vfx.color || '#38bdf8';
        ctx.shadowBlur = 10 * alpha;
        ctx.beginPath();
        ctx.arc(vfx.x, vfx.y, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vfx.x - r, vfx.y);
        ctx.lineTo(vfx.x + r, vfx.y);
        ctx.moveTo(vfx.x, vfx.y - r);
        ctx.lineTo(vfx.x, vfx.y + r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderFishIntent(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const intent = this.battle.getCurrentIntent();
    const effectiveValue = this.battle.getEffectiveIntentValue();

    ctx.save();
    const pillW = 160;
    const pillH = 36;
    const pillX = x - pillW / 2;
    const pillY = y - pillH / 2;

    let bgGradColor = 'rgba(239, 68, 68, 0.9)';
    let intentIcon = '⚡';
    let intentText = `Thrash: ${effectiveValue} Tension`;

    if (intent.type === 'DeepDive') {
      bgGradColor = 'rgba(168, 85, 247, 0.9)';
      intentIcon = '⬇';
      intentText = `Deep Dive: +${intent.value}m`;
    } else if (intent.type === 'Rest') {
      bgGradColor = 'rgba(100, 116, 139, 0.9)';
      intentIcon = '💤';
      intentText = 'Resting (0 Tension)';
    }

    ctx.fillStyle = bgGradColor;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${intentIcon} ${intentText}`, x, y);

    let extraOffset = 26;
    if (this.battle.fishExhausted > 0) {
      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillText(`(Exhausted: -${this.battle.fishExhausted} Thrash Power)`, x, y + extraOffset);
      extraOffset += 15;
    }
    if (this.battle.fishChummed > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.fillText(`(Chummed: +3m to All Pulls • ${this.battle.fishChummed} Turns)`, x, y + extraOffset);
    }
    ctx.restore();
  }

  private renderDetailedDioramaFrame(ctx: CanvasRenderingContext2D, width: number, height: number, _waterLevelY: number): void {
    ctx.save();

    // Dark Victorian Polished Mahogany & Tarnished Brass outer frame
    ctx.strokeStyle = '#140c06'; // Dark aged mahogany
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, width - 10, height - 10);

    ctx.strokeStyle = '#b45309'; // Tarnished brass inner line
    ctx.lineWidth = 1.8;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Engraved Victorian brass corner rivets
    const rivets = [
      { x: 15, y: 15 },
      { x: width - 15, y: 15 },
      { x: 15, y: height - 15 },
      { x: width - 15, y: height - 15 }
    ];
    for (const r of rivets) {
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Overlapping procedural ruler disabled in favor of modular ui_depth_gauge.png
    ctx.restore();
  }

  private renderCombatHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();

    // 1. GOTHIC REEL RESISTANCE TENSION GAUGE (Top Center)
    const gaugeW = 300;
    const gaugeH = 72;
    const gaugeX = (width - gaugeW) / 2;
    const gaugeY = 12;

    const gaugeImg = SideViewDiorama.getImage('ui_power_tension_gauge.png');
    if (gaugeImg && gaugeImg.complete && gaugeImg.naturalWidth > 0) {
      ctx.drawImage(gaugeImg, gaugeX, gaugeY, gaugeW, gaugeH);
    }

    // Dynamic Color Fill Bar inside metallic gauge aperture
    const meterX = gaugeX + Math.floor(gaugeW * 0.14);
    const meterY = gaugeY + Math.floor(gaugeH * 0.40);
    const meterW = Math.floor(gaugeW * 0.72);
    const meterH = Math.floor(gaugeH * 0.24);

    ctx.fillStyle = '#060a0f';
    ctx.fillRect(meterX, meterY, meterW, meterH);

    const hpRatio = Math.max(0, this.battle.lineIntegrity / this.battle.maxLineIntegrity);
    const fillW = Math.max(2, Math.floor(meterW * hpRatio));

    const fillGrad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
    if (hpRatio < 0.35) {
      fillGrad.addColorStop(0, '#ef4444');
      fillGrad.addColorStop(1, '#991b1b');
    } else if (hpRatio < 0.65) {
      fillGrad.addColorStop(0, '#f59e0b');
      fillGrad.addColorStop(1, '#d97706');
    } else {
      fillGrad.addColorStop(0, '#10b981');
      fillGrad.addColorStop(1, '#059669');
    }

    ctx.fillStyle = fillGrad;
    ctx.fillRect(meterX, meterY, fillW, meterH);

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(meterX, meterY, meterW, meterH);

    ctx.font = 'bold 9px "Georgia", serif';
    ctx.fillStyle = hpRatio < 0.35 ? '#fef2f2' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LINE INTEGRITY: ${this.battle.lineIntegrity} / ${this.battle.maxLineIntegrity} HP`, meterX + meterW / 2, meterY + meterH / 2);

    // SLACK BADGE (Block) - Right of gauge
    const slackX = gaugeX + gaugeW + 12;
    const slackY = gaugeY + 16;
    const slackW = 100;
    const slackH = 38;

    ctx.fillStyle = 'rgba(11, 25, 36, 0.95)';
    ctx.strokeStyle = this.battle.lineSlack > 0 ? '#38bdf8' : '#334155';
    ctx.lineWidth = this.battle.lineSlack > 0 ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.roundRect(slackX, slackY, slackW, slackH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px "Georgia", serif';
    ctx.fillStyle = this.battle.lineSlack > 0 ? '#38bdf8' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🛡️ SLACK: +${this.battle.lineSlack}`, slackX + slackW / 2, slackY + slackH / 2);

    // STAMINA ORBS - Left of gauge
    const stamX = gaugeX - 135;
    const stamY = gaugeY + 16;
    const stamW = 120;
    const stamH = 38;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(stamX, stamY, stamW, stamH, 4);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10px "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`STAMINA:`, stamX + 8, stamY + stamH / 2);

    for (let i = 0; i < this.battle.maxStamina; i++) {
      const ox = stamX + 74 + i * 20;
      const oy = stamY + stamH / 2;
      const or = 8.0;

      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(ox, oy, or, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (i < this.battle.stamina) {
        const gemGrad = ctx.createRadialGradient(ox - 2, oy - 2, 1, ox, oy, or - 1);
        gemGrad.addColorStop(0, '#fef08a');
        gemGrad.addColorStop(0.5, '#eab308');
        gemGrad.addColorStop(1, '#78350f');
        ctx.fillStyle = gemGrad;
        ctx.beginPath();
        ctx.arc(ox, oy, or - 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. METRIC DEPTH GAUGE (Right Edge)
    const depthImg = SideViewDiorama.getImage('ui_depth_gauge.png');
    const depthW = 34;
    const depthH = Math.floor(ctx.canvas.height * 0.65);
    const depthX = width - depthW - 10;
    const depthY = Math.floor(ctx.canvas.height * 0.16);

    if (depthImg && depthImg.complete && depthImg.naturalWidth > 0) {
      ctx.drawImage(depthImg, depthX, depthY, depthW, depthH);

      const needleRatio = Math.min(1.0, this.battle.distanceToBoat / 120);
      const needleY = depthY + 30 + needleRatio * (depthH - 60);

      ctx.save();
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#1e1b18';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(depthX - 4, needleY);
      ctx.lineTo(depthX + 9, needleY - 4);
      ctx.lineTo(depthX + 9, needleY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9px "Georgia", serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(this.battle.distanceToBoat)}m`, depthX - 6, needleY + 3);
      ctx.restore();
    }



    // 2. Fish HP / Distance to Boat Gauge
    const fishGaugeW = 280;
    const fishGaugeH = 46;
    const fishGaugeX = width - fishGaugeW - 20;
    const fishGaugeY = 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(fishGaugeX, fishGaugeY, fishGaugeW, fishGaugeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.battle.fish.speciesName.toUpperCase()} — DISTANCE`, fishGaugeX + 12, fishGaugeY + 8);

    const distRatio = Math.max(0, this.battle.distanceToBoat / this.battle.maxStartingDistance);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(fishGaugeX + 12, fishGaugeY + 24, 180, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(fishGaugeX + 12, fishGaugeY + 24, 180 * Math.min(1.0, distRatio), 12);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Segoe UI", monospace';
    ctx.fillText(`${Math.round(this.battle.distanceToBoat)}m`, fishGaugeX + 204, fishGaugeY + 24);

    ctx.restore();
  }

  private renderHand(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const hand = this.battle.hand;
    const cardCount = hand.length;

    // 1. Draw pile indicator (bottom left)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, height - 76, 90, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRAW PILE', 24 + 45, height - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", monospace';
    ctx.fillText(`${this.battle.drawPile.length}`, 24 + 45, height - 36);
    ctx.restore();

    // 2. Discard pile indicator (bottom right)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width - 114, height - 76, 90, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISCARD', width - 114 + 45, height - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", monospace';
    ctx.fillText(`${this.battle.discardPile.length}`, width - 114 + 45, height - 36);
    ctx.restore();

    // 2B. Exhausted Techniques pile indicator
    if (this.battle.exhaustPile.length > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(30, 12, 48, 0.92)';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(width - 214, height - 76, 90, 52, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#d8b4fe';
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXHAUSTED', width - 214 + 45, height - 58);
      ctx.fillStyle = '#f5d0fe';
      ctx.font = 'bold 18px "Segoe UI", monospace';
      ctx.fillText(`${this.battle.exhaustPile.length}`, width - 214 + 45, height - 36);
      ctx.restore();
    }

    if (cardCount === 0) return;

    // 3. Render Hand Cards in a Curved Hand Arc
    const scale = this.getCardScale(width);
    const cardW = CardVisualSocket.CARD_WIDTH * scale;
    const cardH = CardVisualSocket.CARD_HEIGHT * scale;
    const maxHandSpan = Math.min(width - 260, cardCount * (cardW + 16));
    const startX = (width - maxHandSpan) / 2 + cardW / 2;
    const spacing = cardCount > 1 ? (maxHandSpan - cardW) / (cardCount - 1) : 0;
    const baseY = height - cardH / 2 - 14;

    const getCardLayout = (i: number) => {
      const centerDist = i - (cardCount - 1) / 2;
      const cx = cardCount === 1 ? width / 2 : startX + i * spacing;
      const arcDrop = Math.pow(centerDist, 2) * 5; // Curve downward towards edges
      const arcAngle = centerDist * 0.048; // Fan angle
      const isHovered = i === this.hoveredCardIndex;
      const isPlayable = this.battle.canPlayCard(i);

      // On hover: elevate up, straighten rotation, slight 3D perspective tilt
      const lift = isHovered ? 40 : 0;
      const cy = baseY + arcDrop - lift;
      const cardScale = scale * (isHovered ? 1.10 : 1.0);
      const mousePos = Input.getMousePosition();
      const tilt = isHovered ? (mousePos.x - cx) * 0.0012 : arcAngle;

      return { cx, cy, cardScale, tilt, isHovered, isPlayable, card: hand[i], cardH };
    };

    // Render non-hovered cards first, then hovered card on top to prevent clipping
    const renderCardAt = (i: number) => {
      const { cx, cy, cardScale, tilt, isHovered, isPlayable, card, cardH } = getCardLayout(i);

      this.cardSocket.render(ctx, {
        position: new Vector2(cx, cy),
        rotation: tilt,
        scale: new Vector2(cardScale, cardScale)
      }, {
        card,
        isHovered,
        isSelected: false,
        isPlayable
      });

      // Keyboard shortcut badge above card: e.g. [1], [2], [3]
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.fillStyle = isPlayable ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.arc(0, -(cardH / 2) * cardScale - 10, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, 0, -(cardH / 2) * cardScale - 10);
      ctx.restore();
    };

    for (let i = 0; i < cardCount; i++) {
      if (i !== this.hoveredCardIndex) {
        renderCardAt(i);
      }
    }

    if (this.hoveredCardIndex >= 0 && this.hoveredCardIndex < cardCount) {
      renderCardAt(this.hoveredCardIndex);
    }
  }

  private renderEndTurnButton(ctx: CanvasRenderingContext2D): void {
    const btn = this.endTurnBtnRect;

    ctx.save();
    ctx.fillStyle = this.isEndTurnBtnHovered ? '#451a03' : '#1c1917';
    ctx.strokeStyle = this.isEndTurnBtnHovered ? '#f59e0b' : '#78350f';
    ctx.lineWidth = this.isEndTurnBtnHovered ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.isEndTurnBtnHovered ? '#fef08a' : '#fde047';
    ctx.font = 'bold 13px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏳ END TURN', btn.x + btn.w / 2, btn.y + btn.h / 2 - 8);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 10px "Georgia", serif';
    ctx.fillText('Fish Thrash Next [SPACE]', btn.x + btn.w / 2, btn.y + btn.h / 2 + 10);

    ctx.restore();
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.battle.floatingTexts.length === 0) return;

    ctx.save();
    for (const ft of this.battle.floatingTexts) {
      const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      const px = width * ft.x;
      const py = height * ft.y;

      // Stark punchy pop bounce on spawn
      const spawnProgress = Math.min(1.0, ft.life / 0.16);
      const popScale = 1.35 - 0.35 * spawnProgress;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(popScale, popScale);
      ctx.globalAlpha = alpha;

      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#020408';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'miter';
      ctx.font = 'bold 21px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(ft.text, 0, 0);
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private renderTopNav(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const btn = this.returnBtnRect;
    ctx.fillStyle = this.isReturnBtnHovered ? '#1c1917' : '#0a0d12';
    ctx.strokeStyle = this.isReturnBtnHovered ? '#fbbf24' : '#78350f';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀ FLEE [ESC]', btn.x + btn.w / 2, btn.y + btn.h / 2);

    ctx.restore();
  }

  private renderEndGameModal(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const t = this.time;
    const isVictory = this.battle.status === 'victory';

    // 1. Dark Abyssal Backdrop Overlay
    ctx.fillStyle = isVictory ? 'rgba(2, 5, 10, 0.88)' : 'rgba(10, 2, 4, 0.90)';
    ctx.fillRect(0, 0, width, height);

    // 2. Main Frame Architecture
    const modalW = Math.min(680, width - 40);
    const modalH = Math.min(470, height - 40);
    const mx = (width - modalW) / 2;
    const my = (height - modalH) / 2;

    // Heavy Eldritch Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 32;

    const bgGrad = ctx.createLinearGradient(mx, my, mx, my + modalH);
    if (isVictory) {
      bgGrad.addColorStop(0, '#0c131d');
      bgGrad.addColorStop(1, '#05080e');
    } else {
      bgGrad.addColorStop(0, '#1c0f12');
      bgGrad.addColorStop(1, '#0c0708');
    }
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.roundRect(mx, my, modalW, modalH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tarnished Brass or Crimson Border
    ctx.strokeStyle = isVictory ? '#b45309' : '#dc2626';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Inner Fine Inset
    ctx.strokeStyle = isVictory ? 'rgba(253, 224, 71, 0.25)' : 'rgba(248, 113, 113, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx + 6, my + 6, modalW - 12, modalH - 12, 6);
    ctx.stroke();

    // 3. Four Gothic Ornamental Corners
    const cornerImg = SideViewDiorama.getImage('ui_frame_corner_bottom_left.png');
    if (cornerImg && cornerImg.complete && cornerImg.naturalWidth > 0) {
      const cw = 34;
      const ch = 52;
      // Bottom-Left
      ctx.drawImage(cornerImg, mx + 4, my + modalH - ch - 4, cw, ch);
      // Bottom-Right
      ctx.save();
      ctx.translate(mx + modalW - 4, my + modalH - ch - 4);
      ctx.scale(-1, 1);
      ctx.drawImage(cornerImg, 0, 0, cw, ch);
      ctx.restore();
      // Top-Left
      ctx.save();
      ctx.translate(mx + 4, my + ch + 4);
      ctx.scale(1, -1);
      ctx.drawImage(cornerImg, 0, 0, cw, ch);
      ctx.restore();
      // Top-Right
      ctx.save();
      ctx.translate(mx + modalW - 4, my + ch + 4);
      ctx.scale(-1, -1);
      ctx.drawImage(cornerImg, 0, 0, cw, ch);
      ctx.restore();
    }

    if (isVictory) {
      // 4. Header Plate (Engraved Metal Ribbon Flanked by Bone Hooks)
      const headW = modalW - 80;
      const headH = 48;
      const headX = mx + 40;
      const headY = my + 18;

      ctx.fillStyle = '#171412';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, 4);
      ctx.fill();
      ctx.stroke();

      const hookImg = SideViewDiorama.getImage('tackle_hook_bone.png');
      if (hookImg && hookImg.complete && hookImg.naturalWidth > 0) {
        ctx.drawImage(hookImg, headX + 16, headY + 6, 18, 36);
        ctx.save();
        ctx.translate(headX + headW - 16, headY + 6);
        ctx.scale(-1, 1);
        ctx.drawImage(hookImg, 0, 0, 18, 36);
        ctx.restore();
      }

      ctx.font = 'bold 20px "Georgia", serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚓ QUARRY HAULED ABOARD! ⚓', mx + modalW / 2, headY + 18);

      ctx.font = 'bold 9px "Georgia", serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('BOUNTY SECURED • TACKLE SURVIVED THE DEEP', mx + modalW / 2, headY + 35);

      // 5. Left Section: Angler with Lantern Celebrating Catch
      const fmImg = SideViewDiorama.getImage('fisherman_holding_lantern.png');
      const fmW = 100;
      const fmH = 134;
      const fmX = mx + 36;
      const fmY = my + 130;

      if (fmImg && fmImg.complete && fmImg.naturalWidth > 0) {
        const lanternGrad = ctx.createRadialGradient(fmX + 68, fmY + 75, 4, fmX + 68, fmY + 75, 90);
        lanternGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        lanternGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.15)');
        lanternGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lanternGrad;
        ctx.beginPath();
        ctx.arc(fmX + 68, fmY + 75, 90, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(fmImg, fmX, fmY, fmW, fmH);
      }

      ctx.font = 'bold 8.5px "Georgia", serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText('ANGLER OF INNSMOUTH', fmX + fmW / 2, fmY + fmH + 16);

      // 6. Center-Right: Caught Specimen Showcase Alcove
      const alcoveW = modalW - 216;
      const alcoveH = 148;
      const alcoveX = mx + 172;
      const alcoveY = my + 80;

      const alcoveGrad = ctx.createLinearGradient(alcoveX, alcoveY, alcoveX, alcoveY + alcoveH);
      alcoveGrad.addColorStop(0, '#040d16');
      alcoveGrad.addColorStop(0.5, '#081726');
      alcoveGrad.addColorStop(1, '#02060a');
      ctx.fillStyle = alcoveGrad;
      ctx.beginPath();
      ctx.roundRect(alcoveX, alcoveY, alcoveW, alcoveH, 6);
      ctx.fill();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const rippleImg = SideViewDiorama.getImage('fx_water_ripple.png');
      if (rippleImg && rippleImg.complete && rippleImg.naturalWidth > 0) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(rippleImg, alcoveX + 35, alcoveY + alcoveH - 30, alcoveW - 70, 22);
        ctx.globalAlpha = 1.0;
      }

      // Draw the Caught Fish Sprite (Bobbing gently in showcase alcove)
      const fishSpriteName = this.battle.fish.speciesType === 'perch'
        ? 'fish_shadowy_perch_s6.png'
        : (this.battle.fish.speciesType === 'pike'
            ? 'fish_spiky_sculpin.png'
            : (this.battle.fish.speciesType === 'dagon'
                ? 'leviathan_apex_dagon.png'
                : 'fish_angler_pale_lure.png'));

      const fishSprite = SideViewDiorama.getImage(fishSpriteName);
      if (fishSprite && fishSprite.complete && fishSprite.naturalWidth > 0) {
        ctx.save();
        const fishBobY = Math.sin(t * 2.8) * 3.5;
        const dw = Math.min(220, fishSprite.naturalWidth * 0.9);
        const dh = Math.min(130, fishSprite.naturalHeight * 0.9);
        const fx = alcoveX + alcoveW / 2;
        const fy = alcoveY + alcoveH / 2 - 6 + fishBobY;

        if (this.battle.fish.speciesType === 'gar' || this.battle.fish.speciesType === 'dagon') {
          ctx.shadowColor = this.battle.fish.speciesType === 'dagon' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(52, 211, 153, 0.5)';
          ctx.shadowBlur = 18;
        }

        ctx.translate(fx, fy);
        ctx.scale(-1, 1);
        ctx.drawImage(fishSprite, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }

      ctx.font = 'bold 12.5px "Georgia", serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(this.battle.fish.speciesName.toUpperCase(), alcoveX + alcoveW / 2, alcoveY + 18);

      ctx.font = 'bold 8px "Segoe UI", sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`★ ${this.battle.fish.rarity.toUpperCase()} QUARRY ★`, alcoveX + alcoveW / 2, alcoveY + 31);

      // 7. Middle: Parchment Catch Ledger & Bounty Plate
      const plateX = alcoveX;
      const plateY = alcoveY + alcoveH + 10;
      const plateW = alcoveW;
      const plateH = 118;

      const plateImg = SideViewDiorama.getImage('parchment_item_plate.png');
      if (plateImg && plateImg.complete && plateImg.naturalWidth > 0) {
        ctx.drawImage(plateImg, plateX, plateY, plateW, plateH);
      } else {
        ctx.fillStyle = '#1c1714';
        ctx.beginPath();
        ctx.roundRect(plateX, plateY, plateW, plateH, 4);
        ctx.fill();
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      const gold = this.battle.fish.sellValue;
      const colW = plateW / 3;

      // Col 1: Bounty
      ctx.font = 'bold 8.5px "Georgia", serif';
      ctx.fillStyle = '#78350f';
      ctx.textAlign = 'center';
      ctx.fillText('BOUNTY EARNED', plateX + colW * 0.5, plateY + 22);

      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = '#b45309';
      ctx.fillText(`+${gold} Gold`, plateX + colW * 0.5, plateY + 44);

      // Col 2: Haul
      ctx.font = 'bold 8.5px "Georgia", serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText('HAUL DISTANCE', plateX + colW * 1.5, plateY + 22);

      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${this.battle.fish.startingDistance}m Hauled`, plateX + colW * 1.5, plateY + 44);

      // Col 3: Line Condition
      ctx.font = 'bold 8.5px "Georgia", serif';
      ctx.fillStyle = '#78350f';
      ctx.fillText('TACKLE INTEGRITY', plateX + colW * 2.5, plateY + 22);

      const durabilityPct = Math.round((this.battle.lineIntegrity / this.battle.maxLineIntegrity) * 100);
      ctx.font = 'bold 16px "Georgia", serif';
      ctx.fillStyle = durabilityPct >= 50 ? '#065f46' : '#991b1b';
      ctx.fillText(`${this.battle.lineIntegrity}/20 HP (${durabilityPct}%)`, plateX + colW * 2.5, plateY + 44);

      // Lore Snippet
      ctx.font = 'italic 8px "Georgia", serif';
      ctx.fillStyle = '#44382c';
      ctx.fillText(`"${this.battle.fish.description.slice(0, 95)}..."`, plateX + plateW / 2, plateY + 76);

      // 8. Action Button (Gothic Metal Plate with Hover Glow)
      const btn = this.victoryReturnBtnRect;
      const btnGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (this.isVictoryBtnHovered) {
        btnGrad.addColorStop(0, '#d97706');
        btnGrad.addColorStop(1, '#92400e');
      } else {
        btnGrad.addColorStop(0, '#92400e');
        btnGrad.addColorStop(1, '#451a03');
      }
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
      ctx.fill();

      ctx.strokeStyle = this.isVictoryBtnHovered ? '#fef08a' : '#f59e0b';
      ctx.lineWidth = this.isVictoryBtnHovered ? 2.2 : 1.5;
      ctx.stroke();

      ctx.font = 'bold 12.5px "Georgia", serif';
      ctx.fillStyle = this.isVictoryBtnHovered ? '#ffffff' : '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚓ CLAIM BOUNTY & RETURN [SPACE]', btn.x + btn.w / 2, btn.y + btn.h / 2);

    } else {
      // DEFEAT MODAL OVERLAY
      const headW = modalW - 80;
      const headH = 48;
      const headX = mx + 40;
      const headY = my + 24;

      ctx.fillStyle = '#1c0f12';
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(headX, headY, headW, headH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 20px "Georgia", serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥 LINE SNAPPED IN THE DEEP!', mx + modalW / 2, headY + 18);

      ctx.font = 'bold 9px "Georgia", serif';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('TACKLE FAILED • THE BEAST ESCAPED INTO THE VOID', mx + modalW / 2, headY + 35);

      ctx.font = '14px "Georgia", serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`The line could not endure the thrash tension of the ${this.battle.fish.speciesName}.`, mx + modalW / 2, my + 130);
      ctx.fillText(`It snapped under immense tension, disappearing with your lure into the gloom.`, mx + modalW / 2, my + 160);

      // Defeat Stats Box
      const statW = modalW - 140;
      const statH = 90;
      const statX = mx + 70;
      const statY = my + 200;

      ctx.fillStyle = '#180a0c';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(statX, statY, statW, statH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px "Georgia", serif';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`ENCOUNTER CASUALTY REPORT`, statX + statW / 2, statY + 22);

      ctx.font = '11px "Georgia", serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`Quarry: ${this.battle.fish.speciesName} (${this.battle.fish.rarity})`, statX + statW / 2, statY + 45);
      ctx.fillText(`Distance Remaining: ${Math.round(this.battle.distanceToBoat)}m of ${this.battle.maxStartingDistance}m`, statX + statW / 2, statY + 68);

      // Retry Action Button
      const btn = this.victoryReturnBtnRect;
      const btnGrad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.h);
      if (this.isVictoryBtnHovered) {
        btnGrad.addColorStop(0, '#dc2626');
        btnGrad.addColorStop(1, '#991b1b');
      } else {
        btnGrad.addColorStop(0, '#991b1b');
        btnGrad.addColorStop(1, '#450a0a');
      }
      ctx.fillStyle = btnGrad;
      ctx.beginPath();
      ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
      ctx.fill();

      ctx.strokeStyle = this.isVictoryBtnHovered ? '#fca5a5' : '#ef4444';
      ctx.lineWidth = this.isVictoryBtnHovered ? 2.2 : 1.5;
      ctx.stroke();

      ctx.font = 'bold 12.5px "Georgia", serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RE-RIG TACKLE & RETRY [SPACE] 🔄', btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    ctx.restore();
  }
}
