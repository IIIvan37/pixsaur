/**
 * SCR Loader Template Generator for Amstrad CPC
 * Generates Z80 assembly code to load and display a SCR file from disk
 */

/**
 * Options for SCR loader template
 */
export interface ScrLoaderTemplateOptions {
  /**
   * Filename of the SCR file on the DSK
   * Example: "IMAGE.SCR"
   */
  screenFilename: string

  /**
   * CPC graphics mode (0, 1, or 2)
   */
  mode: 0 | 1 | 2

  /**
   * Palette data (firmware color indices 0-26)
   * Array of 16 values for the 16 ink colors
   */
  palette: number[]

  /**
   * Include border color setting
   * Default: true
   */
  includeBorder?: boolean
}

/**
 * Generate ASM loader code for SCR file
 * This loader sets the palette, loads the SCR file, and displays it
 *
 * @param options - SCR loader template options
 * @returns Z80 assembly source code as string
 *
 * @example
 * ```typescript
 * const asmCode = generateScrLoaderTemplate({
 *   screenFilename: "IMAGE.SCR",
 *   mode: 1,
 *   palette: [0, 26, 6, 8, 24, 18, 2, 11, 26, 0, 6, 8, 24, 18, 2, 11]
 * })
 * ```
 */
export function generateScrLoaderTemplate(
  options: ScrLoaderTemplateOptions
): string {
  const { screenFilename, mode, palette, includeBorder = true } = options

  // Border color is palette[16] if present, otherwise palette[0]
  const borderColor = palette.length > 16 ? palette[16] : palette[0]

  return `
    org #8000
    run $

start:
    ; Set graphics mode
    ld a,${mode}
    call #bc0e          ; MC_SET_MODE

${
  includeBorder
    ? `    ; Set border color
    ld b,${borderColor}
    ld c,${borderColor}
    call #bc38          ; SCR_SET_BORDER
`
    : ''
}
    ; Set palette
    ld hl,palette_data
    ld b,16             ; 16 colors to set
    ld c,0              ; Start at pen 0
.palette_loop:
    ld a,c
    push bc
    push hl
    ld b,(hl)           ; Get firmware color index
    call #bc32          ; SCR_SET_INK
    pop hl
    pop bc
    inc hl
    inc c
    djnz .palette_loop

    ; Load SCR file to screen memory
    ld hl,filename
    ld de,#c000         ; Screen memory address
    ld bc,16384         ; SCR file size (16KB)
    call load_file
    
    ; Wait for key press
.wait_key:
    call #bb06          ; KM_READ_CHAR
    jr nc,.wait_key
    
    ret

; Load file from disk
; HL = filename address
; DE = load address
; BC = file size
load_file:
    ; TODO: Implement CAS_IN_OPEN / CAS_IN_DIRECT / CAS_IN_CLOSE
    ; For now, assume file is already loaded at #c000
    ret

palette_data:
${palette.map((color, index) => `    db ${color}              ; Ink ${index}`).join('\n')}

filename:
    db "${screenFilename}",0

end start
`
}
