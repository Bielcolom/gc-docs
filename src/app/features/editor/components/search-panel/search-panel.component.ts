import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { DocumentStore, EditorStore } from '@core/state';
import { IconComponent } from '@shared/components';
import { AutofocusDirective } from '@shared/directives';
import { SearchService } from '../../services/search.service';

/** Buscador del panel lateral, con lista de resultados y navegación. */
@Component({
  selector: 'app-search-panel',
  imports: [IconComponent, AutofocusDirective],
  templateUrl: './search-panel.component.html',
  styleUrl: './search-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPanelComponent {
  protected readonly search = inject(SearchService);
  protected readonly editorStore = inject(EditorStore);
  private readonly documentStore = inject(DocumentStore);

  constructor() {
    // Si cambian las páginas, los resultados pueden haberse movido: se repite la búsqueda
    effect(() => {
      this.documentStore.pages();
      untracked(() => this.search.refresh());
    });
  }

  protected onInput(event: Event): void {
    void this.search.search((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) this.search.previous();
      else this.search.next();
    } else if (event.key === 'Escape') {
      (event.target as HTMLElement).blur();
    }
  }
}
