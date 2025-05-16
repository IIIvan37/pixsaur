import { ColorSpaceDistanceMetric, getDistanceFn } from '../metric/distance'
import { DitheringConfig } from '../quant/quantize'
import { getRgbToColorSpaceFn, getColorSpaceToRgbFn } from '../space'

import { ColorSpace, Vector } from '../type'
import { mapToNearest } from './map-to-nearest'

export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  paletteRGB: Vector<'RGB'>[],
  config: DitheringConfig,
  colorSpace: ColorSpace = 'Lab'
): Uint8ClampedArray {
  const { mode, intensity } = config
  const doDither = mode !== 'none' && intensity > 0

  const N = width * height
  const buf = new Float32Array(N * 3)
  const out = new Uint8ClampedArray(N * 4)

  // 1) Fonctions de conversion
  const rgb2CS = getRgbToColorSpaceFn(colorSpace)
  const cs2Rgb = getColorSpaceToRgbFn(colorSpace)

  // 2) Choix de la métrique : par défaut, la première supportée pour l’espace
  const choosenMetric = ColorSpaceDistanceMetric[colorSpace]

  const distFn = getDistanceFn(colorSpace, choosenMetric[0])
  // 3) Pré-conversion de la palette → CS
  const paletteCS = paletteRGB.map((c) => rgb2CS(c.slice() as Vector<'RGB'>))

  // 4) Initialisation du buffer : srcData RGBA → CS
  for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
    const rgb: Vector<'RGB'> = [srcData[i], srcData[i + 1], srcData[i + 2]]
    const cs = rgb2CS(rgb)
    buf[j] = cs[0]
    buf[j + 1] = cs[1]
    buf[j + 2] = cs[2]
  }

  // Floyd–Steinberg
  const w3 = width * 3
  const offsets = [3, -3 + w3, w3, 3 + w3]
  const weights = [7 / 16, 3 / 16, 5 / 16, 1 / 16].map((w) => w * intensity)

  const tmp: Vector = [0, 0, 0]

  // 5) Boucle principale : mapping + diffusion
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx3 = (y * width + x) * 3

      // couleur d’entrée en CS
      const oldCS: Vector = [buf[idx3], buf[idx3 + 1], buf[idx3 + 2]]

      // mapping vers paletteCS
      tmp[0] = oldCS[0]
      tmp[1] = oldCS[1]
      tmp[2] = oldCS[2]
      const quantCS = mapToNearest(tmp, paletteCS, distFn)

      // erreur en CS
      const errCS: Vector = [
        oldCS[0] - quantCS[0],
        oldCS[1] - quantCS[1],
        oldCS[2] - quantCS[2]
      ]

      // reconversion quantifiée → RGB et écriture
      const [r, g, b] = cs2Rgb(quantCS.slice() as Vector)
      const o4 = (y * width + x) * 4
      out[o4] = Math.round(r)
      out[o4 + 1] = Math.round(g)
      out[o4 + 2] = Math.round(b)
      out[o4 + 3] = 255

      // diffusion si demandé
      if (doDither) {
        for (let k = 0; k < 4; k++) {
          const tx = x + (k === 0 || k === 3 ? 1 : -1)
          const ty = y + (k > 1 ? 1 : 0)
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
          const t3 = idx3 + offsets[k]
          buf[t3] += errCS[0] * weights[k]
          buf[t3 + 1] += errCS[1] * weights[k]
          buf[t3 + 2] += errCS[2] * weights[k]
        }
      }
    }
  }

  return out
}
