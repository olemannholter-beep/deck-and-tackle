import { Boat } from '../overworld/Boat';
import { OverworldMap } from '../overworld/OverworldMap';
import { FishingSpot } from '../overworld/FishingSpot';
import { AudioManager } from '../../engine/AudioManager';
import { Input } from '../../engine/Input';
import { AtmosphereManager } from '../overworld/AtmosphereManager';

export interface CompassBearing {
  angle: number;       // radians pointing from vessel toward harbor
  bearingStr: string;  // 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', or 'ANCHOR'
  distance: number;    // Euclidean distance in meters
  isDocked: boolean;   // true if distance < 10
}

/**
 * Calculates Euclidean angle and 8-wind bearing from vessel position toward harbor (4000, 4000).
 */
export function calculateCompassBearing(
  fromX: number,
  fromY: number,
  harborX: number = 4000,
  harborY: number = 4000
): CompassBearing {
  const dx = harborX - fromX;
  const dy = harborY - fromY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 10) {
    return { angle: 0, bearingStr: 'ANCHOR', distance: 0, isDocked: true };
  }

  const angle = Math.atan2(dy, dx);
  let deg = (angle * 180 / Math.PI) + 90;
  if (deg < 0) deg += 360;
  if (deg >= 360) deg -= 360;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(deg / 45) % 8;
  return { angle, bearingStr: directions[index], distance, isDocked: false };
}

/**
 * Formats metric distance in meters with comma grouping: e.g. 1450 -> "1,450m".
 */
export function formatMetricDistance(meters: number): string {
  const rounded = Math.round(meters);
  return `${rounded.toLocaleString('en-US')}m`;
}

export class HUD {
  public static calculateCompassBearing = calculateCompassBearing;
  public static formatMetricDistance = formatMetricDistance;

  private time: number = 0;
  public onToggleChart?: () => void;

  private chartButtonBounds = { x: 0, y: 0, w: 140, h: 22, hovered: false };

  public update(dt: number): void {
    this.time += dt;

    // Check click on HUD chart button
    const mouse = Input.getMousePosition();
    this.chartButtonBounds.hovered = (
      mouse.x >= this.chartButtonBounds.x &&
      mouse.x <= this.chartButtonBounds.x + this.chartButtonBounds.w &&
      mouse.y >= this.chartButtonBounds.y &&
      mouse.y <= this.chartButtonBounds.y + this.chartButtonBounds.h
    );

    if (this.chartButtonBounds.hovered) {
      Input.setCursor('pointer');
      if (Input.isMouseClicked()) {
        AudioManager.getInstance().playButtonClick();
        this.onToggleChart?.();
      }
    }
  }

  public renderOverworld(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    boat: Boat,
    map: OverworldMap,
    nearbySpot: FishingSpot | null,
    isNearDock: boolean,
    playerGold: number = 25,
    playerDeckCount: number = 7
  ): void {
    ctx.save();

    // 1. Vessel Position & Overworld Telemetry Badge (Top-Left)
    const badgeX = 20;
    const badgeY = 20;
    const badgeW = 260;
    const badgeH = 54;

    ctx.fillStyle = 'rgba(10, 25, 40, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    this.drawRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚓ HMS ANGLER • OVERWORLD', badgeX + 16, badgeY + 10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`Coordinates: ${Math.round(boat.position.x)}, ${Math.round(boat.position.y)}`, badgeX + 16, badgeY + 32);

    // 2. Player Wallet & Deck Count Badge (Top Center-Left)
    const walletX = 295;
    const walletY = 20;
    const walletW = 220;
    const walletH = 54;

    ctx.fillStyle = 'rgba(10, 25, 40, 0.85)';
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.drawRoundRect(ctx, walletX, walletY, walletW, walletH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${playerGold} Gold`, walletX + 16, walletY + 10);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`🎴 Deck: ${playerDeckCount} Cards`, walletX + 16, walletY + 32);

    // 3. Brass Compass Rose, Live Distance Meter & Zone Badge (Top-Center)
    this.renderBrassCompassRose(ctx, width, boat, map);

    // 4. Boat Speedometer & Nautical Heading (Bottom-Left)
    const speed = boat.velocity.magnitude();
    const knots = (speed * 0.1).toFixed(1);
    const speedX = 20;
    const speedY = height - 90;
    const speedW = 190;
    const speedH = 70;

    ctx.fillStyle = 'rgba(10, 25, 40, 0.85)';
    ctx.strokeStyle = '#457b9d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.drawRoundRect(ctx, speedX, speedY, speedW, speedH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a8dadc';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText('VESSEL TELEMETRY', speedX + 14, speedY + 12);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", monospace';
    ctx.fillText(`${knots} KTS`, speedX + 14, speedY + 30);

    // Speed bar indicator
    const maxBarW = 100;
    const currentBarW = Math.min(1.0, speed / boat.maxSpeed) * maxBarW;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(speedX + 14, speedY + 54, maxBarW, 6);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(speedX + 14, speedY + 54, currentBarW, 6);

    // Heading dial
    const dialX = speedX + 150;
    const dialY = speedY + 35;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dialX, dialY, 18, 0, Math.PI * 2);
    ctx.stroke();

    const needleEndX = dialX + Math.cos(boat.heading) * 14;
    const needleEndY = dialY + Math.sin(boat.heading) * 14;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(needleEndX, needleEndY);
    ctx.stroke();

    // 5. Floating Context Interaction Prompt (Center Bottom)
    if (nearbySpot) {
      const promptW = 480;
      const promptH = 58;
      const promptX = (width - promptW) / 2;
      const promptY = height - 100;

      const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
      ctx.fillStyle = 'rgba(7, 18, 29, 0.95)';
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.7 + pulse * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      this.drawRoundRect(ctx, promptX, promptY, promptW, promptH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 15px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`🎣 PRESS [E] OR [SPACE] TO CAST INTO THE DEEP`, width / 2, promptY + 10);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillText(`${nearbySpot.name} — ${nearbySpot.description}`, width / 2, promptY + 34);
    } else if (isNearDock) {
      const promptW = 480;
      const promptH = 58;
      const promptX = (width - promptW) / 2;
      const promptY = height - 100;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      this.drawRoundRect(ctx, promptX, promptY, promptW, promptH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`⚓ PRESS [E] OR [SPACE] TO ENTER MARSH & SONS`, width / 2, promptY + 10);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px "Segoe UI", sans-serif';
      ctx.fillText(`Innsmouth Wharves: Acquire esoteric technique cards & inspect deck`, width / 2, promptY + 34);
    }

    // 6. Controls Helper (Top-Right)
    const guideW = 230;
    const guideH = 138;
    const guideX = width - guideW - 20;
    const guideY = 20;

    ctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.drawRoundRect(ctx, guideX, guideY, guideW, guideH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CONTROLS', guideX + 14, guideY + 10);

    const isAudioMuted = AudioManager.getInstance().isMusicMuted || AudioManager.getInstance().isMuted;
    ctx.fillStyle = isAudioMuted ? '#f87171' : '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(isAudioMuted ? '🔇 [U] MUTED' : '🔊 [U] AUDIO ON', guideX + guideW - 14, guideY + 10);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('[W / S] Throttle / Reverse', guideX + 14, guideY + 30);
    ctx.fillText('[A / D] Steer Rudder', guideX + 14, guideY + 50);
    ctx.fillText('[E / Space] Cast Line / Dock', guideX + 14, guideY + 70);
    ctx.fillText('[M / Tab] Toggle Sea Chart', guideX + 14, guideY + 90);
    ctx.fillText('[U] Mute / Unmute Audio', guideX + 14, guideY + 110);

    ctx.restore();
  }

  /**
   * Renders the Brass Compass Rose, metric live distance meter, and zone badge at Top-Center.
   */
  private renderBrassCompassRose(
    ctx: CanvasRenderingContext2D,
    width: number,
    boat: Boat,
    map: OverworldMap
  ): void {
    const cx = Math.floor(width / 2);
    const cy = 48;
    const radius = 36;

    // Calculate Bearing and Distance to Central Safe Harbor (4000, 4000)
    const bearing = calculateCompassBearing(boat.position.x, boat.position.y, 4000, 4000);
    const dist = bearing.distance;

    ctx.save();

    // 1. Compass Rose Drop Shadow & Soft Backglow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // 2. Dual Brass Rings with Metallic Gradient
    const brassGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    brassGrad.addColorStop(0.0, '#451a03');
    brassGrad.addColorStop(0.2, '#b45309');
    brassGrad.addColorStop(0.4, '#fef08a');
    brassGrad.addColorStop(0.6, '#d97706');
    brassGrad.addColorStop(0.8, '#78350f');
    brassGrad.addColorStop(1.0, '#451a03');

    // Outer brass bezel
    ctx.fillStyle = brassGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Engraved rivets around perimeter
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const rx = cx + Math.cos(angle) * (radius - 2.5);
      const ry = cy + Math.sin(angle) * (radius - 2.5);
      ctx.beginPath();
      ctx.arc(rx, ry, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Inner brass ridge ring
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4.5, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Dial Face (Midnight Navy)
    const dialRadius = radius - 5.5;
    const dialGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, dialRadius);
    dialGrad.addColorStop(0.0, '#040d1a');
    dialGrad.addColorStop(0.7, '#071526');
    dialGrad.addColorStop(1.0, '#0a1d33');

    ctx.fillStyle = dialGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, dialRadius, 0, Math.PI * 2);
    ctx.fill();

    // Cardinal and Intercardinal tick marks
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const isMajor = i % 2 === 0;
      const r1 = dialRadius - (isMajor ? 6 : 3.5);
      const r2 = dialRadius - 1;

      ctx.strokeStyle = isMajor ? '#fde047' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    // Cardinal labels: N, E, S, W
    ctx.font = 'bold 8px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.fillText('N', cx, cy - dialRadius + 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('S', cx, cy + dialRadius - 8);
    ctx.fillText('E', cx + dialRadius - 8, cy);
    ctx.fillText('W', cx - dialRadius + 8, cy);

    // 4. Rotating Needle Pointing Directly Toward Central Safe Harbor
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bearing.angle);

    // North / Harbor Pointer (+X in rotated coordinate frame)
    const needleLength = dialRadius - 4;
    const needleBaseHalf = 3.2;

    // Top facet: bright crimson enamel
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -needleBaseHalf);
    ctx.lineTo(needleLength, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Bottom facet: deep shaded crimson / polished brass
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(needleLength, 0);
    ctx.lineTo(0, needleBaseHalf);
    ctx.closePath();
    ctx.fill();

    // Needle edge line
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -needleBaseHalf);
    ctx.lineTo(needleLength, 0);
    ctx.lineTo(0, needleBaseHalf);
    ctx.stroke();

    // South Counterweight (-X in rotated frame)
    const counterLen = 14;
    const counterHalf = 2.6;

    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(0, -counterHalf);
    ctx.lineTo(-counterLen, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-counterLen, 0);
    ctx.lineTo(0, counterHalf);
    ctx.closePath();
    ctx.fill();

    // Gemstone Pivot Collar & Teal Jewel Cabochon
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2dd4bf'; // Glowing teal gemstone
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff'; // Specular gleam
    ctx.beginPath();
    ctx.arc(-0.8, -0.8, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Restore needle transform

    // 5. Live Metric Distance Meter Plaque (Mounted Below Compass Rose)
    const meterW = 210;
    const meterH = 22;
    const meterX = cx - meterW / 2;
    const meterY = cy + radius + 8;

    let distanceText: string;
    if (dist <= 350 || bearing.isDocked) {
      distanceText = `⚓ Harbor: ${Math.round(dist)}m [SAFE HARBOR]`;
    } else {
      distanceText = `⚓ Harbor: ${formatMetricDistance(dist)} [${bearing.bearingStr}]`;
    }

    ctx.fillStyle = 'rgba(7, 18, 29, 0.92)';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, meterX, meterY, meterW, meterH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = dist <= 350 ? '#34d399' : '#fde047';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(distanceText, cx, meterY + meterH / 2);

    // 6. Current Radial Zone Badge (Mounted Below Distance Plaque)
    const zoneW = 210;
    const zoneH = 22;
    const zoneX = cx - zoneW / 2;
    const zoneY = meterY + meterH + 4;
    const currentZone = map.getZoneAt(boat.position);
    const zoneName = map.getZoneDisplayName(currentZone);
    const zoneTier = AtmosphereManager.getZoneIndex(dist);

    let zoneBorderColor = '#10b981';
    let zoneIcon = '🌿';

    if (zoneTier === 2) {
      zoneBorderColor = '#2dd4bf';
      zoneIcon = '🌫️';
    } else if (zoneTier === 3) {
      zoneBorderColor = '#38bdf8';
      zoneIcon = '⛈️';
    } else if (zoneTier === 4) {
      zoneBorderColor = '#c084fc';
      zoneIcon = '👁️';
    }

    ctx.fillStyle = 'rgba(10, 20, 30, 0.92)';
    ctx.strokeStyle = zoneBorderColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, zoneX, zoneY, zoneW, zoneH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = zoneBorderColor;
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${zoneIcon} ${zoneName.toUpperCase()}`, cx, zoneY + zoneH / 2);

    // 7. Clickable Sea Chart Button Plaque (Below Zone Badge)
    this.chartButtonBounds.w = 140;
    this.chartButtonBounds.h = 22;
    this.chartButtonBounds.x = cx - this.chartButtonBounds.w / 2;
    this.chartButtonBounds.y = zoneY + zoneH + 5;

    const btnHovered = this.chartButtonBounds.hovered;
    ctx.fillStyle = btnHovered ? 'rgba(30, 58, 88, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = btnHovered ? '#38bdf8' : '#64748b';
    ctx.lineWidth = btnHovered ? 1.5 : 1.0;
    ctx.beginPath();
    this.drawRoundRect(
      ctx,
      this.chartButtonBounds.x,
      this.chartButtonBounds.y,
      this.chartButtonBounds.w,
      this.chartButtonBounds.h,
      5
    );
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = btnHovered ? '#38bdf8' : '#cbd5e1';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗺️ SEA CHART [M]', cx, this.chartButtonBounds.y + this.chartButtonBounds.h / 2);

    ctx.restore();
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, w, h, r);
    } else if (typeof ctx.rect === 'function') {
      ctx.rect(x, y, w, h);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    }
  }
}
