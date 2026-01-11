/**
 * CPC Domain Module
 *
 * Centralized CPC-specific logic following ISP (Interface Segregation Principle):
 * - quantization: CPC Classic/Plus color quantization
 * - slot: Palette slot state management (locked/unlocked)
 * - color-distance: Perceptual color distance calculations
 * - palette-filtering: Filtering palettes by various criteria
 * - ignored-slot: Special ignored slot marker handling
 * - color-utils: Generic color vector operations
 */

// Color distance calculations
export {
  areColorsSimilar,
  DEFAULT_PERCEPTUAL_THRESHOLD,
  isColorTooClose,
  perceptualDistance
} from './color-distance'
// Color utilities
export {
  colorToKey,
  createColorKeySet,
  findDarkestColor,
  findDarkestInPalette,
  findDarkestValidColor,
  keyToColor
} from './color-utils'
// Ignored slot marker
export {
  IGNORED_SLOT,
  isIgnoredSlot,
  replaceIgnoredSlots
} from './ignored-slot'

// Palette filtering
export {
  filterByDistance,
  filterIgnored,
  truncatePalette
} from './palette-filtering'
// Quantization (CPC Classic 27 colors, CPC Plus 4096 colors)
export {
  quantifyToCPCPlus,
  quantizeArrayCPCClassic,
  quantizeArrayCPCPlus,
  quantizeArrayForHardware,
  quantizeColorCPCClassic,
  quantizeColorCPCPlus,
  quantizeColorForHardware,
  quantizeCPC,
  toCPCPlusLevel
} from './quantization'
// Slot management (locked state, empty detection)
export {
  countLockedEmptySlots,
  extractLockedColors,
  isLockedEmpty,
  isLockedWithColor,
  type PaletteSlot
} from './slot'

// ============================================================================
// Backward compatibility aliases
// ============================================================================

// Old name -> new name mappings for gradual migration
export {
  isColorTooClose as isColorTooCloseToLocked,
  perceptualDistance as perceptualColorDistance
} from './color-distance'
export { filterByDistance as filterPaletteByLockedColors } from './palette-filtering'
