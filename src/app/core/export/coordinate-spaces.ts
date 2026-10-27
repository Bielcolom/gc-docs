import type { Matrix, PageRef, Size } from '@core/models';
import { baseFromDisplay, displaySize, flipY, invert, multiply } from '@core/utils';

/**
 * Matriz que convierte el espacio base con el eje Y hacia arriba en el espacio PDF de la página.
 * Dibujar con el eje Y hacia arriba permite usar `drawText` de pdf-lib sin que el texto salga invertido.
 */
export function baseToPdf(page: Pick<PageRef, 'viewportTransform' | 'height'>): Matrix {
  return multiply(invert(page.viewportTransform), flipY(page.height));
}

/** Igual que `baseToPdf`, pero para el espacio "tal y como se ve" (con la rotación del usuario). */
export function displayToPdf(page: PageRef): { matrix: Matrix; size: Size } {
  const size = displaySize(page);
  const matrix = multiply(
    multiply(
      invert(page.viewportTransform),
      baseFromDisplay(page.rotation, page.width, page.height),
    ),
    flipY(size.h),
  );
  return { matrix, size };
}
