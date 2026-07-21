import type { ParsedLogbook } from '../types'

const STORAGE_KEY = 'pilot-logbook.parsed.v1'
const UPDATED_KEY = 'pilot-logbook.updatedAt.v1'

/** Millisecond timestamp of the last local modification (0 when unknown). */
export function loadLogbookUpdatedAt(): number {
  try {
    const raw = localStorage.getItem(UPDATED_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function touch(): void {
  try {
    localStorage.setItem(UPDATED_KEY, String(Date.now()))
  } catch {
    // best-effort
  }
}

export function loadLogbook(): ParsedLogbook | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ParsedLogbook
  } catch {
    return null
  }
}

export function saveLogbook(data: ParsedLogbook): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    touch()
  } catch {
    // Ignore quota / privacy-mode errors — persistence is best-effort.
  }
}

export function clearLogbook(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    touch() // a deletion is also a modification \u2014 keeps sync ordering honest
  } catch {
    // no-op
  }
}
