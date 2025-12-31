BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3

include '../common/plus.h.asm'

        org #8000
        run #8000

        di
        ld hl, #c9fb
        ld (#38), hl
        ld sp, #c000
        ei
        
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

LO_RES_FIRST=1
wait_vblank
        ei
        halt
        ld b, #f5
.wait
        in a, (c)
        rra
        jr nc, .wait

        halt
        halt
        di
        ds 17 * 64

        ld b, #7f
IF LO_RES_FIRST
        ld hl, #8c8d
ELSE
        ld hl, #8d8c
ENDIF
        ld e, 100
.loop
        out (c), h
        ds 60
        out (c), l
        ds 60 - 4
        dec e
        jp nz, .loop

        jp wait_vblank




include '../common/plus.asm'
include 'data/palette_plus.asm'
org #c000

include 'data/image_data.asm'