import { useMemo, useState } from 'react'
import type { FlightEntry, LogbookSummary, PilotInfo } from '../types'
import { monthLabel } from '../lib/aggregate'
import { flightId } from '../lib/flightId'
import { formatMinutes } from '../lib/time'
import { countIds, reviewIssues, worstLevel, type Issue } from '../lib/review'
import { buildFlight, draftFromFlight, type FlightDraft } from '../lib/flightDraft'
import { FlightFields } from './FlightFields'

/** A parsed upload waiting for the pilot's approval. Nothing is stored yet. */
export interface PendingImport {
  /** File names the rows came from, for the panel header. */
  sources: string[]
  flights: FlightEntry[]
  /** Years the upload is authoritative for (CSV import replaces those years). */
  replaceYears: string[]
  pilot: PilotInfo
  summary: LogbookSummary
}

export interface ReviewResult {
  /** Rows the pilot kept, with edits applied. */
  flights: FlightEntry[]
  /** flightIds the pilot actually edited — these overwrite existing values. */
  editedIds: string[]
  /** Existing flights the pilot rescued from a year-replacing CSV import. */
  keptIds: string[]
}

interface Props {
  pending: PendingImport
  /** Flights already in the logbook, used to spot re-imports and removals. */
  existing: FlightEntry[]
  onCommit: (result: ReviewResult) => void
  onCancel: () => void
}

interface Row {
  key: string
  draft: FlightDraft
  include: boolean
  edited: boolean
  open: boolean
}

const COLUMNS = 14

function monthKeyOf(draft: FlightDraft): string {
  return draft.date.slice(0, 7) // YYYY-MM
}

export function ReviewPanel({ pending, existing, onCommit, onCancel }: Props) {
  const existingIds = useMemo(
    () => new Set(existing.map((f) => flightId(f))),
    [existing],
  )

  const [rows, setRows] = useState<Row[]>(() => {
    const counts = countIds(pending.flights)
    return pending.flights.map((f, i) => {
      const issues = reviewIssues(f, { existing: existingIds, batchCounts: counts })
      return {
        key: `row-${i}`,
        draft: draftFromFlight(f),
        include: true,
        edited: false,
        // A row that cannot be logged as-is opens straight into the editor so
        // the problem is in front of the pilot instead of behind a click.
        open: issues.some((it) => it.level === 'error'),
      }
    })
  })
  const [kept, setKept] = useState<Set<string>>(new Set())

  /** Re-derive entries and issues on every keystroke so the checks stay live. */
  const analysis = useMemo(() => {
    const built = rows.map((r) => buildFlight(r.draft))
    // Only selected rows count towards duplicate detection, so unticking one
    // half of a double-scanned page clears the error on the other.
    const selected = built.filter(
      (b, i): b is FlightEntry => rows[i].include && typeof b !== 'string',
    )
    const counts = countIds(selected)
    return rows.map((_row, i) => {
      const entry = built[i]
      if (typeof entry === 'string') {
        return { entry: null, issues: [{ level: 'error' as const, text: entry }] }
      }
      return {
        entry,
        issues: reviewIssues(entry, { existing: existingIds, batchCounts: counts }),
      }
    })
  }, [rows, existingIds])

  const includedCount = rows.filter((r) => r.include).length
  const blocking = rows.filter(
    (r, i) => r.include && analysis[i].issues.some((it) => it.level === 'error'),
  ).length
  const warnings = rows.filter(
    (r, i) => r.include && worstLevel(analysis[i].issues) === 'warn',
  ).length
  const known = rows.filter(
    (r, i) => r.include && analysis[i].issues.some((it) => it.level === 'info'),
  ).length

  const includedIds = useMemo(() => {
    const ids = new Set<string>()
    rows.forEach((r, i) => {
      const entry = analysis[i].entry
      if (r.include && entry) ids.add(flightId(entry))
    })
    return ids
  }, [rows, analysis])

  /**
   * A CSV is authoritative for the years it covers, so anything logged in
   * those years that the file does not mention would be dropped. Those flights
   * are listed explicitly instead of disappearing behind a single confirm.
   */
  const removals = useMemo(() => {
    if (pending.replaceYears.length === 0) return []
    const years = new Set(pending.replaceYears)
    return existing.filter(
      (f) => years.has(f.date.slice(0, 4)) && !includedIds.has(flightId(f)),
    )
  }, [existing, includedIds, pending.replaceYears])

  const months = useMemo(() => {
    const map = new Map<string, number[]>()
    rows.forEach((row, i) => {
      const key = monthKeyOf(row.draft)
      const list = map.get(key)
      if (list) list.push(i)
      else map.set(key, [i])
    })
    return [...map.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, indexes]) => ({ key, indexes }))
  }, [rows])

  function patchRow(index: number, patch: Partial<Row>): void {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function editRow(index: number, patch: Partial<FlightDraft>): void {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, draft: { ...r.draft, ...patch }, edited: true } : r)),
    )
  }

  function setMonthIncluded(indexes: number[], include: boolean): void {
    const set = new Set(indexes)
    setRows((prev) => prev.map((r, i) => (set.has(i) ? { ...r, include } : r)))
  }

  function toggleKept(id: string): void {
    setKept((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleCommit(): void {
    const flights: FlightEntry[] = []
    const editedIds: string[] = []
    rows.forEach((row, i) => {
      const entry = analysis[i].entry
      if (!row.include || !entry) return
      flights.push(entry)
      if (row.edited) editedIds.push(flightId(entry))
    })
    onCommit({ flights, editedIds, keptIds: [...kept] })
  }

  return (
    <section className="card review">
      <header className="review__head">
        <div>
          <h2 className="card__title">Check {rows.length} flights before importing</h2>
          <p className="review__sources">From {pending.sources.join(', ')}</p>
        </div>
        <div className="review__head-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Discard
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={includedCount === 0 || blocking > 0}
            onClick={handleCommit}
            title={
              blocking > 0
                ? 'Fix or untick the rows marked in red first'
                : `Add ${includedCount} flight(s) to the logbook`
            }
          >
            Import {includedCount} flight{includedCount === 1 ? '' : 's'}
          </button>
        </div>
      </header>

      <p className="review__hint">
        Nothing is saved yet. Compare each row against the print-out, fix anything the OCR misread,
        and untick what you do not want. Edited rows overwrite what is already logged; untouched
        rows only fill in blanks.
      </p>

      <div className="review__stats">
        <span className="chip">{includedCount} selected</span>
        {blocking > 0 && <span className="chip chip--error">{blocking} must be fixed</span>}
        {warnings > 0 && <span className="chip chip--warn">{warnings} to check</span>}
        {known > 0 && <span className="chip chip--info">{known} already logged</span>}
        {blocking === 0 && warnings === 0 && (
          <span className="chip chip--ok">Nothing looks wrong</span>
        )}
      </div>

      <div className="table-wrap">
        <table className="flight-table review-table">
          <thead>
            <tr>
              <th className="center col-pick" />
              <th>Date</th>
              <th>A/C</th>
              <th>Flight</th>
              <th>Route</th>
              <th className="col-duty-code">Duty Code</th>
              <th className="num">Duty</th>
              <th className="num">Flight</th>
              <th className="num">Night</th>
              <th className="num">Inst</th>
              <th className="center">T/O</th>
              <th className="center">L/D</th>
              <th>Check</th>
              <th />
            </tr>
          </thead>

          {months.map(({ key, indexes }) => {
            const [year, month] = key.split('-')
            const all = indexes.every((i) => rows[i].include)
            const attention = indexes.filter(
              (i) => rows[i].include && worstLevel(analysis[i].issues) !== null,
            ).length
            const minutes = indexes.reduce(
              (sum, i) => sum + (rows[i].include ? (analysis[i].entry?.flightMin ?? 0) : 0),
              0,
            )
            return (
              <tbody key={key}>
                <tr className="review-month">
                  <td colSpan={COLUMNS}>
                    <label className="review-month__pick">
                      <input
                        type="checkbox"
                        checked={all}
                        onChange={(e) => setMonthIncluded(indexes, e.target.checked)}
                      />
                      <strong>
                        {month ? monthLabel(month) : 'Unknown month'} {year}
                      </strong>
                    </label>
                    <span className="review-month__meta">
                      {indexes.length} flights · {formatMinutes(minutes)} selected
                      {attention > 0 ? ` · ${attention} flagged` : ''}
                    </span>
                  </td>
                </tr>

                {indexes.map((i) => {
                  const row = rows[i]
                  const { entry, issues } = analysis[i]
                  const level = worstLevel(issues)
                  return [
                    <tr
                      key={row.key}
                      className={[
                        'review-row',
                        row.include ? '' : 'review-row--off',
                        level ? `review-row--${level}` : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <td className="center col-pick">
                        <input
                          type="checkbox"
                          checked={row.include}
                          aria-label={`Include ${row.draft.date} ${row.draft.flightNo}`}
                          onChange={(e) => patchRow(i, { include: e.target.checked })}
                        />
                      </td>
                      <td className="mono">{row.draft.date.slice(5) || '—'}</td>
                      <td>
                        <span className="ac">{row.draft.aircraft || '—'}</span>
                        {row.draft.tail && <span className="tail">HL{row.draft.tail}</span>}
                      </td>
                      <td className="mono">{row.draft.flightNo || <span className="dim">–</span>}</td>
                      <td>
                        {row.draft.from || row.draft.to ? (
                          <span className="route">
                            {row.draft.from || '???'}
                            <span className="route__arrow">→</span>
                            {row.draft.to || '???'}
                          </span>
                        ) : (
                          <span className="dim">–</span>
                        )}
                      </td>
                      <td className="mono col-duty-code">
                        {row.draft.irr ? (
                          <span className="duty-code">{row.draft.irr}</span>
                        ) : (
                          <span className="dim">–</span>
                        )}
                      </td>
                      <td className="num mono">{row.draft.duty || <span className="dim">–</span>}</td>
                      <td className="num mono strong">
                        {row.draft.flight || <span className="dim">–</span>}
                      </td>
                      <td className="num mono">{row.draft.night || <span className="dim">–</span>}</td>
                      <td className="num mono">
                        {row.draft.instrument || <span className="dim">–</span>}
                      </td>
                      <td className="center mono">
                        {row.draft.takeoff ? '1' : <span className="dim">–</span>}
                      </td>
                      <td className="center mono">
                        {row.draft.landing ? '1' : <span className="dim">–</span>}
                      </td>
                      <td>
                        {level ? (
                          <span className={`chip chip--${level}`} title={issues.map((x) => x.text).join('\n')}>
                            {issues.length} {level === 'info' ? 'note' : 'flag'}
                            {issues.length === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span className="chip chip--ok">OK</span>
                        )}
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className="btn btn--ghost btn--small"
                          aria-expanded={row.open}
                          onClick={() => patchRow(i, { open: !row.open })}
                        >
                          {row.open ? 'Done' : 'Edit'}
                        </button>
                      </td>
                    </tr>,

                    row.open ? (
                      <tr key={`${row.key}-editor`} className="review-editor">
                        <td colSpan={COLUMNS}>
                          {issues.length > 0 && (
                            <ul className="review-issues">
                              {issues.map((issue: Issue, n) => (
                                <li key={n} className={`review-issues__item--${issue.level}`}>
                                  {issue.text}
                                </li>
                              ))}
                            </ul>
                          )}
                          <FlightFields
                            compact
                            draft={row.draft}
                            onChange={(patch) => editRow(i, patch)}
                          />
                          {entry && row.edited && (
                            <p className="review-editor__note">
                              Edited — this row will overwrite what is currently logged for{' '}
                              {entry.date}.
                            </p>
                          )}
                        </td>
                      </tr>
                    ) : null,
                  ]
                })}
              </tbody>
            )
          })}
        </table>
      </div>

      {removals.length > 0 && (
        <div className="review__removals">
          <h3 className="review__removals-title">
            {removals.length} logged flight{removals.length === 1 ? '' : 's'} not in this file
          </h3>
          <p className="review__hint">
            A CSV replaces the years it covers ({pending.replaceYears.join(', ')}), so these will be
            deleted. Tick the ones you want to keep.
          </p>
          <ul className="review__removal-list">
            {removals.map((f) => {
              const id = flightId(f)
              return (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={kept.has(id)}
                      onChange={() => toggleKept(id)}
                    />
                    <span className="mono">{f.date}</span> {f.flightNo || '—'}{' '}
                    <span className="route">
                      {f.from}
                      <span className="route__arrow">→</span>
                      {f.to}
                    </span>{' '}
                    <span className="dim">{formatMinutes(f.flightMin)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <footer className="review__footer">
        <span className="review__footer-text">
          {blocking > 0
            ? `${blocking} selected row(s) cannot be logged yet — fix them in the editor or untick them.`
            : `${includedCount} of ${rows.length} rows will be added to the logbook.`}
        </span>
        <div className="review__head-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Discard
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={includedCount === 0 || blocking > 0}
            onClick={handleCommit}
          >
            Import {includedCount} flight{includedCount === 1 ? '' : 's'}
          </button>
        </div>
      </footer>
    </section>
  )
}
