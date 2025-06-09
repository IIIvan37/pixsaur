export type CpcModeKey =
  | '0'
  | '1'
  | '2'
  | '0-overscan'
  | '1-overscan'
  | '2-overscan'
// This file defines types and constants related to CPC modes and color adjustments.
export type CpcModeConfig = {
  overscan: boolean
  mode: 0 | 1 | 2
  width: number
  height: number
  nColors: number
  scaleX: number
  scaleY: number
}

export const CPC_MODE_CONFIG: Record<CpcModeKey, CpcModeConfig> = {
  '0': {
    overscan: false,
    mode: 0,
    width: 160,
    height: 200,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  },
  '1': {
    overscan: false,
    mode: 1,
    width: 320,
    height: 200,
    nColors: 4,
    scaleX: 1,
    scaleY: 1
  },
  '2': {
    overscan: false,
    mode: 2,
    width: 640,
    height: 200,
    nColors: 2,
    scaleX: 1,
    scaleY: 2
  },
  '0-overscan': {
    overscan: true,
    mode: 0,
    width: 48 * 2 * 2,
    height: 272,
    nColors: 16,
    scaleX: 2,
    scaleY: 1
  },
  '1-overscan': {
    overscan: true,
    mode: 1,
    width: 48 * 2 * 4,
    height: 272,
    nColors: 4,
    scaleX: 1,
    scaleY: 1
  },
  '2-overscan': {
    overscan: true,
    mode: 2,
    width: 48 * 2 * 8,
    height: 272,
    nColors: 2,
    scaleX: 1,
    scaleY: 2
  }
}

export type AdjustementKey =
  | 'red'
  | 'green'
  | 'blue'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'posterization'
