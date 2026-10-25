/**
 * E2E Test Helpers & Authoritative Specification Oracles
 * 2D Top-Down Overworld 8000x8000 Expansion
 * Derived strictly from ORIGINAL_REQUEST.md (2026-10-25T11:46:20Z), TEST_INFRA.md, and PROJECT.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Headless Node Polyfills for DOM / Audio
// ---------------------------------------------------------------------------
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    AudioContext: class MockAudioContext {
      state = 'suspended';
      resume() { return Promise.resolve(); }
      createGain() { return { connect: () => {} }; }
      destination = {};
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
}
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
}
if (typeof globalThis.Audio === 'undefined') {
  (globalThis as any).Audio = class MockAudio {
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
  };
}

// ---------------------------------------------------------------------------
// Authoritative Architectural Constants
// ---------------------------------------------------------------------------
export const MAP_WIDTH = 8000;
export const MAP_HEIGHT = 8000;
export const HARBOR_CENTER_X = 4000;
export const HARBOR_CENTER_Y = 4000;
export const HARBOR_DOCK_X = 4000;
export const HARBOR_DOCK_Y = 4070;

export const ZONE_1_RADIUS = 1200; // The Shallows (0 - 1200 px)
export const ZONE_2_RADIUS = 2400; // The Foggy Banks (1200 - 2400 px)
export const ZONE_3_RADIUS = 3600; // The Sunken Reefs (2400 - 3600 px)
// Zone 4: The Eldritch Trench (3600+ px)

export const GLOBAL_WHIRLPOOL_MIN = 6;
export const GLOBAL_WHIRLPOOL_MAX = 8;
export const LOCAL_WHIRLPOOL_MIN = 2;
export const LOCAL_WHIRLPOOL_MAX = 3;
export const LOCAL_BIAS_INNER_RADIUS = 600;
export const LOCAL_BIAS_OUTER_RADIUS = 1800;

export const WHIRLPOOL_SPAWN_DURATION = 2.5; // seconds
export const WHIRLPOOL_ACTIVE_MIN_DURATION = 35.0; // seconds
export const WHIRLPOOL_ACTIVE_MAX_DURATION = 55.0; // seconds
export const WHIRLPOOL_DESPAWN_DURATION = 3.0; // seconds
export const PROXIMITY_LOCK_RADIUS = 120; // px

// ---------------------------------------------------------------------------
// Authoritative Math & Logic Oracles
// ---------------------------------------------------------------------------

/**
 * Calculates Euclidean radial distance from Central Safe Harbor (4000, 4000).
 */
export function referenceCalcDistanceToHarbor(x: number, y: number): number {
  const dx = x - HARBOR_CENTER_X;
  const dy = y - HARBOR_CENTER_Y;
  return Math.sqrt(dx * dx + dy * dy);
}

export type ZoneType = 'shallow' | 'lake' | 'abyss' | 'cave';
export type ZoneIndex = 1 | 2 | 3 | 4;

export interface ZoneSpecification {
  tier: ZoneIndex;
  id: string;
  name: string;
  zoneType: ZoneType;
  speciesType: 'perch' | 'pike' | 'gar' | 'dagon';
  minDistance: number;
  maxDistance: number;
}

export const ZONE_SPECS: Record<ZoneIndex, ZoneSpecification> = {
  1: {
    tier: 1,
    id: 'zone_1_shallows',
    name: 'The Shallows',
    zoneType: 'shallow',
    speciesType: 'perch',
    minDistance: 0,
    maxDistance: 1200
  },
  2: {
    tier: 2,
    id: 'zone_2_foggy_banks',
    name: 'The Foggy Banks',
    zoneType: 'lake',
    speciesType: 'pike',
    minDistance: 1200,
    maxDistance: 2400
  },
  3: {
    tier: 3,
    id: 'zone_3_sunken_reefs',
    name: 'The Sunken Reefs',
    zoneType: 'abyss',
    speciesType: 'gar',
    minDistance: 2400,
    maxDistance: 3600
  },
  4: {
    tier: 4,
    id: 'zone_4_eldritch_trench',
    name: 'The Eldritch Trench',
    zoneType: 'cave',
    speciesType: 'dagon',
    minDistance: 3600,
    maxDistance: 6000
  }
};

/**
 * Authoritative lookup for Zone given radial distance in pixels.
 */
export function referenceResolveZone(distance: number): ZoneSpecification {
  if (distance < ZONE_1_RADIUS) return ZONE_SPECS[1];
  if (distance < ZONE_2_RADIUS) return ZONE_SPECS[2];
  if (distance < ZONE_3_RADIUS) return ZONE_SPECS[3];
  return ZONE_SPECS[4];
}

/**
 * Authoritative Compass Bearing Calculation:
 * Returns angle in radians and 8-wind directional string (N, NE, E, SE, S, SW, W, NW)
 * pointing toward harbor (4000, 4000) from vessel position (x, y).
 */
export function referenceCalcCompassBearing(fromX: number, fromY: number): {
  angle: number;
  bearingStr: string;
  isDocked: boolean;
} {
  const dx = HARBOR_CENTER_X - fromX;
  const dy = HARBOR_CENTER_Y - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    return { angle: 0, bearingStr: 'ANCHOR', isDocked: true };
  }

  const angle = Math.atan2(dy, dx);
  // Convert angle (-pi to pi) to 0 to 360 degrees (0 = East, 90 = South, 180 = West, 270 = North)
  // Compass bearing: North is 0, East is 90, South is 180, West is 270
  let deg = (angle * 180 / Math.PI) + 90;
  if (deg < 0) deg += 360;
  if (deg >= 360) deg -= 360;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return { angle, bearingStr: directions[index], isDocked: false };
}

/**
 * Metric distance formatting: e.g. 1450 -> "1,450m"
 */
export function referenceFormatMetricDistance(meters: number): string {
  const rounded = Math.round(meters);
  return `${rounded.toLocaleString('en-US')}m`;
}

/**
 * Smoothstep interpolation function: C1-continuous smoothstep.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface ReferenceAtmosphere {
  distance: number;
  zone: ZoneSpecification;
  darknessAlpha: number;
  fogDensity: number;
  lanternAmbientRadius: number;
  lanternBeamLength: number;
  vignetteRatio: number;
  rainIntensity: number;
  miasmaIntensity: number;
  waterColor: string;
}

/**
 * Authoritative Atmosphere calculation across 0 to 4800+ px.
 */
export function referenceCalcAtmosphere(dist: number): ReferenceAtmosphere {
  const zone = referenceResolveZone(dist);

  // Smooth interpolants
  // Darkness alpha: 0.82 at center -> 0.96 at abyss
  const darknessAlpha = 0.82 + 0.14 * smoothstep(0, 4000, dist);

  // Fog density: 0.12 at harbor -> 0.75 in trench
  const fogDensity = 0.12 + 0.63 * smoothstep(800, 3800, dist);

  // Boat lantern ambient radius: 150px at harbor -> 90px in trench
  const lanternAmbientRadius = 150 - 60 * smoothstep(1000, 3600, dist);

  // Boat lantern beam length: 490px at harbor -> 260px in trench
  const lanternBeamLength = 490 - 230 * smoothstep(1000, 3600, dist);

  // Vignette ratio: 0.35 at harbor (open) -> 0.18 in trench (oppressive)
  const vignetteRatio = 0.35 - 0.17 * smoothstep(1200, 3600, dist);

  // Zone 3 Rain: activates between 2400 and 3600
  const rainIntensity = smoothstep(2200, 2600, dist) * (1.0 - smoothstep(3600, 4200, dist));

  // Zone 4 Miasma: activates at 3400+
  const miasmaIntensity = smoothstep(3400, 4000, dist);

  // Water color gradient keyframes
  let waterColor: string;
  if (dist < 1200) {
    waterColor = '#0c221e'; // Murky calm slate green
  } else if (dist < 2400) {
    waterColor = '#081a24'; // Dark teal
  } else if (dist < 3600) {
    waterColor = '#040d1c'; // Abyssal slate/black
  } else {
    waterColor = '#02060e'; // Pitch black with cyan undertone
  }

  return {
    distance: dist,
    zone,
    darknessAlpha,
    fogDensity,
    lanternAmbientRadius,
    lanternBeamLength,
    vignetteRatio,
    rainIntensity,
    miasmaIntensity,
    waterColor
  };
}

// ---------------------------------------------------------------------------
// Headless Canvas & Mock Context2D
// ---------------------------------------------------------------------------

export class MockCanvasRenderingContext2D {
  public operations: { name: string; args: any[] }[] = [];
  public fillStyle: string | any = '#000000';
  public strokeStyle: string | any = '#000000';
  public lineWidth: number = 1;
  public globalAlpha: number = 1.0;
  public globalCompositeOperation: string = 'source-over';
  public font: string = '12px sans-serif';
  public textAlign: string = 'left';
  public textBaseline: string = 'alphabetic';
  public shadowBlur: number = 0;
  public shadowColor: string = 'transparent';

  private transformStack: any[] = [];

  public save(): void {
    this.operations.push({ name: 'save', args: [] });
    this.transformStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation
    });
  }

  public restore(): void {
    this.operations.push({ name: 'restore', args: [] });
    if (this.transformStack.length > 0) {
      const state = this.transformStack.pop();
      this.fillStyle = state.fillStyle;
      this.strokeStyle = state.strokeStyle;
      this.globalAlpha = state.globalAlpha;
      this.globalCompositeOperation = state.globalCompositeOperation;
    }
  }

  public translate(x: number, y: number): void {
    this.operations.push({ name: 'translate', args: [x, y] });
  }

  public rotate(angle: number): void {
    this.operations.push({ name: 'rotate', args: [angle] });
  }

  public scale(x: number, y: number): void {
    this.operations.push({ name: 'scale', args: [x, y] });
  }

  public setTransform(...args: any[]): void {
    this.operations.push({ name: 'setTransform', args });
  }

  public beginPath(): void {
    this.operations.push({ name: 'beginPath', args: [] });
  }

  public closePath(): void {
    this.operations.push({ name: 'closePath', args: [] });
  }

  public moveTo(x: number, y: number): void {
    this.operations.push({ name: 'moveTo', args: [x, y] });
  }

  public lineTo(x: number, y: number): void {
    this.operations.push({ name: 'lineTo', args: [x, y] });
  }

  public arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.operations.push({ name: 'arc', args: [x, y, radius, startAngle, endAngle, counterclockwise] });
  }

  public ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    this.operations.push({ name: 'ellipse', args: [x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise] });
  }

  public fill(): void {
    this.operations.push({ name: 'fill', args: [] });
  }

  public stroke(): void {
    this.operations.push({ name: 'stroke', args: [] });
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'fillRect', args: [x, y, w, h] });
  }

  public strokeRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'strokeRect', args: [x, y, w, h] });
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'clearRect', args: [x, y, w, h] });
  }

  public fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.operations.push({ name: 'fillText', args: [text, x, y, maxWidth] });
  }

  public strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.operations.push({ name: 'strokeText', args: [text, x, y, maxWidth] });
  }

  public measureText(text: string): { width: number } {
    return { width: text.length * 8 };
  }

  public drawImage(...args: any[]): void {
    this.operations.push({ name: 'drawImage', args });
  }

  public setLineDash(segments: number[]): void {
    this.operations.push({ name: 'setLineDash', args: [segments] });
  }

  public getLineDash(): number[] {
    return [];
  }

  public createLinearGradient(x0: number, y0: number, x1: number, y1: number): any {
    return {
      addColorStop: (offset: number, color: string) => {
        this.operations.push({ name: 'addColorStop', args: [offset, color] });
      }
    };
  }

  public createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): any {
    return {
      addColorStop: (offset: number, color: string) => {
        this.operations.push({ name: 'addColorStop', args: [offset, color] });
      }
    };
  }

  public countOperations(name: string): number {
    return this.operations.filter(op => op.name === name).length;
  }

  public hasOperation(name: string): boolean {
    return this.operations.some(op => op.name === name);
  }

  public reset(): void {
    this.operations = [];
  }
}

export class MockCanvas {
  public width: number;
  public height: number;
  public ctx: MockCanvasRenderingContext2D;

  constructor(width = 1280, height = 720) {
    this.width = width;
    this.height = height;
    this.ctx = new MockCanvasRenderingContext2D();
  }

  public getContext(contextId: string): any {
    if (contextId === '2d') return this.ctx;
    return null;
  }
}
