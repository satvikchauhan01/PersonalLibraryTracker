import Papa from 'papaparse';

// Phase 13: turns an uploaded file into rows shaped for POST /api/books/import
// (see server/validators/bookSchemas.js's importRowSchema — that's the
// contract this must satisfy). Two source shapes are recognized:
//  1. This app's own export (JSON or CSV) — passed through almost as-is.
//  2. A Goodreads "export library" CSV — its well-known column names are
//     mapped onto our schema.
// Anything else (an arbitrary CSV) still gets a best-effort pass through
// mapCsvRow's Goodreads branch, so at minimum a Title/Author-shaped sheet
// still imports.

const GOODREADS_SHELF_STATUS = {
  read: 'completed',
  'currently-reading': 'reading',
  'to-read': 'wantToRead',
};

// Goodreads wraps ISBN cells like `="9780143127550"` (an Excel formula
// trick to stop the leading digits being read as a number) — strip that.
const cleanIsbn = (val) => {
  if (!val) return undefined;
  const match = String(val).match(/[\dXx][\dXx-]*/);
  return match ? match[0].replace(/-/g, '') : undefined;
};

// Goodreads dates are 'YYYY/MM/DD' (or blank) — the server's dateString
// schema requires 'YYYY-MM-DD'. Normalizing here (rather than loosening the
// server regex) keeps the server's contract exactly one shape for every
// caller, client-parsed CSV rows included.
const normalizeDate = (val) => {
  if (!val) return undefined;
  const trimmed = String(val).trim();
  if (!trimmed) return undefined;
  const converted = trimmed.replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(converted) ? converted : undefined;
};

const toNumber = (val) => {
  if (val === '' || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
};

const splitList = (val) =>
  val
    ? String(val)
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

// This app's own export shape (JSON rows, or CSV with our exact headers).
const mapOwnRow = (raw) => ({
  title: (raw.title || '').trim(),
  author: (raw.author || '').trim(),
  genre: raw.genre || undefined,
  status: raw.status || undefined,
  isbn: cleanIsbn(raw.isbn),
  currentPage: toNumber(raw.currentPage),
  totalPages: toNumber(raw.totalPages),
  startDate: normalizeDate(raw.startDate),
  finishDate: normalizeDate(raw.finishDate),
  rating: toNumber(raw.rating),
  isFavorite: raw.isFavorite === true || raw.isFavorite === 'true',
  tags: Array.isArray(raw.tags) ? raw.tags : splitList(raw.tags),
  review: raw.review || undefined,
});

// Goodreads "export library" CSV shape.
const mapGoodreadsRow = (raw) => {
  const exclusiveShelf = (raw['Exclusive Shelf'] || '').trim().toLowerCase();
  const rating = toNumber(raw['My Rating']);
  const bookshelves = (raw['Bookshelves'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== exclusiveShelf);

  return {
    title: (raw['Title'] || '').trim(),
    author: (raw['Author'] || '').trim(),
    isbn: cleanIsbn(raw['ISBN13']) || cleanIsbn(raw['ISBN']),
    status: GOODREADS_SHELF_STATUS[exclusiveShelf] || undefined,
    totalPages: toNumber(raw['Number of Pages']),
    finishDate: normalizeDate(raw['Date Read']),
    rating: rating > 0 ? rating : undefined, // Goodreads uses 0 for "not rated"
    tags: bookshelves.length ? bookshelves : undefined,
    review: raw['My Review'] || undefined,
  };
};

// A row is our own shape if it has the page-tracking fields our export
// always includes (Goodreads has no such column).
const isOwnShape = (raw) => 'currentPage' in raw || 'totalPages' in raw;

export const mapImportRow = (raw) => (isOwnShape(raw) ? mapOwnRow(raw) : mapGoodreadsRow(raw));

// Strips undefined fields so the payload matches what a human would expect
// from "only send what's known" — also just tidier over the wire.
const compact = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return out;
};

// Parses a File (json/csv) into normalized+compacted rows, plus a count of
// rows that were dropped for missing a title/author (shown in the preview
// rather than silently swallowed).
export const parseImportFile = (file) => {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'json') {
    return file.text().then((text) => {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.rows || [];
      return finalizeRows(list.map(mapImportRow));
    });
  }

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(finalizeRows(results.data.map(mapImportRow))),
      error: reject,
    });
  });
};

const finalizeRows = (mapped) => {
  const valid = [];
  let droppedCount = 0;
  for (const row of mapped) {
    if (row.title && row.author) {
      valid.push(compact(row));
    } else {
      droppedCount++;
    }
  }
  return { rows: valid, droppedCount };
};
