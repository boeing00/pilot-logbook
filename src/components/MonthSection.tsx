import { useState } from 'react'
import type { MonthGroup } from '../types'
import { monthLabel } from '../lib/aggregate'
import { FlightTable } from './FlightTable'
import { TotalsRow } from './TotalsRow'

interface Props {
  group: MonthGroup
  defaultOpen?: boolean
}

export function MonthSection({ group, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

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

      {open && <FlightTable flights={group.flights} />}
    </section>
  )
}
