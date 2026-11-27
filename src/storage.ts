import type { Annotation, DatasetImage, LabelClass } from './types'

export type ProjectSnapshot = {
  images: DatasetImage[]
  labels: LabelClass[]
  annotations: Annotation[]
  activeImageId: string | null
  activeLabelId: string
}

type StoredProject = ProjectSnapshot & {
  id: 'current'
  savedAt: number
}

const DATABASE_NAME = 'annotation-workspace'
const DATABASE_VERSION = 1
const STORE_NAME = 'projects'

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open local project storage'))
    request.onblocked = () => reject(new Error('Local project storage is blocked by another tab'))
  }).catch((error: unknown) => {
    databasePromise = null
    throw error
  })

  return databasePromise
}

export async function loadProject(): Promise<ProjectSnapshot | null> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get('current')
    request.onsuccess = () => {
      const record = request.result as StoredProject | undefined
      if (!record) {
        resolve(null)
        return
      }
      resolve({
        images: record.images,
        labels: record.labels,
        annotations: record.annotations,
        activeImageId: record.activeImageId,
        activeLabelId: record.activeLabelId,
      })
    }
    request.onerror = () => reject(request.error ?? new Error('Could not read the saved project'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not read the saved project'))
  })
}

export async function saveProject(project: ProjectSnapshot): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({ ...project, id: 'current', savedAt: Date.now() } satisfies StoredProject)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the project'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save the project'))
  })
}
