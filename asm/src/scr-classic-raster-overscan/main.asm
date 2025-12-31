BUILDSNA
BANKSET 0

; include '../common/classic.h.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: ../common/classic.h.asm
; ======================================================================
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






; ======================================================================
; END INCLUDE: ../common/classic.h.asm
; ======================================================================

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
    ld de, 30 * 64 + 36 - 259
    call wait_usec 
  
    CLASSIC_RASTER 280

    ld de, 1 * 64 - 8
    call wait_usec 
    jp main_loop




; include '../common/overscan.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: ../common/overscan.asm
; ======================================================================
R1              equ 48

;------------------------------------------------------------------------------
; Display screen routine
;------------------------------------------------------------------------------

affscr:
        ld      b, 0                   ; 256 lines
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
; ======================================================================
; END INCLUDE: ../common/overscan.asm
; ======================================================================
; include '../common/sync.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: ../common/sync.asm
; ======================================================================
; ----- Sync Routine
sync_vbl:
 di
 ld b,#f5       ; Attendre Etat Vsync =1
 ld hl,19968-23 ; Compteur de nop (moins les marges et la gestion de l'attente)
 ld de,-11
sync_wvblon1    ; Ici on attend le debut de la periode Vsync (ou on attend pas si on y etait deja)
 in a,(c) ;
 rra ;
 jr nc,sync_wvblon1
sync_wvbloff1   ; Flag Vsync CRT passe a 1 (ou etait deja a 1)
 in a,(c)       ; Attendre que le flag repasse a 0 (Fin de Vsync)
 rra
 jr c,sync_wvbloff1
sync_wvblon2    ; On est certain maintenant que le signal Vsync n'etait pas deja en cours
 in a,(c)       ;
 rra            ; marge1 de 7us
 jr nc,sync_wvblon2
sync_wvbloff2   ; Attendre que le signal Vsync repasse a 0 en comptant le temps ecoule
 add hl,de      ; 3 On nop2 On nop3
 in a,(c)       ; 4 2 1
 rra            ; 1 1 1
 jr c,sync_wvbloff2 ; 3/2 2 3 (bcl)+3+4+1+2=15 / marge 15-5=10
 ex de,hl       ; 1
 call wait_usec ; 5 >> 6 + 10(marge2)

;
; Zone de derive pour attendre de nouveau la premiere manifestation du flag
; le in a,(c) va "descendre" nop par nop (frame par frame) jusqu'a ce que le in recupere le flag actif
sync_derive_bcl:
 ld b,#f5 ; 2
 in a,(c) ; 4 usec. 0.1.2.[3] (+1)
 rra ; 1 usec (+1)
 jr c,sync_first ; 2/3 (+3)
 ld de,19969-20 ; 3
 call wait_usec ; 5+(19969-20)
 jr sync_derive_bcl ; 3 >> 20
sync_first ; 6 Le flag a ete détecté au plus tôt, et ce depuis 5 usec (1+1+3)
 ld de,19968-11 ; 3
 jp wait_usec ; 3 >> 11 >> de=19968-11


;==================================================================================
; wait "de" usec
; 40+(((de/8)-5) x 8)+(de and 7) nop
; nb - le call de la fonction n'est pas compte
;========================================================================================
wait_usec:
 ld hl,sync_adjust ; 3
 ld b,0 ; 2
 ld a,e ; 1
 and %111 ; 2>8
 ld c,a ; 1
 sbc hl,bc ; 4
 srl d ; 2
 rr e ; 2>17
 srl d ; 2
 rr e ; 2
 srl d ; 2
 rr e ; 2>25
 dec de ; 2>27 8
 dec de ; 2>29 16
 dec de ; 2>31 24
 dec de ; 2>33 32
 dec de ; 2>35 40 *
 nop ; 1>36
wait_usec_01
 dec de ; 2 -
 ld a,d ; 1 -
 or e ; 1 -
 nop ; 1 -
 jp nz,wait_usec_01 ; 3 - v=(8 x DE)
 jp (hl) ; 1>37 
 nop ; 1 * v=0--7
 nop ; 1
 nop ; 1
 nop ; 1
 nop ; 1
 nop ; 1
 nop ; 1
sync_adjust:
 ret ; 3>40
; ======================================================================
; END INCLUDE: ../common/sync.asm
; ======================================================================
; include '../common/classic.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: ../common/classic.asm
; ======================================================================
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


; ======================================================================
; END INCLUDE: ../common/classic.asm
; ======================================================================

;------------------------------------------------------------------------------
; DATA FILES (from Pixsaur export - extract ZIP to data/ folder)
;------------------------------------------------------------------------------
; include 'data/palette_hardware.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: data/palette_hardware.asm
; ======================================================================
Palette_Hardware:
    DB      #54,#5C,#58,#43,#44,#5B,#40,#4B,#5F,#47,#5E,#4A,#4C,#4E,#55,#5D
; ======================================================================
; END INCLUDE: data/palette_hardware.asm
; ======================================================================
; include 'data/rasters.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: data/rasters.asm
; ======================================================================
RasterData:
    ; Format: For each of the 280 lines:
    ; DB #00 = no change on this line
    ; DB count, ink0, color0, [ink1, color1, ...] = count pairs of (ink, color)
    ; Colors are CPC Classic hardware values
    DB #00    ; Line 0 - no change
    DB #00    ; Line 1 - no change
    DB #00    ; Line 2 - no change
    DB #00    ; Line 3 - no change
    DB 1, 3, #45    ; Line 4
    DB #00    ; Line 5 - no change
    DB #00    ; Line 6 - no change
    DB 1, 3, #46    ; Line 7
    DB #00    ; Line 8 - no change
    DB 1, 5, #43    ; Line 9
    DB #00    ; Line 10 - no change
    DB #00    ; Line 11 - no change
    DB #00    ; Line 12 - no change
    DB #00    ; Line 13 - no change
    DB #00    ; Line 14 - no change
    DB #00    ; Line 15 - no change
    DB #00    ; Line 16 - no change
    DB #00    ; Line 17 - no change
    DB #00    ; Line 18 - no change
    DB #00    ; Line 19 - no change
    DB #00    ; Line 20 - no change
    DB #00    ; Line 21 - no change
    DB 1, 3, #45    ; Line 22
    DB #00    ; Line 23 - no change
    DB #00    ; Line 24 - no change
    DB #00    ; Line 25 - no change
    DB #00    ; Line 26 - no change
    DB #00    ; Line 27 - no change
    DB #00    ; Line 28 - no change
    DB #00    ; Line 29 - no change
    DB #00    ; Line 30 - no change
    DB #00    ; Line 31 - no change
    DB #00    ; Line 32 - no change
    DB 1, 8, #5B    ; Line 33
    DB #00    ; Line 34 - no change
    DB #00    ; Line 35 - no change
    DB #00    ; Line 36 - no change
    DB #00    ; Line 37 - no change
    DB #00    ; Line 38 - no change
    DB #00    ; Line 39 - no change
    DB #00    ; Line 40 - no change
    DB #00    ; Line 41 - no change
    DB 2, 3, #46, 8, #5F    ; Line 42
    DB #00    ; Line 43 - no change
    DB #00    ; Line 44 - no change
    DB #00    ; Line 45 - no change
    DB #00    ; Line 46 - no change
    DB #00    ; Line 47 - no change
    DB 1, 8, #5B    ; Line 48
    DB 1, 8, #5F    ; Line 49
    DB #00    ; Line 50 - no change
    DB #00    ; Line 51 - no change
    DB #00    ; Line 52 - no change
    DB #00    ; Line 53 - no change
    DB 1, 4, #5B    ; Line 54
    DB 1, 3, #44    ; Line 55
    DB 1, 14, #46    ; Line 56
    DB #00    ; Line 57 - no change
    DB #00    ; Line 58 - no change
    DB #00    ; Line 59 - no change
    DB #00    ; Line 60 - no change
    DB #00    ; Line 61 - no change
    DB 1, 14, #4F    ; Line 62
    DB 2, 12, #46, 14, #59    ; Line 63
    DB 1, 14, #4C    ; Line 64
    DB #00    ; Line 65 - no change
    DB #00    ; Line 66 - no change
    DB #00    ; Line 67 - no change
    DB #00    ; Line 68 - no change
    DB #00    ; Line 69 - no change
    DB #00    ; Line 70 - no change
    DB #00    ; Line 71 - no change
    DB #00    ; Line 72 - no change
    DB #00    ; Line 73 - no change
    DB #00    ; Line 74 - no change
    DB #00    ; Line 75 - no change
    DB 1, 11, #59    ; Line 76
    DB #00    ; Line 77 - no change
    DB #00    ; Line 78 - no change
    DB 1, 15, #4A    ; Line 79
    DB #00    ; Line 80 - no change
    DB #00    ; Line 81 - no change
    DB #00    ; Line 82 - no change
    DB #00    ; Line 83 - no change
    DB #00    ; Line 84 - no change
    DB #00    ; Line 85 - no change
    DB #00    ; Line 86 - no change
    DB #00    ; Line 87 - no change
    DB #00    ; Line 88 - no change
    DB #00    ; Line 89 - no change
    DB #00    ; Line 90 - no change
    DB #00    ; Line 91 - no change
    DB #00    ; Line 92 - no change
    DB #00    ; Line 93 - no change
    DB #00    ; Line 94 - no change
    DB #00    ; Line 95 - no change
    DB #00    ; Line 96 - no change
    DB #00    ; Line 97 - no change
    DB #00    ; Line 98 - no change
    DB #00    ; Line 99 - no change
    DB #00    ; Line 100 - no change
    DB #00    ; Line 101 - no change
    DB #00    ; Line 102 - no change
    DB #00    ; Line 103 - no change
    DB #00    ; Line 104 - no change
    DB #00    ; Line 105 - no change
    DB #00    ; Line 106 - no change
    DB #00    ; Line 107 - no change
    DB #00    ; Line 108 - no change
    DB #00    ; Line 109 - no change
    DB #00    ; Line 110 - no change
    DB #00    ; Line 111 - no change
    DB #00    ; Line 112 - no change
    DB #00    ; Line 113 - no change
    DB #00    ; Line 114 - no change
    DB #00    ; Line 115 - no change
    DB #00    ; Line 116 - no change
    DB #00    ; Line 117 - no change
    DB #00    ; Line 118 - no change
    DB #00    ; Line 119 - no change
    DB #00    ; Line 120 - no change
    DB #00    ; Line 121 - no change
    DB #00    ; Line 122 - no change
    DB #00    ; Line 123 - no change
    DB #00    ; Line 124 - no change
    DB #00    ; Line 125 - no change
    DB #00    ; Line 126 - no change
    DB #00    ; Line 127 - no change
    DB #00    ; Line 128 - no change
    DB #00    ; Line 129 - no change
    DB #00    ; Line 130 - no change
    DB #00    ; Line 131 - no change
    DB #00    ; Line 132 - no change
    DB #00    ; Line 133 - no change
    DB #00    ; Line 134 - no change
    DB #00    ; Line 135 - no change
    DB #00    ; Line 136 - no change
    DB #00    ; Line 137 - no change
    DB #00    ; Line 138 - no change
    DB #00    ; Line 139 - no change
    DB 1, 4, #4F    ; Line 140
    DB #00    ; Line 141 - no change
    DB 1, 4, #5B    ; Line 142
    DB #00    ; Line 143 - no change
    DB #00    ; Line 144 - no change
    DB #00    ; Line 145 - no change
    DB #00    ; Line 146 - no change
    DB #00    ; Line 147 - no change
    DB #00    ; Line 148 - no change
    DB #00    ; Line 149 - no change
    DB #00    ; Line 150 - no change
    DB #00    ; Line 151 - no change
    DB #00    ; Line 152 - no change
    DB #00    ; Line 153 - no change
    DB #00    ; Line 154 - no change
    DB #00    ; Line 155 - no change
    DB #00    ; Line 156 - no change
    DB #00    ; Line 157 - no change
    DB 1, 4, #4F    ; Line 158
    DB #00    ; Line 159 - no change
    DB 1, 11, #5B    ; Line 160
    DB #00    ; Line 161 - no change
    DB #00    ; Line 162 - no change
    DB #00    ; Line 163 - no change
    DB #00    ; Line 164 - no change
    DB #00    ; Line 165 - no change
    DB #00    ; Line 166 - no change
    DB #00    ; Line 167 - no change
    DB #00    ; Line 168 - no change
    DB #00    ; Line 169 - no change
    DB #00    ; Line 170 - no change
    DB #00    ; Line 171 - no change
    DB #00    ; Line 172 - no change
    DB #00    ; Line 173 - no change
    DB #00    ; Line 174 - no change
    DB #00    ; Line 175 - no change
    DB #00    ; Line 176 - no change
    DB #00    ; Line 177 - no change
    DB #00    ; Line 178 - no change
    DB #00    ; Line 179 - no change
    DB #00    ; Line 180 - no change
    DB #00    ; Line 181 - no change
    DB #00    ; Line 182 - no change
    DB #00    ; Line 183 - no change
    DB 1, 4, #59    ; Line 184
    DB 1, 4, #45    ; Line 185
    DB 1, 12, #4F    ; Line 186
    DB 1, 15, #59    ; Line 187
    DB #00    ; Line 188 - no change
    DB 1, 12, #46    ; Line 189
    DB 1, 4, #4F    ; Line 190
    DB 1, 12, #45    ; Line 191
    DB 1, 15, #46    ; Line 192
    DB #00    ; Line 193 - no change
    DB #00    ; Line 194 - no change
    DB #00    ; Line 195 - no change
    DB #00    ; Line 196 - no change
    DB 1, 11, #59    ; Line 197
    DB 1, 11, #5B    ; Line 198
    DB #00    ; Line 199 - no change
    DB 1, 12, #59    ; Line 200
    DB #00    ; Line 201 - no change
    DB 1, 14, #45    ; Line 202
    DB #00    ; Line 203 - no change
    DB #00    ; Line 204 - no change
    DB #00    ; Line 205 - no change
    DB #00    ; Line 206 - no change
    DB #00    ; Line 207 - no change
    DB #00    ; Line 208 - no change
    DB #00    ; Line 209 - no change
    DB #00    ; Line 210 - no change
    DB #00    ; Line 211 - no change
    DB #00    ; Line 212 - no change
    DB #00    ; Line 213 - no change
    DB #00    ; Line 214 - no change
    DB #00    ; Line 215 - no change
    DB #00    ; Line 216 - no change
    DB #00    ; Line 217 - no change
    DB 1, 10, #4C    ; Line 218
    DB 1, 4, #5E    ; Line 219
    DB #00    ; Line 220 - no change
    DB #00    ; Line 221 - no change
    DB #00    ; Line 222 - no change
    DB #00    ; Line 223 - no change
    DB #00    ; Line 224 - no change
    DB 1, 10, #4F    ; Line 225
    DB #00    ; Line 226 - no change
    DB #00    ; Line 227 - no change
    DB #00    ; Line 228 - no change
    DB #00    ; Line 229 - no change
    DB #00    ; Line 230 - no change
    DB #00    ; Line 231 - no change
    DB #00    ; Line 232 - no change
    DB #00    ; Line 233 - no change
    DB #00    ; Line 234 - no change
    DB #00    ; Line 235 - no change
    DB #00    ; Line 236 - no change
    DB #00    ; Line 237 - no change
    DB #00    ; Line 238 - no change
    DB 1, 8, #4C    ; Line 239
    DB 1, 12, #5F    ; Line 240
    DB 1, 10, #59    ; Line 241
    DB #00    ; Line 242 - no change
    DB 1, 11, #4F    ; Line 243
    DB #00    ; Line 244 - no change
    DB #00    ; Line 245 - no change
    DB #00    ; Line 246 - no change
    DB 2, 8, #5B, 10, #4A    ; Line 247
    DB 1, 10, #4C    ; Line 248
    DB 1, 8, #4A    ; Line 249
    DB 1, 10, #5B    ; Line 250
    DB #00    ; Line 251 - no change
    DB #00    ; Line 252 - no change
    DB #00    ; Line 253 - no change
    DB 1, 11, #59    ; Line 254
    DB 1, 11, #4F    ; Line 255
    DB #00    ; Line 256 - no change
    DB #00    ; Line 257 - no change
    DB #00    ; Line 258 - no change
    DB #00    ; Line 259 - no change
    DB #00    ; Line 260 - no change
    DB 1, 11, #59    ; Line 261
    DB 1, 11, #4F    ; Line 262
    DB #00    ; Line 263 - no change
    DB #00    ; Line 264 - no change
    DB #00    ; Line 265 - no change
    DB #00    ; Line 266 - no change
    DB 1, 11, #59    ; Line 267
    DB #00    ; Line 268 - no change
    DB #00    ; Line 269 - no change
    DB #00    ; Line 270 - no change
    DB #00    ; Line 271 - no change
    DB #00    ; Line 272 - no change
    DB #00    ; Line 273 - no change
    DB #00    ; Line 274 - no change
    DB #00    ; Line 275 - no change
    DB #00    ; Line 276 - no change
    DB #00    ; Line 277 - no change
    DB #00    ; Line 278 - no change
    DB #00    ; Line 279 - no change
; ======================================================================
; END INCLUDE: data/rasters.asm
; ======================================================================
print "END OF PROGRAM", {hex}$

    org     #4268
; include 'data/ImageData_linear_chunk_0.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: data/ImageData_linear_chunk_0.asm
; ======================================================================
; Linear Data created with Pixsaur - CPC Classic
; Mode 0 Overscan 
; 192x280 pixels, 96x280 bytes.

; Chunk 1/2 - Offset: 0 - Size: 16384 bytes
ImageData_linear_chunk_0:
  db #24, #20, #00, #00, #18, #18, #08, #00, #00, #00, #00, #00, #08, #08, #00, #00
  db #80, #80, #C0, #00, #00, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #2C, #C0
  db #C0, #C0, #C0, #C0, #E2, #E2, #B3, #B3, #B3, #F3, #E3, #F3, #F3, #F3, #F3, #F3
  db #E2, #E2, #B3, #F3, #73, #F3, #F3, #F3, #73, #E2, #C0, #F3, #73, #91, #C0, #C0
  db #C0, #C0, #C0, #91, #D1, #D1, #91, #C0, #C0, #0C, #48, #08, #00, #00, #80, #40
  db #40, #00, #00, #00, #40, #00, #40, #00, #80, #00, #40, #60, #00, #00, #00, #00
  db #04, #20, #20, #00, #24, #24, #24, #00, #00, #00, #00, #00, #60, #20, #00, #00
  db #40, #40, #40, #80, #00, #40, #C0, #C0, #C0, #C0, #80, #C0, #C0, #C0, #3C, #40
  db #40, #C0, #C0, #27, #27, #73, #D1, #D1, #27, #D3, #D3, #D3, #D3, #D3, #D3, #E3
  db #73, #D1, #27, #73, #B3, #F3, #D3, #E3, #F3, #27, #C0, #B3, #E2, #E2, #E2, #62
  db #C0, #C0, #C0, #62, #E2, #E2, #62, #62, #C0, #0D, #48, #40, #40, #40, #00, #80
  db #80, #00, #00, #00, #40, #00, #40, #00, #80, #40, #00, #80, #00, #00, #00, #40
  db #24, #10, #00, #00, #14, #04, #20, #00, #00, #00, #00, #00, #04, #00, #00, #00
  db #40, #40, #40, #00, #00, #80, #C0, #C0, #C0, #C0, #40, #C0, #C0, #C0, #3C, #80
  db #C0, #C0, #C0, #E2, #E2, #E2, #B3, #B3, #D3, #E3, #F3, #E3, #F3, #E3, #F3, #D3
  db #E2, #E2, #B3, #D3, #73, #D3, #F3, #F3, #F3, #E2, #C0, #F3, #73, #D1, #91, #C0
  db #C0, #C0, #91, #D1, #D1, #D1, #91, #C0, #C0, #48, #2C, #40, #00, #80, #00, #40
  db #00, #00, #80, #00, #80, #80, #40, #40, #00, #00, #00, #08, #80, #00, #00, #00
  db #04, #20, #00, #00, #04, #18, #90, #00, #00, #00, #00, #00, #20, #08, #00, #00
  db #40, #00, #80, #80, #00, #40, #C0, #C0, #C0, #C0, #80, #C0, #91, #C0, #3C, #40
  db #C0, #C0, #C0, #27, #27, #73, #D1, #73, #F3, #F3, #D3, #D3, #E3, #F3, #E3, #F3
  db #B3, #1B, #F3, #B3, #F3, #E3, #E3, #E3, #F3, #E2, #C0, #F3, #E2, #E2, #62, #62
  db #C0, #C0, #C0, #62, #E2, #E2, #62, #62, #C0, #84, #84, #40, #40, #00, #00, #80
  db #00, #40, #40, #00, #40, #00, #80, #80, #40, #00, #00, #40, #00, #80, #00, #00
  db #04, #28, #20, #00, #10, #08, #20, #00, #00, #00, #00, #00, #04, #10, #00, #00
  db #00, #80, #C0, #00, #00, #80, #C0, #C0, #C0, #C0, #40, #C0, #C0, #C0, #2C, #68
  db #C0, #C0, #C0, #E2, #E2, #E2, #B3, #4B, #73, #D3, #E3, #E3, #F3, #D3, #D3, #E3
  db #E2, #F3, #63, #73, #E3, #F3, #F3, #F3, #F3, #C8, #40, #F3, #73, #D1, #91, #C0
  db #C0, #C0, #91, #1B, #1B, #1B, #1B, #C0, #C0, #48, #68, #40, #00, #80, #00, #00
  db #00, #80, #00, #80, #80, #00, #40, #00, #80, #00, #00, #80, #40, #00, #00, #00
  db #04, #18, #00, #00, #04, #04, #00, #00, #00, #00, #00, #00, #20, #08, #00, #00
  db #00, #40, #00, #80, #00, #40, #C0, #C0, #C0, #C0, #C0, #C0, #91, #C0, #3C, #60
  db #C0, #C0, #D1, #D1, #D1, #D1, #27, #73, #E3, #E3, #F3, #D3, #D3, #E3, #F3, #D3
  db #B3, #B3, #F3, #F3, #F3, #E3, #E3, #E3, #F3, #C0, #05, #F3, #F3, #62, #E2, #62
  db #C0, #C0, #62, #27, #73, #27, #27, #62, #C0, #84, #94, #40, #40, #40, #00, #00
  db #40, #40, #40, #40, #00, #80, #00, #80, #00, #00, #00, #40, #00, #00, #00, #00
  db #10, #2C, #10, #00, #10, #90, #80, #00, #00, #00, #00, #00, #80, #08, #00, #00
  db #00, #00, #40, #00, #80, #40, #40, #C0, #C0, #C0, #40, #C0, #C0, #E2, #1C, #48
  db #C0, #C0, #C0, #E2, #E2, #B3, #1B, #E3, #F3, #D3, #D3, #E3, #E3, #F3, #D3, #E3
  db #E2, #D3, #B3, #F3, #E3, #E3, #E3, #F3, #D3, #4A, #11, #F3, #F3, #B3, #D1, #C0
  db #C0, #C0, #91, #1B, #1B, #B3, #1B, #91, #C0, #48, #2C, #40, #80, #80, #00, #00
  db #40, #40, #00, #80, #40, #00, #80, #40, #00, #00, #00, #00, #00, #00, #00, #40
  db #00, #1C, #00, #00, #04, #60, #20, #00, #00, #00, #00, #00, #20, #08, #00, #00
  db #00, #00, #80, #80, #00, #40, #C0, #C0, #40, #C0, #C0, #C0, #27, #C0, #2C, #C8
  db #C0, #C0, #E2, #D1, #D1, #D1, #27, #D3, #D3, #E3, #E3, #F3, #D3, #E3, #F3, #D3
  db #F3, #F3, #D3, #F3, #F3, #D3, #D3, #D3, #E3, #80, #41, #F3, #F3, #E2, #E2, #62
  db #91, #C0, #62, #27, #73, #27, #27, #62, #C0, #C0, #0D, #40, #40, #00, #00, #00
  db #40, #40, #40, #00, #80, #80, #40, #00, #00, #00, #00, #40, #00, #00, #00, #00
  db #10, #04, #20, #00, #10, #90, #00, #00, #00, #00, #00, #00, #08, #08, #00, #00
  db #00, #00, #40, #00, #80, #00, #C0, #C0, #C0, #40, #C0, #C0, #1B, #91, #6C, #48
  db #C0, #C0, #D1, #91, #1B, #E2, #B3, #E3, #E3, #F3, #D3, #D3, #D3, #D3, #E3, #F3
  db #D3, #D3, #F3, #F3, #D3, #D3, #E3, #E3, #F3, #80, #51, #F3, #F3, #F3, #62, #1B
  db #C0, #91, #C0, #B3, #B3, #B3, #1B, #1B, #C0, #48, #2C, #40, #80, #80, #00, #00
  db #80, #80, #80, #80, #40, #40, #00, #40, #00, #00, #00, #80, #40, #00, #00, #40
  db #00, #34, #10, #00, #04, #60, #20, #00, #00, #00, #00, #00, #00, #08, #00, #00
  db #00, #00, #80, #00, #00, #40, #40, #C0, #40, #C0, #C0, #85, #62, #E2, #2C, #C8
  db #C0, #85, #62, #E2, #E2, #B3, #4B, #E2, #D3, #D3, #F2, #E3, #F3, #F3, #D3, #D3
  db #E3, #F3, #F3, #F3, #E3, #E3, #E3, #E3, #F3, #00, #51, #F3, #E3, #B3, #1B, #D1
  db #91, #C0, #62, #73, #F3, #73, #27, #62, #C0, #C0, #0D, #40, #40, #00, #00, #00
  db #C0, #40, #40, #00, #80, #80, #80, #80, #00, #00, #00, #00, #80, #40, #00, #40
  db #10, #04, #04, #00, #20, #18, #00, #00, #00, #00, #00, #00, #20, #04, #00, #00
  db #00, #00, #40, #00, #80, #80, #C0, #C0, #80, #C0, #C0, #C0, #D1, #C0, #38, #38
  db #C0, #C0, #D1, #91, #1B, #1B, #5B, #D3, #E3, #F3, #F1, #F0, #FC, #FC, #F3, #E3
  db #E3, #F3, #D3, #F3, #D3, #D3, #D3, #D3, #87, #00, #51, #F3, #F3, #F3, #27, #62
  db #62, #62, #D1, #D1, #73, #B3, #B3, #1B, #C0, #C0, #84, #80, #80, #C0, #00, #00
  db #80, #80, #40, #40, #40, #40, #04, #40, #00, #00, #40, #40, #00, #80, #40, #00
  db #20, #08, #08, #20, #10, #08, #00, #00, #00, #00, #80, #00, #10, #04, #00, #00
  db #00, #00, #80, #40, #40, #40, #40, #80, #C0, #C0, #C0, #D1, #91, #D1, #4C, #4C
  db #C0, #D1, #C0, #27, #27, #27, #63, #D1, #93, #F2, #FC, #FC, #FC, #FC, #FC, #D3
  db #F3, #D3, #F3, #E3, #E3, #E3, #E3, #E3, #E2, #00, #51, #F3, #F3, #F3, #B3, #1B
  db #C0, #1B, #91, #B3, #F3, #73, #27, #62, #C0, #C0, #C0, #40, #00, #C0, #80, #C0
  db #40, #40, #00, #80, #80, #80, #40, #00, #00, #40, #00, #80, #40, #00, #80, #00
  db #08, #04, #10, #00, #08, #18, #00, #00, #00, #00, #00, #00, #40, #10, #80, #00
  db #40, #60, #20, #00, #80, #80, #80, #C0, #40, #C0, #C0, #C0, #E2, #4A, #2C, #8C
  db #C0, #C0, #E2, #E2, #E2, #B3, #5B, #F3, #63, #FC, #FC, #FC, #FC, #FC, #FC, #E9
  db #E3, #E3, #F3, #F3, #D3, #D3, #D3, #D3, #A2, #00, #D1, #F3, #E3, #F3, #73, #91
  db #1B, #C0, #27, #73, #B3, #B3, #B3, #1B, #C0, #62, #62, #00, #40, #C0, #80, #80
  db #80, #80, #40, #40, #40, #00, #04, #40, #40, #00, #40, #00, #80, #40, #40, #00
  db #08, #20, #20, #20, #08, #18, #00, #00, #00, #00, #80, #00, #10, #40, #20, #00
  db #08, #08, #80, #40, #00, #40, #40, #40, #80, #C0, #C0, #91, #D1, #91, #4C, #4C
  db #C0, #D1, #91, #D1, #D1, #D1, #27, #E3, #F6, #FC, #FC, #FC, #FC, #FC, #FC, #FC
  db #F9, #F3, #F3, #E3, #E3, #E3, #E3, #E3, #0A, #00, #D1, #F3, #F3, #D3, #73, #D1
  db #C0, #E2, #E2, #73, #F3, #73, #73, #62, #C0, #91, #C0, #40, #40, #85, #80, #C0
  db #40, #00, #80, #80, #80, #00, #80, #80, #00, #40, #00, #00, #00, #80, #00, #40
  db #08, #08, #08, #04, #24, #60, #00, #00, #00, #00, #40, #00, #40, #00, #08, #00
  db #18, #90, #80, #00, #40, #00, #80, #C0, #40, #C0, #C0, #C0, #E2, #85, #94, #34
  db #60, #4A, #27, #62, #E2, #E2, #F3, #F3, #FC, #FC, #FC, #FC, #FC, #FC, #F0, #FC
  db #F8, #E3, #F3, #F3, #D3, #D3, #D3, #D3, #0A, #00, #D1, #E3, #E3, #F3, #27, #62
  db #E2, #73, #91, #1B, #B3, #B3, #B3, #1B, #C0, #62, #62, #94, #E2, #C0, #80, #80
  db #80, #00, #40, #40, #00, #40, #04, #40, #40, #00, #80, #80, #80, #00, #00, #00
  db #0C, #10, #00, #18, #90, #18, #00, #00, #00, #40, #00, #80, #10, #00, #00, #00
  db #0C, #00, #00, #00, #80, #80, #80, #80, #C0, #C0, #C0, #C0, #91, #C0, #38, #38
  db #4A, #D1, #91, #1B, #1B, #1B, #B3, #F6, #FC, #FC, #F8, #FC, #FC, #FC, #F8, #F0
  db #FC, #F1, #D3, #E3, #E3, #E3, #E3, #F3, #00, #00, #D1, #F3, #D3, #F3, #73, #D1
  db #27, #27, #62, #62, #F3, #73, #73, #27, #91, #91, #91, #1B, #39, #4A, #80, #C0
  db #40, #00, #80, #80, #40, #00, #80, #80, #80, #40, #40, #00, #40, #00, #00, #80
  db #18, #80, #08, #08, #48, #60, #00, #00, #00, #00, #80, #00, #00, #00, #00, #04
  db #08, #08, #00, #00, #40, #40, #40, #40, #C0, #C0, #C0, #C0, #E2, #91, #C4, #34
  db #60, #4A, #E2, #E2, #27, #27, #73, #D6, #FC, #F0, #F4, #FC, #FC, #FC, #F8, #F0
  db #F4, #F8, #F3, #F3, #D3, #D3, #D3, #A7, #00, #00, #D1, #E3, #F3, #F3, #93, #E2
  db #B3, #1B, #E2, #91, #F3, #B3, #B3, #1B, #D1, #C0, #62, #C1, #A7, #62, #00, #80
  db #80, #40, #40, #00, #80, #80, #04, #40, #00, #80, #80, #40, #00, #00, #40, #00
  db #0C, #60, #24, #60, #04, #18, #00, #00, #00, #40, #40, #40, #00, #00, #00, #18
  db #2C, #00, #00, #00, #80, #80, #80, #C0, #C0, #C0, #C0, #91, #C0, #C0, #68, #98
  db #1A, #D1, #D1, #73, #91, #1B, #79, #FC, #F8, #F0, #F4, #F4, #FC, #FC, #F8, #F0
  db #F0, #F8, #D3, #D3, #E3, #E3, #E3, #A7, #00, #00, #4B, #F3, #D3, #F3, #F3, #73
  db #D1, #73, #91, #D1, #D1, #F3, #73, #27, #62, #62, #D1, #C0, #D3, #28, #00, #C0
  db #40, #04, #80, #40, #40, #40, #40, #40, #40, #40, #40, #00, #00, #00, #90, #40
  db #04, #24, #10, #80, #04, #04, #00, #00, #00, #00, #80, #80, #00, #00, #00, #0C
  db #20, #00, #00, #40, #40, #40, #C0, #80, #C0, #C0, #C0, #C0, #E2, #62, #C4, #4C
  db #60, #C0, #E2, #E2, #E2, #36, #76, #FC, #F0, #F0, #F8, #F4, #FC, #FC, #FC, #F0
  db #F0, #F4, #F1, #E3, #E3, #E3, #F3, #82, #00, #00, #F3, #D3, #E3, #F3, #B3, #E2
  db #B3, #B3, #E2, #62, #F3, #F3, #B3, #1B, #1B, #1B, #91, #4A, #00, #00, #40, #C0
  db #00, #80, #00, #80, #80, #80, #80, #08, #80, #80, #80, #00, #00, #40, #08, #00
  db #08, #1C, #04, #00, #00, #0C, #00, #00, #00, #00, #40, #00, #80, #00, #40, #34
  db #80, #00, #00, #00, #80, #80, #C0, #C0, #C0, #C0, #C0, #91, #C0, #D1, #08, #C8
  db #88, #D1, #D1, #73, #D1, #D1, #D6, #F8, #F0, #F0, #F8, #F8, #FC, #FC, #F8, #F8
  db #E5, #F4, #F9, #D3, #D3, #D3, #D3, #0A, #00, #00, #F3, #E3, #F3, #E3, #F3, #D1
  db #73, #B3, #B3, #1B, #D1, #F3, #73, #27, #73, #27, #27, #C0, #00, #00, #40, #C0
  db #40, #20, #40, #40, #40, #40, #40, #40, #40, #40, #00, #00, #00, #84, #00, #80
  db #60, #10, #18, #80, #00, #38, #80, #00, #00, #00, #80, #80, #00, #00, #10, #84
  db #20, #00, #00, #40, #40, #40, #C0, #80, #C0, #C0, #C0, #62, #1B, #C0, #1A, #C4
  db #90, #85, #27, #E2, #E2, #C2, #FC, #F0, #F0, #F0, #F0, #F4, #FC, #FC, #F0, #F0
  db #E5, #F0, #E9, #F3, #E3, #E3, #F3, #08, #00, #00, #E3, #F3, #D3, #F3, #93, #B3
  db #F3, #73, #B3, #62, #B3, #F3, #B3, #B3, #E2, #B3, #4A, #00, #80, #80, #00, #80
  db #80, #80, #80, #80, #80, #80, #80, #08, #80, #80, #00, #00, #04, #80, #40, #40
  db #18, #04, #24, #00, #00, #0C, #00, #00, #00, #00, #40, #40, #40, #00, #40, #0C
  db #00, #00, #00, #40, #40, #40, #40, #C0, #C0, #C0, #C0, #C0, #62, #D1, #08, #C8
  db #25, #31, #1B, #B3, #D1, #C1, #FC, #F0, #F0, #F0, #F4, #F0, #FC, #F4, #F0, #F0
  db #F0, #DA, #F8, #E3, #F3, #D3, #E3, #00, #00, #00, #F3, #E3, #E3, #F3, #F3, #73
  db #F3, #F3, #B3, #E2, #73, #F3, #73, #27, #73, #D1, #80, #80, #C0, #C0, #40, #80
  db #80, #00, #C0, #40, #40, #40, #40, #40, #40, #40, #40, #40, #48, #00, #80, #80
  db #0C, #00, #00, #00, #00, #2C, #10, #00, #00, #00, #00, #80, #80, #00, #04, #08
  db #00, #00, #00, #40, #40, #40, #C0, #C0, #C0, #C0, #C0, #C0, #91, #C0, #1A, #90
  db #10, #51, #D1, #D1, #D1, #D8, #F8, #F0, #F0, #F0, #F0, #F4, #F4, #F0, #F0, #F0
  db #E5, #C7, #FC, #F3, #D3, #D3, #A7, #00, #00, #00, #E3, #F3, #D3, #F3, #B3, #B3
  db #D3, #E3, #B3, #73, #D1, #B3, #F3, #B3, #B3, #E2, #80, #40, #40, #40, #00, #84
  db #00, #40, #40, #40, #40, #40, #40, #40, #40, #40, #40, #40, #00, #40, #40, #40
  db #18, #00, #00, #00, #00, #0C, #00, #00, #00, #00, #40, #00, #00, #00, #08, #38
  db #00, #40, #00, #80, #80, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #E2, #08, #20
  db #08, #60, #E2, #E2, #E6, #F6, #F8, #F0, #DA, #F0, #F0, #F4, #F4, #F4, #F0, #F0
  db #DA, #CB, #F4, #F1, #E3, #F3, #C2, #00, #00, #00, #F3, #D3, #F3, #F3, #F3, #73
  db #F3, #F3, #B3, #E2, #B3, #F3, #B3, #E2, #F3, #73, #00, #80, #80, #C0, #40, #80
  db #40, #40, #40, #40, #80, #80, #80, #80, #80, #80, #80, #80, #80, #80, #80, #80
  db #0C, #00, #00, #00, #04, #14, #60, #00, #00, #00, #00, #40, #00, #00, #84, #08
  db #00, #00, #40, #40, #40, #40, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #A2, #20
  db #60, #04, #1B, #B3, #5B, #D6, #F0, #DA, #F0, #F0, #F0, #F0, #F8, #F8, #F4, #F0
  db #E5, #C7, #DE, #F9, #F3, #E3, #A2, #00, #00, #40, #E3, #E3, #F3, #E3, #F3, #F3
  db #E3, #F3, #F3, #73, #73, #F3, #F3, #73, #73, #27, #40, #40, #40, #C0, #40, #00
  db #00, #08, #80, #80, #80, #80, #80, #80, #80, #08, #C0, #40, #40, #40, #00, #40
  db #04, #60, #20, #00, #10, #14, #08, #00, #00, #00, #00, #00, #00, #00, #18, #08
  db #00, #80, #00, #80, #80, #C0, #C0, #C0, #40, #C0, #C0, #C0, #C0, #85, #80, #10
  db #10, #00, #C2, #E2, #E6, #D6, #E5, #E5, #E5, #F0, #F0, #F0, #F4, #F0, #F0, #E5
  db #F0, #CB, #DA, #F9, #D3, #F3, #80, #00, #00, #40, #F3, #F3, #D3, #F3, #F3, #63
  db #F3, #F3, #B3, #B3, #B3, #F3, #F3, #B3, #B3, #B3, #40, #40, #80, #C0, #40, #00
  db #00, #80, #80, #C0, #40, #04, #80, #80, #80, #68, #40, #00, #00, #80, #80, #80
  db #04, #20, #08, #00, #04, #04, #08, #20, #00, #00, #00, #00, #00, #04, #04, #20
  db #40, #00, #00, #80, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #A2, #20
  db #00, #20, #D1, #D1, #D9, #F4, #DA, #DA, #DA, #F0, #F0, #F0, #F0, #F0, #F0, #F0
  db #E5, #C7, #F2, #E9, #F3, #D3, #80, #00, #00, #05, #E3, #E3, #F3, #D3, #F3, #F3
  db #E3, #F3, #D3, #73, #73, #F3, #F3, #73, #73, #27, #80, #80, #C0, #80, #80, #40
  db #00, #80, #80, #80, #80, #48, #40, #40, #40, #28, #80, #80, #80, #40, #40, #40
  db #04, #08, #20, #00, #04, #20, #2C, #00, #00, #00, #00, #00, #00, #04, #08, #08
  db #00, #80, #40, #40, #40, #40, #C0, #C0, #40, #C0, #C0, #C0, #C0, #C0, #80, #00
  db #20, #00, #0D, #27, #F3, #F8, #CF, #E5, #F0, #DA, #F0, #F0, #F0, #F0, #F0, #DA
  db #DA, #DB, #E7, #E9, #F3, #A7, #00, #00, #00, #40, #D3, #F3, #D3, #F3, #B3, #D3
  db #F3, #F3, #F3, #B3, #B3, #F3, #F3, #B3, #F3, #C2, #40, #40, #40, #40, #00, #80
  db #80, #80, #80, #80, #C0, #80, #80, #80, #80, #68, #80, #40, #00, #80, #80, #80
  db #00, #18, #80, #00, #00, #00, #0C, #00, #00, #00, #00, #00, #00, #90, #90, #80
  db #40, #00, #80, #80, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #80, #00
  db #10, #10, #51, #D1, #D9, #F8, #CB, #DA, #DA, #E5, #F0, #F0, #F0, #DA, #F0, #DA
  db #CB, #CB, #F3, #F8, #E3, #E2, #00, #00, #00, #05, #F3, #D3, #E3, #F3, #F3, #73
  db #D3, #F3, #E3, #73, #73, #F3, #F3, #F3, #E2, #C0, #00, #80, #80, #80, #40, #40
  db #40, #40, #40, #60, #40, #80, #90, #80, #94, #08, #80, #00, #40, #40, #40, #40
  db #10, #90, #80, #00, #00, #04, #1C, #20, #00, #00, #00, #00, #80, #84, #40, #20
  db #40, #00, #40, #40, #40, #40, #C0, #80, #C0, #C0, #C0, #C0, #C0, #C0, #80, #00
  db #00, #00, #14, #73, #E3, #F0, #DA, #DA, #E5, #F0, #E5, #F0, #F0, #E5, #F0, #DA
  db #F2, #E7, #E3, #F4, #F3, #82, #00, #00, #00, #05, #E3, #E3, #F3, #F3, #E6, #F3
  db #F3, #E3, #F3, #93, #F3, #F3, #F3, #B3, #E2, #C0, #C0, #80, #80, #00, #80, #80
  db #80, #80, #80, #80, #C0, #40, #00, #40, #14, #68, #00, #80, #80, #00, #80, #80
  db #00, #18, #10, #00, #00, #00, #0C, #08, #00, #00, #00, #04, #00, #18, #90, #00
  db #80, #80, #80, #80, #80, #C0, #80, #C0, #40, #C0, #C0, #C0, #C0, #C0, #94, #00
  db #00, #00, #40, #E6, #E3, #ED, #E7, #E5, #F0, #DA, #DA, #F0, #F0, #DA, #E5, #E5
  db #F1, #CB, #5B, #F4, #F3, #80, #00, #00, #00, #51, #D3, #F3, #D3, #F3, #F3, #E6
  db #E3, #F3, #E3, #B3, #F3, #F3, #F3, #F3, #85, #C0, #C0, #C0, #00, #40, #40, #40
  db #40, #40, #40, #68, #80, #80, #00, #80, #94, #28, #80, #40, #00, #80, #80, #40
  db #00, #08, #08, #00, #00, #00, #18, #28, #00, #00, #00, #00, #90, #84, #00, #60
  db #40, #00, #40, #40, #40, #C0, #C0, #40, #C0, #C0, #C0, #C0, #C0, #85, #C0, #00
  db #00, #00, #00, #D3, #F6, #F1, #E5, #DA, #DA, #DA, #E5, #E5, #F0, #E5, #E5, #CB
  db #DB, #F3, #E3, #DE, #D3, #80, #00, #00, #00, #41, #F3, #D3, #F3, #F3, #E3, #F3
  db #F3, #E3, #F3, #E6, #F3, #D3, #F3, #F3, #C0, #C0, #C0, #80, #80, #C0, #80, #80
  db #80, #80, #80, #68, #40, #00, #80, #C0, #14, #68, #40, #00, #40, #40, #40, #00
  db #00, #0C, #04, #00, #00, #00, #04, #24, #00, #00, #80, #40, #40, #60, #10, #00
  db #80, #80, #80, #80, #80, #C0, #80, #80, #C0, #C0, #69, #F8, #F0, #87, #96, #00
  db #00, #00, #00, #5B, #D6, #DB, #DA, #F2, #DA, #DA, #DA, #DA, #DA, #DA, #DA, #E7
  db #D3, #F3, #5B, #F6, #E3, #00, #00, #00, #00, #51, #E3, #F3, #D3, #F3, #F3, #D9
  db #F3, #F3, #E3, #B3, #E6, #F3, #F3, #F3, #C0, #C0, #C0, #80, #40, #C0, #40, #40
  db #00, #80, #80, #68, #40, #40, #40, #40, #14, #28, #80, #80, #80, #00, #80, #80
  db #00, #18, #08, #00, #00, #00, #00, #1C, #20, #00, #00, #08, #10, #90, #00, #08
  db #80, #40, #40, #40, #40, #C0, #C0, #C0, #94, #D6, #FC, #FC, #FC, #FC, #BC, #00
  db #00, #00, #00, #59, #F6, #DB, #F1, #E5, #E5, #E5, #E5, #E5, #E5, #E5, #E5, #F1
  db #DB, #F3, #5B, #F6, #E0, #00, #00, #00, #00, #41, #F3, #D3, #F3, #F3, #D3, #F3
  db #F3, #D3, #F3, #E6, #F3, #D9, #F3, #F3, #C0, #C0, #84, #80, #C0, #C0, #80, #80
  db #80, #80, #C0, #28, #80, #40, #40, #00, #81, #08, #80, #40, #00, #80, #80, #80
  db #00, #04, #60, #20, #00, #00, #00, #04, #08, #00, #40, #00, #08, #08, #80, #40
  db #40, #00, #80, #80, #C0, #C0, #80, #85, #D6, #FC, #FC, #FC, #FC, #FC, #BC, #00
  db #00, #00, #00, #41, #F6, #E7, #F2, #DA, #DA, #DA, #DA, #DA, #DA, #DA, #DA, #E7
  db #F3, #5B, #5B, #5E, #A0, #00, #00, #00, #00, #D1, #D3, #E3, #F3, #F3, #E3, #F3
  db #E3, #F3, #D3, #F3, #73, #F3, #F3, #F3, #C0, #E2, #C0, #40, #C0, #C0, #80, #80
  db #80, #C0, #14, #08, #40, #40, #80, #00, #54, #28, #80, #80, #40, #40, #40, #40
  db #00, #18, #08, #08, #00, #00, #00, #60, #34, #80, #00, #80, #08, #08, #00, #08
  db #80, #80, #40, #40, #40, #C0, #40, #C3, #FC, #FC, #FC, #FC, #FC, #FC, #BC, #00
  db #00, #00, #00, #05, #D2, #E7, #F1, #CF, #E5, #E5, #E5, #E5, #E5, #E5, #F1, #F1
  db #A7, #A7, #A7, #F2, #82, #00, #00, #00, #00, #C1, #F3, #D3, #F3, #E3, #F3, #D3
  db #F3, #F3, #E3, #E6, #F3, #E3, #F3, #F3, #85, #27, #C0, #40, #C0, #C0, #C0, #40
  db #80, #C0, #14, #68, #40, #80, #80, #00, #5C, #80, #80, #00, #80, #00, #80, #80
  db #00, #04, #24, #10, #00, #00, #00, #10, #04, #0C, #00, #00, #08, #18, #80, #40
  db #40, #40, #40, #80, #C0, #C0, #C1, #D6, #FC, #FC, #FC, #FC, #FC, #FC, #BC, #00
  db #00, #00, #00, #40, #D2, #E7, #E7, #F1, #DA, #DA, #DA, #DA, #DA, #CB, #CB, #F3
  db #F3, #5B, #5B, #5A, #28, #00, #00, #00, #00, #5B, #D3, #E3, #E3, #F3, #D3, #F3
  db #D3, #F3, #D3, #F3, #D9, #D3, #F3, #F3, #C0, #68, #80, #C1, #80, #C0, #80, #80
  db #80, #C0, #94, #28, #80, #80, #40, #40, #7C, #40, #40, #40, #00, #80, #40, #00
  db #00, #04, #04, #60, #20, #00, #00, #00, #40, #24, #08, #04, #04, #08, #00, #08
  db #80, #00, #80, #C0, #40, #C0, #7C, #FC, #F8, #F0, #F4, #FC, #F8, #F8, #BC, #00
  db #00, #00, #00, #00, #F0, #F3, #F1, #DA, #E7, #E5, #E5, #F1, #E5, #C7, #C7, #F3
  db #5B, #5B, #5B, #F2, #00, #00, #00, #00, #00, #4B, #E3, #F3, #F3, #D3, #F3, #D3
  db #F3, #D3, #F3, #E3, #F3, #F3, #F3, #F3, #68, #C0, #40, #B3, #C0, #C0, #C0, #40
  db #C0, #40, #94, #68, #40, #40, #40, #40, #3C, #28, #80, #00, #40, #00, #80, #40
  db #00, #00, #18, #08, #20, #00, #00, #00, #00, #40, #00, #00, #08, #08, #80, #40
  db #40, #40, #40, #40, #C0, #41, #FC, #FC, #F0, #F0, #F0, #F8, #FC, #F4, #F8, #00
  db #00, #00, #00, #00, #5A, #E7, #E7, #C7, #CB, #DA, #F2, #DA, #CB, #DB, #DB, #F3
  db #5B, #5B, #5B, #5B, #00, #00, #00, #00, #00, #79, #D3, #E3, #E3, #F3, #D3, #E3
  db #E3, #F3, #D3, #D3, #F3, #F3, #F3, #F3, #E2, #4A, #F3, #27, #C0, #C0, #C0, #C0
  db #40, #40, #94, #68, #80, #40, #40, #40, #7C, #40, #40, #40, #00, #40, #00, #80
  db #00, #00, #08, #08, #08, #00, #00, #00, #00, #04, #00, #00, #08, #18, #40, #40
  db #80, #80, #80, #80, #C0, #7C, #FC, #F8, #F0, #F2, #F4, #FC, #F0, #F8, #F8, #00
  db #00, #00, #00, #00, #50, #F3, #DB, #DB, #CF, #E5, #F1, #DB, #E5, #F2, #E7, #A7
  db #A7, #27, #A7, #A7, #00, #00, #00, #00, #00, #F2, #F3, #D3, #F3, #D3, #E3, #F3
  db #D3, #E3, #F3, #F3, #F3, #D3, #F3, #F3, #F3, #F3, #B3, #B3, #C0, #C0, #C0, #80
  db #80, #C0, #94, #68, #00, #00, #80, #80, #7C, #40, #00, #00, #00, #80, #40, #00
  db #00, #00, #90, #90, #10, #00, #00, #80, #00, #04, #00, #04, #08, #08, #00, #80
  db #80, #40, #40, #40, #94, #FC, #FC, #F0, #96, #96, #F0, #FC, #F4, #F8, #F8, #00
  db #00, #00, #00, #00, #05, #F3, #DB, #DB, #F1, #CB, #DA, #F2, #DB, #F1, #DB, #F3
  db #1B, #5B, #5B, #0A, #00, #00, #00, #00, #00, #F1, #D3, #E3, #CB, #CB, #F3, #D3
  db #E3, #F3, #E3, #F3, #D3, #E3, #F3, #F3, #F3, #87, #E3, #F3, #C0, #4A, #C0, #80
  db #C0, #00, #81, #80, #40, #40, #40, #40, #A9, #80, #80, #80, #40, #00, #80, #80
  db #00, #00, #04, #04, #00, #00, #40, #60, #60, #60, #08, #84, #08, #08, #80, #40
  db #40, #40, #40, #C0, #54, #FC, #F0, #B4, #3C, #3C, #DA, #F8, #F0, #F0, #F0, #00
  db #00, #00, #00, #00, #00, #F3, #DB, #DB, #DB, #E5, #E7, #C7, #E7, #F3, #F3, #A7
  db #A7, #A7, #E2, #0A, #00, #00, #00, #00, #00, #F1, #D3, #F1, #C7, #D3, #F1, #E3
  db #F3, #E3, #F3, #D3, #F3, #F3, #F3, #F3, #F3, #DA, #F3, #C2, #4A, #C0, #80, #C0
  db #80, #80, #D4, #28, #80, #80, #80, #84, #FC, #40, #40, #00, #80, #40, #00, #40
  db #00, #00, #00, #08, #00, #00, #00, #90, #90, #04, #04, #04, #04, #60, #60, #40
  db #40, #40, #40, #40, #FC, #F8, #E1, #88, #30, #3C, #F0, #F0, #F0, #D6, #F0, #00
  db #00, #00, #00, #00, #00, #5B, #E7, #E7, #F2, #E7, #F1, #DB, #DB, #D3, #DB, #F3
  db #1B, #1B, #5B, #80, #00, #00, #00, #00, #40, #F1, #CB, #CB, #CB, #E7, #D3, #F1
  db #E3, #F3, #D3, #E3, #F3, #D3, #F3, #F3, #F3, #F3, #F1, #F3, #C0, #4A, #C0, #C0
  db #80, #C0, #D4, #C0, #40, #40, #40, #40, #A9, #80, #00, #40, #00, #80, #40, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #60, #00, #08, #2C, #04, #90, #80, #80
  db #80, #80, #C0, #94, #FC, #F0, #96, #34, #14, #1C, #CB, #F0, #F0, #E5, #F0, #28
  db #00, #00, #00, #00, #00, #5B, #F3, #DB, #DB, #CB, #CF, #C7, #F3, #5B, #F3, #A7
  db #A7, #27, #A7, #00, #00, #00, #00, #00, #05, #C7, #C7, #F1, #C7, #E3, #CB, #E3
  db #F3, #D3, #E3, #F3, #F3, #F3, #F3, #F3, #F3, #F3, #F2, #F3, #94, #C0, #C0, #C0
  db #C0, #40, #D4, #68, #40, #40, #40, #68, #BC, #40, #40, #00, #40, #00, #80, #80
  db #00, #00, #00, #00, #00, #00, #00, #00, #90, #80, #04, #24, #04, #60, #08, #40
  db #40, #40, #40, #54, #FC, #E1, #38, #1A, #30, #3C, #D2, #D2, #69, #78, #DA, #80
  db #00, #00, #00, #00, #00, #51, #E7, #E7, #E7, #C7, #F2, #F3, #F3, #F3, #F3, #5B
  db #1B, #5B, #85, #00, #00, #00, #00, #00, #14, #CB, #DA, #CB, #CB, #F2, #E3, #DB
  db #D3, #F3, #D3, #E3, #F3, #E3, #F3, #F3, #F3, #F3, #F3, #D3, #C0, #4A, #C0, #40
  db #40, #C0, #D4, #68, #40, #40, #04, #94, #BC, #80, #80, #80, #80, #40, #00, #40
  db #00, #00, #00, #00, #00, #00, #00, #00, #60, #20, #80, #0C, #04, #90, #80, #80
  db #80, #80, #C0, #7C, #F8, #B4, #28, #60, #8C, #9C, #79, #69, #69, #3C, #D2, #0A
  db #00, #00, #00, #00, #00, #05, #F3, #DB, #E7, #F3, #DB, #8F, #F3, #5B, #A7, #A7
  db #A7, #27, #E2, #00, #00, #00, #00, #00, #05, #C7, #E5, #C7, #C7, #D3, #C7, #C7
  db #E3, #E3, #F3, #D3, #F3, #D3, #F3, #F3, #F3, #F3, #F3, #F3, #84, #4A, #08, #80
  db #80, #C0, #7C, #80, #80, #80, #C0, #94, #BC, #40, #40, #40, #00, #80, #40, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #90, #80, #04, #14, #04, #60, #60, #40
  db #40, #40, #80, #F8, #F8, #C6, #08, #18, #C4, #1C, #69, #6C, #38, #8C, #6D, #08
  db #00, #00, #00, #00, #00, #00, #F3, #F3, #DB, #DB, #E7, #F3, #A7, #F3, #F3, #5B
  db #D1, #4A, #0A, #00, #00, #00, #00, #00, #41, #DA, #F2, #DA, #DA, #F2, #F2, #F2
  db #F3, #D3, #E3, #F3, #D3, #E3, #F3, #F3, #F3, #F3, #F3, #E2, #C0, #4A, #40, #80
  db #C0, #C0, #7C, #68, #40, #40, #C0, #94, #BC, #C0, #40, #00, #80, #00, #80, #80
  db #00, #00, #00, #00, #00, #00, #00, #00, #08, #04, #00, #0C, #04, #04, #00, #80
  db #80, #C0, #14, #F4, #E9, #38, #8C, #C8, #24, #8C, #6C, #4C, #08, #64, #2C, #00
  db #00, #00, #00, #00, #00, #00, #F3, #E7, #F3, #E7, #F3, #F3, #5B, #F3, #5B, #0F
  db #E2, #4A, #0A, #00, #00, #00, #00, #00, #41, #F1, #E5, #C7, #F1, #F1, #F1, #F1
  db #F1, #E3, #F3, #D3, #E3, #E3, #E7, #F3, #F3, #F3, #F3, #C0, #C0, #68, #C0, #80
  db #C0, #C0, #7C, #68, #80, #80, #80, #1C, #BC, #80, #80, #80, #40, #40, #00, #40
  db #40, #00, #00, #00, #00, #00, #00, #04, #40, #20, #08, #1C, #84, #04, #40, #40
  db #40, #40, #94, #F4, #B4, #3C, #3C, #38, #4C, #4C, #1C, #24, #8C, #10, #28, #20
  db #00, #00, #00, #00, #00, #00, #5B, #F3, #F3, #F3, #F3, #F3, #A7, #A7, #A7, #E2
  db #1B, #4A, #80, #00, #00, #00, #00, #00, #50, #F2, #CB, #DA, #DA, #F2, #DA, #F2
  db #E3, #DB, #D3, #E3, #F3, #D3, #E3, #DB, #F3, #F3, #E2, #84, #85, #C0, #C0, #C0
  db #C0, #C0, #7C, #68, #C0, #40, #04, #41, #16, #C0, #40, #40, #40, #00, #80, #80
  db #00, #00, #00, #00, #00, #00, #00, #00, #08, #90, #90, #94, #0C, #40, #00, #80
  db #80, #C0, #D4, #FC, #96, #29, #29, #29, #24, #8C, #8C, #8C, #44, #90, #1A, #00
  db #00, #00, #00, #00, #00, #00, #51, #F3, #F3, #F3, #F3, #F3, #5B, #F3, #5B, #D1
  db #85, #85, #00, #00, #00, #00, #00, #00, #D0, #DA, #E5, #E5, #F1, #E5, #E5, #C7
  db #C7, #D3, #E3, #F3, #D3, #E3, #DB, #D3, #F3, #F3, #4A, #C0, #C0, #C0, #C0, #C0
  db #C0, #C0, #7C, #68, #80, #80, #80, #D4, #3C, #48, #40, #40, #40, #40, #00, #40
  db #00, #00, #00, #00, #00, #00, #00, #04, #04, #40, #60, #24, #18, #80, #40, #00
  db #40, #80, #7C, #F8, #16, #3C, #16, #16, #38, #4C, #4C, #90, #10, #10, #00, #20
  db #00, #00, #00, #00, #00, #00, #05, #F3, #F3, #F3, #F3, #5B, #A7, #A7, #E2, #E2
  db #4A, #4A, #00, #00, #00, #00, #00, #00, #4B, #E5, #F0, #DA, #DA, #DA, #DA, #F2
  db #E3, #E3, #F3, #D3, #E3, #F3, #C7, #E7, #F3, #A7, #C0, #C0, #C0, #85, #C0, #C0
  db #C0, #C0, #7C, #C0, #40, #40, #00, #D4, #3C, #84, #80, #80, #80, #80, #40, #40
  db #00, #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #0C, #68, #00, #80, #80
  db #80, #C0, #FC, #BC, #16, #16, #16, #16, #16, #24, #2C, #8C, #C8, #20, #20, #00
  db #00, #00, #00, #00, #00, #00, #00, #D3, #F3, #F3, #5B, #A7, #F3, #5B, #5B, #85
  db #85, #C0, #00, #00, #00, #00, #00, #00, #6D, #F0, #DA, #E5, #E5, #F1, #E5, #C7
  db #C7, #D3, #F1, #E3, #F3, #D3, #F2, #F3, #CB, #4A, #C0, #C0, #C0, #C0, #C0, #C0
  db #C0, #C0, #83, #4A, #08, #00, #80, #D4, #16, #C0, #40, #40, #40, #60, #00, #84
  db #00, #00, #00, #00, #00, #00, #08, #04, #04, #04, #04, #04, #38, #80, #40, #40
  db #40, #14, #FC, #BC, #16, #03, #29, #29, #29, #3C, #16, #6C, #4C, #10, #10, #00
  db #00, #00, #00, #00, #00, #00, #00, #5B, #5B, #5B, #5B, #F3, #5B, #5B, #85, #27
  db #C0, #0A, #00, #00, #00, #00, #00, #00, #D2, #DA, #E5, #F0, #DA, #DA, #F1, #F1
  db #F1, #F2, #E3, #F3, #D3, #E3, #E7, #C7, #A7, #C0, #C0, #C0, #C0, #94, #C0, #C0
  db #C0, #4A, #BC, #48, #40, #40, #40, #7C, #3C, #C0, #80, #80, #80, #80, #40, #40
  db #00, #00, #00, #00, #00, #00, #04, #04, #04, #04, #04, #04, #0C, #40, #00, #80
  db #40, #94, #FC, #29, #29, #16, #16, #16, #16, #16, #29, #29, #38, #20, #20, #20
  db #00, #00, #00, #00, #00, #00, #00, #51, #A7, #A7, #A7, #A7, #F3, #5B, #1B, #4A
  db #4A, #80, #00, #00, #00, #00, #00, #00, #C7, #F0, #DA, #E5, #F0, #E5, #E5, #C7
  db #C7, #C7, #C7, #D3, #E3, #F3, #F1, #CB, #4A, #C0, #C0, #C0, #C0, #94, #C0, #C0
  db #C0, #C0, #BC, #80, #80, #80, #80, #7C, #3C, #C0, #40, #40, #40, #40, #40, #04
  db #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #0C, #00, #80, #80
  db #80, #90, #FC, #29, #03, #03, #29, #29, #29, #29, #3C, #16, #46, #08, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #40, #A7, #F3, #5B, #5B, #A7, #A7, #27, #85
  db #85, #80, #00, #00, #00, #00, #00, #40, #F0, #F0, #E5, #F0, #E5, #F1, #F1, #F0
  db #CB, #CB, #CB, #F2, #F3, #D3, #E5, #87, #C0, #C0, #4A, #C0, #C0, #C1, #C0, #C0
  db #C0, #C0, #BC, #08, #40, #40, #40, #D6, #2C, #C0, #80, #C0, #80, #80, #80, #C0
  db #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #84, #08, #40, #40
  db #40, #D4, #A9, #29, #03, #03, #16, #16, #03, #29, #29, #29, #29, #88, #00, #88
  db #00, #00, #00, #00, #00, #00, #00, #40, #5B, #5B, #5B, #A7, #E2, #A7, #1B, #4A
  db #C0, #00, #00, #00, #00, #00, #00, #40, #FC, #E5, #F0, #DA, #F0, #F2, #DA, #DA
  db #F2, #F2, #F2, #F3, #F1, #F2, #CB, #4A, #85, #C0, #27, #C0, #C0, #D4, #C0, #C0
  db #C0, #48, #BC, #80, #80, #C0, #94, #7C, #68, #C0, #40, #80, #80, #80, #C0, #04
  db #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #0C, #40, #40, #40
  db #40, #7C, #BD, #03, #21, #03, #03, #29, #16, #03, #3C, #16, #16, #9C, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #5B, #A7, #A7, #F3, #1B, #1B, #4A, #C0
  db #C0, #00, #00, #00, #00, #00, #00, #50, #F4, #F0, #E5, #F0, #DA, #E5, #E5, #F0
  db #F2, #F2, #F3, #F1, #F2, #E3, #CA, #36, #62, #85, #91, #C0, #C0, #D4, #C0, #C0
  db #C0, #40, #BC, #40, #40, #40, #C0, #74, #68, #40, #C0, #C0, #40, #00, #80, #C0
  db #00, #00, #00, #00, #00, #00, #04, #04, #04, #04, #04, #04, #04, #C4, #80, #80
  db #C0, #7C, #3C, #03, #21, #03, #03, #03, #29, #34, #16, #16, #29, #15, #44, #14
  db #00, #00, #00, #00, #00, #00, #00, #00, #85, #A7, #E2, #A7, #E2, #4A, #E2, #C0
  db #80, #00, #00, #00, #00, #00, #00, #50, #F0, #F8, #F0, #DA, #E5, #F0, #DA, #E5
  db #C7, #F1, #F1, #F1, #F1, #F1, #39, #39, #1B, #4A, #85, #C0, #C0, #D4, #C0, #C0
  db #00, #94, #BC, #40, #40, #40, #40, #BC, #42, #80, #80, #C0, #00, #80, #C0, #40
  db #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #08, #08, #08, #80
  db #C0, #74, #3C, #12, #12, #03, #03, #16, #21, #21, #29, #29, #3C, #02, #88, #29
  db #0A, #00, #00, #00, #00, #00, #00, #00, #51, #5B, #85, #F3, #85, #27, #85, #C0
  db #80, #00, #00, #00, #00, #00, #00, #5A, #F0, #FC, #DA, #E5, #E5, #E5, #F0, #F1
  db #F0, #DA, #F2, #F2, #F2, #E3, #1B, #A7, #27, #27, #91, #4A, #C0, #D4, #4A, #80
  db #40, #14, #BC, #80, #80, #C0, #40, #B8, #68, #40, #C0, #00, #80, #40, #40, #C0
  db #00, #00, #00, #00, #00, #08, #08, #08, #08, #48, #C8, #C8, #C8, #0C, #40, #40
  db #C0, #FC, #9C, #12, #21, #03, #03, #03, #21, #34, #16, #16, #16, #9C, #00, #52
  db #0A, #00, #00, #00, #00, #00, #00, #00, #40, #A7, #E2, #5B, #4A, #E2, #E2, #C0
  db #00, #00, #00, #00, #00, #00, #00, #78, #F0, #F4, #F0, #DA, #DA, #F0, #F0, #DA
  db #DA, #DA, #CB, #CB, #CB, #CB, #E3, #73, #1B, #4A, #4A, #62, #4A, #7C, #C0, #40
  db #40, #94, #BC, #80, #80, #80, #94, #BC, #68, #C0, #00, #80, #40, #00, #80, #C0
  db #00, #00, #00, #00, #00, #04, #04, #04, #04, #04, #04, #04, #04, #04, #C4, #80
  db #94, #BC, #09, #21, #21, #21, #21, #12, #56, #21, #29, #03, #29, #9C, #15, #52
  db #8A, #00, #00, #00, #00, #00, #00, #00, #00, #A7, #E2, #A7, #62, #0F, #C0, #C0
  db #00, #00, #00, #00, #00, #00, #00, #F0, #F0, #F4, #F8, #F0, #E5, #F0, #F0, #E5
  db #F0, #E5, #F1, #F1, #F1, #F1, #F3, #E2, #D3, #D1, #D1, #D1, #85, #5C, #68, #C0
  db #C0, #94, #BC, #80, #80, #80, #94, #BC, #68, #40, #40, #40, #40, #40, #40, #40
  db #00, #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #48, #08, #48, #40
  db #94, #B4, #98, #12, #12, #12, #12, #12, #B8, #A9, #03, #29, #3C, #6E, #01, #78
  db #A5, #00, #00, #00, #00, #00, #00, #00, #00, #D1, #4A, #D1, #C0, #4A, #4A, #80
  db #00, #00, #00, #00, #00, #00, #05, #E5, #F0, #F0, #FC, #DA, #DA, #F0, #DA, #DA
  db #E5, #E5, #C7, #C7, #C7, #C7, #D3, #E3, #E2, #E2, #E2, #E2, #E2, #7C, #68, #C0
  db #C0, #94, #A9, #80, #80, #80, #94, #BC, #68, #00, #80, #80, #80, #80, #80, #C0
  db #00, #00, #00, #00, #00, #04, #00, #C8, #04, #04, #04, #04, #C4, #84, #04, #40
  db #94, #A8, #29, #12, #12, #35, #21, #21, #74, #34, #16, #16, #16, #CC, #10, #6F
  db #F0, #00, #00, #00, #00, #00, #00, #00, #00, #51, #4A, #85, #62, #85, #C0, #80
  db #00, #00, #00, #00, #00, #00, #14, #DA, #D2, #F0, #F4, #F0, #E5, #F0, #E5, #F0
  db #F0, #DA, #DA, #CB, #CB, #CB, #F3, #D3, #D1, #D1, #D1, #D1, #C0, #7C, #68, #C0
  db #C0, #81, #92, #80, #80, #80, #94, #BC, #08, #40, #40, #40, #40, #40, #40, #40
  db #00, #00, #00, #00, #00, #08, #08, #08, #08, #08, #08, #48, #48, #C8, #08, #C0
  db #50, #E4, #3C, #03, #21, #30, #12, #56, #74, #A9, #29, #29, #39, #6C, #29, #7A
  db #F0, #00, #00, #00, #00, #00, #00, #00, #00, #05, #E2, #C0, #4A, #4A, #C0, #80
  db #00, #00, #00, #00, #00, #00, #45, #E0, #E1, #F0, #F4, #F8, #DA, #F0, #F0, #F0
  db #E5, #E5, #C7, #C7, #C7, #F1, #E3, #F3, #E2, #E2, #E2, #E2, #C0, #7C, #68, #C0
  db #C0, #D4, #29, #80, #80, #80, #D4, #BC, #40, #40, #40, #40, #40, #40, #40, #80
  db #00, #00, #00, #00, #00, #04, #04, #00, #04, #04, #04, #C4, #84, #84, #04, #40
  db #D4, #2C, #36, #23, #74, #30, #B8, #B8, #FC, #BC, #34, #16, #03, #88, #16, #F0
  db #F0, #28, #00, #00, #00, #00, #00, #00, #00, #40, #4A, #C0, #E2, #85, #C0, #00
  db #00, #00, #00, #00, #00, #00, #6D, #A0, #69, #F0, #F0, #F8, #F0, #DA, #F0, #F0
  db #F0, #F0, #DA, #CB, #DA, #F2, #F3, #E3, #D1, #D1, #D1, #48, #C0, #92, #3D, #40
  db #C0, #D4, #3C, #80, #80, #80, #D4, #BC, #40, #80, #80, #80, #80, #80, #80, #C0
  db #00, #00, #00, #00, #44, #80, #88, #08, #08, #08, #08, #48, #0C, #48, #08, #C0
  db #5E, #28, #39, #09, #38, #56, #74, #FC, #FC, #B8, #03, #29, #36, #9C, #29, #F4
  db #F0, #A0, #00, #00, #00, #00, #00, #00, #00, #00, #4A, #4A, #4A, #4A, #05, #00
  db #00, #00, #00, #00, #00, #00, #DA, #0A, #2D, #D2, #F0, #FC, #E5, #F0, #F0, #F0
  db #DA, #DA, #E5, #E5, #C7, #F1, #D3, #D3, #E3, #E2, #A6, #4A, #4A, #A1, #2D, #C0
  db #C0, #D4, #29, #80, #80, #80, #D4, #34, #C0, #40, #80, #80, #80, #80, #C0, #40
  db #00, #00, #00, #00, #40, #88, #C4, #04, #04, #04, #04, #84, #84, #84, #04, #40
  db #69, #28, #26, #66, #29, #74, #74, #FC, #FC, #FC, #12, #16, #46, #14, #16, #FC
  db #F8, #BC, #00, #00, #00, #00, #00, #44, #08, #00, #85, #C0, #E2, #C0, #4A, #00
  db #00, #00, #00, #00, #00, #40, #E5, #0A, #94, #D2, #F0, #F4, #F8, #F0, #F0, #E5
  db #F0, #E5, #F0, #DA, #CB, #CB, #E3, #F3, #F3, #E3, #4A, #4A, #E2, #BC, #3D, #C0
  db #4A, #D4, #3C, #84, #40, #40, #7C, #3C, #40, #80, #80, #80, #80, #80, #C0, #C0
  db #00, #00, #00, #00, #44, #40, #C8, #C8, #C8, #C8, #08, #48, #0C, #0C, #08, #48
  db #78, #08, #6C, #6C, #29, #12, #FC, #FC, #FC, #A9, #03, #29, #36, #01, #76, #F0
  db #FC, #F8, #00, #00, #00, #44, #80, #14, #6C, #00, #40, #A7, #4A, #C0, #0A, #88
  db #00, #00, #00, #00, #00, #14, #DA, #00, #14, #C1, #F0, #F4, #FC, #DA, #F0, #F0
  db #F0, #F0, #DA, #E5, #E5, #C7, #D3, #E3, #E3, #A6, #5B, #85, #2F, #A9, #2D, #C0
  db #C0, #7C, #3C, #80, #80, #80, #7C, #3C, #C0, #40, #40, #40, #40, #40, #C0, #C0
  db #00, #00, #00, #00, #00, #08, #08, #4C, #C4, #C4, #84, #04, #48, #0C, #48, #C8
  db #78, #44, #6C, #28, #99, #56, #74, #FC, #FC, #A9, #21, #03, #66, #01, #7C, #CF
  db #F4, #F8, #0A, #00, #00, #00, #22, #1C, #8C, #00, #40, #A7, #E2, #C0, #0A, #6C
  db #00, #00, #00, #00, #00, #50, #DA, #00, #40, #2D, #F0, #F0, #F4, #F0, #F0, #F0
  db #F0, #F0, #E5, #F0, #CB, #DA, #F3, #D3, #F3, #D1, #C2, #4A, #1F, #B8, #C2, #C0
  db #4A, #7C, #3C, #C0, #40, #40, #7C, #3C, #C0, #80, #C0, #80, #80, #C0, #C0, #C0
  db #00, #00, #00, #00, #00, #04, #04, #04, #04, #04, #04, #48, #0C, #84, #2C, #84
  db #78, #44, #6C, #6C, #4E, #29, #B8, #FC, #B8, #12, #03, #29, #88, #29, #78, #DA
  db #DE, #ED, #82, #00, #00, #44, #80, #44, #28, #00, #40, #5B, #85, #C0, #28, #9C
  db #00, #28, #00, #00, #00, #5A, #CB, #01, #0A, #0D, #D2, #F0, #F0, #F8, #F0, #F0
  db #F0, #F0, #F0, #DA, #DA, #DA, #E3, #F3, #C2, #F3, #D1, #C0, #E2, #B8, #68, #C0
  db #C0, #7C, #3C, #80, #80, #C0, #7C, #3C, #C0, #C0, #40, #40, #C0, #40, #C0, #C0
  db #00, #00, #00, #00, #04, #04, #04, #04, #40, #C8, #08, #0C, #84, #0C, #0C, #48
  db #69, #00, #9C, #9C, #44, #3C, #56, #74, #FC, #A9, #21, #16, #88, #16, #79, #E5
  db #F0, #F1, #8F, #00, #00, #00, #9C, #14, #00, #00, #00, #1F, #4A, #85, #00, #9C
  db #04, #28, #00, #00, #00, #4F, #A5, #29, #28, #04, #F0, #F0, #F0, #F4, #F0, #F0
  db #F0, #F0, #E5, #E5, #E5, #F0, #F3, #E3, #F3, #D3, #E2, #0E, #1F, #A9, #87, #C0
  db #4A, #7C, #3C, #C0, #80, #C0, #74, #2C, #C0, #80, #C0, #C0, #40, #C0, #80, #C0
  db #00, #00, #00, #00, #08, #04, #04, #04, #04, #04, #04, #84, #48, #1C, #0C, #0E
  db #B4, #00, #19, #19, #44, #14, #12, #FC, #FC, #21, #29, #39, #88, #16, #79, #DA
  db #CF, #F1, #68, #00, #00, #14, #44, #5E, #28, #00, #00, #94, #85, #80, #00, #44
  db #54, #00, #00, #00, #00, #F2, #8F, #03, #6C, #00, #F0, #DA, #F0, #F0, #F0, #F0
  db #F0, #F0, #F0, #DA, #DA, #DA, #E3, #F3, #E3, #F3, #D1, #85, #3E, #BC, #87, #C0
  db #C0, #D6, #3C, #C0, #40, #40, #FC, #2C, #C0, #40, #C0, #40, #80, #80, #80, #C0
  db #00, #00, #00, #44, #00, #08, #08, #08, #08, #08, #48, #0C, #84, #0C, #2C, #48
  db #AD, #00, #9C, #9C, #88, #28, #29, #56, #16, #12, #29, #46, #44, #6C, #F2, #E7
  db #C7, #F2, #0E, #00, #00, #00, #44, #3C, #A8, #00, #00, #C0, #05, #80, #00, #00
  db #BC, #00, #00, #00, #00, #CF, #A0, #12, #03, #2D, #F0, #F0, #F0, #DA, #F8, #F0
  db #F0, #F0, #E5, #F0, #E5, #F0, #E3, #E3, #F3, #F3, #E2, #E2, #4B, #BC, #C2, #C0
  db #C0, #74, #3C, #C0, #40, #40, #FC, #68, #C0, #40, #C0, #80, #80, #C0, #40, #C0
  db #00, #00, #00, #40, #00, #04, #04, #04, #04, #04, #04, #48, #0C, #2C, #1C, #48
  db #E8, #00, #44, #6C, #28, #88, #9C, #29, #29, #29, #36, #6C, #14, #9C, #F3, #E3
  db #E7, #E7, #19, #88, #00, #00, #00, #08, #FC, #00, #00, #40, #05, #C4, #00, #14
  db #BC, #00, #00, #00, #00, #E5, #CE, #21, #12, #3C, #F0, #F0, #F0, #F0, #F0, #F0
  db #F0, #F0, #F0, #E5, #F0, #F0, #F1, #DB, #D3, #D3, #F3, #85, #3E, #BC, #68, #C0
  db #C0, #61, #16, #C0, #40, #94, #BC, #42, #C0, #80, #C0, #40, #40, #40, #C0, #C0
  db #00, #00, #00, #44, #00, #08, #08, #08, #08, #08, #48, #0C, #0C, #1C, #0C, #68
  db #A8, #00, #44, #6C, #6C, #91, #19, #9C, #36, #9C, #29, #CC, #44, #28, #D3, #5B
  db #79, #87, #9C, #08, #88, #00, #88, #2C, #76, #A8, #00, #88, #40, #0A, #00, #54
  db #28, #00, #00, #00, #40, #DB, #1E, #03, #21, #2D, #F0, #FC, #F0, #E5, #F4, #F0
  db #F0, #F0, #F0, #F0, #F0, #F0, #F0, #D3, #E3, #F3, #E2, #E2, #4B, #A9, #68, #C0
  db #C0, #A9, #3C, #C0, #80, #94, #BC, #68, #C0, #40, #80, #80, #80, #80, #C0, #C0
  db #00, #00, #00, #80, #04, #04, #04, #04, #04, #04, #04, #0C, #1C, #0C, #2C, #1C
  db #E4, #00, #04, #9C, #9C, #8C, #26, #66, #6C, #39, #29, #44, #14, #40, #A7, #C2
  db #E2, #C2, #26, #6C, #00, #44, #0A, #9C, #19, #6C, #14, #00, #40, #80, #88, #00
  db #00, #00, #00, #00, #05, #F3, #0B, #21, #21, #50, #F4, #FC, #FC, #F0, #F0, #F0
  db #F0, #F0, #F0, #F0, #F0, #F0, #F4, #F1, #D3, #E3, #F3, #85, #96, #BC, #68, #E2
  db #C0, #BC, #07, #C0, #80, #94, #BC, #68, #C0, #80, #C0, #40, #40, #C0, #C0, #C0
  db #00, #40, #00, #C8, #88, #C4, #C4, #C4, #C4, #C4, #48, #0C, #0C, #2C, #1C, #0C
  db #A0, #00, #00, #4C, #6C, #4E, #19, #19, #08, #6C, #46, #88, #00, #05, #79, #0E
  db #4A, #0A, #19, #08, #44, #04, #88, #04, #14, #00, #00, #00, #80, #80, #22, #00
  db #88, #00, #00, #00, #14, #F3, #0B, #12, #12, #D0, #F4, #FC, #FC, #F0, #F0, #F8
  db #F0, #F0, #F0, #F0, #F0, #F0, #F0, #F1, #F3, #D3, #D1, #C0, #F6, #BC, #3D, #4A
  db #C0, #A9, #8E, #C0, #C0, #94, #A9, #68, #C0, #C0, #40, #40, #80, #C0, #C0, #C0
  db #00, #00, #40, #04, #40, #C8, #C8, #C8, #C8, #C8, #0C, #84, #2C, #1C, #0C, #2C
  db #A0, #88, #44, #14, #9C, #8D, #88, #29, #13, #44, #6C, #00, #00, #05, #87, #2F
  db #C1, #C4, #6C, #08, #14, #00, #6C, #00, #88, #00, #00, #08, #0A, #00, #00, #00
  db #00, #00, #00, #00, #51, #5B, #29, #21, #34, #78, #F4, #FC, #FC, #F8, #F0, #F4
  db #F0, #F0, #F0, #F0, #F0, #F0, #F0, #F1, #F3, #F3, #E2, #4A, #4B, #34, #E2, #E2
  db #85, #A9, #2D, #C0, #C0, #90, #BC, #68, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #40, #44, #80, #44, #C4, #C4, #C4, #C4, #C4, #84, #0C, #1C, #0C, #2C, #1C
  db #82, #00, #00, #88, #28, #4C, #62, #23, #03, #04, #22, #88, #00, #41, #4B, #85
  db #85, #44, #14, #8D, #3C, #44, #14, #14, #00, #00, #19, #40, #00, #44, #00, #44
  db #00, #00, #00, #00, #4B, #A7, #29, #21, #24, #DA, #F4, #FC, #FC, #F8, #F0, #F4
  db #F0, #F0, #F0, #F0, #F0, #F0, #F0, #E1, #F3, #D3, #1F, #85, #3A, #BC, #3D, #4A
  db #94, #BC, #60, #C0, #C0, #D4, #16, #48, #C0, #C0, #C0, #C0, #80, #C0, #C0, #C0
  db #00, #00, #40, #C8, #40, #C8, #C8, #C8, #C8, #C8, #48, #0C, #0C, #2C, #1C, #1C
  db #82, #00, #88, #44, #44, #4E, #C4, #29, #03, #14, #88, #00, #00, #51, #87, #D1
  db #94, #00, #44, #28, #BC, #00, #08, #28, #00, #00, #88, #00, #85, #00, #00, #08
  db #00, #00, #00, #00, #7D, #5B, #23, #74, #02, #F0, #F4, #FC, #FC, #F8, #F0, #FE
  db #F0, #F0, #F0, #F0, #F0, #F0, #F0, #F1, #D3, #A7, #2F, #E2, #4B, #34, #E2, #E2
  db #94, #A9, #68, #C0, #C0, #D4, #8B, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #44, #80, #08, #08, #08, #08, #08, #4C, #84, #0C, #1C, #0C, #2C, #1C
  db #82, #00, #08, #00, #8D, #88, #8D, #9C, #03, #39, #08, #00, #00, #41, #1F, #4A
  db #82, #00, #00, #0D, #B0, #00, #9C, #44, #00, #00, #44, #28, #94, #80, #00, #00
  db #00, #00, #00, #00, #4B, #0F, #18, #12, #3C, #F0, #F4, #FC, #FC, #F8, #FA, #FE
  db #FC, #F8, #F0, #F0, #F0, #F0, #F0, #E1, #F3, #A7, #E2, #F3, #D4, #16, #C2, #D1
  db #C1, #ED, #42, #4A, #C0, #D4, #16, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #80, #08, #04, #04, #04, #04, #04, #04, #0C, #84, #0C, #2C, #2C, #2C
  db #A0, #00, #44, #00, #44, #44, #C4, #6C, #29, #26, #44, #00, #00, #51, #79, #85
  db #80, #00, #00, #14, #F0, #00, #44, #91, #00, #00, #9C, #C8, #0A, #80, #00, #44
  db #00, #00, #00, #00, #87, #E2, #16, #29, #8D, #F0, #F4, #FC, #FC, #F8, #F5, #F4
  db #FC, #FC, #F0, #F0, #F0, #F0, #F0, #F9, #D3, #97, #5B, #F3, #D4, #29, #E2, #E2
  db #B6, #A9, #68, #C0, #80, #7C, #34, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #04, #40, #C8, #C8, #C8, #C8, #C8, #08, #48, #0C, #2C, #1C, #1C, #1C
  db #82, #00, #00, #00, #00, #00, #8D, #9C, #88, #9C, #00, #00, #00, #94, #A7, #2F
  db #80, #00, #00, #14, #F0, #88, #88, #88, #00, #00, #14, #2C, #A7, #80, #00, #00
  db #00, #00, #00, #00, #E3, #4A, #6C, #6C, #50, #F0, #F4, #FC, #FC, #FC, #FA, #FC
  db #F4, #FC, #F8, #F0, #F0, #F8, #F8, #E1, #E3, #A7, #2F, #F3, #D4, #3C, #E2, #E2
  db #B6, #A9, #68, #68, #40, #7C, #3C, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #00, #08, #C4, #C4, #C4, #C4, #C4, #84, #84, #0C, #1C, #0C, #2C, #2C
  db #A0, #00, #00, #00, #00, #44, #44, #4E, #88, #6C, #00, #00, #00, #0F, #A6, #4A
  db #00, #00, #00, #50, #E5, #44, #00, #00, #00, #44, #0E, #62, #F3, #00, #00, #00
  db #00, #00, #00, #40, #79, #0E, #2C, #36, #50, #F0, #F4, #FC, #FC, #F8, #F0, #FC
  db #F4, #FC, #F8, #F0, #F4, #F0, #F4, #E1, #F3, #F3, #1F, #A7, #3A, #29, #E2, #E2
  db #4B, #BC, #42, #80, #C0, #92, #3C, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #04, #04, #40, #C8, #C8, #C8, #C8, #C8, #0C, #84, #2C, #2C, #2C, #2C
  db #82, #00, #00, #00, #00, #00, #88, #00, #44, #6C, #00, #00, #00, #1E, #A7, #85
  db #00, #00, #00, #50, #F0, #00, #08, #00, #00, #2C, #26, #62, #A7, #00, #00, #00
  db #00, #80, #00, #00, #A5, #E6, #6C, #6C, #78, #F0, #F4, #FC, #FC, #F5, #F0, #F8
  db #F0, #FC, #FC, #F0, #F8, #F4, #F4, #F1, #D3, #D3, #2F, #F3, #5E, #69, #1F, #1F
  db #4B, #A9, #2D, #C0, #C0, #FC, #68, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #00, #08, #08, #08, #C4, #C4, #C4, #84, #84, #1C, #0C, #1C, #1C, #1C
  db #82, #00, #00, #00, #00, #00, #44, #00, #00, #6C, #00, #00, #00, #D1, #3D, #4A
  db #00, #00, #00, #78, #E5, #44, #54, #44, #14, #6C, #28, #08, #87, #00, #00, #00
  db #40, #88, #00, #40, #A5, #84, #26, #6C, #78, #F0, #F4, #FC, #FC, #FA, #5E, #FD
  db #FA, #FC, #FC, #F8, #F4, #F4, #E1, #E3, #E3, #F3, #5B, #F3, #7E, #16, #E2, #E2
  db #B2, #BC, #68, #C0, #C0, #B8, #68, #40, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #00, #C4, #C4, #C4, #C4, #04, #04, #04, #08, #48, #0C, #2C, #2C, #2C, #2C
  db #82, #00, #00, #00, #00, #00, #00, #00, #14, #88, #00, #00, #00, #1E, #2F, #80
  db #00, #00, #00, #5A, #B4, #00, #54, #82, #14, #19, #00, #28, #A7, #00, #00, #00
  db #94, #80, #00, #40, #A5, #C4, #14, #8C, #DA, #F0, #FC, #FC, #FD, #A5, #F8, #FD
  db #F5, #F4, #FC, #F8, #F8, #E9, #E3, #F1, #D3, #E3, #7B, #F3, #5E, #3C, #E2, #1F
  db #5E, #34, #68, #4A, #94, #A9, #68, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #08, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #8C, #84, #2C, #1C, #1C, #1C, #1C
  db #82, #00, #00, #00, #00, #00, #00, #00, #14, #88, #00, #00, #00, #5B, #4A, #0A
  db #00, #00, #04, #F5, #B4, #00, #14, #FC, #3C, #28, #00, #08, #87, #00, #00, #00
  db #0D, #00, #00, #40, #E0, #C4, #14, #28, #F0, #F0, #FC, #FC, #F0, #E6, #F0, #EB
  db #FA, #FA, #FC, #FC, #F4, #D3, #F1, #D3, #D3, #D3, #5B, #A7, #F6, #16, #D1, #85
  db #D4, #A9, #68, #C0, #94, #BC, #68, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #00, #04, #04, #04, #04, #04, #04, #04, #04, #84, #48, #1C, #0C, #2C, #2C, #2C
  db #82, #00, #00, #00, #00, #00, #00, #00, #44, #0A, #00, #00, #00, #0E, #E2, #80
  db #00, #00, #00, #F1, #B4, #08, #14, #F4, #BC, #88, #04, #62, #4A, #00, #00, #00
  db #C4, #00, #00, #40, #E0, #44, #14, #08, #F0, #F0, #FC, #FC, #FA, #3C, #FF, #F5
  db #F5, #F0, #F4, #F8, #FC, #E1, #F2, #F2, #E3, #F3, #E3, #F3, #7C, #3C, #E2, #4A
  db #D4, #34, #68, #4A, #C1, #34, #68, #C0, #C0, #80, #C0, #C0, #C0, #C0, #C0, #C0
  db #40, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #0C, #0C, #2C, #1C, #1C, #1C
  db #82, #00, #00, #00, #00, #00, #00, #00, #44, #00, #00, #00, #00, #5B, #0D, #00
  db #00, #00, #00, #F1, #B4, #28, #00, #D6, #F8, #28, #00, #C4, #1F, #00, #00, #00
  db #00, #00, #00, #40, #E0, #00, #6C, #2D, #F0, #F0, #FC, #F8, #B4, #50, #3C, #69
  db #FA, #FA, #F0, #FC, #F8, #D7, #D3, #F1, #D3, #E3, #F3, #D3, #D6, #3C, #C0, #C0
  db #5E, #47, #48, #85, #D4, #BC, #68, #C0, #48, #C0, #C0, #40, #40, #C0, #C0, #C0
  db #04, #04, #04, #04, #04, #04, #04, #04, #04, #C4, #48, #2C, #1C, #0C, #2C, #2C
  db #68, #00, #00, #00, #00, #00, #00, #88, #11, #00, #88, #00, #00, #0E, #4A, #00
  db #00, #00, #14, #AF, #A5, #28, #00, #7C, #E9, #C2, #00, #00, #94, #00, #00, #80
  db #00, #00, #00, #40, #E0, #44, #8D, #8D, #F0, #F0, #F4, #F8, #87, #3C, #6C, #3C
  db #7D, #F5, #F0, #FC, #F4, #D7, #D7, #D3, #E3, #F3, #C2, #F3, #D6, #3C, #C0, #E2
  db #92, #83, #1F, #4A, #D4, #34, #48, #C0, #4A, #C0, #40, #40, #C0, #C0, #C0, #C0
  db #40, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #0C, #1C, #0C, #2C, #2C, #2C
  db #82, #00, #00, #00, #00, #00, #00, #00, #04, #00, #3C, #88, #00, #5B, #C0, #88
  db #00, #00, #0D, #A5, #E3, #22, #00, #58, #E9, #68, #08, #00, #4A, #00, #04, #00
  db #00, #00, #00, #05, #28, #88, #6C, #94, #FA, #FA, #F0, #F8, #28, #3C, #36, #9C
  db #D7, #F5, #FA, #F4, #F8, #F9, #F1, #F1, #D3, #F3, #7B, #F3, #92, #69, #85, #2F
  db #7C, #16, #68, #C0, #D4, #34, #C0, #C0, #68, #80, #80, #C0, #C0, #C0, #C0, #C0
  db #04, #04, #04, #04, #04, #04, #04, #04, #04, #84, #0C, #84, #1C, #1C, #1C, #1C
  db #82, #00, #00, #00, #00, #00, #00, #88, #11, #00, #29, #28, #40, #0E, #0A, #00
  db #00, #00, #14, #A7, #87, #28, #00, #54, #96, #4B, #68, #00, #85, #00, #40, #00
  db #00, #00, #00, #14, #0A, #00, #9C, #50, #F7, #F5, #F0, #F0, #91, #3C, #19, #29
  db #78, #D7, #F5, #F4, #F8, #E9, #EB, #E3, #E3, #E3, #F3, #F3, #D6, #3C, #7B, #C0
  db #D6, #3C, #1F, #4A, #D4, #34, #C0, #C0, #C0, #40, #C0, #C0, #C0, #C0, #C0, #C0
  db #04, #04, #04, #04, #04, #40, #C8, #C8, #C8, #C8, #0C, #48, #2C, #1C, #1C, #1C
  db #C2, #00, #00, #00, #00, #00, #00, #00, #04, #00, #29, #16, #88, #5B, #C4, #08
  db #28, #00, #D0, #5B, #87, #02, #00, #14, #C3, #7C, #96, #80, #C0, #00, #80, #00
  db #00, #00, #00, #41, #0A, #00, #28, #50, #F7, #FA, #FA, #A5, #14, #39, #2C, #26
  db #3C, #D2, #F2, #F0, #FC, #F0, #D7, #D3, #F1, #D3, #E2, #F3, #92, #79, #D1, #D1
  db #7C, #16, #85, #6A, #92, #3C, #85, #C0, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #C4, #C4, #C4, #C4, #C4, #C4, #C4, #C4, #C4, #84, #48, #0C, #0C, #2C, #2C, #2C
  db #2D, #00, #00, #00, #00, #00, #00, #00, #11, #00, #29, #29, #2C, #4A, #C4, #6C
  db #00, #00, #5B, #87, #A7, #6C, #00, #14, #96, #D6, #C3, #80, #80, #00, #00, #00
  db #00, #00, #00, #41, #0A, #00, #04, #55, #F3, #F5, #FF, #A5, #9C, #2C, #23, #19
  db #CC, #78, #D7, #F0, #FC, #F4, #D3, #F1, #F1, #E3, #F3, #F3, #92, #69, #E2, #E2
  db #B0, #3C, #95, #4A, #D6, #3C, #C0, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #04, #04, #04, #04, #04, #04, #04, #04, #04, #48, #0C, #84, #2C, #1C, #1C, #1C
  db #C2, #88, #00, #00, #00, #00, #00, #00, #44, #00, #9C, #89, #2C, #0E, #14, #00
  db #00, #44, #F2, #A5, #B6, #28, #00, #40, #69, #C3, #3C, #80, #00, #14, #08, #00
  db #00, #00, #00, #C5, #0A, #00, #88, #D1, #D3, #FF, #F5, #82, #36, #13, #03, #2C
  db #62, #63, #D2, #FA, #F4, #F8, #E1, #F2, #E3, #F3, #C2, #F3, #92, #79, #D1, #D1
  db #56, #3C, #2F, #D1, #7C, #3C, #C0, #40, #80, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #08, #08, #08, #08, #08, #08, #08, #08, #48, #8C, #84, #48, #1C, #0C, #2C, #2C
  db #2D, #00, #00, #00, #00, #00, #00, #00, #44, #00, #6C, #3C, #9C, #4A, #88, #00
  db #00, #44, #FA, #E0, #A7, #28, #00, #00, #96, #C3, #7C, #B9, #00, #2C, #36, #00
  db #00, #00, #00, #D0, #80, #00, #00, #5B, #5B, #F2, #FB, #28, #3C, #89, #29, #36
  db #9C, #9C, #D2, #FA, #F4, #F8, #E1, #EB, #FB, #D3, #E3, #F3, #92, #69, #2F, #E2
  db #BC, #16, #95, #1F, #B8, #2C, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #C4, #C4, #C4, #84, #04, #04, #04, #04, #04, #84, #48, #0C, #2C, #1C, #1C, #1C
  db #1C, #80, #88, #00, #00, #00, #00, #00, #88, #00, #04, #8C, #2C, #E6, #00, #00
  db #00, #8D, #B6, #4A, #B6, #A2, #88, #00, #68, #96, #FC, #BC, #2C, #36, #C4, #00
  db #00, #00, #00, #85, #80, #00, #00, #2D, #F3, #F3, #F5, #11, #6C, #16, #13, #03
  db #6C, #4C, #78, #FA, #F0, #FC, #F0, #F3, #D3, #E3, #F3, #F3, #92, #79, #1F, #5B
  db #47, #69, #85, #2F, #FC, #0D, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #08, #48, #C8, #C8, #08, #08, #08, #08, #48, #C8, #0C, #84, #1C, #0C, #2C, #2C
  db #69, #00, #44, #00, #00, #00, #00, #00, #88, #00, #44, #6C, #68, #1E, #88, #00
  db #00, #8D, #F3, #4B, #5B, #68, #00, #00, #1C, #C0, #38, #BC, #19, #91, #14, #00
  db #80, #00, #40, #1E, #00, #00, #00, #1F, #4B, #F3, #B6, #14, #36, #16, #03, #12
  db #6C, #62, #63, #F5, #F0, #FC, #F0, #D7, #E3, #F3, #E3, #F3, #92, #79, #2F, #2F
  db #BC, #53, #95, #1F, #30, #68, #C0, #C0, #C0, #C0, #80, #C0, #C0, #C0, #C0, #C0
  db #C4, #C4, #C4, #C4, #84, #04, #04, #04, #84, #84, #84, #0C, #2C, #2C, #1C, #1C
  db #1C, #C4, #00, #00, #88, #00, #00, #00, #88, #00, #00, #9C, #8D, #81, #16, #00
  db #00, #D9, #A7, #87, #4B, #4A, #88, #00, #94, #94, #28, #3C, #2C, #62, #62, #8D
  db #00, #00, #80, #4A, #00, #00, #00, #4A, #A7, #F3, #82, #01, #29, #29, #03, #21
  db #3C, #88, #1C, #D7, #F0, #F4, #F8, #E3, #F3, #D3, #D3, #F3, #52, #53, #1F, #5B
  db #21, #79, #D1, #C1, #34, #69, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #08, #48, #C8, #C8, #C8, #C8, #C8, #C8, #C8, #48, #0C, #84, #1C, #1C, #1C, #1C
  db #49, #00, #88, #88, #00, #00, #00, #00, #88, #44, #00, #44, #68, #23, #29, #8C
  db #00, #79, #F0, #A7, #D1, #79, #44, #00, #40, #68, #A9, #FC, #3C, #91, #91, #40
  db #00, #00, #C0, #4A, #00, #00, #00, #5B, #D1, #5B, #0A, #3C, #16, #03, #03, #21
  db #16, #6C, #14, #78, #FA, #F4, #F8, #F1, #D3, #E3, #F3, #F3, #A9, #79, #2F, #3E
  db #BC, #79, #D1, #6F, #BC, #68, #4A, #C0, #C0, #C0, #80, #C0, #C0, #C0, #C0, #C0
  db #C4, #C4, #C4, #C4, #C4, #C4, #C4, #C4, #84, #84, #48, #1C, #0C, #2C, #2C, #2C
  db #69, #04, #44, #00, #88, #00, #88, #88, #00, #44, #44, #00, #0D, #29, #16, #16
  db #CC, #4B, #FA, #0F, #C1, #4A, #0A, #00, #04, #94, #D4, #28, #00, #00, #00, #40
  db #00, #00, #80, #85, #00, #00, #00, #E2, #4A, #B6, #80, #39, #16, #03, #03, #03
  db #03, #6C, #08, #96, #F5, #F0, #F8, #E1, #E3, #F3, #D3, #F3, #47, #53, #E2, #E3
  db #34, #79, #2F, #3E, #BC, #69, #95, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #C8, #C8, #48, #C8, #C8, #C8, #48, #C8, #48, #0C, #0C, #2C, #1C, #1C, #1C
  db #49, #4E, #C4, #44, #00, #00, #44, #00, #88, #00, #00, #44, #04, #26, #03, #29
  db #3C, #79, #DB, #4A, #85, #B6, #2A, #88, #05, #1C, #C2, #84, #80, #00, #00, #00
  db #00, #40, #40, #C0, #00, #00, #40, #0F, #2F, #F3, #00, #16, #16, #03, #03, #03
  db #03, #16, #88, #69, #5A, #FA, #FC, #F0, #E3, #E3, #F3, #D3, #61, #79, #E3, #E3
  db #34, #3D, #B7, #5E, #24, #3D, #85, #C0, #C0, #C0, #80, #C0, #C0, #C0, #C0, #C0
  db #C4, #C4, #C4, #C4, #84, #04, #C4, #C4, #84, #0C, #84, #94, #1C, #0C, #2C, #2C
  db #69, #94, #00, #88, #08, #00, #88, #00, #88, #04, #44, #00, #88, #19, #29, #03
  db #16, #F2, #A7, #C0, #05, #C2, #4A, #44, #40, #68, #96, #96, #68, #00, #00, #00
  db #00, #40, #C0, #80, #00, #00, #40, #3D, #4A, #C2, #11, #29, #29, #03, #03, #03
  db #03, #03, #62, #8D, #D7, #F0, #F4, #F0, #F3, #D3, #F3, #F3, #21, #D3, #F3, #B6
  db #BC, #79, #2F, #3A, #AC, #79, #95, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #C8, #48, #C8, #08, #48, #48, #C8, #48, #1C, #48, #0C, #2C, #2C, #2C, #2C
  db #2C, #2C, #44, #04, #44, #00, #44, #00, #88, #14, #9C, #8C, #44, #04, #36, #16
  db #16, #A5, #4A, #C0, #40, #5B, #C1, #00, #40, #68, #69, #C3, #00, #00, #00, #00
  db #00, #C0, #80, #80, #00, #00, #40, #4A, #5B, #0A, #01, #36, #16, #03, #03, #03
  db #03, #03, #6C, #04, #5A, #FA, #F4, #F0, #D3, #E3, #E3, #F3, #34, #79, #2F, #3E
  db #BC, #3D, #B7, #7C, #16, #4A, #C0, #C0, #C0, #C0, #80, #C0, #C0, #C0, #C0, #C0
  db #C4, #84, #04, #84, #C4, #00, #08, #48, #C8, #2C, #2C, #1C, #1C, #1C, #1C, #1C
  db #49, #68, #88, #44, #44, #44, #00, #88, #00, #9C, #16, #9C, #44, #11, #19, #16
  db #16, #EB, #4A, #40, #40, #4A, #4B, #0A, #00, #94, #C0, #80, #80, #00, #00, #00
  db #00, #C0, #40, #00, #00, #00, #05, #85, #2F, #80, #14, #29, #23, #03, #03, #03
  db #21, #21, #6C, #44, #69, #F5, #F0, #F8, #F1, #D7, #F3, #F3, #21, #D3, #B7, #5E
  db #3C, #D3, #2F, #92, #3C, #6A, #6A, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #C8, #48, #C8, #88, #00, #84, #04, #C4, #1C, #48, #0C, #2C, #2C, #2C, #2C
  db #86, #82, #28, #C8, #C8, #88, #88, #00, #88, #14, #16, #46, #C4, #04, #26, #23
  db #3C, #F5, #4A, #80, #C0, #0E, #D1, #28, #00, #68, #68, #0D, #08, #00, #00, #00
  db #40, #80, #80, #80, #00, #00, #40, #E2, #4A, #80, #36, #9C, #19, #03, #03, #12
  db #12, #12, #16, #88, #2D, #D7, #F0, #F8, #F1, #E3, #F3, #B7, #BC, #D3, #2F, #3A
  db #3C, #97, #B7, #7C, #3C, #2F, #95, #95, #4A, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #C4, #84, #04, #84, #0A, #00, #40, #48, #C8, #2C, #0C, #2C, #1C, #1C, #1C, #1C
  db #1C, #82, #28, #88, #08, #88, #88, #88, #00, #1C, #16, #9C, #9C, #88, #19, #19
  db #16, #FA, #A7, #40, #00, #85, #85, #C2, #00, #94, #C0, #94, #4A, #00, #00, #00
  db #40, #4A, #40, #00, #00, #00, #05, #85, #2F, #00, #6C, #6C, #6C, #03, #03, #12
  db #12, #12, #16, #88, #9C, #D2, #FA, #F8, #E1, #F3, #F3, #E3, #34, #D3, #D3, #5E
  db #3C, #D3, #2F, #92, #3C, #6A, #6A, #85, #6A, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #C8, #48, #48, #28, #00, #00, #08, #1C, #1C, #1C, #1C, #1C, #1C, #1C, #1C
  db #86, #3C, #08, #04, #44, #C4, #C4, #00, #88, #36, #16, #6C, #6C, #6C, #6C, #2C
  db #72, #F5, #A5, #85, #87, #4A, #4A, #87, #80, #14, #94, #C3, #C2, #00, #00, #00
  db #C0, #C0, #40, #00, #00, #00, #41, #4A, #4A, #00, #6C, #19, #9C, #39, #03, #21
  db #21, #21, #21, #6C, #14, #5A, #FA, #F4, #F5, #D3, #E3, #F3, #34, #D3, #E3, #B2
  db #3C, #B7, #1F, #74, #1C, #2F, #C0, #E2, #4A, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #C4, #84, #84, #C4, #28, #00, #00, #94, #0C, #2C, #2C, #2C, #2C, #2C, #2C, #2C
  db #69, #1C, #14, #44, #C4, #88, #88, #88, #00, #1C, #16, #89, #3C, #8C, #9C, #9C
  db #DD, #F0, #FA, #C0, #4B, #A7, #85, #87, #08, #14, #C3, #F0, #68, #00, #00, #00
  db #C0, #4A, #40, #00, #00, #00, #05, #2F, #2A, #44, #6C, #62, #26, #26, #23, #21
  db #21, #21, #21, #6C, #44, #69, #FA, #F4, #F0, #F3, #F3, #E3, #34, #D3, #D3, #92
  db #1C, #F3, #2F, #A9, #2D, #6A, #95, #D1, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #48, #48, #48, #28, #00, #00, #00, #1C, #1C, #1C, #1C, #1C, #1C, #1C, #1C
  db #1C, #96, #14, #44, #04, #04, #04, #00, #88, #23, #29, #29, #23, #6C, #6C, #6C
  db #50, #F5, #F5, #68, #85, #C0, #4A, #D3, #C0, #40, #69, #F4, #68, #00, #00, #40
  db #85, #C0, #40, #00, #00, #00, #41, #4A, #4A, #11, #8D, #88, #6C, #6C, #29, #21
  db #21, #21, #21, #6C, #28, #94, #F5, #F4, #F8, #F3, #E3, #E3, #BC, #D3, #E3, #B2
  db #1C, #F3, #1F, #21, #79, #D1, #C0, #E2, #2F, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #C4, #84, #84, #94, #08, #80, #00, #80, #0C, #2C, #2C, #2C, #2C, #2C, #2C, #2C
  db #2C, #69, #91, #C4, #C4, #08, #08, #88, #00, #3C, #46, #16, #16, #16, #9C, #9C
  db #41, #FA, #F0, #EA, #85, #C0, #80, #4B, #0A, #00, #69, #E1, #68, #00, #00, #40
  db #C0, #80, #80, #00, #00, #00, #51, #3D, #0A, #44, #44, #4E, #44, #6C, #29, #74
  db #12, #12, #03, #13, #08, #41, #F2, #F4, #F8, #F3, #F3, #D3, #16, #E3, #F3, #7C
  db #1C, #F3, #3E, #BC, #68, #E2, #95, #95, #4A, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #48, #48, #0C, #28, #40, #00, #80, #94, #1C, #1C, #1C, #1C, #1C, #1C, #1C
  db #49, #1C, #48, #22, #C8, #8C, #44, #80, #88, #6C, #16, #16, #03, #29, #46, #6C
  db #C1, #FA, #F0, #EB, #40, #0A, #C0, #79, #48, #00, #3C, #96, #84, #40, #00, #40
  db #4A, #80, #80, #00, #00, #00, #94, #E2, #80, #14, #88, #9C, #8D, #99, #29, #74
  db #74, #74, #03, #39, #08, #14, #D7, #F0, #F8, #F1, #F3, #E3, #16, #D3, #D3, #83
  db #3C, #F3, #4B, #34, #69, #95, #C0, #E2, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #84, #84, #84, #94, #00, #80, #80, #80, #40, #2C, #2C, #2C, #2C, #2C, #2C, #2C
  db #86, #2C, #28, #28, #88, #08, #08, #88, #00, #3C, #16, #13, #16, #03, #29, #9C
  db #41, #E3, #F0, #F5, #4A, #40, #40, #1E, #A2, #80, #14, #94, #80, #00, #00, #C0
  db #4A, #80, #80, #00, #00, #00, #85, #4A, #00, #14, #44, #14, #8C, #14, #23, #74
  db #FC, #21, #21, #16, #99, #40, #7D, #F0, #FC, #F1, #B6, #49, #29, #EB, #E3, #9E
  db #3C, #F3, #6F, #AC, #79, #85, #95, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #48, #48, #08, #40, #40, #40, #40, #40, #2C, #2C, #2C, #2C, #2C, #2C, #2C
  db #69, #49, #68, #62, #88, #8C, #04, #00, #88, #6C, #03, #29, #29, #16, #03, #6C
  db #0F, #D3, #F1, #F0, #A7, #80, #94, #5B, #68, #40, #14, #80, #00, #00, #00, #85
  db #C0, #80, #80, #00, #44, #28, #94, #2F, #00, #44, #00, #9C, #9C, #44, #29, #30
  db #FC, #A9, #03, #3C, #8C, #00, #69, #FA, #FC, #F1, #29, #3C, #3C, #F1, #D3, #96
  db #3C, #F3, #A3, #24, #79, #95, #C0, #D1, #C0, #C0, #C0, #C0, #95, #C0, #C0, #C0
  db #0C, #84, #84, #0A, #04, #80, #C0, #80, #80, #2C, #2C, #2C, #2C, #2C, #2C, #2C
  db #86, #96, #86, #14, #04, #44, #C4, #08, #00, #9C, #29, #16, #03, #29, #16, #9C
  db #C1, #4B, #F2, #F2, #4B, #4A, #4A, #85, #E2, #40, #00, #00, #00, #00, #40, #C0
  db #4A, #40, #00, #00, #9C, #6C, #85, #4A, #00, #88, #00, #9C, #9C, #00, #14, #12
  db #74, #21, #03, #13, #19, #00, #3C, #FA, #F4, #BC, #12, #16, #29, #D3, #F3, #34
  db #59, #D3, #92, #3C, #C2, #E2, #95, #4A, #C0, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #48, #1C, #0D, #00, #80, #C0, #40, #40, #1C, #1C, #1C, #1C, #1C, #1C, #49
  db #1C, #49, #1C, #14, #44, #C4, #04, #00, #88, #19, #29, #29, #16, #03, #29, #6C
  db #79, #87, #D3, #D3, #A5, #C2, #80, #40, #68, #00, #80, #00, #00, #00, #40, #94
  db #C0, #00, #80, #00, #1C, #9C, #94, #80, #00, #22, #00, #14, #9C, #00, #44, #38
  db #B8, #12, #29, #3C, #8C, #00, #94, #FA, #F0, #16, #12, #16, #16, #0E, #4B, #A4
  db #79, #E3, #A3, #3C, #F3, #D1, #C0, #C0, #4A, #4A, #C0, #C0, #C0, #C0, #C0, #C0
  db #84, #84, #0D, #1C, #00, #C0, #40, #80, #80, #1C, #1C, #1C, #1C, #1C, #1C, #1C
  db #2C, #96, #86, #00, #28, #C8, #88, #08, #00, #9C, #9C, #16, #03, #16, #03, #46
  db #B6, #E3, #4B, #4B, #4B, #A7, #80, #40, #4A, #00, #85, #C0, #00, #00, #40, #4A
  db #4A, #00, #80, #00, #9C, #6C, #5B, #80, #00, #28, #00, #44, #6C, #28, #44, #6C
  db #30, #03, #16, #13, #6C, #00, #41, #D2, #B4, #03, #21, #16, #3C, #3C, #79, #24
  db #79, #D3, #92, #2C, #E2, #E2, #C0, #85, #6A, #C0, #4A, #C0, #C0, #C0, #C0, #C0
  db #48, #48, #1C, #40, #40, #40, #C0, #40, #40, #1C, #1C, #1C, #1C, #1C, #49, #49
  db #49, #69, #1C, #80, #28, #88, #08, #88, #88, #14, #6C, #03, #29, #29, #16, #02
  db #D3, #79, #87, #D3, #87, #87, #80, #00, #1E, #00, #C0, #4A, #80, #00, #C0, #68
  db #80, #00, #80, #00, #28, #8D, #0D, #80, #00, #88, #00, #00, #6C, #08, #00, #14
  db #89, #21, #29, #16, #9C, #00, #14, #78, #A1, #12, #03, #3C, #29, #29, #79, #24
  db #79, #D3, #7C, #9C, #F3, #2F, #2F, #6A, #1F, #4A, #C0, #C0, #C0, #C0, #95, #C0
  db #0C, #84, #94, #84, #00, #80, #C0, #80, #80, #0C, #2C, #2C, #2C, #86, #86, #2C
  db #96, #86, #86, #00, #28, #08, #C8, #88, #00, #CC, #3C, #29, #16, #03, #29, #02
  db #D3, #87, #D3, #4B, #4B, #4B, #4A, #00, #85, #00, #40, #85, #80, #00, #C0, #4A
  db #80, #40, #00, #00, #88, #00, #E2, #00, #00, #22, #00, #00, #9C, #88, #88, #CC
  db #3C, #16, #03, #29, #6C, #08, #40, #69, #29, #21, #16, #23, #3C, #16, #3C, #3C
  db #79, #D3, #56, #41, #B7, #E2, #B7, #1F, #85, #6A, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #2C, #1C, #C0, #40, #40, #C0, #80, #80, #1C, #1C, #1C, #1C, #49, #1C, #96
  db #49, #69, #0C, #0A, #14, #44, #C4, #C4, #00, #14, #9C, #23, #29, #16, #16, #07
  db #D2, #E3, #4B, #4B, #B6, #A7, #C2, #80, #40, #80, #40, #C0, #00, #40, #85, #85
  db #80, #80, #80, #00, #00, #00, #C2, #00, #00, #88, #00, #00, #14, #9C, #88, #44
  db #6C, #29, #03, #16, #26, #22, #00, #96, #12, #03, #39, #54, #29, #B8, #3C, #42
  db #79, #D3, #34, #3C, #7B, #2F, #2F, #6A, #1F, #4A, #C0, #C0, #95, #C0, #C0, #C0
  db #1C, #48, #2C, #0E, #00, #C0, #40, #80, #80, #0C, #2C, #2C, #2C, #86, #2C, #2C
  db #96, #96, #2C, #0E, #14, #00, #C8, #88, #00, #44, #6C, #16, #16, #03, #03, #3C
  db #E3, #D3, #87, #87, #87, #D3, #4B, #80, #40, #40, #00, #80, #00, #40, #85, #C0
  db #00, #4A, #88, #44, #00, #00, #4A, #00, #00, #00, #00, #00, #44, #28, #88, #00
  db #9C, #23, #03, #16, #39, #08, #00, #3C, #21, #16, #02, #54, #18, #21, #16, #3C
  db #79, #C3, #16, #79, #97, #E2, #B7, #D1, #85, #C0, #C0, #C0, #4A, #E2, #C0, #C0
  db #48, #0C, #94, #40, #40, #40, #C0, #08, #80, #1C, #1C, #1C, #49, #1C, #49, #49
  db #69, #49, #48, #68, #00, #28, #44, #C4, #00, #44, #3C, #09, #23, #29, #29, #36
  db #D3, #D3, #79, #4B, #4B, #5B, #79, #4A, #40, #80, #00, #80, #00, #C0, #0E, #4A
  db #00, #C0, #00, #04, #00, #00, #80, #00, #00, #00, #00, #00, #00, #44, #00, #00
  db #00, #8C, #29, #29, #2C, #22, #44, #01, #03, #29, #14, #76, #29, #03, #29, #2C
  db #79, #C3, #34, #59, #F3, #2F, #2F, #6A, #E2, #C0, #C0, #D1, #C0, #C0, #C0, #C0
  db #1C, #94, #1C, #80, #80, #80, #84, #80, #80, #1C, #1C, #1C, #1C, #49, #2C, #2C
  db #86, #96, #1C, #94, #80, #19, #00, #C8, #00, #00, #6C, #3C, #16, #16, #03, #58
  db #D2, #E3, #B6, #B6, #A7, #94, #B6, #2F, #40, #0A, #00, #00, #00, #85, #85, #80
  db #00, #C0, #00, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #00, #28, #44
  db #28, #44, #36, #16, #46, #6C, #00, #9C, #03, #02, #36, #56, #09, #03, #29, #3C
  db #4B, #E3, #60, #79, #D3, #6A, #E3, #D1, #C0, #D1, #D1, #C0, #C0, #C0, #C0, #C0
  db #48, #2C, #1E, #40, #40, #40, #14, #80, #80, #0C, #2C, #2C, #2C, #86, #2C, #96
  db #49, #69, #48, #68, #68, #14, #00, #4C, #00, #44, #1C, #26, #23, #29, #29, #D8
  db #F1, #F1, #79, #79, #79, #3D, #79, #68, #80, #68, #00, #00, #00, #C0, #C0, #00
  db #40, #40, #00, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #00, #88, #01
  db #16, #28, #9C, #16, #36, #9C, #00, #01, #29, #22, #7C, #21, #29, #03, #12, #1C
  db #D3, #96, #A8, #79, #F3, #B7, #5B, #6A, #D1, #D1, #C0, #4A, #C0, #C0, #C0, #C0
  db #1C, #0C, #3C, #80, #80, #80, #80, #80, #80, #2C, #2C, #2C, #2C, #2C, #86, #69
  db #2C, #96, #0D, #0D, #48, #00, #28, #00, #88, #00, #9C, #19, #1C, #16, #16, #D8
  db #E1, #E3, #B6, #B6, #B6, #A7, #C1, #4A, #80, #82, #00, #00, #40, #40, #80, #00
  db #80, #80, #88, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #00, #00, #14
  db #03, #66, #19, #29, #39, #6C, #00, #14, #13, #08, #12, #52, #6C, #03, #29, #14
  db #E3, #A3, #20, #D3, #D3, #7B, #6B, #5B, #E2, #E2, #C0, #C0, #C0, #C0, #C0, #C0
  db #48, #2C, #68, #14, #40, #40, #40, #40, #40, #1C, #1C, #1C, #49, #49, #1C, #49
  db #49, #69, #48, #3D, #68, #08, #08, #00, #00, #04, #14, #26, #39, #29, #23, #50
  db #F1, #F1, #D3, #79, #D3, #3D, #2D, #2F, #40, #4A, #00, #00, #40, #C0, #40, #00
  db #C0, #40, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #29, #88, #88, #39, #06, #26, #22, #44, #9C, #44, #21, #34, #6C, #29, #16, #9C
  db #E3, #7C, #2C, #4B, #F3, #B7, #F3, #2F, #2F, #C0, #C0, #85, #C0, #C0, #C0, #C0
  db #1C, #1C, #0D, #08, #80, #80, #80, #80, #80, #0C, #2C, #2C, #2C, #86, #2C, #96
  db #96, #96, #0D, #0D, #3E, #C0, #00, #08, #00, #44, #C4, #39, #1C, #9C, #16, #78
  db #E1, #E1, #E3, #5B, #79, #4B, #85, #4A, #80, #94, #80, #80, #80, #80, #80, #00
  db #40, #80, #22, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #44, #6C, #29, #19, #08, #14, #44, #14, #12, #16, #2C, #01, #16, #9C
  db #5B, #92, #28, #D3, #F3, #6B, #E2, #E2, #1F, #C0, #C0, #C0, #C0, #C0, #C0, #C0
  db #0C, #0E, #14, #0A, #40, #40, #C0, #40, #40, #1C, #1C, #1C, #49, #1C, #49, #2C
  db #69, #49, #1C, #A6, #C2, #68, #00, #00, #00, #04, #C8, #26, #26, #6C, #29, #5A
  db #F0, #F2, #E3, #4B, #4B, #A7, #0E, #E2, #00, #85, #80, #80, #C0, #00, #00, #80
  db #80, #80, #00, #00, #00, #00, #44, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #44, #14, #9C, #9C, #00, #44, #00, #14, #03, #34, #2C, #14, #16, #26
  db #5B, #56, #14, #E3, #E3, #F3, #7B, #D1, #C0, #E2, #85, #C0, #C0, #C0, #C0, #C0
  db #1C, #48, #68, #28, #80, #C0, #80, #80, #80, #0C, #2C, #2C, #2C, #2C, #86, #96
  db #86, #96, #0D, #96, #B6, #94, #80, #04, #00, #44, #91, #19, #19, #1C, #9C, #78
  db #F0, #D2, #B6, #A7, #A7, #87, #C2, #4A, #00, #C0, #68, #4A, #00, #00, #C0, #40
  db #40, #40, #88, #00, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #88, #6C, #6C, #00, #00, #00, #14, #03, #3C, #3C, #44, #16, #14
  db #3D, #34, #14, #F3, #D3, #F3, #2F, #6A, #E2, #2F, #6A, #4A, #C0, #C0, #C0, #C0
  db #0C, #91, #3C, #80, #40, #40, #C0, #40, #40, #1C, #1C, #1C, #49, #49, #1C, #49
  db #69, #49, #0D, #96, #87, #C2, #48, #00, #00, #00, #8C, #26, #26, #26, #26, #78
  db #F0, #F1, #D3, #79, #79, #4B, #0F, #C2, #00, #C0, #40, #80, #40, #C0, #C0, #80
  db #80, #80, #00, #44, #00, #88, #44, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #44, #9C, #6C, #00, #00, #00, #00, #03, #3C, #3C, #08, #07, #9C
  db #2C, #34, #41, #E3, #F3, #F3, #B7, #1F, #D1, #95, #4A, #6A, #4A, #C0, #C0, #C0
  db #0D, #2C, #40, #28, #80, #C0, #C0, #40, #80, #2C, #2C, #2C, #2C, #86, #69, #69
  db #2C, #96, #1C, #C3, #69, #94, #84, #00, #00, #44, #C4, #6C, #6C, #6C, #6C, #78
  db #F0, #D2, #E3, #B6, #B6, #A7, #87, #85, #00, #85, #80, #80, #C0, #80, #80, #C0
  db #40, #80, #00, #00, #08, #08, #00, #88, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #19, #08, #00, #00, #38, #08, #29, #34, #29, #88, #6C, #1E
  db #16, #3C, #D9, #D3, #E3, #7B, #2F, #2F, #6A, #E2, #2F, #C0, #D1, #D1, #C0, #C0
  db #2C, #80, #40, #28, #C0, #40, #C0, #C0, #40, #1C, #1C, #1C, #49, #1C, #1C, #96
  db #96, #86, #68, #C3, #96, #C2, #48, #00, #00, #00, #C8, #9C, #9C, #9C, #9C, #79
  db #F0, #F2, #D3, #D3, #3D, #4B, #5B, #68, #00, #C0, #94, #4A, #85, #C0, #C0, #05
  db #C0, #80, #00, #88, #26, #22, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #44, #04, #00, #00, #00, #12, #28, #89, #3C, #29, #19, #28, #3C
  db #16, #07, #D9, #E3, #F3, #B7, #B7, #1F, #1F, #1F, #1F, #1F, #1F, #4A, #C0, #C0
  db #3C, #00, #80, #40, #C0, #C0, #C0, #40, #C0, #2C, #2C, #2C, #86, #86, #86, #96
  db #49, #69, #1C, #C3, #C3, #68, #68, #44, #00, #00, #08, #6C, #2C, #26, #26, #69
  db #F2, #D7, #D3, #87, #A7, #59, #79, #85, #00, #80, #79, #D3, #C0, #80, #80, #C0
  db #85, #80, #00, #C8, #6C, #08, #88, #88, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #88, #00, #00, #14, #30, #02, #14, #16, #29, #26, #20, #19
  db #16, #02, #4B, #F3, #D3, #E3, #E2, #E2, #F3, #D1, #D1, #D1, #D1, #95, #C0, #C0
  db #68, #22, #40, #40, #68, #40, #C0, #C0, #40, #1C, #1C, #49, #1C, #49, #49, #69
  db #2C, #96, #0D, #C3, #C3, #96, #84, #14, #00, #00, #04, #14, #9C, #46, #6C, #E3
  db #F2, #E3, #E3, #E3, #4B, #85, #B6, #E2, #00, #40, #D3, #79, #68, #C0, #C0, #C0
  db #4A, #80, #44, #6C, #6C, #22, #8C, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #98, #A9, #34, #04, #24, #29, #6C, #A8, #04
  db #3C, #02, #79, #D3, #E3, #F3, #F3, #D1, #2F, #E2, #E2, #E2, #E2, #6A, #C0, #C0
  db #19, #00, #80, #80, #94, #C0, #C0, #40, #C0, #2C, #2C, #86, #2C, #86, #96, #86
  db #96, #96, #49, #C3, #E1, #C3, #80, #4C, #00, #00, #88, #4C, #6C, #3C, #CC, #E3
  db #E3, #F2, #E3, #E3, #A7, #C2, #5B, #85, #80, #40, #F1, #87, #A2, #C0, #C0, #C0
  db #85, #80, #04, #36, #19, #C4, #91, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #1C, #12, #16, #44, #3C, #16, #06, #28, #28
  db #3C, #28, #D3, #E3, #F3, #D3, #F3, #2F, #7B, #2F, #2F, #2F, #95, #4A, #C0, #C0
  db #3C, #80, #80, #80, #C0, #40, #C0, #C0, #C0, #94, #1C, #1C, #49, #49, #49, #49
  db #69, #69, #0D, #C3, #E1, #96, #C0, #9C, #00, #00, #04, #04, #9C, #89, #28, #79
  db #D7, #D3, #D3, #D3, #79, #4B, #85, #48, #00, #14, #B6, #1F, #68, #C0, #C0, #4A
  db #4A, #80, #14, #2C, #26, #88, #6C, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #89, #12, #03, #14, #28, #03, #3C, #28, #88
  db #3C, #C8, #D3, #D3, #D3, #F3, #B7, #B7, #5B, #E2, #E2, #E2, #2F, #D1, #C0, #C0
  db #3C, #00, #80, #80, #80, #C0, #80, #C0, #94, #94, #49, #49, #1C, #86, #96, #86
  db #96, #96, #49, #C3, #E1, #C3, #0E, #14, #88, #00, #00, #08, #6C, #3C, #02, #D3
  db #D3, #D3, #D3, #D3, #87, #87, #85, #85, #80, #41, #A7, #3E, #C0, #80, #C0, #85
  db #C0, #0A, #9C, #39, #19, #19, #4C, #00, #00, #00, #00, #00, #00, #88, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #01, #03, #34, #9C, #28, #29, #36, #28, #6C
  db #1C, #44, #E3, #F3, #E3, #E3, #7B, #F3, #7B, #7B, #D1, #D1, #C0, #E2, #E2, #E2
  db #68, #00, #80, #80, #C0, #40, #C0, #C0, #C0, #0E, #2C, #86, #3D, #69, #49, #49
  db #69, #69, #49, #D2, #D6, #96, #C2, #36, #08, #00, #44, #04, #14, #9C, #6C, #4B
  db #E3, #E3, #E3, #E3, #4B, #E3, #4A, #4A, #00, #C1, #5B, #68, #4A, #C0, #C0, #C0
  db #4A, #80, #6C, #16, #9C, #8C, #26, #00, #00, #00, #00, #88, #88, #00, #00, #00
  db #00, #00, #00, #00, #88, #00, #00, #14, #03, #03, #39, #28, #29, #9C, #28, #9C
  db #14, #14, #E3, #E3, #F3, #D3, #B7, #B7, #F3, #E2, #E2, #E2, #D1, #D1, #D1, #C0
  db #68, #00, #80, #C0, #40, #80, #C0, #C0, #C0, #94, #49, #1C, #1C, #1C, #86, #96
  db #96, #96, #96, #C3, #E1, #C3, #68, #1C, #22, #00, #00, #08, #8C, #26, #22, #87
  db #D3, #D3, #D3, #D3, #D3, #79, #79, #C0, #00, #79, #2D, #C0, #4A, #4A, #C0, #C0
  db #85, #C4, #3C, #46, #6C, #6C, #19, #08, #00, #00, #00, #44, #00, #88, #00, #00
  db #00, #00, #00, #14, #00, #08, #00, #14, #03, #16, #16, #08, #3C, #9C, #28, #00
  db #2C, #14, #F3, #D3, #E3, #F3, #F3, #7B, #D1, #2F, #7B, #C0, #6A, #E2, #1F, #C0
  db #68, #40, #40, #40, #80, #85, #C0, #C0, #C0, #2C, #86, #2C, #86, #86, #96, #49
  db #69, #69, #49, #D2, #70, #96, #C2, #36, #4C, #00, #00, #04, #44, #6C, #19, #D1
  db #79, #D3, #D3, #D3, #D3, #87, #87, #C0, #00, #4A, #C0, #0E, #4A, #4A, #40, #C0
  db #4A, #14, #89, #29, #9C, #9C, #C8, #88, #44, #00, #00, #88, #88, #44, #44, #00
  db #00, #88, #00, #14, #00, #00, #00, #14, #89, #03, #16, #62, #26, #36, #00, #28
  db #19, #41, #E3, #F3, #D3, #F3, #B7, #B7, #B7, #B7, #1F, #95, #4A, #D1, #D1, #85
  db #68, #00, #80, #80, #C0, #84, #C0, #C0, #4A, #94, #1C, #49, #49, #49, #3D, #69
  db #69, #96, #96, #D6, #E9, #E1, #68, #1C, #26, #00, #00, #44, #C4, #6C, #6C, #4B
  db #4B, #E3, #4B, #E3, #B6, #E3, #4B, #C0, #40, #4A, #C0, #68, #4A, #4A, #40, #C0
  db #C0, #14, #3C, #16, #6C, #6C, #6C, #00, #00, #00, #00, #44, #44, #00, #88, #00
  db #00, #00, #00, #28, #40, #00, #44, #28, #29, #16, #16, #88, #19, #01, #04, #88
  db #0A, #59, #D3, #E3, #F3, #D3, #7B, #7B, #7B, #F3, #95, #C0, #2F, #6A, #E2, #E2
  db #68, #40, #40, #80, #C0, #85, #C0, #C0, #C0, #0E, #86, #86, #86, #96, #49, #69
  db #69, #69, #3D, #F4, #E9, #C3, #3C, #01, #19, #00, #00, #00, #C8, #9C, #8D, #85
  db #87, #D3, #D3, #79, #D3, #87, #87, #C0, #05, #85, #C0, #4B, #D1, #94, #80, #C0
  db #C0, #26, #29, #29, #9C, #9C, #8C, #00, #44, #00, #44, #00, #08, #08, #C8, #88
  db #00, #88, #00, #28, #80, #80, #01, #34, #9C, #03, #16, #04, #26, #14, #14, #08
  db #88, #4B, #E3, #F3, #D3, #F3, #B7, #F3, #B7, #B7, #E2, #E2, #E2, #E2, #E2, #C0
  db #68, #00, #C0, #40, #C0, #C0, #68, #C0, #85, #94, #49, #49, #69, #49, #69, #49
  db #69, #96, #96, #D6, #E9, #C3, #79, #14, #6C, #00, #00, #44, #44, #C4, #28, #87
  db #B6, #E3, #E3, #E3, #E3, #E3, #5B, #85, #40, #4A, #4B, #4A, #87, #E2, #80, #C0
  db #C0, #9C, #29, #29, #6C, #6C, #6C, #00, #44, #00, #88, #44, #04, #44, #C4, #44
  db #00, #08, #14, #00, #C0, #28, #01, #21, #14, #29, #29, #44, #08, #9C, #14, #8D
  db #88, #F3, #F1, #D3, #E3, #F3, #6B, #F3, #97, #F3, #D1, #D1, #D1, #D1, #D1, #C0
  db #68, #40, #40, #80, #94, #85, #6A, #C0, #C0, #94, #86, #69, #1C, #86, #86, #96
  db #96, #C3, #69, #D6, #E9, #E1, #3C, #C4, #6C, #88, #00, #00, #44, #C8, #6C, #E3
  db #A7, #87, #D3, #D3, #87, #87, #87, #6A, #C0, #4A, #87, #D3, #4B, #4B, #4A, #40
  db #C0, #26, #29, #29, #2C, #26, #9C, #00, #04, #00, #44, #44, #C4, #08, #C8, #88
  db #44, #00, #39, #40, #0D, #00, #01, #21, #28, #29, #3C, #14, #88, #91, #04, #22
  db #80, #D3, #D3, #E3, #F3, #D3, #F3, #D3, #F3, #B7, #E2, #E2, #E2, #E2, #E2, #E2
  db #68, #40, #80, #C0, #C0, #68, #4A, #C0, #C0, #94, #49, #1C, #86, #96, #96, #96
  db #C3, #69, #96, #D6, #F8, #C3, #79, #08, #6C, #28, #00, #00, #00, #08, #88, #4B
  db #E3, #5B, #79, #D3, #79, #87, #E2, #4A, #C0, #94, #E3, #B6, #A7, #87, #C2, #80
  db #80, #6C, #16, #16, #46, #6C, #6C, #00, #44, #00, #88, #88, #C8, #C8, #88, #4C
  db #C4, #00, #28, #40, #68, #80, #01, #21, #6C, #3C, #9C, #14, #88, #8D, #14, #44
  db #14, #E3, #E3, #F3, #D3, #E3, #F3, #7B, #D3, #F3, #7B, #D1, #D1, #D1, #D1, #C0
  db #68, #40, #40, #4A, #94, #C0, #C0, #85, #C0, #94, #86, #86, #69, #49, #69, #49
  db #69, #96, #96, #D2, #E9, #E1, #3C, #84, #26, #22, #00, #00, #00, #C8, #88, #79
  db #87, #87, #87, #87, #D3, #4B, #4B, #85, #C0, #4B, #E3, #4B, #E3, #4B, #4B, #80
  db #C0, #3C, #16, #16, #46, #6C, #19, #00, #04, #00, #44, #C4, #C4, #C4, #C4, #04
  db #88, #14, #88, #14, #94, #80, #01, #21, #02, #19, #1C, #14, #08, #28, #04, #04
  db #05, #D3, #D3, #D3, #E3, #F3, #F3, #F3, #F3, #F3, #E2, #B7, #E2, #E2, #E2, #E2
  db #00, #80, #C0, #C0, #C0, #68, #4A, #C1, #C0, #2C, #69, #49, #49, #69, #69, #69
  db #96, #C3, #C3, #69, #E9, #96, #87, #48, #26, #28, #00, #00, #00, #44, #80, #4B
  db #E3, #E3, #4B, #4B, #4B, #4B, #4A, #E2, #85, #79, #D3, #87, #87, #87, #87, #C2
  db #40, #39, #03, #29, #6C, #6C, #6C, #00, #44, #44, #04, #C8, #C8, #C8, #C8, #88
  db #08, #39, #00, #4B, #68, #00, #01, #12, #16, #14, #9C, #14, #9C, #88, #14, #44
  db #05, #D3, #E3, #E3, #E3, #E3, #F3, #D3, #E3, #F3, #D1, #2F, #7B, #D1, #D1, #D1
  db #00, #40, #C0, #4A, #C0, #C0, #48, #85, #85, #C1, #49, #2C, #96, #96, #96, #96
  db #C3, #69, #96, #C3, #E1, #C3, #69, #80, #19, #19, #00, #00, #00, #00, #00, #79
  db #D3, #87, #87, #A7, #87, #87, #87, #85, #85, #D3, #D3, #79, #79, #79, #4B, #5B
  db #94, #89, #29, #29, #1C, #9C, #9C, #00, #04, #00, #08, #4C, #C4, #C4, #C4, #C4
  db #00, #28, #40, #69, #68, #88, #14, #03, #16, #04, #26, #14, #6C, #28, #00, #44
  db #41, #EB, #F3, #D3, #D3, #D3, #F3, #E3, #F3, #D3, #B7, #5B, #E2, #E2, #E2, #E2
  db #40, #04, #C0, #48, #94, #C0, #4A, #D1, #C0, #94, #86, #96, #96, #96, #96, #C3
  db #69, #C3, #C3, #69, #E9, #96, #87, #48, #04, #6C, #00, #00, #00, #00, #00, #4B
  db #E3, #E3, #4B, #1F, #4B, #5B, #1F, #4A, #1F, #79, #87, #D3, #87, #87, #87, #C2
  db #0E, #3C, #16, #16, #9C, #8C, #26, #00, #44, #44, #04, #62, #C8, #C8, #C8, #C8
  db #14, #88, #14, #96, #94, #80, #14, #03, #03, #11, #19, #01, #4C, #80, #88, #04
  db #55, #D3, #D3, #E3, #F3, #F3, #D3, #D3, #E3, #F3, #2F, #D3, #F3, #D1, #D1, #D1
  db #00, #94, #C0, #80, #C0, #C0, #C0, #4A, #68, #94, #49, #49, #69, #69, #69, #69
  db #C3, #C3, #C3, #69, #D2, #C3, #2D, #C0, #44, #16, #00, #00, #00, #00, #00, #C1
  db #E3, #E3, #B6, #E2, #68, #E2, #4A, #4A, #94, #E3, #E3, #B6, #E3, #4B, #4B, #4B
  db #94, #09, #29, #6C, #6C, #6C, #6C, #00, #44, #04, #44, #C4, #C4, #C4, #C4, #C4
  db #36, #00, #C1, #C3, #0E, #0A, #44, #29, #16, #88, #6C, #01, #22, #88, #00, #00
  db #D0, #E3, #E3, #F3, #D3, #D3, #E3, #F3, #D3, #F3, #B7, #F3, #F3, #E2, #E2, #E2
  db #00, #80, #48, #40, #C0, #85, #C0, #85, #6A, #4A, #86, #96, #96, #96, #96, #96
  db #C3, #C3, #C3, #69, #C3, #96, #87, #48, #80, #16, #88, #00, #00, #00, #00, #41
  db #E3, #E3, #E3, #B6, #85, #85, #2F, #85, #D1, #79, #D3, #79, #D3, #D3, #87, #87
  db #94, #1C, #16, #06, #26, #26, #9C, #00, #44, #C4, #C4, #28, #C8, #C8, #9C, #04
  db #28, #40, #D2, #96, #68, #80, #00, #03, #03, #00, #28, #9C, #88, #80, #00, #00
  db #79, #F1, #D3, #D3, #E3, #E3, #F3, #D3, #E3, #F3, #D3, #F3, #F3, #D1, #87, #2F
  db #80, #40, #04, #C0, #40, #C0, #C0, #C0, #3D, #85, #49, #69, #69, #69, #69, #69
  db #C3, #C3, #96, #96, #D2, #C3, #68, #C0, #28, #16, #02, #00, #00, #00, #00, #51
  db #D3, #D3, #D3, #79, #C2, #4A, #4A, #4A, #85, #D3, #D3, #D3, #D3, #79, #79, #79
  db #94, #09, #29, #6C, #6C, #6C, #6C, #00, #44, #04, #C8, #8C, #44, #C4, #08, #94
  db #00, #41, #E1, #B4, #94, #80, #44, #29, #29, #6C, #28, #01, #04, #00, #00, #3C
  db #4B, #E3, #E3, #F3, #D3, #D3, #E3, #F3, #D3, #D3, #D3, #D3, #E2, #E2, #F3, #1F
  db #C0, #80, #80, #C0, #C0, #C0, #85, #85, #C0, #4A, #C1, #49, #69, #96, #96, #C3
  db #69, #C3, #C3, #68, #C3, #96, #A6, #4A, #0A, #16, #16, #00, #00, #00, #00, #05
  db #B6, #B6, #B6, #E3, #E3, #4A, #85, #C0, #85, #4B, #E3, #4B, #4B, #B6, #B6, #A7
  db #94, #9C, #06, #26, #26, #26, #9C, #00, #00, #08, #9C, #04, #C8, #C8, #C8, #22
  db #00, #7C, #E9, #C3, #68, #00, #04, #01, #29, #16, #08, #14, #00, #88, #00, #3C
  db #7D, #D3, #D3, #E3, #F3, #E3, #F3, #D3, #E3, #E3, #F3, #A7, #F3, #F3, #A7, #2F
  db #C0, #0D, #48, #C0, #C0, #C0, #C0, #4A, #85, #85, #C1, #69, #69, #69, #69, #96
  db #C3, #C3, #C3, #96, #C3, #69, #68, #48, #4A, #89, #29, #88, #00, #00, #00, #40
  db #79, #79, #79, #79, #79, #68, #4A, #80, #C0, #79, #79, #87, #D3, #79, #D3, #79
  db #94, #1C, #39, #1C, #19, #19, #08, #88, #44, #04, #44, #28, #4C, #C4, #3C, #22
  db #40, #FC, #E1, #96, #0E, #00, #00, #01, #3C, #16, #28, #88, #44, #00, #00, #08
  db #D7, #D3, #D3, #D3, #E3, #F3, #D3, #D3, #D3, #D3, #D3, #D3, #D3, #F3, #1F, #1F
  db #40, #C0, #C0, #40, #C0, #C0, #C0, #C0, #C2, #C0, #0E, #86, #96, #96, #C3, #69
  db #C3, #C3, #C3, #3C, #C1, #87, #C2, #68, #94, #01, #29, #C8, #00, #00, #00, #40
  db #4B, #4B, #5B, #87, #B6, #B6, #C0, #C0, #05, #C1, #4B, #4B, #B6, #E3, #4B, #4A
  db #0E, #36, #1C, #26, #26, #26, #44, #00, #00, #88, #08, #4C, #C4, #14, #28, #00
  db #94, #FC, #C3, #96, #C0, #00, #00, #14, #9C, #16, #28, #44, #40, #00, #00, #28
  db #F1, #D3, #E3, #F3, #D3, #D3, #E3, #E3, #E3, #E3, #EB, #EB, #FB, #A7, #2F, #3E
  db #40, #84, #94, #C0, #C0, #68, #C0, #4A, #4A, #4A, #49, #69, #69, #69, #69, #C3
  db #C3, #C3, #C3, #96, #C1, #0E, #94, #C0, #85, #14, #16, #6C, #00, #00, #00, #00
  db #C2, #A7, #87, #E2, #1F, #5B, #48, #40, #40, #4A, #B6, #A7, #D3, #79, #87, #87
  db #94, #19, #6C, #6C, #6C, #C4, #44, #00, #00, #08, #8C, #62, #88, #BC, #00, #00
  db #69, #F4, #C3, #2D, #48, #00, #00, #14, #9C, #6C, #28, #88, #44, #00, #44, #28
  db #F1, #F1, #D3, #D3, #E3, #E3, #F3, #D3, #F1, #F1, #D7, #D3, #F3, #F3, #4B, #E3
  db #80, #C0, #C0, #C0, #C0, #94, #2F, #C0, #D1, #85, #3E, #96, #96, #96, #C3, #69
  db #C3, #C3, #96, #86, #0E, #C2, #68, #68, #C1, #44, #29, #6C, #00, #00, #00, #00
  db #85, #C2, #B6, #B6, #B6, #94, #E2, #00, #C0, #C0, #79, #79, #4B, #B6, #B6, #D1
  db #94, #26, #2C, #26, #C8, #88, #88, #88, #00, #C8, #88, #08, #3C, #00, #00, #04
  db #D2, #E9, #C3, #2D, #80, #00, #00, #04, #26, #22, #08, #00, #40, #00, #14, #0D
  db #D3, #D3, #E3, #E3, #F3, #D3, #E3, #E3, #F2, #E3, #EB, #F7, #F2, #E1, #E1, #C3
  db #C0, #84, #94, #C0, #C0, #C0, #4A, #85, #6A, #4A, #69, #69, #69, #69, #96, #C3
  db #C3, #C3, #C3, #68, #C0, #68, #94, #C0, #05, #80, #9C, #02, #00, #44, #00, #00
  db #C0, #4B, #D1, #59, #85, #C0, #94, #80, #00, #4A, #C1, #5B, #79, #79, #79, #0E
  db #1E, #9C, #9C, #9C, #88, #88, #88, #00, #00, #08, #88, #3C, #28, #00, #00, #94
  db #B0, #B4, #C3, #79, #08, #00, #44, #28, #88, #28, #88, #00, #88, #00, #14, #14
  db #E3, #E3, #F3, #D3, #D3, #E3, #EB, #EB, #EB, #FA, #F5, #F0, #F0, #F0, #F0, #E1
  db #80, #C0, #C0, #80, #48, #C0, #85, #C0, #1F, #D1, #49, #49, #96, #96, #C3, #C3
  db #C3, #C3, #C3, #96, #94, #94, #84, #0A, #94, #A2, #01, #6C, #00, #14, #00, #00
  db #C0, #85, #4A, #4A, #1F, #4A, #C0, #4A, #00, #C0, #85, #C1, #4A, #B6, #E2, #C2
  db #94, #9C, #9C, #CC, #C4, #44, #44, #00, #00, #8C, #36, #08, #00, #00, #40, #69
  db #F0, #D2, #96, #C2, #00, #80, #14, #39, #44, #08, #22, #00, #00, #00, #14, #41
  db #EB, #E3, #E3, #F3, #E3, #F3, #D7, #D7, #D2, #F0, #F0, #F0, #F0, #F0, #F0, #F4
  db #C0, #40, #94, #C0, #85, #48, #4A, #D1, #85, #2F, #2F, #96, #C3, #69, #96, #C3
  db #C3, #C3, #96, #E9, #68, #68, #40, #00, #40, #C2, #14, #16, #00, #44, #00, #00
  db #40, #C0, #85, #85, #85, #85, #C0, #C0, #00, #85, #40, #2D, #2F, #2F, #87, #D1
  db #91, #19, #19, #C4, #44, #44, #00, #00, #00, #91, #08, #00, #00, #00, #04, #4B
  db #D2, #61, #69, #0E, #40, #00, #CD, #29, #00, #00, #00, #88, #3C, #00, #14, #50
  db #E3, #E3, #F3, #D3, #D3, #D3, #EB, #FA, #F0, #F0, #F0, #F0, #F0, #E1, #D2, #F8
  db #80, #C0, #85, #80, #C0, #E2, #85, #C0, #E2, #1F, #1F, #69, #69, #96, #C3, #C3
  db #C3, #C3, #70, #96, #94, #94, #C0, #00, #40, #87, #44, #29, #00, #04, #00, #00
  db #00, #C0, #C0, #4A, #4A, #4A, #C0, #C0, #80, #40, #C0, #85, #C1, #D1, #C1, #4A
  db #0E, #26, #62, #88, #88, #88, #88, #00, #00, #00, #00, #00, #00, #00, #85, #69
  db #C3, #B4, #C3, #68, #00, #00, #45, #29, #44, #00, #88, #80, #CD, #28, #44, #4B
  db #EB, #E3, #E3, #E3, #E3, #F2, #F7, #F0, #F0, #F0, #F4, #E1, #E1, #E9, #D6, #87
  db #C0, #40, #84, #C0, #4A, #E2, #E2, #D1, #85, #2F, #85, #3E, #96, #C3, #69, #C3
  db #C3, #C3, #E9, #C3, #96, #68, #80, #00, #40, #5B, #00, #16, #88, #44, #08, #00
  db #00, #40, #C0, #85, #C0, #C0, #C0, #80, #C0, #40, #4A, #84, #4A, #4A, #E2, #C2
  db #19, #19, #C4, #44, #44, #00, #00, #00, #00, #00, #00, #00, #00, #00, #94, #C1
  db #D2, #C3, #69, #80, #80, #00, #45, #3C, #3C, #88, #80, #88, #4E, #00, #88, #7D
  db #D3, #F1, #D3, #D3, #D7, #D3, #F0, #F0, #F0, #F0, #C3, #F4, #FC, #FC, #F8, #5B
  db #C0, #40, #85, #C0, #85, #2F, #95, #1F, #3D, #4A, #E2, #4B, #69, #69, #C3, #C3
  db #C3, #D6, #78, #E9, #96, #C2, #80, #00, #40, #79, #80, #9C, #6C, #00, #22, #14
  db #80, #80, #00, #C0, #C0, #C0, #40, #40, #40, #40, #79, #85, #85, #59, #85, #85
  db #C4, #28, #88, #00, #88, #00, #00, #00, #00, #00, #00, #00, #00, #40, #68, #69
  db #69, #69, #68, #68, #40, #00, #45, #3C, #6C, #28, #00, #00, #62, #22, #00, #E1
  db #F2, #E3, #EB, #E3, #EB, #F2, #F0, #F0, #F0, #C3, #F0, #FC, #FC, #FC, #E9, #C1
  db #C0, #40, #68, #C0, #4A, #E2, #4A, #A7, #6B, #D1, #D1, #49, #96, #C3, #69, #C3
  db #C3, #D6, #B0, #E1, #69, #C2, #80, #00, #00, #4B, #80, #14, #88, #00, #08, #51
  db #68, #40, #00, #00, #00, #00, #00, #80, #80, #80, #4B, #0E, #4A, #4A, #4A, #4A
  db #28, #8C, #44, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #68, #68
  db #96, #96, #B6, #C0, #00, #00, #45, #6C, #3C, #88, #00, #00, #28, #00, #14, #EB
  db #EB, #F2, #F2, #F7, #D3, #F0, #F0, #F0, #B0, #E1, #F4, #FC, #FC, #FC, #C2, #5E
  db #C0, #40, #C1, #C0, #D1, #D1, #D1, #D1, #C2, #F3, #C1, #D1, #69, #96, #C3, #C3
  db #C3, #7C, #E1, #96, #C2, #87, #C0, #00, #00, #D1, #0E, #44, #28, #00, #88, #41
  db #5B, #28, #40, #C0, #00, #00, #94, #A6, #80, #C0, #85, #D3, #0E, #4A, #4A, #4A
  db #19, #C4, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #08, #00, #94
  db #0E, #69, #3D, #68, #80, #00, #45, #08, #6C, #00, #3C, #00, #28, #00, #50, #D7
  db #D7, #D7, #D7, #D7, #F2, #F0, #F0, #F4, #D2, #D2, #FC, #FC, #FC, #FC, #68, #C3
  db #80, #80, #68, #C0, #1F, #3D, #4A, #E2, #F3, #7B, #C2, #A6, #C3, #69, #96, #C3
  db #C3, #E9, #E9, #C3, #2D, #C2, #40, #84, #00, #94, #6A, #44, #88, #00, #44, #41
  db #87, #A7, #08, #00, #00, #41, #5B, #59, #80, #40, #85, #D3, #87, #85, #85, #85
  db #08, #88, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #C0, #40, #85
  db #96, #B6, #B6, #C0, #C0, #88, #14, #6C, #28, #44, #6D, #00, #28, #00, #D0, #E3
  db #EB, #EB, #EB, #EB, #FA, #F0, #F0, #E9, #E1, #FC, #FC, #74, #70, #E9, #85, #C3
  db #C0, #80, #84, #C0, #C1, #D1, #D1, #C1, #7B, #F3, #F3, #59, #96, #C3, #69, #C3
  db #C3, #FC, #D2, #96, #96, #C2, #80, #48, #00, #40, #4A, #00, #44, #00, #00, #50
  db #D3, #79, #4B, #0E, #85, #87, #3E, #A7, #C2, #40, #C0, #1E, #E3, #4A, #4A, #4A
  db #28, #44, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #80, #C0, #94
  db #C3, #69, #C3, #68, #68, #00, #14, #46, #00, #00, #28, #00, #28, #00, #79, #F1
  db #F1, #F1, #F1, #F5, #F0, #F0, #F4, #D2, #D6, #FC, #C3, #92, #92, #BC, #84, #C3
  db #80, #C0, #4A, #C0, #C0, #E2, #E2, #E2, #D3, #7B, #D3, #E2, #C3, #96, #C3, #C3
  db #C3, #E9, #E1, #69, #4B, #68, #C1, #80, #40, #40, #85, #80, #00, #00, #00, #50
  db #D2, #B6, #A7, #87, #87, #B6, #E3, #4B, #4A, #80, #C0, #68, #A7, #87, #85, #85
  db #08, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #04, #14, #C0, #69
  db #D2, #E9, #68, #68, #C0, #80, #14, #2C, #88, #44, #4E, #00, #08, #44, #F2, #F2
  db #F2, #F2, #F2, #F2, #F0, #F0, #E9, #E1, #FC, #E9, #92, #C3, #70, #60, #41, #0C
  db #C0, #80, #2F, #C0, #94, #D1, #85, #2F, #7B, #F3, #E3, #E2, #C3, #C3, #C3, #C3
  db #C3, #F8, #D2, #96, #96, #C2, #C1, #00, #80, #40, #C0, #80, #00, #00, #00, #50
  db #D3, #D3, #79, #87, #B6, #F3, #79, #87, #B6, #80, #40, #85, #0D, #D1, #79, #85
  db #08, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #41, #2D, #C3
  db #FC, #96, #96, #0E, #0E, #80, #45, #46, #00, #00, #88, #44, #00, #14, #E1, #F1
  db #F1, #F1, #F1, #F0, #F0, #F4, #D2, #D6, #FC, #92, #C3, #61, #D6, #28, #94, #48
  db #84, #C0, #1F, #68, #C0, #E2, #D1, #E3, #1F, #F3, #D3, #E2, #E2, #C3, #C3, #C3
  db #D6, #F8, #C3, #69, #4B, #C0, #69, #40, #C0, #00, #40, #C0, #00, #00, #00, #50
  db #D2, #B6, #B6, #B6, #E3, #4B, #F1, #79, #79, #C0, #00, #C0, #4A, #4A, #4A, #4A
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #3C, #C3, #D6
; ======================================================================
; END INCLUDE: data/ImageData_linear_chunk_0.asm
; ======================================================================
; include 'data/ImageData_linear_chunk_1.asm' [EXPANDED]
; ======================================================================
; BEGIN INCLUDE: data/ImageData_linear_chunk_1.asm
; ======================================================================
; Linear Data created with Pixsaur - CPC Classic
; Mode 0 Overscan 
; 192x280 pixels, 96x280 bytes.

; Chunk 2/2 - Offset: 16384 - Size: 10496 bytes
ImageData_linear_chunk_1:
  db #E1, #E1, #69, #87, #48, #00, #14, #13, #00, #04, #00, #14, #00, #14, #F2, #E1
  db #EB, #EB, #FA, #F0, #F0, #FC, #D2, #FC, #E9, #61, #61, #C3, #D6, #80, #48, #80
  db #C0, #80, #85, #2F, #3E, #C0, #E2, #97, #F3, #F3, #E3, #A7, #7B, #4B, #C3, #C3
  db #FC, #BC, #E1, #69, #C1, #4A, #68, #C0, #80, #40, #88, #C0, #80, #00, #00, #50
  db #D3, #D3, #79, #D3, #79, #D7, #87, #D3, #87, #87, #80, #40, #85, #85, #85, #85
  db #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #00, #87, #C3, #B0
  db #E1, #D2, #96, #C2, #C0, #00, #01, #6C, #00, #11, #00, #00, #00, #8D, #E1, #F5
  db #D7, #D7, #D2, #F0, #F0, #E9, #F4, #FC, #61, #92, #C3, #61, #61, #00, #80, #40
  db #84, #C0, #4A, #1F, #1F, #3D, #C1, #D1, #B7, #B7, #F3, #97, #1F, #E2, #E3, #C3
  db #7C, #16, #69, #69, #94, #C0, #C2, #C0, #C0, #00, #28, #40, #80, #00, #00, #50
  db #D2, #E3, #B6, #B6, #B6, #E3, #4B, #B6, #B6, #2F, #28, #40, #40, #4A, #85, #C0
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #40, #69, #D2, #70
  db #F8, #70, #C3, #3C, #94, #C5, #CD, #91, #00, #00, #00, #00, #00, #27, #F0, #F1
  db #F1, #F1, #F0, #F0, #F4, #D2, #F4, #FC, #92, #C3, #C3, #96, #AC, #40, #40, #00
  db #C0, #80, #3E, #2F, #2F, #3E, #6A, #E2, #F3, #7B, #E3, #A7, #2F, #6B, #4B, #96
  db #ED, #16, #16, #A6, #94, #C0, #68, #68, #68, #80, #04, #11, #08, #00, #00, #50
  db #D3, #D3, #79, #D3, #79, #87, #D3, #79, #79, #4B, #4A, #00, #C0, #C0, #C0, #4A
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #85, #04, #4B, #C3, #F4
  db #B8, #E1, #B4, #C2, #C2, #7C, #29, #04, #00, #00, #00, #00, #00, #DD, #F0, #F1
  db #F1, #F5, #F0, #F0, #FC, #D2, #FC, #E9, #61, #C3, #C3, #48, #60, #00, #80, #80
  db #C0, #C0, #4A, #D1, #D1, #D1, #59, #D1, #D1, #F3, #7B, #97, #79, #1F, #4B, #C3
  db #ED, #16, #9C, #68, #94, #C0, #69, #96, #C0, #80, #11, #44, #28, #00, #00, #41
  db #E1, #E3, #B6, #B6, #B6, #E3, #4B, #4B, #5B, #79, #4B, #80, #40, #40, #C0, #80
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #C0, #14, #49, #E1, #FC
  db #F8, #70, #C3, #96, #94, #ED, #29, #14, #88, #00, #00, #00, #00, #50, #F0, #F2
  db #F2, #F2, #F0, #F0, #E9, #F4, #FC, #92, #C3, #C3, #86, #94, #82, #04, #40, #40
  db #84, #80, #C1, #D1, #D1, #D1, #C1, #B7, #E2, #E2, #E3, #F3, #A6, #A7, #6B, #83
  db #ED, #29, #6C, #68, #C0, #94, #6B, #69, #68, #80, #40, #00, #9C, #00, #00, #05
  db #D3, #79, #79, #79, #3D, #5B, #79, #D1, #0D, #B6, #B6, #A2, #80, #C0, #C0, #88
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #4A, #14, #E3, #D2, #74
  db #FC, #C3, #E1, #69, #94, #A9, #6D, #00, #00, #00, #00, #00, #00, #41, #F0, #F1
  db #F1, #F0, #FA, #F4, #F9, #F4, #FC, #C3, #61, #C3, #48, #41, #28, #C0, #80, #80
  db #C0, #68, #C0, #E2, #E2, #E2, #97, #F3, #97, #1F, #D3, #E3, #F3, #3D, #4B, #C7
  db #A9, #29, #3C, #66, #84, #C0, #C3, #96, #A6, #C0, #00, #00, #28, #00, #00, #14
  db #B6, #B6, #B6, #E2, #1E, #A6, #E2, #87, #E2, #87, #87, #87, #80, #80, #80, #80
  db #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #85, #04, #C3, #D2, #FC
  db #F8, #FC, #96, #96, #D4, #16, #16, #6C, #00, #08, #00, #00, #88, #05, #F0, #F2
  db #F2, #F5, #F0, #FC, #D2, #FC, #E9, #61, #C3, #86, #80, #49, #00, #08, #48, #40
  db #40, #40, #68, #1F, #3D, #3D, #4B, #E3, #E3, #F3, #6B, #F3, #D3, #3E, #E3, #7C
  db #9E, #46, #6C, #14, #40, #69, #C3, #C3, #68, #C0, #00, #00, #C8, #00, #00, #05
  db #D3, #79, #2D, #94, #C0, #4A, #85, #84, #0E, #5B, #4B, #4B, #4A, #40, #40, #04
  db #00, #88, #00, #00, #00, #00, #00, #88, #00, #00, #40, #C0, #14, #C3, #D2, #74
  db #FC, #C3, #C3, #3D, #6D, #6D, #16, #26, #00, #14, #88, #8D, #00, #C9, #F0, #F1
  db #F5, #F0, #F0, #FC, #F2, #FC, #E9, #C3, #C3, #48, #C0, #3C, #80, #84, #40, #08
  db #80, #80, #85, #85, #6A, #E2, #97, #F3, #7B, #D3, #D3, #E3, #F3, #D3, #C1, #D6
  db #9E, #29, #9C, #00, #2C, #4B, #C3, #E1, #68, #80, #00, #80, #44, #00, #00, #40
  db #87, #87, #85, #C0, #C0, #40, #40, #C0, #00, #94, #A7, #87, #87, #80, #80, #91
  db #14, #44, #00, #00, #00, #00, #44, #00, #00, #00, #05, #C0, #94, #C3, #D2, #D6
  db #F8, #D2, #3C, #C2, #ED, #9C, #9C, #88, #00, #44, #6C, #00, #00, #D9, #F0, #F0
  db #FA, #F0, #F4, #E9, #F0, #FC, #61, #61, #86, #C0, #40, #86, #40, #48, #48, #40
  db #80, #80, #C0, #C0, #4A, #D1, #C1, #E3, #F3, #E3, #7B, #D3, #E3, #E3, #A7, #D6
  db #16, #46, #6C, #00, #88, #C3, #C3, #C3, #68, #C0, #00, #80, #00, #88, #00, #00
  db #4B, #C0, #4A, #C0, #00, #80, #80, #80, #00, #85, #59, #4B, #4B, #4A, #4A, #14
  db #01, #08, #19, #00, #00, #00, #88, #00, #00, #00, #C0, #0A, #0D, #C3, #E1, #FC
  db #E9, #E1, #C3, #C5, #EC, #6C, #2C, #22, #00, #8D, #C8, #00, #00, #69, #F0, #F0
  db #F0, #F0, #F4, #E9, #F4, #FC, #92, #C3, #0C, #80, #48, #82, #04, #84, #84, #80
  db #C0, #40, #68, #C0, #C0, #1F, #5B, #97, #E3, #F3, #D3, #E3, #F3, #D7, #5B, #74
  db #16, #3C, #88, #00, #00, #C1, #C3, #96, #E2, #80, #00, #40, #00, #00, #00, #00
  db #C0, #4A, #48, #40, #00, #00, #40, #00, #00, #40, #4B, #5B, #79, #0E, #C0, #91
  db #9C, #16, #88, #08, #00, #44, #44, #00, #00, #00, #85, #00, #0D, #C3, #D2, #74
  db #F0, #C3, #96, #7C, #16, #8C, #14, #88, #00, #00, #88, #00, #00, #79, #F0, #F0
  db #F4, #F0, #FC, #D2, #D6, #FC, #C3, #C3, #48, #C0, #94, #28, #C0, #48, #48, #40
  db #C0, #80, #A6, #C0, #C1, #C0, #6B, #E2, #F3, #D3, #E3, #F3, #D3, #D3, #F3, #DE
  db #29, #6C, #28, #00, #00, #14, #C3, #96, #C2, #40, #00, #40, #80, #00, #00, #00
  db #C0, #C0, #40, #00, #00, #00, #00, #00, #00, #80, #D1, #79, #4B, #5B, #C0, #14
  db #9C, #29, #9C, #44, #00, #C8, #88, #00, #00, #40, #4A, #00, #0D, #C3, #C3, #F8
  db #E9, #69, #69, #ED, #3C, #88, #14, #08, #00, #00, #00, #00, #11, #78, #F0, #F0
  db #F0, #F4, #FC, #D2, #F4, #C3, #92, #86, #C0, #48, #49, #08, #84, #84, #C0, #80
  db #84, #84, #85, #2F, #48, #E2, #E2, #97, #E3, #F3, #7B, #D3, #E3, #F2, #B6, #ED
  db #3C, #9C, #88, #00, #00, #00, #C3, #C3, #C0, #40, #00, #00, #C0, #00, #00, #00
  db #80, #80, #00, #C0, #80, #80, #00, #00, #00, #40, #94, #A7, #87, #A6, #4A, #91
  db #1C, #16, #CC, #C4, #00, #6C, #00, #00, #00, #40, #80, #00, #3D, #69, #D2, #D2
  db #69, #96, #C7, #A9, #6C, #80, #9C, #88, #00, #00, #00, #00, #14, #F2, #F0, #F0
  db #F8, #FC, #E9, #E1, #D2, #C3, #C3, #C2, #40, #40, #94, #40, #48, #48, #48, #40
  db #94, #C0, #3D, #3D, #1F, #68, #D1, #2F, #7B, #D3, #E3, #F3, #D3, #D3, #E3, #A9
  db #29, #6C, #00, #00, #00, #44, #1E, #B6, #C0, #40, #00, #00, #C0, #00, #00, #00
  db #40, #40, #40, #40, #40, #00, #80, #00, #00, #40, #05, #3E, #E2, #87, #2F, #14
  db #89, #29, #8D, #88, #00, #6C, #00, #00, #00, #85, #00, #00, #68, #C3, #C3, #69
  db #96, #96, #7C, #9E, #4C, #00, #4C, #00, #00, #00, #00, #00, #04, #F0, #F0, #F0
  db #FC, #FC, #F9, #F0, #FC, #FC, #FC, #C0, #40, #40, #00, #00, #84, #84, #80, #80
  db #C0, #0D, #3E, #3E, #3E, #2F, #2F, #7B, #C1, #7B, #7B, #E3, #F3, #F1, #92, #A9
  db #39, #46, #00, #00, #00, #9C, #41, #94, #C0, #00, #00, #00, #40, #80, #00, #00
  db #40, #00, #80, #80, #80, #C0, #00, #40, #00, #40, #40, #1F, #79, #1F, #4A, #91
  db #29, #3C, #CC, #00, #14, #8C, #00, #00, #00, #C0, #00, #00, #79, #69, #C3, #96
  db #C3, #7C, #ED, #03, #88, #00, #28, #28, #00, #00, #00, #00, #14, #F0, #F0, #F0
  db #FC, #F8, #E9, #F4, #FC, #FC, #FC, #68, #7C, #B8, #00, #04, #40, #C8, #C0, #40
  db #94, #C0, #3D, #3D, #3D, #3D, #3D, #1F, #1F, #1A, #E3, #F3, #D3, #E3, #F6, #A9
  db #29, #9C, #00, #00, #00, #29, #68, #68, #C0, #00, #00, #00, #40, #C0, #00, #00
  db #00, #40, #40, #C0, #C0, #C0, #00, #00, #80, #00, #80, #85, #C1, #4B, #85, #04
  db #16, #46, #28, #00, #14, #88, #00, #00, #40, #80, #00, #40, #2C, #96, #96, #87
  db #96, #FC, #8B, #16, #00, #00, #4C, #00, #00, #00, #00, #00, #14, #F0, #F0, #F4
  db #FC, #F4, #E9, #FC, #FC, #E9, #C3, #28, #A4, #69, #2C, #40, #40, #40, #40, #80
  db #84, #85, #3E, #2F, #3E, #7B, #6B, #2F, #D3, #2F, #7B, #D3, #E3, #E3, #C7, #BC
  db #16, #88, #00, #00, #14, #16, #02, #84, #C0, #00, #00, #00, #40, #C0, #00, #00
  db #00, #80, #C0, #4A, #4A, #4A, #00, #00, #4A, #00, #40, #C0, #4A, #C2, #4A, #1C
  db #29, #9C, #00, #00, #9C, #00, #00, #88, #40, #00, #00, #40, #2D, #C3, #69, #4B
  db #56, #ED, #9E, #02, #88, #00, #C8, #00, #00, #00, #00, #14, #50, #F0, #F0, #F8
  db #FC, #FC, #D2, #FC, #FC, #93, #D6, #C0, #86, #60, #48, #48, #C8, #40, #40, #40
  db #0D, #48, #3D, #1A, #1F, #97, #D3, #D1, #F3, #D3, #D1, #F3, #D3, #D3, #FE, #9E
  db #6C, #28, #00, #00, #1C, #03, #9C, #C0, #80, #80, #00, #28, #00, #C0, #80, #00
  db #00, #40, #4A, #4B, #4B, #C0, #80, #00, #4B, #00, #40, #40, #94, #D1, #C0, #6C
  db #6C, #C4, #00, #00, #6C, #00, #44, #00, #80, #00, #40, #40, #68, #96, #96, #FC
  db #ED, #8B, #29, #28, #00, #04, #00, #00, #00, #00, #00, #3C, #78, #F0, #F4, #F4
  db #F8, #FC, #D2, #FC, #E9, #63, #C3, #84, #38, #0C, #84, #94, #48, #40, #40, #80
  db #84, #C0, #94, #2F, #25, #6B, #F3, #D3, #D3, #E3, #F3, #D3, #E3, #E3, #F4, #16
  db #16, #88, #00, #00, #29, #29, #9C, #C0, #08, #00, #80, #3C, #00, #00, #48, #00
  db #00, #40, #1E, #B6, #B6, #E2, #00, #00, #87, #E2, #00, #C0, #C0, #0E, #4A, #08
  db #88, #88, #00, #14, #88, #00, #00, #88, #00, #00, #40, #04, #0E, #4B, #7C, #ED
  db #CF, #16, #16, #44, #00, #44, #00, #00, #00, #00, #00, #8A, #78, #F0, #F0, #FC
  db #F8, #F8, #D6, #FC, #E9, #63, #86, #D5, #24, #60, #48, #48, #84, #80, #00, #C0
  db #3D, #84, #4A, #3D, #1F, #79, #E3, #D1, #E3, #F3, #E3, #F3, #D1, #D3, #DE, #16
  db #6C, #08, #00, #44, #29, #16, #9C, #40, #80, #80, #40, #78, #00, #00, #00, #00
  db #00, #40, #5B, #79, #79, #68, #80, #00, #1A, #1E, #80, #40, #C0, #4A, #C0, #22
  db #00, #00, #00, #04, #00, #00, #88, #00, #00, #00, #C0, #40, #68, #96, #FC, #56
  db #8B, #29, #13, #00, #00, #88, #00, #00, #00, #00, #54, #88, #F0, #F0, #F4, #F4
  db #F4, #E9, #F4, #FC, #D6, #C3, #86, #D4, #18, #84, #84, #84, #C0, #48, #08, #00
  db #94, #6A, #C0, #3E, #3E, #7B, #D3, #6B, #F3, #D3, #D3, #E3, #E3, #E3, #CF, #16
  db #9C, #00, #00, #9C, #29, #6C, #6C, #04, #40, #00, #80, #F4, #28, #00, #00, #00
  db #00, #40, #4B, #B6, #B6, #E2, #80, #00, #5B, #3D, #4A, #00, #C0, #85, #80, #08
  db #00, #00, #00, #00, #00, #44, #44, #00, #00, #00, #80, #04, #0E, #1A, #F8, #CF
  db #03, #16, #28, #00, #00, #00, #00, #00, #04, #14, #9E, #14, #F0, #F0, #F8, #FC
  db #F4, #E9, #FC, #FC, #61, #61, #86, #69, #0C, #48, #48, #48, #48, #84, #C0, #00
  db #3D, #68, #3D, #C0, #5B, #E3, #F3, #F3, #D3, #E3, #F3, #D3, #E3, #F2, #CF, #16
  db #4C, #00, #00, #6C, #16, #9C, #88, #C8, #80, #00, #80, #D2, #BC, #00, #00, #00
  db #00, #40, #0F, #87, #87, #E2, #80, #00, #94, #2F, #C0, #80, #80, #C0, #C0, #88
  db #00, #00, #00, #00, #00, #8D, #88, #00, #00, #40, #80, #40, #68, #7C, #A9, #8B
  db #16, #16, #88, #00, #44, #00, #00, #7C, #FC, #FC, #6C, #2D, #F0, #F0, #F0, #FC
  db #F4, #E9, #FC, #E9, #61, #C3, #48, #69, #19, #84, #84, #84, #C0, #C0, #48, #1C
  db #94, #3E, #3E, #E3, #6B, #D1, #D3, #97, #E3, #F3, #D3, #D3, #D3, #C7, #A9, #2C
  db #AA, #00, #00, #3C, #57, #6C, #88, #28, #40, #00, #48, #F4, #A9, #14, #00, #00
  db #00, #40, #4A, #4B, #4B, #85, #80, #00, #C0, #79, #0D, #C0, #40, #40, #40, #88
  db #00, #00, #00, #00, #00, #28, #00, #00, #00, #05, #80, #04, #0E, #F4, #A9, #8B
  db #29, #6C, #00, #00, #00, #00, #00, #A9, #6C, #28, #8D, #C9, #F0, #F4, #F0, #F8
  db #FC, #F0, #FC, #E9, #61, #C3, #48, #AC, #26, #84, #84, #84, #84, #C0, #84, #14
  db #95, #3D, #1F, #3D, #5B, #C2, #E3, #F3, #D3, #E3, #E3, #E3, #F2, #C7, #9E, #6C
  db #00, #00, #04, #AE, #AE, #6C, #00, #00, #00, #00, #94, #F4, #FC, #44, #80, #00
  db #00, #40, #85, #27, #27, #C0, #80, #00, #C0, #85, #C0, #4A, #00, #40, #80, #AA
  db #00, #00, #00, #00, #14, #44, #00, #00, #00, #C0, #00, #C0, #0D, #FC, #6D, #16
  db #16, #46, #00, #00, #88, #00, #14, #BC, #3C, #3C, #9C, #D0, #F0, #F0, #F8, #F8
  db #F8, #D6, #FC, #92, #C3, #93, #0D, #39, #48, #48, #48, #48, #48, #84, #84, #40
  db #0D, #D1, #59, #3E, #6B, #6B, #7B, #97, #D3, #D3, #E3, #E3, #E3, #E5, #16, #6C
  db #00, #00, #14, #5D, #16, #CC, #00, #00, #00, #40, #50, #FC, #FC, #00, #5D, #00
  db #00, #00, #C0, #4A, #4A, #4A, #80, #00, #40, #4A, #4A, #85, #80, #00, #80, #88
  db #00, #00, #00, #00, #44, #00, #00, #00, #40, #4A, #00, #80, #4B, #FC, #6D, #16
  db #16, #88, #00, #00, #08, #00, #14, #BC, #9C, #6C, #4E, #5A, #F0, #F4, #F4, #F8
  db #F8, #D6, #FC, #61, #61, #36, #1C, #86, #48, #48, #48, #48, #C0, #48, #48, #04
  db #1F, #68, #A6, #B7, #D3, #97, #D3, #2F, #E3, #F3, #D3, #D3, #F1, #8B, #9E, #88
  db #00, #00, #5D, #3C, #9C, #88, #00, #00, #00, #40, #78, #FC, #BC, #00, #28, #08
  db #00, #00, #80, #85, #85, #C0, #40, #00, #00, #C0, #85, #C0, #80, #00, #04, #00
  db #00, #00, #00, #00, #88, #00, #00, #00, #40, #80, #28, #80, #5C, #E9, #47, #29
  db #6C, #C4, #00, #00, #88, #00, #54, #EC, #3C, #5D, #08, #E1, #F0, #F0, #FC, #F4
  db #E1, #F4, #FC, #92, #C3, #86, #D4, #48, #48, #48, #48, #48, #48, #C0, #68, #40
  db #59, #C1, #D1, #59, #C1, #7B, #E3, #B7, #5B, #D3, #D3, #D3, #E1, #CF, #29, #C8
  db #88, #00, #AE, #7D, #6C, #88, #00, #00, #00, #40, #7C, #FC, #BC, #00, #08, #44
  db #00, #00, #00, #80, #C0, #80, #80, #00, #00, #40, #C0, #C0, #80, #00, #00, #00
  db #6C, #00, #00, #00, #00, #00, #00, #00, #C0, #94, #82, #40, #7C, #96, #9E, #16
  db #8C, #44, #00, #44, #00, #00, #7C, #6C, #3C, #8D, #C8, #F0, #F0, #F4, #F4, #F4
  db #E1, #FC, #B8, #92, #C3, #86, #D4, #0C, #84, #84, #84, #84, #C0, #84, #80, #48
  db #1F, #68, #A6, #B7, #C2, #D3, #D3, #6B, #E3, #E3, #E3, #F2, #E7, #A9, #6C, #28
  db #28, #44, #7D, #2C, #AE, #00, #00, #00, #00, #94, #7C, #FC, #BC, #00, #88, #00
  db #00, #00, #00, #40, #40, #40, #40, #00, #00, #00, #80, #C0, #40, #00, #00, #44
  db #6C, #00, #00, #00, #88, #00, #00, #40, #C0, #50, #28, #84, #78, #96, #16, #16
  db #CC, #80, #00, #00, #00, #00, #FC, #29, #3C, #C8, #8D, #F0, #F0, #F8, #FC, #F4
  db #E1, #FC, #E9, #61, #86, #86, #69, #48, #48, #48, #48, #48, #C0, #04, #80, #48
  db #C2, #A6, #B7, #87, #6B, #E3, #E3, #F3, #D3, #D3, #D3, #D2, #C7, #16, #16, #9C
  db #88, #00, #2C, #57, #5D, #00, #00, #00, #00, #94, #FC, #FC, #BC, #00, #04, #00
  db #00, #00, #00, #00, #80, #80, #80, #00, #00, #00, #40, #40, #80, #80, #00, #14
  db #9C, #00, #00, #00, #44, #00, #00, #85, #80, #78, #82, #EA, #B0, #96, #16, #16
  db #C8, #88, #00, #44, #00, #14, #FC, #BC, #6C, #4E, #41, #F0, #F0, #F4, #F8, #F4
  db #E1, #FC, #F8, #C3, #C3, #48, #69, #0C, #84, #84, #84, #C0, #48, #48, #08, #C0
  db #E3, #D1, #59, #C1, #E3, #E3, #7B, #D3, #E3, #E3, #E3, #F1, #7C, #9E, #6C, #6C
  db #28, #04, #BE, #AE, #AA, #88, #00, #00, #00, #D0, #FC, #FC, #BC, #00, #04, #00
  db #00, #00, #40, #80, #00, #40, #00, #00, #00, #00, #00, #80, #40, #00, #00, #04
  db #AE, #00, #00, #44, #00, #00, #00, #08, #05, #F4, #28, #80, #E9, #96, #16, #46
  db #4C, #44, #00, #00, #00, #54, #A9, #14, #6C, #80, #D0, #F0, #F0, #F8, #F8, #F8
  db #D6, #F8, #61, #61, #86, #48, #AC, #84, #84, #84, #C0, #48, #84, #84, #40, #48
  db #E2, #C2, #A6, #A6, #E3, #B7, #D3, #D3, #D3, #D3, #D3, #F1, #ED, #29, #9C, #9C
  db #88, #14, #5D, #4C, #44, #00, #00, #00, #40, #78, #FC, #FC, #FC, #08, #44, #00
  db #00, #00, #00, #C0, #00, #00, #00, #00, #00, #00, #00, #00, #80, #00, #00, #9C
  db #9C, #00, #00, #00, #88, #00, #00, #00, #50, #F4, #28, #0A, #E9, #39, #16, #9C
  db #04, #00, #00, #00, #00, #54, #BC, #3C, #2C, #44, #4B, #F0, #F4, #F4, #E9, #F8
  db #D6, #BC, #B0, #C3, #49, #48, #AC, #48, #48, #48, #48, #84, #C0, #48, #04, #C0
  db #E3, #C1, #D1, #D3, #6B, #B6, #F9, #D3, #E3, #E3, #F2, #F2, #8B, #3C, #46, #6C
  db #08, #14, #AE, #AA, #88, #00, #00, #00, #14, #5E, #FC, #FC, #FC, #28, #00, #28
  db #00, #00, #00, #4A, #00, #00, #00, #00, #00, #40, #00, #00, #00, #00, #00, #04
  db #AA, #00, #00, #44, #00, #00, #00, #00, #78, #FC, #82, #94, #C3, #96, #57, #4C
  db #08, #88, #00, #00, #00, #00, #A9, #3C, #88, #00, #D2, #F0, #F4, #F4, #F8, #F8
  db #D6, #AD, #E9, #86, #86, #94, #86, #84, #84, #00, #84, #C0, #48, #48, #04, #80
  db #E2, #D3, #C2, #D3, #D3, #7C, #FC, #4B, #F3, #D3, #D3, #E5, #BC, #16, #9C, #9C
  db #00, #8C, #6C, #C4, #00, #00, #00, #00, #14, #D2, #FC, #FC, #FC, #3C, #00, #08
  db #00, #00, #00, #85, #80, #00, #00, #00, #00, #40, #00, #00, #00, #00, #00, #9C
  db #04, #00, #00, #00, #00, #00, #00, #14, #D2, #FC, #22, #94, #96, #96, #AE, #AE
  db #04, #00, #00, #00, #00, #00, #00, #00, #00, #88, #D2, #F0, #F0, #FC, #F4, #E1
  db #FC, #E8, #61, #49, #1D, #D4, #0C, #84, #D0, #28, #C0, #48, #84, #80, #04, #C0
  db #E3, #C1, #C1, #E3, #C1, #ED, #FC, #BC, #E3, #E3, #F1, #76, #29, #6C, #6C, #6C
  db #04, #AE, #C8, #88, #00, #00, #00, #00, #0D, #F4, #FC, #FC, #FC, #AC, #00, #88
  db #00, #00, #00, #85, #85, #80, #00, #00, #00, #40, #C0, #00, #00, #00, #00, #04
  db #88, #00, #00, #44, #00, #00, #00, #14, #78, #FC, #A0, #14, #C3, #3C, #6C, #5D
  db #44, #00, #00, #00, #00, #00, #00, #00, #00, #C8, #F0, #F0, #F4, #F8, #D6, #E1
  db #FC, #E8, #96, #3E, #86, #D4, #48, #48, #5C, #A0, #04, #C0, #48, #08, #48, #80
  db #E2, #D3, #2F, #D3, #FC, #CB, #47, #FC, #D3, #D3, #D2, #DE, #29, #9C, #9C, #C8
  db #88, #5D, #08, #88, #00, #00, #00, #00, #49, #F4, #FC, #FC, #FC, #FD, #00, #14
  db #00, #00, #00, #40, #4A, #4A, #80, #80, #00, #00, #C0, #C0, #00, #00, #00, #55
  db #44, #00, #00, #00, #00, #00, #00, #08, #F4, #FC, #A0, #41, #96, #A3, #AE, #AE
  db #04, #00, #00, #00, #00, #00, #08, #00, #00, #28, #F0, #F0, #F8, #FC, #F4, #E1
  db #FC, #86, #84, #3D, #48, #69, #0C, #84, #5E, #68, #40, #C0, #84, #80, #0C, #C0
  db #E3, #C1, #E3, #E3, #DE, #16, #16, #DE, #AD, #D3, #C7, #BC, #3C, #9C, #9C, #88
  db #C4, #2C, #AA, #00, #00, #00, #00, #40, #78, #FC, #FC, #FC, #FC, #BC, #08, #04
  db #00, #00, #00, #40, #85, #C0, #80, #00, #00, #00, #85, #C0, #C0, #00, #00, #00
  db #88, #00, #00, #00, #00, #00, #00, #6C, #F4, #FC, #A0, #41, #69, #0B, #5D, #08
  db #88, #00, #00, #00, #00, #00, #AA, #00, #14, #8D, #D2, #F0, #F8, #FC, #D2, #D2
  db #FC, #34, #84, #3E, #6A, #3D, #48, #48, #49, #28, #C4, #84, #04, #80, #48, #40
  db #A6, #E3, #C1, #E3, #16, #3C, #6C, #6D, #BC, #2F, #7C, #9E, #16, #9C, #9C, #C8
  db #C8, #AE, #00, #00, #00, #00, #00, #04, #72, #F4, #FC, #FC, #FC, #A9, #68, #88
  db #28, #00, #00, #00, #C0, #C0, #40, #00, #00, #00, #C0, #4A, #C0, #00, #00, #44
  db #00, #00, #00, #00, #00, #00, #00, #5D, #D6, #FC, #A0, #41, #96, #81, #AE, #88
  db #08, #00, #00, #00, #00, #00, #08, #00, #9C, #0D, #F0, #F0, #FC, #F8, #F4, #D6
  db #FC, #C3, #1D, #3D, #48, #AC, #84, #84, #41, #80, #40, #48, #84, #40, #08, #80
  db #F3, #59, #59, #C3, #16, #6C, #3C, #DC, #DE, #DE, #CF, #ED, #6C, #06, #AE, #44
  db #D5, #5D, #00, #00, #00, #00, #00, #14, #F8, #FC, #FC, #FC, #FC, #BC, #3C, #00
  db #5D, #00, #00, #00, #40, #40, #80, #80, #00, #00, #00, #C0, #C0, #80, #00, #00
  db #00, #00, #00, #00, #00, #00, #44, #4E, #F4, #FC, #A0, #41, #69, #3C, #5D, #44
  db #00, #00, #00, #00, #00, #04, #00, #14, #2C, #AF, #F0, #F4, #F4, #E9, #F8, #D6
  db #E9, #61, #3E, #2E, #C0, #2C, #48, #48, #40, #00, #84, #C0, #48, #04, #40, #40
  db #3D, #A6, #E3, #D4, #3C, #47, #5D, #01, #56, #ED, #56, #29, #3C, #8C, #6C, #40
  db #8C, #44, #00, #00, #00, #00, #00, #3C, #F8, #FC, #FC, #FC, #FC, #A9, #2C, #04
  db #14, #88, #00, #00, #40, #80, #80, #00, #00, #00, #00, #00, #80, #00, #40, #00
  db #00, #00, #00, #00, #00, #00, #04, #8D, #FC, #FC, #A0, #41, #96, #94, #8C, #00
  db #00, #00, #00, #00, #00, #14, #00, #3C, #14, #14, #F0, #F0, #FC, #E9, #F0, #D6
  db #E9, #C3, #1D, #86, #1C, #86, #84, #84, #80, #00, #48, #80, #48, #04, #80, #80
  db #C1, #D1, #59, #D6, #9C, #29, #28, #14, #16, #8B, #29, #29, #16, #14, #8C, #44
  db #D5, #C4, #00, #00, #00, #00, #44, #3C, #F8, #FC, #FC, #FC, #FC, #BC, #96, #28
  db #4C, #28, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #80, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #88, #6C, #F4, #FC, #A0, #94, #96, #1C, #88, #08
  db #00, #00, #00, #00, #00, #44, #01, #28, #08, #58, #F0, #F4, #F4, #F0, #E9, #D6
  db #E9, #97, #86, #86, #C1, #0C, #84, #C0, #80, #80, #C0, #C0, #28, #04, #C0, #40
  db #E2, #C2, #E3, #D4, #6C, #6D, #8A, #44, #03, #29, #3C, #16, #2C, #29, #88, #40
  db #EA, #88, #00, #00, #00, #00, #14, #29, #F4, #FC, #FC, #FC, #FC, #BC, #BC, #28
  db #C8, #14, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #00, #40, #00
  db #00, #00, #00, #00, #00, #00, #28, #2C, #F4, #FC, #A0, #49, #69, #0E, #44, #00
  db #00, #00, #00, #14, #00, #00, #80, #9C, #9C, #50, #F0, #F4, #FC, #D6, #E1, #FC
  db #92, #97, #49, #3E, #D4, #84, #84, #84, #84, #40, #08, #C0, #08, #C0, #40, #80
  db #E3, #C1, #E2, #E5, #1C, #9C, #16, #00, #16, #06, #6C, #16, #9C, #46, #C4, #44
  db #4C, #00, #00, #00, #00, #00, #01, #7C, #F4, #FC, #FC, #FC, #FC, #BC, #BC, #02
  db #14, #00, #6C, #00, #00, #00, #00, #00, #80, #00, #00, #00, #00, #00, #80, #00
  db #00, #00, #00, #00, #00, #00, #28, #6C, #F4, #FC, #B4, #41, #4B, #1C, #00, #00
  db #00, #00, #00, #7C, #28, #D5, #D5, #1C, #5D, #5A, #F0, #F0, #FC, #D6, #E1, #FC
  db #C3, #49, #2E, #86, #58, #48, #48, #48, #48, #84, #C0, #48, #08, #48, #80, #C0
  db #B7, #A7, #C7, #FC, #9C, #1C, #16, #00, #29, #6C, #3C, #03, #01, #28, #04, #00
  db #28, #88, #00, #00, #00, #00, #3C, #7C, #FC, #FC, #FC, #FC, #FC, #BC, #BC, #A8
  db #44, #28, #14, #88, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #28, #2C, #F4, #FC, #B4, #94, #87, #48, #88, #00
  db #00, #00, #00, #FC, #A9, #3C, #2C, #AE, #EA, #D2, #F0, #F8, #FC, #F0, #C3, #FC
  db #C3, #3F, #3D, #86, #69, #0C, #84, #84, #84, #C0, #80, #84, #80, #48, #40, #04
  db #E3, #B7, #DE, #3C, #04, #AE, #29, #88, #1C, #6C, #01, #3C, #29, #88, #88, #00
  db #08, #00, #00, #00, #00, #44, #3C, #F8, #FC, #FC, #FC, #ED, #FC, #BC, #B8, #8E
  db #28, #44, #00, #08, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #28, #3C, #F4, #FC, #AD, #0D, #C2, #28, #00, #00
  db #00, #00, #14, #FC, #3C, #3C, #3C, #1C, #28, #F0, #F0, #F8, #FC, #D2, #D2, #B8
  db #C3, #49, #6B, #0C, #86, #84, #C0, #48, #48, #C0, #C0, #48, #04, #80, #80, #84
  db #D3, #7A, #DE, #6C, #14, #5D, #29, #28, #44, #28, #29, #8C, #57, #00, #08, #04
  db #04, #00, #00, #00, #00, #14, #7C, #F4, #FC, #FC, #FC, #BC, #FC, #A9, #FC, #28
  db #00, #40, #00, #44, #28, #00, #00, #00, #00, #00, #40, #40, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #08, #6C, #1C, #F4, #FC, #BC, #94, #94, #80, #00, #00
  db #00, #00, #14, #FC, #6C, #3C, #2C, #3C, #05, #D2, #F0, #FC, #E9, #F8, #7E, #E9
  db #35, #86, #6B, #48, #E8, #48, #48, #84, #C0, #48, #04, #84, #04, #C0, #40, #40
  db #E3, #E7, #BC, #9E, #00, #2C, #AB, #28, #44, #6C, #14, #6C, #6C, #00, #28, #44
  db #08, #00, #00, #00, #00, #9C, #7C, #FC, #FC, #FC, #FC, #EC, #7C, #E9, #FC, #3C
  db #00, #00, #88, #00, #40, #00, #00, #00, #40, #80, #80, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #04, #AA, #28, #3C, #F4, #FC, #BC, #94, #0E, #80, #00, #00
  db #00, #00, #7C, #BC, #3C, #3C, #3C, #1C, #14, #F0, #F0, #F4, #E9, #F8, #D6, #E9
  db #97, #97, #3D, #0D, #86, #48, #48, #48, #84, #C0, #C0, #48, #04, #80, #80, #C0
  db #E3, #F6, #47, #16, #88, #9C, #1C, #02, #44, #28, #00, #9C, #14, #44, #00, #14
  db #00, #00, #00, #00, #00, #3C, #FC, #FC, #FC, #FC, #FC, #EC, #54, #ED, #FC, #3C
  db #A8, #00, #00, #00, #00, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #5D, #80, #6C, #1C, #F4, #FC, #BC, #94, #94, #80, #88, #00
  db #00, #00, #FC, #EC, #3C, #3C, #2C, #6C, #41, #F0, #F4, #F4, #F8, #E1, #D6, #92
  db #86, #3E, #35, #1C, #86, #84, #84, #84, #C0, #84, #84, #0E, #C0, #40, #40, #84
  db #E3, #E7, #16, #9E, #28, #04, #AE, #28, #44, #C4, #00, #14, #44, #14, #00, #9C
  db #00, #00, #00, #00, #14, #D8, #FC, #FC, #FC, #FC, #FC, #8E, #45, #FC, #FC, #6C
  db #BC, #04, #00, #00, #00, #00, #00, #80, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #44, #28, #28, #28, #3C, #FC, #FC, #BC, #94, #C0, #80, #00, #00
  db #00, #14, #FC, #9E, #3C, #16, #3C, #28, #50, #F0, #F4, #F4, #F0, #E1, #D6, #C3
  db #3D, #97, #2E, #D0, #0C, #84, #C0, #48, #84, #C0, #48, #08, #48, #80, #80, #08
  db #D3, #7C, #03, #CF, #5D, #44, #6C, #6C, #00, #00, #00, #00, #88, #6C, #00, #5D
  db #00, #00, #00, #00, #6C, #7C, #F8, #FC, #FC, #FC, #FC, #A8, #14, #74, #FC, #2C
  db #BC, #00, #08, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #2C, #9C, #88, #6C, #94, #FC, #FC, #B4, #C0, #68, #40, #44, #00
  db #00, #14, #FC, #56, #3C, #3C, #3C, #88, #50, #F0, #F8, #FC, #D6, #A5, #FC, #92
  db #1D, #1D, #48, #D4, #48, #48, #48, #48, #48, #84, #84, #80, #48, #40, #04, #C0
  db #E3, #C7, #29, #6D, #2C, #00, #5D, #C4, #00, #00, #00, #00, #08, #6C, #00, #6C
  db #00, #00, #00, #44, #28, #FC, #FC, #FC, #FC, #FC, #FC, #8A, #00, #BC, #FC, #3C
  db #7C, #08, #14, #00, #00, #00, #00, #00, #08, #08, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #28, #28, #28, #28, #6C, #FC, #FC, #B4, #94, #C0, #00, #44, #00
  db #00, #14, #FC, #98, #29, #3C, #6C, #00, #78, #F0, #F4, #FC, #F6, #E3, #FC, #86
  db #84, #84, #84, #94, #2E, #84, #84, #84, #C0, #48, #48, #80, #48, #40, #84, #84
  db #F3, #16, #29, #16, #02, #00, #14, #00, #00, #00, #00, #C8, #00, #28, #00, #28
  db #00, #00, #00, #00, #50, #FC, #F4, #FC, #FC, #FC, #FC, #02, #00, #7C, #FC, #2C
  db #7C, #3C, #04, #14, #00, #00, #00, #14, #14, #04, #EA, #00, #00, #00, #00, #00
  db #00, #00, #08, #6C, #D5, #08, #6C, #28, #FC, #FC, #B4, #C0, #80, #80, #00, #00
  db #00, #00, #A9, #3C, #16, #2C, #88, #00, #D2, #F0, #F8, #FC, #D2, #C3, #E9, #C0
  db #C0, #80, #80, #3D, #C0, #48, #48, #48, #84, #84, #94, #84, #80, #80, #80, #48
  db #E3, #8E, #BE, #06, #14, #6C, #04, #00, #00, #00, #00, #08, #00, #88, #04, #AA
  db #00, #00, #00, #F0, #F8, #FC, #FC, #FC, #FC, #FC, #FC, #8A, #00, #01, #FC, #3C
  db #52, #EC, #00, #00, #00, #00, #00, #08, #28, #08, #08, #88, #00, #00, #00, #00
  db #00, #14, #04, #28, #6C, #28, #28, #88, #DE, #FC, #BC, #84, #40, #40, #00, #00
  db #00, #00, #55, #1C, #6C, #00, #00, #00, #F0, #F4, #F4, #F8, #D2, #58, #AD, #84
  db #80, #80, #80, #38, #00, #04, #84, #84, #C0, #48, #48, #04, #C0, #40, #04, #84
  db #F3, #8E, #BE, #08, #CD, #16, #44, #00, #00, #00, #00, #00, #00, #88, #14, #88
  db #00, #00, #41, #F4, #F4, #F8, #FC, #FC, #FC, #FC, #ED, #28, #00, #41, #FC, #7C
  db #16, #BC, #14, #08, #00, #00, #2C, #04, #14, #2C, #14, #00, #00, #00, #00, #00
  db #00, #08, #28, #6C, #D5, #08, #6C, #00, #56, #FC, #B4, #C0, #80, #08, #80, #00
  db #00, #00, #00, #00, #00, #00, #00, #14, #F0, #F8, #F8, #E9, #E1, #96, #C2, #C0
  db #40, #40, #00, #3C, #00, #00, #00, #40, #48, #68, #80, #14, #80, #80, #C0, #48
  db #E3, #16, #9C, #88, #6D, #16, #88, #00, #00, #00, #00, #88, #80, #04, #01, #00
  db #00, #00, #3C, #F8, #FC, #F4, #FC, #FC, #FC, #FC, #FC, #28, #00, #14, #FC, #7C
  db #BC, #A9, #04, #3C, #1C, #00, #3C, #1C, #2C, #14, #2C, #EA, #00, #00, #00, #44
  db #C4, #14, #44, #28, #6C, #28, #C8, #00, #7C, #FC, #BC, #C0, #40, #40, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #14, #F4, #F4, #F4, #E9, #E1, #94, #E1, #C1
  db #68, #80, #80, #50, #00, #00, #00, #00, #40, #48, #48, #41, #C0, #40, #C8, #84
  db #E3, #7D, #5D, #00, #47, #29, #08, #00, #00, #00, #00, #1C, #88, #44, #6C, #00
  db #00, #00, #16, #F4, #FC, #FC, #FC, #FC, #FC, #FC, #DE, #28, #00, #00, #FC, #7C
  db #A9, #FC, #00, #1C, #2C, #00, #BC, #3C, #00, #00, #14, #08, #00, #00, #00, #14
  db #04, #44, #80, #6C, #D5, #08, #28, #00, #7C, #FC, #F8, #40, #40, #48, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #50, #F8, #F8, #F4, #F8, #E1, #48, #E9, #E9
  db #68, #84, #80, #80, #00, #00, #00, #00, #00, #04, #80, #2C, #80, #80, #84, #84
  db #B6, #2C, #EA, #44, #29, #16, #AA, #6C, #00, #00, #44, #29, #28, #40, #AE, #00
  db #00, #14, #78, #FC, #F8, #F8, #FC, #FC, #FC, #FC, #BC, #28, #00, #00, #7C, #7C
  db #AD, #56, #00, #2C, #3C, #14, #BC, #28, #00, #00, #00, #2C, #00, #00, #5D, #04
  db #14, #44, #20, #5D, #08, #28, #88, #00, #7C, #FC, #F8, #04, #80, #84, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #69, #F8, #F8, #FC, #F8, #C3, #C2, #C1, #E9
  db #24, #80, #C0, #C8, #00, #00, #00, #00, #00, #00, #40, #3C, #C0, #40, #C8, #84
  db #E3, #6C, #C4, #14, #9C, #16, #9C, #3C, #00, #00, #3C, #03, #7D, #00, #08, #00
  db #00, #14, #7C, #F4, #FC, #F4, #FC, #FC, #FC, #FC, #9E, #88, #00, #00, #54, #7C
  db #FC, #56, #00, #1C, #1C, #54, #BC, #00, #40, #08, #00, #5D, #80, #98, #C8, #14
  db #08, #88, #88, #28, #6C, #80, #00, #00, #FE, #FC, #F8, #40, #18, #48, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #78, #F8, #F4, #F8, #F8, #C3, #48, #C3, #A8
  db #00, #00, #40, #40, #40, #00, #00, #00, #00, #80, #00, #C2, #40, #40, #C0, #48
  db #B6, #28, #88, #6C, #3C, #28, #3C, #16, #88, #04, #29, #29, #7D, #00, #00, #00
  db #00, #3C, #78, #FC, #F4, #FC, #FC, #FC, #FC, #FC, #BC, #04, #00, #00, #14, #D6
  db #FC, #56, #40, #C8, #6C, #D4, #8A, #00, #04, #00, #00, #94, #88, #44, #64, #D5
  db #08, #08, #44, #04, #14, #88, #00, #00, #54, #FC, #F8, #C8, #84, #20, #80, #00
  db #88, #00, #00, #00, #00, #00, #00, #F4, #F8, #F8, #F8, #F8, #C3, #C3, #D6, #68
  db #00, #00, #00, #00, #80, #80, #00, #00, #00, #00, #00, #28, #80, #C4, #84, #84
  db #C3, #44, #80, #AE, #AA, #44, #29, #29, #88, #14, #29, #29, #3C, #00, #00, #00
  db #44, #6C, #F4, #F8, #F8, #FC, #FC, #FC, #FC, #FC, #9E, #44, #00, #00, #00, #7C
  db #FC, #16, #28, #D5, #18, #7C, #02, #00, #00, #00, #00, #04, #28, #00, #1C, #9C
  db #C8, #88, #C8, #88, #28, #00, #00, #00, #54, #FC, #F8, #68, #18, #80, #00, #00
  db #00, #00, #00, #00, #00, #00, #10, #F4, #F8, #F4, #F8, #D6, #C3, #E9, #F4, #80
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #28, #00, #C0, #48, #48
  db #B6, #04, #00, #6C, #28, #01, #03, #3C, #88, #44, #3C, #3C, #6C, #00, #00, #00
  db #9C, #9C, #F4, #F4, #F4, #FC, #FC, #FC, #FC, #FC, #29, #00, #00, #00, #00, #54
  db #FC, #BC, #1C, #04, #64, #7C, #28, #00, #00, #00, #00, #1C, #88, #44, #C4, #2C
  db #6C, #C4, #44, #00, #C8, #00, #00, #00, #54, #FC, #FC, #68, #C0, #08, #80, #00
  db #00, #00, #00, #00, #00, #00, #41, #FC, #F4, #F4, #F8, #D6, #D6, #E9, #E9, #C0
  db #08, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #28, #00, #40, #84, #84
  db #96, #00, #88, #2C, #AA, #01, #03, #16, #88, #00, #2C, #6C, #28, #00, #00, #00
  db #6C, #D0, #F8, #F8, #FC, #FC, #FC, #FC, #ED, #FC, #9C, #00, #00, #00, #00, #54
  db #FC, #BC, #3C, #04, #40, #7C, #08, #80, #00, #00, #40, #14, #08, #00, #C8, #6C
  db #2C, #44, #04, #44, #00, #00, #00, #00, #54, #FC, #FC, #A0, #48, #40, #00, #40
  db #00, #00, #00, #00, #00, #00, #50, #FC, #F8, #F0, #FC, #D6, #F4, #C3, #BC, #C0
  db #C0, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #28, #40, #00, #04, #84
  db #B6, #00, #04, #9C, #00, #1C, #03, #3C, #9C, #02, #1C, #9C, #00, #00, #00, #44
  db #28, #F4, #F4, #F4, #FC, #FC, #FC, #FC, #DE, #A9, #28, #44, #00, #00, #00, #14
  db #FC, #BC, #7C, #08, #28, #FC, #00, #08, #00, #00, #84, #C4, #28, #04, #44, #68
  db #AE, #04, #55, #00, #00, #00, #00, #00, #54, #FC, #FC, #E8, #80, #80, #00, #00
  db #80, #00, #00, #00, #00, #00, #78, #FC, #F4, #F0, #F4, #D2, #AD, #D2, #E8, #C0
  db #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #00, #48
  db #96, #00, #00, #28, #00, #5D, #03, #6C, #01, #3C, #44, #6C, #00, #00, #00, #14
  db #14, #F4, #F4, #F4, #FC, #FC, #FC, #FC, #DE, #8F, #00, #00, #00, #00, #00, #00
  db #FC, #BC, #7C, #28, #80, #BC, #00, #C0, #00, #00, #40, #14, #C8, #44, #00, #6C
  db #6C, #28, #C8, #88, #00, #00, #98, #88, #14, #FC, #FC, #BC, #C0, #40, #40, #40
  db #00, #00, #00, #00, #00, #00, #D6, #FC, #F0, #F0, #F4, #F4, #E9, #D6, #E8, #C0
  db #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #80, #14
  db #B6, #00, #44, #C4, #04, #AE, #29, #28, #03, #16, #44, #04, #00, #00, #00, #44
  db #50, #F8, #F8, #FC, #FC, #FC, #FC, #ED, #ED, #ED, #88, #00, #88, #14, #88, #00
  db #54, #BC, #7C, #28, #08, #BC, #00, #08, #00, #00, #00, #14, #08, #14, #00, #6C
  db #2C, #28, #44, #00, #00, #9C, #00, #00, #9C, #DE, #FC, #F8, #40, #40, #40, #80
  db #80, #00, #00, #00, #00, #14, #F4, #FC, #F0, #F0, #F4, #F4, #5A, #D6, #68, #C0
  db #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40, #40
  db #C2, #00, #44, #00, #04, #6C, #29, #14, #03, #16, #88, #00, #00, #00, #00, #00
  db #F4, #F4, #F4, #F4, #FC, #FC, #FC, #DE, #DE, #03, #28, #00, #28, #1C, #88, #00
  db #14, #BC, #7C, #AC, #00, #BC, #00, #00, #00, #00, #00, #14, #88, #C8, #88, #6C
  db #6C, #6C, #80, #88, #00, #00, #14, #2C, #29, #8B, #FC, #F8, #28, #80, #C4, #80
  db #00, #00, #00, #00, #00, #51, #F4, #F8, #F8, #F0, #F0, #FC, #C3, #FC, #C2, #C0
  db #40, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #80
  db #E3, #00, #04, #00, #14, #9C, #88, #01, #03, #16, #88, #00, #00, #00, #00, #50
  db #F0, #F8, #F8, #F8, #FC, #FC, #ED, #ED, #A9, #29, #AA, #00, #08, #AB, #00, #00
  db #00, #3C, #54, #16, #00, #3C, #00, #00, #00, #80, #00, #14, #28, #14, #00, #5D
  db #D5, #5D, #00, #00, #00, #44, #2C, #BE, #9C, #29, #FC, #FC, #68, #C0, #40, #40
  db #00, #00, #00, #00, #00, #D0, #F4, #F8, #F0, #F0, #F4, #FC, #C3, #FC, #C0, #C0
  db #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #40
  db #E3, #20, #44, #00, #44, #64, #28, #1C, #16, #16, #00, #00, #00, #00, #14, #D2
  db #F0, #F4, #F8, #FC, #FC, #FC, #ED, #ED, #A9, #01, #28, #44, #28, #09, #AA, #00
  db #40, #00, #4D, #A9, #20, #2C, #00, #00, #40, #08, #00, #14, #08, #04, #AA, #C8
  db #AE, #28, #00, #00, #00, #5D, #08, #00, #6C, #3C, #DE, #FC, #A8, #80, #C4, #80
  db #00, #00, #00, #00, #00, #F0, #FC, #F8, #F0, #F0, #F0, #F8, #C3, #F8, #E2, #C0
  db #40, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #E3, #92, #88, #88, #04, #9C, #00, #9C, #03, #6C, #80, #00, #00, #00, #C1, #F0
  db #F0, #F8, #F8, #FC, #FC, #FC, #ED, #FC, #9E, #00, #02, #00, #1C, #9C, #6C, #00
  db #40, #80, #14, #52, #08, #3C, #00, #00, #04, #C0, #00, #14, #88, #14, #C4, #D5
  db #5D, #1C, #00, #00, #44, #00, #00, #00, #44, #5D, #29, #FC, #BC, #40, #14, #40
  db #00, #00, #00, #00, #50, #FC, #FC, #F8, #F0, #F0, #F4, #E9, #D6, #E9, #60, #C0
  db #40, #00, #00, #80, #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #E3, #E7, #00, #00, #88, #4C, #80, #AE, #29, #88, #00, #00, #00, #00, #78, #F0
  db #F4, #F4, #F4, #FC, #FC, #FC, #DE, #ED, #4F, #00, #28, #44, #AE, #AE, #02, #00
  db #40, #20, #00, #29, #28, #3C, #04, #00, #40, #00, #14, #3C, #00, #5D, #08, #88
  db #2C, #AA, #00, #00, #88, #00, #00, #00, #00, #04, #14, #47, #E9, #00, #80, #80
  db #00, #00, #00, #40, #7C, #FC, #FC, #F8, #F0, #F0, #F4, #E9, #D6, #F9, #68, #C0
  db #00, #00, #00, #15, #A6, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #D3, #BC, #00, #00, #44, #14, #00, #5D, #1C, #00, #00, #00, #00, #00, #F0, #F0
  db #F0, #F8, #F8, #FC, #FC, #FC, #DE, #FC, #00, #00, #88, #44, #6C, #6C, #6C, #00
  db #40, #94, #00, #40, #3C, #14, #88, #28, #80, #00, #BC, #3C, #00, #98, #C8, #88
  db #08, #00, #00, #44, #00, #00, #00, #00, #44, #6C, #6C, #14, #DE, #00, #40, #00
  db #00, #00, #00, #C5, #FC, #FC, #FC, #F4, #F0, #F0, #F4, #A5, #D6, #E9, #60, #80
  db #80, #00, #40, #41, #06, #00, #00, #00, #00, #00, #00, #08, #00, #00, #00, #00
  db #E3, #3C, #00, #00, #88, #08, #44, #2C, #AA, #00, #00, #00, #00, #14, #F0, #F0
  db #F0, #F4, #F4, #FC, #FC, #ED, #FC, #BC, #00, #00, #00, #00, #2C, #AE, #AE, #14
  db #40, #60, #20, #00, #00, #14, #08, #14, #04, #54, #BC, #2C, #00, #6C, #20, #44
  db #00, #40, #00, #00, #00, #00, #00, #00, #9C, #9C, #10, #90, #91, #28, #40, #00
  db #00, #80, #3C, #5E, #FC, #FC, #FC, #F0, #F0, #F0, #F4, #D2, #D6, #F8, #C0, #80
  db #00, #00, #40, #15, #83, #00, #00, #00, #00, #00, #04, #84, #00, #00, #00, #00
  db #F6, #1C, #00, #00, #00, #00, #14, #9C, #88, #04, #00, #00, #00, #50, #F0, #F0
  db #F0, #F4, #FC, #FC, #FC, #FC, #FC, #8A, #00, #00, #44, #64, #28, #28, #88, #C8
  db #90, #51, #29, #00, #00, #00, #28, #80, #28, #FC, #B9, #28, #44, #D5, #80, #00
  db #00, #80, #00, #00, #00, #00, #00, #00, #00, #C0, #C0, #C8, #68, #0A, #00, #00
  db #80, #00, #94, #7C, #FC, #FC, #FC, #F0, #F0, #F0, #FC, #C3, #FC, #FC, #60, #40
  db #00, #00, #00, #C1, #6B, #00, #00, #00, #00, #00, #68, #48, #08, #00, #00, #00
  db #96, #28, #00, #00, #44, #00, #04, #AE, #00, #14, #00, #00, #00, #50, #F0, #F0
  db #F0, #F8, #FC, #FC, #FC, #F4, #EC, #20, #00, #00, #14, #36, #88, #88, #88, #00
  db #C0, #10, #B2, #84, #80, #00, #1C, #00, #54, #FC, #AC, #00, #40, #88, #00, #00
  db #40, #00, #00, #00, #00, #00, #00, #44, #10, #80, #00, #14, #36, #88, #00, #80
  db #40, #54, #E9, #FC, #FC, #FC, #FC, #F0, #F0, #F0, #F8, #C3, #FC, #FC, #A0, #80
  db #00, #00, #00, #95, #83, #00, #00, #00, #00, #44, #68, #2C, #20, #00, #00, #00
  db #AC, #28, #2C, #00, #00, #00, #14, #14, #00, #04, #00, #00, #00, #78, #F0, #F0
  db #F0, #FC, #FC, #FC, #F8, #FC, #28, #00, #00, #00, #00, #33, #88, #14, #00, #00
  db #61, #40, #92, #80, #61, #80, #04, #28, #0D, #BC, #08, #00, #00, #00, #00, #40
  db #34, #00, #00, #00, #44, #20, #00, #00, #80, #00, #00, #00, #9C, #68, #00, #00
  db #00, #34, #FC, #FC, #FC, #FC, #FC, #F0, #F0, #F0, #ED, #E1, #FC, #FC, #E8, #00
  db #00, #00, #00, #15, #06, #00, #00, #00, #00, #14, #1C, #1C, #08, #28, #00, #00
  db #2C, #04, #3C, #00, #00, #00, #04, #04, #00, #08, #00, #00, #00, #F0, #F0, #F0
  db #F0, #FC, #FC, #FC, #F8, #B4, #00, #00, #00, #00, #6C, #39, #28, #44, #00, #40
  db #C1, #40, #61, #C0, #C1, #20, #00, #2C, #2C, #2C, #64, #00, #00, #00, #80, #C0
  db #92, #00, #00, #00, #2C, #00, #00, #00, #00, #00, #00, #00, #C0, #60, #60, #00
  db #F0, #D6, #FC, #FC, #FC, #FC, #F8, #F8, #F0, #F4, #E9, #D6, #FC, #FC, #BC, #00
  db #00, #00, #00, #40, #08, #00, #00, #00, #00, #14, #1C, #1C, #28, #48, #00, #00
  db #1C, #14, #36, #28, #00, #00, #00, #88, #08, #28, #00, #00, #14, #F0, #F0, #F0
  db #F0, #FC, #FC, #FC, #F0, #B4, #00, #00, #00, #14, #1C, #CC, #36, #00, #00, #00
  db #94, #60, #61, #20, #90, #C2, #00, #04, #2C, #98, #88, #00, #80, #61, #60, #94
  db #E2, #80, #00, #04, #28, #00, #00, #00, #00, #00, #00, #90, #90, #90, #59, #D2
  db #78, #F0, #FC, #FC, #FC, #FC, #F8, #F0, #F0, #F4, #E5, #D6, #FC, #FC, #FC, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #41, #2C, #2C, #68, #2C, #80, #00
  db #28, #1C, #3C, #92, #00, #00, #44, #44, #00, #00, #00, #00, #70, #F0, #F0, #F0
  db #F0, #FC, #FC, #FC, #F0, #B0, #00, #00, #00, #9C, #6C, #28, #9C, #88, #00, #00
  db #90, #68, #61, #E2, #40, #92, #00, #00, #00, #00, #00, #00, #94, #B6, #C0, #79
  db #60, #40, #00, #1C, #00, #00, #00, #00, #00, #00, #40, #60, #C0, #60, #34, #E3
  db #F0, #F0, #FC, #FC, #FC, #FC, #F8, #F8, #F0, #F4, #D2, #7C, #FC, #FC, #FC, #28
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #3C, #1C, #1C, #1C, #94, #48, #00
  db #08, #29, #69, #B6, #00, #00, #00, #04, #00, #00, #00, #00, #D2, #F0, #F0, #F0
  db #F4, #F4, #FC, #FC, #F0, #1A, #00, #00, #44, #3C, #9C, #CC, #14, #88, #00, #40
  db #41, #60, #79, #92, #80, #61, #80, #00, #00, #00, #00, #40, #79, #79, #90, #92
  db #C0, #90, #00, #28, #00, #00, #00, #00, #00, #00, #94, #00, #00, #00, #C0, #79
  db #F0, #F8, #FC, #FC, #FC, #FC, #F4, #F0, #F0, #FC, #96, #D6, #FC, #FC, #FC, #28
  db #00, #00, #00, #00, #00, #00, #00, #00, #08, #3C, #1C, #1C, #1C, #84, #24, #80
  db #14, #56, #D3, #92, #00, #00, #00, #00, #00, #00, #00, #14, #F0, #F0, #F0, #F0
  db #F4, #FC, #FC, #FC, #F0, #E2, #00, #00, #14, #6C, #88, #00, #00, #28, #00, #40
  db #10, #C2, #61, #E3, #20, #90, #C2, #00, #00, #00, #40, #14, #61, #E2, #94, #E2
  db #80, #25, #64, #20, #00, #00, #00, #00, #00, #40, #00, #00, #00, #00, #44, #94
  db #61, #F4, #F0, #FC, #FC, #FC, #F0, #F0, #F4, #F4, #96, #FC, #FC, #FC, #FC, #A8
  db #00, #00, #00, #00, #00, #00, #00, #00, #28, #96, #1C, #1C, #1C, #94, #18, #48
  db #11, #BC, #D3, #C3, #00, #00, #00, #00, #00, #00, #00, #50, #D2, #F0, #F0, #F0
  db #F8, #FC, #FC, #F8, #F0, #60, #00, #00, #9C, #9C, #00, #00, #00, #88, #00, #10
  db #C0, #38, #90, #83, #68, #C0, #79, #68, #94, #00, #80, #90, #92, #C2, #61, #60
  db #90, #79, #18, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #3C
  db #1C, #F0, #F8, #F4, #FC, #F8, #F8, #F4, #F8, #ED, #96, #D6, #FC, #FC, #FC, #F8
  db #00, #00, #00, #00, #00, #00, #00, #14, #00, #E9, #2C, #2C, #2C, #68, #0C, #84
  db #7C, #4B, #E3, #A7, #08, #00, #00, #00, #00, #00, #00, #78, #F0, #F0, #F0, #F4
  db #F4, #FC, #FC, #F4, #A1, #90, #00, #00, #6C, #6C, #00, #00, #00, #04, #00, #41
  db #20, #92, #D1, #69, #E3, #40, #60, #E3, #61, #61, #40, #79, #79, #90, #D3, #C0
  db #41, #24, #90, #48, #40, #80, #00, #00, #00, #00, #00, #00, #00, #00, #00, #14
  db #3C, #69, #F4, #F0, #FC, #F8, #F8, #FC, #FC, #E9, #C7, #74, #FC, #FC, #FC, #FC
  db #28, #00, #00, #00, #00, #00, #00, #68, #94, #E9, #96, #1C, #1C, #94, #84, #84
  db #76, #79, #D3, #96, #08, #28, #00, #00, #00, #00, #14, #F0, #F0, #F0, #F0, #F0
  db #FC, #FC, #F8, #F8, #F1, #68, #00, #14, #9C, #88, #00, #00, #00, #00, #00, #10
  db #60, #61, #90, #E3, #F1, #82, #94, #D1, #68, #E2, #60, #79, #92, #C1, #B6, #80
  db #92, #C2, #34, #10, #D3, #79, #79, #68, #80, #00, #00, #00, #00, #00, #00, #44
  db #3C, #3C, #F0, #F8, #FC, #F8, #F4, #FC, #FC, #E9, #C3, #5C, #FC, #FC, #FC, #FC
  db #82, #00, #00, #00, #00, #00, #14, #C0, #14, #E9, #69, #2C, #2C, #2C, #84, #84
  db #AD, #E3, #E3, #0E, #14, #3C, #00, #00, #00, #00, #D0, #D2, #F0, #F0, #F0, #F8
  db #FC, #FC, #5A, #F0, #B6, #E2, #00, #9C, #6C, #08, #00, #00, #00, #00, #88, #90
  db #C0, #61, #D1, #D1, #D2, #F2, #20, #C0, #71, #90, #94, #E3, #B6, #C1, #E0, #94
  db #B6, #90, #48, #D3, #79, #92, #D3, #D3, #D3, #28, #40, #00, #00, #00, #00, #00
  db #9C, #59, #D2, #F4, #F0, #F8, #F4, #FC, #FC, #E9, #3D, #69, #FC, #FC, #FC, #FC
  db #A8, #40, #00, #00, #00, #04, #68, #80, #54, #E1, #C3, #96, #1C, #48, #68, #48
  db #BC, #E3, #E3, #28, #3C, #1C, #00, #00, #00, #00, #D2, #F0, #F0, #F0, #F0, #F4
  db #FC, #AD, #F8, #F0, #B2, #C2, #00, #6C, #6C, #00, #00, #00, #00, #00, #00, #80
  db #C2, #94, #60, #92, #E3, #F1, #92, #C0, #94, #94, #61, #E3, #30, #D3, #60, #79
  db #60, #61, #D0, #B6, #E3, #F2, #D2, #E3, #43, #F2, #20, #80, #00, #00, #00, #14
  db #90, #61, #F2, #F4, #F4, #F4, #FC, #FC, #F8, #E9, #48, #96, #FC, #FC, #FC, #F8
  db #C2, #28, #00, #00, #40, #68, #C4, #80, #DC, #C3, #96, #C3, #2C, #68, #9C, #84
  db #5B, #D3, #96, #28, #3C, #3C, #82, #00, #00, #40, #F0, #F0, #F0, #F0, #F0, #F8
  db #FC, #AD, #5A, #F1, #79, #94, #44, #3C, #9C, #00, #00, #00, #00, #88, #41, #20
  db #90, #90, #92, #C1, #C1, #F2, #E3, #92, #80, #35, #61, #92, #92, #C3, #60, #D3
  db #68, #E2, #D3, #79, #D3, #E1, #43, #F0, #83, #D3, #92, #40, #00, #00, #00, #00
  db #18, #59, #D3, #F0, #F8, #F0, #FC, #FC, #E1, #E9, #84, #96, #D6, #FC, #FC, #F8
  db #96, #BC, #00, #40, #2C, #C0, #88, #40, #DE, #C3, #C3, #69, #96, #1C, #C0, #48
  db #D3, #D3, #9E, #04, #3C, #3C, #E3, #00, #00, #50, #D2, #F0, #F0, #F0, #F4, #F4
  db #FC, #AD, #AD, #F2, #35, #71, #04, #6C, #6C, #00, #00, #00, #44, #00, #94, #A2
  db #90, #41, #D1, #68, #B2, #D3, #83, #D2, #D2, #B2, #D3, #79, #61, #B6, #C1, #B6
  db #D1, #79, #92, #D3, #E1, #43, #F1, #F0, #F2, #D2, #E1, #92, #00, #00, #00, #00
  db #44, #3C, #F2, #D2, #F8, #F8, #FC, #F8, #E9, #E9, #84, #96, #D6, #FC, #FC, #E5
  db #B4, #D6, #08, #3C, #84, #80, #40, #08, #FC, #96, #C3, #96, #C3, #69, #00, #48
  db #E3, #E3, #3C, #14, #39, #69, #F2, #28, #00, #61, #F0, #F0, #F0, #F0, #F0, #FC
  db #FC, #5E, #5E, #A3, #79, #C1, #14, #9C, #88, #00, #00, #00, #04, #00, #51, #C2
  db #40, #90, #68, #B2, #59, #61, #E3, #E3, #43, #61, #E3, #61, #C1, #92, #61, #60
  db #92, #E3, #61, #61, #F2, #83, #D2, #D2, #D2, #E1, #F0, #F2, #20, #00, #00, #00
  db #00, #5D, #18, #E1, #F4, #F4, #FC, #FC, #F4, #E1, #84, #C1, #69, #FC, #FC, #F8
  db #CB, #B4, #E9, #68, #68, #04, #C4, #94, #F8, #C3, #69, #69, #96, #C3, #20, #84
  db #E3, #F6, #08, #3C, #36, #D3, #D2, #08, #10, #D2, #F0, #F0, #F0, #F0, #F4, #F4
  db #FC, #5E, #0F, #B4, #E2, #92, #2C, #6C, #88, #00, #00, #00, #00, #40, #14, #B6
  db #80, #C0, #61, #D1, #61, #D1, #79, #38, #D1, #79, #92, #92, #C1, #60, #D3, #24
  db #B6, #E3, #71, #D3, #D3, #E1, #F1, #F1, #E1, #F0, #F0, #E1, #E0, #00, #00, #00
  db #00, #AE, #2D, #72, #F4, #F4, #FC, #F4, #E5, #E9, #84, #C5, #96, #FC, #FC, #F4
  db #E1, #69, #69, #3C, #C4, #C4, #24, #14, #E9, #69, #96, #C3, #69, #96, #C2, #14
  db #E3, #96, #28, #3C, #3C, #D2, #96, #D5, #49, #E1, #F0, #F0, #F0, #F0, #F8, #F4
  db #AD, #AD, #AD, #51, #79, #C1, #3C, #9C, #00, #00, #00, #00, #88, #90, #C0, #79
  db #40, #C0, #60, #92, #90, #92, #B6, #E3, #61, #E3, #B6, #B2, #C1, #34, #B6, #C1
  db #60, #92, #E2, #92, #C3, #F2, #F2, #D2, #F2, #E1, #F0, #D2, #D2, #C4, #00, #00
  db #00, #14, #39, #27, #F6, #F4, #FC, #F8, #DA, #BC, #84, #49, #69, #FC, #FC, #E1
  db #C3, #C3, #96, #18, #18, #C8, #48, #D8, #E9, #96, #C3, #69, #96, #C3, #D6, #40
  db #F3, #EC, #14, #39, #69, #E3, #B4, #14, #79, #F0, #F0, #F0, #F0, #F0, #F0, #FC
  db #AD, #5E, #1E, #14, #E2, #92, #2C, #6C, #00, #00, #00, #44, #10, #79, #80, #61
  db #90, #40, #71, #61, #61, #71, #79, #79, #79, #D3, #79, #68, #79, #79, #92, #61
  db #90, #92, #92, #92, #D3, #79, #E1, #43, #F1, #F0, #F0, #F0, #E1, #A0, #00, #00
  db #00, #44, #39, #1E, #F8, #FC, #FC, #F4, #C3, #E9, #84, #49, #69, #D6, #FC, #E5
  db #96, #96, #96, #1C, #84, #24, #94, #54, #E1, #69, #96, #C3, #69, #69, #69, #28
  db #C3, #3C, #14, #76, #F1, #83, #62, #BE, #69, #F0, #F0, #F0, #F0, #F0, #F8, #FC
  db #AD, #AD, #EC, #40, #61, #61, #24, #88, #00, #00, #00, #00, #41, #C1, #C0, #90
  db #60, #80, #60, #92, #92, #D3, #D3, #D3, #61, #E3, #B6, #E2, #92, #E3, #60, #92
  db #94, #E2, #E3, #61, #61, #E3, #F2, #83, #D2, #F2, #D2, #F0, #F0, #B6, #00, #00
  db #00, #00, #39, #1E, #4B, #FC, #F8, #F9, #D2, #BC, #84, #48, #96, #D6, #FC, #E1
  db #96, #96, #2C, #2C, #68, #18, #48, #54, #C3, #C3, #69, #96, #C3, #96, #C3, #3C
  db #A7, #08, #3C, #AD, #E3, #F6, #28, #3C, #83, #D2, #F0, #F0, #F0, #F0, #F4, #FC
  db #AD, #AD, #22, #00, #C2, #E3, #64, #00, #00, #00, #00, #88, #71, #79, #60, #40
  db #82, #60, #90, #E3, #61, #B6, #E3, #B6, #F2, #E3, #71, #48, #92, #D3, #94, #B2
  db #90, #59, #79, #79, #79, #79, #D3, #C3, #43, #F1, #F0, #F0, #F0, #F1, #04, #00
  db #00, #00, #9C, #1E, #67, #FC, #FC, #E1, #C3, #B4, #84, #48, #96, #D6, #FC, #C3
  db #96, #96, #3C, #1C, #94, #84, #64, #7C, #C3, #69, #96, #C3, #69, #69, #69, #96
  db #96, #08, #39, #E9, #E3, #47, #14, #3C, #D2, #F0, #F0, #F0, #F0, #F0, #F4, #FC
  db #AD, #0F, #28, #00, #90, #92, #82, #00, #00, #00, #44, #40, #79, #68, #C2, #C0
  db #60, #C0, #90, #92, #D3, #D3, #92, #D3, #F1, #D3, #79, #94, #B6, #B2, #C1, #60
  db #90, #90, #B6, #B6, #B2, #B6, #E3, #E3, #F2, #F2, #D2, #F0, #F0, #E1, #20, #00
  db #00, #00, #14, #36, #2D, #FC, #F4, #E1, #C3, #BC, #84, #84, #96, #69, #FC, #C3
  db #3C, #1C, #2C, #2C, #68, #18, #08, #F4, #96, #C3, #69, #69, #96, #96, #96, #C3
  db #36, #14, #7C, #5B, #D3, #B4, #14, #69, #F0, #F0, #F0, #F0, #F0, #F0, #F8, #FC
  db #A5, #B9, #00, #00, #41, #61, #E6, #00, #00, #00, #00, #10, #B6, #B2, #E2, #80
  db #94, #C0, #10, #E3, #E3, #E3, #E3, #F2, #D3, #92, #E2, #C1, #61, #60, #79, #68
  db #C0, #60, #92, #B6, #C1, #61, #61, #E3, #E3, #E3, #43, #F0, #F0, #D2, #E0, #00
  db #00, #00, #00, #36, #99, #FC, #F8, #D3, #D6, #B4, #C0, #0C, #69, #69, #F8, #96
  db #C3, #2C, #3C, #18, #48, #2C, #80, #F8, #C3, #69, #96, #96, #C3, #69, #69, #69
  db #2C, #14, #AD, #C3, #E3, #A8, #1C, #23, #D2, #F0, #F0, #F0, #F0, #F0, #F4, #FC
  db #07, #1B, #00, #00, #40, #92, #82, #00, #00, #00, #88, #61, #71, #68, #61, #C0
  db #90, #C0, #C0, #79, #D3, #D3, #D3, #D3, #D3, #92, #C2, #61, #61, #C0, #D3, #C0
  db #60, #61, #61, #71, #71, #90, #92, #D3, #D3, #D3, #D2, #D2, #F0, #F0, #92, #00
  db #00, #00, #44, #39, #14, #5E, #F8, #C3, #D2, #BC, #C0, #48, #49, #3C, #E1, #69
  db #69, #18, #49, #2C, #24, #94, #14, #E9, #69, #96, #C3, #69, #69, #96, #96, #86
  db #5D, #1C, #FC, #E3, #F2, #28, #3C, #D2, #E1, #F0, #F0, #F0, #F0, #F0, #FC, #F8
  db #D2, #1B, #00, #00, #44, #E3, #60, #00, #00, #00, #00, #92, #92, #D3, #D1, #60
  db #40, #60, #90, #C1, #E3, #E3, #E3, #E3, #E3, #61, #60, #79, #92, #90, #92, #C0
  db #90, #C1, #B6, #A6, #24, #B2, #C1, #61, #E3, #F2, #F2, #D2, #D2, #F0, #E1, #20
  db #00, #00, #00, #39, #04, #5E, #F8, #C3, #F4, #96, #80, #C0, #C1, #69, #96, #96
  db #96, #82, #2C, #2C, #18, #48, #9C, #E9, #96, #C3, #69, #96, #96, #C3, #69, #96
  db #2C, #2D, #F9, #D3, #D6, #04, #39, #43, #F0, #F0, #F0, #F0, #F0, #F0, #FC, #F8
  db #43, #1E, #00, #00, #14, #94, #E2, #00, #00, #44, #10, #61, #B6, #B6, #90, #C2
  db #00, #C2, #C0, #79, #D3, #D3, #D3, #D3, #D3, #92, #C0, #D3, #60, #94, #A6, #C0
  db #60, #30, #D3, #79, #90, #C1, #60, #B2, #D3, #D3, #D3, #F1, #F0, #F0, #70, #82
  db #00, #00, #00, #1C, #00, #27, #E9, #E3, #F8, #96, #80, #48, #94, #49, #69, #69
  db #69, #3C, #1C, #1C, #84, #2C, #54, #E1, #69, #96, #96, #C3, #69, #69, #96, #C2
  db #1C, #7C, #CB, #E3, #96, #14, #63, #83, #D2, #F0, #F0, #F0, #F0, #F0, #FC, #F8
  db #A3, #22, #00, #00, #88, #D9, #68, #00, #00, #00, #41, #61, #61, #B6, #C0, #60
  db #80, #90, #C0, #61, #61, #F2, #E3, #E3, #E3, #71, #C0, #92, #60, #C1, #60, #C0
  db #90, #C1, #61, #E3, #24, #60, #71, #59, #61, #61, #B6, #F2, #D2, #F0, #F1, #B0
  db #00, #00, #00, #11, #00, #2D, #E9, #C3, #F8, #96, #80, #84, #84, #96, #69, #69
  db #69, #2C, #24, #2C, #2C, #94, #54, #C3, #96, #C3, #69, #69, #96, #96, #C3, #68
  db #3C, #5E, #D3, #D3, #A8, #39, #F9, #E1, #F0, #D2, #F0, #F0, #F0, #F4, #FC, #F1
  db #A1, #28, #00, #00, #8C, #AA, #B2, #00, #00, #88, #61, #E3, #E3, #B2, #C0, #90
  db #80, #40, #40, #71, #D3, #D3, #F1, #D3, #92, #A6, #90, #92, #C0, #61, #60, #C0
  db #C0, #60, #92, #D3, #D3, #68, #C0, #60, #C2, #92, #D3, #D3, #E1, #F0, #E1, #43
  db #00, #00, #00, #1C, #88, #11, #E9, #C3, #F8, #68, #40, #40, #48, #96, #96, #96
  db #96, #96, #1C, #1C, #1C, #48, #7C, #96, #C3, #69, #96, #96, #C3, #69, #69, #48
  db #3C, #F8, #D3, #C3, #2C, #7C, #78, #F2, #D2, #F0, #F0, #F0, #F0, #F4, #FC, #A1
  db #43, #00, #00, #44, #D5, #08, #94, #00, #00, #00, #92, #D3, #79, #79, #C0, #40
  db #C0, #00, #C0, #79, #D3, #F1, #D2, #E3, #E3, #71, #41, #B6, #C0, #79, #48, #C0
  db #C0, #30, #E3, #E3, #E1, #B2, #90, #94, #D1, #61, #61, #61, #F2, #83, #D2, #D3
  db #20, #00, #00, #14, #08, #14, #5E, #D6, #F8, #84, #40, #40, #C0, #3C, #49, #69
  db #69, #69, #94, #1C, #1C, #C4, #F0, #C3, #69, #96, #C3, #69, #69, #69, #69, #48
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
  db #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00, #00
; ======================================================================
; END INCLUDE: data/ImageData_linear_chunk_1.asm
; ======================================================================

print "END OF IMAGE DATA", {hex}$