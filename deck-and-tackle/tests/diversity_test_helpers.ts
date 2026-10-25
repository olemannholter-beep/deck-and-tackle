/**
 * Authoritative E2E Test Helpers & Specification Oracles:
 * Deck & Tackle Gameplay Diversity Expansion
 * 
 * Derived strictly from:
 * - ORIGINAL_REQUEST.md (2026-10-25T14:25:48Z § R1-R6)
 * - TEST_INFRA.md
 * - PROJECT.md § Interface Contracts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Headless Node Polyfills for DOM / Audio / Canvas
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
    removeEventListener: () => {},
    createElement: () => ({ getContext: () => null })
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
// 1. Authoritative 12 Catchable Fish Species Specifications (ORIGINAL_REQUEST §R1)
// ---------------------------------------------------------------------------

export type ZoneTier = 1 | 2 | 3 | 4;
export type SpeciesRarity = 'common' | 'uncommon' | 'rare' | 'aberrant';

export interface AuthoritativeFishIntent {
  type: 'Thrash' | 'DeepDive' | 'Rest';
  value: number;
  name: string;
  description: string;
}

export interface AuthoritativeFishSpecies {
  id: string;
  speciesType: string;
  speciesName: string;
  zoneTier: ZoneTier;
  rarity: SpeciesRarity;
  startingDistance: number;
  lineDamagePower: number;
  sellValue: number;
  spriteAssetKey: string;
  intentPattern: AuthoritativeFishIntent[];
  description: string;
}

export const AUTHORITATIVE_SPECIES_SPECS: Record<string, AuthoritativeFishSpecies> = {
  // --- Zone 1: The Shallows (0 - 1200 px, 0 - 30m) ---
  perch: {
    id: 'fish_sunny_perch',
    speciesType: 'perch',
    speciesName: 'Innsmouth Perch',
    zoneTier: 1,
    rarity: 'common',
    startingDistance: 30,
    lineDamagePower: 8,
    sellValue: 15,
    spriteAssetKey: 'fish_shadowy_perch_s6.png',
    description: 'A brackish dweller of the fog-choked shallows with glassy eyes.',
    intentPattern: [
      { type: 'Thrash', value: 8, name: 'Spine Thrash', description: 'Twitches with jagged venomous dorsal spines for 8 Tension.' },
      { type: 'Thrash', value: 6, name: 'Barbel Lash', description: 'Whips clammy chin feelers, inflicting 6 Tension.' },
      { type: 'DeepDive', value: 5, name: 'Muck Burrow', description: 'Burrows into rotting eel-grass muck, gaining +5m Distance.' },
      { type: 'Thrash', value: 9, name: 'Venom Surge', description: 'Violently spasms against the leader, inflicting 9 Tension!' }
    ]
  },
  flounder: {
    id: 'fish_benthic_flounder',
    speciesType: 'flounder',
    speciesName: 'Benthic Flounder',
    zoneTier: 1,
    rarity: 'uncommon',
    startingDistance: 42,
    lineDamagePower: 11,
    sellValue: 32,
    spriteAssetKey: 'fish_flounder_benthic.png',
    description: 'A flattened silt-dweller camouflaged in the coastal shallows.',
    intentPattern: [
      { type: 'Thrash', value: 10, name: 'Sandy Tremor', description: 'Shakes violently against the seabed silt for 10 Tension.' },
      { type: 'DeepDive', value: 8, name: 'Silt Camouflage', description: 'Buries beneath sand grains, gaining +8m Distance.' },
      { type: 'Thrash', value: 12, name: 'Pectoral Snap', description: 'Flaps broad pectoral fins, snapping the line for 12 Tension.' },
      { type: 'Rest', value: 0, name: 'Flatfish Stillness', description: 'Remains motionless in the muck to conserve energy.' }
    ]
  },
  ghost_cod: {
    id: 'fish_pale_ghost_cod',
    speciesType: 'ghost_cod',
    speciesName: 'Pale Ghost-Cod',
    zoneTier: 1,
    rarity: 'rare',
    startingDistance: 50,
    lineDamagePower: 14,
    sellValue: 55,
    spriteAssetKey: 'fish_gray_cod.png',
    description: 'An ethereal pale cod that drifts through shallow night mists.',
    intentPattern: [
      { type: 'Thrash', value: 12, name: 'Ethereal Churn', description: 'Spectral thrashing inflicts 12 Tension.' },
      { type: 'DeepDive', value: 12, name: 'Spectral Plunge', description: 'Dives into cold shadow, gaining +12m Distance.' },
      { type: 'Thrash', value: 15, name: 'Barrow Bite', description: 'Snaps with translucent fangs for 15 Tension.' },
      { type: 'DeepDive', value: 6, name: 'Fog Drift', description: 'Dissolves into the mist, gaining +6m Distance.' }
    ]
  },

  // --- Zone 2: The Foggy Banks (1200 - 2400 px, 30 - 60m) ---
  pike: {
    id: 'fish_river_pike',
    speciesType: 'pike',
    speciesName: 'Blighted Pike',
    zoneTier: 2,
    rarity: 'common',
    startingDistance: 52,
    lineDamagePower: 15,
    sellValue: 40,
    spriteAssetKey: 'fish_brown_mutant.png',
    description: 'A mottled predator prowling the fog-shrouded sound with translucent fangs.',
    intentPattern: [
      { type: 'Thrash', value: 13, name: 'Fang Tear', description: 'Snaps needle-teeth violently against the leader for 13 Tension.' },
      { type: 'DeepDive', value: 10, name: 'Fog Plunge', description: 'Dives toward submerged timbers, gaining +10m Distance.' },
      { type: 'Thrash', value: 16, name: 'Convulsive Surge', description: 'Death rolls with unnatural ferocity, inflicting 16 Tension!' },
      { type: 'DeepDive', value: 8, name: 'Abyssal Lurk', description: 'Backs into the deep gloom, gaining +8m Distance.' }
    ]
  },
  sculpin: {
    id: 'fish_spiky_kelp_sculpin',
    speciesType: 'sculpin',
    speciesName: 'Spiky Kelp Sculpin',
    zoneTier: 2,
    rarity: 'uncommon',
    startingDistance: 62,
    lineDamagePower: 18,
    sellValue: 65,
    spriteAssetKey: 'fish_spiky_sculpin.png',
    description: 'An armored bottom-dweller crowned with barbed kelp-like spines.',
    intentPattern: [
      { type: 'Thrash', value: 15, name: 'Thorn Quill Strike', description: 'Lashes barbed spines against the tackle for 15 Tension.' },
      { type: 'Thrash', value: 17, name: 'Venom Spasm', description: 'Discharges kelp toxins, inflicting 17 Tension!' },
      { type: 'DeepDive', value: 12, name: 'Kelp Tangle', description: 'Drags leader into thick kelp fronds, gaining +12m Distance.' },
      { type: 'Rest', value: 0, name: 'Camouflaged Wait', description: 'Blends into the swaying kelp canopy.' }
    ]
  },
  teal_snapper: {
    id: 'fish_biolum_teal_snapper',
    speciesType: 'teal_snapper',
    speciesName: 'Bioluminescent Teal Snapper',
    zoneTier: 2,
    rarity: 'rare',
    startingDistance: 70,
    lineDamagePower: 20,
    sellValue: 95,
    spriteAssetKey: 'fish_teal_snapper.png',
    description: 'A shimmering reef predator glowing with emerald-teal phosphor.',
    intentPattern: [
      { type: 'Thrash', value: 18, name: 'Phosphor Flash', description: 'Blinds the angler with glowing scales for 18 Tension.' },
      { type: 'DeepDive', value: 14, name: 'Biolum Dive', description: 'Plunges into the emerald depth, gaining +14m Distance.' },
      { type: 'Thrash', value: 20, name: 'Emerald Tear', description: 'Tears violently sideways for 20 Tension!' },
      { type: 'DeepDive', value: 10, name: 'Blinding Flash', description: 'Flares photophores, gaining +10m Distance.' }
    ]
  },

  // --- Zone 3: The Sunken Reefs (2400 - 3600 px, 60 - 100m) ---
  gar: {
    id: 'fish_abyssal_gar',
    speciesType: 'gar',
    speciesName: 'Abyssal Void-Gar',
    zoneTier: 3,
    rarity: 'common',
    startingDistance: 75,
    lineDamagePower: 22,
    sellValue: 90,
    spriteAssetKey: 'fish_abyssal_eel.png',
    description: 'An ancient, heavily armored monstrosity with runic basalt scutes.',
    intentPattern: [
      { type: 'Thrash', value: 18, name: 'Runic Surge', description: 'Basalt scutes grind against the line, inflicting 18 Tension.' },
      { type: 'DeepDive', value: 16, name: 'Chasm Plunge', description: 'Pulls toward non-euclidean chasm, gaining +16m Distance.' },
      { type: 'Thrash', value: 22, name: 'Titan Death-Roll', description: 'Unleashes crushing primordial fury, inflicting 22 Tension!' },
      { type: 'Thrash', value: 15, name: 'Abyssal Slam', description: 'Slams armored snout into seabed, inflicting 15 Tension.' }
    ]
  },
  angler: {
    id: 'fish_pale_lure_angler',
    speciesType: 'angler',
    speciesName: 'Pale Lure Angler',
    zoneTier: 3,
    rarity: 'uncommon',
    startingDistance: 86,
    lineDamagePower: 25,
    sellValue: 135,
    spriteAssetKey: 'fish_angler_pale_lure.png',
    description: 'A grotesque anglerfish dangling a hypnotic corpse-pale esca bulb.',
    intentPattern: [
      { type: 'Thrash', value: 22, name: 'Baited Snap', description: 'Lures leader into razor jaws for 22 Tension.' },
      { type: 'DeepDive', value: 18, name: 'Shadow Sink', description: 'Fades into midnight blackness, gaining +18m Distance.' },
      { type: 'Thrash', value: 26, name: 'Cavernous Chomp', description: 'Crushes line in cavernous maw for 26 Tension!' },
      { type: 'DeepDive', value: 15, name: 'Lure Haul-Back', description: 'Jerks backward into the abyss, gaining +15m Distance.' }
    ]
  },
  gulper: {
    id: 'fish_visceral_swollen_gulper',
    speciesType: 'gulper',
    speciesName: 'Visceral Swollen Gulper',
    zoneTier: 3,
    rarity: 'rare',
    startingDistance: 98,
    lineDamagePower: 28,
    sellValue: 185,
    spriteAssetKey: 'fish_visceral_gut_swollen.png',
    description: 'A bloated deep-sea monstrosity with an elastic translucent stomach.',
    intentPattern: [
      { type: 'Thrash', value: 25, name: 'Distended Gulp', description: 'Swallows hook and leader in bloated throat for 25 Tension.' },
      { type: 'DeepDive', value: 20, name: 'Visceral Plunge', description: 'Drags ballast into the deep trench, gaining +20m Distance.' },
      { type: 'Thrash', value: 30, name: 'Bloated Death Roll', description: 'Rolls its colossal gut for a devastating 30 Tension!' },
      { type: 'Rest', value: 0, name: 'Torpid Digestion', description: 'Pauses to digest swallowed brine.' }
    ]
  },

  // --- Zone 4: The Eldritch Trench (3600+ px, 100m+) ---
  maw_worm: {
    id: 'leviathan_abyssal_maw_worm',
    speciesType: 'maw_worm',
    speciesName: 'Abyssal Maw-Worm',
    zoneTier: 4,
    rarity: 'common',
    startingDistance: 105,
    lineDamagePower: 30,
    sellValue: 160,
    spriteAssetKey: 'leviathan_abyssal_maw_worm.png',
    description: 'A subterranean burrower with concentric rings of chitinous teeth.',
    intentPattern: [
      { type: 'Thrash', value: 26, name: 'Tooth Ring Grind', description: 'Rotating tooth rings grind the wire leader for 26 Tension.' },
      { type: 'DeepDive', value: 22, name: 'Benthic Boring', description: 'Bores into hydrothermal basalt, gaining +22m Distance.' },
      { type: 'Thrash', value: 32, name: 'Thermal Vent Lunge', description: 'Strikes out of boiling sulphur vents for 32 Tension!' },
      { type: 'DeepDive', value: 18, name: 'Basalt Burrow', description: 'Sinks into subterranean rock, gaining +18m Distance.' }
    ]
  },
  cthulhu_spawn: {
    id: 'fish_cthulhu_tentacled_spawn',
    speciesType: 'cthulhu_spawn',
    speciesName: 'Tentacled Cthulhu-Spawn',
    zoneTier: 4,
    rarity: 'uncommon',
    startingDistance: 120,
    lineDamagePower: 34,
    sellValue: 225,
    spriteAssetKey: 'fish_cthulhu_tentacled.png',
    description: 'A blasphemous cephalopod abomination with writhing face-tentacles.',
    intentPattern: [
      { type: 'Thrash', value: 30, name: 'Tentacle Lash', description: 'Heavy barbed tentacles whip the line for 30 Tension.' },
      { type: 'DeepDive', value: 25, name: 'Miasma Submerge', description: 'Sinks through toxic miasma, gaining +25m Distance.' },
      { type: 'Thrash', value: 35, name: 'Mind-Shattering Spasm', description: 'Unleashes psychic discord, inflicting 35 Tension!' },
      { type: 'Thrash', value: 28, name: 'Constricting Wrap', description: 'Coils around tackle, inflicting 28 Tension.' }
    ]
  },
  dagon: {
    id: 'leviathan_apex_dagon',
    speciesType: 'dagon',
    speciesName: 'Apex Leviathan Dagon',
    zoneTier: 4,
    rarity: 'rare',
    startingDistance: 140,
    lineDamagePower: 40,
    sellValue: 350,
    spriteAssetKey: 'leviathan_apex_dagon.png',
    description: 'The primordial cyclopean god-beast of the sunken city with colossal tentacles.',
    intentPattern: [
      { type: 'Thrash', value: 35, name: 'Primordial Maw-Crush', description: 'Towering jaws snap for a crushing 35 Tension!' },
      { type: 'DeepDive', value: 28, name: 'Chasm Void-Sink', description: 'Sinks into the infinite abyss, gaining +28m Distance.' },
      { type: 'Thrash', value: 42, name: 'Cyclopean Spasm', description: 'Violent cataclysmic thrashing, inflicting 42 Tension!' },
      { type: 'Thrash', value: 32, name: "Dagon's Writhing Wave", description: 'Tentacle wave surges against line for 32 Tension.' }
    ]
  }
};

export const AUTHORITATIVE_ZONE_SPECIES_MAP: Record<ZoneTier, Record<'common' | 'uncommon' | 'rare', string>> = {
  1: { common: 'perch', uncommon: 'flounder', rare: 'ghost_cod' },
  2: { common: 'pike', uncommon: 'sculpin', rare: 'teal_snapper' },
  3: { common: 'gar', uncommon: 'angler', rare: 'gulper' },
  4: { common: 'maw_worm', uncommon: 'cthulhu_spawn', rare: 'dagon' }
};

// ---------------------------------------------------------------------------
// 2. Authoritative Bait Data & Outcomes (ORIGINAL_REQUEST §R2, §R3)
// ---------------------------------------------------------------------------

export interface AuthoritativeBaitConfig {
  id: string;
  name: string;
  cost: number;
  description: string;
  rarityWeights: { common: number; uncommon: number; rare: number };
  outcomeWeights: { strike: number; salvage: number; slack: number };
  iconAssetKey: string;
}

export const AUTHORITATIVE_BAIT_SPECS: Record<string, AuthoritativeBaitConfig> = {
  bare_hook: {
    id: 'bare_hook',
    name: 'Bare Hook',
    cost: 0,
    description: 'Unadorned bone hook. Fish bite reluctantly; line easily snags flotsam or goes slack.',
    rarityWeights: { common: 0.75, uncommon: 0.22, rare: 0.03 },
    outcomeWeights: { strike: 0.60, salvage: 0.22, slack: 0.18 },
    iconAssetKey: 'tackle_hook_bone.png'
  },
  lugworms: {
    id: 'lugworms',
    name: 'Lugworms',
    cost: 10,
    description: 'Fat, wriggling salt-marsh annelids. Ideal for enticing coastal shoal and sound species.',
    rarityWeights: { common: 0.55, uncommon: 0.38, rare: 0.07 },
    outcomeWeights: { strike: 0.70, salvage: 0.20, slack: 0.10 },
    iconAssetKey: 'tackle_lure_shrimp.png'
  },
  blood_chum: {
    id: 'blood_chum',
    name: 'Blood Chum',
    cost: 25,
    description: 'Viscous mixture of congealed ox-blood and rotting pilchard. Provokes aggressive strikes.',
    rarityWeights: { common: 0.30, uncommon: 0.55, rare: 0.15 },
    outcomeWeights: { strike: 0.76, salvage: 0.18, slack: 0.06 },
    iconAssetKey: 'icon_abyssal_chum.png'
  },
  bio_squid: {
    id: 'bio_squid',
    name: 'Bioluminescent Squid',
    cost: 45,
    description: 'Preserved pelagic squid mantle glowing with azure phosphor. Lures deep predators.',
    rarityWeights: { common: 0.20, uncommon: 0.45, rare: 0.35 },
    outcomeWeights: { strike: 0.80, salvage: 0.15, slack: 0.05 },
    iconAssetKey: 'icon_eldritch_lure.png'
  },
  eldritch_grub: {
    id: 'eldritch_grub',
    name: 'Eldritch Grub',
    cost: 75,
    description: 'Writhing multi-eyed parasite harvested from hydrothermal vents. Attracts primordial horrors.',
    rarityWeights: { common: 0.10, uncommon: 0.30, rare: 0.60 },
    outcomeWeights: { strike: 0.85, salvage: 0.12, slack: 0.03 },
    iconAssetKey: 'tackle_lure_snail.png'
  }
};

export type FishingOutcomeType = 'strike' | 'salvage' | 'slack';

export interface SalvageReward {
  type: 'gold' | 'bait' | 'card';
  amount?: number;
  baitId?: string;
  cardTitle?: string;
  description: string;
}

export function referenceRollTripartiteOutcome(baitId: string, rollFloat: number): FishingOutcomeType {
  const bait = AUTHORITATIVE_BAIT_SPECS[baitId] || AUTHORITATIVE_BAIT_SPECS.bare_hook;
  const pStrike = bait.outcomeWeights.strike;
  const pSalvage = bait.outcomeWeights.salvage;

  if (rollFloat < pStrike) return 'strike';
  if (rollFloat < pStrike + pSalvage) return 'salvage';
  return 'slack';
}

export function referenceRollRarityForBait(baitId: string, rollFloat: number): 'common' | 'uncommon' | 'rare' {
  const bait = AUTHORITATIVE_BAIT_SPECS[baitId] || AUTHORITATIVE_BAIT_SPECS.bare_hook;
  const pCommon = bait.rarityWeights.common;
  const pUncommon = bait.rarityWeights.uncommon;

  if (rollFloat < pCommon) return 'common';
  if (rollFloat < pCommon + pUncommon) return 'uncommon';
  return 'rare';
}

export function referenceResolveSpeciesForCast(zoneTier: ZoneTier, baitId: string, rollFloat: number): string {
  const rarity = referenceRollRarityForBait(baitId, rollFloat);
  return AUTHORITATIVE_ZONE_SPECIES_MAP[zoneTier][rarity];
}

export function referenceGenerateSalvageReward(zoneTier: ZoneTier, rollTypeFloat: number, rollSubFloat: number): SalvageReward {
  // 50% Gold, 30% Bait, 20% Sunken Card
  if (rollTypeFloat < 0.50) {
    // Gold ranges per zone: Z1: 15-25g, Z2: 25-40g, Z3: 40-60g, Z4: 60-100g
    const ranges: Record<ZoneTier, [number, number]> = {
      1: [15, 25],
      2: [25, 40],
      3: [40, 60],
      4: [60, 100]
    };
    const [minG, maxG] = ranges[zoneTier];
    const gold = Math.floor(minG + rollSubFloat * (maxG - minG + 1));
    return {
      type: 'gold',
      amount: gold,
      description: `Dredged Waterlogged Coin Purse: +${gold} Gold Sovereigns!`
    };
  } else if (rollTypeFloat < 0.80) {
    // Bait: 1-2 units of Lugworms, Blood Chum, or Biolum Squid
    const baitPool = ['lugworms', 'blood_chum', 'bio_squid'];
    const bIndex = Math.min(2, Math.floor(rollSubFloat * 3));
    const qty = rollSubFloat > 0.5 ? 2 : 1;
    const baitName = AUTHORITATIVE_BAIT_SPECS[baitPool[bIndex]].name;
    return {
      type: 'bait',
      baitId: baitPool[bIndex],
      amount: qty,
      description: `Recovered Tackle Crate: +${qty}x ${baitName}!`
    };
  } else {
    // Sunken Card: Rare nautical card from depths
    const sunkenCards = ['Deep-Sea Dredge', 'Siren Call', 'Gilded Harpoon', 'Barometric Surge', 'Ghost Anchor'];
    const cIndex = Math.min(sunkenCards.length - 1, Math.floor(rollSubFloat * sunkenCards.length));
    const cardTitle = sunkenCards[cIndex];
    return {
      type: 'card',
      cardTitle,
      description: `Sunken Ledger Parchment: Inscribed Card [${cardTitle}] added to deck!`
    };
  }
}

// ---------------------------------------------------------------------------
// 3. Authoritative Roaming Hostiles Specifications (ORIGINAL_REQUEST §R4)
// ---------------------------------------------------------------------------

export type HostileCategory = 'vessel' | 'beast';

export interface AuthoritativeHostileConfig {
  id: string;
  name: string;
  category: HostileCategory;
  zoneTier: ZoneTier;
  speed: number; // px/s
  maxHp: number;
  detectionRadius: number; // px
  audioCue: string;
  spriteAssetKey: string;
}

export const AUTHORITATIVE_HOSTILE_ROSTER: Record<string, AuthoritativeHostileConfig> = {
  // --- Patrol Vessels ---
  crazed_trawler: {
    id: 'hostile_vessel_crazed_trawler',
    name: 'Crazed Trawler',
    category: 'vessel',
    zoneTier: 1,
    speed: 95,
    maxHp: 80,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'boat_trawler_derelict.png'
  },
  ghost_skiff: {
    id: 'hostile_vessel_ghost_skiff',
    name: 'Ghost Skiff',
    category: 'vessel',
    zoneTier: 2,
    speed: 105,
    maxHp: 110,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'rowboat_fisherman_lantern.png'
  },
  galleon_raider: {
    id: 'hostile_vessel_galleon_raider',
    name: 'Galleon Raider',
    category: 'vessel',
    zoneTier: 3,
    speed: 115,
    maxHp: 160,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'shipwreck_abyssal_galleon.png'
  },
  cursed_black_frigate: {
    id: 'hostile_vessel_black_frigate',
    name: 'Cursed Black Frigate',
    category: 'vessel',
    zoneTier: 4,
    speed: 120,
    maxHp: 220,
    detectionRadius: 400,
    audioCue: 'horn_01_eldritch_horn_wail',
    spriteAssetKey: 'shipwreck_wooden_hull.png'
  },

  // --- Ambush Sea Beasts ---
  mutated_whale: {
    id: 'hostile_beast_mutated_whale',
    name: 'Mutated Whale',
    category: 'beast',
    zoneTier: 1,
    speed: 85,
    maxHp: 90,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'fish_visceral_gut_swollen.png'
  },
  kelp_leviathan: {
    id: 'hostile_beast_kelp_leviathan',
    name: 'Kelp Leviathan',
    category: 'beast',
    zoneTier: 2,
    speed: 110,
    maxHp: 130,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'fish_z2_tentacle_sculpin_sheet.png'
  },
  giant_sea_serpent: {
    id: 'hostile_beast_giant_serpent',
    name: 'Giant Sea Serpent',
    category: 'beast',
    zoneTier: 3,
    speed: 130,
    maxHp: 180,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'shadow_giant_sea_serpent.png'
  },
  cthulhu_colossus: {
    id: 'hostile_beast_cthulhu_colossus',
    name: 'Cthulhu Colossus',
    category: 'beast',
    zoneTier: 4,
    speed: 140,
    maxHp: 260,
    detectionRadius: 350,
    audioCue: 'groan_01_creature_groan_swell',
    spriteAssetKey: 'leviathan_kraken_worm_colossus.png'
  }
};

export const HOSTILE_CONE_ANGLE_RAD = Math.PI / 3.27; // ~55 degrees
export const HOSTILE_CONE_DISTANCE = 400; // px
export const BEAST_GROAN_RADIUS = 350; // px
export const BEAST_BREACH_RADIUS = 150; // px
export const COMBAT_ENGAGE_RADIUS = 45; // px

/**
 * Checks whether a target point falls within a directional detection cone.
 */
export function referenceCheckConeDetection(
  sourceX: number,
  sourceY: number,
  headingRad: number,
  coneLength: number,
  coneAngleRad: number,
  targetX: number,
  targetY: number
): boolean {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > coneLength) return false;

  const angleToTarget = Math.atan2(dy, dx);
  let diff = Math.abs(angleToTarget - headingRad);
  while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI);

  return diff <= coneAngleRad / 2;
}

// ---------------------------------------------------------------------------
// 4. Authoritative Naval Combat Deck & Standoff Engine (ORIGINAL_REQUEST §R4)
// ---------------------------------------------------------------------------

export interface AuthoritativeNavalCard {
  id: string;
  title: string;
  staminaCost: number;
  damage: number;
  armorGain: number;
  hullRepair: number;
  dodgeChance: number;
  stunTurns: number;
  description: string;
}

export const AUTHORITATIVE_NAVAL_CARDS: Record<string, AuthoritativeNavalCard> = {
  swivel_gun: {
    id: 'naval_swivel_gun',
    title: 'Swivel Gun',
    staminaCost: 1,
    damage: 12,
    armorGain: 0,
    hullRepair: 0,
    dodgeChance: 0,
    stunTurns: 0,
    description: 'Fires an accurate deck-mounted swivel gun for 12 Damage.'
  },
  broadside: {
    id: 'naval_broadside',
    title: 'Broadside Cannons',
    staminaCost: 3,
    damage: 28,
    armorGain: 0,
    hullRepair: 0,
    dodgeChance: 0,
    stunTurns: 0,
    description: 'Unleashes a devastating full salvo of 4-pounders for 28 Damage!'
  },
  hull_bracing: {
    id: 'naval_hull_bracing',
    title: 'Hull Bracing',
    staminaCost: 1,
    damage: 0,
    armorGain: 15,
    hullRepair: 0,
    dodgeChance: 0,
    stunTurns: 0,
    description: 'Fortifies timbers and braces for impact, gaining +15 Temporary Armor.'
  },
  evasive_tacking: {
    id: 'naval_evasive_tack',
    title: 'Evasive Tacking',
    staminaCost: 2,
    damage: 0,
    armorGain: 0,
    hullRepair: 0,
    dodgeChance: 0.50,
    stunTurns: 0,
    description: 'Angles the rudder into the trough, granting 50% Dodge chance against the next attack.'
  },
  bilge_patch: {
    id: 'naval_bilge_patch',
    title: 'Bilge Patch',
    staminaCost: 2,
    damage: 0,
    armorGain: 0,
    hullRepair: 18,
    dodgeChance: 0,
    stunTurns: 0,
    description: 'Hammers lead sheeting over splintered bulkheads, repairing 18 Hull HP.'
  },
  harpoon_snare: {
    id: 'naval_harpoon_snare',
    title: 'Harpoon Snare',
    staminaCost: 2,
    damage: 8,
    armorGain: 0,
    hullRepair: 0,
    dodgeChance: 0,
    stunTurns: 1,
    description: 'Fires barbed iron cable, dealing 8 Damage and Snaring/Stunning the target for 1 turn.'
  }
};

// ---------------------------------------------------------------------------
// 5. Authoritative Hull HP, Defeat Penalty & Escape Minigame (ORIGINAL_REQUEST §R5)
// ---------------------------------------------------------------------------

export const VESSEL_MAX_HULL_HP = 60;
export const HARBOR_REPAIR_TOLL_RATE = 0.18; // 18%
export const ESCAPE_MINIGAME_DURATION = 10.0; // 10 seconds
export const ESCAPE_SURVIVAL_LIMP_HP = 20;

/**
 * Calculates harbor salvage repair toll when hull reaches 0.
 * Rule: 18% of player's gold, minimum 1g (if gold > 0).
 */
export function referenceCalcHarborToll(playerGold: number): number {
  if (playerGold <= 0) return 0;
  return Math.max(1, Math.floor(playerGold * HARBOR_REPAIR_TOLL_RATE));
}

// ---------------------------------------------------------------------------
// 6. Authoritative Catalog Paths (ORIGINAL_REQUEST §R6)
// ---------------------------------------------------------------------------

export const CATALOG_BASE_PATH = 'ZONE_SPRITES_CATALOG';
export const EXPECTED_ROAMING_CATALOG_DIRS = [
  'ZONE_SPRITES_CATALOG/05_Roaming_Enemies',
  'ZONE_SPRITES_CATALOG/Zone 1 - The Shallows (Coastal Shoals)/05_Roaming_Enemies',
  'ZONE_SPRITES_CATALOG/Zone 2 - The Foggy Banks (Kelp Shallows)/05_Roaming_Enemies',
  'ZONE_SPRITES_CATALOG/Zone 3 - The Sunken Reefs (Abyssal Trench)/05_Roaming_Enemies',
  'ZONE_SPRITES_CATALOG/Zone 4 - The Eldritch Trench (Subterranean Sea Cave)/05_Roaming_Enemies'
];

export const GALLERY_PATH = 'ZONE_SPRITES_CATALOG/Visual_Sprite_Gallery.html';
