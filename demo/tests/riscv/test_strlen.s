        .text   
        addi a0,zero,string
        jalr ra,strlen
1:      beq zero,zero,1b

        .data
dummy:  .asciz "Foobar"
string: .asciz "Hi there!"

        # test expression evaluation
        .word 0 != 0
        .word 17 == (3 * 4 + 5)
        .word 7 & 0x12
        .word 1 | 2
        .word 15 ^ (8 + 2 + 1)

        .text
