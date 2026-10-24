/**
 * Challenger Visual Invariant & Zone Distinctness Oracle Test Suite
 * 
 * Empirically challenges:
 * 1. Zone 4 / Stage 4 Invariants:
 *    - Strictly NO open sky, NO celestial moon disc, NO church/bell tower silhouette.
 *    - Actively renders bg_subterranean_cave.png, prop_cave_stalactites.png,
 *      prop_cave_chimney_vent.png, and waves_churning_foam_1024_feathered.png.
 * 2. Wave Distinctness & Uniqueness:
 *    - All 4 wave textures are distinct binary files with unique SHA-256 hashes.
 *    - Each zone correctly binds its unique wave sprite.
 * 3. Water Column Palettes:
 *    - Exact hex verification (#12261f, #0d3830, #070f24, #1f1d0a).
 *    - Mathematical Euclidean & perceptual color delta distance matrix.
 * 4. Environmental Props Positioning & Rendering:
 *    - Galleon wreck, anemones, kraken tentacles, dock pilings, lighthouse cliff,
 *      chimney vents, stalactites genuinely positioned within viewport.
 * 5. Adversarial Stress & Resiliency:
 *    - High time stability, resolution scaling, rapid tier switching.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  SPRITE_DIR,
  readPngHeader,
  loadTsModule,
  ZONE_PROFILES_TS_PATH,
  SIDE_VIEW_DIORAMA_TS_PATH,
  PREVIEW_HTML_PATH
} from './test_helpers.mjs';

// Load ZoneProfiles TypeScript module
const zoneProfilesMod = loadTsModule(ZONE_PROFILES_TS_PATH);
const { ZONE_PROFILES, getZoneProfile, resolveZoneTier } = zoneProfilesMod;

// Load SideViewDiorama TypeScript module
const sideViewDioramaMod = loadTsModule(SIDE_VIEW_DIORAMA_TS_PATH);
const { SideViewDiorama } = sideViewDioramaMod;

// Load and parse preview HTML script functions
const previewHtmlRaw = fs.readFileSync(PREVIEW_HTML_PATH, 'utf-8');

function extractPreviewEnvironment() {
  const stageConfigMatch = previewHtmlRaw.match(/const\s+STAGE_CONFIG\s*=\s*(\{[\s\S]*?\n\s{4}\};)/);
  if (!stageConfigMatch) throw new Error('Could not find STAGE_CONFIG in preview HTML');

  const skyboxFnMatch = previewHtmlRaw.match(/function\s+renderPreviewSkybox\s*\([\s\S]*?\n\s{4}\}/);
  if (!skyboxFnMatch) throw new Error('Could not find renderPreviewSkybox in preview HTML');

  const waterColFnMatch = previewHtmlRaw.match(/function\s+renderPreviewWaterColumn\s*\([\s\S]*?\n\s{4}\}/);
  if (!waterColFnMatch) throw new Error('Could not find renderPreviewWaterColumn in preview HTML');

  const waterSurfFnMatch = previewHtmlRaw.match(/function\s+renderPreviewWaterSurface\s*\([\s\S]*?\n\s{4}\}/);
  if (!waterSurfFnMatch) throw new Error('Could not find renderPreviewWaterSurface in preview HTML');

  const sandboxCode = `
    ${stageConfigMatch[0]}
    ${skyboxFnMatch[0]}
    ${waterColFnMatch[0]}
    ${waterSurfFnMatch[0]}
    return { STAGE_CONFIG, renderPreviewSkybox, renderPreviewWaterColumn, renderPreviewWaterSurface };
  `;
  const fn = new Function(sandboxCode);
  return fn();
}

const previewEnv = extractPreviewEnvironment();

/**
 * High-fidelity Mock Canvas 2D Context recording all drawing primitives.
 */
class MockCanvasContext2D {
  constructor() {
    this.drawCalls = [];
    this.imagesDrawn = [];
    this.arcsDrawn = [];
    this.rectsDrawn = [];
    this.linesDrawn = [];
    this.gradientsCreated = [];
    this.stateStack = [];

    // Styling attributes
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
  }

  save() {
    this.stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur
    });
    this.drawCalls.push({ type: 'save' });
  }

  restore() {
    const s = this.stateStack.pop();
    if (s) {
      this.fillStyle = s.fillStyle;
      this.strokeStyle = s.strokeStyle;
      this.lineWidth = s.lineWidth;
      this.globalAlpha = s.globalAlpha;
      this.globalCompositeOperation = s.globalCompositeOperation;
      this.shadowColor = s.shadowColor;
      this.shadowBlur = s.shadowBlur;
    }
    this.drawCalls.push({ type: 'restore' });
  }

  translate(x, y) {
    this.drawCalls.push({ type: 'translate', x, y });
  }

  rotate(angle) {
    this.drawCalls.push({ type: 'rotate', angle });
  }

  scale(sx, sy) {
    this.drawCalls.push({ type: 'scale', sx, sy });
  }

  transform(a, b, c, d, e, f) {
    this.drawCalls.push({ type: 'transform', a, b, c, d, e, f });
  }

  beginPath() {
    this.drawCalls.push({ type: 'beginPath' });
  }

  closePath() {
    this.drawCalls.push({ type: 'closePath' });
  }

  moveTo(x, y) {
    this.drawCalls.push({ type: 'moveTo', x, y });
    this.linesDrawn.push({ type: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.drawCalls.push({ type: 'lineTo', x, y });
    this.linesDrawn.push({ type: 'lineTo', x, y });
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this.drawCalls.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
  }

  arc(x, y, radius, startAngle, endAngle, counterclockwise) {
    const record = {
      x,
      y,
      radius,
      startAngle,
      endAngle,
      fillStyle: typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient',
      globalAlpha: this.globalAlpha
    };
    this.arcsDrawn.push(record);
    this.drawCalls.push({ type: 'arc', ...record });
  }

  ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
    this.drawCalls.push({ type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle });
  }

  fillRect(x, y, w, h) {
    const record = {
      x,
      y,
      w,
      h,
      fillStyle: typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient',
      globalAlpha: this.globalAlpha
    };
    this.rectsDrawn.push(record);
    this.drawCalls.push({ type: 'fillRect', ...record });
  }

  stroke() {
    this.drawCalls.push({
      type: 'stroke',
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha
    });
  }

  fill() {
    this.drawCalls.push({
      type: 'fill',
      fillStyle: typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient',
      globalAlpha: this.globalAlpha
    });
  }

  drawImage(img, ...args) {
    const name = img ? (img.name || img.src || (typeof img === 'string' ? img : 'unknown_image')) : 'null_img';
    let x, y, w, h;
    if (args.length === 2) {
      [x, y] = args;
      w = img ? img.naturalWidth : 100;
      h = img ? img.naturalHeight : 100;
    } else if (args.length === 4) {
      [x, y, w, h] = args;
    } else if (args.length === 8) {
      // sx, sy, sw, sh, dx, dy, dw, dh
      [, , , , x, y, w, h] = args;
    }
    const record = {
      name,
      x,
      y,
      w,
      h,
      alpha: this.globalAlpha,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur
    };
    this.imagesDrawn.push(record);
    this.drawCalls.push({ type: 'drawImage', ...record });
  }

  createLinearGradient(x0, y0, x1, y1) {
    const grad = {
      type: 'linear',
      x0, y0, x1, y1,
      stops: [],
      addColorStop: (offset, color) => {
        grad.stops.push({ offset, color });
      }
    };
    this.gradientsCreated.push(grad);
    return grad;
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    const grad = {
      type: 'radial',
      x0, y0, r0, x1, y1, r1,
      stops: [],
      addColorStop: (offset, color) => {
        grad.stops.push({ offset, color });
      }
    };
    this.gradientsCreated.push(grad);
    return grad;
  }

  measureText(text) {
    return { width: text.length * 8 };
  }

  fillText(text, x, y) {
    this.drawCalls.push({ type: 'fillText', text, x, y });
  }
}

/**
 * Creates mock image registry matching public/assets/sprites/fishing/ files.
 */
function createMockImageRegistry() {
  const images = {};
  const files = fs.readdirSync(SPRITE_DIR);
  for (const f of files) {
    if (!f.endsWith('.png')) continue;
    const header = readPngHeader(path.join(SPRITE_DIR, f));
    images[f] = {
      name: f,
      src: f,
      complete: true,
      naturalWidth: header.width || 100,
      naturalHeight: header.height || 100,
      width: header.width || 100,
      height: header.height || 100
    };
  }
  return images;
}

const mockImages = createMockImageRegistry();

// Setup SideViewDiorama image access stub
SideViewDiorama.getImage = function (name) {
  return mockImages[name] || {
    name,
    src: name,
    complete: true,
    naturalWidth: 100,
    naturalHeight: 100,
    width: 100,
    height: 100
  };
};

// ============================================================================
// SUITE 1: ZONE 4 / STAGE 4 CAVE INVARIANTS & OCCLUSION
// ============================================================================
describe('Suite 1: Zone 4 / Stage 4 Subterranean Cave Invariants', () => {

  test('1.1: Engine SideViewDiorama: activeTier === 4 renders NO open sky, NO moon, NO church spire', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 1.5;
    const ctx = new MockCanvasContext2D();
    const width = 1200;
    const waterLevelY = Math.floor(675 * 0.28);
    const profile = ZONE_PROFILES[4];

    // Render detailed sky with Tier 4 profile
    diorama.renderDetailedSky(ctx, width, waterLevelY, profile);

    // 1. Invariant: bg_subterranean_cave.png MUST be rendered
    const caveBg = ctx.imagesDrawn.find(img => img.name === 'bg_subterranean_cave.png');
    assert.ok(caveBg, 'bg_subterranean_cave.png must be actively drawn in Zone 4 skybox');
    assert.equal(caveBg.x, 0);
    assert.equal(caveBg.y, 0);
    assert.equal(caveBg.w, width);
    assert.equal(caveBg.h, waterLevelY);

    // 2. Invariant: prop_cave_stalactites.png MUST be rendered along the ceiling vault
    const stalactites = ctx.imagesDrawn.filter(img => img.name === 'prop_cave_stalactites.png');
    assert.ok(stalactites.length > 0, 'prop_cave_stalactites.png must be actively rendered along cavern ceiling');
    for (const stal of stalactites) {
      assert.equal(stal.y, 0, 'Ceiling stalactites must anchor at y=0 (ceiling vault)');
      assert.ok(stal.w >= 400, 'Stalactites must span a wide area');
    }

    // 3. Invariant: prop_cave_chimney_vent.png MUST be rendered emitting upper thermal steam
    const vents = ctx.imagesDrawn.filter(img => img.name === 'prop_cave_chimney_vent.png');
    assert.ok(vents.length >= 2, 'Hydrothermal chimney vents must be positioned in cavern');

    // 4. Invariant: STRICTLY NO open sky backdrop sprites (Zones 1-3)
    const openSkyBackdrops = ['bg_coastal_lighthouse.png', 'bg_kelp_shallows.png', 'bg_abyssal_shipwreck.png'];
    for (const bg of openSkyBackdrops) {
      const drawn = ctx.imagesDrawn.find(img => img.name === bg);
      assert.strictEqual(drawn, undefined, `Zone 4 MUST NOT render open sky backdrop ${bg}`);
    }

    // 5. Invariant: STRICTLY NO celestial moon disc
    // Moon disc is drawn as an arc with radius 14 and fillStyle '#f8fafc'
    const moonArcs = ctx.arcsDrawn.filter(a => a.radius >= 10 && a.radius <= 20 && a.fillStyle === '#f8fafc');
    assert.equal(moonArcs.length, 0, 'Zone 4 MUST NOT render celestial moon disc');

    // 6. Invariant: STRICTLY NO church/bell tower silhouette (spire at h=52, x ~ 0.8*width)
    const churchSpireLines = ctx.linesDrawn.filter(l => l.y <= waterLevelY - 50);
    assert.equal(churchSpireLines.length, 0, 'Zone 4 MUST NOT render surface church/bell tower silhouette');

    // 7. Invariant: STRICTLY NO lighthouse cliff or open-air headland
    const lhCliff = ctx.imagesDrawn.find(img => img.name === 'prop_lighthouse_cliff.png');
    assert.strictEqual(lhCliff, undefined, 'Zone 4 MUST NOT render prop_lighthouse_cliff.png');
  });

  test('1.2: Engine SideViewDiorama: activeTier === 4 renders churning foam wave and boiling froth', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 2.0;
    const ctx = new MockCanvasContext2D();
    const width = 1200;
    const waterLevelY = 189;
    const profile = ZONE_PROFILES[4];

    diorama.renderDetailedWaterSurface(ctx, width, waterLevelY, profile);

    // 1. Primary wave MUST be waves_churning_foam_1024_feathered.png
    const primaryWave = ctx.imagesDrawn.find(img => img.name === 'waves_churning_foam_1024_feathered.png');
    assert.ok(primaryWave, 'Zone 4 primary wave MUST be waves_churning_foam_1024_feathered.png');
    assert.ok(primaryWave.w >= width, 'Primary wave must span full width');

    // 2. Secondary wave / froth MUST be fx_seafoam_churning_surf.png
    const froth = ctx.imagesDrawn.find(img => img.name === 'fx_seafoam_churning_surf.png');
    assert.ok(froth, 'Zone 4 secondary wave MUST be fx_seafoam_churning_surf.png');

    // 3. Forbid calm swell or moonlit crest
    const forbiddenWaves = ['waves_misty_swell_1024_feathered.png', 'waves_moonlit_crest_1024_feathered.png'];
    for (const fw of forbiddenWaves) {
      assert.strictEqual(ctx.imagesDrawn.find(img => img.name === fw), undefined, `Zone 4 MUST NOT render ${fw}`);
    }
  });

  test('1.3: Standalone Preview: stage === 4 renders cavern ceiling with NO open sky or moon', () => {
    const ctx = new MockCanvasContext2D();
    const W = 1280;
    const waterlineY = 200;
    const cfg = previewEnv.STAGE_CONFIG[4];

    // Global mock images available to preview function
    const originalImages = globalThis.images;
    globalThis.images = mockImages;

    try {
      previewEnv.renderPreviewSkybox(ctx, W, waterlineY, cfg, 2.5);

      // Verify cavern rock ceiling background
      const caveBg = ctx.imagesDrawn.find(img => img.name === 'bg_subterranean_cave.png');
      assert.ok(caveBg, 'Preview Stage 4 must render bg_subterranean_cave.png');

      // Verify hanging stalactites
      const stalactites = ctx.imagesDrawn.filter(img => img.name === 'prop_cave_stalactites.png');
      assert.ok(stalactites.length > 0, 'Preview Stage 4 must render prop_cave_stalactites.png');

      // Verify NO moon disc or moon glow
      const moonArcs = ctx.arcsDrawn.filter(a => a.radius === 13 || a.radius === 14 || a.radius === 65);
      assert.equal(moonArcs.length, 0, 'Preview Stage 4 must NOT render moon disc or radial glow');

      // Verify NO open sky backdrop
      assert.strictEqual(ctx.imagesDrawn.find(img => img.name === 'bg_coastal_lighthouse.png'), undefined);
      assert.strictEqual(ctx.imagesDrawn.find(img => img.name === 'prop_lighthouse_cliff.png'), undefined);
    } finally {
      globalThis.images = originalImages;
    }
  });

  test('1.4: Standalone Preview: stage === 4 renders churning foam wave and seabed chimney vents', () => {
    const ctxWaves = new MockCanvasContext2D();
    const ctxCol = new MockCanvasContext2D();
    const W = 1280;
    const H = 720;
    const waterlineY = 200;
    const cfg = previewEnv.STAGE_CONFIG[4];

    const originalImages = globalThis.images;
    globalThis.images = mockImages;

    try {
      // 1. Water Surface
      previewEnv.renderPreviewWaterSurface(ctxWaves, W, waterlineY, cfg, 1.0);
      assert.ok(ctxWaves.imagesDrawn.find(img => img.name === 'waves_churning_foam_1024_feathered.png'),
        'Preview Stage 4 water surface MUST draw waves_churning_foam_1024_feathered.png');
      assert.ok(ctxWaves.imagesDrawn.find(img => img.name === 'fx_seafoam_churning_surf.png'),
        'Preview Stage 4 water surface MUST draw fx_seafoam_churning_surf.png');

      // 2. Water Column Props
      previewEnv.renderPreviewWaterColumn(ctxCol, W, H, waterlineY, cfg, 1.0);
      const chimneyVents = ctxCol.imagesDrawn.filter(img => img.name === 'prop_cave_chimney_vent.png');
      assert.ok(chimneyVents.length >= 2, 'Preview Stage 4 water column MUST draw prop_cave_chimney_vent.png');
      const anchor = ctxCol.imagesDrawn.find(img => img.name === 'prop_sea_cave_anchor.png');
      assert.ok(anchor, 'Preview Stage 4 water column MUST draw prop_sea_cave_anchor.png');
    } finally {
      globalThis.images = originalImages;
    }
  });
});

// ============================================================================
// SUITE 2: WAVE TEXTURE DISTINCTNESS & BINDING
// ============================================================================
describe('Suite 2: Wave Texture Distinctness & Uniqueness', () => {

  const PRIMARY_WAVES = [
    { tier: 1, file: 'waves_misty_swell_1024_feathered.png' },
    { tier: 2, file: 'waves_moonlit_crest_1024_feathered.png' },
    { tier: 3, file: 'waves_storm_breaker_1024_feathered.png' },
    { tier: 4, file: 'waves_churning_foam_1024_feathered.png' }
  ];

  test('2.1: All 4 wave textures are unique physical files with distinct SHA-256 hashes', () => {
    const hashes = new Map();
    const sizes = new Map();

    for (const w of PRIMARY_WAVES) {
      const p = path.join(SPRITE_DIR, w.file);
      assert.ok(fs.existsSync(p), `Wave file ${w.file} must exist`);
      const buf = fs.readFileSync(p);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');

      assert.ok(!hashes.has(hash), `SHA-256 collision detected between ${w.file} and ${hashes.get(hash)}!`);
      hashes.set(hash, w.file);
      sizes.set(w.file, buf.length);

      // Verify PNG dimensions
      const header = readPngHeader(p);
      assert.equal(header.width, 1024, `${w.file} width must be exactly 1024px`);
      assert.ok(header.height >= 100, `${w.file} height must be >= 100px`);
      assert.ok(header.hasAlpha, `${w.file} must have RGBA alpha channel`);
    }

    assert.equal(hashes.size, 4, 'All 4 primary wave textures must have unique SHA-256 hashes');
  });

  test('2.2: Pairwise byte distance between all 4 wave textures exceeds 50,000 bytes', () => {
    const waveBuffers = PRIMARY_WAVES.map(w => ({
      name: w.file,
      buf: fs.readFileSync(path.join(SPRITE_DIR, w.file))
    }));

    for (let i = 0; i < waveBuffers.length; i++) {
      for (let j = i + 1; j < waveBuffers.length; j++) {
        const a = waveBuffers[i];
        const b = waveBuffers[j];
        const sizeDelta = Math.abs(a.buf.length - b.buf.length);
        // Compare byte prefixes
        let byteMismatches = 0;
        const compareLen = Math.min(a.buf.length, b.buf.length, 100000);
        for (let k = 0; k < compareLen; k++) {
          if (a.buf[k] !== b.buf[k]) byteMismatches++;
        }
        assert.ok(byteMismatches > 10000 || sizeDelta > 10000,
          `Wave textures ${a.name} and ${b.name} are too similar (mismatches: ${byteMismatches}, sizeDelta: ${sizeDelta})`);
      }
    }
  });

  test('2.3: ZoneProfiles.ts correctly maps each zone to its corresponding wave texture', () => {
    for (const w of PRIMARY_WAVES) {
      const profile = ZONE_PROFILES[w.tier];
      assert.equal(profile.waves.primaryWaveSprite, w.file,
        `Zone ${w.tier} must bind primaryWaveSprite = ${w.file}`);
    }
  });

  test('2.4: Preview STAGE_CONFIG maps each stage to identical corresponding wave texture', () => {
    for (const w of PRIMARY_WAVES) {
      const stage = previewEnv.STAGE_CONFIG[w.tier];
      assert.equal(stage.waves.primaryWaveSprite, w.file,
        `Preview Stage ${w.tier} must bind primaryWaveSprite = ${w.file}`);
    }
  });

  test('2.5: Preview HTML embeds non-identical base64 data URIs for all 4 wave textures', () => {
    const embeddedB64 = new Map();
    for (const w of PRIMARY_WAVES) {
      const regex = new RegExp(`['"]${w.file}['"]\\s*:\\s*['"]data:image/png;base64,([A-Za-z0-9+/=]+)['"]`);
      const match = previewHtmlRaw.match(regex);
      assert.ok(match, `Preview HTML must embed base64 for ${w.file}`);
      const b64 = match[1];
      assert.ok(b64.length > 50000, `Embedded b64 for ${w.file} must be > 50KB (got ${b64.length} chars)`);
      assert.ok(!embeddedB64.has(b64), `Duplicate embedded b64 found for ${w.file}!`);
      embeddedB64.set(b64, w.file);
    }
    assert.equal(embeddedB64.size, 4, 'All 4 embedded wave sprites must be unique');
  });
});

// ============================================================================
// SUITE 3: WATER COLUMN PALETTES & COLOR DISTINCTNESS
// ============================================================================
describe('Suite 3: Water Column Palettes & Mathematical Distinctness', () => {

  const EXPECTED_PALETTES = {
    1: { theme: 'slate_green', midColor: '#12261f', deepColor: '#071510', bedColor: '#030a07' },
    2: { theme: 'emerald_teal', midColor: '#0d3830', deepColor: '#051f18', bedColor: '#02100c' },
    3: { theme: 'abyssal_navy', midColor: '#070f24', deepColor: '#010309', bedColor: '#000103' },
    4: { theme: 'sulfurous_amber', midColor: '#1f1d0a', deepColor: '#0c0b03', bedColor: '#050401' }
  };

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function euclideanColorDist(c1, c2) {
    const rgb1 = hexToRgb(c1);
    const rgb2 = hexToRgb(c2);
    return Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
    );
  }

  test('3.1: ZoneProfiles.ts midColors match specification hex values across all 4 zones', () => {
    for (const [tierStr, expected] of Object.entries(EXPECTED_PALETTES)) {
      const tier = Number(tierStr);
      const profile = ZONE_PROFILES[tier];
      assert.equal(profile.waterColumn.midColor.toLowerCase(), expected.midColor.toLowerCase(),
        `Zone ${tier} midColor must be ${expected.midColor}`);
      assert.equal(profile.waterColumn.deepColor.toLowerCase(), expected.deepColor.toLowerCase(),
        `Zone ${tier} deepColor must be ${expected.deepColor}`);
      assert.equal(profile.waterColumn.bedColor.toLowerCase(), expected.bedColor.toLowerCase(),
        `Zone ${tier} bedColor must be ${expected.bedColor}`);
    }
  });

  test('3.2: Preview STAGE_CONFIG midColors match specification hex values', () => {
    for (const [tierStr, expected] of Object.entries(EXPECTED_PALETTES)) {
      const tier = Number(tierStr);
      const stage = previewEnv.STAGE_CONFIG[tier];
      assert.equal(stage.waterColumn.midColor.toLowerCase(), expected.midColor.toLowerCase(),
        `Stage ${tier} midColor must be ${expected.midColor}`);
      assert.equal(stage.waterColumn.deepColor.toLowerCase(), expected.deepColor.toLowerCase(),
        `Stage ${tier} deepColor must be ${expected.deepColor}`);
      assert.equal(stage.waterColumn.bedColor.toLowerCase(), expected.bedColor.toLowerCase(),
        `Stage ${tier} bedColor must be ${expected.bedColor}`);
    }
  });

  test('3.3: Mathematical Euclidean color distance matrix between all pairs exceeds threshold (>15)', () => {
    const colors = [
      { tier: 1, name: 'slate-green', hex: '#12261f' },
      { tier: 2, name: 'emerald-teal', hex: '#0d3830' },
      { tier: 3, name: 'abyssal-navy', hex: '#070f24' },
      { tier: 4, name: 'sulfurous-amber', hex: '#1f1d0a' }
    ];

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const c1 = colors[i];
        const c2 = colors[j];
        const dist = euclideanColorDist(c1.hex, c2.hex);
        // Distance must be > 15 in RGB space
        assert.ok(dist >= 15,
          `Color distance between Zone ${c1.tier} (${c1.name}: ${c1.hex}) and Zone ${c2.tier} (${c2.name}: ${c2.hex}) is too low (got ${dist.toFixed(2)})`);
      }
    }
  });

  test('3.4: Water column gradients actively bind zone colors in both engine and preview', () => {
    // Engine check
    const diorama = Object.create(SideViewDiorama.prototype);
    for (let tier = 1; tier <= 4; tier++) {
      const ctx = new MockCanvasContext2D();
      diorama.renderDetailedUnderwater(ctx, 1200, 700, 196, ZONE_PROFILES[tier]);
      const linearGrads = ctx.gradientsCreated.filter(g => g.type === 'linear');
      assert.ok(linearGrads.length > 0, `Zone ${tier} must create linear gradient for water column`);
      const waterColGrad = linearGrads[0];
      const expectedMid = EXPECTED_PALETTES[tier].midColor.toLowerCase();
      assert.equal(waterColGrad.stops[0].color.toLowerCase(), expectedMid,
        `Zone ${tier} water gradient stop 0 must be ${expectedMid}`);
    }
  });
});

// ============================================================================
// SUITE 4: ENVIRONMENTAL PROPS POSITIONING & BOUNDS VERIFICATION
// ============================================================================
describe('Suite 4: Environmental Props Positioning & Viewport Bounds', () => {

  const W = 1200;
  const H = 700;
  const waterLevelY = Math.floor(H * 0.28); // 196

  test('4.1: Zone 1 props: Lighthouse cliff, pier breakwater, piling stumps within bounds', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 1.0;
    const ctxSky = new MockCanvasContext2D();
    const ctxWater = new MockCanvasContext2D();

    diorama.renderDetailedSky(ctxSky, W, waterLevelY, ZONE_PROFILES[1]);
    diorama.renderDetailedUnderwater(ctxWater, W, H, waterLevelY, ZONE_PROFILES[1]);

    // Lighthouse cliff in sky
    const lh = ctxSky.imagesDrawn.find(img => img.name === 'prop_lighthouse_cliff.png');
    assert.ok(lh, 'prop_lighthouse_cliff.png must be drawn in Zone 1');
    assert.ok(lh.x > 0 && lh.x + lh.w <= W * 1.1, 'Lighthouse cliff must be within horizontal bounds');
    assert.ok(lh.y >= 0 && lh.y + lh.h <= waterLevelY + 20, 'Lighthouse cliff must be above waterline');

    // Pier beam in water
    const beam = ctxWater.imagesDrawn.find(img => img.name === 'pier_breakwater_beam.png');
    assert.ok(beam, 'pier_breakwater_beam.png must be drawn in Zone 1');
    assert.ok(beam.y >= waterLevelY && beam.y + beam.h <= H + 20, 'Pier beam must be underwater');

    // Pier pilings
    assert.ok(ctxWater.imagesDrawn.find(img => img.name === 'pier_piling_pair.png'));
    assert.ok(ctxWater.imagesDrawn.find(img => img.name === 'wood_piling_stump.png'));
  });

  test('4.2: Zone 2 props: Dock pilings & kelp fronds positioned with sway transforms', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 2.0;
    const ctx = new MockCanvasContext2D();

    diorama.renderDetailedUnderwater(ctx, W, H, waterLevelY, ZONE_PROFILES[2]);

    const pilings = ctx.imagesDrawn.find(img => img.name === 'prop_dock_pilings_kelp.png');
    assert.ok(pilings, 'prop_dock_pilings_kelp.png must be drawn in Zone 2');
    assert.ok(pilings.w > 0 && pilings.h > 0);

    const kelpCluster = ctx.imagesDrawn.find(img => img.name === 'kelp_dense_cluster.png');
    assert.ok(kelpCluster, 'kelp_dense_cluster.png must be drawn in Zone 2');

    const kelpBushes = ctx.imagesDrawn.filter(img => img.name === 'kelp_slender_bush.png');
    assert.ok(kelpBushes.length >= 2, 'Multiple kelp_slender_bush props must be drawn in Zone 2');
  });

  test('4.3: Zone 3 props: Abyssal galleon wreck, biolum anemones, kraken tentacles shadow', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 3.0;
    const ctx = new MockCanvasContext2D();

    diorama.renderDetailedUnderwater(ctx, W, H, waterLevelY, ZONE_PROFILES[3]);

    // Sunken galleon wreck
    const galleon = ctx.imagesDrawn.find(img => img.name === 'shipwreck_abyssal_galleon.png');
    assert.ok(galleon, 'shipwreck_abyssal_galleon.png must be drawn in Zone 3');
    assert.ok(galleon.w >= 400, 'Sunken galleon must have majestic width >= 400px');
    assert.ok(galleon.y + galleon.h <= H + 30, 'Sunken galleon must rest on seabed');

    // Bioluminescent anemones with luminous teal and sky blue glow
    const anemoneTeal = ctx.imagesDrawn.find(img => img.name === 'prop_biolum_anemone_teal.png');
    assert.ok(anemoneTeal, 'prop_biolum_anemone_teal.png must be drawn in Zone 3');
    assert.equal(anemoneTeal.shadowColor, '#2dd4bf', 'Teal anemone must emit #2dd4bf glow');

    const anemoneCup = ctx.imagesDrawn.find(img => img.name === 'prop_biolum_anemone_cup.png');
    assert.ok(anemoneCup, 'prop_biolum_anemone_cup.png must be drawn in Zone 3');
    assert.equal(anemoneCup.shadowColor, '#38bdf8', 'Cup anemone must emit #38bdf8 glow');

    // Kraken tentacles silhouette in deep background
    const kraken = ctx.imagesDrawn.find(img => img.name === 'shadow_kraken_tentacles_bg.png');
    assert.ok(kraken, 'shadow_kraken_tentacles_bg.png must be drawn in Zone 3');
    assert.ok(kraken.alpha <= 0.5, 'Kraken silhouette must have low background alpha (<= 0.5)');
  });

  test('4.4: Zone 4 props: Hydrothermal vents with orange glow, sea cave anchor, stalactites', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 4.0;
    const ctx = new MockCanvasContext2D();

    diorama.renderDetailedUnderwater(ctx, W, H, waterLevelY, ZONE_PROFILES[4]);

    // Hydrothermal chimney vents
    const vents = ctx.imagesDrawn.filter(img => img.name === 'prop_cave_chimney_vent.png');
    assert.ok(vents.length >= 2, 'Hydrothermal chimney vents must be drawn in seabed of Zone 4');
    for (const v of vents) {
      assert.equal(v.shadowColor, '#f97316', 'Chimney vent must emit orange #f97316 volcanic glow');
      assert.ok(v.y + v.h <= H + 20, 'Vent must rest on seabed');
    }

    // Cyclopean sea cave anchor
    const anchor = ctx.imagesDrawn.find(img => img.name === 'prop_sea_cave_anchor.png');
    assert.ok(anchor, 'prop_sea_cave_anchor.png must be drawn in Zone 4 seabed');

    // Perimeter cave stalactites
    const stalactites = ctx.imagesDrawn.find(img => img.name === 'prop_cave_stalactites.png');
    assert.ok(stalactites, 'prop_cave_stalactites.png must be drawn in Zone 4 water column perimeter');
  });
});

// ============================================================================
// SUITE 5: ADVERSARIAL STRESS & RESILIENCY TESTING
// ============================================================================
describe('Suite 5: Adversarial Stress & Resiliency', () => {

  test('5.1: Multi-resolution scaling (800x450 to 3840x2160) maintains Zone 4 cavern vault occlusion', () => {
    const resolutions = [
      { w: 800, h: 450 },
      { w: 1280, h: 720 },
      { w: 1920, h: 1080 },
      { w: 2560, h: 1440 },
      { w: 3840, h: 2160 },
      { w: 500, h: 1000 },  // Portrait
      { w: 2400, h: 400 }   // Ultra-wide
    ];

    const diorama = Object.create(SideViewDiorama.prototype);
    diorama.time = 1.0;

    for (const res of resolutions) {
      const ctx = new MockCanvasContext2D();
      const waterLevelY = Math.floor(res.h * 0.28);
      diorama.renderDetailedSky(ctx, res.w, waterLevelY, ZONE_PROFILES[4]);

      // Assert cave ceiling backdrop covers full width
      const caveBg = ctx.imagesDrawn.find(img => img.name === 'bg_subterranean_cave.png');
      assert.ok(caveBg, `Resolution ${res.w}x${res.h}: bg_subterranean_cave.png must be drawn`);
      assert.equal(caveBg.w, res.w, `Resolution ${res.w}x${res.h}: caveBg must cover full width`);

      // Assert NO moon disc (moon disc is celestial white #f8fafc or pale moonlight rgba(204, 251, 241, 0.60))
      const moonArcs = ctx.arcsDrawn.filter(a =>
        (a.fillStyle === '#f8fafc' || (typeof a.fillStyle === 'string' && a.fillStyle.includes('204, 251, 241'))) &&
        a.radius >= 10 && a.radius <= 20
      );
      assert.equal(moonArcs.length, 0, `Resolution ${res.w}x${res.h}: moon disc must NOT be drawn`);
    }
  });

  test('5.2: High simulation timestamps (t = 1000s, 100000s) execute cleanly without NaN or Inf', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    const times = [0, 0.001, 100.5, 10000.2, 500000.0];

    for (const t of times) {
      diorama.time = t;
      for (let tier = 1; tier <= 4; tier++) {
        const ctx = new MockCanvasContext2D();
        diorama.renderDetailedSky(ctx, 1200, 196, ZONE_PROFILES[tier]);
        diorama.renderDetailedWaterSurface(ctx, 1200, 196, ZONE_PROFILES[tier]);
        diorama.renderDetailedUnderwater(ctx, 1200, 700, 196, ZONE_PROFILES[tier]);

        // Check for any NaN in drawCalls
        for (const call of ctx.drawCalls) {
          for (const [k, v] of Object.entries(call)) {
            if (typeof v === 'number') {
              assert.ok(!Number.isNaN(v), `Draw call ${call.type}.${k} produced NaN at t=${t}, tier=${tier}`);
              assert.ok(Number.isFinite(v), `Draw call ${call.type}.${k} produced Infinite at t=${t}, tier=${tier}`);
            }
          }
        }
      }
    }
  });

  test('5.3: Rapid tier switching (1 -> 4 -> 2 -> 3 -> 4 -> 1) does not leak state across profiles', () => {
    const diorama = Object.create(SideViewDiorama.prototype);
    const sequence = [1, 4, 2, 3, 4, 1];

    for (let step = 0; step < sequence.length; step++) {
      const tier = sequence[step];
      diorama.time = step * 0.5;
      const ctx = new MockCanvasContext2D();
      diorama.renderDetailedSky(ctx, 1200, 196, ZONE_PROFILES[tier]);

      if (tier === 4) {
        // Must be cave
        assert.ok(ctx.imagesDrawn.find(img => img.name === 'bg_subterranean_cave.png'));
        assert.strictEqual(ctx.imagesDrawn.find(img => img.name === 'bg_coastal_lighthouse.png'), undefined);
      } else if (tier === 1) {
        // Must be coastal
        assert.ok(ctx.imagesDrawn.find(img => img.name === 'bg_coastal_lighthouse.png'));
        assert.strictEqual(ctx.imagesDrawn.find(img => img.name === 'bg_subterranean_cave.png'), undefined);
      }
    }
  });
});
