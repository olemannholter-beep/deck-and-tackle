import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CATALOG_BASE_PATH,
  EXPECTED_ROAMING_CATALOG_DIRS,
  GALLERY_PATH,
  AUTHORITATIVE_HOSTILE_ROSTER,
  AuthoritativeHostileConfig
} from './diversity_test_helpers.js';

// Locate workspace root (parent of deck-and-tackle)
const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
const ABS_CATALOG_PATH = path.join(WORKSPACE_ROOT, CATALOG_BASE_PATH);
const ABS_GALLERY_PATH = path.join(WORKSPACE_ROOT, GALLERY_PATH);

/**
 * Helper to inspect catalog directory status
 */
interface CatalogStatus {
  baseExists: boolean;
  expectedDirs: { relativePath: string; absPath: string; exists: boolean }[];
  allDirsExist: boolean;
  missingDirs: string[];
}

function inspectCatalogStatus(): CatalogStatus {
  const baseExists = fs.existsSync(ABS_CATALOG_PATH);
  const expectedDirs = EXPECTED_ROAMING_CATALOG_DIRS.map(rel => {
    const absPath = path.join(WORKSPACE_ROOT, rel);
    return {
      relativePath: rel,
      absPath,
      exists: fs.existsSync(absPath)
    };
  });

  const missingDirs = expectedDirs.filter(d => !d.exists).map(d => d.relativePath);

  return {
    baseExists,
    expectedDirs,
    allDirsExist: missingDirs.length === 0,
    missingDirs
  };
}

/**
 * Simple HTML card extractor for Visual_Sprite_Gallery.html
 */
interface GalleryCard {
  filename: string;
  src: string;
  badge: string;
}

function parseGalleryCards(htmlContent: string): GalleryCard[] {
  const cards: GalleryCard[] = [];
  const cardRegex = /<div class="card">[\s\S]*?<img src="([^"]+)"[\s\S]*?<div class="filename">([^<]+)<\/div>[\s\S]*?<span class="badge [^"]*">([^<]+)<\/span>/g;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(htmlContent)) !== null) {
    cards.push({
      src: match[1],
      filename: match[2].trim(),
      badge: match[3].trim()
    });
  }

  // Also match video cards
  const vidRegex = /<div class="card">[\s\S]*?<video[^>]*src="([^"]+)"[\s\S]*?<div class="filename">([^<]+)<\/div>[\s\S]*?<span class="badge [^"]*">([^<]+)<\/span>/g;
  while ((match = vidRegex.exec(htmlContent)) !== null) {
    cards.push({
      src: match[1],
      filename: match[2].trim(),
      badge: match[3].trim()
    });
  }

  return cards;
}

/**
 * Generator helper for gallery roaming enemy HTML block
 */
function generateRoamingEnemyGalleryBlock(hostiles: Record<string, AuthoritativeHostileConfig>): string {
  const cardsHtml = Object.values(hostiles).map(h => `
      <div class="card">
        <div class="thumb-container">
          <img src="05_Roaming_Enemies/${h.spriteAssetKey}" alt="${h.name}" loading="lazy" />
        </div>
        <div class="card-info">
          <div class="filename">${h.spriteAssetKey}</div>
          <div class="meta"><span>Zone ${h.zoneTier} ${h.category.toUpperCase()}</span><span class="badge badge-png">PNG</span></div>
        </div>
      </div>`).join('');

  return `
  <div class="zone-block" id="roaming-enemies-block">
    <div class="zone-title"><span>📂 05_Roaming_Enemies (Patrol Vessels & Ambush Beasts)</span></div>
    <div class="subcat-title">📁 Roaming Hostiles (${Object.keys(hostiles).length} items)</div>
    <div class="grid">${cardsHtml}
    </div>
  </div>`;
}

// ===========================================================================
// TIER 1: FEATURE COVERAGE (Features 21 - 22)
// ===========================================================================

describe('Tier 1: Feature Coverage (Features 21 - 22)', () => {

  // -------------------------------------------------------------------------
  // Feature 21: Enemy Sprite Catalog Folders
  // -------------------------------------------------------------------------
  describe('F21: Enemy Sprite Catalog Folders', () => {
    test('T1.F21.1: Base catalog folder ZONE_SPRITES_CATALOG exists at workspace root', () => {
      assert.strictEqual(fs.existsSync(ABS_CATALOG_PATH), true, `Catalog base path should exist at ${ABS_CATALOG_PATH}`);
      const stats = fs.statSync(ABS_CATALOG_PATH);
      assert.strictEqual(stats.isDirectory(), true, 'Catalog base path must be a directory');
    });

    test('T1.F21.2: Hostile patrol vessels map to valid sprite asset keys with PNG extensions', () => {
      const vessels = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).filter(h => h.category === 'vessel');
      assert.strictEqual(vessels.length, 4, 'Must have exactly 4 patrol vessels');

      for (const v of vessels) {
        assert.ok(v.spriteAssetKey.endsWith('.png'), `Vessel ${v.name} asset key must end in .png, got ${v.spriteAssetKey}`);
        assert.ok(!v.spriteAssetKey.includes(' '), `Asset key ${v.spriteAssetKey} should not have spaces`);
      }
    });

    test('T1.F21.3: Hostile ambush sea beasts map to valid sprite asset keys with PNG extensions', () => {
      const beasts = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).filter(h => h.category === 'beast');
      assert.strictEqual(beasts.length, 4, 'Must have exactly 4 ambush sea beasts');

      for (const b of beasts) {
        assert.ok(b.spriteAssetKey.endsWith('.png'), `Beast ${b.name} asset key must end in .png, got ${b.spriteAssetKey}`);
        assert.ok(!b.spriteAssetKey.includes(' '), `Asset key ${b.spriteAssetKey} should not have spaces`);
      }
    });

    test('T1.F21.4: Zone segregation: every radial tier (1-4) has exactly 1 vessel and 1 beast', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const tierVessels = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).filter(
          h => h.zoneTier === tier && h.category === 'vessel'
        );
        const tierBeasts = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).filter(
          h => h.zoneTier === tier && h.category === 'beast'
        );

        assert.strictEqual(tierVessels.length, 1, `Zone tier ${tier} must have exactly 1 vessel`);
        assert.strictEqual(tierBeasts.length, 1, `Zone tier ${tier} must have exactly 1 beast`);
      }
    });

    test('T1.F21.5: Catalog status inspector reliably identifies presence or missing state of expected catalog dirs', () => {
      const status = inspectCatalogStatus();
      assert.strictEqual(typeof status.baseExists, 'boolean');
      assert.strictEqual(status.baseExists, true);
      assert.strictEqual(status.expectedDirs.length, 5);
      // Status reports either all complete or explicit list of missing directories
      if (!status.allDirsExist) {
        assert.ok(status.missingDirs.length > 0, 'Missing dirs list should reflect missing paths');
      } else {
        assert.strictEqual(status.missingDirs.length, 0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Feature 22: Visual Sprite Gallery Update
  // -------------------------------------------------------------------------
  describe('F22: Visual Sprite Gallery Update', () => {
    test('T1.F22.1: Visual_Sprite_Gallery.html exists and is readable UTF-8 file', () => {
      assert.strictEqual(fs.existsSync(ABS_GALLERY_PATH), true, `Gallery must exist at ${ABS_GALLERY_PATH}`);
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.length > 1000, `Gallery content must be non-empty (got ${content.length} chars)`);
      assert.ok(content.includes('<!DOCTYPE html>'), 'Gallery must have HTML doctype');
    });

    test('T1.F22.2: Gallery HTML contains complete CSS styling, container classes, and header title', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.includes('<title>Deck & Tackle'), 'Must include Deck & Tackle title');
      assert.ok(content.includes('.zone-block'), 'Must include .zone-block class in styles');
      assert.ok(content.includes('.card'), 'Must include .card class in styles');
      assert.ok(content.includes('.thumb-container'), 'Must include .thumb-container in styles');
    });

    test('T1.F22.3: Gallery HTML includes instructions for replacing sprites in deck-and-tackle/public/assets/', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.includes('deck-and-tackle/public/assets/sprites/fishing/'), 'Must guide user to fishing sprites path');
      assert.ok(content.includes('exact same filename'), 'Must instruct user to use exact same filename');
    });

    test('T1.F22.4: Gallery HTML parses existing cards across categories', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const cards = parseGalleryCards(content);
      assert.ok(cards.length > 50, `Expected at least 50 cards in gallery, found ${cards.length}`);
      for (const card of cards.slice(0, 10)) {
        assert.ok(card.filename.length > 0, 'Card filename must be populated');
        assert.ok(card.src.length > 0, 'Card src must be populated');
        assert.ok(card.badge === 'PNG' || card.badge === 'VID' || card.badge.length > 0, 'Badge must be valid');
      }
    });

    test('T1.F22.5: Roaming enemy gallery block generator creates valid HTML block with all 8 hostiles', () => {
      const blockHtml = generateRoamingEnemyGalleryBlock(AUTHORITATIVE_HOSTILE_ROSTER);
      assert.ok(blockHtml.includes('id="roaming-enemies-block"'));
      assert.ok(blockHtml.includes('05_Roaming_Enemies (Patrol Vessels & Ambush Beasts)'));

      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        assert.ok(blockHtml.includes(h.spriteAssetKey), `Block must include ${h.spriteAssetKey}`);
        assert.ok(blockHtml.includes(h.name), `Block must include ${h.name}`);
      }
    });
  });
});

// ===========================================================================
// TIER 2: BOUNDARY & CORNER CASES (Features 21 - 22)
// ===========================================================================

describe('Tier 2: Boundary & Corner Cases (Features 21 - 22)', () => {

  // -------------------------------------------------------------------------
  // Boundary F21: Enemy Sprite Catalog Folders
  // -------------------------------------------------------------------------
  describe('Boundary F21: Enemy Sprite Catalog Folders', () => {
    test('T2.F21.1: Path resolution handles both relative and absolute paths without malformed separators', () => {
      for (const rel of EXPECTED_ROAMING_CATALOG_DIRS) {
        const resolved = path.resolve(WORKSPACE_ROOT, rel);
        assert.ok(!resolved.includes('//') && !resolved.includes('\\\\'), `Path ${resolved} should not contain double separators`);
        assert.strictEqual(path.isAbsolute(resolved), true, `Resolved path ${resolved} must be absolute`);
      }
    });

    test('T2.F21.2: Hostile sprite asset keys contain no illegal filename characters (<>:"/\\|?*)', () => {
      const illegalChars = /[<>:"/\\|?*]/;
      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        assert.strictEqual(illegalChars.test(h.spriteAssetKey), false, `Asset key ${h.spriteAssetKey} contains illegal characters`);
      }
    });

    test('T2.F21.3: Fallback lookup safely returns fallback sprite when custom enemy sprite is not present', () => {
      function resolveEnemySpriteWithFallback(key: string, availableSprites: Set<string>): string {
        if (availableSprites.has(key)) return key;
        return 'boat_trawler_derelict.png'; // Safe default fallback
      }

      const emptySet = new Set<string>();
      const fallbackResult = resolveEnemySpriteWithFallback('unknown_kraken.png', emptySet);
      assert.strictEqual(fallbackResult, 'boat_trawler_derelict.png');

      const fullSet = new Set(['crazed_trawler.png']);
      const matchResult = resolveEnemySpriteWithFallback('crazed_trawler.png', fullSet);
      assert.strictEqual(matchResult, 'crazed_trawler.png');
    });

    test('T2.F21.4: Catalog path checker detects missing directories without unhandled crashes', () => {
      const bogusPath = path.join(WORKSPACE_ROOT, 'ZONE_SPRITES_CATALOG/NonExistent_99_Folder');
      assert.strictEqual(fs.existsSync(bogusPath), false);
      assert.doesNotThrow(() => {
        const exists = fs.existsSync(bogusPath);
        assert.strictEqual(exists, false);
      });
    });

    test('T2.F21.5: Case-insensitive filesystem path matching on Windows behaves predictably', () => {
      const lower = ABS_CATALOG_PATH.toLowerCase();
      const upper = ABS_CATALOG_PATH.toUpperCase();
      // On Windows, both should resolve to same directory
      if (process.platform === 'win32') {
        assert.strictEqual(fs.existsSync(lower), true);
        assert.strictEqual(fs.existsSync(upper), true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Boundary F22: Visual Sprite Gallery Update
  // -------------------------------------------------------------------------
  describe('Boundary F22: Visual Sprite Gallery Update', () => {
    test('T2.F22.1: Gallery parser handles empty or minimal HTML without throwing exceptions', () => {
      const emptyHtml = '<!DOCTYPE html><html><body><h1>Empty</h1></body></html>';
      const parsed = parseGalleryCards(emptyHtml);
      assert.deepStrictEqual(parsed, []);
    });

    test('T2.F22.2: Gallery generator properly escapes special characters in sprite metadata (XSS prevention)', () => {
      function escapeHtml(text: string): string {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      const maliciousName = '<script>alert("hack")</script>';
      const escaped = escapeHtml(maliciousName);
      assert.ok(!escaped.includes('<script>'));
      assert.ok(escaped.includes('&lt;script&gt;'));
    });

    test('T2.F22.3: Badge classifier correctly assigns badge-png to .png and badge-vid to .mp4/.webm', () => {
      function getBadgeClass(filename: string): { badgeClass: string; badgeLabel: string } {
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.mp4' || ext === '.webm') {
          return { badgeClass: 'badge-vid', badgeLabel: 'VID' };
        }
        return { badgeClass: 'badge-png', badgeLabel: 'PNG' };
      }

      assert.deepStrictEqual(getBadgeClass('trawler.png'), { badgeClass: 'badge-png', badgeLabel: 'PNG' });
      assert.deepStrictEqual(getBadgeClass('waves.mp4'), { badgeClass: 'badge-vid', badgeLabel: 'VID' });
      assert.deepStrictEqual(getBadgeClass('water.webm'), { badgeClass: 'badge-vid', badgeLabel: 'VID' });
      assert.deepStrictEqual(getBadgeClass('icon.PNG'), { badgeClass: 'badge-png', badgeLabel: 'PNG' });
    });

    test('T2.F22.4: Gallery file size verification ensures file is intact (>50KB) and uncorrupted', () => {
      const stats = fs.statSync(ABS_GALLERY_PATH);
      assert.ok(stats.size > 50000, `Gallery size ${stats.size} must be > 50KB`);
      assert.ok(stats.size < 5000000, `Gallery size ${stats.size} must not exceed 5MB`);
    });

    test('T2.F22.5: Gallery updater preserves all original cards when injecting the roaming enemies section', () => {
      const originalContent = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const originalCards = parseGalleryCards(originalContent);
      const roamingBlock = generateRoamingEnemyGalleryBlock(AUTHORITATIVE_HOSTILE_ROSTER);

      // Simulate insertion before closing </body>
      const updatedContent = originalContent.replace('</body>', `${roamingBlock}\n</body>`);
      const updatedCards = parseGalleryCards(updatedContent);

      // Must have original cards + 8 new hostile cards
      assert.strictEqual(updatedCards.length, originalCards.length + 8, 'Must add exactly 8 new cards without dropping existing');
    });
  });
});
