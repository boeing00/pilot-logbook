import type { FlightEntry } from '../types'

export interface CityCount {
  city: string
  count: number
}

export interface RouteCount {
  route: string
  count: number
}

/**
 * Infer the pilot's home base as the most frequent departure airport
 * (e.g. ICN for a Korean-airline logbook). Returns null when unknown.
 */
export function inferHomeBase(flights: FlightEntry[]): string | null {
  const counts = new Map<string, number>()
  for (const f of flights) {
    if (!f.from) continue
    counts.set(f.from, (counts.get(f.from) ?? 0) + 1)
  }
  let best: string | null = null
  let bestN = 0
  for (const [city, n] of counts) {
    if (n > bestN) {
      best = city
      bestN = n
    }
  }
  return best
}

/**
 * Count how many times each city was visited (= arrival airport of a sector),
 * sorted by count desc, then alphabetically. The home base can be excluded so
 * that returning to ICN is not counted as "visiting" ICN.
 */
export function cityVisitCounts(
  flights: FlightEntry[],
  excludeBase?: string | null,
): CityCount[] {
  const counts = new Map<string, number>()
  for (const f of flights) {
    if (!f.to) continue
    if (excludeBase && f.to === excludeBase) continue
    counts.set(f.to, (counts.get(f.to) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || (a.city < b.city ? -1 : 1))
}

/** Count sectors per route ("ICN-LAX"), sorted by count desc. */
export function routeCounts(flights: FlightEntry[]): RouteCount[] {
  const counts = new Map<string, number>()
  for (const f of flights) {
    if (!f.from || !f.to) continue
    const route = `${f.from}-${f.to}`
    counts.set(route, (counts.get(route) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count || (a.route < b.route ? -1 : 1))
}
