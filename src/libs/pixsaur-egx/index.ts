/**
 * EGX Mode (Enhanced Graphics eXtended) - Line-by-line mode alternation
 *
 * The EGX technique creates:
 * - EGX1: 320×200 with up to 16 colors (Mode 0/1 alternation)
 * - EGX2: 640×200 with up to 4 colors (Mode 1/2 alternation)
 *
 * Unlike Mode R (temporal interlacing), EGX has no flicker because
 * it uses spatial line-by-line alternation within a single frame.
 *
 * This module handles:
 * - Palette optimization with shared color constraints
 * - Per-line quantization with mode-aware dithering
 * - Screen encoding for mixed-mode output
 */

export * from './dithering'
export * from './palette-optimizer'
export * from './quantize-egx'
export * from './types'

// Future exports:
// export * from './line-encoder'
