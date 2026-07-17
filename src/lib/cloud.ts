import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import type { ParsedLogbook } from '../types'
import { getDb, getFirebaseAuth } from './firebase'

export interface CloudUser {
  uid: string
  displayName: string | null
  email: string | null
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

function logbookRef(uid: string) {
  return doc(getDb(), 'logbooks', uid)
}

/**
 * Persist the whole logbook as a single per-user document. A typical flight
 * entry is ~150 bytes of JSON, so even decades of flying fit comfortably
 * within Firestore's 1 MiB document limit.
 */
export async function saveCloudLogbook(uid: string, data: ParsedLogbook): Promise<void> {
  await setDoc(logbookRef(uid), {
    pilot: data.pilot,
    summary: data.summary,
    flights: data.flights,
    updatedAt: serverTimestamp(),
  })
}

export async function clearCloudLogbook(uid: string): Promise<void> {
  await setDoc(logbookRef(uid), {
    pilot: {},
    summary: {},
    flights: [],
    updatedAt: serverTimestamp(),
  })
}

/**
 * Subscribe to the user's cloud logbook. Emits null when no document exists
 * yet. Snapshots caused by this client's own pending writes are skipped so
 * local saves don't echo back into state.
 */
export function watchCloudLogbook(
  uid: string,
  cb: (data: ParsedLogbook | null) => void,
): () => void {
  return onSnapshot(logbookRef(uid), (snap) => {
    if (snap.metadata.hasPendingWrites) return
    if (!snap.exists()) {
      cb(null)
      return
    }
    const raw = snap.data()
    cb({
      pilot: raw.pilot ?? {},
      summary: raw.summary ?? {},
      flights: Array.isArray(raw.flights) ? raw.flights : [],
    })
  })
}
