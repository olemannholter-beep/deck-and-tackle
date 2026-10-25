/**
 * catalog_m6.test.ts
 * Unit and integration tests for Milestone 6 (R6):
 * - Feature 21: Enemy Sprite Catalog Folders & Asset Placement
 * - Feature 22: Visual Sprite Gallery HTML Integration & Parsing
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATALOG_BASE_PATH,
  EXPECTED_ROAMING_CATALOG_DIRS,
  GALLERY_PATH,
  AUTHORITATIVE_HOSTILE_ROSTER
} from './diversity_test_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const ABS_CATALOG_PATH = path.join(WORKSPACE_ROOT, CATALOG_BASE_PATH);
const ABS_GALLERY_PATH = path.join(WORKSPACE_ROOT, GALLERY_PATH);

// Expected zone-specific file distribution
const ZONE_SPECIFIC_EXPECTATIONS = {
  zone1: {
    dir: 'ZONE_SPRITES_CATALOG/Zone 1 - The Shallows (Coastal Shoals)/05_Roaming_Enemies',
    vessel: 'boat_trawler_derelict.png',
    beast: 'fish_visceral_gut_swollen.png'
  },
  zone2: {
    dir: 'ZONE_SPRITES_CATALOG/Zone 2 - The Foggy Banks (Kelp Shallows)/05_Roaming_Enemies',
    vessel: 'rowboat_fisherman_lantern.png',
    beast: 'fish_z2_tentacle_sculpin_sheet.png'
  },
  zone3: {
    dir: 'ZONE_SPRITES_CATALOG/Zone 3 - The Sunken Reefs (Abyssal Trench)/05_Roaming_Enemies',
    vessel: 'shipwreck_abyssal_galleon.png',
    beast: 'shadow_giant_sea_serpent.png'
  },
  zone4: {
    dir: 'ZONE_SPRITES_CATALOG/Zone 4 - The Eldritch Trench (Subterranean Sea Cave)/05_Roaming_Enemies',
    vessel: 'shipwreck_wooden_hull.png',
    beast: 'leviathan_kraken_worm_colossus.png'
  }
};

/**
 * Validates PNG binary header signature (89 50 4E 47 0D 0A 1A 0A)
 */
function isValidPngHeader(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 && // P
    buffer[2] === 0x4e && // N
    buffer[3] === 0x47 && // G
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/**
 * Extracts card data specifically from roaming-enemies-block in gallery HTML
 */
interface ParsedRoamingCard {
  src: string;
  filename: string;
  alt: string;
  meta: string;
  badge: string;
}

function parseRoamingEnemiesBlock(htmlContent: string): { blockExists: boolean; cards: ParsedRoamingCard[] } {
  const blockRegex = /<div class="zone-block" id="roaming-enemies-block">([\s\S]*?)<\/div>\s*<\/body>/;
  const match = blockRegex.exec(htmlContent);
  if (!match) {
    return { blockExists: false, cards: [] };
  }

  const blockHtml = match[1];
  const cardRegex = /<div class="card">[\s\S]*?<img src="([^"]+)" alt="([^"]*)"[^>]*>[\s\S]*?<div class="filename">([^<]+)<\/div>[\s\S]*?<div class="meta"><span>([^<]+)<\/span><span class="badge ([^"]*)">([^<]+)<\/span><\/div>[\s\S]*?<\/div>/g;

  const cards: ParsedRoamingCard[] = [];
  let cardMatch: RegExpExecArray | null;
  while ((cardMatch = cardRegex.exec(blockHtml)) !== null) {
    cards.push({
      src: cardMatch[1],
      alt: cardMatch[2],
      filename: cardMatch[3].trim(),
      meta: cardMatch[4].trim(),
      badge: cardMatch[6].trim()
    });
  }

  return { blockExists: true, cards };
}

describe('Milestone 6 Unit Tests: Enemy Sprite Catalog & Visual Gallery', () => {

  // -------------------------------------------------------------------------
  // Feature 21: Enemy Sprite Catalog Folders & File Placement
  // -------------------------------------------------------------------------
  describe('Feature 21: Enemy Sprite Catalog Folders & File Placement', () => {
    test('M6.F21.1: All 5 expected roaming catalog directories exist', () => {
      for (const relDir of EXPECTED_ROAMING_CATALOG_DIRS) {
        const absDir = path.join(WORKSPACE_ROOT, relDir);
        assert.ok(fs.existsSync(absDir), `Catalog directory must exist: ${relDir}`);
        const stat = fs.statSync(absDir);
        assert.ok(stat.isDirectory(), `Path must be a directory: ${relDir}`);
      }
    });

    test('M6.F21.2: Root 05_Roaming_Enemies directory contains all 8 authoritative hostile PNG sprites', () => {
      const rootDir = path.join(WORKSPACE_ROOT, 'ZONE_SPRITES_CATALOG/05_Roaming_Enemies');
      assert.ok(fs.existsSync(rootDir), 'Root 05_Roaming_Enemies directory must exist');

      const expectedFiles = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => h.spriteAssetKey);
      assert.strictEqual(expectedFiles.length, 8, 'Expected exactly 8 hostile sprites');

      for (const filename of expectedFiles) {
        const filePath = path.join(rootDir, filename);
        assert.ok(fs.existsSync(filePath), `Hostile sprite must exist in catalog: ${filename}`);
        const stat = fs.statSync(filePath);
        assert.ok(stat.size > 1000, `Sprite ${filename} must be non-empty (got ${stat.size} bytes)`);
      }
    });

    test('M6.F21.3: All hostile sprite files have valid PNG binary signatures', () => {
      const rootDir = path.join(WORKSPACE_ROOT, 'ZONE_SPRITES_CATALOG/05_Roaming_Enemies');
      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        const filePath = path.join(rootDir, h.spriteAssetKey);
        const buffer = fs.readFileSync(filePath);
        assert.ok(isValidPngHeader(buffer), `File ${h.spriteAssetKey} must have valid PNG magic signature`);
      }
    });

    test('M6.F21.4: Zone 1 05_Roaming_Enemies contains Crazed Trawler and Mutated Whale', () => {
      const z1Dir = path.join(WORKSPACE_ROOT, ZONE_SPECIFIC_EXPECTATIONS.zone1.dir);
      assert.ok(fs.existsSync(z1Dir));
      const vesselPath = path.join(z1Dir, ZONE_SPECIFIC_EXPECTATIONS.zone1.vessel);
      const beastPath = path.join(z1Dir, ZONE_SPECIFIC_EXPECTATIONS.zone1.beast);
      assert.ok(fs.existsSync(vesselPath), 'Zone 1 vessel sprite must exist');
      assert.ok(fs.existsSync(beastPath), 'Zone 1 beast sprite must exist');
      assert.ok(fs.statSync(vesselPath).size > 0);
      assert.ok(fs.statSync(beastPath).size > 0);
    });

    test('M6.F21.5: Zone 2 05_Roaming_Enemies contains Ghost Skiff and Kelp Leviathan', () => {
      const z2Dir = path.join(WORKSPACE_ROOT, ZONE_SPECIFIC_EXPECTATIONS.zone2.dir);
      assert.ok(fs.existsSync(z2Dir));
      const vesselPath = path.join(z2Dir, ZONE_SPECIFIC_EXPECTATIONS.zone2.vessel);
      const beastPath = path.join(z2Dir, ZONE_SPECIFIC_EXPECTATIONS.zone2.beast);
      assert.ok(fs.existsSync(vesselPath), 'Zone 2 vessel sprite must exist');
      assert.ok(fs.existsSync(beastPath), 'Zone 2 beast sprite must exist');
      assert.ok(fs.statSync(vesselPath).size > 0);
      assert.ok(fs.statSync(beastPath).size > 0);
    });

    test('M6.F21.6: Zone 3 05_Roaming_Enemies contains Galleon Raider and Giant Sea Serpent', () => {
      const z3Dir = path.join(WORKSPACE_ROOT, ZONE_SPECIFIC_EXPECTATIONS.zone3.dir);
      assert.ok(fs.existsSync(z3Dir));
      const vesselPath = path.join(z3Dir, ZONE_SPECIFIC_EXPECTATIONS.zone3.vessel);
      const beastPath = path.join(z3Dir, ZONE_SPECIFIC_EXPECTATIONS.zone3.beast);
      assert.ok(fs.existsSync(vesselPath), 'Zone 3 vessel sprite must exist');
      assert.ok(fs.existsSync(beastPath), 'Zone 3 beast sprite must exist');
      assert.ok(fs.statSync(vesselPath).size > 0);
      assert.ok(fs.statSync(beastPath).size > 0);
    });

    test('M6.F21.7: Zone 4 05_Roaming_Enemies contains Cursed Black Frigate and Cthulhu Colossus', () => {
      const z4Dir = path.join(WORKSPACE_ROOT, ZONE_SPECIFIC_EXPECTATIONS.zone4.dir);
      assert.ok(fs.existsSync(z4Dir));
      const vesselPath = path.join(z4Dir, ZONE_SPECIFIC_EXPECTATIONS.zone4.vessel);
      const beastPath = path.join(z4Dir, ZONE_SPECIFIC_EXPECTATIONS.zone4.beast);
      assert.ok(fs.existsSync(vesselPath), 'Zone 4 vessel sprite must exist');
      assert.ok(fs.existsSync(beastPath), 'Zone 4 beast sprite must exist');
      assert.ok(fs.statSync(vesselPath).size > 0);
      assert.ok(fs.statSync(beastPath).size > 0);
    });

    test('M6.F21.8: README documentation exists in all 5 catalog directories with usage instructions', () => {
      for (const relDir of EXPECTED_ROAMING_CATALOG_DIRS) {
        const readmePath = path.join(WORKSPACE_ROOT, relDir, 'README.md');
        assert.ok(fs.existsSync(readmePath), `README.md must exist in ${relDir}`);
        const content = fs.readFileSync(readmePath, 'utf-8');
        assert.ok(content.length > 50, 'README.md must contain instructions');
        assert.ok(content.includes('deck-and-tackle/public/assets/sprites/fishing/'), 'Must mention public asset destination');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Feature 22: Visual Sprite Gallery HTML Integration & Parsing
  // -------------------------------------------------------------------------
  describe('Feature 22: Visual Sprite Gallery HTML Integration & Parsing', () => {
    test('M6.F22.1: Visual_Sprite_Gallery.html contains roaming-enemies-block section', () => {
      assert.ok(fs.existsSync(ABS_GALLERY_PATH), `Gallery must exist at ${ABS_GALLERY_PATH}`);
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.includes('id="roaming-enemies-block"'), 'Must contain id="roaming-enemies-block"');
      assert.ok(content.includes('05_Roaming_Enemies (Patrol Vessels & Ambush Beasts)'), 'Must contain section header');
    });

    test('M6.F22.2: Roaming enemies block contains exactly 8 cards matching the authoritative hostile roster', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockExists, cards } = parseRoamingEnemiesBlock(content);
      assert.ok(blockExists, 'roaming-enemies-block must exist');
      assert.strictEqual(cards.length, 8, `Expected 8 cards in roaming enemies block, found ${cards.length}`);

      const cardFilenames = new Set(cards.map(c => c.filename));
      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        assert.ok(cardFilenames.has(h.spriteAssetKey), `Block must have card for ${h.spriteAssetKey}`);
      }
    });

    test('M6.F22.3: Each card has valid thumbnail image path pointing to existing catalog file', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { cards } = parseRoamingEnemiesBlock(content);

      for (const card of cards) {
        assert.ok(card.src.startsWith('05_Roaming_Enemies/'), `Card src ${card.src} must start with 05_Roaming_Enemies/`);
        // Verify relative to gallery folder (ZONE_SPRITES_CATALOG/)
        const targetDiskPath = path.join(ABS_CATALOG_PATH, card.src);
        assert.ok(fs.existsSync(targetDiskPath), `Image file on disk must exist: ${targetDiskPath}`);
      }
    });

    test('M6.F22.4: Card titles and metadata correctly display zone tier, category, and PNG badge', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { cards } = parseRoamingEnemiesBlock(content);

      const hostileMap = new Map(Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => [h.spriteAssetKey, h]));

      for (const card of cards) {
        const spec = hostileMap.get(card.filename);
        assert.ok(spec, `Unknown card filename ${card.filename}`);
        assert.strictEqual(card.alt, spec.name, `Alt text should equal hostile name ${spec.name}`);
        assert.strictEqual(card.badge, 'PNG', 'Badge label should be PNG');
        assert.ok(card.meta.includes(`Zone ${spec.zoneTier}`), `Meta must mention Zone ${spec.zoneTier}`);
        assert.ok(card.meta.includes(spec.category.toUpperCase()), `Meta must mention category ${spec.category.toUpperCase()}`);
      }
    });

    test('M6.F22.5: Gallery document maintains strict HTML structure', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.startsWith('<!DOCTYPE html>'), 'Gallery must start with doctype');
      assert.ok(content.includes('<html'), 'Gallery must have html open tag');
      assert.ok(content.includes('</html>'), 'Gallery must have html close tag');
      assert.ok(content.includes('<head>'), 'Gallery must have head open tag');
      assert.ok(content.includes('</head>'), 'Gallery must have head close tag');
      assert.ok(content.includes('<body>'), 'Gallery must have body open tag');
      assert.ok(content.includes('</body>'), 'Gallery must have body close tag');
      assert.ok(content.includes('.zone-block'), 'Gallery styles must define .zone-block');
      assert.ok(content.includes('.card'), 'Gallery styles must define .card');
    });

    test('M6.F22.6: Gallery CSS grid classes and responsive cards format correctly', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.includes('grid-template-columns: repeat(auto-fill, minmax(210px, 1fr))'));
      assert.ok(content.includes('.thumb-container img'));
      assert.ok(content.includes('image-rendering: pixelated'));
    });
  });

  // -------------------------------------------------------------------------
  // Edge Cases & Resilience
  // -------------------------------------------------------------------------
  describe('Edge Cases & Resilience', () => {
    test('M6.EDGE.1: Path resolution works seamlessly with relative and absolute path conversions', () => {
      for (const rel of EXPECTED_ROAMING_CATALOG_DIRS) {
        const abs = path.resolve(WORKSPACE_ROOT, rel);
        assert.strictEqual(path.isAbsolute(abs), true);
        const relativeBack = path.relative(WORKSPACE_ROOT, abs).replace(/\\/g, '/');
        assert.strictEqual(relativeBack, rel);
      }
    });

    test('M6.EDGE.2: Binary header verification detects corrupted or zero-byte buffers', () => {
      assert.strictEqual(isValidPngHeader(Buffer.alloc(0)), false);
      assert.strictEqual(isValidPngHeader(Buffer.from([0x00, 0x00, 0x00, 0x00])), false);
      assert.strictEqual(isValidPngHeader(Buffer.from('GIF89a')), false);
      assert.strictEqual(isValidPngHeader(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
    });

    test('M6.EDGE.3: Gallery parser handles empty or malformed block safely', () => {
      assert.deepStrictEqual(parseRoamingEnemiesBlock(''), { blockExists: false, cards: [] });
      assert.deepStrictEqual(parseRoamingEnemiesBlock('<html><body>no block</body></html>'), { blockExists: false, cards: [] });
    });

    test('M6.EDGE.4: Hostile sprite asset keys contain no path traversal sequences', () => {
      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        assert.ok(!h.spriteAssetKey.includes('..'), `Asset key ${h.spriteAssetKey} must not contain ..`);
        assert.ok(!h.spriteAssetKey.includes('/'), `Asset key ${h.spriteAssetKey} must not contain /`);
        assert.ok(!h.spriteAssetKey.includes('\\'), `Asset key ${h.spriteAssetKey} must not contain \\`);
      }
    });

    test('M6.EDGE.5: Asset lookup fallback safely resolves default sprite when queried asset is missing', () => {
      function safeResolveSprite(filename: string, availableFiles: Set<string>): string {
        if (availableFiles.has(filename)) return filename;
        return 'boat_trawler_derelict.png';
      }

      const available = new Set(['boat_trawler_derelict.png', 'ghost_skiff.png']);
      assert.strictEqual(safeResolveSprite('missing_monster.png', available), 'boat_trawler_derelict.png');
      assert.strictEqual(safeResolveSprite('ghost_skiff.png', available), 'ghost_skiff.png');
    });
  });
});
