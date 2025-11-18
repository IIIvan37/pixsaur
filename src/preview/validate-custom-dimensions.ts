import { getPixelsPerByte, getWidthStepForMode } from '@/export'

export type CpcMode = 0 | 1 | 2

export interface ValidationResult {
  valid: boolean
  bytes: number
  kb: number
  errors: string[]
}

export function validateCustomDimensions(
  width: number,
  height: number,
  mode: CpcMode
): ValidationResult {
  const errors: string[] = []
  const widthStep = getWidthStepForMode(mode)
  const pixelsPerByte = getPixelsPerByte(mode)

  if (width % widthStep !== 0) {
    errors.push(`Largeur doit être multiple de ${widthStep}`)
  }

  const widthInBytes = width / pixelsPerByte
  if (widthInBytes % 2 !== 0) {
    errors.push(`Largeur en octets (${widthInBytes}) doit être paire`)
  }

  if (height % 8 !== 0) {
    errors.push('Hauteur doit être multiple de 8')
  }

  const totalBytes = widthInBytes * height
  const totalKb = totalBytes / 1024

  if (totalBytes > 65536) {
    errors.push(`Mémoire ${totalKb.toFixed(2)} Ko dépasse 64 Ko`)
  }

  return {
    valid: errors.length === 0,
    bytes: totalBytes,
    kb: totalKb,
    errors
  }
}
