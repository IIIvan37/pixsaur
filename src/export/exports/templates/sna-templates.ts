/**
 * SNA (Snapshot) Template Generators for Amstrad CPC
 *
 * Generates Z80 assembly code for creating SNA snapshots that display images
 * with optional raster effects.
 *
 * Supported configurations:
 * - CPC Classic (27 colors) - Standard SCR (200 lines) with/without rasters
 * - CPC Classic (27 colors) - Overscan (280 lines) with/without rasters
 * - CPC Plus (4096 colors) - Standard SCR (200 lines) with/without rasters
 * - CPC Plus (4096 colors) - Overscan (280 lines) with/without rasters
 */

import type { CPCHardware } from '@/libs/types'

// =============================================================================
// Types
// =============================================================================

export interface SnaTemplateOptions {
  /** Graphics mode (0, 1, or 2) */
  mode: 0 | 1 | 2
  /** Image height in lines */
  height: number
  /** Whether the image uses overscan format */
  overscan: boolean
  /** Whether raster effects are enabled */
  hasRasters: boolean
  /** Hardware type */
  hardware: CPCHardware
}

export interface SnaDataFiles {
  /** Palette ASM data (label: Palette for Plus, Palette_Hardware for Classic) */
  paletteAsm: string
  /** Raster ASM data (label: RasterData) - only if hasRasters */
  rasterAsm?: string
  /** Image data ASM (label: ImageData for SCR, chunks for overscan) */
  imageAsm: string
  /** Second image chunk for overscan (ImageData_linear_chunk_1) */
  imageAsm2?: string
}

// =============================================================================
// Common ASM Code Sections
// =============================================================================

/**
 * ASIC unlock and activation routines for CPC Plus
 */
const PLUS_ASIC_ROUTINES = `
;------------------------------------------------------------------------------
; ASIC Unlock and Activation (CPC Plus)
;------------------------------------------------------------------------------
Asic_unlock:
    di
    ld e, 17
    ld hl, asic_unlock_seq
    ld bc, #bc00
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, .loop
    ret

Asic_activate:
    ld bc, #7fb8
    out (c), c
    ret

asic_unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238
`

/**
 * Sync routine for precise timing (overscan and rasters)
 */
const SYNC_ROUTINES = `
;------------------------------------------------------------------------------
; Sync Routine - Precise VSync timing
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
 * Overscan display routine
 */
const OVERSCAN_DISPLAY_ROUTINES = `
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
; CRTC register values for overscan
;------------------------------------------------------------------------------
tovercrt:
    db #3f, R1, #32, #06, #26, #00, #21, #23
    db #00, #07, #00, #00, #0c, 160, #ff
`

/**
 * Classic palette set routine
 */
const CLASSIC_SET_PALETTE = `
;------------------------------------------------------------------------------
; Set CPC Classic Palette (hardware values)
;------------------------------------------------------------------------------
setPalette:
    ld b, #7f
.loop:
    out (c), a
    inc b
    outi
    inc a
    dec c
    jr nz, .loop
    ret
`

/**
 * Classic raster routines (jump table based)
 */
const CLASSIC_RASTER_ROUTINES = `
;------------------------------------------------------------------------------
; Classic Raster Routines
;------------------------------------------------------------------------------
no_changes:
    exx
    ld a, (hl)
    add a
    ld iyh, a
    inc hl
    exx
    nop 24
    jp (ix)

changes_1:
    exx
repeat 2
    inc b
    outi
rend
    nop 12
    ld a, (hl)
    add a
    ld iyh, a
    inc hl
    exx
    jp (ix)

changes_2:
    exx
repeat 4
    inc b
    outi
rend
    ld a, (hl)
    add a
    ld iyh, a
    inc hl
    exx
    jp (ix)

align 256
jmp_table:
    dw no_changes
    dw changes_1
    dw changes_2
`

/**
 * Classic raster macro
 */
const CLASSIC_RASTER_MACRO = `
;------------------------------------------------------------------------------
; Classic Raster Macro
;------------------------------------------------------------------------------
macro CLASSIC_RASTER, n
    exx
    ld hl, RasterData
    ld bc, #7f00
    ld ix, .end_change
    ld a, (hl)
    inc hl
    add a
    ld iyh, a
    exx

    ld de, {n}
.loop:
    ld h, hi(jmp_table)
    ld a, iyh
    ld l, a
    ld a, (hl)
    inc l
    ld h, (hl)
    ld l, a
    jp (hl)

.end_change:
    ds 10
    dec de
    ld a, d
    or e
    jr nz, .loop
endm
`

/**
 * Plus raster macro
 */
const PLUS_RASTER_MACRO = `
;------------------------------------------------------------------------------
; Plus Raster Macro
;------------------------------------------------------------------------------
macro PLUS_RASTER, n
    exx
    ld hl, RasterData
    exx

    ld (.save_stack + 1), sp
    ld hl, #6408
REPEAT {n}
    ld sp, hl
    exx
    ld e, (hl)
    inc hl
    ld d, (hl)
    inc hl
    ld ix, de
    ld e, (hl)
    inc hl
    ld d, (hl)
    inc hl
    ld iy, de
    ld e, (hl)
    inc hl
    ld d, (hl)
    inc hl
    ld c, (hl)
    inc hl
    ld b, (hl)
    inc hl
    push bc
    push de
    push iy
    push ix
    exx
    nop 2
REND

.save_stack:
    ld sp, 0
endm
`

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get Gate Array mode register value for CPC mode
 * Mode 0: #8C, Mode 1: #8D, Mode 2: #8E
 */
function getModeRegisterValue(mode: 0 | 1 | 2): string {
  const modeValues = {
    0: '#8C',
    1: '#8D',
    2: '#8E'
  }
  return modeValues[mode]
}

// =============================================================================
// Template Generators
// =============================================================================

/**
 * Generate SNA template for CPC Classic Standard SCR (200 lines)
 */
export function generateClassicScrSnaTemplate(
  options: SnaTemplateOptions
): string {
  const { hasRasters, mode } = options
  const modeReg = getModeRegisterValue(mode)

  if (hasRasters) {
    return `BUILDSNA
BANKSET 0

    org #8000
    run #8000
    di
    ld sp, #c000

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    ld hl, Palette_Hardware
    ld a, 0
    ld c, 16
    call setPalette

wait_vblank:
    ei
    halt
    ld b, #f5
.wait:
    in a, (c)
    rra
    jr nc, .wait

    ld hl, Palette_Hardware
    ld a, 0
    ld c, 16
    call setPalette
    halt

    di
    ds 16 * 64 - 30
    ld bc, #7f10
    out (c), c
    ld c, #54
    out (c), c

    exx
    ld hl, RasterData
    ld bc, #7f00
    ld ix, .end_change
    ld a, (hl)
    inc hl
    add a
    exx

    ld e, 200
.raster_loop:
    ld h, hi(jmp_table)
    ld l, a
    ld a, (hl)
    inc l
    ld h, (hl)
    ld l, a
    jp (hl)

.end_change:
    ds 17
    dec e
    jr nz, .raster_loop

.end:
    jp wait_vblank

no_changes:
    exx
    ld a, (hl)
    add a
    inc hl
    exx
    nop 24
    jp (ix)

changes_1:
    exx
repeat 2
    inc b
    outi
rend
    nop 12
    ld a, (hl)
    add a
    inc hl
    exx
    jp (ix)

changes_2:
    exx
repeat 4
    inc b
    outi
rend
    ld a, (hl)
    add a
    inc hl
    exx
    jp (ix)

${CLASSIC_SET_PALETTE}

align 256
jmp_table:
    dw no_changes
    dw changes_1
    dw changes_2

; === DATA SECTION ===
; Palette_Hardware: (from export)
; RasterData: (from export)
; ImageData at #C000: (from export)
`
  }

  // Without rasters - simple display
  return `BUILDSNA
BANKSET 0

    org #8000
    run #8000
    di
    ld sp, #c000

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    ld hl, Palette_Hardware
    ld a, 0
    ld c, 16
    call setPalette

.end:
    jp .end

${CLASSIC_SET_PALETTE}

; === DATA SECTION ===
; Palette_Hardware: (from export)
; ImageData at #C000: (from export)
`
}

/**
 * Generate SNA template for CPC Classic Overscan (280 lines)
 */
export function generateClassicOverscanSnaTemplate(
  options: SnaTemplateOptions
): string {
  const { hasRasters, height, mode } = options
  const modeReg = getModeRegisterValue(mode)

  if (hasRasters) {
    return `BUILDSNA
BANKSET 0

${CLASSIC_RASTER_MACRO}

;------------------------------------------------------------------------------
; Program entry point
;------------------------------------------------------------------------------
    org #b000
    run #b000
    di
    ld sp, #b000
    ld hl, tovercrt
    call outcrtc
    call affscr

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    ld hl, Palette_Hardware
    ld c, 16
    xor a
    call setPalette

    call sync_vbl
    nop 10

main_loop:
    ld hl, Palette_Hardware
    ld c, 16
    xor a
    call setPalette
    ld de, 30 * 64 + 36 - 259
    call wait_usec

    CLASSIC_RASTER ${height}

    ld de, 1 * 64 - 8
    call wait_usec
    jp main_loop

${OVERSCAN_DISPLAY_ROUTINES}
${SYNC_ROUTINES}
${CLASSIC_SET_PALETTE}
${CLASSIC_RASTER_ROUTINES}

; === DATA SECTION ===
; Palette_Hardware: (from export)
; RasterData: (from export)
; ImageData at #4268: linear chunks (from export)
`
  }

  // Without rasters - simple overscan display
  return `BUILDSNA
BANKSET 0

;------------------------------------------------------------------------------
; Program entry point
;------------------------------------------------------------------------------
    org #b000
    run #b000
    di
    ld sp, #b000
    ld hl, tovercrt
    call outcrtc
    call affscr

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    ld hl, Palette_Hardware
    ld c, 16
    xor a
    call setPalette

.end:
    jp .end

${OVERSCAN_DISPLAY_ROUTINES}
${CLASSIC_SET_PALETTE}

; === DATA SECTION ===
; Palette_Hardware: (from export)
; ImageData at #4268: linear chunks (from export)
`
}

/**
 * Generate SNA template for CPC Plus Standard SCR (200 lines)
 */
export function generatePlusScrSnaTemplate(
  options: SnaTemplateOptions
): string {
  const { hasRasters, mode } = options
  const modeReg = getModeRegisterValue(mode)

  if (hasRasters) {
    return `BUILDSNA
BANKSET 0
SNASET CPC_TYPE, 4 ; CPC 6128 Plus
SNASET CRTC_TYPE, 3

${PLUS_RASTER_MACRO}

    org #8000
    run #8000
    di
    ld hl, #c9fb
    ld (#38), hl

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    call Asic_unlock
    call Asic_activate

    ;; Set CPC Plus hardware palette
    ld hl, (Palette)
    ld (#6420), hl

    ld hl, Palette
    ld de, #6400
    ld bc, 32
    ldir

wait_vblank:
    ei
    ld b, #f5
.wait:
    halt
    in a, (c)
    rra
    jr nc, .wait
    halt
    di
    nop 16 * 64 + 40

    PLUS_RASTER 200
    jp wait_vblank

${PLUS_ASIC_ROUTINES}

; === DATA SECTION ===
; Palette: (from export - CPC Plus format DEFW)
; RasterData: (from export)
; ImageData at #C000: (from export)
`
  }

  // Without rasters - simple Plus display
  return `BUILDSNA
BANKSET 0
SNASET CPC_TYPE, 4 ; CPC 6128 Plus
SNASET CRTC_TYPE, 3

    org #8000
    run #8000
    di
    ld hl, #c9fb
    ld (#38), hl

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    call Asic_unlock
    call Asic_activate

    ;; Set CPC Plus hardware palette
    ld hl, (Palette)
    ld (#6420), hl

    ld hl, Palette
    ld de, #6400
    ld bc, 32
    ldir

.end:
    jp .end

${PLUS_ASIC_ROUTINES}

; === DATA SECTION ===
; Palette: (from export - CPC Plus format DEFW)
; ImageData at #C000: (from export)
`
}

/**
 * Generate SNA template for CPC Plus Overscan (280 lines)
 */
export function generatePlusOverscanSnaTemplate(
  options: SnaTemplateOptions
): string {
  const { hasRasters, height, mode } = options
  const modeReg = getModeRegisterValue(mode)

  if (hasRasters) {
    return `BUILDSNA
BANKSET 0
SNASET CPC_TYPE, 4 ; CPC 6128 Plus
SNASET CRTC_TYPE, 3

${PLUS_RASTER_MACRO}

;------------------------------------------------------------------------------
; Program entry point
;------------------------------------------------------------------------------
    org #b000
    run #b000
    di
    ld sp, #b000

    ld hl, tovercrt
    call outcrtc
    call affscr

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    call Asic_unlock
    call Asic_activate

    ;; Set CPC Plus hardware palette
    ld hl, 0
    ld (#6420), hl

    ld hl, Palette
    ld de, #6400
    ld bc, 32
    ldir

    call sync_vbl
    nop 10

main_loop:
    ld de, 30 * 64 + 36
    call wait_usec

    PLUS_RASTER ${height}

    ld de, 1 * 64 - 8
    call wait_usec
    jp main_loop

${OVERSCAN_DISPLAY_ROUTINES}
${SYNC_ROUTINES}
${PLUS_ASIC_ROUTINES}

; === DATA SECTION ===
; Palette: (from export - CPC Plus format DEFW)
; RasterData: (from export)
; ImageData at #4268: linear chunks (from export)
`
  }

  // Without rasters - simple Plus overscan display
  return `BUILDSNA
BANKSET 0
SNASET CPC_TYPE, 4 ; CPC 6128 Plus
SNASET CRTC_TYPE, 3

;------------------------------------------------------------------------------
; Program entry point
;------------------------------------------------------------------------------
    org #b000
    run #b000
    di
    ld sp, #b000

    ld hl, tovercrt
    call outcrtc
    call affscr

    ld bc, #7c${modeReg.slice(1)}
    out (c), c

    call Asic_unlock
    call Asic_activate

    ;; Set CPC Plus hardware palette
    ld hl, 0
    ld (#6420), hl

    ld hl, Palette
    ld de, #6400
    ld bc, 32
    ldir

.end:
    jp .end

${OVERSCAN_DISPLAY_ROUTINES}
${PLUS_ASIC_ROUTINES}

; === DATA SECTION ===
; Palette: (from export - CPC Plus format DEFW)
; ImageData at #4268: linear chunks (from export)
`
}

/**
 * Generate the appropriate SNA template based on options
 */
export function generateSnaTemplate(options: SnaTemplateOptions): string {
  const { overscan, hardware } = options

  if (hardware === 'plus') {
    return overscan
      ? generatePlusOverscanSnaTemplate(options)
      : generatePlusScrSnaTemplate(options)
  }

  return overscan
    ? generateClassicOverscanSnaTemplate(options)
    : generateClassicScrSnaTemplate(options)
}

/**
 * Combine template with data files to create complete ASM source
 */
export function assembleSnaSource(
  template: string,
  dataFiles: SnaDataFiles,
  options: SnaTemplateOptions
): string {
  const lines: string[] = [template]

  // Add palette data - always include separate palette
  // Both Classic and Plus use separate palette labels
  if (dataFiles.paletteAsm) {
    lines.push('', '; === PALETTE DATA ===', dataFiles.paletteAsm)
  }

  // Add raster data if present
  if (options.hasRasters && dataFiles.rasterAsm) {
    lines.push('', '; === RASTER DATA ===', dataFiles.rasterAsm)
  }

  // Add image data at appropriate address
  lines.push('', '; === IMAGE DATA ===')
  if (options.overscan) {
    lines.push('    org #4268', dataFiles.imageAsm)
    if (dataFiles.imageAsm2) {
      lines.push(dataFiles.imageAsm2)
    }
  } else {
    lines.push('    org #c000', dataFiles.imageAsm)
  }

  return lines.join('\n')
}

// =============================================================================
// Mode R Templates (Dual Frame 50Hz Alternation)
// =============================================================================

/**
 * Mode R constants and macros
 */
const MODE_R_WAIT_CYCLES_MACRO = `
;------------------------------------------------------------------------------
; WAIT_CYCLES Macro - Precise timing for Mode R
;------------------------------------------------------------------------------
MACRO WAIT_CYCLES _cycles
@loops    equ floor(({_cycles}-1)/4)
@loopsx4  equ @loops*4
@nops     equ {_cycles}-@loopsx4-1
    ld b, @loops
@change_waitLoop
    djnz @change_waitLoop
    defs @nops
MEND
`

const MODE_R_COMMON_ROUTINES = `
;------------------------------------------------------------------------------
; Wait Vertical Blank
;------------------------------------------------------------------------------
wVb:
    ld b, #f5
.vbLoop1:
    in a, (c)
    rra
    jr c, .vbLoop1
.vbLoop2:
    in a, (c)
    rra
    jr nc, .vbLoop2
    ret

;------------------------------------------------------------------------------
; Wait BC scanlines
;------------------------------------------------------------------------------
waitScanlines:
    ld a, b
    or c
    ret z

    push bc
    WAIT_CYCLES 40
    pop bc
    dec bc
    ld a, b
    or c
    ret z

.waitScanlines_loop:
    push bc
    WAIT_CYCLES 50
    pop bc
    dec bc
    ld a, b
    or c
    jr nz, .waitScanlines_loop
    ret
`

/**
 * Generate SNA template for Mode R CPC Classic
 * Two frames at #4000 and #C000, alternating palettes at 50Hz
 */
export function generateModeRClassicSnaTemplate(): string {
  return `BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 0

${MODE_R_WAIT_CYCLES_MACRO}

    org #8000
    run #8000
start:
    di

    ld bc, #7f8c            ;; set mode 0
    out (c), c

    ld hl, ModeR_PaletteA_Hardware
    call setPalette

mainLoop:
    call wVb

    ld bc, #bc0c            ;; video page switch (#c000 / #4000)
    out (c), c
    inc b
    ld a, (CRTCReg12)
    out (c), a
    xor #20
    ld (CRTCReg12), a

    ld a, (topScanlines)    ;; wait scanlines
    ld c, a
    xor 1
    ld (topScanlines), a
    ld b, 0
    call waitScanlines

    WAIT_CYCLES 34

    ld bc, #bc02            ;; select CRTC reg 2
    out (c), c

    ld d, 222/2
rasterLoop:
    ld bc, #bd2d
    out (c), c

    WAIT_CYCLES 64-7

    ld bc, #bd2f
    out (c), c

    WAIT_CYCLES 64-7-4

    dec d
    jr nz, rasterLoop

p1: ld hl, ModeR_PaletteB_Hardware
p2: ld de, ModeR_PaletteA_Hardware
    ex hl, de
    ld (p1 + 1), hl
    ld (p2 + 1), de
    call setPalette
    jr mainLoop

;------------------------------------------------------------------------------
; Set Palette (CPC Classic)
;------------------------------------------------------------------------------
setPalette:
    xor a
    ld bc, #7f11
.setPalette_loop:
    out (c), a
    inc b
    outi
    inc a
    cp c
    jr nz, .setPalette_loop
    ret

${MODE_R_COMMON_ROUTINES}

;------------------------------------------------------------------------------
; Mode R Data
;------------------------------------------------------------------------------
topScanlines:   db 51
CRTCReg12:      db #30

; === DATA SECTION ===
; ModeR_PaletteA_Hardware: (16 bytes)
; ModeR_PaletteB_Hardware: (16 bytes)
; Frame A at #4000: (16384 bytes)
; Frame B at #C000: (16384 bytes)
`
}

/**
 * Generate SNA template for Mode R CPC Plus
 * Two frames at #4000 and #C000, alternating 12-bit palettes at 50Hz
 */
export function generateModeRPlusSnaTemplate(): string {
  return `BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3
SNASET CPC_TYPE, 4

${MODE_R_WAIT_CYCLES_MACRO}

    org #8000
    run #8000
start:
    di

    ld bc, #7f8c            ;; set mode 0
    out (c), c

    call Asic_unlock
    call Asic_activate

    ;; Load initial palette
    ld hl, ModeR_PaletteA
    ld de, #6400
    ld bc, 32
    ldir

mainLoop:
    call Asic_deactivate
    call wVb

    ld bc, #bc0c            ;; video page switch (#c000 / #4000)
    out (c), c
    inc b
    ld a, (CRTCReg12)
    out (c), a
    xor #20
    ld (CRTCReg12), a

    ld a, (topScanlines)    ;; wait scanlines
    ld c, a
    xor 1
    ld (topScanlines), a
    ld b, 0
    call waitScanlines

    WAIT_CYCLES 34

    ld bc, #bc02            ;; select CRTC reg 2
    out (c), c

    ld d, 222/2
rasterLoop:
    ld bc, #bd2d
    out (c), c

    WAIT_CYCLES 64-7

    ld bc, #bd2f
    out (c), c

    WAIT_CYCLES 64-7-4

    dec d
    jr nz, rasterLoop

    call Asic_activate
p1: ld hl, ModeR_PaletteB
p2: ld de, ModeR_PaletteA
    ex hl, de
    ld (p1 + 1), hl
    ld (p2 + 1), de
    ld de, #6400
    ld bc, 32
    ldir
    jr mainLoop

${MODE_R_COMMON_ROUTINES}

;------------------------------------------------------------------------------
; ASIC Unlock and Activation (CPC Plus)
;------------------------------------------------------------------------------
Asic_unlock:
    di
    ld e, 17
    ld hl, asic_unlock_seq
    ld bc, #bc00
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, .loop
    ret

Asic_activate:
    ld bc, #7fb8
    out (c), c
    ret

Asic_deactivate:
    ld bc, #7fa0
    out (c), c
    ret

asic_unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238

;------------------------------------------------------------------------------
; Mode R Data
;------------------------------------------------------------------------------
topScanlines:   db 51
CRTCReg12:      db #30

; === DATA SECTION ===
; ModeR_PaletteA: (32 bytes - 16 colors × 2 bytes)
; ModeR_PaletteB: (32 bytes - 16 colors × 2 bytes)
; Frame A at #4000: (16384 bytes)
; Frame B at #C000: (16384 bytes)
`
}

// =============================================================================
// Mode R Data Assembly
// =============================================================================

export interface ModeRDataFiles {
  /** Palette A ASM data (label: ModeR_PaletteA_Hardware for Classic, ModeR_PaletteA for Plus) */
  paletteAAsm: string
  /** Palette B ASM data (label: ModeR_PaletteB_Hardware for Classic, ModeR_PaletteB for Plus) */
  paletteBAsm: string
  /** Frame A image data ASM */
  frameAAsm: string
  /** Frame B image data ASM */
  frameBAsm: string
}

/**
 * Combine Mode R template with data files to create complete ASM source
 */
export function assembleModeRSnaSource(
  template: string,
  dataFiles: ModeRDataFiles
): string {
  const lines: string[] = [template]

  // Add all data in one push per section to avoid multiple push calls
  lines.push(
    '',
    '; === PALETTE DATA ===',
    dataFiles.paletteAAsm,
    dataFiles.paletteBAsm,
    '',
    '; === FRAME A DATA ===',
    '    org #4000',
    dataFiles.frameAAsm,
    '',
    '; === FRAME B DATA ===',
    '    org #c000',
    dataFiles.frameBAsm
  )
  return lines.join('\n')
}
