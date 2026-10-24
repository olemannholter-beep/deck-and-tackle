import { Vector2 } from './Vector2';

export class Input {
  private static keysDown: Set<string> = new Set();
  private static keysJustPressed: Set<string> = new Set();
  private static mousePos: Vector2 = new Vector2(0, 0);
  private static mouseJustClicked: boolean = false;
  private static isMouseDown: boolean = false;
  private static initialized: boolean = false;
  private static canvasRef: HTMLCanvasElement | null = null;

  public static init(canvas: HTMLCanvasElement): void {
    if (this.initialized) return;
    this.initialized = true;
    this.canvasRef = canvas;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      if (!this.keysDown.has(code)) {
        this.keysJustPressed.add(code);
      }
      this.keysDown.add(code);

      // Prevent default page scroll on Arrow keys and Space
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      this.keysDown.delete(code);
    });

    const updateMouse = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      // Use CSS logical pixels directly to match ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this.mousePos.x = clientX - rect.left;
      this.mousePos.y = clientY - rect.top;
    };

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      updateMouse(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      updateMouse(e.clientX, e.clientY);
    });

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      updateMouse(e.clientX, e.clientY);
      if (e.button === 0) {
        this.mouseJustClicked = true;
        this.isMouseDown = true;
      }
    });

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      updateMouse(e.clientX, e.clientY);
      if (e.button === 0) {
        this.mouseJustClicked = true;
        this.isMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    window.addEventListener('pointerup', (e: PointerEvent) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });
  }

  public static setCursor(cursor: string): void {
    if (this.canvasRef) {
      this.canvasRef.style.cursor = cursor;
    }
  }

  public static isDown(code: string): boolean {
    const key = code.toLowerCase();
    return this.keysDown.has(key);
  }

  public static isJustPressed(code: string): boolean {
    const key = code.toLowerCase();
    return this.keysJustPressed.has(key);
  }

  public static getMousePosition(): Vector2 {
    return this.mousePos.clone();
  }

  public static isMouseClicked(): boolean {
    return this.mouseJustClicked;
  }

  public static isMouseDownState(): boolean {
    return this.isMouseDown;
  }

  public static updateEnd(): void {
    this.keysJustPressed.clear();
    this.mouseJustClicked = false;
  }
}
