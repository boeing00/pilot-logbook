import type { FlightEntry, LogbookSummary, ParsedLogbook, PilotInfo } from '../types'
import { parseDurationToMinutes } from './time'

const DATE_RE = /\d{4}\/\d{2}\/\d{2}/
const ROUTE_RE = /^[A-Z]{3}-[A-Z]{3}$/
const MMDD_RE = /^\d{2}\/\d{2}$/
const TIME_RE = /^\d{1,2}:\d{2}$/

/**
 * Normalize OCR / PDF-extracted text so that each flight record starts on its
 * own line. PDF/OCR output frequently collapses rows onto a single line, so we
 * force a break before every full (YYYY/MM/DD) date token.
 */
function normalize(raw: string): string {
  return raw
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    // common OCR digit confusions inside time-like tokens are left alone here;
    // we only tidy whitespace and force line breaks before dates.
    .replace(/(\d{4}\/\d{2}\/\d{2})/g, '\n$1')
    .replace(/[ \t]+/g, ' ')
}

function toTokens(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

/**
 * Parse a single normalized line into a FlightEntry, or null if the line is not
 * a flight record. The layout is:
 *   DATE ACFT TAIL FLTNO ROUTE [IRR...] RO_DATE RO_TIME RI_DATE RI_TIME
 *   DUTY TS NT IT [*] [*]
 */
export function parseFlightLine(line: string): FlightEntry | null {
  const tokens = toTokens(line)
  if (tokens.length < 12) return null
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(tokens[0])) return null

  const routeIdx = tokens.findIndex((t) => ROUTE_RE.test(t))
  if (routeIdx < 4) return null

  // First MM/DD after the route marks the report-out date.
  let roIdx = -1
  for (let i = routeIdx + 1; i < tokens.length; i++) {
    if (MMDD_RE.test(tokens[i])) {
      roIdx = i
      break
    }
  }
  if (roIdx === -1 || roIdx + 7 >= tokens.length) return null

  const date = tokens[0]
  const aircraft = tokens[1]
  const tail = tokens[2]
  const flightNo = tokens[3]
  const [from, to] = tokens[routeIdx].split('-')
  const irr = tokens.slice(routeIdx + 1, roIdx).join(' ')

  const roDate = tokens[roIdx]
  const roTime = tokens[roIdx + 1]
  const riDate = tokens[roIdx + 2]
  const riTime = tokens[roIdx + 3]
  if (!TIME_RE.test(roTime) || !MMDD_RE.test(riDate) || !TIME_RE.test(riTime)) {
    return null
  }

  const durationTokens = tokens.slice(roIdx + 4)
  const times = durationTokens.filter((t) => TIME_RE.test(t))
  if (times.length < 4) return null
  const [dutyMin, flightMin, nightMin, instrumentMin] = times
    .slice(0, 4)
    .map(parseDurationToMinutes)

  const asterisks = durationTokens.filter((t) => t === '*').length

  return {
    date,
    aircraft,
    tail,
    flightNo,
    from,
    to,
    irr,
    reportOut: `${roDate} ${roTime}`,
    reportIn: `${riDate} ${riTime}`,
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
  const firstFlight = raw.search(/\d{4}\/\d{2}\/\d{2}\s+[A-Z0-9]+\s+\S+\s+\S+\s+[A-Z]{3}-[A-Z]{3}/)
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
    const id = `${entry.date}|${entry.flightNo}|${entry.from}|${entry.to}|${entry.reportOut}`
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
