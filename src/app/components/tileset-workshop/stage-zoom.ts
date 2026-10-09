/**
 * The arithmetic of the stage's zoom (S-Q13): pure, so the component only
 * reads the layout and writes the scroll.
 *
 * The stage scrolls a canvas of the image's size times the zoom, centred
 * while it is smaller than the stage.
 */

export type Size = { width: number; height: number }

/** Ajuster, then these (S-Q13). */
const STEPS = [1, 2, 3, 4, 6, 8]

/**
 * The longest side, in canvas pixels, the stage draws. Browsers refuse a
 * canvas much past 16 384 px, and memory runs out well before on a phone.
 */
const MAX_CANVAS_SIDE = 8192

/**
 * « Ajuster »: the largest whole factor that fits the image in the stage, so
 * every source pixel covers the same number of screen pixels — or the
 * fraction that fits an image larger than the stage.
 *
 * A stage not laid out yet measures 0: the image keeps its own size.
 */
export function fitZoom(image: Size, viewport: Size): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 1
  const ratio = Math.min(
    viewport.width / image.width,
    viewport.height / image.height
  )
  return ratio >= 1 ? Math.floor(ratio) : ratio
}

/** The next step up, short of a canvas too large to draw. */
export function zoomIn(current: number, image: Size): number {
  const longest = Math.max(image.width, image.height)
  const next = STEPS.find(
    (step) => step > current && step * longest <= MAX_CANVAS_SIDE
  )
  return next ?? current
}

/**
 * The next step down. Below 1×, only the fitted fraction of an image larger
 * than the stage: smaller than that, the stage would show empty space for
 * nothing.
 */
export function zoomOut(current: number, fit: number): number {
  const below = [...(fit < 1 ? [fit] : []), ...STEPS].filter(
    (step) => step < current
  )
  return below.length > 0 ? Math.max(...below) : current
}

/**
 * The scroll, along one axis, that keeps the image pixel under the pointer in
 * place when the zoom goes from `from` to `to`. `pointer` is measured from
 * the stage's edge, `length` is the image's own size.
 */
export function anchorScroll(axis: {
  scroll: number
  pointer: number
  viewport: number
  length: number
  from: number
  to: number
}): number {
  const { scroll, pointer, viewport, length, from, to } = axis
  // While the image is smaller than the stage, the stage centres it.
  const margin = (zoom: number) => Math.max(0, (viewport - length * zoom) / 2)
  const pixel = (scroll + pointer - margin(from)) / from
  const wanted = pixel * to + margin(to) - pointer
  return Math.min(Math.max(0, wanted), Math.max(0, length * to - viewport))
}
