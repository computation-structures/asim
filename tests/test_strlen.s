// read-only test-jig for strlen.s

        .text
        .global strlen

        mov x0,#string  // pointer to test string
        bl strlen       // call strlen subroutine, answer in x0
        adr x1,#answer  // save result in answer
        stur w0,[x1]
        nop
        nop
        hlt #0         // simulator will halt here...

.mverify answer,0xa    // expect answer == 10

        .data
answer: .word 0
string: .asciz "Hi there!\n"
        .word 0
        .text
