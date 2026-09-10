/**
 * What a pen is, for the whole tileset feature.
 *
 * Its own module because both the conversion and the PNG rendering need it,
 * and neither owns the other.
 */

/** An RGB pen, already snapped to a CPC hardware colour. */
export type Pen = [r: number, g: number, b: number]

/** What a hole is composited over unless the user says otherwise (Q16). */
export const BLACK: Pen = [0, 0, 0]
