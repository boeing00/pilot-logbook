import { useMemo } from 'react'
import type { YearGroup } from '../types'
import { TotalsRow } from './TotalsRow'
import { CategoryBreakdown } from './CategoryBreakdown'
import { CityStats } from './CityStats'

interface Props {
  year: YearGroup
  /** Home base airport (e.g. ICN), excluded from city-visit counts. */
  base?: string | null
  onExportYear?: (year: string) => void
  onRemoveYear?: (year: string) => void
}

export function YearSummary({ year, base, onExportYear, onRemoveYear }: Props) {
  const flights = useMemo(() => year.months.flatMap((m) => m.flights), [year])
  return (
    <section className="card year">
      <header className="year__head">
        <h2 className="year__title">{year.year} annual total</h2>
        <div className="year__side">
          <span className="year__months">{year.months.length} months logged</span>
          {onExportYear && (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => onExportYear(year.year)}
              title={`Download all ${year.year} flights as CSV (archive)`}
            >
              Export {year.year} CSV
            </button>
          )}
          {onRemoveYear && (
            <button
              type="button"
              className="btn btn--ghost btn--small btn--danger"
              onClick={() => onRemoveYear(year.year)}
              title={`Remove ${year.year} flights from this browser`}
            >
              Remove year
            </button>
          )}
        </div>
      </header>
      <TotalsRow totals={year.totals} byAircraft={year.byAircraft} variant="year" />
      <div className="year__categories">
        <CategoryBreakdown byCategory={year.byCategory} />
      </div>
      <CityStats flights={flights} base={base} />
    </section>
  )
}
