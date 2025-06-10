export type Selection = {
  sx: number
  sy: number
  width: number
  height: number
}

/**
 * Draws an HTMLImageElement onto an off-screen canvas, limiting
 * the width to maxWidth (scale ≤ 1), then extracts a region (selection)
 * or the entire image if no selection is provided.
 *
 * @param img        Loaded HTMLImageElement
 * @param _maxWidth   Desired maximum width (original or reduced)
 * @param selection  Area to extract after scaling (optional)
 * @returns          ImageData of the extracted region
 */
export function downscaleImage(
  img: HTMLImageElement,
  _maxWidth: number,
  selection?: Selection
): ImageData {
  // 1. calcul du scale pour limiter la largeur

  const scale = 1

  const w = Math.floor(img.width * scale)
  const h = Math.floor(img.height * scale)

  // 2. dessin du canvas réduit
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d')!
  ctx.imageSmoothingEnabled = false // pas de lissage
  ctx.drawImage(
    img,
    0,
    0,
    img.width,
    img.height, // source complète
    0,
    0,
    w,
    h // target réduit
  )

  // 3. adapter la sélection si fournie
  if (selection) {
    // on met à l’échelle la zone demandée
    const sx = Math.floor(selection.sx * scale)
    const sy = Math.floor(selection.sy * scale)
    const sw = Math.floor(selection.width * scale)
    const sh = Math.floor(selection.height * scale)
    // clamp pour ne pas dépasser les limites du canvas
    const cx = Math.max(0, Math.min(sx, w - 1))
    const cy = Math.max(0, Math.min(sy, h - 1))
    const cw = Math.max(1, Math.min(sw, w - cx))
    const ch = Math.max(1, Math.min(sh, h - cy))
    return ctx.getImageData(cx, cy, cw, ch)
  }

  // 4. pas de sélection → renvoyer tout
  return ctx.getImageData(0, 0, w, h)
}
