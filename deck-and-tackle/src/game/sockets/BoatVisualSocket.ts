import { VisualSocket } from '../../engine/VisualSocket';
import { Vector2 } from '../../engine/Vector2';

export interface BoatRenderData {
  speedRatio: number; // 0 to 1
  isReversing: boolean;
  throttle: number;
}

export class BoatVisualSocket extends VisualSocket<BoatRenderData> {
  // Named socket anchors in local coordinates
  public readonly rodTipSocket: Vector2 = new Vector2(16, -14);
  public readonly motorSocket: Vector2 = new Vector2(-22, 0);
  public readonly bowSocket: Vector2 = new Vector2(25, 0);
  public readonly lanternSocket: Vector2 = new Vector2(24, 0);

  private internalTime: number = 0;

  constructor() {
    super('boat_visual_socket');
  }

  protected renderPlaceholder(ctx: CanvasRenderingContext2D, data: BoatRenderData): void {
    // Boat Length = ~52px, Width = ~24px, facing +X (East)
    this.internalTime += 0.016;
    const t = this.internalTime;

    // 1. Lantern Flickering Light Pool on Murky Water (Dynamic fragile light against cosmic darkness)
    const lanternFlicker = 0.85 + 0.15 * Math.sin(t * 8.5) * Math.cos(t * 13.2);
    const lightRadius = 95 * lanternFlicker;

    ctx.save();
    const lightGrad = ctx.createRadialGradient(20, 0, 4, 20, 0, lightRadius);
    lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.42)'); // Warm amber flame center
    lightGrad.addColorStop(0.35, 'rgba(190, 242, 100, 0.22)'); // Sickly yellow-green halo
    lightGrad.addColorStop(0.75, 'rgba(52, 211, 153, 0.08)'); // Eldritch emerald fringe
    lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lightGrad;
    ctx.beginPath();
    ctx.arc(20, 0, lightRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Water shadow beneath hull
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 12, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-1, 3, 27, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Rotting Weathered Wooden Dory Hull (Dark, brine-soaked timber with chipped paint)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(27, 0); // Sharp bow stem
    ctx.bezierCurveTo(21, -14.5, 0, -15.5, -20, -13.5); // Starboard gunwale
    ctx.lineTo(-24, -9); // Starboard stern corner
    ctx.lineTo(-24, 9);  // Port stern corner
    ctx.lineTo(-20, 13.5); // Port gunwale
    ctx.bezierCurveTo(0, 15.5, 21, 14.5, 27, 0);
    ctx.closePath();

    ctx.fillStyle = '#141c24'; // Weathered blackened navy timber
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#090d12';
    ctx.stroke();

    // Dark green algae scum ring around waterline
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Peeling / chipped paint scuffs exposing raw rotting wood
    ctx.fillStyle = '#451a03'; // Rotted dark timber underneath
    ctx.fillRect(8, -14, 5, 2);
    ctx.fillRect(-12, -13, 6, 1.8);
    ctx.fillRect(11, 12, 5, 2);
    ctx.fillRect(-9, 11.5, 7, 2);

    // Weathered gunwale cap rail (Oak timber scuffed by fishing lines and barnacles)
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.bezierCurveTo(20, -13, 0, -14, -19, -12);
    ctx.lineTo(-22, -8.5);
    ctx.moveTo(-22, 8.5);
    ctx.lineTo(-19, 12);
    ctx.bezierCurveTo(0, 14, 20, 13, 26, 0);
    ctx.stroke();

    // Rusted iron hull repair patches & strap brackets
    ctx.fillStyle = '#57534e';
    ctx.fillRect(-5, 11, 8, 3.5);
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-5, 11, 8, 3.5);

    // Rusted iron rivets on patch
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-3, 12, 1.2, 1.2);
    ctx.fillRect(0, 12, 1.2, 1.2);

    // 4. Inner Weathered Teak Deck Planking
    ctx.beginPath();
    ctx.moveTo(23, 0);
    ctx.bezierCurveTo(18, -11, 0, -12, -17, -10);
    ctx.lineTo(-20, -7);
    ctx.lineTo(-20, 7);
    ctx.lineTo(-17, 10);
    ctx.bezierCurveTo(0, 12, 18, 11, 23, 0);
    ctx.closePath();

    ctx.fillStyle = '#7c5332'; // Salt-bleached weathered teak
    ctx.fill();
    ctx.strokeStyle = '#3d2410';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Deck plank seams with dark tar caulking
    const plankShades = ['#71492a', '#7d5332', '#674023', '#784e2e', '#61391e'];
    for (let i = 0; i < 5; i++) {
      const y1 = -8.5 + i * 3.4;
      const y2 = y1 + 3.4;
      ctx.fillStyle = plankShades[i % plankShades.length];
      ctx.fillRect(-18, y1, 37, y2 - y1);
    }

    ctx.strokeStyle = 'rgba(25, 15, 8, 0.65)';
    ctx.lineWidth = 0.8;
    for (let y = -8.5; y <= 8.5; y += 3.4) {
      ctx.beginPath();
      ctx.moveTo(-18, y);
      ctx.lineTo(19, y);
      ctx.stroke();
    }

    // Waterlogged brine puddle on deck
    ctx.fillStyle = 'rgba(10, 20, 30, 0.45)';
    ctx.beginPath();
    ctx.ellipse(2, -4, 3.2, 1.5, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Foredeck Gear & Rusted Fittings
    // Coiled weathered mooring rope at the bow
    ctx.strokeStyle = '#a89078';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(14, 1, 3.5, 0, Math.PI * 2);
    ctx.arc(14, 1, 2.0, 0, Math.PI * 2);
    ctx.stroke();

    // Weathered Red Metal Tackle Box with rust stains
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(8, -8.5, 6.5, 5);
    ctx.fillStyle = '#b45309'; // Rust corner
    ctx.fillRect(8, -8.5, 2, 2);
    ctx.fillStyle = '#d4d4d8'; // Latch
    ctx.fillRect(11, -9.5, 1.5, 1.2);

    // Galvanized Bait Bucket
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(7, 6.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(7, 6.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // 6. Seated Angler Silhouette (Hunched, rain-slicked dark oilskin coat & sou'wester)
    ctx.save();
    const speedTilt = data ? data.speedRatio * 1.5 : 0;
    const anglerX = -4.5 + speedTilt * 0.4;
    const anglerY = 0;

    // Hunched Torso / Dark Victorian Oilskin Coat
    ctx.fillStyle = '#1c281e'; // Deep murky dark olive-black oilskin
    ctx.beginPath();
    ctx.ellipse(anglerX, anglerY, 5.2, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#09110a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Rain-slicked sheen highlight along shoulder
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(anglerX - 1, anglerY, 4.8, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // Arms gripping steering tiller / rod
    ctx.strokeStyle = '#1c281e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(anglerX + 1, anglerY + 4);
    ctx.lineTo(anglerX + 5, anglerY + 2);
    ctx.moveTo(anglerX + 1, anglerY - 4);
    ctx.lineTo(anglerX + 5, anglerY - 3);
    ctx.stroke();

    // Sailor hands
    ctx.fillStyle = '#d4b483';
    ctx.beginPath();
    ctx.arc(anglerX + 5.2, anglerY + 2, 1.3, 0, Math.PI * 2);
    ctx.arc(anglerX + 5.2, anglerY - 3, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Sou'wester Fisherman's Rain Hat
    // Wide rear brim neck shield
    ctx.fillStyle = '#854d0e';
    ctx.beginPath();
    ctx.ellipse(anglerX - 2.2, anglerY, 4.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Yellow oilskin crown
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.arc(anglerX - 0.6, anglerY, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Front brim highlight
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(anglerX + 1.2, anglerY, 2.4, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();

    // 7. Fishing Rod in Gunwale Mount
    ctx.save();
    ctx.fillStyle = '#a16207'; // Cork handle
    ctx.fillRect(3, -8, 4.5, 2.2);

    ctx.strokeStyle = '#0f172a'; // Dark graphite rod blank
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(6, -7);
    ctx.lineTo(this.rodTipSocket.x, this.rodTipSocket.y);
    ctx.stroke();

    // High-visibility red tip
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(this.rodTipSocket.x, this.rodTipSocket.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 8. Flickering Yellow-Green Oil Lantern Mounted on Bow Stanchion
    ctx.save();
    // Iron mounting bracket at bow
    ctx.fillStyle = '#292524';
    ctx.fillRect(22, -1.5, 4, 3);

    // Brass & blackened iron lantern housing
    ctx.fillStyle = '#451a03';
    ctx.fillRect(23.5, -3, 3.5, 6);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(23.5, -3, 3.5, 6);

    // Glowing lantern glass & dancing wick flame
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#bef264';
    ctx.shadowBlur = 8 * lanternFlicker;
    ctx.beginPath();
    ctx.arc(25, 0, 2 * lanternFlicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 9. Weathered Outboard Motor at Stern
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-28, -6, 7, 12);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(-28, -6, 7, 12);

    // Rusted scratch highlight
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-26, -3);
    ctx.lineTo(-23, -1);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
