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

no_changes
    exx
    ld a, (hl)
    add a
      ld iyh, a
    inc hl
    exx 
    nop 24
    jp (ix)


changes_1
    exx
repeat 2
    inc b
    outi
rend
    nop 12
    ld a,(hl)
    add a
    ld iyh, a
    inc hl
    exx
    jp (ix)


changes_2
    exx
repeat 4
    inc b
    outi
rend
    ld a,(hl)
    add a
    ld iyh, a
    inc hl
    exx
    jp (ix)



align 256
jmp_table
    dw no_changes
    dw changes_1
    dw changes_2
endm

