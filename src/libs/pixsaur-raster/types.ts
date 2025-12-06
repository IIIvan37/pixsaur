import type { Vector } from '../pixsaur-color/src/type'

/**
 * A raster range defines a zone where an ink color is changed
 */
export interface RasterRange {
  /** Unique identifier for the range */
  id: string
  /** Start line (0-based, inclusive) */
  startLine: number
  /** End line (inclusive) */
  endLine: number
  /** Ink index to modify (0-15) */
  inkIndex: number
  /** Target RGB color */
  color: Vector<'RGB'>
}

/**
 * Raster configuration
 */
export interface RasterConfig {
  enabled: boolean
  ranges: RasterRange[]
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
