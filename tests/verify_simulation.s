        // Rudimentary tests to verify each opcode simulates as expected

        // Success if simulation stops at HLT #0 instruction
        // Error if simulation stops at HLT #1 instruction

        b .+8
        hlt #1

        //////////////////////////////////////////////////
        // check b.cc
        //////////////////////////////////////////////////

        .macro btest branch,nobranch
        \branch .+8; hlt #1; \nobranch .+8; b .+8; hlt #1
        .endm

        movz x10,#0x8000,lsl #16; msr nzcv,x10    // set N flag
        btest b.ne, b.eq
        btest b.cc, b.cs
        btest b.mi, b.pl
        btest b.vc, b.vs
        btest b.ls, b.hi
        btest b.lt, b.ge
        btest b.le, b.gt
        btest b.al, b.nv

        movz x10,#0x4000,lsl #16; msr nzcv,x10    // set Z flag
        btest b.eq, b.ne
        btest b.cc, b.cs
        btest b.pl, b.mi
        btest b.vc, b.vs
        btest b.ls, b.hi
        btest b.ge, b.lt
        btest b.le, b.gt
        btest b.al, b.nv

        movz x10,#0x2000,lsl #16; msr nzcv,x10    // set C flag
        btest b.ne, b.eq
        btest b.cs, b.cc
        btest b.pl, b.mi
        btest b.vc, b.vs
        btest b.hi, b.ls
        btest b.ge, b.lt
        btest b.gt, b.le
        btest b.al, b.nv

        movz x10,#0x1000,lsl #16; msr nzcv,x10    // set V flag
        btest b.ne, b.eq
        btest b.cc, b.cs
        btest b.pl, b.mi
        btest b.vs, b.vc
        btest b.ls, b.hi
        btest b.lt, b.ge
        btest b.le, b.gt
        btest b.al, b.nv
        
        .data
        // some useful constants
        .align 3
c0001:  .dword 0x11223344FFEEDDCC
c0002:  .dword 0xFFFFFFFFFFFFFFFF
c0003:  .dword 0xAAAAAAAAAAAAAAAA
c0004:  .dword 0x5555555555555555
c0005:  .word 5
c0006:  .word 6
c0007:  .word 7
c0008:  .word 0x87654321
c0009:  .word 0x789ABCDE
        .align 3
c0010:  .dword 0x0000FFFF0000FFFF
c0011:  .dword 0xFFFFFFFF00000000

starget: .dword 0
        .text

        // load useful constants
        mov x0, #0             
        ldr x1,c0001
        ldr x2,c0002
        ldr x3,c0003
        ldr x4,c0004
        ldr w5,c0005
        ldr w6,c0006
        ldr w7,c0007
        ldrsw x8,c0008
        ldr w9,c0009

        .macro expect reg,value
        ldr x30,1f
        .data
        .align 3
1:      .dword \value
        .text
        sub x30,\reg,x30
        cbz x30,.+8
        hlt #1
        .endm

        //////////////////////////////////////////////////
        // check OP2 operand
        //////////////////////////////////////////////////

        add x10,x0,x1
        expect x10,0x11223344FFEEDDCC
        add x10,x0,x1,LSL #8
        expect x10,0x223344FFEEDDCC00
        add x10,x0,x1,LSR #4
        expect x10,0x011223344FFEEDDC
        add x10,x0,x8,ASR #16
        expect x10,0xFFFFFFFFFFFF8765
        orr x10,x0,x1,ROR #12
        expect x10,0xDCC11223344FFEED
        add x10,x0,w1,uxtb
        expect x10,0xCC
        add x10,x0,w1,uxth #4
        expect x10,0xDDCC0
        add x10,x0,w1,uxtw #2
        expect x10,(0xFFEEDDCC << 2)
        add x10,x0,x1,uxtx #2
        expect x10,(0x11223344FFEEDDCC << 2)
        add x10,x0,w1,sxtb
        expect x10,0xFFFFFFFFFFFFFFCC
        add x10,x0,w1,sxth #4
        expect x10,0xFFFFFFFFFFFDDCC0
        add x10,x0,w1,sxtw #2
        expect x10,(0xFFFFFFFFFFEEDDCC << 2)
        add x10,x0,x1,sxtx #2
        expect x10,(0x11223344FFEEDDCC << 2)
        add x10,x0,#0x234
        expect x10,0x234
        add x10,x0,#0x234,lsl #12
        expect x10,0x234000
        orr x10,x0,#0x007FFC00007FFC00
        expect x10,0x007FFC00007FFC00

        //////////////////////////////////////////////////
        // check arithmetic
        //////////////////////////////////////////////////

        // check add, sub, adc, sbc, neg, ngc
        add x10,x3,x4
        expect x10,-1
        add w10,w1,w2
        expect x10,0xFFEEDDCB
        sub x10,x1,x2
        expect x10,0x11223344FFEEDDCD
        sub w10,w4,w3
        expect x10,0xAAAAAAAB
        subs x10,x1,#1   // set C flag (subtraction with no borrow)
        adc x10,x2,xzr
        expect x10,0
        adc w10,w3,w3
        expect x10,0x55555555
        sbc x10,x2,xzr
        expect x10,-1
        sbc w10,w3,w3
        expect x10,0
        negs x10,x6     // clear C flag
        expect x10,-6
        ngc x10,x6
        expect x10,-7

        // check multiply-add
        madd x10,x5,x6,x7
        expect x10,37
        madd w10,w1,w2,w3
        expect x10,0xAABBCCDE
        mneg x10,x7,x6
        expect x10,-42
        mneg w10,w3,w4
        expect x10,0x8E38E38E
        msub x10,x1,x2,x3
        expect x10,0xbbccddefaa998876
        msub w10,w3,w4,w1
        expect x10,0x8E27C15A
        mul x10,x5,x7
        expect x10,35
        mul w10,w9,w1
        expect x10,0x68BE26E8
        smaddl x10,w1,w2,xzr
        expect x10,0x112234
        smnegl x10,w4,w2
        expect x10,0x55555555
        smsubl x10,w8,w9,x7
        expect x10,0x38d16e985f098d69
        smulh x10,x3,x4
        expect x10,0xe38e38e38e38e38e
        smull x10,w8,w9
        expect x10,0xc72e9167a0f6729e
        umaddl x10,w1,w2,xzr
        expect x10,0xffeeddcb00112234
        umnegl x10,w4,w2
        expect x10,0xaaaaaaab55555555
        umsubl x10,w8,w9,x7
        expect x10,0xc036b1ba5f098d69
        umulh x10,x1,x1
        expect x10,0x01258f60d296457a
        umull x10,w8,w9
        expect x10,0x3fc94e45a0f6729e

        // division
        sdiv x10,x3,x8
        expect x10,0xb521cfb2
        udiv x10,x3,x8
        expect x10,0x0
        sdiv x10,x3,x9
        expect x10,0xffffffff4ade304c
        udiv x10,x3,x9
        expect x10,0x16a439f68
        
        //////////////////////////////////////////////////
        // check logical
        //////////////////////////////////////////////////

        // boolean
        ldr x11,c0010
        ldr x12,c0011
        and x10,x11,x12
        expect x10,0x0000FFFF00000000
        bic x10,x11,x12
        expect x10,0x000000000000FFFF
        orr x10,x11,x12
        expect x10,0xFFFFFFFF0000FFFF
        orn x10,x11,x12
        expect x10,0x0000FFFFFFFFFFFF
        eor x10,x11,x12
        expect x10,0xFFFF00000000FFFF
        eon x10,x11,x12
        expect x10,0x0000FFFFFFFF0000

        // shift
        mov x11,#12
        asr x10,x8,x11
        expect x10,0xFFFFFFFFFFF87654
        asr x10,x8,#4
        expect x10,0xFFFFFFFFF8765432
        lsl x10,x1,x11
        expect x10,0x23344FFEEDDCC000
        lsl x10,x1,#4
        expect x10,0x1223344FFEEDDCC0
        lsr x10,x1,x11
        expect x10,0x00011223344FFEED
        lsr x10,x1,#4
        expect x10,0x011223344FFEEDDC
        ror x10,x1,x11
        expect x10,0xDCC11223344FFEED
        ror x10,x1,#4
        expect x10,0xC11223344FFEEDDC

        // movk, movn, movz
        mov x10,x1
        movk x10,#0x5463
        expect x10,0x11223344FFEE5463
        movn x10,#0x5463,LSL #16
        expect x10,~(0x5463 << 16)
        movz x10,#0x5463,LSL #32
        expect x10,0x0000546300000000
        mov w10,w1
        movk w10,#0x5463
        expect x10,0xFFEE5463
        movn w10,#0x5463,LSL #16
        expect x10,0xAB9CFFFF
        movz w10,#0x1234,LSL #16
        expect x10,0x12340000

        // bit manipulation
        rbit x10,x1
        expect x10,0x33bb77ff22cc4488
        rev x10,x1
        expect x10,0xCCDDEEFF44332211
        rev16 x10,x1
        expect x10,0X22114433EEFFCCDD
        rev32 x10,x1
        expect x10,0X44332211CCDDEEFF
        cls x10,x2
        expect x10,63
        cls x10,x8
        expect x10,32
        clz x10,x2
        expect x10,0
        clz x10,x7
        expect x10,61
        cls w10,w2
        expect x10,31
        cls w10,w8
        expect x10,0
        clz w10,w2
        expect x10,0
        clz w10,w7
        expect x10,29

        // bit fields
        mov x10,x1
        bfm x10,x1,#16,#7
        expect x10,0x11CC3344FFEEDDCC
        mov x10,x1
        sbfm x10,x1,#16,#7
        expect x10,0xFFCC000000000000
        mov x10,x1
        ubfm x10,x1,#16,#7
        expect x10,0x00CC000000000000

        mov x10,x1
        bfm x10,x1,#24,#31
        expect x10,0x11223344FFEEDDFF
        mov x10,x1
        sbfm x10,x1,#24,#31
        expect x10,0xFFFFFFFFFFFFFFFF
        mov x10,x1
        ubfm x10,x1,#24,#31
        expect x10,0x00000000000000FF

        //////////////////////////////////////////////////
        // LD
        //////////////////////////////////////////////////

        mov x12,#c0001

        ldrb w10,[x12]
        expect x10,0xCC
        ldrh w10,[x12]
        expect x10,0xDDCC
        ldr w10,[x12]
        expect x10,0xFFEEDDCC
        ldr x10,[x12]
        expect x10,0x11223344FFEEDDCC

        ldrsb w10,[x12]
        expect x10,0xFFFFFFCC
        ldrsh w10,[x12]
        expect x10,0xFFFFDDCC
        ldrsw x10,[x12]
        expect x10,0xFFFFFFFFFFEEDDCC

        ldrb w10,[x12,#1]
        expect x10,0xDD
        ldrh w10,[x12,#2]
        expect x10,0xFFEE
        ldr w10,[x12,#4]
        expect x10,0x11223344
        ldr x10,[x12,#8]
        expect x10,0xFFFFFFFFFFFFFFFF

        mov x13,x12
        ldrh w10,[x13],#2
        expect x10,0xDDCC
        expect x13,(c0001 + 2)

        mov x13,x12
        ldrh w10,[x13,#2]!
        expect x10,0xFFEE
        expect x13,(c0001 + 2)

        mov x13,#2
        ldrh w10,[x12,x13]
        expect x10,0xFFEE
        ldrh w10,[x12,x13,lsl #1]
        expect x10,0x3344
        ldrh w10,[x12,w13,sxtw #1]
        expect x10,0x3344
        ldrh w10,[x12,x13,sxtx #1]
        expect x10,0x3344
        
        //////////////////////////////////////////////////
        // ST
        //////////////////////////////////////////////////

        mov x12,#starget
        str x2,[x12]
        ldr x10,[x12]
        expect x10,-1
        strb w1,[x12,#1]
        ldr x10,[x12]
        expect x10,0xFFFFFFFFFFFFCCFF
        strh w1,[x12,#2]
        ldr x10,[x12]
        expect x10,0xFFFFFFFFDDCCCCFF

        mov x12,#starget+8
        stur x2,[x12,-8]
        ldur x10,[x12,-8]
        expect x10,-1
        sturb w1,[x12,-1]
        ldur x10,[x12,-8]
        expect x10,0xCCFFFFFFFFFFFFFF
        sturh w1,[x12,-4]
        ldur x10,[x12,-8]
        expect x10,0xCCFFDDCCFFFFFFFF
        
        hlt #0          // success!
