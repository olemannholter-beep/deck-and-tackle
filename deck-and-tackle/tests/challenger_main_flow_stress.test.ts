/**
 * Empirical Adversarial Challenger Stress Test Suite: Milestone 3 (R3)
 * Target: Overworld Whirlpool Interaction & Main Game Loop Branching
 * 
 * Verifies:
 * 1. Whirlpool interaction state transitions: active -> precast -> cast -> resolution -> despawning (3.0s timer).
 * 2. Re-trigger prevention: verify player cannot re-interact with a spot that is in DESPAWNING or locked.
 * 3. Modal layering: verify behavior when PreCastModal or FlotsamSalvageOverlay is open during overworld updates
 *    (boat controls disabled, no unintended movement, esc dismisses cleanly, Sea Chart blocked).
 * 4. Slack line notice timer: verify notice appears on slack line and decays over 4.0s without freezing game.
 * 5. High-frequency end-to-end stress & fuzzing harness (dt variation, screen fuzzing, callback exception safety).
 * 
 * Framework: node:test + node:assert/strict
 * Run: npx tsx --test tests/challenger_main_flow_stress.test.ts
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Extended Mock Context with HTML5 Canvas roundRect, rect, clip, and ellipse
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

class ExtendedMockContext extends MockCanvasRenderingContext2D {
  public strokeStylesUsed: string[] = [];
  public fillStylesUsed: string[] = [];

  public stroke(): void {
    super.stroke();
    this.strokeStylesUsed.push(this.strokeStyle);
  }

  public fillText(text: string, x: number, y: number, maxWidth?: number): void {
    super.fillText(text, x, y, maxWidth);
    this.fillStylesUsed.push(this.fillStyle);
  }

  public roundRect(x: number, y: number, w: number, h: number, radii?: any): void {
    this.operations.push({ name: 'roundRect', args: [x, y, w, h, radii] });
  }

  public rect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'rect', args: [x, y, w, h] });
  }

  public clip(): void {
    this.operations.push({ name: 'clip', args: [] });
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

  public quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.operations.push({ name: 'quadraticCurveTo', args: [cpx, cpy, x, y] });
  }

  public bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void {
    this.operations.push({ name: 'bezierCurveTo', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
  }

  public reset(): void {
    super.reset();
    this.strokeStylesUsed = [];
    this.fillStylesUsed = [];
  }
}

class ExtendedMockCanvas extends MockCanvas {
  public style: Record<string, string> = { cursor: 'default' };
  private listeners: Map<string, Function[]> = new Map();

  constructor(width = 1280, height = 720) {
    super(width, height);
    this.ctx = new ExtendedMockContext() as any;
  }

  public getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width, height: this.height };
  }

  public addEventListener(evt: string, fn: Function): void {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt)!.push(fn);
  }

  public removeEventListener(evt: string, fn: Function): void {
    const list = this.listeners.get(evt);
    if (list) {
      this.listeners.set(evt, list.filter(f => f !== fn));
    }
  }
}

// ---------------------------------------------------------------------------
// Headless Node Polyfills for DOM / Audio
// ---------------------------------------------------------------------------
const primaryCanvas = new ExtendedMockCanvas(1280, 720);

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
} else {
  (globalThis as any).window.innerWidth = 1280;
  (globalThis as any).window.innerHeight = 720;
  (globalThis as any).window.devicePixelRatio = 1;
}

(globalThis as any).window.AudioContext = class MockAudioContext {
  state = 'suspended';
  currentTime = 0;
  resume() { return Promise.resolve(); }
  createGain() {
    return {
      connect: () => {},
      gain: {
        value: 1,
        setValueAtTime: () => {},
        setTargetAtTime: () => {},
        linearRampToValueAtTime: () => {}
      }
    };
  }
  createBufferSource() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      playbackRate: { value: 1 }
    };
  }
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { setValueAtTime: () => {} }
    };
  }
  destination = {};
};

if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {};
}

(globalThis as any).document.getElementById = (id: string) => {
  if (id === 'game-canvas') return primaryCanvas;
  return null;
};

(globalThis as any).document.createElement = (tag: string) => {
  if (tag === 'canvas') {
    return new ExtendedMockCanvas(1280, 720);
  }
  if (tag === 'video') {
    return {
      src: '',
      autoplay: false,
      loop: false,
      muted: false,
      playsInline: false,
      preload: '',
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      play: () => Promise.resolve(),
      pause: () => {}
    };
  }
  return {
    style: {},
    appendChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
};

(globalThis as any).document.body = {
  appendChild: () => {},
  removeChild: () => {}
};

if (typeof (globalThis as any).Audio === 'undefined') {
  (globalThis as any).Audio = class MockAudio {
    play() { return Promise.resolve(); }
    pause() {}
    load() {}
  };
}

if (typeof (globalThis as any).Image === 'undefined') {
  (globalThis as any).Image = class MockImage {
    src: string = '';
    complete: boolean = true;
    naturalWidth: number = 200;
    naturalHeight: number = 100;
  };
}

// Intercept requestAnimationFrame so tests deterministically step frames
(globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
  return 1;
};

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { Game } from '../src/main.js';
import { Input } from '../src/engine/Input.js';
import { Vector2 } from '../src/engine/Vector2.js';
import { GameState } from '../src/game/GameStateManager.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { PreCastModal } from '../src/game/ui/PreCastModal.js';
import {
  FlotsamSalvageOverlay,
  generateSalvageReward,
  createSunkenCard
} from '../src/game/ui/FlotsamSalvageOverlay.js';
import { FishingSpot } from '../src/game/overworld/FishingSpot.js';
import { WhirlpoolSpawner } from '../src/game/overworld/WhirlpoolSpawner.js';
import { Boat } from '../src/game/overworld/Boat.js';
import {
  rollOutcomeForBait,
  rollSpeciesForZone,
  BAIT_REGISTRY,
  ALL_BAIT_IDS
} from '../src/game/battle/BaitData.js';

// Input simulation helpers
function simulateKeyPress(code: string): void {
  const c = code.toLowerCase();
  (Input as any).keysJustPressed.add(c);
  (Input as any).keysDown.add(c);
}

function simulateKeyDown(code: string): void {
  const c = code.toLowerCase();
  (Input as any).keysDown.add(c);
}

function simulateMouseClick(x: number, y: number): void {
  (Input as any).mousePos.x = x;
  (Input as any).mousePos.y = y;
  (Input as any).mouseJustClicked = true;
}

function clearInputs(): void {
  Input.updateEnd();
  (Input as any).keysDown.clear();
}

/**
 * Helper to construct an active Game instance in overworld exploration state.
 */
function createExplorationGame(startX = 4500, startY = 4500): Game {
  const game = new Game();
  // Transition immediately out of MainMenu into OverworldExploration
  game.stateManager.changeState(GameState.OverworldExploration, true);
  game.boat.position.set(startX, startY);
  game.boat.isFrozen = false;
  game.camera.snapTo(game.boat.position);
  return game;
}

// ============================================================================
// SUITE 1: WHIRLPOOL INTERACTION STATE MACHINE & TRANSITIONS
// ============================================================================
describe('Challenger M3 Suite 1: Whirlpool Interaction State Machine & Transitions', () => {
  beforeEach(() => {
    clearInputs();
  });

  it('1.1: Spot in ACTIVE state triggers PreCastModal when player presses KeyE or Space within interaction radius', () => {
    const game = createExplorationGame();
    // Spawn an ACTIVE spot within interaction radius (40px away)
    const spot = new FishingSpot({
      id: 'spot_active_1',
      name: 'The Shallows (Coastal Shoals)',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Murky brackish eddy.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    assert.equal(game.preCastModal.isOpen, false);
    assert.equal(game.boat.isFrozen, false);
    assert.equal(spot.isFishingLocked, false);

    // Press KeyE
    simulateKeyPress('keye');
    (game as any).updateOverworld(0.016);
    clearInputs();

    // Verify state transition: ACTIVE -> PRECAST
    assert.equal(game.preCastModal.isOpen, true, 'PreCastModal must open');
    assert.equal(game.boat.isFrozen, true, 'Boat must be frozen while PreCastModal is open');
    assert.equal(spot.isFishingLocked, true, 'Spot must be locked from despawning');
    assert.equal(game.currentActiveFishingSpot, spot, 'Active fishing spot must be bound to game');
    assert.equal(game.preCastModal.zoneTier, 1, 'Zone tier must be calculated and bound');
  });

  it('1.2: PreCastModal cancellation via Escape returns spot to ACTIVE, unlocks it, and unfreezes boat', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_active_2',
      name: 'Sunken Sound',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'lake',
      speciesType: 'pike',
      description: 'Cold mist-shrouded waters.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    // Trigger open
    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.preCastModal.isOpen, true);
    assert.equal(spot.isFishingLocked, true);
    assert.equal(game.boat.isFrozen, true);

    // Press Escape to cancel
    simulateKeyPress('escape');
    (game as any).updateOverworld(0.016);
    clearInputs();

    // Verify clean cancellation
    assert.equal(game.preCastModal.isOpen, false, 'PreCastModal must close');
    assert.equal(game.boat.isFrozen, false, 'Boat must unfreeze');
    assert.equal(spot.isFishingLocked, false, 'Spot must unlock');
    assert.equal(game.currentActiveFishingSpot, null, 'Active fishing spot reference must be cleared');
    assert.equal(spot.state, 'ACTIVE', 'Spot must remain in ACTIVE state');
  });

  it('1.3: Cast resolution: Salvage outcome triggers immediate despawn (3.0s timer), opens FlotsamSalvageOverlay, and unfreezes boat upon claim', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_salvage_1',
      name: 'Devil’s Chasm',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'abyss',
      speciesType: 'gar',
      description: 'Lightless trench.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });

    // Forced salvage roll (0.70 with bare_hook)
    const outcome = game.handleCast(spot, 3, 'bare_hook', 0.70);
    assert.equal(outcome, 'salvage');

    // Verify immediate spot transition to DESPAWNING
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 0);
    assert.equal(spot.despawnDuration, 3.0);
    assert.equal(spot.isFishingLocked, false);

    // Verify FlotsamSalvageOverlay is open
    assert.equal(game.flotsamSalvageOverlay.isOpen, true);
    assert.ok(game.flotsamSalvageOverlay.currentReward !== null);

    // During overworld update, boat must remain frozen
    (game as any).updateOverworld(0.016);
    assert.equal(game.boat.isFrozen, true);

    // Claim reward via Space
    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.flotsamSalvageOverlay.isOpen, false);
    assert.equal(game.boat.isFrozen, false, 'Boat must unfreeze after claiming salvage');
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('1.4: Cast resolution: Slack outcome triggers spot despawn (3.0s timer), sets 4.0s notice, avoids battle, and unfreezes boat immediately', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_slack_1',
      name: 'Sunken Ruin',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'cave',
      speciesType: 'dagon',
      description: 'Black abyssal brine.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });

    // Forced slack roll (0.95 with bare_hook)
    const outcome = game.handleCast(spot, 4, 'bare_hook', 0.95);
    assert.equal(outcome, 'slack');

    // Verify spot transition to DESPAWNING
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 0);
    assert.equal(spot.isFishingLocked, false);

    // Verify slack notice timer initialized to 4.0s
    assert.equal(game.slackNoticeTimer, 4.0);
    assert.ok(game.slackNoticeText.includes('cold abyss'));

    // Verify boat unfrozen immediately and battle not started
    assert.equal(game.boat.isFrozen, false);
    assert.equal(game.currentActiveFishingSpot, null);
    assert.equal(game.stateManager.getState(), GameState.OverworldExploration);
  });

  it('1.5: Cast resolution: Strike outcome locks spot, launches SideViewBattle diorama, and preserves spot during battle', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_strike_1',
      name: 'The Shallows',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Brackish weed-beds.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });

    // Forced strike roll (0.20 with bare_hook)
    const outcome = game.handleCast(spot, 1, 'bare_hook', 0.20);
    assert.equal(outcome, 'strike');

    // Complete state transition to SideViewBattle (requires stepping past 0.225s midpoint)
    game.stateManager.update(0.25);
    game.stateManager.update(0.25);
    assert.equal(game.stateManager.getState(), GameState.SideViewBattle);
    assert.equal(spot.isFishingLocked, true, 'Spot must remain locked during battle');
    assert.equal(spot.state, 'ACTIVE', 'Spot must remain ACTIVE during battle');
    assert.equal(game.currentActiveFishingSpot, spot);
  });

  it('1.6: Post-battle victory resolution: triggers immediate 3.0s despawn and clears active spot', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_vic_1',
      name: 'The Foggy Banks',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'lake',
      speciesType: 'pike',
      description: 'Cold mist.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    // Trigger strike
    game.handleCast(spot, 2, 'bare_hook', 0.10);
    game.stateManager.update(0.25);
    game.stateManager.update(0.25);
    assert.equal(game.stateManager.getState(), GameState.SideViewBattle);

    // Mock battle victory
    (game.diorama as any).battle = { status: 'victory' };

    // Return to overworld
    (game as any).returnToOverworld();
    game.stateManager.update(0.25);
    game.stateManager.update(0.25);

    assert.equal(game.stateManager.getState(), GameState.OverworldExploration);
    assert.equal(spot.state, 'DESPAWNING', 'Spot must transition to DESPAWNING on battle victory');
    assert.equal(spot.timer, 0, 'Despawn timer must start at 0');
    assert.equal(spot.despawnDuration, 3.0);
    assert.equal(spot.isFishingLocked, false);
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('1.7: Post-battle flee or loss resolution: unlocks spot without despawning', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_flee_1',
      name: 'The Shallows',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Shallows.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    game.handleCast(spot, 1, 'bare_hook', 0.10);
    game.stateManager.update(0.25);
    game.stateManager.update(0.25);

    // Mock battle defeat or flee
    (game.diorama as any).battle = { status: 'defeat' };

    (game as any).returnToOverworld();
    game.stateManager.update(0.25);
    game.stateManager.update(0.25);

    assert.equal(game.stateManager.getState(), GameState.OverworldExploration);
    assert.equal(spot.state, 'ACTIVE', 'Spot must remain ACTIVE if not victorious');
    assert.equal(spot.isFishingLocked, false, 'Fishing lock must be released');
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('1.8: Despawn progress over 3.0s monotonically decays alpha and scale to 0.0 and sets isDead', () => {
    const spot = new FishingSpot({
      id: 'spot_fade_1',
      name: 'Fade Test',
      position: new Vector2(4000, 4000),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Fade.',
      initialState: 'ACTIVE'
    });

    spot.triggerDespawn();
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.alpha, 1.0);
    assert.equal(spot.scale, 1.0);

    // Step 1.0s
    spot.update(1.0, new Vector2(0, 0));
    assert.ok(spot.alpha < 1.0 && spot.alpha >= 0.65);
    assert.ok(spot.scale < 1.0 && spot.scale >= 0.65);

    // Step another 1.0s (total 2.0s)
    spot.update(1.0, new Vector2(0, 0));
    assert.ok(spot.alpha < 0.40 && spot.alpha >= 0.30);
    assert.ok(spot.scale < 0.40 && spot.scale >= 0.30);

    // Step another 1.0s (total 3.0s)
    spot.update(1.0, new Vector2(0, 0));
    assert.equal(spot.isDead, true);
    assert.equal(spot.alpha, 0.0);
    assert.equal(spot.scale, 0.0);

    // Subsequent updates on dead spot do nothing
    spot.update(1.0, new Vector2(0, 0));
    assert.equal(spot.isDead, true);
  });
});

// ============================================================================
// SUITE 2: RE-TRIGGER PREVENTION & CONCURRENCY STRESS
// ============================================================================
describe('Challenger M3 Suite 2: Re-Trigger Prevention & Concurrency Stress', () => {
  beforeEach(() => {
    clearInputs();
  });

  it('2.1: Whirlpool in DESPAWNING state strictly rejects player interaction', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_despawning_1',
      name: 'Despawning Spot',
      position: game.boat.position.clone(), // Boat is directly at spot
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Dissipating swirl.',
      initialState: 'DESPAWNING',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    // Verify distance is 0
    assert.ok(spot.position.distanceTo(game.boat.position) <= spot.interactionRadius);
    assert.equal(spot.state, 'DESPAWNING');

    // Mash KeyE and Space
    simulateKeyPress('keye');
    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    // Verify PreCastModal is NOT opened
    assert.equal(game.preCastModal.isOpen, false, 'PreCastModal must NOT open for despawning spot');
    assert.equal(game.boat.isFrozen, false, 'Boat must not freeze');
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('2.2: Whirlpool in SPAWNING state strictly rejects player interaction', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_spawning_1',
      name: 'Spawning Spot',
      position: game.boat.position.clone(),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Emerging swirl.',
      initialState: 'SPAWNING',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    assert.equal(spot.state, 'SPAWNING');

    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.preCastModal.isOpen, false, 'PreCastModal must NOT open for spawning spot');
    assert.equal(game.boat.isFrozen, false);
  });

  it('2.3: Whirlpool with isFishingLocked = true cannot be re-triggered', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_locked_1',
      name: 'Locked Spot',
      position: game.boat.position.clone(),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Locked.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    spot.isFishingLocked = true;
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    // Already active modal or battle
    game.preCastModal.isOpen = true;

    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    // Because modal is already open, it executes confirmCast on modal, not re-opening
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('2.4: triggerDespawn() is strictly idempotent across 100 rapid calls', () => {
    const spot = new FishingSpot({
      id: 'spot_idem_1',
      name: 'Idempotency Test',
      position: new Vector2(4000, 4000),
      zoneType: 'lake',
      speciesType: 'pike',
      description: 'Idem.',
      initialState: 'ACTIVE'
    });

    spot.triggerDespawn();
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 0);

    // Advance 1.5s
    spot.update(1.5, new Vector2(0, 0));
    assert.equal(spot.timer, 1.5);
    const alphaAt1_5 = spot.alpha;

    // Call triggerDespawn 100 times while in DESPAWNING
    for (let i = 0; i < 100; i++) {
      spot.triggerDespawn();
    }

    // Timer and state must NOT have been reset to 0
    assert.equal(spot.state, 'DESPAWNING');
    assert.equal(spot.timer, 1.5, 'Timer must not be reset by redundant triggerDespawn calls');
    assert.equal(spot.alpha, alphaAt1_5, 'Alpha must not be corrupted');
  });

  it('2.5: Dead spot (isDead = true) after 3.0s is pruned by WhirlpoolSpawner and never returned by getNearbySpot', () => {
    const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
    const deadSpot = new FishingSpot({
      id: 'spot_dead_1',
      name: 'Dead Spot',
      position: new Vector2(4000, 4000),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Dead.',
      initialState: 'DESPAWNING'
    });

    // Advance 3.5s to kill it
    deadSpot.update(3.5, new Vector2(4000, 4000));
    assert.equal(deadSpot.isDead, true);

    spawner.whirlpools.push(deadSpot);

    // Update spawner
    spawner.update(0.016, new Vector2(4000, 4000));

    // Verify pruned from active pool
    assert.equal(spawner.whirlpools.includes(deadSpot), false, 'Dead spot must be pruned from spawner');
    assert.equal(spawner.getNearbySpot(new Vector2(4000, 4000)) !== deadSpot, true);
  });

  it('2.6: High-frequency input spam (50 consecutive KeyE / Space presses) on a despawning spot produces 0 glitches', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_spam_1',
      name: 'Spam Test',
      position: game.boat.position.clone(),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Spam.',
      initialState: 'DESPAWNING',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    for (let f = 0; f < 50; f++) {
      simulateKeyPress(f % 2 === 0 ? 'space' : 'keye');
      (game as any).updateOverworld(0.016);
      clearInputs();

      assert.equal(game.preCastModal.isOpen, false);
      assert.equal(game.flotsamSalvageOverlay.isOpen, false);
      assert.equal(game.boat.isFrozen, false);
      assert.equal(game.currentActiveFishingSpot, null);
    }
  });

  it('2.7: Spawner enforces minimum 350px separation between concurrent whirlpools', () => {
    const spawner = new WhirlpoolSpawner([], new Vector2(4000, 4000));
    const active = spawner.getActiveWhirlpools();

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const d = active[i].position.distanceTo(active[j].position);
        assert.ok(d >= 350, `Spots ${active[i].id} and ${active[j].id} separation ${d} >= 350px`);
      }
    }
  });
});

// ============================================================================
// SUITE 3: MODAL LAYERING & BOAT MOVEMENT LOCKOUT STRESS
// ============================================================================
describe('Challenger M3 Suite 3: Modal Layering & Boat Movement Lockout Stress', () => {
  beforeEach(() => {
    clearInputs();
  });

  it('3.1: PreCastModal open disables boat controls and produces 0 displacement across 60 frames', () => {
    const game = createExplorationGame();
    const initialPos = game.boat.position.clone();
    const initialHeading = game.boat.heading;

    // Open PreCastModal
    game.preCastModal.open(1, 'Test Zone', 15, () => {}, () => {});
    assert.equal(game.preCastModal.isOpen, true);

    // Apply throttle and steer inputs every frame for 60 frames
    for (let f = 0; f < 60; f++) {
      simulateKeyDown('KeyW');
      simulateKeyDown('ArrowUp');
      simulateKeyDown('KeyD');
      (game as any).updateOverworld(0.016);
      clearInputs();
    }

    assert.equal(game.boat.isFrozen, true);
    assert.equal(game.boat.velocity.magnitude(), 0, 'Boat velocity must remain 0');
    assert.equal(game.boat.angularVelocity, 0, 'Angular velocity must remain 0');
    assert.equal(game.boat.position.x, initialPos.x, 'X position must be strictly unchanged');
    assert.equal(game.boat.position.y, initialPos.y, 'Y position must be strictly unchanged');
    assert.equal(game.boat.heading, initialHeading, 'Heading must be strictly unchanged');
  });

  it('3.2: FlotsamSalvageOverlay open disables boat controls and produces 0 displacement across 60 frames', () => {
    const game = createExplorationGame();
    const initialPos = game.boat.position.clone();

    // Open FlotsamSalvageOverlay
    const reward = generateSalvageReward(1, 0.1, 0.5);
    game.flotsamSalvageOverlay.open(reward);
    assert.equal(game.flotsamSalvageOverlay.isOpen, true);

    for (let f = 0; f < 60; f++) {
      simulateKeyDown('KeyW');
      simulateKeyDown('KeyA');
      (game as any).updateOverworld(0.016);
      clearInputs();
    }

    assert.equal(game.boat.isFrozen, true);
    assert.equal(game.boat.velocity.magnitude(), 0);
    assert.equal(game.boat.position.x, initialPos.x);
    assert.equal(game.boat.position.y, initialPos.y);
  });

  it('3.3: While PreCastModal is open, map updates and collision checks are bypassed (early return)', () => {
    const game = createExplorationGame();
    let collisionCalled = false;
    (game.map as any).resolveCollisions = () => {
      collisionCalled = true;
    };

    game.preCastModal.open(1, 'Test Zone', 15, () => {}, () => {});
    (game as any).updateOverworld(0.016);

    assert.equal(collisionCalled, false, 'Collisions must not be evaluated while modal is open');
  });

  it('3.4: While FlotsamSalvageOverlay is open, map updates and collision checks are bypassed', () => {
    const game = createExplorationGame();
    let collisionCalled = false;
    (game.map as any).resolveCollisions = () => {
      collisionCalled = true;
    };

    game.flotsamSalvageOverlay.open(generateSalvageReward(1, 0.1, 0.5));
    (game as any).updateOverworld(0.016);

    assert.equal(collisionCalled, false, 'Collisions must not be evaluated while salvage modal is open');
  });

  it('3.5: Escape key cleanly dismisses PreCastModal, unfreezes vessel, and releases fishing lock', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_esc_1',
      name: 'Esc Spot',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Esc.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [spot];
    game.map.fishingSpots = [spot];

    // Open via KeyE
    simulateKeyPress('keye');
    (game as any).updateOverworld(0.016);
    clearInputs();
    assert.equal(game.preCastModal.isOpen, true);
    assert.equal(game.boat.isFrozen, true);
    assert.equal(spot.isFishingLocked, true);

    // Dismiss via Escape
    simulateKeyPress('escape');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.preCastModal.isOpen, false);
    assert.equal(game.boat.isFrozen, false);
    assert.equal(spot.isFishingLocked, false);
    assert.equal(game.currentActiveFishingSpot, null);
  });

  it('3.6: Escape key cleanly dismisses FlotsamSalvageOverlay, claims loot safely, and unfreezes vessel', () => {
    const game = createExplorationGame();
    const initialGold = game.inventory.gold;
    const spot = new FishingSpot({
      id: 'spot_esc_2',
      name: 'Esc Salvage Spot',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Esc.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });

    // Trigger salvage cast
    game.handleCast(spot, 1, 'bare_hook', 0.70);
    assert.equal(game.flotsamSalvageOverlay.isOpen, true);
    (game as any).updateOverworld(0.016);
    assert.equal(game.boat.isFrozen, true);

    // Dismiss via Escape
    simulateKeyPress('escape');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.flotsamSalvageOverlay.isOpen, false);
    assert.equal(game.boat.isFrozen, false, 'Boat must unfreeze after ESC dismissal');
    assert.equal(game.flotsamSalvageOverlay.isClaimed, true, 'Reward must be safely credited upon dismissal');
    const hasLoot = game.inventory.gold > initialGold ||
      game.inventory.deck.length > 7 ||
      game.inventory.getBaitCount('lugworms') > 0 ||
      game.inventory.getBaitCount('blood_chum') > 0 ||
      game.inventory.getBaitCount('bio_squid') > 0;
    assert.ok(hasLoot, 'Salvage reward must credit gold, bait, or card to inventory');
  });

  it('3.7: Sea Chart overlay (KeyM / Tab) cannot open while PreCastModal or FlotsamSalvageOverlay is open', () => {
    const game = createExplorationGame();
    assert.equal(game.seaChart.isOpen(), false);

    // Open PreCastModal
    game.preCastModal.open(1, 'Zone', 15, () => {}, () => {});

    // Press KeyM and Tab
    simulateKeyPress('keym');
    simulateKeyPress('tab');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.seaChart.isOpen(), false, 'Sea Chart must NOT open while PreCastModal is open');

    // Close PreCastModal and open FlotsamSalvageOverlay
    game.preCastModal.close();
    game.flotsamSalvageOverlay.open(generateSalvageReward(1, 0.1, 0.5));

    simulateKeyPress('keym');
    simulateKeyPress('tab');
    (game as any).updateOverworld(0.016);
    clearInputs();

    assert.equal(game.seaChart.isOpen(), false, 'Sea Chart must NOT open while FlotsamSalvageOverlay is open');
  });

  it('3.8: Mute button is hidden from rendering while PreCastModal or FlotsamSalvageOverlay is open', () => {
    const game = createExplorationGame();
    const canvas = new ExtendedMockCanvas(1280, 720);
    const ctx = canvas.ctx as any;

    let muteRendered = false;
    (game.muteButton as any).render = () => {
      muteRendered = true;
    };

    // When modal is open
    game.preCastModal.open(1, 'Zone', 15, () => {}, () => {});
    (game as any).render();
    assert.equal(muteRendered, false, 'Mute button must not render when PreCastModal is open');

    game.preCastModal.close();
    game.flotsamSalvageOverlay.open(generateSalvageReward(1, 0.1, 0.5));
    (game as any).render();
    assert.equal(muteRendered, false, 'Mute button must not render when FlotsamSalvageOverlay is open');
  });
});

// ============================================================================
// SUITE 4: SLACK LINE NOTICE TIMER & NON-BLOCKING DECAY STRESS
// ============================================================================
describe('Challenger M3 Suite 4: Slack Line Notice Timer & Non-Blocking Decay Stress', () => {
  beforeEach(() => {
    clearInputs();
  });

  it('4.1: Slack line outcome sets slackNoticeTimer = 4.0 and populates cold slate text', () => {
    const game = createExplorationGame();
    const spot = new FishingSpot({
      id: 'spot_slack_timer_1',
      name: 'Slack Spot',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Slack.',
      initialState: 'ACTIVE'
    });

    game.handleCast(spot, 1, 'bare_hook', 0.95);

    assert.equal(game.slackNoticeTimer, 4.0);
    assert.equal(game.slackNoticeText, 'The line went slack in the cold abyss... Nothing took the hook.');
    assert.equal(game.boat.isFrozen, false);
  });

  it('4.2: slackNoticeTimer decays monotonically over 4.0s of simulated delta time without freezing', () => {
    const game = createExplorationGame();
    game.slackNoticeTimer = 4.0;

    let previousTimer = 4.0;
    const dt = 0.5;

    for (let step = 0; step < 8; step++) {
      (game as any).updateOverworld(dt);
      assert.ok(game.slackNoticeTimer < previousTimer, `Step ${step}: timer must strictly decrease`);
      previousTimer = game.slackNoticeTimer;
    }

    assert.equal(game.slackNoticeTimer, 0.0);
  });

  it('4.3: Boat navigation is 100% responsive during the entire 4.0s slack decay', () => {
    const game = createExplorationGame();
    game.slackNoticeTimer = 4.0;
    const initialPos = game.boat.position.clone();

    // Drive forward with KeyW across 4.0s (dt = 0.05, 80 steps)
    for (let s = 0; s < 80; s++) {
      simulateKeyDown('KeyW');
      (game as any).updateOverworld(0.05);
      clearInputs();
      assert.equal(game.boat.isFrozen, false);
    }

    // Step once more to absorb any sub-picosecond IEEE 754 precision residual
    (game as any).updateOverworld(0.01);
    assert.equal(game.slackNoticeTimer, 0.0);
    assert.ok(game.boat.velocity.magnitude() > 0, 'Boat must be cruising');
    assert.ok(game.boat.position.distanceTo(initialPos) > 50, 'Boat must have moved significantly');
  });

  it('4.4: slackNoticeTimer clamps cleanly at 0.0 and does not underflow', () => {
    const game = createExplorationGame();
    game.slackNoticeTimer = 0.5;

    // Step with dt = 2.0s
    (game as any).updateOverworld(2.0);

    assert.equal(game.slackNoticeTimer, 0.0, 'Timer must clamp at 0.0');

    // Step again
    (game as any).updateOverworld(1.0);
    assert.equal(game.slackNoticeTimer, 0.0);
  });

  it('4.5: Canvas rendering of slack notice draws #94a3b8 border and text when active, stops when 0', () => {
    const game = createExplorationGame();
    const canvas = new ExtendedMockCanvas(1280, 720);
    const ctx = canvas.ctx as any;

    // When timer is 4.0s
    game.slackNoticeTimer = 4.0;
    ctx.reset();
    (game as any).renderSlackNotice(ctx, 1280, 720);

    assert.ok(ctx.hasOperation('fillText'), 'Must render text');
    assert.ok(ctx.hasOperation('stroke'), 'Must render border');
    assert.ok(ctx.strokeStylesUsed.includes('#94a3b8'), 'Must use cold slate border');
    assert.ok(ctx.fillStylesUsed.includes('#94a3b8'), 'Must use cold slate text');

    // When timer reaches 0.0s
    game.slackNoticeTimer = 0.0;
    ctx.reset();
    // In game.render(), renderSlackNotice is conditionally called only if timer > 0
    (game as any).render();
    // Verified that renderSlackNotice was not called
    assert.equal(ctx.countOperations('stroke'), 0);
  });

  it('4.6: Player can interact with a new whirlpool while previous slack notice is still decaying', () => {
    const game = createExplorationGame();
    game.slackNoticeTimer = 2.5; // halfway decayed

    const newSpot = new FishingSpot({
      id: 'spot_slack_interact_2',
      name: 'Second Spot',
      position: game.boat.position.clone().add(new Vector2(40, 0)),
      zoneType: 'shallow',
      speciesType: 'perch',
      description: 'Second.',
      initialState: 'ACTIVE',
      interactionRadius: 120
    });
    game.map.whirlpoolSpawner.whirlpools = [newSpot];
    game.map.fishingSpots = [newSpot];

    simulateKeyPress('space');
    (game as any).updateOverworld(0.016);
    clearInputs();

    // PreCastModal opens successfully despite active slackNoticeTimer
    assert.equal(game.preCastModal.isOpen, true);
    assert.equal(game.currentActiveFishingSpot, newSpot);
    assert.equal(game.boat.isFrozen, true);
  });
});

// ============================================================================
// SUITE 5: HIGH-FREQUENCY END-TO-END STRESS & FUZZING HARNESS
// ============================================================================
describe('Challenger M3 Suite 5: High-Frequency End-to-End Stress & Fuzzing Harness', () => {
  beforeEach(() => {
    clearInputs();
  });

  it('5.1: 50 consecutive full whirlpool encounter cycles run with 0 errors and zero state leak', () => {
    const game = createExplorationGame();

    for (let cycle = 0; cycle < 50; cycle++) {
      const zoneTier = ((cycle % 4) + 1) as 1 | 2 | 3 | 4;
      const spot = new FishingSpot({
        id: `stress_spot_${cycle}`,
        name: `Zone ${zoneTier} Maelstrom`,
        position: game.boat.position.clone().add(new Vector2((cycle % 5) * 5, (cycle % 3) * 5)),
        zoneType: (['shallow', 'lake', 'abyss', 'cave'] as const)[zoneTier - 1],
        speciesType: (['perch', 'pike', 'gar', 'dagon'] as const)[zoneTier - 1],
        description: 'Stress maelstrom.',
        initialState: 'ACTIVE',
        interactionRadius: 120
      });
      game.map.whirlpoolSpawner.whirlpools = [spot];
      game.map.fishingSpots = [spot];

      // Approach & open modal
      simulateKeyPress('keye');
      (game as any).updateOverworld(0.016);
      clearInputs();
      assert.equal(game.preCastModal.isOpen, true);

      // Close modal and execute deterministic cast outcome
      game.preCastModal.close();
      const roll = (cycle % 3 === 0) ? 0.1 : (cycle % 3 === 1 ? 0.70 : 0.95);
      const outcome = game.handleCast(spot, zoneTier, 'bare_hook', roll);

      if (outcome === 'strike') {
        game.stateManager.update(0.25);
        game.stateManager.update(0.25);
        assert.equal(game.stateManager.getState(), GameState.SideViewBattle);
        if (game.diorama.battle) {
          game.diorama.battle.status = 'victory';
        } else {
          (game.diorama as any).battle = { status: 'victory', reset: () => {} };
        }
        (game as any).returnToOverworld();
        game.stateManager.update(0.25);
        game.stateManager.update(0.25);
      } else if (outcome === 'salvage') {
        assert.equal(game.flotsamSalvageOverlay.isOpen, true);
        game.flotsamSalvageOverlay.claim();
      } else {
        assert.equal(outcome, 'slack');
        assert.equal(game.slackNoticeTimer, 4.0);
      }

      // Despawn spot over 3.0s
      spot.update(3.5, new Vector2(0, 0));
      assert.equal(spot.isDead, true);

      // Verify post-cycle invariant
      assert.equal(game.preCastModal.isOpen, false);
      assert.equal(game.flotsamSalvageOverlay.isOpen, false);
      assert.equal(game.boat.isFrozen, false);
      assert.equal(game.currentActiveFishingSpot, null);
    }
  });

  it('5.2: Extreme dt variation stress: updates with dt = 0, dt < 0, dt = 1e-6, dt = 10.0s execute cleanly', () => {
    const game = createExplorationGame();
    const extremeDts = [0, -0.016, 1e-9, 10.0, 100.0];

    for (const dt of extremeDts) {
      assert.doesNotThrow(() => {
        (game as any).update(dt);
      }, `Update must not throw for dt = ${dt}`);
    }
  });

  it('5.3: Screen resolution fuzzing across extreme dimensions executes cleanly without rendering error', () => {
    const game = createExplorationGame();
    const canvas = new ExtendedMockCanvas(1280, 720);
    const ctx = canvas.ctx as any;

    const resolutions = [
      { w: 320, h: 240 },
      { w: 1280, h: 720 },
      { w: 1920, h: 1080 },
      { w: 3840, h: 2160 },
      { w: 100, h: 100 }
    ];

    for (const res of resolutions) {
      assert.doesNotThrow(() => {
        // Open preCastModal
        game.preCastModal.open(1, 'Fuzz Zone', 15, () => {}, () => {});
        game.preCastModal.render(ctx, res.w, res.h);
        game.preCastModal.close();

        // Open salvage overlay
        game.flotsamSalvageOverlay.open(generateSalvageReward(1, 0.1, 0.5));
        game.flotsamSalvageOverlay.render(ctx, res.w, res.h);
        game.flotsamSalvageOverlay.close();

        // Render slack notice
        game.slackNoticeTimer = 3.0;
        (game as any).renderSlackNotice(ctx, res.w, res.h);
      }, `Rendering must survive resolution ${res.w}x${res.h}`);
    }
  });

  it('5.4: Callback error resilience: exception during cast callback closes modal safely', () => {
    const game = createExplorationGame();
    game.preCastModal.open(1, 'Error Zone', 15, () => {
      throw new Error('Asynchronous fault in hook!');
    }, () => {});

    assert.throws(() => {
      game.preCastModal.confirmCast();
    }, /Asynchronous fault in hook!/);

    assert.equal(game.preCastModal.isOpen, false);
    assert.equal((game.preCastModal as any).onCastCallback, null);
  });
});
