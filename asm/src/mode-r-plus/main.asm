
BULD SNA
BANKSET 0
SNASET CRTC_TYPE, 3
SNASET CPC_TYPE, 4

MACRO	WAIT_CYCLES _cycles

@loops		equ	({_cycles}-1)/4           
@loopsx4	equ	@loops*4
          
@nops		equ	{_cycles}-@loopsx4-1

	ld	b,@loops
@change_waitLoop
	djnz	@change_waitLoop
    print @nops
	defs	@nops

MEND

	ORG	#8000
    RUN #8000
start
	di

	ld	bc,#7f8c + 0		;; set scr mode 0
	out	(c),c

	call Asic_unlock
    call Asic_activate  


    
    ;; Palette colors at offset 2002-2033 (16 colors × 2 bytes = 32 bytes)
    ld hl, ModeR_PaletteA     ; Source: palette data in SCR
    ld de, #6400            ; Dest: Pen 0 register
    ld bc, 32               ; 16 colors × 2 bytes
    ldir                    ; Copy all palette colors

mainLoop
    call Asic_deactivate
	call	wVb

	ld	bc,#bc0c		;; video page switch (#c000 / #4000)
	out	(c),c
	inc	b
	ld	a,(CRTCReg12)
	out	(c),a
	xor	#20
	ld	(CRTCReg12),a

	ld	a,(topScanlines)	;; wait scanlines
	ld	c,a
	xor	1
	ld	(topScanlines),a
	ld	b,0	
	call	waitScanlines

	WAIT_CYCLES	34

	ld	bc,#bc02		;; select CRTC reg 2
	out	(c),c

	ld	d,222/2
rasterLoop
	ld	bc,#bd2d
	out	(c),c

	WAIT_CYCLES	64-7

	ld	bc,#bd2f
	out	(c),c

	WAIT_CYCLES	64-7-4

	dec	d
	jr	nz, rasterLoop

    call Asic_activate
p1  ld hl, ModeR_PaletteB
p2  ld de, ModeR_PaletteA
    ex hl, de
	ld (p1 + 1), hl
    ld (p2 + 1), de
    ld de, #6400          ; Dest: Pen 0 register
    ld bc, 32               ; 16 colors × 2 bytes
    ldir                    ; Copy all palette colors
    jr	mainLoop

	;; Set Palette

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

	;; Wait vertical blank

wVb
	ld 	b,#f5
vbLoop1
	in 	a,(c)
        rra
        jr 	c, vbLoop1
vbLoop2
	in 	a,(c)
        rra
        jr 	nc, vbLoop2
	ret

	;; Wait BC scanlines
	
waitScanlines
	ld	a,b				; 1c
	or	c				; 1c
	ret	z				; 2/4c

	push	bc				; 4c
	WAIT_CYCLES 	40
	pop	bc				; 3c
	dec	bc				; 2c
	ld	a,b				; 1c
	or	c				; 1c
	ret	z				; 2/4c
						; 	57c
waitScanlines_loop
	push	bc				; 4c
	WAIT_CYCLES 	50
	pop	bc				; 3c
	dec	bc				; 2c
	ld	a,b				; 1c
	or	c				; 1c
	jr	nz, waitScanlines_loop		; 2/3c

	ret					; 3c

	;; Data

topScanlines	db	51
CRTCReg12	db	#30
; ========== HARDWARE CODES (Gate Array) ==========
include 'data/palettes.asm'

border		db	#54
include '../common/plus.asm'

org #4000
include 'data/frame-1.asm'
org #c000
include 'data/frame-2.asm'
