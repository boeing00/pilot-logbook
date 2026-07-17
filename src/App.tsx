import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { FlightEntry, ParsedLogbook } from './types'
import { extractText, isCsvFile, isSupportedFile } from './lib/extractText'
import { parseLogbook } from './lib/parseLogbook'
import { groupByMonth, groupByYear } from './lib/aggregate'
import { clearLogbook, loadLogbook, saveLogbook } from './lib/storage'
import { csvToFlights, downloadCsv, flightsToCsv } from './lib/csv'
import { FileDropzone } from './components/FileDropzone'
import { SummaryCard } from './components/SummaryCard'
import { CategorySummary } from './components/CategorySummary'
import { YearSummary } from './components/YearSummary'
import { MonthSection } from './components/MonthSection'

/**
 * Identity for de-duplication when merging sources. Report times are excluded
 * because CSV exports no longer carry them, so an imported CSV row must match
 * the same sector parsed from a PDF/photo.
 */
function flightId(f: FlightEntry): string {
  return `${f.date}|${f.flightNo}|${f.from}|${f.to}`
}

function mergeLogbooks(prev: ParsedLogbook | null, next: ParsedLogbook): ParsedLogbook {
  if (!prev) return next
  const byId = new Map<string, FlightEntry>()
  for (const f of prev.flights) byId.set(flightId(f), f)
  for (const f of next.flights) {
    const existing = byId.get(flightId(f))
    // Keep fields the newer source is missing (e.g. CSV imports have no report times).
    byId.set(
      flightId(f),
      existing
        ? {
            ...f,
            reportOut: f.reportOut || existing.reportOut,
            reportIn: f.reportIn || existing.reportIn,
            tail: f.tail || existing.tail,
            irr: f.irr || existing.irr,
          }
        : f,
    )
  }
  const flights = [...byId.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )
  return {
    pilot: { ...prev.pilot, ...next.pilot },
    summary: { ...prev.summary, ...next.summary },
    flights,
  }
}

export default function App() {
  const [data, setData] = useState<ParsedLogbook | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setData(loadLogbook())
  }, [])

  const months = useMemo(() => groupByMonth(data?.flights ?? []), [data])
  const years = useMemo(() => groupByYear(months), [months])

  async function handleFiles(files: File[]) {
    setError('')
    const supported = files.filter(isSupportedFile)
    if (supported.length === 0) {
      setError('Unsupported file. Please upload a PDF, JPG, PNG, or an exported CSV.')
      return
    }

    setBusy(true)
    try {
      let merged = data
      let addedTotal = 0
      for (const file of supported) {
        setProgress(`Reading ${file.name}…`)
        let parsed: ParsedLogbook
        if (isCsvFile(file)) {
          const flights = csvToFlights(await file.text())
          parsed = { pilot: {}, summary: {}, flights }
        } else {
          const text = await extractText(file, (message, ratio) => {
            setProgress(
              ratio != null ? `${file.name}: ${message} ${Math.round(ratio * 100)}%` : message,
            )
          })
          parsed = parseLogbook(text)
        }
        addedTotal += parsed.flights.length
        merged = mergeLogbooks(merged, parsed)
      }
      if (merged && merged.flights.length > 0) {
        setData({ ...merged })
        saveLogbook(merged)
        if (addedTotal === 0) {
          setError('No flight rows were recognized in that file. Try a clearer scan or a PDF.')
        }
      } else {
        setError(
          'No flight rows were recognized. For photos, use a sharp, well-lit, straight-on image.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function handleClear() {
    setData(null)
    clearLogbook()
    setError('')
  }

  function handleExport() {
    if (!data) return
    downloadCsv('pilot-logbook.csv', flightsToCsv(data.flights))
  }

  function handleExportYear(year: string) {
    if (!data) return
    const flights = data.flights.filter((f) => f.date.startsWith(`${year}/`))
    if (flights.length === 0) return
    downloadCsv(`pilot-logbook-${year}.csv`, flightsToCsv(flights))
  }

  function handleRemoveYear(year: string) {
    if (!data) return
    const confirmed = window.confirm(
      `Remove all ${year} flights from the browser?\n` +
        `Export the ${year} CSV first if you want to keep an archive — you can re-import it anytime.`,
    )
    if (!confirmed) return
    const flights = data.flights.filter((f) => !f.date.startsWith(`${year}/`))
    if (flights.length === 0) {
      setData(null)
      clearLogbook()
    } else {
      const next = { ...data, flights }
      setData(next)
      saveLogbook(next)
    }
  }

  const hasData = Boolean(data && data.flights.length > 0)

  return (
    <div className="app">
      <header className="app__header">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            &#9992;
          </span>
          <div>
            <h1 className="brand__title">Pilot Logbook</h1>
            <p className="brand__tag">
              Turn a photo, JPG, or PDF of your flight log into monthly & yearly totals
            </p>
          </div>
        </div>
        {hasData && (
          <div className="app__actions">
            <button type="button" className="btn btn--ghost" onClick={handleExport}>
              Export CSV
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleClear}>
              Clear
            </button>
          </div>
        )}
      </header>

      <main className="app__main">
        <FileDropzone onFiles={handleFiles} busy={busy} progress={progress} />

        {error && <p className="alert">{error}</p>}

        {hasData && data && (
          <>
            <SummaryCard pilot={data.pilot} summary={data.summary} />

            <CategorySummary flights={data.flights} />

            {years.map((year) => (
              <div className="year-block" key={year.year}>
                <YearSummary
                  year={year}
                  onExportYear={handleExportYear}
                  onRemoveYear={handleRemoveYear}
                />
                <div className="month-list">
                  {year.months.map((m, idx) => (
                    <MonthSection key={m.key} group={m} defaultOpen={idx === 0} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {!hasData && !busy && (
          <section className="empty">
            <h2 className="empty__title">No logbook loaded yet</h2>
            <p className="empty__text">
              Upload a scan or photo of your flight log above. Flights are grouped by month
              with per-month subtotals, and each year is summarized separately. Everything
              stays in your browser.
            </p>
          </section>
        )}
      </main>

      <footer className="app__footer">
        Runs entirely in your browser · PDFs are read as text, images via on-device OCR
      </footer>
    </div>
  )
}
