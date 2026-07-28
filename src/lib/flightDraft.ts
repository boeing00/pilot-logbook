import type { FlightEntry } from '../types'
import { parseDurationInput } from './time'

/**
 * A flight while it is being typed: every value is the raw string in the input
 * box, so a half-finished "9:" does not have to be a valid duration yet. Both
 * the manual-entry form and the import review editor work on this shape, which
 * is why the conversion between a draft and a FlightEntry lives here rather
 * than inside either screen.
 */
export interface FlightDraft {
  /** YYYY-MM-DD, the format <input type="date"> speaks. */
  date: string
  aircraft: string
  tail: string
  flightNo: string
  from: string
  to: string
  irr: string
  duty: string
  flight: string
  night: string
  instrument: string
  takeoff: boolean
  landing: boolean
  /** Report times are carried through edits untouched (OCR-only fields). */
  reportOut: string
  reportIn: string
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function minutesToInput(min: number): string {
  if (!min) return ''
  return `${Math.floor(min / 60)}:${pad2(min % 60)}`
}

export interface DraftSeed {
  date?: string
  aircraft?: string
  tail?: string
}

export function emptyDraft(defaults?: DraftSeed): FlightDraft {
  return {
    date: defaults?.date ?? todayIso(),
    aircraft: defaults?.aircraft ?? 'A380',
    tail: defaults?.tail ?? '',
    flightNo: '',
    from: '',
    to: '',
    irr: '',
    duty: '',
    flight: '',
    night: '',
    instrument: '',
    takeoff: false,
    landing: false,
    reportOut: '',
    reportIn: '',
  }
}

export function draftFromFlight(f: FlightEntry): FlightDraft {
  return {
    date: f.date.replaceAll('/', '-'),
    aircraft: f.aircraft,
    tail: f.tail,
    flightNo: f.flightNo,
    from: f.from,
    to: f.to,
    irr: f.irr,
    duty: minutesToInput(f.dutyMin),
    flight: minutesToInput(f.flightMin),
    night: minutesToInput(f.nightMin),
    instrument: minutesToInput(f.instrumentMin),
    takeoff: f.takeoff,
    landing: f.landing,
    reportOut: f.reportOut,
    reportIn: f.reportIn,
  }
}

/**
 * Turn a draft into a FlightEntry, or return the message explaining why it
 * cannot be one yet. Callers treat a string result as "not loggable".
 */
export function buildFlight(d: FlightDraft): FlightEntry | string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return 'Enter a date (YYYY-MM-DD).'
  if (d.aircraft.trim() === '') return 'Aircraft type is required (e.g. A380).'

  const times: Array<[label: string, raw: string]> = [
    ['Duty', d.duty],
    ['Flight', d.flight],
    ['Night', d.night],
    ['Instrument', d.instrument],
  ]
  const minutes: number[] = []
  for (const [label, raw] of times) {
    const parsed = parseDurationInput(raw)
    if (parsed == null) {
      return `${label} time "${raw.trim()}" is not valid — use H:MM (9:30) or hours (9.5).`
    }
    minutes.push(parsed)
  }
  const [dutyMin, flightMin, nightMin, instrumentMin] = minutes

  return {
    date: d.date.replaceAll('-', '/'),
    aircraft: d.aircraft.trim().toUpperCase(),
    tail: d.tail.trim().replace(/^HL/i, ''),
    flightNo: d.flightNo.trim().toUpperCase(),
    from: d.from.trim().toUpperCase(),
    to: d.to.trim().toUpperCase(),
    irr: d.irr.trim().toUpperCase(),
    reportOut: d.reportOut,
    reportIn: d.reportIn,
    dutyMin,
    flightMin,
    nightMin,
    instrumentMin,
    takeoff: d.takeoff,
    landing: d.landing,
  }
}
