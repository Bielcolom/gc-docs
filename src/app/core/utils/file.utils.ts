const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || IMAGE_EXTENSIONS.test(file.name);
}

export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
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

export interface LoadedImage {
  /** Data URL en PNG o JPEG (los formatos que admite pdf-lib). */
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** Lee cualquier imagen que entienda el navegador y la convierte a PNG si no es PNG o JPEG. */
export async function loadImageFile(file: Blob): Promise<LoadedImage> {
  const url = await readFileAsDataUrl(file);
  const img = await loadImage(url);
  if (/^data:image\/(png|jpeg|jpg)/.test(url))
    return { src: url, width: img.naturalWidth, height: img.naturalHeight };
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')?.drawImage(img, 0, 0);
  return { src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(',')[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      type,
      quality,
    ),
  );
}
