import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/lib/extractText', () => ({
  extractText: vi.fn(),
  isCsvFile: () => false,
  isHeicFile: () => false,
  isSupportedFile: () => true,
}))

import App from '../src/App'
import { csvToFlights } from '../src/lib/csv'
import { flightId } from '../src/lib/flightId'
import type { FlightEntry } from '../src/types'

function flight(over: Partial<FlightEntry> = {}): FlightEntry {
  return {
    date: '2025/03/02', aircraft: 'A380', tail: '7611', flightNo: '901',
    from: 'ICN', to: 'CDG', irr: '', reportOut: '', reportIn: '',
    dutyMin: 800, flightMin: 700, nightMin: 300, instrumentMin: 30,
    takeoff: true, landing: false, ...over,
  }
}

const KEY = 'pilot-logbook.parsed.v1'
const stored = (): FlightEntry[] => JSON.parse(localStorage.getItem(KEY)!).flights

function seed(flights: FlightEntry[], summary: object = {}) {
  localStorage.setItem(KEY, JSON.stringify({ pilot: {}, summary, flights }))
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('CSV import from an Excel re-save', () => {
  const header = 'Date,Aircraft,Tail,FlightNo,From,To,DutyCode,Category,Duty,Flight,Night,Instrument,T/O,L/D'

  it('reads H:MM:SS durations instead of zeroing them', () => {
    const [f] = csvToFlights(`${header}\n2025/03/02,A380,7611,901,ICN,CDG,,,13:20:00,11:05:00,4:30:00,0:30:00,1,`)
    expect(f.dutyMin).toBe(800)
    expect(f.flightMin).toBe(665)
    expect(f.nightMin).toBe(270)
    expect(f.instrumentMin).toBe(30)
  })

  it('treats 0 / N / FALSE in T/O and L/D as no', () => {
    const rows = csvToFlights(
      `${header}\n2025/03/02,A380,7611,901,ICN,CDG,,,1:00,1:00,0:00,0:00,0,N\n` +
        `2025/03/03,A380,7611,902,CDG,ICN,,,1:00,1:00,0:00,0:00,1,*`,
    )
    expect([rows[0].takeoff, rows[0].landing]).toEqual([false, false])
    expect([rows[1].takeoff, rows[1].landing]).toEqual([true, true])
  })

  it('matches a flight number Excel stripped of its leading zero', () => {
    expect(flightId(flight({ flightNo: '11' }))).toBe(flightId(flight({ flightNo: '011' })))
    expect(flightId(flight({ flightNo: '0' }))).not.toBe(flightId(flight({ flightNo: '' })))
  })
})

describe('career summary', () => {
  it('sums every logged sector for a figure the report did not supply', async () => {
    // The report gave a total but no instrument figure. Instrument must be the
    // whole logged sum, not just the flights after the as-of date.
    seed(
      [flight({ instrumentMin: 30 }), flight({ date: '2025/03/09', flightNo: '903', instrumentMin: 45 })],
      { totalFlightMin: 60000, asOf: '2025/03/05' },
    )
    render(<App />)
    const label = await screen.findByText('Instrument flight time')
    expect(label.previousElementSibling?.textContent).toBe('1:15')
  })
})

describe('editing a logged flight', () => {
  it('replaces the sector even when its identity changes', async () => {
    seed([flight(), flight({ date: '2025/03/05', flightNo: '902', from: 'CDG', to: 'ICN' })])
    const user = userEvent.setup()
    render(<App />)

    const row = (await screen.findByText('901')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: /Edit the 2025\/03\/02/ }))

    const tail = screen.getByLabelText('Tail (HL)')
    await user.clear(tail)
    await user.type(tail, '7622')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const flights = stored()
    expect(flights).toHaveLength(2)
    expect(flights.find((f) => f.flightNo === '901')?.tail).toBe('7622')
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('asks before overwriting a different logged sector', async () => {
    seed([flight(), flight({ tail: '7622', flightMin: 100 })])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    const rows = (await screen.findAllByText('901')).map((el) => el.closest('tr')!)
    await user.click(within(rows[0]).getAllByRole('button', { name: /Edit/ })[0])
    const tail = screen.getByLabelText('Tail (HL)')
    await user.clear(tail)
    await user.type(tail, rows[0].textContent?.includes('HL7611') ? '7622' : '7611')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(confirm).toHaveBeenCalledOnce()
    expect(stored()).toHaveLength(2)
  })
})
