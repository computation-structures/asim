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
        const EA = this.va_to_phys(this.pc);
        const EAindex = EA / 4;
        let info = this.inst_decode[EAindex];

        // if not, do it now...
        if (info === undefined) {
            this.disassemble(EA, this.pc);   // fills in inst_decode
            info = this.inst_decode[EA/4];
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
            //this.registers.set('w'+i, i);
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

    opcode_info() {
        const tool = this;  // for reference by handlers

        // This table has separate opcodes for different instruction formats, eg, "add" and "addi"
        // order matters! put aliases before corresponding more-general opcode
        tool.opcode_list = [
            {opcode: 'asri',   pattern: "10001011100nnnnniiiiii11111ddddd", type: "I"},  // ADD Xd,XZR,Xn,ASR #a
            {opcode: 'cmp',    pattern: "11101011ss0mmmmmaaaaaannnnn11111", type: "R"},  // n==31: SP // SUBS XZR,Xn,Xm
            {opcode: 'cmpi',   pattern: "1111000100iiiiiiiiiiiinnnnnddddd", type: "I"},  // n==31: SP // SUBIS XZR,Xn,#i
            {opcode: 'lsli',   pattern: "10001011000nnnnniiiiii11111ddddd", type: "I"},  // ADD Xd,XZR,Xn,LSL #a
            {opcode: 'lsri',   pattern: "10001011010nnnnniiiiii11111ddddd", type: "I"},  // ADD Xd,XZR,Xn,LSR #a
            {opcode: 'mov',    pattern: "1001000100000000000000nnnnnddddd", type: "I"},  // n,d==31: SP  // ADDI Xd,Xn,#0
            {opcode: 'movi',   pattern: "110100101ssiiiiiiiiiiiiiiiiddddd", type: "I"},  // MOVZ Xd, #i, LSL #0
            {opcode: 'tst',    pattern: "11101010ss0mmmmmaaaaaannnnn11111", type: "R"},  // ANDS XZR,Xn,Xm
            {opcode: 'tstm',   pattern: "111100100Nrrrrrrssssssnnnnn11111", type: "IM"}, // ANDMS XZR,Xn,Xm

            {opcode: 'add',    pattern: "10001011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'addi',   pattern: "100100010siiiiiiiiiiiinnnnnddddd", type: "I"},  // n,d==31: SP
            {opcode: 'addis',  pattern: "101100010siiiiiiiiiiiinnnnnddddd", type: "I"},  // n,d==31: SP
            {opcode: 'adds',   pattern: "10101011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'and',    pattern: "10001010000mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'andm',   pattern: "100100100Nrrrrrrssssssnnnnnddddd", type: "IM"},
            {opcode: 'andms',  pattern: "111100100Nrrrrrrssssssnnnnnddddd", type: "IM"},
            {opcode: 'ands',   pattern: "11101010ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'bic',    pattern: "10001010ss1mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'bics',   pattern: "11101010ss1mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'asr',    pattern: "10011010110mmmmm001010nnnnnddddd", type: "R"},
            {opcode: 'b',      pattern: "000101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},
            {opcode: 'b.eq',   pattern: "01010100IIIIIIIIIIIIIIIIIII00000", type: "CB"},
            {opcode: 'b.ne',   pattern: "01010100IIIIIIIIIIIIIIIIIII00001", type: "CB"},
            {opcode: 'b.hs',   pattern: "01010100IIIIIIIIIIIIIIIIIII00010", type: "CB"},
            {opcode: 'b.lo',   pattern: "01010100IIIIIIIIIIIIIIIIIII00011", type: "CB"},
            {opcode: 'b.mi',   pattern: "01010100IIIIIIIIIIIIIIIIIII00100", type: "CB"},
            {opcode: 'b.pl',   pattern: "01010100IIIIIIIIIIIIIIIIIII00101", type: "CB"},
            {opcode: 'b.vs',   pattern: "01010100IIIIIIIIIIIIIIIIIII00110", type: "CB"},
            {opcode: 'b.vc',   pattern: "01010100IIIIIIIIIIIIIIIIIII00111", type: "CB"},
            {opcode: 'b.hi',   pattern: "01010100IIIIIIIIIIIIIIIIIII01000", type: "CB"},
            {opcode: 'b.ls',   pattern: "01010100IIIIIIIIIIIIIIIIIII01001", type: "CB"},
            {opcode: 'b.ge',   pattern: "01010100IIIIIIIIIIIIIIIIIII01010", type: "CB"},
            {opcode: 'b.lt',   pattern: "01010100IIIIIIIIIIIIIIIIIII01011", type: "CB"},
            {opcode: 'b.gt',   pattern: "01010100IIIIIIIIIIIIIIIIIII01100", type: "CB"},
            {opcode: 'b.le',   pattern: "01010100IIIIIIIIIIIIIIIIIII01101", type: "CB"},
            {opcode: 'b.al',   pattern: "01010100IIIIIIIIIIIIIIIIIII01110", type: "CB"},
            {opcode: 'bl',     pattern: "100101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},
            {opcode: 'br',     pattern: "11010110000mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'cbnz',   pattern: "10110101IIIIIIIIIIIIIIIIIIIddddd", type: "CB"},
            {opcode: 'cbz',    pattern: "10110100IIIIIIIIIIIIIIIIIIIddddd", type: "CB"},
            {opcode: 'eon',    pattern: "11001010ss1mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'eor',    pattern: "11001010ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'eorm',   pattern: "110100100Nrrrrrrssssssnnnnnddddd", type: "IM"},
            {opcode: 'ldur',   pattern: "11111000010IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldurb',  pattern: "00111000010IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldurh',  pattern: "01111000010IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldurw',  pattern: "10111000010IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP // LDUR Wd,[Xn,#i]
            {opcode: 'ldursb', pattern: "00111000100IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldursh', pattern: "01111000100IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldursw', pattern: "10111000100IIIIIIIII00nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'ldxr',   pattern: "1100100001011111011111nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'lsl',    pattern: "10011010110mmmmm001000nnnnnddddd", type: "R"},
            {opcode: 'lsr',    pattern: "10011010110mmmmm001001nnnnnddddd", type: "R"},
            {opcode: 'movk',   pattern: "111100101IIIIIIIIIIIIIIIIIIddddd", type: "M"},
            {opcode: 'movz',   pattern: "110100101IIIIIIIIIIIIIIIIIIddddd", type: "M"},
            {opcode: 'mul',    pattern: "10011011000mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'orn',    pattern: "10101010ss1mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'orr',    pattern: "10101010ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'orrm',   pattern: "101100100Nrrrrrrssssssnnnnnddddd", type: "IM"},
            {opcode: 'sdiv',   pattern: "10011010110mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'smulh',  pattern: "10011011010mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'stur',   pattern: "11111000000IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sturb',  pattern: "00111000000IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sturh',  pattern: "01111000000IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sturw',  pattern: "10111000000IIIIIIIII00nnnnnttttt", type: "D"}, // STUR Wt,[Xn,#i]
            {opcode: 'stxr',   pattern: "11001000000IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sub',    pattern: "11001011000mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'subi',   pattern: "110100010siiiiiiiiiiiinnnnnddddd", type: "I"}, // n,d==31: SP
            {opcode: 'subis',  pattern: "111100010siiiiiiiiiiiinnnnnddddd", type: "I"}, // n==31: SP
            {opcode: 'subs',   pattern: "11101011000mmmmmaaaaaannnnnddddd", type: "R"}, // n==31: SP
            {opcode: 'udiv',   pattern: "10011010110mmmmm000011nnnnnddddd", type: "R"},
            {opcode: 'umulh',  pattern: "10011011110mmmmm011111nnnnnddddd", type: "R"},

            /*
            {opcode: 'fadds', pattern: "00011110001mmmmm001010nnnnnddddd", type: "R"},
            {opcode: 'faddd', pattern: "00011110011mmmmm001010nnnnnddddd", type: "R"},
            {opcode: 'fcmps', pattern: "00011110001mmmmm001000nnnnnddddd", type: "R"},
            {opcode: 'fcmpd', pattern: "00011110011mmmmm001000nnnnnddddd", type: "R"},
            {opcode: 'fdivs', pattern: "00011110001mmmmm000110nnnnnddddd", type: "R"},
            {opcode: 'fdivd', pattern: "00011110011mmmmm000110nnnnnddddd", type: "R"},
            {opcode: 'fmuls', pattern: "00011110001mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'fmuld', pattern: "00011110011mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'fsubs', pattern: "00011110001mmmmm001110nnnnnddddd", type: "R"},
            {opcode: 'fsubd', pattern: "00011110011mmmmm001110nnnnnddddd", type: "R"},
            {opcode: 'ldurd', pattern: "11111000010IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'ldurs', pattern: "10111100010IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sturd ', pattern: "11111100000IIIIIIIII00nnnnnttttt", type: "D"},
            {opcode: 'sturs', pattern: "10111100000IIIIIIIII00nnnnnttttt", type: "D"},
            */
        ];
        tool.inst_codec = new SimTool.InstructionCodec(tool.opcode_list, this);

        // define macros for official pseudo ops
        // remember to escape the backslashes in the macro body!
        tool.assembly_prologue = `
`;

        // is operand a register name: return regnumber or undefined
        function is_register(operand) {
            return (operand !== undefined && operand.length === 1 && operand[0].type=='symbol') ?
                tool.registers.get(operand[0].token.toLowerCase()) : undefined;
        }

        // is operand an immediate?  return expression tree or undefined
        function is_immediate(operand) {
            return ((operand !== undefined && operand[0].type==='operator' && operand[0].token==='#' ) ?
                    tool.read_expression(operand,1) : undefined);
        }

        // interpret operand as a register
        function expect_register(operand, fields, fname) {
            const reg = is_register(operand);
            if (reg === undefined)
                tool.syntax_error(`Register name expected`,
                                  operand[0].start, operand[operand.length - 1].end);
            return reg;
        }

        // interpret operand as an immediate
        function expect_immediate(operand, minv, maxv) {
            const imm = is_immediate(operand);
            if (imm !== undefined) {
                const v = tool.pass === 2 ? Number(tool.eval_expression(imm)) : 0;
                if (v < minv || v > maxv)
                    tool.syntax_error(`Immediate value ${v} out of range ${minv}:${maxv}`,
                                      operand[0].start, operand[operand.length - 1].end);
                return v;
            }
            tool.syntax_error(`Immediate expression expected`,
                              operand[0].start, operand[operand.length - 1].end);
            return undefined;   // never executed...
        }

        // is this number's binary representation all 1s?
        function is_mask(n) { return ((n + 1n) & n) == 0; }

        // is this number's binary representation a sequence
        // of 1's followed by a sequence of 0's
        function is_shifted_mask(n) { return is_mask((n - 1n) | n); }

        // number of trailing zeroes in binary representation
        function trailing_0s(n) {
            for (let i = 0; i < 64; i += 1, n >> 1n)
                if ((n & 1n) == 1n) return i;
            return 64;
        }

        // number of trailing ones in binary representation
        function trailing_1s(n) {
            for (let i = 0; i < 64; i += 1, n >> 1n)
                if ((n & 1n) == 0n) return i;
            return 64;
        }

        // number of leading ones in binary representation
        function leading_1s(n) {
            for (let i = 0; i < 64; i += 1, n << 1n)
                if ((n & 0x8000000000000000n) === 0x8000000000000000n) return i;
            return 64;
        }

        // Such an immediate is a 32-bit or 64-bit pattern viewed as a vector of identical
        // elements of size e = 2, 4, 8, 16, 32, or 64 bits. Each element contains the same
        // sub-pattern: a single run of 1 to e-1 non-zero bits, rotated by 0 to e-1 bits.
        // This mechanism can generate 5,334 unique 64-bit patterns (as 2,667 pairs of pattern
        // and their bitwise inverse). Because the all-zeros and all-ones values cannot be
        // described in this way, the assembler generates an error message.
        function encode_bitmask_immediate(operand, fields) {
            let mask = is_immediate(operand);
            if (mask === undefined) return false;
            if (tool.pass != 2) {
                fields.N = 1;
                fields.r = 0;
                fields.s = 0;
                fields.mask = 0n;
                return true;
            }

            // https://kddnewton.com/2022/08/11/aarch64-bitmask-immediates.html
            const v = BigInt.asUintN(64,tool.eval_expression(mask));   // value to be encoded
            fields.mask = v;

            // can't encode all 0's or all 1;s
            if (v == 0n || v == 0xFFFFFFFFFFFFFFFFn) return undefined;

            // determine the size of the pattern that we’re dealing with.
            // To do this, we’ll start at 64-bits and work downward. If the binary
            // representation of the value is equal to itself when shifted by 32 bits,
            // then we know we can continue. Otherwise, it must be a 64-bit pattern.
            // Similarly, if the binary representation of the value is equal to itself
            // when shifted by 16 bits, we can continue on. We continue on in this
            // manner until we find the size.
            let imm = v;
            let size = 64;
            mask = 0xFFFFFFFFFFFFFFFFn;
            for (;;) {
                size >>= 1;
                mask >>= 1n;
                if ((imm & mask) != ((imm >> BigInt(size)) & mask)) { size <<= 1; break; }
                if (size <= 2) break;
            }

            // Finally, we can find the number of rotations. If the number is already
            // a shifted mask (i.e., it’s just a series of 1s and then a series of 0s)
            // it’s relatively trivial to find the number of rotations: count the number
            // of trailing 0s. If it’s split up (like 1001), then we need to add together
            // the number of trailing and leading 0s. (Because of number representations,
            // we actually flip all of the bits first to make them 1s first.) 
            let trailing_ones;
            let left_rotations;
            mask = 0xFFFFFFFFFFFFFFFFn >> BigInt(64 - size);
            imm &= mask;
            if (is_shifted_mask(imm)) {
                left_rotations = trailing_0s(imm);
                trailing_ones = trailing_1s(imm >> BigInt(left_rotations));
            } else {
                imm = imm | ~mask;
                if (!is_shifted_mask(~imm)) return false;
                const leading_ones = leading_1s(imm);
                left_rotations = 64 - leading_ones;
                trailing_ones = leading_ones + trailing_1s(imm) - (64 - size);
            }

            // r is the number of right rotations it takes to get from the
            // matching unrotated pattern to the target value.
            fields.r = Number((size - left_rotations) & (size - 1));
            // s is the size of the pattern, a 0, and then one less
            // than the number of sequential 1s.
            fields.s = Number((~(size - 1) << 1) | (trailing_ones - 1));
            // n is 1 if size is 64 bits, 0 otherwisze
            fields.N = 1;
            return true;
        }

        // op Rd, Rn, Rm (, (LSL|LSR|ASR|ROR) #imm)?
        // TST Rn, Rm (, (LSL|LSR|ASR|ROR) #imm)?
        // op Rd, Rn, #imm (, LSL #(0|12))?   [arithmetic]
        // op Rd, Rn, #mask   [logical, test]
        function assemble_op2(opc, operands, context) {
            let noperands = operands.length;   // number of operands
            let eoperands;                     // expected number of operands
            let fields;
            if (context === 'test') {
                eoperands = 2;
                fields = {n: expect_register(operands[0]), m: expect_register(operands[1])};
            } else {
                eoperands = 3;
                fields = {d: expect_register(operands[0]), n: expect_register(operands[1])};
            }

            const m = operands[eoperands - 1];
            if (m !== undefined && m[0].type === 'operator' && m[0].token === '#') {
                if (context == 'arithmetic' || context == 'test') {
                    // switch to corresponding immediate opcode for encoding/decoding
                    opc = {add: 'addi', adds: 'addis', sub: 'subi', subs: 'subis', tst: 'tsti'}[opc];

                    // third operand is immediate
                    fields.i = expect_immediate(m, 0, 4095);
                    fields.s = 0;

                    // check for shift spec
                    if (noperands > eoperands && operands[eoperands][0].type === 'symbol') {
                        const shift = operands[eoperands][0].token.toLowerCase();
                        const s = {lsl: 0}[shift];
                        if (s !== undefined) {
                            fields.a = expect_immediate(operands[eoperands].slice(1), 0, 63);
                            if (!(fields.a === 0 || fields.a === 12))
                                tool.syntax_error(`Immediate shift must be LSL of 0 or 12`,
                                                  operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                            fields.s = (fields.a == 0) ? 0 : 1;
                            noperands -= 1;   // we consumed an operand
                        } else
                            tool.syntax_error(`Immediate shift must be LSL of 0 or 12`,
                                              operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                    }
                } else {
                    // switch to corresponding mask opcode for encoding/decoding
                    const nopc = {and: 'andm', ands: 'andsm', eor: 'eorm', orr: 'orrm', tst: 'tstm'}[opc]
                    if (nopc === undefined) 
                        tool.syntax_error(`Immediate operand not permitted for ${opc.toUpperCase()}`,
                                          m[0].start, m[m.length - 1].end);
                    opc = nopc;

                    if (!encode_bitmask_immediate(m,fields))
                        tool.syntax_error(`Cannot encode immediate as a bitmask`,
                                          m[0].start, m[m.length - 1].end);
                }
            } else {
                if (context !== 'test') {
                    // third operand is register
                    fields.m = expect_register(m);
                }

                // check for shift spec
                fields.a = 0;
                fields.s = 0;
                if (noperands > eoperands && operands[eoperands][0].type === 'symbol') {
                    const shift = operands[3][0].token.toLowerCase();
                    const s = {lsl: 0, lsr: 1, asr: 2, ror: 3}[shift];
                    if (s !== undefined) {
                        if (s == 3 && !(context === 'logical' || context === 'test'))
                            tool.syntax_error(`ROR shift only valid for logic operations`,
                                              operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                        fields.s = s;
                        fields.a = expect_immediate(operands[eoperands].slice(1), 0, 63);
                        noperands -= 1;   // we consumed an operand
                    } else
                        tool.syntax_error(`Unrecognized register-shift operation`,
                                          operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                }
            }
            // ensure correct number of operands
            if (noperands !== eoperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${eoperands} operands`);
            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_op2_arithmetic(opc, operands) {
            return assemble_op2(opc, operands, 'arithmetic');
        }

        function assemble_op2_logical(opc, operands) {
            return assemble_op2(opc, operands, 'logical');
        }

        function assemble_op2_test(opc, operands) {
            return assemble_op2(opc, operands, 'test');
        }

        this.assembly_handlers = new Map();
        this.assembly_handlers.set('add', assemble_op2_arithmetic);
        this.assembly_handlers.set('adds', assemble_op2_arithmetic);
        this.assembly_handlers.set('and', assemble_op2_logical);
        this.assembly_handlers.set('ands', assemble_op2_logical);
        this.assembly_handlers.set('bic', assemble_op2_logical);
        this.assembly_handlers.set('bics', assemble_op2_logical);
        this.assembly_handlers.set('eon', assemble_op2_logical);
        this.assembly_handlers.set('eor', assemble_op2_logical);
        this.assembly_handlers.set('orn', assemble_op2_logical);
        this.assembly_handlers.set('orr', assemble_op2_logical);
        this.assembly_handlers.set('sub', assemble_op2_arithmetic);
        this.assembly_handlers.set('subs', assemble_op2_arithmetic);
        this.assembly_handlers.set('tst', assemble_op2_test);
        

        this.execution_handlers = new Map();  // execution handlers: opcode => function
    }

    // return text representation of instruction at addr
    disassemble(pa, va) {
        const inst = this.memory.getUint32(pa,this.little_endian);
        const result = this.inst_codec.decode(inst);
        if (result === undefined) return undefined;
        console.log(result);

        const info = result.info
        if (va === undefined) va = this.pa2va(pa);
        info.va = va;
        if (this.inst_decode) this.inst_decode[pa/4] = info;   // save all our hard work!

        // redirect writes to XZR to a bit bucket
        info.dest = (info.d === 31) ? 32 : info.d

        if (info.type === 'R') {
            let i = `${info.opcode} x${result.d || 31},x${result.n},x${result.m}`;
            if (result.a) i += `,${['lsl','lsr','asr','ror'][result.s]} #${result.a}`;
            return i;
        }
        if (info.type === 'I') {
            if (info.opcode === 'mov')
                return `mov x${result.d},x${result.n}`;
            else {
                let i = `${info.opcode} x${result.d},x${result.n},#${result.i}`;
                if (result.s) i += `,lsl #${result.s ? 12 : 0}`;
                return i;
            }
        }
        return undefined;
    }

    //////////////////////////////////////////////////
    // Assembly
    //////////////////////////////////////////////////

    // return undefined if opcode not recognized, otherwise true
    // Call this.emit32(inst) to store binary into main memory at dot.
    // Call this.syntax_error(msg, start, end) to report an error
    assemble_opcode(opcode, operands) {
        if (opcode.type !== 'symbol') return undefined;
        const opc = opcode.token.toLowerCase();
        const handler = this.assembly_handlers.get(opc);
        if (handler === undefined) return undefined;
        handler(opc, operands);
        return true;
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