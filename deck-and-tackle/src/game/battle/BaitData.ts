import type { SpeciesType } from './FishData';
import { ZONE_SPECIES_MAP } from './FishData';

export type BaitId = 'bare_hook' | 'lugworms' | 'blood_chum' | 'bio_squid' | 'eldritch_grub';

export type FishingOutcomeType = 'strike' | 'salvage' | 'slack';

export interface BaitRarityWeights {
  common: number;
  uncommon: number;
  rare: number;
  aberrant?: number;
}

export interface BaitOutcomeWeights {
  strike: number;
  salvage: number;
  slack: number;
}

export interface BaitData {
  id: BaitId;
  name: string;
  cost: number;
  description: string;
  lore?: string;
  iconAssetKey: string;
  rarityWeights: BaitRarityWeights;
  outcomeWeights: BaitOutcomeWeights;
  rarityWeightMultipliers?: { common: number; uncommon: number; rare: number; aberrant: number };
}

export const ALL_BAIT_IDS: BaitId[] = [
  'bare_hook',
  'lugworms',
  'blood_chum',
  'bio_squid',
  'eldritch_grub'
];

export const BAIT_REGISTRY: Record<BaitId, BaitData> = {
  bare_hook: {
    id: 'bare_hook',
    name: 'Bare Hook',
    cost: 0,
    description: 'A plain unadorned hook. Simple and reliable, but unlikely to entice rare deep-sea horrors.',
    lore: 'Standard tackle aboard every Innsmouth skiff. Always in stock.',
    iconAssetKey: '/assets/sprites/fishing/tackle_hook_bone.png',
    outcomeWeights: { strike: 60, salvage: 22, slack: 18 },
    rarityWeights: { common: 75, uncommon: 22, rare: 3 },
    rarityWeightMultipliers: { common: 0.75, uncommon: 0.22, rare: 0.03, aberrant: 0.03 }
  },
  lugworms: {
    id: 'lugworms',
    name: 'Lugworms',
    cost: 10,
    description: 'Fat, wriggling salt-marsh annelids. Ideal for enticing coastal shoal and sound species.',
    lore: 'Cheap, reliable bait favored by coastal net-draggers to coax skittish bottom-feeders.',
    iconAssetKey: '/assets/sprites/fishing/tackle_lure_shrimp.png',
    outcomeWeights: { strike: 70, salvage: 20, slack: 10 },
    rarityWeights: { common: 55, uncommon: 38, rare: 7 },
    rarityWeightMultipliers: { common: 0.55, uncommon: 0.38, rare: 0.07, aberrant: 0.07 }
  },
  blood_chum: {
    id: 'blood_chum',
    name: 'Blood Chum',
    cost: 25,
    description: 'Viscous mixture of congealed ox-blood and rotting pilchard. Provokes aggressive predatory strikes.',
    lore: 'Spreads a dark crimson slick across the brine that lures razor-toothed pelagic hunters.',
    iconAssetKey: '/assets/sprites/shop/icon_abyssal_chum.png',
    outcomeWeights: { strike: 76, salvage: 18, slack: 6 },
    rarityWeights: { common: 30, uncommon: 55, rare: 15 },
    rarityWeightMultipliers: { common: 0.30, uncommon: 0.55, rare: 0.15, aberrant: 0.15 }
  },
  bio_squid: {
    id: 'bio_squid',
    name: 'Bioluminescent Squid',
    cost: 45,
    description: 'Preserved pelagic squid mantle that glows with hypnotic azure phosphor in lightless depths.',
    lore: 'Deep-sea predators mistake its pulsating cold light for vulnerable prey in pitch-black waters.',
    iconAssetKey: '/assets/sprites/shop/icon_eldritch_lure.png',
    outcomeWeights: { strike: 80, salvage: 15, slack: 5 },
    rarityWeights: { common: 20, uncommon: 45, rare: 35 },
    rarityWeightMultipliers: { common: 0.20, uncommon: 0.45, rare: 0.35, aberrant: 0.35 }
  },
  eldritch_grub: {
    id: 'eldritch_grub',
    name: 'Eldritch Grub',
    cost: 75,
    description: 'Writhing, multi-eyed parasite harvested from hydrothermal chimneys. Attracts primordial horrors.',
    lore: 'Its uncanny vibrations and pungent scent awaken ancient leviathans slumbering in the abyss.',
    iconAssetKey: '/assets/sprites/fishing/tackle_lure_snail.png',
    outcomeWeights: { strike: 85, salvage: 12, slack: 3 },
    rarityWeights: { common: 10, uncommon: 30, rare: 60 },
    rarityWeightMultipliers: { common: 0.10, uncommon: 0.30, rare: 0.60, aberrant: 0.60 }
  }
};

export function getBaitData(baitId: BaitId): BaitData {
  return BAIT_REGISTRY[baitId] ?? BAIT_REGISTRY.bare_hook;
}

export function getAllBaits(): BaitData[] {
  return ALL_BAIT_IDS.map(id => BAIT_REGISTRY[id]);
}

/**
 * Rolls rarity ('common' | 'uncommon' | 'rare') biased by the selected bait.
 * Supports deterministic roll parameter:
 * - If 0 <= roll <= 1, it scales against total weight.
 * - If roll > 1, it compares directly against cumulative weight thresholds.
 */
export function rollRarityForBait(baitId: BaitId, roll?: number): 'common' | 'uncommon' | 'rare' {
  const config = BAIT_REGISTRY[baitId] ?? BAIT_REGISTRY.bare_hook;
  const weights = config.rarityWeights;
  const total = weights.common + weights.uncommon + weights.rare;

  let r: number;
  if (roll !== undefined) {
    if (roll <= 1.0 && total > 1.0) {
      r = roll * total;
    } else {
      r = roll;
    }
  } else {
    r = Math.random() * total;
  }

  if (r < weights.common) {
    return 'common';
  } else if (r < weights.common + weights.uncommon) {
    return 'uncommon';
  } else {
    return 'rare';
  }
}

/**
 * Rolls a specific species for a zone tier (1..4) modulated by the selected bait.
 */
export function rollSpeciesForZone(
  zoneTier: 1 | 2 | 3 | 4,
  baitId: BaitId,
  rollRarity?: number
): SpeciesType {
  const rarity = rollRarityForBait(baitId, rollRarity);
  const tierClamped = Math.max(1, Math.min(4, zoneTier)) as 1 | 2 | 3 | 4;
  const zoneMap = ZONE_SPECIES_MAP[tierClamped];
  if (!zoneMap) {
    return 'perch';
  }
  return zoneMap[rarity] ?? zoneMap.common;
}

/**
 * Rolls fishing outcome ('strike' | 'salvage' | 'slack') based on bait outcome weights.
 */
export function rollOutcomeForBait(baitId: BaitId, roll?: number): FishingOutcomeType {
  const config = BAIT_REGISTRY[baitId] ?? BAIT_REGISTRY.bare_hook;
  const weights = config.outcomeWeights;
  const total = weights.strike + weights.salvage + weights.slack;

  let r: number;
  if (roll !== undefined) {
    if (roll <= 1.0 && total > 1.0) {
      r = roll * total;
    } else {
      r = roll;
    }
  } else {
    r = Math.random() * total;
  }

  if (r < weights.strike) {
    return 'strike';
  } else if (r < weights.strike + weights.salvage) {
    return 'salvage';
  } else {
    return 'slack';
  }
}
