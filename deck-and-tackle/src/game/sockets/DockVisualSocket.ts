import { VisualSocket } from '../../engine/VisualSocket';

export interface DockRenderData {
  time: number;
  isPlayerNearby: boolean;
  dockWidth: number;
  dockHeight: number;
}

export class DockVisualSocket extends VisualSocket<DockRenderData> {
  constructor() {
    super('dock_visual_socket');
  }

  protected renderPlaceholder(ctx: CanvasRenderingContext2D, data: DockRenderData): void {
    const t = data ? data.time : 0;
    const isNearby = data ? data.isPlayerNearby : false;
    const w = data ? data.dockWidth : 120;
    const h = data ? data.dockHeight : 50;

    ctx.save();

    // 1. Water shadow under pier
    ctx.fillStyle = 'rgba(5, 15, 25, 0.65)';
    ctx.fillRect(-w / 2 - 6, -h / 2 + 5, w + 12, h + 10);

    // Green slime / algae under-fringing around water line
    ctx.fillStyle = 'rgba(21, 128, 61, 0.4)';
    ctx.fillRect(-w / 2 - 4, h / 2 - 2, w + 8, 8);

    // 2. Main Pier Deck (Weathered greyed-wood planks with barnacles)
    ctx.fillStyle = '#4a3d31'; // Salt-bleached dark weathered wood
    ctx.fillRect(-w / 2, -h / 2, w, h);

    // Varied plank tones & rotting grain lines
    ctx.strokeStyle = '#2b2118';
    ctx.lineWidth = 1.4;
    for (let x = -w / 2; x <= w / 2; x += 9) {
      ctx.beginPath();
      ctx.moveTo(x, -h / 2);
      ctx.lineTo(x, h / 2);
      ctx.stroke();
    }

    // Outer slimy wooden bumper curb
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Salt Brine Barrels on the pier
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(-w / 2 + 28, -h / 2 + 10, 5, 0, Math.PI * 2);
    ctx.arc(-w / 2 + 38, -h / 2 + 8, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Wooden Mooring Pilings / Rusted Iron Bollards
    const pilings = [
      { x: -w / 2 + 8, y: -h / 2 },
      { x: w / 2 - 8, y: -h / 2 },
      { x: -w / 2 + 8, y: h / 2 },
      { x: w / 2 - 8, y: h / 2 },
      { x: 0, y: h / 2 }
    ];

    for (const p of pilings) {
      // Piling head with barnacles
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#15803d'; // Green moss ring
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Weathered hemp mooring rope coil
      ctx.strokeStyle = '#a89472';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Innsmouth Harbor Gas Lantern with Sickly Green-Amber Aura
    const lanternX = -w / 2 + 16;
    const lanternY = 0;

    // Sickly flickering atmospheric glow
    const flicker = 0.85 + 0.15 * Math.sin(t * 8) * Math.cos(t * 13);
    const glowGradient = ctx.createRadialGradient(lanternX, lanternY, 3, lanternX, lanternY, 44 * flicker);
    glowGradient.addColorStop(0, 'rgba(167, 243, 208, 0.55)'); // Pale sea-green center
    glowGradient.addColorStop(0.4, 'rgba(234, 179, 8, 0.25)'); // Amber mid
    glowGradient.addColorStop(1, 'rgba(5, 150, 105, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 44 * flicker, 0, Math.PI * 2);
    ctx.fill();

    // Rusted iron lamp post
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(lanternX - 3.5, lanternY - 11, 7, 22);
    // Greenish glass burner
    ctx.fillStyle = '#6ee7b7';
    ctx.fillRect(lanternX - 2, lanternY - 5, 4, 10);

    // 5. Innsmouth Dock Sign / Label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 9px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('INNSMOUTH WHARF', 14, 0);

    // 6. Proximity pulse if player is near
    if (isNearby) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}
