import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

/**
 * Firebase is optional: the app works local-only when no config is provided.
 * Set the VITE_FIREBASE_* variables (see .env.example) to enable cloud sync.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

const useEmulator = import.meta.env.VITE_FIREBASE_USE_EMULATOR === 'true'

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null

export function isCloudConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId)
}

function ensureApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(config)
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(ensureApp())
    if (useEmulator) {
      connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true })
    }
  }
  return authInstance
}

export function getDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(ensureApp())
    if (useEmulator) {
      connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080)
    }
  }
  return dbInstance
}
