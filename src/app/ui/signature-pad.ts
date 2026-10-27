import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, afterNextRender, computed, inject, output, signal, viewChild } from '@angular/core';
import { DocumentStore } from '../core/document.store';
import { FONT_MAP } from '../core/fonts';
import { currentPageRef, placeImage } from '../core/actions';
import { loadImage, normalizeImage } from '../core/util';
import { Icon } from './icon';
import { PageActions } from './page-actions';

const STORAGE_KEY = 'gcdocs.signatures';

interface Saved {
  src: string;
  w: number;
  h: number;
}

@Component({
  selector: 'app-signature-pad',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature-pad.html',
  styleUrl: './signature-pad.css',
})
export class SignaturePad implements OnDestroy {
  readonly done = output<void>();
  private readonly store = inject(DocumentStore);
  private readonly actions = inject(PageActions);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('pad');

  protected readonly tab = signal<'draw' | 'type' | 'upload'>('draw');
  protected readonly color = signal('#111418');
  protected readonly name = signal('');
  protected readonly typeFont = signal<'dancing' | 'greatvibes' | 'caveat'>('greatvibes');
  protected readonly hasInk = signal(false);
  protected readonly upload = signal<{ src: string; w: number; h: number } | null>(null);
  protected readonly removeBg = signal(true);
  protected readonly saved = signal<Saved[]>(this.loadSaved());
  protected readonly FONT_MAP = FONT_MAP;
  protected readonly typeFonts = ['greatvibes', 'dancing', 'caveat'] as const;
  protected readonly canUse = computed(() => {
    const t = this.tab();
    if (t === 'draw') return this.hasInk();
    if (t === 'type') return this.name().trim().length > 0;
    return !!this.upload();
  });

  private strokes: { color: string; pts: [number, number][] }[] = [];
  private ro?: ResizeObserver;

  constructor() {
    afterNextRender(() => this.setupCanvas());
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  protected setTab(t: 'draw' | 'type' | 'upload'): void {
    this.tab.set(t);
    if (t === 'draw') setTimeout(() => this.setupCanvas(), 0);
  }

  private setupCanvas(): void {
    const c = this.canvasRef()?.nativeElement;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      this.redraw();
    };
    this.ro?.disconnect();
    this.ro = new ResizeObserver(fit);
    this.ro.observe(c);
    fit();
  }

  private redraw(): void {
    const c = this.canvasRef()?.nativeElement;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    const dpr = window.devicePixelRatio || 1;
    for (const s of this.strokes) drawStroke(ctx, s.pts, s.color, 2.6 * dpr, c.width, c.height);
  }

  protected onDown(e: PointerEvent): void {
    const c = this.canvasRef()!.nativeElement;
    c.setPointerCapture(e.pointerId);
    const r = c.getBoundingClientRect();
    const toN = (ev: PointerEvent): [number, number] => [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height];
    const stroke = { color: this.color(), pts: [toN(e)] };
    this.strokes.push(stroke);
    const move = (ev: PointerEvent) => {
      stroke.pts.push(toN(ev));
      this.redraw();
    };
    const up = () => {
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      this.hasInk.set(this.strokes.some((s) => s.pts.length > 1));
    };
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }

  protected clear(): void {
    this.strokes = [];
    this.hasInk.set(false);
    this.redraw();
  }

  protected setColor(c: string): void {
    this.color.set(c);
    for (const s of this.strokes) s.color = c;
    this.redraw();
  }

  protected async pickUpload(): Promise<void> {
    const [file] = await this.actions.pickFiles('image/*', false);
    if (!file) return;
    const img = await normalizeImage(file);
    this.upload.set({ src: img.src, w: img.width, h: img.height });
  }

  protected async use(): Promise<void> {
    let result: Saved | null = null;
    const t = this.tab();
    if (t === 'draw') result = this.renderDrawn();
    else if (t === 'type') result = await this.renderTyped();
    else if (this.upload()) result = await this.processUpload(this.upload()!);
    if (!result) return;
    this.save(result);
    this.place(result);
  }

  protected place(s: Saved): void {
    const page = currentPageRef(this.store);
    if (!page) return;
    const targetW = Math.min(180, page.w * 0.35);
    placeImage(this.store, page, s.src, targetW, (targetW * s.h) / s.w, { isSignature: true });
    this.done.emit();
  }

  protected forget(i: number): void {
    const list = this.saved().filter((_, k) => k !== i);
    this.saved.set(list);
    this.persist(list);
  }

  private renderDrawn(): Saved | null {
    const pts = this.strokes.flatMap((s) => s.pts);
    if (!pts.length) return null;
    const src = this.canvasRef()!.nativeElement;
    const W = 1200;
    const H = Math.round((W * src.height) / src.width);
    const xs = pts.map((p) => p[0] * W);
    const ys = pts.map((p) => p[1] * H);
    const pad = 14;
    const minX = Math.max(0, Math.min(...xs) - pad);
    const minY = Math.max(0, Math.min(...ys) - pad);
    const maxX = Math.min(W, Math.max(...xs) + pad);
    const maxY = Math.min(H, Math.max(...ys) + pad);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(maxX - minX));
    out.height = Math.max(1, Math.round(maxY - minY));
    const ctx = out.getContext('2d')!;
    ctx.translate(-minX, -minY);
    for (const s of this.strokes) drawStroke(ctx, s.pts, s.color, 7, W, H);
    return { src: out.toDataURL('image/png'), w: out.width, h: out.height };
  }

  private async renderTyped(): Promise<Saved | null> {
    const text = this.name().trim();
    if (!text) return null;
    const css = FONT_MAP[this.typeFont()].css;
    await document.fonts.load(`120px ${css}`);
    const size = 150;
    const m = document.createElement('canvas').getContext('2d')!;
    m.font = `${size}px ${css}`;
    const metrics = m.measureText(text);
    const pad = 30;
    const w = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + pad * 2);
    const asc = metrics.actualBoundingBoxAscent;
    const desc = metrics.actualBoundingBoxDescent;
    const h = Math.ceil(asc + desc + pad * 2);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.font = `${size}px ${css}`;
    ctx.fillStyle = this.color();
    ctx.fillText(text, pad + metrics.actualBoundingBoxLeft, pad + asc);
    return { src: c.toDataURL('image/png'), w, h };
  }

  private async processUpload(u: { src: string; w: number; h: number }): Promise<Saved> {
    if (!this.removeBg()) return u;
    const img = await loadImage(u.src);
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum > 215) d[i + 3] = 0;
      else if (lum > 160) d[i + 3] = Math.round(d[i + 3] * ((215 - lum) / 55));
    }
    ctx.putImageData(data, 0, 0);
    return { src: c.toDataURL('image/png'), w: c.width, h: c.height };
  }

  private loadSaved(): Saved[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private save(s: Saved): void {
    const list = [s, ...this.saved().filter((x) => x.src !== s.src)].slice(0, 6);
    this.saved.set(list);
    this.persist(list);
  }

  private persist(list: Saved[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* almacenamiento lleno o no disponible */
    }
  }

  protected value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, pts: [number, number][], color: string, width: number, W: number, H: number): void {
  if (!pts.length) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0] * W, pts[0][1] * H, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i][0] + pts[i + 1][0]) / 2) * W;
    const my = ((pts[i][1] + pts[i + 1][1]) / 2) * H;
    ctx.quadraticCurveTo(pts[i][0] * W, pts[i][1] * H, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0] * W, last[1] * H);
  ctx.stroke();
}
