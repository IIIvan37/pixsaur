/**
 * Processing Configuration
 *
 * Single responsibility: Processor type, palette strategy, smoothing
 */

import { atom } from 'jotai'
import type { PaletteStrategy, ProcessorType } from './types'

// ============================================================================
// CORE ATOMS
// ============================================================================

/**
 * Smoothing enabled (legacy)
 */
export const smoothingAtom = atom<boolean>(true)

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
