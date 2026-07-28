import type { FlightEntry } from '../types'
import { flightId } from './flightId'
import { formatMinutes } from './time'

export type IssueLevel = 'error' | 'warn' | 'info'

export interface Issue {
  level: IssueLevel
  text: string
}

export interface ReviewContext {
  /** flightIds already present in the logbook. */
  existing: Set<string>
  /** How many rows in this import share each flightId. */
  batchCounts: Map<string, number>
}

/** Longest sector any airline schedules, with margin — beyond this it is OCR noise. */
const MAX_SECTOR_MIN = 19 * 60
const IATA_RE = /^[A-Z]{3}$/
const TYPE_RE = /^[A-Z]{1,2}\d{2,3}[A-Z]?$/

function isRealDate(date: string): boolean {
  const m = date.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && y >= 1950
  )
}

function todayStamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

/**
 * Everything worth a second look before a parsed row is committed to the
 * logbook. OCR fails in predictable ways — a smudged digit turns 1:05 into
 * 11:05, a column shifts and duty lands in the flight-time cell, the same page
 * gets photographed twice — so the checks target those failures rather than
 * trying to validate the flight itself. 'error' means the row cannot be logged
 * as-is; 'warn' means it is loggable but suspicious; 'info' is context.
 */
export function reviewIssues(f: FlightEntry, ctx: ReviewContext): Issue[] {
  const issues: Issue[] = []
  const id = flightId(f)

  if (!isRealDate(f.date)) {
    issues.push({ level: 'error', text: `"${f.date}" is not a real calendar date.` })
  } else if (f.date > todayStamp()) {
    issues.push({ level: 'warn', text: 'The date is in the future.' })
  }

  if (f.aircraft === '') {
    issues.push({
      level: 'error',
      text: 'No aircraft type, so the sector cannot be split into PIC or Auditor time.',
    })
  } else if (!TYPE_RE.test(f.aircraft)) {
    issues.push({ level: 'warn', text: `"${f.aircraft}" does not look like a type code.` })
  }

  if (f.tail !== '' && !/^\d{3,5}$/.test(f.tail)) {
    issues.push({ level: 'warn', text: `Tail "HL${f.tail}" does not look like a registration.` })
  }

  if (f.flightNo === '') issues.push({ level: 'warn', text: 'No flight number.' })

  if (!IATA_RE.test(f.from) || !IATA_RE.test(f.to)) {
    issues.push({ level: 'warn', text: 'Route is missing or is not a pair of 3-letter airports.' })
  } else if (f.from === f.to) {
    issues.push({ level: 'warn', text: 'Departure and arrival are the same airport.' })
  }

  if (f.flightMin === 0) {
    issues.push({ level: 'warn', text: 'Flight time is 0:00 — nothing will be credited.' })
  } else if (f.flightMin > MAX_SECTOR_MIN) {
    issues.push({
      level: 'warn',
      text: `Flight time ${formatMinutes(f.flightMin)} is longer than any scheduled sector.`,
    })
  }

  if (f.dutyMin > 0 && f.flightMin > f.dutyMin) {
    issues.push({
      level: 'warn',
      text: `Flight time ${formatMinutes(f.flightMin)} exceeds duty time ${formatMinutes(f.dutyMin)} — the columns may have shifted.`,
    })
  }
  if (f.nightMin > f.flightMin) {
    issues.push({ level: 'warn', text: 'Night time is longer than flight time.' })
  }
  if (f.instrumentMin > f.flightMin) {
    issues.push({ level: 'warn', text: 'Instrument time is longer than flight time.' })
  }

  if ((ctx.batchCounts.get(id) ?? 0) > 1) {
    issues.push({
      level: 'error',
      text: 'This row appears twice in the upload — same date, flight number, route, and tail.',
    })
  } else if (ctx.existing.has(id)) {
    issues.push({
      level: 'info',
      text: 'Already in the logbook. Importing refreshes that sector instead of adding a second one.',
    })
  }

  return issues
}

export function worstLevel(issues: Issue[]): IssueLevel | null {
  if (issues.some((i) => i.level === 'error')) return 'error'
  if (issues.some((i) => i.level === 'warn')) return 'warn'
  if (issues.length > 0) return 'info'
  return null
}

/** Count each flightId across a batch, so duplicates inside one upload surface. */
export function countIds(flights: FlightEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const f of flights) {
    const id = flightId(f)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}
