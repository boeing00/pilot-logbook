# Pilot Logbook

A client-side web app that turns a pilot's flight logbook — provided as a **PDF, JPG, or phone
photo** — into an organized log with **monthly subtotals** and **yearly summaries**. Everything
runs in the browser; no server, no upload, no account.

## Features

- **Upload** a PDF, JPG, PNG, WEBP, or BMP (drag & drop or browse). Multiple files merge together.
- **Text extraction**
  - PDFs are read as text with [`pdf.js`](https://mozilla.github.io/pdf.js/) (fully offline).
  - Images / phone photos are read with on-device OCR via [`tesseract.js`](https://tesseract.projectnaptha.com/).
- **Parsing** of the AFLIS-style logbook layout: date, aircraft, tail, flight no, route, report
  out/in, duty / flight / night / instrument time, and take-off / landing markers, plus the
  career-summary header and pilot info.
- **Organization**
  - Flights grouped **by month** with a per-month totals row and per-aircraft breakdown.
  - A **yearly summary** card per year.
  - A **career summary** card from the file's cumulative totals.
- **CSV export** and automatic persistence in `localStorage`.

## Tech stack

React 19 · Vite 8 · TypeScript · `pdfjs-dist` · `tesseract.js` · oxlint

## Development

```bash
npm install     # install dependencies
npm run dev     # start the Vite dev server (http://localhost:5173)
npm run lint    # run oxlint
npm run build   # type-check + production build
npm run preview # preview the production build
```

## How it works

The upload pipeline is `extractText` (`src/lib/extractText.ts`) → `parseLogbook`
(`src/lib/parseLogbook.ts`) → `groupByMonth` / `groupByYear` (`src/lib/aggregate.ts`).

> Note: pdf.js emits each glyph as a separate text item, so `extractText` reconstructs words from
> horizontal gaps rather than naively joining items with spaces. See `src/lib/extractText.ts`.
