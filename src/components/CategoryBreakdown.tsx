import type { CategoryTotals, FlightCategory } from '../types'
import { CATEGORY_LABELS } from '../lib/category'
import { formatMinutes } from '../lib/time'

interface Props {
  byCategory: CategoryTotals
}

const ORDER: FlightCategory[] = ['pic', 'auditor']

/** Compact A380 PIC vs Auditor time chips shown in totals rows. */
export function CategoryBreakdown({ byCategory }: Props) {
  const entries = ORDER.filter((c) => byCategory[c].flights > 0)
  if (entries.length === 0) return null

  return (
    <div className="totals__aircraft">
      {entries.map((c) => (
        <span className={`badge badge--${c}`} key={c}>
          {CATEGORY_LABELS[c]} <strong>{formatMinutes(byCategory[c].flightMin)}</strong>
          <span className="badge__meta">
            {byCategory[c].flights} FLT · T/O {byCategory[c].takeoffs} · L/D {byCategory[c].landings}
          </span>
        </span>
      ))}
    </div>
  )
}
