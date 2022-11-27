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

    
