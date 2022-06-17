        .text   
        addi a0,zero,string
        jalr ra,strlen
1:      beq zero,zero,1b

        .data
dummy:  .asciz "Foobar"
string: .asciz "Hi there!"
        .text
