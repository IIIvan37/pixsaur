macro PLUS_RASTER, n
    exx
    ld hl, RasterData     ; Raster data from Pixsaur export
    exx

    ld (.save_stack + 1), sp
    ld hl, #6408
REPEAT {n}
TICKER START, mesure
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
   
TICKER STOP, mesure
REND

.save_stack:
    ld sp, 0
endm