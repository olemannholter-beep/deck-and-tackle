/**
 * Adversarial Verification & Stress-Testing Suite (Tier 5)
 * 
 * Verifies:
 * 1. Camera Boundary Clamping & Viewport AABB Confinement:
 *    - Strict adherence to [0, 8000] world extents under negative, boundary, and extreme overshoot coordinates.
 *    - Multi-frame dynamic lerp stability under high-velocity traversal.
 *    - Invariance across diverse viewport resolutions (800x600 to 4K/8K).
 *    - High-density fuzzing (10,000 randomized coordinates).
 * 2. Atmospheric Smoothstep Continuity:
 *    - Continuous mathematical sampling of 5,000 points from 0 to 6000 px radius.
 *    - Absence of step jumps, NaNs, or sudden threshold pops.
 *    - C0 and C1 continuity verification (matching zero first derivatives at span boundaries).
 *    - Max discrete delta bounds on RGB color channels (|ΔC| <= 1 per pixel).
 * 3. Compass Rose Math & Singularity Stress:
 *    - Singularity resolution at exact harbor center (4000, 4000) (distance = 0).
 *    - Annular docking threshold boundary transition (10px).
 *    - Exhaustive alignment across all 8 cardinal and intercardinal winds.
 *    - High-resolution 3,600-point circular angle sweep across octant boundaries.
 *    - Metric distance string formatting with localized comma grouping.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../src/engine/Camera.js';
import { Vector2 } from '../src/engine/Vector2.js';
import { AtmosphereManager } from '../src/game/overworld/AtmosphereManager.js';
import { calculateCompassBearing, formatMetricDistance } from '../src/game/ui/HUD.js';
import './test_helpers.js';

// ============================================================================
// SUITE 1: CAMERA BOUNDARY CLAMPING & VIEWPORT AABB CONFINEMENT
// ============================================================================
describe('Challenger Suite 1: Camera Boundary Clamping & Viewport AABB Confinement', () => {
  const MAP_BOUNDS = { minX: 0, minY: 0, maxX: 8000, maxY: 8000 };

  test('1.1: Negative Coordinates: Viewport AABB never penetrates outside [0, 8000]', () => {
    const camera = new Camera(1280, 720);
    camera.setBounds(MAP_BOUNDS);

    const testCoordinates = [
      new Vector2(-500, -500),
      new Vector2(-1000, -2000),
      new Vector2(-10000, -50000),
      new Vector2(-1e6, -1e6),
      new Vector2(-0.0001, -0.0001),
      new Vector2(-500, 4000),
      new Vector2(4000, -500)
    ];

    for (const coord of testCoordinates) {
      camera.snapTo(coord);
      const bounds = camera.getViewportBounds(0);

      assert.ok(
        bounds.minX >= 0,
        `Negative coord (${coord.x}, ${coord.y}) caused minX (${bounds.minX}) < 0`
      );
      assert.ok(
        bounds.minY >= 0,
        `Negative coord (${coord.x}, ${coord.y}) caused minY (${bounds.minY}) < 0`
      );
      assert.ok(
        bounds.maxX <= 8000,
        `Negative coord (${coord.x}, ${coord.y}) caused maxX (${bounds.maxX}) > 8000`
      );
      assert.ok(
        bounds.maxY <= 8000,
        `Negative coord (${coord.x}, ${coord.y}) caused maxY (${bounds.maxY}) > 8000`
      );

      // Verify exact clamped center when pinned at top-left
      if (coord.x <= 640 && coord.y <= 360) {
        assert.equal(camera.position.x, 640, `Camera position.x should clamp to 640, got ${camera.position.x}`);
        assert.equal(camera.position.y, 360, `Camera position.y should clamp to 360, got ${camera.position.y}`);
        assert.equal(bounds.minX, 0, `minX must be exactly 0`);
        assert.equal(bounds.minY, 0, `minY must be exactly 0`);
      }
    }
  });

  test('1.2: Exact Boundary Coordinates: (0,0), (8000,8000), and midpoints clamp safely', () => {
    const camera = new Camera(1280, 720);
    camera.setBounds(MAP_BOUNDS);

    const boundaryCoords = [
      new Vector2(0, 0),
      new Vector2(8000, 8000),
      new Vector2(0, 8000),
      new Vector2(8000, 0),
      new Vector2(0, 4000),
      new Vector2(8000, 4000),
      new Vector2(4000, 0),
      new Vector2(4000, 8000)
    ];

    for (const coord of boundaryCoords) {
      camera.snapTo(coord);
      const bounds = camera.getViewportBounds(0);

      assert.ok(bounds.minX >= 0, `Boundary (${coord.x}, ${coord.y}) minX was ${bounds.minX}`);
      assert.ok(bounds.minY >= 0, `Boundary (${coord.x}, ${coord.y}) minY was ${bounds.minY}`);
      assert.ok(bounds.maxX <= 8000, `Boundary (${coord.x}, ${coord.y}) maxX was ${bounds.maxX}`);
      assert.ok(bounds.maxY <= 8000, `Boundary (${coord.x}, ${coord.y}) maxY was ${bounds.maxY}`);

      // Dimension invariant: viewport width and height are preserved
      assert.equal(Math.round(bounds.maxX - bounds.minX), 1280, 'Viewport width preserved');
      assert.equal(Math.round(bounds.maxY - bounds.minY), 720, 'Viewport height preserved');
    }
  });

  test('1.3: Extreme Overshoot Coordinates: (12000, 12000), (1e7, 1e7) clamp strictly to map extents', () => {
    const camera = new Camera(1280, 720);
    camera.setBounds(MAP_BOUNDS);

    const overshootCoords = [
      new Vector2(12000, 12000),
      new Vector2(8000.001, 8000.001),
      new Vector2(50000, 80000),
      new Vector2(1e7, 1e7),
      new Vector2(12000, 4000),
      new Vector2(4000, 12000)
    ];

    for (const coord of overshootCoords) {
      camera.snapTo(coord);
      const bounds = camera.getViewportBounds(0);

      assert.ok(bounds.minX >= 0, `Overshoot (${coord.x}, ${coord.y}) minX was ${bounds.minX}`);
      assert.ok(bounds.minY >= 0, `Overshoot (${coord.x}, ${coord.y}) minY was ${bounds.minY}`);
      assert.ok(bounds.maxX <= 8000, `Overshoot (${coord.x}, ${coord.y}) maxX was ${bounds.maxX}`);
      assert.ok(bounds.maxY <= 8000, `Overshoot (${coord.x}, ${coord.y}) maxY was ${bounds.maxY}`);

      // Verify exact clamped center when pinned at bottom-right
      if (coord.x >= 7360 && coord.y >= 7640) {
        assert.equal(camera.position.x, 7360, `Camera position.x should clamp to 7360, got ${camera.position.x}`);
        assert.equal(camera.position.y, 7640, `Camera position.y should clamp to 7640, got ${camera.position.y}`);
        assert.equal(bounds.maxX, 8000, `maxX must be exactly 8000`);
        assert.equal(bounds.maxY, 8000, `maxY must be exactly 8000`);
      }
    }
  });

  test('1.4: Dynamic Multi-Frame Tracking & Lerp Overshoot Stress: high velocity impacts', () => {
    const camera = new Camera(1280, 720);
    camera.setBounds(MAP_BOUNDS);
    camera.snapTo(new Vector2(4000, 4000));

    // High velocity trajectories rocketing beyond map edges
    const trajectories = [
      { start: new Vector2(1000, 1000), target: new Vector2(-15000, -15000) },
      { start: new Vector2(7000, 7000), target: new Vector2(25000, 25000) },
      { start: new Vector2(4000, 1000), target: new Vector2(4000, -20000) },
      { start: new Vector2(4000, 7000), target: new Vector2(4000, 30000) },
      { start: new Vector2(1000, 4000), target: new Vector2(-30000, 4000) },
      { start: new Vector2(7000, 4000), target: new Vector2(30000, 4000) }
    ];

    for (const traj of trajectories) {
      camera.snapTo(traj.start);
      camera.target.copy(traj.target);

      // Simulate 120 frames with varying delta times (high frame rate to low frame rate spikes)
      const dts = [0.016, 0.033, 0.064, 0.1, 0.008, 0.016];
      for (let frame = 0; frame < 120; frame++) {
        const dt = dts[frame % dts.length];
        camera.update(dt);
        const bounds = camera.getViewportBounds(0);

        assert.ok(
          bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX <= 8000 && bounds.maxY <= 8000,
          `Dynamic frame ${frame} breached bounds: [${bounds.minX}, ${bounds.minY}, ${bounds.maxX}, ${bounds.maxY}]`
        );
      }
    }
  });

  test('1.5: Viewport Resolution Invariance: standard, ultrawide, portrait, and 4K', () => {
    const resolutions = [
      { w: 800, h: 600, name: 'SVGA 4:3' },
      { w: 1024, h: 768, name: 'XGA 4:3' },
      { w: 1280, h: 720, name: '720p 16:9' },
      { w: 1366, h: 768, name: 'HD 16:9' },
      { w: 1920, h: 1080, name: '1080p 16:9' },
      { w: 2560, h: 1440, name: '1440p 16:9' },
      { w: 3440, h: 1440, name: 'Ultrawide 21:9' },
      { w: 3840, h: 2160, name: '4K UHD' },
      { w: 720, h: 1280, name: 'Portrait 9:16' }
    ];

    const testPositions = [
      new Vector2(-1000, -1000),
      new Vector2(0, 0),
      new Vector2(4000, 4000),
      new Vector2(8000, 8000),
      new Vector2(15000, 15000)
    ];

    for (const res of resolutions) {
      const camera = new Camera(res.w, res.h);
      camera.setBounds(MAP_BOUNDS);

      for (const pos of testPositions) {
        camera.snapTo(pos);
        const bounds = camera.getViewportBounds(0);

        assert.ok(
          bounds.minX >= 0,
          `Resolution ${res.name} at (${pos.x}, ${pos.y}) breached minX: ${bounds.minX}`
        );
        assert.ok(
          bounds.minY >= 0,
          `Resolution ${res.name} at (${pos.x}, ${pos.y}) breached minY: ${bounds.minY}`
        );
        assert.ok(
          bounds.maxX <= 8000,
          `Resolution ${res.name} at (${pos.x}, ${pos.y}) breached maxX: ${bounds.maxX}`
        );
        assert.ok(
          bounds.maxY <= 8000,
          `Resolution ${res.name} at (${pos.x}, ${pos.y}) breached maxY: ${bounds.maxY}`
        );
      }
    }
  });

  test('1.6: Combinatorial Fuzzing: 10,000 random coordinates in [-50,000, +50,000]', () => {
    const camera = new Camera(1280, 720);
    camera.setBounds(MAP_BOUNDS);

    let breaches = 0;
    const fuzzCount = 10000;

    for (let i = 0; i < fuzzCount; i++) {
      // Deterministic PRNG formula for repeatability
      const rx = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 100000 - 50000;
      const ry = (Math.cos(i * 78.233) * 43758.5453 % 1) * 100000 - 50000;

      camera.snapTo(new Vector2(rx, ry));
      const b = camera.getViewportBounds(0);

      if (b.minX < 0 || b.minY < 0 || b.maxX > 8000 || b.maxY > 8000) {
        breaches++;
      }
    }

    assert.equal(breaches, 0, `Camera boundary breaches occurred in fuzzing: ${breaches} / ${fuzzCount}`);
  });
});

// ============================================================================
// SUITE 2: ATMOSPHERIC SMOOTHSTEP C1 CONTINUITY & FINITE DIFFERENCE STRESS
// ============================================================================
describe('Challenger Suite 2: Atmospheric Smoothstep Continuity & C1 Derivative Proof', () => {

  test('2.1: Continuous 5,000-Point Sampling (0 to 6000 px): zero NaNs, all values strictly bounded', () => {
    const sampleCount = 5000;
    const maxRadius = 6000;
    const step = maxRadius / sampleCount; // 1.2 px per step

    let nanCount = 0;
    let rangeViolations = 0;

    for (let i = 0; i <= sampleCount; i++) {
      const radius = i * step;
      const atmo = AtmosphereManager.calculateAtmosphere(radius, 0);

      // Check for NaNs
      if (
        Number.isNaN(atmo.darknessAlpha) ||
        Number.isNaN(atmo.lanternAmbientRadius) ||
        Number.isNaN(atmo.lanternBeamLength) ||
        Number.isNaN(atmo.fogDensity) ||
        Number.isNaN(atmo.vignetteInnerRatio) ||
        Number.isNaN(atmo.vignetteOuterRatio) ||
        Number.isNaN(atmo.vignetteDarkness) ||
        Number.isNaN(atmo.rainIntensity) ||
        Number.isNaN(atmo.miasmaIntensity) ||
        Number.isNaN(atmo.causticAlpha) ||
        Number.isNaN(atmo.waterColorRgb[0]) ||
        Number.isNaN(atmo.waterColorRgb[1]) ||
        Number.isNaN(atmo.waterColorRgb[2])
      ) {
        nanCount++;
      }

      // Check physical ranges
      if (atmo.darknessAlpha < 0.45 || atmo.darknessAlpha > 0.94) rangeViolations++;
      if (atmo.lanternAmbientRadius < 85 || atmo.lanternAmbientRadius > 195) rangeViolations++;
      if (atmo.lanternBeamLength < 290 || atmo.lanternBeamLength > 550) rangeViolations++;
      if (atmo.vignetteDarkness < 0.50 || atmo.vignetteDarkness > 0.99) rangeViolations++;
      if (atmo.rainIntensity < 0.0 || atmo.rainIntensity > 1.0) rangeViolations++;
      if (atmo.miasmaIntensity < 0.0 || atmo.miasmaIntensity > 1.0) rangeViolations++;

      // Check RGB integer validities
      for (let c = 0; c < 3; c++) {
        const val = atmo.waterColorRgb[c];
        if (!Number.isInteger(val) || val < 0 || val > 255) {
          rangeViolations++;
        }
      }
    }

    assert.equal(nanCount, 0, `Encountered ${nanCount} NaN values across 5,000 samples`);
    assert.equal(rangeViolations, 0, `Encountered ${rangeViolations} value range violations`);
  });

  test('2.2: Derivative & Finite Difference Analysis: no step jumps or sudden threshold pops', () => {
    const sampleCount = 5000;
    const maxRadius = 6000;
    const step = maxRadius / sampleCount; // 1.2 px

    let maxDarknessStepDelta = 0;
    let maxLanternRadiusStepDelta = 0;
    let maxRgbChannelStepDelta = 0;

    let prevAtmo = AtmosphereManager.calculateAtmosphere(0, 0);

    for (let i = 1; i <= sampleCount; i++) {
      const radius = i * step;
      const atmo = AtmosphereManager.calculateAtmosphere(radius, 0);

      const dDarkness = Math.abs(atmo.darknessAlpha - prevAtmo.darknessAlpha);
      const dLantern = Math.abs(atmo.lanternAmbientRadius - prevAtmo.lanternAmbientRadius);
      const dR = Math.abs(atmo.waterColorRgb[0] - prevAtmo.waterColorRgb[0]);
      const dG = Math.abs(atmo.waterColorRgb[1] - prevAtmo.waterColorRgb[1]);
      const dB = Math.abs(atmo.waterColorRgb[2] - prevAtmo.waterColorRgb[2]);

      if (dDarkness > maxDarknessStepDelta) maxDarknessStepDelta = dDarkness;
      if (dLantern > maxLanternRadiusStepDelta) maxLanternRadiusStepDelta = dLantern;
      if (dR > maxRgbChannelStepDelta) maxRgbChannelStepDelta = dR;
      if (dG > maxRgbChannelStepDelta) maxRgbChannelStepDelta = dG;
      if (dB > maxRgbChannelStepDelta) maxRgbChannelStepDelta = dB;

      prevAtmo = atmo;
    }

    // Mathematical guarantees:
    // With 1.2px step, darknessAlpha changes by at most ~0.00026 per step.
    assert.ok(
      maxDarknessStepDelta < 0.001,
      `Darkness alpha step delta exceeded 0.001: got ${maxDarknessStepDelta}`
    );

    // Lantern ambient radius changes by at most ~0.053 px per step.
    assert.ok(
      maxLanternRadiusStepDelta < 0.1,
      `Lantern ambient radius step delta exceeded 0.1: got ${maxLanternRadiusStepDelta}`
    );

    // RGB discrete color channels must change by AT MOST 1 unit per step (no color flashing/banding pops).
    assert.ok(
      maxRgbChannelStepDelta <= 1,
      `RGB channel step delta had sudden pop > 1: got ${maxRgbChannelStepDelta}`
    );
  });

  test('2.3: Mathematical C1 Continuity Verification: derivatives match zero at all keyframe thresholds', () => {
    // Keyframe thresholds: 1200, 2400, 3600, 4800 px
    const thresholds = [1200, 2400, 3600, 4800];
    const h = 0.001; // infinitesimal delta for numerical differentiation

    for (const threshold of thresholds) {
      // Left derivative: (f(B) - f(B - h)) / h
      const atmoLeft = AtmosphereManager.calculateAtmosphere(threshold - h, 0);
      const atmoCenter = AtmosphereManager.calculateAtmosphere(threshold, 0);
      const atmoRight = AtmosphereManager.calculateAtmosphere(threshold + h, 0);

      const dDarknessLeft = (atmoCenter.darknessAlpha - atmoLeft.darknessAlpha) / h;
      const dDarknessRight = (atmoRight.darknessAlpha - atmoCenter.darknessAlpha) / h;

      const dLanternLeft = (atmoCenter.lanternAmbientRadius - atmoLeft.lanternAmbientRadius) / h;
      const dLanternRight = (atmoRight.lanternAmbientRadius - atmoCenter.lanternAmbientRadius) / h;

      // C0 Continuity check: values immediately left and right match within float epsilon
      assert.ok(
        Math.abs(atmoCenter.darknessAlpha - atmoLeft.darknessAlpha) < 1e-4,
        `C0 discontinuity in darknessAlpha at threshold ${threshold}`
      );
      assert.ok(
        Math.abs(atmoRight.darknessAlpha - atmoCenter.darknessAlpha) < 1e-4,
        `C0 discontinuity in darknessAlpha at threshold ${threshold}`
      );

      // C1 Continuity check: derivatives must both converge to 0 at smoothstep keyframe endpoints
      assert.ok(
        Math.abs(dDarknessLeft) < 1e-3,
        `Left derivative of darknessAlpha at ${threshold} is non-zero: ${dDarknessLeft}`
      );
      assert.ok(
        Math.abs(dDarknessRight) < 1e-3,
        `Right derivative of darknessAlpha at ${threshold} is non-zero: ${dDarknessRight}`
      );
      assert.ok(
        Math.abs(dLanternLeft) < 1e-2,
        `Left derivative of lanternAmbientRadius at ${threshold} is non-zero: ${dLanternLeft}`
      );
      assert.ok(
        Math.abs(dLanternRight) < 1e-2,
        `Right derivative of lanternAmbientRadius at ${threshold} is non-zero: ${dLanternRight}`
      );
    }
  });

  test('2.4: Out-of-Bounds & Extreme Radius Robustness: negative, zero, and deep ocean clamping', () => {
    // Negative distance clamps to 0 (harbor center)
    const atmoNeg = AtmosphereManager.calculateAtmosphere(-500);
    const atmoZero = AtmosphereManager.calculateAtmosphere(0);
    assert.equal(atmoNeg.darknessAlpha, atmoZero.darknessAlpha);
    assert.equal(atmoNeg.zoneIndex, 1);
    assert.equal(atmoNeg.zoneType, 'shallow');

    // Radii beyond 4800px clamp to trench maximum without NaN or index out of bounds
    const atmo4800 = AtmosphereManager.calculateAtmosphere(4800);
    const atmo6000 = AtmosphereManager.calculateAtmosphere(6000);
    const atmo10000 = AtmosphereManager.calculateAtmosphere(10000);
    const atmo100000 = AtmosphereManager.calculateAtmosphere(100000);

    assert.equal(atmo6000.darknessAlpha, atmo4800.darknessAlpha);
    assert.equal(atmo10000.darknessAlpha, atmo4800.darknessAlpha);
    assert.equal(atmo100000.darknessAlpha, atmo4800.darknessAlpha);
    assert.equal(atmo100000.zoneIndex, 4);
    assert.equal(atmo100000.zoneType, 'cave');
  });
});

// ============================================================================
// SUITE 3: COMPASS ROSE MATH & SINGULARITY STRESS
// ============================================================================
describe('Challenger Suite 3: Compass Rose Math & Singularity Stress', () => {

  test('3.1: Exact Singularity at (4000, 4000) (distance = 0): safe ANCHOR resolution, no NaN', () => {
    const bearing = calculateCompassBearing(4000, 4000, 4000, 4000);

    assert.equal(bearing.distance, 0, 'Distance must be exactly 0 at harbor center');
    assert.equal(bearing.isDocked, true, 'isDocked must be true at harbor center');
    assert.equal(bearing.bearingStr, 'ANCHOR', 'Bearing string must be ANCHOR at harbor center');
    assert.equal(bearing.angle, 0, 'Angle must be 0 at harbor center');
    assert.ok(!Number.isNaN(bearing.angle), 'Angle must not be NaN');
    assert.ok(!Number.isNaN(bearing.distance), 'Distance must not be NaN');
  });

  test('3.2: Docking Threshold Annular Boundary (10px): sharp clean transition from ANCHOR to Wind', () => {
    // Inside docking zone (< 10 px)
    const insideCoords = [
      { x: 4000, y: 4005, d: 5 },
      { x: 4000, y: 4009.99, d: 9.99 },
      { x: 4007, y: 4007, d: Math.SQRT2 * 7 } // ~9.899
    ];

    for (const c of insideCoords) {
      const b = calculateCompassBearing(c.x, c.y);
      assert.equal(b.isDocked, true, `Coord (${c.x}, ${c.y}) must be docked`);
      assert.equal(b.bearingStr, 'ANCHOR', `Coord (${c.x}, ${c.y}) must read ANCHOR`);
      assert.equal(b.distance, 0);
    }

    // Outside docking zone (>= 10 px)
    const outsideCoords = [
      { x: 4000, y: 4010.01, expected: 'N' },
      { x: 4000, y: 3989.99, expected: 'S' },
      { x: 3989.99, y: 4000, expected: 'E' },
      { x: 4010.01, y: 4000, expected: 'W' }
    ];

    for (const c of outsideCoords) {
      const b = calculateCompassBearing(c.x, c.y);
      assert.equal(b.isDocked, false, `Coord (${c.x}, ${c.y}) must not be docked`);
      assert.notEqual(b.bearingStr, 'ANCHOR', `Coord (${c.x}, ${c.y}) must have compass wind`);
      assert.equal(b.bearingStr, c.expected, `Coord (${c.x}, ${c.y}) expected ${c.expected}, got ${b.bearingStr}`);
      assert.ok(b.distance >= 10, 'Distance must be >= 10');
    }
  });

  test('3.3: Cardinal & Intercardinal Alignments: all 8 winds resolve accurately', () => {
    // In top-down 2D canvas:
    // +X is East, -X is West, -Y is North (up), +Y is South (down)
    // Harbor is at (4000, 4000). The bearing points FROM vessel TOWARD harbor.
    const cardinalTestCases = [
      // Vessel south of harbor -> heading toward harbor is North ('N')
      { fromX: 4000, fromY: 5500, expectedBearing: 'N', desc: 'Vessel due South, Harbor due North' },
      // Vessel southwest of harbor -> heading toward harbor is North-East ('NE')
      { fromX: 2500, fromY: 5500, expectedBearing: 'NE', desc: 'Vessel South-West, Harbor North-East' },
      // Vessel west of harbor -> heading toward harbor is East ('E')
      { fromX: 2500, fromY: 4000, expectedBearing: 'E', desc: 'Vessel due West, Harbor due East' },
      // Vessel northwest of harbor -> heading toward harbor is South-East ('SE')
      { fromX: 2500, fromY: 2500, expectedBearing: 'SE', desc: 'Vessel North-West, Harbor South-East' },
      // Vessel north of harbor -> heading toward harbor is South ('S')
      { fromX: 4000, fromY: 2500, expectedBearing: 'S', desc: 'Vessel due North, Harbor due South' },
      // Vessel northeast of harbor -> heading toward harbor is South-West ('SW')
      { fromX: 5500, fromY: 2500, expectedBearing: 'SW', desc: 'Vessel North-East, Harbor South-West' },
      // Vessel east of harbor -> heading toward harbor is West ('W')
      { fromX: 5500, fromY: 4000, expectedBearing: 'W', desc: 'Vessel due East, Harbor due West' },
      // Vessel southeast of harbor -> heading toward harbor is North-West ('NW')
      { fromX: 5500, fromY: 5500, expectedBearing: 'NW', desc: 'Vessel South-East, Harbor North-West' }
    ];

    for (const tc of cardinalTestCases) {
      const b = calculateCompassBearing(tc.fromX, tc.fromY);
      assert.equal(
        b.bearingStr,
        tc.expectedBearing,
        `${tc.desc}: expected ${tc.expectedBearing}, got ${b.bearingStr}`
      );
      assert.equal(b.isDocked, false);
      assert.ok(!Number.isNaN(b.angle));
      assert.ok(!Number.isNaN(b.distance));
    }
  });

  test('3.4: Wind Octant Boundary Sweep: full 3,600-point circular angle sweep (0.1° resolution)', () => {
    const validWinds = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);
    const radius = 2000;
    const sweepPoints = 3600;

    let undefinedCount = 0;
    let nanCount = 0;

    for (let i = 0; i < sweepPoints; i++) {
      const theta = (i * 2 * Math.PI) / sweepPoints;
      // Coordinates of vessel at radius from harbor
      const vx = 4000 + radius * Math.cos(theta);
      const vy = 4000 + radius * Math.sin(theta);

      const b = calculateCompassBearing(vx, vy);

      if (!validWinds.has(b.bearingStr)) {
        undefinedCount++;
      }
      if (Number.isNaN(b.angle) || Number.isNaN(b.distance)) {
        nanCount++;
      }
    }

    assert.equal(undefinedCount, 0, `Invalid wind bearing strings encountered: ${undefinedCount}`);
    assert.equal(nanCount, 0, `NaN values encountered in circular angle sweep: ${nanCount}`);
  });

  test('3.5: Metric Distance Formatting: correct rounding and comma formatting', () => {
    assert.equal(formatMetricDistance(0), '0m');
    assert.equal(formatMetricDistance(9), '9m');
    assert.equal(formatMetricDistance(14), '14m');
    assert.equal(formatMetricDistance(999), '999m');
    assert.equal(formatMetricDistance(1000), '1,000m');
    assert.equal(formatMetricDistance(1450), '1,450m');
    assert.equal(formatMetricDistance(3999.6), '4,000m');
    assert.equal(formatMetricDistance(5656.854), '5,657m');
    assert.equal(formatMetricDistance(8000), '8,000m');
    assert.equal(formatMetricDistance(11313.708), '11,314m');
  });
});
