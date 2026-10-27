import { Pipe, type PipeTransform } from '@angular/core';

/**
 * Número con el sustantivo en singular o plural.
 * @example {{ 3 | plural: 'página' : 'páginas' }} → "3 páginas"
 */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(count: number, singular: string, plural: string, includeCount = true): string {
    const word = count === 1 ? singular : plural;
    return includeCount ? `${count} ${word}` : word;
  }
}
