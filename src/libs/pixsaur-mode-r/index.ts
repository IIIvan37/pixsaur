/**
 * Mode R (Rhino Mode) - Interlaced palette mode for CPC
 *
 * The Mode R technique creates:
 * - Doubled horizontal resolution perception (384×272 from 192×272)
 * - Up to 240 perceived colors (16×15 unique pairs)
 * - Minimal flicker when optimized for luminance similarity
 *
 * This module handles:
 * - Color pair optimization (minimize flicker while matching target colors)
 * - Dual palette generation
 * - Blend simulation for preview
 */

export * from './blend'
export * from './pair-optimizer'
export * from './quantize-mode-r'
export * from './types'
