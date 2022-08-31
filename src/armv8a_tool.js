/*
Copyright 2022 Christopher J. Terman

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

//////////////////////////////////////////////////
// ARMV8-A assembly/simulation
//////////////////////////////////////////////////

SimTool.ARMV8ATool = class extends(SimTool.CPUTool) {
    constructor(tool_div) {
        // super() will call this.emulation_initialize()
        super(tool_div, 'armv8a_tool.1', 'ARMV8A', 'ARMV8A-A64');
    }

    //////////////////////////////////////////////////
    // ISA emulation
    //////////////////////////////////////////////////

    va_to_phys(va) {
        // no MMU (yet)
        return Number(va);
    }

    // provide RISC-V-specific information
    emulation_initialize() {
        // things CPUTool needs to know about our ISA
        this.line_comment = '//';
        this.block_comment_start = '/*';
        this.block_comment_end = '*/';
        this.little_endian = true;

        this.register_nbits = 64;  // 64-bit registers
        this.inst_nbits = 32;      // size of instruction in bits (multiple of 8)
        this.word_nbits = 32;      // size of memory word in bits (multiple of 8)

        // addresses are always byte addresses; addresses are Numbers
        this.data_section_alignment = 256;
        this.bss_section_alignment = 8;
        this.address_space_alignment = 256;

        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 31;

        // ISA-specific tables and storage
        this.pc = 0n;
        this.register_file = new Array(32 + 1);    // include extra reg for writes to xzr
        this.memory = new DataView(new ArrayBuffer(256));  // assembly will replace this

        this.register_info();
        this.opcode_info();
        this.opcode_handlers();

        // reset to initial state
        this.emulation_reset();
    }

    // reset emulation state to initial values
    emulation_reset() {
        this.pc = 0n;
        this.register_file.fill(0n);

        if (this.assembler_memory !== undefined) {
            // allocate working copy of memory if needed
            if (this.memory === undefined || this.memory.byteLength != this.assembler_memory.byteLength) {
                this.memory = new DataView(new ArrayBuffer(this.assembler_memory.byteLength));
                this.inst_decode = Array(this.memory.byteLength/4);  // holds decoded inst objs
            }

            // initialize memory by copying contents from assembler_memory
            new Uint8Array(this.memory.buffer).set(new Uint8Array(this.assembler_memory.buffer));
        }
    }

    // execute a single instruction
    emulation_step(update_display) {
        if (update_display) this.clear_highlights();

        // have we already decoded the instruction?
        let info = this.inst_decode[this.pc / 4];

        // if not, do it now...
        if (info === undefined) {
            const inst = this.memory.getUint32(this.pc,true);
            this.disassemble(inst, this.pc);   // fills in inst_decode
            info = this.inst_decode[this.pc/4];
            if (info === undefined) {
                throw 'Cannot decode instruction at ' + this.pc;
            }
        }

        // handler function will emulate instruction
        // if gui is passed, handler will call the appropriate gui update functions
        info.handler(info, update_display);

        // update PC and disassembly displays
        if (update_display) this.next_pc(this.pc);
    }

    emulation_pc() {
        return this.pc;
    }

    //////////////////////////////////////////////////
    // ISA registers
    //////////////////////////////////////////////////

    // set up this.registers, this.register_names
    register_info() {
        // map token (register name) => register number
        this.registers = new Map();
        for (let i = 0; i <= 30; i += 1) {
            this.registers.set('x'+i, i);
            this.registers.set('w'+i, i);
        }

        this.registers.set('xzr', 31);
        this.registers.set('sp', 28);
        this.registers.set('fp', 29);
        this.registers.set('lr', 30);

        this.register_names = this.registers;
    }

    //////////////////////////////////////////////////
    // ISA opcodes
    //////////////////////////////////////////////////

    /*
      ADD    (o = 0, S = 0)
      ADDS   (o = 0, S = 1)   [CMN]
      SUB    (o = 1, S = 0))
      SUBS   (o = 1, S = 1)   [CMP, NEGS]
        "zoS01011001mmmmmoooiiinnnnnnnnnn"   extended register (SP)
        "zoS01011ss0mmmmmiiiiiinnnnnddddd"   shifted registers (LSL,LSR,ASR,RSVD)
        "zoS100010siiiiiiiiiiiinnnnnddddd"   immediate (unsigned, <<12, SP)

      ADC  (o = 0, S = 0)
      ADCS (o = 0, S = 1)
      SBC  (o = 1, S = 0)   [NGC]
      SBCS (o = 1, S = 1)   [NGCS]
        "zoS11010000mmmmm000000nnnnnddddd"
        "zo011010000mmmmm000000nnnnnddddd"

      AND    (oo = 00, N = 0)
      ANDS   (oo = 11, N = 0)   [TST]
      BIC    (oo = 00, N = 1)
      BICS   (oo = 11, N = 1)
      EON    (oo = 10, N = 1)
      EOR    (oo = 10, N = 0)
      ORR    (oo = 01, N = 0)   [MOV]
      ORN    (oo = 01, N = 1)   [MOVN]
        "zoo01010ss0mmmmmiiiiiinnnnnddddd"   shifted register (LSL,LSR,ASR,ROR)
        "zoo100100Nrrrrrrssssssnnnnnddddd"   immediate

      ADR
      ADRP
        "Pii10000IIIIIIIIIIIIIIIIIIIddddd"   imm = I<<2 | i

      MADD (o = 0)   [MUL]
      MSUB (o = 1)   [MNEG]
        "z0011011000mmmmmoaaaaannnnnddddd"

      SDIV (o = 1)
      UDIV (o = 0)
        "z0011010110mmmmm00001onnnnnddddd"

      SMADDL (o = 0, U = 0)   [SMULL]
      SMSUBL (o = 1, U = 0)   [SMNEGL]
      UMADDL (o = 0, U = 1)
      UMSUBL (o = 1, U = 1)
        "10011011U01mmmmmoaaaaannnnnddddd"

      LSLV (reg, oo = 00)      [LSL]
      LSRV (reg, oo = 01)      [LSR]
      ASRV (reg, oo = 10)      [ASR]
      RORV (reg, oo = 11)      [ROR]
        "z0011010110mmmmm0010oonnnnnddddd"

      MOVK (o = 11)
      MOVN (o = 00)    [MOV]
      MOVZ (o = 10)    [MOV]
        "zoo100101hhiiiiiiiiiiiiiiiiddddd"     imm = i << (h << 4)

      SBFM (o = 00)   [ASR, SBFIZ, SBFX, SXTB, SXTH, SXTW]
      BFM  (o = 01)   [BFC, BFI, BFXIL]
      UBFM (o = 10)   [LSL, LSR, UBFIZ, UBFX, UXTB, UXTH]
        "zoo100110Nrrrrrrssssssnnnnnddddd"
        "zoo100110Nrrrrrrssssssnnnnnddddd"

      CLS (x=1)
      CLZ (x=0)
        "z10110101100000000010xnnnnnddddd"

      EXTR (nb: z == N)   [ROR]
        "z00100111N0mmmmmiiiiiinnnnnddddd"

      RBIT
        "z101101011000000000000nnnnnddddd"

      REV (o = 1x)    [REV64]
      REV16 (o = 01)
      REV32 (o = 10)
      REV64 (o = 11)
        "z1011010110000000000oonnnnnddddd"
      SBFM (o = 00)   [ASR, SBFIZ, SBFX, SXTB, SXTH, SXTW]
        "z00100110Nrrrrrrssssssnnnnnddddd"

      B  (L = 0)
      BL (L = 1)
        "L00101IIIIIIIIIIIIIIIIIIIIIIIIII"

      BEQ (c = 0, Z)
      BNE (c = 1, !Z)
      BCS/BHS (c = 2, C)
      BCC/BLO (c = 3, !C)
      BMI (c = 4, N)
      BPL (c = 5, !N)
      BVS (c = 6, V)
      BVC (c = 7, !V)
      BHI (c = 8, C & !Z)
      BLS (c = 9, !C | Z)
      BGE (c = 10, N = V)
      BLT (c = 11, N != V)
      BGT (c = 12, !Z & N=V)
      BLT (c = 13, Z | N!=V)
      BAL (c = 14/15, --)
        "01010100IIIIIIIIIIIIIIIIIII0cccc"

      BLR
        "1101011000111111000000nnnnnddddd"

      BR
        "1101011000011111000000nnnnn00000"

      CBNZ (x=1)
      CBZ  (x=0)
        "z011010xIIIIIIIIIIIIIIIIIIIttttt"

      RET
        "1101011001011111000000nnnnnmmmmm"

      TBZ (o = 0)
      TBNZ (o = 1)
        "c011011obbbbbIIIIIIIIIIIIIIttttt"   bit_pos = {c,b}

      LDP (o = 0, L = 1)  (Xt, Xu)
      LDPSW (o = 1, L = 1)
      STP (o = 0, L = 0)  
        ".o1010001Liiiiiiiuuuuunnnnnttttt"   post-index
        ".o1010011Liiiiiiiuuuuunnnnnttttt"   pre-index
        ".o1010010Liiiiiiiuuuuunnnnnttttt"   signed-offset

      LDR (xx = 1z, oo = 01)
      LDUR (xx = 1z, oo = 01)
      LDRSW (xx = 10, oo = 10)
      LDURSW (xx = 10, oo = 10)
      STR (xx = 1z, oo = 00)
        "xx111000oo0IIIIIIIII00nnnnnttttt"   LDUR...
        "xx111000oo0IIIIIIIII01nnnnnttttt"   post-index
        "xx111000oo0IIIIIIIII11nnnnnttttt"   pre-index
        "xx111001ooIIIIIIIIIIIInnnnnttttt"   unsigned-offset
        "xx011000IIIIIIIIIIIIIIIIIIIttttt"   pc-relative
        "xx111000oo1mmmmmsssS10nnnnnttttt"   register (s=010:UXTW,011:LSL,110:SXTW,111:SXTX)

      LDRB (xx = 00, oo = 01)
      LDURB (xx = 00, oo = 01)
      LDRSB (xx = 00, oo = 10)
      LDURSB (xx = 00, oo = 10)
      LDRH (xx = 01, oo = 01)
      LDURH (xx = 00, oo = 01)
      LDRSH (xx = 01, oo = 10)
      LDURSH (xx = 01, oo = 10)
      STRB,STURB (xx = 00, oo = 00)
      STRH, STURH (xx = 01, oo = 00)
        "xx111000oo0IIIIIIIII00nnnnnttttt"   LDUR..., STUR...
        "xx111000oo0IIIIIIIII01nnnnnttttt"   post-index
        "xx111000oo0IIIIIIIII11nnnnnttttt"   pre-index
        "xx111001ooIIIIIIIIIIIInnnnnttttt"   unsigned-offset
        "xx111000oo1mmmmmsssS10nnnnnttttt"   extended register (s=010:UXTW,110:SXTW,111:SXTX)
        "xx111000oo1mmmmmsssS10nnnnnttttt"   shifted register (s = 011)
    */

    opcode_info() {
        // LEGv8 from H&P
        this.inst_codec = new SimTool.InstructionCodec({
            add:    {pattern: "10001011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            addi:   {pattern: "1001000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            addis:  {pattern: "1011000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            adds:   {pattern: "10101011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            and:    {pattern: "10001010000mmmmmaaaaaannnnnddddd", type: "R"},
            andi:   {pattern: "1001001000IIIIIIIIIIIInnnnnddddd", type: "I"},
            andis:  {pattern: "1111001000IIIIIIIIIIIInnnnnddddd", type: "I"},
            ands:   {pattern: "11101010ss0mmmmmaaaaaannnnnddddd", type: "R"},
            b:      {pattern: "000101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},

            'b.eq': {pattern: "01010100IIIIIIIIIIIIIIIIIII00000", type: "CB"},
            'b.ne': {pattern: "01010100IIIIIIIIIIIIIIIIIII00001", type: "CB"},
            'b.hs': {pattern: "01010100IIIIIIIIIIIIIIIIIII00010", type: "CB"},
            'b.lo': {pattern: "01010100IIIIIIIIIIIIIIIIIII00011", type: "CB"},
            'b.mi': {pattern: "01010100IIIIIIIIIIIIIIIIIII00100", type: "CB"},
            'b.pl': {pattern: "01010100IIIIIIIIIIIIIIIIIII00101", type: "CB"},
            'b.vs': {pattern: "01010100IIIIIIIIIIIIIIIIIII00110", type: "CB"},
            'b.vc': {pattern: "01010100IIIIIIIIIIIIIIIIIII00111", type: "CB"},
            'b.hi': {pattern: "01010100IIIIIIIIIIIIIIIIIII01000", type: "CB"},
            'b.ls': {pattern: "01010100IIIIIIIIIIIIIIIIIII01001", type: "CB"},
            'b.ge': {pattern: "01010100IIIIIIIIIIIIIIIIIII01010", type: "CB"},
            'b.lt': {pattern: "01010100IIIIIIIIIIIIIIIIIII01011", type: "CB"},
            'b.gt': {pattern: "01010100IIIIIIIIIIIIIIIIIII01100", type: "CB"},
            'b.le': {pattern: "01010100IIIIIIIIIIIIIIIIIII01101", type: "CB"},
            'b.al': {pattern: "01010100IIIIIIIIIIIIIIIIIII01110", type: "CB"},
            'b.nv': {pattern: "01010100IIIIIIIIIIIIIIIIIII01111", type: "CB"},

            bl:     {pattern: "100101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},
            br:     {pattern: "11010110000mmmmmaaaaaannnnnddddd", type: "R"},
            cbnz:   {pattern: "10110101IIIIIIIIIIIIIIIIIIIttttt", type: "CB"},
            cbz:    {pattern: "10110100IIIIIIIIIIIIIIIIIIIttttt", type: "CB"},
            eor:    {pattern: "11001010000mmmmmaaaaaannnnnddddd", type: "R"},
            eori:   {pattern: "1101001000IIIIIIIIIIIInnnnnddddd", type: "I"},
            //fadds:  {pattern: "00011110001mmmmm001010nnnnnddddd", type: "R"},
            //faddd:  {pattern: "00011110011mmmmm001010nnnnnddddd", type: "R"},
            //fcmps:  {pattern: "00011110001mmmmm001000nnnnnddddd", type: "R"},
            //fcmpd:  {pattern: "00011110011mmmmm001000nnnnnddddd", type: "R"},
            //fdivs:  {pattern: "00011110001mmmmm000110nnnnnddddd", type: "R"},
            //fdivd:  {pattern: "00011110011mmmmm000110nnnnnddddd", type: "R"},
            //fmuls:  {pattern: "00011110001mmmmm000010nnnnnddddd", type: "R"},
            //fmuld:  {pattern: "00011110011mmmmm000010nnnnnddddd", type: "R"},
            //fsubs:  {pattern: "00011110001mmmmm001110nnnnnddddd", type: "R"},
            //fsubd:  {pattern: "00011110011mmmmm001110nnnnnddddd", type: "R"},
            ldur:   {pattern: "11111000010IIIIIIIII00nnnnnttttt", type: "D"},
            ldurb:  {pattern: "00111000010IIIIIIIII00nnnnnttttt", type: "D"},
            //ldurd:  {pattern: "11111000010IIIIIIIII00nnnnnttttt", type: "D"},
            ldurh:  {pattern: "01111000010IIIIIIIII00nnnnnttttt", type: "D"},
            //ldurs:  {pattern: "10111100010IIIIIIIII00nnnnnttttt", type: "D"},
            ldursw: {pattern: "10111000100IIIIIIIII00nnnnnttttt", type: "D"},
            ldxr:   {pattern: "1100100001011111011111nnnnnttttt", type: "D"},
            lsl:    {pattern: "11010011011mmmmmaaaaaannnnnddddd", type: "R"},
            lsr:    {pattern: "11010011010mmmmmaaaaaannnnnddddd", type: "R"},
            movk:   {pattern: "111100101IIIIIIIIIIIIIIIIIIddddd", type: "IM"},
            movz:   {pattern: "110100101IIIIIIIIIIIIIIIIIIddddd", type: "IM"},
            mul:    {pattern: "10011011000mmmmm011111nnnnnddddd", type: "R"},
            orr:    {pattern: "10101010000mmmmmaaaaaannnnnddddd", type: "R"},
            orri:   {pattern: "1011001000IIIIIIIIIIIInnnnnddddd", type: "I"},
            sdiv:   {pattern: "10011010110mmmmm000010nnnnnddddd", type: "R"},
            smulh:  {pattern: "10011011010mmmmm011111nnnnnddddd", type: "R"},
            stur:   {pattern: "11111000000IIIIIIIII00nnnnnttttt", type: "D"},
            sturb:  {pattern: "00111000000IIIIIIIII00nnnnnttttt", type: "D"},
            //sturd : {pattern: "11111100000IIIIIIIII00nnnnnttttt", type: "D"},
            sturh:  {pattern: "01111000000IIIIIIIII00nnnnnttttt", type: "D"},
            //sturs:  {pattern: "10111100000IIIIIIIII00nnnnnttttt", type: "D"},
            sturw:  {pattern: "10111000000IIIIIIIII00nnnnnttttt", type: "D"},
            stxr:   {pattern: "11001000000IIIIIIIII00nnnnnttttt", type: "D"},
            sub:    {pattern: "11001011000mmmmmaaaaaannnnnddddd", type: "R"},
            subi:   {pattern: "1101000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            subis:  {pattern: "1111000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            subs:   {pattern: "11101011000mmmmmaaaaaannnnnddddd", type: "R"},
            udiv:   {pattern: "10011010110mmmmm000011nnnnnddddd", type: "R"},
            umulh:  {pattern: "10011011110mmmmm011111nnnnnddddd", type: "R"},
        });

        // define macros for official pseudo ops
        // remember to escape the backslashes in the macro body!
        this.assembly_prologue = `
`;
    }

    // return text representation of instruction at addr
    disassemble(addr) {
        const inst = this.memory.getUint32(addr,this.little_endian);

    }

    // NB: rd fields of zero are redirected to this.register_file[32]
    disassemble_opcode(v, opcode, info, addr) {
        return opcode + '???';
    }

    // define functions that emulate each opcode
    opcode_handlers() {
        const tool = this;  // for reference by handlers

        this.inst_handlers = new Map();  // execution handlers: opcode => function
    }

    //////////////////////////////////////////////////
    // Assembly
    //////////////////////////////////////////////////

    // interpret operand as a register, returning its number
    // or undefined it's not a register
    expect_register(operand, oname) {
        if (operand.length === 1) {
            const rinfo = this.registers.get(operand[0].token);
            if (rinfo) return rinfo.bin;
        }
        this.syntax_error(`Register name expected for the ${oname} operand`,
                          operand[0].start, operand[operand.length - 1].end);
        return undefined;   // never executed...
    }

    // interpret operand as an offset, base, (base), or offset(base), return {offset:, base:}
    // or undefined it's not a base and offset expression
    expect_base_and_offset(operand) {
        const len = operand.length;
        const result = {offset: 0, base: 0};

        // check for base register
        if (len === 1 && this.registers.has(operand[0].token)) {
            result.base = this.registers.get(operand[0].token).bin;
            return result;
        }

        // check for (base)
        if (len >= 3 && operand[len-1].token === ')' && operand[len-3].token === '(') {
            const reg = operand[len-2].token;
            if (this.registers.has(reg)) {
                result.base = this.registers.get(reg).bin;
                operand = operand.slice(0,-3);   // remove (base) from token list
            } else
                throw operand[len-2].asSyntaxError('Expected a register name');
        }

        // check for offset
        if (operand.length > 0) {
            const offset = this.read_expression(operand);
            if (this.pass === 2 && offset !== undefined) {
                result.offset = Number(this.eval_expression(offset));   // avoid BigInts
                if (result.offset < -2048 || result.offset > 2047)
                    this.syntax_error(`Expression evaluates to ${result.offset.toString()}, which is too large to fit in the 12-bit immediate field. `,
                                      operand[0].start, operand[operand.length - 1].end);
            }
        }

        return result;
    }

    // return Array of operand objects
    parse_operands(operands) {
        let result = [];
        let index = 0;

        while (index < operands.length) {
            let operand = operands[index++];   // list of tokens
            let j = 0;

            let token = operand[j]
            let tstring = (token.type == 'number') ? '' : token.token.toLowerCase();

            // register name
            if (this.registers.has(tstring)) {
                result.push({register: tstring});
                j += 1;
                if (j < operand.length)
                    throw this.syntax_error(`Register name expected`,
                                            operand[0].start, operand[operand.length - 1].end);
            } else if (tstring.match(/lsl|lsr|asr|ror|[su]xt[bhwx]/)) {
                // op2: shifted or extended register indicators for previous register operand
                j += 1;
                if (operand[j].token == '#') j += 1;
                const prev = result[result.length - 1];
                if (prev !== undefined && prev.register !== undefined) {
                    prev.shift = tstring;
                    console.log(tstring, operand.slice(j));
                    prev.shamt = this.read_expression(operand,j);
                } else 
                    throw this.syntax_error(`Bad register for register shift or extension`,
                                            operand[0].start, operand[operand.length - 1].end);
            } else if (tstring == '[') {
                // address operand
                let astart = j+1;
                let aend = operand.length - 1;

                // look for pre-index indicator
                let pre_index = false;
                if (operand[aend].token === '!') { pre_index = true; aend -= 1; }

                if (operand[aend].token !== ']')
                    throw this.syntax_error('Unrecognized address operand format',
                                            operand[0].start, operand[operand.length - 1].end);

                // now parse what was between [ and ]
                // handle internal ',' if any
                let addr = [[]];  // will add second element if needed for offset
                while (astart < aend) {
                    if (operand[astart].token === ',') addr.push([]);
                    else addr[addr.length - 1].push(operand[astart]);
                    astart += 1;
                }
                result.push({pre_index: pre_index,
                             addr: this.parse_operands(addr)
                            });
            } else {
                // immediate operand
                if (operand[j].token == '#') j += 1;
                const imm = this.read_expression(operand,j);

                // is this a post-index for previous address operand?
                const prev = result[result.length - 1];
                if (prev !== undefined && prev.addr !== undefined)
                    prev.post_index = imm;
                else
                    // not a post index, so it's an immediate operand
                    result.push({imm: imm});
            }
        }

        return result
    }

    // return undefined if opcode not recognized, otherwise number of bytes
    // occupied by assembled instruction.
    // Call results.emit32(inst) to store binary into main memory at dot.
    // Call results.syntax_error(msg, start, end) to report an error
    assemble_opcode(opcode, operands) {
        operands = this.parse_operands(operands)

        console.log(opcode.token, operands);
        return 0;

        /*
        const info = this.opcodes.get(opcode.token.toLowerCase());

        if (info === undefined) return undefined;

        return undefined;
        */
    }

};

//////////////////////////////////////////////////
// ARMV8A syntax coloring
//////////////////////////////////////////////////

CodeMirror.defineMode('ARMV8A', function() {
    'use strict';

    const line_comment = '//';
    const block_comment_start = '/*';
    const block_comment_end = '*/';

    // consume characters until end character is found
    function nextUntilUnescaped(stream, end) {
        let escaped = false, next;
        while ((next = stream.next()) != null) {
            if (next === end && !escaped) {
                return false;
            }
            escaped = !escaped && next === "\\";
        }
        return escaped;
    }

    // consume block comment
    function clikeComment(stream, state) {
        let maybeEnd = false, ch;
        while ((ch = stream.next()) != null) {
            if (ch === "/" && maybeEnd) {
                state.tokenize = null;
                break;
            }
            maybeEnd = (ch === "*");
        }
        return "comment";
    }

    let directives = [
        '.align',
        '.ascii',
        '.asciz',
        '.bss',
        '.byte',
        '.data',
        '.dword',
        '.global',
        '.hword',
        '.include',
        '.section',
        '.text',
        '.word'
    ];

    let registers = [
        'x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7',
        'x8', 'x9', 'x10', 'x11', 'x12', 'x23', 'x14', 'x15',
        'x16','x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
        'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'xzr',
        'sp', 'fp', 'lr',
    ];

    // mode object for CodeMirror
    return {
        mode_name: 'ARMV8A',
        lineComment: '//',
        blockCommentStart: '/*',
        blockCommentEnd: '*/',

        startState: function() { return { tokenize: null }; },

        // consume next token, return its CodeMirror syntax style
        token: function(stream, state) {
            if (state.tokenize) return state.tokenize(stream, state);

            if (stream.eatSpace()) return null;

            let ch = stream.next();

            // block and line comments
            if (ch === "/") {
                if (stream.eat("*")) {
                    state.tokenize = clikeComment;
                    return clikeComment(stream, state);
                }
                if (stream.eat("/")) {
                    stream.skipToEnd();
                    return "comment";
                }
            }

            // string
            if (ch === '"') {
                nextUntilUnescaped(stream, '"');
                return "string";
            }

            // directive
            if (ch === '.') {
                stream.eatWhile(/\w/);
                const cur = stream.current().toLowerCase();
                return directives.find(element => element===cur) !== undefined ? 'builtin' : null;
            }

            // symbol assignment
            if (ch === '=') {
                stream.eatWhile(/\w/);
                return "tag";
            }

            if (ch === '{') {
                return "bracket";
            }

            if (ch === '}') {
                return "bracket";
            }

            // numbers
            if (/\d/.test(ch)) {
                if (ch === "0" && stream.eat(/[xXoObB]/)) {
                    stream.eatWhile(/[0-9a-fA-F]/);
                    return "number";
                }
                if (stream.eat(/[bBfF]/)) {
                    return 'tag';
                }
                stream.eatWhile(/\d/);
                if (stream.eat(':')) {
                    return 'tag';
                }
                return "number";
            }

            // symbol
            if (/\w/.test(ch)) {
                stream.eatWhile(/\w/);
                if (stream.eat(":")) {
                    return 'tag';
                }
                const cur = stream.current().toLowerCase();
                return registers.find(element => element==cur) !== undefined ? 'keyword' : null;
            }

            return undefined;
        },
    };
});

// set up GUI in any div.armv8a_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('armv8a_tool')) {
        new SimTool.ARMV8ATool(div);
    }
});
