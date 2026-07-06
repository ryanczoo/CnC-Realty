// apps/web/src/lib/ica-pdf.ts
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { ICA_VERSION, ICA_INTRO, ICA_SECTIONS, SUMMARY_TABLE, type RichText } from "./ica-content";

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 10;
const LINE_GAP = 4;

interface Writer {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = trial;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function newPage(w: Writer) {
  w.page = w.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  w.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(w: Writer, needed: number) {
  if (w.y - needed < MARGIN) newPage(w);
}

function drawParagraph(w: Writer, text: string, opts: { bold?: boolean; indent?: number } = {}) {
  const size = BODY_SIZE;
  const font = opts.bold ? w.bold : w.font;
  const indent = opts.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;
  for (const line of wrapText(text, font, size, maxWidth)) {
    ensureSpace(w, size + LINE_GAP);
    w.page.drawText(line, { x: MARGIN + indent, y: w.y - size, size, font });
    w.y -= size + LINE_GAP;
  }
}

/**
 * Splits RichText into a flat token stream, tagging each word with whether it's bold
 * and whether a space should render before it. `spaceBefore` is computed from actual
 * whitespace adjacency in the source text — a bold run directly followed by punctuation
 * with no space (e.g. "$990" then ", inclusive...") must NOT get a phantom space inserted
 * at that run boundary, even though word-splitting elsewhere always implies a space.
 */
function tokenizeRichText(text: RichText): { word: string; bold: boolean; spaceBefore: boolean }[] {
  const runs = typeof text === "string" ? [text] : text;
  const tokens: { word: string; bold: boolean; spaceBefore: boolean }[] = [];
  let prevRunEndedWithSpace = true;
  for (const run of runs) {
    const isBold = typeof run !== "string";
    const str = typeof run === "string" ? run : run.bold;
    const startsWithSpace = /^\s/.test(str);
    const words = str.split(/\s+/).filter(Boolean);
    words.forEach((word, i) => {
      const spaceBefore = i === 0 ? prevRunEndedWithSpace || startsWithSpace : true;
      tokens.push({ word, bold: isBold, spaceBefore });
    });
    prevRunEndedWithSpace = str.length === 0 || /\s$/.test(str);
  }
  return tokens;
}

/** Word-wraps and draws RichText, switching font per word so inline bold spans render correctly. */
function drawRichParagraph(w: Writer, text: RichText, opts: { indent?: number } = {}) {
  const size = BODY_SIZE;
  const indent = opts.indent ?? 0;
  const maxWidth = CONTENT_WIDTH - indent;
  const tokens = tokenizeRichText(text);
  const spaceWidth = w.font.widthOfTextAtSize(" ", size);

  let line: { word: string; bold: boolean; spaceBefore: boolean }[] = [];
  let lineWidth = 0;

  function flushLine() {
    if (line.length === 0) return;
    ensureSpace(w, size + LINE_GAP);
    let x = MARGIN + indent;
    line.forEach((tok, i) => {
      const font = tok.bold ? w.bold : w.font;
      if (i > 0 && tok.spaceBefore) x += spaceWidth;
      w.page.drawText(tok.word, { x, y: w.y - size, size, font });
      x += font.widthOfTextAtSize(tok.word, size);
    });
    w.y -= size + LINE_GAP;
    line = [];
    lineWidth = 0;
  }

  for (const tok of tokens) {
    const font = tok.bold ? w.bold : w.font;
    const wordWidth = font.widthOfTextAtSize(tok.word, size);
    const sep = line.length > 0 && tok.spaceBefore ? spaceWidth : 0;
    const addedWidth = sep + wordWidth;
    if (lineWidth + addedWidth > maxWidth && line.length > 0) {
      flushLine();
      line = [tok];
      lineWidth = wordWidth;
    } else {
      lineWidth += addedWidth;
      line.push(tok);
    }
  }
  flushLine();
}

function drawSub(w: Writer, id: string, boldLead: string | undefined, text: RichText) {
  const label = boldLead ? `${id}. ${boldLead}` : `${id}.`;
  drawParagraph(w, label, { bold: true, indent: 8 });
  drawRichParagraph(w, text, { indent: 8 });
  w.y -= 2;
}

function drawList(w: Writer, items: string[]) {
  for (const item of items) {
    const lines = wrapText(item, w.font, BODY_SIZE, CONTENT_WIDTH - 20);
    lines.forEach((line, i) => {
      ensureSpace(w, BODY_SIZE + LINE_GAP);
      const prefix = i === 0 ? "•  " : "   ";
      w.page.drawText(`${prefix}${line}`, { x: MARGIN + 8, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.font });
      w.y -= BODY_SIZE + LINE_GAP;
    });
  }
}

function drawTable(w: Writer, headers: string[], rows: string[][]) {
  const colWidth = CONTENT_WIDTH / headers.length;
  ensureSpace(w, BODY_SIZE + 14);
  headers.forEach((h, i) => {
    w.page.drawText(h, { x: MARGIN + i * colWidth, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.bold });
  });
  w.y -= BODY_SIZE + 6;
  w.page.drawLine({
    start: { x: MARGIN, y: w.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: w.y },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  w.y -= 8;
  for (const row of rows) {
    ensureSpace(w, BODY_SIZE + LINE_GAP);
    row.forEach((cell, i) => {
      w.page.drawText(cell, { x: MARGIN + i * colWidth, y: w.y - BODY_SIZE, size: BODY_SIZE, font: w.font });
    });
    w.y -= BODY_SIZE + LINE_GAP;
  }
  w.y -= 6;
}

export async function generateSignedIcaPdf(input: {
  signerName: string;
  signedAt: Date;
  signerIp: string;
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w: Writer = { doc, font, bold, page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), y: PAGE_HEIGHT - MARGIN };

  drawParagraph(w, "CnC Realty", { bold: true });
  drawParagraph(w, "Independent Contractor Agreement", { bold: true });
  w.y -= 10;
  drawRichParagraph(w, ICA_INTRO);
  w.y -= 8;

  for (const section of ICA_SECTIONS) {
    ensureSpace(w, BODY_SIZE + LINE_GAP + 14);
    drawParagraph(w, `${section.num}. ${section.title}`, { bold: true });
    w.y -= 2;
    for (const item of section.content) {
      if (item.type === "p") drawRichParagraph(w, item.text);
      else if (item.type === "p-bold") drawParagraph(w, item.text, { bold: true });
      else if (item.type === "sub") drawSub(w, item.id, item.boldLead, item.text);
      else if (item.type === "list") drawList(w, item.items);
      else drawTable(w, item.headers, item.rows);
    }
    w.y -= 10;
  }

  ensureSpace(w, 140);
  drawParagraph(w, "Acknowledgement and Signature", { bold: true });
  w.y -= 4;
  drawParagraph(
    w,
    "I, the undersigned Associate-Licensee, do hereby acknowledge that I have read CnC Realty's Independent Contractor Agreement and agree to abide by its provisions during my association with CnC Realty."
  );
  w.y -= 8;
  drawParagraph(w, `Signed electronically by: ${input.signerName}`, { bold: true });
  drawParagraph(w, `Date/Time: ${input.signedAt.toISOString()}`);
  drawParagraph(w, `IP Address: ${input.signerIp}`);
  drawParagraph(w, `ICA Version: ${ICA_VERSION}`);

  w.y -= 14;
  drawParagraph(w, "Fee Schedule Summary", { bold: true });
  drawTable(w, SUMMARY_TABLE.headers, SUMMARY_TABLE.rows);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
