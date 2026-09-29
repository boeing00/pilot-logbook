import { expect, it } from 'vitest'
import { buildFlight, emptyDraft } from '../src/lib/flightDraft'
import { loadLogbookUpdatedAt, saveLogbook } from '../src/lib/storage'

it('does not turn a downloaded cloud snapshot into a newer local edit', () => {
  saveLogbook({ pilot: {}, summary: {}, flights: [] }, 123456789)
  expect(loadLogbookUpdatedAt()).toBe(123456789)
})

it('rejects impossible manual dates and accepts a leap day', () => {
  expect(buildFlight(emptyDraft({ date: '2025-02-29' }))).toBe('Enter a real calendar date.')
  expect(buildFlight(emptyDraft({ date: '2024-02-29' }))).toMatchObject({ date: '2024/02/29' })
})
