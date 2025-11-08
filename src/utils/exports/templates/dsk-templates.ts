/**
 * DSK Template Generators for Amstrad CPC
 * Each function generates Z80 assembly code for a specific file type on the DSK
 */

/**
 * Options for SCR file template on DSK
 */
export interface ScrDskTemplateOptions {
  /**
   * Filename of the binary SCR file to include (without path)
   * Example: "image1.bin"
   */
  scrBinFilename: string

  /**
   * Label name for the screen data
   * Example: "image1"
   */
  scrLabel: string

  /**
   * Output DSK filename
   * Example: "pixsaur.dsk"
   */
  dskFilename: string

  /**
   * Filename for the screen data on the DSK
   * Example: "IMAGE.SCR"
   */
  screenFilename: string
}

/**
 * Generate ASM template for saving SCR data to DSK
 * This template includes the SCR binary file using INCBIN and uses RASM's SAVE directive
 *
 * @param options - SCR DSK template options
 * @returns Z80 assembly source code as string
 *
 * @example
 * ```typescript
 * const asmCode = generateScrDskTemplate({
 *   scrBinFilename: "image1.bin",
 *   scrLabel: "image1",
 *   dskFilename: "pixsaur.dsk",
 *   screenFilename: "IMAGE1.SCR"
 * })
 * ```
 */
export function generateScrDskTemplate(options: ScrDskTemplateOptions): string {
  const { scrBinFilename, scrLabel, dskFilename, screenFilename } = options

  return `
${scrLabel}:
    incbin "${scrBinFilename}"
${scrLabel}_end:

    SAVE '${screenFilename}', ${scrLabel}, ${scrLabel}_end - ${scrLabel}, DSK, '${dskFilename}'
  `
}
