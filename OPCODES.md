## Arm A64 opcodes supported by ASim

See [Arm A64 Instruction Set Architecture](https://developer.arm.com/documentation/ddi0596/2021-09)
for a detailed description of each opcode.

    ADC <Wd>, <Wn>, <Wm>
    ADC <Xd>, <Xn>, <Xm>
    ADCS <Wd>, <Wn>, <Wm>
    ADCS <Xd>, <Xn>, <Xm>
    ADD <Wd|WSP>, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}
    ADD <Xd|SP>, <Xn|SP>, <R><m>{, <extend> {#<amount>}}
    ADD <Wd|WSP>, <Wn|WSP>, #<imm>{, <shift>}
    ADD <Xd|SP>, <Xn|SP>, #<imm>{, <shift>}
    ADD <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    ADD <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    ADDS <Wd>, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}
    ADDS <Xd>, <Xn|SP>, <R><m>{, <extend> {#<amount>}}
    ADDS <Wd>, <Wn|WSP>, #<imm>{, <shift>}
    ADDS <Xd>, <Xn|SP>, #<imm>{, <shift>}
    ADDS <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    ADDS <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    ADR <Xd>, <label>
    ADRP <Xd>, <label>
    AND <Wd|WSP>, <Wn>, #<bitmask_imm>
    AND <Xd|SP>, <Xn>, #<bitmask_imm>
    AND <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    AND <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    ANDS <Wd>, <Wn>, #<imm>
    ANDS <Xd>, <Xn>, #<imm>
    ANDS <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    ANDS <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    ASR <Wd>, <Wn>, #<shift> [alias for SBFM <Wd>, <Wn>, #<shift>, #31]
    ASR <Xd>, <Xn>, #<shift> [alias for SBFM <Xd>, <Xn>, #<shift>, #63]
    ASR <Wd>, <Wn>, <Wm>
    ASR <Xd>, <Xn>, <Xm>
    B <label>
    B.<cond> <label>
    BFC <Wd>, #<lsb>, #<width> [alias for BFM <Wd>, WZR, #(-<lsb> MOD 32), #(<width>-1)]
    BFC <Xd>, #<lsb>, #<width> [alias for BFM <Xd>, XZR, #(-<lsb> MOD 64), #(<width>-1)]
    BFI <Wd>, <Wn>, #<lsb>, #<width> [alias for BFM <Wd>, <Wn>, #(-<lsb> MOD 32), #(<width>-1)]
    BFI <Xd>, <Xn>, #<lsb>, #<width> [alias for BFM <Xd>, <Xn>, #(-<lsb> MOD 64), #(<width>-1)]
    BFM <Wd>, <Wn>, #<immr>, #<imms>
    BFM <Xd>, <Xn>, #<immr>, #<imms>
    BFXIL <Wd>, <Wn>, #<lsb>, #<width> [alias for BFM <Wd>, <Wn>, #<lsb>, #(<lsb>+<width>-1)]
    BFXIL <Xd>, <Xn>, #<lsb>, #<width> [alias for BFM <Xd>, <Xn>, #<lsb>, #(<lsb>+<width>-1)]
    BIC <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    BIC <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    BICS <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    BICS <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    BL <label>
    BLR <Xn>
    BR <Xn>
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
    CINC <Wd>, <Wn>, <cond> [alias for CSINC <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CINC <Xd>, <Xn>, <cond> [alias for CSINC <Xd>, <Xn>, <Xn>, invert(<cond>)]
    CINV <Wd>, <Wn>, <cond> [alias for CSINV <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CINV <Xd>, <Xn>, <cond> [alias for CSINV <Xd>, <Xn>, <Xn>, invert(<cond>)]
    CLS <Wd>, <Wn>
    CLS <Xd>, <Xn>
    CLZ <Wd>, <Wn>
    CLZ <Xd>, <Xn>
    CMN <Wn|WSP>, <Wm>{, <extend> {#<amount>}} [alias for ADDS WZR, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}]
    CMN <Xn|SP>, <R><m>{, <extend> {#<amount>}} [alias for ADDS XZR, <Xn|SP>, <R><m>{, <extend> {#<amount>}}]
    CMN <Wn|WSP>, #<imm>{, <shift>} [alias for ADDS WZR, <Wn|WSP>, #<imm> {, <shift>}]
    CMN <Xn|SP>, #<imm>{, <shift>} [alias for ADDS XZR, <Xn|SP>, #<imm> {, <shift>}]
    CMN <Wn>, <Wm>{, <shift> #<amount>} [alias for ADDS WZR, <Wn>, <Wm> {, <shift> #<amount>}]
    CMN <Xn>, <Xm>{, <shift> #<amount>} [alias for ADDS XZR, <Xn>, <Xm> {, <shift> #<amount>}]
    CMP <Wn|WSP>, <Wm>{, <extend> {#<amount>}} [alias for SUBS WZR, <Wn|WSP>, <Wm>{, <extend> {#<amount>}}]
    CMP <Xn|SP>, <R><m>{, <extend> {#<amount>}} [alias for SUBS XZR, <Xn|SP>, <R><m>{, <extend> {#<amount>}}]
    CMP <Wn|WSP>, #<imm>{, <shift>} [alias for SUBS WZR, <Wn|WSP>, #<imm> {, <shift>}]
    CMP <Xn|SP>, #<imm>{, <shift>} [alias for SUBS XZR, <Xn|SP>, #<imm> {, <shift>}]
    CMP <Wn>, <Wm>{, <shift> #<amount>} [alias for SUBS WZR, <Wn>, <Wm> {, <shift> #<amount>}]
    CMP <Xn>, <Xm>{, <shift> #<amount>} [alias for SUBS XZR, <Xn>, <Xm> {, <shift> #<amount>}]
    CNEG <Wd>, <Wn>, <cond> [alias for CSNEG <Wd>, <Wn>, <Wn>, invert(<cond>)]
    CNEG <Xd>, <Xn>, <cond> [alias for CSNEG <Xd>, <Xn>, <Xn>, invert(<cond>)]
    CSEL <Wd>, <Wn>, <Wm>, <cond>
    CSEL <Xd>, <Xn>, <Xm>, <cond>
    CSET <Wd>, <cond> [alias for CSINC <Wd>, WZR, WZR, invert(<cond>)]
    CSET <Xd>, <cond> [alias for CSINC <Xd>, XZR, XZR, invert(<cond>)]
    CSETM <Wd>, <cond> [alias for CSINV <Wd>, WZR, WZR, invert(<cond>)]
    CSETM <Xd>, <cond> [alias for CSINV <Xd>, XZR, XZR, invert(<cond>)]
    CSINC <Wd>, <Wn>, <Wm>, <cond>
    CSINC <Xd>, <Xn>, <Xm>, <cond>
    CSINV <Wd>, <Wn>, <Wm>, <cond>
    CSINV <Xd>, <Xn>, <Xm>, <cond>
    CSNEG <Wd>, <Wn>, <Wm>, <cond>
    CSNEG <Xd>, <Xn>, <Xm>, <cond>
    EON <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    EON <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    EOR <Wd|WSP>, <Wn>, #<imm>
    EOR <Xd|SP>, <Xn>, #<imm>
    EOR <Wd>, <Wn>, <Wm>{, <shift> #<amount>}
    EOR <Xd>, <Xn>, <Xm>{, <shift> #<amount>}
    EXTR <Wd>, <Wn>, <Wm>, #<lsb>
    EXTR <Xd>, <Xn>, <Xm>, #<lsb>
    LDP <Wt1>, <Wt2>, [<Xn|SP>], #<imm>
    LDP <Xt1>, <Xt2>, [<Xn|SP>], #<imm>
    LDPSW <Xt1>, <Xt2>, [<Xn|SP>], #<imm>
    LDPSW <Xt1>, <Xt2>, [<Xn|SP>, #<imm>]!
    LDPSW <Xt1>, <Xt2>, [<Xn|SP>{, #<imm>}]
    LDR <Wt>, [<Xn|SP>], #<simm>
    LDR <Xt>, [<Xn|SP>], #<simm>
    LDR <Wt>, [<Xn|SP>, #<simm>]!
    LDR <Xt>, [<Xn|SP>, #<simm>]!
    LDR <Wt>, [<Xn|SP>{, #<pimm>}]
    LDR <Xt>, [<Xn|SP>{, #<pimm>}]
    LDR <Wt>, <label>
    LDR <Xt>, <label>
    LDR <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDR <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDRB <Wt>, [<Xn|SP>], #<simm>
    LDRB <Wt>, [<Xn|SP>, #<simm>]!
    LDRB <Wt>, [<Xn|SP>{, #<pimm>}]
    LDRB <Wt>, [<Xn|SP>, (<Wm>|<Xm>), <extend> {<amount>}]
    LDRB <Wt>, [<Xn|SP>, <Xm>{, LSL <amount>}]
    LDRH <Wt>, [<Xn|SP>], #<simm>
    LDRH <Wt>, [<Xn|SP>, #<simm>]!
    LDRH <Wt>, [<Xn|SP>{, #<pimm>}]
    LDRH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDRSB <Wt>, [<Xn|SP>], #<simm>
    LDRSB <Xt>, [<Xn|SP>], #<simm>
    LDRSB <Wt>, [<Xn|SP>, #<simm>]!
    LDRSB <Xt>, [<Xn|SP>, #<simm>]!
    LDRSB <Wt>, [<Xn|SP>{, #<pimm>}]
    LDRSB <Xt>, [<Xn|SP>{, #<pimm>}]
    LDRSB <Wt>, [<Xn|SP>, (<Wm>|<Xm>), <extend> {<amount>}]
    LDRSB <Wt>, [<Xn|SP>, <Xm>{, LSL <amount>}]
    LDRSB <Xt>, [<Xn|SP>, (<Wm>|<Xm>), <extend> {<amount>}]
    LDRSB <Xt>, [<Xn|SP>, <Xm>{, LSL <amount>}]
    LDRSH <Wt>, [<Xn|SP>], #<simm>
    LDRSH <Xt>, [<Xn|SP>], #<simm>
    LDRSH <Wt>, [<Xn|SP>, #<simm>]!
    LDRSH <Xt>, [<Xn|SP>, #<simm>]!
    LDRSH <Wt>, [<Xn|SP>{, #<pimm>}]
    LDRSH <Xt>, [<Xn|SP>{, #<pimm>}]
    LDRSH <Wt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDRSH <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDRSW <Xt>, [<Xn|SP>], #<simm>
    LDRSW <Xt>, [<Xn|SP>, #<simm>]!
    LDRSW <Xt>, [<Xn|SP>{, #<pimm>}]
    LDRSW <Xt>, <label>
    LDRSW <Xt>, [<Xn|SP>, (<Wm>|<Xm>){, <extend> {<amount>}}]
    LDUR <Wt>, [<Xn|SP>{, #<simm>}]
    LDUR <Xt>, [<Xn|SP>{, #<simm>}]
    LDURB <Wt>, [<Xn|SP>{, #<simm>}]
    LDURH <Wt>, [<Xn|SP>{, #<simm>}]
    LDURSB <Wt>, [<Xn|SP>{, #<simm>}]
    LDURSB <Xt>, [<Xn|SP>{, #<simm>}]
    LDURSH <Wt>, [<Xn|SP>{, #<simm>}]
    LDURSH <Xt>, [<Xn|SP>{, #<simm>}]
    LDURSW <Xt>, [<Xn|SP>{, #<simm>}]
    LSL <Wd>, <Wn>, #<shift> [alias for UBFM <Wd>, <Wn>, #(-<shift> MOD 32), #(31-<shift>)]
    LSL <Xd>, <Xn>, #<shift> [alias for UBFM <Xd>, <Xn>, #(-<shift> MOD 64), #(63-<shift>)]
    LSL <Wd>, <Wn>, <Wm>
    LSL <Xd>, <Xn>, <Xm>
    LSR <Wd>, <Wn>, #<shift> [alias for UBFM <Wd>, <Wn>, #<shift>, #31]
    LSR <Xd>, <Xn>, #<shift> [alias for UBFM <Xd>, <Xn>, #<shift>, #63]
    LSR <Wd>, <Wn>, <Wm>
    LSR <Xd>, <Xn>, <Xm>
    MADD <Wd>, <Wn>, <Wm>, <Wa>
    MADD <Xd>, <Xn>, <Xm>, <Xa>
    MNEG <Wd>, <Wn>, <Wm> [alias for MSUB <Wd>, <Wn>, <Wm>, WZR]
    MNEG <Xd>, <Xn>, <Xm> [alias for MSUB <Xd>, <Xn>, <Xm>, XZR]
    MOV <Wd|WSP>, #<imm> [alias for ORR <Wd|WSP>, WZR, #<imm>]
    MOV <Xd|SP>, #<imm> [alias for ORR <Xd|SP>, XZR, #<imm>]
    MOV <Wd>, #<imm> [alias for MOVZ, MOVN, ORR (bitmask), or sequence of MOVZ,MOVK,...]
    MOV <Xd>, #<imm> [alias for MOVZ, MOVN, ORR (bitmask), or sequence of MOVZ,MOVK,...]
    MOV <Wd>, <Wm> [alias for ORR <Wd>, WZR, <Wm>]
    MOV <Xd>, <Xm> [alias for ORR <Xd>, XZR, <Xm>]
    MOV <Wd|WSP>, <Wn|WSP> [alias for ADD <Wd|WSP>, <Wn|WSP>, #0]
    MOV <Xd|SP>, <Xn|SP> [alias for ADD <Xd|SP>, <Xn|SP>, #0]
    MOVK <Wd>, #<imm>{, LSL #<shift>}
    MOVK <Xd>, #<imm>{, LSL #<shift>}
    MOVN <Wd>, #<imm>{, LSL #<shift>}
    MOVN <Xd>, #<imm>{, LSL #<shift>}
    MOVZ <Wd>, #<imm>{, LSL #<shift>}
    MOVZ <Xd>, #<imm>{, LSL #<shift>}
    MSUB <Wd>, <Wn>, <Wm>, <Wa>
    MSUB <Xd>, <Xn>, <Xm>, <Xa>
    MUL <Wd>, <Wn>, <Wm> [alias for MADD <Wd>, <Wn>, <Wm>, WZR]
    MUL <Xd>, <Xn>, <Xm> [alias for MADD <Xd>, <Xn>, <Xm>, XZR]
    MVN <Wd>, <Wm>{, <shift> #<amount>} [alias for ORN <Wd>, WZR, <Wm>{, <shift> #<amount>}]
    MVN <Xd>, <Xm>{, <shift> #<amount>} [alias for ORN <Xd>, XZR, <Xm>{, <shift> #<amount>}]
    
    
