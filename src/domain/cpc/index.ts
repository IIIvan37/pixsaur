/**
 * CPC Domain Module
 *
 * Centralized CPC-specific logic following ISP (Interface Segregation Principle):
 * - quantization: CPC Classic/Plus color quantization
 * - slot: Palette slot state management (locked/unlocked)
 * - color-distance: Perceptual color distance calculations
 * - palette-filtering: Filtering palettes by various criteria
 * - ignored-slot: Special ignored slot marker handling
 */

// Color utilities (generic ones live in pixsaur-color, re-exported here
// to keep the public @/domain/cpc API stable)
export {
  colorToKey,
  createColorKeySet,
  keyToColor
} from '@/libs/pixsaur-color/src/utils/color-key'
export {
  findDarkestColor,
  findDarkestInPalette
} from '@/libs/pixsaur-color/src/utils/luminance'
// Color distance calculations
export {
  areColorsSimilar,
  DEFAULT_PERCEPTUAL_THRESHOLD,
  isColorTooClose,
  perceptualDistance
} from './color-distance'
// Hardware palettes (27-color classic, 4096-color Plus)
export {
  cpcFullPalette,
  cpcPalette,
  generateAmstradCPCPalette,
  generateCPCPlusPalette,
  getPaletteForHardware,
  vectorToHex
} from './cpc-palette'
// Ignored slot marker
export {
  findDarkestValidColor,
  IGNORED_SLOT,
  isIgnoredSlot,
  replaceIgnoredSlots
} from './ignored-slot'
// Mode configuration (source of truth for mode 0/1/2 dims and color counts)
export {
  buildCpcModeKey,
  buildCustomModeConfig,
  CPC_MODE_CONFIG,
  type CpcModeConfig,
  type CpcModeKey,
  type CustomDimensions,
  type DimensionPreset,
  type PixelMode,
  parseCpcModeKey
} from './mode-config'

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
