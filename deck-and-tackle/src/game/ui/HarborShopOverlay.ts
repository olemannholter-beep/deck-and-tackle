import { Input } from '../../engine/Input';
import { PlayerInventory, STAMINA_UPGRADES, LINE_HEALTH_UPGRADES } from '../player/PlayerInventory';
import type { StaminaUpgradeTier, LineHealthUpgradeTier } from '../player/PlayerInventory';
import { SHOP_CARDS } from '../battle/CardData';
import type { CardData } from '../battle/CardData';
import { AudioManager } from '../../engine/AudioManager';
import { BAIT_REGISTRY } from '../battle/BaitData';
import type { BaitData } from '../battle/BaitData';
import type { NavalCardData } from '../battle/NavalCardData';

export class HarborShopOverlay {
  private onClose: () => void;
  private inventory: PlayerInventory;
  private time: number = 0;

  // View mode: 'shop' | 'deck_view' (strictly mutually exclusive)
  private viewMode: 'shop' | 'deck_view' = 'shop';

  // Category filter tab: 'all' | 'ledgers' | 'techniques' | 'upgrades' | 'bait'
  private selectedTab: 'all' | 'ledgers' | 'techniques' | 'upgrades' | 'bait' = 'all';

  // UI button hitboxes
  private returnBtnRect = { x: 24, y: 0, w: 210, h: 32 };
  private viewDeckBtnRect = { x: 0, y: 0, w: 0, h: 0 };
  private tabLedgersRect = { x: 0, y: 0, w: 0, h: 0 };
  private tabTechniquesRect = { x: 0, y: 0, w: 0, h: 0 };
  private tabBaitRect = { x: 0, y: 0, w: 0, h: 0 };
  private tabUpgradesRect = { x: 0, y: 0, w: 0, h: 0 };

  // Shop cards layout & buy button hitboxes
  private buyButtons: { card: CardData; rect: { x: number; y: number; w: number; h: number } }[] = [];
  private staminaUpgradeButtons: { tier: StaminaUpgradeTier; rect: { x: number; y: number; w: number; h: number } }[] = [];
  private lineUpgradeButtons: { tier: LineHealthUpgradeTier; rect: { x: number; y: number; w: number; h: number } }[] = [];
  private baitBuyButtons: { bait: BaitData; rect: { x: number; y: number; w: number; h: number } }[] = [];

  private hoveredBuyIndex: number = -1;
  private hoveredStaminaIndex: number = -1;
  private hoveredLineIndex: number = -1;
  private hoveredBaitBuyIndex: number = -1;
  private isReturnHovered: boolean = false;
  private isViewDeckHovered: boolean = false;
  private isTabLedgersHovered: boolean = false;
  private isTabTechniquesHovered: boolean = false;
  private isTabBaitHovered: boolean = false;
  private isTabUpgradesHovered: boolean = false;

  // Tooltip & feedback notification
  private hoveredCard: CardData | null = null;
  private notification: { text: string; color: string; life: number } | null = null;

  // Static Image Cache for all 13 shop sprites
  private static images: Map<string, HTMLImageElement> = new Map();
  private static imagesInitialized: boolean = false;

  constructor(inventory: PlayerInventory, onClose: () => void) {
    this.inventory = inventory;
    this.onClose = onClose;
    HarborShopOverlay.initImages();
  }

  private static initImages(): void {
    if (this.imagesInitialized) return;
    this.imagesInitialized = true;

    const spriteNames = [
      'shop_left_diorama_bg.png',
      'fisherman_merchant.png',
      'specimen_aquarium.png',
      'ui_header_bar.png',
      'grimoire_ledger_book.png',
      'parchment_item_plate.png',
      'icon_black_iron_winch.png',
      'icon_kelp_snare.png',
      'icon_void_pump.png',
      'icon_cyclopean_gantry.png',
      'icon_eldritch_lure.png',
      'icon_dagons_barbed_hook.png',
      'icon_abyssal_chum.png'
    ];

    for (const name of spriteNames) {
      const img = new Image();
      img.src = `/assets/sprites/shop/${name}`;
      this.images.set(name, img);
      this.images.set(`/assets/sprites/shop/${name}`, img);
    }

    const fishingSprites = [
      'tackle_hook_bone.png',
      'tackle_lure_shrimp.png',
      'tackle_lure_snail.png'
    ];
    for (const name of fishingSprites) {
      const img = new Image();
      img.src = `/assets/sprites/fishing/${name}`;
      this.images.set(name, img);
      this.images.set(`/assets/sprites/fishing/${name}`, img);
    }
  }

  private static getImage(name: string): HTMLImageElement | undefined {
    if (this.images.has(name)) {
      return this.images.get(name);
    }
    const filename = name.split('/').pop();
    if (filename && this.images.has(filename)) {
      return this.images.get(filename);
    }
    const img = new Image();
    img.src = name.startsWith('/') ? name : `/assets/sprites/shop/${name}`;
    this.images.set(name, img);
    return img;
  }

  public update(dt: number, width: number, height: number): void {
    this.time += dt;

    if (this.notification) {
      this.notification.life -= dt;
      if (this.notification.life <= 0) {
        this.notification = null;
      }
    }

    // Keyboard Shortcuts
    if (Input.isJustPressed('escape')) {
      if (this.viewMode === 'deck_view') {
        this.viewMode = 'shop';
        AudioManager.getInstance().playButtonClick();
        return;
      }
      AudioManager.getInstance().playButtonClick();
      this.onClose();
      return;
    }

    if (Input.isJustPressed('keyd')) {
      this.toggleViewMode();
      return;
    }

    if (Input.isJustPressed('keyl')) {
      this.selectedTab = this.selectedTab === 'ledgers' ? 'all' : 'ledgers';
      AudioManager.getInstance().playButtonClick();
      return;
    }

    if (Input.isJustPressed('keyt')) {
      this.selectedTab = this.selectedTab === 'techniques' ? 'all' : 'techniques';
      AudioManager.getInstance().playButtonClick();
      return;
    }

    if (Input.isJustPressed('keyu')) {
      this.selectedTab = this.selectedTab === 'upgrades' ? 'all' : 'upgrades';
      AudioManager.getInstance().playButtonClick();
      this.showNotification(
        this.selectedTab === 'upgrades'
          ? 'Viewing Vessel & Angler Upgrades (Stamina & Line Health)'
          : 'Showing All Chandlery Items',
        '#10b981'
      );
      return;
    }

    if (Input.isJustPressed('keyb')) {
      this.selectedTab = this.selectedTab === 'bait' ? 'all' : 'bait';
      AudioManager.getInstance().playButtonClick();
      this.showNotification(
        this.selectedTab === 'bait'
          ? 'Viewing Chandlery Bait & Chum Offerings'
          : 'Showing All Chandlery Items',
        '#f59e0b'
      );
      return;
    }

    const mousePos = Input.getMousePosition();
    const leftW = Math.floor(width * 0.48);
    const divW = 8;
    const rightX = leftW + divW;
    const rightW = width - rightX;

    // 1. Return to Vessel Button [Bottom-Left Corner of Diorama Screen]
    this.returnBtnRect.x = 24;
    this.returnBtnRect.y = height - 46;
    this.returnBtnRect.w = 210;
    this.returnBtnRect.h = 32;

    this.isReturnHovered =
      mousePos.x >= this.returnBtnRect.x &&
      mousePos.x <= this.returnBtnRect.x + this.returnBtnRect.w &&
      mousePos.y >= this.returnBtnRect.y &&
      mousePos.y <= this.returnBtnRect.y + this.returnBtnRect.h;

    if (this.isReturnHovered && Input.isMouseClicked()) {
      this.hoveredCard = null;
      this.viewMode = 'shop';
      AudioManager.getInstance().playButtonClick();
      this.onClose();
      return;
    }

    // 2. Header Geometry
    const headerX = rightX;
    const headerY = 8;
    const headerW = rightW;
    const headerH = Math.floor(headerW * (151 / 1300));

    // Inspect Ledger Green Plaque Button (Header Top Right)
    this.viewDeckBtnRect.x = headerX + Math.floor(headerW * (925 / 1300));
    this.viewDeckBtnRect.y = headerY + Math.floor(headerH * (1 / 151));
    this.viewDeckBtnRect.w = Math.floor(headerW * (350 / 1300));
    this.viewDeckBtnRect.h = Math.floor(headerH * (110 / 151));

    this.isViewDeckHovered =
      mousePos.x >= this.viewDeckBtnRect.x &&
      mousePos.x <= this.viewDeckBtnRect.x + this.viewDeckBtnRect.w &&
      mousePos.y >= this.viewDeckBtnRect.y &&
      mousePos.y <= this.viewDeckBtnRect.y + this.viewDeckBtnRect.h;

    if (this.isViewDeckHovered && Input.isMouseClicked()) {
      this.toggleViewMode();
      return;
    }

    // Tab 1: Ledgers
    this.tabLedgersRect.x = headerX + Math.floor(headerW * (408 / 1300));
    this.tabLedgersRect.y = headerY + Math.floor(headerH * (89 / 151));
    this.tabLedgersRect.w = Math.floor(headerW * (123 / 1300));
    this.tabLedgersRect.h = headerH - Math.floor(headerH * (89 / 151)) - 5;

    this.isTabLedgersHovered =
      mousePos.x >= this.tabLedgersRect.x &&
      mousePos.x <= this.tabLedgersRect.x + this.tabLedgersRect.w &&
      mousePos.y >= this.tabLedgersRect.y &&
      mousePos.y <= this.tabLedgersRect.y + this.tabLedgersRect.h;

    if (this.isTabLedgersHovered && Input.isMouseClicked()) {
      AudioManager.getInstance().playButtonClick();
      this.selectedTab = this.selectedTab === 'ledgers' ? 'all' : 'ledgers';
      this.showNotification(
        this.selectedTab === 'ledgers' ? 'Viewing Active Tackle Ledgers' : 'Showing All Chandlery Items',
        '#f59e0b'
      );
      return;
    }

    // Tab 2: Techniques
    this.tabTechniquesRect.x = headerX + Math.floor(headerW * (535 / 1300));
    this.tabTechniquesRect.y = headerY + Math.floor(headerH * (89 / 151));
    this.tabTechniquesRect.w = Math.floor(headerW * (123 / 1300));
    this.tabTechniquesRect.h = headerH - Math.floor(headerH * (89 / 151)) - 5;

    this.isTabTechniquesHovered =
      mousePos.x >= this.tabTechniquesRect.x &&
      mousePos.x <= this.tabTechniquesRect.x + this.tabTechniquesRect.w &&
      mousePos.y >= this.tabTechniquesRect.y &&
      mousePos.y <= this.tabTechniquesRect.y + this.tabTechniquesRect.h;

    if (this.isTabTechniquesHovered && Input.isMouseClicked()) {
      AudioManager.getInstance().playButtonClick();
      this.selectedTab = this.selectedTab === 'techniques' ? 'all' : 'techniques';
      this.showNotification(
        this.selectedTab === 'techniques' ? 'Viewing Purchasable Mythos Techniques (Once-Per-Fight)' : 'Showing All Chandlery Items',
        '#c084fc'
      );
      return;
    }

    // Tab 3: Bait & Chum
    this.tabBaitRect.x = headerX + Math.floor(headerW * (662 / 1300));
    this.tabBaitRect.y = headerY + Math.floor(headerH * (89 / 151));
    this.tabBaitRect.w = Math.floor(headerW * (123 / 1300));
    this.tabBaitRect.h = headerH - Math.floor(headerH * (89 / 151)) - 5;

    this.isTabBaitHovered =
      mousePos.x >= this.tabBaitRect.x &&
      mousePos.x <= this.tabBaitRect.x + this.tabBaitRect.w &&
      mousePos.y >= this.tabBaitRect.y &&
      mousePos.y <= this.tabBaitRect.y + this.tabBaitRect.h;

    if (this.isTabBaitHovered && Input.isMouseClicked()) {
      AudioManager.getInstance().playButtonClick();
      this.selectedTab = this.selectedTab === 'bait' ? 'all' : 'bait';
      this.showNotification(
        this.selectedTab === 'bait' ? 'Viewing Chandlery Bait & Chum Offerings' : 'Showing All Chandlery Items',
        '#f59e0b'
      );
      return;
    }

    // Tab 4: Upgrades (Stamina & Line Health)
    this.tabUpgradesRect.x = headerX + Math.floor(headerW * (789 / 1300));
    this.tabUpgradesRect.y = headerY + Math.floor(headerH * (89 / 151));
    this.tabUpgradesRect.w = Math.floor(headerW * (123 / 1300));
    this.tabUpgradesRect.h = headerH - Math.floor(headerH * (89 / 151)) - 5;

    this.isTabUpgradesHovered =
      mousePos.x >= this.tabUpgradesRect.x &&
      mousePos.x <= this.tabUpgradesRect.x + this.tabUpgradesRect.w &&
      mousePos.y >= this.tabUpgradesRect.y &&
      mousePos.y <= this.tabUpgradesRect.y + this.tabUpgradesRect.h;

    if (this.isTabUpgradesHovered && Input.isMouseClicked()) {
      AudioManager.getInstance().playButtonClick();
      this.selectedTab = this.selectedTab === 'upgrades' ? 'all' : 'upgrades';
      this.showNotification(
        this.selectedTab === 'upgrades' ? 'Viewing Vessel & Angler Upgrades (Stamina & Line Health)' : 'Showing All Chandlery Items',
        '#10b981'
      );
      return;
    }

    // 3. Shop Buy Buttons Click Handling
    if (this.viewMode === 'shop') {
      if (this.selectedTab === 'upgrades') {
        // Test stamina upgrade buttons
        this.hoveredStaminaIndex = -1;
        for (let i = 0; i < this.staminaUpgradeButtons.length; i++) {
          const item = this.staminaUpgradeButtons[i];
          const btn = item.rect;
          if (
            mousePos.x >= btn.x &&
            mousePos.x <= btn.x + btn.w &&
            mousePos.y >= btn.y &&
            mousePos.y <= btn.y + btn.h
          ) {
            this.hoveredStaminaIndex = i;
            break;
          }
        }

        if (this.hoveredStaminaIndex !== -1 && Input.isMouseClicked()) {
          const item = this.staminaUpgradeButtons[this.hoveredStaminaIndex];
          if (this.inventory.staminaUpgradeLevel >= item.tier.level) {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(`${item.tier.title} is already permanently installed on your vessel!`, '#94a3b8');
            return;
          }
          if (item.tier.level > this.inventory.staminaUpgradeLevel + 1) {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(`Must acquire Rank ${item.tier.level - 1} stamina upgrade first!`, '#f59e0b');
            return;
          }
          if (this.inventory.upgradeStamina()) {
            AudioManager.getInstance().playUpgradeAcquired();
            this.showNotification(`Installed ${item.tier.title}! Max Stamina increased to ${this.inventory.maxStamina}.`, '#34d399');
          } else {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(
              `Insufficient sovereigns! Need ${item.tier.cost}g (You hold ${this.inventory.gold}g).`,
              '#f87171'
            );
          }
          return;
        }

        // Test line integrity upgrade buttons
        this.hoveredLineIndex = -1;
        for (let i = 0; i < this.lineUpgradeButtons.length; i++) {
          const item = this.lineUpgradeButtons[i];
          const btn = item.rect;
          if (
            mousePos.x >= btn.x &&
            mousePos.x <= btn.x + btn.w &&
            mousePos.y >= btn.y &&
            mousePos.y <= btn.y + btn.h
          ) {
            this.hoveredLineIndex = i;
            break;
          }
        }

        if (this.hoveredLineIndex !== -1 && Input.isMouseClicked()) {
          const item = this.lineUpgradeButtons[this.hoveredLineIndex];
          if (this.inventory.lineHealthUpgradeLevel >= item.tier.level) {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(`${item.tier.title} is already reinforced on your vessel!`, '#94a3b8');
            return;
          }
          if (item.tier.level > this.inventory.lineHealthUpgradeLevel + 1) {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(`Must acquire Rank ${item.tier.level - 1} line reinforcement first!`, '#f59e0b');
            return;
          }
          if (this.inventory.upgradeLineHealth()) {
            AudioManager.getInstance().playUpgradeAcquired();
            this.showNotification(`Installed ${item.tier.title}! Max Line Integrity reinforced to ${this.inventory.maxLineIntegrity}.`, '#34d399');
          } else {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(
              `Insufficient sovereigns! Need ${item.tier.cost}g (You hold ${this.inventory.gold}g).`,
              '#f87171'
            );
          }
          return;
        }
      } else if (this.selectedTab === 'bait') {
        // Bait Buy Buttons
        this.hoveredBaitBuyIndex = -1;
        for (let i = 0; i < this.baitBuyButtons.length; i++) {
          const item = this.baitBuyButtons[i];
          const btn = item.rect;
          if (
            mousePos.x >= btn.x &&
            mousePos.x <= btn.x + btn.w &&
            mousePos.y >= btn.y &&
            mousePos.y <= btn.y + btn.h
          ) {
            this.hoveredBaitBuyIndex = i;
            break;
          }
        }

        if (this.hoveredBaitBuyIndex !== -1 && Input.isMouseClicked()) {
          const baitToBuy = this.baitBuyButtons[this.hoveredBaitBuyIndex].bait;
          if (baitToBuy.id === 'bare_hook') {
            AudioManager.getInstance().playButtonClick();
            this.showNotification('Bare Hook is permanent and always in stock aboard your vessel!', '#94a3b8');
            return;
          }

          if (this.inventory.spendGold(baitToBuy.cost)) {
            this.inventory.addBait(baitToBuy.id, 1);
            AudioManager.getInstance().playGoldCoins();
            this.showNotification(
              `Acquired ${baitToBuy.name}! In Hold: ${this.inventory.getBaitCount(baitToBuy.id)}.`,
              '#34d399'
            );
          } else {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(
              `Insufficient sovereigns! Need ${baitToBuy.cost}g (You hold ${this.inventory.gold}g).`,
              '#f87171'
            );
          }
          return;
        }
      } else {
        // Standard Card Buy Buttons (Ledgers & Techniques)
        this.hoveredBuyIndex = -1;
        for (let i = 0; i < this.buyButtons.length; i++) {
          const item = this.buyButtons[i];
          const btn = item.rect;
          if (
            mousePos.x >= btn.x &&
            mousePos.x <= btn.x + btn.w &&
            mousePos.y >= btn.y &&
            mousePos.y <= btn.y + btn.h
          ) {
            this.hoveredBuyIndex = i;
            break;
          }
        }

        if (this.hoveredBuyIndex !== -1 && Input.isMouseClicked()) {
          const cardToBuy = this.buyButtons[this.hoveredBuyIndex].card;
          const price = cardToBuy.shopPrice ?? 30;
          const isOwned = this.inventory.deck.some(c => c.id === cardToBuy.id);

          if (isOwned) {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(`${cardToBuy.title} is already inscribed in your vessel ledger!`, '#94a3b8');
            return;
          }

          if (this.inventory.spendGold(price)) {
            this.inventory.addCard(cardToBuy);
            AudioManager.getInstance().playGoldCoins();
            const isTech = cardToBuy.cardType === 'Technique' || cardToBuy.oncePerBattle;
            const msg = isTech
              ? `Acquired Mythos Technique: ${cardToBuy.title}! Once-per-fight ability inscribed into your ledger.`
              : `Acquired ${cardToBuy.title}! Inscribed into your grimoire ledger.`;
            this.showNotification(msg, isTech ? '#c084fc' : '#34d399');
          } else {
            AudioManager.getInstance().playButtonClick();
            this.showNotification(
              `Insufficient sovereigns! Need ${price}g (You hold ${this.inventory.gold}g).`,
              '#f87171'
            );
          }
        }
      }
    }

    const isInteractive =
      this.isReturnHovered ||
      this.isViewDeckHovered ||
      this.isTabLedgersHovered ||
      this.isTabTechniquesHovered ||
      this.isTabBaitHovered ||
      this.isTabUpgradesHovered ||
      (this.viewMode === 'shop' && (
        this.hoveredBuyIndex !== -1 ||
        this.hoveredStaminaIndex !== -1 ||
        this.hoveredLineIndex !== -1 ||
        this.hoveredBaitBuyIndex !== -1
      ));

    Input.setCursor(isInteractive ? 'pointer' : 'default');
  }

  private toggleViewMode(): void {
    AudioManager.getInstance().playButtonClick();
    this.viewMode = this.viewMode === 'shop' ? 'deck_view' : 'shop';
    const msg =
      this.viewMode === 'shop'
        ? 'Opened Chandlery Shop Catalogue'
        : 'Opened Vessel Ledger Deck Inspection';
    this.showNotification(msg, '#38bdf8');
  }

  private showNotification(text: string, color: string = '#38bdf8'): void {
    this.notification = { text, color, life: 2.8 };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Dark Abyssal Backdrop
    ctx.fillStyle = '#080d14';
    ctx.fillRect(0, 0, width, height);

    const leftW = Math.floor(width * 0.48);
    const divW = 8;
    const rightX = leftW + divW;
    const rightW = width - rightX;

    // 1. Render Left Side: Cutaway Chandlery Shanty Diorama (No pipe smoke)
    this.renderChandleryShack(ctx, 0, 0, leftW, height);

    // 2. Render Vertical Wooden Beam Divider
    this.renderShackDivider(ctx, leftW, 0, divW, height);

    // 3. Render Right Side: Open Grimoire Ledger & Catalogue
    this.renderGrimoireLedger(ctx, rightX, 0, rightW, height);

    // 4. In-Game Hover Tooltip (When hovering card plates)
    if (this.hoveredCard && !this.notification) {
      this.renderHoverTooltip(ctx, width, height);
    }

    // 5. Notification Toast (Floating near bottom center)
    if (this.notification) {
      this.renderNotification(ctx, width, height);
    }

    ctx.restore();
  }

  // ==========================================
  // LEFT SIDE: CUTAWAY CHANDLERY SHANTY DIORAMA
  // ==========================================
  private renderChandleryShack(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Background Diorama Interior
    const dioramaImg = HarborShopOverlay.getImage('shop_left_diorama_bg.png');
    if (dioramaImg && dioramaImg.complete && dioramaImg.naturalWidth > 0) {
      ctx.drawImage(dioramaImg, x, y, w, h);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, h);
    }

    // Aquarium Specimen Tank FX (Deep-sea green glow & rising bubbles)
    const aquaX = x + Math.floor(w * (0 / 1431));
    const aquaY = y + Math.floor(h * (460 / 1536));
    const aquaW = Math.floor(w * (430 / 1431));
    const aquaH = Math.floor(h * (980 / 1536));

    const pulse = Math.sin(this.time * 1.8) * 0.5 + 0.5;
    const causticsGrad = ctx.createLinearGradient(aquaX, aquaY, aquaX + aquaW, aquaY + aquaH);
    causticsGrad.addColorStop(0, `rgba(16, 185, 129, ${0.08 + pulse * 0.05})`);
    causticsGrad.addColorStop(0.5, `rgba(6, 95, 70, ${0.04 + pulse * 0.04})`);
    causticsGrad.addColorStop(1, 'rgba(2, 44, 34, 0.0)');
    ctx.fillStyle = causticsGrad;
    ctx.fillRect(aquaX, aquaY, aquaW, aquaH);

    ctx.fillStyle = 'rgba(167, 243, 208, 0.35)';
    for (let i = 0; i < 6; i++) {
      const bx = aquaX + 40 + ((i * 55 + Math.sin(this.time + i) * 12) % Math.max(10, aquaW - 80));
      const by = aquaY + aquaH - ((this.time * 45 + i * 90) % Math.max(10, aquaH));
      const br = 1.8 + Math.sin(this.time * 2 + i) * 0.8;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1, br), 0, Math.PI * 2);
      ctx.fill();
    }

    // Fisherman Merchant NPC Sprite (Stationary at counter, zero bobbing, zero smoke)
    const npcX = x + Math.floor(w * (991 / 1431));
    const npcY = y + Math.floor(h * (538 / 1536));
    const npcW = Math.floor(w * (247 / 1431));
    const npcH = Math.floor(h * (460 / 1536));

    const merchantImg = HarborShopOverlay.getImage('fisherman_merchant.png');
    if (merchantImg && merchantImg.complete && merchantImg.naturalWidth > 0) {
      ctx.drawImage(merchantImg, npcX, npcY, npcW, npcH);
    }

    // Warm Counter Lantern Glow
    const lanternX = npcX + npcW * 0.95;
    const lanternY = npcY + npcH * 0.40;
    const flicker = 1.0 + (Math.sin(this.time * 7.5) * 0.05 + Math.cos(this.time * 13.2) * 0.03);
    const lGrad = ctx.createRadialGradient(
      lanternX,
      lanternY,
      15,
      lanternX,
      lanternY,
      Math.max(20, 220 * flicker)
    );
    lGrad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
    lGrad.addColorStop(0.35, 'rgba(217, 119, 6, 0.12)');
    lGrad.addColorStop(0.7, 'rgba(180, 83, 9, 0.04)');
    lGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lGrad;
    ctx.fillRect(x, y, w, h);

    // Return to Vessel Button [ESC] (Relocated to bottom-left corner of diorama)
    ctx.save();
    ctx.fillStyle = this.isReturnHovered ? 'rgba(30, 41, 59, 0.96)' : 'rgba(8, 14, 22, 0.90)';
    ctx.strokeStyle = this.isReturnHovered ? '#fbbf24' : '#b45309';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(this.returnBtnRect.x, this.returnBtnRect.y, this.returnBtnRect.w, this.returnBtnRect.h, 5);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px "Cinzel", Georgia, serif';
    ctx.fillStyle = this.isReturnHovered ? '#fef3c7' : '#d97706';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '[ ⚓ RETURN TO VESSEL (ESC) ]',
      this.returnBtnRect.x + this.returnBtnRect.w / 2,
      this.returnBtnRect.y + this.returnBtnRect.h / 2
    );
    ctx.restore();

    ctx.restore();
  }

  // ==========================================
  // CENTER WOODEN BEAM DIVIDER
  // ==========================================
  private renderShackDivider(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    const beamGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    beamGrad.addColorStop(0, '#1c1511');
    beamGrad.addColorStop(0.2, '#38281d');
    beamGrad.addColorStop(0.5, '#4a3525');
    beamGrad.addColorStop(0.8, '#2b1e16');
    beamGrad.addColorStop(1, '#0e0a08');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#64748b';
    for (let sy = 30; sy < h; sy += 50) {
      ctx.beginPath();
      ctx.arc(x + w * 0.5, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================
  // RIGHT SIDE: GRIMOIRE LEDGER & CATALOGUE
  // ==========================================
  private renderGrimoireLedger(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    ctx.save();
    this.buyButtons = [];
    this.staminaUpgradeButtons = [];
    this.lineUpgradeButtons = [];
    this.baitBuyButtons = [];
    this.hoveredCard = null;

    // 1. Header Bar Banner
    const headerImg = HarborShopOverlay.getImage('ui_header_bar.png');
    const headerX = x;
    const headerY = y + 8;
    const headerW = w;
    const headerH = Math.floor(headerW * (151 / 1300));

    if (headerImg && headerImg.complete && headerImg.naturalWidth > 0) {
      ctx.drawImage(headerImg, headerX, headerY, headerW, headerH);
    }

    // --- LIVE GOLD SOVEREIGN COUNTER ---
    const goldX = headerX + Math.floor(headerW * (312 / 1300));
    const goldY = headerY + Math.floor(headerH * (137 / 151));
    const goldFontSize = Math.max(10, Math.round(headerH * 0.19));
    ctx.save();
    ctx.font = `bold ${goldFontSize}px "Cinzel", "Georgia", serif`;
    ctx.fillStyle = '#fde047';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(253, 224, 71, 0.4)';
    ctx.shadowBlur = 4;
    ctx.fillText(`${this.inventory.gold}g`, goldX, goldY);
    ctx.restore();

    // --- SOLID BACKING PLATE FOR TABS (prevents underlying sprite text bleed) ---
    const tabBackX = headerX + Math.floor(headerW * (404 / 1300));
    const tabBackY = headerY + Math.floor(headerH * (86 / 151));
    const tabBackW = Math.floor(headerW * (514 / 1300));
    const tabBackH = headerH - Math.floor(headerH * (86 / 151)) - 3;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tabBackX, tabBackY, tabBackW, tabBackH, 5);
    ctx.fillStyle = '#140e0a';
    ctx.fill();
    ctx.strokeStyle = '#38251a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // --- TAB 1: LEDGERS ---
    const isLedgersActive = this.selectedTab === 'ledgers';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      this.tabLedgersRect.x,
      this.tabLedgersRect.y,
      this.tabLedgersRect.w,
      this.tabLedgersRect.h,
      4
    );
    ctx.fillStyle = isLedgersActive
      ? '#451a03'
      : (this.isTabLedgersHovered ? '#2e1809' : '#1c130d');
    ctx.fill();
    ctx.strokeStyle = isLedgersActive ? '#fbbf24' : (this.isTabLedgersHovered ? '#f59e0b' : '#573d2a');
    ctx.lineWidth = isLedgersActive ? 2.0 : 1.2;
    ctx.stroke();

    ctx.font = `bold ${Math.max(7.5, Math.round(this.tabLedgersRect.h * 0.38))}px "Cinzel", serif`;
    ctx.fillStyle = isLedgersActive ? '#fef08a' : (this.isTabLedgersHovered ? '#fde68a' : '#d6c7b2');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '⚓ LEDGERS',
      this.tabLedgersRect.x + this.tabLedgersRect.w / 2,
      this.tabLedgersRect.y + this.tabLedgersRect.h / 2
    );
    ctx.restore();

    // --- TAB 2: TECHNIQUES ---
    const isTechniquesActive = this.selectedTab === 'techniques';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      this.tabTechniquesRect.x,
      this.tabTechniquesRect.y,
      this.tabTechniquesRect.w,
      this.tabTechniquesRect.h,
      4
    );
    ctx.fillStyle = isTechniquesActive
      ? '#2e1065'
      : (this.isTabTechniquesHovered ? '#220c4c' : '#1c130d');
    ctx.fill();
    ctx.strokeStyle = isTechniquesActive ? '#c084fc' : (this.isTabTechniquesHovered ? '#a855f7' : '#573d2a');
    ctx.lineWidth = isTechniquesActive ? 2.0 : 1.2;
    ctx.stroke();

    ctx.font = `bold ${Math.max(7.5, Math.round(this.tabTechniquesRect.h * 0.38))}px "Cinzel", serif`;
    ctx.fillStyle = isTechniquesActive ? '#f3e8ff' : (this.isTabTechniquesHovered ? '#e9d5ff' : '#d6c7b2');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '★ TECHNIQUES',
      this.tabTechniquesRect.x + this.tabTechniquesRect.w / 2,
      this.tabTechniquesRect.y + this.tabTechniquesRect.h / 2
    );
    ctx.restore();

    // --- TAB 3: BAIT & CHUM ---
    const isBaitActive = this.selectedTab === 'bait';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      this.tabBaitRect.x,
      this.tabBaitRect.y,
      this.tabBaitRect.w,
      this.tabBaitRect.h,
      4
    );
    ctx.fillStyle = isBaitActive
      ? '#451a03'
      : (this.isTabBaitHovered ? '#2e1809' : '#1c130d');
    ctx.fill();
    ctx.strokeStyle = isBaitActive ? '#f59e0b' : (this.isTabBaitHovered ? '#fbbf24' : '#573d2a');
    ctx.lineWidth = isBaitActive ? 2.0 : 1.2;
    ctx.stroke();

    ctx.font = `bold ${Math.max(7.5, Math.round(this.tabBaitRect.h * 0.38))}px "Cinzel", serif`;
    ctx.fillStyle = isBaitActive ? '#fef08a' : (this.isTabBaitHovered ? '#fde68a' : '#d6c7b2');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '🪱 BAIT & CHUM',
      this.tabBaitRect.x + this.tabBaitRect.w / 2,
      this.tabBaitRect.y + this.tabBaitRect.h / 2
    );
    ctx.restore();

    // --- TAB 4: UPGRADES (STAMINA & LINE HEALTH) ---
    const isUpgradesActive = this.selectedTab === 'upgrades';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(
      this.tabUpgradesRect.x,
      this.tabUpgradesRect.y,
      this.tabUpgradesRect.w,
      this.tabUpgradesRect.h,
      4
    );
    ctx.fillStyle = isUpgradesActive
      ? '#064e3b'
      : (this.isTabUpgradesHovered ? '#043729' : '#1c130d');
    ctx.fill();
    ctx.strokeStyle = isUpgradesActive ? '#34d399' : (this.isTabUpgradesHovered ? '#10b981' : '#573d2a');
    ctx.lineWidth = isUpgradesActive ? 2.0 : 1.2;
    ctx.stroke();

    ctx.font = `bold ${Math.max(7.5, Math.round(this.tabUpgradesRect.h * 0.38))}px "Cinzel", serif`;
    ctx.fillStyle = isUpgradesActive ? '#a7f3d0' : (this.isTabUpgradesHovered ? '#6ee7b7' : '#d6c7b2');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '⚙ UPGRADES',
      this.tabUpgradesRect.x + this.tabUpgradesRect.w / 2,
      this.tabUpgradesRect.y + this.tabUpgradesRect.h / 2
    );
    ctx.restore();

    // --- INSPECT LEDGER GREEN METALLIC PLAQUE BUTTON ---
    ctx.save();
    if (this.isViewDeckHovered) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
      ctx.strokeStyle = '#6ee7b7';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(
        this.viewDeckBtnRect.x + 8,
        this.viewDeckBtnRect.y + 12,
        this.viewDeckBtnRect.w - 16,
        this.viewDeckBtnRect.h - 24,
        6
      );
      ctx.fill();
      ctx.stroke();
    }

    const plaqueFontSize = Math.max(10, Math.round(this.viewDeckBtnRect.h * 0.28));
    ctx.font = `bold ${plaqueFontSize}px "Cinzel", "Georgia", serif`;
    ctx.fillStyle = this.isViewDeckHovered ? '#ffffff' : '#f1f5f9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const plaqueLabel = this.viewMode === 'shop' ? '📜 Inspect Ledger' : '🛒 Chandlery Shop';
    ctx.fillText(
      plaqueLabel,
      this.viewDeckBtnRect.x + this.viewDeckBtnRect.w / 2,
      this.viewDeckBtnRect.y + this.viewDeckBtnRect.h / 2
    );
    ctx.restore();

    // 2. Grimoire Book - Starts seamlessly right below header banner
    const bookImg = HarborShopOverlay.getImage('grimoire_ledger_book.png');
    const bookX = x;
    const bookY = headerY + headerH;
    const bookW = w;
    const bookH = h - bookY - 6;

    if (bookImg && bookImg.complete && bookImg.naturalWidth > 0) {
      ctx.drawImage(bookImg, bookX, bookY, bookW, bookH);
    } else {
      ctx.fillStyle = '#261b14';
      ctx.fillRect(bookX, bookY, bookW, bookH);
    }

    // 3. Mutually Exclusive Content Views (Deck inspection, Shop catalogue, Upgrades catalogue, or Bait catalogue)
    if (this.viewMode === 'shop') {
      if (this.selectedTab === 'upgrades') {
        this.renderUpgradesCatalogue(ctx, bookX, bookY, bookW, bookH);
      } else if (this.selectedTab === 'bait') {
        this.renderBaitCatalogue(ctx, bookX, bookY, bookW, bookH);
      } else {
        this.renderShopCatalogue(ctx, bookX, bookY, bookW, bookH);
      }
    } else {
      this.renderDeckInspection(ctx, bookX, bookY, bookW, bookH);
    }

    ctx.restore();
  }

  // ==========================================
  // SHOP CATALOGUE (ONLY RENDERED IN SHOP MODE)
  // ==========================================
  private renderShopCatalogue(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): void {
    const pageMarginTop = 48;
    const pageMarginBottom = 20;
    const usableH = bh - pageMarginTop - pageMarginBottom;

    const pageWidth = (bw - 64) / 2;
    const leftPageX = bx + 34;
    const rightPageX = bx + pageWidth + 30;
    const startY = by + pageMarginTop;

    const leftCards = SHOP_CARDS.filter(c => c.page === 'left');
    const rightCards = SHOP_CARDS.filter(c => c.page === 'right');

    const cardGap = 8;
    const cardH = Math.min(56, Math.floor((usableH - cardGap * 3) / 4));
    const cardW = pageWidth - 14;

    const showLeft = this.selectedTab === 'all' || this.selectedTab === 'ledgers';
    const showRight = this.selectedTab === 'all' || this.selectedTab === 'techniques';

    // Left Page (Tackle Ledgers)
    if (showLeft) {
      leftCards.forEach((card, idx) => {
        const cy = startY + idx * (cardH + cardGap);
        this.renderItemCard(ctx, leftPageX, cy, cardW, cardH, card);
      });
    } else {
      // Left Page Codex when Techniques Tab is selected
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(leftPageX, startY, cardW, usableH, 6);
      ctx.fillStyle = 'rgba(40, 20, 56, 0.08)';
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#2e1065';
      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText('MYTHOS TECHNIQUE CODEX', leftPageX + cardW / 2, startY + 24);

      ctx.fillStyle = '#6b21a8';
      ctx.font = 'italic 9.5px Georgia, serif';
      ctx.fillText('Ancient Angling Rites of the Abyssal Void', leftPageX + cardW / 2, startY + 40);

      // Section 1: Once Per Fight
      ctx.fillStyle = '#1e1b18';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.textAlign = 'left';
      ctx.fillText('★ ONCE PER FIGHT', leftPageX + 16, startY + 70);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Techniques channel unstable eldritch forces. Once', leftPageX + 16, startY + 84);
      ctx.fillText('invoked, they are consumed for the rest of combat.', leftPageX + 16, startY + 98);

      // Section 2: Blood Backlash
      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillText('⚡ LINE BACKLASH', leftPageX + 16, startY + 124);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Smiting deep aberrations exacts a violent physical toll.', leftPageX + 16, startY + 138);
      ctx.fillText('Direct recoil damage is dealt to your Line Integrity.', leftPageX + 16, startY + 152);

      // Section 3: Inscription
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillText('📜 PURCHASE & INSCRIBE', leftPageX + 16, startY + 178);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Acquire techniques on the right page with gold to', leftPageX + 16, startY + 192);
      ctx.fillText('permanently inscribe them into your vessel ledger.', leftPageX + 16, startY + 206);

      ctx.restore();
    }

    // Right Page (Mythos Techniques)
    if (showRight) {
      rightCards.forEach((card, idx) => {
        const cy = startY + idx * (cardH + cardGap);
        this.renderItemCard(ctx, rightPageX, cy, cardW, cardH, card);
      });
    } else {
      // Right Page Codex when Ledgers Tab is selected
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rightPageX, startY, cardW, usableH, 6);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0c4a6e';
      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText('VESSEL TACKLE SCHEMATICS', rightPageX + cardW / 2, startY + 24);

      ctx.fillStyle = '#0369a1';
      ctx.font = 'italic 9.5px Georgia, serif';
      ctx.fillText('Permanent Hardware Winches & Drag Spools', rightPageX + cardW / 2, startY + 40);

      // Section 1: Standard Cycling
      ctx.fillStyle = '#1e1b18';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚙ REUSABLE TACKLE', rightPageX + 16, startY + 70);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Tackle cards cycle continuously through your draw and', rightPageX + 16, startY + 84);
      ctx.fillText('discard piles every turn, powered by your Stamina.', rightPageX + 16, startY + 98);

      // Section 2: Winches & Slack
      ctx.fillStyle = '#0369a1';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillText('⚓ WINCHES & DRAG SLACK', rightPageX + 16, startY + 124);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Heavy winches reel distance rapidly, while drag spools', rightPageX + 16, startY + 138);
      ctx.fillText('grant Line Slack to absorb violent thrash tension.', rightPageX + 16, startY + 152);

      // Section 3: Hardware Inscription
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillText('📜 PURCHASE HARDWARE', rightPageX + 16, startY + 178);

      ctx.fillStyle = '#44382c';
      ctx.font = 'italic 8.5px Georgia, serif';
      ctx.fillText('Purchase winches on the left page to bolster your', rightPageX + 16, startY + 192);
      ctx.fillText('deck with powerful, reusable deep-sea tackle.', rightPageX + 16, startY + 206);

      ctx.restore();
    }
  }

  private renderItemCard(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    card: CardData
  ): void {
    const mousePos = Input.getMousePosition();
    const isCardHovered =
      mousePos.x >= cx &&
      mousePos.x <= cx + cw &&
      mousePos.y >= cy &&
      mousePos.y <= cy + ch;

    if (isCardHovered) {
      this.hoveredCard = card;
    }

    const isOwned = this.inventory.deck.some(c => c.id === card.id);
    const price = card.shopPrice ?? 30;
    const canAfford = this.inventory.gold >= price;

    // STRICT CARD CLIPPING: Ensures zero text overflows card plates
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 4);
    ctx.clip();

    // 1. Parchment Plate Background
    const plateImg = HarborShopOverlay.getImage('parchment_item_plate.png');
    if (plateImg && plateImg.complete && plateImg.naturalWidth > 0) {
      ctx.drawImage(plateImg, cx, cy, cw, ch);
    } else {
      ctx.fillStyle = isCardHovered ? '#ebdcc1' : '#ddc9a4';
      ctx.beginPath();
      ctx.roundRect(cx, cy, cw, ch, 4);
      ctx.fill();
    }

    // Hover Border Glow
    if (isCardHovered) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1, 4);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Standalone Woodcut Icon Frame
    const iconSize = 36;
    const iconX = cx + 8;
    const iconY = cy + Math.floor((ch - iconSize) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(28, 20, 14, 0.06)';
    ctx.strokeStyle = '#5a3e2b';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 3);
    ctx.fill();
    ctx.stroke();

    if (card.iconSprite) {
      const iconImg = HarborShopOverlay.getImage(card.iconSprite);
      if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
        ctx.drawImage(iconImg, iconX + 1, iconY + 1, iconSize - 2, iconSize - 2);
      }
    }
    ctx.restore();

    // 3. Compact Buy Button (Positioned at right edge)
    const btnW = 50;
    const btnH = 16;
    const btnX = cx + cw - btnW - 8;
    const btnY = cy + Math.floor((ch - btnH) / 2);

    const isBtnHovered =
      mousePos.x >= btnX &&
      mousePos.x <= btnX + btnW &&
      mousePos.y >= btnY &&
      mousePos.y <= btnY + btnH;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 3);

    if (isOwned) {
      ctx.fillStyle = '#292524';
      ctx.fill();
      ctx.strokeStyle = '#78716c';
    } else if (!canAfford) {
      ctx.fillStyle = '#3f3f46';
      ctx.fill();
      ctx.strokeStyle = '#71717a';
    } else {
      ctx.fillStyle = isBtnHovered ? '#92400e' : '#451a03';
      ctx.fill();
      ctx.strokeStyle = isBtnHovered ? '#f59e0b' : '#b45309';
    }
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.font = 'bold 8px "Cinzel", "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isOwned) {
      ctx.fillStyle = '#a8a29e';
      ctx.fillText('OWNED', btnX + btnW / 2, btnY + btnH / 2);
    } else {
      ctx.fillStyle = canAfford ? '#fef08a' : '#a8a29e';
      ctx.fillText(`${price}g`, btnX + btnW / 2, btnY + btnH / 2);
    }
    ctx.restore();

    this.buyButtons.push({
      card: card,
      rect: { x: btnX, y: btnY, w: btnW, h: btnH }
    });

    // 4. Content Typography Area (Strict 3 lines)
    const textX = iconX + iconSize + 8;
    const maxTextW = btnX - textX - 6;

    // Line 1: Stamina Medallion + Title
    const titleY = cy + 14;
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(textX + 5, titleY - 3.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 7.5px "Cinzel", serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const romanCost =
      card.staminaCost === 0 ? '0' : card.staminaCost === 1 ? 'I' : card.staminaCost === 2 ? 'II' : 'III';
    ctx.fillText(romanCost, textX + 5, titleY - 3.5);

    ctx.font = 'bold 10px "Cinzel", serif';
    ctx.fillStyle = '#1e1b18';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(card.title, textX + 15, titleY, maxTextW - 15);
    ctx.restore();

    // Line 2: Formatted Stat Summary
    const statY = titleY + 13;
    ctx.save();
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const statColor =
      card.pullDistance > 0 ? '#047857' : card.slackGain > 0 ? '#0369a1' : '#7c3aed';
    ctx.fillStyle = statColor;
    ctx.fillText(card.statSummary ?? `${card.pullDistance}m Pull`, textX + 15, statY, maxTextW - 15);
    ctx.restore();

    // Line 3: Concise Lore Description
    const descY = statY + 12;
    ctx.save();
    ctx.font = 'italic 8px "Crimson Pro", Georgia, serif';
    ctx.fillStyle = '#44382c';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(card.shortDesc ?? card.description, textX + 15, descY, maxTextW - 15);
    ctx.restore();

    ctx.restore(); // Ends strict card clip
  }

  // ==========================================
  // UPGRADES CATALOGUE (STAMINA & LINE INTEGRITY)
  // ==========================================
  private renderUpgradesCatalogue(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): void {
    const pageMarginTop = 46;
    const pageWidth = (bw - 64) / 2;
    const leftPageX = bx + 34;
    const rightPageX = bx + pageWidth + 30;
    const startY = by + pageMarginTop;
    const cardW = pageWidth - 14;

    const mousePos = Input.getMousePosition();

    // ==========================================
    // LEFT PAGE: ANGLER STAMINA & VIGOR
    // ==========================================
    ctx.save();
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.fillStyle = '#0f766e';
    ctx.textAlign = 'center';
    ctx.fillText('✦ ANGLER STAMINA & VIGOR ✦', leftPageX + pageWidth / 2, startY - 14);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#574635';
    ctx.fillText('Endurance to haul deep aberrations & cast heavy tackle', leftPageX + pageWidth / 2, startY);

    // Current Stamina Plaque
    const plaqueY = startY + 14;
    const plaqueH = 42;
    ctx.beginPath();
    ctx.roundRect(leftPageX, plaqueY, cardW, plaqueH, 5);
    ctx.fillStyle = 'rgba(15, 118, 110, 0.08)';
    ctx.strokeStyle = '#0d9488';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10.5px "Cinzel", serif';
    ctx.fillStyle = '#115e59';
    ctx.textAlign = 'left';
    ctx.fillText(`CURRENT MAX STAMINA: ${this.inventory.maxStamina} / 5`, leftPageX + 12, plaqueY + 16);

    ctx.font = 'italic 8px Georgia, serif';
    ctx.fillStyle = '#475569';
    const installedCount = this.inventory.staminaUpgradeLevel;
    ctx.fillText(`Base: 2 Stamina  •  Upgrades Installed: +${installedCount}`, leftPageX + 12, plaqueY + 30);

    // 5 Brass Energy Orbs
    const orbsStartX = leftPageX + cardW - 110;
    for (let i = 0; i < 5; i++) {
      const ox = orbsStartX + i * 20;
      const oy = plaqueY + 21;
      const isOwned = i < this.inventory.maxStamina;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fillStyle = isOwned ? '#0f172a' : '#1c1917';
      ctx.strokeStyle = isOwned ? '#f59e0b' : '#78716c';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      if (isOwned) {
        ctx.beginPath();
        ctx.arc(ox, oy, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      ctx.restore();
    }

    // Stamina Tiers
    const stamCardH = 56;
    const stamGap = 10;
    const stamStartY = plaqueY + plaqueH + 12;

    STAMINA_UPGRADES.forEach((tier, idx) => {
      const cy = stamStartY + idx * (stamCardH + stamGap);
      if (cy + stamCardH > by + bh - 16) return;

      const isOwned = this.inventory.staminaUpgradeLevel >= tier.level;
      const isNext = this.inventory.staminaUpgradeLevel === tier.level - 1;
      const canAfford = this.inventory.gold >= tier.cost;

      // Card plate
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(leftPageX, cy, cardW, stamCardH, 4);
      ctx.clip();

      ctx.fillStyle = isOwned ? '#e2e8f0' : (isNext ? '#ebdcc1' : '#d6d3d1');
      ctx.fill();
      ctx.strokeStyle = isOwned ? '#10b981' : (isNext ? (canAfford ? '#0d9488' : '#b91c1c') : '#a8a29e');
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Icon box
      const iconSize = 36;
      const iconX = leftPageX + 8;
      const iconY = cy + Math.floor((stamCardH - iconSize) / 2);
      ctx.beginPath();
      ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
      ctx.fillStyle = isOwned ? '#042f2e' : '#1e293b';
      ctx.strokeStyle = isOwned ? '#10b981' : '#64748b';
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();

      // Icon glyph
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.fillStyle = isOwned ? '#34d399' : (isNext ? '#38bdf8' : '#94a3b8');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', iconX + iconSize / 2, iconY + iconSize / 2);

      // Buy / Status Button
      const btnW = 76;
      const btnH = 20;
      const btnX = leftPageX + cardW - btnW - 8;
      const btnY = cy + Math.floor((stamCardH - btnH) / 2);

      const isBtnHovered =
        mousePos.x >= btnX && mousePos.x <= btnX + btnW &&
        mousePos.y >= btnY && mousePos.y <= btnY + btnH;

      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 3);
      if (isOwned) {
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
      } else if (isNext) {
        if (canAfford) {
          ctx.fillStyle = isBtnHovered ? '#0f766e' : '#115e59';
          ctx.strokeStyle = isBtnHovered ? '#34d399' : '#0d9488';
        } else {
          ctx.fillStyle = '#450a0a';
          ctx.strokeStyle = '#991b1b';
        }
      } else {
        ctx.fillStyle = '#292524';
        ctx.strokeStyle = '#57534e';
      }
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 8px "Cinzel", "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isOwned) {
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText('INSTALLED ✓', btnX + btnW / 2, btnY + btnH / 2);
      } else if (isNext) {
        ctx.fillStyle = canAfford ? '#fef08a' : '#fca5a5';
        ctx.fillText(canAfford ? `BUY ${tier.cost}g` : `${tier.cost}g (LACK)`, btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('LOCKED', btnX + btnW / 2, btnY + btnH / 2);
      }

      this.staminaUpgradeButtons.push({
        tier,
        rect: { x: btnX, y: btnY, w: btnW, h: btnH }
      });

      // Typography
      const textX = iconX + iconSize + 8;
      const maxTextW = btnX - textX - 6;

      // Line 1: Title
      ctx.font = 'bold 9.5px "Cinzel", serif';
      ctx.fillStyle = '#1e1b18';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Rank ${tier.level}: ${tier.title}`, textX, cy + 15, maxTextW);

      // Line 2: Stat boost
      ctx.font = 'bold 8.5px sans-serif';
      ctx.fillStyle = isOwned ? '#059669' : '#0284c7';
      ctx.fillText(tier.shortDesc, textX, cy + 28, maxTextW);

      // Line 3: Lore
      ctx.font = 'italic 7.5px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = '#44382c';
      ctx.fillText(tier.lore, textX, cy + 41, maxTextW);

      ctx.restore();
    });
    ctx.restore();

    // ==========================================
    // RIGHT PAGE: VESSEL LINE & HULL INTEGRITY
    // ==========================================
    ctx.save();
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.fillStyle = '#991b1b';
    ctx.textAlign = 'center';
    ctx.fillText('✦ LINE INTEGRITY & REINFORCEMENT ✦', rightPageX + pageWidth / 2, startY - 14);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#574635';
    ctx.fillText('Tensile strength resisting snapping under violent thrash tension', rightPageX + pageWidth / 2, startY);

    // Current Line Health Plaque
    ctx.beginPath();
    ctx.roundRect(rightPageX, plaqueY, cardW, plaqueH, 5);
    ctx.fillStyle = 'rgba(153, 27, 27, 0.08)';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10.5px "Cinzel", serif';
    ctx.fillStyle = '#7f1d1d';
    ctx.textAlign = 'left';
    ctx.fillText(`CURRENT MAX LINE: ${this.inventory.maxLineIntegrity} / 40`, rightPageX + 12, plaqueY + 16);

    ctx.font = 'italic 8px Georgia, serif';
    ctx.fillStyle = '#475569';
    const lineInstalledCount = this.inventory.lineHealthUpgradeLevel;
    ctx.fillText(`Base: 20 Line  •  Reinforcements Installed: +${lineInstalledCount * 5}`, rightPageX + 12, plaqueY + 30);

    // Braided Wire Gauge Bar
    const gaugeX = rightPageX + cardW - 120;
    const gaugeY = plaqueY + 14;
    const gaugeW = 108;
    const gaugeH = 14;

    ctx.beginPath();
    ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 3);
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1.0;
    ctx.fill();
    ctx.stroke();

    const gaugeRatio = Math.min(1.0, this.inventory.maxLineIntegrity / 40);
    const fillW = Math.max(0, Math.floor(gaugeW * gaugeRatio));
    if (fillW > 0) {
      const gGrad = ctx.createLinearGradient(gaugeX, gaugeY, gaugeX + fillW, gaugeY);
      gGrad.addColorStop(0, '#ef4444');
      gGrad.addColorStop(0.7, '#f59e0b');
      gGrad.addColorStop(1, '#10b981');
      ctx.beginPath();
      ctx.roundRect(gaugeX + 1, gaugeY + 1, fillW - 2, gaugeH - 2, 2);
      ctx.fillStyle = gGrad;
      ctx.fill();
    }

    // Line Integrity Tiers
    const lineCardH = 46;
    const lineGap = 8;
    const lineStartY = plaqueY + plaqueH + 12;

    LINE_HEALTH_UPGRADES.forEach((tier, idx) => {
      const cy = lineStartY + idx * (lineCardH + lineGap);
      if (cy + lineCardH > by + bh - 16) return;

      const isOwned = this.inventory.lineHealthUpgradeLevel >= tier.level;
      const isNext = this.inventory.lineHealthUpgradeLevel === tier.level - 1;
      const canAfford = this.inventory.gold >= tier.cost;

      // Card plate
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rightPageX, cy, cardW, lineCardH, 4);
      ctx.clip();

      ctx.fillStyle = isOwned ? '#e2e8f0' : (isNext ? '#ebdcc1' : '#d6d3d1');
      ctx.fill();
      ctx.strokeStyle = isOwned ? '#10b981' : (isNext ? (canAfford ? '#b91c1c' : '#7f1d1d') : '#a8a29e');
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Icon box
      const iconSize = 30;
      const iconX = rightPageX + 8;
      const iconY = cy + Math.floor((lineCardH - iconSize) / 2);
      ctx.beginPath();
      ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
      ctx.fillStyle = isOwned ? '#042f2e' : '#1e1b18';
      ctx.strokeStyle = isOwned ? '#10b981' : '#78716c';
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.fillStyle = isOwned ? '#34d399' : (isNext ? '#f87171' : '#94a3b8');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚓', iconX + iconSize / 2, iconY + iconSize / 2);

      // Buy Button
      const btnW = 76;
      const btnH = 19;
      const btnX = rightPageX + cardW - btnW - 8;
      const btnY = cy + Math.floor((lineCardH - btnH) / 2);

      const isBtnHovered =
        mousePos.x >= btnX && mousePos.x <= btnX + btnW &&
        mousePos.y >= btnY && mousePos.y <= btnY + btnH;

      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 3);
      if (isOwned) {
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
      } else if (isNext) {
        if (canAfford) {
          ctx.fillStyle = isBtnHovered ? '#991b1b' : '#7f1d1d';
          ctx.strokeStyle = isBtnHovered ? '#f87171' : '#ef4444';
        } else {
          ctx.fillStyle = '#450a0a';
          ctx.strokeStyle = '#7f1d1d';
        }
      } else {
        ctx.fillStyle = '#292524';
        ctx.strokeStyle = '#57534e';
      }
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 8px "Cinzel", "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isOwned) {
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText('INSTALLED ✓', btnX + btnW / 2, btnY + btnH / 2);
      } else if (isNext) {
        ctx.fillStyle = canAfford ? '#fef08a' : '#fca5a5';
        ctx.fillText(canAfford ? `BUY ${tier.cost}g` : `${tier.cost}g (LACK)`, btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.fillStyle = '#a8a29e';
        ctx.fillText('LOCKED', btnX + btnW / 2, btnY + btnH / 2);
      }

      this.lineUpgradeButtons.push({
        tier,
        rect: { x: btnX, y: btnY, w: btnW, h: btnH }
      });

      // Typography
      const textX = iconX + iconSize + 8;
      const maxTextW = btnX - textX - 6;

      ctx.font = 'bold 9px "Cinzel", serif';
      ctx.fillStyle = '#1e1b18';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`Rank ${tier.level}: ${tier.title}`, textX, cy + 13, maxTextW);

      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = isOwned ? '#059669' : '#047857';
      ctx.fillText(tier.shortDesc, textX, cy + 24, maxTextW);

      ctx.font = 'italic 7px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = '#44382c';
      ctx.fillText(tier.lore, textX, cy + 35, maxTextW);

      ctx.restore();
    });
    ctx.restore();
  }

  // ==========================================
  // BAIT & CHUM CATALOGUE
  // ==========================================
  private renderBaitCatalogue(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): void {
    const pageMarginTop = 46;
    const pageWidth = (bw - 64) / 2;
    const leftPageX = bx + 34;
    const rightPageX = bx + pageWidth + 30;
    const startY = by + pageMarginTop;
    const cardW = pageWidth - 14;

    const mousePos = Input.getMousePosition();

    // ==========================================
    // LEFT PAGE: INNSMOUTH CHANDLERY BAIT & CHUM
    // ==========================================
    ctx.save();
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.fillStyle = '#78350f';
    ctx.textAlign = 'center';
    ctx.fillText('✦ INNSMOUTH CHANDLERY BAIT & CHUM ✦', leftPageX + pageWidth / 2, startY - 14);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#574635';
    ctx.fillText('Entice coastal shoals, bottom-dwellers & pelagic predators', leftPageX + pageWidth / 2, startY);

    // Left Page Baits: Bare Hook, Lugworms, Blood Chum
    const leftBaits: BaitData[] = [
      BAIT_REGISTRY.bare_hook,
      BAIT_REGISTRY.lugworms,
      BAIT_REGISTRY.blood_chum
    ];

    const cardH = 68;
    const cardGap = 12;
    const cardsStartY = startY + 12;

    leftBaits.forEach((bait, idx) => {
      const cy = cardsStartY + idx * (cardH + cardGap);
      this.renderBaitCard(ctx, bait, leftPageX, cy, cardW, cardH, mousePos);
    });

    ctx.restore();

    // ==========================================
    // RIGHT PAGE: ABYSSAL LURES & APEX OFFERINGS
    // ==========================================
    ctx.save();
    ctx.font = 'bold 12px "Cinzel", serif';
    ctx.fillStyle = '#581c87';
    ctx.textAlign = 'center';
    ctx.fillText('✦ ABYSSAL LURES & APEX OFFERINGS ✦', rightPageX + pageWidth / 2, startY - 14);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#574635';
    ctx.fillText('Harvested from lightless hydrothermal vents & trench voids', rightPageX + pageWidth / 2, startY);

    // Right Page Baits: Bioluminescent Squid, Eldritch Grub
    const rightBaits: BaitData[] = [
      BAIT_REGISTRY.bio_squid,
      BAIT_REGISTRY.eldritch_grub
    ];

    rightBaits.forEach((bait, idx) => {
      const cy = cardsStartY + idx * (cardH + cardGap);
      this.renderBaitCard(ctx, bait, rightPageX, cy, cardW, cardH, mousePos);
    });

    // Right Page Bottom: Tackle Codex / Lore Plaque
    const codexY = cardsStartY + 2 * (cardH + cardGap) + 4;
    const codexH = bh - (codexY - by) - 24;
    if (codexH > 40) {
      ctx.beginPath();
      ctx.roundRect(rightPageX, codexY, cardW, codexH, 5);
      ctx.fillStyle = 'rgba(88, 28, 135, 0.06)';
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = '#6b21a8';
      ctx.textAlign = 'left';
      ctx.fillText('✦ CHANDLERY TACKLE CODEX ✦', rightPageX + 12, codexY + 18);

      ctx.font = 'italic 8px Georgia, serif';
      ctx.fillStyle = '#44382c';
      ctx.fillText(
        '• Baits bias fish encounters toward Rare & Aberrant apex specimens.',
        rightPageX + 12,
        codexY + 34
      );
      ctx.fillText(
        '• High-grade bait increases bite strike rate (up to 85%) and lowers slack line.',
        rightPageX + 12,
        codexY + 48
      );
      ctx.fillText(
        '• Bare Hook is always available without cost. Rig your tackle prior to every cast.',
        rightPageX + 12,
        codexY + 62
      );
    }

    ctx.restore();
  }

  private renderBaitCard(
    ctx: CanvasRenderingContext2D,
    bait: BaitData,
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    mousePos: { x: number; y: number }
  ): void {
    const isBareHook = bait.id === 'bare_hook';
    const count = this.inventory.getBaitCount(bait.id);
    const canAfford = this.inventory.gold >= bait.cost;

    // Card plate
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, ch, 4);
    ctx.clip();

    // Parchment card fill
    ctx.fillStyle = '#f5ede0';
    ctx.fill();
    ctx.strokeStyle = isBareHook ? '#78716c' : '#b45309';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 1. Icon Box
    const iconSize = 42;
    const iconX = cx + 8;
    const iconY = cy + Math.floor((ch - iconSize) / 2);

    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
    ctx.fillStyle = '#1e1b18';
    ctx.fill();
    ctx.strokeStyle = '#785b3b';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    const img = HarborShopOverlay.getImage(bait.iconAssetKey);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, iconX + 2, iconY + 2, iconSize - 4, iconSize - 4);
    } else {
      // Fallback symbol
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪱', iconX + iconSize / 2, iconY + iconSize / 2);
    }

    // 2. Buy / Status Button on Right
    const btnW = 74;
    const btnH = 26;
    const btnX = cx + cw - btnW - 8;
    const btnY = cy + Math.floor((ch - btnH) / 2);

    const isBtnHovered =
      mousePos.x >= btnX &&
      mousePos.x <= btnX + btnW &&
      mousePos.y >= btnY &&
      mousePos.y <= btnY + btnH;

    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 3);

    if (isBareHook) {
      ctx.fillStyle = '#292524';
      ctx.fill();
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('READY (∞)', btnX + btnW / 2, btnY + btnH / 2);
    } else {
      if (canAfford) {
        ctx.fillStyle = isBtnHovered ? '#92400e' : '#451a03';
        ctx.strokeStyle = isBtnHovered ? '#f59e0b' : '#b45309';
      } else {
        ctx.fillStyle = '#3f3f46';
        ctx.strokeStyle = '#71717a';
      }
      ctx.fill();
      ctx.lineWidth = 1.0;
      ctx.stroke();

      ctx.font = 'bold 8.5px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (canAfford) {
        ctx.fillStyle = isBtnHovered ? '#ffffff' : '#fef08a';
        ctx.fillText(`BUY ${bait.cost}g`, btnX + btnW / 2, btnY + btnH / 2);
      } else {
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`${bait.cost}g (LACK)`, btnX + btnW / 2, btnY + btnH / 2);
      }
    }

    this.baitBuyButtons.push({
      bait,
      rect: { x: btnX, y: btnY, w: btnW, h: btnH }
    });

    // 3. Content Typography Area
    const textX = iconX + iconSize + 8;
    const maxTextW = btnX - textX - 6;

    // Line 1: Title + Owned in Hold Badge
    const titleY = cy + 15;
    ctx.font = 'bold 10.5px "Cinzel", serif';
    ctx.fillStyle = '#1e1b18';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(bait.name, textX, titleY, maxTextW - 65);

    // Owned Stock Badge
    ctx.save();
    const holdBadgeText = isBareHook ? 'In Hold: ∞' : `In Hold: ${count}`;
    ctx.font = 'bold 8.5px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = count > 0 || isBareHook ? '#047857' : '#94a3b8';
    ctx.fillText(holdBadgeText, btnX - 6, titleY);
    ctx.restore();

    // Line 2: Attraction Stat Tags (+Common / +Uncommon / +Rare)
    const statY = titleY + 14;
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const rw = bait.rarityWeights;
    const statTagText = `Attracts: ${rw.common}% Common • ${rw.uncommon}% Uncom • ${rw.rare}% Rare`;
    ctx.fillStyle = '#0369a1';
    ctx.fillText(statTagText, textX, statY, maxTextW);

    // Line 3: Description Lore
    const descY = statY + 13;
    ctx.font = 'italic 7.5px "Crimson Pro", Georgia, serif';
    ctx.fillStyle = '#44382c';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(bait.description, textX, descY, maxTextW);

    ctx.restore();
  }

  // ==========================================
  // DECK INSPECTION VIEW (ONLY RENDERED IN DECK VIEW MODE)
  // ==========================================
  private renderDeckInspection(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): void {
    ctx.save();
    const pageMarginTop = 48;
    const usableH = bh - pageMarginTop - 20;
    const pageWidth = (bw - 64) / 2;
    const leftPageX = bx + 34;
    const rightPageX = bx + pageWidth + 30;
    const startY = by + pageMarginTop;

    const cardGap = 8;
    const cardH = Math.min(52, Math.floor((usableH - 40 - cardGap * 3) / 4));
    const cardW = pageWidth - 14;

    const showLeft = this.selectedTab === 'all' || this.selectedTab === 'ledgers' || this.selectedTab === 'upgrades';
    const showRight = this.selectedTab === 'all' || this.selectedTab === 'techniques' || this.selectedTab === 'upgrades';

    // LEFT PAGE: ACTIVE TACKLE (NON-TECHNIQUE CARDS IN DECK)
    if (showLeft) {
      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.fillStyle = '#1e1b18';
      ctx.textAlign = 'center';
      ctx.fillText('ACTIVE INNSMOUTH TACKLE', leftPageX + pageWidth / 2, startY - 14);

      ctx.font = 'italic 9.5px Georgia, serif';
      ctx.fillStyle = '#574635';
      ctx.fillText('Standard sea-worn angling gear & winches aboard your vessel', leftPageX + pageWidth / 2, startY);

      // Collect all unique tackle cards in deck
      const tackleCards: CardData[] = [];
      for (const c of this.inventory.deck) {
        if (c.cardType !== 'Technique' && !c.oncePerBattle) {
          if (!tackleCards.some(tc => tc.id === c.id)) {
            tackleCards.push(c);
          }
        }
      }

      tackleCards.forEach((sc, idx) => {
        const count = this.inventory.deck.filter(c => c.id === sc.id).length;
        const cy = startY + 14 + idx * (cardH + cardGap);
        if (cy + cardH > by + bh - 16) return;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(leftPageX, cy, cardW, cardH, 4);
        ctx.clip();

        ctx.fillStyle = '#ebdcc1';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 1.2;
        ctx.fill();
        ctx.stroke();

        // Stamina Medallion
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(leftPageX + 16, cy + cardH / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 8.5px "Cinzel", serif';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const romanCost =
          sc.staminaCost === 0 ? '0' : sc.staminaCost === 1 ? 'I' : 'II';
        ctx.fillText(romanCost, leftPageX + 16, cy + cardH / 2);

        // Title with count
        ctx.font = 'bold 10.5px "Cinzel", serif';
        ctx.fillStyle = '#1e1b18';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${sc.title} (x${count})`, leftPageX + 30, cy + 15, cardW - 38);

        // Stat Summary
        ctx.font = 'bold 8.5px sans-serif';
        ctx.fillStyle = sc.pullDistance > 0 ? '#047857' : '#0369a1';
        ctx.fillText(sc.statSummary ?? `${sc.pullDistance}m Pull`, leftPageX + 30, cy + 27, cardW - 38);

        // Short Description
        ctx.font = 'italic 8px "Crimson Pro", Georgia, serif';
        ctx.fillStyle = '#44382c';
        ctx.fillText(sc.shortDesc ?? sc.description, leftPageX + 30, cy + 39, cardW - 38);

        ctx.restore();
      });
    } else {
      ctx.save();
      ctx.font = 'italic 12px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = 'rgba(74, 53, 37, 0.45)';
      ctx.textAlign = 'center';
      ctx.fillText('• Active Tackle Deck (Click Ledgers Tab) •', leftPageX + cardW / 2, startY + usableH / 2);
      ctx.restore();
    }

    // RIGHT PAGE: NAVAL ARMORY DECK (Cards for naval/monster combat)
    if (showRight) {
      ctx.font = 'bold 12px "Cinzel", serif';
      ctx.fillStyle = '#1e1b18';
      ctx.textAlign = 'center';
      ctx.fillText('NAVAL ARMORY DECK', rightPageX + pageWidth / 2, startY - 14);

      ctx.font = 'italic 9.5px Georgia, serif';
      ctx.fillStyle = '#574635';
      ctx.fillText('Fitted broadsides, ordnance & maneuvers for warship & beast combat', rightPageX + pageWidth / 2, startY);

      const navalCards = this.inventory.navalDeck || [];
      const hasCards = navalCards.length > 0;

      if (!hasCards) {
        ctx.save();
        ctx.fillStyle = 'rgba(74, 53, 37, 0.08)';
        ctx.strokeStyle = '#a8947c';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.roundRect(rightPageX, startY + 16, cardW, usableH - 24, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 12px "Cinzel", serif';
        ctx.fillStyle = '#78350f';
        ctx.textAlign = 'center';
        ctx.fillText(
          'No Armory Cards Fitted',
          rightPageX + cardW / 2,
          startY + usableH / 2 - 10
        );
        ctx.font = 'italic 11px Georgia, serif';
        ctx.fillStyle = '#574635';
        ctx.fillText(
          'Fit cannons, bracing, or tactical naval armory cards',
          rightPageX + cardW / 2,
          startY + usableH / 2 + 12
        );
        ctx.fillText(
          'to prepare your vessel for hostile broadside encounters.',
          rightPageX + cardW / 2,
          startY + usableH / 2 + 28
        );
        ctx.restore();
      } else {
        // Collect unique naval cards for clean pagination
        const uniqueNavalCards: NavalCardData[] = [];
        for (const nc of navalCards) {
          if (!uniqueNavalCards.some(u => u.id === nc.id)) {
            uniqueNavalCards.push(nc);
          }
        }

        uniqueNavalCards.forEach((c, idx) => {
          const count = navalCards.filter(card => card.id === c.id).length;
          const cy = startY + 14 + idx * (cardH + cardGap);
          if (cy + cardH <= by + bh - 24) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(rightPageX, cy, cardW, cardH, 4);
            ctx.clip();

            ctx.fillStyle = '#f0fdf4';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.2;
            ctx.fill();
            ctx.stroke();

            // Stamina Medallion
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(rightPageX + 16, cy + cardH / 2, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = 'bold 8.5px "Cinzel", serif';
            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const romanCost =
              c.staminaCost === 0 ? '0' : c.staminaCost === 1 ? 'I' : c.staminaCost === 2 ? 'II' : 'III';
            ctx.fillText(romanCost, rightPageX + 16, cy + cardH / 2);

            // Title with count
            ctx.font = 'bold 10px "Cinzel", serif';
            ctx.fillStyle = '#0f172a';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            const countSuffix = count > 1 ? ` (x${count})` : '';
            ctx.fillText(`${c.title}${countSuffix}`, rightPageX + 30, cy + 15, cardW - 38);

            // Stat Summary (Damage / Armor / Repair / Dodge / Stun)
            let statSummary = '';
            if (c.damage > 0 && c.stunTurns > 0) statSummary = `${c.damage} DMG • 1 TURN STUN`;
            else if (c.damage > 0) statSummary = `${c.damage} CANNON DAMAGE`;
            else if (c.armorGain > 0) statSummary = `+${c.armorGain} TEMPORARY ARMOR`;
            else if (c.hullRepair > 0) statSummary = `+${c.hullRepair} HULL REPAIR`;
            else if (c.dodgeChance > 0) statSummary = `${Math.round(c.dodgeChance * 100)}% EVASIVE DODGE`;

            ctx.font = 'bold 8px "Segoe UI", sans-serif';
            ctx.fillStyle = '#0369a1';
            ctx.fillText(statSummary, rightPageX + 30, cy + 27, cardW - 38);

            // Description Lore
            ctx.font = 'italic 7.5px "Crimson Pro", Georgia, serif';
            ctx.fillStyle = '#334155';
            ctx.fillText(c.description, rightPageX + 30, cy + 39, cardW - 38);

            ctx.restore();
          }
        });
      }
    } else {
      ctx.save();
      ctx.font = 'italic 12px "Crimson Pro", Georgia, serif';
      ctx.fillStyle = 'rgba(74, 53, 37, 0.45)';
      ctx.textAlign = 'center';
      ctx.fillText(
        '• Naval Armory Deck (Click Techniques Tab) •',
        rightPageX + cardW / 2,
        startY + usableH / 2
      );
      ctx.restore();
    }

    // Bottom Vessel Capacities Banner
    const statusBannerY = by + bh - 30;
    const statusBannerX = leftPageX;
    const statusBannerW = rightPageX + cardW - leftPageX;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(statusBannerX, statusBannerY, statusBannerW, 22, 4);
    ctx.fillStyle = 'rgba(20, 16, 12, 0.85)';
    ctx.strokeStyle = '#785337';
    ctx.lineWidth = 1.0;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 9px "Cinzel", serif';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `⚓ TACKLE DECK: ${this.inventory.deck.length} CARDS  •  NAVAL ARMORY: ${this.inventory.navalDeck.length} CARDS  •  HULL: ${this.inventory.hullHp}/${this.inventory.maxHullHp} HP`,
      statusBannerX + statusBannerW / 2,
      statusBannerY + 11
    );
    ctx.restore();

    ctx.restore();
  }

  // ==========================================
  // FLOATING HOVER TOOLTIP & NOTIFICATION
  // ==========================================
  private renderHoverTooltip(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (!this.hoveredCard) return;
    const c = this.hoveredCard;

    ctx.save();
    const ttW = Math.min(540, W - 48);
    const ttH = 34;
    const ttX = (W - ttW) / 2;
    const ttY = H - 46;

    ctx.fillStyle = 'rgba(10, 16, 24, 0.95)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(ttX, ttY, ttW, ttH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 10.5px "Cinzel", Georgia, serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`📜 ${c.title}`, ttX + 12, ttY + ttH / 2);

    ctx.font = 'italic 10px "Crimson Pro", Georgia, serif';
    ctx.fillStyle = '#e2e8f0';
    const titleW = ctx.measureText(`📜 ${c.title}`).width;
    ctx.fillText(`— ${c.description}`, ttX + 16 + titleW, ttY + ttH / 2, ttW - titleW - 28);

    ctx.restore();
  }

  private renderNotification(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (!this.notification) return;

    ctx.save();
    const notifW = Math.min(540, W - 40);
    const notifH = 42;
    const notifX = (W - notifW) / 2;
    const notifY = H - 98;

    ctx.fillStyle = 'rgba(8, 12, 16, 0.95)';
    ctx.strokeStyle = this.notification.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(notifX, notifY, notifW, notifH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = this.notification.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.notification.text, notifX + notifW / 2, notifY + notifH / 2);
    ctx.restore();
  }
}
