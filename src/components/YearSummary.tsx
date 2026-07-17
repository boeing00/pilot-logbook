import type { YearGroup } from '../types'
import { TotalsRow } from './TotalsRow'

interface Props {
  year: YearGroup
}

export function YearSummary({ year }: Props) {
  return (
    <section className="card year">
      <header className="year__head">
        <h2 className="year__title">{year.year} annual total</h2>
        <span className="year__months">{year.months.length} months logged</span>
      </header>
      <TotalsRow totals={year.totals} byAircraft={year.byAircraft} variant="year" />
    </section>
  )
}
