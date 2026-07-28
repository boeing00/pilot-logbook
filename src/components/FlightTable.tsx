import type { FlightEntry } from '../types'
import { flightCategory } from '../lib/category'
import { formatMinutes } from '../lib/time'

interface Props {
  flights: FlightEntry[]
  /** Delete a single sector. The column is hidden when no handler is given. */
  onRemove?: (flight: FlightEntry) => void
}

export function FlightTable({ flights, onRemove }: Props) {
  return (
    <div className="table-wrap">
      <table className="flight-table">
        <thead>
          <tr>
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
            {onRemove && <th className="center col-remove" aria-label="Delete" />}
          </tr>
        </thead>
        <tbody>
          {flights.map((f, i) => {
            const isAuditor = flightCategory(f) === 'auditor'
            const route = f.from && f.to ? `${f.from}–${f.to}` : ''
            return (
              <tr
                key={`${f.date}-${f.flightNo}-${f.reportOut}-${i}`}
                className={isAuditor ? 'flight-row--auditor' : undefined}
              >
                <td className="mono">{f.date.slice(5)}</td>
                <td>
                  <span className="ac">{f.aircraft}</span>
                  <span className="tail">HL{f.tail}</span>
                </td>
                <td className="mono">{f.flightNo}</td>
                <td>
                  <span className="route">
                    {f.from}
                    <span className="route__arrow">→</span>
                    {f.to}
                  </span>
                </td>
                <td className="mono col-duty-code">
                  {f.irr ? (
                    <span className="duty-code">{f.irr}</span>
                  ) : (
                    <span className="dim">–</span>
                  )}
                </td>
                <td className="num mono">{formatMinutes(f.dutyMin)}</td>
                <td className="num mono strong">{formatMinutes(f.flightMin)}</td>
                <td className="num mono">{formatMinutes(f.nightMin)}</td>
                <td className="num mono">{formatMinutes(f.instrumentMin)}</td>
                <td className="center mono">{f.takeoff ? '1' : <span className="dim">–</span>}</td>
                <td className="center mono">{f.landing ? '1' : <span className="dim">–</span>}</td>
                {onRemove && (
                  <td className="center col-remove">
                    <button
                      type="button"
                      className="row-remove"
                      aria-label={`Delete the ${f.date} flight ${f.flightNo} ${route}`}
                      title="Delete this flight"
                      onClick={() => onRemove(f)}
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
