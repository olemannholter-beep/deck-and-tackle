import type { CardData } from './CardData';
import { createStarterDeck } from './CardData';
import type { FishData, FishIntent, SpeciesType } from './FishData';
import { FISH_REGISTRY } from './FishData';
import { AudioManager } from '../../engine/AudioManager';

export type BattleStatus = 'player_turn' | 'fish_turn' | 'victory' | 'defeat';

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
  maxLife: number;
}

export class BattleEngine {
  // Player state
  public maxLineIntegrity: number = 20;
  public lineIntegrity: number = 20; // Player HP (lowered to 20 for tight, punishing combat)
  public lineSlack: number = 0; // Block (absorbs tension)
  public maxStamina: number = 2;
  public stamina: number = 2; // Energy (2 stamina economy)

  // Master deck template
  private masterDeck: CardData[] = [];

  // Card piles
  public drawPile: CardData[] = [];
  public hand: CardData[] = [];
  public discardPile: CardData[] = [];
  public exhaustPile: CardData[] = []; // Once-per-battle techniques exhausted from fight

  // Fish enemy state
  public fish: FishData;
  public distanceToBoat: number = 40; // Enemy HP (0m = caught)
  public maxStartingDistance: number = 40;
  public currentIntentIndex: number = 0;
  public fishExhausted: number = 0; // Status effect (reduces Thrash tension)
  public fishChummed: number = 0;

  // Battle flow
  public status: BattleStatus = 'player_turn';
  public turnNumber: number = 1;

  // Floating combat feedback texts
  public floatingTexts: FloatingText[] = [];

  // Callbacks
  public onVictory?: () => void;
  public onDefeat?: () => void;

  constructor(
    speciesType: SpeciesType = 'pike',
    playerDeck?: CardData[],
    playerStats?: { maxStamina?: number; maxLineIntegrity?: number }
  ) {
    if (playerStats?.maxStamina !== undefined) {
      this.maxStamina = playerStats.maxStamina;
      this.stamina = playerStats.maxStamina;
    }
    if (playerStats?.maxLineIntegrity !== undefined) {
      this.maxLineIntegrity = playerStats.maxLineIntegrity;
      this.lineIntegrity = playerStats.maxLineIntegrity;
    }
    this.fish = { ...FISH_REGISTRY[speciesType] };
    this.distanceToBoat = this.fish.startingDistance;
    this.maxStartingDistance = this.fish.startingDistance;
    this.masterDeck = playerDeck ? playerDeck.map(c => ({ ...c })) : createStarterDeck();
    this.initDeck();
    this.startPlayerTurn();
  }

  public setPlayerStats(maxStamina: number, maxLineIntegrity: number): void {
    this.maxStamina = maxStamina;
    this.maxLineIntegrity = maxLineIntegrity;
  }

  public reset(
    speciesType: SpeciesType,
    playerDeck?: CardData[],
    playerStats?: { maxStamina?: number; maxLineIntegrity?: number }
  ): void {
    if (playerStats?.maxStamina !== undefined) {
      this.maxStamina = playerStats.maxStamina;
    }
    if (playerStats?.maxLineIntegrity !== undefined) {
      this.maxLineIntegrity = playerStats.maxLineIntegrity;
    }
    this.fish = { ...FISH_REGISTRY[speciesType] };
    this.distanceToBoat = this.fish.startingDistance;
    this.maxStartingDistance = this.fish.startingDistance;
    this.lineIntegrity = this.maxLineIntegrity;
    this.lineSlack = 0;
    this.stamina = this.maxStamina;
    this.currentIntentIndex = 0;
    this.fishExhausted = 0;
    this.fishChummed = 0;
    this.status = 'player_turn';
    this.turnNumber = 1;
    this.floatingTexts = [];
    this.exhaustPile = [];
    if (playerDeck) {
      this.masterDeck = playerDeck.map(c => ({ ...c }));
    }
    this.initDeck();
    this.startPlayerTurn();
  }

  private initDeck(): void {
    this.drawPile = this.shuffle(this.masterDeck.map(c => ({ ...c })));
    this.hand = [];
    this.discardPile = [];
    this.exhaustPile = [];
  }

  private shuffle(array: CardData[]): CardData[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  public getCurrentIntent(): FishIntent {
    const pattern = this.fish.intentPattern;
    return pattern[this.currentIntentIndex % pattern.length];
  }

  public getEffectiveIntentValue(): number {
    const intent = this.getCurrentIntent();
    if (intent.type === 'Thrash') {
      return Math.max(0, intent.value - this.fishExhausted);
    }
    return intent.value;
  }

  public startPlayerTurn(): void {
    if (this.status === 'victory' || this.status === 'defeat') return;

    this.status = 'player_turn';
    this.stamina = this.maxStamina;
    this.lineSlack = 0; // Slack resets each turn

    // Draw up to 5 cards (or remaining hand)
    this.drawCards(5);
  }

  public drawCards(count: number): void {
    const initialCount = this.hand.length;
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        // Reshuffle discard into draw pile
        this.drawPile = this.shuffle(this.discardPile);
        this.discardPile = [];
      }
      const card = this.drawPile.pop();
      if (card) {
        this.hand.push(card);
      }
    }
    if (this.hand.length > initialCount) {
      AudioManager.getInstance().playCardDraw();
    }
  }

  public isCardTechnique(card: CardData): boolean {
    return card.cardType === 'Technique' || !!card.oncePerBattle;
  }

  public canPlayCard(cardIndex: number): boolean {
    if (this.status !== 'player_turn') return false;
    const card = this.hand[cardIndex];
    if (!card) return false;
    return this.stamina >= card.staminaCost;
  }

  public playCard(cardIndex: number): boolean {
    if (!this.canPlayCard(cardIndex)) return false;

    const [card] = this.hand.splice(cardIndex, 1);
    if (!card) return false;

    // 1. Deduct Stamina
    this.stamina -= card.staminaCost;

    // 2. Pull Distance (Damage to distance)
    if (card.effect.pullDistance && card.effect.pullDistance > 0) {
      let pull = card.effect.pullDistance;
      if (this.fishChummed > 0) pull += 3;
      this.distanceToBoat = Math.max(0, this.distanceToBoat - pull);
      this.addFloatingText(`-${pull}m`, 0.65, 0.5, '#48cae4');
    }

    // 3. Gain Slack (Block)
    if (card.effect.slackGain && card.effect.slackGain > 0) {
      this.lineSlack += card.effect.slackGain;
      this.addFloatingText(`+${card.effect.slackGain} Slack`, 0.25, 0.35, '#38bdf8');
    }

    // 4. Tension Self (Line Backlash)
    const selfDmg = card.tensionSelf ?? card.effect.tensionSelf ?? 0;
    if (selfDmg > 0) {
      this.lineIntegrity = Math.max(0, this.lineIntegrity - selfDmg);
      this.addFloatingText(`-${selfDmg} Line Backlash!`, 0.25, 0.45, '#ef4444');
    }

    // 5. Status Effects
    if (card.effect.exhaustedInflict && card.effect.exhaustedInflict > 0) {
      this.fishExhausted += card.effect.exhaustedInflict;
      this.addFloatingText(`+${card.effect.exhaustedInflict} Exhausted`, 0.65, 0.42, '#c084fc');
    }
    if (card.effect.chummedInflict && card.effect.chummedInflict > 0) {
      this.fishChummed += card.effect.chummedInflict;
      this.addFloatingText(`+${card.effect.chummedInflict} Chummed`, 0.65, 0.42, '#f59e0b');
    }

    // 6. Draw Cards
    if (card.effect.drawCards && card.effect.drawCards > 0) {
      this.drawCards(card.effect.drawCards);
    }

    // Check if card is a once-per-battle Technique
    const isTechnique = this.isCardTechnique(card);
    if (isTechnique) {
      this.exhaustPile.push(card);
      this.addFloatingText('TECHNIQUE EXHAUSTED', 0.5, 0.35, '#c084fc');
    } else {
      this.discardPile.push(card);
    }

    // Audio Feedback for Card Play
    const title = card.title.toLowerCase();
    let cardType = 'play';
    if (isTechnique) {
      cardType = 'technique';
    } else if (title.includes('reel') || title.includes('winch') || title.includes('crane')) {
      cardType = 'reel';
    } else if (title.includes('drag') || title.includes('slack')) {
      cardType = 'drag';
    } else if (title.includes('strike') || title.includes('tug')) {
      cardType = 'strike';
    }
    AudioManager.getInstance().playCardPlay(cardType);

    // Check Victory
    if (this.distanceToBoat <= 0.001) {
      this.status = 'victory';
      this.addFloatingText('FISH LANDED!', 0.5, 0.4, '#fde047');
      AudioManager.getInstance().playCatchVictory();
      if (this.onVictory) this.onVictory();
      return true;
    }

    // Check Defeat (Line Snapped from Backlash)
    if (this.lineIntegrity <= 0) {
      this.status = 'defeat';
      this.addFloatingText('LINE SNAPPED (BACKLASH)!', 0.5, 0.4, '#ef4444');
      AudioManager.getInstance().playLineSnap();
      if (this.onDefeat) this.onDefeat();
      return true;
    }

    // Line stress warning sound if critically damaged (< 40% health)
    if (this.lineIntegrity < 8) {
      AudioManager.getInstance().playLineWarning();
    }

    return true;
  }

  public endTurn(): void {
    if (this.status !== 'player_turn') return;

    this.status = 'fish_turn';

    // Discard all remaining cards in hand
    while (this.hand.length > 0) {
      const c = this.hand.pop();
      if (c) this.discardPile.push(c);
    }

    // Execute fish intent
    const intent = this.getCurrentIntent();

    if (intent.type === 'Thrash') {
      AudioManager.getInstance().playFishThrash();
      const rawDamage = Math.max(0, intent.value - this.fishExhausted);
      const damageToSlack = Math.min(this.lineSlack, rawDamage);
      this.lineSlack -= damageToSlack;
      const unblocked = rawDamage - damageToSlack;

      if (damageToSlack > 0) {
        this.addFloatingText(`Blocked ${damageToSlack}!`, 0.25, 0.35, '#38bdf8');
      }

      if (unblocked > 0) {
        this.lineIntegrity = Math.max(0, this.lineIntegrity - unblocked);
        this.addFloatingText(`-${unblocked} Line Damage!`, 0.25, 0.45, '#ef4444');
      }
    } else if (intent.type === 'DeepDive') {
      AudioManager.getInstance().playFishDeepDive();
      this.distanceToBoat += intent.value;
      this.addFloatingText(`+${intent.value}m Dive!`, 0.65, 0.5, '#f43f5e');
    } else if (intent.type === 'Rest') {
      this.addFloatingText('Resting...', 0.65, 0.45, '#94a3b8');
    }

    // Decay status effects
    if (this.fishExhausted > 0) {
      this.fishExhausted = Math.max(0, this.fishExhausted - 1);
    }
    if (this.fishChummed > 0) {
      this.fishChummed = Math.max(0, this.fishChummed - 1);
    }

    // Advance intent index
    this.currentIntentIndex = (this.currentIntentIndex + 1) % this.fish.intentPattern.length;

    // Check Defeat condition
    if (this.lineIntegrity <= 0) {
      this.status = 'defeat';
      this.addFloatingText('LINE SNAPPED!', 0.5, 0.4, '#ef4444');
      AudioManager.getInstance().playLineSnap();
      if (this.onDefeat) this.onDefeat();
      return;
    }

    if (this.lineIntegrity < 8) {
      AudioManager.getInstance().playLineWarning();
    }

    // Start next player turn
    this.turnNumber++;
    this.startPlayerTurn();
  }

  public addFloatingText(text: string, xRatio: number, yRatio: number, color: string): void {
    this.floatingTexts.push({
      text,
      x: xRatio,
      y: yRatio,
      color,
      life: 0,
      maxLife: 1.5
    });
  }

  public update(dt: number): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      ft.y -= dt * 0.05;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }
}
