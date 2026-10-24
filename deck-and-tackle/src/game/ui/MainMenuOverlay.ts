import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';

export interface MainMenuOverlayOptions {
  onStartGame: () => void;
}

interface MenuSpore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  maxAlpha: number;
  life: number;
  maxLife: number;
}

export class MainMenuOverlay {
  private video: HTMLVideoElement;
  private isVideoReady: boolean = false;
  private isHovered: boolean = false;
  private hoverProgress: number = 0; // 0.0 to 1.0 smooth interpolation
  private clickFlashTimer: number = 0; // Flash animation on click
  private isStarting: boolean = false;
  private onStartGame: () => void;

  // Normalized plaque button coordinates (derived from 3840x2160 video frame)
  private readonly normBtnX: number = 0.363;
  private readonly normBtnY: number = 0.729;
  private readonly normBtnW: number = 0.273;
  private readonly normBtnH: number = 0.181;

  // Computed layout in screen space
  private layout = {
    destX: 0,
    destY: 0,
    destW: 0,
    destH: 0,
    btnX: 0,
    btnY: 0,
    btnW: 0,
    btnH: 0
  };

  // Drifting eldritch motes around the plaque
  private motes: MenuSpore[] = [];
  private animTimer: number = 0;

  constructor(options: MainMenuOverlayOptions) {
    this.onStartGame = options.onStartGame;

    // Create and configure video element
    this.video = document.createElement('video');
    this.video.src = '/video/main_menu.mp4';
    this.video.autoplay = true;
    this.video.loop = true;
    this.video.muted = true; // Required by browsers for immediate autoplay
    this.video.playsInline = true;
    this.video.preload = 'auto';

    // Off-screen styling so browser processes decoding
    this.video.style.position = 'fixed';
    this.video.style.top = '-9999px';
    this.video.style.left = '-9999px';
    this.video.style.opacity = '0';
    this.video.style.pointerEvents = 'none';
    this.video.style.width = '1px';
    this.video.style.height = '1px';
    document.body.appendChild(this.video);

    this.video.addEventListener('canplay', () => {
      this.isVideoReady = true;
    });

    this.video.addEventListener('loadeddata', () => {
      this.isVideoReady = true;
    });

    // Start video playback
    this.video.play().catch(() => {
      // If blocked, wait for user interaction
      const playOnGesture = () => {
        this.video.play().catch(() => {});
        window.removeEventListener('click', playOnGesture);
        window.removeEventListener('keydown', playOnGesture);
      };
      window.addEventListener('click', playOnGesture, { once: true });
      window.addEventListener('keydown', playOnGesture, { once: true });
    });

    // Initialize floating motes
    this.initMotes();
  }

  private initMotes(): void {
    this.motes = [];
    for (let i = 0; i < 20; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.15 - Math.random() * 0.25,
        radius: 1.5 + Math.random() * 2.5,
        alpha: 0,
        maxAlpha: 0.3 + Math.random() * 0.45,
        life: Math.random() * 3,
        maxLife: 2.5 + Math.random() * 2.5
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    this.animTimer += dt;

    // 1. Calculate aspect-cover destination rectangle
    const videoAspect = 3840 / 2160;
    const screenAspect = width / height;

    let destW: number;
    let destH: number;
    let destX: number;
    let destY: number;

    if (screenAspect > videoAspect) {
      destW = width;
      destH = width / videoAspect;
      destX = 0;
      destY = (height - destH) / 2;
    } else {
      destH = height;
      destW = height * videoAspect;
      destX = (width - destW) / 2;
      destY = 0;
    }

    // Vertical clamping: Ensure plaque at the bottom is never cut off
    const btnBottomNorm = this.normBtnY + this.normBtnH; // 0.910
    const btnBottomPx = destY + btnBottomNorm * destH;
    if (btnBottomPx > height - 12) {
      destY -= (btnBottomPx - (height - 12));
    }
    const btnTopPx = destY + this.normBtnY * destH;
    if (btnTopPx < 10) {
      destY = 10 - this.normBtnY * destH;
    }

    // Screen-space button bounds
    const btnX = destX + this.normBtnX * destW;
    const btnY = destY + this.normBtnY * destH;
    const btnW = this.normBtnW * destW;
    const btnH = this.normBtnH * destH;

    this.layout = { destX, destY, destW, destH, btnX, btnY, btnW, btnH };

    // 2. Button hover & click hit-testing
    const mouse = Input.getMousePosition();
    const hovered = (
      mouse.x >= btnX &&
      mouse.x <= btnX + btnW &&
      mouse.y >= btnY &&
      mouse.y <= btnY + btnH
    );

    if (hovered !== this.isHovered) {
      this.isHovered = hovered;
      Input.setCursor(this.isHovered ? 'pointer' : 'default');
    }

    // Smooth hover interpolation
    const targetHover = this.isHovered ? 1.0 : 0.0;
    this.hoverProgress += (targetHover - this.hoverProgress) * Math.min(1.0, dt * 10);

    // Click trigger
    if (this.isHovered && Input.isMouseClicked() && !this.isStarting) {
      this.triggerStart();
    }

    // Click flash decay
    if (this.clickFlashTimer > 0) {
      this.clickFlashTimer -= dt * 2.5;
    }

    // Update motes
    for (const m of this.motes) {
      m.life += dt;
      if (m.life >= m.maxLife) {
        m.life = 0;
        m.x = Math.random();
        m.y = 0.8 + Math.random() * 0.2; // Start near bottom of button
        m.vx = (Math.random() - 0.5) * 0.08;
        m.vy = -0.15 - Math.random() * 0.25;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      const progress = m.life / m.maxLife;
      m.alpha = Math.sin(progress * Math.PI) * m.maxAlpha;
    }
  }

  private triggerStart(): void {
    this.isStarting = true;
    this.clickFlashTimer = 1.0;
    Input.setCursor('default');

    // Visceral audio feedback
    AudioManager.getInstance().playButtonClick();

    // Pause video playback
    if (this.video) {
      this.video.pause();
    }

    // Trigger state transition into overworld
    this.onStartGame();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const { destX, destY, destW, destH, btnX, btnY, btnW, btnH } = this.layout;

    // 1. Draw Video Frame (or dark abyssal placeholder if buffering)
    if (this.video && (this.video.readyState >= 2 || this.isVideoReady)) {
      ctx.drawImage(this.video, destX, destY, destW, destH);
    } else {
      // Abyssal background while video warms up
      ctx.fillStyle = '#030710';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.fillStyle = '#2dd4bf';
      ctx.font = '600 16px "Cinzel", "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const pulse = 0.5 + Math.sin(this.animTimer * 4) * 0.3;
      ctx.globalAlpha = pulse;
      ctx.fillText('COMMUNING WITH THE DEPTHS...', width / 2, height / 2);
      ctx.restore();
    }

    // 2. Interactive "DELVE INTO THE DEPTHS" Plaque Glow & Effects
    this.renderButtonFeedback(ctx, btnX, btnY, btnW, btnH);
  }

  private renderButtonFeedback(
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): void {
    const hp = this.hoverProgress;
    const flash = Math.max(0, this.clickFlashTimer);

    if (hp <= 0.01 && flash <= 0.01) {
      // Subtle idle breathing pulse to hint clickability
      const idlePulse = (Math.sin(this.animTimer * 2.2) * 0.5 + 0.5) * 0.18;
      ctx.save();
      ctx.strokeStyle = `rgba(45, 212, 191, ${idlePulse})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);
      ctx.restore();
      return;
    }

    ctx.save();

    // A. Outer Arcane Bioluminescent Aura
    const glowAlpha = (0.25 + Math.sin(this.animTimer * 5.0) * 0.08) * hp + flash * 0.6;
    const glowGrad = ctx.createRadialGradient(
      bx + bw / 2, by + bh / 2, bw * 0.2,
      bx + bw / 2, by + bh / 2, bw * 0.65
    );
    glowGrad.addColorStop(0, `rgba(45, 212, 191, ${Math.min(0.7, glowAlpha * 1.2)})`);
    glowGrad.addColorStop(0.5, `rgba(20, 184, 166, ${Math.min(0.4, glowAlpha * 0.7)})`);
    glowGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.fillStyle = glowGrad;
    ctx.fillRect(bx - 30, by - 30, bw + 60, bh + 60);

    // B. Beveled Stone Plaque Highlight Outline
    const cornerR = Math.min(14, bh * 0.15);
    const borderAlpha = Math.min(1.0, 0.45 * hp + flash * 0.8);
    ctx.strokeStyle = `rgba(94, 234, 212, ${borderAlpha})`;
    ctx.lineWidth = 2.5 + hp * 1.5;
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 12 * hp + flash * 24;

    ctx.beginPath();
    ctx.roundRect(bx + 6, by + 6, bw - 12, bh - 12, cornerR);
    ctx.stroke();

    // C. Internal Plaque Shimmer (Screen blend mode for natural engraved illumination)
    ctx.globalCompositeOperation = 'screen';
    const shimmerAlpha = (0.12 * hp + flash * 0.45);
    const shimmerGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    shimmerGrad.addColorStop(0, `rgba(45, 212, 191, ${shimmerAlpha * 0.4})`);
    shimmerGrad.addColorStop(0.5, `rgba(167, 243, 208, ${shimmerAlpha * 0.8})`);
    shimmerGrad.addColorStop(1, `rgba(45, 212, 191, ${shimmerAlpha * 0.3})`);
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(bx + 10, by + 10, bw - 20, bh - 20);

    // D. Drifting Bioluminescent Spores rising across the button
    ctx.globalCompositeOperation = 'source-over';
    for (const m of this.motes) {
      if (m.alpha <= 0.01) continue;
      const px = bx + m.x * bw;
      const py = by + m.y * bh;
      ctx.fillStyle = `rgba(94, 234, 212, ${m.alpha * hp * 1.2})`;
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, m.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // E. Click Ripple / Shockwave
    if (flash > 0.05) {
      ctx.save();
      const rippleR = (1.0 - flash) * (bw * 0.7);
      ctx.strokeStyle = `rgba(224, 242, 254, ${flash * 0.85})`;
      ctx.lineWidth = 3 * flash;
      ctx.shadowColor = '#5eead4';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(bx + bw / 2, by + bh / 2, rippleR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  public destroy(): void {
    if (this.video) {
      this.video.pause();
      this.video.remove();
    }
  }
}
