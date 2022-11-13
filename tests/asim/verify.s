start:
    adc X29, X21, X24
    adc W10, W0, W27

    adcs X1, X15, X24
    adcs W9, W11, W7

    add X20, X26, X17
    add SP, X27, X8
    add X1, SP, X29
    add X6, X9, X27, LSL #63
    add X21, X13, X13, LSR #61
    add X15, X19, X8, ASR #40
    add X9, X27, W16, SXTB #1
    add X28, X15, W28, UXTB #2
    add X15, X20, W26, SXTH #0
    add X14, X28, W9, UXTH #1
    add X24, X3, W21, SXTW #0
    add X11, X25, W2, UXTW #3
    add X10, X23, X0, SXTX #1
    add X18, X2, X6, UXTX #2
    add X25, X8, #1239
    add X9, X1, #1747, LSL #12
    add W25, W8, W16
    add WSP, W18, W15
    add W16, WSP, W1
    add W4, W17, W5, LSL #2
    add W11, W24, W30, LSR #31
    add W25, W29, W12, ASR #11
    add W11, W18, W14, SXTB #1
    add W22, W10, W26, UXTB #0
    add W3, W8, W19, SXTH #0
    add W16, W28, W17, UXTH #3
    add W21, W18, W26, SXTW #0
    add W0, W20, W12, UXTW #2
    add W26, W15, #2218
    add W11, W28, #1738, LSL #12

    adds X13, X13, X0
    adds X13, SP, X14
    adds X19, X14, X1, LSL #31
    adds X11, X19, X17, LSR #42
    adds X28, X19, X19, ASR #60
    adds X29, X22, W7, SXTB #0
    adds X23, X3, W14, UXTB #1
    adds X1, X2, W9, SXTH #3
    adds X14, X13, W3, UXTH #0
    adds X1, X26, W1, SXTW #3
    adds X20, X20, W27, UXTW #3
    adds X3, X21, XZR, SXTX #0
    adds X23, X11, X15, UXTX #1
    adds X21, X3, #3931
    adds X24, X7, #3975, LSL #12
    adds W18, W19, W24
    adds W8, WSP, W27
    adds W24, W7, W9, LSL #10
    adds W22, W4, W1, LSR #8
    adds W19, W15, W9, ASR #24
    adds W13, WSP, W22, SXTB #3
    adds W24, W1, W13, UXTB #1
    adds W7, W16, WZR, SXTH #0
    adds W7, W19, W8, UXTH #2
    adds W27, W17, W30, SXTW #3
    adds W13, W15, W8, UXTW #1
    adds W5, W17, #1262
    adds W26, W27, #2980, LSL #12

    cmn X19, X28
    cmn SP, X19
    cmn X0, X18, LSL #35
    cmn XZR, X3, LSR #10
    cmn X1, XZR, ASR #45
    cmn X16, W17, SXTB #2
    cmn X30, W26, UXTB #0
    cmn X28, W28, SXTH #3
    cmn X20, W25, UXTH #1
    cmn X5, W17, SXTW #2
    cmn X10, W1, UXTW #1
    cmn X11, X11, SXTX #2
    cmn X8, X4, UXTX #0
    cmn X18, #3251
    cmn X3, #2782, LSL #12
    cmn W25, W13
    cmn WSP, W5
    cmn W9, W30, LSL #29
    cmn W27, W1, LSR #21
    cmn W6, W20, ASR #13
    cmn W19, W6, SXTB #1
    cmn W29, W13, UXTB #2
    cmn W2, W16, SXTH #0
    cmn W21, W16, UXTH #1
    cmn W17, W14, SXTW #3
    cmn W16, W0, UXTW #0
    cmn W23, #141
    cmn W15, #128, LSL #12

    cmp X14, X10
    cmp SP, X16
    cmp X25, X16, LSL #44
    cmp X26, X24, LSR #14
    cmp X27, X9, ASR #22
    cmp X7, W8, SXTB #0
    cmp X2, W15, UXTB #3
    cmp X1, W6, SXTH #2
    cmp X10, W17, UXTH #1
    cmp X17, W4, SXTW #2
    cmp X20, W6, UXTW #3
    cmp X21, X15, SXTX #0
    cmp X7, X0, UXTX #2
    cmp X11, #2209
    cmp X2, #3565, LSL #12
    cmp W13, W16
    cmp WSP, W27
    cmp W19, W2, LSL #23
    cmp W23, W13, LSR #23
    cmp W0, W21, ASR #15
    cmp W2, W5, SXTB #2
    cmp W8, W17, UXTB #2
    cmp W2, W19, SXTH #0
    cmp W28, W13, UXTH #1
    cmp W6, W17, SXTW #1
    cmp W9, W9, UXTW #1
    cmp W26, #2215
    cmp W2, #353, LSL #12

    madd X27, X26, X26, X15
    madd W30, W11, W15, W27

    mneg X2, X17, X18
    mneg WZR, WZR, W27

    msub X15, X19, X15, X25
    msub W19, W27, W23, W13

    mul X30, X21, X1
    mul W16, W24, W23

    neg X28, X8
    neg X14, X0, LSL #10
    neg X24, X26, LSR #29
    neg X28, X6, ASR #7
    neg W13, W15
    neg W30, W10, LSL #11
    neg W26, W15, LSR #18
    neg W3, W18, ASR #0

    negs X14, X30
    negs X22, XZR, LSL #4
    negs X9, X19, LSR #6
    negs X29, X8, ASR #58
    negs W9, W21
    negs W18, W14, LSL #1
    negs W30, W9, LSR #20
    negs W22, W26, ASR #1

    ngc X1, X28
    ngc W24, W19

    ngc X9, X2
    ngc W10, W3

    sbc X20, X15, X23
    sbc W23, W28, W25

    sbcs X30, X11, XZR
    sbcs W28, W9, W10

    sdiv X2, X7, X11
    sdiv W18, W5, W26

    smulh X14, X10, X29

    sub SP, X6, X10
    sub SP, X7, X13
    sub X13, SP, X27
    sub X10, X29, X2, LSL #20
    sub X8, X8, X25, LSR #23
    sub X12, X27, X18, ASR #27
    sub X22, X26, W9, SXTB #3
    sub SP, X3, W3, UXTB #2
    sub X29, X28, W9, SXTH #2
    sub X19, X4, WZR, UXTH #2
    sub X22, X4, W20, SXTW #0
    sub X5, X4, W19, UXTW #1
    sub SP, X13, X6, SXTX #3
    sub X25, X7, X16, UXTX #2
    sub X22, X29, #1295
    sub X22, X2, #2986, LSL #12
    sub W24, W11, W7
    sub WSP, W6, W17
    sub W1, WSP, W28
    sub W13, W22, W11, LSL #8
    sub W9, W11, W14, LSR #28
    sub W11, W10, W5, ASR #16
    sub W6, W0, WZR, SXTB #2
    sub W0, W16, W13, UXTB #3
    sub W25, W21, W2, SXTH #0
    sub W4, W26, W3, UXTH #2
    sub W2, W19, W25, SXTW #2
    sub W29, W2, W22, UXTW #0
    sub WSP, W2, #3978
    sub W29, W11, #2860, LSL #12

    subs X0, X26, X26
    subs X19, SP, X30
    subs X23, X18, XZR, LSL #9
    subs X17, X19, X29, LSR #45
    subs X11, X5, X7, ASR #46
    subs X15, X19, W20, SXTB #0
    subs X6, X3, W20, UXTB #0
    subs X14, X26, W26, SXTH #3
    subs X14, X14, W24, UXTH #0
    subs X3, X19, W19, SXTW #3
    subs X14, X7, W20, UXTW #0
    subs X22, X20, X25, SXTX #3
    subs X10, X19, X21, UXTX #2
    subs X10, X2, #1861
    subs X18, X17, #1579, LSL #12
    subs W27, W22, W15
    subs W20, WSP, W4
    subs W30, W0, W4, LSL #16
    subs W17, W8, W3, LSR #25
    subs W26, W29, W24, ASR #8
    subs W27, W25, W16, SXTB #1
    subs W15, W8, W23, UXTB #0
    subs W27, W9, W8, SXTH #0
    subs W2, W29, W21, UXTH #0
    subs W25, W6, W4, SXTW #3
    subs W21, W24, W5, UXTW #0
    subs W21, W5, #1455
    subs W27, W25, #2925, LSL #12

    udiv X24, X11, X17
    udiv W30, W6, W19

    umulh X11, X1, XZR

end:

.averify 0x00000000,0x9a1802bd,0x1a1b000a,0xba1801e1,0x3a070169
.averify 0x00000010,0x8b110354,0x8b28637f,0x8b3d63e1,0x8b1bfd26
.averify 0x00000020,0x8b4df5b5,0x8b88a26f,0x8b308769,0x8b3c09fc
.averify 0x00000030,0x8b3aa28f,0x8b29278e,0x8b35c078,0x8b224f2b
.averify 0x00000040,0x8b20e6ea,0x8b266852,0x91135d19,0x915b4c29
.averify 0x00000050,0x0b100119,0x0b2f425f,0x0b2143f0,0x0b050a24
.averify 0x00000060,0x0b5e7f0b,0x0b8c2fb9,0x0b2e864b,0x0b3a0156
.averify 0x00000070,0x0b33a103,0x0b312f90,0x0b3ac255,0x0b2c4a80
.averify 0x00000080,0x1122a9fa,0x115b2b8b,0xab0001ad,0xab2e63ed
.averify 0x00000090,0xab017dd3,0xab51aa6b,0xab93f27c,0xab2782dd
.averify 0x000000a0,0xab2e0477,0xab29ac41,0xab2321ae,0xab21cf41
.averify 0x000000b0,0xab3b4e94,0xab3fe2a3,0xab2f6577,0xb13d6c75
.averify 0x000000c0,0xb17e1cf8,0x2b180272,0x2b3b43e8,0x2b0928f8
.averify 0x000000d0,0x2b412096,0x2b8961f3,0x2b368fed,0x2b2d0438
.averify 0x000000e0,0x2b3fa207,0x2b282a67,0x2b3ece3b,0x2b2845ed
.averify 0x000000f0,0x3113ba25,0x316e937a,0xab1c027f,0xab3363ff
.averify 0x00000100,0xab128c1f,0xab432bff,0xab9fb43f,0xab318a1f
.averify 0x00000110,0xab3a03df,0xab3caf9f,0xab39269f,0xab31c8bf
.averify 0x00000120,0xab21455f,0xab2be97f,0xab24611f,0xb132ce5f
.averify 0x00000130,0xb16b787f,0x2b0d033f,0x2b2543ff,0x2b1e753f
.averify 0x00000140,0x2b41577f,0x2b9434df,0x2b26867f,0x2b2d0bbf
.averify 0x00000150,0x2b30a05f,0x2b3026bf,0x2b2ece3f,0x2b20421f
.averify 0x00000160,0x310236ff,0x314201ff,0xeb0a01df,0xeb3063ff
.averify 0x00000170,0xeb10b33f,0xeb583b5f,0xeb895b7f,0xeb2880ff
.averify 0x00000180,0xeb2f0c5f,0xeb26a83f,0xeb31255f,0xeb24ca3f
.averify 0x00000190,0xeb264e9f,0xeb2fe2bf,0xeb2068ff,0xf122857f
.averify 0x000001a0,0xf177b45f,0x6b1001bf,0x6b3b43ff,0x6b025e7f
.averify 0x000001b0,0x6b4d5eff,0x6b953c1f,0x6b25885f,0x6b31091f
.averify 0x000001c0,0x6b33a05f,0x6b2d279f,0x6b31c4df,0x6b29453f
.averify 0x000001d0,0x71229f5f,0x7145845f,0x9b1a3f5b,0x1b0f6d7e
.averify 0x000001e0,0x9b12fe22,0x1b1bffff,0x9b0fe66f,0x1b17b773
.averify 0x000001f0,0x9b017ebe,0x1b177f10,0xcb0803fc,0xcb002bee
.averify 0x00000200,0xcb5a77f8,0xcb861ffc,0x4b0f03ed,0x4b0a2ffe
.averify 0x00000210,0x4b4f4bfa,0x4b9203e3,0xeb1e03ee,0xeb1f13f6
.averify 0x00000220,0xeb531be9,0xeb88ebfd,0x6b1503e9,0x6b0e07f2
.averify 0x00000230,0x6b4953fe,0x6b9a07f6,0xda1c03e1,0x5a1303f8
.averify 0x00000240,0xda0203e9,0x5a0303ea,0xda1701f4,0x5a190397
.averify 0x00000250,0xfa1f017e,0x7a0a013c,0x9acb0ce2,0x1ada0cb2
.averify 0x00000260,0x9b5d7d4e,0xcb2a60df,0xcb2d60ff,0xcb3b63ed
.averify 0x00000270,0xcb0253aa,0xcb595d08,0xcb926f6c,0xcb298f56
.averify 0x00000280,0xcb23087f,0xcb29ab9d,0xcb3f2893,0xcb34c096
.averify 0x00000290,0xcb334485,0xcb26edbf,0xcb3068f9,0xd1143fb6
.averify 0x000002a0,0xd16ea856,0x4b070178,0x4b3140df,0x4b3c43e1
.averify 0x000002b0,0x4b0b22cd,0x4b4e7169,0x4b85414b,0x4b3f8806
.averify 0x000002c0,0x4b2d0e00,0x4b22a2b9,0x4b232b44,0x4b39ca62
.averify 0x000002d0,0x4b36405d,0x513e285f,0x516cb17d,0xeb1a0340
.averify 0x000002e0,0xeb3e63f3,0xeb1f2657,0xeb5db671,0xeb87b8ab
.averify 0x000002f0,0xeb34826f,0xeb340066,0xeb3aaf4e,0xeb3821ce
.averify 0x00000300,0xeb33ce63,0xeb3440ee,0xeb39ee96,0xeb356a6a
.averify 0x00000310,0xf11d144a,0xf158ae32,0x6b0f02db,0x6b2443f4
.averify 0x00000320,0x6b04401e,0x6b436511,0x6b9823ba,0x6b30873b
.averify 0x00000330,0x6b37010f,0x6b28a13b,0x6b3523a2,0x6b24ccd9
.averify 0x00000340,0x6b254315,0x7116bcb5,0x716db73b,0x9ad10978
.averify 0x00000350,0x1ad308de,0x9bdf7c2b
