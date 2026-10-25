/**
 * challenger_catalog_stress.test.ts
 * Adversarial Challenger Stress Test Suite for Milestone 6:
 * Enemy Sprite Catalog Folders & Assets (Feature 21 & Feature 22)
 *
 * Scope:
 * 1. Absolute & relative directory resolution across Windows/POSIX path styles for all 5 EXPECTED_ROAMING_CATALOG_DIRS
 * 2. Binary header verification & IHDR chunk integrity for all 8 hostile sprites in root and zone folders
 * 3. Strict zone segregation, exclusion of foreign zone sprites, and zero cross-contamination
 * 4. Missing folder detection logic, traversal resilience, and fallback robustness
 * 5. Visual_Sprite_Gallery.html semantic structure, card asset link verification, and metadata integrity
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
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

// PNG standard magic signature: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Expected zone segregation specifications
const EXPECTED_ZONE_SEGREGATION: Record<number, { dirName: string; vessel: string; beast: string }> = {
  1: {
    dirName: 'Zone 1 - The Shallows (Coastal Shoals)',
    vessel: 'boat_trawler_derelict.png',
    beast: 'fish_visceral_gut_swollen.png'
  },
  2: {
    dirName: 'Zone 2 - The Foggy Banks (Kelp Shallows)',
    vessel: 'rowboat_fisherman_lantern.png',
    beast: 'fish_z2_tentacle_sculpin_sheet.png'
  },
  3: {
    dirName: 'Zone 3 - The Sunken Reefs (Abyssal Trench)',
    vessel: 'shipwreck_abyssal_galleon.png',
    beast: 'shadow_giant_sea_serpent.png'
  },
  4: {
    dirName: 'Zone 4 - The Eldritch Trench (Subterranean Sea Cave)',
    vessel: 'shipwreck_wooden_hull.png',
    beast: 'leviathan_kraken_worm_colossus.png'
  }
};

/**
 * Validates PNG 8-byte magic header
 */
function isValidPngMagic(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return buffer.subarray(0, 8).equals(PNG_MAGIC);
}

/**
 * Validates PNG IHDR chunk (chunk length 13, type 'IHDR', width > 0, height > 0)
 */
interface PngIhdrInfo {
  valid: boolean;
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

function parsePngIhdr(buffer: Buffer): PngIhdrInfo {
  if (buffer.length < 29 || !isValidPngMagic(buffer)) {
    return { valid: false, width: 0, height: 0, bitDepth: 0, colorType: 0 };
  }

  // Chunk length (bytes 8-11)
  const chunkLength = buffer.readUInt32BE(8);
  // Chunk type (bytes 12-15) must be "IHDR"
  const chunkType = buffer.toString('ascii', 12, 16);

  if (chunkLength !== 13 || chunkType !== 'IHDR') {
    return { valid: false, width: 0, height: 0, bitDepth: 0, colorType: 0 };
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  return {
    valid: width > 0 && height > 0,
    width,
    height,
    bitDepth,
    colorType
  };
}

/**
 * Calculates SHA-256 hash of a file or buffer
 */
function sha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

describe('Adversarial Challenger: Enemy Sprite Catalog & Assets Stress', () => {

  // ==========================================================================
  // SUITE 1: Path Resolution & Normalization Stress Across Windows/POSIX Styles
  // ==========================================================================
  describe('Suite 1: Path Resolution Across Windows/POSIX Styles & Normalization', () => {

    test('All 5 EXPECTED_ROAMING_CATALOG_DIRS resolve consistently across relative and absolute forms', () => {
      assert.strictEqual(EXPECTED_ROAMING_CATALOG_DIRS.length, 5, 'Must test exactly 5 roaming catalog directories');

      for (const relPath of EXPECTED_ROAMING_CATALOG_DIRS) {
        // 1. Resolve relative to workspace root
        const absFromRoot = path.resolve(WORKSPACE_ROOT, relPath);
        assert.ok(path.isAbsolute(absFromRoot), `Path must be absolute: ${absFromRoot}`);
        assert.ok(fs.existsSync(absFromRoot), `Directory must exist on disk: ${absFromRoot}`);
        const stat = fs.statSync(absFromRoot);
        assert.ok(stat.isDirectory(), `Path must be a directory: ${absFromRoot}`);

        // 2. Resolve relative to deck-and-tackle package directory
        const absFromPkg = path.resolve(__dirname, '..', '..', relPath);
        assert.strictEqual(absFromPkg, absFromRoot, 'Resolution from nested directory must match root resolution');

        // 3. Resolve using relative dot-segments (./ and ../)
        const dotSegmented = path.resolve(WORKSPACE_ROOT, '.', relPath);
        assert.strictEqual(dotSegmented, absFromRoot, 'Dot segment normalization must match');
      }
    });

    test('Path separators normalization: POSIX forward slashes, Windows backslashes, and mixed slashes', () => {
      for (const relPath of EXPECTED_ROAMING_CATALOG_DIRS) {
        // POSIX style
        const posixStyle = relPath.replace(/\\/g, '/');
        // Windows style
        const winStyle = relPath.replace(/\//g, '\\');
        // Mixed style (alternating)
        const mixedStyle = relPath.split('/').join('\\/').replace(/\\\/05_/g, '/05_');

        const resolvedPosix = path.resolve(WORKSPACE_ROOT, posixStyle);
        const resolvedWin = path.resolve(WORKSPACE_ROOT, winStyle);

        assert.strictEqual(resolvedPosix, resolvedWin, 'POSIX and Windows path resolution must yield identical paths');
        assert.ok(fs.existsSync(resolvedPosix), `POSIX resolved path must exist: ${resolvedPosix}`);
        assert.ok(fs.existsSync(resolvedWin), `Windows resolved path must exist: ${resolvedWin}`);

        // Ensure normalized paths do not contain unnormalized duplicate slashes
        const normalized = path.normalize(mixedStyle);
        assert.ok(!normalized.includes('//') && !normalized.includes('\\\\'), `Normalized path ${normalized} must not contain double separators`);
      }
    });

    test('Redundant separators and parent traversal normalization are safely sanitized', () => {
      for (const relPath of EXPECTED_ROAMING_CATALOG_DIRS) {
        // Path with redundant separators
        const redundant = relPath.replace('ZONE_SPRITES_CATALOG', 'ZONE_SPRITES_CATALOG///');
        const normalizedRedundant = path.normalize(redundant);
        const resolvedRedundant = path.resolve(WORKSPACE_ROOT, normalizedRedundant);
        assert.ok(fs.existsSync(resolvedRedundant), `Redundant slash path must resolve cleanly: ${resolvedRedundant}`);

        // Path with internal backtracking
        const backtracked = `ZONE_SPRITES_CATALOG/fake_subdir/../${relPath.replace('ZONE_SPRITES_CATALOG/', '')}`;
        const resolvedBacktracked = path.resolve(WORKSPACE_ROOT, backtracked);
        assert.ok(fs.existsSync(resolvedBacktracked), `Backtracked path must resolve to real directory: ${resolvedBacktracked}`);
      }
    });

    test('Directory names exactly match disk casing without case mutation drift', () => {
      // Read directory names directly from disk to confirm casing fidelity
      const catalogChildren = fs.readdirSync(ABS_CATALOG_PATH);

      for (let tier = 1; tier <= 4; tier++) {
        const expectedZoneFolder = EXPECTED_ZONE_SEGREGATION[tier].dirName;
        assert.ok(
          catalogChildren.includes(expectedZoneFolder),
          `Disk must contain exact case-sensitive zone directory: "${expectedZoneFolder}"`
        );

        // Verify child folder 05_Roaming_Enemies casing
        const zonePath = path.join(ABS_CATALOG_PATH, expectedZoneFolder);
        const zoneChildren = fs.readdirSync(zonePath);
        assert.ok(
          zoneChildren.includes('05_Roaming_Enemies'),
          `Zone ${tier} must contain exact case-sensitive subfolder "05_Roaming_Enemies"`
        );
      }

      assert.ok(
        catalogChildren.includes('05_Roaming_Enemies'),
        'Root catalog must contain exact case-sensitive folder "05_Roaming_Enemies"'
      );
    });

    test('URL-decoded vs literal space path resolution handles gallery image tags correctly', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const dirName = EXPECTED_ZONE_SEGREGATION[tier].dirName;
        const encoded = encodeURI(dirName);
        const decoded = decodeURI(encoded);
        assert.strictEqual(decoded, dirName, 'URL decode must restore exact folder name');

        const resolved = path.join(ABS_CATALOG_PATH, decoded, '05_Roaming_Enemies');
        assert.ok(fs.existsSync(resolved), `Decoded path must resolve to existing directory: ${resolved}`);
      }
    });
  });

  // ==========================================================================
  // SUITE 2: Deep Binary Header, IHDR Chunk & Image Integrity Verification
  // ==========================================================================
  describe('Suite 2: Binary Header, IHDR Chunk & Image Integrity Stress', () => {

    test('All 8 hostile sprites in root 05_Roaming_Enemies have valid 8-byte PNG magic header', () => {
      const rootDir = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies');
      assert.ok(fs.existsSync(rootDir), 'Root 05_Roaming_Enemies must exist');

      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        const filePath = path.join(rootDir, h.spriteAssetKey);
        assert.ok(fs.existsSync(filePath), `Hostile sprite ${h.spriteAssetKey} must exist in root 05_Roaming_Enemies`);

        const stat = fs.statSync(filePath);
        assert.ok(stat.size > 1000, `Sprite ${h.spriteAssetKey} size (${stat.size} bytes) must be substantial (>1000 bytes)`);

        const buffer = fs.readFileSync(filePath);
        assert.ok(isValidPngMagic(buffer), `File ${h.spriteAssetKey} failed 8-byte PNG magic header check`);
      }
    });

    test('All 8 hostile sprites in root 05_Roaming_Enemies possess valid, non-zero IHDR dimensions', () => {
      const rootDir = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies');

      for (const h of Object.values(AUTHORITATIVE_HOSTILE_ROSTER)) {
        const filePath = path.join(rootDir, h.spriteAssetKey);
        const buffer = fs.readFileSync(filePath);
        const ihdr = parsePngIhdr(buffer);

        assert.ok(ihdr.valid, `IHDR chunk invalid for ${h.spriteAssetKey}`);
        assert.ok(ihdr.width > 0, `Width must be > 0 for ${h.spriteAssetKey}, got ${ihdr.width}`);
        assert.ok(ihdr.height > 0, `Height must be > 0 for ${h.spriteAssetKey}, got ${ihdr.height}`);
        assert.ok([8, 16].includes(ihdr.bitDepth), `Bit depth must be standard (8 or 16), got ${ihdr.bitDepth}`);
        // Color type 2 (Truecolor) or 6 (Truecolor with alpha) typically
        assert.ok([0, 2, 3, 4, 6].includes(ihdr.colorType), `Color type must be valid PNG color type, got ${ihdr.colorType}`);
      }
    });

    test('All zone-specific hostile sprites (Zones 1-4) have valid PNG magic headers and IHDR dimensions', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const spec = EXPECTED_ZONE_SEGREGATION[tier];
        const zoneEnemiesDir = path.join(ABS_CATALOG_PATH, spec.dirName, '05_Roaming_Enemies');

        for (const filename of [spec.vessel, spec.beast]) {
          const filePath = path.join(zoneEnemiesDir, filename);
          assert.ok(fs.existsSync(filePath), `Zone ${tier} sprite must exist: ${filename}`);

          const buffer = fs.readFileSync(filePath);
          assert.ok(isValidPngMagic(buffer), `Zone ${tier} sprite ${filename} failed PNG magic header check`);

          const ihdr = parsePngIhdr(buffer);
          assert.ok(ihdr.valid, `Zone ${tier} sprite ${filename} failed IHDR validation`);
          assert.ok(ihdr.width > 0 && ihdr.height > 0, `Zone ${tier} sprite ${filename} must have positive dimensions`);
        }
      }
    });

    test('Byte-for-byte SHA-256 hash identity between zone-specific sprites and root catalog sprites', () => {
      const rootDir = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies');

      for (let tier = 1; tier <= 4; tier++) {
        const spec = EXPECTED_ZONE_SEGREGATION[tier];
        const zoneDir = path.join(ABS_CATALOG_PATH, spec.dirName, '05_Roaming_Enemies');

        for (const filename of [spec.vessel, spec.beast]) {
          const rootBuffer = fs.readFileSync(path.join(rootDir, filename));
          const zoneBuffer = fs.readFileSync(path.join(zoneDir, filename));

          const rootHash = sha256(rootBuffer);
          const zoneHash = sha256(zoneBuffer);

          assert.strictEqual(
            zoneHash,
            rootHash,
            `Sprite ${filename} in Zone ${tier} must be identical to root catalog copy (hash mismatch)`
          );
        }
      }
    });

    test('Adversarial fuzzing: PNG header validator rejects corrupted, non-PNG, and mutated buffers', () => {
      // 1. Zero-byte buffer
      assert.strictEqual(isValidPngMagic(Buffer.alloc(0)), false, 'Must reject 0-byte buffer');

      // 2. Truncated 7-byte buffer
      assert.strictEqual(isValidPngMagic(PNG_MAGIC.subarray(0, 7)), false, 'Must reject 7-byte buffer');

      // 3. Fake headers from other formats
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      assert.strictEqual(isValidPngMagic(jpegHeader), false, 'Must reject JPEG header');

      const gifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      assert.strictEqual(isValidPngMagic(gifHeader), false, 'Must reject GIF header');

      const textHeader = Buffer.from('<!DOCTYPE html><html>');
      assert.strictEqual(isValidPngMagic(textHeader), false, 'Must reject text/HTML header');

      // 4. Single-byte mutation at every header position (0 to 7)
      for (let i = 0; i < 8; i++) {
        const mutated = Buffer.from(PNG_MAGIC);
        mutated[i] = (mutated[i] + 1) % 256;
        assert.strictEqual(isValidPngMagic(mutated), false, `Must reject mutated byte at index ${i}`);
      }

      // 5. IHDR parser rejects corrupt IHDR chunk length or type
      const corruptTypeBuffer = Buffer.concat([PNG_MAGIC, Buffer.from([0, 0, 0, 13, 0x58, 0x59, 0x5a, 0x57])]); // "XYZW" instead of "IHDR"
      const res = parsePngIhdr(corruptTypeBuffer);
      assert.strictEqual(res.valid, false, 'Must reject non-IHDR chunk type');
    });
  });

  // ==========================================================================
  // SUITE 3: Strict Zone Segregation & Cross-Contamination Stress
  // ==========================================================================
  describe('Suite 3: Strict Zone Segregation & Zero Cross-Contamination', () => {

    test('Each zone directory contains strictly its assigned vessel and beast, with zero foreign sprites', () => {
      for (let tier = 1; tier <= 4; tier++) {
        const spec = EXPECTED_ZONE_SEGREGATION[tier];
        const zoneDir = path.join(ABS_CATALOG_PATH, spec.dirName, '05_Roaming_Enemies');
        assert.ok(fs.existsSync(zoneDir), `Directory must exist: ${zoneDir}`);

        const dirEntries = fs.readdirSync(zoneDir);
        // Exclude README.md or documentation files
        const imageFiles = dirEntries.filter(f => f.endsWith('.png'));

        assert.strictEqual(
          imageFiles.length,
          2,
          `Zone ${tier} must contain exactly 2 image files, found ${imageFiles.length}: [${imageFiles.join(', ')}]`
        );

        assert.ok(
          imageFiles.includes(spec.vessel),
          `Zone ${tier} must contain vessel ${spec.vessel}`
        );
        assert.ok(
          imageFiles.includes(spec.beast),
          `Zone ${tier} must contain beast ${spec.beast}`
        );

        // Verify foreign sprites from other zones are NOT present
        for (let otherTier = 1; otherTier <= 4; otherTier++) {
          if (otherTier === tier) continue;
          const foreignSpec = EXPECTED_ZONE_SEGREGATION[otherTier];
          assert.strictEqual(
            imageFiles.includes(foreignSpec.vessel),
            false,
            `Zone ${tier} must NOT contain Zone ${otherTier} vessel ${foreignSpec.vessel}`
          );
          assert.strictEqual(
            imageFiles.includes(foreignSpec.beast),
            false,
            `Zone ${tier} must NOT contain Zone ${otherTier} beast ${foreignSpec.beast}`
          );
        }
      }
    });

    test('Root 05_Roaming_Enemies contains exactly the union of all 4 zones (all 8 sprites) and no extras', () => {
      const rootDir = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies');
      const rootEntries = fs.readdirSync(rootDir);
      const rootImages = rootEntries.filter(f => f.endsWith('.png'));

      assert.strictEqual(rootImages.length, 8, `Root 05_Roaming_Enemies must contain exactly 8 sprites, found ${rootImages.length}`);

      const expectedAll = Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => h.spriteAssetKey);
      for (const expectedFile of expectedAll) {
        assert.ok(rootImages.includes(expectedFile), `Root catalog must include ${expectedFile}`);
      }

      for (const actualFile of rootImages) {
        assert.ok(expectedAll.includes(actualFile), `Root catalog contains unexpected file ${actualFile}`);
      }
    });

    test('Zone tier mapping in AUTHORITATIVE_HOSTILE_ROSTER exactly corresponds with physical placement', () => {
      for (const [key, hostile] of Object.entries(AUTHORITATIVE_HOSTILE_ROSTER)) {
        const spec = EXPECTED_ZONE_SEGREGATION[hostile.zoneTier];
        assert.ok(spec, `Hostile ${key} has valid zoneTier ${hostile.zoneTier}`);

        const expectedFile = hostile.category === 'vessel' ? spec.vessel : spec.beast;
        assert.strictEqual(
          hostile.spriteAssetKey,
          expectedFile,
          `Hostile ${key} (tier ${hostile.zoneTier}) spriteAssetKey must match expected zone file`
        );
      }
    });
  });

  // ==========================================================================
  // SUITE 4: Missing Folder Detection Logic, Traversal & Fallback Resilience
  // ==========================================================================
  describe('Suite 4: Missing Folder Detection Logic, Traversal & Fallback Resilience', () => {

    test('Missing directory detector correctly isolates missing folders without throwing unhandled exceptions', () => {
      function checkCatalogDirectories(dirs: string[]): { present: string[]; missing: string[] } {
        const present: string[] = [];
        const missing: string[] = [];

        for (const dir of dirs) {
          try {
            const abs = path.resolve(WORKSPACE_ROOT, dir);
            if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
              present.push(dir);
            } else {
              missing.push(dir);
            }
          } catch {
            missing.push(dir);
          }
        }
        return { present, missing };
      }

      // 1. With actual directories
      const realResult = checkCatalogDirectories(EXPECTED_ROAMING_CATALOG_DIRS);
      assert.strictEqual(realResult.missing.length, 0, 'No expected catalog directories should be missing');
      assert.strictEqual(realResult.present.length, 5, 'All 5 expected directories should be present');

      // 2. With fabricated / non-existent directories
      const mixedDirs = [
        ...EXPECTED_ROAMING_CATALOG_DIRS,
        'ZONE_SPRITES_CATALOG/Zone 99 - NonExistent_Zone/05_Roaming_Enemies',
        'ZONE_SPRITES_CATALOG/Corrupt_Invalid_Folder!@#$'
      ];
      const mixedResult = checkCatalogDirectories(mixedDirs);
      assert.strictEqual(mixedResult.present.length, 5);
      assert.strictEqual(mixedResult.missing.length, 2);
      assert.ok(mixedResult.missing.includes('ZONE_SPRITES_CATALOG/Zone 99 - NonExistent_Zone/05_Roaming_Enemies'));
    });

    test('Path traversal resistance: checks outside catalog root are identified or rejected safely', () => {
      const escapeAttempts = [
        '../package.json',
        '../../README.md',
        'ZONE_SPRITES_CATALOG/../../outside.txt',
        'ZONE_SPRITES_CATALOG/../ZONE_SPRITES_CATALOG/05_Roaming_Enemies'
      ];

      function isSafelyContained(baseDir: string, targetPath: string): boolean {
        const absBase = path.resolve(baseDir);
        const absTarget = path.resolve(absBase, targetPath);
        const relative = path.relative(absBase, absTarget);
        return !relative.startsWith('..') && !path.isAbsolute(relative);
      }

      assert.strictEqual(isSafelyContained(ABS_CATALOG_PATH, '../package.json'), false);
      assert.strictEqual(isSafelyContained(ABS_CATALOG_PATH, '../../README.md'), false);
      assert.strictEqual(isSafelyContained(ABS_CATALOG_PATH, 'ZONE_SPRITES_CATALOG/../../outside.txt'), false);
      assert.strictEqual(isSafelyContained(ABS_CATALOG_PATH, '05_Roaming_Enemies'), true);
      assert.strictEqual(isSafelyContained(ABS_CATALOG_PATH, '05_Roaming_Enemies/boat_trawler_derelict.png'), true);
    });

    test('Sprite asset fallback resolver returns designated fallback on missing sprite or corrupt key', () => {
      const FALLBACK_SPRITE = 'boat_trawler_derelict.png';

      function resolveHostileSpriteKey(
        requestedKey: string | null | undefined,
        knownSprites: Set<string>
      ): string {
        if (!requestedKey || typeof requestedKey !== 'string') {
          return FALLBACK_SPRITE;
        }
        const cleaned = path.basename(requestedKey.trim());
        if (knownSprites.has(cleaned)) {
          return cleaned;
        }
        return FALLBACK_SPRITE;
      }

      const available = new Set(Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => h.spriteAssetKey));

      // Valid sprite
      assert.strictEqual(
        resolveHostileSpriteKey('rowboat_fisherman_lantern.png', available),
        'rowboat_fisherman_lantern.png'
      );

      // Missing sprite
      assert.strictEqual(
        resolveHostileSpriteKey('non_existent_ghost_ship.png', available),
        FALLBACK_SPRITE
      );

      // Edge cases: null, undefined, empty string, path traversal attempts
      assert.strictEqual(resolveHostileSpriteKey(null as any, available), FALLBACK_SPRITE);
      assert.strictEqual(resolveHostileSpriteKey(undefined as any, available), FALLBACK_SPRITE);
      assert.strictEqual(resolveHostileSpriteKey('', available), FALLBACK_SPRITE);
      assert.strictEqual(resolveHostileSpriteKey('   ', available), FALLBACK_SPRITE);
      assert.strictEqual(resolveHostileSpriteKey('../../etc/passwd', available), FALLBACK_SPRITE);
    });

    test('Resilience under read errors or file permission anomalies handles errors gracefully', () => {
      // Simulate reading a non-existent file with try-catch wrapper
      function safeReadPngHeader(filePath: string): { success: boolean; isPng: boolean; error?: string } {
        try {
          if (!fs.existsSync(filePath)) {
            return { success: false, isPng: false, error: 'File does not exist' };
          }
          const fd = fs.openSync(filePath, 'r');
          const header = Buffer.alloc(8);
          fs.readSync(fd, header, 0, 8, 0);
          fs.closeSync(fd);
          return { success: true, isPng: isValidPngMagic(header) };
        } catch (err: any) {
          return { success: false, isPng: false, error: err.message };
        }
      }

      const validFile = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies', 'boat_trawler_derelict.png');
      const validResult = safeReadPngHeader(validFile);
      assert.strictEqual(validResult.success, true);
      assert.strictEqual(validResult.isPng, true);

      const invalidFile = path.join(ABS_CATALOG_PATH, '05_Roaming_Enemies', 'does_not_exist.png');
      const invalidResult = safeReadPngHeader(invalidFile);
      assert.strictEqual(invalidResult.success, false);
      assert.strictEqual(invalidResult.isPng, false);
    });
  });

  // ==========================================================================
  // SUITE 5: Visual Sprite Gallery HTML Conformance & Semantic Integrity
  // ==========================================================================
  describe('Suite 5: Visual Sprite Gallery HTML Conformance & Semantic Integrity', () => {

    test('Visual_Sprite_Gallery.html exists, is valid UTF-8, and has non-trivial size (>50KB)', () => {
      assert.ok(fs.existsSync(ABS_GALLERY_PATH), `Gallery must exist at ${ABS_GALLERY_PATH}`);
      const stats = fs.statSync(ABS_GALLERY_PATH);
      assert.ok(stats.size > 50000, `Gallery size must be > 50KB (got ${stats.size} bytes)`);

      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      assert.ok(content.startsWith('<!DOCTYPE html>') || content.includes('<!DOCTYPE html>'));
      assert.ok(content.includes('</html>'));
    });

    test('Section #roaming-enemies-block exists exactly once in Visual_Sprite_Gallery.html', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const matches = content.match(/id="roaming-enemies-block"/g);
      assert.ok(matches !== null, 'Gallery must contain id="roaming-enemies-block"');
      assert.strictEqual(matches.length, 1, 'id="roaming-enemies-block" must be unique (appear exactly once)');
    });

    test('All 8 cards in #roaming-enemies-block reference existing images on disk with valid PNG headers', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const blockMatch = content.match(/<div class="zone-block" id="roaming-enemies-block">([\s\S]*?)<\/div>\s*<\/body>/);
      assert.ok(blockMatch, 'Must find roaming-enemies-block preceding closing body');

      const blockHtml = blockMatch[1];
      const imgRegex = /<img src="([^"]+)" alt="([^"]*)"/g;
      const parsedImages: { src: string; alt: string }[] = [];

      let m: RegExpExecArray | null;
      while ((m = imgRegex.exec(blockHtml)) !== null) {
        parsedImages.push({ src: m[1], alt: m[2] });
      }

      assert.strictEqual(parsedImages.length, 8, `Expected exactly 8 images in roaming block, found ${parsedImages.length}`);

      for (const item of parsedImages) {
        // Resolve relative to gallery path (ZONE_SPRITES_CATALOG/)
        const diskPath = path.resolve(ABS_CATALOG_PATH, item.src);
        assert.ok(fs.existsSync(diskPath), `Gallery image on disk must exist: ${diskPath}`);

        const buf = fs.readFileSync(diskPath);
        assert.ok(isValidPngMagic(buf), `Gallery image on disk must have valid PNG magic: ${diskPath}`);
        assert.ok(buf.length > 1000, `Gallery image must be substantial: ${diskPath}`);
      }
    });

    test('Each card contains accurate metadata badges matching zone tier and category', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');
      const blockMatch = content.match(/<div class="zone-block" id="roaming-enemies-block">([\s\S]*?)<\/div>\s*<\/body>/);
      assert.ok(blockMatch);

      const blockHtml = blockMatch[1];
      const cardRegex = /<div class="card">[\s\S]*?<div class="filename">([^<]+)<\/div>[\s\S]*?<div class="meta"><span>([^<]+)<\/span><span class="badge ([^"]*)">([^<]+)<\/span><\/div>/g;

      const cardMatches: { filename: string; meta: string; badgeClass: string; badgeLabel: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = cardRegex.exec(blockHtml)) !== null) {
        cardMatches.push({
          filename: m[1].trim(),
          meta: m[2].trim(),
          badgeClass: m[3].trim(),
          badgeLabel: m[4].trim()
        });
      }

      assert.strictEqual(cardMatches.length, 8, `Expected 8 card metadata blocks, found ${cardMatches.length}`);

      const rosterByFilename = new Map(
        Object.values(AUTHORITATIVE_HOSTILE_ROSTER).map(h => [h.spriteAssetKey, h])
      );

      for (const card of cardMatches) {
        const hostile = rosterByFilename.get(card.filename);
        assert.ok(hostile, `Card filename "${card.filename}" must be present in authoritative hostile roster`);

        assert.strictEqual(card.badgeLabel, 'PNG');
        assert.strictEqual(card.badgeClass, 'badge-png');
        assert.ok(card.meta.includes(`Zone ${hostile.zoneTier}`), `Meta "${card.meta}" must contain Zone ${hostile.zoneTier}`);
        assert.ok(card.meta.includes(hostile.category.toUpperCase()), `Meta "${card.meta}" must contain ${hostile.category.toUpperCase()}`);
      }
    });

    test('Gallery HTML retains valid document structure without unclosed tags or corrupted DOM', () => {
      const content = fs.readFileSync(ABS_GALLERY_PATH, 'utf-8');

      // Verify basic tag balance
      const openDivs = (content.match(/<div(\s|>)/g) || []).length;
      const closeDivs = (content.match(/<\/div>/g) || []).length;
      assert.strictEqual(openDivs, closeDivs, `Mismatched <div> tag count: ${openDivs} open vs ${closeDivs} close`);

      const openBodies = (content.match(/<body(\s|>)/g) || []).length;
      const closeBodies = (content.match(/<\/body>/g) || []).length;
      assert.strictEqual(openBodies, 1, 'Must have exactly 1 <body> tag');
      assert.strictEqual(closeBodies, 1, 'Must have exactly 1 </body> tag');

      // Verify gallery ends properly
      assert.ok(content.trim().endsWith('</html>'), 'Gallery must end with </html>');
    });
  });
});
