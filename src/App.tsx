import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { FlightEntry, ParsedLogbook } from './types'
import { extractText, isCsvFile, isHeicFile, isSupportedFile } from './lib/extractText'
import { parseLogbook } from './lib/parseLogbook'
import { groupByMonth, groupByYear } from './lib/aggregate'
import { clearLogbook, loadLogbook, saveLogbook } from './lib/storage'
import { csvToFlights, downloadCsv, flightsToCsv } from './lib/csv'
import { isCloudConfigured } from './lib/firebase'
import {
  clearCloudLogbook,
  saveCloudLogbook,
  signInWithGoogle,
  signOut,
  watchAuth,
  watchCloudLogbook,
  type CloudUser,
} from './lib/cloud'
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

type SyncState = 'idle' | 'saving' | 'synced' | 'error'

const EMPTY_BOOK: ParsedLogbook = { pilot: {}, summary: {}, flights: [] }

function sameBook(a: ParsedLogbook | null, b: ParsedLogbook | null): boolean {
  return JSON.stringify(a ?? EMPTY_BOOK) === JSON.stringify(b ?? EMPTY_BOOK)
}

export default function App() {
  const [data, setData] = useState<ParsedLogbook | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  const cloudEnabled = isCloudConfigured()
  const [user, setUser] = useState<CloudUser | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const dataRef = useRef<ParsedLogbook | null>(null)
  dataRef.current = data

  useEffect(() => {
    setData(loadLogbook())
  }, [])

  useEffect(() => {
    if (!cloudEnabled) return
    return watchAuth((u) => {
      setUser(u)
      if (!u) setSyncState('idle')
    })
  }, [cloudEnabled])

  async function pushCloud(uid: string, book: ParsedLogbook | null): Promise<void> {
    try {
      setSyncState('saving')
      if (book && book.flights.length > 0) {
        await saveCloudLogbook(uid, book)
      } else {
        await clearCloudLogbook(uid)
      }
      setSyncState('synced')
    } catch {
      setSyncState('error')
    }
  }

  useEffect(() => {
    if (!user) return
    const uid = user.uid
    // The first snapshot after sign-in merges cloud data with whatever is on
    // this device (so nothing is lost), then pushes the union back up. Later
    // snapshots come from other devices and replace local state, so deletions
    // propagate instead of resurrecting.
    let firstSnapshot = true
    return watchCloudLogbook(uid, (remote) => {
      const local = dataRef.current
      if (firstSnapshot) {
        firstSnapshot = false
        const merged = remote ? mergeLogbooks(local, remote) : local
        if (merged) {
          setData({ ...merged })
          saveLogbook(merged)
        }
        if (!sameBook(merged, remote)) {
          void pushCloud(uid, merged)
        } else {
          setSyncState('synced')
        }
        return
      }
      if (sameBook(remote, local)) return
      if (remote && remote.flights.length > 0) {
        setData(remote)
        saveLogbook(remote)
      } else {
        setData(null)
        clearLogbook()
      }
      setSyncState('synced')
    })
  }, [user])

  /** Update state + localStorage, and mirror to the cloud when signed in. */
  function persist(next: ParsedLogbook | null): void {
    if (next && next.flights.length > 0) {
      setData(next)
      saveLogbook(next)
    } else {
      setData(null)
      clearLogbook()
    }
    if (user) void pushCloud(user.uid, next)
  }

  async function handleSignIn() {
    setError('')
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
    }
  }

  async function handleSignOut() {
    await signOut()
  }

  const months = useMemo(() => groupByMonth(data?.flights ?? []), [data])
  const years = useMemo(() => groupByYear(months), [months])

  async function handleFiles(files: File[]) {
    setError('')
    if (files.some(isHeicFile)) {
      setError(
        'iPhone HEIC photos are not supported yet. In the share sheet choose Options → Most Compatible to save as JPG, then upload that.',
      )
      return
    }
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
        persist({ ...merged })
        if (addedTotal === 0) {
          setError('No flight rows were recognized in that file. Try a clearer scan or a PDF.')
        }
      } else {
        setError(
          'No flight rows were recognized. Tip: AFLIS에서 PDF로 저장해 올리면 가장 정확합니다. 사진/캡처는 JPG·PNG로, 표가 꽉 차게 찍어 주세요 (iPhone HEIC 불가).',
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
    if (user) {
      const confirmed = window.confirm(
        'You are signed in, so this also clears the logbook stored in the cloud for all your devices. Continue?',
      )
      if (!confirmed) return
    }
    persist(null)
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
    persist(flights.length === 0 ? null : { ...data, flights })
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
        <div className="app__actions">
          {cloudEnabled &&
            (user ? (
              <div className="cloud">
                <span
                  className={`cloud__status cloud__status--${syncState}`}
                  title={
                    syncState === 'error'
                      ? 'Cloud save failed — changes are kept locally'
                      : undefined
                  }
                >
                  {syncState === 'saving' && 'Syncing…'}
                  {syncState === 'synced' && 'Synced'}
                  {syncState === 'error' && 'Sync error'}
                  {syncState === 'idle' && 'Connecting…'}
                </span>
                <span className="cloud__user" title={user.email ?? undefined}>
                  {user.displayName ?? user.email ?? 'Signed in'}
                </span>
                <button type="button" className="btn btn--ghost btn--small" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost" onClick={handleSignIn}>
                Sign in with Google
              </button>
            ))}
          {hasData && (
            <>
              <button type="button" className="btn btn--ghost" onClick={handleExport}>
                Export CSV
              </button>
              <button type="button" className="btn btn--ghost" onClick={handleClear}>
                Clear
              </button>
            </>
          )}
        </div>
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
              with per-month subtotals, and each year is summarized separately.{' '}
              {cloudEnabled
                ? 'Sign in with Google to sync your logbook across your phone, iPad, and computer.'
                : 'Everything stays in your browser.'}
            </p>
          </section>
        )}
      </main>

      <footer className="app__footer">
        {cloudEnabled
          ? 'PDFs are read as text, images via on-device OCR · Sign in to sync across devices'
          : 'Runs entirely in your browser · PDFs are read as text, images via on-device OCR'}
      </footer>
    </div>
  )
}
