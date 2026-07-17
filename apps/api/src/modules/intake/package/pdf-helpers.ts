import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface PdfCursor {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  y: number;
}

/** One page with a standard title header — every generated document in the package shares this look. */
export async function startPdfPage(title: string, subtitle: string): Promise<PdfCursor> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let y = PAGE_HEIGHT - MARGIN;
  page.drawText(title, { x: MARGIN, y, size: 16, font: boldFont });
  y -= 22;
  page.drawText(subtitle, { x: MARGIN, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  return { doc, page, font, boldFont, y };
}

/** Draws a bold field label followed by its value, wrapping the value across lines as needed. Advances and returns the cursor's y. */
export function drawField(cursor: PdfCursor, label: string, value: string, size = 10): number {
  const { page, font, boldFont } = cursor;
  let y = cursor.y;
  page.drawText(label, { x: MARGIN, y, size, font: boldFont });
  y -= 14;
  const lines = wrapText(value || "—", font, size, CONTENT_WIDTH);
  for (const line of lines) {
    if (y < MARGIN) {
      cursor.page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    cursor.page.drawText(line, { x: MARGIN, y, size, font });
    y -= 14;
  }
  y -= 6;
  cursor.y = y;
  return y;
}

/** Plain paragraph text, wrapped and page-broken like drawField but with no label. */
export function drawParagraph(cursor: PdfCursor, text: string, size = 10): void {
  const lines = wrapText(text, cursor.font, size, CONTENT_WIDTH);
  for (const line of lines) {
    if (cursor.y < MARGIN) {
      cursor.page = cursor.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.y = PAGE_HEIGHT - MARGIN;
    }
    cursor.page.drawText(line, { x: MARGIN, y: cursor.y, size, font: cursor.font });
    cursor.y -= 14;
  }
  cursor.y -= 6;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export { PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_WIDTH };
