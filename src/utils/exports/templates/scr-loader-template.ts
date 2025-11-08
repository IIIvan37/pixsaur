/*
 * SCR Loader Template Generator for Amstrad CPC
 * Generates Z80 assembly code to load and display a SCR file from disk
 *
 * Note: The SCR file already contains the palette data and mode injected at specific offsets:
 * - Classic: offset 2000 (border), 2001-2016 (firmware), 2017-2033 (hardware), 2034 (mode)
 * - Plus: offset 2000 (border), 2001-2032 (CPC+ palette values), 2034 (mode)
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
 * Generate ASM loader code for CPC Classic SCR file
 * The SCR file contains palette data at offset 2000 and mode at offset 2034
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
buffer equ #3800        ; Temporary buffer (#4000 - 2048 = #3800)
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
/**
 * Generate ASM universal loader code for CPC Classic and CPC Plus SCR files
 * This loader accepts a filename parameter from BASIC and auto-detects format
 *
 * Usage from BASIC:
 *   CALL &8000, @"IMG00001.SCR"
 *
 * The loader will:
 * - Load the SCR file specified by the filename parameter
 * - Auto-detect CPC Classic or CPC Plus format (via hardware byte at offset 2035)
 * - Set the appropriate graphics mode (read from offset 2034)
 * - Apply the palette from the SCR file (firmware for Classic, hardware for Plus)
 * - Display the image
 *
 * SCR Format (offsets 2000-2047 in first 2KB block):
 * - 2000-2033: Palette data (format depends on hardware type)
 * - 2034: Graphics mode (0, 1, or 2)
 * - 2035: Hardware type (0=Classic, 1=Plus)
 * - 2036-2047: Reserved/unused
 *
 * @param dskFilename - The DSK filename to save the loader to
 * @returns Z80 assembly source code as string
 */
export function generateUniversalScrLoader(dskFilename: string): string {
  return `
;; Universal SCR Loader for Amstrad CPC Classic & CPC Plus
;; Can load any SCR file with filename passed as parameter from BASIC
;; Auto-detects Classic vs Plus format via hardware byte at offset 2035
;;
;; Usage from BASIC:
;;   CALL &8000, @"IMG00001.SCR"
;;   CALL &8000, @"IMG00002.SCR"
;;   etc.

;; Firmware functions
cas_in_open equ #bc77       ; open a file for reading
cas_in_direct equ #bc83     ; read entire file
cas_in_close equ #bc7a      ; close file
scr_set_mode equ #bc0e      ; set graphics mode
scr_set_border equ #bc38    ; set border color
scr_set_ink equ #bc32       ; set ink color
km_wait_char equ #bb06      ; wait for a key press

;; CPC Plus hardware addresses
pen0_addr equ #6400         ; Pen 0 register
border_addr equ #6420       ; Border register

;; Memory layout
data equ #4000              ; SCR file loaded here temporarily

    org #8000               ; loader address (avoid #4000-#4FFF used by ASIC sprites)
    
start:
    ;; Get filename parameter passed from BASIC
    ;; When called with CALL &4000, @a$
    ;; A register = number of parameters (should be 1)
    ;; DE register = address of string descriptor (last parameter)
    
    ;; Check we have at least 1 parameter
    cp 1
    ret nz                   ; return if no parameters
    
    ;; DE contains the address of a 3-byte descriptor:
    ;; Byte 0: string length
    ;; Byte 1: low byte of string data address
    ;; Byte 2: high byte of string data address
    
    ex de, hl               ; HL = address of string descriptor
    
    ld b, (hl)              ; B = string length (1st byte)
    inc hl
    ld e, (hl)              ; E = low byte of string data
    inc hl
    ld d, (hl)              ; D = high byte of string data
    
    ;; Save filename info (DE = address of string characters)
    ex de, hl               ; HL = string data address
 
    ;; Load the file
    call load_file
    ret c                   ; return if error (carry set)
    
    ;; File loaded successfully, now set mode and display it
    jp display_screen

load_file:
    ;; B = length of filename
    ;; HL = address of filename
   
    ;; DE = buffer address (not used by CAS IN DIRECT in disc mode)
    ld de, #4000
    
    ;; Open file for reading
    call cas_in_open
    ret nc                  ; return with carry clear if error
    
    ;; Load file to #4000
    ld hl, data
    call cas_in_direct
    
    ;; Close file
    call cas_in_close
    
    ;; Read graphics mode from offset 2034 and set it BEFORE copying to screen
    ;; (changing mode clears the screen)
    ld a, (data + 2034)
    call scr_set_mode
    
    ;; Copy from #4000 to screen memory #c000
    ld hl, data             ; Source: #4000
    ld de, #c000            ; Dest: screen memory
    ld bc, #4000            ; 16KB
    ldir
    
    or a                    ; clear carry to indicate success
    ret

display_screen:
    ;; Check hardware type at offset 2035 (0=Classic, 1=Plus)
    ;; Note: image is now at #c000 (screen memory)
    ld a, (#c000 + 2035)
    cp 1
    jr z, plus_format       ; hardware type = 1, use Plus loader
    
    ;; Fall through to classic_format

classic_format:
    ;; CPC Classic format: use firmware functions
    
    ;; Set border color (at offset 2000)
    ld hl, #c000 + 2000
    ld b, (hl)
    ld c, b
    call scr_set_border
    
    ;; Set palette (16 colors at offset 2001-2016)
    ;; Note: In mode 0, palette is reorganized in SCR file
    ;; We read from last to first (2016->2001) using pen 15->0
    ld b, #10               ; 16 colors
    ld hl, #c000+2000+16    ; start from last color
classic_palette_loop:
    push hl
    push bc
    ld a, b                 ; pen number from b
    dec a                   ; b-1 (16->15, 15->14, etc.)
    and #0f                 ; ensure 0-15 range
    ld b, (hl)              ; color value
    ld c, b
    call scr_set_ink        ; set ink(pen=A, color=BC)
    pop bc
    pop hl
    dec hl                  ; previous color (going backwards)
    djnz classic_palette_loop
    jr end_display

plus_format:
    ;; CPC Plus format: use hardware palette registers
    
    ;; Unlock ASIC (sequence of 17 bytes to port #BC00)
    di                      ; disable interrupts
    ld e, 17                ; 17 bytes to send
    ld hl, asic_unlock_seq
    ld bc, #bc00
unlock_loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, unlock_loop
    
    ;; Activate CPC Plus functions
    ld bc, #7fb8
    out (c), c
    
    ;; Set CPC Plus hardware palette
    ;; Border color at offset 2000-2001 (16-bit little-endian)
    ld hl, (#c000 + 2000)   ; Load border color value
    ld (#6420), hl          ; Write to border register
    
    ;; Palette colors at offset 2002-2033 (16 colors × 2 bytes = 32 bytes)
    ld hl, #c000 + 2002     ; Source: palette data in SCR
    ld de, #6400            ; Dest: Pen 0 register
    ld bc, 32               ; 16 colors × 2 bytes
    ldir                    ; Copy all palette colors
    
    ;; Lock ASIC (disable CPC Plus functions)
    ld bc, #7fa0
    out (c), c
    
end_display:
.end
    jr .end

;; ASIC unlock sequence (17 bytes)
asic_unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238

    SAVE 'LOADER.BIN', start, $ - start, DSK, '${dskFilename}'
`
}

export function generateScrLoaderPlus(
  options: ScrLoaderTemplateOptions
): string {
  const { dskFilename, screenFilename, mode } = options

  // CPC Plus loader - not yet fully implemented
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
