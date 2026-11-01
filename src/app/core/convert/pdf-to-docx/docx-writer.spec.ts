import JSZip from 'jszip';
import { writeDocx } from './docx-writer';
import type { DocumentLayout, ParagraphBlock } from './layout.model';

const paragraph = (text: string, overrides: Partial<ParagraphBlock> = {}): ParagraphBlock => ({
  kind: 'paragraph',
  runs: [{ text, fontSize: 11, font: 'Arial', bold: false, italic: false, color: '000000' }],
  align: 'left',
  indent: 0,
  firstLineIndent: 0,
  spaceBefore: 0,
  lineSpacing: 1,
  tabStops: [],
  heading: 0,
  fontSize: 11,
  ...overrides,
});

const layout = (overrides: Partial<DocumentLayout> = {}): DocumentLayout => ({
  pageWidth: 595,
  pageHeight: 842,
  margins: { top: 72, right: 60, bottom: 36, left: 60 },
  pages: [[paragraph('Primera página')], [paragraph('Segunda página')]],
  ...overrides,
});

async function documentXml(doc: DocumentLayout): Promise<string> {
  const blob = await writeDocx(doc, { title: 'prueba' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file('word/document.xml')?.async('string')) ?? '';
}

describe('writeDocx', () => {
  it('escribe el texto y separa las páginas con saltos de página', async () => {
    const xml = await documentXml(layout());
    expect(xml).toContain('Primera página');
    expect(xml).toContain('Segunda página');
    expect(xml.match(/w:type="page"/g)).toHaveLength(1);
  });

  it('usa un único tamaño de página con los márgenes en veinteavos de punto', async () => {
    const xml = await documentXml(layout());
    expect(xml).toMatch(/<w:pgSz[^>]*w:w="11900"[^>]*w:h="16840"/);
    expect(xml).toMatch(/<w:pgMar[^>]*w:top="1440"/);
  });

  it('respeta la orientación horizontal', async () => {
    const xml = await documentXml(layout({ pageWidth: 842, pageHeight: 595 }));
    expect(xml).toMatch(/<w:pgSz[^>]*w:w="16840"[^>]*w:h="11900"[^>]*w:orient="landscape"/);
  });

  it('marca los títulos con los estilos que Google Docs reconoce', async () => {
    const xml = await documentXml(layout({ pages: [[paragraph('Resumen', { heading: 1 })]] }));
    expect(xml).toContain('<w:pStyle w:val="Heading1"/>');
  });

  it('escribe tabuladores y sus posiciones', async () => {
    const row = paragraph('', {
      runs: [
        { text: 'Nombre', fontSize: 11, font: 'Arial', bold: true, italic: false, color: '000000' },
        { tab: true },
        { text: 'Ana', fontSize: 11, font: 'Arial', bold: false, italic: false, color: '000000' },
      ],
      tabStops: [200],
    });
    const xml = await documentXml(layout({ pages: [[row]] }));
    expect(xml).toContain('<w:tab/>');
    expect(xml).toMatch(/<w:tab w:val="left" w:pos="4000"\/>/);
  });

  it('usa interlineado múltiple, que es el que entiende Google Docs', async () => {
    const xml = await documentXml(layout({ pages: [[paragraph('a', { lineSpacing: 1.5 })]] }));
    expect(xml).toMatch(/w:line="360" w:lineRule="auto"/);
  });
});
