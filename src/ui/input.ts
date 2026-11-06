/**
 * One-thumb input. Floating stick created where the finger lands, pointer events
 * only (never touch events), first pointer wins so a second thumb cannot steal
 * the stick. Desktop uses WASD / arrows for testing.
 */

import type { StickVisual } from '../render';
import type { MoveInput } from '../sim/step';

const DEADZONE_PX = 9;
const MAX_RADIUS = 68;
const DEADZONE = 0.14;

interface MutableVec {
  x: number;
  y: number;
}

export interface InputController {
  /** Normalised {-1..1} movement vector for the sim. */
  read(): MoveInput;
  /** Visual state for the renderer, null when no thumb is down. */
  stick(): StickVisual | null;
  setEnabled(enabled: boolean): void;
  /** Drop the current stick and clear held keys. Used on pause and restart. */
  reset(): void;
  destroy(): void;
}

export function createInput(stage: HTMLElement): InputController {
  let enabled = true;
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let knobX = 0;
  let knobY = 0;
  let active = false;

  const stickVec: MutableVec = { x: 0, y: 0 };
  const keys = new Set<string>();
  const keyboardVec: MutableVec = { x: 0, y: 0 };

  const visual: StickVisual = { active: false, originX: 0, originY: 0, knobX: 0, knobY: 0 };

  stage.style.touchAction = 'none';

  function release(): void {
    if (pointerId !== null && stage.hasPointerCapture?.(pointerId)) {
      try {
        stage.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    pointerId = null;
    active = false;
    visual.active = false;
    stickVec.x = 0;
    stickVec.y = 0;
  }

  function onPointerDown(event: PointerEvent): void {
    if (!enabled) return;
    event.preventDefault();
    // A second finger must not take the stick away from the first one.
    if (pointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    knobX = originX;
    knobY = originY;
    active = true;
    visual.active = true;
    visual.originX = originX;
    visual.originY = originY;
    visual.knobX = knobX;
    visual.knobY = knobY;
    stickVec.x = 0;
    stickVec.y = 0;

    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (pointerId === null || event.pointerId !== pointerId) return;
    event.preventDefault();

    const dx = event.clientX - originX;
    const dy = event.clientY - originY;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_RADIUS) {
      const k = MAX_RADIUS / dist;
      knobX = originX + dx * k;
      knobY = originY + dy * k;
    } else {
      knobX = event.clientX;
      knobY = event.clientY;
    }
    visual.knobX = knobX;
    visual.knobY = knobY;

    if (dist <= DEADZONE_PX) {
      stickVec.x = 0;
      stickVec.y = 0;
      return;
    }
    const strength = Math.min(1, (dist - DEADZONE_PX) / (MAX_RADIUS - DEADZONE_PX));
    stickVec.x = (dx / dist) * strength;
    stickVec.y = (dy / dist) * strength;
  }

  function onPointerUp(event: PointerEvent): void {
    if (pointerId === null || event.pointerId !== pointerId) return;
    release();
  }

  function isMoveKey(code: string): boolean {
    return (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight'
    );
  }

  function rebuildKeyboard(): void {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    keyboardVec.x = len > 0 ? x / len : 0;
    keyboardVec.y = len > 0 ? y / len : 0;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (!isMoveKey(event.code)) return;
    if (event.target instanceof HTMLElement && event.target.tagName === 'INPUT') return;
    event.preventDefault();
    keys.add(event.code);
    rebuildKeyboard();
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!isMoveKey(event.code)) return;
    keys.delete(event.code);
    rebuildKeyboard();
  }

  function onBlur(): void {
    keys.clear();
    rebuildKeyboard();
    release();
  }

  // iOS: kill pinch-zoom and rubber-band scrolling while a thumb is on the stage.
  function onTouchMove(event: TouchEvent): void {
    if (active) event.preventDefault();
  }

  function onGestureStart(event: Event): void {
    event.preventDefault();
  }

  stage.addEventListener('pointerdown', onPointerDown, { passive: false });
  stage.addEventListener('pointermove', onPointerMove, { passive: false });
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerUp);
  stage.addEventListener('lostpointercapture', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('gesturestart', onGestureStart as EventListener);

  return {
    read(): MoveInput {
      if (!enabled) return { x: 0, y: 0 };
      if (active) {
        const len = Math.hypot(stickVec.x, stickVec.y);
        if (len < DEADZONE) return { x: 0, y: 0 };
        return { x: stickVec.x, y: stickVec.y };
      }
      return { x: keyboardVec.x, y: keyboardVec.y };
    },
    stick(): StickVisual | null {
      if (!active) return null;
      return visual;
    },
    setEnabled(next: boolean): void {
      enabled = next;
      if (!next) {
        keys.clear();
        rebuildKeyboard();
        release();
      }
    },
    reset(): void {
      keys.clear();
      rebuildKeyboard();
      release();
    },
    destroy(): void {
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('lostpointercapture', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('gesturestart', onGestureStart as EventListener);
    },
  };
}