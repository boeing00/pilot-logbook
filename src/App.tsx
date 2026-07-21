import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { FlightEntry, ParsedLogbook } from './types'
import { extractText, isCsvFile, isHeicFile, isSupportedFile } from './lib/extractText'
import { parseLogbook } from './lib/parseLogbook'
import { groupByMonth, groupByYear } from './lib/aggregate'
import { clearLogbook, loadLogbook, loadLogbookUpdatedAt, saveLogbook } from './lib/storage'
import { csvToFlights, downloadCsv, flightsToCsv } from './lib/csv'
import { inferHomeBase } from './lib/stats'
import { flightId } from './lib/flightId'
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

function mergeLogbooks(prev: ParsedLogbook | null, next: ParsedLogbook): ParsedLogbook {
  if (!prev) return next
  const byId = new Map<string, FlightEntry>()
  for (const f of prev.flights) byId.set(flightId(f), f)
  for (const f of next.flights) {
    const existing = byId.get(flightId(f))
    // Existing data wins; the new source only fills gaps. A re-uploaded blurry
    // photo must never overwrite good values from an earlier PDF with a worse
    // OCR pass. To intentionally change values, edit and re-import the CSV
    // (that path replaces data instead of merging).
    byId.set(
      flightId(f),
      existing
        ? {
            ...existing,
            tail: existing.tail || f.tail,
            irr: existing.irr || f.irr,
            reportOut: existing.reportOut || f.reportOut,
            reportIn: existing.reportIn || f.reportIn,
            dutyMin: existing.dutyMin || f.dutyMin,
            flightMin: existing.flightMin || f.flightMin,
            nightMin: existing.nightMin || f.nightMin,
            instrumentMin: existing.instrumentMin || f.instrumentMin,
            takeoff: existing.takeoff || f.takeoff,
            landing: existing.landing || f.landing,
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

/**
 * Apply an edited/exported CSV back onto the logbook. The CSV is treated as
 * authoritative for every year it contains: existing flights in those years
 * are replaced by the CSV rows, so edits AND deletions made in the CSV
 * propagate into the log. Years not present in the CSV are left untouched.
 */
function applyCsvImport(
  prev: ParsedLogbook | null,
  imported: FlightEntry[],
): { book: ParsedLogbook; removed: number; kept: number } {
  const years = new Set(imported.map((f) => f.date.slice(0, 4)))
  const outside = (prev?.flights ?? []).filter((f) => !years.has(f.date.slice(0, 4)))
  const inside = (prev?.flights ?? []).filter((f) => years.has(f.date.slice(0, 4)))

  // De-duplicate rows inside the CSV itself (last occurrence wins).
  const byId = new Map<string, FlightEntry>()
  for (const f of imported) byId.set(flightId(f), f)

  const removed = inside.filter((f) => !byId.has(flightId(f))).length
  const flights = [...outside, ...byId.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )
  return {
    book: { pilot: prev?.pilot ?? {}, summary: prev?.summary ?? {}, flights },
    removed,
    kept: outside.length,
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
    // First snapshot after sign-in: compare the cloud's updatedAt with the
    // local modification time. If the cloud is as new or newer, adopt it so
    // deletions performed on other devices propagate instead of being
    // resurrected by stale localStorage. Only when the local copy is strictly
    // newer (offline edits) is it merged and pushed back up. Later snapshots
    // come from other devices and replace local state.
    let firstSnapshot = true
    return watchCloudLogbook(uid, ({ data: remote, updatedAtMs, legacy }) => {
      const local = dataRef.current
      if (firstSnapshot) {
        firstSnapshot = false
        if (!remote) {
          if (local) {
            void pushCloud(uid, local)
          } else {
            setSyncState('synced')
          }
          return
        }
        const localAt = loadLogbookUpdatedAt()
        if (!local || updatedAtMs >= localAt) {
          if (remote.flights.length > 0) {
            setData(remote)
            saveLogbook(remote)
          } else {
            setData(null)
            clearLogbook()
          }
          // Rewrite legacy single-document cloud data in the sharded format.
          if (legacy) {
            void pushCloud(uid, remote.flights.length > 0 ? remote : null)
          } else {
            setSyncState('synced')
          }
        } else {
          const merged = mergeLogbooks(local, remote)
          setData({ ...merged })
          saveLogbook(merged)
          if (legacy || !sameBook(merged, remote)) {
            void pushCloud(uid, merged)
          } else {
            setSyncState('synced')
          }
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
  const homeBase = useMemo(() => inferHomeBase(data?.flights ?? []), [data])

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
        if (isCsvFile(file)) {
          // A CSV is an edited export: replace the years it covers so that
          // edits and deletions made in the CSV are mirrored into the log.
          const flights = csvToFlights(await file.text())
          if (flights.length === 0) continue
          const { book, removed } = applyCsvImport(merged, flights)
          if (removed > 0) {
            const ok = window.confirm(
              `${file.name}: this CSV is missing ${removed} flight(s) that currently exist ` +
                `in the covered year(s). Import will remove them from the log ` +
                `(edits in the CSV are applied either way). Continue?`,
            )
            if (!ok) continue
          }
          addedTotal += flights.length
          merged = book
        } else {
          const text = await extractText(file, (message, ratio) => {
            setProgress(
              ratio != null ? `${file.name}: ${message} ${Math.round(ratio * 100)}%` : message,
            )
          })
          const parsed = parseLogbook(text)
          addedTotal += parsed.flights.length
          merged = mergeLogbooks(merged, parsed)
        }
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
    const cloudNote = user
      ? `\nYou are signed in, so this also removes ${year} from the cloud and all your devices.`
      : ''
    const confirmed = window.confirm(
      `Remove all ${year} flights from the browser?${cloudNote}\n` +
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
                  base={homeBase}
                  onExportYear={handleExportYear}
                  onRemoveYear={handleRemoveYear}
                />
                <div className="month-list">
                  {year.months.map((m, idx) => (
                    <MonthSection key={m.key} group={m} base={homeBase} defaultOpen={idx === 0} />
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
