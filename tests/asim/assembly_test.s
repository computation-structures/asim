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

        b.eq start
        b.ne 1f
        b.cs start
        b.hs 1f
        b.cc start
        b.lo 1f
        b.mi start
        b.pl 1f
        b.vs start
        b.vc 1f
        b.hi start
        b.ls 1f
        b.ge start
        b.lt 1f
        b.gt start
        b.le 1f
        b.al start
1:      

//        .include "assembly_test_verify.s"
