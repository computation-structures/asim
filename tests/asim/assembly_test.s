start:  
        mov x1,x2
        mov sp,x3
        mov x4,sp
        mov x5,#-0x8765
        mov x6,#0x12340000
        mov x7,#0xFEDC00000000
        mov x8,#0x7654000000000000
        mov x9,#0xF83FF83FF83FF83F

        sub sp,sp,#16
        add x1,x2,x3,lsl #5
        adds x1,x2,x3,lsr #10
        sub x1,x2,x3,asr #31
        subs x1,x2,x3,lsl #5
        add x1,x2,w3,uxtb
        add x1,x2,w3,uxtb #1
        adds x1,x2,w3,uxth #2
        sub x1,x2,w3,uxtw #3
        subs x1,x2,x3,uxtx #4
        add x1,x2,w3,sxtb
        add x1,x2,w3,sxtb #1
        adds x1,x2,w3,sxth #2
        sub x1,x2,w3,sxtw #3
        subs x1,x2,x3,sxtx #4
        add x1,x2,#4095
        sub x1,x2,#1,LSL #12

        cmn x2,x3,lsl #5
        cmp x2,w3,sxtw #3
        cmp x17,#3
        neg x21,x22
        negs x22,x23,asr #5

        adc x1,x2,x3
        adcs w4,w4,w6
        sbc w7,w8,w9
        sbcs x10,x11,x12
        ngc x23,x24
        ngc w25,w17

        smaddl x1,w2,w3,x4
        smsubl x1,w2,w3,x4
        umaddl x1,w2,w3,x4
        umsubl x1,w2,w3,x4
        smull x1,w2,w3
        smnegl x1,w2,w3
        umull x1,w2,w3
        umnegl x1,w2,w3

        lsl x1,x2,x3
        lsl x4,x5,#42
        lsr x1,x2,x3
        lsr x4,x5,#43
        asr x1,x2,x3
        asr x4,x5,#44
        ror x1,x2,x3
        ror x4,x5,#45

        movk x10,#0xFEDC
        movn x11,#0x1234,lsl #16
        movz x12,#0x7777,lsl #32
        movz x12,#0x8888,lsl #48

        //adr x0,start
        //adrp x1,start

        b start
        bl start
        br x11
        blr x13
        ret x17
        ret

        cbz x17,start+4
        cbnz w12,start+8
        tbz x22, #35, start
        tbnz x25, #17, start

1:      b.eq start
        b.ne 1f
        b.cs start
        b.hs 1b
        b.cc start
        b.lo 1f
        b.mi start
        b.pl 1b
        b.vs start
        b.vc 1f
        b.hi start
        b.ls 1b
        b.ge start
        b.lt 1f
        b.gt start
        b.le 1b
        b.al start
1:      

        ldr     x1,1b
        ldr     w1,start
        ldrsw   x1,1b

        ldur    x1,[x12]
        ldurb   w2,[x13,#255]
        ldurh   w2,[x13,-255]
        ldur    w2,[sp,4]
        ldursb  x3,[sp]
        ldursh  x4,[sp]
        ldursw  x5,[sp,#10]
        stur    x1,[x12]
        sturb   w2,[x13,#255]
        sturh   w2,[x13,-255]
        stur    w2,[sp,4]

        ldr     x1,[x2]
        ldrh    w1,[x3,#4]
        ldrb    w1,[x4,#8]!
        ldr     w1,[x5],#12
        ldrsb   x1,[x6,x7]
        ldrsh   x1,[x8,x9,LSL #1]
        ldrsw   x1,[x10,w11,uxtw]
        str     x1,[x12,w13,sxtw #3]
        strb    w1,[x12,w13,uxtw #0]
        strh    w1,[x12,x13,sxtx #1]
        str     w1,[x12,x13,lsl #2]
        strh    w1,[x3,#4]
        str     w1,[x4,#8]!

//        .include "assembly_test_verify.s"
