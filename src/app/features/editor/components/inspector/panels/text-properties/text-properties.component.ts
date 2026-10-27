import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { COVER_COLORS, PALETTE } from '@core/constants';
import { FONTS, FONT_GROUP_LABELS } from '@core/fonts';
import type { FontGroup, FontId, TextAnnotation } from '@core/models';
import { DocumentStore } from '@core/state';
import { NotificationService } from '@core/services';
import { ColorSwatchesComponent, IconComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

const GROUPS: readonly FontGroup[] = ['classic', 'modern', 'handwriting'];

@Component({
  selector: 'app-text-properties',
  imports: [IconComponent, ColorSwatchesComponent],
  templateUrl: './text-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextPropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  private readonly documentStore = inject(DocumentStore);
  private readonly notifications = inject(NotificationService);

  protected readonly palette = PALETTE;
  protected readonly coverColors = COVER_COLORS;
  protected readonly fontGroups = GROUPS.map((group) => ({
    label: FONT_GROUP_LABELS[group],
    fonts: FONTS.filter((f) => f.group === group),
  }));

  /** La anotación de texto seleccionada (no existe cuando se edita el estilo de la herramienta). */
  protected readonly text = computed(() => {
    const a = this.target.annotation();
    return a?.type === 'text' ? (a as TextAnnotation) : null;
  });

  protected onFontChange(event: Event): void {
    this.target.setFont((event.target as HTMLSelectElement).value as FontId);
  }

  protected onSizeChange(event: Event): void {
    this.target.setSize(parseFloat((event.target as HTMLInputElement).value));
  }

  protected restoreOriginal(): void {
    const text = this.text();
    if (!text) return;
    this.documentStore.removeAnnotation(text.id);
    this.notifications.success('Texto original restaurado');
  }
}
