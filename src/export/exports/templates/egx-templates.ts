/**
 * EGX (Extended Graphics) Template Generators for Amstrad CPC
 *
 * Generates Z80 assembly code for displaying EGX images.
 * EGX alternates video modes line by line:
 * - EGX1: Alternates Mode 0 (16 colors) and Mode 1 (4 colors) = up to 16 colors
 * - EGX2: Alternates Mode 1 (4 colors) and Mode 2 (2 colors) = up to 4 colors
 */

import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'
import type { CPCHardware } from '@/libs/types'

// =============================================================================
// Types
// =============================================================================

export interface EgxSnaTemplateOptions {
  /** EGX configuration */
  egxConfig: EGXConfig
  /** Image height (typically 200 for standard, 280 for overscan) */
  height: number
  /** CPC hardware type (classic or plus) */
  hardware?: CPCHardware
  /** Whether this is overscan mode */
  overscan?: boolean
}

export interface EgxDataFiles {
  /** Palette ASM data - hardware format for Classic, 12-bit for Plus */
  paletteAsm: string
  /** Image data ASM (label: ImageData) - SCR format for standard, linear chunks for overscan */
  imageAsm: string
  /** Second chunk for overscan (linear format) */
  imageAsm2?: string
}

// =============================================================================
// Common ASM Code Sections for Overscan
// =============================================================================

/**
 * Sync routines for precise VBL timing (overscan)
 */
const EGX_SYNC_ROUTINES = `
;------------------------------------------------------------------------------
; Sync VBL - Wait for vertical blank with precise timing
;------------------------------------------------------------------------------
sync_vbl:
    di
    ld b, #f5
    ld hl, 19968-23
    ld de, -11
sync_wvblon1:
    in a, (c)
    rra
    jr nc, sync_wvblon1
sync_wvbloff1:
    in a, (c)
    rra
    jr c, sync_wvbloff1
sync_wvblon2:
    in a, (c)
    rra
    jr nc, sync_wvblon2
sync_wvbloff2:
    add hl, de
    in a, (c)
    rra
    jr c, sync_wvbloff2
    ex de, hl
    call wait_usec

sync_derive_bcl:
    ld b, #f5
    in a, (c)
    rra
    jr c, sync_first
    ld de, 19969-20
    call wait_usec
    jr sync_derive_bcl
sync_first:
    ld de, 19968-11
    jp wait_usec

;------------------------------------------------------------------------------
; Wait DE microseconds
;------------------------------------------------------------------------------
wait_usec:
    ld hl, sync_adjust
    ld b, 0
    ld a, e
    and %111
    ld c, a
    sbc hl, bc
    srl d
    rr e
    srl d
    rr e
    srl d
    rr e
    dec de
    dec de
    dec de
    dec de
    dec de
    nop
wait_usec_01:
    dec de
    ld a, d
    or e
    nop
    jp nz, wait_usec_01
    jp (hl)
    nop
    nop
    nop
    nop
    nop
    nop
    nop
sync_adjust:
    ret
`

/**
 * Overscan display routines (CRTC config, screen display, address calculation)
 */
const EGX_OVERSCAN_ROUTINES = `
;------------------------------------------------------------------------------
; Overscan Constants
;------------------------------------------------------------------------------
R1              equ 48

;------------------------------------------------------------------------------
; Display screen routine (Overscan)
;------------------------------------------------------------------------------
affscr:
    ld b, 0
    ld c, R1 * 2
    ld de, #0140
    ld hl, #4268
    call .bclt1
    ld b, 280 - 256

.bclt1:
    push de
    push bc
    ld b, #00
    ldir
    pop bc
    pop de

    push hl
    ex de, hl
    call adinfuni
    ld a, h
    or a
    jr nz, .okaff
    ld h, #40
.okaff:
    ex de, hl
    pop hl
    djnz .bclt1
    ret

;------------------------------------------------------------------------------
; Output to CRTC
;------------------------------------------------------------------------------
outcrtc:
    ld bc, #bc00

bcloutc:
    ld a, (hl)
    cp #ff
    ret z
    out (c), c
    inc b
    out (c), a
    dec b
    inc c
    inc hl
    jr bcloutc

;------------------------------------------------------------------------------
; Address calculation for overscan
;------------------------------------------------------------------------------
adinfuni:
    ld a, h
    add a, #08
    ld h, a
    and #38
    ret nz
    ld a, h
    sub #40
    ld h, a
    ld a, l
    add a, R1 * 2
    ld l, a
    ret nc
    inc h
    ld a, h
    and #07
    ret nz
    ld a, h
    sub #08
    ld h, a
    ret

;------------------------------------------------------------------------------
; CRTC register values for overscan (96 bytes/line, 280 lines)
;------------------------------------------------------------------------------
tovercrt:
    db #3f, R1, #32, #06, #26, #00, #21, #23
    db #00, #07, #00, #00, #0c, 160, #ff
`

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the mode register values for EGX type (without # prefix)
 */
function getEgxModeValues(type: EGXType): {
  lowMode: string
  highMode: string
} {
  if (type === 'egx1') {
    return { lowMode: '8c', highMode: '8d' } // Mode 0 / Mode 1
  } else {
    return { lowMode: '8d', highMode: '8e' } // Mode 1 / Mode 2
  }
}

/**
 * Get number of colors for EGX type (as hex string)
 */
function getEgxColorCountHex(type: EGXType): string {
  return type === 'egx1' ? '10' : '04' // 16 or 4 in hex
}

// =============================================================================
// Template Generator
// =============================================================================

/**
 * Generate SNA template for CPC Classic EGX (200 lines)
 *
 * The EGX technique uses precise timing to switch video mode every line.
 * This creates a display that alternates between two modes spatially
 * (no flickering like temporal mixing).
 */
export function generateEgxSnaTemplate(options: EgxSnaTemplateOptions): string {
  const { egxConfig, height } = options
  const { lowMode, highMode } = getEgxModeValues(egxConfig.type)
  const colorCountHex = getEgxColorCountHex(egxConfig.type)

  // Determine initial mode based on firstLineMode
  const firstMode = egxConfig.firstLineMode === 'low' ? lowMode : highMode
  const secondMode = egxConfig.firstLineMode === 'low' ? highMode : lowMode

  const egxTypeLabel = egxConfig.type === 'egx1' ? '1' : '2'
  const modesDesc =
    egxConfig.type === 'egx1' ? 'Mode 0/Mode 1' : 'Mode 1/Mode 2'
  const firstLineDesc =
    egxConfig.firstLineMode === 'low' ? 'Low-res' : 'High-res'
  const linePairs = Math.floor(height / 2)

  return `BUILDSNA
BANKSET 0

    org #8000
    run #8000

;------------------------------------------------------------------------------
; EGX${egxTypeLabel} Display Routine
; Alternates ${modesDesc} every scanline
; First line: ${firstLineDesc}
;------------------------------------------------------------------------------

    di
    ld hl, #c9fb
    ld (#38), hl
    ld sp, #c000
    ei

    ; Set initial video mode (use #7c for gate array select)
    ld bc, #7c${firstMode}
    out (c), c

    ; Set palette
    ld hl, Palette_Hardware
    call setPalette

;------------------------------------------------------------------------------
; Main Loop - Wait for VBlank and run EGX line switching
;------------------------------------------------------------------------------
wait_vblank:
    ei
    halt

    ; Wait for VSync
    ld b, #f5
.wait:
    in a, (c)
    rra
    jr nc, .wait

    ; Extra halts for timing
    halt
    halt

    di

    ; Timing adjustment to start at first visible line
    ; 17 CRTC lines x 64 us = top border
    ds 17 * 64

    ; EGX line switching loop
    ld b, #7f
    ld hl, #${firstMode}${secondMode}  ; H=first mode, L=second mode
    ld e, ${linePairs}  ; Number of line pairs

.egx_loop:
    out (c), h         ; Switch to first mode (line N)
    ds 60              ; Wait ~60 NOPs (rest of line)
    out (c), l         ; Switch to second mode (line N+1)
    ds 60 - 4          ; Wait (minus loop overhead)
    dec e
    jp nz, .egx_loop

    jp wait_vblank

;------------------------------------------------------------------------------
; Set Palette Routine
; HL = pointer to palette data (hardware format)
;------------------------------------------------------------------------------
setPalette:
    xor a
    ld bc, #7f${colorCountHex}
.loop:
    out (c), a
    inc b
    outi
    inc a
    cp c
    jr nz, .loop
    ret
`
}

/**
 * Generate SNA template for CPC Plus EGX (200 lines)
 *
 * Uses ASIC unlock and 12-bit palette registers.
 */
export function generateEgxPlusSnaTemplate(
  options: EgxSnaTemplateOptions
): string {
  const { egxConfig, height } = options
  const { lowMode, highMode } = getEgxModeValues(egxConfig.type)

  // Determine initial mode based on firstLineMode
  const firstMode = egxConfig.firstLineMode === 'low' ? lowMode : highMode
  const secondMode = egxConfig.firstLineMode === 'low' ? highMode : lowMode

  const egxTypeLabel = egxConfig.type === 'egx1' ? '1' : '2'
  const modesDesc =
    egxConfig.type === 'egx1' ? 'Mode 0/Mode 1' : 'Mode 1/Mode 2'
  const firstLineDesc =
    egxConfig.firstLineMode === 'low' ? 'Low-res' : 'High-res'
  const linePairs = Math.floor(height / 2)

  return `BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3
SNASET CPC_TYPE, 4

    org #8000
    run #8000

;------------------------------------------------------------------------------
; EGX${egxTypeLabel} Display Routine (CPC Plus)
; Alternates ${modesDesc} every scanline
; First line: ${firstLineDesc}
;------------------------------------------------------------------------------

    di
    ld hl, #c9fb
    ld (#38), hl
    ld sp, #c000
    ei

    ; Unlock and activate ASIC
    call Asic_unlock
    call Asic_activate

    ; Set CPC Plus palette (12-bit colors)
    ; Border color at #6420-#6421
    ld hl, (Palette_Plus)
    ld (#6420), hl

    ; Palette colors at #6400-#641F (16 colors × 2 bytes)
    ld hl, Palette_Plus
    ld de, #6400
    ld bc, 32
    ldir

    ; Set initial video mode
    ld bc, #7c${firstMode}
    out (c), c

;------------------------------------------------------------------------------
; Main Loop - Wait for VBlank and run EGX line switching
;------------------------------------------------------------------------------
wait_vblank:
    ei
    halt

    ; Wait for VSync
    ld b, #f5
.wait:
    in a, (c)
    rra
    jr nc, .wait

    ; Extra halts for timing
    halt
    halt

    di

    ; Timing adjustment to start at first visible line
    ; 17 CRTC lines x 64 us = top border
    ds 17 * 64

    ; EGX line switching loop
    ld b, #7f
    ld hl, #${firstMode}${secondMode}  ; H=first mode, L=second mode
    ld e, ${linePairs}  ; Number of line pairs

.egx_loop:
    out (c), h         ; Switch to first mode (line N)
    ds 60              ; Wait ~60 NOPs (rest of line)
    out (c), l         ; Switch to second mode (line N+1)
    ds 60 - 4          ; Wait (minus loop overhead)
    dec e
    jp nz, .egx_loop

    jp wait_vblank

;------------------------------------------------------------------------------
; ASIC Unlock Routine
;------------------------------------------------------------------------------
Asic_unlock:
    di
    ld e, 17
    ld hl, unlock_seq
    ld bc, #bc00
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, .loop
    ret

unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238

;------------------------------------------------------------------------------
; ASIC Activate/Deactivate
;------------------------------------------------------------------------------
Asic_activate:
    ld bc, #7fb8
    out (c), c
    ret

Asic_deactivate:
    ld bc, #7fA0
    out (c), c
    ret
`
}

/**
 * Generate SNA template for CPC Classic EGX Overscan (280 lines)
 *
 * Uses overscan CRTC configuration and linear image data.
 * The EGX technique switches video mode every line using precise timing.
 */
export function generateEgxOverscanSnaTemplate(
  options: EgxSnaTemplateOptions
): string {
  const { egxConfig, height } = options
  const { lowMode, highMode } = getEgxModeValues(egxConfig.type)

  // Determine initial mode based on firstLineMode
  const firstMode = egxConfig.firstLineMode === 'low' ? lowMode : highMode

  const egxTypeLabel = egxConfig.type === 'egx1' ? '1' : '2'
  const modesDesc =
    egxConfig.type === 'egx1' ? 'Mode 0/Mode 1' : 'Mode 1/Mode 2'
  const firstLineDesc =
    egxConfig.firstLineMode === 'low' ? 'Low-res' : 'High-res'
  const linePairs = Math.floor(height / 2)

  // Conditional for firstLineMode
  const loResFirstValue = egxConfig.firstLineMode === 'low' ? '1' : '0'

  return `BUILDSNA
BANKSET 0

LO_RES_FIRST=${loResFirstValue}

;------------------------------------------------------------------------------
; EGX${egxTypeLabel} Overscan Display Routine
; Alternates ${modesDesc} every scanline
; First line: ${firstLineDesc}
; Height: ${height} lines (${linePairs} line pairs)
;------------------------------------------------------------------------------

    org     #b000
    run     #b000
    di
    ld      sp, #b000
    ld      hl, tovercrt         ; Switch CRTC to 96 columns, ${height} lines
    call    outcrtc
    call    affscr               ; Display the screen

    ld bc, #7c${firstMode}
    out (c), c

    ld hl, Palette_Hardware
    ld c, 16
    xor a
    call setPalette

    call sync_vbl
    nop 10

;------------------------------------------------------------------------------
; Main Loop
;------------------------------------------------------------------------------
main_loop:
    ld hl, Palette_Hardware
    ld c, 16
    xor a
    call setPalette
    ld de, 26 * 64 - 40
    call wait_usec

    ld b, #7f
IF LO_RES_FIRST
    ld hl, #${lowMode}${highMode}
ELSE
    ld hl, #${highMode}${lowMode}
ENDIF
    ld e, ${linePairs}
.egx_loop:
    out (c), h
    ds 60
    out (c), l
    ds 60 - 4
    dec e
    jp nz, .egx_loop

    ld de, 1 * 64 - 8 + 87
    call wait_usec
    jp main_loop

;------------------------------------------------------------------------------
; Set Palette Routine
; HL = pointer to palette data (hardware format)
; C = number of colors
;------------------------------------------------------------------------------
setPalette:
    ld      b, #7f
.loop:
    out     (c), a
    inc     b
    outi
    inc     a
    dec     c
    jr      nz, .loop
    ret
${EGX_OVERSCAN_ROUTINES}
${EGX_SYNC_ROUTINES}
`
}

/**
 * Generate SNA template for CPC Plus EGX Overscan (280 lines)
 *
 * Uses ASIC unlock, 12-bit palette, and overscan CRTC configuration.
 */
export function generateEgxPlusOverscanSnaTemplate(
  options: EgxSnaTemplateOptions
): string {
  const { egxConfig, height } = options
  const { lowMode, highMode } = getEgxModeValues(egxConfig.type)

  const egxTypeLabel = egxConfig.type === 'egx1' ? '1' : '2'
  const modesDesc =
    egxConfig.type === 'egx1' ? 'Mode 0/Mode 1' : 'Mode 1/Mode 2'
  const firstLineDesc =
    egxConfig.firstLineMode === 'low' ? 'Low-res' : 'High-res'
  const linePairs = Math.floor(height / 2)

  // Conditional for firstLineMode
  const loResFirstValue = egxConfig.firstLineMode === 'low' ? '1' : '0'

  return `BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3
SNASET CPC_TYPE, 4

LO_RES_FIRST=${loResFirstValue}

;------------------------------------------------------------------------------
; EGX${egxTypeLabel} Overscan Display Routine (CPC Plus)
; Alternates ${modesDesc} every scanline
; First line: ${firstLineDesc}
; Height: ${height} lines (${linePairs} line pairs)
;------------------------------------------------------------------------------

    org     #b000
    run     #b000
    di
    ld      sp, #b000
    ld      hl, tovercrt         ; Switch CRTC to 96 columns, ${height} lines
    call    outcrtc
    call    affscr               ; Display the screen

    call Asic_unlock
    call Asic_activate

    ; Set CPC Plus palette (12-bit colors)
    ; Border color at #6420-#6421
    ld hl, (Palette_Plus)
    ld (#6420), hl

    ; Palette colors at #6400-#641F (16 colors × 2 bytes)
    ld hl, Palette_Plus
    ld de, #6400
    ld bc, 32
    ldir

    call sync_vbl
    nop 10

;------------------------------------------------------------------------------
; Main Loop
;------------------------------------------------------------------------------
main_loop:
    ld de, 31 * 64 - 40 + 64
    call wait_usec

    ld b, #7f
IF LO_RES_FIRST
    ld hl, #${lowMode}${highMode}
ELSE
    ld hl, #${highMode}${lowMode}
ENDIF
    ld e, ${linePairs}
.egx_loop:
    out (c), h
    ds 60
    out (c), l
    ds 60 - 4
    dec e
    jp nz, .egx_loop

    ds 22
    jp main_loop

;------------------------------------------------------------------------------
; ASIC Unlock Routine
;------------------------------------------------------------------------------
Asic_unlock:
    di
    ld e, 17
    ld hl, unlock_seq
    ld bc, #bc00
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, .loop
    ret

unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238

;------------------------------------------------------------------------------
; ASIC Activate/Deactivate
;------------------------------------------------------------------------------
Asic_activate:
    ld bc, #7fb8
    out (c), c
    ret

Asic_deactivate:
    ld bc, #7fA0
    out (c), c
    ret
${EGX_OVERSCAN_ROUTINES}
${EGX_SYNC_ROUTINES}
`
}

/**
 * Combine EGX template with data files to create complete ASM source
 */
export function assembleEgxSnaSource(
  template: string,
  dataFiles: EgxDataFiles,
  options?: { overscan?: boolean }
): string {
  const lines: string[] = [template]

  // Add palette data
  if (dataFiles.paletteAsm) {
    lines.push('', '; === PALETTE DATA ===', dataFiles.paletteAsm)
  }

  // Add image data
  if (options?.overscan) {
    // Overscan: linear data in two chunks at #4268 (after overscan setup code)
    lines.push(
      '',
      'print "END OF PROGRAM", {hex}$',
      '',
      '    org     #4268',
      '',
      '; === IMAGE DATA (Linear format, 2 chunks) ===',
      dataFiles.imageAsm
    )
    if (dataFiles.imageAsm2) {
      lines.push(dataFiles.imageAsm2)
    }
  } else {
    // Standard: SCR data at #c000
    lines.push('', '; === IMAGE DATA ===', '    org #c000', dataFiles.imageAsm)
  }

  return lines.join('\n')
}
