/**
 * Browser adapter for {@link TilesetProjectStore}: one record in IndexedDB.
 *
 * IndexedDB rather than `localStorage` (Q31): a sheet is hundreds of kilobytes
 * of raw RGBA, past what the string store holds, and the structured clone
 * keeps the `Uint8ClampedArray` as it stands — no base64 on the hot path.
 *
 * Where there is no IndexedDB — a private window, an old runtime, the test
 * environment — every call is a no-op and the workshop runs without a memory.
 */

import type { TilesetProjectStore } from '../ports'
import type { TilesetProject } from '../tileset-project'

const DB_NAME = 'pixsaur-tileset'
const DB_VERSION = 1
const STORE_NAME = 'project'
/** One document at a time: the workshop has a single open project. */
const RECORD_KEY = 'current'

function request<T>(from: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    from.onsuccess = () => resolve(from.result)
    from.onerror = () => reject(from.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  const opening = globalThis.indexedDB.open(DB_NAME, DB_VERSION)
  opening.onupgradeneeded = () => {
    if (!opening.result.objectStoreNames.contains(STORE_NAME)) {
      opening.result.createObjectStore(STORE_NAME)
    }
  }
  return request(opening)
}

/** Runs `work` in its own transaction, and closes the database behind it. */
async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  if (!globalThis.indexedDB) return null

  const db = await openDatabase()
  try {
    const transaction = db.transaction(STORE_NAME, mode)
    return await request(work(transaction.objectStore(STORE_NAME)))
  } finally {
    db.close()
  }
}

export const idbProjectStore: TilesetProjectStore = {
  load: () => withStore('readonly', (store) => store.get(RECORD_KEY)),

  async save(project: TilesetProject) {
    await withStore('readwrite', (store) => store.put(project, RECORD_KEY))
  },

  async clear() {
    await withStore('readwrite', (store) => store.delete(RECORD_KEY))
  }
}
