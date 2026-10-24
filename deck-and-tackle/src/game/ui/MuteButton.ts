import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';

export class MuteButton {
  public x: number = 20;
  public y: number = 82;
  public w: number = 38;
  public h: number = 38;

  private isHovered: boolean = false;
  private hoverProgress: number = 0; // 0.0 to 1.0 smooth interpolation
  private clickFlashTimer: number = 0;

  /**
   * Updates hover state, processes click, and checks keyboard shortcut [M]
   * Returns true if a click on the button occurred.
   */
  public update(dt: number): boolean {
    const mouse = Input.getMousePosition();
    this.isHovered = (
      mouse.x >= this.x &&
      mouse.x <= this.x + this.w &&
      mouse.y >= this.y &&
      mouse.y <= this.y + this.h
    );

    // Smooth hover interpolation
    const targetHover = this.isHovered ? 1.0 : 0.0;
    this.hoverProgress += (targetHover - this.hoverProgress) * Math.min(1.0, dt * 12);

    if (this.clickFlashTimer > 0) {
      this.clickFlashTimer = Math.max(0, this.clickFlashTimer - dt * 4);
    }

    let consumedClick = false;

    // Click handler
    if (this.isHovered && Input.isMouseClicked()) {
      AudioManager.getInstance().playButtonClick();
      AudioManager.getInstance().toggleMusicMute();
      this.clickFlashTimer = 1.0;
      consumedClick = true;
    }

    // Keyboard shortcut [M]
    if (Input.isJustPressed('keym')) {
      AudioManager.getInstance().playButtonClick();
      AudioManager.getInstance().toggleMusicMute();
      this.clickFlashTimer = 1.0;
    }

    if (this.isHovered) {
      Input.setCursor('pointer');
    }

    return consumedClick;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    const isMuted = AudioManager.getInstance().isMusicMuted || AudioManager.getInstance().isMuted;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    // 1. Button Background & Glow
    const bgAlpha = 0.85 + this.hoverProgress * 0.12;
    ctx.fillStyle = `rgba(10, 25, 40, ${bgAlpha})`;
    
    const borderColor = isMuted 
      ? (this.isHovered ? '#f87171' : '#ef4444')
      : (this.isHovered ? '#67e8f9' : '#38bdf8');
    
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.8 + this.hoverProgress * 0.6;

    if (this.hoverProgress > 0.05) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 8 * this.hoverProgress;
    }

    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.w, this.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Click flash
    if (this.clickFlashTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.clickFlashTimer * 0.35})`;
      ctx.beginPath();
      ctx.roundRect(this.x, this.y, this.w, this.h, 8);
      ctx.fill();
    }

    // 2. Speaker Vector Icon
    const iconColor = isMuted ? '#fca5a5' : (this.isHovered ? '#ffffff' : '#38bdf8');
    ctx.fillStyle = iconColor;
    ctx.strokeStyle = iconColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Left base rectangle of speaker
    const baseW = 4;
    const baseH = 8;
    const baseX = cx - 8;
    const baseY = cy - baseH / 2;
    ctx.fillRect(baseX, baseY, baseW, baseH);

    // Trapezoid cone
    ctx.beginPath();
    ctx.moveTo(baseX + baseW, baseY);
    ctx.lineTo(cx, cy - 8);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(baseX + baseW, baseY + baseH);
    ctx.closePath();
    ctx.fill();

    if (!isMuted) {
      // Sound waves
      // Inner arc
      ctx.beginPath();
      ctx.arc(cx - 1, cy, 6, -Math.PI * 0.32, Math.PI * 0.32);
      ctx.stroke();

      // Outer arc
      ctx.beginPath();
      ctx.arc(cx - 1, cy, 10, -Math.PI * 0.32, Math.PI * 0.32);
      ctx.stroke();
    } else {
      // Red strike-through slash for muted state
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy - 10);
      ctx.lineTo(cx + 10, cy + 10);
      ctx.stroke();
    }

    // 3. Hover Tooltip Pill
    if (this.hoverProgress > 0.05) {
      ctx.globalAlpha = this.hoverProgress;
      const tipX = this.x + this.w + 10;
      const tipY = this.y + (this.h - 28) / 2;
      const tipText = isMuted ? '🔇 Music: MUTED [M]' : '🎵 Music: ON [M]';
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      const textWidth = ctx.measureText(tipText).width;
      const tipW = textWidth + 20;
      const tipH = 28;

      ctx.fillStyle = 'rgba(10, 25, 40, 0.95)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 6);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = isMuted ? '#fca5a5' : '#e0f2fe';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(tipText, tipX + 10, tipY + tipH / 2);
    }

    ctx.restore();
  }
}
