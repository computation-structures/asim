                                // Mac M1 assembler output
        // op Xd,Xn,Xm
        adc x1,x2,x3            // 9a030041
        adcs x3,x4,x5           // ba050083
        ngc  x6,x7              // da0703e6
        ngcs x8,x9              // fa0903e8
        madd x1,x2,x3,x4        // 9b031041
        mneg x1,x2,x3           // 9b03fc41
        msub x5,x6,x7,x8        // 9b07a0c5
        mul x9,x10,x11          // 9b0b7d49
        smulh x9,x10,x11        // 9b4b7d49
        umulh x9,x10,x11        // 9bcb7d49
        sbc x1,x2,x3            // da030041
        sbcs x3,x4,x5           // fa050083
        sdiv x9,x10,x11         // 9acb0d49
        udiv x9,x10,x11         // 9acb0949

        asr x1,x2,x3            // 9ac32841 
        asr x1,x2,#29           // 935dfc41 **
        lsl x1,x2,x3            // 9ac32041 
        lsl x1,x2,#55           // d3492041 **
        lsr x1,x2,x3            // 9ac32441
        lsr x1,x2,#42           // d36afc41 **
        ror x1,x2,x3            // 9ac32c41
        ror x1,x2,#63           // 93c2fcf1 **

        // op Xd,Xn,op2
        add x1,x2,x3            // 8b030041
        add x3,x4,x5,LSL #5     // 8b051483
        add x6,x7,#1234         // 911348e6
        add x8,x9,#4095,LSL #12 // 917ffd28

        adds x3,x4,x5,LSR #5    // ab451483
        and x10,x11,x12,ASR #33 // 8a8c856a
        ands x10,x11,x12,ROR #57 // eacce56a
        bic x10,x11,x12         // 8a2c016a
        bics x10,x11,x12        // ea2c016a
        eon x10,x11,x12         // ca2c016a
        eor x10,x11,x12         // ca0c016a
        orn x10,x11,x12         // aa2c016a
        orr x10,x11,x12         // aa0c016a
        tst x1,x2               // ea02003f

        and x15,x16,#0x003FFFF8003FFFF8 // 921d4a0f
        eor x17,x18,#0x0FFFFFFFFFFFFFF0 // d27cde51
        orr x19,x20,#0x0C000C000C000C00 // b2068693
        tst x21,#0xFEFEFEFEFEFEFEFE     // f207dabf
        and x23,x24,#0x6666666666666666 // 9203e717
        eor x23,x24,#0xAAAAAAAAAAAAAAAA // d201f317

        ldur x10,[x11]          // f8400016
        ldur x12,[x13,#-256]    // f85001ac
        ldurb w14,[x15]         // 384001ee
        ldurh w14,[x15]         // 784001ee
        ldur w14,[x15]          // b84001ee
        ldursb x14,[x15]        // 38800133
        ldursh x14,[x15]        // 78800133
        ldursw x14,[x15]        // b84001ee  **?
