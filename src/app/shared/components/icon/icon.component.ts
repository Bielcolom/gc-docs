import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICONS, type IconName } from './icons';

/** Icono SVG decorativo. Para iconos con significado, pon el texto en el botón que lo contiene. */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  readonly strokeWidth = input(1.8);

  protected readonly paths = computed(() => ICONS[this.name()].split(/ (?=M)/));
}
