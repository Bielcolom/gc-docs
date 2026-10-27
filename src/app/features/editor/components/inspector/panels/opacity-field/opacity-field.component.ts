import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-opacity-field',
  imports: [DecimalPipe],
  templateUrl: './opacity-field.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpacityFieldComponent {
  protected readonly target = inject(InspectorTargetService);

  protected onInput(event: Event): void {
    this.target.setOpacity(parseFloat((event.target as HTMLInputElement).value));
  }
}
