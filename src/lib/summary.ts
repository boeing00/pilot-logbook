import type { LogbookSummary } from '../types'

/**
 * Drop keys whose value is undefined.
 *
 * Firestore rejects `undefined` outright — `WriteBatch.set() called with
 * invalid data` — so any object built by naming every field up front has to be
 * compacted before it is stored. An absent key means "not reported"; a key
 * holding undefined means a failed write.
 */
export function compact<T extends object>(value: T): T {
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) out[key] = v
  }
  return out as T
}

/**
 * Career figures only ever grow, so the larger number is always the more
 * recent one. Keeping the maximum per field means a misread or re-uploaded
 * older report can never drag the baseline down, which is what turned a career
 * total into "2:34". The month figures are not cumulative, so those take the
 * newest value instead.
 */
export function mergeSummary(prev: LogbookSummary, next: LogbookSummary): LogbookSummary {
  const larger = (a?: number, b?: number) => Math.max(a ?? 0, b ?? 0) || undefined
  const nextIsNewer = (next.totalFlightMin ?? 0) >= (prev.totalFlightMin ?? 0)
  return compact({
    totalFlightMin: larger(prev.totalFlightMin, next.totalFlightMin),
    typeFlightMin: larger(prev.typeFlightMin, next.typeFlightMin),
    typeCaptainMin: larger(prev.typeCaptainMin, next.typeCaptainMin),
    captainFlightMin: larger(prev.captainFlightMin, next.captainFlightMin),
    nightFlightMin: larger(prev.nightFlightMin, next.nightFlightMin),
    instrumentFlightMin: larger(prev.instrumentFlightMin, next.instrumentFlightMin),
    monthFlightMin: next.monthFlightMin ?? prev.monthFlightMin,
    monthDeadheadMin: next.monthDeadheadMin ?? prev.monthDeadheadMin,
    typeFlightLabel: next.typeFlightLabel ?? prev.typeFlightLabel,
    typeCaptainLabel: next.typeCaptainLabel ?? prev.typeCaptainLabel,
    // The as-of date belongs to whichever report supplied the winning total.
    asOf: nextIsNewer ? (next.asOf ?? prev.asOf) : (prev.asOf ?? next.asOf),
  })
}
