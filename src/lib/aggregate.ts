import type { FlightEntry, MonthGroup, Totals, YearGroup } from '../types'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthLabel(month: string): string {
  const idx = Number(month) - 1
  return MONTH_NAMES[idx] ?? month
}

function emptyTotals(): Totals {
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

function addFlight(totals: Totals, byAircraft: Record<string, number>, f: FlightEntry): void {
  totals.flights += 1
  totals.flightMin += f.flightMin
  totals.nightMin += f.nightMin
  totals.instrumentMin += f.instrumentMin
  totals.dutyMin += f.dutyMin
  if (f.takeoff) totals.takeoffs += 1
  if (f.landing) totals.landings += 1
  byAircraft[f.aircraft] = (byAircraft[f.aircraft] ?? 0) + f.flightMin
}

/** Split "YYYY/MM/DD" into { year, month }. */
function splitDate(date: string): { year: string; month: string } {
  const [year = '', month = ''] = date.split('/')
  return { year, month }
}

export function groupByMonth(flights: FlightEntry[]): MonthGroup[] {
  const map = new Map<string, MonthGroup>()

  for (const f of flights) {
    const { year, month } = splitDate(f.date)
    const key = `${year}-${month}`
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        year,
        month,
        flights: [],
        totals: emptyTotals(),
        byAircraft: {},
      }
      map.set(key, group)
    }
    group.flights.push(f)
    addFlight(group.totals, group.byAircraft, f)
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
}

export function groupByYear(months: MonthGroup[]): YearGroup[] {
  const map = new Map<string, YearGroup>()

  for (const m of months) {
    let group = map.get(m.year)
    if (!group) {
      group = { year: m.year, months: [], totals: emptyTotals(), byAircraft: {} }
      map.set(m.year, group)
    }
    group.months.push(m)
    group.totals.flights += m.totals.flights
    group.totals.flightMin += m.totals.flightMin
    group.totals.nightMin += m.totals.nightMin
    group.totals.instrumentMin += m.totals.instrumentMin
    group.totals.dutyMin += m.totals.dutyMin
    group.totals.takeoffs += m.totals.takeoffs
    group.totals.landings += m.totals.landings
    for (const [ac, min] of Object.entries(m.byAircraft)) {
      group.byAircraft[ac] = (group.byAircraft[ac] ?? 0) + min
    }
  }

  return [...map.values()].sort((a, b) => (a.year < b.year ? 1 : a.year > b.year ? -1 : 0))
}
