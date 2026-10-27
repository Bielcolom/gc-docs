/**
 * Operaciones puras sobre el documento: reciben un estado y devuelven otro nuevo
 * (o el mismo objeto si no hay cambios). No tienen dependencias de Angular, así que
 * se prueban de forma aislada y se reutilizan desde el store.
 */
import type {
  Annotation,
  AnnotationPatch,
  DocumentGroup,
  DocumentState,
  FormValue,
  PageRef,
  Rotation,
} from '@core/models';

const sameOrder = (a: readonly PageRef[], b: readonly PageRef[]): boolean =>
  a.length === b.length && a.every((p, i) => p === b[i]);

const withPages = (state: DocumentState, pages: readonly PageRef[]): DocumentState =>
  sameOrder(pages, state.pages) ? state : { ...state, pages };

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------

export function insertPages(
  state: DocumentState,
  pages: readonly PageRef[],
  at = state.pages.length,
): DocumentState {
  if (!pages.length) return state;
  const next = [...state.pages];
  next.splice(Math.max(0, Math.min(at, next.length)), 0, ...pages);
  return { ...state, pages: next };
}

export function rotatePages(
  state: DocumentState,
  ids: readonly string[],
  delta: 90 | -90,
): DocumentState {
  const set = new Set(ids);
  if (!state.pages.some((p) => set.has(p.id))) return state;
  return {
    ...state,
    pages: state.pages.map((p) =>
      set.has(p.id)
        ? { ...p, rotation: ((((p.rotation + delta) % 360) + 360) % 360) as Rotation }
        : p,
    ),
  };
}

/** Elimina páginas y sus anotaciones. Nunca deja el documento vacío. */
export function deletePages(state: DocumentState, ids: readonly string[]): DocumentState {
  const set = new Set(ids);
  const pages = state.pages.filter((p) => !set.has(p.id));
  if (!pages.length || pages.length === state.pages.length) return state;
  return { ...state, pages, annotations: state.annotations.filter((a) => !set.has(a.pageId)) };
}

/** Duplica cada página (con sus anotaciones) justo después de la original. */
export function duplicatePages(
  state: DocumentState,
  ids: readonly string[],
  newId: (prefix: string) => string,
): DocumentState {
  const set = new Set(ids);
  if (!state.pages.some((p) => set.has(p.id))) return state;
  const pages: PageRef[] = [];
  const annotations = [...state.annotations];
  for (const page of state.pages) {
    pages.push(page);
    if (!set.has(page.id)) continue;
    const copy: PageRef = { ...page, id: newId('pg') };
    pages.push(copy);
    for (const a of state.annotations) {
      if (a.pageId === page.id) annotations.push({ ...a, id: newId('an'), pageId: copy.id });
    }
  }
  return { ...state, pages, annotations };
}

/** Mueve las páginas para que queden justo antes de la que ahora ocupa `toIndex` (0..n). */
export function movePages(
  state: DocumentState,
  ids: readonly string[],
  toIndex: number,
): DocumentState {
  const set = new Set(ids);
  const moving = state.pages.filter((p) => set.has(p.id));
  const before = state.pages.slice(0, toIndex).filter((p) => !set.has(p.id));
  const after = state.pages.slice(toIndex).filter((p) => !set.has(p.id));
  return withPages(state, [...before, ...moving, ...after]);
}

/** Coloca las páginas para que la primera quede en la posición final `index` (base 0). */
export function placePages(
  state: DocumentState,
  ids: readonly string[],
  index: number,
): DocumentState {
  const set = new Set(ids);
  const moving = state.pages.filter((p) => set.has(p.id));
  const rest = state.pages.filter((p) => !set.has(p.id));
  const at = Math.max(0, Math.min(index, rest.length));
  return withPages(state, [...rest.slice(0, at), ...moving, ...rest.slice(at)]);
}

/** Desplaza las páginas una posición; no hace nada si alguna ya está en el extremo. */
export function shiftPages(
  state: DocumentState,
  ids: readonly string[],
  direction: -1 | 1,
): DocumentState {
  const set = new Set(ids);
  const pages = [...state.pages];
  const indexes = pages.flatMap((p, i) => (set.has(p.id) ? [i] : []));
  if (!indexes.length) return state;
  if (direction < 0 && indexes[0] === 0) return state;
  if (direction > 0 && indexes[indexes.length - 1] === pages.length - 1) return state;
  for (const i of direction < 0 ? indexes : [...indexes].reverse()) {
    [pages[i], pages[i + direction]] = [pages[i + direction], pages[i]];
  }
  return withPages(state, pages);
}

export function reversePages(state: DocumentState): DocumentState {
  return state.pages.length < 2 ? state : { ...state, pages: [...state.pages].reverse() };
}

// ---------------------------------------------------------------------------
// Documentos de origen
// ---------------------------------------------------------------------------

/** Páginas agrupadas por archivo de origen, en el orden en que aparece cada archivo. */
export function groupBySource(
  pages: readonly PageRef[],
  nameOf: (sourceId: string) => string,
): DocumentGroup[] {
  const groups = new Map<string, PageRef[]>();
  for (const page of pages) {
    const list = groups.get(page.sourceId);
    if (list) list.push(page);
    else groups.set(page.sourceId, [page]);
  }
  return [...groups].map(([sourceId, list]) => ({ sourceId, name: nameOf(sourceId), pages: list }));
}

/** Reordena archivos completos; las páginas de cada uno quedan juntas y en su orden actual. */
export function reorderSources(state: DocumentState, order: readonly string[]): DocumentState {
  const groups = new Map(groupBySource(state.pages, () => '').map((g) => [g.sourceId, g.pages]));
  const pages = order.flatMap((id) => groups.get(id) ?? []);
  for (const [id, list] of groups) if (!order.includes(id)) pages.push(...list);
  return withPages(state, pages);
}

export function sortSourcesByName(
  state: DocumentState,
  nameOf: (sourceId: string) => string,
  direction: 'asc' | 'desc',
): DocumentState {
  const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
  const sign = direction === 'asc' ? 1 : -1;
  const order = groupBySource(state.pages, nameOf)
    .sort((a, b) => collator.compare(a.name, b.name) * sign)
    .map((g) => g.sourceId);
  return reorderSources(state, order);
}

// ---------------------------------------------------------------------------
// Anotaciones
// ---------------------------------------------------------------------------

export function addAnnotation(state: DocumentState, annotation: Annotation): DocumentState {
  return { ...state, annotations: [...state.annotations, annotation] };
}

export function updateAnnotation(
  state: DocumentState,
  id: string,
  patch: AnnotationPatch,
): DocumentState {
  let changed = false;
  const annotations = state.annotations.map((a) => {
    if (a.id !== id) return a;
    changed = true;
    return { ...a, ...patch } as Annotation;
  });
  return changed ? { ...state, annotations } : state;
}

/** Actualiza varias anotaciones a la vez (p. ej. medidas calculadas al dibujar). */
export function patchAnnotations(
  state: DocumentState,
  patches: ReadonlyMap<string, AnnotationPatch>,
): DocumentState {
  if (!patches.size) return state;
  return {
    ...state,
    annotations: state.annotations.map((a) => {
      const patch = patches.get(a.id);
      return patch ? ({ ...a, ...patch } as Annotation) : a;
    }),
  };
}

export function removeAnnotation(state: DocumentState, id: string): DocumentState {
  const annotations = state.annotations.filter((a) => a.id !== id);
  return annotations.length === state.annotations.length ? state : { ...state, annotations };
}

/** Copia una anotación desplazada. Una edición de texto se copia como texto normal. */
export function duplicateAnnotation(
  state: DocumentState,
  id: string,
  newId: string,
  offset: number,
): DocumentState {
  const source = state.annotations.find((a) => a.id === id);
  if (!source) return state;
  let copy: Annotation = { ...source, id: newId, x: source.x + offset, y: source.y + offset };
  if (copy.type === 'text') {
    const { cover: _cover, editOf: _editOf, ...plain } = copy;
    copy = plain;
  }
  return addAnnotation(state, copy);
}

export function moveAnnotationInStack(
  state: DocumentState,
  id: string,
  to: 'front' | 'back',
): DocumentState {
  const target = state.annotations.find((a) => a.id === id);
  if (!target) return state;
  const rest = state.annotations.filter((a) => a.id !== id);
  return { ...state, annotations: to === 'front' ? [...rest, target] : [target, ...rest] };
}

// ---------------------------------------------------------------------------
// Formularios y ajustes
// ---------------------------------------------------------------------------

export const formValueKey = (sourceId: string, fieldName: string): string =>
  `${sourceId}::${fieldName}`;

export function setFormValue(state: DocumentState, key: string, value: FormValue): DocumentState {
  return state.formValues[key] === value
    ? state
    : { ...state, formValues: { ...state.formValues, [key]: value } };
}
