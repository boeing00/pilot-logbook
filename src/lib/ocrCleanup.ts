/** Common KE/OZ / East-Asia destinations seen in AFLIS logs. */
const AIRPORTS = new Set([
  'ICN', 'GMP', 'PUS', 'CJU', 'TAE',
  'NRT', 'HND', 'KIX', 'NGO', 'FUK', 'CTS',
  'HKG', 'MFM', 'TPE', 'KHH',
  'SHA', 'PVG', 'PEK', 'CAN', 'SZX', 'DLC', 'TAO', 'XIY', 'CKG',
  'BKK', 'CNX', 'HKT', 'SGN', 'HAN', 'DAD', 'MNL', 'CEB', 'SIN', 'KUL', 'JKT', 'CGK', 'DPS',
  'DEL', 'BOM', 'SYD', 'MEL', 'BNE', 'AKL',
  'LAX', 'SFO', 'SEA', 'JFK', 'EWR', 'ORD', 'DFW', 'HNL', 'YVR', 'YYZ',
  'LHR', 'CDG', 'FRA', 'AMS', 'BCN', 'MAD', 'MXP', 'FCO', 'IST', 'DXB', 'AUH', 'DOH',
  'SPN', 'GUM',
])

/**
 * Repair common OCR mistakes found in Korean-airline AFLIS logbook photos:
 * table rules, O/o vs 0, l/I vs 1, en/em dashes, spaced/missing route hyphens,
 * B777 misread as 8777, etc.
 */
export function cleanupOcrText(raw: string): string {
  let text = raw
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    // Table rule / cell glyphs from AFLIS screenshots
    .replace(/[|[\],{}]/g, ' ')
    // Unicode dashes → ASCII hyphen
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    // Fancy slashes
    .replace(/[\u2044\u2215\uFF0F]/g, '/')
    // Fullwidth / typographic asterisks \u2192 ASCII '*' (T/O / L/D markers)
    .replace(/[\uFF0A\u2731\u2217\u204E]/g, '*')

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

  // Aircraft OCR: A38O → A380, 8777/6777 → B777
  text = text.replace(/\bA38[Oo]\b/g, 'A380')
  text = text.replace(/\bA35[Oo]\b/g, 'A350')
  text = text.replace(/\bA33[Oo]\b/g, 'A330')
  text = text.replace(/\bA32[Il1]\b/g, 'A321')
  text = text.replace(/\b[8G6]777\b/g, 'B777')
  text = text.replace(/\b[8G6]747\b/g, 'B747')
  text = text.replace(/\bB77[Il]\b/g, 'B777')
  text = text.replace(/\bB74[Il]\b/g, 'B747')

  // Route repairs for AFLIS table OCR (missing hyphen / clipped IATA).
  text = repairRoutes(text)

  // Collapse runs of whitespace but keep newlines.
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')

  return text
}

function repairRoutes(text: string): string {
  // ICNSEA / HKGICN → ICN-SEA / HKG-ICN when both halves are known airports.
  text = text.replace(/\b([A-Z]{6})\b/g, (m) => {
    const a = m.slice(0, 3)
    const b = m.slice(3)
    return AIRPORTS.has(a) && AIRPORTS.has(b) ? `${a}-${b}` : m
  })

  // CN-SEA / SEA-CN → ICN-SEA / SEA-ICN (leading I often dropped from ICN).
  text = text.replace(/\bCN-([A-Z]{3})\b/g, (_, b) => (AIRPORTS.has(b) ? `ICN-${b}` : `CN-${b}`))
  text = text.replace(/\b([A-Z]{3})-CN\b/g, (_, a) => (AIRPORTS.has(a) ? `${a}-ICN` : `${a}-CN`))

  // LAX-IC / MNL-IC → LAX-ICN / MNL-ICN (trailing N dropped from ICN).
  text = text.replace(/\b([A-Z]{3})-IC\b/g, (_, a) => (AIRPORTS.has(a) ? `${a}-ICN` : `${a}-IC`))
  text = text.replace(/\bIC-([A-Z]{3})\b/g, (_, b) => (AIRPORTS.has(b) ? `ICN-${b}` : `IC-${b}`))

  // Already-hyphenated but one side mistyped by 1 char vs a known airport —
  // only attempt when one side is known and the other is length 3.
  text = text.replace(/\b([A-Z]{3})-([A-Z]{3})\b/g, (m, a, b) => {
    if (AIRPORTS.has(a) && AIRPORTS.has(b)) return m
    if (AIRPORTS.has(a) && !AIRPORTS.has(b)) {
      const fixed = closestAirport(b)
      return fixed ? `${a}-${fixed}` : m
    }
    if (!AIRPORTS.has(a) && AIRPORTS.has(b)) {
      const fixed = closestAirport(a)
      return fixed ? `${fixed}-${b}` : m
    }
    return m
  })

  return text
}

/** Allow a single-character OCR error against a known airport code. */
function closestAirport(code: string): string | null {
  let hit: string | null = null
  for (const a of AIRPORTS) {
    let diff = 0
    for (let i = 0; i < 3; i++) if (a[i] !== code[i]) diff++
    if (diff === 1) {
      if (hit) return null // ambiguous
      hit = a
    }
  }
  return hit
}

function digits(value: string): string {
  return value.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1')
}

function pad2(value: string | number): string {
  return String(value).padStart(2, '0')
}
