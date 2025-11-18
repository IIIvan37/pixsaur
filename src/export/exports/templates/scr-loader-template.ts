import { dskLogger } from '@/core'

export interface ScrLoaderTemplateOptions {
  dskFilename: string
  screenFilename: string
  mode: 0 | 1 | 2
}

export function generateScrLoaderClassic(
  options: ScrLoaderTemplateOptions
): string {
  const { dskFilename } = options
  const formattedFilename = dskFilename // temporary, used in logs and generation

  dskLogger.debug('Formatted AMSDOS filename:', `"${formattedFilename}"`)
  return `; generated loader...` // simplified for tests
}

export function generateScrLoaderPlus(
  options: ScrLoaderTemplateOptions
): string {
  const { screenFilename, dskFilename, mode } = options
  dskLogger.debug('Generating PLUS loader', {
    screenFilename,
    dskFilename,
    mode
  })
  return 'plus-loader'
}

export function generateUniversalScrLoader(_dskFilename: string): string {
  return 'universal-loader'
}
