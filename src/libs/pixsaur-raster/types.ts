import type { Vector } from '../pixsaur-color/src/type'

/**
 * A raster change defines a point where an ink color is changed.
 * The color persists until another change on the same ink.
 */
export interface RasterChange {
  /** Unique identifier for the change */
  id: string
  /** Line where the change occurs (0-based) */
  line: number
  /** Ink index to modify (0-15) */
  inkIndex: number
  /** Target RGB color */
  color: Vector<'RGB'>
}

/**
 * @deprecated Use RasterChange instead. Kept for backward compatibility.
 */
export type RasterRange = RasterChange

/**
 * Raster configuration
 */
export interface RasterConfig {
  enabled: boolean
  changes: RasterChange[]
}

/**
 * Classic raster change (for export)
 */
export interface ClassicRasterChange {
  inkIndex: number
  gaColor: number // 0-31
}

/**
 * Plus raster change (for export)
 */
export interface PlusRasterChange {
  inkIndex: number
  cpcPlusColor16: number // 0-4095
}

/**
 * A line of raster changes
 */
export type ClassicRasterLine = ClassicRasterChange[]
export type PlusRasterLine = PlusRasterChange[]

/**
 * Raster data for export
 */
export type RasterData =
  | {
      hardware: 'classic'
      lines: ClassicRasterLine[]
    }
  | {
      hardware: 'plus'
      lines: PlusRasterLine[]
    }
