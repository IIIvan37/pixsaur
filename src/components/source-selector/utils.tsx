import type { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'
export type Handle =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | null

/**
 * Converts a logical selection (in image space) to display coordinates in percent.
 *
 * @param sel - The logical selection { sx, sy, width, height }.
 * @param imageWidth - The logical width of the image (e.g. 400).
 * @param imageHeight - The logical height of the image.
 * @returns A rectangle in percent coordinates: { x, y, width, height }.
 */
export function logicalToPercentRect(
  sel: Selection,
  imageWidth: number,
  imageHeight: number
) {
  return {
    x: (sel.sx / imageWidth) * 100,
    y: (sel.sy / imageHeight) * 100,
    width: (sel.width / imageWidth) * 100,
    height: (sel.height / imageHeight) * 100
  }
}

/**
 * Converts a display rectangle (in percent of container) back to logical image coordinates.
 *
 * @param rect - The selection in percent: { x, y, width, height }.
 * @param imageWidth - The logical image width.
 * @param imageHeight - The logical image height.
 * @returns A logical selection { sx, sy, width, height }.
 */
export function percentRectToLogical(
  rect: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number
): Selection {
  return {
    sx: Math.round((rect.x / 100) * imageWidth),
    sy: Math.round((rect.y / 100) * imageHeight),
    width: Math.round((rect.width / 100) * imageWidth),
    height: Math.round((rect.height / 100) * imageHeight)
  }
}

export function clampSelectionToBounds(
  sel: Selection,
  imageWidth: number,
  imageHeight: number
): Selection {
  const maxWidth = Math.max(1, imageWidth)
  const maxHeight = Math.max(1, imageHeight)
  const sx = Math.max(0, Math.min(sel.sx, maxWidth - 1))
  const sy = Math.max(0, Math.min(sel.sy, maxHeight - 1))
  const width = Math.max(1, Math.min(sel.width, maxWidth - sx))
  const height = Math.max(1, Math.min(sel.height, maxHeight - sy))

  return { sx, sy, width, height }
}
