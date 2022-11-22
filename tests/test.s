        mov x1,#0x2000000
1:      sub x1, x1, #1
        cbnz x1,1b
2:      cbz x1,2b
