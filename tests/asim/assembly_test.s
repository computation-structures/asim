        mov x1,x2
        mov sp,x3
        mov x4,sp
        mov x5,#-0x8765
        mov x6,#0x12340000
        mov x7,#0xFEDC00000000
        mov x8,#0x7654000000000000
        mov x9,#0xF83FF83FF83FF83F

        add x1,x2,x3
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

//        .include "assembly_test_verify.s"
