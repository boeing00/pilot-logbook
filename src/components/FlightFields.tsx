import type { FlightDraft } from '../lib/flightDraft'

interface Props {
  draft: FlightDraft
  onChange: (patch: Partial<FlightDraft>) => void
  /** Rendered inside a table cell, where the grid needs to stay narrower. */
  compact?: boolean
}

export function FlightFields({ draft, onChange, compact = false }: Props) {
  return (
    <div className={`flight-fields${compact ? ' flight-fields--compact' : ''}`}>
      <label className="field">
        <span className="field__label">Date</span>
        <input
          type="date"
          value={draft.date}
          required
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Aircraft</span>
        <input
          type="text"
          value={draft.aircraft}
          placeholder="A380"
          onChange={(e) => onChange({ aircraft: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Tail (HL)</span>
        <input
          type="text"
          value={draft.tail}
          placeholder="7611"
          inputMode="numeric"
          onChange={(e) => onChange({ tail: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Flight no.</span>
        <input
          type="text"
          value={draft.flightNo}
          placeholder="901"
          onChange={(e) => onChange({ flightNo: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">From</span>
        <input
          type="text"
          value={draft.from}
          placeholder="ICN"
          maxLength={4}
          onChange={(e) => onChange({ from: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">To</span>
        <input
          type="text"
          value={draft.to}
          placeholder="CDG"
          maxLength={4}
          onChange={(e) => onChange({ to: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Duty code</span>
        <input
          type="text"
          value={draft.irr}
          placeholder="2Z"
          onChange={(e) => onChange({ irr: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Duty</span>
        <input
          type="text"
          value={draft.duty}
          placeholder="13:20"
          onChange={(e) => onChange({ duty: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Flight</span>
        <input
          type="text"
          value={draft.flight}
          placeholder="11:05"
          onChange={(e) => onChange({ flight: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Night</span>
        <input
          type="text"
          value={draft.night}
          placeholder="4:30"
          onChange={(e) => onChange({ night: e.target.value })}
        />
      </label>
      <label className="field">
        <span className="field__label">Instrument</span>
        <input
          type="text"
          value={draft.instrument}
          placeholder="0:30"
          onChange={(e) => onChange({ instrument: e.target.value })}
        />
      </label>
      <div className="field field--checks">
        <label className="field--check">
          <input
            type="checkbox"
            checked={draft.takeoff}
            onChange={(e) => onChange({ takeoff: e.target.checked })}
          />
          <span>T/O</span>
        </label>
        <label className="field--check">
          <input
            type="checkbox"
            checked={draft.landing}
            onChange={(e) => onChange({ landing: e.target.checked })}
          />
          <span>L/D</span>
        </label>
      </div>
    </div>
  )
}
