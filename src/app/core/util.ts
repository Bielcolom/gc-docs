let counter = 0;
export function uid(prefix = 'id'): string {
  counter++;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function hexToRgb01(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}

export function readFileBytes(file: Blob): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b));
}

export function readFileDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

/** Convierte cualquier imagen que entienda el navegador a PNG/JPEG (lo que admite pdf-lib). */
export async function normalizeImage(file: Blob): Promise<{ src: string; width: number; height: number }> {
  const url = await readFileDataUrl(file);
  const img = await loadImage(url);
  if (/^data:image\/(png|jpeg|jpg)/.test(url)) return { src: url, width: img.naturalWidth, height: img.naturalHeight };
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return { src: c.toDataURL('image/png'), width: c.width, height: c.height };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function downloadBlob(data: Blob | Uint8Array, filename: string, type = 'application/pdf'): void {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** "1-3, 5, 8-" -> índices base 0 */
export function parseRanges(input: string, total: number): number[][] | null {
  const groups: number[][] = [];
  for (const part of input.split(/[,;]+/)) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^(\d+)?\s*(-)?\s*(\d+)?$/);
    if (!m) return null;
    const a = m[1] ? parseInt(m[1], 10) : 1;
    const b = m[2] ? (m[3] ? parseInt(m[3], 10) : total) : a;
    if (a < 1 || b < 1 || a > total || b > total) return null;
    const g: number[] = [];
    if (a <= b) for (let i = a; i <= b; i++) g.push(i - 1);
    else for (let i = a; i >= b; i--) g.push(i - 1);
    groups.push(g);
  }
  return groups.length ? groups : null;
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

/** Matriz afín [a b c d e f]: x' = a x + c y + e ; y' = b x + d y + f */
export type Mat = [number, number, number, number, number, number];

export function mul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function inv(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  return [
    m[3] / det,
    -m[1] / det,
    -m[2] / det,
    m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
