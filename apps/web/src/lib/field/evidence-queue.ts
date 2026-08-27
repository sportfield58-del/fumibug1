import { db, type PhotoBlob, type OutboxEntry } from '../offline/db'
import { getSyncEngine } from '../offline/sync-engine'
import { processPhoto, type ProcessedPhoto } from './photo'

/**
 * Evidence queue: stores the compressed photo blob in Dexie and enqueues a
 * confirm event to the outbox. The SyncEngine uploads when online.
 * docs/spec/12-offline-pwa.md — read cached + queued write.
 */
export interface QueueEvidenceInput {
  sessionId: string
  category: string // EvidenceCategory: 'BEFORE' | 'DURING' | 'AFTER' | 'HASH' ...
  type: string // EvidenceType
  clientEventId: string
  source: Blob
  deps?: string[]
}

/**
 * Capture + compress + hash a photo and enqueue it for upload.
 * Returns the enqueued photo record.
 */
export async function captureAndQueueEvidence(
  input: QueueEvidenceInput
): Promise<PhotoBlob> {
  const processed: ProcessedPhoto = await processPhoto(input.source)

  const photo: PhotoBlob = {
    id: input.clientEventId,
    serviceId: input.sessionId,
    blob: processed.blob,
    mimeType: processed.mimeType,
    sizeBytes: processed.sizeBytes,
    hash: processed.sha256,
    createdAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.photos, db.outbox, async () => {
    await db.photos.put(photo)
    await getSyncEngine().enqueue(makeEvidenceOutboxEntry(input, processed))
  })

  return photo
}

function makeEvidenceOutboxEntry(
  input: QueueEvidenceInput,
  processed: ProcessedPhoto
): Omit<OutboxEntry, 'status' | 'attempts' | 'createdAt'> {
  return {
    id: input.clientEventId,
    type: 'field/confirm-evidence',
    occurredAt: new Date().toISOString(),
    deps: input.deps ?? [],
    payload: {
      sessionId: input.sessionId,
      category: input.category,
      type: input.type,
      mimeType: processed.mimeType,
      sizeBytes: processed.sizeBytes,
      width: processed.width,
      height: processed.height,
      sha256: processed.sha256,
      clientEventId: input.clientEventId,
    },
  }
}

/** All photos still waiting for server confirmation. */
export async function listPendingPhotos(): Promise<PhotoBlob[]> {
  const photos = await db.photos.toArray()
  return photos.filter((p) => !p.uploadedAt)
}
