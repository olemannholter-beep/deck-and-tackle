/**
 * Adversarial Challenger Stress Test Suite: Milestone 2
 * Focus: PreCastModal and HarborShopOverlay Canvas 2D integration
 * 
 * Tests:
 * 1. PreCastModal Lifecycle & Parameter Boundary Fuzzing (tiers 1-4, 0, 5, -1, 999, extreme names/depths)
 * 2. Bait Cycling & Selection Boundary Stress (Bare Hook only, sparse inventory, all 5, out-of-stock rejection)
 * 3. High-Frequency Key Event Simulation & Rapid Input Burst (1..5, Space, Enter, Escape, Arrow keys, invalid keys)
 * 4. Re-entrancy, Double-Open, Double-Close & Callback Exception Safety
 * 5. HarborShopOverlay Tab Switching & Rapid Toggling (Ledgers, Techniques, Bait, Upgrades, Deck view)
 * 6. HarborShopOverlay Purchasing Until Bankrupt & 0-Gold Stress
 * 7. Canvas 2D Rendering Stress & Screen Geometry Fuzzing
 */

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Headless polyfills for browser canvas and audio globals
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
  };
}

// Always ensure window.AudioContext provides a full gain node mock with setTargetAtTime
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
  (globalThis as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({ getContext: () => null })
  };
}
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

import { Input } from '../src/engine/Input.js';
import { PlayerInventory } from '../src/game/player/PlayerInventory.js';
import { PreCastModal } from '../src/game/ui/PreCastModal.js';
import { HarborShopOverlay } from '../src/game/ui/HarborShopOverlay.js';
import { BAIT_REGISTRY, ALL_BAIT_IDS, BaitId } from '../src/game/battle/BaitData.js';
import { MockCanvas, MockCanvasRenderingContext2D } from './test_helpers.js';

// Extended Mock Context with HTML5 Canvas roundRect, rect, and clip support
class ExtendedMockContext extends MockCanvasRenderingContext2D {
  public roundRect(x: number, y: number, w: number, h: number, radii?: any): void {
    this.operations.push({ name: 'roundRect', args: [x, y, w, h, radii] });
  }

  public rect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ name: 'rect', args: [x, y, w, h] });
  }

  public clip(): void {
    this.operations.push({ name: 'clip', args: [] });
  }
}

class ExtendedMockCanvas extends MockCanvas {
  constructor(width = 1280, height = 720) {
    super(width, height);
    this.ctx = new ExtendedMockContext() as any;
  }
}

// Helpers for input simulation
function simulateKeyPress(code: string): void {
  const c = code.toLowerCase();
  (Input as any).keysJustPressed.add(c);
  (Input as any).keysDown.add(c);
}

function simulateMouseMove(x: number, y: number): void {
  (Input as any).mousePos.x = x;
  (Input as any).mousePos.y = y;
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

describe('M2 Challenger Stress Suite: PreCastModal & HarborShopOverlay', () => {

  beforeEach(() => {
    clearInputs();
  });

  // ==========================================================================
  // 1. PreCastModal Lifecycle & Parameter Boundary Fuzzing
  // ==========================================================================
  describe('1. PreCastModal Lifecycle & Parameter Boundary Fuzzing', () => {
    it('1.1: PreCastModal opens and renders across all standard zone tiers (1, 2, 3, 4)', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);
      const ctx = canvas.ctx as any;

      const testTiers: Array<{ tier: 1 | 2 | 3 | 4; name: string; depth: number }> = [
        { tier: 1, name: 'The Shallows', depth: 15 },
        { tier: 2, name: 'The Foggy Banks', depth: 45 },
        { tier: 3, name: 'The Sunken Reefs', depth: 80 },
        { tier: 4, name: 'The Eldritch Trench', depth: 150 }
      ];

      for (const t of testTiers) {
        modal.open(t.tier, t.name, t.depth, () => {}, () => {});
        assert.equal(modal.isOpen, true);
        assert.equal(modal.zoneTier, t.tier);
        assert.equal(modal.zoneName, t.name);
        assert.equal(modal.depthMeters, t.depth);

        // Verify canvas rendering does not throw
        assert.doesNotThrow(() => {
          modal.render(ctx, canvas.width, canvas.height);
        }, `Modal must render cleanly for zone tier ${t.tier}`);

        modal.close();
        assert.equal(modal.isOpen, false);
      }
    });

    it('1.2: PreCastModal handles boundary and out-of-spec zone tiers (0, 5, -1, 999, NaN) gracefully', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);
      const ctx = canvas.ctx as any;

      const boundaryTiers = [0, 5, -1, 999, NaN];

      for (const tier of boundaryTiers) {
        assert.doesNotThrow(() => {
          modal.open(tier as any, `Extreme Zone ${tier}`, 100, () => {}, () => {});
          modal.render(ctx, canvas.width, canvas.height);
          modal.update(0.016, canvas.width, canvas.height);
        }, `Must survive invalid zoneTier: ${tier}`);

        assert.equal(modal.isOpen, true);
        modal.close();
      }
    });

    it('1.3: PreCastModal handles extreme zone names without layout failure', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);
      const ctx = canvas.ctx as any;

      const extremeNames = [
        '',
        'A'.repeat(500),
        '⚡☠️🐙 Oceanic Maelstrom 🌀🌊⚓',
        '<script>alert("xss")</script>',
        'DROP TABLE whirlpools; --',
        '\\n\\r\\t\\0'
      ];

      for (const name of extremeNames) {
        assert.doesNotThrow(() => {
          modal.open(1, name, 25, () => {}, () => {});
          modal.render(ctx, canvas.width, canvas.height);
        }, `Must render without error with name "${name.slice(0, 20)}..."`);
        modal.close();
      }
    });

    it('1.4: PreCastModal handles extreme depth values (-100, 0, 1000000, NaN, Infinity)', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);
      const ctx = canvas.ctx as any;

      const depths = [-100, 0, 1000000, NaN, Infinity, -Infinity];

      for (const d of depths) {
        assert.doesNotThrow(() => {
          modal.open(2, 'Depth Test', d, () => {}, () => {});
          modal.render(ctx, canvas.width, canvas.height);
        }, `Must render cleanly with depth: ${d}`);
        modal.close();
      }
    });

    it('1.5: Double-open cleanly re-binds zone, depth, and callbacks without leaking previous state', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);

      let castA = 0;
      let castB = 0;

      modal.open(1, 'Zone 1', 10, () => { castA++; }, () => {});
      assert.equal(modal.zoneTier, 1);
      assert.equal(modal.zoneName, 'Zone 1');

      // Double-open with Zone 4 and Callback B
      modal.open(4, 'Zone 4', 120, () => { castB++; }, () => {});
      assert.equal(modal.zoneTier, 4);
      assert.equal(modal.zoneName, 'Zone 4');
      assert.equal(modal.depthMeters, 120);

      // Confirm cast should trigger Callback B, not Callback A
      modal.confirmCast();
      assert.equal(castA, 0, 'Callback A must NOT be triggered after double-open overwrite');
      assert.equal(castB, 1, 'Callback B must be triggered exactly once');
      assert.equal(modal.isOpen, false);
    });

    it('1.6: Idempotency of close() — calling close() repeatedly on already closed modal is safe', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);

      assert.equal(modal.isOpen, false);
      for (let i = 0; i < 20; i++) {
        assert.doesNotThrow(() => {
          modal.close();
        });
        assert.equal(modal.isOpen, false);
      }
    });

    it('1.7: Calling cancel() on already closed modal does not execute stale callbacks', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);

      let cancelCount = 0;
      modal.open(1, 'Test', 20, () => {}, () => { cancelCount++; });
      modal.close(); // Closed directly

      // Now call cancel on closed modal
      modal.cancel();
      assert.equal(cancelCount, 0, 'Must not fire cancel callback after close() was called');
      assert.equal(modal.isOpen, false);
    });

    it('1.8: Casting without callback provided (null/undefined) executes safely', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);

      modal.open(1, 'Zone', 20, undefined as any, undefined as any);
      assert.doesNotThrow(() => {
        const chosen = modal.confirmCast();
        assert.equal(chosen, 'bare_hook');
      });
      assert.equal(modal.isOpen, false);

      modal.open(1, 'Zone', 20, undefined as any, undefined as any);
      assert.doesNotThrow(() => {
        modal.cancel();
      });
      assert.equal(modal.isOpen, false);
    });

    it('1.9: Callback throwing error preserves modal closed state and cleans up callbacks', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);

      modal.open(1, 'Zone', 20, () => {
        throw new Error('Explosion during cast handling!');
      }, () => {});

      assert.throws(() => {
        modal.confirmCast();
      }, /Explosion during cast handling!/);

      // Modal must be closed and callbacks cleared despite exception
      assert.equal(modal.isOpen, false);
      assert.equal((modal as any).onCastCallback, null);
      assert.equal((modal as any).onCancelCallback, null);
    });
  });

  // ==========================================================================
  // 2. Bait Cycling & Selection Boundary Stress
  // ==========================================================================
  describe('2. Bait Cycling & Selection Boundary Stress', () => {
    it('2.1: Cycling with ONLY Bare Hook owned is a safe no-op across 50 iterations', () => {
      const inv = new PlayerInventory();
      // Only bare_hook is owned (count Infinity, others 0)
      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      assert.equal(inv.selectedBait, 'bare_hook');

      // Forward cycles
      for (let i = 0; i < 50; i++) {
        modal.cycleBait(1);
        assert.equal(inv.selectedBait, 'bare_hook');
      }

      // Backward cycles
      for (let i = 0; i < 50; i++) {
        modal.cycleBait(-1);
        assert.equal(inv.selectedBait, 'bare_hook');
      }
    });

    it('2.2: Cycling forward and backward with sparse inventory (Bare Hook and Eldritch Grub only)', () => {
      const inv = new PlayerInventory();
      inv.addBait('eldritch_grub', 3);
      // Owned: bare_hook and eldritch_grub (indices 0 and 4 in ALL_BAIT_IDS)
      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      assert.equal(inv.selectedBait, 'bare_hook');

      modal.cycleBait(1);
      assert.equal(inv.selectedBait, 'eldritch_grub');

      modal.cycleBait(1);
      assert.equal(inv.selectedBait, 'bare_hook');

      modal.cycleBait(-1);
      assert.equal(inv.selectedBait, 'eldritch_grub');

      modal.cycleBait(-1);
      assert.equal(inv.selectedBait, 'bare_hook');
    });

    it('2.3: Cycling with all 5 baits owned traverses the exact circular sequence', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 5);
      inv.addBait('blood_chum', 5);
      inv.addBait('bio_squid', 5);
      inv.addBait('eldritch_grub', 5);

      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      const expectedOrder: BaitId[] = ['bare_hook', 'lugworms', 'blood_chum', 'bio_squid', 'eldritch_grub'];

      // Forward 20 cycles
      for (let i = 0; i < 20; i++) {
        const expected = expectedOrder[i % 5];
        assert.equal(inv.selectedBait, expected, `Cycle forward step ${i}`);
        modal.cycleBait(1);
      }

      // Backward 20 cycles
      for (let i = 0; i < 20; i++) {
        modal.cycleBait(-1);
      }
      assert.equal(inv.selectedBait, 'bare_hook');
    });

    it('2.4: Cycling recovers gracefully if inventory selectedBait was corrupted to unowned bait', () => {
      const inv = new PlayerInventory();
      // Add one legitimate bait so ownedBaits.length is 2
      inv.addBait('lugworms', 1);

      // Corrupt state externally: selectedBait set to unowned bio_squid
      (inv as any).selectedBait = 'bio_squid';

      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      // On open, PreCastModal must revert out-of-stock selection to bare_hook
      assert.equal(inv.selectedBait, 'bare_hook');

      // If corrupted again while modal is open
      (inv as any).selectedBait = 'bio_squid';

      // cycleBait must not throw, recover from currentIndex === -1, and select valid owned bait
      assert.doesNotThrow(() => {
        modal.cycleBait(1);
      });
      assert.equal(inv.selectedBait, 'lugworms');
    });

    it('2.5: Direct selectBait strictly rejects out-of-stock baits and maintains current selection', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 2);
      inv.selectBait('lugworms');
      assert.equal(inv.selectedBait, 'lugworms');

      // Attempt to select zero-stock blood_chum
      const ok = inv.selectBait('blood_chum');
      assert.equal(ok, false);
      assert.equal(inv.selectedBait, 'lugworms', 'Must remain on lugworms');

      // Attempt to select zero-stock eldritch_grub
      const ok2 = inv.selectBait('eldritch_grub');
      assert.equal(ok2, false);
      assert.equal(inv.selectedBait, 'lugworms');
    });

    it('2.6: Number keys [1..5] in update() reject unowned / zero-count baits', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 1);
      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      // Currently owned: bare_hook [1], lugworms [2]. Others [3, 4, 5] have 0 count.
      assert.equal(inv.selectedBait, 'bare_hook');

      // Press 3 (blood_chum) - unowned
      simulateKeyPress('digit3');
      modal.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(inv.selectedBait, 'bare_hook', 'Must reject digit3 for unowned blood_chum');

      // Press 4 (bio_squid) - unowned
      simulateKeyPress('digit4');
      modal.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(inv.selectedBait, 'bare_hook', 'Must reject digit4 for unowned bio_squid');

      // Press 5 (eldritch_grub) - unowned
      simulateKeyPress('digit5');
      modal.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(inv.selectedBait, 'bare_hook', 'Must reject digit5 for unowned eldritch_grub');

      // Press 2 (lugworms) - owned!
      simulateKeyPress('digit2');
      modal.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(inv.selectedBait, 'lugworms', 'Must select digit2 for owned lugworms');
    });

    it('2.7: Mouse click in update() rejects unowned / zero-count bait tiles', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);

      modal.open(1, 'Zone', 20, () => {}, () => {});
      modal.render(canvas.ctx as any, canvas.width, canvas.height);

      const tileRects = (modal as any).baitTileRects as { baitId: BaitId; rect: { x: number; y: number; w: number; h: number } }[];
      assert.equal(tileRects.length, 5);

      // Find tile for eldritch_grub (index 4, unowned)
      const grubTile = tileRects.find(t => t.baitId === 'eldritch_grub')!;
      assert.ok(grubTile);

      // Click on unowned tile
      simulateMouseClick(grubTile.rect.x + 10, grubTile.rect.y + 10);
      modal.update(0.016, canvas.width, canvas.height);
      clearInputs();

      assert.equal(inv.selectedBait, 'bare_hook', 'Clicking unowned bait must not equip it');
    });

    it('2.8: Opening PreCastModal when currently selected bait has 0 stock automatically reverts to Bare Hook', () => {
      const inv = new PlayerInventory();
      inv.addBait('blood_chum', 1);
      inv.selectBait('blood_chum');
      assert.equal(inv.selectedBait, 'blood_chum');

      // Externally deplete stock
      inv.baits.blood_chum = 0;

      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      assert.equal(inv.selectedBait, 'bare_hook', 'Must fallback to bare_hook upon open');
    });
  });

  // ==========================================================================
  // 3. High-Frequency Key Event Simulation & Rapid Input Burst
  // ==========================================================================
  describe('3. High-Frequency Key Event Simulation & Rapid Input Burst', () => {
    it('3.1: Rapid sequential number key presses accurately switch equipped bait when owned', () => {
      const inv = new PlayerInventory();
      // Give stock to all baits
      for (const id of ALL_BAIT_IDS) {
        if (id !== 'bare_hook') inv.addBait(id, 10);
      }

      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      const keySequence: Array<{ key: string; expected: BaitId }> = [
        { key: 'digit2', expected: 'lugworms' },
        { key: 'digit3', expected: 'blood_chum' },
        { key: 'digit4', expected: 'bio_squid' },
        { key: 'digit5', expected: 'eldritch_grub' },
        { key: 'digit1', expected: 'bare_hook' }
      ];

      for (const step of keySequence) {
        simulateKeyPress(step.key);
        modal.update(0.016, 1280, 720);
        clearInputs();
        assert.equal(inv.selectedBait, step.expected, `Expected ${step.expected} after ${step.key}`);
      }
    });

    it('3.2: Rapid alternating arrow key burst across 100 frames maintains valid selection', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 5);
      inv.addBait('bio_squid', 5);

      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      const keys = ['arrowright', 'arrowleft', 'keyd', 'keya'];

      for (let f = 0; f < 100; f++) {
        const k = keys[f % keys.length];
        simulateKeyPress(k);
        modal.update(0.016, 1280, 720);
        clearInputs();

        assert.ok(
          inv.selectedBait === 'bare_hook' || inv.selectedBait === 'lugworms' || inv.selectedBait === 'bio_squid',
          `Frame ${f} selectedBait must be one of the owned baits`
        );
      }
    });

    it('3.3: Space key press triggers confirmCast, consumes 1 bait, invokes callback, and closes modal', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 3);
      inv.selectBait('lugworms');

      const modal = new PreCastModal(inv);
      let castResult: BaitId | null = null;
      modal.open(1, 'Zone', 20, (b) => { castResult = b; }, () => {});

      simulateKeyPress('space');
      modal.update(0.016, 1280, 720);
      clearInputs();

      assert.equal(castResult, 'lugworms');
      assert.equal(inv.getBaitCount('lugworms'), 2);
      assert.equal(modal.isOpen, false);
    });

    it('3.4: Enter key press triggers confirmCast identically to Space', () => {
      const inv = new PlayerInventory();
      inv.addBait('blood_chum', 2);
      inv.selectBait('blood_chum');

      const modal = new PreCastModal(inv);
      let castResult: BaitId | null = null;
      modal.open(1, 'Zone', 20, (b) => { castResult = b; }, () => {});

      simulateKeyPress('enter');
      modal.update(0.016, 1280, 720);
      clearInputs();

      assert.equal(castResult, 'blood_chum');
      assert.equal(inv.getBaitCount('blood_chum'), 1);
      assert.equal(modal.isOpen, false);
    });

    it('3.5: Escape key press triggers cancel, preserves bait count, invokes onCancel, and closes modal', () => {
      const inv = new PlayerInventory();
      inv.addBait('eldritch_grub', 1);
      inv.selectBait('eldritch_grub');

      const modal = new PreCastModal(inv);
      let cancelled = false;
      modal.open(1, 'Zone', 20, () => {}, () => { cancelled = true; });

      simulateKeyPress('escape');
      modal.update(0.016, 1280, 720);
      clearInputs();

      assert.equal(cancelled, true);
      assert.equal(inv.getBaitCount('eldritch_grub'), 1, 'Bait must not be consumed');
      assert.equal(modal.isOpen, false);
    });

    it('3.6: Conflicting simultaneous keys: Escape and Space in the same frame prioritizes safe cancellation', () => {
      const inv = new PlayerInventory();
      inv.addBait('lugworms', 1);
      inv.selectBait('lugworms');

      const modal = new PreCastModal(inv);
      let castFired = false;
      let cancelFired = false;
      modal.open(1, 'Zone', 20, () => { castFired = true; }, () => { cancelFired = true; });

      // Simulate both escape and space pressed in the same tick
      simulateKeyPress('escape');
      simulateKeyPress('space');
      modal.update(0.016, 1280, 720);
      clearInputs();

      assert.equal(cancelFired, true, 'Escape must cancel modal');
      assert.equal(castFired, false, 'Cast must NOT fire when escape is pressed simultaneously');
      assert.equal(inv.getBaitCount('lugworms'), 1, 'Bait must be preserved');
      assert.equal(modal.isOpen, false);
    });

    it('3.7: Fuzzing unrecognized / invalid key codes leaves modal state unchanged and responsive', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      const junkKeys = [
        'keyx', 'keyz', 'f12', 'backquote', 'shiftleft', 'controlleft',
        'capslock', 'tab', 'contextmenu', '', 'undefined', 'null'
      ];

      for (const k of junkKeys) {
        simulateKeyPress(k);
        modal.update(0.016, 1280, 720);
        clearInputs();
        assert.equal(modal.isOpen, true);
        assert.equal(inv.selectedBait, 'bare_hook');
      }

      // After junk keys, valid Space key still works
      simulateKeyPress('space');
      modal.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(modal.isOpen, false);
    });

    it('3.8: dt variation stress: updates with dt = 0, dt < 0, dt = 1e6, and micro dt without freeze or NaN', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      modal.open(1, 'Zone', 20, () => {}, () => {});

      const dtValues = [0, -0.016, 1e-9, 100, 1000000];
      for (const dt of dtValues) {
        assert.doesNotThrow(() => {
          modal.update(dt, 1280, 720);
        });
      }
      assert.equal(modal.isOpen, true);
    });
  });

  // ==========================================================================
  // 4. HarborShopOverlay Tab Switching & Rapid Toggling
  // ==========================================================================
  describe('4. HarborShopOverlay Tab Switching & Rapid Toggling', () => {
    it('4.1: Rapid keyboard tab toggling between ledgers, techniques, bait, upgrades, and all', () => {
      const inv = new PlayerInventory();
      let closed = false;
      const overlay = new HarborShopOverlay(inv, () => { closed = true; });

      // Initially 'all'
      assert.equal((overlay as any).selectedTab, 'all');

      // Press KeyL -> 'ledgers'
      simulateKeyPress('keyl');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'ledgers');

      // Press KeyL again -> 'all'
      simulateKeyPress('keyl');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'all');

      // Press KeyT -> 'techniques'
      simulateKeyPress('keyt');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'techniques');

      // Press KeyB -> 'bait'
      simulateKeyPress('keyb');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'bait');

      // Press KeyU -> 'upgrades'
      simulateKeyPress('keyu');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'upgrades');

      // Press KeyU again -> 'all'
      simulateKeyPress('keyu');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).selectedTab, 'all');

      assert.equal(closed, false);
    });

    it('4.2: 200 random tab switch requests via hotkeys maintain valid state without leaks', () => {
      const inv = new PlayerInventory();
      const overlay = new HarborShopOverlay(inv, () => {});
      const keys = ['keyl', 'keyt', 'keyb', 'keyu'];
      const validTabs = ['all', 'ledgers', 'techniques', 'bait', 'upgrades'];

      for (let i = 0; i < 200; i++) {
        const k = keys[i % keys.length];
        simulateKeyPress(k);
        overlay.update(0.016, 1280, 720);
        clearInputs();

        const currentTab = (overlay as any).selectedTab;
        assert.ok(validTabs.includes(currentTab), `Tab ${currentTab} must be a valid tab enum value`);
      }
    });

    it('4.3: Mouse click tab switching on header hitboxes toggles tabs accurately', () => {
      const inv = new PlayerInventory();
      const overlay = new HarborShopOverlay(inv, () => {});

      // Call update once to calculate header tab hitboxes
      overlay.update(0.016, 1280, 720);

      const tabBaitRect = (overlay as any).tabBaitRect;
      assert.ok(tabBaitRect.w > 0 && tabBaitRect.h > 0, 'tabBaitRect must have valid geometry');

      // Click on Bait & Chum tab
      simulateMouseClick(tabBaitRect.x + tabBaitRect.w / 2, tabBaitRect.y + tabBaitRect.h / 2);
      overlay.update(0.016, 1280, 720);
      clearInputs();

      assert.equal((overlay as any).selectedTab, 'bait', 'Must switch to bait tab on mouse click');

      // Click on Upgrades tab
      const tabUpgradesRect = (overlay as any).tabUpgradesRect;
      simulateMouseClick(tabUpgradesRect.x + tabUpgradesRect.w / 2, tabUpgradesRect.y + tabUpgradesRect.h / 2);
      overlay.update(0.016, 1280, 720);
      clearInputs();

      assert.equal((overlay as any).selectedTab, 'upgrades', 'Must switch to upgrades tab on mouse click');
    });

    it('4.4: View mode toggle between shop and deck_view via KeyD and mouse click', () => {
      const inv = new PlayerInventory();
      const overlay = new HarborShopOverlay(inv, () => {});

      assert.equal((overlay as any).viewMode, 'shop');

      // Toggle to deck_view via KeyD
      simulateKeyPress('keyd');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).viewMode, 'deck_view');

      // Toggle back to shop via KeyD
      simulateKeyPress('keyd');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).viewMode, 'shop');
    });

    it('4.5: Escape key hierarchy: switches deck_view -> shop, then shop -> onClose()', () => {
      const inv = new PlayerInventory();
      let closed = false;
      const overlay = new HarborShopOverlay(inv, () => { closed = true; });

      // Put into deck_view
      simulateKeyPress('keyd');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).viewMode, 'deck_view');

      // First Escape: exits deck_view back to shop (does NOT close overlay)
      simulateKeyPress('escape');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal((overlay as any).viewMode, 'shop');
      assert.equal(closed, false);

      // Second Escape: closes overlay
      simulateKeyPress('escape');
      overlay.update(0.016, 1280, 720);
      clearInputs();
      assert.equal(closed, true);
    });
  });

  // ==========================================================================
  // 5. HarborShopOverlay Purchasing Until Bankrupt & 0-Gold Stress
  // ==========================================================================
  describe('5. HarborShopOverlay Purchasing Until Bankrupt & 0-Gold Stress', () => {
    it('5.1: Purchasing items until bankrupt depletes gold step-by-step and refuses overdraft', () => {
      const inv = new PlayerInventory();
      inv.gold = 100;
      const overlay = new HarborShopOverlay(inv, () => {});
      const canvas = new ExtendedMockCanvas(1280, 720);

      // Switch to bait tab and render
      (overlay as any).selectedTab = 'bait';
      overlay.render(canvas.ctx as any, canvas.width, canvas.height);

      const baitButtons = (overlay as any).baitBuyButtons as Array<{ bait: any; rect: any }>;
      assert.equal(baitButtons.length, 5);

      const grubBtn = baitButtons.find(b => b.bait.id === 'eldritch_grub')!;
      const chumBtn = baitButtons.find(b => b.bait.id === 'blood_chum')!;

      // 1. Buy Eldritch Grub (75g): 100g - 75g = 25g
      simulateMouseClick(grubBtn.rect.x + 5, grubBtn.rect.y + 5);
      overlay.update(0.016, canvas.width, canvas.height);
      clearInputs();
      assert.equal(inv.gold, 25);
      assert.equal(inv.getBaitCount('eldritch_grub'), 1);

      // 2. Try to buy Eldritch Grub again with only 25g (Need 75g): Rejection!
      simulateMouseClick(grubBtn.rect.x + 5, grubBtn.rect.y + 5);
      overlay.update(0.016, canvas.width, canvas.height);
      clearInputs();
      assert.equal(inv.gold, 25, 'Gold must remain untouched');
      assert.equal(inv.getBaitCount('eldritch_grub'), 1, 'Stock must not increment');

      // 3. Buy Blood Chum (25g): 25g - 25g = 0g (Bankrupt)
      simulateMouseClick(chumBtn.rect.x + 5, chumBtn.rect.y + 5);
      overlay.update(0.016, canvas.width, canvas.height);
      clearInputs();
      assert.equal(inv.gold, 0);
      assert.equal(inv.getBaitCount('blood_chum'), 1);
    });

    it('5.2: Purchasing with 0 gold: all purchasable items are strictly rejected', () => {
      const inv = new PlayerInventory();
      inv.gold = 0; // Bankrupt
      const overlay = new HarborShopOverlay(inv, () => {});
      const canvas = new ExtendedMockCanvas(1280, 720);

      // 1. Try all baits in Bait tab
      (overlay as any).selectedTab = 'bait';
      overlay.render(canvas.ctx as any, canvas.width, canvas.height);
      const baitButtons = (overlay as any).baitBuyButtons as Array<{ bait: any; rect: any }>;

      const paidBaits = baitButtons.filter(b => b.bait.cost > 0);
      for (const b of paidBaits) {
        simulateMouseClick(b.rect.x + 5, b.rect.y + 5);
        overlay.update(0.016, canvas.width, canvas.height);
        clearInputs();
        assert.equal(inv.gold, 0, 'Gold must not go negative');
        assert.equal(inv.getBaitCount(b.bait.id), 0, `Must not award ${b.bait.id} for 0 gold`);
      }

      // 2. Try Upgrades tab with 0 gold
      (overlay as any).selectedTab = 'upgrades';
      overlay.render(canvas.ctx as any, canvas.width, canvas.height);
      const staminaBtns = (overlay as any).staminaUpgradeButtons as Array<{ tier: any; rect: any }>;

      if (staminaBtns.length > 0) {
        const sBtn = staminaBtns[0];
        simulateMouseClick(sBtn.rect.x + 5, sBtn.rect.y + 5);
        overlay.update(0.016, canvas.width, canvas.height);
        clearInputs();
        assert.equal(inv.staminaUpgradeLevel, 0, 'Stamina must not upgrade with 0 gold');
        assert.equal(inv.gold, 0);
      }
    });

    it('5.3: Bare Hook purchase in shop with 0 gold is free/informative and preserves Infinity stock', () => {
      const inv = new PlayerInventory();
      inv.gold = 0;
      const overlay = new HarborShopOverlay(inv, () => {});
      const canvas = new ExtendedMockCanvas(1280, 720);

      (overlay as any).selectedTab = 'bait';
      overlay.render(canvas.ctx as any, canvas.width, canvas.height);

      const baitButtons = (overlay as any).baitBuyButtons as Array<{ bait: any; rect: any }>;
      const bareHookBtn = baitButtons.find(b => b.bait.id === 'bare_hook')!;

      simulateMouseClick(bareHookBtn.rect.x + 5, bareHookBtn.rect.y + 5);
      overlay.update(0.016, canvas.width, canvas.height);
      clearInputs();

      assert.equal(inv.gold, 0);
      assert.equal(inv.getBaitCount('bare_hook'), Infinity);
      assert.ok((overlay as any).notification?.text.includes('Bare Hook is permanent'));
    });

    it('5.4: Gold boundary edge case: fractional gold spends safely without precision corruption', () => {
      const inv = new PlayerInventory();
      inv.gold = 10.5;

      const spent = inv.spendGold(10);
      assert.equal(spent, true);
      assert.equal(Math.round(inv.gold * 10) / 10, 0.5);

      const spentMore = inv.spendGold(1);
      assert.equal(spentMore, false);
      assert.equal(Math.round(inv.gold * 10) / 10, 0.5);
    });
  });

  // ==========================================================================
  // 6. Canvas 2D Rendering Stress & Screen Geometry Fuzzing
  // ==========================================================================
  describe('6. Canvas 2D Rendering Stress & Screen Geometry Fuzzing', () => {
    it('6.1: PreCastModal renders at various resolutions (800x600, 1280x720, 1920x1080)', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      modal.open(2, 'The Foggy Banks', 45, () => {}, () => {});

      const resolutions = [
        { w: 800, h: 600 },
        { w: 1280, h: 720 },
        { w: 1920, h: 1080 }
      ];

      for (const res of resolutions) {
        const canvas = new ExtendedMockCanvas(res.w, res.h);
        assert.doesNotThrow(() => {
          modal.render(canvas.ctx as any, res.w, res.h);
        }, `Must render at ${res.w}x${res.h}`);
      }
    });

    it('6.2: PreCastModal renders at extreme resolutions (320x240, 3840x2160, 100x100) without crashing', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      modal.open(3, 'The Sunken Reefs', 75, () => {}, () => {});

      const extremeRes = [
        { w: 320, h: 240 },
        { w: 3840, h: 2160 },
        { w: 100, h: 100 }
      ];

      for (const res of extremeRes) {
        const canvas = new ExtendedMockCanvas(res.w, res.h);
        assert.doesNotThrow(() => {
          modal.render(canvas.ctx as any, res.w, res.h);
        }, `Must render without crash at extreme res ${res.w}x${res.h}`);
      }
    });

    it('6.3: HarborShopOverlay renders across all tabs without throwing', () => {
      const inv = new PlayerInventory();
      const overlay = new HarborShopOverlay(inv, () => {});
      const canvas = new ExtendedMockCanvas(1280, 720);

      const tabs: Array<'all' | 'ledgers' | 'techniques' | 'bait' | 'upgrades'> = [
        'all', 'ledgers', 'techniques', 'bait', 'upgrades'
      ];

      for (const tab of tabs) {
        (overlay as any).selectedTab = tab;
        assert.doesNotThrow(() => {
          overlay.render(canvas.ctx as any, canvas.width, canvas.height);
        }, `Must render HarborShopOverlay tab: ${tab}`);
      }
    });

    it('6.4: Interactive hitboxes are accurately populated after render and accept mouse click hit-testing', () => {
      const inv = new PlayerInventory();
      const modal = new PreCastModal(inv);
      const canvas = new ExtendedMockCanvas(1280, 720);

      let castTriggered = false;
      modal.open(1, 'The Shallows', 15, () => { castTriggered = true; }, () => {});
      modal.render(canvas.ctx as any, canvas.width, canvas.height);

      const castBtnRect = (modal as any).castBtnRect;
      assert.ok(castBtnRect.w > 0 && castBtnRect.h > 0);

      // Click on Cast button
      simulateMouseClick(castBtnRect.x + castBtnRect.w / 2, castBtnRect.y + castBtnRect.h / 2);
      modal.update(0.016, canvas.width, canvas.height);
      clearInputs();

      assert.equal(castTriggered, true, 'Clicking cast button must trigger cast');
      assert.equal(modal.isOpen, false);
    });
  });
});
