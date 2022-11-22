        add x1, x1, #1
        lsl x1, x1, #24
1:      sub x1, x1, #1
        cbnz x1,1b
2:      cbz x1,2b
