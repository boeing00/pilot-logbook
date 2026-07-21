import { useMemo, useState } from 'react'
import type { FlightEntry } from '../types'
import { cityVisitCounts, routeCounts } from '../lib/stats'

interface Props {
  flights: FlightEntry[]
  /** Home base airport to exclude from "cities visited" (e.g. ICN). */
  base?: string | null
  /** Compact chip row (used inside a month section). */
  compact?: boolean
}

const COMPACT_LIMIT = 8
const PANEL_LIMIT = 14

/**
 * "Cities visited" statistics. A visit is counted per arrival airport,
 * excluding the inferred home base so returns home are not "visits".
 */
export function CityStats({ flights, base, compact = false }: Props) {
  const [showAll, setShowAll] = useState(false)

  const cities = useMemo(() => cityVisitCounts(flights, base), [flights, base])
  const routes = useMemo(() => (compact ? [] : routeCounts(flights)), [flights, compact])

  if (cities.length === 0) return null

  if (compact) {
    const shown = cities.slice(0, COMPACT_LIMIT)
    const rest = cities.length - shown.length
    return (
      <div className="city-stats city-stats--compact">
        <span className="city-stats__label">Cities</span>
        {shown.map((c) => (
          <span className="badge badge--city" key={c.city}>
            {c.city} <strong>×{c.count}</strong>
          </span>
        ))}
        {rest > 0 && <span className="city-stats__more">+{rest} more</span>}
      </div>
    )
  }

  const shown = showAll ? cities : cities.slice(0, PANEL_LIMIT)
  const hidden = cities.length - shown.length

  return (
    <div className="city-stats">
      <div className="city-stats__head">
        <span className="city-stats__label">
          Cities visited{base ? ` (excl. base ${base})` : ''} · {cities.length} cities
        </span>
        {hidden > 0 && !showAll && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowAll(true)}>
            Show all
          </button>
        )}
        {showAll && cities.length > PANEL_LIMIT && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowAll(false)}>
            Show top {PANEL_LIMIT}
          </button>
        )}
      </div>
      <div className="city-stats__chips">
        {shown.map((c) => (
          <span className="badge badge--city" key={c.city}>
            {c.city} <strong>×{c.count}</strong>
          </span>
        ))}
        {hidden > 0 && !showAll && <span className="city-stats__more">+{hidden} more</span>}
      </div>
      {routes.length > 0 && (
        <div className="city-stats__routes">
          <span className="city-stats__label">Top routes</span>
          {routes.slice(0, 6).map((r) => (
            <span className="badge" key={r.route}>
              {r.route} <strong>×{r.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
