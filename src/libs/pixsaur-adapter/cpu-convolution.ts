/**
 * CPU Convolution Implementation
 *
 * Fallback CPU pour les filtres de convolution (sharpen, blur)
 * quand le GPU n'est pas disponible.
 */

import {
  createBlurKernel,
  createSharpenKernel,
  getBlurPassCount
} from './convolution-kernels'

/**
 * Applique une convolution 3x3 sur une image
 *
 * @param imageData - Image d'entrée
 * @param kernel - Kernel 3x3 en format row-major [9 éléments]
 * @param strength - Force du mélange (0 = original, 1 = full)
 * @returns Nouvelle ImageData avec la convolution appliquée
 */
export function applyConvolution3x3(
  imageData: ImageData,
  kernel: number[],
  strength: number
): ImageData {
  const { width, height, data: src } = imageData
  const dst = new Uint8ClampedArray(src.length)

  // Si strength est 0, retourner une copie
  if (strength === 0) {
    dst.set(src)
    return new ImageData(dst, width, height)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0
      let sumG = 0
      let sumB = 0

      // Appliquer le kernel 3x3
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          // Coordonnées avec clamping aux bords
          const sx = Math.max(0, Math.min(width - 1, x + kx))
          const sy = Math.max(0, Math.min(height - 1, y + ky))

          const srcIdx = (sy * width + sx) * 4
          const kernelIdx = (ky + 1) * 3 + (kx + 1)
          const weight = kernel[kernelIdx]

          sumR += src[srcIdx] * weight
          sumG += src[srcIdx + 1] * weight
          sumB += src[srcIdx + 2] * weight
        }
      }

      const dstIdx = (y * width + x) * 4

      // Mélanger entre original et convolué selon strength
      const origR = src[dstIdx]
      const origG = src[dstIdx + 1]
      const origB = src[dstIdx + 2]

      dst[dstIdx] = Math.round(origR * (1 - strength) + sumR * strength)
      dst[dstIdx + 1] = Math.round(origG * (1 - strength) + sumG * strength)
      dst[dstIdx + 2] = Math.round(origB * (1 - strength) + sumB * strength)
      dst[dstIdx + 3] = src[dstIdx + 3] // Préserver alpha
    }
  }

  return new ImageData(dst, width, height)
}

/**
 * Applique les filtres de convolution (sharpen et/ou blur) sur une image
 *
 * @param imageData - Image d'entrée
 * @param sharpen - Force du sharpen (0 = off, 1 = strong)
 * @param blur - Force du blur (0 = off, 1-3 = passes de gaussian blur)
 * @returns Nouvelle ImageData avec les filtres appliqués
 */
export function applyConvolutionFilters(
  imageData: ImageData,
  sharpen: number,
  blur: number
): ImageData {
  // Aucun filtre actif
  if (sharpen === 0 && blur === 0) {
    return imageData
  }

  let result = imageData

  // Appliquer blur d'abord (multi-pass si blur > 1)
  if (blur !== 0) {
    const blurKernel = createBlurKernel(blur)
    const passes = getBlurPassCount(blur)

    for (let pass = 0; pass < passes; pass++) {
      result = applyConvolution3x3(result, blurKernel, 1.0)
    }
  }

  // Puis sharpen (si actif)
  if (sharpen !== 0) {
    const sharpenKernel = createSharpenKernel(Math.abs(sharpen))
    result = applyConvolution3x3(result, sharpenKernel, 1.0)
  }

  return result
}

/**
 * Trouve la médiane d'un tableau de nombres
 * Utilise un tri partiel pour performance optimale
 */
function findMedian(arr: number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted[mid]
}

/**
 * Applique un filtre médian sur une image
 *
 * Le filtre médian remplace chaque pixel par la médiane de ses voisins.
 * Excellent pour le débruitage (bruit sel et poivre) tout en préservant les contours.
 *
 * @param imageData - Image d'entrée
 * @param radius - Rayon du filtre: 1 = 3x3, 2 = 5x5, 3 = 7x7
 * @returns Nouvelle ImageData avec le filtre médian appliqué
 */
export function applyMedianFilter(
  imageData: ImageData,
  radius: number
): ImageData {
  if (radius <= 0) {
    return imageData
  }

  // Clamper le rayon entre 1 et 3
  const r = Math.min(3, Math.max(1, Math.round(radius)))
  const { width, height, data: src } = imageData
  const dst = new Uint8ClampedArray(src.length)

  // Taille du kernel
  const size = 2 * r + 1
  const kernelSize = size * size

  // Pré-allouer les tableaux pour chaque canal
  const redValues: number[] = new Array(kernelSize)
  const greenValues: number[] = new Array(kernelSize)
  const blueValues: number[] = new Array(kernelSize)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = 0

      // Collecter tous les pixels du voisinage
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          // Coordonnées avec clamping aux bords
          const sx = Math.max(0, Math.min(width - 1, x + kx))
          const sy = Math.max(0, Math.min(height - 1, y + ky))

          const srcIdx = (sy * width + sx) * 4
          redValues[idx] = src[srcIdx]
          greenValues[idx] = src[srcIdx + 1]
          blueValues[idx] = src[srcIdx + 2]
          idx++
        }
      }

      // Trouver la médiane pour chaque canal
      const dstIdx = (y * width + x) * 4
      dst[dstIdx] = findMedian(redValues)
      dst[dstIdx + 1] = findMedian(greenValues)
      dst[dstIdx + 2] = findMedian(blueValues)
      dst[dstIdx + 3] = src[dstIdx + 3] // Préserver alpha
    }
  }

  return new ImageData(dst, width, height)
}

/**
 * Convert RGB to grayscale using luminance formula
 */
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Applique la détection de contours Sobel sur une image
 *
 * @param imageData - Image d'entrée
 * @param strength - Force de la détection (0 = off, 1 = contours uniquement)
 * @returns Nouvelle ImageData avec les contours détectés
 */
export function applySobelEdgeDetection(
  imageData: ImageData,
  strength: number
): ImageData {
  if (strength === 0) {
    return imageData
  }

  const { width, height, data: src } = imageData
  const dst = new Uint8ClampedArray(src.length)

  // Helper pour obtenir la luminance à une position avec clamping
  const getLuminance = (x: number, y: number): number => {
    const cx = Math.max(0, Math.min(width - 1, x))
    const cy = Math.max(0, Math.min(height - 1, y))
    const idx = (cy * width + cx) * 4
    return luminance(src[idx], src[idx + 1], src[idx + 2])
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Sample 3x3 neighborhood
      const tl = getLuminance(x - 1, y - 1)
      const tc = getLuminance(x, y - 1)
      const tr = getLuminance(x + 1, y - 1)
      const ml = getLuminance(x - 1, y)
      const mr = getLuminance(x + 1, y)
      const bl = getLuminance(x - 1, y + 1)
      const bc = getLuminance(x, y + 1)
      const br = getLuminance(x + 1, y + 1)

      // Sobel Gx: horizontal gradient (detects vertical edges)
      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br

      // Sobel Gy: vertical gradient (detects horizontal edges)
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br

      // Gradient magnitude (sum of absolutes for performance)
      const magnitude = Math.min(255, Math.abs(gx) + Math.abs(gy))

      const dstIdx = (y * width + x) * 4
      const origR = src[dstIdx]
      const origG = src[dstIdx + 1]
      const origB = src[dstIdx + 2]

      // Mix original with edge detection based on strength
      dst[dstIdx] = Math.round(origR * (1 - strength) + magnitude * strength)
      dst[dstIdx + 1] = Math.round(
        origG * (1 - strength) + magnitude * strength
      )
      dst[dstIdx + 2] = Math.round(
        origB * (1 - strength) + magnitude * strength
      )
      dst[dstIdx + 3] = src[dstIdx + 3] // Preserve alpha
    }
  }

  return new ImageData(dst, width, height)
}
