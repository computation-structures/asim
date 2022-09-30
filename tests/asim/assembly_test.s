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
        add x1,x2,x3,lsr #10
        add x1,x2,x3,asr #31
        
