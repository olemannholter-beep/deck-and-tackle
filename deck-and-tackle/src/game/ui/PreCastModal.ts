import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';
import { PlayerInventory } from '../player/PlayerInventory';
import { BAIT_REGISTRY, ALL_BAIT_IDS } from '../battle/BaitData';
import type { BaitId } from '../battle/BaitData';

export class PreCastModal {
  public isOpen: boolean = false;
  public zoneTier: 1 | 2 | 3 | 4 = 1;
  public zoneName: string = 'The Shallows';
  public depthMeters: number = 15;

  private inventory: PlayerInventory;
  private onCastCallback: ((baitId: BaitId) => void) | null = null;
  private onCancelCallback: (() => void) | null = null;
  private time: number = 0;

  // Hitbox Tracking
  private baitTileRects: { baitId: BaitId; rect: { x: number; y: number; w: number; h: number } }[] = [];
  private castBtnRect = { x: 0, y: 0, w: 220, h: 36 };
  private cancelBtnRect = { x: 0, y: 0, w: 180, h: 36 };

  private hoveredBaitId: BaitId | null = null;
  private isCastBtnHovered: boolean = false;
  private isCancelBtnHovered: boolean = false;

  // Static Image Cache
  private static images: Map<string, HTMLImageElement> = new Map();
  private static imagesInitialized: boolean = false;

  constructor(inventory: PlayerInventory) {
    this.inventory = inventory;
    PreCastModal.initImages();
  }

  private static initImages(): void {
    if (this.imagesInitialized) return;
    this.imagesInitialized = true;

    const assets = [
      { key: '/assets/sprites/fishing/tackle_hook_bone.png', fallback: 'tackle_hook_bone.png' },
      { key: '/assets/sprites/fishing/tackle_lure_shrimp.png', fallback: 'tackle_lure_shrimp.png' },
      { key: '/assets/sprites/shop/icon_abyssal_chum.png', fallback: 'icon_abyssal_chum.png' },
      { key: '/assets/sprites/shop/icon_eldritch_lure.png', fallback: 'icon_eldritch_lure.png' },
      { key: '/assets/sprites/fishing/tackle_lure_snail.png', fallback: 'tackle_lure_snail.png' }
    ];

    for (const a of assets) {
      const img = new Image();
      img.src = a.key;
      this.images.set(a.key, img);
      this.images.set(a.fallback, img);
    }
  }

  private static getImage(key: string): HTMLImageElement | undefined {
    if (this.images.has(key)) {
      return this.images.get(key);
    }
    const filename = key.split('/').pop();
    if (filename && this.images.has(filename)) {
      return this.images.get(filename);
    }
    const img = new Image();
    img.src = key;
    this.images.set(key, img);
    return img;
  }

  /**
   * Opens the pre-cast preparation modal for an active whirlpool encounter.
   */
  public open(
    zoneTier: 1 | 2 | 3 | 4,
    zoneName: string,
    depthMeters: number,
    onCast: (baitId: BaitId) => void,
    onCancel: () => void
  ): void {
    this.isOpen = true;
    this.zoneTier = zoneTier;
    this.zoneName = zoneName;
    this.depthMeters = depthMeters;
    this.onCastCallback = onCast;
    this.onCancelCallback = onCancel;

    // Validate that current selected bait is still available in inventory
    const currentCount = this.inventory.getBaitCount(this.inventory.selectedBait);
    if (this.inventory.selectedBait !== 'bare_hook' && currentCount <= 0) {
      this.inventory.selectBait('bare_hook');
    }

    AudioManager.getInstance().playButtonClick();
  }

  /**
   * Closes the modal.
   */
  public close(): void {
    this.isOpen = false;
    this.onCastCallback = null;
    this.onCancelCallback = null;
  }

  /**
   * Confirms cast with currently equipped bait, consumes 1 unit, and executes callback.
   */
  public confirmCast(): BaitId {
    const chosenBait = this.inventory.selectedBait;
    this.inventory.consumeBait(chosenBait);

    const cb = this.onCastCallback;
    this.close();

    AudioManager.getInstance().playButtonClick();
    if (cb) {
      cb(chosenBait);
    }
    return chosenBait;
  }

  /**
   * Cancels preparation and resumes boat navigation without casting.
   */
  public cancel(): void {
    const cb = this.onCancelCallback;
    this.close();

    AudioManager.getInstance().playButtonClick();
    if (cb) {
      cb();
    }
  }

  /**
   * Cycles through available owned baits in inventory.
   */
  public cycleBait(direction: 1 | -1): void {
    const ownedBaits: BaitId[] = ALL_BAIT_IDS.filter(
      id => id === 'bare_hook' || this.inventory.getBaitCount(id) > 0
    );

    if (ownedBaits.length <= 1) return;

    let currentIndex = ownedBaits.indexOf(this.inventory.selectedBait);
    if (currentIndex === -1) currentIndex = 0;

    const nextIndex = (currentIndex + direction + ownedBaits.length) % ownedBaits.length;
    this.inventory.selectBait(ownedBaits[nextIndex]);
    AudioManager.getInstance().playButtonClick();
  }

  public update(dt: number, _width?: number, _height?: number): void {
    if (!this.isOpen) return;
    this.time += dt;

    // Keyboard Shortcuts
    if (Input.isJustPressed('escape')) {
      this.cancel();
      return;
    }

    if (Input.isJustPressed('space') || Input.isJustPressed('enter')) {
      this.confirmCast();
      return;
    }

    if (Input.isJustPressed('arrowleft') || Input.isJustPressed('keya')) {
      this.cycleBait(-1);
      return;
    }

    if (Input.isJustPressed('arrowright') || Input.isJustPressed('keyd')) {
      this.cycleBait(1);
      return;
    }

    // Number keys 1-5 for direct bait selection
    const numberKeys: { key: string; baitId: BaitId }[] = [
      { key: 'digit1', baitId: 'bare_hook' },
      { key: 'digit2', baitId: 'lugworms' },
      { key: 'digit3', baitId: 'blood_chum' },
      { key: 'digit4', baitId: 'bio_squid' },
      { key: 'digit5', baitId: 'eldritch_grub' }
    ];

    for (const item of numberKeys) {
      if (Input.isJustPressed(item.key)) {
        if (item.baitId === 'bare_hook' || this.inventory.getBaitCount(item.baitId) > 0) {
          this.inventory.selectBait(item.baitId);
          AudioManager.getInstance().playButtonClick();
        }
        return;
      }
    }

    // Mouse Hit-Testing
    const mousePos = Input.getMousePosition();

    // 1. Bait Tiles Hover & Click
    this.hoveredBaitId = null;
    for (const tile of this.baitTileRects) {
      const r = tile.rect;
      if (
        mousePos.x >= r.x &&
        mousePos.x <= r.x + r.w &&
        mousePos.y >= r.y &&
        mousePos.y <= r.y + r.h
      ) {
        this.hoveredBaitId = tile.baitId;
        if (Input.isMouseClicked()) {
          if (tile.baitId === 'bare_hook' || this.inventory.getBaitCount(tile.baitId) > 0) {
            this.inventory.selectBait(tile.baitId);
            AudioManager.getInstance().playButtonClick();
          }
        }
        break;
      }
    }

    // 2. Cast Button Hover & Click
    this.isCastBtnHovered =
      mousePos.x >= this.castBtnRect.x &&
      mousePos.x <= this.castBtnRect.x + this.castBtnRect.w &&
      mousePos.y >= this.castBtnRect.y &&
      mousePos.y <= this.castBtnRect.y + this.castBtnRect.h;

    if (this.isCastBtnHovered && Input.isMouseClicked()) {
      this.confirmCast();
      return;
    }

    // 3. Cancel Button Hover & Click
    this.isCancelBtnHovered =
      mousePos.x >= this.cancelBtnRect.x &&
      mousePos.x <= this.cancelBtnRect.x + this.cancelBtnRect.w &&
      mousePos.y >= this.cancelBtnRect.y &&
      mousePos.y <= this.cancelBtnRect.y + this.cancelBtnRect.h;

    if (this.isCancelBtnHovered && Input.isMouseClicked()) {
      this.cancel();
      return;
    }

    // Cursor Styling
    const isInteractive =
      this.hoveredBaitId !== null || this.isCastBtnHovered || this.isCancelBtnHovered;
    Input.setCursor(isInteractive ? 'pointer' : 'default');
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.isOpen) return;

    ctx.save();

    // 1. Semi-translucent dark abyssal vignette overlay
    ctx.fillStyle = 'rgba(2, 6, 14, 0.82)';
    ctx.fillRect(0, 0, width, height);

    // 2. Main Modal Container Plate
    const modalW = Math.min(680, width - 40);
    const modalH = Math.min(480, height - 40);
    const modalX = Math.floor((width - modalW) / 2);
    const modalY = Math.floor((height - modalH) / 2);

    // Background Gradient (Dark Victorian Ironclad Hull)
    const bgGrad = ctx.createLinearGradient(modalX, modalY, modalX, modalY + modalH);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(0.5, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');

    ctx.beginPath();
    ctx.roundRect(modalX, modalY, modalW, modalH, 8);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Double Brass Border
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(modalX + 4, modalY + 4, modalW - 8, modalH - 8, 6);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Rivet Studs at corners
    const rivets = [
      { x: modalX + 10, y: modalY + 10 },
      { x: modalX + modalW - 10, y: modalY + 10 },
      { x: modalX + 10, y: modalY + modalH - 10 },
      { x: modalX + modalW - 10, y: modalY + modalH - 10 }
    ];
    ctx.fillStyle = '#f59e0b';
    for (const r of rivets) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Header Section
    const headerY = modalY + 28;
    ctx.font = 'bold 15px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('⚓ PRE-CAST TACKLE RIGGING ⚓', modalX + modalW / 2, headerY);

    // Whirlpool & Zone Telemetry
    const subY = headerY + 18;
    ctx.font = 'italic 10px Georgia, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `Eddy Location: ${this.zoneName} (Zone Tier ${this.zoneTier})  •  Estimated Depth: ~${this.depthMeters}m`,
      modalX + modalW / 2,
      subY
    );

    // Sub-instruction
    const instrY = subY + 16;
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      'Select bait to rig onto your hook before casting into the swirl (Keys [1-5] or Click):',
      modalX + modalW / 2,
      instrY
    );

    // 4. Bait Carousel / Grid (5 cards horizontally)
    this.baitTileRects = [];
    const tilesStartX = modalX + 20;
    const tilesStartY = instrY + 14;
    const availableW = modalW - 40;
    const tileGap = 8;
    const tileW = Math.floor((availableW - tileGap * 4) / 5);
    const tileH = 140;

    ALL_BAIT_IDS.forEach((id, idx) => {
      const bait = BAIT_REGISTRY[id];
      const count = this.inventory.getBaitCount(id);
      const isSelected = this.inventory.selectedBait === id;
      const isOwned = id === 'bare_hook' || count > 0;
      const isHovered = this.hoveredBaitId === id;

      const tx = tilesStartX + idx * (tileW + tileGap);
      const ty = tilesStartY;

      this.baitTileRects.push({
        baitId: id,
        rect: { x: tx, y: ty, w: tileW, h: tileH }
      });

      // Tile Background Plate
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, 5);

      if (isSelected) {
        ctx.fillStyle = '#1e293b';
      } else if (isHovered && isOwned) {
        ctx.fillStyle = '#1e2230';
      } else if (!isOwned) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
      } else {
        ctx.fillStyle = '#0f172a';
      }
      ctx.fill();

      // Border: glowing if selected, dim if owned, red/gray if empty
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
      } else if (isHovered && isOwned) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = isOwned ? '#475569' : '#334155';
        ctx.lineWidth = 1.0;
      }
      ctx.stroke();
      ctx.restore();

      // Hotkey Badge [1..5]
      ctx.save();
      ctx.font = 'bold 8.5px "Cinzel", monospace';
      ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText(`[${idx + 1}]`, tx + 6, ty + 14);

      // Status pill: READY, xCount, or OUT
      ctx.textAlign = 'right';
      if (id === 'bare_hook') {
        ctx.fillStyle = '#34d399';
        ctx.fillText('∞ READY', tx + tileW - 6, ty + 14);
      } else if (count > 0) {
        ctx.fillStyle = '#34d399';
        ctx.fillText(`x${count}`, tx + tileW - 6, ty + 14);
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillText('0 HELD', tx + tileW - 6, ty + 14);
      }
      ctx.restore();

      // Bait Icon
      const iconSize = 40;
      const iconX = tx + Math.floor((tileW - iconSize) / 2);
      const iconY = ty + 22;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(iconX, iconY, iconSize, iconSize, 4);
      ctx.fillStyle = '#090d16';
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#475569';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      const img = PreCastModal.getImage(bait.iconAssetKey);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, iconX + 2, iconY + 2, iconSize - 4, iconSize - 4);
      } else {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪱', iconX + iconSize / 2, iconY + iconSize / 2);
      }
      ctx.restore();

      // Bait Title
      ctx.save();
      ctx.font = 'bold 9.5px "Cinzel", serif';
      ctx.fillStyle = isOwned ? (isSelected ? '#fef08a' : '#f1f5f9') : '#64748b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(bait.name, tx + tileW / 2, ty + 78, tileW - 8);

      // Attraction Tag Summary
      ctx.font = '8px sans-serif';
      const rw = bait.rarityWeights;
      if (rw.rare >= 35) {
        ctx.fillStyle = '#c084fc'; // Purple for rare bias
        ctx.fillText(`+${rw.rare}% Rare`, tx + tileW / 2, ty + 93);
      } else if (rw.uncommon >= 38) {
        ctx.fillStyle = '#38bdf8'; // Blue for uncommon bias
        ctx.fillText(`+${rw.uncommon}% Uncom`, tx + tileW / 2, ty + 93);
      } else {
        ctx.fillStyle = '#34d399'; // Green for common
        ctx.fillText(`+${rw.common}% Com`, tx + tileW / 2, ty + 93);
      }

      // Selected Indicator Badge at bottom of tile
      if (isSelected) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.roundRect(tx + 8, ty + tileH - 24, tileW - 16, 16, 3);
        ctx.fill();

        ctx.font = 'bold 8px "Cinzel", serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('RIGGED ✓', tx + tileW / 2, ty + tileH - 13);
      } else if (!isOwned) {
        ctx.font = 'italic 7.5px sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Unavailable', tx + tileW / 2, ty + tileH - 13);
      } else {
        ctx.font = 'italic 7.5px sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Click to Rig', tx + tileW / 2, ty + tileH - 13);
      }

      ctx.restore();
    });

    // 5. Selected Bait Telemetry & Attraction Odds Panel
    const selectedBait = BAIT_REGISTRY[this.inventory.selectedBait] ?? BAIT_REGISTRY.bare_hook;
    const oddsY = tilesStartY + tileH + 12;
    const oddsW = availableW;
    const oddsH = 82;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tilesStartX, oddsY, oddsW, oddsH, 5);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Rigged Bait Name Header
    ctx.font = 'bold 11px "Cinzel", serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`RIGGED TACKLE: ${selectedBait.name.toUpperCase()}`, tilesStartX + 12, oddsY + 18);

    // Attraction Odds Row
    const rw = selectedBait.rarityWeights;
    const ow = selectedBait.outcomeWeights;

    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(
      `Attraction Bias:   [Common: ${rw.common}%]   [Uncommon: ${rw.uncommon}%]   [Rare / Aberrant: ${rw.rare}%]`,
      tilesStartX + 12,
      oddsY + 36
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      `Outcome Odds:     Strike: ${ow.strike}%   •   Flotsam Salvage: ${ow.salvage}%   •   Line Goes Slack: ${ow.slack}%`,
      tilesStartX + 12,
      oddsY + 52
    );

    // Lore Description
    ctx.font = 'italic 8px Georgia, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`"${selectedBait.lore || selectedBait.description}"`, tilesStartX + 12, oddsY + 69, oddsW - 24);
    ctx.restore();

    // 6. Action Buttons at Bottom
    const btnRowY = oddsY + oddsH + 14;
    const totalBtnW = this.castBtnRect.w + 14 + this.cancelBtnRect.w;
    const btnStartX = modalX + Math.floor((modalW - totalBtnW) / 2);

    this.castBtnRect.x = btnStartX;
    this.castBtnRect.y = btnRowY;
    this.cancelBtnRect.x = btnStartX + this.castBtnRect.w + 14;
    this.cancelBtnRect.y = btnRowY;

    // Cast Button
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(this.castBtnRect.x, this.castBtnRect.y, this.castBtnRect.w, this.castBtnRect.h, 4);
    ctx.fillStyle = this.isCastBtnHovered ? '#059669' : '#047857';
    ctx.fill();
    ctx.strokeStyle = this.isCastBtnHovered ? '#6ee7b7' : '#10b981';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.font = 'bold 11px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '🎣 CAST TACKLE [SPACE]',
      this.castBtnRect.x + this.castBtnRect.w / 2,
      this.castBtnRect.y + this.castBtnRect.h / 2
    );
    ctx.restore();

    // Cancel Button
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(this.cancelBtnRect.x, this.cancelBtnRect.y, this.cancelBtnRect.w, this.cancelBtnRect.h, 4);
    ctx.fillStyle = this.isCancelBtnHovered ? '#475569' : '#334155';
    ctx.fill();
    ctx.strokeStyle = this.isCancelBtnHovered ? '#cbd5e1' : '#64748b';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = 'bold 10px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      '✖ BACK AWAY [ESC]',
      this.cancelBtnRect.x + this.cancelBtnRect.w / 2,
      this.cancelBtnRect.y + this.cancelBtnRect.h / 2
    );
    ctx.restore();

    ctx.restore();
  }
}
