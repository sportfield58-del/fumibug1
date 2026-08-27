/**
 * Photo capture helpers for the field app.
 * - Compression to WebP <300KB
 * - EXIF (GPS location) stripping
 * - SHA-256 hash for server confirmation
 * docs/spec/12-offline-pwa.md, docs/spec/03-modulos.md §C.11
 */

const MAX_PHOTO_BYTES = 300 * 1024 // 300KB
const MAX_DIMENSION = 1920 // cap long edge

export interface ProcessedPhoto {
  blob: Blob
  mimeType: string
  sizeBytes: number
  width: number
  height: number
  sha256: string
}

/**
 * Compresses an image File/Blob to WebP <300KB and returns metadata.
 * Strips EXIF by re-encoding through canvas (never carries EXIF).
 */
export async function processPhoto(
  source: Blob,
  maxBytes = MAX_PHOTO_BYTES
): Promise<ProcessedPhoto> {
  const bitmap = await createImageBitmap(source)
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D no disponible')

  // Stage 1: initial draw. EXIF is not copied by drawImage, so location is stripped.
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.82
  let blob = await canvasToBlob(canvas, quality)
  // Reduce quality until under budget (min 0.4)
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.12
    blob = await canvasToBlob(canvas, quality)
  }

  // If still too big after quality floor, scale down further
  while (blob.size > maxBytes && width > 480) {
    const nextW = Math.round(width * 0.75)
    const nextH = Math.round(height * 0.75)
    canvas.width = nextW
    canvas.height = nextH
    const ctx2 = canvas.getContext('2d')
    if (!ctx2) return fromBlob(blob, width, height)
    ctx2.drawImage(canvas, 0, 0, nextW, nextH)
    blob = await canvasToBlob(canvas, 0.7)
  }

  return fromBlob(blob, canvas.width, canvas.height)
}

function fromBlob(blob: Blob, width: number, height: number): Promise<ProcessedPhoto> {
  return blob.arrayBuffer().then((buffer) =>
    crypto.subtle.digest('SHA-256', buffer).then((hashBuf) => ({
      blob,
      mimeType: blob.type || 'image/webp',
      sizeBytes: blob.size,
      width,
      height,
      sha256: toHex(hashBuf),
    }))
  )
}

function scaleDimensions(w: number, h: number): { width: number; height: number } {
  const longEdge = Math.max(w, h)
  if (longEdge <= MAX_DIMENSION) return { width: w, height: h }
  const ratio = MAX_DIMENSION / longEdge
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo generar la imagen'))
      },
      'image/webp',
      quality
    )
  })
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

