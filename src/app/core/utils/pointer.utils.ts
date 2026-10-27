import { DRAG_THRESHOLD_PX } from '@core/constants';

export interface PointerTrackingHandlers {
  /** Se llama con cada movimiento, una vez superado el umbral de arrastre. */
  readonly onMove?: (event: PointerEvent) => void;
  /** Se llama al soltar. `dragged` indica si se llegó a arrastrar o fue un simple clic. */
  readonly onEnd?: (event: PointerEvent, dragged: boolean) => void;
  /** Distancia mínima en píxeles para considerar que hay arrastre. */
  readonly threshold?: number;
}

/**
 * Sigue el puntero desde un `pointerdown` hasta que se suelta, escuchando en `window`
 * para no perder el arrastre si el cursor sale del elemento. Devuelve una función para cancelar.
 */
export function trackPointer(start: PointerEvent, handlers: PointerTrackingHandlers): () => void {
  const threshold = handlers.threshold ?? DRAG_THRESHOLD_PX;
  let dragged = false;

  const move = (event: PointerEvent) => {
    if (
      !dragged &&
      Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < threshold
    )
      return;
    dragged = true;
    event.preventDefault();
    handlers.onMove?.(event);
  };
  const end = (event: PointerEvent) => {
    stop();
    handlers.onEnd?.(event, dragged);
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };

  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  return stop;
}
