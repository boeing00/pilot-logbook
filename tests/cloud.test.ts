import { beforeEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({
  listeners: new Map<string, { options: { includeMetadataChanges?: boolean }, next: (value: unknown) => void }>(),
  flush: () => {},
}))
vi.mock('../src/lib/firebase', () => ({ getDb: () => ({}), getFirebaseAuth: () => ({}) }))
vi.mock('firebase/firestore', () => ({
  collection: () => 'years', doc: () => 'meta', getDocs: vi.fn(), serverTimestamp: vi.fn(), writeBatch: vi.fn(),
  onSnapshot: (ref: string, options: { includeMetadataChanges?: boolean }, observer: { next: (value: unknown) => void }) => {
    transport.listeners.set(ref, { options, next: observer.next })
    return () => transport.listeners.delete(ref)
  },
  onSnapshotsInSync: (_db: unknown, callback: () => void) => {
    transport.flush = callback
    return () => { transport.flush = () => {} }
  },
}))
import { watchCloudLogbook } from '../src/lib/cloud'

function emit(ref: string, fromCache: boolean, value: unknown, metadataOnly = false) {
  const listener = transport.listeners.get(ref)!
  // Firestore suppresses metadata-only transitions unless explicitly requested.
  if (metadataOnly && !listener.options.includeMetadataChanges) return
  const metadata = { fromCache, hasPendingWrites: false }
  listener.next(ref === 'meta'
    ? { metadata, exists: () => true, data: () => value }
    : { metadata, docs: [{ id: '2025', data: () => ({ flights: value }) }] })
}
beforeEach(() => transport.listeners.clear())

describe('cloud snapshot delivery', () => {
  it('leaves offline state when identical cached data is confirmed by the server', () => {
    const receive = vi.fn()
    const stop = watchCloudLogbook('test', receive)
    emit('meta', true, { pilot: {}, summary: {} })
    emit('years', true, [])
    transport.flush()
    expect(receive.mock.lastCall?.[0].fromCache).toBe(true)
    emit('meta', false, { pilot: {}, summary: {} }, true)
    emit('years', false, [], true)
    transport.flush()
    expect(receive.mock.lastCall?.[0].fromCache).toBe(false)
    stop()
    expect(transport.listeners.size).toBe(0)
  })

  it('delivers a batch only after the metadata and year listeners both update', () => {
    const receive = vi.fn()
    const stop = watchCloudLogbook('test', receive)
    emit('meta', false, { pilot: { name: 'Old' } })
    emit('years', false, [{ date: '2025/03/02' }])
    transport.flush()
    receive.mockClear()
    emit('meta', false, { pilot: { name: 'New' } })
    expect(receive).not.toHaveBeenCalled()
    emit('years', false, [])
    transport.flush()
    expect(receive).toHaveBeenCalledTimes(1)
    expect(receive.mock.lastCall?.[0].data).toMatchObject({ pilot: { name: 'New' }, flights: [] })
    stop()
  })
})
