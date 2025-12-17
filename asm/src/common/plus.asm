module Asic
;; Unlock ASIC (sequence of 17 bytes to port #BC00)
unlock
    di
    ld e, 17                ; 17 bytes to send
    ld hl, unlock_seq
    ld bc, #bc00
.loop:
    ld a, (hl)
    out (c), a
    inc hl
    dec e
    jr nz, .loop
    ret

activate
    ;; Activate CPC Plus functions
    ld bc, #7fb8
    out (c), c
    ret

;; ASIC unlock sequence (17 bytes)
unlock_seq:
    defb 255, 0, 255, 119, 179
    defb 81, 168, 212, 98, 57, 156
    defb 70, 43, 21, 138, 205, 238

module off