import { euclideanDistance } from '../metric/distance'
import { DitheringConfig } from '../quant/quantize'
import { Vector } from '../type'
import { mapToNearest } from './map-to-nearest'

/**
 * Mappe un tampon RGBA (Uint8ClampedArray) vers une palette réduite (Vector[])
 * et applique du dithering Floyd–Steinberg en RGB si intensity > 0.
 *
 * @param srcData   tampon RGBA d’entrée (length = w*h*4)
 * @param width     largeur logique
 * @param height    hauteur logique
 * @param palette   palette réduite en RGB (Vector[])
 * @param config    mode & intensity
 * @returns         tampon RGBA final (Uint8ClampedArray)
 */
export function mapAndDither(
  srcData: Uint8ClampedArray,
  width: number,
  height: number,
  palette: Vector[],
  config: DitheringConfig
): Uint8ClampedArray {
  const { mode, intensity } = config
  const doDither = mode !== 'none' && intensity > 0

  const N = width * height
  // buffer float pour accumulation d'erreurs RGB
  const buf = new Float32Array(N * 3)
  // tampon final RGBA
  const out = new Uint8ClampedArray(N * 4)

  // initialisation du buffer RGB à partir de srcData
  for (let i = 0, j = 0; i < srcData.length; i += 4, j += 3) {
    buf[j] = srcData[i]
    buf[j + 1] = srcData[i + 1]
    buf[j + 2] = srcData[i + 2]
  }

  // paramètres Floyd–Steinberg
  const w3 = width * 3
  const offsets = [
    /* droite      */ 3,
    /* bas‑gauche  */ -3 + w3,
    /* bas         */ w3,
    /* bas‑droite  */ 3 + w3
  ]
  const weights = [7 / 16, 3 / 16, 5 / 16, 1 / 16].map((w) => w * intensity)

  const tmp: Vector = [0, 0, 0]

  // parcours linéaire map + dither
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx3 = (y * width + x) * 3
      const oldR = buf[idx3],
        oldG = buf[idx3 + 1],
        oldB = buf[idx3 + 2]

      // mapping vers palette en RGB euclidien
      tmp[0] = oldR
      tmp[1] = oldG
      tmp[2] = oldB
      const [nr, ng, nb] = mapToNearest(tmp, palette, euclideanDistance)

      // erreur
      const errR = oldR - nr
      const errG = oldG - ng
      const errB = oldB - nb

      // écriture dans out
      const o4 = (y * width + x) * 4
      out[o4] = nr
      out[o4 + 1] = ng
      out[o4 + 2] = nb
      out[o4 + 3] = 255

      if (doDither) {
        // diffuser l'erreur
        for (let k = 0; k < 4; k++) {
          const tx = x + (k === 0 || k === 3 ? 1 : -1)
          const ty = y + (k > 1 ? 1 : 0)
          if (tx < 0 || tx >= width || ty < 0 || ty >= height) continue
          const t3 = idx3 + offsets[k]
          buf[t3] += errR * weights[k]
          buf[t3 + 1] += errG * weights[k]
          buf[t3 + 2] += errB * weights[k]
        }
      }
    }
  }

  return out
}
