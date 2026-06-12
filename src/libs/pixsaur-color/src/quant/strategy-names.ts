/**
 * Stratégies de palette sélectionnables par l'utilisateur.
 *
 * Sous-ensemble de PaletteStrategyName (palette-strategies-v2) : exclut les
 * stratégies internes appliquées automatiquement ('mode0-hue-diversity',
 * 'distinct-mapping').
 */

// Palette selection strategy for color quantization
export type PaletteStrategy =
  | 'exhaustive-contrast' // Exhaustive search: tests all combinations, maximizes min distance
  | 'coverage-aware' // Maximizes coverage of image colors within threshold
  | 'dithering-aware' // Selects colors that blend well for dithering
  | 'frequency-balanced' // Original: frequency + diversity, mode balanced (80% freq)
  | 'frequency-max' // Original: frequency + diversity, max contrast (60% freq)
  | 'balanced-score-balanced' // Multi-criteria: 50% freq, 25% diversity, 25% luminance
  | 'balanced-score-max' // Multi-criteria: 30% freq, 35% diversity, 35% luminance
  | 'perceptual-balanced' // Luminance bins with frequency priority
  | 'perceptual-max' // Luminance bins with diversity priority
  | 'diversity-first-balanced' // Diversity max with slight frequency (90% div, 10% freq)
  | 'diversity-first-max' // Pure diversity (100% div, 0% freq)
  | 'adaptive' // Adaptive based on image analysis
