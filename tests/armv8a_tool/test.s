        // op Xd,Xn,Xm
        adc x1,x2,x3
        adcs x3,x4,x5
        ngc  x6,x7
        ngcs x8,x9
        madd x1,x2,x3,x4
        mneg x1,x2,x3
        msub x5,x6,x7,x8
        mul x9,x10,x11
        smulh x9,x10,x11
        umulh x9,x10,x11
        sbc x1,x2,x3
        sbcs x3,x4,x5
        sdiv x9,x10,x11
        udiv x9,x10,x11

        asr x1,x2,x3
        asr x1,x2,#29
        lsl x1,x2,x3
        lsl x1,x2,#55
        lsr x1,x2,x3
        lsr x1,x2,#42
        ror x1,x2,x3
        ror x1,x2,#63

        // op Xd,Xn,op2
        add x1,x2,x3
        add x3,x4,x5,LSL #5
        add x6,x7,#1234
        add x8,x9,#4095,LSL #12

        adds x3,x4,x5,LSR #5
        and x10,x11,x12,ASR #33
        ands x10,x11,x12,ROR #57
        bic x10,x11,x12
        bics x10,x11,x12
        eon x10,x11,x12
        eor x10,x11,x12
        orn x10,x11,x12
        orr x10,x11,x12
        tst x1,x2

        and x15,x16,#0x003FFFF8003FFFF8
        eor x17,x18,#0x0FFFFFFFFFFFFFF0
        orr x19,x20,#0x0C000C000C000C00
        tst x21,#0xFEFEFEFEFEFEFEFE
        and x23,x24,#0x6666666666666666
        eor x23,x24,#0xAAAAAAAAAAAAAAAA
