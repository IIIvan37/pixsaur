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
.loop
    ld h, hi(jmp_table)
    ld a, iyh
    ld l, a
    ld a, (hl)
    inc l
    ld h, (hl)
    ld l, a
    jp (hl)

.end_change
    ds 10
    dec de
    ld a, d
    or e
    jr nz, .loop
endm





