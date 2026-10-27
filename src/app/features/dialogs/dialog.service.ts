import { Dialog, type DialogConfig, type DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import type { ConfirmOptions } from '@core/tokens';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { ExportImagesDialogComponent } from './export-images-dialog/export-images-dialog.component';
import { MetadataDialogComponent } from './metadata-dialog/metadata-dialog.component';
import { PageNumbersDialogComponent } from './page-numbers-dialog/page-numbers-dialog.component';
import {
  PasswordDialogComponent,
  type PasswordDialogData,
} from './password-dialog/password-dialog.component';
import { ShortcutsDialogComponent } from './shortcuts-dialog/shortcuts-dialog.component';
import {
  SignatureDialogComponent,
  type SignatureResult,
} from './signature-dialog/signature-dialog.component';
import { SplitDialogComponent } from './split-dialog/split-dialog.component';
import { StampDialogComponent, type StampResult } from './stamp-dialog/stamp-dialog.component';
import { WatermarkDialogComponent } from './watermark-dialog/watermark-dialog.component';

/**
 * Punto único para abrir diálogos. Usa el `Dialog` de Angular CDK, que se encarga del foco,
 * la tecla Escape, el fondo y la accesibilidad. Cada método devuelve el resultado del diálogo.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly dialog = inject(Dialog);

  hasOpenDialogs(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  openSignature(): Promise<SignatureResult | undefined> {
    return this.open<SignatureDialogComponent, SignatureResult>(SignatureDialogComponent);
  }

  openStamp(): Promise<StampResult | undefined> {
    return this.open<StampDialogComponent, StampResult>(StampDialogComponent);
  }

  openWatermark(): Promise<void> {
    return this.open(WatermarkDialogComponent).then(() => undefined);
  }

  openPageNumbers(): Promise<void> {
    return this.open(PageNumbersDialogComponent).then(() => undefined);
  }

  openMetadata(): Promise<void> {
    return this.open(MetadataDialogComponent).then(() => undefined);
  }

  openSplit(): Promise<void> {
    return this.open(SplitDialogComponent).then(() => undefined);
  }

  openExportImages(): Promise<void> {
    return this.open(ExportImagesDialogComponent).then(() => undefined);
  }

  openShortcuts(): Promise<void> {
    return this.open(ShortcutsDialogComponent).then(() => undefined);
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return (
      (await this.open<ConfirmDialogComponent, boolean, ConfirmOptions>(
        ConfirmDialogComponent,
        options,
      )) === true
    );
  }

  async password(fileName: string, incorrect: boolean): Promise<string | null> {
    const result = await this.open<PasswordDialogComponent, string, PasswordDialogData>(
      PasswordDialogComponent,
      {
        fileName,
        incorrect,
      },
    );
    return result ?? null;
  }

  private open<C, R = unknown, D = unknown>(
    component: ComponentType<C>,
    data?: D,
  ): Promise<R | undefined> {
    const config: DialogConfig<D, DialogRef<R, C>> = {
      data,
      backdropClass: 'app-dialog-backdrop',
      panelClass: 'app-dialog-panel',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    };
    return firstValueFrom(this.dialog.open<R, D, C>(component, config).closed);
  }
}
