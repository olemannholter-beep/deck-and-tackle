import { Vector2 } from '../../engine/Vector2';
import { Input } from '../../engine/Input';
import { FishingSpot } from '../overworld/FishingSpot';
import type { IslandCollider } from '../overworld/OverworldMap';
import { AtmosphereManager } from '../overworld/AtmosphereManager';
import { FISH_REGISTRY } from '../battle/FishData';

export class SeaChartOverlay {
  public static readonly WORLD_SIZE: number = 8000;
  public static readonly HARBOR_CENTER: Vector2 = new Vector2(4000, 4000);

  private open: boolean = false;
  private time: number = 0;

  // Pan and Zoom
  private panX: number = 0;
  private panY: number = 0;
  private zoom: number = 1.0;
  private readonly minZoom: number = 0.8;
  private readonly maxZoom: number = 3.5;

  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private lastPanX: number = 0;
  private lastPanY: number = 0;

  // Cached UI button bounds for click detection
  private closeBtn = { x: 0, y: 0, w: 32, h: 32, hovered: false };
  private centerBtn = { x: 0, y: 0, w: 120, h: 28, hovered: false };
  private resetBtn = { x: 0, y: 0, w: 90, h: 28, hovered: false };

  // Hovered spot for tooltip
  private hoveredSpot: FishingSpot | null = null;
  private mousePos: Vector2 = new Vector2(0, 0);

  public isOpen(): boolean {
    return this.open;
  }

  public openChart(): void {
    this.open = true;
  }

  public closeChart(): void {
    this.open = false;
    this.isDragging = false;
    this.hoveredSpot = null;
  }

  public toggle(): void {
    if (this.open) {
      this.closeChart();
    } else {
      this.openChart();
    }
  }

  public setOpen(open: boolean): void {
    if (open) {
      this.openChart();
    } else {
      this.closeChart();
    }
  }

  /**
   * Updates state, pan/zoom interaction, and hover detection.
   * Returns true if overlay consumed input or is open.
   */
  public update(
    dt: number,
    width: number,
    height: number,
    boatPos?: Vector2
  ): boolean {
    this.time += dt;

    // 1. Check toggle shortcuts
    if (Input.isJustPressed('keym') || Input.isJustPressed('tab')) {
      this.toggle();
      return true;
    }

    if (!this.open) {
      return false;
    }

    // 2. Escape closes chart
    if (Input.isJustPressed('escape')) {
      this.closeChart();
      return true;
    }

    // 3. Quick action keyboard shortcuts
    if (Input.isJustPressed('keyc') && boatPos) {
      this.centerOnPosition(boatPos, width, height);
    }
    if (Input.isJustPressed('keyr')) {
      this.resetView();
    }

    this.mousePos = Input.getMousePosition();

    // 4. Update button hover states
    this.closeBtn.hovered = this.isPointInRect(this.mousePos.x, this.mousePos.y, this.closeBtn);
    this.centerBtn.hovered = this.isPointInRect(this.mousePos.x, this.mousePos.y, this.centerBtn);
    this.resetBtn.hovered = this.isPointInRect(this.mousePos.x, this.mousePos.y, this.resetBtn);

    // 5. Handle button clicks
    if (Input.isMouseClicked()) {
      if (this.closeBtn.hovered) {
        this.closeChart();
        return true;
      }
      if (this.centerBtn.hovered && boatPos) {
        this.centerOnPosition(boatPos, width, height);
        return true;
      }
      if (this.resetBtn.hovered) {
        this.resetView();
        return true;
      }
    }

    // 6. Handle Mouse Wheel Zoom (centered around mouse cursor)
    const wheelDelta = Input.consumeWheelDelta();
    if (wheelDelta !== 0) {
      this.handleZoom(wheelDelta, this.mousePos.x, this.mousePos.y, width, height);
    }

    // 7. Handle Mouse Drag Pan
    const isMouseDown = Input.isMouseDownState();
    if (isMouseDown && !this.isDragging) {
      // Check if mouse is within modal chart area
      const margin = 28;
      const chartX = margin;
      const chartY = margin;
      const chartW = width - margin * 2;
      const chartH = height - margin * 2;
      if (
        this.mousePos.x >= chartX &&
        this.mousePos.x <= chartX + chartW &&
        this.mousePos.y >= chartY &&
        this.mousePos.y <= chartY + chartH &&
        !this.closeBtn.hovered &&
        !this.centerBtn.hovered &&
        !this.resetBtn.hovered
      ) {
        this.isDragging = true;
        this.dragStartX = this.mousePos.x;
        this.dragStartY = this.mousePos.y;
        this.lastPanX = this.panX;
        this.lastPanY = this.panY;
      }
    } else if (isMouseDown && this.isDragging) {
      const dx = this.mousePos.x - this.dragStartX;
      const dy = this.mousePos.y - this.dragStartY;
      this.panX = this.lastPanX + dx;
      this.panY = this.lastPanY + dy;

      // Soft clamp pan bounds
      const maxPan = SeaChartOverlay.WORLD_SIZE * this.getScale(width, height) * 0.8;
      this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
      this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
    } else {
      this.isDragging = false;
    }

    // 8. Update cursor
    if (this.closeBtn.hovered || this.centerBtn.hovered || this.resetBtn.hovered || this.hoveredSpot) {
      Input.setCursor('pointer');
    } else if (this.isDragging) {
      Input.setCursor('grabbing');
    } else {
      Input.setCursor('grab');
    }

    return true;
  }

  public resetView(): void {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  public centerOnPosition(pos: Vector2, width: number, height: number): void {
    const s = this.getScale(width, height);
    this.panX = (SeaChartOverlay.HARBOR_CENTER.x - pos.x) * s;
    this.panY = (SeaChartOverlay.HARBOR_CENTER.y - pos.y) * s;
  }

  private handleZoom(
    deltaY: number,
    mouseX: number,
    mouseY: number,
    width: number,
    height: number
  ): void {
    const zoomFactor = deltaY < 0 ? 1.15 : 0.85;
    const oldZoom = this.zoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * zoomFactor));
    if (newZoom === oldZoom) return;

    const baseScale = this.getBaseScale(width, height);
    const oldScale = baseScale * oldZoom;
    const newScale = baseScale * newZoom;

    const centerX = width / 2;
    const centerY = (height + 24) / 2;

    // Coordinate before zoom in world offset units
    const worldOffsetX = (mouseX - centerX - this.panX) / oldScale;
    const worldOffsetY = (mouseY - centerY - this.panY) / oldScale;

    this.zoom = newZoom;
    this.panX = mouseX - centerX - worldOffsetX * newScale;
    this.panY = mouseY - centerY - worldOffsetY * newScale;
  }

  private getBaseScale(width: number, height: number): number {
    const margin = 50;
    const topBarH = 70;
    const availW = Math.max(200, width - margin * 2);
    const availH = Math.max(200, height - topBarH - margin);
    return Math.min(availW / SeaChartOverlay.WORLD_SIZE, availH / SeaChartOverlay.WORLD_SIZE);
  }

  private getScale(width: number, height: number): number {
    return this.getBaseScale(width, height) * this.zoom;
  }

  private worldToChart(
    wx: number,
    wy: number,
    width: number,
    height: number
  ): { x: number; y: number } {
    const s = this.getScale(width, height);
    const centerX = width / 2;
    const centerY = (height + 24) / 2;
    return {
      x: centerX + this.panX + (wx - SeaChartOverlay.HARBOR_CENTER.x) * s,
      y: centerY + this.panY + (wy - SeaChartOverlay.HARBOR_CENTER.y) * s
    };
  }

  private isPointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /**
   * Renders the complete aged parchment Sea Chart modal.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    boatPos: Vector2,
    boatHeading: number,
    activeWhirlpools: FishingSpot[],
    harborPos: Vector2 = SeaChartOverlay.HARBOR_CENTER,
    islandColliders: IslandCollider[] = []
  ): void {
    if (!this.open) return;

    ctx.save();

    // 1. Dark atmospheric backdrop dimming overworld
    ctx.fillStyle = 'rgba(2, 6, 12, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // 2. Modal Dimensions & Outer Parchment Panel
    const margin = 28;
    const panelX = margin;
    const panelY = margin;
    const panelW = width - margin * 2;
    const panelH = height - margin * 2;

    // Parchment gradient backing
    const parchmentGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
    parchmentGrad.addColorStop(0.0, '#101924');
    parchmentGrad.addColorStop(0.5, '#0c131b');
    parchmentGrad.addColorStop(1.0, '#090e15');

    ctx.fillStyle = parchmentGrad;
    ctx.beginPath();
    this.drawRoundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();

    // Antique dual brass borders
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Corner brass bracket flourishes
    this.renderCornerBrackets(ctx, panelX, panelY, panelW, panelH);

    // Clip content to inner parchment area
    ctx.save();
    ctx.beginPath();
    this.drawRoundRect(ctx, panelX + 4, panelY + 4, panelW - 8, panelH - 8, 8);
    if (typeof ctx.clip === 'function') {
      ctx.clip();
    }

    // 3. Cartographic Grid & Rhumb Lines
    this.renderCartographicGrid(ctx, width, height);

    // 4. Concentric Radial Zone Rings (1200m, 2400m, 3600m)
    this.renderZoneRings(ctx, width, height, harborPos);

    // 5. Islands & Landmass Contours from islandColliders
    this.renderIslands(ctx, width, height, islandColliders);

    // 6. Central Safe Harbor & Sanctuary Anchor at (4000, 4000)
    this.renderHarbor(ctx, width, height, harborPos);

    // 7. Active Ephemeral Whirlpools with dynamic vortex spirals
    this.hoveredSpot = null;
    this.renderWhirlpools(ctx, width, height, activeWhirlpools);

    // 8. Player Vessel Marker with directional arrow and sonar radar ripple
    this.renderVessel(ctx, width, height, boatPos, boatHeading);

    ctx.restore(); // Restore clip

    // 9. Nautical Scale Bar & Legend (Bottom-Left)
    this.renderLegendAndScale(ctx, panelX + 16, panelY + panelH - 96, width, height);

    // 10. Top Title Banner & Quick Action Buttons
    this.renderHeader(ctx, panelX, panelY, panelW);

    // 11. Whirlpool Hover Tooltip Card
    if (this.hoveredSpot) {
      this.renderWhirlpoolTooltip(ctx, this.hoveredSpot, width, height);
    }

    ctx.restore();
  }

  private renderCornerBrackets(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const size = 18;
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2.0;

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8 + size);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + 8 + size, y + 8);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(x + w - 8 - size, y + 8);
    ctx.lineTo(x + w - 8, y + 8);
    ctx.lineTo(x + w - 8, y + 8 + size);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(x + 8, y + h - 8 - size);
    ctx.lineTo(x + 8, y + h - 8);
    ctx.lineTo(x + 8 + size, y + h - 8);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(x + w - 8 - size, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - 8 - size);
    ctx.stroke();
  }

  private renderCartographicGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const harborChart = this.worldToChart(4000, 4000, width, height);
    const s = this.getScale(width, height);

    // 16-point nautical rhumb rays radiating from Central Harbor
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.09)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    const rayLength = 5500 * s;
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8;
      ctx.beginPath();
      ctx.moveTo(harborChart.x, harborChart.y);
      ctx.lineTo(
        harborChart.x + Math.cos(angle) * rayLength,
        harborChart.y + Math.sin(angle) * rayLength
      );
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Faint bathymetric coordinate grid (every 1000m)
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.08)';
    ctx.lineWidth = 0.8;
    for (let wx = 0; wx <= 8000; wx += 1000) {
      const p1 = this.worldToChart(wx, 0, width, height);
      const p2 = this.worldToChart(wx, 8000, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let wy = 0; wy <= 8000; wy += 1000) {
      const p1 = this.worldToChart(0, wy, width, height);
      const p2 = this.worldToChart(8000, wy, width, height);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // World border boundary (8000x8000)
    const tl = this.worldToChart(0, 0, width, height);
    const br = this.worldToChart(8000, 8000, width, height);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    ctx.restore();
  }

  private renderZoneRings(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    harborPos: Vector2
  ): void {
    const center = this.worldToChart(harborPos.x, harborPos.y, width, height);
    const s = this.getScale(width, height);

    interface RingDef {
      radius: number;
      color: string;
      label: string;
    }

    const rings: RingDef[] = [
      { radius: 1200, color: '#10b981', label: 'ZONE I: THE SHALLOWS (0 - 1,200m)' },
      { radius: 2400, color: '#2dd4bf', label: 'ZONE II: THE FOGGY BANKS (1,200 - 2,400m)' },
      { radius: 3600, color: '#38bdf8', label: 'ZONE III: THE SUNKEN REEFS (2,400 - 3,600m)' }
    ];

    ctx.save();
    for (const ring of rings) {
      const r = ring.radius * s;

      // Dashed boundary ring
      ctx.beginPath();
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Zone Title text banner along top and bottom of circle
      ctx.setLineDash([]);
      ctx.fillStyle = ring.color;
      ctx.font = 'bold 10px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`— ${ring.label} —`, center.x, center.y - r - 4);
    }

    // Zone 4 Outer Trench Label
    const r4 = 4200 * s;
    ctx.beginPath();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 8]);
    ctx.arc(center.x, center.y, r4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('— ZONE IV: THE ELDRITCH TRENCH (3,600m+ ABYSS) —', center.x, center.y - r4 - 4);

    ctx.restore();
  }

  private renderIslands(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    colliders: IslandCollider[]
  ): void {
    const s = this.getScale(width, height);

    ctx.save();
    for (const col of colliders) {
      const pos = this.worldToChart(col.x, col.y, width, height);
      const r = Math.max(3, col.radius * s);

      // Coastal shelf halo
      ctx.fillStyle = 'rgba(14, 116, 144, 0.18)';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 4, 0, Math.PI * 2);
      ctx.fill();

      // Island landmass fill
      ctx.fillStyle = col.type === 'rock' ? '#334155' : (col.type === 'sandbar' ? '#78716c' : '#1e293b');
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderHarbor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    harborPos: Vector2
  ): void {
    const center = this.worldToChart(harborPos.x, harborPos.y, width, height);
    const s = this.getScale(width, height);

    ctx.save();

    // 1. Safe Haven Sanctuary Boundary (radius 350px)
    const safeRadius = 350 * s;
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.arc(center.x, center.y, safeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sanctuary glow halo
    const glow = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, Math.max(16, safeRadius));
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.15)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(16, safeRadius), 0, Math.PI * 2);
    ctx.fill();

    // 2. Anchor Icon
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.font = 'bold 20px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('⚓', center.x, center.y);
    ctx.fillText('⚓', center.x, center.y);

    // 3. Port Innsmouth Banner
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Port Innsmouth', center.x, center.y + 14);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillText('Central Safe Haven (4000, 4000)', center.x, center.y + 28);

    ctx.restore();
  }

  private renderWhirlpools(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    whirlpools: FishingSpot[]
  ): void {
    ctx.save();

    for (const spot of whirlpools) {
      const pos = this.worldToChart(spot.position.x, spot.position.y, width, height);

      // Distance from harbor determines tier color
      const distToHarbor = Math.hypot(spot.position.x - 4000, spot.position.y - 4000);
      const tierIndex = AtmosphereManager.getZoneIndex(distToHarbor);

      let tierColor = '#34d399';
      if (tierIndex === 2) tierColor = '#2dd4bf';
      else if (tierIndex === 3) tierColor = '#38bdf8';
      else if (tierIndex === 4) tierColor = '#c084fc';

      // Check hover
      const mouseDist = Math.hypot(this.mousePos.x - pos.x, this.mousePos.y - pos.y);
      if (mouseDist <= 16) {
        this.hoveredSpot = spot;
      }

      const isHovered = this.hoveredSpot === spot;
      const spotAlpha = spot.alpha !== undefined ? spot.alpha : 1.0;
      const spotScale = spot.scale !== undefined ? spot.scale : 1.0;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.globalAlpha = spotAlpha;

      // 1. Sub-surface aura glow
      const auraRadius = (isHovered ? 18 : 12) * spotScale;
      const aura = ctx.createRadialGradient(0, 0, 2, 0, 0, auraRadius);
      aura.addColorStop(0, tierColor);
      aura.addColorStop(1, 'transparent');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Animated Swirling Spiral Vortex Arms
      ctx.rotate(-this.time * 2.2);
      ctx.strokeStyle = tierColor;
      ctx.lineWidth = isHovered ? 2.2 : 1.5;

      for (let arm = 0; arm < 3; arm++) {
        const armAngle = (arm * Math.PI * 2) / 3;
        ctx.beginPath();
        for (let step = 0; step <= 8; step++) {
          const t = step / 8;
          const r = (3 + t * 9) * spotScale;
          const a = armAngle + t * 2.4;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (step === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // 3. Center Abyss Core glyph
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 * spotScale, 0, Math.PI * 2);
      ctx.fill();

      // 4. Hover highlight circle
      if (isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private renderVessel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    boatPos: Vector2,
    boatHeading: number
  ): void {
    const pos = this.worldToChart(boatPos.x, boatPos.y, width, height);

    ctx.save();

    // 1. Expanding sonar radar ping ripple
    const pingProgress = (this.time * 0.75) % 1.0;
    const pingRadius = 6 + pingProgress * 24;
    const pingAlpha = (1.0 - pingProgress) * 0.85;

    ctx.strokeStyle = `rgba(56, 189, 248, ${pingAlpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pingRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Directional Heading Indicator Arrow
    const arrowLen = 22;
    const arrowX = pos.x + Math.cos(boatHeading) * arrowLen;
    const arrowY = pos.y + Math.sin(boatHeading) * arrowLen;

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(arrowX, arrowY);
    ctx.stroke();

    // Arrow arrowhead
    const arrowHeadAngle1 = boatHeading + Math.PI * 0.82;
    const arrowHeadAngle2 = boatHeading - Math.PI * 0.82;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + Math.cos(arrowHeadAngle1) * 6, arrowY + Math.sin(arrowHeadAngle1) * 6);
    ctx.lineTo(arrowX + Math.cos(arrowHeadAngle2) * 6, arrowY + Math.sin(arrowHeadAngle2) * 6);
    ctx.closePath();
    ctx.fill();

    // 3. Vessel Boat Icon
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.0;
    ctx.font = 'bold 18px "Segoe UI Symbol", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('⛵', pos.x, pos.y);
    ctx.fillText('⛵', pos.x, pos.y);

    // 4. Vessel Tag Label
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('HMS Angler (You)', pos.x + 14, pos.y - 6);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText(`${Math.round(boatPos.x)}, ${Math.round(boatPos.y)}`, pos.x + 14, pos.y + 7);

    ctx.restore();
  }

  private renderLegendAndScale(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const s = this.getScale(width, height);

    ctx.save();

    // Legend panel box
    const legW = 260;
    const legH = 84;
    ctx.fillStyle = 'rgba(10, 20, 30, 0.88)';
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    this.drawRoundRect(ctx, x, y, legW, legH, 6);
    ctx.fill();
    ctx.stroke();

    // Scale Bar (1,000m metric scale)
    const scaleBarMeters = 1000;
    const scaleBarPx = scaleBarMeters * s;
    const barX = x + 14;
    const barY = y + 20;

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + scaleBarPx, barY);
    // Ticks
    ctx.moveTo(barX, barY - 4);
    ctx.lineTo(barX, barY + 4);
    ctx.moveTo(barX + scaleBarPx, barY - 4);
    ctx.lineTo(barX + scaleBarPx, barY + 4);
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('— 1,000m —', barX + scaleBarPx + 8, barY);

    // Symbols Legend
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('⚓ Harbor  •  ⛵ You  •  🌀 Whirlpool', x + 14, y + 42);

    // Zone Color Dots
    ctx.fillStyle = '#10b981';
    ctx.fillText('● Z1', x + 14, y + 64);
    ctx.fillStyle = '#2dd4bf';
    ctx.fillText('● Z2', x + 60, y + 64);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('● Z3', x + 106, y + 64);
    ctx.fillStyle = '#c084fc';
    ctx.fillText('● Z4 (Abyss)', x + 152, y + 64);

    ctx.restore();
  }

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    panelX: number,
    panelY: number,
    panelW: number
  ): void {
    ctx.save();

    // Title banner background
    const barH = 46;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.drawRoundRect(ctx, panelX, panelY, panelW, barH, 12);
    ctx.fill();
    ctx.stroke();

    // Chart Title
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px "Georgia", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧭 NAUTICAL SEA CHART — INNSMOUTH REACH', panelX + 20, panelY + barH / 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText('8,000m × 8,000m OVERWORLD EXPANSE', panelX + 430, panelY + barH / 2);

    // Quick Action Buttons (Center Ship, Reset, Close)
    const rightMargin = panelX + panelW - 14;

    // Close button [✕]
    this.closeBtn.w = 32;
    this.closeBtn.h = 30;
    this.closeBtn.x = rightMargin - this.closeBtn.w;
    this.closeBtn.y = panelY + 8;

    ctx.fillStyle = this.closeBtn.hovered ? '#ef4444' : 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = this.closeBtn.hovered ? '#fca5a5' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, this.closeBtn.x, this.closeBtn.y, this.closeBtn.w, this.closeBtn.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', this.closeBtn.x + this.closeBtn.w / 2, this.closeBtn.y + this.closeBtn.h / 2);

    // Reset button [Reset (R)]
    this.resetBtn.w = 88;
    this.resetBtn.h = 30;
    this.resetBtn.x = this.closeBtn.x - this.resetBtn.w - 10;
    this.resetBtn.y = panelY + 8;

    ctx.fillStyle = this.resetBtn.hovered ? '#334155' : 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = this.resetBtn.hovered ? '#fde047' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, this.resetBtn.x, this.resetBtn.y, this.resetBtn.w, this.resetBtn.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.resetBtn.hovered ? '#fde047' : '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillText('Reset [R]', this.resetBtn.x + this.resetBtn.w / 2, this.resetBtn.y + this.resetBtn.h / 2);

    // Center button [Center Ship (C)]
    this.centerBtn.w = 118;
    this.centerBtn.h = 30;
    this.centerBtn.x = this.resetBtn.x - this.centerBtn.w - 10;
    this.centerBtn.y = panelY + 8;

    ctx.fillStyle = this.centerBtn.hovered ? '#334155' : 'rgba(30, 41, 59, 0.85)';
    ctx.strokeStyle = this.centerBtn.hovered ? '#38bdf8' : '#64748b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    this.drawRoundRect(ctx, this.centerBtn.x, this.centerBtn.y, this.centerBtn.w, this.centerBtn.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.centerBtn.hovered ? '#38bdf8' : '#cbd5e1';
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillText('Center Ship [C]', this.centerBtn.x + this.centerBtn.w / 2, this.centerBtn.y + this.centerBtn.h / 2);

    // Footer Help Bar
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(
      `[Drag to Pan] • [Scroll to Zoom (${this.zoom.toFixed(1)}x)] • [M / Tab / Esc to Close]`,
      panelX + panelW - 20,
      panelY + barH + 20
    );

    ctx.restore();
  }

  private renderWhirlpoolTooltip(
    ctx: CanvasRenderingContext2D,
    spot: FishingSpot,
    width: number,
    height: number
  ): void {
    const mouse = this.mousePos;
    const cardW = 240;
    const cardH = 110;
    let cardX = mouse.x + 16;
    let cardY = mouse.y + 16;

    // Keep tooltip inside canvas
    if (cardX + cardW > width - 30) cardX = mouse.x - cardW - 16;
    if (cardY + cardH > height - 30) cardY = mouse.y - cardH - 16;

    ctx.save();

    // Card background
    ctx.fillStyle = 'rgba(7, 18, 29, 0.95)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    this.drawRoundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // Spot Title
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`🌀 ${spot.name}`, cardX + 12, cardY + 10);

    // Zone & Species
    const species = FISH_REGISTRY[spot.speciesType];
    const speciesName = species ? species.speciesName : spot.speciesType;
    const speciesRarity = species ? species.rarity.toUpperCase() : 'COMMON';

    ctx.fillStyle = '#fde047';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText(`Fish: ${speciesName}`, cardX + 12, cardY + 32);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillText(`Tier: ${spot.zoneType.toUpperCase()} • Rarity: ${speciesRarity}`, cardX + 12, cardY + 50);

    // State & Duration
    const remainingTime = Math.max(0, Math.round(spot.activeDuration - spot.timer));
    let stateColor = '#34d399';
    if (spot.state === 'SPAWNING') stateColor = '#f59e0b';
    else if (spot.state === 'DESPAWNING') stateColor = '#ef4444';

    ctx.fillStyle = stateColor;
    ctx.font = 'bold 11px monospace';
    const stateStr = spot.isFishingLocked
      ? `STATE: ${spot.state.toUpperCase()} [🔒 LOCKED]`
      : `STATE: ${spot.state.toUpperCase()} (${remainingTime}s left)`;
    ctx.fillText(stateStr, cardX + 12, cardY + 70);

    // Proximity hint
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillText('Sail within 120px to cast line & freeze despawn', cardX + 12, cardY + 90);

    ctx.restore();
  }

  private drawRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number = 0
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

export default SeaChartOverlay;
