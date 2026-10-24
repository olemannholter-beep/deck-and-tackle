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
import { FishingSpot } from './game/overworld/FishingSpot';
import { PlayerInventory } from './game/player/PlayerInventory';
import { Vector2 } from './engine/Vector2';
import { AudioManager } from './engine/AudioManager';

interface AmbientSpore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

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

  // Dynamic Lighting Canvas for darkness mask & lantern illumination
  private lightingCanvas: HTMLCanvasElement;
  private lightingCtx: CanvasRenderingContext2D;

  // Drifting Bioluminescent Spores Particle System
  private spores: AmbientSpore[] = [];

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
    this.hud = new HUD();
    this.muteButton = new MuteButton();
    AudioManager.getInstance().startSoundtrack();

    // Spawn boat at harbor dock cove (starts frozen while in MainMenu)
    this.boat = new Boat(400, 1370, -Math.PI / 4);
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

    // 6. Initialize Ambient Spores
    this.initSpores();

    // 7. Handle window resizing
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
    this.stateManager.changeState(GameState.OverworldExploration);
    this.camera.target.copy(this.boat.position);
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
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.update(dt, this.width, this.height);
    }
  }

  private initSpores(): void {
    this.spores = [];
    for (let i = 0; i < 35; i++) {
      this.spores.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 12 + 6,
        vy: -8 - Math.random() * 12,
        radius: 1.0 + Math.random() * 2.2,
        life: Math.random() * 5,
        maxLife: 5 + Math.random() * 4,
        color: Math.random() > 0.4 ? '#2dd4bf' : (Math.random() > 0.5 ? '#6ee7b7' : '#a7f3d0')
      });
    }
  }

  private updateSpores(dt: number): void {
    for (let i = this.spores.length - 1; i >= 0; i--) {
      const s = this.spores[i];
      s.life += dt;
      s.x += (s.vx + Math.sin(s.life * 1.4) * 8) * dt;
      s.y += s.vy * dt;

      if (s.life >= s.maxLife || s.y < -30 || s.x > this.width + 60 || s.x < -60) {
        this.spores.splice(i, 1);
      }
    }

    // Replenish spores up to 45
    while (this.spores.length < 45) {
      this.spores.push({
        x: Math.random() * (this.width + 120) - 60,
        y: this.height + 15 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 12 + 6,
        vy: -10 - Math.random() * 14,
        radius: 1.0 + Math.random() * 2.0,
        life: 0,
        maxLife: 6 + Math.random() * 5,
        color: Math.random() > 0.4 ? '#2dd4bf' : (Math.random() > 0.5 ? '#6ee7b7' : '#a7f3d0')
      });
    }
  }

  private updateOverworld(dt: number): void {
    // 1. Update boat physics & hydrodynamic movement
    this.boat.update(dt);

    // 2. Shoreline and dock collision resolution
    this.map.resolveCollisions(this.boat.position, this.boat.radius, this.boat.velocity.magnitude());

    // 3. Update map elements (ripples, spots, dock triggers)
    this.map.update(dt, this.boat.position);

    // 4. Camera smoothly tracks boat
    this.camera.target.copy(this.boat.position);
    this.camera.update(dt);

    // 5. Update drifting bioluminescent spores
    this.updateSpores(dt);

    // 6. HUD update
    this.hud.update(dt);

    // 7. Check interactive triggers ('E' or 'Space')
    const nearbySpot = this.getNearbyFishingSpot();
    const isNearDock = this.map.harborDock.isPlayerNearby;

    if (!this.stateManager.isInTransition()) {
      if ((Input.isJustPressed('keye') || Input.isJustPressed('space'))) {
        if (nearbySpot) {
          AudioManager.getInstance().playButtonClick();
          // Freeze boat and transition smoothly to Bobber Minigame -> Battle Diorama
          this.boat.isFrozen = true;
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
    for (const spot of this.map.fishingSpots) {
      if (spot.isPlayerNearby) {
        return spot;
      }
    }
    return null;
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
    } else if (currentState === GameState.SideViewBattle) {
      this.diorama.render(this.ctx, this.width, this.height);
    } else if (currentState === GameState.HarborShop) {
      this.shopOverlay.render(this.ctx, this.width, this.height);
    }

    // Render persistent Mute Button in the left corner
    this.muteButton.render(this.ctx);

    // Render seamless screen transition overlay
    this.stateManager.renderTransitionOverlay(this.ctx, this.width, this.height);
  }

  private renderOverworldLightingAndAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const t = performance.now() * 0.001;
    const boatLanternPos = this.boat.getLanternPosition();
    const boatScreen = this.camera.worldToScreen(boatLanternPos);

    // 1. Offscreen Darkness Mask Pass (punches transparent light pools into the oppressive darkness)
    this.lightingCtx.save();
    this.lightingCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.lightingCtx.clearRect(0, 0, width, height);

    // Deep Eldritch Abyss Darkness overlay
    this.lightingCtx.fillStyle = 'rgba(2, 6, 14, 0.84)';
    this.lightingCtx.fillRect(0, 0, width, height);

    // Punch holes using 'destination-out'
    this.lightingCtx.globalCompositeOperation = 'destination-out';

    // A. Player Boat Ambient Light & Forward Conical Searchlight Beam
    const flicker = 0.94 + Math.sin(t * 7.1) * 0.04 + Math.cos(t * 19.3) * 0.02;
    const boatHeading = this.boat.heading;
    const beamLength = 490 * flicker;
    const ambientRadius = 140 * flicker;

    // A1. Soft Ambient Circle (keeps boat, angler and immediate waters visible)
    const ambientGrad = this.lightingCtx.createRadialGradient(
      boatScreen.x, boatScreen.y, 8,
      boatScreen.x, boatScreen.y, ambientRadius
    );
    ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    ambientGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.90)');
    ambientGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.50)');
    ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.lightingCtx.fillStyle = ambientGrad;
    this.lightingCtx.beginPath();
    this.lightingCtx.arc(boatScreen.x, boatScreen.y, ambientRadius, 0, Math.PI * 2);
    this.lightingCtx.fill();

    // A2. Forward Conical Beam (projects ahead along boat heading with feathered falloff)
    this.lightingCtx.save();
    this.lightingCtx.translate(boatScreen.x, boatScreen.y);
    this.lightingCtx.rotate(boatHeading);

    const conePasses = [
      { halfAngle: 0.76, lenFactor: 0.88, alpha: 0.22 }, // Soft outer penumbra (~87 deg total arc)
      { halfAngle: 0.58, lenFactor: 0.95, alpha: 0.35 }, // Mid spread (~66 deg total arc)
      { halfAngle: 0.40, lenFactor: 1.00, alpha: 0.60 }, // Primary beam (~46 deg total arc)
      { halfAngle: 0.22, lenFactor: 1.03, alpha: 0.85 }  // Intense forward core (~25 deg total arc)
    ];

    for (const pass of conePasses) {
      const passLen = beamLength * pass.lenFactor;
      const cGrad = this.lightingCtx.createRadialGradient(0, 0, 10, 0, 0, passLen);
      cGrad.addColorStop(0, `rgba(0, 0, 0, ${pass.alpha})`);
      cGrad.addColorStop(0.25, `rgba(0, 0, 0, ${pass.alpha * 0.95})`);
      cGrad.addColorStop(0.60, `rgba(0, 0, 0, ${pass.alpha * 0.65})`);
      cGrad.addColorStop(0.85, `rgba(0, 0, 0, ${pass.alpha * 0.25})`);
      cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      this.lightingCtx.fillStyle = cGrad;
      this.lightingCtx.beginPath();
      this.lightingCtx.moveTo(0, 0);
      this.lightingCtx.arc(0, 0, passLen, -pass.halfAngle, pass.halfAngle);
      this.lightingCtx.closePath();
      this.lightingCtx.fill();
    }
    this.lightingCtx.restore();

    // B. World Lanterns Light Pools (Harbor Dock, Central Shrine, Spire Beacon, Outpost)
    for (const lantern of this.map.worldLanterns) {
      const lScreen = this.camera.worldToScreen(new Vector2(lantern.x, lantern.y));
      if (
        lScreen.x >= -lantern.radius &&
        lScreen.x <= width + lantern.radius &&
        lScreen.y >= -lantern.radius &&
        lScreen.y <= height + lantern.radius
      ) {
        const wGrad = this.lightingCtx.createRadialGradient(
          lScreen.x, lScreen.y, 8,
          lScreen.x, lScreen.y, lantern.radius
        );
        wGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        wGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.88)');
        wGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.50)');
        wGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.lightingCtx.fillStyle = wGrad;
        this.lightingCtx.beginPath();
        this.lightingCtx.arc(lScreen.x, lScreen.y, lantern.radius, 0, Math.PI * 2);
        this.lightingCtx.fill();
      }
    }

    // C. Swirling Bioluminescent Fishing Spot Light Pools
    for (const spot of this.map.fishingSpots) {
      const sScreen = this.camera.worldToScreen(spot.position);
      const spotRadius = 145;
      if (
        sScreen.x >= -spotRadius &&
        sScreen.x <= width + spotRadius &&
        sScreen.y >= -spotRadius &&
        sScreen.y <= height + spotRadius
      ) {
        const sGrad = this.lightingCtx.createRadialGradient(
          sScreen.x, sScreen.y, 6,
          sScreen.x, sScreen.y, spotRadius
        );
        sGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
        sGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.32)');
        sGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.lightingCtx.fillStyle = sGrad;
        this.lightingCtx.beginPath();
        this.lightingCtx.arc(sScreen.x, sScreen.y, spotRadius, 0, Math.PI * 2);
        this.lightingCtx.fill();
      }
    }

    this.lightingCtx.restore();

    // 2. Composite Darkness Mask onto Main Canvas
    ctx.drawImage(this.lightingCanvas, 0, 0, width, height);

    // 3. Colored Lantern Bloom & Halos (Lighter Composite Operation)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Boat Lantern Warm Amber/Sickly Green Ambient Halo
    const haloGrad = ctx.createRadialGradient(
      boatScreen.x, boatScreen.y, 4,
      boatScreen.x, boatScreen.y, ambientRadius * 0.95
    );
    haloGrad.addColorStop(0, `rgba(254, 240, 138, ${0.35 * flicker})`);
    haloGrad.addColorStop(0.35, `rgba(234, 179, 8, ${0.18 * flicker})`);
    haloGrad.addColorStop(0.70, `rgba(163, 230, 53, ${0.06 * flicker})`);
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(boatScreen.x, boatScreen.y, ambientRadius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Boat Forward Searchlight Colored Conical Beam
    ctx.save();
    ctx.translate(boatScreen.x, boatScreen.y);
    ctx.rotate(boatHeading);

    const bloomPasses = [
      { halfAngle: 0.74, lenFactor: 0.88, color: '163, 230, 53', alpha: 0.05 * flicker }, // Sickly green perimeter
      { halfAngle: 0.55, lenFactor: 0.95, color: '234, 179, 8',  alpha: 0.10 * flicker }, // Honey amber mid-beam
      { halfAngle: 0.36, lenFactor: 1.00, color: '254, 240, 138', alpha: 0.18 * flicker }, // Warm yellow illumination
      { halfAngle: 0.18, lenFactor: 1.03, color: '254, 249, 195', alpha: 0.28 * flicker }  // Bright core searchlight beam
    ];

    for (const pass of bloomPasses) {
      const pLen = beamLength * pass.lenFactor;
      const bGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, pLen);
      bGrad.addColorStop(0, `rgba(${pass.color}, ${pass.alpha * 1.2})`);
      bGrad.addColorStop(0.20, `rgba(${pass.color}, ${pass.alpha * 0.95})`);
      bGrad.addColorStop(0.55, `rgba(${pass.color}, ${pass.alpha * 0.50})`);
      bGrad.addColorStop(0.85, `rgba(${pass.color}, ${pass.alpha * 0.15})`);
      bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, pLen, -pass.halfAngle, pass.halfAngle);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // World Lanterns Colored Halos
    for (const lantern of this.map.worldLanterns) {
      const lScreen = this.camera.worldToScreen(new Vector2(lantern.x, lantern.y));
      if (
        lScreen.x >= -lantern.radius &&
        lScreen.x <= width + lantern.radius &&
        lScreen.y >= -lantern.radius &&
        lScreen.y <= height + lantern.radius
      ) {
        const lBloom = ctx.createRadialGradient(
          lScreen.x, lScreen.y, 4,
          lScreen.x, lScreen.y, lantern.radius * 0.85
        );
        lBloom.addColorStop(0, `${lantern.color}50`);
        lBloom.addColorStop(0.35, `${lantern.color}22`);
        lBloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lBloom;
        ctx.beginPath();
        ctx.arc(lScreen.x, lScreen.y, lantern.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 4. Volumetric Rolling Fog (3 Parallax Layers of Low-Opacity Grey-Green Patches)
    ctx.save();
    const cam = this.camera.position;
    const fogLayers = [
      { count: 7, speed: 7, parallax: 0.08, rx: 280, ry: 140, alpha: 0.07, color: '18, 34, 30' },
      { count: 9, speed: 17, parallax: 0.16, rx: 200, ry: 105, alpha: 0.09, color: '24, 44, 38' },
      { count: 11, speed: 27, parallax: 0.24, rx: 140, ry: 75, alpha: 0.08, color: '32, 56, 48' }
    ];

    for (const layer of fogLayers) {
      const wrapW = width + layer.rx * 2;
      const wrapH = height + layer.ry * 2;

      for (let i = 0; i < layer.count; i++) {
        const seedX = i * 389.7 + i * i * 47.1;
        const seedY = i * 271.3 + i * 83.5;

        const rawX = seedX + t * layer.speed - cam.x * layer.parallax;
        const rawY = seedY + Math.sin(t * 0.28 + i * 1.6) * 35 - cam.y * layer.parallax;

        const px = ((rawX % wrapW) + wrapW) % wrapW - layer.rx;
        const py = ((rawY % wrapH) + wrapH) % wrapH - layer.ry;

        const fGrad = ctx.createRadialGradient(px, py, 10, px, py, layer.rx);
        fGrad.addColorStop(0, `rgba(${layer.color}, ${layer.alpha})`);
        fGrad.addColorStop(0.55, `rgba(${layer.color}, ${layer.alpha * 0.5})`);
        fGrad.addColorStop(1, `rgba(${layer.color}, 0)`);

        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, layer.ry / layer.rx);
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        ctx.arc(0, 0, layer.rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // 5. Heavy Claustrophobic Screen-Edge Vignette
    ctx.save();
    const minDim = Math.min(width, height);
    const maxDim = Math.max(width, height);
    const vig = ctx.createRadialGradient(width / 2, height / 2, minDim * 0.30, width / 2, height / 2, maxDim * 0.74);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.5, 'rgba(2, 6, 12, 0.40)');
    vig.addColorStop(0.85, 'rgba(1, 3, 8, 0.82)');
    vig.addColorStop(1, 'rgba(0, 2, 5, 0.96)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // 6. Particle System: Drifting Bioluminescent Spores
    ctx.save();
    for (const spore of this.spores) {
      const lifeRatio = spore.life / spore.maxLife;
      const alpha = Math.sin(lifeRatio * Math.PI) * 0.85;
      if (alpha <= 0.01) continue;

      ctx.save();
      ctx.shadowBlur = 6;
      ctx.shadowColor = spore.color;
      ctx.fillStyle = spore.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(spore.x, spore.y, spore.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 7. Subtle Eldritch Film Grain / Miasma Dust
    ctx.fillStyle = 'rgba(167, 243, 208, 0.028)';
    for (let i = 0; i < 35; i++) {
      const gx = (i * 97.7 + t * 45) % width;
      const gy = (i * 53.3 - t * 30 + (i % 2 === 0 ? 0 : height)) % height;
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
    ctx.restore();
  }
}

// Start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  (window as any).__game = new Game();
});
