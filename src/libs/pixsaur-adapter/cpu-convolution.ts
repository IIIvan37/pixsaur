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
    const passes = getBlurPassCount(blur)

    for (let pass = 0; pass < passes; pass++) {
      // Première passe: kernel interpolé, passes suivantes: full Gaussian
      const blurKernel = createBlurKernel(blur, pass)
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
 * Réseau de tri optimisé pour 9 éléments (3x3 kernel)
 * Utilise seulement 25 comparaisons au lieu de ~20 pour un tri complet
 * Retourne directement la médiane (élément 4)
 */
function median9(v: number[]): number {
  // Macro de swap conditionnel
  const swap = (i: number, j: number) => {
    if (v[i] > v[j]) {
      const t = v[i]
      v[i] = v[j]
      v[j] = t
    }
  }

  // Réseau de tri partiel optimisé pour trouver la médiane
  swap(0, 1)
  swap(3, 4)
  swap(6, 7)
  swap(1, 2)
  swap(4, 5)
  swap(7, 8)
  swap(0, 1)
  swap(3, 4)
  swap(6, 7)
  swap(0, 3)
  swap(3, 6)
  swap(0, 3)
  swap(1, 4)
  swap(4, 7)
  swap(1, 4)
  swap(2, 5)
  swap(5, 8)
  swap(2, 5)
  swap(1, 3)
  swap(5, 7)
  swap(2, 6)
  swap(4, 6)
  swap(2, 4)
  swap(2, 3)
  swap(5, 6)
  swap(3, 4)
  swap(4, 5)

  return v[4]
}

/**
 * QuickSelect - trouve le k-ième élément en O(n) moyen
 * Plus rapide que le tri complet pour trouver la médiane
 */
function quickSelect(arr: number[], k: number): number {
  const n = arr.length
  if (n === 1) return arr[0]

  // Copie pour ne pas modifier l'original
  const a = arr.slice()

  let left = 0
  let right = n - 1

  while (left < right) {
    // Pivot = médiane de trois
    const mid = (left + right) >> 1
    if (a[mid] < a[left]) {
      const t = a[mid]
      a[mid] = a[left]
      a[left] = t
    }
    if (a[right] < a[left]) {
      const t = a[right]
      a[right] = a[left]
      a[left] = t
    }
    if (a[right] < a[mid]) {
      const t = a[right]
      a[right] = a[mid]
      a[mid] = t
    }

    const pivot = a[mid]
    let i = left
    let j = right

    // Partition
    while (i <= j) {
      while (a[i] < pivot) i++
      while (a[j] > pivot) j--
      if (i <= j) {
        const t = a[i]
        a[i] = a[j]
        a[j] = t
        i++
        j--
      }
    }

    if (k <= j) {
      right = j
    } else if (k >= i) {
      left = i
    } else {
      return a[k]
    }
  }

  return a[k]
}

/**
 * Trouve la médiane d'un tableau - optimisé selon la taille
 */
function findMedian(arr: number[], size: number): number {
  if (size === 9) {
    // Utiliser le réseau de tri optimisé pour 3x3
    return median9(arr.slice(0, 9))
  }
  // Pour les plus grands kernels, utiliser quickselect
  return quickSelect(arr.slice(0, size), size >> 1)
}

/**
 * Applique un filtre médian sur une image
 *
 * Le filtre médian remplace chaque pixel par la médiane de ses voisins.
 * Excellent pour le débruitage (bruit sel et poivre) tout en préservant les contours.
 *
 * Optimisations:
 * - Réseau de tri pour kernel 3x3 (25 comparaisons)
 * - QuickSelect O(n) pour les plus grands kernels
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
      dst[dstIdx] = findMedian(redValues, kernelSize)
      dst[dstIdx + 1] = findMedian(greenValues, kernelSize)
      dst[dstIdx + 2] = findMedian(blueValues, kernelSize)
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

/**
 * Applique le chroma key (suppression de fond) sur une image
 *
 * Les pixels correspondant à la couleur clé (dans la tolérance) sont remplacés
 * par la couleur de remplacement (typiquement ink 0 / noir).
 *
 * @param imageData - Image d'entrée
 * @param keyColor - Couleur RGB à supprimer [r, g, b]
 * @param tolerance - Tolérance de distance euclidienne (0-100)
 * @param replacementColor - Couleur RGB de remplacement (défaut: noir [0, 0, 0])
 * @returns Nouvelle ImageData avec le fond remplacé
 */
export function applyChromaKey(
  imageData: ImageData,
  keyColor: [number, number, number],
  tolerance: number,
  replacementColor: [number, number, number] = [0, 0, 0]
): ImageData {
  const { width, height, data: src } = imageData
  const dst = new Uint8ClampedArray(src.length)

  // Tolérance au carré pour éviter sqrt dans la boucle
  const toleranceSq = tolerance * tolerance

  const [keyR, keyG, keyB] = keyColor
  const [repR, repG, repB] = replacementColor

  for (let i = 0; i < src.length; i += 4) {
    const r = src[i]
    const g = src[i + 1]
    const b = src[i + 2]
    const a = src[i + 3]

    // Distance euclidienne au carré
    const dr = r - keyR
    const dg = g - keyG
    const db = b - keyB
    const distSq = dr * dr + dg * dg + db * db

    if (distSq <= toleranceSq) {
      // Pixel dans la tolérance -> remplacer par la couleur de remplacement
      dst[i] = repR
      dst[i + 1] = repG
      dst[i + 2] = repB
      dst[i + 3] = a // Préserver alpha
    } else {
      // Pixel hors tolérance -> copier tel quel
      dst[i] = r
      dst[i + 1] = g
      dst[i + 2] = b
      dst[i + 3] = a
    }
  }

  return new ImageData(dst, width, height)
}
