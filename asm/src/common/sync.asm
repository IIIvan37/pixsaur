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