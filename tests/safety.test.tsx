import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FlightEntry } from '../src/types'

vi.mock('../src/lib/extractText', () => ({
  extractText: vi.fn(), isCsvFile: () => true, isHeicFile: () => false, isSupportedFile: () => true,
}))
import App from '../src/App'
import { ReviewPanel } from '../src/components/ReviewPanel'
import { FileDropzone } from '../src/components/FileDropzone'

const KEY = 'pilot-logbook.parsed.v1'
const entry: FlightEntry = {
  date: '2025/03/02', aircraft: 'A380', tail: '7611', flightNo: '901',
  from: 'ICN', to: 'CDG', irr: '', reportOut: '', reportIn: '',
  dutyMin: 800, flightMin: 700, nightMin: 300, instrumentMin: 30,
  takeoff: true, landing: false,
}
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify({ pilot: { name: 'Test pilot' }, summary: { totalFlightMin: 60000, asOf: '2025/03/02' }, flights: [entry] }))
})
afterEach(() => vi.restoreAllMocks())

describe('destructive actions and persistence', () => {
  it('asks before clearing a local logbook and honors cancellation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Clear' }))
    expect(confirm).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(KEY)!).flights).toHaveLength(1)
  })

  it('retains the career baseline and pilot after the last flight is deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Delete the 2025/ }))
    expect(JSON.parse(localStorage.getItem(KEY)!)).toMatchObject({ pilot: { name: 'Test pilot' }, summary: { totalFlightMin: 60000 }, flights: [] })
    expect(screen.getAllByText('1000:00').length).toBeGreaterThan(0)
  })

  it('warns when local storage fails while retaining the current record for export', async () => {
    render(<App />)
    await screen.findByText('901')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota full', 'QuotaExceededError') })
    await userEvent.click(screen.getByRole('button', { name: 'Edit baseline' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert').textContent).toMatch(/not saved.*device/i)
    expect(screen.getAllByRole('button', { name: 'Export CSV', exact: true }).length).toBeGreaterThan(0)
  })
})

describe('review and keyboard interactions', () => {
  it('keeps flights absent from a monthly CSV unless the user chooses to remove them', async () => {
    const onCommit = vi.fn()
    render(<ReviewPanel pending={{ sources: ['march.csv'], flights: [entry], replaceYears: ['2025'], pilot: {}, summary: {} }} existing={[entry, { ...entry, date: '2025/04/02', flightNo: '902' }]} onCommit={onCommit} onCancel={vi.fn()} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Import 1 flight' })[0])
    expect(onCommit.mock.calls[0][0].keptIds).toHaveLength(1)
  })

  it('prevents Space from scrolling when opening the file picker', () => {
    render(<FileDropzone onFiles={vi.fn()} busy={false} progress="" />)
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    fireEvent(screen.getByRole('button'), event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('disables the dropzone while flights are awaiting review', () => {
    const onFiles = vi.fn()
    render(<FileDropzone onFiles={onFiles} busy={false} disabled progress="" />)
    const dropzone = screen.getByRole('button')
    expect(dropzone.getAttribute('aria-disabled')).toBe('true')
    fireEvent.drop(dropzone, { dataTransfer: { files: [new File(['a'], 'a.csv')] } })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('shows the deletion count when an absent CSV flight is explicitly unchecked', async () => {
    const onCommit = vi.fn()
    render(<ReviewPanel pending={{ sources: ['march.csv'], flights: [entry], replaceYears: ['2025'], pilot: {}, summary: {} }} existing={[entry, { ...entry, date: '2025/04/02', flightNo: '902' }]} onCommit={onCommit} onCancel={vi.fn()} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /2025\/04\/02/ }))
    expect(screen.getAllByText(/1 existing flights will be deleted/).length).toBeGreaterThan(0)
    await userEvent.click(screen.getAllByRole('button', { name: 'Import 1 flight' })[0])
    expect(onCommit.mock.calls[0][0].keptIds).toEqual([])
  })

  it('filters across months and years without changing stored records or career totals', async () => {
    const book = { pilot: {}, summary: { totalFlightMin: 60000, asOf: '2025/12/31' }, flights: [
      entry, { ...entry, date: '2025/04/02', flightNo: '902', to: 'NRT' },
      { ...entry, date: '2024/12/02', flightNo: '903', to: 'NRT' },
    ] }
    localStorage.setItem(KEY, JSON.stringify(book))
    render(<App />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox', { name: 'Search flights' }), 'nrt')
    expect(screen.getByText('2 of 3 flights')).toBeTruthy()
    expect(screen.queryByText('901')).toBeNull()
    expect(screen.getByText('902')).toBeTruthy()
    expect(screen.getByText('903')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove year' })).toBeNull()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Year' }), '2025')
    expect(screen.getByText('1 of 3 flights')).toBeTruthy()
    expect(screen.queryByText('903')).toBeNull()
    expect(screen.getAllByText('1000:00').length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(book)
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(screen.getByText('3 of 3 flights')).toBeTruthy()
  })
})
