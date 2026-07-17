# AGENTS.md

## Cursor Cloud specific instructions

This repo is a single client-side product: a **Pilot Logbook** SPA (React 19 + Vite 8 +
TypeScript) that parses a flight logbook from a PDF/JPG/photo and organizes it by month and year.
There is no backend, database, or auth — everything runs in the browser.

Standard commands live in `package.json` (`dev`, `build`, `lint`, `preview`) and are documented in
`README.md`; use those rather than duplicating them here. The Vite dev server runs on
**http://localhost:5173**.

Non-obvious notes:

- **Image OCR needs network on first use.** PDF parsing (`pdf.js`) is fully offline, but image/photo
  uploads use `tesseract.js`, which downloads the OCR engine (wasm) and the `eng` traineddata from
  the jsDelivr CDN at runtime the first time an image is processed. If CDN egress is blocked, image
  OCR will hang/fail while PDF parsing still works. Prefer PDFs for offline testing.
- **Don't "simplify" PDF text extraction.** `src/lib/extractText.ts` reconstructs words from glyph
  x-gaps because pdf.js emits each character as a separate text item; replacing that with a plain
  `items.join(' ')` yields `"2 0 2 6"` and breaks parsing.
- Parsed logbook data persists in `localStorage` under `pilot-logbook.parsed.v1`; use the in-app
  **Clear** button (or clear that key) to reset to the empty state.
- Lint uses **oxlint** (config in `.oxlintrc.json`), not ESLint.
