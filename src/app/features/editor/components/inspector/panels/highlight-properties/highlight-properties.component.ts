import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HIGHLIGHT_COLORS, PALETTE } from '@core/constants';
import type { HighlightMode } from '@core/models';
import { ColorSwatchesComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-highlight-properties',
  imports: [ColorSwatchesComponent],
  templateUrl: './highlight-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightPropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly modes: readonly { readonly id: HighlightMode; readonly label: string }[] = [
    { id: 'highlight', label: 'Resaltar' },
    { id: 'underline', label: 'Subrayar' },
    { id: 'strike', label: 'Tachar' },
  ];
  protected readonly colors = computed(() =>
    this.target.highlightMode() === 'highlight' ? HIGHLIGHT_COLORS : PALETTE,
  );
}
