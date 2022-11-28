// read-only test-jig for strlen.s

        .text
        .global strlen
        adr x0,string   // pointer test string
        bl strlen       // call strlen subroutine, answer in x0
        b .             // simulator will halt here...

        .data
dummy:  .asciz "Foobar"
string: .asciz "Hi there!"
