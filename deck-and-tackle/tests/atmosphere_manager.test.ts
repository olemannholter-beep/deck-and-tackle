import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from '../src/engine/Vector2.js';
import { Camera } from '../src/engine/Camera.js';
import { Boat } from '../src/game/overworld/Boat.js';
import { AtmosphereManager } from '../src/game/overworld/AtmosphereManager.js';
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

describe('AtmosphereManager: Milestone 2 Atmospheric & Radial Zone Suite', () => {

  describe('1. Radial Euclidean Distance & Zone Boundaries', () => {
    test('Calculates exact Euclidean distance to Harbor Center (4000, 4000)', () => {
      assert.equal(AtmosphereManager.getDistanceToHarbor(new Vector2(4000, 4000)), 0);
      assert.equal(AtmosphereManager.getDistanceToHarbor(new Vector2(4000, 5200)), 1200);
      assert.equal(AtmosphereManager.getDistanceToHarbor(new Vector2(1600, 4000)), 2400);
      assert.equal(AtmosphereManager.getDistanceToHarbor(new Vector2(4000, 7600)), 3600);
      
      const cornerDist = Math.hypot(4000, 4000);
      assert.ok(Math.abs(AtmosphereManager.getDistanceToHarbor(new Vector2(0, 0)) - cornerDist) < 1e-6);
      assert.ok(Math.abs(AtmosphereManager.getDistanceToHarbor(new Vector2(8000, 8000)) - cornerDist) < 1e-6);
    });

    test('Maps 4 concentric zones accurately by distance threshold', () => {
      // Zone 1: The Shallows (0 to 1200 px) -> 'shallow'
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 4000)), 'shallow');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 4600)), 'shallow');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 5199)), 'shallow');
      assert.equal(AtmosphereManager.getZoneIndex(0), 1);
      assert.equal(AtmosphereManager.getZoneIndex(1199.9), 1);

      // Zone 2: The Foggy Banks (1200 to 2400 px) -> 'lake'
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 5200)), 'lake');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 5800)), 'lake');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 6399)), 'lake');
      assert.equal(AtmosphereManager.getZoneIndex(1200), 2);
      assert.equal(AtmosphereManager.getZoneIndex(2399.9), 2);

      // Zone 3: The Sunken Reefs (2400 to 3600 px) -> 'abyss'
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 6400)), 'abyss');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 7000)), 'abyss');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 7599)), 'abyss');
      assert.equal(AtmosphereManager.getZoneIndex(2400), 3);
      assert.equal(AtmosphereManager.getZoneIndex(3599.9), 3);

      // Zone 4: The Eldritch Trench (3600+ px) -> 'cave'
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(4000, 7600)), 'cave');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(0, 0)), 'cave');
      assert.equal(AtmosphereManager.getZoneAt(new Vector2(8000, 8000)), 'cave');
      assert.equal(AtmosphereManager.getZoneIndex(3600), 4);
      assert.equal(AtmosphereManager.getZoneIndex(5657), 4);
    });

    test('Zone display names match expected titles', () => {
      assert.equal(AtmosphereManager.getZoneDisplayName('shallow'), 'The Shallows (Zone 1)');
      assert.equal(AtmosphereManager.getZoneDisplayName('lake'), 'The Foggy Banks (Zone 2)');
      assert.equal(AtmosphereManager.getZoneDisplayName('abyss'), 'The Sunken Reefs (Zone 3)');
      assert.equal(AtmosphereManager.getZoneDisplayName('cave'), 'The Eldritch Trench (Zone 4)');
    });
  });

  describe('2. Smoothstep Interpolation & Zero-Pop Continuity', () => {
    test('Smoothstep S-curve satisfies boundary values and derivative continuity', () => {
      assert.equal(AtmosphereManager.smoothstep(0, 100, -10), 0.0);
      assert.equal(AtmosphereManager.smoothstep(0, 100, 0), 0.0);
      assert.equal(AtmosphereManager.smoothstep(0, 100, 50), 0.5);
      assert.equal(AtmosphereManager.smoothstep(0, 100, 100), 1.0);
      assert.equal(AtmosphereManager.smoothstep(0, 100, 150), 1.0);
    });

    test('Continuous smoothstep parameters across Zone 1 -> Zone 2 boundary (D = 1200)', () => {
      const pPre = AtmosphereManager.calculateAtmosphere(1199.99);
      const pPost = AtmosphereManager.calculateAtmosphere(1200.01);

      assert.ok(Math.abs(pPre.darknessAlpha - pPost.darknessAlpha) < 0.001);
      assert.ok(Math.abs(pPre.lanternAmbientRadius - pPost.lanternAmbientRadius) < 0.01);
      assert.ok(Math.abs(pPre.lanternBeamLength - pPost.lanternBeamLength) < 0.01);
      assert.ok(Math.abs(pPre.fogDensity - pPost.fogDensity) < 0.001);
      assert.ok(Math.abs(pPre.vignetteInnerRatio - pPost.vignetteInnerRatio) < 0.001);
      assert.ok(Math.abs(pPre.vignetteDarkness - pPost.vignetteDarkness) < 0.001);
      assert.deepEqual(pPre.waterColorRgb, pPost.waterColorRgb);
    });

    test('Continuous smoothstep parameters across Zone 2 -> Zone 3 boundary (D = 2400)', () => {
      const pPre = AtmosphereManager.calculateAtmosphere(2399.99);
      const pPost = AtmosphereManager.calculateAtmosphere(2400.01);

      assert.ok(Math.abs(pPre.darknessAlpha - pPost.darknessAlpha) < 0.001);
      assert.ok(Math.abs(pPre.lanternAmbientRadius - pPost.lanternAmbientRadius) < 0.01);
      assert.ok(Math.abs(pPre.lanternBeamLength - pPost.lanternBeamLength) < 0.01);
      assert.ok(Math.abs(pPre.rainIntensity - pPost.rainIntensity) < 0.001);
      assert.deepEqual(pPre.waterColorRgb, pPost.waterColorRgb);
    });

    test('Continuous smoothstep parameters across Zone 3 -> Zone 4 boundary (D = 3600)', () => {
      const pPre = AtmosphereManager.calculateAtmosphere(3599.99);
      const pPost = AtmosphereManager.calculateAtmosphere(3600.01);

      assert.ok(Math.abs(pPre.darknessAlpha - pPost.darknessAlpha) < 0.001);
      assert.ok(Math.abs(pPre.lanternAmbientRadius - pPost.lanternAmbientRadius) < 0.01);
      assert.ok(Math.abs(pPre.miasmaIntensity - pPost.miasmaIntensity) < 0.001);
      assert.deepEqual(pPre.waterColorRgb, pPost.waterColorRgb);
    });
  });

  describe('3. Keyframe Atmospheric Parameter Values', () => {
    test('Water colors scale from murky green to dark teal, abyssal slate, and pitch-black void', () => {
      const z1 = AtmosphereManager.calculateAtmosphere(0);
      assert.deepEqual(z1.waterColorRgb, [14, 52, 38]);
      assert.equal(z1.waterColor, 'rgb(14, 52, 38)');

      const z2 = AtmosphereManager.calculateAtmosphere(2400);
      assert.deepEqual(z2.waterColorRgb, [7, 25, 32]);
      assert.equal(z2.waterColor, 'rgb(7, 25, 32)');

      const z3 = AtmosphereManager.calculateAtmosphere(3600);
      assert.deepEqual(z3.waterColorRgb, [4, 9, 18]);
      assert.equal(z3.waterColor, 'rgb(4, 9, 18)');

      const z4 = AtmosphereManager.calculateAtmosphere(4800);
      assert.deepEqual(z4.waterColorRgb, [1, 2, 4]);
      assert.equal(z4.waterColor, 'rgb(1, 2, 4)');
    });

    test('Darkness mask base alpha escalates from 0.45 in Zone 1 up to 0.94 in Zone 4', () => {
      const d0 = AtmosphereManager.calculateAtmosphere(0).darknessAlpha;
      const d1200 = AtmosphereManager.calculateAtmosphere(1200).darknessAlpha;
      const d2400 = AtmosphereManager.calculateAtmosphere(2400).darknessAlpha;
      const d3600 = AtmosphereManager.calculateAtmosphere(3600).darknessAlpha;
      const d4800 = AtmosphereManager.calculateAtmosphere(4800).darknessAlpha;

      assert.ok(Math.abs(d0 - 0.45) < 0.01);
      assert.ok(Math.abs(d1200 - 0.62) < 0.01);
      assert.ok(Math.abs(d2400 - 0.80) < 0.01);
      assert.ok(Math.abs(d3600 - 0.88) < 0.01);
      assert.ok(Math.abs(d4800 - 0.94) < 0.01);
    });

    test('Boat lantern ambient radius constricts from 195px down to 85px', () => {
      const r0 = AtmosphereManager.calculateAtmosphere(0).lanternAmbientRadius;
      const r1200 = AtmosphereManager.calculateAtmosphere(1200).lanternAmbientRadius;
      const r2400 = AtmosphereManager.calculateAtmosphere(2400).lanternAmbientRadius;
      const r3600 = AtmosphereManager.calculateAtmosphere(3600).lanternAmbientRadius;
      const r4800 = AtmosphereManager.calculateAtmosphere(4800).lanternAmbientRadius;

      assert.ok(Math.abs(r0 - 195) < 0.01);
      assert.ok(Math.abs(r1200 - 160) < 0.01);
      assert.ok(Math.abs(r2400 - 135) < 0.01);
      assert.ok(Math.abs(r3600 - 110) < 0.01);
      assert.ok(Math.abs(r4800 - 85) < 0.01);
    });

    test('Boat searchlight beam length scales down from 550px down to 290px', () => {
      const b0 = AtmosphereManager.calculateAtmosphere(0).lanternBeamLength;
      const b1200 = AtmosphereManager.calculateAtmosphere(1200).lanternBeamLength;
      const b2400 = AtmosphereManager.calculateAtmosphere(2400).lanternBeamLength;
      const b3600 = AtmosphereManager.calculateAtmosphere(3600).lanternBeamLength;
      const b4800 = AtmosphereManager.calculateAtmosphere(4800).lanternBeamLength;

      assert.ok(Math.abs(b0 - 550) < 0.01);
      assert.ok(Math.abs(b1200 - 490) < 0.01);
      assert.ok(Math.abs(b2400 - 430) < 0.01);
      assert.ok(Math.abs(b3600 - 360) < 0.01);
      assert.ok(Math.abs(b4800 - 290) < 0.01);
    });

    test('Screen-edge vignette constricts inner radius and escalates darkness to 0.99', () => {
      const v0 = AtmosphereManager.calculateAtmosphere(0);
      const v4 = AtmosphereManager.calculateAtmosphere(4800);

      assert.ok(v0.vignetteInnerRatio > v4.vignetteInnerRatio);
      assert.ok(v0.vignetteOuterRatio > v4.vignetteOuterRatio);
      assert.ok(v0.vignetteDarkness < v4.vignetteDarkness);
      assert.ok(Math.abs(v4.vignetteDarkness - 0.99) < 0.01);
    });

    test('Zone 3 Tempest Squall activates rain; Zone 4 Whispering Miasma activates cyan motes', () => {
      const z1 = AtmosphereManager.calculateAtmosphere(600);
      const z3 = AtmosphereManager.calculateAtmosphere(3000);
      const z4 = AtmosphereManager.calculateAtmosphere(4500);

      assert.equal(z1.rainIntensity, 0);
      assert.equal(z1.miasmaIntensity, 0);

      assert.ok(z3.rainIntensity > 0.5, 'Rain must peak in Zone 3');
      assert.ok(z4.miasmaIntensity > 0.8, 'Miasma must peak in Zone 4');
    });
  });

  describe('4. AtmosphereManager Instance & Particle Lifecycle', () => {
    test('AtmosphereManager instantiates and updates with boat and camera positions', () => {
      const atmo = new AtmosphereManager();
      const boatPos = new Vector2(4000, 7000); // Zone 3 Sunken Reefs
      const camPos = new Vector2(4000, 7000);

      atmo.update(0.016, boatPos, camPos, 1920, 1080);
      const params = atmo.getParameters();

      assert.equal(params.zoneIndex, 3);
      assert.equal(params.zoneType, 'abyss');
      assert.equal(params.zoneName, 'The Sunken Reefs (Zone 3)');
      assert.ok(params.rainIntensity > 0.5);
    });

    test('Zone 4 activates Whispering Miasma motes update', () => {
      const atmo = new AtmosphereManager();
      const trenchPos = new Vector2(0, 0); // Farthest map corner (D ≈ 5657 px) deep in Zone 4 Eldritch Trench

      atmo.update(0.05, trenchPos, trenchPos, 1920, 1080);
      const params = atmo.getParameters();

      assert.equal(params.zoneIndex, 4);
      assert.equal(params.zoneType, 'cave');
      assert.ok(params.miasmaIntensity > 0.8);
    });

    test('AtmosphereManager executes renderLightingAndAtmosphere dual-canvas pipeline without exceptions', () => {
      const atmo = new AtmosphereManager();
      const boat = new Boat(4000, 4000, 0);
      const cam = new Camera(1280, 720);
      cam.snapTo(boat.position);

      const mainCanvas = new MockCanvas(1280, 720);
      const mainCtx = mainCanvas.getContext('2d') as unknown as CanvasRenderingContext2D;
      const lightingCanvas = new MockCanvas(1280, 720) as unknown as HTMLCanvasElement;
      const lightingCtx = (lightingCanvas as any).getContext('2d') as unknown as CanvasRenderingContext2D;

      atmo.update(0.016, boat.position, cam.position, 1280, 720);

      assert.doesNotThrow(() => {
        atmo.renderLightingAndAtmosphere(
          mainCtx,
          lightingCanvas,
          lightingCtx,
          cam,
          boat,
          [{ x: 4000, y: 4070, radius: 240, color: '#fef08a' }],
          [],
          1280,
          720,
          1
        );
      });
    });

    test('AtmosphereManager provides valid interface implementations for water background, bathymetry, and drift cues', () => {
      const atmo = new AtmosphereManager();
      const cam = new Camera(1280, 720);
      cam.snapTo(new Vector2(4000, 4000));
      const mainCanvas = new MockCanvas(1280, 720);
      const mainCtx = mainCanvas.getContext('2d') as unknown as CanvasRenderingContext2D;

      assert.doesNotThrow(() => {
        atmo.renderWaterBackground(mainCtx, cam, 1280, 720);
        atmo.renderConcentricBathymetryRings(mainCtx, cam);
        atmo.renderOpenWaterDriftCues(mainCtx, cam, new Vector2(50, 0));
      });
    });
  });
});
