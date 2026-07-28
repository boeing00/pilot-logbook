/**
 * Parse an "H:MM" / "HH:MM" duration (hours can exceed 24, minutes may be
 * unpadded like "0:0") into total minutes. Returns 0 for empty/invalid input.
 */
export function parseDurationToMinutes(value: string | undefined | null): number {
  if (!value) return 0
  const match = value.trim().match(/^(\d+):(\d{1,2})$/)
  if (!match) return 0
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

/**
 * Parse a duration typed by hand in the manual-entry form. Accepts the
 * logbook's own "H:MM" form plus the shapes a pilot is likely to type on a
 * phone keypad: decimal hours ("9.5", "9,5") and whole hours ("2").
 * Empty input means zero; returns null when the text can't be understood so
 * the form can point at the offending field instead of silently logging 0:00.
 */
export function parseDurationInput(value: string): number | null {
  const s = value.trim().replace(',', '.')
  if (s === '') return 0
  const hm = s.match(/^(\d{1,5}):([0-5]?\d)$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const dec = s.match(/^(\d{1,5}(?:\.\d{1,2})?)\s*h?$/i)
  if (dec) return Math.round(Number(dec[1]) * 60)
  return null
}

/** Format total minutes back into "H:MM" (hours may exceed 24). */
export function formatMinutes(total: number): string {
  const safe = Math.max(0, Math.round(total))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/** Format total minutes as a decimal-hours string, e.g. 9.8h. */
export function formatDecimalHours(total: number): string {
  return `${(total / 60).toFixed(1)}h`
}
