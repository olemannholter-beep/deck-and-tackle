/**
 * NavalBattleEngine.ts
 * Side-angle broadside card combat engine against hostile patrol warships.
 * Implements Milestone 4 (ORIGINAL_REQUEST §R4, PROJECT.md Features 13 & 14).
 */

import { Input } from '../../engine/Input';
import { AudioManager } from '../../engine/AudioManager';
import { PlayerInventory } from '../player/PlayerInventory';
import type { NavalCardData } from './NavalCardData';
import { AUTHORITATIVE_NAVAL_CARDS } from './NavalCardData';

export interface ICombatEngine {
  init(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  isFinished(): boolean;
  getResult(): 'victory' | 'defeat' | 'fled';
}

export interface EnemyShipConfig {
  name: string;
  maxHp: number;
  armor: number;
  baseDamage: number;
  goldReward: number;
  spriteAssetKey?: string;
}

export class NavalBattleEngine implements ICombatEngine {
  private inventory: PlayerInventory;
  private onFinishedCallback?: (result: 'victory' | 'defeat' | 'fled', rewardGold: number) => void;

  // Combatants State
  public playerHull: number = 60;
  public playerMaxHull: number = 60;
  public playerArmor: number = 0;
  public playerStamina: number = 3;
  public playerMaxStamina: number = 3;
  public playerDodgeChance: number = 0;

  public enemyName: string = 'Crazed Trawler';
  public enemyHull: number = 80;
  public enemyMaxHp: number = 80;
  public enemyArmor: number = 20;
  public enemyBaseDamage: number = 14;
  public enemyStunnedTurns: number = 0;
  public goldReward: number = 45;

  // Decks & Hand Tracking
  public drawPile: NavalCardData[] = [];
  public hand: NavalCardData[] = [];
  public discardPile: NavalCardData[] = [];
  public exhaustPile: NavalCardData[] = [];

  // Turn Flow
  public turn: number = 1;
  public isPlayerTurn: boolean = true;
  public enemyTurnTimer: number = 0;
  public combatFinished: boolean = false;
  public combatResult: 'victory' | 'defeat' | 'fled' = 'fled';

  // Visual & Particle Effects
  private time: number = 0;
  private smokeParticles: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; life: number }> = [];
  private muzzleFlashes: Array<{ x: number; y: number; timer: number; radius: number }> = [];
  private combatLog: string[] = ['Broadside combat engaged! Prepare your cannons.'];

  // UI Button hitboxes
  private endTurnRect = { x: 0, y: 0, w: 120, h: 36 };
  private cardRects: Array<{ x: number; y: number; w: number; h: number; card: NavalCardData }> = [];
  private hoveredCardIndex: number = -1;
  private isEndTurnHovered: boolean = false;

  constructor(
    inventory: PlayerInventory,
    enemy?: Partial<EnemyShipConfig>,
    onFinished?: (result: 'victory' | 'defeat' | 'fled', rewardGold: number) => void
  ) {
    this.inventory = inventory;
    this.onFinishedCallback = onFinished;

    this.playerHull = this.inventory.hullHp || 60;
    this.playerMaxHull = this.inventory.maxHullHp || 60;
    this.playerMaxStamina = Math.max(3, this.inventory.maxStamina || 3);
    this.playerStamina = this.playerMaxStamina;

    if (enemy) {
      this.enemyName = enemy.name ?? 'Warship Raider';
      this.enemyMaxHp = enemy.maxHp ?? 80;
      this.enemyHull = this.enemyMaxHp;
      this.enemyArmor = enemy.armor ?? 20;
      this.enemyBaseDamage = enemy.baseDamage ?? 14;
      this.goldReward = enemy.goldReward ?? 45;
    }
  }

  public init(): void {
    // Populate draw pile from PlayerInventory.navalDeck
    const copy = this.inventory.getNavalDeckCopy();
    if (copy.length > 0) {
      this.drawPile = this.shuffle([...copy]);
    } else {
      this.drawPile = [
        { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
        { ...AUTHORITATIVE_NAVAL_CARDS.swivel_gun },
        { ...AUTHORITATIVE_NAVAL_CARDS.broadside },
        { ...AUTHORITATIVE_NAVAL_CARDS.hull_bracing },
        { ...AUTHORITATIVE_NAVAL_CARDS.bilge_patch },
        { ...AUTHORITATIVE_NAVAL_CARDS.harpoon_snare }
      ];
    }

    this.hand = [];
    this.discardPile = [];
    this.exhaustPile = [];
    this.turn = 1;
    this.isPlayerTurn = true;
    this.combatFinished = false;

    // Initial draw: 4 cards
    this.drawCards(4);
    AudioManager.getInstance().playCardDraw();
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  public drawCards(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.hand.length >= 5) break; // Maximum hand size 5

      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = this.shuffle([...this.discardPile]);
        this.discardPile = [];
      }

      const card = this.drawPile.pop();
      if (card) {
        this.hand.push(card);
      }
    }
  }

  public playCard(index: number): boolean {
    if (!this.isPlayerTurn || this.combatFinished) return false;
    if (index < 0 || index >= this.hand.length) return false;

    const card = this.hand[index];
    if (this.playerStamina < card.staminaCost) {
      this.combatLog.unshift(`Not enough stamina for ${card.title}!`);
      return false;
    }

    // Deduct stamina
    this.playerStamina -= card.staminaCost;
    this.hand.splice(index, 1);

    // Apply Card Effects
    if (card.damage > 0) {
      this.applyDamageToEnemy(card.damage, card.title);
      this.triggerMuzzleFlash(380, 360);
      AudioManager.getInstance().playCardPlay('technique');
    }

    if (card.armorGain > 0) {
      this.playerArmor += card.armorGain;
      this.combatLog.unshift(`Braced timbers! Gained +${card.armorGain} Armor.`);
      AudioManager.getInstance().playCardPlay('drag');
    }

    if (card.hullRepair > 0) {
      const repaired = Math.min(this.playerMaxHull - this.playerHull, card.hullRepair);
      this.playerHull = Math.min(this.playerMaxHull, this.playerHull + card.hullRepair);
      this.inventory.hullHp = this.playerHull;
      this.combatLog.unshift(`Patched bulkheads! Restored +${repaired} Hull HP.`);
      AudioManager.getInstance().playWaterLap();
    }

    if (card.dodgeChance > 0) {
      this.playerDodgeChance = Math.max(this.playerDodgeChance, card.dodgeChance);
      this.combatLog.unshift(`Angled into trough! Gained ${Math.round(card.dodgeChance * 100)}% Dodge.`);
      AudioManager.getInstance().playCardPlay('reel');
    }

    if (card.stunTurns > 0) {
      this.enemyStunnedTurns += card.stunTurns;
      this.combatLog.unshift(`Harpoon snare snagged the enemy rudder! Stunned for ${card.stunTurns} turn.`);
      AudioManager.getInstance().playFishThrash();
    }

    if (card.oncePerBattle) {
      this.exhaustPile.push(card);
    } else {
      this.discardPile.push(card);
    }

    // Check Victory
    if (this.enemyHull <= 0) {
      this.enemyHull = 0;
      this.resolveVictory();
    }

    return true;
  }

  public applyDamageToEnemy(damage: number, source: string): void {
    const absorbed = Math.min(this.enemyArmor, damage);
    this.enemyArmor -= absorbed;
    const carryOver = damage - absorbed;
    this.enemyHull = Math.max(0, this.enemyHull - carryOver);

    this.spawnSmoke(680, 360, 8);
    this.combatLog.unshift(`${source} deals ${damage} DMG (${absorbed} absorbed by armor, ${carryOver} to hull)!`);
  }

  public endTurn(): void {
    if (!this.isPlayerTurn || this.combatFinished) return;

    // Discard unplayed hand cards
    this.discardPile.push(...this.hand);
    this.hand = [];

    this.isPlayerTurn = false;
    this.enemyTurnTimer = 1.0;
    this.combatLog.unshift('Turn ended. Enemy vessel prepares broadside...');
  }

  private executeEnemyTurn(): void {
    if (this.combatFinished) return;

    if (this.enemyStunnedTurns > 0) {
      this.enemyStunnedTurns--;
      this.combatLog.unshift(`Enemy warship is SNARLED by harpoons and unable to fire!`);
      this.startPlayerTurn();
      return;
    }

    // Check Dodge
    if (this.playerDodgeChance > 0 && Math.random() < this.playerDodgeChance) {
      this.combatLog.unshift(`EVASIVE MANEUVER SUCCEEDED! Enemy broadside splashed into the wake!`);
      this.playerDodgeChance = 0;
      this.startPlayerTurn();
      return;
    }
    this.playerDodgeChance = 0;

    // Enemy attacks
    const incomingDmg = this.enemyBaseDamage + Math.floor(Math.random() * 6);
    this.triggerMuzzleFlash(660, 360);
    this.spawnSmoke(360, 360, 10);

    const absorbed = Math.min(this.playerArmor, incomingDmg);
    this.playerArmor -= absorbed;
    const carryOver = incomingDmg - absorbed;
    this.playerHull = Math.max(0, this.playerHull - carryOver);
    this.inventory.hullHp = this.playerHull;

    this.combatLog.unshift(`Enemy salvo hits for ${incomingDmg} DMG (${absorbed} absorbed by armor, ${carryOver} to hull)!`);
    AudioManager.getInstance().playCardPlay('technique');

    if (this.playerHull <= 0) {
      this.playerHull = 0;
      this.resolveDefeat();
      return;
    }

    this.startPlayerTurn();
  }

  private startPlayerTurn(): void {
    this.turn++;
    this.isPlayerTurn = true;
    this.playerStamina = this.playerMaxStamina;
    this.drawCards(4);
    AudioManager.getInstance().playCardDraw();
    this.combatLog.unshift(`--- Turn ${this.turn} --- Draw 4 cards.`);
  }

  private resolveVictory(): void {
    this.combatFinished = true;
    this.combatResult = 'victory';
    this.inventory.addGold(this.goldReward);
    this.combatLog.unshift(`VICTORY! Enemy warship shattered! Recovered ${this.goldReward} Gold Sovereigns.`);
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
    this.combatLog.unshift(`DEFEAT! Hull shattered by incoming broadside salvo!`);
    AudioManager.getInstance().playLineSnap();

    if (this.onFinishedCallback) {
      setTimeout(() => {
        this.onFinishedCallback?.('defeat', 0);
      }, 1500);
    }
  }

  public update(dt: number): void {
    this.time += dt;

    // Enemy Turn processing
    if (!this.isPlayerTurn && !this.combatFinished) {
      this.enemyTurnTimer -= dt;
      if (this.enemyTurnTimer <= 0) {
        this.executeEnemyTurn();
      }
    }

    // Update Particles
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.radius += dt * 14;
      p.alpha = Math.max(0, p.life / 1.5);
      if (p.life <= 0) {
        this.smokeParticles.splice(i, 1);
      }
    }

    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const mf = this.muzzleFlashes[i];
      mf.timer -= dt;
      if (mf.timer <= 0) {
        this.muzzleFlashes.splice(i, 1);
      }
    }

    // Input Handling for interactive cards & end turn
    if (this.isPlayerTurn && !this.combatFinished) {
      const mousePos = Input.getMousePosition();

      // Check End Turn Button
      this.isEndTurnHovered =
        mousePos.x >= this.endTurnRect.x &&
        mousePos.x <= this.endTurnRect.x + this.endTurnRect.w &&
        mousePos.y >= this.endTurnRect.y &&
        mousePos.y <= this.endTurnRect.y + this.endTurnRect.h;

      if (this.isEndTurnHovered && Input.isMouseClicked()) {
        AudioManager.getInstance().playButtonClick();
        this.endTurn();
        return;
      }

      // Check Hand Cards
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

      // Keyboard shortcuts: 1-5 play cards, Space / E ends turn
      if (Input.isJustPressed('space') || Input.isJustPressed('keye')) {
        this.endTurn();
      }
      if (Input.isJustPressed('digit1')) this.playCard(0);
      if (Input.isJustPressed('digit2')) this.playCard(1);
      if (Input.isJustPressed('digit3')) this.playCard(2);
      if (Input.isJustPressed('digit4')) this.playCard(3);
      if (Input.isJustPressed('digit5')) this.playCard(4);
    }
  }

  private triggerMuzzleFlash(x: number, y: number): void {
    this.muzzleFlashes.push({ x, y, timer: 0.15, radius: 24 });
    this.spawnSmoke(x, y, 6);
  }

  private spawnSmoke(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.smokeParticles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        radius: 8 + Math.random() * 8,
        alpha: 0.8,
        life: 1.2 + Math.random() * 0.4
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

    // 1. Rolling Waves Ocean & Gloomy Sky Diorama Backdrop
    this.renderBackdrop(ctx, width, height);

    // 2. Ships on Waterline
    this.renderShips(ctx, width, height);

    // 3. Smoke & Muzzle Flashes
    this.renderParticles(ctx);

    // 4. Combatants Status Bars & Telemetry
    this.renderTelemetry(ctx, width, height);

    // 5. Hand Cards & Action Controls
    this.renderHand(ctx, width, height);

    // 6. Combat Log Overlay
    this.renderCombatLog(ctx, width, height);

    // 7. Victory / Defeat Modal Banner
    if (this.combatFinished) {
      this.renderEndBanner(ctx, width, height);
    }

    ctx.restore();
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Gloomy sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.65);
    skyGrad.addColorStop(0, '#0a0f1d');
    skyGrad.addColorStop(0.5, '#1e293b');
    skyGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Moon / pale sun halo
    ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.2, 90, 0, Math.PI * 2);
    ctx.fill();

    // Rolling deep ocean waves
    const waterLevel = height * 0.58;
    ctx.fillStyle = '#0b192c';
    ctx.fillRect(0, waterLevel, width, height - waterLevel);

    // Sinusoidal wave layers
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 15) {
      const y = waterLevel + Math.sin(x * 0.015 + this.time * 2.0) * 12 + Math.cos(x * 0.03 - this.time) * 6;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Foreground wave froth
    ctx.fillStyle = '#112233';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 15) {
      const y = waterLevel + 16 + Math.sin(x * 0.02 + this.time * 2.5 + 1) * 10;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  }

  private renderShips(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const waterY = height * 0.58;
    const playerShipX = width * 0.28;
    const enemyShipX = width * 0.72;

    const playerWavePitch = Math.sin(this.time * 2.2) * 0.05;
    const playerBob = Math.cos(this.time * 2.0) * 8;

    const enemyWavePitch = Math.sin(this.time * 2.2 + 1.5) * 0.05;
    const enemyBob = Math.cos(this.time * 2.0 + 1.2) * 8;

    // Player Vessel
    ctx.save();
    ctx.translate(playerShipX, waterY + playerBob);
    ctx.rotate(playerWavePitch);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;

    // Hull silhouette
    ctx.beginPath();
    ctx.moveTo(-70, -20);
    ctx.lineTo(60, -20);
    ctx.lineTo(80, 0);
    ctx.lineTo(40, 25);
    ctx.lineTo(-60, 25);
    ctx.lineTo(-80, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cabin and Masts
    ctx.fillStyle = '#334155';
    ctx.fillRect(-20, -45, 30, 25);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(-5, -20);
    ctx.lineTo(-5, -75);
    ctx.stroke();

    // Deck cannon ports
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(30, -10, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Enemy Warship
    ctx.save();
    ctx.translate(enemyShipX, waterY + enemyBob);
    ctx.rotate(enemyWavePitch);

    ctx.fillStyle = '#450a0a';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.0;

    // Menacing larger hull silhouette
    ctx.beginPath();
    ctx.moveTo(-90, 0);
    ctx.lineTo(-70, 30);
    ctx.lineTo(60, 30);
    ctx.lineTo(95, 0);
    ctx.lineTo(75, -28);
    ctx.lineTo(-65, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rigging & Masts
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(-35, -55, 45, 27);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-15, -28);
    ctx.lineTo(-15, -95);
    ctx.moveTo(25, -28);
    ctx.lineTo(25, -85);
    ctx.stroke();

    // Black sails
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(-45, -88, 30, 45);

    // Enemy Cannon ports
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(-30, -10, 6, 0, Math.PI * 2);
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    // Muzzle Flashes
    for (const mf of this.muzzleFlashes) {
      const grad = ctx.createRadialGradient(mf.x, mf.y, 2, mf.x, mf.y, mf.radius);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.4, '#f59e0b');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mf.x, mf.y, mf.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smoke Clouds
    for (const p of this.smokeParticles) {
      ctx.fillStyle = `rgba(148, 163, 184, ${p.alpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderTelemetry(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    // Top Bar Header
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, 0, width, 80);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, width, 80);

    // Player Status (Left)
    const pBarW = 220;
    const pBarH = 16;
    const pX = 40;
    const pY = 24;

    ctx.font = 'bold 14px "Cinzel", Georgia, serif';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`⚓ YOUR VESSEL  •  STAMINA: ${this.playerStamina}/${this.playerMaxStamina} ⚡`, pX, pY - 6);

    // HP Bar background
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(pX, pY, pBarW, pBarH);
    // HP Bar fill
    const playerHpRatio = Math.max(0, this.playerHull / this.playerMaxHull);
    ctx.fillStyle = playerHpRatio > 0.35 ? '#10b981' : '#ef4444';
    ctx.fillRect(pX, pY, pBarW * playerHpRatio, pBarH);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(pX, pY, pBarW, pBarH);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${this.playerHull}/${this.playerMaxHull} HP (Armor: ${this.playerArmor})`, pX + 8, pY + 12);

    // Enemy Status (Right)
    const eX = width - pBarW - 40;
    const eY = 24;

    ctx.font = 'bold 14px "Cinzel", Georgia, serif';
    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.fillText(`☠ ${this.enemyName}  •  ${this.enemyStunnedTurns > 0 ? '⚓ SNARLED' : 'READY TO FIRE'}`, eX + pBarW, eY - 6);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(eX, eY, pBarW, pBarH);
    const enemyHpRatio = Math.max(0, this.enemyHull / this.enemyMaxHp);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(eX, eY, pBarW * enemyHpRatio, pBarH);
    ctx.strokeStyle = '#7f1d1d';
    ctx.strokeRect(eX, eY, pBarW, pBarH);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`${this.enemyHull}/${this.enemyMaxHp} HP (Armor: ${this.enemyArmor})`, eX + 8, eY + 12);

    // Turn indicator center
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.fillStyle = this.isPlayerTurn ? '#fef08a' : '#f87171';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.isPlayerTurn ? `YOUR TURN (ROUND ${this.turn})` : 'ENEMY FIRING...',
      width / 2,
      35
    );
  }

  private renderHand(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Draw Pile Indicator (Bottom-Left)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, height - 76, 90, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DRAW PILE', 24 + 45, height - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", monospace';
    ctx.fillText(`${this.drawPile.length}`, 24 + 45, height - 36);
    ctx.restore();

    // 2. Discard Pile Indicator (Bottom-Right)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width - 114, height - 76, 90, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISCARD', width - 114 + 45, height - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", monospace';
    ctx.fillText(`${this.discardPile.length}`, width - 114 + 45, height - 36);
    ctx.restore();

    // 3. End Turn Button (Above Discard Pile on Right)
    this.endTurnRect = {
      x: width - 180,
      y: height - 142,
      w: 156,
      h: 52
    };

    ctx.save();
    ctx.fillStyle = this.isPlayerTurn
      ? (this.isEndTurnHovered ? '#451a03' : '#1c1917')
      : '#0f172a';
    ctx.strokeStyle = this.isPlayerTurn
      ? (this.isEndTurnHovered ? '#f59e0b' : '#78350f')
      : '#475569';
    ctx.lineWidth = this.isEndTurnHovered ? 2.4 : 1.5;
    ctx.beginPath();
    ctx.roundRect(this.endTurnRect.x, this.endTurnRect.y, this.endTurnRect.w, this.endTurnRect.h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = this.isPlayerTurn
      ? (this.isEndTurnHovered ? '#fef08a' : '#fde047')
      : '#94a3b8';
    ctx.font = 'bold 13px "Georgia", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.isPlayerTurn ? '⏳ END TURN' : 'ENEMY FIRING...',
      this.endTurnRect.x + this.endTurnRect.w / 2,
      this.endTurnRect.y + this.endTurnRect.h / 2 - 8
    );

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'italic 10px "Georgia", serif';
    ctx.fillText(
      'Enemy Salvo Next [SPACE]',
      this.endTurnRect.x + this.endTurnRect.w / 2,
      this.endTurnRect.y + this.endTurnRect.h / 2 + 10
    );
    ctx.restore();

    // 4. Curved Hand Arc & Grimoire Cards
    const cardCount = this.hand.length;
    this.cardRects = [];
    if (cardCount === 0) return;

    const scale = Math.min(1.0, Math.max(0.72, width / 1280));
    const baseW = 138;
    const baseH = 196;
    const cardW = baseW * scale;
    const cardH = baseH * scale;
    const maxHandSpan = Math.min(width - 360, cardCount * (cardW + 14));
    const startX = (width - maxHandSpan) / 2 + cardW / 2;
    const spacing = cardCount > 1 ? (maxHandSpan - cardW) / (cardCount - 1) : 0;
    const baseY = height - cardH / 2 - 14;

    const getCardLayout = (i: number) => {
      const centerDist = i - (cardCount - 1) / 2;
      const cx = cardCount === 1 ? width / 2 : startX + i * spacing;
      const arcDrop = Math.pow(centerDist, 2) * 5;
      const arcAngle = centerDist * 0.045;
      const isHovered = i === this.hoveredCardIndex;
      const isPlayable = this.isPlayerTurn && this.playerStamina >= this.hand[i].staminaCost;

      const lift = isHovered ? 38 : 0;
      const cy = baseY + arcDrop - lift;
      const cardScale = scale * (isHovered ? 1.10 : 1.0);
      const mousePos = Input.getMousePosition();
      const tilt = isHovered ? (mousePos.x - cx) * 0.0012 : arcAngle;

      return { cx, cy, cardScale, tilt, isHovered, isPlayable, card: this.hand[i] };
    };

    for (let i = 0; i < cardCount; i++) {
      const layout = getCardLayout(i);
      this.cardRects.push({
        x: layout.cx - cardW / 2,
        y: layout.cy - cardH / 2,
        w: cardW,
        h: cardH,
        card: layout.card
      });
    }

    const renderCardAt = (i: number) => {
      const { cx, cy, cardScale, tilt, isHovered, isPlayable, card } = getCardLayout(i);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.scale(cardScale, cardScale);

      const w = baseW;
      const h = baseH;

      // Drop Shadow
      ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 2, -h / 2 + (isHovered ? 14 : 6), w - 4, h, 8);
      ctx.fill();

      let frameColor = '#210e11';
      let innerParchment = '#2b1b1d';
      let headerBg = '#4c1118';
      let eldritchGlow = '#f43f5e';
      let typeTag = 'CANNON (ATTACK)';
      let sigilColor = '#fca5a5';

      if (card.cardType === 'Defense') {
        frameColor = '#0b1924';
        innerParchment = '#15242f';
        headerBg = '#0c3047';
        eldritchGlow = '#38bdf8';
        typeTag = 'DEFENSE (BRACE)';
        sigilColor = '#7dd3fc';
      } else if (card.cardType === 'Tactic') {
        frameColor = '#241033';
        innerParchment = '#2d183d';
        headerBg = '#421659';
        eldritchGlow = '#c084fc';
        typeTag = 'TACTIC (MANEUVER)';
        sigilColor = '#e9d5ff';
      } else if (card.cardType === 'Repair') {
        frameColor = '#241b0b';
        innerParchment = '#2e2516';
        headerBg = '#54360e';
        eldritchGlow = '#34d399';
        typeTag = 'REPAIR (HULL)';
        sigilColor = '#6ee7b7';
      }

      if (isPlayable) {
        ctx.shadowColor = eldritchGlow;
        ctx.shadowBlur = isHovered ? 18 : 8;
      }

      ctx.fillStyle = frameColor;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 6);
      ctx.fill();
      ctx.strokeStyle = isPlayable ? eldritchGlow : '#475569';
      ctx.lineWidth = isHovered ? 2.5 : 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = innerParchment;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 4);
      ctx.fill();

      // Header Ribbon
      ctx.fillStyle = headerBg;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 6, -h / 2 + 7, w - 12, 25, 3);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 10.5px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.title, 8, -h / 2 + 20, w - 34);

      // Stamina Cost Medallion
      const gemX = -w / 2 + 15;
      const gemY = -h / 2 + 15;
      const gemR = 12.5;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(gemX, gemY, gemR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const gemGrad = ctx.createRadialGradient(gemX - 3, gemY - 3, 2, gemX, gemY, gemR - 2);
      gemGrad.addColorStop(0, '#fef08a');
      gemGrad.addColorStop(0.4, '#eab308');
      gemGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = gemGrad;
      ctx.beginPath();
      ctx.arc(gemX, gemY, gemR - 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 13px "Georgia", serif';
      ctx.fillText(`${card.staminaCost}`, gemX, gemY + 1);

      // Artwork Socket
      const artW = w - 16;
      const artH = 64;
      const artX = -artW / 2;
      const artY = -h / 2 + 36;
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(artX, artY, artW, artH);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1;
      ctx.strokeRect(artX, artY, artW, artH);

      let statText = '';
      if (card.damage > 0) statText = `${card.damage} DMG`;
      if (card.armorGain > 0) statText = `+${card.armorGain} ARMOR`;
      if (card.hullRepair > 0) statText = `+${card.hullRepair} REPAIR`;
      if (card.dodgeChance > 0) statText = `${Math.round(card.dodgeChance * 100)}% DODGE`;
      if (card.stunTurns > 0) statText = `${card.damage} DMG • STUN`;

      ctx.fillStyle = sigilColor;
      ctx.font = 'bold 11px "Georgia", serif';
      ctx.fillText(statText, 0, artY + artH / 2);

      // Type Tag Ribbon
      ctx.fillStyle = card.cardType === 'Tactic' ? '#2e1065' : '#171412';
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 10, artY + artH + 5, w - 20, 14, 2);
      ctx.fill();
      ctx.fillStyle = sigilColor;
      ctx.font = 'bold 8px "Segoe UI", sans-serif';
      ctx.fillText(typeTag, 0, artY + artH + 12);

      // Description
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9.5px "Georgia", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      this.wrapText(ctx, card.description, 0, artY + artH + 25, w - 20, 12);

      if (!isPlayable) {
        ctx.fillStyle = 'rgba(10, 12, 16, 0.65)';
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 6);
        ctx.fill();
      }

      ctx.restore();

      // Shortcut Badge
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.fillStyle = isPlayable ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.arc(0, -(baseH / 2) * cardScale - 10, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, 0, -(baseH / 2) * cardScale - 10);
      ctx.restore();
    };

    for (let i = 0; i < cardCount; i++) {
      if (i !== this.hoveredCardIndex) {
        renderCardAt(i);
      }
    }
    if (this.hoveredCardIndex >= 0 && this.hoveredCardIndex < cardCount) {
      renderCardAt(this.hoveredCardIndex);
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim().length > 0) {
      ctx.fillText(line.trim(), x, curY);
    }
  }

  private renderCombatLog(ctx: CanvasRenderingContext2D, _width: number, height: number): void {
    const logX = 24;
    const logY = height * 0.64;
    const logW = 280;
    const logH = 80;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(logX, logY, logW, logH, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.0;
    ctx.stroke();

    ctx.font = 'bold 9.5px "Cinzel", serif';
    ctx.fillStyle = '#f59e0b';
    ctx.textAlign = 'left';
    ctx.fillText('NAVAL ENGAGEMENT DISPATCH', logX + 8, logY + 14);

    ctx.font = 'italic 8.5px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    for (let i = 0; i < Math.min(4, this.combatLog.length); i++) {
      ctx.fillText(this.combatLog[i], logX + 8, logY + 28 + i * 13, logW - 16);
    }
    ctx.restore();
  }

  private renderEndBanner(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const isVictory = this.combatResult === 'victory';
    const bannerW = 440;
    const bannerH = 140;
    const bx = Math.floor((width - bannerW) / 2);
    const by = Math.floor((height - bannerH) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 24, 0.94)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bannerW, bannerH, 8);
    ctx.fill();
    ctx.strokeStyle = isVictory ? '#facc15' : '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 24px "Cinzel", serif';
    ctx.fillStyle = isVictory ? '#fde047' : '#ef4444';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isVictory ? 'NAVAL VICTORY' : 'VESSEL DERELICT', bx + bannerW / 2, by + 40);

    ctx.font = 'italic 12px Georgia, serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(
      isVictory ? `Warship sunk! Awarded +${this.goldReward} Gold Sovereigns.` : 'Your vessel was overwhelmed by enemy cannon fire.',
      bx + bannerW / 2,
      by + 75
    );

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Returning to overworld ocean...', bx + bannerW / 2, by + 108);

    ctx.restore();
  }
}
