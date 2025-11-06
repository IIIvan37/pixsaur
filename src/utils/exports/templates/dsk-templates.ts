/**
 * DSK Template Generators for Amstrad CPC
 * Each function generates Z80 assembly code for a specific file type on the DSK
 */

/**
 * Options for SCR file template on DSK
 */
export interface ScrDskTemplateOptions {
  /**
   * Filename of the SCR ASM file to include (without path)
   * Example: "pixsaur_data.asm"
   */
  scrAsmFilename: string

  /**
   * Label name used in the SCR ASM file
   * Example: "pixsaur_data"
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
 * This template includes the SCR ASM file and uses RASM's SAVE directive
 *
 * @param options - SCR DSK template options
 * @returns Z80 assembly source code as string
 *
 * @example
 * ```typescript
 * const asmCode = generateScrDskTemplate({
 *   scrAsmFilename: "pixsaur_data.asm",
 *   scrLabel: "pixsaur_data",
 *   dskFilename: "pixsaur.dsk",
 *   screenFilename: "IMAGE.SCR"
 * })
 * ```
 */
export function generateScrDskTemplate(options: ScrDskTemplateOptions): string {
  const { scrAsmFilename, scrLabel, dskFilename, screenFilename } = options

  return `
    start
    include "${scrAsmFilename}"

    SAVE '${screenFilename}', ${scrLabel}, $ - start, DSK, '${dskFilename}'
  `
}
