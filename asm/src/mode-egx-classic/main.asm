
BUILDSNA
BANKSET 0

        org #8000
        run #8000

        di
        ld hl, #c9fb
        ld (#38), hl
        ld sp, #c000
        ei
        
        ld bc, #7c8c
        out (c), c
        ld hl, Palette_Hardware
        call setPalette

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


setPalette
	xor	a
	ld	bc,#7f11
setPalette_loop
	out	(c),a
	inc	b
	outi
	inc	a
	cp	c
	jr	nz,setPalette_loop
	ret




include 'data/palette_hardware.asm'
org #c000

include 'data/ImageData.asm'