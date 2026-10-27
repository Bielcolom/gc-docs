import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ActivityIndicatorComponent, ToastOutletComponent } from '@shared/components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastOutletComponent, ActivityIndicatorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
