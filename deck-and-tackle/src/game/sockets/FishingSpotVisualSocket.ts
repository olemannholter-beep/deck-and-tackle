import { VisualSocket } from '../../engine/VisualSocket';

export interface FishingSpotRenderData {
  time: number;
  isPlayerNearby: boolean;
  zoneType: 'shallow' | 'lake' | 'abyss';
  spotRadius: number;
}

export class FishingSpotVisualSocket extends VisualSocket<FishingSpotRenderData> {
  constructor() {
    super('fishing_spot_visual_socket');
  }

  protected renderPlaceholder(ctx: CanvasRenderingContext2D, data: FishingSpotRenderData): void {
    const t = data ? data.time : 0;
    const isNearby = data ? data.isPlayerNearby : false;
    const radius = data ? data.spotRadius : 65;

    // Palette: Pale cyan-green eldritch bioluminescence (#2dd4bf / #5eead4)
    const primaryCyan = 'rgba(45, 212, 191,'; // #2dd4bf
    const highlightTeal = 'rgba(94, 234, 212,'; // #5eead4
    const deepGlow = 'rgba(13, 58, 51,';

    ctx.save();

    // 1. Soft Sub-Surface Bioluminescent Water Bloom
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.5);
    const bloomGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, radius * 0.95);
    bloomGrad.addColorStop(0, `${primaryCyan} ${0.35 + pulse * 0.2})`);
    bloomGrad.addColorStop(0.45, `${deepGlow} 0.22)`);
    bloomGrad.addColorStop(1, 'rgba(4, 9, 20, 0)');
    ctx.fillStyle = bloomGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // 2. Lurking Underwater Beast Silhouette circling deep in the vortex
    ctx.save();
    const beastAngle = t * 1.35;
    const beastOrbitX = Math.cos(beastAngle) * (radius * 0.42);
    const beastOrbitY = Math.sin(beastAngle) * (radius * 0.28);
    ctx.translate(beastOrbitX, beastOrbitY);
    ctx.rotate(beastAngle + Math.PI / 2);

    ctx.fillStyle = 'rgba(2, 6, 12, 0.72)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Faint glowing eye on beast
    ctx.fillStyle = '#5eead4';
    ctx.beginPath();
    ctx.arc(-8, -2, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Writhing tail fin
    const tailWiggle = Math.sin(t * 9) * 4;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(-24, -6 + tailWiggle);
    ctx.lineTo(-21, 0);
    ctx.lineTo(-25, 6 + tailWiggle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Continuous Inward Swirling Eldritch Vortex / Whirlpool
    ctx.save();
    ctx.rotate(-t * 2.2); // Smooth counter-clockwise inward swirl
    ctx.lineWidth = 1.8;

    // 4 Intertwined Inward Spiraling Vortex Arms
    const arms = 4;
    for (let a = 0; a < arms; a++) {
      const armOffset = (a * Math.PI * 2) / arms;
      ctx.strokeStyle = a % 2 === 0
        ? `${highlightTeal} ${0.65 + pulse * 0.3})`
        : `${primaryCyan} 0.45)`;
      ctx.beginPath();

      for (let theta = 0; theta < Math.PI * 2.5; theta += 0.15) {
        const r = (radius * 0.85) * Math.pow(1 - theta / (Math.PI * 2.5), 1.2);
        const curAngle = theta + armOffset;
        const sx = Math.cos(curAngle) * r;
        const sy = Math.sin(curAngle) * (r * 0.75); // Elliptical isometric tilt

        if (theta === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 4. Abyss Core Void Eye (Pitch black sinkhole drawing light downward)
    const voidGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
    voidGrad.addColorStop(0, '#010307');
    voidGrad.addColorStop(0.7, '#02070e');
    voidGrad.addColorStop(1, 'rgba(4, 15, 24, 0)');
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Center rotating void froth ring
    ctx.strokeStyle = `${highlightTeal} 0.55)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 + Math.sin(t * 6) * 1.5, 3 + Math.sin(t * 6) * 1.0, -t * 3, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Pulsing Concentric Phosphorescent Ripple Rings
    const numRipples = 3;
    for (let i = 0; i < numRipples; i++) {
      const rawProgress = (t * 0.65 + i / numRipples) % 1;
      const progress = (rawProgress + 1) % 1;
      const r = 8 + progress * (radius * 0.85);
      const alpha = Math.max(0, (1 - progress) * 0.7);

      ctx.strokeStyle = `${primaryCyan} ${alpha})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 6. Rising Glowing Motes & Spores bubbling from the vortex eye
    for (let m = 0; m < 9; m++) {
      const mPhase = (t * 1.5 + m * 0.7) % 1;
      const mAngle = m * 2.39 + t * 0.8;
      const mDist = 6 + mPhase * (radius * 0.65);
      const mx = Math.cos(mAngle) * mDist;
      const my = Math.sin(mAngle) * (mDist * 0.75) - mPhase * 18;
      const mAlpha = Math.sin(mPhase * Math.PI) * 0.85;
      const mSize = 1.2 + (1 - mPhase) * 2.2;

      ctx.fillStyle = `${highlightTeal} ${mAlpha})`;
      ctx.shadowColor = '#5eead4';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(mx, my, mSize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // 7. Occult Interaction Glyphs & Rune Ring when Player is Nearby
    if (isNearby) {
      const ringPulse = 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = `${highlightTeal} ${0.5 + ringPulse * 0.45})`;
      ctx.shadowColor = '#5eead4';
      ctx.shadowBlur = 10 * ringPulse;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([12, 8, 4, 8]);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Small glowing rune ticks along perimeter
      for (let k = 0; k < 8; k++) {
        const rAng = (k / 8) * Math.PI * 2 + t * 0.3;
        const rx = Math.cos(rAng) * (radius + 5);
        const ry = Math.sin(rAng) * (radius * 0.75 + 4);
        ctx.fillStyle = '#5eead4';
        ctx.beginPath();
        ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
