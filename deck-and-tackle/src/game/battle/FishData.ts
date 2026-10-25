export type IntentType = 'Thrash' | 'DeepDive' | 'Rest';

export type SpeciesType =
  // Zone 1: The Shallows (0-1200 px, 0-30m)
  | 'perch'
  | 'flounder'
  | 'ghost_cod'
  // Zone 2: The Foggy Banks (1200-2400 px, 30-60m)
  | 'pike'
  | 'sculpin'
  | 'teal_snapper'
  // Zone 3: The Sunken Reefs (2400-3600 px, 60-100m)
  | 'gar'
  | 'angler'
  | 'gulper'
  // Zone 4: The Eldritch Trench (3600+ px, 100m+)
  | 'maw_worm'
  | 'cthulhu_spawn'
  | 'dagon';

export type FishRarity = 'common' | 'uncommon' | 'rare' | 'aberrant' | 'Common' | 'Uncommon' | 'Rare';

export interface FishIntent {
  type: IntentType;
  value: number; // Damage for Thrash, meters for DeepDive, 0 for Rest
  name: string;
  description: string;
}

export interface FishData {
  id: string;
  speciesName: string;
  speciesType: SpeciesType;
  zoneTier: 1 | 2 | 3 | 4;
  startingDistance: number; // Enemy HP (0m = caught!)
  lineDamagePower: number;
  intentPattern: FishIntent[];
  rarity: FishRarity;
  sellValue: number;
  description: string;

  // Compatibility and contract aliases matching FishSpeciesConfig
  name: string;
  linePower: number;
  marketValue: number;
  spriteAssetKey: string;
  intents: FishIntent[];
}

export interface FishSpeciesConfig {
  id: SpeciesType;
  name: string;
  zoneTier: 1 | 2 | 3 | 4;
  rarity: 'common' | 'uncommon' | 'rare' | 'aberrant';
  startingDistance: number;
  linePower: number;
  marketValue: number;
  spriteAssetKey: string;
  intents: FishIntent[];
}

export const ALL_SPECIES_TYPES: SpeciesType[] = [
  'perch',
  'flounder',
  'ghost_cod',
  'pike',
  'sculpin',
  'teal_snapper',
  'gar',
  'angler',
  'gulper',
  'maw_worm',
  'cthulhu_spawn',
  'dagon'
];

export const ZONE_SPECIES_MAP: Record<1 | 2 | 3 | 4, {
  common: SpeciesType;
  uncommon: SpeciesType;
  rare: SpeciesType;
  aberrant?: SpeciesType;
}> = {
  1: {
    common: 'perch',
    uncommon: 'flounder',
    rare: 'ghost_cod'
  },
  2: {
    common: 'pike',
    uncommon: 'sculpin',
    rare: 'teal_snapper'
  },
  3: {
    common: 'gar',
    uncommon: 'angler',
    rare: 'gulper'
  },
  4: {
    common: 'maw_worm',
    uncommon: 'cthulhu_spawn',
    rare: 'dagon',
    aberrant: 'dagon'
  }
};

export function getSpeciesForZone(
  tier: 1 | 2 | 3 | 4,
  rarity: 'common' | 'uncommon' | 'rare' | 'aberrant' | 'Common' | 'Uncommon' | 'Rare'
): SpeciesType {
  const normRarity = rarity.toLowerCase() as 'common' | 'uncommon' | 'rare' | 'aberrant';
  const entry = ZONE_SPECIES_MAP[tier];
  if (normRarity === 'aberrant') {
    return entry.aberrant ?? entry.rare;
  }
  return entry[normRarity] ?? entry.common;
}

export function getFishData(type: SpeciesType): FishData {
  return FISH_REGISTRY[type];
}

export function getAllFishForZone(tier: 1 | 2 | 3 | 4): FishData[] {
  return Object.values(FISH_REGISTRY).filter((fish) => fish.zoneTier === tier);
}

const perchIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 8,
    name: 'Spine Thrash',
    description: 'Twitches with jagged venomous dorsal spines for 8 Tension.'
  },
  {
    type: 'Thrash',
    value: 6,
    name: 'Barbel Lash',
    description: 'Whips clammy chin feelers, inflicting 6 Tension.'
  },
  {
    type: 'DeepDive',
    value: 5,
    name: 'Muck Burrow',
    description: 'Burrows into rotting eel-grass muck, gaining +5m Distance.'
  },
  {
    type: 'Thrash',
    value: 9,
    name: 'Venom Surge',
    description: 'Violently spasms against the leader, inflicting 9 Tension!'
  }
];

const flounderIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 10,
    name: 'Sandy Tremor',
    description: 'Violently thrashes in the silt cloud, inflicting 10 Tension.'
  },
  {
    type: 'DeepDive',
    value: 8,
    name: 'Silt Camouflage',
    description: 'Kicks up a blinding flurry of sand and retreats +8m.'
  },
  {
    type: 'Thrash',
    value: 12,
    name: 'Pectoral Snap',
    description: 'Snaps muscular fins against the seabed, causing 12 Tension.'
  },
  {
    type: 'Rest',
    value: 0,
    name: 'Flatfish Stillness',
    description: 'Freezes motionless against the sea bed, waiting in silent ambush.'
  }
];

const ghostCodIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 12,
    name: 'Ethereal Churn',
    description: 'Spasms with phantom energy, racking the line for 12 Tension.'
  },
  {
    type: 'DeepDive',
    value: 12,
    name: 'Spectral Plunge',
    description: 'Drifts ghost-like toward deeper trenches, taking +12m Distance.'
  },
  {
    type: 'Thrash',
    value: 15,
    name: 'Barrow Bite',
    description: 'Clamps necrotic jaws onto the leader, inflicting 15 Tension!'
  },
  {
    type: 'DeepDive',
    value: 6,
    name: 'Fog Drift',
    description: 'Dissolves partially into misty brine, gaining +6m Distance.'
  }
];

const pikeIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 13,
    name: 'Fang Tear',
    description: 'Snaps needle-teeth violently against the leader for 13 Tension.'
  },
  {
    type: 'DeepDive',
    value: 10,
    name: 'Fog Plunge',
    description: 'Dives toward the submerged timbers, gaining +10m Distance.'
  },
  {
    type: 'Thrash',
    value: 16,
    name: 'Convulsive Surge',
    description: 'Death rolls with unnatural ferocity, inflicting 16 Tension!'
  },
  {
    type: 'DeepDive',
    value: 8,
    name: 'Abyssal Lurk',
    description: 'Backs into the deep gloom, gaining +8m Distance.'
  }
];

const sculpinIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 15,
    name: 'Thorn Quill Strike',
    description: 'Drives barbed venomous quills against the line for 15 Tension.'
  },
  {
    type: 'Thrash',
    value: 17,
    name: 'Venom Spasm',
    description: 'Convulses with toxic fury, inflicting 17 Tension!'
  },
  {
    type: 'DeepDive',
    value: 12,
    name: 'Kelp Tangle',
    description: 'Weaves line through thick kelp stipes, gaining +12m Distance.'
  },
  {
    type: 'Rest',
    value: 0,
    name: 'Camouflaged Wait',
    description: 'Hunkers down motionless in the kelp bed to recover.'
  }
];

const tealSnapperIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 18,
    name: 'Phosphor Flash',
    description: 'Blinds the angler with a pulsing flare, inflicting 18 Tension.'
  },
  {
    type: 'DeepDive',
    value: 14,
    name: 'Biolum Dive',
    description: 'Streaks in an emerald arc toward the reefs, pulling +14m.'
  },
  {
    type: 'Thrash',
    value: 20,
    name: 'Emerald Tear',
    description: 'Snaps razor jaws coated in caustic phosphor for 20 Tension!'
  },
  {
    type: 'DeepDive',
    value: 10,
    name: 'Blinding Flash',
    description: 'Emits a dazzling burst of blue-green light, gaining +10m Distance.'
  }
];

const garIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 18,
    name: 'Runic Surge',
    description: 'Basalt scutes grind against the line, inflicting 18 Tension.'
  },
  {
    type: 'DeepDive',
    value: 16,
    name: 'Chasm Plunge',
    description: 'Pulls toward the non-euclidean chasm, gaining +16m Distance.'
  },
  {
    type: 'Thrash',
    value: 22,
    name: 'Titan Death-Roll',
    description: 'Unleashes crushing primordial fury, inflicting 22 Tension!'
  },
  {
    type: 'Thrash',
    value: 15,
    name: 'Abyssal Slam',
    description: 'Slams armored snout into the dark floor, inflicting 15 Tension.'
  }
];

const anglerIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 22,
    name: 'Baited Snap',
    description: 'Hinged jaws spring shut with crushing force, inflicting 22 Tension.'
  },
  {
    type: 'DeepDive',
    value: 18,
    name: 'Shadow Sink',
    description: 'Recedes into lightless fathoms beneath the galleon wreck, gaining +18m.'
  },
  {
    type: 'Thrash',
    value: 26,
    name: 'Cavernous Chomp',
    description: 'Swallows the leader in a violent vacuum bite, dealing 26 Tension!'
  },
  {
    type: 'DeepDive',
    value: 15,
    name: 'Lure Haul-Back',
    description: 'Pulls back with hypnotic lure motion, gaining +15m Distance.'
  }
];

const gulperIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 25,
    name: 'Distended Gulp',
    description: 'Huge elastic maw engulfs and strains the tackle for 25 Tension.'
  },
  {
    type: 'DeepDive',
    value: 20,
    name: 'Visceral Plunge',
    description: 'Heavily weighted body drops like lead toward the abyss, taking +20m.'
  },
  {
    type: 'Thrash',
    value: 30,
    name: 'Bloated Death Roll',
    description: 'Thrashing bulk twists violently in the depths, inflicting 30 Tension!'
  },
  {
    type: 'Rest',
    value: 0,
    name: 'Torpid Digestion',
    description: 'Lies motionless in the pitch black while struggling to digest.'
  }
];

const mawWormIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 26,
    name: 'Tooth Ring Grind',
    description: 'Revolving rings of teeth saw into the leader, inflicting 26 Tension.'
  },
  {
    type: 'DeepDive',
    value: 22,
    name: 'Benthic Boring',
    description: 'Bores violently into volcanic fissures, gaining +22m Distance.'
  },
  {
    type: 'Thrash',
    value: 32,
    name: 'Thermal Vent Lunge',
    description: 'Explodes upward through boiling mineral vents for 32 Tension!'
  },
  {
    type: 'DeepDive',
    value: 18,
    name: 'Basalt Burrow',
    description: 'Drags tackle into narrow stone tunnels, taking +18m Distance.'
  }
];

const cthulhuSpawnIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 30,
    name: 'Tentacle Lash',
    description: 'Mass of barbed suckers lashes the line violently, inflicting 30 Tension.'
  },
  {
    type: 'DeepDive',
    value: 25,
    name: 'Miasma Submerge',
    description: 'Expels cloud of psychic ink and dives +25m into the chasm.'
  },
  {
    type: 'Thrash',
    value: 35,
    name: 'Mind-Shattering Spasm',
    description: 'A horrific mental shockwave thrashes the tackle for 35 Tension!'
  },
  {
    type: 'Thrash',
    value: 28,
    name: 'Constricting Wrap',
    description: 'Tentacles coil around the leader with crushing grip, inflicting 28 Tension.'
  }
];

const dagonIntents: FishIntent[] = [
  {
    type: 'Thrash',
    value: 35,
    name: 'Primordial Maw-Crush',
    description: 'Towering primordial jaws snap for a crushing 35 Tension!'
  },
  {
    type: 'DeepDive',
    value: 28,
    name: 'Chasm Void-Sink',
    description: 'Sinks into the infinite abyss, gaining +28m Distance.'
  },
  {
    type: 'Thrash',
    value: 42,
    name: 'Cyclopean Spasm',
    description: 'Violent cataclysmic thrashing, inflicting 42 Tension!'
  },
  {
    type: 'Thrash',
    value: 32,
    name: "Dagon's Writhing Wave",
    description: 'Tentacle wave surges against the line for 32 Tension.'
  }
];

export const FISH_REGISTRY: Record<SpeciesType, FishData> = {
  // ─── ZONE 1: THE SHALLOWS (COASTAL SHOALS, 0-30m) ──────────────────────
  perch: {
    id: 'fish_sunny_perch',
    speciesName: 'Innsmouth Perch',
    name: 'Innsmouth Perch',
    speciesType: 'perch',
    zoneTier: 1,
    startingDistance: 30,
    lineDamagePower: 8,
    linePower: 8,
    rarity: 'common',
    sellValue: 15,
    marketValue: 15,
    spriteAssetKey: '/assets/sprites/fishing/fish_shadowy_perch_s6.png',
    description: 'A brackish dweller of the fog-choked shallows. Its unblinking glassy eyes possess an eerie, almost human gaze.',
    intentPattern: perchIntents,
    intents: perchIntents
  },

  flounder: {
    id: 'fish_benthic_flounder',
    speciesName: 'Benthic Flounder',
    name: 'Benthic Flounder',
    speciesType: 'flounder',
    zoneTier: 1,
    startingDistance: 42,
    lineDamagePower: 11,
    linePower: 11,
    rarity: 'uncommon',
    sellValue: 32,
    marketValue: 32,
    spriteAssetKey: '/assets/sprites/fishing/fish_flounder_benthic.png',
    description: 'A grotesque flatfish embedded in the seafloor silt. Both uncanny eyes stare upward from the same side of its mottled skull.',
    intentPattern: flounderIntents,
    intents: flounderIntents
  },

  ghost_cod: {
    id: 'fish_pale_ghost_cod',
    speciesName: 'Pale Ghost-Cod',
    name: 'Pale Ghost-Cod',
    speciesType: 'ghost_cod',
    zoneTier: 1,
    startingDistance: 50,
    lineDamagePower: 14,
    linePower: 14,
    rarity: 'rare',
    sellValue: 55,
    marketValue: 55,
    spriteAssetKey: '/assets/sprites/fishing/fish_gray_cod.png',
    description: 'A translucent, bleached gadid with milky cataract eyes and cold phantom-white scales that seem to pass through solid netting.',
    intentPattern: ghostCodIntents,
    intents: ghostCodIntents
  },

  // ─── ZONE 2: THE FOGGY BANKS (KELP SHALLOWS, 30-60m) ───────────────────
  pike: {
    id: 'fish_river_pike',
    speciesName: 'Blighted Pike',
    name: 'Blighted Pike',
    speciesType: 'pike',
    zoneTier: 2,
    startingDistance: 52,
    lineDamagePower: 15,
    linePower: 15,
    rarity: 'common',
    sellValue: 40,
    marketValue: 40,
    spriteAssetKey: '/assets/sprites/fishing/fish_brown_mutant.png',
    description: 'A mottled predator prowling the fog-shrouded sound. Covered in pale sensory pustules and jagged translucent fangs.',
    intentPattern: pikeIntents,
    intents: pikeIntents
  },

  sculpin: {
    id: 'fish_spiky_sculpin',
    speciesName: 'Spiky Kelp Sculpin',
    name: 'Spiky Kelp Sculpin',
    speciesType: 'sculpin',
    zoneTier: 2,
    startingDistance: 62,
    lineDamagePower: 18,
    linePower: 18,
    rarity: 'uncommon',
    sellValue: 65,
    marketValue: 65,
    spriteAssetKey: '/assets/sprites/fishing/fish_spiky_sculpin.png',
    description: 'An armored, venomous lurker camouflaged within the tangled kelp stalks. Its barbed spines drip virulent green ichor.',
    intentPattern: sculpinIntents,
    intents: sculpinIntents
  },

  teal_snapper: {
    id: 'fish_biolum_teal_snapper',
    speciesName: 'Bioluminescent Teal Snapper',
    name: 'Bioluminescent Teal Snapper',
    speciesType: 'teal_snapper',
    zoneTier: 2,
    startingDistance: 70,
    lineDamagePower: 20,
    linePower: 20,
    rarity: 'rare',
    sellValue: 95,
    marketValue: 95,
    spriteAssetKey: '/assets/sprites/fishing/fish_teal_snapper.png',
    description: 'A radiant deep-reef snapper whose phosphorescent scales flare with unnatural teal fire when threatened.',
    intentPattern: tealSnapperIntents,
    intents: tealSnapperIntents
  },

  // ─── ZONE 3: THE SUNKEN REEFS (ABYSSAL TRENCH, 60-100m) ─────────────────
  gar: {
    id: 'fish_abyssal_gar',
    speciesName: 'Abyssal Void-Gar',
    name: 'Abyssal Void-Gar',
    speciesType: 'gar',
    zoneTier: 3,
    startingDistance: 75,
    lineDamagePower: 22,
    linePower: 22,
    rarity: 'common',
    sellValue: 90,
    marketValue: 90,
    spriteAssetKey: '/assets/sprites/fishing/fish_abyssal_eel.png',
    description: 'An ancient, heavily armored monstrosity dredged from the sunken cyclopean trench. Its scutes glow with eerie abyssal runes.',
    intentPattern: garIntents,
    intents: garIntents
  },

  angler: {
    id: 'fish_angler_pale_lure',
    speciesName: 'Pale Lure Angler',
    name: 'Pale Lure Angler',
    speciesType: 'angler',
    zoneTier: 3,
    startingDistance: 86,
    lineDamagePower: 25,
    linePower: 25,
    rarity: 'uncommon',
    sellValue: 135,
    marketValue: 135,
    spriteAssetKey: '/assets/sprites/fishing/fish_angler_pale_lure.png',
    description: 'A cavernous-mouthed horror from the sunless deep. A pale fleshy esca dangles before rows of translucent needle teeth.',
    intentPattern: anglerIntents,
    intents: anglerIntents
  },

  gulper: {
    id: 'fish_visceral_gut_swollen',
    speciesName: 'Visceral Swollen Gulper',
    name: 'Visceral Swollen Gulper',
    speciesType: 'gulper',
    zoneTier: 3,
    startingDistance: 98,
    lineDamagePower: 28,
    linePower: 28,
    rarity: 'rare',
    sellValue: 185,
    marketValue: 185,
    spriteAssetKey: '/assets/sprites/fishing/fish_visceral_gut_swollen.png',
    description: 'A nightmarish pelagic eel whose stomach and jaw can distend to swallow creatures twice its size. Pulsing organs glow within.',
    intentPattern: gulperIntents,
    intents: gulperIntents
  },

  // ─── ZONE 4: THE ELDRITCH TRENCH (SUBTERRANEAN SEA CAVE, 100m+) ─────────
  maw_worm: {
    id: 'leviathan_abyssal_maw_worm',
    speciesName: 'Abyssal Maw-Worm',
    name: 'Abyssal Maw-Worm',
    speciesType: 'maw_worm',
    zoneTier: 4,
    startingDistance: 105,
    lineDamagePower: 30,
    linePower: 30,
    rarity: 'common',
    sellValue: 160,
    marketValue: 160,
    spriteAssetKey: '/assets/sprites/fishing/leviathan_abyssal_maw_worm.png',
    description: 'A colossal vermiform beast that bores through subterranean basalt. Concentric rings of chitinous teeth line its gaping maw.',
    intentPattern: mawWormIntents,
    intents: mawWormIntents
  },

  cthulhu_spawn: {
    id: 'fish_cthulhu_tentacled',
    speciesName: 'Tentacled Cthulhu-Spawn',
    name: 'Tentacled Cthulhu-Spawn',
    speciesType: 'cthulhu_spawn',
    zoneTier: 4,
    startingDistance: 120,
    lineDamagePower: 34,
    linePower: 34,
    rarity: 'uncommon',
    sellValue: 225,
    marketValue: 225,
    spriteAssetKey: '/assets/sprites/fishing/fish_cthulhu_tentacled.png',
    description: 'A writhing offspring of the sunken sleep. Dozens of barbed suction-tentacles surround a beak dripping sanity-corroding slime.',
    intentPattern: cthulhuSpawnIntents,
    intents: cthulhuSpawnIntents
  },

  dagon: {
    id: 'leviathan_apex_dagon',
    speciesName: 'Apex Leviathan Dagon',
    name: 'Apex Leviathan Dagon',
    speciesType: 'dagon',
    zoneTier: 4,
    startingDistance: 140,
    lineDamagePower: 40,
    linePower: 40,
    rarity: 'aberrant',
    sellValue: 250,
    marketValue: 350,
    spriteAssetKey: '/assets/sprites/fishing/leviathan_apex_dagon.png',
    description: 'The primordial cyclopean god-beast of the sunken city! Massive writhing tentacles and abyssal fury.',
    intentPattern: dagonIntents,
    intents: dagonIntents
  }
};

