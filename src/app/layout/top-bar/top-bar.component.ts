import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { APP_PATHS } from '@core/constants';
import { DocumentActionsService, ThemeService } from '@core/services';
import { DocumentStore, EditorStore } from '@core/state';
import { DialogService } from '@features/dialogs/dialog.service';
import { BrandLogoComponent, IconComponent } from '@shared/components';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive, IconComponent, BrandLogoComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
  protected readonly documentStore = inject(DocumentStore);
  protected readonly editorStore = inject(EditorStore);
  protected readonly actions = inject(DocumentActionsService);
  protected readonly theme = inject(ThemeService);
  protected readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);

  protected readonly paths = APP_PATHS;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly editorUrl = this.router.serializeUrl(
    this.router.createUrlTree(APP_PATHS.editor),
  );
  protected readonly isEditor = computed(() => this.url().startsWith(this.editorUrl));
  protected readonly zoomLabel = computed(() => `${Math.round(this.editorStore.zoom() * 100)} %`);
  protected readonly pageLabel = computed(
    () => `${this.editorStore.currentPageIndex() + 1} / ${this.documentStore.pageCount()}`,
  );

  protected rename(event: Event): void {
    this.documentStore.rename((event.target as HTMLInputElement).value);
  }

  protected async close(): Promise<void> {
    if (await this.actions.close()) void this.router.navigate(APP_PATHS.welcome);
  }

  protected async openOther(): Promise<void> {
    if (await this.actions.pickAndOpen()) void this.router.navigate(APP_PATHS.editor);
  }

  protected blur(event: Event): void {
    (event.target as HTMLElement).blur();
  }
}
