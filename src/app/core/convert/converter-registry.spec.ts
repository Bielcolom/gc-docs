import type { ConverterDefinition } from '@core/models';
import { CONVERTERS, findConverter, sourcesOf, targetsOf } from './converter-registry';
import { acceptFor, convertedFileName, detectFormat, isFormatId } from './file-formats';

const fake = (from: 'pdf' | 'docx', to: 'pdf' | 'docx'): ConverterDefinition => ({
  id: `${from}-to-${to}`,
  from,
  to,
  description: '',
  load: () => Promise.reject(new Error('no se carga en los tests')),
});

describe('converter-registry', () => {
  it('incluye el conversor de PDF a Google Docs', () => {
    expect(findConverter('pdf', 'docx')?.id).toBe('pdf-to-docx');
  });

  it('devuelve null para un sentido que aún no existe', () => {
    expect(findConverter('docx', 'pdf', [fake('pdf', 'docx')])).toBeNull();
  });

  it('encuentra los dos sentidos cuando hay conversores para ambos', () => {
    const both = [fake('pdf', 'docx'), fake('docx', 'pdf')];
    expect(findConverter('docx', 'pdf', both)?.id).toBe('docx-to-pdf');
    expect(targetsOf('pdf', both)).toEqual(['docx']);
    expect(sourcesOf('pdf', both)).toEqual(['docx']);
  });

  it('cada conversor carga su código bajo demanda', () => {
    for (const converter of CONVERTERS) expect(typeof converter.load).toBe('function');
  });
});

describe('file-formats', () => {
  it('detecta el formato por la extensión, sin distinguir mayúsculas', () => {
    expect(detectFormat({ name: 'Informe.PDF', type: '' })).toBe('pdf');
    expect(detectFormat({ name: 'acta.docx', type: '' })).toBe('docx');
  });

  it('usa el tipo MIME si el archivo no tiene extensión', () => {
    expect(detectFormat({ name: 'descarga', type: 'application/pdf' })).toBe('pdf');
  });

  it('no reconoce formatos desconocidos', () => {
    expect(detectFormat({ name: 'foto.png', type: 'image/png' })).toBeNull();
  });

  it('cambia la extensión del archivo convertido', () => {
    expect(convertedFileName('contrato.final.pdf', 'docx')).toBe('contrato.final.docx');
    expect(convertedFileName('.pdf', 'docx')).toBe('documento.docx');
  });

  it('prepara el filtro del selector de archivos', () => {
    expect(acceptFor('pdf')).toBe('application/pdf,.pdf');
  });

  it('valida identificadores de formato', () => {
    expect(isFormatId('docx')).toBe(true);
    expect(isFormatId('odt')).toBe(false);
    expect(isFormatId(undefined)).toBe(false);
  });
});
