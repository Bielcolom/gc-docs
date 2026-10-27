import { SOURCE_COLORS } from '@core/constants';

/**
 * Color de cada archivo de origen. Depende del orden en que se abrieron (no del orden actual
 * de las páginas), para que un documento no cambie de color al reordenarlo.
 */
export function sourceColorMap(
  sourceIdsInOpeningOrder: readonly string[],
): ReadonlyMap<string, string> {
  return new Map(
    sourceIdsInOpeningOrder.map((id, i) => [id, SOURCE_COLORS[i % SOURCE_COLORS.length]]),
  );
}
