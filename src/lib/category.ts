import type { CategoryTotals, FlightCategory, FlightEntry, Totals } from '../types'

export const CATEGORY_LABELS: Record<FlightCategory, string> = {
  pic: 'A380 PIC Time',
  auditor: 'Auditor Time',
}

/**
 * Classify a sector:
 * - Any non-A380 aircraft is an Auditor flight.
 * - Any duty code containing "Z" is Auditor time.
 * - Everything else is A380 PIC time.
 */
export function flightCategory(f: FlightEntry): FlightCategory {
  if (f.aircraft.toUpperCase() !== 'A380') return 'auditor'
  if (f.irr.toUpperCase().includes('Z')) return 'auditor'
  return 'pic'
}

export function emptyTotals(): Totals {
  return {
    flights: 0,
    flightMin: 0,
    nightMin: 0,
    instrumentMin: 0,
    dutyMin: 0,
    takeoffs: 0,
    landings: 0,
  }
}

export function addFlightToTotals(totals: Totals, f: FlightEntry): void {
  totals.flights += 1
  totals.flightMin += f.flightMin
  totals.nightMin += f.nightMin
  totals.instrumentMin += f.instrumentMin
  totals.dutyMin += f.dutyMin
  if (f.takeoff) totals.takeoffs += 1
  if (f.landing) totals.landings += 1
}

export function emptyCategoryTotals(): CategoryTotals {
  return { pic: emptyTotals(), auditor: emptyTotals() }
}

export function categoryTotals(flights: FlightEntry[]): CategoryTotals {
  const totals = emptyCategoryTotals()
  for (const f of flights) addFlightToTotals(totals[flightCategory(f)], f)
  return totals
}

export function splitByCategory(flights: FlightEntry[]): Record<FlightCategory, FlightEntry[]> {
  const out: Record<FlightCategory, FlightEntry[]> = { pic: [], auditor: [] }
  for (const f of flights) out[flightCategory(f)].push(f)
  return out
}
