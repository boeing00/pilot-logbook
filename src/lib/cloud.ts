import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore'
import type { FlightEntry, ParsedLogbook } from '../types'
import { getDb, getFirebaseAuth } from './firebase'
import { compact } from './summary'

export interface CloudUser {
  uid: string
  displayName: string | null
  email: string | null
}

/** Snapshot of the cloud logbook delivered to subscribers. */
export interface CloudSnapshot {
  data: ParsedLogbook | null
  /** Server-side updatedAt of the meta doc in ms (0 when unknown). */
  updatedAtMs: number
  /** True when the data came from the pre-sharding single-document format. */
  legacy: boolean
  /**
   * True when Firestore served this from its local cache without having
   * reached the server. Cached snapshots are not authoritative — treating one
   * as a real answer would let a stale copy overwrite newer local edits.
   */
  fromCache: boolean
}

function toCloudUser(user: User | null): CloudUser | null {
  if (!user) return null
  return { uid: user.uid, displayName: user.displayName, email: user.email }
}

export function watchAuth(cb: (user: CloudUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (user) => cb(toCloudUser(user)))
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
}

export async function signOut(): Promise<void> {
  await fbSignOut(getFirebaseAuth())
}

/*
 * Storage layout (sharded by year to stay far below Firestore's 1 MiB
 * per-document limit even for very long careers):
 *
 *   logbooks/{uid}              -> { pilot, summary, updatedAt }
 *   logbooks/{uid}/years/{YYYY} -> { flights: FlightEntry[] }
 *
 * The legacy layout stored everything (including `flights`) in the meta doc;
 * it is read transparently and rewritten in the new format on the next save.
 */
function metaRef(uid: string) {
  return doc(getDb(), 'logbooks', uid)
}

function yearsCol(uid: string) {
  return collection(getDb(), 'logbooks', uid, 'years')
}

function groupFlightsByYear(flights: FlightEntry[]): Map<string, FlightEntry[]> {
  const byYear = new Map<string, FlightEntry[]>()
  for (const f of flights) {
    const year = f.date.slice(0, 4)
    const bucket = byYear.get(year) ?? []
    bucket.push(f)
    byYear.set(year, bucket)
  }
  return byYear
}

function sortByDate(flights: FlightEntry[]): FlightEntry[] {
  return [...flights].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Persist the logbook: meta doc + one doc per year. Year docs that no longer
 * exist locally are deleted so removals propagate to other devices. A single
 * batch keeps the update atomic (batch limit 500 ops >> years in a career).
 */
export async function saveCloudLogbook(uid: string, data: ParsedLogbook): Promise<void> {
  const byYear = groupFlightsByYear(data.flights)
  const existing = await getDocs(yearsCol(uid))

  const batch = writeBatch(getDb())
  // set() without merge replaces the meta doc, which also drops the legacy
  // `flights` array on first save after migration.
  batch.set(metaRef(uid), {
    // compact() guards the write: a single undefined field anywhere in here
    // fails the whole batch, and the logbook silently stops syncing.
    pilot: compact(data.pilot),
    summary: compact(data.summary),
    updatedAt: serverTimestamp(),
  })
  for (const [year, flights] of byYear) {
    batch.set(doc(yearsCol(uid), year), { flights })
  }
  for (const d of existing.docs) {
    if (!byYear.has(d.id)) batch.delete(d.ref)
  }
  await batch.commit()
}

export async function clearCloudLogbook(uid: string): Promise<void> {
  const existing = await getDocs(yearsCol(uid))
  const batch = writeBatch(getDb())
  batch.set(metaRef(uid), { pilot: {}, summary: {}, updatedAt: serverTimestamp() })
  for (const d of existing.docs) batch.delete(d.ref)
  await batch.commit()
}

interface MetaState {
  exists: boolean
  pilot: ParsedLogbook['pilot']
  summary: ParsedLogbook['summary']
  updatedAtMs: number
  legacyFlights?: FlightEntry[]
}

/**
 * Subscribe to the user's cloud logbook (meta doc + years collection).
 * Emits only after both listeners have delivered their initial snapshot, and
 * skips snapshots caused by this client's own pending writes so local saves
 * don't echo back into state.
 *
 * `onError` matters: a Firestore listener that fails — rules not deployed, no
 * database created, a blocked connection — reports it here and nowhere else.
 * Without it the subscription dies quietly and the UI waits forever.
 */
export function watchCloudLogbook(
  uid: string,
  cb: (snapshot: CloudSnapshot) => void,
  onError?: (error: FirestoreError) => void,
): () => void {
  let meta: MetaState | null = null
  let years: Map<string, FlightEntry[]> | null = null
  let metaFromCache = true
  let yearsFromCache = true

  const emit = () => {
    if (meta === null || years === null) return
    const hasYearDocs = years.size > 0
    const fromCache = metaFromCache || yearsFromCache
    if (!meta.exists && !hasYearDocs) {
      cb({ data: null, updatedAtMs: 0, legacy: false, fromCache })
      return
    }
    const legacy = !hasYearDocs && Array.isArray(meta.legacyFlights)
    const flights = legacy
      ? sortByDate(meta.legacyFlights ?? [])
      : sortByDate([...years.values()].flat())
    cb({
      data: { pilot: meta.pilot, summary: meta.summary, flights },
      updatedAtMs: meta.updatedAtMs,
      legacy,
      fromCache,
    })
  }

  // Cached snapshots are still emitted, flagged rather than dropped: silently
  // discarding them is what left the status stuck on "Connecting…" whenever the
  // server could not be reached.
  const unsubMeta = onSnapshot(metaRef(uid), {
    next: (snap) => {
      if (snap.metadata.hasPendingWrites) return
      metaFromCache = snap.metadata.fromCache
      const raw = snap.exists() ? snap.data() : {}
      meta = {
        exists: snap.exists(),
        pilot: raw.pilot ?? {},
        summary: raw.summary ?? {},
        updatedAtMs:
          typeof raw.updatedAt?.toMillis === 'function' ? raw.updatedAt.toMillis() : 0,
        legacyFlights: Array.isArray(raw.flights) ? raw.flights : undefined,
      }
      emit()
    },
    error: (err) => onError?.(err),
  })

  const unsubYears = onSnapshot(yearsCol(uid), {
    next: (snap) => {
      if (snap.metadata.hasPendingWrites) return
      yearsFromCache = snap.metadata.fromCache
      const next = new Map<string, FlightEntry[]>()
      for (const d of snap.docs) {
        const flights = d.data().flights
        if (Array.isArray(flights)) next.set(d.id, flights)
      }
      years = next
      emit()
    },
    error: (err) => onError?.(err),
  })

  return () => {
    unsubMeta()
    unsubYears()
  }
}
