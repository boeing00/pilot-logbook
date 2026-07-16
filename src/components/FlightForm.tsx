import { useEffect, useId, useState, type FormEvent } from 'react'
import type { FlightDraft, FlightEntry } from '../types'
import { emptyDraft } from '../types'

interface FlightFormProps {
  open: boolean
  initial?: FlightEntry | null
  onClose: () => void
  onSubmit: (draft: FlightDraft) => void
}

function NumberField({
  label,
  value,
  onChange,
  step = '0.1',
  min = '0',
}: {
  label: string
  value: number
  onChange: (n: number) => void
  step?: string
  min?: string
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  maxLength?: number
}) {
  const id = useId()
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function FlightForm({ open, initial, onClose, onSubmit }: FlightFormProps) {
  const [draft, setDraft] = useState<FlightDraft>(emptyDraft())
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    if (initial) {
      setDraft({
        date: initial.date,
        aircraftMakeModel: initial.aircraftMakeModel,
        aircraftId: initial.aircraftId,
        from: initial.from,
        to: initial.to,
        route: initial.route,
        totalTime: initial.totalTime,
        pic: initial.pic,
        sic: initial.sic,
        dualReceived: initial.dualReceived,
        dualGiven: initial.dualGiven,
        solo: initial.solo,
        night: initial.night,
        crossCountry: initial.crossCountry,
        actualInstrument: initial.actualInstrument,
        simulatedInstrument: initial.simulatedInstrument,
        dayLandings: initial.dayLandings,
        nightLandings: initial.nightLandings,
        approaches: initial.approaches,
        remarks: initial.remarks,
      })
    } else {
      setDraft(emptyDraft())
    }
  }, [open, initial])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function set<K extends keyof FlightDraft>(key: K, value: FlightDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!draft.aircraftMakeModel.trim() || !draft.from.trim() || !draft.to.trim()) {
      return
    }
    if (draft.totalTime <= 0) return
    onSubmit({
      ...draft,
      aircraftMakeModel: draft.aircraftMakeModel.trim(),
      aircraftId: draft.aircraftId.trim().toUpperCase(),
      from: draft.from.trim().toUpperCase(),
      to: draft.to.trim().toUpperCase(),
      route: draft.route.trim().toUpperCase(),
      remarks: draft.remarks.trim(),
    })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2 id={titleId}>{initial ? 'Edit Flight' : 'Log Flight'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <form className="flight-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field" htmlFor="flight-date">
              <span>Date</span>
              <input
                id="flight-date"
                type="date"
                required
                value={draft.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </label>
            <TextField
              label="Aircraft"
              value={draft.aircraftMakeModel}
              onChange={(v) => set('aircraftMakeModel', v)}
              required
              placeholder="C172S"
            />
            <TextField
              label="Aircraft ID"
              value={draft.aircraftId}
              onChange={(v) => set('aircraftId', v)}
              placeholder="N12345"
              maxLength={10}
            />
            <TextField
              label="From"
              value={draft.from}
              onChange={(v) => set('from', v)}
              required
              placeholder="RKSI"
              maxLength={8}
            />
            <TextField
              label="To"
              value={draft.to}
              onChange={(v) => set('to', v)}
              required
              placeholder="RKSS"
              maxLength={8}
            />
            <TextField
              label="Route"
              value={draft.route}
              onChange={(v) => set('route', v)}
              placeholder="DCT"
            />
          </div>

          <fieldset className="form-section">
            <legend>Time (hours)</legend>
            <div className="form-grid form-grid--dense">
              <NumberField label="Total" value={draft.totalTime} onChange={(n) => set('totalTime', n)} />
              <NumberField label="PIC" value={draft.pic} onChange={(n) => set('pic', n)} />
              <NumberField label="SIC" value={draft.sic} onChange={(n) => set('sic', n)} />
              <NumberField
                label="Dual Received"
                value={draft.dualReceived}
                onChange={(n) => set('dualReceived', n)}
              />
              <NumberField
                label="Dual Given"
                value={draft.dualGiven}
                onChange={(n) => set('dualGiven', n)}
              />
              <NumberField label="Solo" value={draft.solo} onChange={(n) => set('solo', n)} />
              <NumberField label="Night" value={draft.night} onChange={(n) => set('night', n)} />
              <NumberField
                label="Cross Country"
                value={draft.crossCountry}
                onChange={(n) => set('crossCountry', n)}
              />
              <NumberField
                label="Actual Instrument"
                value={draft.actualInstrument}
                onChange={(n) => set('actualInstrument', n)}
              />
              <NumberField
                label="Simulated Instrument"
                value={draft.simulatedInstrument}
                onChange={(n) => set('simulatedInstrument', n)}
              />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Landings & Approaches</legend>
            <div className="form-grid form-grid--dense">
              <NumberField
                label="Day Landings"
                value={draft.dayLandings}
                onChange={(n) => set('dayLandings', Math.max(0, Math.round(n)))}
                step="1"
              />
              <NumberField
                label="Night Landings"
                value={draft.nightLandings}
                onChange={(n) => set('nightLandings', Math.max(0, Math.round(n)))}
                step="1"
              />
              <NumberField
                label="Approaches"
                value={draft.approaches}
                onChange={(n) => set('approaches', Math.max(0, Math.round(n)))}
                step="1"
              />
            </div>
          </fieldset>

          <label className="field field--full" htmlFor="flight-remarks">
            <span>Remarks</span>
            <textarea
              id="flight-remarks"
              rows={3}
              value={draft.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              placeholder="Weather, training notes, endorsements…"
            />
          </label>

          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              {initial ? 'Save Changes' : 'Add to Logbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
