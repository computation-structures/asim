## Arm A64 opcodes/operands supported by ASim

See [Arm A64 Instruction Set Architecture](https://developer.arm.com/documentation/ddi0596/2021-09)
for a detailed description of each opcode.

    <cond> := <EQ|NE|CS|HS|CC|LO|MI|PL|VS|VC|HI|LS|GE|LT|GT|LE|AL|NV>
    <extend> := <SXTB|SXTH|SXTW|SXTX|UXTB|UXTH|UXTW|SXTX|LSL>

    ADC <Wd>, <Wn>, <Wm>
    ADC <Xd>, <Xn>, <Xm>

    ADCS <Wd>, <Wn>, <Wm>
    ADCS <Xd>, <Xn>, <Xm>

    ADD <Wd|WSP>, <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
    ADD <Xd|SP>, <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
    **ADD <Wd|WSP>, <Wn|WSP>, #<imm:0..4095>{, LSL #<0|12>}**
    **ADD <Xd|SP>, <Xn|SP>, #<imm:0..4095>{, LSL #<0|12>}**
    ADD <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
    ADD <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}

    ADDS <Wd>, <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
    ADDS <Xd>, <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
    ADDS <Wd>, <Wn|WSP>, #<imm:0..4095>{, LSL #<0|12>}
    ADDS <Xd>, <Xn|SP>, #<imm:0..4095>{, LSL #<0|12}
    ADDS <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
    ADDS <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}

    ADR <Xd>, <label>

    ADRP <Xd>, <label>

    AND <Wd|WSP>, <Wn>, #<bitmask_imm:32-bit>
    AND <Xd|SP>, <Xn>, #<bitmask_imm:64-bit>
    AND <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    AND <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..64>}

    ANDS <Wd>, <Wn>, #<bitmask_imm>
    ANDS <Xd>, <Xn>, #<bitmask_imm>
    ANDS <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    ANDS <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..64>}

    ASR <Wd>, <Wn>, #<shift:0..31>
        [alias for SBFM <Wd>, <Wn>, #<shift>, #31]
    ASR <Xd>, <Xn>, #<shift:0..63>
        [alias for SBFM <Xd>, <Xn>, #<shift>, #63]
    ASR <Wd>, <Wn>, <Wm>
    ASR <Xd>, <Xn>, <Xm>

    B <label>

    B.<cond> <label>

    BFC <Wd>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for BFM <Wd>, WZR, #(-<lsb> MOD 32), #(<width>-1)]
    BFC <Xd>, #<lsb:0..63>, #<width:1..64-lsb>
        [alias for BFM <Xd>, XZR, #(-<lsb> MOD 64), #(<width>-1)]

    BFI <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for BFM <Wd>, <Wn>, #(-<lsb> MOD 32), #(<width>-1)]
    BFI <Xd>, <Xn>, #<lsb:0..31>, #<width:1..64-lsb>
        [alias for BFM <Xd>, <Xn>, #(-<lsb> MOD 64), #(<width>-1)]

    BFM <Wd>, <Wn>, #<immr:0..31>, #<imms:0..31>
    BFM <Xd>, <Xn>, #<immr:0..63>, #<imms:0..63>

    BFXIL <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for BFM <Wd>, <Wn>, #<lsb>, #(<lsb>+<width>-1)]
    BFXIL <Xd>, <Xn>, #<lsb:0..63>, #<width:1..64-lsp>
        [alias for BFM <Xd>, <Xn>, #<lsb>, #(<lsb>+<width>-1)]

    BIC <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    BIC <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    BICS <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    BICS <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    BL <label>

    BLR <Xn>

    BR <Xn>

    BRK {#<imm:0..65535>}

    CBNZ <Wt>, <label>
    CBNZ <Xt>, <label>

    CBZ <Wt>, <label>
    CBZ <Xt>, <label>

    CCMN <Wn>, #<imm>, #<nzcv>, <cond>
    CCMN <Xn>, #<imm>, #<nzcv>, <cond>
    CCMN <Wn>, <Wm>, #<nzcv>, <cond>
    CCMN <Xn>, <Xm>, #<nzcv>, <cond>

    CCMP <Wn>, #<imm>, #<nzcv>, <cond>
    CCMP <Xn>, #<imm>, #<nzcv>, <cond>
    CCMP <Wn>, <Wm>, #<nzcv>, <cond>
    CCMP <Xn>, <Xm>, #<nzcv>, <cond>

    CINC <Wd>, <Wn>, <cond>
        [alias for CSINC <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CINC <Xd>, <Xn>, <cond>
        [alias for CSINC <Xd>, <Xn>, <Xn>, invert(<cond>)]

    CINV <Wd>, <Wn>, <cond>
        [alias for CSINV <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CINV <Xd>, <Xn>, <cond>
        [alias for CSINV <Xd>, <Xn>, <Xn>, invert(<cond>)]

    CLS <Wd>, <Wn>
    CLS <Xd>, <Xn>

    CLZ <Wd>, <Wn>
    CLZ <Xd>, <Xn>

    CMN <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
        [alias for ADDS WZR, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}]
    CMN <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
        [alias for ADDS XZR, <Xn|SP>, <R><m>{, <extend> {#<amount>}}]
    CMN <Wn|WSP>, #<imm>{, LSL #<0|12>}
        [alias for ADDS WZR, <Wn|WSP>, #<imm> {, <shift>}]
    CMN <Xn|SP>, #<imm>{, LSL #<0|12>}
        [alias for ADDS XZR, <Xn|SP>, #<imm> {, <shift>}]
    CMN <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
        [alias for ADDS WZR, <Wn>, <Wm> {, <shift> #<amount>}]
    CMN <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}
        [alias for ADDS XZR, <Xn>, <Xm> {, <shift> #<amount>}]

    CMP <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
        [alias for SUBS WZR, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}]
    CMP <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
        [alias for SUBS XZR, <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}]
    CMP <Wn|WSP>, #<imm>{, LSL #<0|12>}
        [alias for SUBS WZR, <Wn|WSP>, #<imm> {, <shift>}]
    CMP <Xn|SP>, #<imm>{, LSL #<0|12>}
        [alias for SUBS XZR, <Xn|SP>, #<imm> {, <shift>}]
    CMP <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
        [alias for SUBS WZR, <Wn>, <Wm> {, <shift> #<amount>}]
    CMP <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}
        [alias for SUBS XZR, <Xn>, <Xm> {, <shift> #<amount>}]

    CNEG <Wd>, <Wn>, <cond>
        [alias for CSNEG <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CNEG <Xd>, <Xn>, <cond>
        [alias for CSNEG <Xd>, <Xn>, <Xn>, invert(<cond>)]

    CSEL <Wd>, <Wn>, <Wm>, <cond>
    CSEL <Xd>, <Xn>, <Xm>, <cond>

    CSET <Wd>, <cond>
        [alias for CSINC <Wd>, WZR, WZR, invert(<cond>)]
    CSET <Xd>, <cond>
        [alias for CSINC <Xd>, XZR, XZR, invert(<cond>)]

    CSETM <Wd>, <cond>
        [alias for CSINV <Wd>, WZR, WZR, invert(<cond>)]
    CSETM <Xd>, <cond>
        [alias for CSINV <Xd>, XZR, XZR, invert(<cond>)]

    CSINC <Wd>, <Wn>, <Wm>, <cond>
    CSINC <Xd>, <Xn>, <Xm>, <cond>

    CSINV <Wd>, <Wn>, <Wm>, <cond>
    CSINV <Xd>, <Xn>, <Xm>, <cond>

    CSNEG <Wd>, <Wn>, <Wm>, <cond>
    CSNEG <Xd>, <Xn>, <Xm>, <cond>

    EON <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    EON <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    EOR <Wd|WSP>, <Wn>, #<bitmask_imm>
    EOR <Xd|SP>, <Xn>, #<bitmask_imm>
    EOR <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    EOR <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    EXTR <Wd>, <Wn>, <Wm>, #<lsb:0..31>
    EXTR <Xd>, <Xn>, <Xm>, #<lsb:0..64>

    HLT {#<imm:0..65535>}

    LDP <Wt1>, <Wt2>, [<Xn|SP>], #<imm:-256..252, multiple of 4>
    LDP <Xt1>, <Xt2>, [<Xn|SP>], #<imm:-512..504, multiple of 8>
    LDP <Wt1>, <Wt2>, [<Xn|SP>, #<imm:-256..252, multiple of 4>]!
    LDP <Xt1>, <Xt2>, [<Xn|SP>, #<imm:-512..504, multiple of 8>]!
    LDP <Wt1>, <Wt2>, [<Xn|SP>{, #<imm:-256..252, multiple of 4>}]
    LDP <Xt1>, <Xt2>, [<Xn|SP>{, #<imm:-512..504, multiple of 8>}]

    LDPSW <Xt1>, <Xt2>, [<Xn|SP>], #<imm:-256..252, multiple of 4>
    LDPSW <Xt1>, <Xt2>, [<Xn|SP>, #<imm:-256..252, multiple of 4>]!
    LDPSW <Xt1>, <Xt2>, [<Xn|SP>{, #<imm:-256..252, multiple of 4>}]

    LDR <Wt>, [<Xn|SP>], #<simm:-256..255>
    LDR <Xt>, [<Xn|SP>], #<simm:-256..255>
    LDR <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    LDR <Xt>, [<Xn|SP>, #<simm:-256..255>]!
    LDR <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    LDR <Xt>, [<Xn|SP>{, #<pimm:0..32760, multiple of 8>}]
    LDR <Wt>, <label>
    LDR <Xt>, <label>
    LDR <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|2>}}]
    LDR <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|3}}]

    LDRB <Wt>, [<Xn|SP>], #<simm:-256..255>
    LDRB <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRB <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    LDRB <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#0}}]

    LDRH <Wt>, [<Xn|SP>], #<simm:-256..255>
    LDRH <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRH <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    LDRH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|1>}}]

    LDRSB <Wt>, [<Xn|SP>], #<simm:-256..255>
    LDRSB <Xt>, [<Xn|SP>], #<simm:-256..255>
    LDRSB <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRSB <Xt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRSB <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    LDRSB <Xt>, [<Xn|SP>{, #<pimm:0..32760, multiple of 8>}]
    LDRSB <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#0}}]
    LDRSB <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#0}}]

    LDRSH <Wt>, [<Xn|SP>], #<simm:-256..255>
    LDRSH <Xt>, [<Xn|SP>], #<simm:-256..255>
    LDRSH <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRSH <Xt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRSH <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    LDRSH <Xt>, [<Xn|SP>{, #<pimm:0..32760, multiple of 8>}]
    LDRSH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|1>}}]
    LDRSH <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|1>}}]

    LDRSW <Xt>, [<Xn|SP>], #<simm:-256..255>
    LDRSW <Xt>, [<Xn|SP>, #<simm:-256..255>]!
    LDRSW <Xt>, [<Xn|SP>{, #<pimm:0..32760, multiple of 8>}]
    LDRSW <Xt>, <label>
    LDRSW <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|2>}}]

    LDUR <Wt>, [<Xn|SP>{, #<simm:-256..255>}]
    LDUR <Xt>, [<Xn|SP>{, #<simm:-256..255>}]

    LDURB <Wt>, [<Xn|SP>{, #<simm:-256..255>}]

    LDURH <Wt>, [<Xn|SP>{, #<simm:-256..255>}]

    LDURSB <Wt>, [<Xn|SP>{, #<simm:-256..255>}]
    LDURSB <Xt>, [<Xn|SP>{, #<simm:-256..255>}]

    LDURSH <Wt>, [<Xn|SP>{, #<simm:-256..255>}]
    LDURSH <Xt>, [<Xn|SP>{, #<simm:-256..255>}]

    LDURSW <Xt>, [<Xn|SP>{, #<simm:-256..255>}]

    LSL <Wd>, <Wn>, #<shift:0..31>
        [alias for UBFM <Wd>, <Wn>, #(-<shift> MOD 32), #(31-<shift>)]
    LSL <Xd>, <Xn>, #<shift:0..63>
        [alias for UBFM <Xd>, <Xn>, #(-<shift> MOD 64), #(63-<shift>)]
    LSL <Wd>, <Wn>, <Wm>
    LSL <Xd>, <Xn>, <Xm>

    LSR <Wd>, <Wn>, #<shift:0..31>
        [alias for UBFM <Wd>, <Wn>, #<shift>, #31]
    LSR <Xd>, <Xn>, #<shift:0..63>
        [alias for UBFM <Xd>, <Xn>, #<shift>, #63]
    LSR <Wd>, <Wn>, <Wm>
    LSR <Xd>, <Xn>, <Xm>

    MADD <Wd>, <Wn>, <Wm>, <Wa>
    MADD <Xd>, <Xn>, <Xm>, <Xa>

    MNEG <Wd>, <Wn>, <Wm>
        [alias for MSUB <Wd>, <Wn>, <Wm>, WZR]
    MNEG <Xd>, <Xn>, <Xm>
        [alias for MSUB <Xd>, <Xn>, <Xm>, XZR]

    MOV <Wd|WSP>, #<bitmask_imm>
        [alias for ORR <Wd|WSP>, WZR, #<imm>]
    MOV <Xd|SP>, #<bitmask_imm>
        [alias for ORR <Xd|SP>, XZR, #<imm>]
    MOV <Wd>, #<imm>
        [alias for MOVZ, MOVN, ORR (bitmask), or sequence of MOVZ,MOVK,...]
    MOV <Xd>, #<imm>
        [alias for MOVZ, MOVN, ORR (bitmask), or sequence of MOVZ,MOVK,...]
    MOV <Wd>, <Wm>
        [alias for ORR <Wd>, WZR, <Wm>]
    MOV <Xd>, <Xm>
        [alias for ORR <Xd>, XZR, <Xm>]
    MOV <Wd|WSP>, <Wn|WSP>
        [alias for ADD <Wd|WSP>, <Wn|WSP>, #0]
    MOV <Xd|SP>, <Xn|SP>
        [alias for ADD <Xd|SP>, <Xn|SP>, #0]

    MOVK <Wd>, #<imm:0..65535>{, LSL #<0|16>}
    MOVK <Xd>, #<imm:0..65535>{, LSL #<0|16|32|48>}

    MOVN <Wd>, #<imm:0..65535>{, LSL #<0|16>}
    MOVN <Xd>, #<imm:0..65535>{, LSL #<0|16|32|48>}

    MOVZ <Wd>, #<imm:0..65535>{, LSL #<0|16>}
    MOVZ <Xd>, #<imm:0..65535>{, LSL #<0|16|32|48>}

    MRS <Xd>, <NZVC|CONSOLE|MOUSE|CYCLES>

    MSR <NZVC|CONSOLE>, <Xd>

    MSUB <Wd>, <Wn>, <Wm>, <Wa>
    MSUB <Xd>, <Xn>, <Xm>, <Xa>

    MUL <Wd>, <Wn>, <Wm>
        [alias for MADD <Wd>, <Wn>, <Wm>, WZR]
    MUL <Xd>, <Xn>, <Xm>
        [alias for MADD <Xd>, <Xn>, <Xm>, XZR]

    MVN <Wd>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
        [alias for ORN <Wd>, WZR, <Wm>{, <shift> #<amount>}]
    MVN <Xd>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}
        [alias for ORN <Xd>, XZR, <Xm>{, <shift> #<amount>}]

    NEG <Wd>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
        [alias for SUB <Wd>, WZR, <Wm> {, <shift> #<amount>}]
    NEG <Xd>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}
        [alias for SUB <Xd>, XZR, <Xm> {, <shift> #<amount>}]

    NEGS <Wd>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
        [alias for SUBS <Wd>, WZR, <Wm> {, <shift> #<amount>}]
    NEGS <Xd>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}
        [alias for SUBS <Xd>, XZR, <Xm> {, <shift> #<amount>}]

    NGC <Wd>, <Wm>
        [alias for SBC <Wd>, WZR, <Wm>]
    NGC <Xd>, <Xm>
        [alias for SBC <Xd>, XZR, <Xm>]

    NGCS <Wd>, <Wm>
        [alias for SBCS <Wd>, WZR, <Wm>]
    NGCS <Xd>, <Xm>
        [alias for SBCS <Xd>, XZR, <Xm>]

    NOP

    ORN <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    ORN <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    ORR <Wd|WSP>, <Wn>, #<bitmask_imm>
    ORR <Xd|SP>, <Xn>, #<bitmask_imm>
    ORR <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
    ORR <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}

    RBIT <Wd>, <Wn>
    RBIT <Xd>, <Xn>

    RET {<Xn>}

    REV <Wd>, <Wn>
    REV <Xd>, <Xn>

    REV16 <Wd>, <Wn>
    REV16 <Xd>, <Xn>

    REV32 <Xd>, <Xn>

    ROR <Wd>, <Ws>, #<shift:0..31>
        [alias for EXTR <Wd>, <Ws>, <Ws>, #<shift>]
    ROR <Xd>, <Xs>, #<shift:0..63>
        [alias for EXTR <Xd>, <Xs>, <Xs>, #<shift>]
    ROR <Wd>, <Wn>, <Wm>
    ROR <Xd>, <Xn>, <Xm>

    SBC <Wd>, <Wn>, <Wm>
    SBC <Xd>, <Xn>, <Xm>

    SBCS <Wd>, <Wn>, <Wm>
    SBCS <Xd>, <Xn>, <Xm>

    SBFIZ <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for SBFM <Wd>, <Wn>, #(-<lsb> MOD 32), #(<width>-1)]
    SBFIZ <Xd>, <Xn>, #<lsb:0..63>, #<width:1..64-lsb>
        [alias for SBFM <Xd>, <Xn>, #(-<lsb> MOD 64), #(<width>-1)]

    SBFM <Wd>, <Wn>, #<immr:0..31>, #<imms:0..31>
    SBFM <Xd>, <Xn>, #<immr:0..63>, #<imms:0..63>

    SBFX <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for SBFM <Wd>, <Wn>, #<lsb>, #(<lsb>+<width>-1)]
    SBFX <Xd>, <Xn>, #<lsb:0..63>, #<width:1..64-lsb>
        [alias for SBFM <Xd>, <Xn>, #<lsb>, #(<lsb>+<width>-1)]

    SDIV <Wd>, <Wn>, <Wm>
    SDIV <Xd>, <Xn>, <Xm>

    SMADDL <Xd>, <Wn>, <Wm>, <Xa>

    SMNEGL <Xd>, <Wn>, <Wm>
        [alias for SMSUBL <Xd>, <Wn>, <Wm>, XZR]

    SMSUBL <Xd>, <Wn>, <Wm>, <Xa>

    SMULH <Xd>, <Xn>, <Xm>

    SMULL <Xd>, <Wn>, <Wm>
        [alias for SMADDL <Xd>, <Wn>, <Wm>, XZR]

    STP <Wt1>, <Wt2>, [<Xn|SP>], #<imm:-256..252, multiple of 4>
    STP <Xt1>, <Xt2>, [<Xn|SP>], #<imm:-512..504, multiple of 8>
    STP <Wt1>, <Wt2>, [<Xn|SP>, #<imm:-256..252, multiple of 4>]!
    STP <Xt1>, <Xt2>, [<Xn|SP>, #<imm:-512..504, multiple of 8>]!
    STP <Wt1>, <Wt2>, [<Xn|SP>{, #<imm:-256..252, multiple of 4>}]
    STP <Xt1>, <Xt2>, [<Xn|SP>{, #<imm:-512..504, multiple of 8>}]

    STR <Wt>, [<Xn|SP>], #<simm:-256..255>
    STR <Xt>, [<Xn|SP>], #<simm:-256..255>
    STR <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    STR <Xt>, [<Xn|SP>, #<simm:-256..255>]!
    STR <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    STR <Xt>, [<Xn|SP>{, #<pimm:0..32760, multiple of 8>}]
    STR <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|2>}}]
    STR <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|3>}}]

    STRB <Wt>, [<Xn|SP>], #<simm:-256..255>
    STRB <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    STRB <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    STRB <Wt>, [<Xn|SP>, (<Wm>|<Xm>), <extend> {#0}]

    STRH <Wt>, [<Xn|SP>], #<simm:-256..255>
    STRH <Wt>, [<Xn|SP>, #<simm:-256..255>]!
    STRH <Wt>, [<Xn|SP>{, #<pimm:0..16380, multiple of 4>}]
    STRH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {#<0|1>}}]

    STUR <Wt>, [<Xn|SP>{, #<simm:-256..255>}]
    STUR <Xt>, [<Xn|SP>{, #<simm:-256..255>}]

    STURB <Wt>, [<Xn|SP>{, #<simm:-256..255>}]

    STURH <Wt>, [<Xn|SP>{, #<simm:-256..255>}]

    SUB <Wd|WSP>, <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
    SUB <Xd|SP>, <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
    SUB <Wd|WSP>, <Wn|WSP>, #<imm:0..4095>{, LSL #<0|12>}
    SUB <Xd|SP>, <Xn|SP>, #<imm:0..4095>{, LSL #<0|12>}
    SUB <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
    SUB <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}

    SUBS <Wd>, <Wn|WSP>, <Wm>{, <extend> {#<amount:0..4>}}
    SUBS <Xd>, <Xn|SP>, <R><m>{, <extend> {#<amount:0..4>}}
    SUBS <Wd>, <Wn|WSP>, #<imm:0..4095>{,<LSL|LSR|ASR> #<amount:0..31>}
    SUBS <Xd>, <Xn|SP>, #<imm:0..4095>{, <LSL|LSR|ASR> #<amount:0..63>}
    SUBS <Wd>, <Wn>, <Wm>{, <LSL|LSR|ASR> #<amount:0..31>}
    SUBS <Xd>, <Xn>, <Xm>{, <LSL|LSR|ASR> #<amount:0..63>}

    SXTB <Wd>, <Wn>
        [alias for SBFM <Wd>, <Wn>, #0, #7]
    SXTB <Xd>, <Wn>
        [alias for SBFM <Xd>, <Xn>, #0, #7]

    SXTH <Wd>, <Wn>
        [alias for SBFM <Wd>, <Wn>, #0, #15]
    SXTH <Xd>, <Wn>
        [alias for SBFM <Xd>, <Xn>, #0, #15]
    SXTW <Xd>, <Wn>
        [alias for SBFM <Xd>, <Xn>, #0, #31]

    TBNZ <R><t>, #<imm>, <label>

    TBZ <R><t>, #<imm>, <label>

    TST <Wn>, #<bitmask_imm>
        [alias for ANDS WZR, <Wn>, #<bitmask_imm>]
    TST <Xn>, #<bitmask_imm>
        [alias for ANDS XZR, <Xn>, #<bitmask_imm>]
    TST <Wn>, <Wm>{, <LSL|LSR|ASR|ROR> #<amount:0..31>}
        [alias for ANDS WZR, <Wn>, <Wm>{, <shift> #<amount>}]
    TST <Xn>, <Xm>{, <LSL|LSR|ASR|ROR> #<amount:0..63>}
        [alias for ANDS XZR, <Xn>, <Xm>{, <shift> #<amount>}]

    UBFIZ <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for UBFM <Wd>, <Wn>, #(-<lsb> MOD 32), #(<width>-1)]
    UBFIZ <Xd>, <Xn>, #<lsb:0..63>, #<width:1..64-lsb>
        [alias for UBFM <Xd>, <Xn>, #(-<lsb> MOD 64), #(<width>-1)]

    UBFM <Wd>, <Wn>, #<immr:0..31>, #<imms:0..31>
    UBFM <Xd>, <Xn>, #<immr:0..63>, #<imms:0..63>

    UBFX <Wd>, <Wn>, #<lsb:0..31>, #<width:1..32-lsb>
        [alias for UBFM <Wd>, <Wn>, #<lsb>, #(<lsb>+<width>-1)]
    UBFX <Xd>, <Xn>, #<lsb:0..31>, #<width:1..64-lsb>
        [alias for UBFM <Xd>, <Xn>, #<lsb>, #(<lsb>+<width>-1)]

    UDIV <Wd>, <Wn>, <Wm>
    UDIV <Xd>, <Xn>, <Xm>

    UMADDL <Xd>, <Wn>, <Wm>, <Xa>

    UMNEGL <Xd>, <Wn>, <Wm>
        [alias for UMSUBL <Xd>, <Wn>, <Wm>, XZR]

    UMSUBL <Xd>, <Wn>, <Wm>, <Xa>

    UMULH <Xd>, <Xn>, <Xm>

    UMULL <Xd>, <Wn>, <Wm>
        [alias for UMADDL <Xd>, <Wn>, <Wm>, XZR]

    UXTB <Wd>, <Wn>
        [alias for UBFM <Wd>, <Wn>, #0, #7]

    UXTH <Wd>, <Wn>
        [alias for UBFM <Wd>, <Wn>, #0, #15]
