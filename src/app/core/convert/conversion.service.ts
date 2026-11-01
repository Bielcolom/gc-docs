import { Injectable, Injector, inject } from '@angular/core';
import type { ConversionOptions, ConversionResult, ConverterDefinition } from '@core/models';
import { DownloadService } from '@core/services/download.service';

/** Ejecuta cualquier conversor del registro sin saber cuál es. */
@Injectable({ providedIn: 'root' })
export class ConversionService {
  private readonly injector = inject(Injector);
  private readonly downloads = inject(DownloadService);

  /**
   * El conversor (y sus librerías) se descarga la primera vez que se usa. Es un servicio
   * `providedIn: 'root'`, así que el inyector raíz lo crea en cuanto su código está disponible.
   */
  async convert(
    definition: ConverterDefinition,
    file: File,
    options?: ConversionOptions,
  ): Promise<ConversionResult> {
    const converter = this.injector.get(await definition.load());
    return converter.convert(file, options);
  }

  download(result: ConversionResult): void {
    this.downloads.save(result.blob, result.fileName, result.blob.type);
  }
}
