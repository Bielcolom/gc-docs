import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  type ParagraphChild,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import type { Block, DocumentLayout, ImageBlock, ParagraphBlock, TextAlign } from './layout.model';

/** Puntos → veinteavos de punto (la unidad de OOXML para medidas de página y párrafo). */
const twips = (points: number): number => Math.round(points * 20);
/** `docx` mide las imágenes en píxeles a 96 ppp. */
const pixels = (points: number): number => Math.max(1, Math.round((points * 96) / 72));
/** Interlineado: 240 = sencillo. */
const LINE_SINGLE = 240;

const ALIGNMENT = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
} as const satisfies Record<TextAlign, unknown>;

const HEADINGS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

const NEUTRAL_HEADING = {
  run: { color: '000000' },
  paragraph: { spacing: { before: 0, after: 0 } },
};

export interface DocxMetadata {
  readonly title: string;
}

/**
 * Escribe el documento en formato .docx pensando en cómo lo importa Google Docs:
 * - un único tamaño de página (Docs no admite varios) y saltos de página manuales entre las del PDF;
 * - interlineado como múltiplo (Docs ignora el "exacto" y el "mínimo");
 * - títulos con los estilos "Heading 1–3", que Docs convierte en sus Títulos 1–3 (índice y esquema);
 * - imágenes en línea con el texto, que Docs nunca descoloca;
 * - cabecera y pie de verdad, con el número de página y el total como campos.
 */
export async function writeDocx(layout: DocumentLayout, metadata: DocxMetadata): Promise<Blob> {
  const landscape = layout.pageWidth > layout.pageHeight;
  const { margins } = layout;
  // Con portada, la primera página lleva una cabecera y un pie vacíos
  const empty = () => [new Paragraph({})];
  const document = new Document({
    creator: 'GC Docs',
    title: metadata.title,
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: { spacing: { before: 0, after: 0, line: LINE_SINGLE } },
        },
        // `docx` pinta los títulos de azul por defecto; aquí manda el formato de cada trozo
        heading1: NEUTRAL_HEADING,
        heading2: NEUTRAL_HEADING,
        heading3: NEUTRAL_HEADING,
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              // Con orientación horizontal, `docx` intercambia ancho y alto
              width: twips(Math.min(layout.pageWidth, layout.pageHeight)),
              height: twips(Math.max(layout.pageWidth, layout.pageHeight)),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: twips(margins.top),
              right: twips(margins.right),
              bottom: twips(margins.bottom),
              left: twips(margins.left),
              header: twips(margins.header),
              footer: twips(margins.footer),
            },
            pageNumbers:
              layout.firstPageNumber !== 1 ? { start: layout.firstPageNumber } : undefined,
          },
          titlePage: layout.titlePage,
        },
        headers: layout.header.length
          ? {
              default: new Header({ children: blockParagraphs(layout.header) }),
              first: layout.titlePage ? new Header({ children: empty() }) : undefined,
            }
          : undefined,
        footers: layout.footer.length
          ? {
              default: new Footer({ children: blockParagraphs(layout.footer) }),
              first: layout.titlePage ? new Footer({ children: empty() }) : undefined,
            }
          : undefined,
        children: layout.pages.flatMap((blocks, index) => pageParagraphs(blocks, index > 0)),
      },
    ],
  });
  return Packer.toBlob(document);
}

function pageParagraphs(blocks: readonly Block[], breakBefore: boolean): Paragraph[] {
  // Una página vacía del PDF también ocupa una página del documento
  if (!blocks.length) return breakBefore ? [new Paragraph({ children: [new PageBreak()] })] : [];
  return blocks.map((block, i) =>
    block.kind === 'image'
      ? imageParagraph(block, breakBefore && i === 0)
      : textParagraph(block, breakBefore && i === 0),
  );
}

function blockParagraphs(blocks: readonly Block[]): Paragraph[] {
  return blocks.map((block) =>
    block.kind === 'image' ? imageParagraph(block, false) : textParagraph(block, false),
  );
}

function textParagraph(block: ParagraphBlock, breakBefore: boolean): Paragraph {
  const children: ParagraphChild[] = breakBefore ? [new PageBreak()] : [];
  for (const run of block.runs) {
    if ('tab' in run) {
      children.push(new TextRun({ children: [new Tab()] }));
      continue;
    }
    const format = {
      font: run.font,
      size: Math.round(run.fontSize * 2),
      bold: run.bold,
      italics: run.italic,
      color: run.color,
    };
    children.push(
      run.field
        ? new TextRun({
            ...format,
            children: [run.field === 'page' ? PageNumber.CURRENT : PageNumber.TOTAL_PAGES],
          })
        : new TextRun({ ...format, text: run.text }),
    );
  }
  const first = block.firstLineIndent;
  return new Paragraph({
    children,
    heading: block.heading ? HEADINGS[block.heading] : undefined,
    alignment: ALIGNMENT[block.align],
    indent: {
      left: twips(block.indent),
      firstLine: first > 0 ? twips(first) : undefined,
      hanging: first < 0 ? twips(-first) : undefined,
    },
    spacing: {
      before: twips(block.spaceBefore),
      after: 0,
      line: Math.round(LINE_SINGLE * block.lineSpacing),
      lineRule: LineRuleType.AUTO,
    },
    tabStops: block.tabStops.map((position) => ({
      type: TabStopType.LEFT,
      position: twips(position),
    })),
  });
}

function imageParagraph(block: ImageBlock, breakBefore: boolean): Paragraph {
  const image = new ImageRun({
    type: 'png',
    data: block.data,
    transformation: { width: pixels(block.width), height: pixels(block.height) },
  });
  return new Paragraph({
    children: breakBefore ? [new PageBreak(), image] : [image],
    indent: { left: twips(block.indent) },
    spacing: { before: twips(block.spaceBefore), after: 0 },
  });
}
