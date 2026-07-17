import type { LogbookSummary, PilotInfo } from '../types'
import { formatMinutes } from '../lib/time'

interface Props {
  pilot: PilotInfo
  summary: LogbookSummary
}

interface Stat {
  label: string
  value?: number
  suffix?: string
}

export function SummaryCard({ pilot, summary }: Props) {
  const stats: Stat[] = [
    { label: 'Total flight time', value: summary.totalFlightMin },
    {
      label: `${summary.typeFlightLabel ?? 'Type'} flight time`,
      value: summary.typeFlightMin,
    },
    {
      label: `${summary.typeCaptainLabel ?? 'Type'} CAP time`,
      value: summary.typeCaptainMin,
    },
    { label: 'Captain flight time', value: summary.captainFlightMin },
    { label: 'Night flight time', value: summary.nightFlightMin },
    { label: 'Instrument flight time', value: summary.instrumentFlightMin },
  ]

  const hasStats = stats.some((s) => s.value != null)
  const hasPilot = Boolean(pilot.name || pilot.empNo || pilot.aircraft)

  if (!hasStats && !hasPilot) return null

  return (
    <section className="card summary-card">
      <header className="summary-card__head">
        <div>
          <h2 className="card__title">Career summary</h2>
          <p className="card__subtitle">Cumulative totals reported in the source file</p>
        </div>
        {hasPilot && (
          <div className="pilot">
            {pilot.name && <span className="pilot__name">{pilot.name}</span>}
            <span className="pilot__meta">
              {[pilot.empNo, pilot.aircraft, pilot.duty, pilot.nationality]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        )}
      </header>

      {hasStats && (
        <div className="summary-grid">
          {stats.map((s) =>
            s.value != null ? (
              <div className="summary-grid__item" key={s.label}>
                <span className="summary-grid__value">{formatMinutes(s.value)}</span>
                <span className="summary-grid__label">{s.label}</span>
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}
