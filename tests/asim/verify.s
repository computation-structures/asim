start:
    adc X11, X5, X1
    adc W1, W15, W26

    adcs X21, X27, X17
    adcs W5, W6, W24

    add X13, X16, X25
    add SP, X10, X3
    add X14, SP, X26
    add X24, X4, X25, LSL #53
    add X24, X29, X7, LSR #17
    add X10, X0, X14, ASR #34
    add X7, X6, W28, SXTB #0
    add X9, X17, W12, UXTB #2
    add X22, X24, W19, SXTH #1
    add X23, X28, W20, UXTH #0
    add X30, X7, W17, SXTW #1
    add X5, X3, W18, UXTW #0
    add X9, X19, X9, SXTX #2
    add X28, X25, X2, UXTX #0
    add X8, X15, #1299
    add X17, X14, #2243, LSL #12
    add W22, W12, W10
    add WSP, W25, W15
    add W20, WSP, W14
    add W21, W26, W16, LSL #0
    add W19, W26, W29, LSR #14
    add W20, W16, W1, ASR #0
    add W26, W6, W17, SXTB #1
    add W24, W20, W1, UXTB #2
    add W17, W16, W7, SXTH #2
    add W6, W25, W0, UXTH #1
    add W28, W27, W24, SXTW #1
    add W10, W2, W14, UXTW #0
    add W7, W24, #2721
    add W5, W5, #125, LSL #12

    adds X23, X28, X23
    adds X15, SP, X11
    adds X4, X21, X18, LSL #0
    adds X25, X1, X13, LSR #3
    adds X6, X7, X15, ASR #56
    adds X19, X8, W7, SXTB #0
    adds X9, X11, W10, UXTB #3
    adds X23, X10, W10, SXTH #2
    adds X11, X5, W10, UXTH #0
    adds XZR, X11, W29, SXTW #3
    adds X20, X2, W27, UXTW #1
    adds X29, X15, X12, SXTX #3
    adds X16, X9, X20, UXTX #0
    adds X8, X15, #1909
    adds X2, X28, #1189, LSL #12
    adds W15, W13, W19
    adds W6, WSP, W10
    adds W18, W30, WZR, LSL #5
    adds W2, W21, W27, LSR #19
    adds W13, W18, W28, ASR #31
    adds W0, W23, WZR, SXTB #2
    adds W7, W10, W29, UXTB #2
    adds W4, W28, W23, SXTH #1
    adds W27, W16, W8, UXTH #0
    adds W7, W16, W14, SXTW #3
    adds W15, W12, W19, UXTW #1
    adds W13, W18, #1679
    adds W18, W30, #3533, LSL #12

    cmn X7, X6
    cmn SP, X11
    cmn X18, X12, LSL #58
    cmn X1, X24, LSR #27
    cmn X5, X19, ASR #30
    cmn X16, W18, SXTB #3
    cmn X2, W6, UXTB #0
    cmn X23, W8, SXTH #1
    cmn X19, W0, UXTH #3
    cmn X7, W21, SXTW #3
    cmn X10, W16, UXTW #0
    cmn X0, X18, SXTX #1
    cmn X30, X9, UXTX #0
    cmn X13, #2203
    cmn X2, #3237, LSL #12
    cmn W15, W3
    cmn WSP, W28
    cmn W6, W24, LSL #24
    cmn W14, W20, LSR #8
    cmn WZR, W9, ASR #28
    cmn W1, W6, SXTB #0
    cmn W2, W30, UXTB #3
    cmn W12, W30, SXTH #0
    cmn W21, W27, UXTH #1
    cmn W16, W20, SXTW #0
    cmn W2, W15, UXTW #3
    cmn W10, #1056
    cmn WSP, #2991, LSL #12

    cmp X2, XZR
    cmp SP, X18
    cmp X10, X20, LSL #45
    cmp X8, X18, LSR #54
    cmp X5, X21, ASR #37
    cmp X23, W11, SXTB #1
    cmp X7, W25, UXTB #3
    cmp X5, W16, SXTH #1
    cmp X2, WZR, UXTH #2
    cmp X22, W0, SXTW #1
    cmp X19, W30, UXTW #3
    cmp X13, X28, SXTX #1
    cmp X19, X7, UXTX #0
    cmp X28, #3459
    cmp X3, #2465, LSL #12
    cmp W1, WZR
    cmp WSP, W2
    cmp W3, W13, LSL #28
    cmp W8, W3, LSR #1
    cmp W24, W8, ASR #30
    cmp W12, W18, SXTB #3
    cmp W21, W14, UXTB #0
    cmp W26, W28, SXTH #2
    cmp W29, W24, UXTH #0
    cmp W4, W27, SXTW #0
    cmp W3, W15, UXTW #2
    cmp W24, #3043
    cmp W20, #3788, LSL #12

    madd X11, XZR, X22, X28
    madd W25, W30, W1, W16

    mneg X12, X8, X0
    mneg W26, W2, W13

    msub X11, X21, X29, X29
    msub W6, W18, W18, W19

    mul X18, X22, X21
    mul W26, W2, W22

    neg X16, X9
    neg XZR, X22, LSL #10
    neg X30, X12, LSR #37
    neg X24, X4, ASR #28
    neg W14, W19
    neg W5, W4, LSL #21
    neg W16, W23, LSR #15
    neg W2, W4, ASR #4

    negs X22, X16
    negs X25, X20, LSL #53
    negs X20, X0, LSR #39
    negs X26, X10, ASR #6
    negs W17, W28
    negs W15, W30, LSL #17
    negs W15, W1, LSR #12
    negs W7, W28, ASR #12

    ngc X12, X17
    ngc W28, W19

    ngc X28, X16
    ngc W3, W2

    sbc X3, X17, X20
    sbc W22, W2, W5

    sbcs X13, X10, X1
    sbcs W28, W26, W6

    sub X17, SP, X13
    sub SP, SP, X28
    sub X17, SP, X27
    sub X4, X12, X21, LSL #62
    sub X26, X28, X30, LSR #56
    sub X15, X24, X7, ASR #12
    sub X28, X5, W23, SXTB #1
    sub X23, X23, W21, UXTB #0
    sub SP, X22, W4, SXTH #1
    sub X6, X4, W2, UXTH #0
    sub X22, X24, W8, SXTW #0
    sub X24, X12, W17, UXTW #2
    sub X15, X10, X20, SXTX #3
    sub X0, X6, X14, UXTX #2
    sub X18, X6, #2515
    sub X10, X25, #1366, LSL #12
    sub W10, W2, W7
    sub WSP, W2, WZR
    sub W9, WSP, W0
    sub W14, W20, W6, LSL #24
    sub W2, W5, W7, LSR #24
    sub W21, W10, W13, ASR #30
    sub W8, W12, W27, SXTB #1
    sub W25, WSP, WZR, UXTB #1
    sub W18, W3, W15, SXTH #1
    sub W2, W15, WZR, UXTH #1
    sub W30, W22, W28, SXTW #1
    sub W12, W8, W24, UXTW #3
    sub W11, W30, #2707
    sub WSP, W10, #1485, LSL #12

    subs X15, X5, X13
    subs X29, SP, X28
    subs X17, X26, X10, LSL #17
    subs X7, X23, X10, LSR #5
    subs X17, X6, X13, ASR #19
    subs X12, X14, W30, SXTB #0
    subs X27, X20, W18, UXTB #2
    subs X21, X26, W30, SXTH #1
    subs X18, X5, W16, UXTH #2
    subs X27, X29, W22, SXTW #3
    subs X7, X24, W5, UXTW #2
    subs X7, X4, X7, SXTX #3
    subs X23, X5, X2, UXTX #2
    subs X3, X10, #948
    subs X23, X5, #2336, LSL #12
    subs W16, W22, W19
    subs W12, WSP, W14
    subs W30, W13, W10, LSL #15
    subs W8, W23, W13, LSR #22
    subs W18, WZR, W20, ASR #7
    subs W18, W30, W25, SXTB #0
    subs W28, W2, W22, UXTB #1
    subs W0, W29, W12, SXTH #2
    subs W18, W29, W4, UXTH #2
    subs W20, W23, W1, SXTW #1
    subs W5, W26, W19, UXTW #0
    subs W4, W21, #369
    subs W29, W1, #3451, LSL #12

end:

.averify 0x00000000,0x9a0100ab,0x1a1a01e1,0xba110375,0x3a1800c5
.averify 0x00000010,0x8b19020d,0x8b23615f,0x8b3a63ee,0x8b19d498
.averify 0x00000020,0x8b4747b8,0x8b8e880a,0x8b3c80c7,0x8b2c0a29
.averify 0x00000030,0x8b33a716,0x8b342397,0x8b31c4fe,0x8b324065
.averify 0x00000040,0x8b29ea69,0x8b22633c,0x91144de8,0x91630dd1
.averify 0x00000050,0x0b0a0196,0x0b2f433f,0x0b2e43f4,0x0b100355
.averify 0x00000060,0x0b5d3b53,0x0b810214,0x0b3184da,0x0b210a98
.averify 0x00000070,0x0b27aa11,0x0b202726,0x0b38c77c,0x0b2e404a
.averify 0x00000080,0x112a8707,0x1141f4a5,0xab170397,0xab2b63ef
.averify 0x00000090,0xab1202a4,0xab4d0c39,0xab8fe0e6,0xab278113
.averify 0x000000a0,0xab2a0d69,0xab2aa957,0xab2a20ab,0xab3dcd7f
.averify 0x000000b0,0xab3b4454,0xab2cedfd,0xab346130,0xb11dd5e8
.averify 0x000000c0,0xb1529782,0x2b1301af,0x2b2a43e6,0x2b1f17d2
.averify 0x000000d0,0x2b5b4ea2,0x2b9c7e4d,0x2b3f8ae0,0x2b3d0947
.averify 0x000000e0,0x2b37a784,0x2b28221b,0x2b2ece07,0x2b33458f
.averify 0x000000f0,0x311a3e4d,0x317737d2,0xab0600ff,0xab2b63ff
.averify 0x00000100,0xab0cea5f,0xab586c3f,0xab9378bf,0xab328e1f
.averify 0x00000110,0xab26005f,0xab28a6ff,0xab202e7f,0xab35ccff
.averify 0x00000120,0xab30415f,0xab32e41f,0xab2963df,0xb1226dbf
.averify 0x00000130,0xb172945f,0x2b0301ff,0x2b3c43ff,0x2b1860df
.averify 0x00000140,0x2b5421df,0x2b8973ff,0x2b26803f,0x2b3e0c5f
.averify 0x00000150,0x2b3ea19f,0x2b3b26bf,0x2b34c21f,0x2b2f4c5f
.averify 0x00000160,0x3110815f,0x316ebfff,0xeb1f005f,0xeb3263ff
.averify 0x00000170,0xeb14b55f,0xeb52d91f,0xeb9594bf,0xeb2b86ff
.averify 0x00000180,0xeb390cff,0xeb30a4bf,0xeb3f285f,0xeb20c6df
.averify 0x00000190,0xeb3e4e7f,0xeb3ce5bf,0xeb27627f,0xf1360f9f
.averify 0x000001a0,0xf166847f,0x6b1f003f,0x6b2243ff,0x6b0d707f
.averify 0x000001b0,0x6b43051f,0x6b887b1f,0x6b328d9f,0x6b2e02bf
.averify 0x000001c0,0x6b3cab5f,0x6b3823bf,0x6b3bc09f,0x6b2f487f
.averify 0x000001d0,0x712f8f1f,0x717b329f,0x9b1673eb,0x1b0143d9
.averify 0x000001e0,0x9b00fd0c,0x1b0dfc5a,0x9b1df6ab,0x1b12ce46
.averify 0x000001f0,0x9b157ed2,0x1b167c5a,0xcb0903f0,0xcb162bff
.averify 0x00000200,0xcb4c97fe,0xcb8473f8,0x4b1303ee,0x4b0457e5
.averify 0x00000210,0x4b573ff0,0x4b8413e2,0xeb1003f6,0xeb14d7f9
.averify 0x00000220,0xeb409ff4,0xeb8a1bfa,0x6b1c03f1,0x6b1e47ef
.averify 0x00000230,0x6b4133ef,0x6b9c33e7,0xda1103ec,0x5a1303fc
.averify 0x00000240,0xda1003fc,0x5a0203e3,0xda140223,0x5a050056
.averify 0x00000250,0xfa01014d,0x7a06035c,0xcb2d63f1,0xcb3c63ff
.averify 0x00000260,0xcb3b63f1,0xcb15f984,0xcb5ee39a,0xcb87330f
.averify 0x00000270,0xcb3784bc,0xcb3502f7,0xcb24a6df,0xcb222086
.averify 0x00000280,0xcb28c316,0xcb314998,0xcb34ed4f,0xcb2e68c0
.averify 0x00000290,0xd1274cd2,0xd1555b2a,0x4b07004a,0x4b3f405f
.averify 0x000002a0,0x4b2043e9,0x4b06628e,0x4b4760a2,0x4b8d7955
.averify 0x000002b0,0x4b3b8588,0x4b3f07f9,0x4b2fa472,0x4b3f25e2
.averify 0x000002c0,0x4b3cc6de,0x4b384d0c,0x512a4fcb,0x5157355f
.averify 0x000002d0,0xeb0d00af,0xeb3c63fd,0xeb0a4751,0xeb4a16e7
.averify 0x000002e0,0xeb8d4cd1,0xeb3e81cc,0xeb320a9b,0xeb3ea755
.averify 0x000002f0,0xeb3028b2,0xeb36cfbb,0xeb254b07,0xeb27ec87
.averify 0x00000300,0xeb2268b7,0xf10ed143,0xf16480b7,0x6b1302d0
.averify 0x00000310,0x6b2e43ec,0x6b0a3dbe,0x6b4d5ae8,0x6b941ff2
.averify 0x00000320,0x6b3983d2,0x6b36045c,0x6b2caba0,0x6b242bb2
.averify 0x00000330,0x6b21c6f4,0x6b334345,0x7105c6a4,0x7175ec3d
