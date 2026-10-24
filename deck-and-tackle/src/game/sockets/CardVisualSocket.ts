import { VisualSocket } from '../../engine/VisualSocket';
import type { CardData } from '../battle/CardData';

export interface CardRenderData {
  card: CardData;
  isHovered: boolean;
  isSelected: boolean;
  isPlayable: boolean;
  scale?: number;
}

export class CardVisualSocket extends VisualSocket<CardRenderData> {
  public static readonly CARD_WIDTH = 138;
  public static readonly CARD_HEIGHT = 196;

  constructor() {
    super('card_visual_socket');
  }

  protected renderPlaceholder(ctx: CanvasRenderingContext2D, data: CardRenderData): void {
    const card = data.card;
    const isHovered = data.isHovered;
    const isPlayable = data.isPlayable;
    const w = CardVisualSocket.CARD_WIDTH;
    const h = CardVisualSocket.CARD_HEIGHT;

    ctx.save();

    // 1. Heavy Eldritch Drop Shadow
    ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)';
    const shadowY = isHovered ? 14 : 6;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 2, -h / 2 + shadowY, w - 4, h, 8);
    ctx.fill();

    // 2. Determine Eldritch Card Type Theme & Glow Palette
    let frameColor = '#1c1514'; // Tarnished iron / blackened oak
    let innerParchment = '#241e1b'; // Salt-stained grimoire vellum
    let headerBg = '#361517';
    let eldritchGlow = '#f43f5e'; // Crimson blood
    let typeTag = 'ATTACK / REEL';
    let sigilColor = '#fca5a5';

    switch (card.cardType) {
      case 'Reel':
        frameColor = '#210e11';
        innerParchment = '#2b1b1d';
        headerBg = '#4c1118';
        eldritchGlow = '#f43f5e'; // Blood crimson
        typeTag = 'REEL (ATTACK)';
        sigilColor = '#fca5a5';
        break;
      case 'Drag':
        frameColor = '#0b1924';
        innerParchment = '#15242f';
        headerBg = '#0c3047';
        eldritchGlow = '#38bdf8'; // Abyssal cyan
        typeTag = 'DRAG (SLACK)';
        sigilColor = '#7dd3fc';
        break;
      case 'Technique':
        frameColor = '#241033';
        innerParchment = '#2d183d';
        headerBg = '#421659';
        eldritchGlow = '#c084fc'; // Occult purple
        typeTag = card.oncePerBattle ? '★ TECHNIQUE (ONCE) ★' : 'TECHNIQUE';
        sigilColor = '#e9d5ff';
        break;
      case 'Power':
        frameColor = '#241b0b';
        innerParchment = '#2e2516';
        headerBg = '#54360e';
        eldritchGlow = '#34d399'; // Eldritch emerald
        typeTag = 'ANCIENT POWER';
        sigilColor = '#6ee7b7';
        break;
    }

    // 3. Playable Eldritch Aura Glow
    if (isPlayable) {
      ctx.shadowColor = eldritchGlow;
      ctx.shadowBlur = isHovered ? 18 : 8;
    }

    // 4. Weathered Grimoire Card Base (Dark aged leather / bound plate)
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();

    // Tarnished Iron & Bone Border
    let borderColor = isPlayable ? eldritchGlow : '#475569';
    if (!isHovered && isPlayable) {
      borderColor = card.cardType === 'Reel' ? '#991b1b' : (card.cardType === 'Drag' ? '#0284c7' : '#7c3aed');
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isHovered ? 2.5 : 1.6;
    ctx.stroke();
    ctx.shadowBlur = 0; // Clear shadow blur for inner details

    // Waterlogged Salt-Stained Parchment Inset
    ctx.fillStyle = innerParchment;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4);
    ctx.fill();

    // Salt stains & water tide rings across the parchment
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.2, -h * 0.1, 24, 18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.22, h * 0.28, 28, 14, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Brine tide line
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, h * 0.2);
    ctx.bezierCurveTo(-w * 0.1, h * 0.16, w * 0.1, h * 0.25, w / 2 - 6, h * 0.19);
    ctx.stroke();

    // Carved Bone / Tarnished Iron Corner Brackets (Occult grimoire binding)
    ctx.strokeStyle = isHovered ? sigilColor : '#78716c';
    ctx.lineWidth = 1.8;
    const cSize = 9;
    ctx.beginPath();
    // Top-Left
    ctx.moveTo(-w / 2 + cSize + 2, -h / 2 + 2);
    ctx.lineTo(-w / 2 + 2, -h / 2 + 2);
    ctx.lineTo(-w / 2 + 2, -h / 2 + cSize + 2);
    // Top-Right
    ctx.moveTo(w / 2 - cSize - 2, -h / 2 + 2);
    ctx.lineTo(w / 2 - 2, -h / 2 + 2);
    ctx.lineTo(w / 2 - 2, -h / 2 + cSize + 2);
    // Bottom-Left
    ctx.moveTo(-w / 2 + cSize + 2, h / 2 - 2);
    ctx.lineTo(-w / 2 + 2, h / 2 - 2);
    ctx.lineTo(-w / 2 + 2, h / 2 - cSize - 2);
    // Bottom-Right
    ctx.moveTo(w / 2 - cSize - 2, h / 2 - 2);
    ctx.lineTo(w / 2 - 2, h / 2 - 2);
    ctx.lineTo(w / 2 - 2, h / 2 - cSize - 2);
    ctx.stroke();

    // Corner rivet dots
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(-w / 2 + 4, -h / 2 + 4, 1.5, 1.5);
    ctx.fillRect(w / 2 - 5.5, -h / 2 + 4, 1.5, 1.5);
    ctx.fillRect(-w / 2 + 4, h / 2 - 5.5, 1.5, 1.5);
    ctx.fillRect(w / 2 - 5.5, h / 2 - 5.5, 1.5, 1.5);

    // 5. Title Header Ribbon (Woodcut Engraved Plate)
    ctx.fillStyle = headerBg;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 6, -h / 2 + 7, w - 12, 25, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Card Title in stark antique serif
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.title, 8, -h / 2 + 20);

    // 6. Stamina Cost Gem (Tarnished Brass Manometer Medallion)
    const gemX = -w / 2 + 15;
    const gemY = -h / 2 + 15;
    const gemR = 12.5;

    // Rusted iron bezel
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(gemX, gemY, gemR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Glowing ember cabochon
    const gemGrad = ctx.createRadialGradient(gemX - 3, gemY - 3, 2, gemX, gemY, gemR - 2);
    gemGrad.addColorStop(0, '#fef08a');
    gemGrad.addColorStop(0.4, '#eab308');
    gemGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = gemGrad;
    ctx.beginPath();
    ctx.arc(gemX, gemY, gemR - 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Stamina number
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.staminaCost.toString(), gemX, gemY + 1);

    // 7. Woodcut Artwork Socket
    const artW = w - 16;
    const artH = 64;
    const artX = -artW / 2;
    const artY = -h / 2 + 36;

    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(artX, artY, artW, artH);
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1;
    ctx.strokeRect(artX, artY, artW, artH);

    // Render Woodcut / Engraving Iconography
    this.renderWoodcutArt(ctx, card, artX + artW / 2, artY + artH / 2, sigilColor);

    // 8. Card Type Tag Ribbon (Dark Victorian parchment tag)
    ctx.fillStyle = card.cardType === 'Technique' ? '#2e1065' : '#171412';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 10, artY + artH + 5, w - 20, 14, 2);
    ctx.fill();
    ctx.strokeStyle = card.cardType === 'Technique' ? 'rgba(192, 132, 252, 0.4)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = sigilColor;
    ctx.font = 'bold 8px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typeTag, 0, artY + artH + 12);

    // Technique Backlash Badge inside Art Box bottom
    const selfDmg = card.tensionSelf ?? card.effect?.tensionSelf ?? 0;
    if (selfDmg > 0) {
      ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 12, artY + artH - 13, w - 24, 11, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fee2e2';
      ctx.font = 'bold 7px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚡ BACKLASH: -${selfDmg} LINE`, 0, artY + artH - 7.5);
    }

    // 9. Description Text Box (Grim Victorian Letterpress)
    const descY = artY + artH + 26;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '10px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    this.wrapText(ctx, card.description, 0, descY, w - 20, 13);

    // 10. Playability Overlay (Dimmed & salt-corroded when unplayable)
    if (!isPlayable) {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.65)';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render stark, high-contrast woodcut engravings for card actions
   */
  private renderWoodcutArt(ctx: CanvasRenderingContext2D, card: CardData, cx: number, cy: number, tint: string): void {
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = tint;
    ctx.fillStyle = tint;
    ctx.lineWidth = 1.8;

    if (card.cardType === 'Reel') {
      // Woodcut: Heavy Barbed Iron Hook & Coiled Chain
      ctx.beginPath();
      ctx.moveTo(-16, -18);
      ctx.lineTo(-16, 4);
      ctx.bezierCurveTo(-16, 18, 14, 18, 14, 4);
      ctx.lineTo(14, -4);
      ctx.lineTo(8, -1);
      ctx.stroke();

      // Hook barb
      ctx.beginPath();
      ctx.moveTo(14, -4);
      ctx.lineTo(18, 4);
      ctx.lineTo(13, 0);
      ctx.fill();

      // Hook eyelet
      ctx.beginPath();
      ctx.arc(-16, -18, 3.5, 0, Math.PI * 2);
      ctx.stroke();

      // Blood trickle
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(14, 14, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (card.cardType === 'Drag') {
      // Woodcut: Tarnished Nautical Ward Shield & Entangling Kelp Waves
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(16, -12);
      ctx.lineTo(12, 10);
      ctx.lineTo(0, 19);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-16, -12);
      ctx.closePath();
      ctx.stroke();

      // Shield elder symbol
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(0, 12);
      ctx.moveTo(-8, -2);
      ctx.lineTo(8, -2);
      ctx.stroke();

      // Slack wave coils
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-20, 4, 8, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(20, -4, 8, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
    } else if (card.cardType === 'Technique') {
      const id = card.id;
      if (id === 'tension_strike') {
        // Woodcut: Dagon's Barbed Hook (Heavy serrated basalt hook dripping sacrificial blood)
        ctx.beginPath();
        ctx.moveTo(-10, -18);
        ctx.lineTo(-10, 6);
        ctx.bezierCurveTo(-10, 20, 16, 20, 16, 4);
        ctx.lineTo(16, -6);
        ctx.lineTo(8, -1);
        ctx.stroke();

        // Serrated Barbs
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(16, -6);
        ctx.lineTo(21, 2);
        ctx.lineTo(15, -1);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(16, 5);
        ctx.lineTo(20, 10);
        ctx.lineTo(15, 8);
        ctx.closePath();
        ctx.fill();

        // Blood drops
        ctx.beginPath();
        ctx.arc(16, 16, 2.2, 0, Math.PI * 2);
        ctx.arc(10, 22, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === 'chum_scatter') {
        // Woodcut: Abyssal Chum (Cauldron of bubbling dark ichor & floating bone runes)
        ctx.beginPath();
        ctx.moveTo(-18, -6);
        ctx.bezierCurveTo(-20, 18, 20, 18, 18, -6);
        ctx.closePath();
        ctx.stroke();

        // Rim
        ctx.beginPath();
        ctx.ellipse(0, -6, 18, 5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Bubbling ichor droplets
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-6, -14, 3, 0, Math.PI * 2);
        ctx.arc(5, -12, 2.2, 0, Math.PI * 2);
        ctx.arc(0, -18, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === 'desperate_haul') {
        // Woodcut: Desperate Haul (Violently bending rod with straining line and blood sparks)
        ctx.beginPath();
        ctx.moveTo(-20, 16);
        ctx.bezierCurveTo(-8, -12, 8, -20, 20, -10);
        ctx.stroke();

        // Straining line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(20, -10);
        ctx.lineTo(-4, 18);
        ctx.stroke();

        // Tension sparks
        ctx.fillStyle = '#f87171';
        for (const pt of [[-2, 4], [8, -4], [14, -8]]) {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Woodcut: Occult Feather Jig & Writhing Eldritch Tentacle (Eldritch Lure)
        ctx.beginPath();
        ctx.moveTo(-14, 16);
        ctx.bezierCurveTo(-6, 0, 6, -10, 16, -16);
        ctx.stroke();

        // Jig barb
        ctx.beginPath();
        ctx.moveTo(16, -16);
        ctx.lineTo(10, -12);
        ctx.lineTo(12, -18);
        ctx.closePath();
        ctx.fill();

        // Occult eye on the lure
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.ellipse(-2, 3, 5, 8, -0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-2, 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Woodcut: Cyclopean Monolith Sigil & Straining Black Iron Winch
      ctx.beginPath();
      ctx.moveTo(-12, 16);
      ctx.lineTo(-5, -16);
      ctx.lineTo(5, -16);
      ctx.lineTo(12, 16);
      ctx.closePath();
      ctx.stroke();

      // Glowing rune inside monolith
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 8);
      ctx.moveTo(-4, -2);
      ctx.lineTo(4, 2);
      ctx.stroke();

      // Power sparks
      ctx.fillStyle = '#34d399';
      for (const p of [-14, 14]) {
        ctx.beginPath();
        ctx.arc(p, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
  }
}
