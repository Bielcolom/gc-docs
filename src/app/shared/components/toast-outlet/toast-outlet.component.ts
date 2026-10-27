import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '@core/services';

/** Muestra los avisos de `NotificationService`. Se coloca una sola vez, en el componente raíz. */
@Component({
  selector: 'app-toast-outlet',
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastOutletComponent {
  protected readonly notifications = inject(NotificationService);
}
