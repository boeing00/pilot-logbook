import { useState } from 'react'
import type { FlightEntry, MonthGroup } from '../types'
import { monthLabel } from '../lib/aggregate'
import { FlightTable } from './FlightTable'
import { TotalsRow } from './TotalsRow'
import { CategoryBreakdown } from './CategoryBreakdown'
import { CityStats } from './CityStats'

interface Props {
  group: MonthGroup
  /** Home base airport (e.g. ICN), excluded from city-visit counts. */
  base?: string | null
  defaultOpen?: boolean
  /** Download just this month as CSV. */
  onExportMonth?: (key: string) => void
  /** Delete a single sector from the month's table. */
  onRemoveFlight?: (flight: FlightEntry) => void
  /** Open the manual entry form prefilled for this month. */
  onAddFlight?: (group: MonthGroup) => void
}

export function MonthSection({
  group,
  base,
  defaultOpen = false,
  onExportMonth,
  onRemoveFlight,
  onAddFlight,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const label = `${monthLabel(group.month)} ${group.year}`

  return (
    <section className="card month">
      {/* The toggle is its own button so the export action can sit beside it —
          a button may not be nested inside another button. */}
      <div className="month__head">
        <button
          type="button"
          className="month__toggle"
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

        {(onExportMonth || onAddFlight) && (
          <div className="month__actions">
            {onAddFlight && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => onAddFlight(group)}
                title={`Add a flight to ${label} by hand`}
              >
                + Add flight
              </button>
            )}
            {onExportMonth && (
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => onExportMonth(group.key)}
                title={`Download the ${label} flights as CSV (archive)`}
              >
                Export CSV
              </button>
            )}
          </div>
        )}
      </div>

      <TotalsRow totals={group.totals} byAircraft={group.byAircraft} variant="month" />
      <div className="month__categories">
        <CategoryBreakdown byCategory={group.byCategory} />
      </div>
      <CityStats flights={group.flights} base={base} compact />

      {open && <FlightTable flights={group.flights} onRemove={onRemoveFlight} />}
    </section>
  )
}
