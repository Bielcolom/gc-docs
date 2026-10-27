import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ENVIRONMENT } from '@core/tokens';

/** Logotipo: una hoja con un trazo de rotulador, y el nombre de la aplicación. */
@Component({
  selector: 'app-brand-logo',
  templateUrl: './brand-logo.component.html',
  styleUrl: './brand-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-large]': "size() === 'lg'" },
})
export class BrandLogoComponent {
  readonly size = input<'sm' | 'lg'>('sm');
  readonly showName = input(true);
  protected readonly name = inject(ENVIRONMENT).appName.replace(/ \(dev\)$/, '');
}
