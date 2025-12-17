BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3

include '../common/plus.h.asm'

    org #8000
    run #8000
    di
    ld hl, #c9fb
    ld (#38), hl

    ld bc, #7c8c
    out (c), c

    call Asic_unlock
    call Asic_activate  

    ;; Set CPC Plus hardware palette
    ;; Border color at offset 2000-2001 (16-bit little-endian)
    ld hl, (palette)   ; Load border color value
    ld (#6420), hl          ; Write to border register
    
    ;; Palette colors at offset 2002-2033 (16 colors × 2 bytes = 32 bytes)
    ld hl, palette     ; Source: palette data in SCR
    ld de, #6400            ; Dest: Pen 0 register
    ld bc, 32               ; 16 colors × 2 bytes
    ldir                    ; Copy all palette colors


wait_vblank
    ei
    ld b, #f5
.wait
    halt
    in a, (c)
    rra
    jr nc, .wait
    halt
    di
    nop 16 * 64 + 40

    PLUS_RASTER 200
    jp wait_vblank


include '../common/plus.asm'
include 'data/palette_plus.asm'
include 'data/rasters.asm'

    org #c000
include 'data/ImageData.asm'


