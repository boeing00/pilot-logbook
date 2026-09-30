import { useState, type FormEvent } from 'react'
import type { FlightEntry } from '../types'
import { CATEGORY_LABELS, flightCategory } from '../lib/category'
import { formatMinutes } from '../lib/time'
import {
  buildFlight,
  draftFromFlight,
  emptyDraft,
  type DraftSeed,
  type FlightDraft,
} from '../lib/flightDraft'
import { FlightFields } from './FlightFields'

interface Props {
  /** Adds (or overwrites) one sector. Returns true when it replaced an existing one. */
  onAdd: (flight: FlightEntry) => boolean
  onClose: () => void
  /** Date / airframe to prefill, e.g. from the month the pilot opened it in. */
  defaults?: DraftSeed
  /** A logged sector being corrected; the form then saves over it instead of adding. */
  editing?: FlightEntry | null
  /** Replace `original` with `updated`, even when the date, route, or tail changed. */
  onUpdate?: (original: FlightEntry, updated: FlightEntry) => void
}

/**
 * Manual entry for a single sector, for flights that never made it into an
 * AFLIS print-out (sim rides, ferry legs, a page the OCR could not read, or a
 * flight the pilot wants to log the same day). The resulting entry has exactly
 * the same shape as a parsed one, so it merges, exports, and syncs identically.
 *
 * Opened with `editing`, the same form corrects a logged sector in place. That
 * covers the case adding cannot: a misread date, flight number, route, or tail
 * changes the flight's identity, so "add again" would leave the bad row behind.
 */
export function FlightForm({ onAdd, onClose, defaults, editing, onUpdate }: Props) {
  const [draft, setDraft] = useState<FlightDraft>(() =>
    editing ? draftFromFlight(editing) : emptyDraft(defaults),
  )
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  function handleChange(patch: Partial<FlightDraft>): void {
    setDraft((prev) => ({ ...prev, ...patch }))
    setError('')
    setSaved('')
  }

  const built = buildFlight(draft)
  const preview = typeof built === 'string' ? null : built

  function handleSubmit(e: FormEvent): void {
    e.preventDefault()
    if (typeof built === 'string') {
      setError(built)
      return
    }
    if (editing && onUpdate) {
      onUpdate(editing, built)
      return
    }
    const replaced = onAdd(built)
    const route = built.from && built.to ? ` ${built.from}→${built.to}` : ''
    setSaved(
      `${replaced ? 'Updated' : 'Added'} ${built.date}${route} · ${formatMinutes(built.flightMin)} flight time.`,
    )
    setError('')
    // Keep date / aircraft / tail so the next sector of the same pairing is
    // two or three fields away; the leg-specific fields start blank, with the
    // arrival airport carried over as the next departure.
    setDraft((prev) => ({
      ...prev,
      flightNo: '',
      from: prev.to,
      to: '',
      irr: '',
      duty: '',
      flight: '',
      night: '',
      instrument: '',
      takeoff: false,
      landing: false,
    }))
  }

  return (
    <section className={`card flight-form${editing ? ' flight-form--edit' : ''}`}>
      <div className="flight-form__head">
        <h2 className="card__title">
          {editing
            ? `Edit ${editing.date} ${editing.flightNo}`.trim()
            : 'Add a flight manually'}
        </h2>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          {editing ? 'Cancel' : 'Close'}
        </button>
      </div>
      <p className="flight-form__hint">
        {editing ? (
          <>
            Correct any field, including the date, route, or tail. Saving replaces this sector.
            Times accept H:MM (9:30) or decimal hours (9.5).
          </>
        ) : (
          <>
            For sectors that are not on an AFLIS print-out. Times accept H:MM (9:30) or decimal
            hours (9.5). Adding a flight that already exists on the same date, flight number,
            route, and tail overwrites it. To fix a logged row, use <strong>Edit</strong> on that
            row in its month.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit}>
        <FlightFields draft={draft} onChange={handleChange} />

        <div className="flight-form__footer">
          <span className="flight-form__preview">
            {preview ? (
              <>
                Logs as <strong>{CATEGORY_LABELS[flightCategory(preview)]}</strong> ·{' '}
                {formatMinutes(preview.flightMin)} flight / {formatMinutes(preview.dutyMin)} duty
              </>
            ) : (
              'Fill in the date and aircraft to log this sector.'
            )}
          </span>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Save changes' : 'Add flight'}
          </button>
        </div>
      </form>

      {error && <p className="flight-form__error">{error}</p>}
      {!error && saved && <p className="flight-form__saved">{saved}</p>}
    </section>
  )
}
