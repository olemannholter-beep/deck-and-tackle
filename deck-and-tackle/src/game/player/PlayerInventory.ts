import type { CardData } from '../battle/CardData';
import { createStarterDeck } from '../battle/CardData';

export interface StaminaUpgradeTier {
  level: number;
  title: string;
  bonusStamina: number;
  cost: number;
  shortDesc: string;
  lore: string;
}

export interface LineHealthUpgradeTier {
  level: number;
  title: string;
  bonusLine: number;
  cost: number;
  shortDesc: string;
  lore: string;
}

export const STAMINA_UPGRADES: StaminaUpgradeTier[] = [
  {
    level: 1,
    title: "Brass Diver's Bellows",
    bonusStamina: 1,
    cost: 40,
    shortDesc: '+1 Max Stamina (2 → 3)',
    lore: 'Pressurized breathing canisters forged for abyssal salvage. Grants additional vigor to haul against violent currents.'
  },
  {
    level: 2,
    title: 'Eldritch Heart Conduit',
    bonusStamina: 1,
    cost: 80,
    shortDesc: '+1 Max Stamina (3 → 4)',
    lore: 'A pulsating biological core grafted to your vessel. Your spirit surges with unnatural, tireless stamina.'
  },
  {
    level: 3,
    title: "Leviathan's Pulse",
    bonusStamina: 1,
    cost: 150,
    shortDesc: '+1 Max Stamina (4 → 5)',
    lore: 'Resonates in sync with the primordial pulse of Dagon. Endless endurance churns through your veins.'
  }
];

export const LINE_HEALTH_UPGRADES: LineHealthUpgradeTier[] = [
  {
    level: 1,
    title: 'Tar-Boiled Cordage',
    bonusLine: 5,
    cost: 25,
    shortDesc: '+5 Max Line (20 → 25)',
    lore: 'Coarse natural hemp boiled in black pine pitch. Resists the initial snapping fury of thrashing quarry.'
  },
  {
    level: 2,
    title: 'Braided Steel Wire Line',
    bonusLine: 5,
    cost: 45,
    shortDesc: '+5 Max Line (25 → 30)',
    lore: 'Multi-strand tempered steel cord designed for offshore whalers. Drastically reduces catastrophic snap risk.'
  },
  {
    level: 3,
    title: 'Kraken Sinew Filaments',
    bonusLine: 5,
    cost: 70,
    shortDesc: '+5 Max Line (30 → 35)',
    lore: 'Flexible, unbreakable connective tissue harvested from pelagic behemoths. Absorbs violent sudden jerks.'
  },
  {
    level: 4,
    title: 'Void-Bound Tensile Weave',
    bonusLine: 5,
    cost: 100,
    shortDesc: '+5 Max Line (35 → 40)',
    lore: 'Non-euclidean weave shimmering with violet iridescence. Withstands direct abyssal crushing forces.'
  }
];

export class PlayerInventory {
  public gold: number = 25; // Starting wallet gold
  public deck: CardData[] = [];
  public totalFishCaught: number = 0;

  // Upgradable Player Stats (Base values)
  public baseMaxStamina: number = 2;
  public baseMaxLineIntegrity: number = 20;

  // Upgrade Levels (number of purchased tiers)
  public staminaUpgradeLevel: number = 0;
  public lineHealthUpgradeLevel: number = 0;

  constructor() {
    this.deck = createStarterDeck();
  }

  public get maxStamina(): number {
    let stamina = this.baseMaxStamina;
    for (let i = 0; i < this.staminaUpgradeLevel; i++) {
      if (STAMINA_UPGRADES[i]) {
        stamina += STAMINA_UPGRADES[i].bonusStamina;
      }
    }
    return stamina;
  }

  public get maxLineIntegrity(): number {
    let line = this.baseMaxLineIntegrity;
    for (let i = 0; i < this.lineHealthUpgradeLevel; i++) {
      if (LINE_HEALTH_UPGRADES[i]) {
        line += LINE_HEALTH_UPGRADES[i].bonusLine;
      }
    }
    return line;
  }

  public getNextStaminaUpgrade(): StaminaUpgradeTier | null {
    if (this.staminaUpgradeLevel < STAMINA_UPGRADES.length) {
      return STAMINA_UPGRADES[this.staminaUpgradeLevel];
    }
    return null;
  }

  public getNextLineHealthUpgrade(): LineHealthUpgradeTier | null {
    if (this.lineHealthUpgradeLevel < LINE_HEALTH_UPGRADES.length) {
      return LINE_HEALTH_UPGRADES[this.lineHealthUpgradeLevel];
    }
    return null;
  }

  public upgradeStamina(): boolean {
    const nextTier = this.getNextStaminaUpgrade();
    if (!nextTier) return false;
    if (this.spendGold(nextTier.cost)) {
      this.staminaUpgradeLevel++;
      return true;
    }
    return false;
  }

  public upgradeLineHealth(): boolean {
    const nextTier = this.getNextLineHealthUpgrade();
    if (!nextTier) return false;
    if (this.spendGold(nextTier.cost)) {
      this.lineHealthUpgradeLevel++;
      return true;
    }
    return false;
  }

  public addGold(amount: number): void {
    this.gold += amount;
  }

  public spendGold(amount: number): boolean {
    if (this.gold >= amount) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  public addCard(card: CardData): void {
    this.deck.push({ ...card });
  }

  public getDeckCopy(): CardData[] {
    return this.deck.map(c => ({ ...c }));
  }
}
