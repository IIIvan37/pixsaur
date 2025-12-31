BUILDSNA
BANKSET 0

LO_RES_FIRST=1

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
    ld de, 26 * 64 - 40
    call wait_usec 
  
    ld b, #7f
IF LO_RES_FIRST
        ld hl, #8c8d
ELSE
        ld hl, #8d8c
ENDIF
        ld e, 140
.loop
        out (c), h
        ds 60
        out (c), l
        ds 60 - 4
        dec e
        jp nz, .loop

    ld de, 1 * 64 - 8 + 87
    call wait_usec 
    jp main_loop




include '../common/overscan.asm' 
include '../common/sync.asm' 

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





   include 'data/palette_hardware.asm'

print "END OF PROGRAM", {hex}$

    org     #4268

; Chunk 1/2 - Offset: 0 - Size: 16384 bytes
include 'data/ImageData_linear_chunk_0.asm'
include 'data/ImageData_linear_chunk_1.asm'
