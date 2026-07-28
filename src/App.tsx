import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { FlightEntry, MonthGroup, ParsedLogbook } from './types'
import { extractText, isCsvFile, isHeicFile, isSupportedFile } from './lib/extractText'
import { parseLogbook } from './lib/parseLogbook'
import { groupByMonth, groupByYear } from './lib/aggregate'
import { clearLogbook, loadLogbook, loadLogbookUpdatedAt, saveLogbook } from './lib/storage'
import { csvToFlights, downloadCsv, flightsToCsv } from './lib/csv'
import { inferHomeBase } from './lib/stats'
import { compact, mergeSummary } from './lib/summary'
import { formatMinutes } from './lib/time'
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
import { FlightForm } from './components/FlightForm'
import type { DraftSeed } from './lib/flightDraft'
import { ReviewPanel, type PendingImport, type ReviewResult } from './components/ReviewPanel'

/**
 * Existing data wins; the incoming record only fills gaps. A re-uploaded blurry
 * photo must never overwrite good values from an earlier PDF with a worse OCR
 * pass. Values are only replaced when the pilot says so — by editing the row in
 * the import review, or by re-importing an edited CSV.
 */
function fillGaps(existing: FlightEntry, next: FlightEntry): FlightEntry {
  return {
    ...existing,
    tail: existing.tail || next.tail,
    irr: existing.irr || next.irr,
    reportOut: existing.reportOut || next.reportOut,
    reportIn: existing.reportIn || next.reportIn,
    dutyMin: existing.dutyMin || next.dutyMin,
    flightMin: existing.flightMin || next.flightMin,
    nightMin: existing.nightMin || next.nightMin,
    instrumentMin: existing.instrumentMin || next.instrumentMin,
    takeoff: existing.takeoff || next.takeoff,
    landing: existing.landing || next.landing,
  }
}

function mergeLogbooks(prev: ParsedLogbook | null, next: ParsedLogbook): ParsedLogbook {
  if (!prev) return next
  const byId = new Map<string, FlightEntry>()
  for (const f of prev.flights) byId.set(flightId(f), f)
  for (const f of next.flights) {
    const existing = byId.get(flightId(f))
    byId.set(flightId(f), existing ? fillGaps(existing, f) : f)
  }
  const flights = [...byId.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  )
  return {
    pilot: { ...prev.pilot, ...next.pilot },
    summary: mergeSummary(prev.summary, next.summary),
    flights,
  }
}

type SyncState = 'idle' | 'saving' | 'synced' | 'offline' | 'error'

const EMPTY_BOOK: ParsedLogbook = { pilot: {}, summary: {}, flights: [] }

function sameBook(a: ParsedLogbook | null, b: ParsedLogbook | null): boolean {
  return JSON.stringify(a ?? EMPTY_BOOK) === JSON.stringify(b ?? EMPTY_BOOK)
}

export default function App() {
  const [data, setData] = useState<ParsedLogbook | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  /** Prefill for the manual form, set when it is opened from a month card. */
  const [formSeed, setFormSeed] = useState<DraftSeed | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  /** Parsed rows waiting for the pilot to check them; nothing is stored yet. */
  const [pending, setPending] = useState<PendingImport | null>(null)

  const cloudEnabled = isCloudConfigured()
  const [user, setUser] = useState<CloudUser | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  /** Firestore's own message, so a failure says why instead of hanging. */
  const [syncError, setSyncError] = useState('')
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
      setSyncError('')
    } catch (err) {
      setSyncState('error')
      setSyncError(err instanceof Error ? err.message : 'Cloud save failed.')
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
    return watchCloudLogbook(
      uid,
      ({ data: remote, updatedAtMs, legacy, fromCache }) => {
      // A cached snapshot means the server has not answered yet. Acting on it
      // could overwrite good local data with a stale copy, so it only updates
      // the status line.
      if (fromCache) {
        setSyncState((prev) => (prev === 'saving' ? prev : 'offline'))
        return
      }
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
      setSyncError('')
      },
      (err) => {
        setSyncState('error')
        setSyncError(`${err.code}: ${err.message}`)
      },
    )
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
  /** Prefill the manual form with the airframe from the most recent sector. */
  const formDefaults = useMemo<DraftSeed>(() => {
    const last = data?.flights.at(-1)
    return { aircraft: last?.aircraft, tail: last?.tail }
  }, [data])

  /**
   * Open the manual form for a specific month. The date and airframe come from
   * the last sector already logged there, so adding a missed leg to an old
   * month does not mean re-typing everything or fixing today's date.
   */
  function openFormForMonth(group: MonthGroup) {
    const last = group.flights.at(-1)
    setFormSeed({
      date: last ? last.date.replaceAll('/', '-') : `${group.year}-${group.month}-01`,
      aircraft: last?.aircraft,
      tail: last?.tail,
    })
    setShowForm(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    })
  }

  const csvInputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: File[]) {
    setError('')
    if (pending) {
      setError('Finish or discard the flights waiting for review before uploading another file.')
      return
    }
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
      // Parsing only builds a proposal. Every row goes to the review panel and
      // the logbook is not touched until the pilot presses Import, so a bad OCR
      // pass can no longer quietly corrupt months of records.
      const candidates: FlightEntry[] = []
      const replaceYears = new Set<string>()
      const sources: string[] = []
      let pilot: ParsedLogbook['pilot'] = {}
      let summary: ParsedLogbook['summary'] = {}
      let csvParseFailed = false

      for (const file of supported) {
        setProgress(`Reading ${file.name}…`)
        if (isCsvFile(file)) {
          // A CSV is an edited export, so it stays authoritative for the years
          // it covers: rows missing from it are offered for deletion in the
          // review panel instead of being silently dropped.
          const flights = csvToFlights(await file.text())
          if (flights.length === 0) {
            csvParseFailed = true
            continue
          }
          for (const f of flights) replaceYears.add(f.date.slice(0, 4))
          candidates.push(...flights)
          sources.push(file.name)
        } else {
          const text = await extractText(file, (message, ratio) => {
            setProgress(
              ratio != null ? `${file.name}: ${message} ${Math.round(ratio * 100)}%` : message,
            )
          })
          const parsed = parseLogbook(text)
          candidates.push(...parsed.flights)
          pilot = { ...pilot, ...parsed.pilot }
          summary = { ...summary, ...parsed.summary }
          sources.push(file.name)
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
        setPending({
          sources,
          flights: candidates,
          replaceYears: [...replaceYears].sort(),
          pilot,
          summary,
        })
      } else if (csvParseFailed) {
        setError(
          'CSV에서 비행 기록을 찾지 못했습니다. Export CSV로 받은 파일을 그대로 편집했는지, 헤더 행을 지우지 않았는지, Date 열이 YYYY/MM/DD 형식인지 확인해 주세요.',
        )
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

  /**
   * Commit what the pilot approved in the review panel. Rows they edited are
   * taken as the truth and overwrite whatever is logged; rows they left alone
   * keep the old gap-filling behaviour. For a year-replacing CSV import, the
   * flights they did not tick to keep are dropped.
   */
  function commitReview(result: ReviewResult) {
    if (!pending) return
    const book = data ?? EMPTY_BOOK
    const replaced = new Set(pending.replaceYears)
    const keep = new Set(result.keptIds)

    const byId = new Map<string, FlightEntry>()
    for (const f of book.flights) {
      const id = flightId(f)
      if (replaced.has(f.date.slice(0, 4)) && !keep.has(id)) continue
      byId.set(id, f)
    }

    const edited = new Set(result.editedIds)
    for (const f of result.flights) {
      const id = flightId(f)
      const current = byId.get(id)
      byId.set(id, current && !edited.has(id) ? fillGaps(current, f) : f)
    }

    const flights = [...byId.values()].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    )
    persist({
      pilot: { ...book.pilot, ...pending.pilot },
      summary: mergeSummary(book.summary, pending.summary),
      flights,
    })
    setPending(null)
    setError('')
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

  /**
   * Log one hand-entered sector. A manual entry is an explicit statement by
   * the pilot, so unlike an OCR pass it overwrites any existing flight with
   * the same identity instead of only filling gaps — that makes the form
   * usable for correcting a badly-scanned row. Returns true when it replaced
   * one, so the form can say "Updated" rather than "Added".
   */
  function handleAddFlight(entry: FlightEntry): boolean {
    const book = data ?? EMPTY_BOOK
    const id = flightId(entry)
    const rest = book.flights.filter((f) => flightId(f) !== id)
    const replaced = rest.length !== book.flights.length
    const flights = [...rest, entry].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    )
    persist({ pilot: book.pilot, summary: book.summary, flights })
    setError('')
    return replaced
  }

  /**
   * Correct the career baseline by hand, for when the report's header was
   * misread or the pilot wants to anchor the total to a specific print-out.
   */
  function handleSetBaseline(totalFlightMin?: number, asOf?: string) {
    if (!data) return
    persist({ ...data, summary: compact({ ...data.summary, totalFlightMin, asOf }) })
  }

  /** "2025-03" (MonthGroup.key) → "2025/03/" date prefix. */
  function monthPrefix(key: string): string {
    return `${key.replace('-', '/')}/`
  }

  function handleExportMonth(key: string) {
    if (!data) return
    const flights = data.flights.filter((f) => f.date.startsWith(monthPrefix(key)))
    if (flights.length === 0) return
    downloadCsv(`pilot-logbook-${key}.csv`, flightsToCsv(flights))
  }

  /**
   * Delete one sector. The confirmation lives here rather than in the row so it
   * can name the flight and mention cloud sync; an in-row two-step was too easy
   * to mis-tap on a tablet, where "cancel" and "confirm" ended up pixels apart.
   */
  function handleRemoveFlight(flight: FlightEntry) {
    if (!data) return
    const id = flightId(flight)
    const flights = data.flights.filter((f) => flightId(f) !== id)
    if (flights.length === data.flights.length) return
    const route = flight.from && flight.to ? ` ${flight.from}→${flight.to}` : ''
    const cloudNote = user ? '\nThis also removes it from the cloud and your other devices.' : ''
    const confirmed = window.confirm(
      `Delete this flight?\n\n${flight.date}  ${flight.flightNo}${route}  ` +
        `${formatMinutes(flight.flightMin)} flight time${cloudNote}`,
    )
    if (!confirmed) return
    persist(flights.length === 0 ? null : { ...data, flights })
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
                  title={syncError || undefined}
                >
                  {syncState === 'saving' && 'Syncing…'}
                  {syncState === 'synced' && 'Synced'}
                  {syncState === 'error' && 'Sync error'}
                  {syncState === 'offline' && 'Offline — saved on this device'}
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
          <button
            type="button"
            className="btn btn--ghost"
            aria-expanded={showForm}
            title="Type in a single flight by hand"
            onClick={() => {
              setFormSeed(null)
              setShowForm((v) => !v)
            }}
          >
            {showForm ? 'Close form' : '+ Add flight'}
          </button>
          {hasData && (
            <>
              <button type="button" className="btn btn--ghost" onClick={handleExport}>
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => csvInputRef.current?.click()}
                title="Import an edited CSV \u2014 it overwrites the years it covers"
              >
                Import CSV
              </button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const files = e.target.files ? [...e.target.files] : []
                  e.target.value = ''
                  if (files.length > 0) void handleFiles(files)
                }}
              />
              <button type="button" className="btn btn--ghost" onClick={handleClear}>
                Clear
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app__main">
        <FileDropzone onFiles={handleFiles} busy={busy} progress={progress} />

        {pending && (
          <ReviewPanel
            pending={pending}
            existing={data?.flights ?? []}
            onCommit={commitReview}
            onCancel={() => setPending(null)}
          />
        )}

        {showForm && (
          <div ref={formRef}>
            <FlightForm
              // Remounts when opened from a different month so the prefill
              // takes effect instead of keeping the previous draft.
              key={formSeed?.date ?? 'default'}
              onAdd={handleAddFlight}
              onClose={() => {
                setShowForm(false)
                setFormSeed(null)
              }}
              defaults={formSeed ?? formDefaults}
            />
          </div>
        )}

        {error && <p className="alert">{error}</p>}

        {cloudEnabled && user && syncState === 'error' && (
          <p className="alert">
            Cloud sync failed — your logbook is still saved on this device.
            <br />
            <span className="alert__detail">{syncError}</span>
          </p>
        )}

        {hasData && data && (
          <>
            <SummaryCard
              pilot={data.pilot}
              summary={data.summary}
              flights={data.flights}
              onSetBaseline={handleSetBaseline}
            />

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
                    <MonthSection
                      key={m.key}
                      group={m}
                      base={homeBase}
                      defaultOpen={idx === 0}
                      onExportMonth={handleExportMonth}
                      onRemoveFlight={handleRemoveFlight}
                      onAddFlight={openFormForMonth}
                    />
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
              Upload a scan or photo of your flight log above, or use{' '}
              <strong>+ Add flight</strong> to type a single sector in by hand. Flights are
              grouped by month with per-month subtotals, and each year is summarized
              separately.{' '}
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
