        .macro expect reg,value
        ldr x30,2f
        .data
        .align 3
2:      .dword \value
        .text
        sub x30,\reg,x30
        cbz x30,1f
        bl fail
1:
        .endm

        .data
        .align 3
c0001:  .dword 0x11223344FFEEDDCC
c0002:  .dword 0xFFFFFFFFFFFFFFFF
c0003:  .dword 0xAAAAAAAAAAAAAAAA
c0004:  .dword 0x5555555555555555
c0005:  .word 5
c0006:  .word 6
c0007:  .word 7
c0008:  .word 8
c0009:  .word 0x789ABCDE
        .text

        b 1f
fail:   hlt     // if stopped here, failing test addr is in X30

        // load useful constants
1:      mov x0, #0             
        ldr x1,c0001
        ldr x2,c0002
        ldr x3,c0003
        ldr x4,c0004
        ldr w5,c0005
        ldr w6,c0006
        ldr w7,c0007
        ldr w8,c0008
        ldr w9,c0009

        // check NZCV flags and b.cc
        cmp x1,x1   // set Z and C flags
        b.eq 1f     // z=1
        bl fail
1:      b.cs 1f     // c=1
        bl fail
1:      b.pl 1f     // n=0
        bl fail
1:      b.vc 1f     // v=0
        bl fail
1:      b.ls 1f     // c & !z
        bl fail
1:      adds wzr,w9,w9  // set N and V flags
        b.mi 1f     // n=1
        bl fail
1:      b.vs 1f     // v=1
        bl fail
1:      b.ne 1f     // z=0
        bl fail
1:      b.cc 1f     // c=0
        bl fail
1:      b.gt 1f     // !z & n==v
        bl fail
1:      b.ls 1f     // !c | z
        bl fail
1:      b.al 1f
        bl fail
1:      

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

        hlt

        // check that move works...
1:      mov x0,#1
        expect x0,1

        // ADC, ADCS
        mov x0,#0x500000000
        subs x1,x0,#1   // set C flag (subtraction with no borrow)
        adc x2,x0,x1
        expect x2,0xA00000000
        adc w2,w0,w1
        expect x2,0
        adcs x2,x0,x1
        mrs x0, nzcv
        expect x0,0

        // ADD (extended register)
        ldr x0,c0001
        mov x1,#5
        add w2,w1,w0
        expect x2,0xFFEEDDD1
        add w2,w1,w0,uxtb
        expect x2,0xD1

        hlt
