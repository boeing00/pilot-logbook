import { useEffect, useState } from 'react'
import type { FlightDraft, FlightEntry } from '../types'
import {
  createId,
  loadEntries,
  saveEntries,
} from '../lib/storage'

export function useFlights() {
  const [entries, setEntries] = useState<FlightEntry[]>(() => loadEntries())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    saveEntries(entries)
  }, [entries, ready])

  function addFlight(draft: FlightDraft) {
    const entry: FlightEntry = { ...draft, id: createId() }
    setEntries((prev) =>
      [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date)),
    )
  }

  function updateFlight(id: string, draft: FlightDraft) {
    setEntries((prev) =>
      prev
        .map((e) => (e.id === id ? { ...draft, id } : e))
        .sort((a, b) => b.date.localeCompare(a.date)),
    )
  }

  function deleteFlight(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return {
    entries,
    addFlight,
    updateFlight,
    deleteFlight,
  }
}
