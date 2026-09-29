import { describe, expect, it } from 'vitest'
import { csvToFlights, flightsToCsv } from '../src/lib/csv'
import type { FlightEntry } from '../src/types'

const flight: FlightEntry = {
  date: '2025/03/02', aircraft: 'A380', tail: '7611', flightNo: '901',
  from: 'ICN', to: 'CDG', irr: '', reportOut: '03/02 12:05', reportIn: '03/03 01:25',
  dutyMin: 800, flightMin: 700, nightMin: 300, instrumentMin: 30,
  takeoff: true, landing: false,
}
const header = 'Date,Aircraft,Flight,T/O,L/D'

describe('CSV data preservation', () => {
  it('round trips every flight field, including report timestamps and quoted text', () => {
    const entry = { ...flight, irr: 'note, "quoted"\rline' }
    expect(csvToFlights(flightsToCsv([entry]))).toEqual([entry])
  })

  it('does not count zero or false markers as takeoffs and landings', () => {
    const rows = csvToFlights(`${header}\n2025/03/02,A380,1:00,0,FALSE\n2025/03/03,A380,1:00,true,1`)
    expect(rows.map(({ takeoff, landing }) => [takeoff, landing])).toEqual([[false, false], [true, true]])
  })

  it('rejects a damaged row instead of silently importing only part of an archive', () => {
    expect(() => csvToFlights(`${header}\n2025/03/02,A380,1:00,1,\nbad-date,A380,1:00,,`)).toThrow(/row 3.*date/i)
    expect(() => csvToFlights(`${header}\n2025/03/02,A380,1:99,1,`)).toThrow(/row 2.*Flight/i)
    expect(() => csvToFlights(`${header}\n2025/03/02,A380,"1:00,1,`)).toThrow(/quote/i)
  })

  it('keeps compatibility with BOMs, semicolon CSV and older column names', () => {
    const [entry] = csvToFlights('\uFEFFDate;Aircraft;Flight;Takeoff;Landing;ReportOut\r\n3/2/2025;A380;1:30;X;0;03/02 12:05')
    expect(entry).toMatchObject({ date: '2025/03/02', flightMin: 90, takeoff: true, landing: false, reportOut: '03/02 12:05' })
  })
})
