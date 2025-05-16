import { Selection } from '@/libs/pixsaur-adapter/io/downscale-image'

export function getVisualRegion(
  src: ImageData,
  selection: Selection,
  targetW: number
): ImageData {
  const { sx, sy, width: sw, height: sh } = selection

  // Crée un canvas temporaire pour extraire la sélection
  const tmp = document.createElement('canvas')
  tmp.width = src.width
  tmp.height = src.height
  const tctx = tmp.getContext('2d')!
  tctx.putImageData(src, 0, 0)
  const region = tctx.getImageData(sx, sy, sw, sh)

  console.log('original', src.width, src.height, src.width / src.height)
  // Puis redimensionne à targetW×targetH
  const tmp2 = document.createElement('canvas')
  tmp2.width = targetW
  tmp2.height = sh * (320 / sw)
  console.log('resized', tmp2.width, tmp2.height, tmp2.width / tmp2.height)
  const t2 = tmp2.getContext('2d')!
  t2.imageSmoothingEnabled = false
  // drawImage prend ImageBitmap‑like, on doit d’abord mettre region sur un canvas
  const buf = document.createElement('canvas')
  buf.width = sw
  buf.height = sh
  buf.getContext('2d')!.putImageData(region, 0, 0)
  t2.drawImage(buf, 0, 0, sw, sh, 0, 0, tmp2.width, tmp2.height)

  return t2.getImageData(0, 0, tmp2.width, tmp2.height)
}
