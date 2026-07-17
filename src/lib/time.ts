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
