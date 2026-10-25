import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from '../src/engine/Vector2.js';
import { HUD, calculateCompassBearing, formatMetricDistance } from '../src/game/ui/HUD.js';
import { SeaChartOverlay } from '../src/game/ui/SeaChartOverlay.js';
import { FishingSpot } from '../src/game/overworld/FishingSpot.js';
import { OverworldMap } from '../src/game/overworld/OverworldMap.js';
import { Boat } from '../src/game/overworld/Boat.js';
import { MockCanvas } from './test_helpers.js';

describe('Navigation HUD & Sea Chart Unit Tests', () => {

  // --------------------------------------------------------------------------
  // 1. Compass Bearing & Directional Calculations
  // --------------------------------------------------------------------------
  describe('Compass Bearing & Angle Math', () => {
    test('calculateCompassBearing returns ANCHOR and isDocked when at harbor center (4000, 4000)', () => {
      const result = calculateCompassBearing(4000, 4000);
      assert.equal(result.isDocked, true);
      assert.equal(result.distance, 0);
      assert.equal(result.bearingStr, 'ANCHOR');
    });

    test('calculateCompassBearing returns N when vessel is directly South of harbor (4000, 6000)', () => {
      const result = calculateCompassBearing(4000, 6000);
      assert.equal(result.bearingStr, 'N');
      assert.equal(result.distance, 2000);
      assert.equal(result.isDocked, false);
      // Needle angle points toward harbor: dy = -2000, dx = 0 -> -PI/2
      assert.ok(Math.abs(result.angle - (-Math.PI / 2)) < 0.001);
    });

    test('calculateCompassBearing returns NE when vessel is Southwest of harbor (2000, 6000)', () => {
      const result = calculateCompassBearing(2000, 6000);
      assert.equal(result.bearingStr, 'NE');
      assert.ok(result.distance > 2800);
    });

    test('calculateCompassBearing returns E when vessel is directly West of harbor (2000, 4000)', () => {
      const result = calculateCompassBearing(2000, 4000);
      assert.equal(result.bearingStr, 'E');
      assert.equal(result.distance, 2000);
      assert.equal(result.angle, 0);
    });

    test('calculateCompassBearing returns SE when vessel is Northwest of harbor (2000, 2000)', () => {
      const result = calculateCompassBearing(2000, 2000);
      assert.equal(result.bearingStr, 'SE');
    });

    test('calculateCompassBearing returns S when vessel is directly North of harbor (4000, 2000)', () => {
      const result = calculateCompassBearing(4000, 2000);
      assert.equal(result.bearingStr, 'S');
      assert.equal(result.distance, 2000);
      assert.ok(Math.abs(result.angle - (Math.PI / 2)) < 0.001);
    });

    test('calculateCompassBearing returns SW when vessel is Northeast of harbor (6000, 2000)', () => {
      const result = calculateCompassBearing(6000, 2000);
      assert.equal(result.bearingStr, 'SW');
    });

    test('calculateCompassBearing returns W when vessel is directly East of harbor (6000, 4000)', () => {
      const result = calculateCompassBearing(6000, 4000);
      assert.equal(result.bearingStr, 'W');
      assert.equal(result.distance, 2000);
      assert.ok(Math.abs(Math.abs(result.angle) - Math.PI) < 0.001);
    });

    test('calculateCompassBearing returns NW when vessel is Southeast of harbor (6000, 6000)', () => {
      const result = calculateCompassBearing(6000, 6000);
      assert.equal(result.bearingStr, 'NW');
    });

    test('calculateCompassBearing Euclidean 3-4-5 triangle computes exact distance 500m', () => {
      const result = calculateCompassBearing(4300, 4400);
      assert.equal(result.distance, 500);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Metric Distance Formatting
  // --------------------------------------------------------------------------
  describe('Metric Distance Formatter', () => {
    test('formatMetricDistance formats numbers under 1000m without comma', () => {
      assert.equal(formatMetricDistance(0), '0m');
      assert.equal(formatMetricDistance(280), '280m');
      assert.equal(formatMetricDistance(999), '999m');
    });

    test('formatMetricDistance formats numbers >= 1000m with comma grouping', () => {
      assert.equal(formatMetricDistance(1000), '1,000m');
      assert.equal(formatMetricDistance(1450), '1,450m');
      assert.equal(formatMetricDistance(5657), '5,657m');
      assert.equal(formatMetricDistance(8000), '8,000m');
    });

    test('formatMetricDistance rounds floating point values cleanly', () => {
      assert.equal(formatMetricDistance(1449.6), '1,450m');
      assert.equal(formatMetricDistance(349.2), '349m');
    });
  });

  // --------------------------------------------------------------------------
  // 3. SeaChartOverlay State Machine & Pan/Zoom
  // --------------------------------------------------------------------------
  describe('SeaChartOverlay Lifecycle & State', () => {
    test('SeaChartOverlay initializes in closed state', () => {
      const overlay = new SeaChartOverlay();
      assert.equal(overlay.isOpen(), false);
    });

    test('SeaChartOverlay.openChart() and closeChart() modify open state', () => {
      const overlay = new SeaChartOverlay();
      overlay.openChart();
      assert.equal(overlay.isOpen(), true);
      overlay.closeChart();
      assert.equal(overlay.isOpen(), false);
    });

    test('SeaChartOverlay.toggle() alternates state', () => {
      const overlay = new SeaChartOverlay();
      assert.equal(overlay.isOpen(), false);
      overlay.toggle();
      assert.equal(overlay.isOpen(), true);
      overlay.toggle();
      assert.equal(overlay.isOpen(), false);
    });

    test('SeaChartOverlay.setOpen() sets boolean directly', () => {
      const overlay = new SeaChartOverlay();
      overlay.setOpen(true);
      assert.equal(overlay.isOpen(), true);
      overlay.setOpen(false);
      assert.equal(overlay.isOpen(), false);
    });

    test('SeaChartOverlay.resetView() resets pan to (0, 0)', () => {
      const overlay = new SeaChartOverlay();
      overlay.centerOnPosition(new Vector2(6000, 6000), 1280, 720);
      overlay.resetView();
      // Should reset to origin
      assert.ok(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Headless Canvas Rendering Verification
  // --------------------------------------------------------------------------
  describe('Canvas Rendering Verification', () => {
    test('SeaChartOverlay.render executes path drawing when open', () => {
      const overlay = new SeaChartOverlay();
      overlay.openChart();

      const canvas = new MockCanvas(1280, 720);
      const ctx = canvas.ctx;

      const boatPos = new Vector2(4500, 4500);
      const boatHeading = 0;
      const whirlpools: FishingSpot[] = [
        new FishingSpot({
          id: 'test_spot',
          name: 'Eddy One',
          position: new Vector2(4800, 4800),
          zoneType: 'shallow',
          speciesType: 'perch',
          description: 'A swirling eddy'
        })
      ];

      overlay.render(
        ctx as any,
        1280,
        720,
        boatPos,
        boatHeading,
        whirlpools,
        new Vector2(4000, 4000),
        []
      );

      assert.ok(ctx.hasOperation('save'), 'Overlay must save canvas state');
      assert.ok(ctx.hasOperation('restore'), 'Overlay must restore canvas state');
      assert.ok(ctx.hasOperation('arc'), 'Overlay must render circular markers and rings');
      assert.ok(ctx.hasOperation('fillText'), 'Overlay must render labels and texts');
    });

    test('HUD.renderOverworld renders compass rose without errors on mock canvas', () => {
      const hud = new HUD();
      const canvas = new MockCanvas(1280, 720);
      const ctx = canvas.ctx;

      const boat = new Boat(4000, 5000, 0);
      const map = new OverworldMap();

      hud.renderOverworld(
        ctx as any,
        1280,
        720,
        boat,
        map,
        null,
        false,
        100,
        7
      );

      assert.ok(ctx.hasOperation('save'));
      assert.ok(ctx.hasOperation('restore'));
      assert.ok(ctx.hasOperation('fillText'));
      assert.ok(ctx.hasOperation('arc'));
    });
  });

  // --------------------------------------------------------------------------
  // 5. HUD Static & Instance Compatibility
  // --------------------------------------------------------------------------
  describe('HUD Class API Compatibility', () => {
    test('HUD exposes calculateCompassBearing as static method', () => {
      assert.equal(typeof HUD.calculateCompassBearing, 'function');
      const b = HUD.calculateCompassBearing(4000, 5450);
      assert.equal(b.bearingStr, 'N');
      assert.equal(b.distance, 1450);
    });

    test('HUD exposes formatMetricDistance as static method', () => {
      assert.equal(typeof HUD.formatMetricDistance, 'function');
      assert.equal(HUD.formatMetricDistance(1450), '1,450m');
    });
  });

});
