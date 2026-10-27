import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { Annotation } from '@core/models';
import { DocumentStore } from '@core/state';
import { IconComponent } from '@shared/components';
import { EditorCommandsService } from '@features/editor/services/editor-commands.service';

@Component({
  selector: 'app-annotation-actions',
  imports: [IconComponent],
  templateUrl: './annotation-actions.component.html',
  styleUrl: './annotation-actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnotationActionsComponent {
  readonly annotation = input.required<Annotation>();
  protected readonly documentStore = inject(DocumentStore);
  protected readonly commands = inject(EditorCommandsService);
}
