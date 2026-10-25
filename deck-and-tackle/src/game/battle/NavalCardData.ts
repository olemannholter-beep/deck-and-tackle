/**
 * NavalCardData.ts
 * Authoritative card catalog for side-angle naval broadside combat and monster standoffs.
 * Implements Milestone 4 (ORIGINAL_REQUEST §R4, PROJECT.md Feature 13).
 */

export type NavalCardId =
  | 'naval_swivel_gun'
  | 'naval_broadside'
  | 'naval_hull_bracing'
  | 'naval_evasive_tack'
  | 'naval_bilge_patch'
  | 'naval_harpoon_snare';

export interface NavalCardData {
  id: NavalCardId;
  title: string;
  staminaCost: number;
  damage: number;
  armorGain: number;
  hullRepair: number;
  dodgeChance: number;
  stunTurns: number;
  description: string;
  cardType?: 'Attack' | 'Defense' | 'Tactic' | 'Repair';
  oncePerBattle?: boolean;
}

export const AUTHORITATIVE_NAVAL_CARDS: Record<string, NavalCardData> = {
  swivel_gun: {
    id: 'naval_swivel_gun',
    title: 'Swivel Gun',
    staminaCost: 1,
    damage: 12,
    armorGain: 0,
    hullRepair: 0,
    dodgeChance: 0,
    stunTurns: 0,
    cardType: 'Attack',
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
    cardType: 'Attack',
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
    cardType: 'Defense',
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
    cardType: 'Tactic',
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
    cardType: 'Repair',
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
    cardType: 'Tactic',
    description: 'Fires barbed iron cable, dealing 8 Damage and Snaring/Stunning the target for 1 turn.'
  }
};

/**
 * Creates the starter naval deck fitted to the player's vessel.
 */
export function createStarterNavalDeck(): NavalCardData[] {
  return [
    { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
    { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
    { ...AUTHORITATIVE_NAVAL_CARDS.broadside },
    { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing },
    { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing },
    { ...AUTHORITATIVE_NAVAL_CARDS.evasive_tacking },
    { ...AUTHORITATIVE_NAVAL_CARDS.bilge_patch },
    { ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }
  ];
}
