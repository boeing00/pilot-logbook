import type { ParsedLogbook } from '../types'

const STORAGE_KEY = 'pilot-logbook.parsed.v1'

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
  } catch {
    // Ignore quota / privacy-mode errors — persistence is best-effort.
  }
}

export function clearLogbook(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // no-op
  }
}
