export type IntentType = 'Thrash' | 'DeepDive' | 'Rest';

export type SpeciesType = 'perch' | 'pike' | 'gar' | 'dagon';

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
  startingDistance: number; // Enemy HP (0m = caught!)
  lineDamagePower: number;
  intentPattern: FishIntent[];
  rarity: 'Common' | 'Uncommon' | 'Rare';
  sellValue: number;
  description: string;
}

export const FISH_REGISTRY: Record<SpeciesType, FishData> = {
  perch: {
    id: 'fish_sunny_perch',
    speciesName: 'Innsmouth Perch',
    speciesType: 'perch',
    startingDistance: 30, // 30m starting distance
    lineDamagePower: 8,
    rarity: 'Common',
    sellValue: 15,
    description: 'A brackish dweller of the fog-choked shallows. Its unblinking glassy eyes possess an eerie, almost human gaze.',
    intentPattern: [
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
    ]
  },

  pike: {
    id: 'fish_river_pike',
    speciesName: 'Blighted Pike',
    speciesType: 'pike',
    startingDistance: 52, // 52m starting distance
    lineDamagePower: 15,
    rarity: 'Uncommon',
    sellValue: 40,
    description: 'A mottled predator prowling the fog-shrouded sound. Covered in pale sensory pustules and jagged translucent fangs.',
    intentPattern: [
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
    ]
  },

  gar: {
    id: 'fish_abyssal_gar',
    speciesName: 'Abyssal Void-Gar',
    speciesType: 'gar',
    startingDistance: 75, // 75m starting distance
    lineDamagePower: 22,
    rarity: 'Rare',
    sellValue: 90,
    description: 'An ancient, heavily armored monstrosity dredged from the sunken cyclopean trench. Its scutes glow with eerie abyssal runes.',
    intentPattern: [
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
    ]
  },

  dagon: {
    id: 'leviathan_apex_dagon',
    speciesName: 'Apex Dagon',
    speciesType: 'dagon',
    startingDistance: 110, // 110m starting distance
    lineDamagePower: 32,
    rarity: 'Rare',
    sellValue: 250,
    description: 'The primordial cyclopean god-beast of the sunken city! Massive writhing tentacles and abyssal fury.',
    intentPattern: [
      {
        type: 'Thrash',
        value: 28,
        name: 'Primordial Maw-Crush',
        description: 'Towering jaws snap for a crushing 28 Tension!'
      },
      {
        type: 'DeepDive',
        value: 22,
        name: 'Chasm Void-Sink',
        description: 'Sinks into the infinite abyss, gaining +22m Distance.'
      },
      {
        type: 'Thrash',
        value: 36,
        name: 'Cyclopean Spasm',
        description: 'Violent cataclysmic thrashing, inflicting 36 Tension!'
      },
      {
        type: 'Thrash',
        value: 25,
        name: "Dagon's Writhing Wave",
        description: 'Tentacle wave surges against the line for 25 Tension.'
      }
    ]
  }
};
