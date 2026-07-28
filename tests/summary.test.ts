import { describe, expect, it } from 'vitest'
import { compact, mergeSummary } from '../src/lib/summary'
import type { LogbookSummary } from '../src/types'

/** Firestore rejects undefined, so this is the property that actually matters. */
function hasUndefined(o: object): boolean {
  return Object.values(o).some((v) => v === undefined)
}

describe('mergeSummary', () => {
  it('never emits undefined field values', () => {
    expect(hasUndefined(mergeSummary({}, {}))).toBe(false)
    expect(hasUndefined(mergeSummary({ totalFlightMin: 100 }, {}))).toBe(false)
    expect(hasUndefined(mergeSummary({}, { nightFlightMin: 5 }))).toBe(false)
    expect(Object.keys(mergeSummary({}, {}))).toEqual([])
  })

  it('keeps the larger figure so an older report cannot lower the baseline', () => {
    const july: LogbookSummary = {
      totalFlightMin: 13206 * 60,
      nightFlightMin: 4502 * 60,
      asOf: '2026/07/26',
    }
    const stale: LogbookSummary = { totalFlightMin: 154, nightFlightMin: 10, asOf: '2020/01/01' }

    expect(mergeSummary(july, stale).totalFlightMin).toBe(13206 * 60)
    expect(mergeSummary(stale, july).totalFlightMin).toBe(13206 * 60)
    // the as-of date follows the winning total, in both orders
    expect(mergeSummary(july, stale).asOf).toBe('2026/07/26')
    expect(mergeSummary(stale, july).asOf).toBe('2026/07/26')
  })

  it('takes the newest month figures, which are not cumulative', () => {
    const merged = mergeSummary({ monthFlightMin: 900 }, { monthFlightMin: 120 })
    expect(merged.monthFlightMin).toBe(120)
  })
})

describe('compact', () => {
  it('drops undefined keys and keeps falsy values', () => {
    const out = compact({ a: 1, b: undefined, c: 0, d: '', e: false })
    expect('b' in out).toBe(false)
    expect(out).toEqual({ a: 1, c: 0, d: '', e: false })
  })
})
