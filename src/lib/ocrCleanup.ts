/**
 * Repair common OCR mistakes found in Korean-airline logbook photos:
 * O/o vs 0, l/I vs 1, en/em dashes, spaced dates/routes, glued times.
 */
export function cleanupOcrText(raw: string): string {
  let text = raw
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    // Unicode dashes → ASCII hyphen
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    // Fancy slashes
    .replace(/[\u2044\u2215\uFF0F]/g, '/')

  // Dates like "2025 . 03 . 08" or "2025 - 03 - 08" → "2025/03/08"
  text = text.replace(
    /(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/g,
    (_, y, m, d) => `${y}/${pad2(m)}/${pad2(d)}`,
  )

  // Routes with spaces around hyphen: "ICN - SEA" → "ICN-SEA"
  text = text.replace(/\b([A-Z]{3})\s*-\s*([A-Z]{3})\b/g, '$1-$2')

  // Fix O/o and l/I inside date, MM/DD, and H:MM tokens.
  text = text.replace(/\b([0-9OIl]{4})\/([0-9OIl]{1,2})\/([0-9OIl]{1,2})\b/g, (_, a, b, c) => {
    return `${digits(a)}/${pad2(digits(b))}/${pad2(digits(c))}`
  })
  text = text.replace(/\b([0-9OIl]{1,2})\/([0-9OIl]{1,2})\b/g, (_, a, b) => {
    return `${pad2(digits(a))}/${pad2(digits(b))}`
  })
  text = text.replace(/\b([0-9OIl]{1,2}):([0-9OIl]{2})\b/g, (_, a, b) => {
    return `${Number(digits(a))}:${pad2(digits(b))}`
  })

  // Aircraft OCR: A38O → A380, B77Z → B777-ish kept as-is if unclear
  text = text.replace(/\bA38[Oo]\b/g, 'A380')
  text = text.replace(/\bA35[Oo]\b/g, 'A350')
  text = text.replace(/\bA33[Oo]\b/g, 'A330')
  text = text.replace(/\bB77[Il]\b/g, 'B777')
  text = text.replace(/\bB74[Il]\b/g, 'B747')

  // Collapse runs of whitespace but keep newlines.
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')

  return text
}

function digits(value: string): string {
  return value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
}

function pad2(value: string | number): string {
  return String(value).padStart(2, '0')
}
