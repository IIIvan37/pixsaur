export type CpcModeKey = '0' | '1' | '2'
export type CpcModeConfig = {
  mode: 0 | 1 | 2
  width: number
  nColors: number
  scaleX: number
  scaleY: number
}

export const CPC_MODE_CONFIG: Record<CpcModeKey, CpcModeConfig> = {
  '0': { mode: 0, width: 160, nColors: 16, scaleX: 2, scaleY: 1 },
  '1': { mode: 1, width: 320, nColors: 4, scaleX: 1, scaleY: 1 },
  '2': { mode: 2, width: 640, nColors: 2, scaleX: 1, scaleY: 2 }
}

export type AdjustementKey =
  | 'red'
  | 'green'
  | 'blue'
  | 'brightness'
  | 'contrast'
  | 'saturation'
