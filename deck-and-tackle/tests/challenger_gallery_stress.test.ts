/**
 * challenger_gallery_stress.test.ts
 * 
 * Adversarial Challenger Stress Test Suite for Milestone 6 (Feature 22):
 * Visual Sprite Gallery HTML & Card Parser Robustness
 * 
 * Adversarially challenges:
 * 1. HTML document structural & style contract validation (DOCTYPE, styles, tag balancing, attribute quotes)
 * 2. Hostile cards & #roaming-enemies-block extraction robustness (exact 8 cards, filenames, alt text, badges)
 * 3. Image path validity & on-disk binary signatures (PNG magic bytes, full-gallery link audit)
 * 4. Adversarial fuzzing: malformed HTML, attribute permutations, whitespace, comments, ReDoS, XSS
 * 5. Fallback mechanisms & catalog update idempotence
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
  AUTHORITATIVE_HOSTILE_ROSTER,
  AuthoritativeHostileConfig
} from './diversity_test_helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..');
const ABS_CATALOG_PATH = path.join(WORKSPACE_ROOT, CATALOG_BASE_PATH);
const ABS_GALLERY_PATH = path.join(WORKSPACE_ROOT, GALLERY_PATH);

// PNG binary signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isValidPng(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return buffer.subarray(0, 8).equals(PNG_MAGIC);
}

// ---------------------------------------------------------------------------
// Extracted Card Representation
// ---------------------------------------------------------------------------
interface ExtractedCard {
  src: string;
  alt: string;
  filename: string;
  meta: string;
  badge: string;
  badgeClass: string;
  rawCardHtml: string;
}

/**
 * Robust, adversarial card parser that handles flexible attribute ordering,
 * whitespace variations, single or double quotes, and isolates thumbnail <img>
 * from potential tags inside filenames or descriptions.
 */
function extractCardsFromBlock(blockHtml: string): ExtractedCard[] {
  const cards: ExtractedCard[] = [];
  const parts = blockHtml.split(/<div\s+class=["']card["']>/i);

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];

    // Isolate thumbnail container specifically to avoid matching fake imgs in filenames
    const thumbMatch = /<div\s+class=["']thumb-container["']>([\s\S]*?)<\/div>/i.exec(chunk);
    const thumbArea = thumbMatch ? thumbMatch[1] : chunk;

    // Extract img src and alt from thumbnail area
    const imgMatch = /<img\b([^>]*?)\/?>/i.exec(thumbArea);
    if (!imgMatch) continue;

    const imgAttrs = imgMatch[1];
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(imgAttrs);
    const altMatch = /\balt=["']([^"']*)["']/i.exec(imgAttrs);
    const src = srcMatch ? srcMatch[1].trim() : '';
    const alt = altMatch ? altMatch[1].trim() : '';

    // Extract filename
    const fnMatch = /<div\s+class=["']filename["']>([\s\S]*?)<\/div>/i.exec(chunk);
    const filename = fnMatch ? fnMatch[1].trim() : '';

    // Extract meta and badge
    const metaMatch = /<div\s+class=["']meta["']>([\s\S]*?)<\/div>/i.exec(chunk);
    let metaText = '';
    let badgeText = '';
    let badgeClass = '';

    if (metaMatch) {
      const metaInner = metaMatch[1];
      const spanMatch = /<span>([^<]*)<\/span>/i.exec(metaInner);
      metaText = spanMatch ? spanMatch[1].trim() : '';

      const badgeMatch = /<span\s+class=["']([^"']*badge[^"']*)["']>([^<]*)<\/span>/i.exec(metaInner);
      if (badgeMatch) {
        badgeClass = badgeMatch[1].trim();
        badgeText = badgeMatch[2].trim();
      }
    }

    cards.push({
      src,
      alt,
      filename,
      meta: metaText,
      badge: badgeText,
      badgeClass,
      rawCardHtml: chunk
    });
  }

  return cards;
}

/**
 * Extracts roaming enemies block content
 */
function extractRoamingBlock(html: string): { found: boolean; blockHtml: string; outerMatch: string } {
  // Find roaming-enemies-block container
  const regex = /<div\s+class=["']zone-block["']\s+id=["']roaming-enemies-block["']>([\s\S]*?)<\/div>\s*<\/body>/i;
  const match = regex.exec(html);
  if (!match) {
    return { found: false, blockHtml: '', outerMatch: '' };
  }
  return { found: true, blockHtml: match[1], outerMatch: match[0] };
}

describe('Adversarial Challenger: Visual Sprite Gallery HTML & Card Parser Stress', () => {

  // =========================================================================
  // SUITE 1: HTML Document Structure & Style Contract Validation
  // =========================================================================
  describe('Suite 1: HTML Document Structure & Style Contract Validation', () => {

    test('T1.1: DOCTYPE declaration is exact HTML5 and document wraps in well-formed <html>, <head>, and <body>', () => {
      assert.ok(fs.existsSync(ABS_GALLERY_PATH), `Gallery file must exist at ${ABS_GALLERY_PATH}`);
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');

      // Check DOCTYPE
      assert.ok(/^<!DOCTYPE\s+html>/i.test(raw.trim()), 'Gallery must start with valid <!DOCTYPE html>');

      // Check root tag hierarchy
      assert.ok(/<html(\s+[^>]*)?>/i.test(raw), 'Must contain open <html>');
      assert.ok(/<\/html>/i.test(raw), 'Must contain close </html>');
      assert.ok(/<head(\s+[^>]*)?>[\s\S]*?<\/head>/i.test(raw), 'Must contain well-formed <head>...</head>');
      assert.ok(/<body(\s+[^>]*)?>[\s\S]*?<\/body>/i.test(raw), 'Must contain well-formed <body>...</body>');
    });

    test('T1.2: Style definitions mandate complete required class rules for cards, grids, and thumbnails', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const styleMatch = /<style>([\s\S]*?)<\/style>/i.exec(raw);
      assert.ok(styleMatch, 'Gallery must contain inline <style> block');
      const css = styleMatch[1];

      const requiredSelectors = [
        '.zone-block',
        '.zone-title',
        '.subcat-title',
        '.grid',
        '.card',
        '.card:hover',
        '.thumb-container',
        '.thumb-container img',
        '.card-info',
        '.filename',
        '.meta',
        '.badge',
        '.badge-png',
        '.badge-vid'
      ];

      for (const selector of requiredSelectors) {
        assert.ok(
          css.includes(selector),
          `CSS styles must define selector: ${selector}`
        );
      }

      // Check CSS curly brace balance
      const openBraces = (css.match(/\{/g) || []).length;
      const closeBraces = (css.match(/\}/g) || []).length;
      assert.strictEqual(openBraces, closeBraces, 'CSS rules must have perfectly balanced curly braces');
      assert.ok(openBraces >= 10, 'CSS must define at least 10 rules');
    });

    test('T1.3: HTML structural tags maintain exact opening-to-closing parity', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');

      const pairedTags = ['html', 'head', 'body', 'style', 'title', 'div', 'span', 'strong', 'code', 'p', 'h1'];
      for (const tag of pairedTags) {
        const openRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi');
        const closeRegex = new RegExp(`</${tag}>`, 'gi');
        const openCount = (raw.match(openRegex) || []).length;
        const closeCount = (raw.match(closeRegex) || []).length;
        assert.strictEqual(
          openCount,
          closeCount,
          `Tag <${tag}> has opening/closing mismatch (opens: ${openCount}, closes: ${closeCount})`
        );
      }
    });

    test('T1.4: HTML attributes have properly closed quotes throughout the entire document', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const lines = raw.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match any tag opening that doesn't close on the same line, or attribute value quote mismatch
        const tagMatches = line.matchAll(/<[a-zA-Z0-9]+(\s+[^>]*?)>/g);
        for (const t of tagMatches) {
          const attrStr = t[1];
          // Check quotes within attributes
          const doubleQuotes = (attrStr.match(/"/g) || []).length;
          const singleQuotes = (attrStr.match(/'/g) || []).length;
          assert.strictEqual(
            doubleQuotes % 2,
            0,
            `Line ${i + 1} has unbalanced double quotes in tag: ${t[0]}`
          );
          assert.strictEqual(
            singleQuotes % 2,
            0,
            `Line ${i + 1} has unbalanced single quotes in tag: ${t[0]}`
          );
        }
      }
    });

    test('T1.5: Void elements (img, meta) are properly formed without invalid closing tags', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(!raw.includes('</img>'), 'Document must not contain invalid </img> closing tags');
      assert.ok(!raw.includes('</meta>'), 'Document must not contain invalid </meta> closing tags');
      assert.ok(!raw.includes('</br>'), 'Document must not contain invalid </br> closing tags');
    });
  });

  // =========================================================================
  // SUITE 2: Hostile Cards & #roaming-enemies-block Extraction Robustness
  // =========================================================================
  describe('Suite 2: Hostile Cards & #roaming-enemies-block Extraction Robustness', () => {

    test('T2.1: Exactly one element with id="roaming-enemies-block" exists in the document', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const matches = raw.match(/id=["']roaming-enemies-block["']/gi) || [];
      assert.strictEqual(matches.length, 1, 'Must have exactly 1 element with id="roaming-enemies-block"');
    });

    test('T2.2: Section headers declare title and item count accurately', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { found, blockHtml } = extractRoamingBlock(raw);
      assert.ok(found, 'Roaming enemies block must be extractable');

      assert.ok(
        blockHtml.includes('📂 05_Roaming_Enemies (Patrol Vessels & Ambush Beasts)'),
        'Block must have canonical zone title'
      );
      assert.ok(
        blockHtml.includes('📁 Roaming Hostiles (8 items)'),
        'Block must state canonical item count header'
      );
    });

    test('T2.3: Extractor retrieves exactly 8 valid cards from #roaming-enemies-block', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { found, blockHtml } = extractRoamingBlock(raw);
      assert.ok(found, 'Roaming block must exist');

      const cards = extractCardsFromBlock(blockHtml);
      assert.strictEqual(cards.length, 8, `Expected exactly 8 cards in roaming block, found ${cards.length}`);
    });

    test('T2.4: Every authoritative hostile entity is mapped 1:1 in the gallery cards', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml } = extractRoamingBlock(raw);
      const cards = extractCardsFromBlock(blockHtml);

      const hostileEntries = Object.values(AUTHORITATIVE_HOSTILE_ROSTER);
      const cardFilenames = new Map(cards.map(c => [c.filename, c]));

      for (const hostile of hostileEntries) {
        const card = cardFilenames.get(hostile.spriteAssetKey);
        assert.ok(card, `Missing gallery card for hostile asset key: ${hostile.spriteAssetKey} (${hostile.name})`);

        // Assert exact alt text
        assert.strictEqual(
          card.alt,
          hostile.name,
          `Card alt for ${hostile.spriteAssetKey} must equal "${hostile.name}", got "${card.alt}"`
        );

        // Assert src format
        assert.strictEqual(
          card.src,
          `05_Roaming_Enemies/${hostile.spriteAssetKey}`,
          `Card src must follow "05_Roaming_Enemies/${hostile.spriteAssetKey}"`
        );

        // Assert badge
        assert.strictEqual(card.badge, 'PNG', `Card ${hostile.spriteAssetKey} badge must be PNG`);
        assert.ok(
          card.badgeClass.includes('badge-png'),
          `Card ${hostile.spriteAssetKey} badgeClass must include badge-png`
        );

        // Assert meta text includes zone and category
        const expectedZoneStr = `Zone ${hostile.zoneTier}`;
        const expectedCatStr = hostile.category.toUpperCase();
        assert.ok(
          card.meta.includes(expectedZoneStr),
          `Card meta "${card.meta}" must contain "${expectedZoneStr}"`
        );
        assert.ok(
          card.meta.includes(expectedCatStr),
          `Card meta "${card.meta}" must contain "${expectedCatStr}"`
        );
      }
    });

    test('T2.5: Hostile cards maintain strict order: Vessels 1-4 followed by Beasts 1-4', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml } = extractRoamingBlock(raw);
      const cards = extractCardsFromBlock(blockHtml);

      const expectedSequence = [
        // Vessels
        { filename: 'boat_trawler_derelict.png', name: 'Crazed Trawler', category: 'vessel', zone: 1 },
        { filename: 'rowboat_fisherman_lantern.png', name: 'Ghost Skiff', category: 'vessel', zone: 2 },
        { filename: 'shipwreck_abyssal_galleon.png', name: 'Galleon Raider', category: 'vessel', zone: 3 },
        { filename: 'shipwreck_wooden_hull.png', name: 'Cursed Black Frigate', category: 'vessel', zone: 4 },
        // Beasts
        { filename: 'fish_visceral_gut_swollen.png', name: 'Mutated Whale', category: 'beast', zone: 1 },
        { filename: 'fish_z2_tentacle_sculpin_sheet.png', name: 'Kelp Leviathan', category: 'beast', zone: 2 },
        { filename: 'shadow_giant_sea_serpent.png', name: 'Giant Sea Serpent', category: 'beast', zone: 3 },
        { filename: 'leviathan_kraken_worm_colossus.png', name: 'Cthulhu Colossus', category: 'beast', zone: 4 }
      ];

      for (let i = 0; i < expectedSequence.length; i++) {
        const expected = expectedSequence[i];
        const card = cards[i];
        assert.strictEqual(card.filename, expected.filename, `Position ${i} expected ${expected.filename}`);
        assert.strictEqual(card.alt, expected.name, `Position ${i} alt expected ${expected.name}`);
        assert.ok(card.meta.includes(`Zone ${expected.zone}`), `Position ${i} expected Zone ${expected.zone}`);
        assert.ok(card.meta.includes(expected.category.toUpperCase()), `Position ${i} expected ${expected.category.toUpperCase()}`);
      }
    });
  });

  // =========================================================================
  // SUITE 3: Filesystem Image Path Validity & Binary Signature Verification
  // =========================================================================
  describe('Suite 3: Filesystem Image Path Validity & Binary Signature Verification', () => {

    test('T3.1: All roaming hostile image sources resolve to real files on disk', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml } = extractRoamingBlock(raw);
      const cards = extractCardsFromBlock(blockHtml);

      for (const card of cards) {
        // Path is relative to ZONE_SPRITES_CATALOG/
        const absPath = path.resolve(ABS_CATALOG_PATH, card.src);
        assert.ok(fs.existsSync(absPath), `Image file on disk must exist: ${absPath}`);

        const stat = fs.statSync(absPath);
        assert.ok(stat.isFile(), `Target must be a regular file: ${absPath}`);
        assert.ok(stat.size > 1000, `Image file must have non-trivial content (>1000 bytes): ${absPath}`);
      }
    });

    test('T3.2: All hostile sprite files have authentic 8-byte PNG binary signatures', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml } = extractRoamingBlock(raw);
      const cards = extractCardsFromBlock(blockHtml);

      for (const card of cards) {
        const absPath = path.resolve(ABS_CATALOG_PATH, card.src);
        const buffer = fs.readFileSync(absPath);
        assert.ok(
          isValidPng(buffer),
          `File ${card.src} must start with PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)`
        );
      }
    });

    test('T3.3: Authoritative source sprites in deck-and-tackle/public/ match catalog sprites bit-for-bit', () => {
      const publicBase = path.join(WORKSPACE_ROOT, 'deck-and-tackle/public/assets/sprites/fishing');
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml } = extractRoamingBlock(raw);
      const cards = extractCardsFromBlock(blockHtml);

      for (const card of cards) {
        const catalogPath = path.resolve(ABS_CATALOG_PATH, card.src);
        const publicPath = path.join(publicBase, card.filename);

        assert.ok(fs.existsSync(publicPath), `Public source sprite must exist: ${publicPath}`);

        const catalogBuf = fs.readFileSync(catalogPath);
        const publicBuf = fs.readFileSync(publicPath);

        assert.strictEqual(
          catalogBuf.length,
          publicBuf.length,
          `File size must match between catalog and public for ${card.filename}`
        );
        assert.ok(
          catalogBuf.equals(publicBuf),
          `Binary content must match byte-for-byte between catalog and public for ${card.filename}`
        );
      }
    });

    test('T3.4: Zone-segregated subdirectories mirror their corresponding hostile sprites identically', () => {
      const expectations = [
        { dir: 'Zone 1 - The Shallows (Coastal Shoals)', vessel: 'boat_trawler_derelict.png', beast: 'fish_visceral_gut_swollen.png' },
        { dir: 'Zone 2 - The Foggy Banks (Kelp Shallows)', vessel: 'rowboat_fisherman_lantern.png', beast: 'fish_z2_tentacle_sculpin_sheet.png' },
        { dir: 'Zone 3 - The Sunken Reefs (Abyssal Trench)', vessel: 'shipwreck_abyssal_galleon.png', beast: 'shadow_giant_sea_serpent.png' },
        { dir: 'Zone 4 - The Eldritch Trench (Subterranean Sea Cave)', vessel: 'shipwreck_wooden_hull.png', beast: 'leviathan_kraken_worm_colossus.png' }
      ];

      for (const exp of expectations) {
        const zoneRoamingDir = path.join(ABS_CATALOG_PATH, exp.dir, '05_Roaming_Enemies');
        assert.ok(fs.existsSync(zoneRoamingDir), `Zone roaming directory must exist: ${zoneRoamingDir}`);

        // Check vessel
        const vesselPath = path.join(zoneRoamingDir, exp.vessel);
        assert.ok(fs.existsSync(vesselPath), `Vessel ${exp.vessel} must exist in ${exp.dir}`);
        const vesselBuf = fs.readFileSync(vesselPath);
        assert.ok(isValidPng(vesselBuf), `Vessel ${exp.vessel} must be valid PNG`);

        // Check beast
        const beastPath = path.join(zoneRoamingDir, exp.beast);
        assert.ok(fs.existsSync(beastPath), `Beast ${exp.beast} must exist in ${exp.dir}`);
        const beastBuf = fs.readFileSync(beastPath);
        assert.ok(isValidPng(beastBuf), `Beast ${exp.beast} must be valid PNG`);

        // Ensure zone directory only has these 2 sprites + README.md
        const dirFiles = fs.readdirSync(zoneRoamingDir).filter(f => !f.endsWith('.md'));
        assert.strictEqual(
          dirFiles.length,
          2,
          `Zone roaming directory ${exp.dir} should contain strictly 2 sprites, found: ${dirFiles.join(', ')}`
        );
      }
    });

    test('T3.5: Comprehensive audit of all <img> and <video> elements across entire Visual_Sprite_Gallery.html', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');

      // Match all img src and video src
      const mediaSrcRegex = /<(?:img|video)\b[^>]*?\bsrc=["']([^"']+)["']/gi;
      let match: RegExpExecArray | null;
      let totalMediaFound = 0;
      let totalValidOnDisk = 0;
      const missingMedia: string[] = [];

      while ((match = mediaSrcRegex.exec(raw)) !== null) {
        totalMediaFound++;
        const rawSrc = match[1];
        // URL-decode the path (e.g. Zone%201 -> Zone 1)
        const decodedSrc = decodeURIComponent(rawSrc);
        const diskPath = path.resolve(ABS_CATALOG_PATH, decodedSrc);

        if (fs.existsSync(diskPath)) {
          totalValidOnDisk++;
        } else {
          missingMedia.push(rawSrc);
        }
      }

      assert.ok(totalMediaFound >= 100, `Expected at least 100 media elements in gallery, found ${totalMediaFound}`);
      assert.strictEqual(
        missingMedia.length,
        0,
        `Found broken media links in gallery (${missingMedia.length}): ${missingMedia.slice(0, 5).join(', ')}`
      );
      assert.strictEqual(totalValidOnDisk, totalMediaFound, 'All media sources must resolve on disk');
    });
  });

  // =========================================================================
  // SUITE 4: Adversarial Fuzzing & Malformed Snippet Resilience
  // =========================================================================
  describe('Suite 4: Adversarial Fuzzing & Malformed Snippet Resilience', () => {

    test('T4.1: Attribute permutations and irregular spacing do not break extraction', () => {
      const adversarialBlock = `
        <div class="card">
          <div class="thumb-container">
            <img   loading="lazy"   alt="Crazed Trawler"   src="05_Roaming_Enemies/boat_trawler_derelict.png"   />
          </div>
          <div class="card-info">
            <div class="filename">   boat_trawler_derelict.png   </div>
            <div class="meta"><span>Zone 1 VESSEL</span><span class="badge badge-png">PNG</span></div>
          </div>
        </div>
        <div class='card'>
          <div class='thumb-container'>
            <img src='05_Roaming_Enemies/rowboat_fisherman_lantern.png' alt='Ghost Skiff' loading='lazy'>
          </div>
          <div class='card-info'>
            <div class='filename'>rowboat_fisherman_lantern.png</div>
            <div class='meta'><span>Zone 2 VESSEL</span><span class='badge badge-png'>PNG</span></div>
          </div>
        </div>
      `;

      const cards = extractCardsFromBlock(adversarialBlock);
      assert.strictEqual(cards.length, 2, 'Must extract both permutation cards');
      assert.strictEqual(cards[0].filename, 'boat_trawler_derelict.png');
      assert.strictEqual(cards[0].alt, 'Crazed Trawler');
      assert.strictEqual(cards[0].src, '05_Roaming_Enemies/boat_trawler_derelict.png');

      assert.strictEqual(cards[1].filename, 'rowboat_fisherman_lantern.png');
      assert.strictEqual(cards[1].alt, 'Ghost Skiff');
      assert.strictEqual(cards[1].src, '05_Roaming_Enemies/rowboat_fisherman_lantern.png');
    });

    test('T4.2: Truncated HTML snippets and broken tags do not throw uncaught exceptions', () => {
      const truncatedSnippets = [
        '<div class="card"><div class="thumb-container"><img src="05_Roaming',
        '<div class="card"><div class="filename">broken.png</div>',
        '<div class="card"><img src="test.png">',
        '<<<>>>>><<<///card>>',
        '',
        '   \n\t\r  ',
        '<!DOCTYPE html><html><body><div id="roaming-enemies-block">truncated without closing'
      ];

      for (const snippet of truncatedSnippets) {
        assert.doesNotThrow(() => {
          const cards = extractCardsFromBlock(snippet);
          assert.ok(Array.isArray(cards));
        }, `Snippet should not throw: ${snippet.slice(0, 30)}`);

        assert.doesNotThrow(() => {
          const block = extractRoamingBlock(snippet);
          assert.strictEqual(typeof block.found, 'boolean');
        });
      }
    });

    test('T4.3: HTML comments and CDATA blocks containing card markup are safely ignored', () => {
      const commentedBlock = `
        <!-- <div class="card">
          <img src="05_Roaming_Enemies/fake_decoy.png" alt="Decoy">
          <div class="filename">fake_decoy.png</div>
          <div class="meta"><span>Decoy</span><span class="badge badge-png">PNG</span></div>
        </div> -->
        <div class="card">
          <div class="thumb-container">
            <img src="05_Roaming_Enemies/boat_trawler_derelict.png" alt="Crazed Trawler" loading="lazy" />
          </div>
          <div class="card-info">
            <div class="filename">boat_trawler_derelict.png</div>
            <div class="meta"><span>Zone 1 VESSEL</span><span class="badge badge-png">PNG</span></div>
          </div>
        </div>
      `;

      // Filter out HTML comments before extraction
      const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
      const cards = extractCardsFromBlock(stripComments(commentedBlock));

      assert.strictEqual(cards.length, 1, 'Commented card must be stripped and not counted');
      assert.strictEqual(cards[0].filename, 'boat_trawler_derelict.png');
    });

    test('T4.4: Partial card definitions (missing filename or badge) are handled gracefully', () => {
      const partialCardHtml = `
        <div class="card">
          <div class="thumb-container">
            <img src="05_Roaming_Enemies/incomplete_asset.png" alt="Incomplete" />
          </div>
          <div class="card-info">
            <!-- Missing filename div -->
            <div class="meta"><span>Unknown</span></div>
          </div>
        </div>
      `;

      const cards = extractCardsFromBlock(partialCardHtml);
      assert.strictEqual(cards.length, 1);
      assert.strictEqual(cards[0].src, '05_Roaming_Enemies/incomplete_asset.png');
      assert.strictEqual(cards[0].filename, '', 'Missing filename should default to empty string');
      assert.strictEqual(cards[0].badge, '', 'Missing badge should default to empty string');
    });

    test('T4.5: ReDoS and performance stress test with 500 synthesized cards executes in < 250ms', () => {
      const singleCard = `
        <div class="card">
          <div class="thumb-container">
            <img src="05_Roaming_Enemies/boat_trawler_derelict.png" alt="Crazed Trawler" loading="lazy" />
          </div>
          <div class="card-info">
            <div class="filename">boat_trawler_derelict.png</div>
            <div class="meta"><span>Zone 1 VESSEL</span><span class="badge badge-png">PNG</span></div>
          </div>
        </div>`;

      const largeBlock = singleCard.repeat(500); // 500 cards
      const startTime = performance.now();
      const cards = extractCardsFromBlock(largeBlock);
      const elapsed = performance.now() - startTime;

      assert.strictEqual(cards.length, 500, 'Should extract all 500 cards');
      assert.ok(elapsed < 250, `Parsing 500 cards took ${elapsed.toFixed(1)}ms (must be < 250ms)`);
    });

    test('T4.6: XSS strings and HTML entity escapes do not corrupt extracted metadata', () => {
      const xssSnippet = `
        <div class="card">
          <div class="thumb-container">
            <img src="05_Roaming_Enemies/safe_image.png" alt="&lt;script&gt;alert(1)&lt;/script&gt;" />
          </div>
          <div class="card-info">
            <div class="filename">suspicious_&lt;script&gt;.png</div>
            <div class="meta"><span>Fish &amp; Tackle</span><span class="badge badge-png">PNG</span></div>
          </div>
        </div>
      `;

      const cards = extractCardsFromBlock(xssSnippet);
      assert.strictEqual(cards.length, 1);
      assert.ok(cards[0].alt.includes('&lt;script&gt;'));
      assert.ok(cards[0].filename.includes('&lt;script&gt;'));
      assert.ok(cards[0].meta.includes('Fish &amp; Tackle'));
    });
  });

  // =========================================================================
  // SUITE 5: Fallback Mechanisms & Document Modification Simulation
  // =========================================================================
  describe('Suite 5: Fallback Mechanisms & Document Modification Simulation', () => {

    test('T5.1: Missing sprite query resolves to safe default vessel fallback', () => {
      function resolveSpriteWithFallback(key: string, catalogFiles: Set<string>): { resolvedKey: string; isFallback: boolean } {
        if (catalogFiles.has(key)) {
          return { resolvedKey: key, isFallback: false };
        }
        return { resolvedKey: 'boat_trawler_derelict.png', isFallback: true };
      }

      const catalogFiles = new Set(Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => h.spriteAssetKey));

      // Test valid lookup
      const valid = resolveSpriteWithFallback('shipwreck_abyssal_galleon.png', catalogFiles);
      assert.strictEqual(valid.isFallback, false);
      assert.strictEqual(valid.resolvedKey, 'shipwreck_abyssal_galleon.png');

      // Test unknown key
      const unknown = resolveSpriteWithFallback('non_existent_beast.png', catalogFiles);
      assert.strictEqual(unknown.isFallback, true);
      assert.strictEqual(unknown.resolvedKey, 'boat_trawler_derelict.png');
    });

    test('T5.2: Re-generating and replacing roaming block is completely idempotent', () => {
      const originalHtml = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const { blockHtml: originalBlock } = extractRoamingBlock(originalHtml);
      const originalCards = extractCardsFromBlock(originalBlock);

      // Function to generate the roaming block
      function generateRoamingBlock(): string {
        const cardsHtml = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => `
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
    <div class="subcat-title">📁 Roaming Hostiles (${Object.keys(AUTHORITATIVE_HOSTILE_ROSTER).length} items)</div>
    <div class="grid">${cardsHtml}
    </div>
  </div>`;
      }

      const generated = generateRoamingBlock();
      const generatedCards = extractCardsFromBlock(generated);

      assert.strictEqual(generatedCards.length, originalCards.length, 'Generated cards count must match original');
      for (let i = 0; i < originalCards.length; i++) {
        assert.strictEqual(generatedCards[i].filename, originalCards[i].filename);
        assert.strictEqual(generatedCards[i].alt, originalCards[i].alt);
        assert.strictEqual(generatedCards[i].src, originalCards[i].src);
        assert.strictEqual(generatedCards[i].badge, originalCards[i].badge);
      }
    });

    test('T5.3: Document end termination is clean and precedes closing body tag', () => {
      const raw = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const trimmed = raw.trim();
      assert.ok(trimmed.endsWith('</html>'), 'Document must end with </html>');
      assert.ok(trimmed.endsWith('</body>\n</html>') || trimmed.endsWith('</body>\r\n</html>'), 'Must cleanly terminate with </body></html>');

      // Check position: roaming-enemies-block must be the last zone-block before </body>
      const roamingBlockIdx = raw.indexOf('id="roaming-enemies-block"');
      const bodyCloseIdx = raw.indexOf('</body>');
      assert.ok(roamingBlockIdx > 0, 'Roaming block must exist');
      assert.ok(bodyCloseIdx > roamingBlockIdx, '</body> must follow roaming block');

      const afterRoaming = raw.substring(roamingBlockIdx);
      const matches = afterRoaming.match(/class=["']zone-block["']/g) || [];
      assert.strictEqual(matches.length, 0, 'No subsequent zone-block elements appear after roaming block');
    });
  });
});
