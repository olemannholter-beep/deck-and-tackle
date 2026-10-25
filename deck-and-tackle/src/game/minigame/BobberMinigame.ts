import { Vector2 } from '../../engine/Vector2';
import { Input } from '../../engine/Input';
import type { WaterZoneType } from '../overworld/FishingSpot';
import { AudioManager } from '../../engine/AudioManager';
import type { SpeciesType } from '../battle/FishData';

export type BobberPhase = 'power_charge' | 'casting' | 'waiting' | 'nibble' | 'bite' | 'hooked' | 'missed';

export interface BobberConfig {
  zoneType: WaterZoneType;
  speciesType: SpeciesType;
  onHookedSuccess: () => void;
}

export class BobberMinigame {
  public phase: BobberPhase = 'power_charge';
  public zoneType: WaterZoneType;
  public speciesType: SpeciesType;
  public onHookedSuccess: () => void;

  // Animation & timing
  private time: number = 0;
  private stateTimer: number = 0;

  // Power throw parameters
  public powerOscillation: number = 0; // 0 to 1
  public lockedPower: number = 0; // Locked-in cast power
  public powerRating: string = '';

  // Cast trajectory
  private castProgress: number = 0; // 0 to 1
  public bobberPos: Vector2 = new Vector2(0, 0);
  private bobberTargetX: number = 0;

  // Nibble and bite parameters
  private nibbleCount: number = 0;
  private targetNibbles: number = 2;
  private nextEventTime: number = 2.0;

  // Bite timing window
  public biteWindowDuration: number = 1.3; // seconds to react
  public biteTimer: number = 0;

  // Visual feedback
  public feedbackText: string = '⚡ POWER THROW: Press [SPACE / E / CLICK] to launch!';
  public feedbackColor: string = '#fde047';
  private ripples: { x: number; y: number; r: number; alpha: number }[] = [];

  constructor(config: BobberConfig) {
    this.zoneType = config.zoneType;
    this.speciesType = config.speciesType;
    this.onHookedSuccess = config.onHookedSuccess;
    this.reset();
  }

  public reset(): void {
    this.phase = 'power_charge';
    this.time = 0;
    this.stateTimer = 0;
    this.powerOscillation = 0;
    this.lockedPower = 0;
    this.powerRating = '';
    this.castProgress = 0;
    this.nibbleCount = 0;
    this.targetNibbles = 1 + Math.floor(Math.random() * 2);
    this.nextEventTime = 1.5 + Math.random() * 1.5;
    this.biteTimer = 0;
    this.feedbackText = '⚡ POWER THROW: Press [SPACE / E / CLICK] to launch!';
    this.feedbackColor = '#fde047';
    this.ripples = [];
  }

  public update(dt: number, width: number, waterLevelY: number): void {
    this.time += dt;
    this.stateTimer += dt;

    // Update water ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.r += dt * 30;
      r.alpha -= dt * 0.8;
      if (r.alpha <= 0) {
        this.ripples.splice(i, 1);
      }
    }

    const actionTriggered =
      Input.isJustPressed('space') ||
      Input.isJustPressed('keye') ||
      Input.isMouseClicked();

    // State machine
    switch (this.phase) {
      case 'power_charge': {
        // Needle bounces smoothly between 0 and 1
        const speed = 3.6;
        this.powerOscillation = 0.5 + 0.5 * Math.sin(this.time * speed);

        // Position bobber at rod tip while aiming
        const rodTipX = width * 0.20 + 64;
        const rodTipY = waterLevelY - 36;
        this.bobberPos.set(rodTipX + 4, rodTipY + 8);

        // When player triggers action: lock in power and launch cast!
        if (actionTriggered) {
          this.lockedPower = this.powerOscillation;
          const pct = Math.round(this.lockedPower * 100);

          if (this.lockedPower >= 0.75 && this.lockedPower <= 0.94) {
            this.powerRating = `✨ PERFECT CAST! (${pct}% Power)`;
            this.feedbackColor = '#38bdf8';
            this.nextEventTime = 1.0; // Bites faster on perfect cast!
          } else if (this.lockedPower >= 0.50) {
            this.powerRating = `🎯 GREAT CAST! (${pct}% Power)`;
            this.feedbackColor = '#4ade80';
            this.nextEventTime = 1.6;
          } else {
            this.powerRating = `🎣 SHORT CAST (${pct}% Power)`;
            this.feedbackColor = '#f59e0b';
            this.nextEventTime = 2.2;
          }

          this.feedbackText = this.powerRating;
          // Target landing X scales with cast power (from 42% of screen to 78%)
          this.bobberTargetX = width * (0.40 + this.lockedPower * 0.38);

          this.phase = 'casting';
          this.stateTimer = 0;
          this.castProgress = 0;
          AudioManager.getInstance().playCastWhoosh();
        }
        break;
      }

      case 'casting': {
        const castDuration = 0.65;
        this.castProgress = Math.min(1.0, this.stateTimer / castDuration);

        // Parabolic arc for soaring bobber
        const startX = width * 0.20 + 64;
        const startY = waterLevelY - 36;
        const currentX = startX + (this.bobberTargetX - startX) * this.castProgress;
        const arcHeight = 110 * Math.max(0.6, this.lockedPower);
        const arcY = Math.sin(this.castProgress * Math.PI) * arcHeight;
        const currentY = startY + (waterLevelY - startY) * this.castProgress - arcY;
        this.bobberPos.set(currentX, currentY);

        if (this.castProgress >= 1.0) {
          this.phase = 'waiting';
          this.stateTimer = 0;
          this.feedbackText = 'Waiting for a bite... Watch the bobber!';
          this.feedbackColor = '#94a3b8';
          this.addRipple(this.bobberPos.x, waterLevelY, 1.5);
          AudioManager.getInstance().playBobberSplash();
        }
        break;
      }

      case 'waiting': {
        // Floating on water surface waves
        const wave = Math.sin(this.bobberPos.x * 0.03 + this.time * 3) * 3;
        this.bobberPos.set(this.bobberTargetX, waterLevelY + wave);

        if (actionTriggered) {
          this.feedbackText = 'Too early! The fish wasn\'t biting yet.';
          this.feedbackColor = '#f87171';
          this.addRipple(this.bobberPos.x, waterLevelY);
        }

        if (this.stateTimer >= this.nextEventTime) {
          if (this.nibbleCount < this.targetNibbles) {
            this.phase = 'nibble';
            this.stateTimer = 0;
            this.nibbleCount++;
            this.feedbackText = 'Nibble! Hold steady...';
            this.feedbackColor = '#fbbf24';
            this.addRipple(this.bobberPos.x, waterLevelY);
            AudioManager.getInstance().playNibbleTwitch();
          } else {
            this.phase = 'bite';
            this.stateTimer = 0;
            this.biteTimer = 0;
            this.feedbackText = '💥 BITE! HOOK IT NOW! [SPACE / E / CLICK]';
            this.feedbackColor = '#ef4444';
            this.addRipple(this.bobberPos.x, waterLevelY, 2.0);
            AudioManager.getInstance().playBiteSplash();
          }
        }
        break;
      }

      case 'nibble': {
        // Bobber dips slightly
        const dip = Math.sin(this.stateTimer * Math.PI * 4) * 6;
        const wave = Math.sin(this.bobberPos.x * 0.03 + this.time * 3) * 3;
        this.bobberPos.set(this.bobberTargetX, waterLevelY + wave + Math.max(0, dip));

        if (actionTriggered) {
          this.feedbackText = 'Too early! It was only a nibble.';
          this.feedbackColor = '#f87171';
          this.phase = 'waiting';
          this.stateTimer = 0;
          this.nextEventTime = 1.2 + Math.random() * 1.0;
        }

        if (this.stateTimer >= 0.6) {
          this.phase = 'waiting';
          this.stateTimer = 0;
          this.nextEventTime = 1.0 + Math.random() * 1.5;
          this.feedbackText = 'Waiting for a bite...';
          this.feedbackColor = '#94a3b8';
        }
        break;
      }

      case 'bite': {
        this.biteTimer += dt;
        // Bobber plunged underwater
        const wave = Math.sin(this.bobberPos.x * 0.03 + this.time * 3) * 3;
        this.bobberPos.set(this.bobberTargetX, waterLevelY + wave + 18 + Math.sin(this.time * 15) * 3);

        if (Math.random() < 0.3) {
          this.addRipple(this.bobberPos.x + (Math.random() - 0.5) * 10, waterLevelY);
        }

        // Successfully hooked!
        if (actionTriggered) {
          this.phase = 'hooked';
          this.stateTimer = 0;
          this.feedbackText = '🎉 HOOKED! BATTLE ENGAGED!';
          this.feedbackColor = '#fde047';
          this.addRipple(this.bobberPos.x, waterLevelY, 2.5);
          AudioManager.getInstance().play('sfx_tension_strike', 0.9);
          return;
        }

        // Missed window
        if (this.biteTimer >= this.biteWindowDuration) {
          this.phase = 'missed';
          this.stateTimer = 0;
          this.feedbackText = 'Too late! The fish took the bait.';
          this.feedbackColor = '#ef4444';
          AudioManager.getInstance().play('sfx_drag_release', 0.7);
        }
        break;
      }

      case 'missed': {
        const wave = Math.sin(this.bobberPos.x * 0.03 + this.time * 3) * 3;
        this.bobberPos.set(this.bobberTargetX, waterLevelY + wave);

        if (this.stateTimer >= 1.2) {
          this.phase = 'waiting';
          this.stateTimer = 0;
          this.nibbleCount = 0;
          this.nextEventTime = 1.5 + Math.random() * 1.5;
          this.feedbackText = 'Waiting for another fish...';
          this.feedbackColor = '#94a3b8';
        }
        break;
      }

      case 'hooked': {
        if (this.stateTimer >= 0.55) {
          this.onHookedSuccess();
        }
        break;
      }
    }
  }

  private addRipple(x: number, y: number, scale: number = 1.0): void {
    this.ripples.push({
      x,
      y,
      r: 4 * scale,
      alpha: 0.8
    });
  }

  public render(ctx: CanvasRenderingContext2D, width: number, waterLevelY: number, rodTip: Vector2): void {
    ctx.save();

    // 1. Fishing Line from rod tip to bobber
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.4;
    const midX = (rodTip.x + this.bobberPos.x) / 2;
    const sag = this.phase === 'casting' ? -35 : (this.phase === 'power_charge' ? 5 : 15);
    const midY = (rodTip.y + this.bobberPos.y) / 2 + sag;
    ctx.beginPath();
    ctx.moveTo(rodTip.x, rodTip.y);
    ctx.quadraticCurveTo(midX, midY, this.bobberPos.x, this.bobberPos.y - 12);
    ctx.stroke();

    // 2. Ripples on water surface
    for (const r of this.ripples) {
      if (r.r <= 0.1 || r.alpha <= 0.01) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, r.alpha)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, Math.max(0.1, r.r), Math.max(0.1, r.r * 0.4), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Underwater Fish Shadow circling under target landing point (Zones 2-4 only; Shoals use animated minnows)
    if (this.zoneType !== 'shallow') {
      const shadowAnchorX = this.phase === 'power_charge' ? width * 0.60 : this.bobberPos.x;
      const fishDistRatio = this.phase === 'casting' || this.phase === 'power_charge' ? 1.0 : Math.max(0, 1 - (this.nibbleCount / (this.targetNibbles + 1)));
      const fishX = shadowAnchorX + Math.sin(this.time * 2) * (25 + fishDistRatio * 45);
      const fishY = waterLevelY + 45 + Math.cos(this.time * 1.5) * 15;

      const isMovingRight = Math.cos(this.time * 2) >= 0;

      ctx.save();
      ctx.translate(fishX, fishY);
      // Shadow is natively drawn with snout at +X (right) and tail at -X (left).
      if (!isMovingRight) {
        ctx.scale(-1, 1);
      }
      ctx.rotate(Math.sin(this.time * 2) * 0.15);
      ctx.fillStyle = 'rgba(10, 30, 45, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(-32, -6);
      ctx.lineTo(-32, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Victorian Cork-and-Quill Bobber Float
    const bx = this.bobberPos.x;
    const by = this.bobberPos.y;

    ctx.save();
    ctx.translate(bx, by);

    // Natural Goose Quill stem
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 12);
    ctx.stroke();

    // Dark dipped quill tip (weathered red)
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(0, -18, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Turned Natural Cork Float body
    ctx.fillStyle = '#b45309'; // Cork amber
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Black painted mid-band
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(-8, -2, 16, 4);

    // Small cork texture pores
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-3, -6, 2, 1.5);
    ctx.fillRect(2, 4, 2, 1.5);

    ctx.restore();

    // Outer rim
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 5. Power Throw Minigame UI (When in 'power_charge' phase)
    if (this.phase === 'power_charge') {
      this.renderPowerMeter(ctx, width, waterLevelY, rodTip);
    }

    // 6. Bite Timing Ring (Target sweet-spot indicator)
    if (this.phase === 'bite') {
      const reactionProgress = Math.min(1.0, this.biteTimer / this.biteWindowDuration);
      const ringRadius = 50 * (1.0 - reactionProgress) + 12;

      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, by, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(bx, by, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 7. Floating Status & Instructions Banner
    const bannerW = Math.min(540, width - 40);
    const bannerH = 46;
    const bannerX = (width - bannerW) / 2;
    const bannerY = waterLevelY - 85;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = this.feedbackColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.feedbackColor;
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.feedbackText, width / 2, bannerY + bannerH / 2);

    ctx.restore();
  }

  private renderPowerMeter(ctx: CanvasRenderingContext2D, _width: number, waterLevelY: number, rodTip: Vector2): void {
    ctx.save();

    // Power gauge centered above the rod tip
    const meterW = 200;
    const meterH = 22;
    const meterX = rodTip.x + 30;
    const meterY = waterLevelY - 140;

    // Victorian Brass Manometer Gauge container
    ctx.fillStyle = 'rgba(8, 12, 18, 0.95)';
    ctx.strokeStyle = '#b45309'; // Antique brass
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(meterX - 12, meterY - 26, meterW + 24, meterH + 48, 4);
    ctx.fill();
    ctx.stroke();

    // Victorian Brass Screws
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(meterX - 6, meterY - 20, 2, 0, Math.PI * 2);
    ctx.arc(meterX + meterW + 6, meterY - 20, 2, 0, Math.PI * 2);
    ctx.arc(meterX - 6, meterY + meterH + 16, 2, 0, Math.PI * 2);
    ctx.arc(meterX + meterW + 6, meterY + meterH + 16, 2, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 11px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚓ CAST TRAJECTORY & FORCE', meterX + meterW / 2, meterY - 10);

    // Meter background bar with gradient zones (Muted Victorian Tones)
    const barGrad = ctx.createLinearGradient(meterX, 0, meterX + meterW, 0);
    barGrad.addColorStop(0, '#b45309');
    barGrad.addColorStop(0.5, '#4d7c0f');
    barGrad.addColorStop(0.75, '#15803d');
    barGrad.addColorStop(0.85, '#0d9488');
    barGrad.addColorStop(0.92, '#ca8a04');
    barGrad.addColorStop(1.0, '#991b1b');

    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.roundRect(meterX, meterY, meterW, meterH, 3);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sweet Spot Target Box (75% to 92%)
    const sweetX = meterX + meterW * 0.75;
    const sweetW = meterW * 0.17;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.strokeRect(sweetX, meterY - 2, sweetW, meterH + 4);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9px "Georgia", serif';
    ctx.fillText('OPTIMAL', sweetX + sweetW / 2, meterY + meterH + 13);

    // Oscillating Needle Indicator (Victorian Brass Pointer)
    const needleX = meterX + meterW * this.powerOscillation;
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Needle diamond
    ctx.moveTo(needleX, meterY - 6);
    ctx.lineTo(needleX + 5, meterY + meterH / 2);
    ctx.lineTo(needleX, meterY + meterH + 6);
    ctx.lineTo(needleX - 5, meterY + meterH / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.stroke();

    ctx.restore();
  }
}
