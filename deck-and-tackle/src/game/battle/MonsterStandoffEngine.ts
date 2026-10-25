/**
 * MonsterStandoffEngine.ts
 * 2-Phase Standoff Engine against Ambush Sea Beasts (Harpoon Tethering & Weak Point Targeting).
 * Implements Milestone 4 (ORIGINAL_REQUEST §R4, PROJECT.md Feature 15).
 */

import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';
import { PlayerInventory } from '../player/PlayerInventory';
import type { ICombatEngine } from './NavalBattleEngine';
import type { NavalCardData } from './NavalCardData';
import { AUTHORITATIVE_NAVAL_CARDS } from './NavalCardData';

export interface SeaBeastConfig {
  name: string;
  maxHp: number;
  speed: number;
  goldReward: number;
  spriteAssetKey?: string;
  zoneTier?: number;
}

export type StandoffPhase = 1 | 2;

export interface WeakPoint {
  id: string;
  name: string;
  xRatio: number; // 0..1 relative to beast bounding box
  yRatio: number;
  radius: number;
  isActive: boolean;
}

export class MonsterStandoffEngine implements ICombatEngine {
  private inventory: PlayerInventory;
  private onFinishedCallback?: (result: 'victory' | 'defeat' | 'fled', rewardGold: number) => void;

  // Standoff Phase Architecture (1: Tethering -> 2: Weak Points)
  public phase: StandoffPhase = 1;

  // Beast Stats & State
  public beastName: string = 'Kelp Leviathan';
  public beastHp: number = 130;
  public beastMaxHp: number = 130;
  public goldReward: number = 65;

  // Phase 1: Harpoon Tethering Telemetry
  public tetherMeter: number = 0; // 0 to 100%
  public harpoonsAnchored: number = 0;
  public lineTension: number = 0; // 0 to 100%
  public chargeCountdown: number = 5.0; // Seconds until next ram
  public chargeMaxDuration: number = 5.0;
  public cableSnapped: boolean = false;
  public ramImpact: boolean = false;

  // Phase 2: Weak Point Targeting Telemetry
  public isEnraged: boolean = false;
  public weakPoints: WeakPoint[] = [];
  public activeWeakPointIndex: number = 0;
  public weakPointShiftTimer: number = 3.0;

  // Player Telemetry & Naval Hand
  public playerHull: number = 60;
  public playerMaxHull: number = 60;
  public playerStamina: number = 3;
  public playerMaxStamina: number = 3;
  public drawPile: NavalCardData[] = [];
  public hand: NavalCardData[] = [];
  public discardPile: NavalCardData[] = [];

  // Combat Status
  public combatFinished: boolean = false;
  public combatResult: 'victory' | 'defeat' | 'fled' = 'fled';
  public combatLog: string[] = ['Apex sea beast surfaced! Tether the monster before it rams!'];

  // Animation & Visual State
  private time: number = 0;
  private splashParticles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; life: number }> = [];

  // Interactive UI Hitboxes
  private fireHarpoonBtnRect = { x: 0, y: 0, w: 160, h: 40 };
  private easeCableBtnRect = { x: 0, y: 0, w: 160, h: 40 };
  private cardRects: Array<{ x: number; y: number; w: number; h: number; card: NavalCardData }> = [];
  private hoveredCardIndex: number = -1;

  constructor(
    inventory: PlayerInventory,
    beast?: Partial<SeaBeastConfig>,
    onFinished?: (result: 'victory' | 'defeat' | 'fled', rewardGold: number) => void
  ) {
    this.inventory = inventory;
    this.onFinishedCallback = onFinished;

    this.playerHull = this.inventory.hullHp || 60;
    this.playerMaxHull = this.inventory.maxHullHp || 60;
    this.playerMaxStamina = this.inventory.maxStamina || 3;
    this.playerStamina = this.playerMaxStamina;

    if (beast) {
      this.beastName = beast.name ?? 'Kelp Leviathan';
      this.beastMaxHp = beast.maxHp ?? 130;
      this.beastHp = this.beastMaxHp;
      this.goldReward = beast.goldReward ?? 65;
    }

    this.initWeakPoints();
  }

  private initWeakPoints(): void {
    this.weakPoints = [
      { id: 'eye', name: 'Glowing Abyssal Eye', xRatio: 0.35, yRatio: 0.30, radius: 24, isActive: true },
      { id: 'gill', name: 'Pulsing Gill Slit', xRatio: 0.55, yRatio: 0.45, radius: 22, isActive: false },
      { id: 'underbelly', name: 'Vulnerable Underbelly Scute', xRatio: 0.70, yRatio: 0.60, radius: 26, isActive: false }
    ];
  }

  public init(): void {
    this.phase = 1;
    this.tetherMeter = 0;
    this.harpoonsAnchored = 0;
    this.lineTension = 15;
    this.chargeCountdown = 5.0;
    this.cableSnapped = false;
    this.ramImpact = false;
    this.isEnraged = false;
    this.combatFinished = false;

    // Load naval deck
    const copy = this.inventory.getNavalDeckCopy();
    if (copy.length > 0) {
      this.drawPile = [...copy];
    } else {
      this.drawPile = [
        { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
        { ...AUTHORITATIVE_NAVAL_CARDS.broadside },
        { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing },
        { ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }
      ];
    }

    this.hand = [];
    this.discardPile = [];
    this.drawCards(4);
    AudioManager.getInstance().playCardDraw();
  }

  public drawCards(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.hand.length >= 5) break;
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = [...this.discardPile];
        this.discardPile = [];
      }
      const c = this.drawPile.pop();
      if (c) this.hand.push(c);
    }
  }

  // Phase 1 Action: Fire & Anchor Harpoon
  public fireHarpoon(): boolean {
    if (this.phase !== 1 || this.combatFinished) return false;
    if (this.playerStamina < 1) {
      this.combatLog.unshift('Not enough stamina to launch harpoon cable!');
      return false;
    }

    this.playerStamina -= 1;
    this.harpoonsAnchored++;
    this.tetherMeter = Math.min(100, this.tetherMeter + 35);
    this.lineTension += 20;

    AudioManager.getInstance().playCastWhoosh();
    this.spawnSplash(600, 320, 10);
    this.combatLog.unshift(`Harpoon iron sunk! Tether at ${this.tetherMeter}%, Tension at ${this.lineTension}%.`);

    // Check Cable Snap boundary: tension >= 100%
    if (this.lineTension >= 100) {
      this.cableSnapped = true;
      this.playerHull = Math.max(0, this.playerHull - 10);
      this.inventory.hullHp = this.playerHull;
      this.lineTension = 0;
      this.harpoonsAnchored = Math.max(0, this.harpoonsAnchored - 1);
      this.tetherMeter = Math.max(0, this.tetherMeter - 30);
      this.combatLog.unshift('CABLE SNAP! Whipping iron snapped and inflicted -10 Hull damage!');
      AudioManager.getInstance().playLineSnap();

      if (this.playerHull <= 0) {
        this.resolveDefeat();
        return false;
      }
    }

    // Check Phase 1 Completion: 2+ harpoons or 100% tether
    if (this.harpoonsAnchored >= 2 || this.tetherMeter >= 100) {
      this.transitionToPhase2();
    }

    return true;
  }

  // Phase 1 Action: Ease Cable Winch (Reduces Tension)
  public easeCable(): void {
    if (this.phase !== 1 || this.combatFinished) return;
    this.lineTension = Math.max(0, this.lineTension - 25);
    this.combatLog.unshift(`Eased winch drag. Tension safely reduced to ${this.lineTension}%.`);
    AudioManager.getInstance().playWaterLap();
  }

  private transitionToPhase2(): void {
    this.phase = 2;
    this.combatLog.unshift('BEAST ANCHORED! Phase 2: Weak points exposed! Strike for 2.0x Critical Damage!');
    AudioManager.getInstance().playFishThrash();
    this.playerStamina = this.playerMaxStamina;
  }

  // Phase 2 Action: Play naval card or target weak spot
  public attackTarget(baseDamage: number, isWeakPoint: boolean = false): number {
    const multiplier = isWeakPoint ? 2.0 : 1.0;
    const finalDmg = Math.round(baseDamage * multiplier);

    this.beastHp = Math.max(0, this.beastHp - finalDmg);
    this.spawnSplash(650, 320, isWeakPoint ? 16 : 8);

    if (isWeakPoint) {
      this.combatLog.unshift(`CRITICAL WEAK POINT HIT! Struck for ${finalDmg} DMG (2.0x Multiplier)!`);
      AudioManager.getInstance().playCardPlay('technique');
    } else {
      this.combatLog.unshift(`Hit sea beast for ${finalDmg} Damage.`);
      AudioManager.getInstance().playCardPlay('strike');
    }

    // Check enrage boundary: <25% max HP
    if (this.beastHp / this.beastMaxHp < 0.25 && !this.isEnraged) {
      this.isEnraged = true;
      this.combatLog.unshift('BEAST ENRAGED! Thrashing with cataclysmic abyssal fury!');
      AudioManager.getInstance().playFishThrash();
    }

    // Check victory: beastHp === 0
    if (this.beastHp <= 0) {
      this.beastHp = 0;
      this.resolveVictory();
    }

    return finalDmg;
  }

  public playCard(index: number): boolean {
    if (this.combatFinished) return false;
    if (index < 0 || index >= this.hand.length) return false;

    const card = this.hand[index];
    if (this.playerStamina < card.staminaCost) {
      this.combatLog.unshift(`Not enough stamina for ${card.title}!`);
      return false;
    }

    this.playerStamina -= card.staminaCost;
    this.hand.splice(index, 1);
    this.discardPile.push(card);

    if (this.phase === 1) {
      // In Phase 1, attack cards deal minor damage and contribute +15% tether
      if (card.damage > 0) {
        this.beastHp = Math.max(0, this.beastHp - card.damage);
        this.tetherMeter = Math.min(100, this.tetherMeter + 15);
        this.combatLog.unshift(`${card.title} fired! Sunk harpoon barb (+15% Tether).`);
        if (this.tetherMeter >= 100) {
          this.transitionToPhase2();
        }
      }
    } else {
      // Phase 2: Weak Point targeting
      if (card.damage > 0) {
        // Active weak point hit bonus if card is played
        const isCrit = card.id === 'naval_broadside' || card.id === 'naval_harpoon_snare' || Math.random() > 0.4;
        this.attackTarget(card.damage, isCrit);
      }
    }

    if (card.armorGain > 0) {
      this.combatLog.unshift(`Braced timbers against thrashing tentacles.`);
    }

    if (card.hullRepair > 0) {
      this.playerHull = Math.min(this.playerMaxHull, this.playerHull + card.hullRepair);
      this.inventory.hullHp = this.playerHull;
      this.combatLog.unshift(`Repaired +${card.hullRepair} Hull HP.`);
    }

    return true;
  }

  private resolveVictory(): void {
    this.combatFinished = true;
    this.combatResult = 'victory';
    this.inventory.addGold(this.goldReward);
    // Also award high grade bait upon apex kill
    this.inventory.addBait('bio_squid', 1);

    this.combatLog.unshift(`VICTORY! Monstrous beast sank into the dark! Recovered ${this.goldReward}g and Biolum Squid!`);
    AudioManager.getInstance().playCatchVictory();

    if (this.onFinishedCallback) {
      setTimeout(() => {
        this.onFinishedCallback?.('victory', this.goldReward);
      }, 1500);
    }
  }

  private resolveDefeat(): void {
    this.combatFinished = true;
    this.combatResult = 'defeat';
    this.combatLog.unshift('DEFEAT! Your vessel was smashed and dragged under by the apex leviathan.');
    AudioManager.getInstance().playLineSnap();

    if (this.onFinishedCallback) {
      setTimeout(() => {
        this.onFinishedCallback?.('defeat', 0);
      }, 1500);
    }
  }

  public update(dt: number): void {
    this.time += dt;

    // Phase 1 Ram Countdown
    if (this.phase === 1 && !this.combatFinished) {
      this.chargeCountdown -= dt;
      if (this.chargeCountdown <= 0) {
        // Ram Impact
        this.ramImpact = true;
        this.chargeCountdown = this.chargeMaxDuration;
        const ramDmg = 16;
        this.playerHull = Math.max(0, this.playerHull - ramDmg);
        this.inventory.hullHp = this.playerHull;
        this.spawnSplash(380, 360, 14);
        this.combatLog.unshift(`RAMMING IMPACT! Leviathan lunged and smashed hull for ${ramDmg} DMG!`);
        AudioManager.getInstance().playDockBump();

        if (this.playerHull <= 0) {
          this.resolveDefeat();
          return;
        }
      }
    }

    // Phase 2 Weak Point Shifting & Beast Counter-Attacks
    if (this.phase === 2 && !this.combatFinished) {
      this.weakPointShiftTimer -= dt;
      if (this.weakPointShiftTimer <= 0) {
        this.weakPointShiftTimer = this.isEnraged ? 1.8 : 3.0;
        this.activeWeakPointIndex = (this.activeWeakPointIndex + 1) % this.weakPoints.length;
        this.weakPoints.forEach((wp, idx) => {
          wp.isActive = idx === this.activeWeakPointIndex;
        });

        // Periodic tentacle lash counter-attack
        const lashDmg = this.isEnraged ? 15 : 9;
        this.playerHull = Math.max(0, this.playerHull - lashDmg);
        this.inventory.hullHp = this.playerHull;
        this.combatLog.unshift(`Tentacle lash struck deck for ${lashDmg} DMG!`);
        AudioManager.getInstance().playFishThrash();

        if (this.playerHull <= 0) {
          this.resolveDefeat();
          return;
        }
      }
    }

    // Stamina Regeneration (every 3 seconds)
    if (Math.floor(this.time) % 3 === 0 && Math.floor(this.time - dt) % 3 !== 0) {
      if (this.playerStamina < this.playerMaxStamina) {
        this.playerStamina = Math.min(this.playerMaxStamina, this.playerStamina + 1);
        this.drawCards(1);
      }
    }

    // Particle simulation
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const sp = this.splashParticles[i];
      sp.life -= dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vy += 60 * dt; // gravity
      sp.alpha = Math.max(0, sp.life / 0.8);
      if (sp.life <= 0) {
        this.splashParticles.splice(i, 1);
      }
    }

    // Input Handling
    if (!this.combatFinished) {
      const mousePos = Input.getMousePosition();

      // Phase 1 Buttons
      if (this.phase === 1) {
        if (
          mousePos.x >= this.fireHarpoonBtnRect.x &&
          mousePos.x <= this.fireHarpoonBtnRect.x + this.fireHarpoonBtnRect.w &&
          mousePos.y >= this.fireHarpoonBtnRect.y &&
          mousePos.y <= this.fireHarpoonBtnRect.y + this.fireHarpoonBtnRect.h &&
          Input.isMouseClicked()
        ) {
          this.fireHarpoon();
        }

        if (
          mousePos.x >= this.easeCableBtnRect.x &&
          mousePos.x <= this.easeCableBtnRect.x + this.easeCableBtnRect.w &&
          mousePos.y >= this.easeCableBtnRect.y &&
          mousePos.y <= this.easeCableBtnRect.y + this.easeCableBtnRect.h &&
          Input.isMouseClicked()
        ) {
          this.easeCable();
        }
      }

      // Check Cards
      this.hoveredCardIndex = -1;
      for (let i = 0; i < this.cardRects.length; i++) {
        const cr = this.cardRects[i];
        if (
          mousePos.x >= cr.x &&
          mousePos.x <= cr.x + cr.w &&
          mousePos.y >= cr.y &&
          mousePos.y <= cr.y + cr.h
        ) {
          this.hoveredCardIndex = i;
          if (Input.isMouseClicked()) {
            this.playCard(i);
            break;
          }
        }
      }

      // Phase 2: Clicking Weak Point directly deals swivel gun hit
      if (this.phase === 2 && Input.isMouseClicked()) {
        const beastX = 640;
        const beastY = 320;
        const activeWp = this.weakPoints[this.activeWeakPointIndex];
        if (activeWp) {
          const wpX = beastX + (activeWp.xRatio - 0.5) * 160;
          const wpY = beastY + (activeWp.yRatio - 0.5) * 120;
          const dx = mousePos.x - wpX;
          const dy = mousePos.y - wpY;
          if (Math.sqrt(dx * dx + dy * dy) <= activeWp.radius + 10) {
            this.attackTarget(14, true);
          }
        }
      }

      // Keyboard shortcuts
      if (Input.isJustPressed('space') && this.phase === 1) this.fireHarpoon();
      if (Input.isJustPressed('keyq') && this.phase === 1) this.easeCable();
      if (Input.isJustPressed('digit1')) this.playCard(0);
      if (Input.isJustPressed('digit2')) this.playCard(1);
      if (Input.isJustPressed('digit3')) this.playCard(2);
      if (Input.isJustPressed('digit4')) this.playCard(3);
    }
  }

  private spawnSplash(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.splashParticles.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 15,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 80,
        radius: 2 + Math.random() * 3,
        alpha: 0.9,
        life: 0.8
      });
    }
  }

  public isFinished(): boolean {
    return this.combatFinished;
  }

  public getResult(): 'victory' | 'defeat' | 'fled' {
    return this.combatResult;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Abyssal Ocean & Dark Sky Diorama
    this.renderBackdrop(ctx, width, height);

    // 2. Surfaced Sea Beast with Thrashing Tentacles
    this.renderSeaBeast(ctx, width, height);

    // 3. Player Vessel & Harpoon Cables
    this.renderPlayerVessel(ctx, width, height);

    // 4. Splashes & Particles
    this.renderSplashes(ctx);

    // 5. Phase-Specific Telemetry HUD
    this.renderTelemetry(ctx, width, height);

    // 6. Action Cards & Controls
    this.renderControls(ctx, width, height);

    // 7. Combat Log
    this.renderLog(ctx, width, height);

    // 8. End Banner
    if (this.combatFinished) {
      this.renderEndBanner(ctx, width, height);
    }

    ctx.restore();
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.6);
    sky.addColorStop(0, '#020617');
    sky.addColorStop(0.5, '#0f172a');
    sky.addColorStop(1, '#064e3b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Deep water
    const waterY = height * 0.55;
    ctx.fillStyle = '#022c22';
    ctx.fillRect(0, waterY, width, height - waterY);

    // Violent ocean swells
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 15) {
      const y = waterY + Math.sin(x * 0.02 + this.time * 3.0) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  private renderSeaBeast(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const beastX = width * 0.72;
    const beastY = height * 0.52 + Math.sin(this.time * 2.5) * 12;

    ctx.save();
    ctx.translate(beastX, beastY);

    // Thrashing Tentacles
    for (let i = 0; i < 4; i++) {
      ctx.save();
      const tX = -70 + i * 45;
      const tAngle = Math.sin(this.time * 3.5 + i * 1.2) * 0.45;
      ctx.translate(tX, -10);
      ctx.rotate(tAngle);

      ctx.fillStyle = '#064e3b';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;

      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-18, -60, -5, -95);
      ctx.lineTo(5, -95);
      ctx.quadraticCurveTo(12, -60, 10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Barbed suckers
      ctx.fillStyle = '#f87171';
      for (let s = -20; s > -85; s -= 18) {
        ctx.beginPath();
        ctx.arc(-8, s, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Colossal Monster Head / Body
    ctx.fillStyle = this.isEnraged ? '#7f1d1d' : '#042f2e';
    ctx.strokeStyle = this.isEnraged ? '#ef4444' : '#10b981';
    ctx.lineWidth = 3.0;

    ctx.beginPath();
    ctx.ellipse(0, 0, 95, 65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Menacing jaws / chitin teeth
    ctx.fillStyle = '#f1f5f9';
    for (let t = -50; t <= 50; t += 20) {
      ctx.beginPath();
      ctx.moveTo(t, 25);
      ctx.lineTo(t + 8, 45);
      ctx.lineTo(t + 16, 25);
      ctx.fill();
    }

    // Phase 2 Weak Points Reticle
    if (this.phase === 2) {
      for (const wp of this.weakPoints) {
        const wpX = (wp.xRatio - 0.5) * 160;
        const wpY = (wp.yRatio - 0.5) * 120;

        ctx.save();
        ctx.translate(wpX, wpY);

        if (wp.isActive) {
          // Pulsing reticle
          const pulse = 1.0 + Math.sin(this.time * 6.0) * 0.15;
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, wp.radius * pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Glowing bullseye center
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'center';
          ctx.fillText('CRIT (2.0x)', 0, -wp.radius - 4);
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(0, 0, wp.radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    ctx.restore();
  }

  private renderPlayerVessel(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const vesselX = width * 0.28;
    const vesselY = height * 0.54 + Math.sin(this.time * 2.0) * 8;

    ctx.save();
    ctx.translate(vesselX, vesselY);

    // Vessel Hull
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-60, -15);
    ctx.lineTo(50, -15);
    ctx.lineTo(70, 5);
    ctx.lineTo(35, 25);
    ctx.lineTo(-50, 25);
    ctx.lineTo(-70, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy Harpoon Ballista Mount
    ctx.fillStyle = '#78350f';
    ctx.fillRect(25, -28, 26, 14);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(35, -20);
    ctx.lineTo(60, -26);
    ctx.stroke();

    ctx.restore();

    // Tether cables from vessel to sea beast
    if (this.harpoonsAnchored > 0 || this.phase === 2) {
      const beastX = width * 0.72;
      const beastY = height * 0.52;

      ctx.save();
      ctx.strokeStyle = this.lineTension > 75 ? '#ef4444' : '#e2e8f0';
      ctx.lineWidth = 2.0;

      for (let i = 0; i < Math.max(1, this.harpoonsAnchored); i++) {
        const sag = Math.max(0, 50 - this.lineTension * 0.5);
        ctx.beginPath();
        ctx.moveTo(vesselX + 55, vesselY - 20);
        ctx.quadraticCurveTo((vesselX + beastX) / 2, (vesselY + beastY) / 2 + sag, beastX - 40, beastY - 10 + i * 15);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderSplashes(ctx: CanvasRenderingContext2D): void {
    for (const sp of this.splashParticles) {
      ctx.fillStyle = `rgba(167, 243, 208, ${sp.alpha})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderTelemetry(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    // Header Telemetry
    ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
    ctx.fillRect(0, 0, width, 84);
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, width, 84);

    // Player Hull
    const pX = 40;
    const pY = 24;
    ctx.font = 'bold 13px "Cinzel", serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`⚓ YOUR VESSEL  •  STAMINA: ${this.playerStamina}/${this.playerMaxStamina} ⚡`, pX, pY - 6);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(pX, pY, 200, 16);
    ctx.fillStyle = this.playerHull / this.playerMaxHull > 0.3 ? '#10b981' : '#ef4444';
    ctx.fillRect(pX, pY, 200 * (this.playerHull / this.playerMaxHull), 16);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(pX, pY, 200, 16);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.playerHull}/${this.playerMaxHull} HP`, pX + 8, pY + 12);

    // Beast Status (Right)
    const eX = width - 240;
    const eY = 24;
    ctx.font = 'bold 13px "Cinzel", serif';
    ctx.fillStyle = this.isEnraged ? '#ef4444' : '#34d399';
    ctx.textAlign = 'right';
    ctx.fillText(`☣ ${this.beastName} ${this.isEnraged ? '(ENRAGED)' : ''}`, eX + 200, eY - 6);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(eX, eY, 200, 16);
    ctx.fillStyle = this.isEnraged ? '#dc2626' : '#059669';
    ctx.fillRect(eX, eY, 200 * (this.beastHp / this.beastMaxHp), 16);
    ctx.strokeStyle = '#047857';
    ctx.strokeRect(eX, eY, 200, 16);

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.beastHp}/${this.beastMaxHp} HP`, eX + 8, eY + 12);

    // Center Phase Banner & Telemetry
    const cX = width / 2;
    ctx.textAlign = 'center';

    if (this.phase === 1) {
      ctx.font = 'bold 13px "Cinzel", serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText(`PHASE 1: HARPOON TETHERING (CHARGE IN ${this.chargeCountdown.toFixed(1)}s)`, cX, 22);

      // Tether & Tension Dual Meter
      const barW = 260;
      const barH = 12;

      // Tether Meter
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cX - barW / 2, 34, barW, barH);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(cX - barW / 2, 34, barW * (this.tetherMeter / 100), barH);
      ctx.strokeStyle = '#0284c7';
      ctx.strokeRect(cX - barW / 2, 34, barW, barH);

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`TETHER: ${this.tetherMeter}% (Anchored: ${this.harpoonsAnchored})`, cX, 44);

      // Tension Meter
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(cX - barW / 2, 54, barW, barH);
      ctx.fillStyle = this.lineTension > 75 ? '#ef4444' : '#eab308';
      ctx.fillRect(cX - barW / 2, 54, barW * (this.lineTension / 100), barH);
      ctx.strokeStyle = '#b45309';
      ctx.strokeRect(cX - barW / 2, 54, barW, barH);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(`CABLE TENSION: ${this.lineTension}% (SNAP WARNING AT 100%)`, cX, 64);
    } else {
      ctx.font = 'bold 14px "Cinzel", serif';
      ctx.fillStyle = '#ef4444';
      ctx.fillText('✦ PHASE 2: WEAK POINT TARGETING (2.0x CRITICAL DAMAGE) ✦', cX, 30);

      ctx.font = 'italic 11px Georgia, serif';
      ctx.fillStyle = '#fde047';
      const activeWp = this.weakPoints[this.activeWeakPointIndex];
      ctx.fillText(`Target Exposed: ${activeWp?.name ?? 'Glowing Eye'} — Strike with Cannons or Harpoon!`, cX, 55);
    }
  }

  private renderControls(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Phase 1 Interactive Buttons
    if (this.phase === 1) {
      this.fireHarpoonBtnRect = { x: 40, y: height - 120, w: 170, h: 42 };
      this.easeCableBtnRect = { x: 225, y: height - 120, w: 170, h: 42 };

      // Button 1: Fire Harpoon
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(this.fireHarpoonBtnRect.x, this.fireHarpoonBtnRect.y, this.fireHarpoonBtnRect.w, this.fireHarpoonBtnRect.h, 6);
      ctx.fillStyle = '#047857';
      ctx.fill();
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = 'bold 11px "Cinzel", serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FIRE HARPOON [SPACE]', this.fireHarpoonBtnRect.x + this.fireHarpoonBtnRect.w / 2, this.fireHarpoonBtnRect.y + 21);

      // Button 2: Ease Cable
      ctx.beginPath();
      ctx.roundRect(this.easeCableBtnRect.x, this.easeCableBtnRect.y, this.easeCableBtnRect.w, this.easeCableBtnRect.h, 6);
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillText('EASE WINCH [Q]', this.easeCableBtnRect.x + this.easeCableBtnRect.w / 2, this.easeCableBtnRect.y + 21);
      ctx.restore();
    }

    // Render Hand Cards (Bottom center)
    const cardW = 110;
    const cardH = 140;
    const gap = 12;
    const totalW = this.hand.length * cardW + (this.hand.length - 1) * gap;
    const startX = width - totalW - 40;
    const startY = height - cardH - 20;

    this.cardRects = [];

    for (let i = 0; i < this.hand.length; i++) {
      const card = this.hand[i];
      const cx = startX + i * (cardW + gap);
      const isHovered = this.hoveredCardIndex === i;
      const cy = isHovered ? startY - 12 : startY;

      this.cardRects.push({ x: cx, y: cy, w: cardW, h: cardH, card });

      const canAfford = this.playerStamina >= card.staminaCost;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx, cy, cardW, cardH, 6);
      ctx.fillStyle = canAfford ? (isHovered ? '#0f291e' : '#042f2e') : '#18181b';
      ctx.fill();
      ctx.strokeStyle = canAfford ? (isHovered ? '#facc15' : '#34d399') : '#52525b';
      ctx.lineWidth = isHovered ? 2.0 : 1.2;
      ctx.stroke();

      // Stamina cost
      ctx.fillStyle = canAfford ? '#059669' : '#52525b';
      ctx.beginPath();
      ctx.arc(cx + 14, cy + 14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${card.staminaCost}`, cx + 14, cy + 14);

      // Title
      ctx.font = 'bold 10px "Cinzel", serif';
      ctx.fillStyle = canAfford ? '#fef08a' : '#9ca3af';
      ctx.fillText(card.title, cx + cardW / 2 + 6, cy + 18, cardW - 32);

      // Stat
      ctx.font = 'bold 9.5px sans-serif';
      ctx.fillStyle = '#34d399';
      let st = card.damage > 0 ? `${card.damage} DMG` : (card.armorGain > 0 ? `+${card.armorGain} Arm` : `+${card.hullRepair} HP`);
      ctx.fillText(st, cx + cardW / 2, cy + 42);

      // Desc
      ctx.font = 'italic 8px Georgia, serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(card.description, cx + 8, cy + 64, cardW - 16);

      ctx.restore();
    }
  }

  private renderLog(ctx: CanvasRenderingContext2D, _width: number, height: number): void {
    const logX = 40;
    const logY = height - 60;
    const logW = 355;
    const logH = 46;

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
    ctx.beginPath();
    ctx.roundRect(logX, logY, logW, logH, 4);
    ctx.fill();
    ctx.strokeStyle = '#065f46';
    ctx.stroke();

    ctx.font = 'italic 9px Georgia, serif';
    ctx.fillStyle = '#a7f3d0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < Math.min(2, this.combatLog.length); i++) {
      ctx.fillText(this.combatLog[i], logX + 8, logY + 18 + i * 16, logW - 16);
    }
    ctx.restore();
  }

  private renderEndBanner(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const isVictory = this.combatResult === 'victory';
    const bannerW = 460;
    const bannerH = 140;
    const bx = Math.floor((width - bannerW) / 2);
    const by = Math.floor((height - bannerH) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 8);
    ctx.fill();
    ctx.strokeStyle = isVictory ? '#34d399' : '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 24px "Cinzel", serif';
    ctx.fillStyle = isVictory ? '#34d399' : '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isVictory ? 'APEX BEAST DEFEATED' : 'VESSEL DRAGGED UNDER', bx + bannerW / 2, by + 40);

    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(
      isVictory ? `Apex monster slayed! Awarded +${this.goldReward}g and Biolum Squid.` : 'Your vessel hull was crushed by the primordial titan.',
      bx + bannerW / 2,
      by + 76
    );

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Returning to overworld ocean...', bx + bannerW / 2, by + 108);

    ctx.restore();
  }
}
