import type { FlightEntry } from '../types'
import { categoryTotals } from '../lib/category'
import { formatMinutes } from '../lib/time'

interface Props {
  flights: FlightEntry[]
}

/**
 * Overall split of all loaded flights into A380 PIC time and Auditor time.
 * Auditor time = non-A380 sectors plus any sector whose duty code contains "Z".
 */
export function CategorySummary({ flights }: Props) {
  const totals = categoryTotals(flights)
  if (totals.pic.flights === 0 && totals.auditor.flights === 0) return null

  const cards = [
    { key: 'pic' as const, title: 'A380 PIC Time', t: totals.pic },
    { key: 'auditor' as const, title: 'Auditor Time', t: totals.auditor },
  ]

  return (
    <div className="cat-summary">
      {cards.map(({ key, title, t }) => (
        <section className={`card cat-card cat-card--${key}`} key={key}>
          <header className="cat-card__head">
            <h2 className="cat-card__title">{title}</h2>
            <span className="cat-card__count">{t.flights} flights</span>
          </header>
          <div className="cat-card__grid">
            <div className="cat-card__stat">
              <span className="cat-card__value">{formatMinutes(t.flightMin)}</span>
              <span className="cat-card__label">Flight time</span>
            </div>
            <div className="cat-card__stat">
              <span className="cat-card__value">{formatMinutes(t.nightMin)}</span>
              <span className="cat-card__label">Night</span>
            </div>
            <div className="cat-card__stat">
              <span className="cat-card__value">{formatMinutes(t.instrumentMin)}</span>
              <span className="cat-card__label">Instrument</span>
            </div>
            <div className="cat-card__stat">
              <span className="cat-card__value">{t.takeoffs}</span>
              <span className="cat-card__label">T/O</span>
            </div>
            <div className="cat-card__stat">
              <span className="cat-card__value">{t.landings}</span>
              <span className="cat-card__label">L/D</span>
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
