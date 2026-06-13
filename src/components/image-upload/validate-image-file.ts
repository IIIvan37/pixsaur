/**
 * Upload guard rails. Source images are decoded and processed synchronously on
 * the main thread, so an oversized file (bytes) or oversized canvas (pixels)
 * can freeze the UI or exhaust memory. These pure checks let the upload flow
 * reject such files up front with a localized message.
 */

/** Maximum accepted file size, in bytes (40 MB). */
export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024

/** Maximum accepted width or height, in pixels, of a decoded source image. */
export const MAX_IMAGE_DIMENSION = 8192

export type ImageValidationError = 'file-too-large' | 'dimensions-too-large'

export type ImageValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ImageValidationError }

const OK: ImageValidationResult = { ok: true }

/** Reject files larger than {@link MAX_FILE_SIZE_BYTES}. */
export function validateFileSize(file: File): ImageValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, reason: 'file-too-large' }
  }
  return OK
}

/**
 * Reject decoded images whose width or height exceeds
 * {@link MAX_IMAGE_DIMENSION}. Uses natural dimensions when available so the
 * check reflects the real pixel buffer, not a CSS-scaled size.
 */
export function validateImageDimensions(
  img: HTMLImageElement
): ImageValidationResult {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return { ok: false, reason: 'dimensions-too-large' }
  }
  return OK
}
