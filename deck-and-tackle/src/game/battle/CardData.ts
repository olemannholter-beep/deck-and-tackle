export type CardType = 'Reel' | 'Drag' | 'Technique' | 'Power';

export interface CardEffect {
  pullDistance?: number;
  slackGain?: number;
  tensionSelf?: number;
  exhaustedInflict?: number;
  chummedInflict?: number;
  drawCards?: number;
}

export interface CardData {
  id: string;
  title: string;
  cardType: CardType;
  oncePerBattle?: boolean; // Techniques are powerful once-per-fight abilities
  staminaCost: number; // Stamina cost (0, 1, 2, 3)
  pullDistance: number; // Meters pulled toward boat
  slackGain: number; // Slack gained (absorbs tension)
  tensionAdded: number; // Direct tension to line
  tensionSelf?: number; // Direct self-damage / line backlash
  statusEffect?: {
    type: 'Exhausted' | 'Chummed';
    value: number;
  };
  description: string;
  shortDesc?: string;
  statSummary?: string;
  iconSprite?: string;
  category?: 'ledgers' | 'techniques';
  page?: 'left' | 'right';
  shopPrice?: number; // Cost in gold at the Harbor Shop
  effect: CardEffect;
}

/**
 * 4 Simple Starter Cards for the early game (Innsmouth Coastal Angler Deck).
 */
export const STARTER_CARDS: CardData[] = [
  {
    id: 'reel_in',
    title: 'Reel In',
    cardType: 'Reel',
    staminaCost: 1,
    pullDistance: 4,
    slackGain: 0,
    tensionAdded: 0,
    statSummary: '+4m Pull',
    shortDesc: 'Crank the salt-crusted winch.',
    description: 'Crank the salt-crusted winch aboard your boat. Pull 4m toward the vessel.',
    effect: {
      pullDistance: 4
    }
  },
  {
    id: 'slack_drag',
    title: 'Slack Drag',
    cardType: 'Drag',
    staminaCost: 1,
    pullDistance: 0,
    slackGain: 4,
    tensionAdded: 0,
    statSummary: '+4 Slack',
    shortDesc: 'Yield line to abyssal surges.',
    description: 'Yield line to the abyssal surge. Gain 4 Slack against thrash.',
    effect: {
      slackGain: 4
    }
  },
  {
    id: 'quick_tug',
    title: 'Snap Strike',
    cardType: 'Reel',
    staminaCost: 0,
    pullDistance: 2,
    slackGain: 0,
    tensionAdded: 0,
    statSummary: '+2m Pull',
    shortDesc: 'Desperate yank on the rod.',
    description: 'A sharp, desperate yank on the rod. Pull 2m of line.',
    effect: {
      pullDistance: 2
    }
  },
  {
    id: 'brace',
    title: 'Brace',
    cardType: 'Drag',
    staminaCost: 2,
    pullDistance: 0,
    slackGain: 8,
    tensionAdded: 0,
    statSummary: '+8 Slack',
    shortDesc: 'Steel boots against the surge.',
    description: 'Dig boots into wet deck, steeling against the surge. Gain 8 Slack.',
    effect: {
      slackGain: 8
    }
  }
];

/**
 * Catalog of Advanced Cards available for purchase in the Harbor Shop (O. Marsh & Sons).
 */
export const SHOP_CARDS: CardData[] = [
  // LEFT PAGE: ACTIVE TACKLE LEDGERS (Reusable Hardware)
  {
    id: 'power_winch',
    title: 'Black Iron Winch',
    cardType: 'Reel',
    staminaCost: 2,
    pullDistance: 12,
    slackGain: 0,
    tensionAdded: 0,
    shopPrice: 25,
    iconSprite: 'icon_black_iron_winch.png',
    category: 'ledgers',
    page: 'left',
    statSummary: '+12m Pull',
    shortDesc: 'Heavy salt-forged whaling winch.',
    description: 'Heavy whaling winch forged in salt and shadow. Pull 12m toward boat.',
    effect: {
      pullDistance: 12
    }
  },
  {
    id: 'spring_drag',
    title: 'Kelp Snare Drag',
    cardType: 'Drag',
    staminaCost: 0,
    pullDistance: 0,
    slackGain: 3,
    tensionAdded: 0,
    shopPrice: 45,
    iconSprite: 'icon_kelp_snare.png',
    category: 'ledgers',
    page: 'left',
    statSummary: '+3 Slack • Draw 1',
    shortDesc: 'Lash spool with slick kelp sinew.',
    description: 'Lash the spool with slick kelp sinew. Gain 3 Slack & draw 1 card.',
    effect: {
      slackGain: 3,
      drawCards: 1
    }
  },
  {
    id: 'deep_pump',
    title: 'Void Pump',
    cardType: 'Reel',
    staminaCost: 2,
    pullDistance: 16,
    slackGain: 0,
    tensionAdded: 0,
    shopPrice: 45,
    iconSprite: 'icon_void_pump.png',
    category: 'ledgers',
    page: 'left',
    statSummary: '+16m Pull',
    shortDesc: 'Rhythmic hauling against deep.',
    description: 'Rhythmic, desperate hauling against the deep. Pull a massive 16m.',
    effect: {
      pullDistance: 16
    }
  },
  {
    id: 'titan_crane',
    title: 'Cyclopean Gantry',
    cardType: 'Power',
    staminaCost: 2,
    pullDistance: 24,
    slackGain: 0,
    tensionAdded: 0,
    shopPrice: 80,
    iconSprite: 'icon_cyclopean_gantry.png',
    category: 'ledgers',
    page: 'left',
    statSummary: '+24m Pull',
    shortDesc: 'Massive steam whaling gantry.',
    description: 'Massive steam-assisted whaling gantry. Pull an incredible 24m!',
    effect: {
      pullDistance: 24
    }
  },

  // RIGHT PAGE: MYTHOS RELIC TECHNIQUES (Once-Per-Battle Abilities + Line Backlash)
  {
    id: 'desperate_haul',
    title: 'Desperate Haul',
    cardType: 'Technique',
    oncePerBattle: true,
    staminaCost: 1,
    pullDistance: 8,
    slackGain: 0,
    tensionAdded: 2,
    tensionSelf: 2,
    shopPrice: 20,
    iconSprite: 'icon_kelp_snare.png',
    category: 'techniques',
    page: 'right',
    statSummary: '+8m Pull • -2 Line',
    shortDesc: 'Wrench the rod with reckless fury.',
    description: 'Wrench the rod with desperate, reckless fury. Pull 8m at the cost of 2 Line Integrity. Can only be used once per fight.',
    effect: {
      pullDistance: 8,
      tensionSelf: 2
    }
  },
  {
    id: 'tension_strike',
    title: "Dagon's Barbed Hook",
    cardType: 'Technique',
    oncePerBattle: true,
    staminaCost: 1,
    pullDistance: 14,
    slackGain: 0,
    tensionAdded: 3,
    tensionSelf: 3,
    shopPrice: 35,
    iconSprite: 'icon_dagons_barbed_hook.png',
    category: 'techniques',
    page: 'right',
    statSummary: '+14m Pull • -3 Line',
    shortDesc: 'Deep-biting basalt whaling hook.',
    description: "Barbed basalt hook that bites into the quarry maw. Pull a devastating 14m, taking 3 Line backlash. Can only be used once per fight.",
    effect: {
      pullDistance: 14,
      tensionSelf: 3
    }
  },
  {
    id: 'feather_lure',
    title: 'Eldritch Lure',
    cardType: 'Technique',
    oncePerBattle: true,
    staminaCost: 1,
    pullDistance: 6,
    slackGain: 0,
    tensionAdded: 2,
    tensionSelf: 2,
    shopPrice: 45,
    iconSprite: 'icon_eldritch_lure.png',
    category: 'techniques',
    page: 'right',
    statSummary: '+6m • 4 Exhausted • -2 Line',
    shortDesc: 'Humming bone lure from abyss.',
    statusEffect: {
      type: 'Exhausted',
      value: 4
    },
    description: 'Humming relic carved from ancient leviathan bone. Pull 6m & inflict 4 Exhausted. Suffer 2 Line backlash. Can only be used once per fight.',
    effect: {
      pullDistance: 6,
      exhaustedInflict: 4,
      tensionSelf: 2
    }
  },
  {
    id: 'chum_scatter',
    title: 'Abyssal Chum',
    cardType: 'Technique',
    oncePerBattle: true,
    staminaCost: 1,
    pullDistance: 0,
    slackGain: 0,
    tensionAdded: 2,
    tensionSelf: 2,
    shopPrice: 15,
    iconSprite: 'icon_abyssal_chum.png',
    category: 'techniques',
    page: 'right',
    statSummary: 'Chummed 6 (+3m) • -2 Line',
    shortDesc: 'Offal steeped in black ichor.',
    statusEffect: {
      type: 'Chummed',
      value: 6
    },
    description: 'Fling offal steeped in your own blood and black ichor. Inflict 6 Chummed (+3m to all pulls). Suffer 2 Line backlash. Can only be used once per fight.',
    effect: {
      chummedInflict: 6,
      tensionSelf: 2
    }
  }
];

/**
 * Creates the initial starting deck:
 * 3x Reel In, 2x Slack Drag, 1x Quick Tug, 1x Brace (7 cards)
 * Techniques must be purchased in the shop under the Techniques tab!
 */
export function createStarterDeck(): CardData[] {
  return [
    { ...STARTER_CARDS[0] }, // Reel In
    { ...STARTER_CARDS[0] }, // Reel In
    { ...STARTER_CARDS[0] }, // Reel In
    { ...STARTER_CARDS[1] }, // Slack Drag
    { ...STARTER_CARDS[1] }, // Slack Drag
    { ...STARTER_CARDS[2] }, // Quick Tug (Snap Strike)
    { ...STARTER_CARDS[3] }  // Brace
  ];
}
