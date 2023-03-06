        mov x0,#0x800000
1:
        subs x0,x0,#1
        b.ne 1b
        nop
        nop
        hlt #0
        
