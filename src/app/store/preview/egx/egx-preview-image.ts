/**
 * EGX preview line masking.
 *
 * All that remains of the former EGX preview-image atom, which produced an
 * ImageData nothing consumed (`finalEgxPreviewImageAtom` is the one the
 * preview reads). `egx-final.ts` uses this predicate to grey out the lines the
 * current preview mode is not showing.
 */

/**
 * Helper to determine if a line should be grayed out based on preview mode
 */
export function shouldGrayOut(
  previewMode: string,
  isLowResLine: boolean
): boolean {
  return (
    (previewMode === 'lowLines' && !isLowResLine) ||
    (previewMode === 'highLines' && isLowResLine)
  )
}
