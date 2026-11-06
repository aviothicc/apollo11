class InputManagerClass {
  private keysHeld: Record<string, boolean> = {};
  private virtualForward = 0;
  private virtualTurn = 0;
  private onInteractCallback?: () => void;
  private onEscapeCallback?: () => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupKeyboardListeners();
      this.setupWindowBlurListener();
    }
  }

  public setCallbacks(onInteract: () => void, onEscape: () => void) {
    this.onInteractCallback = onInteract;
    this.onEscapeCallback = onEscape;
  }

  private setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
      this.keysHeld[e.code] = true;
      if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) {
        this.onInteractCallback?.();
      }
      if (e.code === 'Escape' && !e.repeat) {
        this.onEscapeCallback?.();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keysHeld[e.code] = false;
    });
  }

  private setupWindowBlurListener() {
    window.addEventListener('blur', () => {
      this.keysHeld = {};
      this.virtualForward = 0;
      this.virtualTurn = 0;
    });
  }

  public setVirtualJoystick(forward: number, turn: number) {
    this.virtualForward = Math.max(-1, Math.min(1, forward));
    this.virtualTurn = Math.max(-1, Math.min(1, turn));
  }

  public getInputs() {
    let forward = 0;
    let turn = 0;
    if (this.keysHeld.KeyW || this.keysHeld.ArrowUp) forward += 1;
    if (this.keysHeld.KeyS || this.keysHeld.ArrowDown) forward -= 1;
    if (this.keysHeld.KeyA || this.keysHeld.ArrowLeft) turn += 1;
    if (this.keysHeld.KeyD || this.keysHeld.ArrowRight) turn -= 1;

    return {
      forward: forward === 0 ? this.virtualForward : forward,
      turn: turn === 0 ? this.virtualTurn : turn,
    };
  }
}

export const InputManager = new InputManagerClass();
