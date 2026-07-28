import { useState } from 'react'
import type { FlightEntry, LogbookSummary, PilotInfo } from '../types'
import { formatMinutes, parseDurationInput } from '../lib/time'

interface Props {
  pilot: PilotInfo
  summary: LogbookSummary
  /** Every logged sector, used to carry the career total past the baseline. */
  flights: FlightEntry[]
  /** Overwrite the baseline total and the date it is current as of. */
  onSetBaseline?: (totalFlightMin?: number, asOf?: string) => void
}

interface Stat {
  label: string
  value?: number
}

export function SummaryCard({ pilot, summary, flights, onSetBaseline }: Props) {
  const [editing, setEditing] = useState(false)
  const [totalInput, setTotalInput] = useState('')
  const [asOfInput, setAsOfInput] = useState('')
  const [error, setError] = useState('')

  const baseline = summary.totalFlightMin
  const asOf = summary.asOf

  /**
   * The report's header is a snapshot: correct on its print date and stale the
   * moment the next sector is flown. So a carried figure is that baseline plus
   * everything logged after the last flight the report covered. Without an
   * as-of date nothing can be added safely — the baseline may already include
   * these flights — so the raw figure stands until the pilot dates it.
   *
   * Only the three totals that can be recomputed from the sectors themselves
   * are carried. The captain and per-type figures depend on crew position,
   * which the flight rows do not record, so those stay as reported.
   */
  function carry(baselineMin: number | undefined, of: (f: FlightEntry) => number) {
    const since = asOf
      ? flights.reduce((sum, f) => (f.date > asOf ? sum + of(f) : sum), 0)
      : baselineMin != null
        ? 0
        : flights.reduce((sum, f) => sum + of(f), 0)
    const value = baselineMin != null ? baselineMin + since : since > 0 ? since : undefined
    return { value, since }
  }

  const total = carry(baseline, (f) => f.flightMin)
  const night = carry(summary.nightFlightMin, (f) => f.nightMin)
  const instrument = carry(summary.instrumentFlightMin, (f) => f.instrumentMin)

  const stats: Stat[] = [
    { label: 'Total flight time', value: total.value },
    { label: `${summary.typeFlightLabel ?? 'Type'} flight time`, value: summary.typeFlightMin },
    { label: `${summary.typeCaptainLabel ?? 'Type'} CAP time`, value: summary.typeCaptainMin },
    { label: 'Captain flight time', value: summary.captainFlightMin },
    { label: 'Night flight time', value: night.value },
    { label: 'Instrument flight time', value: instrument.value },
  ]

  const hasStats = stats.some((s) => s.value != null)
  const hasPilot = Boolean(pilot.name || pilot.empNo || pilot.aircraft)
  if (!hasStats && !hasPilot) return null

  function startEditing() {
    setTotalInput(baseline != null ? formatMinutes(baseline) : '')
    setAsOfInput(asOf ? asOf.replaceAll('/', '-') : '')
    setError('')
    setEditing(true)
  }

  function save() {
    if (!onSetBaseline) return
    const trimmed = totalInput.trim()
    if (trimmed === '') {
      onSetBaseline(undefined, undefined)
      setEditing(false)
      return
    }
    const minutes = parseDurationInput(trimmed)
    if (minutes == null || minutes <= 0) {
      setError('Enter the total as H:MM (e.g. 13206:27) or decimal hours.')
      return
    }
    if (asOfInput !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(asOfInput)) {
      setError('Enter the as-of date, or clear it.')
      return
    }
    onSetBaseline(minutes, asOfInput === '' ? undefined : asOfInput.replaceAll('-', '/'))
    setEditing(false)
  }

  return (
    <section className="card summary-card">
      <header className="summary-card__head">
        <div>
          <h2 className="card__title">Career summary</h2>
          <p className="card__subtitle">
            Total, night, and instrument time are the figures reported in the source file,
            carried forward with everything logged since. The other rows are as reported.
          </p>
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

      {onSetBaseline && !editing && (
        <p className="summary-card__baseline">
          {baseline != null ? (
            <>
              Baseline <strong>{formatMinutes(baseline)}</strong>
              {asOf ? (
                <>
                  {' '}
                  as of {asOf} · logged since:{' '}
                  <strong>{formatMinutes(total.since)}</strong> flight,{' '}
                  <strong>{formatMinutes(night.since)}</strong> night,{' '}
                  <strong>{formatMinutes(instrument.since)}</strong> instrument
                </>
              ) : (
                <> — no as-of date, so later flights are not being added yet</>
              )}
            </>
          ) : (
            <>No baseline from a report — the total is the sum of the logged flights.</>
          )}{' '}
          <button type="button" className="link-btn" onClick={startEditing}>
            Edit baseline
          </button>
        </p>
      )}

      {editing && (
        <div className="summary-card__editor">
          <label className="field">
            <span className="field__label">Total flight time in the report</span>
            <input
              type="text"
              value={totalInput}
              placeholder="13206:27"
              onChange={(e) => {
                setTotalInput(e.target.value)
                setError('')
              }}
            />
          </label>
          <label className="field">
            <span className="field__label">Current as of (last flight in that report)</span>
            <input
              type="date"
              value={asOfInput}
              onChange={(e) => {
                setAsOfInput(e.target.value)
                setError('')
              }}
            />
          </label>
          <div className="summary-card__editor-actions">
            <button type="button" className="btn btn--primary btn--small" onClick={save}>
              Save
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
          {error && <p className="flight-form__error">{error}</p>}
        </div>
      )}
    </section>
  )
}
