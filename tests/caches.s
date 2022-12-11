        // test cache modeling

        // all caches hold 64 words
        // first cache: direct-mapped, blocksize=1
        .cache  1,64,1,lru,writeback

        // second cache: direct-mapped, blocksize=4
        .cache  4,16,1,lru,writeback

        // third cache: 4-way set-associative, blocksize=4
        .cache  4,4,4,lru,writeback

        // there are 125 instruction fetches, 40 reads,  20 writes

        .text
        mov x10,#100
        
        // outer loop: run inner loop 10 times
loop:
        mov x0,#A
        mov x1,#B
        mov x2,#C
        mov x3,#len
        // inner loop: compute C=A+B for 20-element vectors
1:      ldr w4,[x0],#4
        ldr w5,[x1],#4
        add w6,w4,w5
        str w6,[x2],#4
        sub x3,x3,#1
        cbnz x3,1b

        sub x10,x10,#1
        cbnz x10,loop

        hlt

        .data
A:      .word 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
len = (. - A)/4
B:      .word 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
C:      .word 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19
