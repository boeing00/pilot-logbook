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

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify({
    pilot: {}, summary: {},
    flights: [flight(), flight({ date: '2025/03/05', flightNo: '902', from: 'CDG', to: 'ICN' })],
  }))
})
afterEach(() => vi.restoreAllMocks())

describe('per-flight delete', () => {
  it('deletes the row after the confirmation is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)

    const row = (await screen.findByText('901')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: /Delete the 2025\/03\/02/ }))

    expect(screen.queryByText('901')).toBeNull()
    expect(screen.queryByText('902')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(KEY)!).flights.length).toBe(1)
  })

  it('keeps the row when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    const row = (await screen.findByText('901')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: /Delete the 2025\/03\/02/ }))

    expect(screen.queryByText('901')).not.toBeNull()
    expect(JSON.parse(localStorage.getItem(KEY)!).flights.length).toBe(2)
  })

  it('names the flight in the confirmation', async () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)
    const row = (await screen.findByText('901')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: /Delete the 2025\/03\/02/ }))
    expect(spy.mock.calls[0][0]).toContain('2025/03/02')
    expect(spy.mock.calls[0][0]).toContain('ICN→CDG')
  })
})

describe('manual entry', () => {
  it('offers Add flight in the header and on each month card', async () => {
    render(<App />)
    const buttons = await screen.findAllByRole('button', { name: /Add flight/ })
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('opens the form prefilled with the month it was opened from', async () => {
    const user = userEvent.setup()
    render(<App />)

    const monthCard = (await screen.findByText('March')).closest('section')!
    await user.click(within(monthCard).getByRole('button', { name: /Add flight/ }))

    const date = screen.getByLabelText<HTMLInputElement>('Date', { exact: false })
    expect(date.value).toBe('2025-03-05')
    expect(screen.getByDisplayValue('A380')).toBeTruthy()
  })

  it('adds a typed flight to the logbook', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /Add flight/ })[0])
    await user.type(screen.getByPlaceholderText('901'), '905')
    await user.type(screen.getByPlaceholderText('ICN'), 'ICN')
    await user.type(screen.getByPlaceholderText('CDG'), 'NRT')
    await user.type(screen.getByPlaceholderText('11:05'), '2:15')
    await user.click(screen.getByRole('button', { name: 'Add flight' }))

    expect(await screen.findByText(/Added/)).toBeTruthy()
    const stored = JSON.parse(localStorage.getItem(KEY)!)
    expect(stored.flights.length).toBe(3)
    expect(stored.flights.some((f: FlightEntry) => f.flightNo === '905' && f.flightMin === 135)).toBe(true)
  })
})

describe('career total', () => {
  it('carries the reported baseline forward with flights logged after it', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      pilot: {},
      summary: { totalFlightMin: 13206 * 60 + 27, asOf: '2026/07/31' },
      flights: [
        flight({ date: '2026/07/20', flightMin: 700 }),   // already in the baseline
        flight({ date: '2026/08/03', flightNo: '903', flightMin: 660 }),
        flight({ date: '2026/08/09', flightNo: '904', flightMin: 120 }),
      ],
    }))
    render(<App />)
    // 13206:27 + 13:00 logged after the report
    expect(await screen.findByText('13219:27')).toBeTruthy()
    expect(screen.getByText(/as of 2026\/07\/31/)).toBeTruthy()
  })

  it('lets the pilot correct a misread baseline', async () => {
    const user = userEvent.setup()
    localStorage.setItem(KEY, JSON.stringify({
      pilot: {}, summary: { totalFlightMin: 154, asOf: '2026/07/31' }, // the bogus "2:34"
      flights: [flight({ date: '2026/08/03', flightMin: 60 })],
    }))
    render(<App />)
    expect(await screen.findByText('3:34')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Edit baseline' }))
    const total = screen.getByPlaceholderText('13206:27')
    await user.clear(total)
    await user.type(total, '13206:27')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('13207:27')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(KEY)!).summary.totalFlightMin).toBe(13206 * 60 + 27)
  })
})

describe('night and instrument carry forward', () => {
  it('adds night and instrument time logged after the baseline', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      pilot: {},
      summary: {
        totalFlightMin: 13206 * 60 + 27,
        nightFlightMin: 4502 * 60 + 52,
        instrumentFlightMin: 100 * 60,
        captainFlightMin: 7500 * 60 + 15,
        asOf: '2026/07/31',
      },
      flights: [
        flight({ date: '2026/07/20', flightMin: 700, nightMin: 300, instrumentMin: 30 }),
        flight({ date: '2026/08/03', flightNo: '903', flightMin: 660, nightMin: 240, instrumentMin: 20 }),
      ],
    }))
    render(<App />)

    expect(await screen.findByText('13217:27')).toBeTruthy()   // 13206:27 + 11:00
    expect(screen.getByText('4506:52')).toBeTruthy()           // 4502:52 + 4:00
    expect(screen.getByText('100:20')).toBeTruthy()            // 100:00 + 0:20
    expect(screen.getByText('7500:15')).toBeTruthy()           // captain: untouched
  })

  it('shows logged night and instrument time when no report supplied a baseline', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      pilot: {}, summary: {},
      flights: [flight({ flightMin: 660, nightMin: 240, instrumentMin: 20 })],
    }))
    render(<App />)
    const card = within((await screen.findByText('Career summary')).closest('section')!)
    expect(card.getByText('11:00')).toBeTruthy()
    expect(card.getByText('4:00')).toBeTruthy()
    expect(card.getByText('0:20')).toBeTruthy()
  })
})
