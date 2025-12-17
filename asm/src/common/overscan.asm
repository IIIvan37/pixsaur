R1              equ 48

;------------------------------------------------------------------------------
; Display screen routine
;------------------------------------------------------------------------------

affscr:
        ld      b, 0                 ; 256 lines
        ld      c, R1 * 2               
        ld      de, #0140            ; Screen address (#00E0 + 96)
        ld      hl, #4268            ; Linear data
        call    .bclt1               
        ld      b, 280 - 256             

.bclt1:
        push    de                   
        push    bc
        ld      b, #00
        ldir                        ; Transfer 1 line
        pop     bc
        pop     de

        push    hl
        ex      de, hl
        call    adinfuni
        ld      a, h
        or      a
        jr      nz, .okaff
        ld      h, #40
.okaff:
        ex      de, hl
        pop     hl
        djnz    .bclt1
        ret

;------------------------------------------------------------------------------
; Output to CRTC
;------------------------------------------------------------------------------

outcrtc:
        ld      bc, #bc00            ; Activate CRTC

bcloutc:
        ld      a, (hl)
        cp      #ff
        ret     z
        out     (c), c               ; Select port #bc00 to #bc12
        inc     b
        out     (c), a               ; Send byte to port #bdxx
        dec     b
        inc     c
        inc     hl
        jr      bcloutc

;------------------------------------------------------------------------------
; Special ADINF routine
;------------------------------------------------------------------------------

adinfuni:
        ld      a, h
        add     a, #08
        ld      h, a
        and     #38
        ret     nz
        ld      a, h
        sub     #40
        ld      h, a
        ld      a, l
        add     a, R1 * 2
        ld      l, a
        ret     nc
        inc     h
        ld      a, h
        and     #07
        ret     nz
        ld      a, h
        sub     #08
        ld      h, a
        ret



;------------------------------------------------------------------------------
; CRTC register values for overscan
;------------------------------------------------------------------------------

tovercrt:
        db      #3f, R1, #32, #06, #26, #00, #21, #23
        db      #00, #07, #00, #00, #0c, 160, #ff