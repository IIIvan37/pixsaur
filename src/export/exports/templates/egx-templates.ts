/**
 * EGX (Extended Graphics) Template Generators for Amstrad CPC
 *
 * Generates Z80 assembly code for displaying EGX images.
 * EGX alternates video modes line by line:
 * - EGX1: Alternates Mode 0 (16 colors) and Mode 1 (4 colors) = up to 16 colors
 * - EGX2: Alternates Mode 1 (4 colors) and Mode 2 (2 colors) = up to 4 colors
 */

import type { EGXConfig, EGXType } from '@/libs/pixsaur-egx'

// =============================================================================
// Types
// =============================================================================

export interface EgxSnaTemplateOptions {
  /** EGX configuration */
  egxConfig: EGXConfig
  /** Image height (typically 200) */
  height: number
}

export interface EgxDataFiles {
  /** Palette ASM data (label: Palette_Hardware) - 16 colors for EGX1, 4 for EGX2 */
  paletteAsm: string
  /** Image data ASM (label: ImageData) - 16KB SCR format */
  imageAsm: string
}

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
 * Combine EGX template with data files to create complete ASM source
 */
export function assembleEgxSnaSource(
  template: string,
  dataFiles: EgxDataFiles
): string {
  const lines: string[] = [template]

  // Add palette data
  if (dataFiles.paletteAsm) {
    lines.push('', '; === PALETTE DATA ===', dataFiles.paletteAsm)
  }

  // Add image data at #c000
  lines.push('', '; === IMAGE DATA ===', '    org #c000', dataFiles.imageAsm)

  return lines.join('\n')
}
