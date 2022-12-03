// read-only test-jig for strlen.s

        .text
        .global strlen

        mov x0,#string  // pointer to test string
        bl strlen       // call strlen subroutine, answer in x0
        hlt #0          // simulator will halt here...

        .data
dummy:  .asciz "Foobar"
string: .asciz "Hi there!\n"
