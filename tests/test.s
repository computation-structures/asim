        mov w1, #0x1
        mov w2, #0xDEADBEEF
        mov w3, #0x80000000
        mov w4, #0x7FFFFFFF
        mov w5, #0xFFFFFFFF
        subs w10,w1,w1   // n=0, z=1, v=0 [c=1]
        subs w11,w1,w2   // n=0, z=0, v=0 [c=0]
        subs w12,w3,w1   // n=0, z=0, v=1 [c=1]
        subs w13,w2,w1   // n=1, z=0, v=0 [c=1]
        subs w14,w4,w5   // n=1, z=0, v=1 [c=0]
