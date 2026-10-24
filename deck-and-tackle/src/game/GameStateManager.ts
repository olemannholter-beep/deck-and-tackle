export const GameState = {
  MainMenu: 'MainMenu',
  OverworldExploration: 'OverworldExploration',
  SideViewBattle: 'SideViewBattle',
  HarborShop: 'HarborShop'
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

export type StateChangeCallback = (fromState: GameState, toState: GameState) => void;

export class GameStateManager {
  private currentState: GameState = GameState.MainMenu;
  private targetState: GameState | null = null;
  private transitionTimer: number = 0;
  private transitionDuration: number = 0.45; // seconds
  private isTransitioning: boolean = false;
  private transitionAlpha: number = 0;

  private listeners: StateChangeCallback[] = [];

  // Context data for current encounter / interaction
  public activeSpotZone: 'shallow' | 'lake' | 'abyss' = 'shallow';
  public activeSpotName: string = 'Shallow Reeds';

  constructor(initialState: GameState = GameState.MainMenu) {
    this.currentState = initialState;
  }

  public getState(): GameState {
    return this.currentState;
  }

  public isInTransition(): boolean {
    return this.isTransitioning;
  }

  public getTransitionAlpha(): number {
    return this.transitionAlpha;
  }

  public onStateChange(cb: StateChangeCallback): void {
    this.listeners.push(cb);
  }

  public changeState(toState: GameState, immediate: boolean = false): void {
    if (this.currentState === toState && !this.isTransitioning) return;

    if (immediate) {
      const prev = this.currentState;
      this.currentState = toState;
      this.isTransitioning = false;
      this.transitionAlpha = 0;
      this.listeners.forEach(cb => cb(prev, toState));
      return;
    }

    this.targetState = toState;
    this.isTransitioning = true;
    this.transitionTimer = 0;
  }

  public update(dt: number): void {
    if (!this.isTransitioning || this.targetState === null) {
      return;
    }

    this.transitionTimer += dt;
    const half = this.transitionDuration / 2;

    if (this.transitionTimer <= half) {
      // Fade out (fade to dark/transition color)
      this.transitionAlpha = this.transitionTimer / half;
    } else if (this.transitionTimer <= this.transitionDuration) {
      // Switch state at midpoint
      if (this.currentState !== this.targetState) {
        const prev = this.currentState;
        this.currentState = this.targetState;
        this.listeners.forEach(cb => cb(prev, this.currentState));
      }
      // Fade back in
      this.transitionAlpha = 1.0 - (this.transitionTimer - half) / half;
    } else {
      // Finished
      this.isTransitioning = false;
      this.transitionAlpha = 0;
      this.targetState = null;
    }
  }

  public renderTransitionOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.transitionAlpha <= 0.001) return;

    ctx.save();
    ctx.fillStyle = `rgba(10, 20, 30, ${Math.min(1.0, this.transitionAlpha)})`;
    ctx.fillRect(0, 0, width, height);

    // Subtle nautical transition ripples in the dark wipe
    if (this.transitionAlpha > 0.4) {
      const ringAlpha = (this.transitionAlpha - 0.4) * 1.5;
      ctx.strokeStyle = `rgba(168, 218, 220, ${ringAlpha * 0.5})`;
      ctx.lineWidth = 2;
      const cx = width / 2;
      const cy = height / 2;
      const r = (1.0 - this.transitionAlpha) * Math.max(width, height) * 0.4 + 40;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
