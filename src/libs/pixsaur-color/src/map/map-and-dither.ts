import {
  getDistanceFn,
  ColorSpaceDistanceMetric,
  DistanceFn
} from '../metric/distance'
import { DitheringConfig } from '../quant'
import { getRgbToColorSpaceFn } from '../space'
import { Vector, ColorSpace } from '../type'

function findNearestIndex(
  src: Float32Array,
  palette: Float32Array[],
  distFn: DistanceFn
): number {
  let bestI = 0,
    bestD = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = distFn(src, palette[i])
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  return bestI
}

export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  paletteRGB: Vector<'RGB'>[],
  config: DitheringConfig,
  colorSpace: ColorSpace = 'RGB'
): Uint8ClampedArray {
  const { mode, intensity } = config
  const doDither = mode !== 'none' && intensity > 0
  const N = width * height
  const buf = new Float32Array(N * 3)
  const out = new Uint8ClampedArray(N * 4)

  // — préparations en amont (cf §1 & §2) —
  const rgb2CS = getRgbToColorSpaceFn(colorSpace)
  const distFn = getDistanceFn(
    colorSpace,
    ColorSpaceDistanceMetric[colorSpace][0]
  )
  const paletteCS: Float32Array[] = paletteRGB.map((c) =>
    Float32Array.from(rgb2CS(c.slice() as Vector))
  )
  const paletteOut: Uint8ClampedArray[] = paletteRGB.map((c) =>
    Uint8ClampedArray.from([...c, 255])
  )

  // init CS buffer
  for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
    const cs = rgb2CS([srcData[i], srcData[i + 1], srcData[i + 2]])
    buf[j] = cs[0]
    buf[j + 1] = cs[1]
    buf[j + 2] = cs[2]
  }

  // paramètres Floyd–Steinberg
  const w3 = width * 3
  const offsets = [3, -3 + w3, w3, 3 + w3]
  const weights = [7 / 16, 3 / 16, 5 / 16, 1 / 16].map((w) => w * intensity)

  // buffers temporaires CS
  const pixelCS = new Float32Array(3)

  // boucle pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx3 = (y * width + x) * 3

      // lecture CS
      pixelCS[0] = buf[idx3]
      pixelCS[1] = buf[idx3 + 1]
      pixelCS[2] = buf[idx3 + 2]

      // quantification par index
      const qi = findNearestIndex(pixelCS, paletteCS, distFn)

      // écriture RGB de sortie (plus besoin de cs2Rgb ici)
      const o4 = (y * width + x) * 4
      out[o4] = paletteOut[qi][0]
      out[o4 + 1] = paletteOut[qi][1]
      out[o4 + 2] = paletteOut[qi][2]
      out[o4 + 3] = 255

      // erreur et diffusion en CS
      if (doDither) {
        const err0 = pixelCS[0] - paletteCS[qi][0]
        const err1 = pixelCS[1] - paletteCS[qi][1]
        const err2 = pixelCS[2] - paletteCS[qi][2]
        for (let k = 0; k < 4; k++) {
          const tx = x + (k === 0 || k === 3 ? 1 : -1)
          const ty = y + (k > 1 ? 1 : 0)
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
          const t3 = idx3 + offsets[k]
          buf[t3] += err0 * weights[k]
          buf[t3 + 1] += err1 * weights[k]
          buf[t3 + 2] += err2 * weights[k]
        }
      }
    }
  }

  return out
}
