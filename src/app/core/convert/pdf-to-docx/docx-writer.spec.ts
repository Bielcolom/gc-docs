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
  margins: { top: 72, right: 60, bottom: 36, left: 60, header: 30, footer: 20 },
  pages: [[paragraph('Primera página')], [paragraph('Segunda página')]],
  header: [],
  footer: [],
  titlePage: false,
  firstPageNumber: 1,
  ...overrides,
});

async function documentXml(doc: DocumentLayout): Promise<string> {
  return (await files(doc))['word/document.xml'] ?? '';
}

/** El contenido XML de cada parte del .docx. */
async function files(doc: DocumentLayout): Promise<Record<string, string>> {
  const blob = await writeDocx(doc, { title: 'prueba' });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const entries = Object.values(zip.files).filter((f) => f.name.endsWith('.xml'));
  return Object.fromEntries(
    await Promise.all(entries.map(async (f) => [f.name, await f.async('string')])),
  );
}

const pageNumberRun = (field: 'page' | 'pages', text: string) => ({
  text,
  field,
  fontSize: 9,
  font: 'Arial',
  bold: false,
  italic: false,
  color: '000000',
});

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

  it('escribe la cabecera y el pie como tales, con los campos de página', async () => {
    const footer = paragraph('', {
      runs: [
        {
          text: 'Página ',
          fontSize: 9,
          font: 'Arial',
          bold: false,
          italic: false,
          color: '000000',
        },
        pageNumberRun('page', '1'),
        { text: ' de ', fontSize: 9, font: 'Arial', bold: false, italic: false, color: '000000' },
        pageNumberRun('pages', '3'),
      ],
    });
    const parts = await files(layout({ header: [paragraph('ACME · Informe')], footer: [footer] }));
    const document = parts['word/document.xml'];
    const headerXml = Object.entries(parts).find(([name]) =>
      /word\/header\d*\.xml/.test(name),
    )?.[1];
    const footerXml = Object.entries(parts).find(([name]) =>
      /word\/footer\d*\.xml/.test(name),
    )?.[1];

    expect(document).not.toContain('ACME');
    expect(document).toMatch(/<w:headerReference w:type="default"/);
    expect(document).toMatch(/<w:pgMar[^>]*w:header="600"[^>]*w:footer="400"/);
    expect(headerXml).toContain('ACME · Informe');
    expect(footerXml).toContain('Página ');
    expect(footerXml).toContain('PAGE');
    expect(footerXml).toContain('NUMPAGES');
  });

  it('con portada, deja la primera página sin cabecera ni pie y ajusta la numeración', async () => {
    const xml = await documentXml(
      layout({ footer: [paragraph('Pie')], titlePage: true, firstPageNumber: 0 }),
    );
    expect(xml).toContain('<w:titlePg/>');
    expect(xml).toMatch(/<w:footerReference w:type="first"/);
    expect(xml).toMatch(/<w:pgNumType w:start="0"/);
  });
});
