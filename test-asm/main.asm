BUILDSNA
BANKSET 0
;
;- Charger et afficher un écran en overscan -
;
;
        ORG #B000
        run #B000

        di
        ld sp, #38
;

        LD HL,TOVERCRT ;Puis passer l'ecran en 92 colonnes 264 lignes
        CALL OUTCRTC ;avec #D0 comme deépart .
;
        CALL AFFSCR;L'afficher .

end
        jr end

;
AFFSCR  LD B, 255  ;264 lignes ca ne tient pas dans un registre 8 bits !
        LD C, 92  ;On procedera en 2 fois .
        LD DE, #D0  ;Adresse de l'ecran
        LD HL, 17000;Adresse de la zone overscan
        CALL .BCLT1 ;Transferer 255 lignes
        LD B, 9 ;Puis les 9 qui manquent pour faire 264

.BCLT1   PUSH DE  ;Preserver adresse écran
        PUSH BC
        LD B, 0
        LDIR  ;Transferer 1 ligne
        POP BC
        POP DE
;
        PUSH HL  ;ADINFUNI est une routine qui a le même effet que
        EX DE,HL  ;ADINF mais calcule le decalage écran pour toute
        CALL ADINFUNI ;adresse de 0 a #FFFF . Autre avantage , lorsque
        LD A, H ;le 1er groupe est depasse (de 0 à #3FFF) H revient
        OR A  ;a 0 ce qui permet de tester rapidement si on doit
        JR NZ, .OKAFF;passer au second groupe en #4000
        LD H, #40
.OKAFF   EX DE, HL
        POP HL
        DJNZ .BCLT1
        RET
;
OUTCRTC LD BC, #BC00;Activation du CRTC
BCLOUTC LD A, (HL)
        CP #FF
        RET Z
OUT (C), C  ;Selection des port #BC00 a #BC12
INC B
OUT (C), A  ;Port BDxx envoyer l'octet voulu .
DEC B  ;Port #BCnn
INC C  ;incremente
INC HL ;Pointer octet CRTC suivant .
JR BCLOUTC
;
ADINFUNI LD A, H  ;Routine ADINF speciale
ADD A, 8
LD H, A
AND #38
RET NZ
;
LD A, H
 SUB #40
LD H, A
LD A, L
ADD A, #5C
LD L, A
RET NC
;
INC H
 LD A, H
AND 7
RET NZ
;
LD A, H
 SUB 8
LD H, A
RET
;

;
;ci-dessous : La 1ere ligne indique les registres du CRTC concernes .
;La seconde les valeurs a envoyer aux registres correspondants pour
;activer l'overscan en #D0 .
;La troisieme les valeurs pour restaurer le CTRC aux normes CPC
;
;  ;0 1 2 3 4 5 6 7 8 9 10 11 12 13
TOVERCRT DB 62,46,48,14,38,00,32,34,00,07,00,00,12,104,#FF


org 17000
; Linear Data created with Pixsaur
; Mode 0 Overscan 
; 192x272 pixels, 96x272 bytes.

pixsaur_data_linear:
 