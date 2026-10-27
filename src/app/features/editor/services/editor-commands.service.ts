import { Injectable, inject } from '@angular/core';
import { createImage, createStamp } from '@core/annotations';
import { PASTE_OFFSET } from '@core/constants';
import { FontMetricsService } from '@core/fonts';
import type { Point } from '@core/models';
import { ACCEPT_IMAGES, FilePickerService, NotificationService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { loadImageFile } from '@core/utils';
import { DialogService } from '@features/dialogs/dialog.service';
import type { SignatureResult } from '@features/dialogs/signature-dialog/signature-dialog.component';
import type { StampResult } from '@features/dialogs/stamp-dialog/stamp-dialog.component';

/** Puntos por píxel de una imagen (96 ppp de pantalla → 72 ppp de PDF). */
const POINTS_PER_PIXEL = 0.75;
const SIGNATURE_MAX_WIDTH = 180;
const STAMP_FONT = 'Helvetica, Arial, sans-serif';

/** Acciones del editor que crean o modifican anotaciones. */
@Injectable({ providedIn: 'root' })
export class EditorCommandsService {
  private readonly documentStore = inject(DocumentStore);
  private readonly editorStore = inject(EditorStore);
  private readonly picker = inject(FilePickerService);
  private readonly metrics = inject(FontMetricsService);
  private readonly notifications = inject(NotificationService);
  private readonly dialogs = inject(DialogService);

  async openSignature(): Promise<void> {
    const signature = await this.dialogs.openSignature();
    if (signature) this.placeSignature(signature);
  }

  async openStamp(): Promise<void> {
    const stamp = await this.dialogs.openStamp();
    if (stamp) this.placeStamp(stamp);
  }

  async pickImage(): Promise<void> {
    const [file] = await this.picker.pick(ACCEPT_IMAGES, false);
    if (file) await this.insertImageFile(file);
  }

  async insertImageFile(
    file: Blob,
    page = this.editorStore.currentPage(),
    at?: Point,
  ): Promise<void> {
    if (!page) return;
    try {
      const image = await loadImageFile(file);
      this.add(
        createImage(
          page,
          image.src,
          { width: image.width * POINTS_PER_PIXEL, height: image.height * POINTS_PER_PIXEL },
          { at },
        ),
      );
    } catch {
      this.notifications.error('No se pudo leer la imagen');
    }
  }

  placeSignature(signature: SignatureResult): void {
    const page = this.editorStore.currentPage();
    if (!page) return;
    const maxWidth = Math.min(SIGNATURE_MAX_WIDTH, page.width * 0.35);
    this.add(createImage(page, signature.src, signature, { isSignature: true, maxWidth }));
  }

  placeStamp(stamp: StampResult): void {
    const page = this.editorStore.currentPage();
    if (!page) return;
    this.add(
      createStamp(page, stamp.label, stamp.color, (size) =>
        this.metrics.measure(stamp.label, STAMP_FONT, size, true),
      ),
    );
  }

  duplicateSelected(): void {
    const id = this.editorStore.selectedAnnotationId();
    if (id)
      this.editorStore.selectAnnotation(this.documentStore.duplicateAnnotation(id, PASTE_OFFSET));
  }

  deleteSelected(): void {
    const id = this.editorStore.selectedAnnotationId();
    if (id) this.documentStore.removeAnnotation(id);
  }

  nudgeSelected(dx: number, dy: number): void {
    const annotation = this.editorStore.selectedAnnotation();
    if (annotation) {
      this.documentStore.updateAnnotation(
        annotation.id,
        { x: annotation.x + dx, y: annotation.y + dy },
        `nudge:${annotation.id}`,
      );
    }
  }

  goToPage(index: number): void {
    const total = this.documentStore.pageCount();
    this.editorStore.requestScroll(Math.max(0, Math.min(total - 1, index)));
  }

  private add(annotation: Parameters<DocumentStore['addAnnotation']>[0]): void {
    this.documentStore.addAnnotation(annotation);
    this.editorStore.setTool('select');
    this.editorStore.selectAnnotation(annotation.id);
  }
}
