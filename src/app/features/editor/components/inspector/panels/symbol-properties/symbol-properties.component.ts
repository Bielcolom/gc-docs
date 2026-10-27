import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PALETTE } from '@core/constants';
import type { SymbolKind } from '@core/models';
import { ColorSwatchesComponent, IconComponent, type IconName } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-symbol-properties',
  imports: [ColorSwatchesComponent, IconComponent],
  templateUrl: './symbol-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SymbolPropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly palette = PALETTE;
  protected readonly kinds: readonly {
    readonly kind: SymbolKind;
    readonly icon: IconName;
    readonly label: string;
  }[] = [
    { kind: 'check', icon: 'check', label: 'Visto bueno' },
    { kind: 'cross', icon: 'cross', label: 'Aspa' },
    { kind: 'dot', icon: 'dot', label: 'Punto' },
  ];
  protected readonly symbolSize = computed(() => Math.round(this.target.annotation()?.w ?? 0));

  protected onSize(event: Event): void {
    this.target.setSymbolSize(parseFloat((event.target as HTMLInputElement).value));
  }
}
