import type { WaterZoneType } from '../overworld/FishingSpot';
import type { SpeciesType } from '../battle/FishData';

export type ZoneTier = 1 | 2 | 3 | 4;

export type SkyboxType = 'open_sky' | 'cave_ceiling';
export type CelestialType = 'moon' | 'fog_moon' | 'storm_obscured' | 'none';
export type ParticleType = 'plankton' | 'bubbles' | 'vent_sparks';

export interface SkyboxConfig {
  type: SkyboxType;
  skyTop: string;
  skyBottom: string;
  backdropSprite?: string;
  horizonProp?: string;
  celestialType: CelestialType;
  showRain?: boolean;
  showLighthouseBeam?: boolean;
  showStalactites?: boolean;
  showChimneyVents?: boolean;
  fogColor?: string;
  fogDensity?: number;
}

export interface WaveConfig {
  primaryWaveSprite: string;
  secondaryWaveSprite: string;
  foregroundBreakerSprite?: string;
  foamPatchSprite?: string;
  whitecapSprite?: string;
  waveSpeed: number;
  waveAmp: number;
  waveDrift: number;
  foamColor: string;
}

export interface WaterPropConfig {
  sprite: string;
  xRatio: number;
  yRatio: number;
  w: number;
  h: number;
  sway?: boolean;
  glow?: string;
  alpha?: number;
}

export interface WaterColumnConfig {
  midColor: string;
  deepColor: string;
  bedColor: string;
  causticsColor: string;
  lightRayColor: string;
  props: WaterPropConfig[];
  particleType: ParticleType;
}

export interface ZoneProfile {
  tier: ZoneTier;
  id: string;
  name: string;
  depthRange: [number, number];
  sky: SkyboxConfig;
  waves: WaveConfig;
  waterColumn: WaterColumnConfig;
  ambientFishSprites: string[];
}

export const ZONE_PROFILES: Record<ZoneTier, ZoneProfile> = {
  1: {
    tier: 1,
    id: 'coastal_shoals',
    name: 'Coastal Shoals (Innsmouth Coastal)',
    depthRange: [0, 30],
    sky: {
      type: 'open_sky',
      skyTop: '#02040a',
      skyBottom: '#182430',
      backdropSprite: 'bg_coastal_lighthouse.png',
      horizonProp: undefined,
      celestialType: 'moon',
      showRain: false,
      showLighthouseBeam: true,
      showStalactites: false,
      showChimneyVents: false,
      fogColor: 'rgba(24, 36, 48, 0.35)',
      fogDensity: 0.25
    },
    waves: {
      primaryWaveSprite: 'waves_misty_swell_1024_feathered.png',
      secondaryWaveSprite: 'waves_moonlit_crest_1024_feathered.png',
      foregroundBreakerSprite: undefined,
      foamPatchSprite: undefined,
      whitecapSprite: undefined,
      waveSpeed: 1.0,
      waveAmp: 2.2,
      waveDrift: 0.7,
      foamColor: 'rgba(167, 243, 208, 0.35)'
    },
    waterColumn: {
      midColor: '#12261f',
      deepColor: '#071510',
      bedColor: '#030a07',
      causticsColor: 'rgba(167, 243, 208, 0.15)',
      lightRayColor: 'rgba(167, 243, 208, 0.08)',
      particleType: 'plankton',
      props: [
        { sprite: 'pier_breakwater_beam.png', xRatio: 0.15, yRatio: 0.82, w: 90, h: 150, sway: false },
        { sprite: 'pier_piling_pair.png', xRatio: 0.82, yRatio: 0.80, w: 50, h: 172, sway: false },
        { sprite: 'wood_piling_stump.png', xRatio: 0.75, yRatio: 0.88, w: 46, h: 150, sway: false }
      ]
    },
    ambientFishSprites: [
      'fish_animated_minnow_sheet.png',
      'fish_school_minnows.png',
      'fish_shadowy_minnow_tiny1.png',
      'fish_shadowy_perch_s6.png'
    ]
  },
  2: {
    tier: 2,
    id: 'sunken_reef',
    name: 'Kelp Shallows (Sunken Reef)',
    depthRange: [30, 60],
    sky: {
      type: 'open_sky',
      skyTop: '#040d08',
      skyBottom: '#142c1c',
      backdropSprite: 'bg_kelp_shallows.png',
      horizonProp: 'prop_dock_pilings_kelp.png',
      celestialType: 'fog_moon',
      showRain: false,
      showLighthouseBeam: false,
      showStalactites: false,
      showChimneyVents: false,
      fogColor: 'rgba(20, 44, 28, 0.45)',
      fogDensity: 0.40
    },
    waves: {
      primaryWaveSprite: 'waves_moonlit_crest_1024_feathered.png',
      secondaryWaveSprite: 'waves_misty_swell_1024_feathered.png',
      foregroundBreakerSprite: undefined,
      foamPatchSprite: undefined,
      whitecapSprite: 'fx_wave_moonlit_curl.png',
      waveSpeed: 1.5,
      waveAmp: 3.0,
      waveDrift: 1.0,
      foamColor: 'rgba(94, 234, 212, 0.45)'
    },
    waterColumn: {
      midColor: '#0d3830',
      deepColor: '#051f18',
      bedColor: '#02100c',
      causticsColor: 'rgba(94, 234, 212, 0.22)',
      lightRayColor: 'rgba(94, 234, 212, 0.12)',
      particleType: 'plankton',
      props: [
        { sprite: 'prop_dock_pilings_kelp.png', xRatio: 0.18, yRatio: 0.75, w: 120, h: 183, sway: false },
        { sprite: 'kelp_dense_cluster.png', xRatio: 0.78, yRatio: 0.85, w: 174, h: 152, sway: true },
        { sprite: 'kelp_slender_bush.png', xRatio: 0.88, yRatio: 0.82, w: 84, h: 172, sway: true },
        { sprite: 'kelp_slender_bush.png', xRatio: 0.08, yRatio: 0.84, w: 84, h: 172, sway: true }
      ]
    },
    ambientFishSprites: [
      'fish_shadowy_trout_s2.png',
      'fish_shadowy_mackerel_s1.png',
      'fish_spiky_sculpin.png'
    ]
  },
  3: {
    tier: 3,
    id: 'abyssal_trench',
    name: 'Abyssal Trench (Sunken Galleon)',
    depthRange: [60, 100],
    sky: {
      type: 'open_sky',
      skyTop: '#010206',
      skyBottom: '#080d1a',
      backdropSprite: 'bg_abyssal_shipwreck.png',
      horizonProp: undefined,
      celestialType: 'storm_obscured',
      showRain: true,
      showLighthouseBeam: false,
      showStalactites: false,
      showChimneyVents: false,
      fogColor: 'rgba(8, 13, 26, 0.65)',
      fogDensity: 0.60
    },
    waves: {
      primaryWaveSprite: 'waves_storm_breaker_1024_feathered.png',
      secondaryWaveSprite: 'fx_wave_crashing_breaker_left.png',
      foregroundBreakerSprite: 'fx_wave_claw_surge_right.png',
      foamPatchSprite: 'fx_seafoam_patch_heavy.png',
      whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
      waveSpeed: 2.6,
      waveAmp: 6.5,
      waveDrift: 1.8,
      foamColor: 'rgba(148, 163, 184, 0.85)'
    },
    waterColumn: {
      midColor: '#070f24',
      deepColor: '#010309',
      bedColor: '#000103',
      causticsColor: 'rgba(56, 189, 248, 0.12)',
      lightRayColor: 'rgba(56, 189, 248, 0.05)',
      particleType: 'plankton',
      props: [
        { sprite: 'shipwreck_abyssal_galleon.png', xRatio: 0.72, yRatio: 0.78, w: 400, h: 195, sway: false },
        { sprite: 'prop_biolum_anemone_teal.png', xRatio: 0.22, yRatio: 0.88, w: 115, h: 88, glow: '#2dd4bf' },
        { sprite: 'prop_biolum_anemone_cup.png', xRatio: 0.35, yRatio: 0.90, w: 80, h: 73, glow: '#38bdf8' },
        { sprite: 'shadow_kraken_tentacles_bg.png', xRatio: 0.50, yRatio: 0.65, w: 220, h: 95, sway: true, alpha: 0.35 }
      ]
    },
    ambientFishSprites: [
      'fish_angler_pale_lure.png',
      'fish_shadowy_minnow_tiny1.png'
    ]
  },
  4: {
    tier: 4,
    id: 'sea_cave',
    name: 'Subterranean Sea Cave (Dagon Abyssal Lair)',
    depthRange: [100, 200],
    sky: {
      type: 'cave_ceiling',
      skyTop: '#0d0705',
      skyBottom: '#1c100a',
      backdropSprite: 'bg_subterranean_cave.png',
      horizonProp: 'prop_cave_stalactites.png',
      celestialType: 'none',
      showRain: false,
      showLighthouseBeam: false,
      showStalactites: true,
      showChimneyVents: true,
      fogColor: 'rgba(28, 16, 10, 0.50)',
      fogDensity: 0.55
    },
    waves: {
      primaryWaveSprite: 'waves_churning_foam_1024_feathered.png',
      secondaryWaveSprite: 'fx_seafoam_churning_surf.png',
      foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
      foamPatchSprite: 'fx_seafoam_churning_surf.png',
      whitecapSprite: 'fx_wave_whitecap_spray_crest.png',
      waveSpeed: 3.2,
      waveAmp: 5.0,
      waveDrift: 2.2,
      foamColor: 'rgba(253, 224, 71, 0.80)'
    },
    waterColumn: {
      midColor: '#1f1d0a',
      deepColor: '#0c0b03',
      bedColor: '#050401',
      causticsColor: 'rgba(251, 191, 36, 0.20)',
      lightRayColor: 'rgba(245, 158, 11, 0.10)',
      particleType: 'vent_sparks',
      props: [
        { sprite: 'prop_cave_chimney_vent.png', xRatio: 0.18, yRatio: 0.82, w: 80, h: 98, glow: '#f97316' },
        { sprite: 'prop_cave_chimney_vent.png', xRatio: 0.82, yRatio: 0.84, w: 80, h: 98, glow: '#f97316' },
        { sprite: 'prop_sea_cave_anchor.png', xRatio: 0.38, yRatio: 0.90, w: 115, h: 83 },
        { sprite: 'prop_cave_stalactites.png', xRatio: 0.50, yRatio: 0.15, w: 420, h: 85 }
      ]
    },
    ambientFishSprites: [
      'leviathan_abyssal_maw_worm.png',
      'fish_angler_pale_lure.png'
    ]
  }
};

/**
 * Resolves the ZoneTier (1..4) based on WaterZoneType, active species, and encounter depth.
 * Priority:
 * 1. Apex boss (speciesType 'dagon') or explicit zoneType 'cave' or depth >= 100m -> Tier 4
 * 2. Void creature (speciesType 'gar') or zoneType 'abyss' or depth >= 60m -> Tier 3
 * 3. Lake predator (speciesType 'pike') or zoneType 'lake' or depth >= 30m -> Tier 2
 * 4. Default / Coastal perch (speciesType 'perch') or zoneType 'shallow' -> Tier 1
 */
export function resolveZoneTier(
  zoneType: WaterZoneType,
  speciesType?: SpeciesType,
  depthMeters?: number
): ZoneTier {
  if (speciesType === 'dagon' || zoneType === 'cave' || (depthMeters !== undefined && depthMeters >= 100)) {
    return 4;
  }
  if (speciesType === 'gar' || zoneType === 'abyss' || (depthMeters !== undefined && depthMeters >= 60)) {
    return 3;
  }
  if (speciesType === 'pike' || zoneType === 'lake' || (depthMeters !== undefined && depthMeters >= 30)) {
    return 2;
  }
  return 1;
}

/**
 * Returns the environment profile for the given ZoneTier.
 * Falls back to Tier 1 if an invalid tier is provided.
 */
export function getZoneProfile(tier: ZoneTier): ZoneProfile {
  return ZONE_PROFILES[tier] ?? ZONE_PROFILES[1];
}
