import type { FlightTotals } from '../types'
import { formatHours } from '../lib/storage'

interface TotalsBarProps {
  totals: FlightTotals
}

const ITEMS: Array<{ key: keyof FlightTotals; label: string; hours?: boolean }> = [
  { key: 'totalTime', label: 'Total Time', hours: true },
  { key: 'pic', label: 'PIC', hours: true },
  { key: 'night', label: 'Night', hours: true },
  { key: 'crossCountry', label: 'Cross Country', hours: true },
  { key: 'dayLandings', label: 'Day LDG' },
  { key: 'nightLandings', label: 'Night LDG' },
  { key: 'flights', label: 'Flights' },
]

export function TotalsBar({ totals }: TotalsBarProps) {
  return (
    <div className="totals" aria-label="Flight totals">
      {ITEMS.map((item, index) => {
        const raw = totals[item.key]
        const value = item.hours ? formatHours(raw) : String(raw)
        return (
          <div
            key={item.key}
            className="totals__item"
            style={{ animationDelay: `${0.05 * index}s` }}
          >
            <span className="totals__label">{item.label}</span>
            <span className="totals__value">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
