start:
    adc X8, X1, X26
    adc W7, W28, W19

    adcs X30, X28, X16
    adcs W17, W0, WZR

    add X22, X17, X13
    add SP, X23, X9
    add X2, SP, X3
    add X18, X6, X6, LSL #43
    add X16, X1, X29, LSR #4
    add X4, X2, X7, ASR #57
    add X4, X28, W23, SXTB #1
    add X3, X16, W7, UXTB #1
    add X21, X25, W18, SXTH #1
    add X3, X23, W19, UXTH #2
    add X29, X19, W22, SXTW #2
    add X11, X17, W24, UXTW #0
    add X9, X8, X11, SXTX #2
    add X26, X6, X19, UXTX #2
    add X30, X10, #1850
    add X9, X1, #3867, LSL #12
    add W4, W14, W14
    add WSP, W27, W22
    add W23, WSP, W20
    add W28, W29, W19, LSL #0
    add W12, W1, W0, LSR #15
    add W29, W9, W6, ASR #8
    add W21, W7, W22, SXTB #3
    add W27, W19, W24, UXTB #2
    add W25, WSP, W18, SXTH #0
    add WSP, W27, W8, UXTH #3
    add W29, W20, W6, SXTW #3
    add W1, W12, W28, UXTW #0
    add W22, W20, #2192
    add W17, W7, #3065, LSL #12

    adds X19, X16, X6
    adds X7, SP, X17
    adds X17, X21, X9, LSL #34
    adds X21, X19, X25, LSR #13
    adds X3, X4, X2, ASR #26
    adds X7, X2, W16, SXTB #2
    adds X20, X30, W5, UXTB #3
    adds X11, X19, W30, SXTH #2
    adds X8, X17, W3, UXTH #0
    adds XZR, X22, W4, SXTW #1
    adds X19, X8, W17, UXTW #2
    adds X21, X15, X13, SXTX #2
    adds X20, X21, X28, UXTX #0
    adds X14, SP, #664
    adds X7, X2, #1753, LSL #12
    adds W28, W10, W16
    adds W19, WSP, W29
    adds W25, W17, W6, LSL #8
    adds W30, W24, W7, LSR #12
    adds W10, W11, W8, ASR #24
    adds W25, W17, W24, SXTB #0
    adds W23, W1, W24, UXTB #0
    adds W3, W27, W5, SXTH #3
    adds W17, W2, W18, UXTH #2
    adds W15, W4, W9, SXTW #2
    adds W30, W1, W27, UXTW #0
    adds W23, W23, #3154
    adds W4, W6, #3760, LSL #12

    cmn X11, X24
    cmn SP, X23
    cmn X20, X27, LSL #43
    cmn X8, X10, LSR #44
    cmn X3, X17, ASR #27
    cmn X1, WZR, SXTB #0
    cmn X27, W5, UXTB #0
    cmn X22, W27, SXTH #1
    cmn X0, W18, UXTH #1
    cmn X24, W16, SXTW #1
    cmn X3, W16, UXTW #0
    cmn X1, X16, SXTX #0
    cmn X19, X1, UXTX #2
    cmn X26, #3560
    cmn X9, #2907, LSL #12
    cmn W0, W25
    cmn WSP, W9
    cmn W20, W20, LSL #31
    cmn W29, W18, LSR #29
    cmn W21, W8, ASR #13
    cmn W27, W11, SXTB #0
    cmn W25, W21, UXTB #2
    cmn W2, W26, SXTH #1
    cmn W12, WZR, UXTH #2
    cmn W28, W15, SXTW #1
    cmn W0, W13, UXTW #1
    cmn W16, #1910
    cmn W15, #1543, LSL #12

    cmp X10, X9
    cmp SP, X19
    cmp X2, X4, LSL #52
    cmp X18, XZR, LSR #52
    cmp X18, X2, ASR #13
    cmp X15, W22, SXTB #1
    cmp X17, W9, UXTB #2
    cmp X4, WZR, SXTH #2
    cmp X12, WZR, UXTH #1
    cmp X0, W5, SXTW #1
    cmp X1, W12, UXTW #3
    cmp X4, X15, SXTX #1
    cmp X4, X15, UXTX #1
    cmp X2, #1121
    cmp X15, #2312, LSL #12
    cmp W27, W8
    cmp WSP, W6
    cmp W4, W23, LSL #19
    cmp W8, W27, LSR #27
    cmp W25, W7, ASR #0
    cmp W22, W19, SXTB #0
    cmp W26, W25, UXTB #3
    cmp W23, W2, SXTH #1
    cmp W5, WZR, UXTH #2
    cmp W4, W6, SXTW #3
    cmp W13, W8, UXTW #3
    cmp W0, #1601
    cmp W19, #1896, LSL #12

    madd X20, X22, X1, X17
    madd W14, W9, W29, W21

    mneg X11, X6, X13
    mneg W21, W2, W12

    msub X26, X2, X15, X28
    msub W28, W19, W7, W19

    mul X24, X20, X24
    mul W11, W25, W25

    neg X25, X16
    neg X26, X8, LSL #7
    neg X15, X27, LSR #41
    neg X16, X10, ASR #15
    neg W14, W10
    neg W22, W25, LSL #12
    neg W0, W1, LSR #31
    neg W22, W15, ASR #4

    negs X20, X12
    negs X2, X20, LSL #46
    negs X2, X16, LSR #0
    negs X4, X15, ASR #44
    negs W30, W3
    negs W11, WZR, LSL #24
    negs W10, W25, LSR #31
    negs W30, W2, ASR #15

    ngc X2, X9
    ngc W2, W23

    ngcs X6, X12
    ngcs W11, W3

    sbc X10, X0, X7
    sbc W9, W11, W12

    sbcs X29, X23, X9
    sbcs W14, W26, W8

    sdiv X2, X14, X1
    sdiv W26, W22, W30

    smaddl XZR, W24, W27, X29
    smnegl X22, W12, W12
    smsubl X26, W18, W15, X12
    smulh X13, X20, X19

    smull X17, W22, W10
    sub SP, SP, X0
    sub SP, X21, X24
    sub X28, SP, X12
    sub X25, X19, X20, LSL #39
    sub X12, X10, X2, LSR #59
    sub X18, X12, XZR, ASR #14
    sub X17, X8, W18, SXTB #0
    sub X13, X22, W26, UXTB #3
    sub X29, X28, W6, SXTH #0
    sub X0, X21, W23, UXTH #3
    sub X3, X29, W9, SXTW #3
    sub X22, X3, W1, UXTW #2
    sub X16, X6, X12, SXTX #0
    sub X18, X29, XZR, UXTX #2
    sub X19, X30, #4063
    sub X10, X1, #3594, LSL #12
    sub W26, W22, W6
    sub WSP, W22, W6
    sub W14, WSP, W23
    sub W15, W12, W19, LSL #12
    sub WZR, W9, W7, LSR #27
    sub W12, W7, W0, ASR #18
    sub W6, W3, W9, SXTB #1
    sub W23, W6, W9, UXTB #1
    sub W0, W7, W22, SXTH #1
    sub W11, W16, W16, UXTH #3
    sub W13, W14, W6, SXTW #0
    sub W20, W25, WZR, UXTW #1
    sub W5, W11, #3369
    sub W10, W5, #1913, LSL #12

    subs X1, X6, X28
    subs X4, SP, XZR
    subs X29, XZR, X4, LSL #27
    subs X21, X11, X19, LSR #26
    subs X24, X23, X1, ASR #57
    subs X26, SP, W23, SXTB #1
    subs X5, X20, W9, UXTB #1
    subs X23, SP, W4, SXTH #1
    subs X22, X24, W1, UXTH #0
    subs X26, X16, W18, SXTW #2
    subs X20, X15, W5, UXTW #1
    subs X6, X20, XZR, SXTX #1
    subs X0, X11, X6, UXTX #2
    subs X10, X17, #3443
    subs X22, X21, #1098, LSL #12
    subs W9, W11, W2
    subs W9, WSP, W24
    subs W19, W5, W15, LSL #28
    subs W12, W2, W23, LSR #29
    subs W2, W14, W5, ASR #3
    subs W26, W10, W7, SXTB #3
    subs W13, W12, W12, UXTB #0
    subs W4, W5, W18, SXTH #1
    subs W26, W27, W22, UXTH #2
    subs W13, W21, W11, SXTW #3
    subs W26, W29, W27, UXTW #1
    subs W19, W8, #3896
    subs W21, W14, #1322, LSL #12

    udiv X25, X18, X2
    udiv W20, WZR, W29

    umaddl X3, W12, W5, X13
    umnegl X22, W29, W23
    umsubl X23, W12, W2, X1
    umulh X8, X1, X17

    umull X6, W3, W8
    and X24, X1, X25
    and X7, X14, X9, LSL #45
    and X25, X20, X21, LSR #19
    and X24, X13, X23, ASR #1
    and X24, X10, X27, ROR #50
    and X1, XZR, #0xaaaaaaaaaaaaaaaa
    and X19, X12, #0x6666666666666666
    and X23, X18, #0x3e3e3e3e3e3e3e3e
    and X12, X1, #0xfe00fe00fe00fe
    and X19, X17, #0xf0000000f000000
    and X17, X10, #0x3ffffffc000000
    and W0, W12, WZR
    and W28, W24, W13, LSL #28
    and W11, W17, W6, LSR #7
    and W20, W27, W6, ASR #18
    and W1, W22, W2, ROR #24
    and W25, W12, #0xaaaaaaaa
    and WSP, W1, #0x66666666
    and W14, W13, #0x3e3e3e3e
    and W21, WZR, #0xfe00fe
    and W3, W25, #0xf000000

    ands X28, X1, X7
    ands X29, X13, X5, LSL #37
    ands X9, X25, X18, LSR #2
    ands X30, X9, XZR, ASR #3
    ands X3, X20, X3, ROR #45
    ands X2, X23, #0xaaaaaaaaaaaaaaaa
    ands X12, X5, #0x6666666666666666
    ands X21, X27, #0x3e3e3e3e3e3e3e3e
    ands X27, X14, #0xfe00fe00fe00fe
    ands X1, X1, #0xf0000000f000000
    ands X27, X5, #0x3ffffffc000000
    ands W18, W27, W8
    ands W16, W28, W28, LSL #5
    ands W15, W16, W7, LSR #23
    ands W20, W25, W26, ASR #0
    ands W28, W29, W11, ROR #16
    ands W30, W3, #0xaaaaaaaa
    ands W25, W14, #0x66666666
    ands W23, W15, #0x3e3e3e3e
    ands W9, W9, #0xfe00fe
    ands W5, W10, #0xf000000

    bic X13, X14, X11
    bic X18, X5, X18, LSL #9
    bic X0, X18, X7, LSR #34
    bic X2, X13, X27, ASR #30
    bic X2, X27, X30, ROR #37
    bic W2, W12, W18
    bic W8, W1, W16, LSL #30
    bic W24, W4, W18, LSR #21
    bic W27, W1, W16, ASR #26
    bic W24, W26, W28, ROR #18

    bics X14, X5, X1
    bics X18, X26, X18, LSL #4
    bics X11, X12, X9, LSR #28
    bics X7, X25, X7, ASR #11
    bics X27, X2, X3, ROR #7
    bics W15, W23, W19
    bics W4, W13, W22, LSL #8
    bics W25, W17, W30, LSR #11
    bics W20, W28, W5, ASR #15
    bics W14, W21, W26, ROR #15

    eon X9, X2, X23
    eon X23, X3, X15, LSL #57
    eon X29, X23, X22, LSR #61
    eon X3, X11, X15, ASR #33
    eon X22, X26, X19, ROR #12
    eon W3, W11, W22
    eon W0, W28, W23, LSL #15
    eon WZR, W14, W22, LSR #10
    eon W21, W28, W10, ASR #10
    eon W12, W24, W5, ROR #23

    eor X14, X2, X30
    eor X28, X17, X24, LSL #34
    eor X29, X27, X24, LSR #1
    eor X18, X1, X26, ASR #5
    eor X4, X1, X21, ROR #8
    eor X15, X28, #0xaaaaaaaaaaaaaaaa
    eor X11, X5, #0x6666666666666666
    eor X17, X17, #0x3e3e3e3e3e3e3e3e
    eor X14, X24, #0xfe00fe00fe00fe
    eor X5, X14, #0xf0000000f000000
    eor X29, X0, #0x3ffffffc000000
    eor W22, W11, W22
    eor W5, W24, W25, LSL #20
    eor W26, W4, W9, LSR #17
    eor W25, W8, W14, ASR #12
    eor W20, W25, W30, ROR #12
    eor W18, W2, #0xaaaaaaaa
    eor W2, W29, #0x66666666
    eor W16, W19, #0x3e3e3e3e
    eor WSP, W1, #0xfe00fe
    eor W9, W21, #0xf000000

    orn X7, X26, X0
    orn X26, X22, X19, LSL #63
    orn X10, X2, X28, LSR #16
    orn X19, X15, X2, ASR #55
    orn X8, X13, X12, ROR #27
    orn W13, W24, W23
    orn W0, W15, W6, LSL #0
    orn W27, W17, W24, LSR #30
    orn W15, W17, W8, ASR #18
    orn W28, W30, W26, ROR #4

    orr X30, X19, X12
    orr X2, X27, X11, LSL #16
    orr X21, X15, X5, LSR #42
    orr X19, X17, X30, ASR #13
    orr X16, X20, X20, ROR #23
    orr X1, X28, #0xaaaaaaaaaaaaaaaa
    orr X15, X3, #0x6666666666666666
    orr X28, X28, #0x3e3e3e3e3e3e3e3e
    orr X5, X20, #0xfe00fe00fe00fe
    orr X14, X21, #0xf0000000f000000
    orr X22, X11, #0x3ffffffc000000
    orr W9, W9, W6
    orr W21, W27, W30, LSL #9
    orr W11, W11, W27, LSR #19
    orr W23, W1, W14, ASR #23
    orr W1, W17, W3, ROR #14
    orr W25, W4, #0xaaaaaaaa
    orr W13, W18, #0x66666666
    orr W22, W12, #0x3e3e3e3e
    orr W19, W19, #0xfe00fe
    orr W13, W13, #0xf000000

end:

.averify 0x00000000,0x9a1a0028,0x1a130387,0xba10039e,0x3a1f0011
.averify 0x00000010,0x8b0d0236,0x8b2962ff,0x8b2363e2,0x8b06acd2
.averify 0x00000020,0x8b5d1030,0x8b87e444,0x8b378784,0x8b270603
.averify 0x00000030,0x8b32a735,0x8b332ae3,0x8b36ca7d,0x8b38422b
.averify 0x00000040,0x8b2be909,0x8b3368da,0x911ce95e,0x917c6c29
.averify 0x00000050,0x0b0e01c4,0x0b36437f,0x0b3443f7,0x0b1303bc
.averify 0x00000060,0x0b403c2c,0x0b86213d,0x0b368cf5,0x0b380a7b
.averify 0x00000070,0x0b32a3f9,0x0b282f7f,0x0b26ce9d,0x0b3c4181
.averify 0x00000080,0x11224296,0x116fe4f1,0xab060213,0xab3163e7
.averify 0x00000090,0xab098ab1,0xab593675,0xab826883,0xab308847
.averify 0x000000a0,0xab250fd4,0xab3eaa6b,0xab232228,0xab24c6df
.averify 0x000000b0,0xab314913,0xab2de9f5,0xab3c62b4,0xb10a63ee
.averify 0x000000c0,0xb15b6447,0x2b10015c,0x2b3d43f3,0x2b062239
.averify 0x000000d0,0x2b47331e,0x2b88616a,0x2b388239,0x2b380037
.averify 0x000000e0,0x2b25af63,0x2b322851,0x2b29c88f,0x2b3b403e
.averify 0x000000f0,0x31314af7,0x317ac0c4,0xab18017f,0xab3763ff
.averify 0x00000100,0xab1bae9f,0xab4ab11f,0xab916c7f,0xab3f803f
.averify 0x00000110,0xab25037f,0xab3ba6df,0xab32241f,0xab30c71f
.averify 0x00000120,0xab30407f,0xab30e03f,0xab216a7f,0xb137a35f
.averify 0x00000130,0xb16d6d3f,0x2b19001f,0x2b2943ff,0x2b147e9f
.averify 0x00000140,0x2b5277bf,0x2b8836bf,0x2b2b837f,0x2b350b3f
.averify 0x00000150,0x2b3aa45f,0x2b3f299f,0x2b2fc79f,0x2b2d441f
.averify 0x00000160,0x311dda1f,0x31581dff,0xeb09015f,0xeb3363ff
.averify 0x00000170,0xeb04d05f,0xeb5fd25f,0xeb82365f,0xeb3685ff
.averify 0x00000180,0xeb290a3f,0xeb3fa89f,0xeb3f259f,0xeb25c41f
.averify 0x00000190,0xeb2c4c3f,0xeb2fe49f,0xeb2f649f,0xf111845f
.averify 0x000001a0,0xf16421ff,0x6b08037f,0x6b2643ff,0x6b174c9f
.averify 0x000001b0,0x6b5b6d1f,0x6b87033f,0x6b3382df,0x6b390f5f
.averify 0x000001c0,0x6b22a6ff,0x6b3f28bf,0x6b26cc9f,0x6b284dbf
.averify 0x000001d0,0x7119041f,0x715da27f,0x9b0146d4,0x1b1d552e
.averify 0x000001e0,0x9b0dfccb,0x1b0cfc55,0x9b0ff05a,0x1b07ce7c
.averify 0x000001f0,0x9b187e98,0x1b197f2b,0xcb1003f9,0xcb081ffa
.averify 0x00000200,0xcb5ba7ef,0xcb8a3ff0,0x4b0a03ee,0x4b1933f6
.averify 0x00000210,0x4b417fe0,0x4b8f13f6,0xeb0c03f4,0xeb14bbe2
.averify 0x00000220,0xeb5003e2,0xeb8fb3e4,0x6b0303fe,0x6b1f63eb
.averify 0x00000230,0x6b597fea,0x6b823ffe,0xda0903e2,0x5a1703e2
.averify 0x00000240,0xfa0c03e6,0x7a0303eb,0xda07000a,0x5a0c0169
.averify 0x00000250,0xfa0902fd,0x7a08034e,0x9ac10dc2,0x1ade0eda
.averify 0x00000260,0x9b3b771f,0x9b2cfd96,0x9b2fb25a,0x9b537e8d
.averify 0x00000270,0x9b2a7ed1,0xcb2063ff,0xcb3862bf,0xcb2c63fc
.averify 0x00000280,0xcb149e79,0xcb42ed4c,0xcb9f3992,0xcb328111
.averify 0x00000290,0xcb3a0ecd,0xcb26a39d,0xcb372ea0,0xcb29cfa3
.averify 0x000002a0,0xcb214876,0xcb2ce0d0,0xcb3f6bb2,0xd13f7fd3
.averify 0x000002b0,0xd178282a,0x4b0602da,0x4b2642df,0x4b3743ee
.averify 0x000002c0,0x4b13318f,0x4b476d3f,0x4b8048ec,0x4b298466
.averify 0x000002d0,0x4b2904d7,0x4b36a4e0,0x4b302e0b,0x4b26c1cd
.averify 0x000002e0,0x4b3f4734,0x5134a565,0x515de4aa,0xeb1c00c1
.averify 0x000002f0,0xeb3f63e4,0xeb046ffd,0xeb536975,0xeb81e6f8
.averify 0x00000300,0xeb3787fa,0xeb290685,0xeb24a7f7,0xeb212316
.averify 0x00000310,0xeb32ca1a,0xeb2545f4,0xeb3fe686,0xeb266960
.averify 0x00000320,0xf135ce2a,0xf1512ab6,0x6b020169,0x6b3843e9
.averify 0x00000330,0x6b0f70b3,0x6b57744c,0x6b850dc2,0x6b278d5a
.averify 0x00000340,0x6b2c018d,0x6b32a4a4,0x6b362b7a,0x6b2bcead
.averify 0x00000350,0x6b3b47ba,0x713ce113,0x7154a9d5,0x9ac20a59
.averify 0x00000360,0x1add0bf4,0x9ba53583,0x9bb7ffb6,0x9ba28597
.averify 0x00000370,0x9bd17c28,0x9ba87c66,0x8a190038,0x8a09b5c7
.averify 0x00000380,0x8a554e99,0x8a9705b8,0x8adbc958,0x9201f3e1
.averify 0x00000390,0x9203e593,0x9207d257,0x920f982c,0x92080e33
.averify 0x000003a0,0x92666d51,0x0a1f0180,0x0a0d731c,0x0a461e2b
.averify 0x000003b0,0x0a864b74,0x0ac262c1,0x1201f199,0x1203e43f
.averify 0x000003c0,0x1207d1ae,0x120f9bf5,0x12080f23,0xea07003c
.averify 0x000003d0,0xea0595bd,0xea520b29,0xea9f0d3e,0xeac3b683
.averify 0x000003e0,0xf201f2e2,0xf203e4ac,0xf207d375,0xf20f99db
.averify 0x000003f0,0xf2080c21,0xf2666cbb,0x6a080372,0x6a1c1790
.averify 0x00000400,0x6a475e0f,0x6a9a0334,0x6acb43bc,0x7201f07e
.averify 0x00000410,0x7203e5d9,0x7207d1f7,0x720f9929,0x72080d45
.averify 0x00000420,0x8a2b01cd,0x8a3224b2,0x8a678a40,0x8abb79a2
.averify 0x00000430,0x8afe9762,0x0a320182,0x0a307828,0x0a725498
.averify 0x00000440,0x0ab0683b,0x0afc4b58,0xea2100ae,0xea321352
.averify 0x00000450,0xea69718b,0xeaa72f27,0xeae31c5b,0x6a3302ef
.averify 0x00000460,0x6a3621a4,0x6a7e2e39,0x6aa53f94,0x6afa3eae
.averify 0x00000470,0xca370049,0xca2fe477,0xca76f6fd,0xcaaf8563
.averify 0x00000480,0xcaf33356,0x4a360163,0x4a373f80,0x4a7629df
.averify 0x00000490,0x4aaa2b95,0x4ae55f0c,0xca1e004e,0xca188a3c
.averify 0x000004a0,0xca58077d,0xca9a1432,0xcad52024,0xd201f38f
.averify 0x000004b0,0xd203e4ab,0xd207d231,0xd20f9b0e,0xd2080dc5
.averify 0x000004c0,0xd2666c1d,0x4a160176,0x4a195305,0x4a49449a
.averify 0x000004d0,0x4a8e3119,0x4ade3334,0x5201f052,0x5203e7a2
.averify 0x000004e0,0x5207d270,0x520f983f,0x52080ea9,0xaa200347
.averify 0x000004f0,0xaa33feda,0xaa7c404a,0xaaa2ddf3,0xaaec6da8
.averify 0x00000500,0x2a37030d,0x2a2601e0,0x2a787a3b,0x2aa84a2f
.averify 0x00000510,0x2afa13dc,0xaa0c027e,0xaa0b4362,0xaa45a9f5
.averify 0x00000520,0xaa9e3633,0xaad45e90,0xb201f381,0xb203e46f
.averify 0x00000530,0xb207d39c,0xb20f9a85,0xb2080eae,0xb2666d76
.averify 0x00000540,0x2a060129,0x2a1e2775,0x2a5b4d6b,0x2a8e5c37
.averify 0x00000550,0x2ac33a21,0x3201f099,0x3203e64d,0x3207d196
.averify 0x00000560,0x320f9a73,0x32080dad
