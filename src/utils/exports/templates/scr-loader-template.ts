/**
 * SCR Loader Template Generator for Amstrad CPC
 * Generates Z80 assembly code to load and display a SCR file from disk
 *
 * Note: The SCR file already contains the palette data injected at specific offsets:
 * - Classic: offset 2000 (border), 2001-2016 (firmware), 2017-2033 (hardware)
 * - Plus: offset 2000 (border), 2001-2032 (CPC+ palette values)
 */

/**
 * Options for SCR loader template
 */
export interface ScrLoaderTemplateOptions {
  /**
   * Output DSK filename
   * Example: "pixsaur.dsk"
   */
  dskFilename: string

  /**
   * Filename of the SCR file on the DSK
   * Example: "IMAGE.SCR"
   */
  screenFilename: string

  /**
   * CPC graphics mode (0, 1, or 2)
   */
  mode: 0 | 1 | 2
}

/**
 * Format filename for CPC AMSDOS (8.3 format with spaces)
 * Name: 8 chars max, Extension: 3 chars max
 * Example: "IMAGE.SCR" -> "IMAGE   SCR"
 */
function formatAmsdosFilename(filename: string): string {
  // Split name and extension
  const lastDot = filename.lastIndexOf('.')
  let name = ''
  let ext = ''

  if (lastDot === -1) {
    name = filename
  } else {
    name = filename.substring(0, lastDot)
    ext = filename.substring(lastDot + 1)
  }

  // Pad name to 8 characters
  name = name.substring(0, 8).padEnd(8, ' ')
  // Pad extension to 3 characters
  ext = ext.substring(0, 3).padEnd(3, ' ')

  return name + ext
}

/**
 * Generate ASM loader code for CPC Classic SCR file
 * The SCR file contains palette data at offset 2000
 *
 * @param options - SCR loader template options
 * @returns Z80 assembly source code as string
 */
export function generateScrLoaderClassic(
  options: ScrLoaderTemplateOptions
): string {
  const { dskFilename, screenFilename, mode } = options
  const formattedFilename = screenFilename

  console.log('Formatted AMSDOS filename:', `"${formattedFilename}"`)
  return `
;; firmware function to open a file for reading
buffer equ start - 2048
cas_in_open equ #bc77
;; firmware function to read an entire file (must have a AMSDOS header)
;; the file must have been opened for reading
cas_in_direct equ #bc83
;; firmware function to close a file opened for reading
cas_in_close equ #bc7a

    org  #4000     ; start of code
start:
    call load_file


    ld  a, ${mode}		; graphics mode
    call #bc0e		; SCR_SET_MODE
; set border color
    ld  hl, data+2000
    ld  b, (hl)
    ld  c, b
    call #bc38		; SCR_SET_BORDER
    ld  b, #10		; loop counter
; read palette from memory
    ld  hl, data+2000+16
Loop1:
    push hl
    push bc
    ld  a, b
    dec a
    and #0f
    ld  b, (hl)
    ld  c, b
    call #bc32		; SCR_SET_INK
    pop bc
    pop hl
    dec hl
    djnz Loop1

; set image bytes
    ld	de, #c000   ; DE = screen
    ld	hl, data     ; HL = image data
    ld 	bc, #4000   ; BC = # of bytes
    ldir            ; copy

    ret

load_file
;; B = length of the filename in characters
ld b, end_filename-filename

;; HL = address of the start of the filename
ld hl, filename

;; DE = address of a 2k buffer
;; 
;; in disc mode: this buffer is not used when CAS IN DIRECT
;; firmware function is used, so it is safe to put it anywhere
;; you want.
ld de, buffer

;; firmware function to open a file for reading
call cas_in_open

;; cas_in_open returns:
;; if file was opened successfully:
;; - carry is true 
;; - HL contains address of the file's AMSDOS header
;; - DE contains the load address of the file (from the header)
;; - BC contains the length of the file (from the file header)
;; - A contains the file type (2 for binary files)

;; firmware function to load the entire file
;; this will work with files that have a AMSDOS header (ASCII
;; files do not have a header)

;; HL = load address

ld hl,data
;; read file
call cas_in_direct

;; firmware function to close a file opened for reading
jp cas_in_close


;; the filename to load
;; disc filenames are 11 characters (8.3 format with spaces)
;; 8 characters for name, and 3 characters for extension
filename
defb "${formattedFilename}"
end_filename


data:
   
    SAVE 'LOADER.BIN', start, $ - start, DSK, '${dskFilename}'
`
}

/**
 * Generate ASM loader code for CPC Plus SCR file
 * The SCR file contains CPC+ palette data at offset 2000
 *
 * @param options - SCR loader template options
 * @returns Z80 assembly source code as string
 */
export function generateScrLoaderPlus(
  options: ScrLoaderTemplateOptions
): string {
  const { dskFilename, screenFilename, mode } = options

  // TODO: Add your ASM code here
  return `
    org #8000
    run $

start:
    ; Set graphics mode
    ld a,${mode}
    call #bc0e          ; MC_SET_MODE

    ; TODO: Load SCR file and extract CPC+ palette from offset 2000
    ; TODO: Set border color from palette[0]
    ; TODO: Set 16 ink colors from palette[1-16] (CPC+ hardware registers)
    ; TODO: Copy screen data to #C000

    ret

dsk_filename:
    db "${dskFilename}",0

filename:
    db "${screenFilename}",0

end start
`
}
