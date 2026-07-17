import type { FlightEntry } from '../types'
import { CATEGORY_LABELS, flightCategory } from './category'
import { formatMinutes, parseDurationToMinutes } from './time'

const HEADER = [
  'Date',
  'Aircraft',
  'Tail',
  'FlightNo',
  'From',
  'To',
  'DutyCode',
  'Category',
  'Duty',
  'Flight',
  'Night',
  'Instrument',
  'T/O',
  'L/D',
]

function cell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function flightsToCsv(flights: FlightEntry[]): string {
  const rows = flights.map((f) =>
    [
      f.date,
      f.aircraft,
      f.tail,
      f.flightNo,
      f.from,
      f.to,
      f.irr,
      CATEGORY_LABELS[flightCategory(f)],
      formatMinutes(f.dutyMin),
      formatMinutes(f.flightMin),
      formatMinutes(f.nightMin),
      formatMinutes(f.instrumentMin),
      f.takeoff ? '1' : '',
      f.landing ? '1' : '',
    ]
      .map(cell)
      .join(','),
  )
  return [HEADER.join(','), ...rows].join('\n')
}

/** Split raw CSV text into rows of cells, honoring quoted cells. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cellBuf = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cellBuf += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cellBuf += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cellBuf)
      cellBuf = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cellBuf)
      cellBuf = ''
      rows.push(row)
      row = []
    } else {
      cellBuf += ch
    }
  }
  if (cellBuf !== '' || row.length > 0) {
    row.push(cellBuf)
    rows.push(row)
  }
  return rows
}

/** Case-insensitive header lookup supporting old and new export column names. */
function columnIndex(header: string[], names: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase())
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

/**
 * Parse a CSV previously produced by "Export CSV" back into flight entries.
 * Understands both the current header (DutyCode, T/O, L/D) and older exports
 * (IRR, Takeoff, Landing, ReportOut/ReportIn). Rows that don't carry a valid
 * YYYY/MM/DD date are skipped.
 */
export function csvToFlights(text: string): FlightEntry[] {
  const rows = parseCsvRows(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length < 2) return []

  const header = rows[0]
  const col = {
    date: columnIndex(header, ['Date']),
    aircraft: columnIndex(header, ['Aircraft']),
    tail: columnIndex(header, ['Tail']),
    flightNo: columnIndex(header, ['FlightNo']),
    from: columnIndex(header, ['From']),
    to: columnIndex(header, ['To']),
    irr: columnIndex(header, ['DutyCode', 'IRR']),
    reportOut: columnIndex(header, ['ReportOut']),
    reportIn: columnIndex(header, ['ReportIn']),
    duty: columnIndex(header, ['Duty']),
    flight: columnIndex(header, ['Flight']),
    night: columnIndex(header, ['Night']),
    instrument: columnIndex(header, ['Instrument']),
    takeoff: columnIndex(header, ['T/O', 'Takeoff']),
    landing: columnIndex(header, ['L/D', 'Landing']),
  }
  if (col.date === -1 || col.aircraft === -1 || col.flight === -1) return []

  const get = (row: string[], idx: number): string => (idx === -1 ? '' : (row[idx] ?? '').trim())

  const flights: FlightEntry[] = []
  for (const row of rows.slice(1)) {
    const date = get(row, col.date)
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(date)) continue
    flights.push({
      date,
      aircraft: get(row, col.aircraft),
      tail: get(row, col.tail),
      flightNo: get(row, col.flightNo),
      from: get(row, col.from),
      to: get(row, col.to),
      irr: get(row, col.irr),
      reportOut: get(row, col.reportOut),
      reportIn: get(row, col.reportIn),
      dutyMin: parseDurationToMinutes(get(row, col.duty)),
      flightMin: parseDurationToMinutes(get(row, col.flight)),
      nightMin: parseDurationToMinutes(get(row, col.night)),
      instrumentMin: parseDurationToMinutes(get(row, col.instrument)),
      takeoff: get(row, col.takeoff) !== '',
      landing: get(row, col.landing) !== '',
    })
  }
  return flights
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
