import type { FlightEntry } from '../types'
import { formatHours } from '../lib/storage'

interface FlightListProps {
  entries: FlightEntry[]
  query: string
  onEdit: (entry: FlightEntry) => void
  onDelete: (id: string) => void
}

export function FlightList({ entries, query, onEdit, onDelete }: FlightListProps) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? entries.filter((e) =>
        [e.date, e.aircraftMakeModel, e.aircraftId, e.from, e.to, e.route, e.remarks]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : entries

  if (entries.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No flights logged yet</p>
        <p className="empty__copy">
          Start your logbook with the first flight — date, aircraft, route, and time.
        </p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No matching flights</p>
        <p className="empty__copy">Try a different airport, aircraft, or date.</p>
      </div>
    )
  }

  return (
    <div className="flight-table-wrap">
      <table className="flight-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Aircraft</th>
            <th>Route</th>
            <th>Total</th>
            <th>PIC</th>
            <th>Night</th>
            <th>LDG</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((entry, index) => (
            <tr key={entry.id} style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}>
              <td>
                <time dateTime={entry.date}>{entry.date}</time>
              </td>
              <td>
                <div className="ac">
                  <span className="ac__model">{entry.aircraftMakeModel}</span>
                  {entry.aircraftId ? (
                    <span className="ac__id">{entry.aircraftId}</span>
                  ) : null}
                </div>
              </td>
              <td>
                <span className="route">
                  <span>{entry.from}</span>
                  <span className="route__arrow" aria-hidden="true">
                    →
                  </span>
                  <span>{entry.to}</span>
                </span>
                {entry.route ? <span className="route__via">{entry.route}</span> : null}
              </td>
              <td className="num">{formatHours(entry.totalTime)}</td>
              <td className="num">{formatHours(entry.pic)}</td>
              <td className="num">{formatHours(entry.night)}</td>
              <td className="num">{entry.dayLandings + entry.nightLandings}</td>
              <td className="actions">
                <button type="button" className="link-btn" onClick={() => onEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="link-btn link-btn--danger"
                  onClick={() => {
                    if (window.confirm('Delete this flight entry?')) {
                      onDelete(entry.id)
                    }
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
