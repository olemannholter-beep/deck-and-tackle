/**
 * E2E Test Suite Utilities & Authoritative Specification Oracles
 * Derived from ORIGINAL_REQUEST.md (R1-R4), PROJECT.md, and TEST_INFRA.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const GAME_DIR = path.join(PROJECT_ROOT, 'deck-and-tackle');
export const SPRITE_DIR = path.join(GAME_DIR, 'public', 'assets', 'sprites', 'fishing');
export const PREVIEW_HTML_PATH = path.join(PROJECT_ROOT, 'side_view_battle_redesign_preview.html');
export const PREVIEW_GENERATOR_PATH = path.join(PROJECT_ROOT, 'build_full_preview.py');
export const ZONE_PROFILES_TS_PATH = path.join(GAME_DIR, 'src', 'game', 'sideview', 'ZoneProfiles.ts');
export const SIDE_VIEW_DIORAMA_TS_PATH = path.join(GAME_DIR, 'src', 'game', 'sideview', 'SideViewDiorama.ts');
export const FISHING_SPOT_TS_PATH = path.join(GAME_DIR, 'src', 'game', 'overworld', 'FishingSpot.ts');
export const OVERWORLD_MAP_TS_PATH = path.join(GAME_DIR, 'src', 'game', 'overworld', 'OverworldMap.ts');

/**
 * 17 mandatory zone texture assets specified across R1, R2, and R3.
 */
export const REQUIRED_ZONE_ASSETS = [
  // Zone 1: Coastal Shoals (0-30m)
  'prop_lighthouse_cliff.png',
  'waves_misty_swell_1024_feathered.png',
  'bg_coastal_lighthouse.png',

  // Zone 2: Kelp Shallows / Sunken Reef (30-60m)
  'prop_dock_pilings_kelp.png',
  'waves_moonlit_crest_1024_feathered.png',
  'bg_kelp_shallows.png',

  // Zone 3: Abyssal Trench / Sunken Galleon (60-100m)
  'waves_storm_breaker_1024_feathered.png',
  'fx_wave_whitecap_spray_crest.png',
  'prop_biolum_anemone_teal.png',
  'shipwreck_abyssal_galleon.png',
  'shadow_kraken_tentacles_bg.png',
  'bg_abyssal_shipwreck.png',

  // Zone 4: Subterranean Sea Cave / Dagon Abyssal Lair (100m+)
  'bg_subterranean_cave.png',
  'prop_cave_stalactites.png',
  'prop_cave_chimney_vent.png',
  'waves_churning_foam_1024_feathered.png',
  'fx_seafoam_churning_surf.png'
];

/**
 * Parses PNG binary header and returns image metadata.
 */
export function readPngHeader(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, error: 'File does not exist' };
  }
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(29);
  fs.readSync(fd, buffer, 0, 29, 0);
  fs.closeSync(fd);

  // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  const isPng = (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  );

  if (!isPng) {
    return { exists: true, isPng: false, error: 'Not a valid PNG file' };
  }

  // IHDR chunk begins at offset 12 (4 bytes length + 4 bytes 'IHDR')
  const ihdrType = buffer.toString('ascii', 12, 16);
  if (ihdrType !== 'IHDR') {
    return { exists: true, isPng: true, error: 'IHDR chunk missing' };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25]; // 2 = RGB, 6 = RGBA

  return {
    exists: true,
    isPng: true,
    size: stat.size,
    width,
    height,
    bitDepth,
    colorType,
    hasAlpha: colorType === 6
  };
}

/**
 * Authoritative reference profiles derived directly from ORIGINAL_REQUEST.md & PROJECT.md
 */
export const REFERENCE_ZONE_PROFILES = {
  1: {
    tier: 1,
    id: 'coastal',
    name: 'Coastal Shoals / Innsmouth Coastal',
    depthRange: [0, 30],
    species: 'perch',
    sky: {
      type: 'open_sky',
      celestialType: 'moon',
      backdropSprite: 'bg_coastal_lighthouse.png',
      horizonProp: 'prop_lighthouse_cliff.png'
    },
    waves: {
      primaryWaveSprite: 'waves_misty_swell_1024_feathered.png',
      secondaryWaveSprite: 'fx_calm_misty_swell.png',
      waveSpeed: 1.1,
      waveAmp: 2.5,
      foamColor: '#a7f3d0'
    },
    waterColumn: {
      theme: 'slate_green',
      props: ['fish_school_minnows.png', 'prop_lighthouse_cliff.png']
    }
  },
  2: {
    tier: 2,
    id: 'reef',
    name: 'Kelp Shallows / Sunken Reef',
    depthRange: [30, 60],
    species: 'pike',
    sky: {
      type: 'open_sky',
      celestialType: 'fog_moon',
      backdropSprite: 'bg_kelp_shallows.png',
      horizonProp: 'prop_dock_pilings_kelp.png'
    },
    waves: {
      primaryWaveSprite: 'waves_moonlit_crest_1024_feathered.png',
      secondaryWaveSprite: 'fx_wave_moonlit_curl.png',
      waveSpeed: 1.8,
      waveAmp: 3.5,
      foamColor: '#5eead4'
    },
    waterColumn: {
      theme: 'emerald_teal',
      props: ['prop_dock_pilings_kelp.png', 'kelp_dense_cluster.png', 'kelp_slender_bush.png']
    }
  },
  3: {
    tier: 3,
    id: 'trench',
    name: 'Abyssal Trench / Sunken Galleon',
    depthRange: [60, 100],
    species: 'gar',
    sky: {
      type: 'open_sky',
      celestialType: 'storm_obscured',
      backdropSprite: 'bg_abyssal_shipwreck.png',
      showRain: true
    },
    waves: {
      primaryWaveSprite: 'waves_storm_breaker_1024_feathered.png',
      secondaryWaveSprite: 'fx_wave_whitecap_spray_crest.png',
      foregroundBreakerSprite: 'fx_wave_crashing_breaker_left.png',
      waveSpeed: 2.6,
      waveAmp: 6.5,
      foamColor: '#cbd5e1'
    },
    waterColumn: {
      theme: 'abyssal_navy',
      props: ['shipwreck_abyssal_galleon.png', 'prop_biolum_anemone_teal.png', 'shadow_kraken_tentacles_bg.png']
    }
  },
  4: {
    tier: 4,
    id: 'cave',
    name: 'Subterranean Sea Cave / Dagon Abyssal Lair',
    depthRange: [100, 150],
    species: 'dagon',
    sky: {
      type: 'cave_ceiling',
      celestialType: 'none',
      backdropSprite: 'bg_subterranean_cave.png',
      stalactiteProp: 'prop_cave_stalactites.png',
      chimneyVentProp: 'prop_cave_chimney_vent.png'
    },
    waves: {
      primaryWaveSprite: 'waves_churning_foam_1024_feathered.png',
      secondaryWaveSprite: 'fx_seafoam_churning_surf.png',
      waveSpeed: 3.2,
      waveAmp: 5.0,
      foamColor: '#fde047'
    },
    waterColumn: {
      theme: 'sulfurous_amber',
      props: ['prop_cave_chimney_vent.png', 'prop_cave_stalactites.png', 'prop_sea_cave_anchor.png']
    }
  }
};

/**
 * Reference oracle implementation for resolveZoneTier.
 * Used to verify the actual implementation in ZoneProfiles.ts and preview stage logic.
 */
export function referenceResolveZoneTier(zoneType, speciesType, depthMeters) {
  if (speciesType === 'dagon' || zoneType === 'cave' || (typeof depthMeters === 'number' && depthMeters >= 100)) {
    return 4;
  }
  if (speciesType === 'gar' || (zoneType === 'abyss' && speciesType !== 'dagon') || (typeof depthMeters === 'number' && depthMeters >= 60)) {
    return 3;
  }
  if (speciesType === 'pike' || zoneType === 'lake' || (typeof depthMeters === 'number' && depthMeters >= 30)) {
    return 2;
  }
  return 1;
}

/**
 * Loads a TypeScript file by transpiling in-memory using the workspace's typescript installation.
 * Returns the module exports object or null if file not present.
 */
export function loadTsModule(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const tsPath = path.join(GAME_DIR, 'node_modules', 'typescript');
    const ts = require(tsPath);
    const tsSource = fs.readFileSync(filePath, 'utf-8');
    const jsSource = ts.transpileModule(tsSource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText;

    const moduleExports = {};
    const moduleObj = { exports: moduleExports };
    const fakeRequire = (id) => {
      // Mock relative imports to sibling files if needed
      return {};
    };

    const fn = new Function('module', 'exports', 'require', '__dirname', '__filename', jsSource);
    fn(moduleObj, moduleExports, fakeRequire, path.dirname(filePath), filePath);
    return moduleObj.exports;
  } catch (err) {
    return { __loadError: err.message };
  }
}

/**
 * Extracts and parses key sections of side_view_battle_redesign_preview.html
 */
export function parsePreviewHtml() {
  if (!fs.existsSync(PREVIEW_HTML_PATH)) {
    return { exists: false, error: 'Preview HTML not found' };
  }

  const html = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');
  const size = fs.statSync(PREVIEW_HTML_PATH).size;

  // Extract embedded asset keys from ASSETS = { ... }
  const assetsMatch = html.match(/const\s+ASSETS\s*=\s*\{([\s\S]*?)\};/);
  const embeddedAssetKeys = [];
  if (assetsMatch) {
    const assetBlock = assetsMatch[1];
    const keyRegex = /['"]([^'"]+\.png)['"]\s*:/g;
    let m;
    while ((m = keyRegex.exec(assetBlock)) !== null) {
      embeddedAssetKeys.push(m[1]);
    }
  }

  // Check stage button definitions
  const stageButton1 = html.includes('data-tier="1"');
  const stageButton2 = html.includes('data-tier="2"');
  const stageButton3 = html.includes('data-tier="3"');
  const stageButton4 = html.includes('data-tier="4"');

  // Check for presence of zone assets in the script/HTML
  const hasLighthouseCliff = html.includes('prop_lighthouse_cliff.png');
  const hasDockPilings = html.includes('prop_dock_pilings_kelp.png');
  const hasGalleon = html.includes('shipwreck_abyssal_galleon.png');
  const hasStalactites = html.includes('prop_cave_stalactites.png');
  const hasChimneyVent = html.includes('prop_cave_chimney_vent.png');
  const hasMistySwell = html.includes('waves_misty_swell_1024_feathered.png');
  const hasMoonlitCrest = html.includes('waves_moonlit_crest_1024_feathered.png');
  const hasStormBreaker = html.includes('waves_storm_breaker_1024_feathered.png');
  const hasChurningFoam = html.includes('waves_churning_foam_1024_feathered.png');
  const hasCaveBg = html.includes('bg_subterranean_cave.png');

  // Check if static composite override suppresses zone rendering
  const hasStaticCompositeOverride = html.includes("images['bg_fishing_clean_environment.png']") &&
    !html.includes('stageConfig.sky') && !html.includes('currentEnv.sky');

  return {
    exists: true,
    size,
    embeddedAssetKeys,
    stageButtons: {
      stage1: stageButton1,
      stage2: stageButton2,
      stage3: stageButton3,
      stage4: stageButton4
    },
    assetReferences: {
      hasLighthouseCliff,
      hasDockPilings,
      hasGalleon,
      hasStalactites,
      hasChimneyVent,
      hasMistySwell,
      hasMoonlitCrest,
      hasStormBreaker,
      hasChurningFoam,
      hasCaveBg
    },
    hasStaticCompositeOverride,
    raw: html
  };
}

/**
 * Inspects build_full_preview.py to check asset list and stage config generation
 */
export function parsePreviewGenerator() {
  if (!fs.existsSync(PREVIEW_GENERATOR_PATH)) {
    return { exists: false, error: 'build_full_preview.py not found' };
  }

  const code = fs.readFileSync(PREVIEW_GENERATOR_PATH, 'utf-8');
  const assetRegex = /['"]([^'"]+\.png)['"]/g;
  const referencedAssets = [];
  let m;
  while ((m = assetRegex.exec(code)) !== null) {
    if (!referencedAssets.includes(m[1])) {
      referencedAssets.push(m[1]);
    }
  }

  return {
    exists: true,
    code,
    referencedAssets,
    encodesAll17Assets: REQUIRED_ZONE_ASSETS.every(a => code.includes(a))
  };
}
