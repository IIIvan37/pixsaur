BUILDSNA
BANKSET 0
SNASET CRTC_TYPE, 3
SNASET CPC TYPE, 4
LO_RES_FIRST=1

    org     #b000
    run     #b000
    di
    ld      sp, #b000
    ld      hl, tovercrt         ; Switch CRTC to 96 columns, 280 lines
    call    outcrtc              
    call    affscr               ; Display the screen

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



    call sync_vbl
    nop 10
main_loop
    ld de, 31 * 64 - 40 + 64
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

    ds 22
    
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




include '../common/plus.asm'
include 'data/palette_plus.asm'

print "END OF PROGRAM", {hex}$

    org     #4268

; Chunk 1/2 - Offset: 0 - Size: 16384 bytes
include 'data/ImageData_linear_chunk_0.asm'
include 'data/ImageData_linear_chunk_1.asm'
