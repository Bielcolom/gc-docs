import fontkit from '@pdf-lib/fontkit';
import {
  BlendMode,
  LineCapStyle,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFFont,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  PDFHexString,
  PDFImage,
  PDFName,
  PDFPage,
  PDFRef,
  PDFString,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import { DocumentStore } from './document.store';
import { FONT_MAP, FontDef, baselineOffset, fontFile, LINE_HEIGHT } from './fonts';
import { Annot, DocState, FontId, PageRef, PathAnnot, TextAnnot } from './models';
import { baseHref } from './pdfjs';
import { Mat, apply, dataUrlToBytes, hexToRgb01, inv, mul } from './util';

type Color = ReturnType<typeof rgb>;
const col = (hex: string): Color => {
  const [r, g, b] = hexToRgb01(hex);
  return rgb(r, g, b);
};

const fontBytesCache = new Map<string, Promise<ArrayBuffer>>();
function fetchFont(file: string): Promise<ArrayBuffer> {
  let p = fontBytesCache.get(file);
  if (!p) {
    p = fetch(`${baseHref()}fonts/${file}`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar la fuente ${file}`);
      return r.arrayBuffer();
    });
    fontBytesCache.set(file, p);
  }
  return p;
}

class FontPool {
  private cache = new Map<string, Promise<PDFFont>>();
  constructor(private doc: PDFDocument) {}

  get(def: FontDef, bold: boolean, italic: boolean): Promise<PDFFont> {
    const key = `${def.id}|${bold}|${italic}`;
    let p = this.cache.get(key);
    if (!p) {
      if (def.standard) {
        const s = def.standard;
        const name = bold && italic ? s.boldItalic : bold ? s.bold : italic ? s.italic : s.regular;
        p = this.doc.embedFont(name as StandardFonts);
      } else {
        const file = fontFile(def, bold, italic)!;
        p = fetchFont(file).then((bytes) => this.doc.embedFont(bytes, { subset: false }));
      }
      this.cache.set(key, p);
    }
    return p;
  }

  /** Devuelve una fuente capaz de codificar el texto (cae a una TTF Unicode si hace falta). */
  async forText(id: FontId, bold: boolean, italic: boolean, text: string): Promise<PDFFont> {
    const def = FONT_MAP[id];
    const font = await this.get(def, bold, italic);
    if (def.standard) {
      try {
        font.encodeText(text);
        return font;
      } catch {
        return this.get(FONT_MAP[def.unicodeFallback ?? 'roboto'], bold, italic);
      }
    }
    return font;
  }
}

export interface ExportOptions {
  /** Solo estas páginas (en este orden). Por defecto, todas. */
  pageIds?: string[];
  /** Aplicar marca de agua / numeración (por defecto sí). */
  decorations?: boolean;
}

export interface ExportResult {
  bytes: Uint8Array;
  rasterized: boolean;
}

export async function exportPdf(store: DocumentStore, opts: ExportOptions = {}): Promise<ExportResult> {
  const state = store.state();
  const pages = opts.pageIds
    ? opts.pageIds.map((id) => state.pages.find((p) => p.id === id)!).filter(Boolean)
    : state.pages;
  if (!pages.length) throw new Error('No hay páginas que exportar');

  // ¿Podemos editar el PDF original "in situ"? (conserva formularios, enlaces y marcadores)
  const first = store.source(pages[0].srcId)!;
  const inPlace =
    !first.info.encrypted &&
    pages.length === first.info.pageCount &&
    pages.every((p, i) => p.srcId === first.info.id && p.srcIndex === i);

  const loaded = new Map<string, PDFDocument | null>();
  let rasterized = false;
  const loadSrc = async (srcId: string): Promise<PDFDocument | null> => {
    if (loaded.has(srcId)) return loaded.get(srcId)!;
    const src = store.source(srcId)!;
    let doc: PDFDocument | null = null;
    if (!src.info.encrypted) {
      try {
        doc = await PDFDocument.load(src.bytes, { updateMetadata: false });
        fillForms(doc, srcId, state, !inPlace);
      } catch (e) {
        console.warn('pdf-lib no pudo leer la fuente, se exportará como imagen', e);
        doc = null;
      }
    }
    loaded.set(srcId, doc);
    return doc;
  };

  let out: PDFDocument;
  const outPages: { page: PDFPage; ref: PageRef; vt: number[] }[] = [];

  if (inPlace) {
    out = (await loadSrc(first.info.id))!;
    if (!out) throw new Error('No se pudo leer el PDF');
    out.getPages().forEach((page, i) => outPages.push({ page, ref: pages[i], vt: pages[i].vt }));
  } else {
    out = await PDFDocument.create();
    // Copiar por fuente de una vez para compartir recursos
    const bySrc = new Map<string, number[]>();
    pages.forEach((p, i) => {
      const list = bySrc.get(p.srcId) ?? [];
      list.push(i);
      bySrc.set(p.srcId, list);
    });
    const copied = new Map<number, PDFPage>();
    const rasterPages = new Map<number, { img: PDFImage }>();
    for (const [srcId, idxs] of bySrc) {
      const doc = await loadSrc(srcId);
      if (doc) {
        const result = await out.copyPages(doc, idxs.map((i) => pages[i].srcIndex));
        result.forEach((pg, k) => copied.set(idxs[k], pg));
      } else {
        rasterized = true;
        for (const i of idxs) {
          const png = await rasterizePage(store, pages[i]);
          rasterPages.set(i, { img: await out.embedJpg(png) });
        }
      }
    }
    pages.forEach((ref, i) => {
      const c = copied.get(i);
      if (c) {
        out.addPage(c);
        outPages.push({ page: c, ref, vt: ref.vt });
      } else {
        const r = rasterPages.get(i)!;
        const page = out.addPage([ref.w, ref.h]);
        page.drawImage(r.img, { x: 0, y: 0, width: ref.w, height: ref.h });
        outPages.push({ page, ref, vt: [1, 0, 0, -1, 0, ref.h] });
      }
    });
  }

  out.registerFontkit(fontkit);
  const fonts = new FontPool(out);
  const images = new Map<string, Promise<PDFImage>>();
  const embedImage = (src: string): Promise<PDFImage> => {
    let p = images.get(src);
    if (!p) {
      const bytes = dataUrlToBytes(src);
      p = src.startsWith('data:image/png') ? out.embedPng(bytes) : out.embedJpg(bytes);
      images.set(src, p);
    }
    return p;
  };

  const byPage = new Map<string, Annot[]>();
  for (const a of state.annots) {
    const l = byPage.get(a.pageId) ?? [];
    l.push(a);
    byPage.set(a.pageId, l);
  }

  const total = outPages.length;
  for (let i = 0; i < outPages.length; i++) {
    const { page, ref, vt } = outPages[i];
    const intrinsic = page.getRotation().angle;
    page.setRotation(degrees((((intrinsic + ref.rotation) % 360) + 360) % 360));

    const toPdf = inv(vt as Mat);
    const baseUp: Mat = mul(toPdf, [1, 0, 0, -1, 0, ref.h]);
    const annots = byPage.get(ref.id) ?? [];
    if (annots.length) {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...baseUp));
      for (const a of annots) {
        if (a.type === 'note') continue;
        await drawAnnot(page, a, ref.h, fonts, embedImage);
      }
      page.pushOperators(popGraphicsState());
      for (const a of annots) if (a.type === 'note') addNoteAnnotation(out, page, a, baseUp, ref.h);
    }

    if (opts.decorations !== false && (state.watermark.enabled || state.pageNumbers.enabled)) {
      const rot = ref.rotation;
      const W = ref.w;
      const H = ref.h;
      const Wd = rot % 180 ? H : W;
      const Hd = rot % 180 ? W : H;
      const baseFromDisp: Mat =
        rot === 0 ? [1, 0, 0, 1, 0, 0] : rot === 90 ? [0, -1, 1, 0, 0, H] : rot === 180 ? [-1, 0, 0, -1, W, H] : [0, 1, -1, 0, W, 0];
      const dispUp: Mat = mul(mul(toPdf, baseFromDisp), [1, 0, 0, -1, 0, Hd]);
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...dispUp));
      if (state.watermark.enabled && state.watermark.text.trim()) {
        const wm = state.watermark;
        const font = await fonts.forText('helvetica', true, false, wm.text);
        const tw = font.widthOfTextAtSize(wm.text, wm.size);
        const ch = font.heightAtSize(wm.size, { descender: false }) * 0.72;
        const t = (wm.angle * Math.PI) / 180;
        const ox = Wd / 2 - ((tw / 2) * Math.cos(t) - (ch / 2) * Math.sin(t));
        const oy = Hd / 2 - ((tw / 2) * Math.sin(t) + (ch / 2) * Math.cos(t));
        page.drawText(wm.text, { x: ox, y: oy, size: wm.size, font, color: col(wm.color), opacity: wm.opacity, rotate: degrees(wm.angle) });
      }
      const pn = state.pageNumbers;
      if (pn.enabled && !(pn.skipFirst && i === 0)) {
        const n = i + pn.startAt - (pn.skipFirst ? 1 : 0);
        const shownTotal = total + pn.startAt - 1 - (pn.skipFirst ? 1 : 0);
        const text = pageNumberText(pn.format, n, shownTotal);
        const font = await fonts.forText('helvetica', false, false, text);
        const tw = font.widthOfTextAtSize(text, pn.size);
        const m = 28;
        const [vpos, hpos] = pn.position.split('-');
        const x = hpos === 'left' ? m : hpos === 'right' ? Wd - m - tw : (Wd - tw) / 2;
        const y = vpos === 'bottom' ? m : Hd - m - pn.size * 0.72;
        page.drawText(text, { x, y, size: pn.size, font, color: col(pn.color) });
      }
      page.pushOperators(popGraphicsState());
    }
  }

  const meta = state.meta;
  if (meta.title) out.setTitle(meta.title, { showInWindowTitleBar: true });
  if (meta.author) out.setAuthor(meta.author);
  if (meta.subject) out.setSubject(meta.subject);
  if (meta.keywords) out.setKeywords(meta.keywords.split(',').map((k) => k.trim()).filter(Boolean));
  out.setProducer('GC Docs · editor de PDF');
  out.setModificationDate(new Date());

  const bytes = await out.save({ useObjectStreams: true });
  return { bytes, rasterized };
}

export function pageNumberText(format: string, n: number, total: number): string {
  return format.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(total));
}

// -----------------------------------------------------------------------------

function fillForms(doc: PDFDocument, srcId: string, state: DocState, flatten: boolean): void {
  let form;
  try {
    form = doc.getForm();
  } catch {
    return;
  }
  const fields = form.getFields();
  if (!fields.length) return;
  const prefix = `${srcId}::`;
  for (const [key, value] of Object.entries(state.forms)) {
    if (!key.startsWith(prefix)) continue;
    const name = key.slice(prefix.length);
    try {
      const field = form.getField(name);
      if (field instanceof PDFTextField) field.setText(String(value ?? ''));
      else if (field instanceof PDFCheckBox) (value ? field.check() : field.uncheck());
      else if (field instanceof PDFRadioGroup) {
        if (value) field.select(String(value));
        else field.clear();
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (value) field.select(String(value));
        else field.clear();
      }
    } catch (e) {
      console.warn('No se pudo rellenar el campo', name, e);
    }
  }
  if (flatten) {
    try {
      form.flatten();
      // pdf-lib puede dejar referencias a widgets ya eliminados: se limpian para no romper el PDF
      for (const page of doc.getPages()) {
        const annots = page.node.Annots();
        if (!annots) continue;
        const keep = annots.asArray().filter((r) => !(r instanceof PDFRef) || doc.context.lookup(r) !== undefined);
        page.node.set(PDFName.of('Annots'), doc.context.obj(keep));
      }
    } catch (e) {
      console.warn('No se pudo aplanar el formulario', e);
    }
  }
}

async function rasterizePage(store: DocumentStore, ref: PageRef): Promise<Uint8Array> {
  const page = await store.getPdfPage(ref.srcId, ref.srcIndex);
  const scale = 2;
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  await page.render({ canvas, viewport: vp, background: '#ffffff' }).promise;
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92));
  return new Uint8Array(await blob.arrayBuffer());
}

function pathPoints(a: PathAnnot): [number, number][] {
  return a.points.map(([px, py]) => [a.x + px * a.w, a.y + py * a.h]);
}

export function arrowHead(x1: number, y1: number, x2: number, y2: number, sw: number): [number, number][] {
  const len = Math.max(9, sw * 4);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const spread = Math.PI / 7;
  return [
    [x2, y2],
    [x2 - len * Math.cos(ang - spread), y2 - len * Math.sin(ang - spread)],
    [x2 - len * Math.cos(ang + spread), y2 - len * Math.sin(ang + spread)],
  ];
}

export function smoothPath(pts: [number, number][]): string {
  if (!pts.length) return '';
  if (pts.length < 3) return `M${pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L')}`;
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0].toFixed(2)} ${last[1].toFixed(2)}`;
  return d;
}

export function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

export const SYMBOL_PATHS: Record<'check' | 'cross', [number, number][][]> = {
  check: [[[0.14, 0.54], [0.4, 0.8], [0.88, 0.2]]],
  cross: [
    [[0.18, 0.18], [0.82, 0.82]],
    [[0.82, 0.18], [0.18, 0.82]],
  ],
};

async function drawAnnot(
  page: PDFPage,
  a: Annot,
  H: number,
  fonts: FontPool,
  embedImage: (src: string) => Promise<PDFImage>,
): Promise<void> {
  const up = (y: number) => H - y;
  switch (a.type) {
    case 'text':
      await drawText(page, a, H, fonts);
      break;
    case 'rect':
      page.drawRectangle({
        x: a.x,
        y: up(a.y + a.h),
        width: a.w,
        height: a.h,
        color: a.fill ? col(a.fill) : undefined,
        borderColor: a.stroke ? col(a.stroke) : undefined,
        borderWidth: a.stroke ? a.strokeWidth : 0,
        opacity: a.opacity,
        borderOpacity: a.opacity,
      });
      break;
    case 'ellipse':
      page.drawEllipse({
        x: a.x + a.w / 2,
        y: up(a.y + a.h / 2),
        xScale: a.w / 2,
        yScale: a.h / 2,
        color: a.fill ? col(a.fill) : undefined,
        borderColor: a.stroke ? col(a.stroke) : undefined,
        borderWidth: a.stroke ? a.strokeWidth : 0,
        opacity: a.opacity,
        borderOpacity: a.opacity,
      });
      break;
    case 'line':
    case 'arrow':
    case 'ink': {
      const pts = pathPoints(a);
      const d = a.type === 'ink' ? smoothPath(pts) : `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
      page.drawSvgPath(d, {
        x: 0,
        y: H,
        borderColor: col(a.stroke),
        borderWidth: a.strokeWidth,
        borderOpacity: a.opacity,
        borderLineCap: LineCapStyle.Round,
      });
      if (a.type === 'arrow') {
        const head = arrowHead(pts[0][0], pts[0][1], pts[1][0], pts[1][1], a.strokeWidth);
        page.drawSvgPath(`M${head[0].join(' ')} L${head[1].join(' ')} L${head[2].join(' ')} Z`, {
          x: 0,
          y: H,
          color: col(a.stroke),
          opacity: a.opacity,
        });
      }
      break;
    }
    case 'highlight': {
      const color = col(a.color);
      if (a.mode === 'highlight') {
        page.drawRectangle({ x: a.x, y: up(a.y + a.h), width: a.w, height: a.h, color, opacity: 0.45 * a.opacity, blendMode: BlendMode.Multiply });
      } else {
        const t = Math.max(1.2, a.h * 0.08);
        const yy = a.mode === 'underline' ? a.y + a.h - t : a.y + a.h / 2 - t / 2;
        page.drawRectangle({ x: a.x, y: up(yy + t), width: a.w, height: t, color, opacity: a.opacity });
      }
      break;
    }
    case 'image': {
      const img = await embedImage(a.src);
      page.drawImage(img, { x: a.x, y: up(a.y + a.h), width: a.w, height: a.h, opacity: a.opacity });
      break;
    }
    case 'stamp': {
      const color = col(a.color);
      const bw = Math.max(1.5, a.h * 0.07);
      page.drawSvgPath(roundedRectPath(a.x + bw / 2, a.y + bw / 2, a.w - bw, a.h - bw, a.h * 0.18), {
        x: 0,
        y: H,
        borderColor: color,
        borderWidth: bw,
        borderOpacity: a.opacity,
      });
      const font = await fonts.forText('helvetica', true, false, a.label);
      let size = a.h * 0.46;
      const max = a.w * 0.84;
      const tw0 = font.widthOfTextAtSize(a.label, size);
      if (tw0 > max) size *= max / tw0;
      const tw = font.widthOfTextAtSize(a.label, size);
      const cap = size * 0.72;
      page.drawText(a.label, { x: a.x + (a.w - tw) / 2, y: up(a.y + a.h / 2 + cap / 2), size, font, color, opacity: a.opacity });
      break;
    }
    case 'symbol': {
      const color = col(a.color);
      if (a.kind === 'dot') {
        page.drawEllipse({ x: a.x + a.w / 2, y: up(a.y + a.h / 2), xScale: a.w * 0.32, yScale: a.h * 0.32, color, opacity: a.opacity });
      } else {
        const sw = Math.min(a.w, a.h) * 0.13;
        for (const stroke of SYMBOL_PATHS[a.kind]) {
          const pts = stroke.map(([px, py]) => [a.x + px * a.w, a.y + py * a.h]);
          page.drawSvgPath(`M${pts.map((p) => p.join(' ')).join(' L')}`, {
            x: 0,
            y: H,
            borderColor: color,
            borderWidth: sw,
            borderOpacity: a.opacity,
            borderLineCap: LineCapStyle.Round,
          });
        }
      }
      break;
    }
  }
}

async function drawText(page: PDFPage, a: TextAnnot, H: number, fonts: FontPool): Promise<void> {
  if (a.cover) {
    page.drawRectangle({ x: a.cover.x, y: H - a.cover.y - a.cover.h, width: a.cover.w, height: a.cover.h, color: col(a.cover.color) });
  }
  if (a.bg) {
    page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, color: col(a.bg), opacity: a.opacity });
  }
  const text = a.text.replace(/\r/g, '');
  if (!text.trim()) return;
  const font = await fonts.forText(a.font, a.bold, a.italic, text);
  const lines = text.split('\n');
  const lh = a.size * LINE_HEIGHT;
  const base = baselineOffset(a.font, a.bold, a.italic, a.size);
  const color = col(a.color);
  // Simula la negrita/cursiva si la fuente no tiene esa variante
  const def = FONT_MAP[a.font];
  const fakeItalic = a.italic && !def.standard && !def.files?.italic;
  lines.forEach((line, i) => {
    if (!line) return;
    const lw = font.widthOfTextAtSize(line, a.size);
    const dx = a.align === 'center' ? (a.w - lw) / 2 : a.align === 'right' ? a.w - lw : 0;
    const x = a.x + dx;
    const yBase = a.y + i * lh + base;
    page.drawText(line, {
      x,
      y: H - yBase,
      size: a.size,
      font,
      color,
      opacity: a.opacity,
      ySkew: undefined,
      xSkew: fakeItalic ? degrees(12) : undefined,
    });
    if (a.underline) {
      const t = Math.max(0.6, a.size / 16);
      page.drawRectangle({ x, y: H - yBase - a.size * 0.12 - t, width: lw, height: t, color, opacity: a.opacity });
    }
  });
}

function addNoteAnnotation(doc: PDFDocument, page: PDFPage, a: Annot, m: Mat, H: number): void {
  if (a.type !== 'note') return;
  const corners = [
    apply(m, a.x, H - a.y),
    apply(m, a.x + a.w, H - a.y),
    apply(m, a.x, H - a.y - a.h),
    apply(m, a.x + a.w, H - a.y - a.h),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const [r, g, b] = hexToRgb01(a.color);
  const dict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    Contents: PDFHexString.fromText(a.text || ''),
    T: PDFHexString.fromText('GC Docs'),
    Name: 'Comment',
    C: [r, g, b],
    F: 4,
    Open: false,
    M: PDFString.fromDate(new Date()),
    CA: a.opacity,
  });
  const ref = doc.context.register(dict);
  page.node.addAnnot(ref);
}
