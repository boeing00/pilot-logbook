import type { FlightEntry, LogbookSummary, ParsedLogbook, PilotInfo } from '../types'
import { parseDurationToMinutes } from './time'
import { cleanupOcrText } from './ocrCleanup'

const DATE_RE = /\d{4}\/\d{2}\/\d{2}/
const ROUTE_RE = /^[A-Z]{3}-[A-Z]{3}$/
const ACFT_RE = /^(A380|A350|A330|A321|A320|B777|B747|B787|B737)$/i
const MMDD_RE = /^\d{2}\/\d{2}$/
const TIME_RE = /^\d{1,2}:\d{2}$/
/** Looser time match used while recovering OCR-glued tokens like "10:179:31". */
const TIME_FIND_RE = /\d{1,2}:\d{2}/g

/**
 * Normalize OCR / PDF-extracted text so that each flight record starts on its
 * own line. PDF/OCR output frequently collapses rows onto a single line, so we
 * force a break before every full (YYYY/MM/DD) date token.
 */
function normalize(raw: string): string {
  return cleanupOcrText(raw)
    .replace(/(\d{4}\/\d{2}\/\d{2})/g, '\n$1')
    .replace(/[ \t]+/g, ' ')
}

function toTokens(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

/**
 * Pull H:MM tokens out of a run of OCR noise. Handles glued values like
 * "10:179:31" → ["10:17","9:31"] and "22:22" kept as-is.
 */
function extractTimes(text: string): string[] {
  const out: string[] = []
  const re = new RegExp(TIME_FIND_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const [h, mm] = m[0].split(':')
    const hours = Number(h)
    const minutes = Number(mm)
    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) continue
    // Reject absurd single-sector duty/flight hours (>48) — usually OCR junk.
    if (hours > 48) continue
    out.push(`${hours}:${String(minutes).padStart(2, '0')}`)
  }
  return out
}

/**
 * Parse a single normalized line into a FlightEntry, or null if the line is not
 * a flight record. Layout (Out/In may be mangled by OCR and are best-effort):
 *   DATE ACFT TAIL FLTNO ROUTE [IRR...] [RO_DATE RO_TIME RI_DATE RI_TIME]
 *   DUTY TS NT IT [*] [*]
 */
export function parseFlightLine(line: string): FlightEntry | null {
  const tokens = toTokens(line)
  if (tokens.length < 6) return null
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(tokens[0])) return null

  const aircraftIdx = tokens.findIndex((t, i) => i >= 1 && i <= 3 && ACFT_RE.test(t))
  if (aircraftIdx === -1) return null

  const routeIdx = tokens.findIndex((t) => ROUTE_RE.test(t))
  if (routeIdx < aircraftIdx + 1) return null

  const date = tokens[0]
  const aircraft = tokens[aircraftIdx].toUpperCase()
  // Tail / flight number sit between aircraft and route; OCR may drop one.
  const mid = tokens.slice(aircraftIdx + 1, routeIdx)
  const tail = mid[0] ?? ''
  const flightNo = mid.length >= 2 ? mid[mid.length - 1] : mid[0] ?? ''
  const [from, to] = tokens[routeIdx].split('-')

  // Everything after the route.
  const afterRoute = tokens.slice(routeIdx + 1)

  // Duty code = tokens after route until the first MM/DD or time-like token.
  let cursor = 0
  const irrParts: string[] = []
  while (cursor < afterRoute.length) {
    const t = afterRoute[cursor]
    if (MMDD_RE.test(t) || TIME_RE.test(t) || t.includes(':')) break
    // Duty codes are short: 2, 2Z, Z, 4Z, 3 …
    if (/^[A-Z0-9]{1,4}$/i.test(t)) irrParts.push(t)
    cursor++
  }
  const irr = irrParts.join(' ').toUpperCase()

  // Best-effort report-out / report-in (optional — not shown in the UI).
  let reportOut = ''
  let reportIn = ''
  if (
    cursor + 3 < afterRoute.length &&
    MMDD_RE.test(afterRoute[cursor]) &&
    TIME_RE.test(afterRoute[cursor + 1]) &&
    MMDD_RE.test(afterRoute[cursor + 2]) &&
    TIME_RE.test(afterRoute[cursor + 3])
  ) {
    reportOut = `${afterRoute[cursor]} ${afterRoute[cursor + 1]}`
    reportIn = `${afterRoute[cursor + 2]} ${afterRoute[cursor + 3]}`
    cursor += 4
  }

  // Duration fields: recover H:MM tokens from the remainder, including glued OCR.
  const remainder = afterRoute.slice(cursor).join(' ')
  const times = extractTimes(remainder)
  if (times.length < 4) return null
  // Prefer the last four valid times — Out/In fragments that leaked into the
  // remainder sit earlier than Duty / T-S / N/T / I/T.
  const durationTimes = times.length > 4 ? times.slice(-4) : times
  const [dutyMin, flightMin, nightMin, instrumentMin] = durationTimes.map(parseDurationToMinutes)

  const asterisks = (remainder.match(/\*/g) ?? []).length

  return {
    date,
    aircraft,
    tail,
    flightNo,
    from,
    to,
    irr,
    reportOut,
    reportIn,
    dutyMin,
    flightMin,
    nightMin,
    instrumentMin,
    takeoff: asterisks >= 1,
    landing: asterisks >= 2,
  }
}

function parsePilot(raw: string): PilotInfo {
  const pilot: PilotInfo = {}

  const nameMatch = raw.match(/([\uac00-\ud7a3]{2,4})\s*\(([^)]+)\)/)
  if (nameMatch) pilot.name = `${nameMatch[1]} (${nameMatch[2].trim()})`

  const empMatch = raw.match(/\b(\d{6})\b/)
  if (empMatch) pilot.empNo = empMatch[1]

  const dutyMatch = raw.match(/\b(CAP|FO|SO|CAPT|F\/O)\b/)
  if (dutyMatch) pilot.duty = dutyMatch[1]

  const natMatch = raw.match(/\b(KOR|USA|JPN|CHN)\b/)
  if (natMatch) pilot.nationality = natMatch[1]

  const acMatch = raw.match(/\b(A380|A350|A330|A321|A320|B777|B747|B787|B737)\b/)
  if (acMatch) pilot.aircraft = acMatch[1]

  return pilot
}

/**
 * Parse the career summary block. It appears as a single run of durations
 * before the flight rows, e.g.
 *   13206:27 3128:29 3026:07 7500:15 4502:52 10549:35 96:53 hr 0:0 hr
 */
function parseSummary(raw: string): LogbookSummary {
  const summary: LogbookSummary = {}
  // Isolate the region before the first flight-log date to avoid capturing
  // durations that belong to flight rows.
  const firstFlight = raw.search(
    /\d{4}\/\d{2}\/\d{2}\s+[A-Z0-9]+\s+\S+\s+\S+\s+[A-Z]{3}-[A-Z]{3}/,
  )
  const head = firstFlight > 0 ? raw.slice(0, firstFlight) : raw

  const durations = head.match(/\b\d+:\d{1,2}\b/g) ?? []
  const mins = durations.map(parseDurationToMinutes)
  // Expected order per the AFLIS summary layout.
  if (mins[0] != null) summary.totalFlightMin = mins[0]
  if (mins[1] != null) summary.typeFlightMin = mins[1]
  if (mins[2] != null) summary.typeCaptainMin = mins[2]
  if (mins[3] != null) summary.captainFlightMin = mins[3]
  if (mins[4] != null) summary.nightFlightMin = mins[4]
  if (mins[5] != null) summary.instrumentFlightMin = mins[5]
  if (mins[6] != null) summary.monthFlightMin = mins[6]
  if (mins[7] != null) summary.monthDeadheadMin = mins[7]

  const typeLabel = head.match(/\b(A380|A350|A330|A321|A320|B777|B747|B787|B737)\b/)
  if (typeLabel) {
    summary.typeFlightLabel = typeLabel[1]
    summary.typeCaptainLabel = typeLabel[1]
  }

  return summary
}

export function parseLogbook(raw: string): ParsedLogbook {
  const normalized = normalize(raw)
  const lines = normalized.split('\n')

  const flights: FlightEntry[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    if (!DATE_RE.test(line)) continue
    const entry = parseFlightLine(line)
    if (!entry) continue
    // De-duplicate identical rows (can happen with overlapping OCR passes).
    const id = `${entry.date}|${entry.flightNo}|${entry.from}|${entry.to}`
    if (seen.has(id)) continue
    seen.add(id)
    flights.push(entry)
  }

  flights.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return {
    pilot: parsePilot(normalized),
    summary: parseSummary(normalized),
    flights,
  }
}
