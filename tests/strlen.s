.include "test_strlen.s"        // include test-jig source file

        .text
        .global strlen
strlen:                         // pointer to string in x0
        add x9, x0, #1          // remember starting value of pointer + 1
1:      ldrb w10,[x0],#1        // load unsigned byte from string, increment pointer
        cbnz w10,1b             // if it's not zero, keep looking!
        sub x0,x0,x9            // compute how much pointer changed

        // busy loop to test simulator's instructions/second
        mov x12,#0x2000000
1:      sub x12,x12,#1
        cbnz x12,1b

        ret                     // return to caller
