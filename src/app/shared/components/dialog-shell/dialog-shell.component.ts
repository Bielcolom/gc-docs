import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Estructura común de los diálogos: título, botón de cerrar, contenido y pie opcional.
 *
 * @example
 * <app-dialog-shell title="Marca de agua">
 *   …contenido…
 *   <ng-container dialogFooter><button class="btn btn--primary">Hecho</button></ng-container>
 * </app-dialog-shell>
 */
@Component({
  selector: 'app-dialog-shell',
  imports: [IconComponent],
  templateUrl: './dialog-shell.component.html',
  styleUrl: './dialog-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-wide]': 'wide()' },
})
export class DialogShellComponent {
  readonly title = input.required<string>();
  readonly wide = input(false);
  protected readonly dialogRef = inject(DialogRef);
}
