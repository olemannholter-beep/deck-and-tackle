import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';

export interface ExpeditionStats {
  milesSailed?: number;
  distanceM?: number;
  fishCaught?: number;
  catches?: number;
  monstersDefeated?: number;
}

export const EULOGY_TEXT = 'LOST TO THE COLD TIDE — Your vessel broke upon the black crags. The deep abyss claims all.';

/**
 * 100% Canvas 2D overlay modal triggered when Desperate Escape fails.
 * Eerie Lovecraftian styling, eulogy parchment, full expedition recap statistics,
 * and a "Restart Expedition" button restoring the player vessel at harbor dock.
 */
export class GameOverOverlay {
  public isOpen: boolean = false;
  public milesSailed: number = 0;
  public fishCaught: number = 0;
  public monstersDefeated: number = 0;
  public onRestartCallback: (() => void) | null = null;

  public restartBtnRect = { x: 500, y: 550, w: 280, h: 48 };
  public isRestartBtnHovered: boolean = false;
  public eulogy: string = EULOGY_TEXT;

  private time: number = 0;

  constructor(onRestart?: () => void) {
    if (onRestart) {
      this.onRestartCallback = onRestart;
    }
  }

  public open(stats?: ExpeditionStats, onRestart?: () => void): void {
    this.isOpen = true;
    this.time = 0;

    if (stats) {
      if (stats.milesSailed !== undefined) {
        this.milesSailed = stats.milesSailed;
      } else if (stats.distanceM !== undefined) {
        this.milesSailed = stats.distanceM / 1852;
      } else {
        this.milesSailed = 0;
      }

      this.fishCaught = stats.fishCaught ?? stats.catches ?? 0;
      this.monstersDefeated = stats.monstersDefeated ?? 0;
    }

    if (onRestart) {
      this.onRestartCallback = onRestart;
    }

    try {
      AudioManager.getInstance().duckSoundtrack(0.1);
      AudioManager.getInstance().transitionToMusic('menu', 2.0);
    } catch {
      // Headless / mock audio fallback
    }
  }

  public close(): void {
    this.isOpen = false;
    Input.setCursor('default');
  }

  public isButtonClicked(mx: number, my: number): boolean {
    const btn = this.restartBtnRect;
    return mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h;
  }

  public restart(): void {
    this.close();
    if (this.onRestartCallback) {
      this.onRestartCallback();
    }
  }

  public formatRecap(style?: 'short' | 'detailed'): string {
    const distanceM = Math.round(this.milesSailed * 1852);
    if (style === 'short') {
      return `Catches: ${this.fishCaught} | Distance: ${distanceM}m`;
    }
    return `Catches: ${this.fishCaught} | Distance: ${distanceM}m | Monsters: ${this.monstersDefeated}`;
  }

  public update(dt: number, width: number = 1280, height: number = 720): void {
    if (!this.isOpen) return;

    this.time += dt;

    // Recalculate button bounds for the given viewport
    this.updateButtonBounds(width, height);

    // Keyboard shortcuts: Space or Enter
    if (Input.isJustPressed('space') || Input.isJustPressed('enter')) {
      this.restart();
      return;
    }

    // Mouse Hit-Testing
    const mousePos = Input.getMousePosition();
    this.isRestartBtnHovered = this.isButtonClicked(mousePos.x, mousePos.y);

    if (this.isRestartBtnHovered) {
      Input.setCursor('pointer');
      if (Input.isMouseClicked()) {
        try {
          AudioManager.getInstance().playButtonClick();
        } catch {
          // Audio fallback
        }
        this.restart();
      }
    } else {
      Input.setCursor('default');
    }
  }

  private updateButtonBounds(width: number, height: number): void {
    this.restartBtnRect.w = 280;
    this.restartBtnRect.h = 48;
    if (width === 1280 && height === 720) {
      this.restartBtnRect.x = 500;
      this.restartBtnRect.y = 550;
    } else {
      this.restartBtnRect.x = Math.floor((width - this.restartBtnRect.w) / 2);
      this.restartBtnRect.y = Math.floor(height * 0.76);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.isOpen) return;

    ctx.save();
    this.updateButtonBounds(width, height);

    // 1. Semi-translucent dark abyssal shroud
    ctx.fillStyle = 'rgba(2, 6, 14, 0.94)';
    ctx.fillRect(0, 0, width, height);

    // 2. Main Parchment Modal Plate
    const modalW = Math.min(640, width - 40);
    const modalH = Math.min(500, height - 40);
    const modalX = Math.floor((width - modalW) / 2);
    const modalY = Math.floor((height - modalH) / 2);

    // Modal Background Gradient
    const bgGrad = ctx.createLinearGradient(modalX, modalY, modalX, modalY + modalH);
    bgGrad.addColorStop(0, '#0a0f1d');
    bgGrad.addColorStop(0.5, '#111827');
    bgGrad.addColorStop(1, '#05070e');

    ctx.beginPath();
    this.drawRoundRect(ctx, modalX, modalY, modalW, modalH, 10);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Ornate Eldritch Double Border
    ctx.strokeStyle = '#78350f'; // Dark aged bronze
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    this.drawRoundRect(ctx, modalX + 5, modalY + 5, modalW - 10, modalH - 10, 8);
    ctx.strokeStyle = '#b45309'; // Withered gold
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Rivet studs at corners
    const rivets = [
      { x: modalX + 14, y: modalY + 14 },
      { x: modalX + modalW - 14, y: modalY + 14 },
      { x: modalX + 14, y: modalY + modalH - 14 },
      { x: modalX + modalW - 14, y: modalY + modalH - 14 }
    ];
    ctx.fillStyle = '#f59e0b';
    for (const r of rivets) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Header Title: LOST TO THE COLD TIDE
    const headerY = modalY + 44;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = 'bold 22px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚓ EXPEDITION TERMINATED ⚓', modalX + modalW / 2, headerY);

    // 4. Eulogy Box
    const eulogyBoxW = modalW - 60;
    const eulogyBoxH = 68;
    const eulogyBoxX = modalX + 30;
    const eulogyBoxY = headerY + 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, eulogyBoxX, eulogyBoxY, eulogyBoxW, eulogyBoxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'italic 12px "Georgia", serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      '"' + this.eulogy + '"',
      modalX + modalW / 2,
      eulogyBoxY + 38,
      eulogyBoxW - 24
    );

    // 5. Expedition Recap Statistics Panel
    const statsY = eulogyBoxY + eulogyBoxH + 26;
    ctx.font = 'bold 13px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.fillText('— EXPEDITION MANIFEST RECAP —', modalX + modalW / 2, statsY);

    // 3 Stat Cards
    const cardW = Math.floor((eulogyBoxW - 24) / 3);
    const cardH = 92;
    const cardY = statsY + 14;

    const cardsData = [
      {
        icon: '🧭',
        label: 'MILES SAILED',
        val: `${this.milesSailed.toFixed(1)} NM`,
        sub: `${Math.round(this.milesSailed * 1852).toLocaleString()} meters`
      },
      {
        icon: '🐟',
        label: 'FISH CAUGHT',
        val: `${this.fishCaught}`,
        sub: 'quarry landed'
      },
      {
        icon: '⚔️',
        label: 'MONSTERS SLAIN',
        val: `${this.monstersDefeated}`,
        sub: 'horrors repelled'
      }
    ];

    for (let i = 0; i < cardsData.length; i++) {
      const c = cardsData[i];
      const cx = eulogyBoxX + i * (cardW + 12);

      ctx.fillStyle = 'rgba(10, 16, 28, 0.88)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      this.drawRoundRect(ctx, cx, cardY, cardW, cardH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font = '18px sans-serif';
      ctx.fillText(c.icon, cx + cardW / 2, cardY + 24);

      ctx.font = 'bold 9px "Segoe UI", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(c.label, cx + cardW / 2, cardY + 42);

      ctx.font = 'bold 15px "Segoe UI", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.val, cx + cardW / 2, cardY + 63);

      ctx.font = 'italic 8.5px "Georgia", serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(c.sub, cx + cardW / 2, cardY + 79);
    }

    // 6. "Restart Expedition" Button
    const btn = this.restartBtnRect;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);

    ctx.beginPath();
    this.drawRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);

    ctx.fillStyle = this.isRestartBtnHovered ? '#b91c1c' : '#991b1b'; // Crimson button
    ctx.fill();

    ctx.strokeStyle = this.isRestartBtnHovered
      ? `rgba(254, 202, 202, ${0.8 + pulse * 0.2})`
      : '#f87171';
    ctx.lineWidth = this.isRestartBtnHovered ? 2.5 : 1.5;
    ctx.shadowColor = this.isRestartBtnHovered ? '#ef4444' : 'transparent';
    ctx.shadowBlur = this.isRestartBtnHovered ? 12 : 0;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.font = 'bold 14px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Restart Expedition', btn.x + btn.w / 2, btn.y + 30);

    // 7. Footer Prompt
    ctx.font = 'italic 10px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('[ Press SPACE or ENTER to Awaken at Safe Harbor ]', modalX + modalW / 2, btn.y + btn.h + 24);

    ctx.restore();
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number = 4
  ): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
  }
}
