import type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
import type { Vector } from '@/libs/pixsaur-color/src/type'

export type { PaletteStrategy } from '@/libs/pixsaur-color/src/quant/strategy-names'
export type ProcessorType = 'auto' | 'cpu' | 'gpu'

export interface QuantizationOptions {
  autoDistinctMapping?: boolean
  colorDiversity?: number
}

/**
 * Configuration pour les ajustements d'image
 */
export interface AdjustmentConfig {
  rgb: { r: number; g: number; b: number }
  brightness: number
  contrast: number
  saturation: number
  hue: number // Rotation de teinte en degrés (-180 à +180)
  vibrance: number // Saturation intelligente (-100 à +100)
  temperature: number // Balance des blancs bleu/orange (-100 à +100)
  tint: number // Balance des blancs vert/magenta (-100 à +100)
  gamma: number // Correction gamma (0.1 à 3.0, défaut 1.0)
  exposure: number // Exposition en stops (-3 à +3)
  highlights: number // Ajustement des hautes lumières (-100 à +100)
  shadows: number // Ajustement des ombres (-100 à +100)
  posterization: number
  // Convolution filters
  median: number // Median filter radius: 0 = off, 1-3 = kernel size (3x3, 5x5, 7x7)
  sharpen: number // Sharpen amount: 0 = off, 0.5 = subtle, 1.0 = strong
  blur: number // Blur strength: 0 = off, 1 = full Gaussian
  edges: number // Edge detection strength: 0 = off, 1 = full edges
  // Chroma key (background removal)
  chromaKeyEnabled: number // 0 = off, 1 = on
  chromaKeyColor: [number, number, number] | null // RGB color to key out
  chromaKeyTolerance: number // Distance tolerance (0-100)
}

/**
 * Interface pour les processors d'image (CPU ou GPU/WebGL).
 *
 * Deux implémentations la satisfont — `CpuProcessor` et `GpuProcessor` — et
 * `processorFactory` est le seul endroit qui choisit entre les deux.
 */
export interface ImageProcessor {
  /** Implémentation effectivement en service. */
  readonly type: 'cpu' | 'gpu'

  /**
   * Applique les ajustements d'image (brightness, contrast, saturation, etc.).
   *
   * Synchrone sur les deux implémentations : le chemin GPU bloque sur
   * `regl.read()`, donc une signature asynchrone ne cacherait la latence que
   * de nom.
   */
  applyAdjustments(
    imageData: ImageData,
    adjustments: AdjustmentConfig
  ): ImageData

  /**
   * Quantifie une palette à partir d'un buffer d'image.
   * Colorspace fixé sur RGB pour optimisation GPU.
   */
  quantizePalette(
    buffer: Uint8ClampedArray,
    imageData: ImageData | { width: number; height: number },
    targetColors: number,
    basePalette: Vector[],
    preselected: Vector[],
    paletteStrategy?: PaletteStrategy,
    options?: QuantizationOptions
  ): Promise<Vector[]>

  /**
   * Rendu de l'aperçu raster (palettes par ligne).
   */
  renderRasterPreview(
    indexBuffer: Uint8Array,
    width: number,
    height: number,
    globalPalette: Vector[],
    rasterChanges: Array<{ line: number; inkIndex: number; color: Vector }>
  ): ImageData

  /**
   * Nettoie les ressources (WebGL contexts, etc.)
   */
  dispose(): void
}

/**
 * Factory pour créer le processor adapté. Elle porte à elle seule la décision
 * GPU/CPU, y compris le fallback silencieux du mode `'auto'`.
 */
export interface ProcessorFactory {
  /**
   * @param processorType - `'cpu'`, `'gpu'` ou `'auto'` (GPU puis fallback CPU)
   */
  createBestProcessor(processorType?: ProcessorType): Promise<ImageProcessor>
}
