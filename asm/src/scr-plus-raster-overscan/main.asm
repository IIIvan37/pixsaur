BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3

include '../common/plus.h.asm'
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

        call Asic_unlock
        call Asic_activate  
    
        ;; Set CPC Plus hardware palette
        ;; Border color at offset 2000-2001 (16-bit little-endian)
        ld hl, 0   ; Load border color value
        ld (#6420), hl          ; Write to border register
        
        ;; Palette colors at offset 2002-2033 (16 colors × 2 bytes = 32 bytes)
        ld hl, Palette     ; Source: palette data from Pixsaur export
        ld de, #6400            ; Dest: Pen 0 register
        ld bc, 32               ; 16 colors × 2 bytes
        ldir                    ; Copy all palette colors



    call sync_vbl
    nop 10
;------------------------------------------------------------------------------
main_loop
    ld de, 30 * 64 + 36
    call wait_usec 
  
    PLUS_RASTER 280

    ld de, 1 * 64 - 8
    call wait_usec 
    jp main_loop

include '../common/overscan.asm'
include '../common/sync.asm'
include '../common/plus.asm'

;------------------------------------------------------------------------------
; DATA FILES (from Pixsaur export - extract ZIP to data/ folder)
;------------------------------------------------------------------------------
include 'data/palette_plus.asm'
include 'data/rasters.asm'
print "END OF PROGRAM", {hex}$

    org     #4268
include 'data/ImageData_linear_chunk_0.asm'
include 'data/ImageData_linear_chunk_1.asm'

print "END OF IMAGE DATA", {hex}$