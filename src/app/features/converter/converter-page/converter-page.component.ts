import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { APP_PATHS, converterQuery } from '@core/constants';
import {
  CONVERTERS,
  ConversionService,
  FILE_FORMATS,
  acceptFor,
  detectFormat,
  findConverter,
  isConversionCancelled,
  isFormatId,
} from '@core/convert';
import type {
  ConversionPair,
  ConversionProgress,
  ConversionResult,
  FileFormatId,
} from '@core/models';
import { errorMessage } from '@core/pdf';
import { FilePickerService, ThemeService } from '@core/services';
import { BrandLogoComponent, IconComponent } from '@shared/components';
import { FormatSwitchComponent } from '../components/format-switch/format-switch.component';

type ConversionState =
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'working';
      readonly fileName: string;
      readonly progress: ConversionProgress | null;
    }
  | { readonly kind: 'done'; readonly result: ConversionResult }
  | { readonly kind: 'error'; readonly message: string };

const DEFAULT_PAIR: ConversionPair = { from: 'pdf', to: 'docx' };

/** Sentido de la conversión a partir de la URL, corrigiendo valores ausentes o inválidos. */
function pairFromQuery(from: string | undefined, to: string | undefined): ConversionPair {
  const source: FileFormatId = isFormatId(from) ? from : DEFAULT_PAIR.from;
  if (isFormatId(to) && to !== source) return { from: source, to };
  return { from: source, to: source === DEFAULT_PAIR.to ? DEFAULT_PAIR.from : DEFAULT_PAIR.to };
}

/**
 * Pantalla de conversión. El sentido (`?de=pdf&a=docx`) se refleja en la URL para poder enlazarlo
 * o recargar; la pantalla no conoce ningún conversor concreto: todo sale de `CONVERTERS`.
 */
@Component({
  selector: 'app-converter-page',
  imports: [RouterLink, IconComponent, BrandLogoComponent, FormatSwitchComponent],
  templateUrl: './converter-page.component.html',
  styleUrl: './converter-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterPageComponent {
  private readonly conversion = inject(ConversionService);
  private readonly picker = inject(FilePickerService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected readonly theme = inject(ThemeService);

  // Parámetros de la URL (ver `converterQuery`), enlazados con `withComponentInputBinding()`
  readonly de = input<string>();
  readonly a = input<string>();

  protected readonly paths = APP_PATHS;
  protected readonly formats = FILE_FORMATS;

  /** Sentido elegido: empieza con el de la URL y después lo cambia la propia pantalla. */
  private readonly pair = linkedSignal(() => pairFromQuery(this.de(), this.a()));
  protected readonly from = computed(() => this.pair().from);
  protected readonly to = computed(() => this.pair().to);
  protected readonly converter = computed(() => findConverter(this.from(), this.to()));
  /** Conversiones que ya funcionan, para proponerlas cuando el sentido elegido no está listo. */
  protected readonly alternatives = CONVERTERS;

  protected readonly state = signal<ConversionState>({ kind: 'idle' });
  protected readonly isDraggingOver = signal(false);
  private abort: AbortController | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.abort?.abort());
  }

  /**
   * Cambia el sentido y lo refleja en la URL sin navegar: así no se repite la transición de
   * pantalla ni se pierde el estado, y el enlace sigue sirviendo para compartir o recargar.
   */
  protected setPair(pair: ConversionPair): void {
    this.state.set({ kind: 'idle' });
    this.pair.set(pair);
    const url = this.router.createUrlTree(APP_PATHS.converter, {
      queryParams: converterQuery(pair),
    });
    this.location.replaceState(this.router.serializeUrl(url));
  }

  protected async choose(): Promise<void> {
    const [file] = await this.picker.pick(acceptFor(this.from()), false);
    if (file) await this.start(file);
  }

  protected cancel(): void {
    this.abort?.abort();
  }

  protected reset(): void {
    this.state.set({ kind: 'idle' });
  }

  protected downloadAgain(result: ConversionResult): void {
    this.conversion.download(result);
  }

  protected onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files') || this.state().kind === 'working') return;
    event.preventDefault();
    this.isDraggingOver.set(true);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDraggingOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file && this.state().kind !== 'working') await this.start(file);
  }

  /** Convierte un archivo. Si es de otro formato que el elegido, cambia el sentido por él. */
  private async start(file: File): Promise<void> {
    const detected = detectFormat(file);
    if (!detected) {
      this.fail(`«${file.name}» no es un archivo que se pueda convertir.`);
      return;
    }
    let pair: ConversionPair = { from: this.from(), to: this.to() };
    if (detected !== pair.from) {
      pair = { from: detected, to: detected === pair.to ? pair.from : pair.to };
      this.setPair(pair);
    }
    const definition = findConverter(pair.from, pair.to);
    if (!definition) {
      this.fail(
        `Todavía no se puede convertir de ${FILE_FORMATS[pair.from].label} a ` +
          `${FILE_FORMATS[pair.to].label}.`,
      );
      return;
    }

    const abort = new AbortController();
    this.abort = abort;
    this.state.set({ kind: 'working', fileName: file.name, progress: null });
    try {
      const result = await this.conversion.convert(definition, file, {
        signal: abort.signal,
        onProgress: (progress) =>
          this.state.update((s) => (s.kind === 'working' ? { ...s, progress } : s)),
      });
      this.conversion.download(result);
      this.state.set({ kind: 'done', result });
    } catch (error) {
      if (isConversionCancelled(error)) this.reset();
      else this.fail(`No se pudo convertir «${file.name}»: ${errorMessage(error)}`);
    } finally {
      if (this.abort === abort) this.abort = null;
    }
  }

  private fail(message: string): void {
    this.state.set({ kind: 'error', message });
  }
}
