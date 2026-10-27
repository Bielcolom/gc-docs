import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NOTE_COLORS } from '@core/constants';
import { ColorSwatchesComponent } from '@shared/components';
import { InspectorTargetService } from '../../inspector-target/inspector-target.service';

@Component({
  selector: 'app-note-properties',
  imports: [ColorSwatchesComponent],
  templateUrl: './note-properties.component.html',
  styleUrl: '../panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotePropertiesComponent {
  protected readonly target = inject(InspectorTargetService);
  protected readonly colors = NOTE_COLORS;
  protected readonly note = computed(() => {
    const a = this.target.annotation();
    return a?.type === 'note' ? a : null;
  });

  protected onText(event: Event): void {
    this.target.setNoteText((event.target as HTMLTextAreaElement).value);
  }
}
