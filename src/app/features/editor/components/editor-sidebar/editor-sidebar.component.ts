import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DocumentStore, EditorStore } from '@core/state';
import { IconComponent } from '@shared/components';
import { PageListComponent } from '../page-list/page-list.component';
import { SearchPanelComponent } from '../search-panel/search-panel.component';

/** Panel lateral del editor con dos pestañas: páginas y búsqueda. */
@Component({
  selector: 'app-editor-sidebar',
  imports: [IconComponent, PageListComponent, SearchPanelComponent],
  templateUrl: './editor-sidebar.component.html',
  styleUrl: './editor-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorSidebarComponent {
  protected readonly editorStore = inject(EditorStore);
  protected readonly documentStore = inject(DocumentStore);
}
