import { Boat } from '../overworld/Boat';
import { OverworldMap } from '../overworld/OverworldMap';
import { FishingSpot } from '../overworld/FishingSpot';
import { AudioManager } from '../../engine/AudioManager';

export class HUD {
  private time: number = 0;

  public update(dt: number): void {
    this.time += dt;
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

    // 1. Current Water Depth Zone Badge (Top-Left)
    const currentZone = map.getZoneAt(boat.position);
    const zoneName = map.getZoneDisplayName(currentZone);

    let badgeColor = '#48cae4';
    let zoneIcon = '🌊';
    if (currentZone === 'shallow') {
      badgeColor = '#52b788';
      zoneIcon = '🌿';
    } else if (currentZone === 'abyss') {
      badgeColor = '#9d4edd';
      zoneIcon = '🌌';
    }

    const badgeX = 20;
    const badgeY = 20;
    const badgeW = 260;
    const badgeH = 54;

    ctx.fillStyle = 'rgba(10, 25, 40, 0.85)';
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${zoneIcon} ${zoneName}`, badgeX + 16, badgeY + 10);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Segoe UI", sans-serif';
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
    ctx.roundRect(walletX, walletY, walletW, walletH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`💰 ${playerGold} Gold`, walletX + 16, walletY + 10);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`🎴 Deck: ${playerDeckCount} Cards`, walletX + 16, walletY + 32);

    // 3. Boat Speedometer & Nautical Heading (Bottom-Left)
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
    ctx.roundRect(speedX, speedY, speedW, speedH, 8);
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

    // Compass dial
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

    // 4. Floating Context Interaction Prompt (Center Bottom)
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
      ctx.roundRect(promptX, promptY, promptW, promptH, 8);
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
      ctx.roundRect(promptX, promptY, promptW, promptH, 8);
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

    // 5. Controls Helper (Top-Right)
    const guideW = 240;
    const guideH = 120;
    const guideX = width - guideW - 20;
    const guideY = 20;

    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(guideX, guideY, guideW, guideH, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CONTROLS', guideX + 14, guideY + 10);

    const isAudioMuted = AudioManager.getInstance().isMuted;
    ctx.fillStyle = isAudioMuted ? '#f87171' : '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(isAudioMuted ? '🔇 MUTED' : '🔊 AUDIO ON', guideX + guideW - 14, guideY + 10);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('[W / S] Throttle / Reverse', guideX + 14, guideY + 30);
    ctx.fillText('[A / D] Steer Rudder', guideX + 14, guideY + 50);
    ctx.fillText('[E / Space] Cast Line / Dock', guideX + 14, guideY + 70);
    ctx.fillText('[M] Toggle Sound & Music', guideX + 14, guideY + 90);

    ctx.restore();
  }
}
