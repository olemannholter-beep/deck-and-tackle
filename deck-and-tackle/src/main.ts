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

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  public inventory: PlayerInventory;
  public stateManager: GameStateManager;
  public camera: Camera;
  public map: OverworldMap;
  public boat: Boat;
  public diorama: SideViewDiorama;
  public shopOverlay: HarborShopOverlay;
  public mainMenuOverlay: MainMenuOverlay;
  public muteButton: MuteButton;
  public hud: HUD;
  public seaChart: SeaChartOverlay;
  public atmosphere: AtmosphereManager;
  public get atmosphereManager(): AtmosphereManager { return this.atmosphere; }
  public currentActiveFishingSpot: FishingSpot | null = null;

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
        // e.g. GameState.SideViewBattle
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
    } else if (currentState === GameState.OverworldExploration) {
      this.updateOverworld(dt);
    } else if (currentState === GameState.SideViewBattle) {
      this.diorama.update(dt, this.width, this.height);
      this.map.update(dt, this.boat.position, true);
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.update(dt, this.width, this.height);
    }
  }

  private updateOverworld(dt: number): void {
    // 0. Update Sea Chart overlay and check open state
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

    // 2. Shoreline and dock collision resolution
    this.map.resolveCollisions(this.boat.position, this.boat.radius, this.boat.velocity.magnitude());

    // 3. Update map elements (ripples, spots, dock triggers)
    this.map.update(dt, this.boat.position, false);

    // 4. Camera smoothly tracks boat
    this.camera.target.copy(this.boat.position);
    this.camera.update(dt);

    // 5. Update Atmosphere & Weather (concentric zones, fog, rain squall, miasma)
    this.atmosphere.update(dt, this.boat.position, this.camera.position, this.width, this.height);

    // 6. HUD update
    this.hud.update(dt);

    // 7. Check interactive triggers ('E' or 'Space') only when chart is closed
    const nearbySpot = this.getNearbyFishingSpot();
    const isNearDock = this.map.harborDock.isPlayerNearby;

    if (!this.stateManager.isInTransition() && !isChartOpen) {
      if ((Input.isJustPressed('keye') || Input.isJustPressed('space'))) {
        if (nearbySpot) {
          AudioManager.getInstance().playButtonClick();
          // Freeze boat and transition smoothly to Bobber Minigame -> Battle Diorama
          this.boat.isFrozen = true;
          this.currentActiveFishingSpot = nearbySpot;
          nearbySpot.isFishingLocked = true;
          this.diorama.setEncounter(nearbySpot.zoneType, nearbySpot.name, nearbySpot.speciesType);
          this.stateManager.changeState(GameState.SideViewBattle);
        } else if (isNearDock) {
          AudioManager.getInstance().playButtonClick();
          // Freeze boat and transition smoothly to Harbor Shop
          this.boat.isFrozen = true;
          this.stateManager.changeState(GameState.HarborShop);
        }
      }
    }
  }

  private getNearbyFishingSpot(): FishingSpot | null {
    return this.map.getNearbyFishingSpot(this.boat.position);
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

      // 6. Overworld Post-Processing Atmosphere (Darkness Mask, Lantern Pools, Volumetric Fog, Vignette & Spores)
      this.renderOverworldLightingAndAtmosphere(this.ctx, this.width, this.height);

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
        this.inventory.deck.length
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
          this.map.islandColliders
        );
      }
    } else if (currentState === GameState.SideViewBattle) {
      this.diorama.render(this.ctx, this.width, this.height);
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.render(this.ctx, this.width, this.height);
    }

    // Render persistent Mute Button in the left corner (hidden while full-screen Sea Chart is open)
    if (!this.seaChart.isOpen()) {
      this.muteButton.render(this.ctx);
    }

    // Render seamless screen transition overlay
    this.stateManager.renderTransitionOverlay(this.ctx, this.width, this.height);
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
      this.dpr
    );
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  (window as any).__game = new Game();
});
