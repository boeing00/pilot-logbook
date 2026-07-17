import { useState } from 'react'
import type { FlightCategory, MonthGroup } from '../types'
import { monthLabel } from '../lib/aggregate'
import { CATEGORY_LABELS, splitByCategory } from '../lib/category'
import { formatMinutes } from '../lib/time'
import { FlightTable } from './FlightTable'
import { TotalsRow } from './TotalsRow'
import { CategoryBreakdown } from './CategoryBreakdown'

interface Props {
  group: MonthGroup
  defaultOpen?: boolean
}

const ORDER: FlightCategory[] = ['pic', 'auditor']

export function MonthSection({ group, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const byCat = splitByCategory(group.flights)

  return (
    <section className="card month">
      <button
        type="button"
        className="month__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="month__chevron" data-open={open} aria-hidden>
          ▸
        </span>
        <h3 className="month__title">
          {monthLabel(group.month)} <span className="month__year">{group.year}</span>
        </h3>
        <span className="month__count">{group.totals.flights} flights</span>
      </button>

      <TotalsRow totals={group.totals} byAircraft={group.byAircraft} variant="month" />
      <div className="month__categories">
        <CategoryBreakdown byCategory={group.byCategory} />
      </div>

      {open &&
        ORDER.map((cat) => {
          const flights = byCat[cat]
          if (flights.length === 0) return null
          const totals = group.byCategory[cat]
          return (
            <div className={`cat-section cat-section--${cat}`} key={cat}>
              <div className="cat-section__head">
                <h4 className="cat-section__title">{CATEGORY_LABELS[cat]}</h4>
                <span className="cat-section__meta">
                  {totals.flights} flights · {formatMinutes(totals.flightMin)} · T/O{' '}
                  {totals.takeoffs} · L/D {totals.landings}
                </span>
              </div>
              <FlightTable flights={flights} />
            </div>
          )
        })}
    </section>
  )
}
