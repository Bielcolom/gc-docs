import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SIGNATURE_INKS } from '@core/constants';
import { getFont } from '@core/fonts';
import type { FontId } from '@core/models';
import { ACCEPT_IMAGES, FilePickerService } from '@core/services';
import { loadImageFile } from '@core/utils';
import { DialogShellComponent } from '@shared/components';
import { AutofocusDirective } from '@shared/directives';
import {
  removeWhiteBackground,
  renderTypedSignature,
  type SignatureImage,
} from './signature-image';
import { SignaturePadComponent } from './signature-pad/signature-pad.component';
import { SignatureStorageService } from './signature-storage.service';

export type SignatureResult = SignatureImage;
type SignatureTab = 'draw' | 'type' | 'upload';

const HANDWRITING_FONTS: readonly FontId[] = ['great-vibes', 'dancing', 'caveat'];

@Component({
  selector: 'app-signature-dialog',
  imports: [DialogShellComponent, SignaturePadComponent, AutofocusDirective],
  templateUrl: './signature-dialog.component.html',
  styleUrl: './signature-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignatureDialogComponent {
  private readonly dialogRef = inject<DialogRef<SignatureResult>>(DialogRef);
  private readonly picker = inject(FilePickerService);
  protected readonly storage = inject(SignatureStorageService);
  private readonly pad = viewChild(SignaturePadComponent);

  protected readonly inks = SIGNATURE_INKS;
  protected readonly fonts = HANDWRITING_FONTS.map((id) => ({ id, css: getFont(id).cssFamily }));

  protected readonly tab = signal<SignatureTab>('draw');
  protected readonly ink = signal<string>(SIGNATURE_INKS[0]);
  protected readonly typedName = signal('');
  protected readonly typedFont = signal<FontId>('great-vibes');
  protected readonly uploaded = signal<SignatureImage | null>(null);
  protected readonly removeBackground = signal(true);

  protected readonly canPlace = computed(() => {
    switch (this.tab()) {
      case 'draw':
        return this.pad()?.isEmpty() === false;
      case 'type':
        return this.typedName().trim().length > 0;
      case 'upload':
        return this.uploaded() !== null;
    }
  });

  protected async pickImage(): Promise<void> {
    const [file] = await this.picker.pick(ACCEPT_IMAGES, false);
    if (file) this.uploaded.set(await loadImageFile(file));
  }

  protected async place(): Promise<void> {
    const signature = await this.build();
    if (!signature) return;
    this.storage.remember(signature);
    this.dialogRef.close(signature);
  }

  protected reuse(signature: SignatureImage): void {
    this.dialogRef.close(signature);
  }

  protected onNameInput(event: Event): void {
    this.typedName.set((event.target as HTMLInputElement).value);
  }

  protected onRemoveBackgroundChange(event: Event): void {
    this.removeBackground.set((event.target as HTMLInputElement).checked);
  }

  private async build(): Promise<SignatureImage | null> {
    switch (this.tab()) {
      case 'draw':
        return this.pad()?.toImage() ?? null;
      case 'type':
        return renderTypedSignature(
          this.typedName(),
          getFont(this.typedFont()).cssFamily,
          this.ink(),
        );
      case 'upload': {
        const image = this.uploaded();
        if (!image) return null;
        return this.removeBackground() ? removeWhiteBackground(image) : image;
      }
    }
  }
}
