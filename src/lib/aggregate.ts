import type { FlightEntry, MonthGroup, Totals, YearGroup } from '../types'
import { addFlightToTotals, emptyCategoryTotals, flightCategory } from './category'

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

function accumulate(target: Totals, add: Totals): void {
  target.flights += add.flights
  target.flightMin += add.flightMin
  target.nightMin += add.nightMin
  target.instrumentMin += add.instrumentMin
  target.dutyMin += add.dutyMin
  target.takeoffs += add.takeoffs
  target.landings += add.landings
}

function addFlight(group: MonthGroup, f: FlightEntry): void {
  addFlightToTotals(group.totals, f)
  addFlightToTotals(group.byCategory[flightCategory(f)], f)
  group.byAircraft[f.aircraft] = (group.byAircraft[f.aircraft] ?? 0) + f.flightMin
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
        byCategory: emptyCategoryTotals(),
      }
      map.set(key, group)
    }
    group.flights.push(f)
    addFlight(group, f)
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
}

export function groupByYear(months: MonthGroup[]): YearGroup[] {
  const map = new Map<string, YearGroup>()

  for (const m of months) {
    let group = map.get(m.year)
    if (!group) {
      group = {
        year: m.year,
        months: [],
        totals: emptyTotals(),
        byAircraft: {},
        byCategory: emptyCategoryTotals(),
      }
      map.set(m.year, group)
    }
    group.months.push(m)
    accumulate(group.totals, m.totals)
    accumulate(group.byCategory.pic, m.byCategory.pic)
    accumulate(group.byCategory.auditor, m.byCategory.auditor)
    for (const [ac, min] of Object.entries(m.byAircraft)) {
      group.byAircraft[ac] = (group.byAircraft[ac] ?? 0) + min
    }
  }

  return [...map.values()].sort((a, b) => (a.year < b.year ? 1 : a.year > b.year ? -1 : 0))
}
