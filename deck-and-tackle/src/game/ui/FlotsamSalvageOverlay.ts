import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';
import { PlayerInventory } from '../player/PlayerInventory';
import { BAIT_REGISTRY } from '../battle/BaitData';
import type { BaitId } from '../battle/BaitData';
import type { CardData } from '../battle/CardData';
import { SHOP_CARDS } from '../battle/CardData';

export type SalvageRewardType = 'gold' | 'bait' | 'card';

export interface SalvageReward {
  type: SalvageRewardType;
  amount?: number;
  baitId?: BaitId;
  cardTitle?: string;
  cardData?: CardData;
  title: string;
  description: string;
  lore?: string;
}

/**
 * Creates a valid CardData object for a dredged sunken card.
 */
export function createSunkenCard(cardTitle: string): CardData {
  const existing = SHOP_CARDS.find(
    c => c.title.toLowerCase() === cardTitle.toLowerCase() || c.id === cardTitle.toLowerCase()
  );
  if (existing) {
    return { ...existing };
  }

  const templates: Record<string, Partial<CardData>> = {
    'Deep-Sea Dredge': {
      cardType: 'Power',
      staminaCost: 1,
      pullDistance: 10,
      slackGain: 3,
      tensionAdded: 0,
      statSummary: '+10m Pull • +3 Slack',
      shortDesc: 'Heavy dredge scooping the chasm floor.',
      description: 'Heavy iron dredge hauling from the abyssal seabed. Pull 10m and gain 3 Slack.',
      effect: { pullDistance: 10, slackGain: 3 }
    },
    'Siren Call': {
      cardType: 'Technique',
      oncePerBattle: true,
      staminaCost: 1,
      pullDistance: 8,
      slackGain: 4,
      tensionAdded: 0,
      tensionSelf: 1,
      statSummary: '+8m Pull • +4 Slack • -1 Line',
      shortDesc: 'Hypnotic melody echoing in the deep.',
      description: 'A mournful melody resonating through the brine. Mesmerizes quarry, pulling 8m with 4 Slack.',
      effect: { pullDistance: 8, slackGain: 4, tensionSelf: 1 }
    },
    'Gilded Harpoon': {
      cardType: 'Reel',
      staminaCost: 2,
      pullDistance: 14,
      slackGain: 0,
      tensionAdded: 2,
      statSummary: '+14m Pull',
      shortDesc: 'Ancient rune-inscribed bronze harpoon.',
      description: 'Ancient bronze harpoon blessed by drowned elders. Sinks deep to haul 14m.',
      effect: { pullDistance: 14 }
    },
    'Barometric Surge': {
      cardType: 'Drag',
      staminaCost: 1,
      pullDistance: 0,
      slackGain: 7,
      tensionAdded: 0,
      statSummary: '+7 Slack • Draw 1',
      shortDesc: 'Abrupt drop in sea pressure.',
      description: 'A sudden chill pressure drop deadens the fury of waves. Gain 7 Slack and draw 1 card.',
      effect: { slackGain: 7, drawCards: 1 }
    },
    'Ghost Anchor': {
      cardType: 'Drag',
      staminaCost: 2,
      pullDistance: 0,
      slackGain: 10,
      tensionAdded: 0,
      statSummary: '+10 Slack',
      shortDesc: 'Spectral anchor holding firm.',
      description: 'Cast a spectral anchor into the lightless void. Hold the vessel rock-steady with 10 Slack.',
      effect: { slackGain: 10 }
    }
  };

  const tmpl = templates[cardTitle] || {};
  return {
    id: `sunken_${cardTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    title: cardTitle,
    cardType: tmpl.cardType ?? 'Power',
    staminaCost: tmpl.staminaCost ?? 1,
    pullDistance: tmpl.pullDistance ?? 8,
    slackGain: tmpl.slackGain ?? 2,
    tensionAdded: tmpl.tensionAdded ?? 0,
    tensionSelf: tmpl.tensionSelf,
    oncePerBattle: tmpl.oncePerBattle,
    statSummary: tmpl.statSummary ?? '+8m Pull • +2 Slack',
    shortDesc: tmpl.shortDesc ?? 'Sunken maritime relic.',
    description: tmpl.description ?? `Salvaged nautical technique: ${cardTitle}.`,
    effect: tmpl.effect ?? { pullDistance: tmpl.pullDistance ?? 8, slackGain: tmpl.slackGain ?? 2 }
  };
}

/**
 * Procedurally generates a tier-scaled salvage reward matching game diversity specifications:
 * - 50% Gold: Zone 1 (15-25g), Zone 2 (25-40g), Zone 3 (40-60g), Zone 4 (60-100g)
 * - 30% Bait: 1-2 units of purchasable bait (Lugworms, Blood Chum, Bioluminescent Squid)
 * - 20% Sunken Card: Rare nautical card added to the player's deck
 */
export function generateSalvageReward(
  zoneTier: 1 | 2 | 3 | 4,
  rollTypeFloat?: number,
  rollSubFloat?: number
): SalvageReward {
  const typeRoll = rollTypeFloat !== undefined ? rollTypeFloat : Math.random();
  const subRoll = rollSubFloat !== undefined ? rollSubFloat : Math.random();

  if (typeRoll < 0.50) {
    // 1. Gold reward
    const ranges: Record<1 | 2 | 3 | 4, [number, number]> = {
      1: [15, 25],
      2: [25, 40],
      3: [40, 60],
      4: [60, 100]
    };
    const [minG, maxG] = ranges[zoneTier] || ranges[1];
    const clampedSub = Math.max(0, Math.min(0.999999, subRoll));
    const gold = Math.max(minG, Math.min(maxG, Math.floor(minG + clampedSub * (maxG - minG + 1))));

    return {
      type: 'gold',
      amount: gold,
      title: `Barnacle-Encrusted Strongbox (+${gold} Sovereigns)`,
      description: `Dredged Waterlogged Coin Purse: +${gold} Gold Sovereigns!`,
      lore: 'A waterlogged iron-banded chest hauled from the silt. Ancient gold sovereigns gleam through rotting pitch.'
    };
  } else if (typeRoll < 0.80) {
    // 2. Bait reward
    const baitPool: BaitId[] = ['lugworms', 'blood_chum', 'bio_squid'];
    const bIndex = Math.min(2, Math.floor(subRoll * 3));
    const chosenBait = baitPool[bIndex];
    const baitConfig = BAIT_REGISTRY[chosenBait];
    const baitName = baitConfig?.name || 'Blood Chum';
    const qty = subRoll > 0.5 ? 2 : 1;

    return {
      type: 'bait',
      baitId: chosenBait,
      amount: qty,
      title: `Waterproof Bait Cask (+${qty} ${baitName})`,
      description: `Recovered Tackle Crate: +${qty}x ${baitName}!`,
      lore: 'A sealed tarred keg bobbing among sunken wreckage, miraculously preserved against the salt tide.'
    };
  } else {
    // 3. Sunken Card reward
    const sunkenCards = ['Deep-Sea Dredge', 'Siren Call', 'Gilded Harpoon', 'Barometric Surge', 'Ghost Anchor'];
    const cIndex = Math.min(sunkenCards.length - 1, Math.floor(subRoll * sunkenCards.length));
    const cardTitle = sunkenCards[cIndex];
    const cardData = createSunkenCard(cardTitle);

    return {
      type: 'card',
      cardTitle: cardTitle,
      cardData: cardData,
      amount: 1,
      title: `Sunken Grimoire Page (+1 [${cardTitle}] to Deck)`,
      description: `Sunken Ledger Parchment: Inscribed Card [${cardTitle}] added to deck!`,
      lore: 'Waterlogged vellum inscribed with forgotten maritime rites and abyssal angling lore.'
    };
  }
}

/**
 * Pure Canvas 2D overlay modal displaying dredged salvage rewards.
 * Matches the dark Victorian / Lovecraftian parchment and brass aesthetic.
 */
export class FlotsamSalvageOverlay {
  public isOpen: boolean = false;
  public currentReward: SalvageReward | null = null;
  public isClaimed: boolean = false;

  private inventory: PlayerInventory;
  private onClaimCallback: (() => void) | null = null;
  private time: number = 0;

  // Hitbox Tracking
  private claimBtnRect = { x: 0, y: 0, w: 320, h: 42 };
  private isClaimBtnHovered: boolean = false;

  constructor(inventory: PlayerInventory) {
    this.inventory = inventory;
  }

  public generateSalvageReward(
    zoneTier: 1 | 2 | 3 | 4,
    rollTypeFloat?: number,
    rollSubFloat?: number
  ): SalvageReward {
    return generateSalvageReward(zoneTier, rollTypeFloat, rollSubFloat);
  }

  /**
   * Opens the Flotsam Salvage modal with the given reward.
   */
  public open(reward: SalvageReward, onClaim?: () => void): void {
    this.isOpen = true;
    this.currentReward = reward;
    this.onClaimCallback = onClaim || null;
    this.isClaimed = false;
    this.time = 0;

    AudioManager.getInstance().playButtonClick();
  }

  /**
   * Closes the modal.
   */
  public close(): void {
    this.isOpen = false;
    this.onClaimCallback = null;
    Input.setCursor('default');
  }

  /**
   * Applies the reward to the PlayerInventory (once) and closes modal.
   */
  public claim(): void {
    if (!this.isOpen) return;

    if (!this.isClaimed && this.currentReward) {
      this.isClaimed = true;
      this.applyRewardToInventory(this.currentReward);

      if (this.currentReward.type === 'gold') {
        AudioManager.getInstance().playGoldCoins();
      } else {
        AudioManager.getInstance().playCatchVictory();
      }
    }

    const cb = this.onClaimCallback;
    this.close();
    if (cb) {
      cb();
    }
  }

  /**
   * Dismiss action (alias to claim so loot is safely credited when user presses ESC).
   */
  public dismiss(): void {
    this.claim();
  }

  private applyRewardToInventory(reward: SalvageReward): void {
    if (reward.type === 'gold') {
      this.inventory.addGold(reward.amount ?? 0);
    } else if (reward.type === 'bait') {
      if (reward.baitId) {
        this.inventory.addBait(reward.baitId, reward.amount ?? 1);
      }
    } else if (reward.type === 'card') {
      const card = reward.cardData || createSunkenCard(reward.cardTitle || 'Deep-Sea Dredge');
      this.inventory.addCard(card);
    }
  }

  public update(dt: number, _width?: number, _height?: number): void {
    if (!this.isOpen) return;
    this.time += dt;

    // Keyboard controls: Space / Enter / Escape
    if (Input.isJustPressed('escape')) {
      this.dismiss();
      return;
    }

    if (Input.isJustPressed('space') || Input.isJustPressed('enter') || Input.isJustPressed('keye')) {
      this.claim();
      return;
    }

    // Mouse Hit-Testing on Claim Button
    const mousePos = Input.getMousePosition();
    this.isClaimBtnHovered =
      mousePos.x >= this.claimBtnRect.x &&
      mousePos.x <= this.claimBtnRect.x + this.claimBtnRect.w &&
      mousePos.y >= this.claimBtnRect.y &&
      mousePos.y <= this.claimBtnRect.y + this.claimBtnRect.h;

    if (this.isClaimBtnHovered) {
      Input.setCursor('pointer');
      if (Input.isMouseClicked()) {
        this.claim();
        return;
      }
    } else {
      Input.setCursor('default');
    }
  }

  private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number = 4): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.isOpen || !this.currentReward) return;

    ctx.save();

    // 1. Semi-translucent dark abyssal vignette overlay
    ctx.fillStyle = 'rgba(2, 6, 14, 0.85)';
    ctx.fillRect(0, 0, width, height);

    // 2. Main Modal Plate
    const modalW = Math.min(580, width - 40);
    const modalH = Math.min(430, height - 40);
    const modalX = Math.floor((width - modalW) / 2);
    const modalY = Math.floor((height - modalH) / 2);

    // Background Gradient (Dark Victorian Ironclad Hull & Aged Parchment)
    const bgGrad = ctx.createLinearGradient(modalX, modalY, modalX, modalY + modalH);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');

    ctx.beginPath();
    this.drawRoundRect(ctx, modalX, modalY, modalW, modalH, 8);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Double Brass Border
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    this.drawRoundRect(ctx, modalX + 4, modalY + 4, modalW - 8, modalH - 8, 6);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Rivet Studs at corners
    const rivets = [
      { x: modalX + 12, y: modalY + 12 },
      { x: modalX + modalW - 12, y: modalY + 12 },
      { x: modalX + 12, y: modalY + modalH - 12 },
      { x: modalX + modalW - 12, y: modalY + modalH - 12 }
    ];
    ctx.fillStyle = '#f59e0b';
    for (const r of rivets) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Header Section
    const headerY = modalY + 34;
    ctx.font = 'bold 16px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('⚓ DREDGED FLOTSAM SALVAGE ⚓', modalX + modalW / 2, headerY);

    const subY = headerY + 18;
    ctx.font = 'italic 10.5px Georgia, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      'Recovered from the lightless brine • Sunken cargo hauled to deck',
      modalX + modalW / 2,
      subY
    );

    // 4. Central Loot Card Display
    const reward = this.currentReward;
    const cardW = modalW - 60;
    const cardH = 175;
    const cardX = modalX + 30;
    const cardY = subY + 22;

    // Glowing border color based on reward type
    let accentColor = '#f59e0b'; // Gold
    let badgeLabel = 'GOLD SOVEREIGNS';
    let iconChar = '🪙';

    if (reward.type === 'bait') {
      accentColor = '#38bdf8'; // Blue
      badgeLabel = 'TACKLE PROVISIONS';
      iconChar = '🪱';
    } else if (reward.type === 'card') {
      accentColor = '#c084fc'; // Purple
      badgeLabel = 'FORBIDDEN TECHNIQUE';
      iconChar = '📜';
    }

    ctx.save();
    ctx.beginPath();
    this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fillStyle = '#09101d';
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.8;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();

    // Reward Category Badge (Top of card)
    ctx.save();
    ctx.font = 'bold 8.5px "Cinzel", monospace';
    ctx.fillStyle = accentColor;
    ctx.textAlign = 'center';
    ctx.fillText(`[ ${badgeLabel} ]`, cardX + cardW / 2, cardY + 22);

    // Large Reward Icon
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconChar, cardX + cardW / 2, cardY + 58);

    // Primary Reward Title (e.g. Barnacle-Encrusted Strongbox (+X Sovereigns))
    ctx.font = 'bold 13px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(reward.title, cardX + cardW / 2, cardY + 102, cardW - 20);

    // Description text (e.g. Dredged Waterlogged Coin Purse: +X Gold Sovereigns!)
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(reward.description, cardX + cardW / 2, cardY + 124, cardW - 24);

    // Atmospheric Lore line
    if (reward.lore) {
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`"${reward.lore}"`, cardX + cardW / 2, cardY + 148, cardW - 28);
    }
    ctx.restore();

    // 5. Claim Salvage Button at Bottom
    this.claimBtnRect.x = modalX + Math.floor((modalW - this.claimBtnRect.w) / 2);
    this.claimBtnRect.y = cardY + cardH + 28;

    ctx.save();
    ctx.beginPath();
    this.drawRoundRect(
      ctx,
      this.claimBtnRect.x,
      this.claimBtnRect.y,
      this.claimBtnRect.w,
      this.claimBtnRect.h,
      4
    );

    ctx.fillStyle = this.isClaimBtnHovered ? '#059669' : '#047857';
    ctx.fill();

    ctx.strokeStyle = this.isClaimBtnHovered ? '#6ee7b7' : '#10b981';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = this.isClaimBtnHovered ? '#10b981' : 'transparent';
    ctx.shadowBlur = this.isClaimBtnHovered ? 8 : 0;
    ctx.stroke();

    ctx.font = 'bold 12px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '⚓ CLAIM SALVAGE [SPACE / ENTER]',
      this.claimBtnRect.x + this.claimBtnRect.w / 2,
      this.claimBtnRect.y + this.claimBtnRect.h / 2
    );
    ctx.restore();

    // Dismiss notice hint
    ctx.font = 'italic 9px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      '[ Press ESC to Stow & Return to Helm ]',
      modalX + modalW / 2,
      modalY + modalH - 14
    );

    ctx.restore();
  }
}
