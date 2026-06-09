/**
 * Processing Configuration
 *
 * Single responsibility: Processor type, palette strategy, smoothing
 */

import { atom } from 'jotai'
import type { Mode0Filter, PaletteStrategy, ProcessorType } from './types'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Smoothing enabled for preview canvas (bilinear interpolation on upscale)
 * Disabled by default for accurate CPC pixel rendering
 */
export const smoothingAtom = atom<boolean>(false)

/**
 * Horizontal smoothing (anti-aliasing for CPC pixel modes)
 */
export const horizontalSmoothingAtom = atom<boolean>(false)

/**
 * Processor type selection (auto, cpu, gpu)
 * GPU by default for better performance
 */
export const processorTypeAtom = atom<ProcessorType>('gpu')

/**
 * Palette strategy for color quantization
 */
export const paletteStrategyAtom = atom<PaletteStrategy>('exhaustive-contrast')

/**
 * Auto distinct-mapping for low-color retro images (C64, ZX Spectrum, etc.)
 * Disabled by default - user must explicitly enable
 */
export const autoDistinctMappingAtom = atom<boolean>(false)

/**
 * Color diversity level for CPC Plus Mode 0 quantization (0-100)
 * 0 = Similar shades (prioritize frequency, allow close hues)
 * 50 = Balanced (default)
 * 100 = Distinct hues (maximize color variety)
 */
export const colorDiversityAtom = atom<number>(50)

/**
 * Reconstruction filter for the mode 0 linear-light horizontal 2:1 downscale.
 * Only applies to CPC mode 0 in 'origin' resize. Lanczos-2 = best quality.
 */
export const mode0FilterAtom = atom<Mode0Filter>('lanczos2')

// ============================================================================
// SETTERS
// ============================================================================

/**
 * Setter for processor type
 */
export const setProcessorTypeAtom = atom(
  null,
  (_get, set, payload: ProcessorType) => {
    set(processorTypeAtom, payload)
  }
)

/**
 * Setter for palette strategy
 */
export const setPaletteStrategyAtom = atom(
  null,
  (_get, set, payload: PaletteStrategy) => {
    set(paletteStrategyAtom, payload)
  }
)

/**
 * Setter for color diversity
 */
export const setColorDiversityAtom = atom(
  null,
  (_get, set, payload: number) => {
    set(colorDiversityAtom, Math.max(0, Math.min(100, payload)))
  }
)

/**
 * Setter for the mode 0 resample filter
 */
export const setMode0FilterAtom = atom(
  null,
  (_get, set, payload: Mode0Filter) => {
    set(mode0FilterAtom, payload)
  }
)
