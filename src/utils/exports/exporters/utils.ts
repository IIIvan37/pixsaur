import type { CpcModeConfig } from '@/app/store/config/types'
import { getPixelsPerByte } from '@/utils/cpc-calculations'

export function getHeader(
  modeConfig: CpcModeConfig,
  type: string,
  isCPCPlus: boolean
): string {
  const pixelsPerByte = getPixelsPerByte(modeConfig.mode)
  const hardwareType = isCPCPlus ? 'CPC+' : 'CPC Classic'
  const paletteInfo =
    type === 'SCR'
      ? `; Palette data injected at offset 2000 (border at 2000, firmware colors at 2001-2016, hardware colors at 2017-2033)\n`
      : ''
  return `; ${type} Data created with Pixsaur - ${hardwareType}
; Mode ${modeConfig.mode} ${modeConfig.overscan ? 'Overscan' : ''} 
; ${modeConfig.width}x${modeConfig.height} pixels, ${modeConfig.width / pixelsPerByte}x${modeConfig.height} bytes.
${paletteInfo}\n`
}
