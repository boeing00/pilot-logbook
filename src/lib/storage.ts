import type { FlightEntry, FlightTotals } from '../types'

const STORAGE_KEY = 'pilot-logbook.entries.v1'

export function loadEntries(): FlightEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FlightEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function saveEntries(entries: FlightEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function computeTotals(entries: FlightEntry[]): FlightTotals {
  return entries.reduce<FlightTotals>(
    (acc, e) => ({
      flights: acc.flights + 1,
      totalTime: acc.totalTime + e.totalTime,
      pic: acc.pic + e.pic,
      sic: acc.sic + e.sic,
      dualReceived: acc.dualReceived + e.dualReceived,
      dualGiven: acc.dualGiven + e.dualGiven,
      solo: acc.solo + e.solo,
      night: acc.night + e.night,
      crossCountry: acc.crossCountry + e.crossCountry,
      actualInstrument: acc.actualInstrument + e.actualInstrument,
      simulatedInstrument: acc.simulatedInstrument + e.simulatedInstrument,
      dayLandings: acc.dayLandings + e.dayLandings,
      nightLandings: acc.nightLandings + e.nightLandings,
      approaches: acc.approaches + e.approaches,
    }),
    {
      flights: 0,
      totalTime: 0,
      pic: 0,
      sic: 0,
      dualReceived: 0,
      dualGiven: 0,
      solo: 0,
      night: 0,
      crossCountry: 0,
      actualInstrument: 0,
      simulatedInstrument: 0,
      dayLandings: 0,
      nightLandings: 0,
      approaches: 0,
    },
  )
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value)) return '0.0'
  return value.toFixed(1)
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `flt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function exportCsv(entries: FlightEntry[]): string {
  const headers = [
    'Date',
    'Aircraft',
    'ID',
    'From',
    'To',
    'Route',
    'Total',
    'PIC',
    'SIC',
    'Dual Rec',
    'Dual Given',
    'Solo',
    'Night',
    'XC',
    'Actual Inst',
    'Sim Inst',
    'Day LDG',
    'Night LDG',
    'Approaches',
    'Remarks',
  ]

  const rows = entries.map((e) =>
    [
      e.date,
      e.aircraftMakeModel,
      e.aircraftId,
      e.from,
      e.to,
      e.route,
      e.totalTime,
      e.pic,
      e.sic,
      e.dualReceived,
      e.dualGiven,
      e.solo,
      e.night,
      e.crossCountry,
      e.actualInstrument,
      e.simulatedInstrument,
      e.dayLandings,
      e.nightLandings,
      e.approaches,
      e.remarks,
    ]
      .map((cell) => {
        const text = String(cell ?? '')
        return `"${text.replaceAll('"', '""')}"`
      })
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}
