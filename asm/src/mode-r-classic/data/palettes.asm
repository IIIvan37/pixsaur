
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

	ld	hl,ModeR_PaletteA_Hardware		;; set scr palette
	call setPalette

mainLoop
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

p1  ld hl, ModeR_PaletteA_Hardware
p2  ld de, ModeR_PaletteB_Hardware
    ex hl, de
	ld (p1 + 1), hl
    ld (p2 + 1), de
    call setPalette
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

ModeR_PaletteA_Hardware:
    db #54  ; Ink 0
    db #4E  ; Ink 1
    db #5C  ; Ink 2
    db #40  ; Ink 3
    db #58  ; Ink 4
    db #43  ; Ink 5
    db #4B  ; Ink 6
    db #47  ; Ink 7
    db #44  ; Ink 8
    db #5F  ; Ink 9
    db #4A  ; Ink 10
    db #4C  ; Ink 11
    db #5B  ; Ink 12
    db #5E  ; Ink 13
    db #55  ; Ink 14
    db #5D  ; Ink 15

ModeR_PaletteB_Hardware:
    db #54  ; Ink 0
    db #4B  ; Ink 1
    db #52  ; Ink 2
    db #4D  ; Ink 3
    db #57  ; Ink 4
    db #4E  ; Ink 5
    db #40  ; Ink 6
    db #55  ; Ink 7
    db #58  ; Ink 8
    db #4C  ; Ink 9
    db #56  ; Ink 10
    db #53  ; Ink 11
    db #59  ; Ink 12
    db #4F  ; Ink 13
    db #4A  ; Ink 14
    db #44  ; Ink 15

border		db	#54


org #4000
include 'frame1.asm'
org #c000
include 'frame2.asm'

