BUILDSNA
BANKSET 0

include '../common/classic.h.asm'

;------------------------------------------------------------------------------
; Program entry point
;------------------------------------------------------------------------------

        org     #b000
        run     #b000
        di
        ld      sp, #b000
        ld      hl, tovercrt         ; Switch CRTC to 96 columns, 280 lines
        call    outcrtc              
        call    affscr               ; Display the screen

        ld bc, #7c8c
        out (c), c

         ld hl, palette_Hardware
    ld c, 16
    xor a
    call setPalette


    call sync_vbl
    nop 10
main_loop
    ld hl, palette_Hardware
    ld c, 16
    xor a
    call setPalette
    ld de, 30 * 64 + 36 - 259
    call wait_usec 
  
    CLASSIC_RASTER 280

    ld de, 1 * 64 - 8
    call wait_usec 
    jp main_loop




include '../common/overscan.asm'
include '../common/sync.asm'
include '../common/classic.asm'

;------------------------------------------------------------------------------
; DATA FILES (from Pixsaur export - extract ZIP to data/ folder)
;------------------------------------------------------------------------------
include 'data/palette_hardware.asm'
include 'data/rasters.asm'
print "END OF PROGRAM", {hex}$

    org     #4268
include 'data/ImageData_linear_chunk_0.asm'
include 'data/ImageData_linear_chunk_1.asm'

print "END OF IMAGE DATA", {hex}$