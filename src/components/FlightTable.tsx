import type { FlightEntry } from '../types'
import { formatMinutes } from '../lib/time'

interface Props {
  flights: FlightEntry[]
}

export function FlightTable({ flights }: Props) {
  return (
    <div className="table-wrap">
      <table className="flight-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>A/C</th>
            <th>Flight</th>
            <th>Route</th>
            <th>Out</th>
            <th>In</th>
            <th className="num">Duty</th>
            <th className="num">Flight</th>
            <th className="num">Night</th>
            <th className="num">Inst</th>
            <th className="center">T/O·L/D</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f, i) => (
            <tr key={`${f.date}-${f.flightNo}-${f.reportOut}-${i}`}>
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
              <td className="mono dim">{f.reportOut}</td>
              <td className="mono dim">{f.reportIn}</td>
              <td className="num mono">{formatMinutes(f.dutyMin)}</td>
              <td className="num mono strong">{formatMinutes(f.flightMin)}</td>
              <td className="num mono">{formatMinutes(f.nightMin)}</td>
              <td className="num mono">{formatMinutes(f.instrumentMin)}</td>
              <td className="center">
                {f.takeoff && <span className="dot" title="Take-off">▲</span>}
                {f.landing && <span className="dot" title="Landing">▼</span>}
                {!f.takeoff && !f.landing && <span className="dim">–</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
