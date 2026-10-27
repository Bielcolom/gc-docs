import { Injectable, inject } from '@angular/core';
import type { PageRef } from '@core/models';
import {
  PasswordRequiredError,
  SourceRegistryService,
  createBlankPdf,
  createPdfFromImages,
} from '@core/pdf';
import { DocumentStore, EditorStore } from '@core/state';
import { USER_PROMPTS } from '@core/tokens/user-prompts.token';
import { baseName, isImageFile, loadImageFile, readFileBytes } from '@core/utils';
import { ActivityService } from './activity.service';

/** Convierte archivos del usuario en páginas del documento. */
@Injectable({ providedIn: 'root' })
export class DocumentLoaderService {
  private readonly sources = inject(SourceRegistryService);
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly prompts = inject(USER_PROMPTS);
  private readonly activity = inject(ActivityService);

  /** Abre archivos como un documento nuevo, sustituyendo al actual. Devuelve las páginas cargadas. */
  async open(files: readonly File[]): Promise<number> {
    const pages = await this.toPages(files);
    if (!pages.length) return 0;
    this.documentStore.load(pages, baseName(files[0].name));
    this.editorStore.reset();
    return pages.length;
  }

  /** Inserta archivos como páginas nuevas a partir de la posición `at` (al final si no se indica). */
  async insert(files: readonly File[], at?: number): Promise<number> {
    const pages = await this.toPages(files);
    if (!pages.length) return 0;
    const index = at ?? this.documentStore.pageCount();
    this.documentStore.insertPages(pages, index);
    this.editorStore.requestScroll(index);
    return pages.length;
  }

  async openBlank(): Promise<void> {
    const pages = await this.sources.register(await createBlankPdf(), 'en blanco.pdf');
    this.documentStore.load(pages, 'documento nuevo');
    this.editorStore.reset();
  }

  /** Inserta una hoja en blanco del mismo tamaño que la página anterior. */
  async insertBlank(at: number): Promise<void> {
    const reference = this.documentStore.pages()[Math.max(0, at - 1)];
    const rotated = reference ? reference.rotation % 180 !== 0 : false;
    const width = reference ? (rotated ? reference.height : reference.width) : undefined;
    const height = reference ? (rotated ? reference.width : reference.height) : undefined;
    const pages = await this.sources.register(
      await createBlankPdf(width, height),
      'página en blanco.pdf',
    );
    this.documentStore.insertPages(pages, at);
    this.editorStore.requestScroll(at);
  }

  close(): void {
    this.documentStore.close();
    this.editorStore.reset();
    this.sources.clear();
  }

  private toPages(files: readonly File[]): Promise<PageRef[]> {
    const label =
      files.length > 1 ? `Abriendo ${files.length} archivos…` : `Abriendo ${files[0]?.name ?? ''}…`;
    return this.activity.run(label, async () => {
      const pages: PageRef[] = [];
      const images = files.filter(isImageFile);
      for (const file of files.filter((f) => !isImageFile(f))) {
        pages.push(...(await this.registerWithPassword(await readFileBytes(file), file.name)));
      }
      if (images.length) {
        const bytes = await createPdfFromImages(await Promise.all(images.map(loadImageFile)));
        pages.push(
          ...(await this.sources.register(
            bytes,
            images.length === 1 ? images[0].name : 'imágenes.pdf',
          )),
        );
      }
      return pages;
    });
  }

  /** Abre un PDF pidiendo la contraseña tantas veces como haga falta. */
  private async registerWithPassword(bytes: Uint8Array, name: string): Promise<PageRef[]> {
    let password: string | undefined;
    for (;;) {
      try {
        return await this.sources.register(bytes, name, password);
      } catch (error) {
        if (!(error instanceof PasswordRequiredError)) throw error;
        const answer = await this.prompts.password(name, error.incorrect);
        if (answer === null) return [];
        password = answer;
      }
    }
  }
}
