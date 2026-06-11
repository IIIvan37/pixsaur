/**
 * Ports for the preview feature (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges so the orchestration code stays pure and
 * testable with fakes.
 *
 * Living registry: see `./README.md`.
 */

import type { ImageProcessor } from '@/libs/pixsaur-adapter'

/**
 * Quantizes an image buffer down to a CPC palette.
 *
 * Narrow facet of {@link ImageProcessor} — use-cases depend only on the one
 * method they need, not the whole CPU/GPU processor surface.
 *
 * - Runtime adapter: the `imageProcessorAtom` value
 *   (`@/libs/pixsaur-adapter`, GPU with automatic CPU fallback), injected as
 *   `deps.quantizer`.
 */
export type PaletteQuantizer = Pick<ImageProcessor, 'quantizePalette'>
