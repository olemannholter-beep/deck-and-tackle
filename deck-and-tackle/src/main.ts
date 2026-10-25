import { Input } from './engine/Input';
import { Camera } from './engine/Camera';
import { GameStateManager, GameState } from './game/GameStateManager';
import { OverworldMap } from './game/overworld/OverworldMap';
import { Boat } from './game/overworld/Boat';
import { SideViewDiorama } from './game/sideview/SideViewDiorama';
import { HarborShopOverlay } from './game/ui/HarborShopOverlay';
import { MainMenuOverlay } from './game/ui/MainMenuOverlay';
import { MuteButton } from './game/ui/MuteButton';
import { HUD } from './game/ui/HUD';
import { SeaChartOverlay } from './game/ui/SeaChartOverlay';
import { FishingSpot } from './game/overworld/FishingSpot';
import { PlayerInventory } from './game/player/PlayerInventory';
import { AudioManager } from './engine/AudioManager';
import { AtmosphereManager } from './game/overworld/AtmosphereManager';
import { PreCastModal } from './game/ui/PreCastModal';
import { FlotsamSalvageOverlay } from './game/ui/FlotsamSalvageOverlay';
import { rollOutcomeForBait, rollSpeciesForZone } from './game/battle/BaitData';
import type { BaitId, FishingOutcomeType } from './game/battle/BaitData';
import { WhirlpoolSpawner } from './game/overworld/WhirlpoolSpawner';
import { RoamingHostileManager, HostileEntity } from './game/overworld/RoamingHostileManager';
import { NavalBattleEngine } from './game/battle/NavalBattleEngine';
import { MonsterStandoffEngine } from './game/battle/MonsterStandoffEngine';
import { DesperateEscapeMinigame } from './game/ui/DesperateEscapeMinigame';
import { GameOverOverlay } from './game/ui/GameOverOverlay';
import { createStarterDeck } from './game/battle/CardData';
import { createStarterNavalDeck } from './game/battle/NavalCardData';

export const HARBOR_DOCK_X = 4000;
export const HARBOR_DOCK_Y = 4070;
export const HARBOR_CENTER_X = 4000;
export const HARBOR_CENTER_Y = 4000;

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public inventory: PlayerInventory;
  public stateManager: GameStateManager;
  public camera: Camera;
  public map: OverworldMap;
  public boat: Boat;
  public diorama: SideViewDiorama;
  public shopOverlay: HarborShopOverlay;
  public preCastModal: PreCastModal;
  public flotsamSalvageOverlay: FlotsamSalvageOverlay;
  public mainMenuOverlay: MainMenuOverlay;
  public muteButton: MuteButton;
  public hud: HUD;
  public seaChart: SeaChartOverlay;
  public atmosphere: AtmosphereManager;
  public roamingHostiles: RoamingHostileManager;
  public navalBattleEngine: NavalBattleEngine | null = null;
  public monsterStandoffEngine: MonsterStandoffEngine | null = null;
  public escapeMinigame: DesperateEscapeMinigame;
  public gameOverOverlay: GameOverOverlay;
  public salvageReportModal: { isOpen: boolean; toll: number; title: string; body: string } | null = null;
  public salvageReportBtnRect = { x: 0, y: 0, w: 260, h: 42 };
  public isSalvageReportBtnHovered: boolean = false;
  public escapeNoticeTimer: number = 0;
  public escapeNoticeText: string = 'BATTERED BUT UNBROKEN: You limped through the crags and reached Innsmouth harbor.';
  public totalDistanceTraveled: number = 0;
  public monstersDefeated: number = 0;
  public get milesSailed(): number { return this.totalDistanceTraveled / 1852; }
  public get atmosphereManager(): AtmosphereManager { return this.atmosphere; }
  public currentActiveFishingSpot: FishingSpot | null = null;
  public slackNoticeTimer: number = 0;
  public slackNoticeText: string = 'The line went slack in the cold abyss... Nothing took the hook.';

  // Dynamic Lighting Canvas for darkness mask & lantern illumination
  private lightingCanvas: HTMLCanvasElement;
  private lightingCtx: CanvasRenderingContext2D;

  private width: number = window.innerWidth;
  private height: number = window.innerHeight;
  private dpr: number = window.devicePixelRatio || 1;

  private lastTime: number = 0;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not initialize 2D canvas context');
    this.ctx = context;

    // Initialize Offscreen Lighting Canvas
    this.lightingCanvas = document.createElement('canvas');
    const lCtx = this.lightingCanvas.getContext('2d');
    if (!lCtx) throw new Error('Could not initialize 2D lighting context');
    this.lightingCtx = lCtx;

    // 1. Initialize Input system
    Input.init(this.canvas);

    // 2. Initialize Player Inventory
    this.inventory = new PlayerInventory();

    // 3. Initialize Game Systems & Audio
    this.stateManager = new GameStateManager(GameState.MainMenu);
    this.camera = new Camera(this.width, this.height);
    this.map = new OverworldMap();
    this.atmosphere = new AtmosphereManager();
    this.map.setAtmosphereManager(this.atmosphere);
    this.hud = new HUD();
    this.seaChart = new SeaChartOverlay();
    this.hud.onToggleChart = () => this.seaChart.toggle();
    this.muteButton = new MuteButton();
    AudioManager.getInstance().startSoundtrack();

    // Spawn boat at central safe harbor (starts frozen while in MainMenu)
    this.boat = new Boat(4000, 4000, -Math.PI / 2);
    this.boat.isFrozen = true;

    // Set camera limits to map dimensions
    this.camera.setBounds({
      minX: 0,
      minY: 0,
      maxX: this.map.width,
      maxY: this.map.height
    });
    this.camera.snapTo(this.boat.position);

    // 4. Initialize Side View Diorama & Harbor Shop Overlay
    this.diorama = new SideViewDiorama({
      zoneType: 'lake',
      spotName: 'Open Lake Eddy',
      speciesType: 'pike',
      inventory: this.inventory,
      onReturnToOverworld: () => this.returnToOverworld()
    });

    this.shopOverlay = new HarborShopOverlay(this.inventory, () => this.returnToOverworld());
    this.preCastModal = new PreCastModal(this.inventory);
    this.flotsamSalvageOverlay = new FlotsamSalvageOverlay(this.inventory);

    // Initialize Roaming Hostiles Spawner & Manager
    this.roamingHostiles = new RoamingHostileManager();

    // Initialize M5 Escape Minigame & Game Over Overlay
    this.escapeMinigame = new DesperateEscapeMinigame(
      () => this.handleEscapeSuccess(),
      () => this.handleEscapeFailure()
    );
    this.gameOverOverlay = new GameOverOverlay(() => this.restartExpedition());

    // 5. Initialize Main Menu Overlay
    this.mainMenuOverlay = new MainMenuOverlay({
      onStartGame: () => {
        this.stateManager.changeState(GameState.OverworldExploration);
      }
    });

    // 6. Handle window resizing
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // 8. State change listener
    this.stateManager.onStateChange((from, to) => {
      if (to === GameState.OverworldExploration) {
        this.boat.isFrozen = false;
        Input.setCursor('default');
        AudioManager.getInstance().unduckSoundtrack();
        if (from === GameState.MainMenu) {
          AudioManager.getInstance().transitionToMusic('overworld', 2.0);
        } else if (from === GameState.HarborShop) {
          AudioManager.getInstance().transitionToMusic('overworld', 1.4);
        }
      } else if (to === GameState.HarborShop) {
        this.boat.isFrozen = true;
        AudioManager.getInstance().unduckSoundtrack();
        AudioManager.getInstance().transitionToMusic('storefront', 1.4);
      } else if (to === GameState.MainMenu) {
        this.boat.isFrozen = true;
        AudioManager.getInstance().unduckSoundtrack();
        AudioManager.getInstance().transitionToMusic('menu', 1.5);
      } else {
        // e.g. GameState.SideViewBattle, NavalBattle, MonsterStandoff
        this.boat.isFrozen = true;
        AudioManager.getInstance().duckSoundtrack(0.4);
      }
    });

    // 9. Start Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private handleResize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.lightingCanvas.width = Math.floor(this.width * this.dpr);
    this.lightingCanvas.height = Math.floor(this.height * this.dpr);

    this.camera.resize(this.width, this.height);
  }

  private returnToOverworld(): void {
    if (this.currentActiveFishingSpot) {
      if (this.diorama.battle && this.diorama.battle.status === 'victory') {
        this.map.onFishingVictory(this.currentActiveFishingSpot.id);
        this.currentActiveFishingSpot.triggerDespawn();
      } else {
        this.currentActiveFishingSpot.isFishingLocked = false;
      }
      this.currentActiveFishingSpot = null;
    }

    this.stateManager.changeState(GameState.OverworldExploration);
    this.camera.target.copy(this.boat.position);
    this.camera.snapTo(this.boat.position);
    Input.setCursor('default');
  }

  private gameLoop(time: number): void {
    const rawDt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = Math.min(0.064, rawDt);

    this.update(dt);
    this.render();

    Input.updateEnd();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  private update(dt: number): void {
    this.stateManager.update(dt);
    const currentState = this.stateManager.getState();
    const isOverworld = currentState === GameState.OverworldExploration;

    // Continuous audio update (engine chug modulation, periodic ambient foghorn/bell)
    AudioManager.getInstance().update(dt, this.boat.velocity.magnitude(), isOverworld);

    // Update Mute Button (handles hover, click, and [M] shortcut)
    this.muteButton.update(dt);

    if (currentState === GameState.MainMenu) {
      this.mainMenuOverlay.update(dt, this.width, this.height);
    } else if (this.gameOverOverlay.isOpen) {
      this.gameOverOverlay.update(dt, this.width, this.height);
    } else if (this.escapeMinigame.isRunning) {
      this.escapeMinigame.update(dt, this.width, this.height);
    } else if (currentState === GameState.OverworldExploration) {
      this.updateOverworld(dt);
    } else if (currentState === GameState.SideViewBattle) {
      this.diorama.update(dt, this.width, this.height);
      this.map.update(dt, this.boat.position, true);
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.update(dt, this.width, this.height);
    } else if (currentState === ('NavalBattle' as any) && this.navalBattleEngine) {
      this.navalBattleEngine.update(dt);
    } else if (currentState === ('MonsterStandoff' as any) && this.monsterStandoffEngine) {
      this.monsterStandoffEngine.update(dt);
    }
  }

  private updateOverworld(dt: number): void {
    // Decrement atmospheric slack line notification timer
    if (this.slackNoticeTimer > 0) {
      this.slackNoticeTimer -= dt;
      if (this.slackNoticeTimer < 0) this.slackNoticeTimer = 0;
    }

    // Decrement escape limp notification timer
    if (this.escapeNoticeTimer > 0) {
      this.escapeNoticeTimer -= dt;
      if (this.escapeNoticeTimer < 0) this.escapeNoticeTimer = 0;
    }

    // Check Salvage Report modal
    if (this.salvageReportModal && this.salvageReportModal.isOpen) {
      this.boat.isFrozen = true;
      this.updateSalvageReportModal(dt);
      return;
    }

    // Check Vessel Defeat (Hull <= 0)
    if (this.inventory.hullHp <= 0) {
      this.handleVesselDefeat();
      return;
    }

    // 0a. Check modal overlays (FlotsamSalvageOverlay and PreCastModal)
    if (this.flotsamSalvageOverlay.isOpen) {
      this.boat.isFrozen = true;
      this.flotsamSalvageOverlay.update(dt, this.width, this.height);
      return;
    }

    if (this.preCastModal.isOpen) {
      this.boat.isFrozen = true;
      this.preCastModal.update(dt, this.width, this.height);
      return;
    }

    // 0b. Update Sea Chart overlay and check open state
    this.seaChart.update(dt, this.width, this.height, this.boat.position);
    const isChartOpen = this.seaChart.isOpen();

    // Freeze boat controls when Sea Chart is open
    if (isChartOpen) {
      this.boat.isFrozen = true;
    } else if (!this.stateManager.isInTransition()) {
      this.boat.isFrozen = false;
    }

    // 1. Update boat physics & hydrodynamic movement
    this.boat.update(dt);
    this.totalDistanceTraveled += this.boat.velocity.magnitude() * dt;

    // 2. Shoreline and dock collision resolution
    this.map.resolveCollisions(this.boat.position, this.boat.radius, this.boat.velocity.magnitude());

    // 3. Update map elements (ripples, spots, dock triggers)
    this.map.update(dt, this.boat.position, false);

    // 3b. Update roaming hostiles and check hull-to-hull touch / combat engagement
    const engagedHostile =
      this.roamingHostiles.update(dt, this.boat.position) ||
      this.roamingHostiles.checkBoatCollision(this.boat);
    if (engagedHostile && !this.stateManager.isInTransition()) {
      this.triggerHostileCombat(engagedHostile);
      return;
    }

    // 4. Camera smoothly tracks boat
    this.camera.target.copy(this.boat.position);
    this.camera.update(dt);

    // 5. Update Atmosphere & Weather (concentric zones, fog, rain squall, miasma)
    this.atmosphere.update(dt, this.boat.position, this.camera.position, this.width, this.height);

    // 6. HUD update
    this.hud.update(dt);

    // 7. Check interactive triggers ('E' or 'Space') only when chart and modals are closed
    const nearbySpot = this.getNearbyFishingSpot();
    const isNearDock = this.map.harborDock.isPlayerNearby;

    if (!this.stateManager.isInTransition() && !isChartOpen && !this.preCastModal.isOpen && !this.flotsamSalvageOverlay.isOpen) {
      if ((Input.isJustPressed('keye') || Input.isJustPressed('space'))) {
        if (nearbySpot && nearbySpot.state === 'ACTIVE') {
          AudioManager.getInstance().playButtonClick();
          // Freeze boat and lock spot
          this.boat.isFrozen = true;
          this.currentActiveFishingSpot = nearbySpot;
          nearbySpot.isFishingLocked = true;

          const profile = WhirlpoolSpawner.getEncounterProfileForPosition(nearbySpot.position);
          const zoneTier = profile.tier as 1 | 2 | 3 | 4;
          (nearbySpot as any).zoneTier = zoneTier;
          const depthMeters = [0, 15, 45, 75, 120][zoneTier] || 15;

          this.preCastModal.open(
            zoneTier,
            profile.name,
            depthMeters,
            (baitId: BaitId) => {
              this.handleCast(nearbySpot, zoneTier, baitId);
            },
            () => {
              nearbySpot.isFishingLocked = false;
              this.currentActiveFishingSpot = null;
              this.boat.isFrozen = false;
            }
          );
        } else if (isNearDock) {
          AudioManager.getInstance().playButtonClick();
          // Freeze boat and transition smoothly to Harbor Shop
          this.boat.isFrozen = true;
          this.stateManager.changeState(GameState.HarborShop);
        }
      }
    }
  }

  public handleCast(
    spot: FishingSpot,
    zoneTier: 1 | 2 | 3 | 4,
    baitId: BaitId,
    forcedRoll?: number
  ): FishingOutcomeType {
    const outcome = rollOutcomeForBait(baitId, forcedRoll);

    if (outcome === 'strike') {
      const species = rollSpeciesForZone(zoneTier, baitId);
      this.currentActiveFishingSpot = spot;
      spot.isFishingLocked = true;
      this.diorama.setEncounter(spot.zoneType, spot.name, species);
      this.stateManager.changeState(GameState.SideViewBattle);
    } else if (outcome === 'salvage') {
      const reward = this.flotsamSalvageOverlay.generateSalvageReward(zoneTier);
      spot.triggerDespawn();
      this.flotsamSalvageOverlay.open(reward, () => {
        this.boat.isFrozen = false;
        this.currentActiveFishingSpot = null;
      });
    } else {
      // outcome === 'slack'
      this.slackNoticeTimer = 4.0;
      this.slackNoticeText = 'The line went slack in the cold abyss... Nothing took the hook.';
      AudioManager.getInstance().playWaterLap();
      spot.triggerDespawn();
      this.currentActiveFishingSpot = null;
      this.boat.isFrozen = false;
    }

    return outcome;
  }

  public getNearbyFishingSpot(maxDist?: number): FishingSpot | null {
    const spot = this.map.getNearbyFishingSpot(this.boat.position);
    if (!spot) return null;
    if (maxDist !== undefined) {
      const d = spot.position.distanceTo(this.boat.position);
      return d <= maxDist ? spot : null;
    }
    return spot;
  }

  public triggerHostileCombat(hostile: HostileEntity): void {
    this.boat.isFrozen = true;
    if (hostile.category === 'vessel') {
      this.navalBattleEngine = new NavalBattleEngine(
        this.inventory,
        { name: hostile.name, maxHp: hostile.maxHp },
        (result) => {
          if (result === 'victory') {
            this.roamingHostiles.removeHostile(hostile.id);
            this.monstersDefeated++;
          }
          this.returnFromHostileCombat();
        }
      );
      this.navalBattleEngine.init();
      this.stateManager.changeState(('NavalBattle' as any));
    } else {
      this.monsterStandoffEngine = new MonsterStandoffEngine(
        this.inventory,
        { name: hostile.name, maxHp: hostile.maxHp },
        (result) => {
          if (result === 'victory') {
            this.roamingHostiles.removeHostile(hostile.id);
            this.monstersDefeated++;
          }
          this.returnFromHostileCombat();
        }
      );
      this.monsterStandoffEngine.init();
      this.stateManager.changeState(('MonsterStandoff' as any));
    }
  }

  public returnFromHostileCombat(): void {
    this.navalBattleEngine = null;
    this.monsterStandoffEngine = null;
    this.stateManager.changeState(GameState.OverworldExploration);
    this.camera.target.copy(this.boat.position);
    this.camera.snapTo(this.boat.position);
    this.boat.isFrozen = false;
    Input.setCursor('default');

    if (this.inventory.hullHp <= 0) {
      this.handleVesselDefeat();
    }
  }

  public handleVesselDefeat(): void {
    if (this.escapeMinigame.isRunning || this.gameOverOverlay.isOpen || (this.salvageReportModal && this.salvageReportModal.isOpen)) {
      return;
    }

    if (this.inventory.gold > 0) {
      // 18% towing toll (min 1g)
      const toll = Math.max(1, Math.floor(this.inventory.gold * 0.18));
      this.inventory.gold = Math.max(0, this.inventory.gold - toll);
      this.inventory.hullHp = 60;

      // Reset vessel to Harbor Dock (4000, 4070) with zero velocity
      this.boat.position.set(HARBOR_DOCK_X, HARBOR_DOCK_Y);
      this.boat.velocity.set(0, 0);
      this.boat.isFrozen = true;
      this.camera.target.copy(this.boat.position);
      this.camera.snapTo(this.boat.position);

      this.salvageReportModal = {
        isOpen: true,
        toll,
        title: 'SALVAGED BY INNSMOUTH CUTTER',
        body: `Your vessel was towed to the harbor dock. Repairs toll: -${toll}g. Hull restored.`
      };

      try {
        AudioManager.getInstance().playGoldCoins();
      } catch {
        // Audio fallback
      }
    } else {
      // 0 Gold -> Launch Desperate Escape Minigame
      this.boat.isFrozen = true;
      try {
        AudioManager.getInstance().duckSoundtrack(0.1);
      } catch {
        // Audio fallback
      }
      this.escapeMinigame.start(this.width, this.height);
    }
  }

  public handleEscapeSuccess(): void {
    this.boat.position.set(HARBOR_DOCK_X, HARBOR_DOCK_Y);
    this.boat.velocity.set(0, 0);
    this.boat.isFrozen = false;
    this.camera.target.copy(this.boat.position);
    this.camera.snapTo(this.boat.position);

    this.inventory.hullHp = 20;
    this.escapeNoticeTimer = 5.0;
    this.escapeNoticeText = 'BATTERED BUT UNBROKEN: You limped through the crags and reached Innsmouth harbor.';

    try {
      AudioManager.getInstance().unduckSoundtrack();
    } catch {
      // Audio fallback
    }
    this.stateManager.changeState(GameState.OverworldExploration);
  }

  public handleEscapeFailure(): void {
    this.boat.isFrozen = true;
    this.gameOverOverlay.open({
      milesSailed: this.milesSailed,
      fishCaught: this.inventory.totalFishCaught,
      monstersDefeated: this.monstersDefeated
    });
  }

  public restartExpedition(): void {
    this.inventory.gold = 25;
    this.inventory.hullHp = 60;
    this.inventory.maxHullHp = 60;
    this.inventory.deck = createStarterDeck();
    this.inventory.navalDeck = createStarterNavalDeck();
    this.inventory.baits = {
      bare_hook: Infinity,
      lugworms: 0,
      blood_chum: 0,
      bio_squid: 0,
      eldritch_grub: 0
    };
    this.inventory.selectedBait = 'bare_hook';
    this.inventory.staminaUpgradeLevel = 0;
    this.inventory.lineHealthUpgradeLevel = 0;
    this.inventory.totalFishCaught = 0;

    this.totalDistanceTraveled = 0;
    this.monstersDefeated = 0;

    this.boat.position.set(HARBOR_CENTER_X, HARBOR_CENTER_Y);
    this.boat.velocity.set(0, 0);
    this.boat.heading = -Math.PI / 2;
    this.boat.isFrozen = false;
    this.camera.target.copy(this.boat.position);
    this.camera.snapTo(this.boat.position);

    try {
      AudioManager.getInstance().unduckSoundtrack();
      AudioManager.getInstance().transitionToMusic('overworld', 1.5);
    } catch {
      // Audio fallback
    }

    this.stateManager.changeState(GameState.OverworldExploration);
  }

  public dismissSalvageReport(): void {
    if (this.salvageReportModal) {
      this.salvageReportModal.isOpen = false;
      this.salvageReportModal = null;
    }
    this.boat.isFrozen = false;
    this.stateManager.changeState(GameState.OverworldExploration);
    Input.setCursor('default');
  }

  private updateSalvageReportModal(_dt: number): void {
    if (!this.salvageReportModal || !this.salvageReportModal.isOpen) return;

    if (Input.isJustPressed('space') || Input.isJustPressed('enter') || Input.isJustPressed('escape')) {
      try {
        AudioManager.getInstance().playButtonClick();
      } catch {
        // Audio fallback
      }
      this.dismissSalvageReport();
      return;
    }

    const mouse = Input.getMousePosition();
    const btn = this.salvageReportBtnRect;
    this.isSalvageReportBtnHovered = (
      mouse.x >= btn.x && mouse.x <= btn.x + btn.w &&
      mouse.y >= btn.y && mouse.y <= btn.y + btn.h
    );

    if (this.isSalvageReportBtnHovered) {
      Input.setCursor('pointer');
      if (Input.isMouseClicked()) {
        try {
          AudioManager.getInstance().playButtonClick();
        } catch {
          // Audio fallback
        }
        this.dismissSalvageReport();
      }
    } else {
      Input.setCursor('default');
    }
  }

  private render(): void {
    // Reset canvas transform to handle devicePixelRatio
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);

    const currentState = this.stateManager.getState();

    if (currentState === GameState.MainMenu) {
      this.mainMenuOverlay.render(this.ctx, this.width, this.height);
    } else if (currentState === GameState.OverworldExploration || this.stateManager.isInTransition()) {
      // 1. Apply Camera World Transform
      this.camera.applyTransform(this.ctx);

      // 2. Render Overworld Map
      this.map.render(this.ctx, this.camera.position, this.width, this.height);

      // 3. Render Boat Wake particles
      this.boat.renderWake(this.ctx);

      // 4. Render Boat Entity
      this.boat.render(this.ctx);

      // 5. Restore World Transform
      this.camera.restoreTransform(this.ctx);

      // 5b. Render Roaming Hostiles (screen-space via camera.worldToScreen, underneath darkness mask & fog)
      this.roamingHostiles.renderWorld(this.ctx, this.camera);

      // 6. Overworld Post-Processing Atmosphere (Darkness Mask, Lantern Pools, Volumetric Fog, Vignette & Spores)
      this.renderOverworldLightingAndAtmosphere(this.ctx, this.width, this.height);

      // Render searchlight beams & additive bloom
      this.roamingHostiles.renderSearchlights(this.ctx, this.camera);

      // 7. Render Overworld Screen Space HUD with Gold & Deck counts
      const nearbySpot = this.getNearbyFishingSpot();
      const isNearDock = this.map.harborDock.isPlayerNearby;
      this.hud.renderOverworld(
        this.ctx,
        this.width,
        this.height,
        this.boat,
        this.map,
        nearbySpot,
        isNearDock,
        this.inventory.gold,
        this.inventory.deck.length,
        this.inventory.hullHp,
        this.inventory.maxHullHp
      );

      // 8. Render interactive full-screen Sea Chart overlay modal
      if (this.seaChart.isOpen()) {
        this.seaChart.render(
          this.ctx,
          this.width,
          this.height,
          this.boat.position,
          this.boat.heading,
          this.map.fishingSpots,
          AtmosphereManager.HARBOR_CENTER,
          this.map.islandColliders,
          this.roamingHostiles.getHostiles()
        );
      }

      // 9. Render atmospheric slack line notification
      if (this.slackNoticeTimer > 0) {
        this.renderSlackNotice(this.ctx, this.width, this.height);
      }

      // 9b. Render narrative escape notice banner
      if (this.escapeNoticeTimer > 0) {
        this.renderEscapeNotice(this.ctx, this.width, this.height);
      }

      // 10. Render PreCastModal if open
      if (this.preCastModal.isOpen) {
        this.preCastModal.render(this.ctx, this.width, this.height);
      }

      // 11. Render FlotsamSalvageOverlay if open
      if (this.flotsamSalvageOverlay.isOpen) {
        this.flotsamSalvageOverlay.render(this.ctx, this.width, this.height);
      }

      // 12. Render Salvage Report Modal if open
      if (this.salvageReportModal && this.salvageReportModal.isOpen) {
        this.renderSalvageReportModal(this.ctx, this.width, this.height);
      }

      // 13. Render Desperate Escape Minigame if running
      if (this.escapeMinigame.isRunning) {
        this.escapeMinigame.render(this.ctx, this.width, this.height);
      }

      // 14. Render Lovecraftian Game Over Overlay if open
      if (this.gameOverOverlay.isOpen) {
        this.gameOverOverlay.render(this.ctx, this.width, this.height);
      }
    } else if (currentState === GameState.SideViewBattle) {
      this.diorama.render(this.ctx, this.width, this.height);
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.render(this.ctx, this.width, this.height);
    } else if (currentState === ('NavalBattle' as any) && this.navalBattleEngine) {
      this.navalBattleEngine.render(this.ctx, this.width, this.height);
    } else if (currentState === ('MonsterStandoff' as any) && this.monsterStandoffEngine) {
      this.monsterStandoffEngine.render(this.ctx, this.width, this.height);
    }

    // Render persistent Mute Button in the left corner (hidden while modals or full-screen overlays are open)
    if (
      !this.seaChart.isOpen() &&
      !this.preCastModal.isOpen &&
      !this.flotsamSalvageOverlay.isOpen &&
      !this.escapeMinigame.isRunning &&
      !this.gameOverOverlay.isOpen &&
      (!this.salvageReportModal || !this.salvageReportModal.isOpen)
    ) {
      this.muteButton.render(this.ctx);
    }

    // Render seamless screen transition overlay
    this.stateManager.renderTransitionOverlay(this.ctx, this.width, this.height);
  }

  private renderSlackNotice(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const alpha = Math.min(1.0, this.slackNoticeTimer);
    const boxW = Math.min(560, width - 40);
    const boxH = 54;
    const boxX = Math.floor((width - boxW) / 2);
    const boxY = height - 90;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Background pill plate
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();

    // Cold slate border matching tests & aesthetic
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Text: cold slate (#94a3b8)
    ctx.font = 'bold 12px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.slackNoticeText, boxX + boxW / 2, boxY + 22);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(
      'Your hook drifts through cold, barren brine. The whirlpool dissipates into the dark.',
      boxX + boxW / 2,
      boxY + 40
    );

    ctx.restore();
  }

  private renderSalvageReportModal(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.salvageReportModal || !this.salvageReportModal.isOpen) return;

    ctx.save();
    // Backdrop
    ctx.fillStyle = 'rgba(2, 6, 14, 0.88)';
    ctx.fillRect(0, 0, width, height);

    // Modal Frame
    const modalW = Math.min(540, width - 40);
    const modalH = 260;
    const modalX = Math.floor((width - modalW) / 2);
    const modalY = Math.floor((height - modalH) / 2);

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(modalX, modalY, modalW, modalH, 8);
    } else {
      ctx.rect(modalX, modalY, modalW, modalH);
    }
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Title
    ctx.font = 'bold 16px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.salvageReportModal.title, modalX + modalW / 2, modalY + 38);

    // Subtitle
    ctx.font = 'italic 11px Georgia, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Innsmouth Harbor Towing & Salvage Cutter Service', modalX + modalW / 2, modalY + 58);

    // Narrative Body Box
    const bodyBoxW = modalW - 40;
    const bodyBoxH = 80;
    const bodyBoxX = modalX + 20;
    const bodyBoxY = modalY + 74;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(bodyBoxX, bodyBoxY, bodyBoxW, bodyBoxH, 6);
    } else {
      ctx.rect(bodyBoxX, bodyBoxY, bodyBoxW, bodyBoxH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Your vessel was towed to the harbor dock.', modalX + modalW / 2, bodyBoxY + 30);

    ctx.font = 'bold 12px "Segoe UI", monospace';
    ctx.fillStyle = '#f87171';
    ctx.fillText(`Repairs toll: -${this.salvageReportModal.toll}g. Hull restored.`, modalX + modalW / 2, bodyBoxY + 52);

    // Button: RETURN TO HELM
    this.salvageReportBtnRect.w = 260;
    this.salvageReportBtnRect.h = 42;
    this.salvageReportBtnRect.x = modalX + Math.floor((modalW - this.salvageReportBtnRect.w) / 2);
    this.salvageReportBtnRect.y = bodyBoxY + bodyBoxH + 20;

    const btn = this.salvageReportBtnRect;
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(btn.x, btn.y, btn.w, btn.h, 6);
    } else {
      ctx.rect(btn.x, btn.y, btn.w, btn.h);
    }
    ctx.fillStyle = this.isSalvageReportBtnHovered ? '#059669' : '#047857';
    ctx.fill();

    ctx.strokeStyle = this.isSalvageReportBtnHovered ? '#6ee7b7' : '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = 'bold 12px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText('RETURN TO HELM [SPACE / ENTER]', btn.x + btn.w / 2, btn.y + btn.h / 2);

    ctx.restore();
  }

  private renderEscapeNotice(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const alpha = Math.min(1.0, this.escapeNoticeTimer);
    const boxW = Math.min(620, width - 40);
    const boxH = 54;
    const boxX = Math.floor((width - boxW) / 2);
    const boxY = height - 90;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(boxX, boxY, boxW, boxH, 6);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fill();

    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.font = 'bold 12px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#fde047';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.escapeNoticeText, boxX + boxW / 2, boxY + 22);

    ctx.font = 'italic 9.5px Georgia, serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      'Your vessel limps into harbor dock with 20 HP integrity remaining.',
      boxX + boxW / 2,
      boxY + 40
    );

    ctx.restore();
  }

  private renderOverworldLightingAndAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.atmosphere.renderLightingAndAtmosphere(
      ctx,
      this.lightingCanvas,
      this.lightingCtx,
      this.camera,
      this.boat,
      this.map.worldLanterns,
      this.map.fishingSpots,
      width,
      height,
      this.dpr,
      (lCtx) => this.roamingHostiles.renderLighting(lCtx, this.camera, this.dpr)
    );
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  (window as any).__game = new Game();
});
