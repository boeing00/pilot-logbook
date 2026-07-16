import { useState } from 'react'
import { FlightForm } from './components/FlightForm'
import { FlightList } from './components/FlightList'
import { TotalsBar } from './components/TotalsBar'
import { useFlights } from './hooks/useFlights'
import { computeTotals, exportCsv } from './lib/storage'
import type { FlightDraft, FlightEntry } from './types'
import './App.css'

function App() {
  const { entries, addFlight, updateFlight, deleteFlight } = useFlights()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FlightEntry | null>(null)
  const [query, setQuery] = useState('')

  const totals = computeTotals(entries)

  function openNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(entry: FlightEntry) {
    setEditing(entry)
    setFormOpen(true)
  }

  function handleSubmit(draft: FlightDraft) {
    if (editing) {
      updateFlight(editing.id, draft)
    } else {
      addFlight(draft)
    }
  }

  function handleExport() {
    const csv = exportCsv(entries)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pilot-logbook-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <div className="sky" aria-hidden="true" />
      <div className="horizon" aria-hidden="true" />

      <header className="masthead">
        <div className="masthead__brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand">Pilot Logbook</p>
            <p className="tagline">Flight hours, routes, and landings — kept on the flight deck.</p>
          </div>
        </div>
        <div className="masthead__actions">
          <button type="button" className="btn btn--primary" onClick={openNew}>
            Log Flight
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>

      <main className="main">
        <TotalsBar totals={totals} />

        <section className="log" aria-labelledby="log-heading">
          <div className="log__toolbar">
            <h1 id="log-heading" className="log__title">
              Flight Log
            </h1>
            <label className="search">
              <span className="sr-only">Search flights</span>
              <input
                type="search"
                placeholder="Search airport, aircraft, remarks…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          <FlightList
            entries={entries}
            query={query}
            onEdit={openEdit}
            onDelete={deleteFlight}
          />
        </section>
      </main>

      <FlightForm
        open={formOpen}
        initial={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

export default App
