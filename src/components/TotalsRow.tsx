import type { Totals } from '../types'
import { formatMinutes } from '../lib/time'

interface Props {
  totals: Totals
  byAircraft?: Record<string, number>
  variant?: 'month' | 'year'
}

export function TotalsRow({ totals, byAircraft, variant = 'month' }: Props) {
  const items: { label: string; value: string }[] = [
    { label: 'Flights', value: String(totals.flights) },
    { label: 'Flight time', value: formatMinutes(totals.flightMin) },
    { label: 'Night', value: formatMinutes(totals.nightMin) },
    { label: 'Instrument', value: formatMinutes(totals.instrumentMin) },
    { label: 'Duty', value: formatMinutes(totals.dutyMin) },
    { label: 'T/O · L/D', value: `${totals.takeoffs} · ${totals.landings}` },
  ]

  const aircraftEntries = byAircraft
    ? Object.entries(byAircraft).sort((a, b) => b[1] - a[1])
    : []

  return (
    <div className={`totals totals--${variant}`}>
      <div className="totals__stats">
        {items.map((it) => (
          <div className="totals__stat" key={it.label}>
            <span className="totals__value">{it.value}</span>
            <span className="totals__label">{it.label}</span>
          </div>
        ))}
      </div>
      {aircraftEntries.length > 0 && (
        <div className="totals__aircraft">
          {aircraftEntries.map(([ac, min]) => (
            <span className="badge" key={ac}>
              {ac} <strong>{formatMinutes(min)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
