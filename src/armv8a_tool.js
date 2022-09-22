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

    // provide ARMV8A-specific information
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
            // arithmetic
            {opcode: 'adc',    pattern: "10011010000mmmmm000000nnnnnddddd", type: "R"},
            {opcode: 'adcs',   pattern: "10111010000mmmmm000000nnnnnddddd", type: "R"},
            {opcode: 'add',    pattern: "10001011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'addi',   pattern: "100100010siiiiiiiiiiiinnnnnddddd", type: "I"},
            {opcode: 'addis',  pattern: "101100010siiiiiiiiiiiinnnnnddddd", type: "I"},
            {opcode: 'adds',   pattern: "10101011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'adr',    pattern: "0ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},
            {opcode: 'adrp',   pattern: "1ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},
            {opcode: 'madd',   pattern: "10011011000mmmmm0ooooonnnnnddddd", type: "R"},
            {opcode: 'msub',   pattern: "10011011000mmmmm1ooooonnnnnddddd", type: "R"},
            {opcode: 'sbc',    pattern: "11011010000mmmmm000000nnnnnddddd", type: "R"},
            {opcode: 'sbcs',   pattern: "11111010000mmmmm000000nnnnnddddd", type: "R"},
            {opcode: 'sdiv',   pattern: "10011010110mmmmm000011nnnnnddddd", type: "R"},
            {opcode: 'smulh',  pattern: "10011011010mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'sub',    pattern: "11001011000mmmmmaaaaaannnnnddddd", type: "R"},
            {opcode: 'subi',   pattern: "110100010siiiiiiiiiiiinnnnnddddd", type: "I"}, // n,d==31: SP
            {opcode: 'subis',  pattern: "111100010siiiiiiiiiiiinnnnnddddd", type: "I"}, // n==31: SP
            {opcode: 'subs',   pattern: "11101011000mmmmmaaaaaannnnnddddd", type: "R"}, // n==31: SP
            {opcode: 'udiv',   pattern: "10011010110mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'umulh',  pattern: "10011011110mmmmm011111nnnnnddddd", type: "R"},

            // logical and move

            // ss: 00: LSL, 01: LSR, 10: ASR, 11:ROR
            // xxN: 000: and, 001: bic, 010: orr, 011: orn, 100: eor, 101: eon, 110: ands, 111: bics
            {opcode: 'bool',   pattern: "1xx01010ssNmmmmmaaaaaannnnnddddd", type: "R"},

            // xx: 00: andm, 01: orrm, 10: eorm, 11: andms
            {opcode: 'boolm',  pattern: "1xx100100Nrrrrrrssssssnnnnnddddd", type: "IM"},

            // ss: 00: LSL, 01: LSR, 10: ASR, 11:ROR
            {opcode: 'shift',  pattern: "10011010110mmmmm0010ssnnnnnddddd", type: "R"},

            {opcode: 'movk',   pattern: "111100101ssiiiiiiiiiiiiiiiiddddd", type: "M"},
            {opcode: 'movn',   pattern: "100100101ssiiiiiiiiiiiiiiiiddddd", type: "M"},
            {opcode: 'movz',   pattern: "110100101ssiiiiiiiiiiiiiiiiddddd", type: "M"},

            // branch
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

            // load and store
            // ss: 00=str, 01=ldr, 1.=ldrs
            // xx: 00=unscaled offset, 01:post-index, 10: shifted-register, 11: pre-index
            {opcode: 'ldst',   pattern: "zz111000ss0IIIIIIIIIxxnnnnnddddd", type: "D"},
            {opcode: 'ldst.of', pattern:"zz111001ssiiiiiiiiiiiinnnnnddddd", type: "D"},  // unsigned offset
            {opcode: 'ldr.pc', pattern: "01011000IIIIIIIIIIIIIIIIIIIddddd", type: "D"},  // pc offset
            {opcode: 'ldxr',   pattern: "1100100001011111011111nnnnnddddd", type: "D"},  // n==31: SP
            {opcode: 'stxr',   pattern: "11001000000IIIIIIIII00nnnnnttttt", type: "D"},

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

        // is operand a Wn register? return regnumber or undefined
        function is_Wn(operand) {
            if (operand !== undefined && operand.length === 1 && operand[0].type=='symbol') {
                const match = operand[0].token.match(/^[wW](\d+)$/);
                if (match !== null) return parseInt(match[1]);
            }
            return undefined
        }

        // is operand an immediate?  return expression tree or undefined
        function is_immediate(operand) {
            return ((operand !== undefined && operand[0].type==='operator' && operand[0].token==='#' ) ?
                    tool.read_expression(operand,1) : undefined);
        }

        // interpret operand as a register
        function expect_register(operands,index) {
            const operand = operands[index];
            const reg = is_register(operand);
            if (reg === undefined) {
                const first = (operand !== undefined) ? operand: operands[0];
                const last = (operand !== undefined) ? operand: operands[operands.length - 1];
                tool.syntax_error(`Register name expected`,
                                  first[0].start, last[last.length - 1].end);
            }
            return reg;
        }

        // interpret operand as an immediate
        function expect_immediate(operands, index, minv, maxv) {
            const operand = operands[index];
            const imm = is_immediate(operand);
            if (imm !== undefined) {
                const v = tool.pass === 2 ? Number(tool.eval_expression(imm)) : 0;
                if (minv !== undefined && (v < minv || v > maxv)) {
                    tool.syntax_error(`Immediate value ${v} out of range ${minv}:${maxv}`,
                                      operand[0].start, operand[operand.length - 1].end);
                }
                return v;
            }
            const first = operands[0];
            const last = operands[operands.length - 1];
            tool.syntax_error(`Immediate expression expected`,
                              first[0].start, last[last.length - 1].end);
            return undefined;   // never executed...
        }

        // interpret operand as an address:
        //   [Xn{, #i}]
        //   [Xn], #i
        //   [Xn, #i]!
        //   [Xn, Xm{, LSL #0|s}]
        //   *not supported* [Xn, Wm,{S,U}XTW {#0|s}]
        //   [Xn, Xm,{SXTX {#0|s}]
        function expect_addr(operands, index, fields, opc) {
            const operand = operands[index++];
            const aend = operand.length - 1;
            let astart = 1;

            // look for pre-index indicator
            if (operand[aend].type === 'operator' && operand[aend] === '!') {
                fields.post_index = true;
                aend -= 1;
            }

            // make sure operand has the form [...]
            if (operand[0].type !== 'operator' || operand[0].token !== '[' ||
                operand[aend].type !== 'operator' || operand[aend].token !== ']')
                tool.syntax_error('Expected operand of the form [...]',
                                  operand[0].start, operand[aend].end);

            // now parse what's between [ and ]
            // by building array of comma-separated operands
            let addr = [[]];  // will add additional elements if needed
            while (astart < aend) {
                if (operand[astart].type === 'operator' && operand[astart].token === ',') addr.push([]);
                else addr[addr.length - 1].push(operand[astart]);
                astart += 1;
            }
            
            fields.n = expect_register(addr,0);   // Xn

            if (addr.length > 1) {
                fields.m = is_register(addr, 1);      // Xm?
                if (fields.m === undefined) {
                    // no Xm, so what's left should be immediate offset expression
                    // look for post
                    fields.imm = expect_immediate(addr, 1);
                } else {
                    // look for LSL or SXTX shift/extend
                    // more here...
                }
            }
            else if (index < operands.length) {
                // there must be an post-index immediate
                fields.post_index = true;
                fields.imm = expect_immediate(operands, index++, -256, 255)
            }

            if (index >= operands.length) {
                const first = operands[index];
                const last = operands[operands.length - 1];
                tool.syntax_error('Unexpected tokens following address operand',
                                  first[0].start, last[last.length - 1].end);
            }
        }

        // interpret operand as [Xn{, #simm}]
        function expect_base_offset(operands, index, fields) {
            const operand = operands[index];
            const aend = operand.length - 1;
            let astart = 1;

            // make operand has the form [...]
            if (operand[0].type !== 'operator' || operand[0].token !== '[' ||
                operand[aend].type !== 'operator' || operand[aend].token !== ']')
                tool.syntax_error('Expected operand of the form [...]',
                                  operand[0].start, operand[aend].end);

            // now parse what was between [ and ]
            // by building array of comma-separated operands
            // then recursively parse that array
            let addr = [[]];  // will add additional elements if needed
            while (astart < aend) {
                if (operand[astart].type === 'operator' && operand[astart].token === ',') addr.push([]);
                else addr[addr.length - 1].push(operand[astart]);
                astart += 1;
            }

            // just base and (optionally) offset expression?
            if (addr.length > 2) {
                const first = addr[0];
                const last = addr[addr.length - 1];
                tool.syntax_error(`Expected Xd, #simm`,
                                  first[0].start, last[last.length - 1].end)
            }

            fields.n = expect_register(addr,0)
            fields.I = (addr.length === 2) ? expect_immediate(addr, 1, -256, 255) : 0;
        }

        // is this number's binary representation all 1s?
        function is_mask(n) { return ((n + 1n) & n) == 0; }

        // is this number's binary representation a sequence
        // of 1's followed by a sequence of 0's
        function is_shifted_mask(n) { return is_mask((n - 1n) | n); }

        // number of trailing zeroes in binary representation
        function trailing_0s(n) {
            for (let i = 0; i < 64; i += 1, n >>= 1n)
                if ((n & 1n) == 1n) return i;
            return 64;
        }

        // number of trailing ones in binary representation
        function trailing_1s(n) {
            for (let i = 0; i < 64; i += 1, n >>= 1n)
                if ((n & 1n) === 0n) return i;
            return 64;
        }

        // number of leading ones in binary representation
        function leading_1s(n) {
            const hibit = 0x8000000000000000n;
            for (let i = 0; i < 64; i += 1, n <<= 1n)
                if ((n & hibit) === 0n) return i;
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
                fields.N = 0;
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
                mask = (1n << BigInt(size)) - 1n;
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
                imm |= ~mask;
                if (!is_shifted_mask(~imm)) return false;
                const leading_ones = leading_1s(imm);
                left_rotations = 64 - leading_ones;
                trailing_ones = leading_ones + trailing_1s(imm) - (64 - size);
            }

            // r is the number of right rotations it takes to get from the
            // matching unrotated pattern to the target value.
            fields.r = Number((size - left_rotations) & (size - 1)) & 0x3F;
            // s is the size of the pattern, a 0, and then one less
            // than the number of sequential 1s.
            let imms = Number((~(size - 1) << 1) | (trailing_ones - 1));
            fields.s = imms & 0x3F;
            // n is 1 if element size is 64 bits, 0 otherwisze
            fields.N = ((imms >> 6) & 1) ^ 1;
            return true;
        }

        // op Rd, Rn, Rm (, (LSL|LSR|ASR|ROR) #imm)?  [all]
        // op Rd, Rn, #imm (, LSL #(0|12))?   [arithmetic]
        // op Rd, Rn, #mask   [logical, test]
        function assemble_op2(opc, opcode, operands, context) {
            let noperands = operands.length;   // number of operands
            let eoperands;                     // expected number of operands
            let fields;
            let xopc = opc;
            if (opc === 'tst') {
                eoperands = 2;
                xopc = 'ands';
                fields = {d: 31, n: expect_register(operands,0)};
            } else if (opc === 'cmp') {
                eoperands = 2;
                xopc = 'subs';
                fields = {d: 31, n: expect_register(operands,0)};
            } else if (opc === 'cmn') {
                eoperands = 2;
                xopc = 'adds';
                fields = {d: 31, n: expect_register(operands,0)};
            } else if (opc === 'mov') {
                eoperands = 2;
                xopc = 'add';
                fields = {d: expect_register(operands,0), n: 31};
            } else if (opc === 'mvn') {
                eoperands = 2;
                xopc = 'orn';
                fields = {d: expect_register(operands,0), n: 31};
            } else if (opc === 'neg') {
                eoperands = 2;
                xopc = 'sub';
                fields = {d: expect_register(operands,0), n: 31};
            } else if (opc === 'negs') {
                eoperands = 2;
                xopc = 'subs';
                fields = {d: expect_register(operands,0), n: 31};
            } else {
                eoperands = 3;
                fields = {d: expect_register(operands,0), n: expect_register(operands,1)};
            }

            const m = operands[eoperands - 1];
            if (m !== undefined && m[0].type === 'operator' && m[0].token === '#') {
                if (context == 'arithmetic') {
                    // switch to corresponding immediate opcode for encoding/decoding
                    xopc = {add: 'addi', adds: 'addis', sub: 'subi', subs: 'subis'}[xopc];

                    // third operand is immediate
                    fields.i = expect_immediate(operands, eoperands-1, 0, 4095);
                    fields.s = 0;

                    // check for shift spec
                    if (noperands > eoperands && operands[eoperands][0].type === 'symbol') {
                        const shift = operands[eoperands][0].token.toLowerCase();
                        const s = {lsl: 0}[shift];
                        if (s !== undefined) {
                            operands[eoperands] = operands[eoperands].slice(1);  // remove LSL
                            fields.a = expect_immediate(operands, eoperands, 0, 63);
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
                    fields.x = {and: 0, orr: 1, eor: 2, ands: 3}[xopc]
                    if (fields.x === undefined) 
                        tool.syntax_error(`Immediate operand not permitted for ${opc.toUpperCase()}`,
                                          m[0].start, m[m.length - 1].end);
                    xopc = 'boolm';
                    if (!encode_bitmask_immediate(m,fields))
                        tool.syntax_error(`Cannot encode immediate as a bitmask`,
                                          m[0].start, m[m.length - 1].end);
                }
            } else {
                // last operand is register
                fields.m = expect_register(operands, eoperands - 1);

                if (context === 'logical') {
                    const encoding = {'and': 0, 'bic': 1, 'orr': 2, 'orn': 3,
                                      'eor': 4, 'eon': 5, 'ands': 6, 'bics': 7}[opc];
                    fields.N = encoding & 0x1;
                    fields.x = encoding >> 1;
                    xopc = 'bool';
                }

                // check for shift spec
                fields.a = 0;
                fields.s = 0;
                if (noperands > eoperands && operands[eoperands][0].type === 'symbol') {
                    const shift = operands[eoperands][0].token.toLowerCase();
                    const s = {lsl: 0, lsr: 1, asr: 2, ror: 3}[shift];
                    if (s !== undefined) {
                        if (s == 3 && !(context === 'logical'))
                            tool.syntax_error(`ROR shift only valid for logic operations`,
                                              operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                        operands[eoperands] = operands[eoperands].slice(1);  // remove shift op
                        fields.s = s;
                        fields.a = expect_immediate(operands, eoperands, 0, 63);
                        noperands -= 1;   // we consumed an operand
                    } else
                        tool.syntax_error(`Unrecognized register-shift operation`,
                                          operands[eoperands][0].start, operands[eoperands][operands[eoperands].length - 1].end);
                }
            }
            // ensure correct number of operands
            if (noperands !== eoperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${eoperands} operands`, opcode.start, opcode. end);
            // emit encoded instruction
            const inst = tool.inst_codec.encode(xopc, fields, true);
            if (tool.pass == 2) console.log(xopc,fields,tool.hexify(inst,16));
        }

        function assemble_op2_arithmetic(opc, opcode, operands) {
            return assemble_op2(opc, opcode, operands, 'arithmetic');
        }

        function assemble_op2_logical(opc, opcode, operands) {
            return assemble_op2(opc, opcode, operands, 'logical');
        }

        function assemble_shift(opc, opcode, operands) {
            if (operands.length !== 3)
                tool.syntax_error(`${opc.toUpperCase()} expects 3 operands`, opcode.start, opcode.end);

            let fields = {s: {'lsl': 0, 'lsr': 1, 'asr': 2, 'ror': 3}[opc]};

            const m = operands[2];
            if (m !== undefined && m[0].type === 'operator' && m[0].token === '#') {
                // imm as third operand: use ORR (shifted-register)
                fields.d = expect_register(operands,0);
                fields.n = 31;
                fields.m = expect_register(operands,1);
                fields.a = expect_immediate(operands, 2, 0, 63);
                fields.x = 1;   // orr
                fields.N = 0;
                opc = 'bool';
            } else {
                // register as third operand
                fields.d = expect_register(operands,0);
                fields.n = expect_register(operands,1);
                fields.m = expect_register(operands,2);
                opc = 'shift'
            }
            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_mov(opc, opcode, operands) {
            let noperands = operands.length;
            let fields = {
                d: expect_register(operands, 0),
                i: expect_immediate(operands, 1, 0, 65535),
                s: 0    // default: no shift
            };

            let m = operands[2];
            if (m !== undefined && m[0].type == 'symbol') {
                const shift = m[0].token.toLowerCase();
                const s = {lsl: 0}[shift];
                if (s !== undefined) {
                    operands[2] = operands[2].slice(1);
                    fields.s = expect_immediate(operands, 2, 0, 48);
                    if (!(fields.s === 0 || fields.s === 16 || fields.s === 32 || fields.s === 48))
                        tool.syntax_error(`Shift must be LSL of 0, 16, 32, or 48`,
                                          m[0].start, m[m.length - 1].end);
                    fields.s = (fields.a > 16) ? ((fields.a === 32) ? 2 : 3) : ((fields.a === 0) ? 0 : 1);
                    noperands -= 1;   // we consumed an operand
                } else
                    tool.syntax_error(`Shift must be LSL of 0, 16, 32, or 48`,
                                      m[0].start, m[m.length - 1].end);

            }

            if (noperands !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);
            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_registers(opc, opcode, operands) {
            let noperands = {adc: 3, adcs: 3, madd: 4, mneg: 3, msub: 4, mul: 3,
                             ngc: 2, ngcs: 2, sbc: 3, sbcs: 3, sdiv: 3, smulh: 3,
                             udiv: 3, umulh: 3}[opc];

            if (operands.length !== noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`, opcode.start, opcode.end);

            let fields = {};
            if (opc === 'mul' || opc === 'mneg') {
                opc = (opc === 'mul') ? 'madd' : 'msub';
                fields.d = expect_register(operands, 0);
                fields.n = expect_register(operands, 1);
                fields.m = expect_register(operands, 2);
                fields.o = 31;
            } else if (opc === 'ngc' || opc === 'ngcs') {
                opc = (opc === 'ngc') ? 'sbc' : 'sbcs';
                fields.d = expect_register(operands, 0);
                fields.n = 31;
                fields.m = expect_register(operands, 1);
            } else {
                fields.d = expect_register(operands, 0);
                fields.n = expect_register(operands, 1);
                fields.m = expect_register(operands, 2);
                if (noperands > 3) fields.o = expect_register(operands, 3);
            }
            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_adr(opc, opcode, operands) {
            if (operands.length != 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            const fields = { d: expect_register(operands, 0), i: 0, I: 0 };
            const addr = tool.read_expression(operands[1]);
            if (tool.pass == 2) {
                const v = Number(BigInt.asUintN(64, tool.eval_expression(addr)));
                const pc = tool.dot();
                if (opc == 'adrp') { v >>= 12; pc >>= 12; }
                const imm = v - pc;   // offset from pc
                if (imm < -1048576 || imm > 1048575) {
                    const first = operands[1][0];
                    const last = operands[1][operands[1].length - 1];
                    tool.syntax_error(`Offset ${imm} is out of range -1048576:1048575`,
                                      first.start, last.end)
                }
                fields.i = imm & 0x3;
                fields.I = imm >> 2;
            }

            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_ldu_stu(opc, opcode, operands) {
            if (operands.length != 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            // allow Wn as dest for xxURB, xxURH, xxUR.  Rewrite to use Xn instead
            const Wn = is_Wn(operands[0]);
            if (Wn !== undefined) {
                if (opc == 'ldurb' || opc == 'ldurh') operands[0][0].token = `x${Wn}`;
                else if (opc == 'sturb' || opc == 'sturh') operands[0][0].token = `x${Wn}`;
                else if (opc == 'ldur') { opc = 'ldurw'; operands[0][0].token = `x${Wn}`; }
                else if (opc == 'stur') { opc = 'sturw'; operands[0][0].token = `x${Wn}`; }
            }

            const fields = { d: expect_register(operands, 0) };
            expect_base_offset(operands, 1, fields);    // fills in n and i fields

            fields.z = {'b': 0, 'h': 1, 'w': 2, 'r': 3}[opc.charAt(opc.length - 1)];
            fields.s = opc.startsWith('ldurs') ? 2 : opc.startsWith('stur') ? 0 : 1;
            fields.x = 0;   // unscaled offset

            // emit encoded instruction
            tool.inst_codec.encode('ldst', fields, true);
        }

        this.assembly_handlers = new Map();
        // arithmetic
        this.assembly_handlers.set('adc', assemble_registers);
        this.assembly_handlers.set('adcs', assemble_registers);
        this.assembly_handlers.set('add', assemble_op2_arithmetic);
        this.assembly_handlers.set('adds', assemble_op2_arithmetic);
        this.assembly_handlers.set('adr', assemble_adr);
        this.assembly_handlers.set('adrp', assemble_adr);
        this.assembly_handlers.set('madd', assemble_registers);
        this.assembly_handlers.set('mneg', assemble_registers);
        this.assembly_handlers.set('msub', assemble_registers);
        this.assembly_handlers.set('mul', assemble_registers);
        this.assembly_handlers.set('neg', assemble_op2_arithmetic);
        this.assembly_handlers.set('negs', assemble_op2_arithmetic);
        this.assembly_handlers.set('ngc', assemble_registers);
        this.assembly_handlers.set('ngcs', assemble_registers);
        this.assembly_handlers.set('sbc', assemble_registers);
        this.assembly_handlers.set('sbcs', assemble_registers);
        this.assembly_handlers.set('sdiv', assemble_registers);
        this.assembly_handlers.set('smulh', assemble_registers);
        this.assembly_handlers.set('sub', assemble_op2_arithmetic);
        this.assembly_handlers.set('subs', assemble_op2_arithmetic);
        this.assembly_handlers.set('udiv', assemble_registers);
        this.assembly_handlers.set('umulh', assemble_registers);

        // logical and move
        this.assembly_handlers.set('and', assemble_op2_logical);
        this.assembly_handlers.set('ands', assemble_op2_logical);
        this.assembly_handlers.set('asr', assemble_shift);
        this.assembly_handlers.set('bic', assemble_op2_logical);
        this.assembly_handlers.set('bics', assemble_op2_logical);
        this.assembly_handlers.set('cmn', assemble_op2_arithmetic);
        this.assembly_handlers.set('cmp', assemble_op2_arithmetic);
        this.assembly_handlers.set('eon', assemble_op2_logical);
        this.assembly_handlers.set('eor', assemble_op2_logical);
        this.assembly_handlers.set('lsl', assemble_shift);
        this.assembly_handlers.set('lsr', assemble_shift);
        this.assembly_handlers.set('mov', assemble_op2_arithmetic);
        this.assembly_handlers.set('movk', assemble_mov);
        this.assembly_handlers.set('movn', assemble_mov);
        this.assembly_handlers.set('movz', assemble_mov);
        this.assembly_handlers.set('mvn', assemble_op2_arithmetic);
        this.assembly_handlers.set('orn', assemble_op2_logical);
        this.assembly_handlers.set('orr', assemble_op2_logical);
        this.assembly_handlers.set('ror', assemble_shift);
        this.assembly_handlers.set('tst', assemble_op2_logical);

        // load and store (unscaled offset)
        this.assembly_handlers.set('ldur', assemble_ldu_stu);
        this.assembly_handlers.set('ldurb', assemble_ldu_stu);
        this.assembly_handlers.set('ldurh', assemble_ldu_stu);
        this.assembly_handlers.set('ldurw', assemble_ldu_stu);
        this.assembly_handlers.set('ldursb', assemble_ldu_stu);
        this.assembly_handlers.set('ldursh', assemble_ldu_stu);
        this.assembly_handlers.set('ldursw', assemble_ldu_stu);
        this.assembly_handlers.set('stur', assemble_ldu_stu);
        this.assembly_handlers.set('sturb', assemble_ldu_stu);
        this.assembly_handlers.set('sturh', assemble_ldu_stu);
        this.assembly_handlers.set('sturw', assemble_ldu_stu);

        // load and store
        //this.assembly_handlers.set('ldr', assemble_ldst);
        //this.assembly_handlers.set('ldrb', assemble_ldst);
        //this.assembly_handlers.set('ldrh', assemble_ldst);
        //this.assembly_handlers.set('ldrw', assemble_ldst);
        //this.assembly_handlers.set('ldrsb', assemble_ldst);
        //this.assembly_handlers.set('ldrsh', assemble_ldst);
        //this.assembly_handlers.set('ldrsw', assemble_ldst);
        //this.assembly_handlers.set('str', assemble_ldst);
        //this.assembly_handlers.set('strb', assemble_ldst);
        //this.assembly_handlers.set('strh', assemble_ldst);
        //this.assembly_handlers.set('strw', assemble_ldst);

        this.execution_handlers = new Map();  // execution handlers: opcode => function
    }

    // return text representation of instruction at addr
    // saves fields of decoded instruction in this.inst_code[pa/4]
    disassemble(pa, va) {
        const inst = this.memory.getUint32(pa,this.little_endian);
        const result = this.inst_codec.decode(inst);
        if (result === undefined) return undefined;

        const info = result.info
        if (va === undefined) va = this.pa2va(pa);
        result.va = va;

        if (this.inst_decode) this.inst_decode[pa/4] = result;   // save all our hard work!

        // redirect writes to XZR to a bit bucket
        result.dest = (result.d === 31) ? 32 : result.d;

        if (info.type === 'R') {
            let xopc = info.opcode;
            if (xopc === 'bool') {
                switch (result.x) {
                case 0: xopc = (result.N == 0) ? 'and' : 'bic'; break;
                case 1: xopc = (result.N == 0) ? 'orr' : 'orn'; break;
                case 2: xopc = (result.N == 0) ? 'eor' : 'eon'; break;
                case 3: xopc = (result.N == 0) ? 'ands' : 'bics'; break;
                };
            }
            else if (xopc === 'shift') {
                xopc = {0: 'lsl', 1: 'lsr', 2: 'asr', 3: 'ror'}[result.s];
            }

            let i = `${xopc} x${result.d},x${result.n},x${result.m}`;
            // fourth operand?
            if (result.o !== undefined) i += `,x${result.o}`;
            // shifted register?
            if (result.a !== undefined && result.a !== 0) {
                i += `,${['lsl','lsr','asr','ror'][result.s]} #${result.a}`;
                result.a = BigInt(result.a);   // for 64-bit operations
            } else result.a = undefined;   // no shift needed
            return i;
        }

        if (info.type === 'I') {
            // convert opcode back to what user typed in...
            let opc = {addi: 'add', addis: 'adds', subi: 'sub', subis: 'subs'}[info.opcode];
            if (opc === undefined) opc = info.opcode;

            result.i = BigInt(result.i);   // for 64-bit operations

            let i = `${opc} x${result.d},x${result.n},#${result.i}`;
            // shifted immediate?
            if (result.s === 1) {
                i += `,lsl #12`;
                result.i <<= 12n;   // adjust the actual immediate operand too
            }
            return i;
        }

        if (info.type === 'D') {
            result.offset = BigInt(result.I || result.i || 0);   // for 64-bit operations

            // more here: currently only handles for LDUR*, STUR*

            if (info.opcode === 'ldst') {
                let opc = result.s == 0 ? 'st' : 'ld'; // ld or st?
                if (result.x == 0) opc += 'u';     // unscaled offset?
                opc += 'r';
                opc += result.s == 2 ? 's' : '';    // signed?
                opc += {0: 'b', 1: 'h', 2: 'w', 3: ''}[result.z];  // size?
                result.opcode = opc;

                // dispatch on addressing mode
                switch (result.x) {
                case 0:
                    const offset = (result.offset !== 0n)  ? `,#${result.offset}` : '';
                    return `${opc} x${result.d},[x${result.n}${offset}]`;
                case 1:
                    // post-index
                    return '? post-index';
                case 2:
                    // shifted-register
                    return '? shifted-register';
                case 3:
                    // pre-index
                    return '? pre-index';
                }
            }

            let i = `${opc} x${result.d},[x${result.n}`;
            if (result.I !== 0n) i += `,#${result.I}`
            return i + ']';
        }

        if (info.type === 'IM') {
            // convert opcode back to what user typed in...
            let opc = {0: 'and', 1: 'orr', 2: 'eor', 3: 'ands'}[result.x];

            // reconstruct mask from N, r, s fields of instruction
            let size, nones;
            if (result.N === 0 && ((result.s & 0b111110) == 0b111100)) {
                // 2-bit mask
                size = 2;
                nones = (result.s & 0b000001) + 1;    // always 1!
            }
            else if (result.N === 0 && ((result.s & 0b111100) == 0b111000)) {
                // 4-bit mask
                size = 4;
                nones = (result.s & 0b000011) + 1;    // 1:3
            }
            else if (result.N === 0 && ((result.s & 0b111000) == 0b110000)) {
                // 8-bit mask
                size = 8;
                nones = (result.s & 0b000111) + 1;   // 1:7
            }
            else if (result.N === 0 && ((result.s & 0b110000) == 0b100000)) {
                // 16-bit mask
                size = 16;
                nones = (result.s & 0b001111) + 1;   // 1:15
            }
            else if (result.N === 0 && ((result.s & 0b100000) == 0b000000)) {
                // 32-bit mask
                size = 32;
                nones = (result.s & 0b011111) + 1;   // 1:31
            }
            else if (result.N === -1) {
                // 64-bit mask
                size = 64;
                nones = (result.s & 0b111111) + 1;   // 1:63
            }
            // build mask with required number of bits
            let pattern = (1n << BigInt(nones)) - 1n;
            // now ROR pattern by result.r bits
            pattern = BigInt.asUintN(size, ((pattern << BigInt(size)) | pattern) >> BigInt(result.r));
            // replicate to build 64-bit mask
            result.mask = 0n;
            for (let rep = 0; rep < 64/size; rep += 1) result.mask |= (pattern << BigInt(rep*size));

            return `${opc} x${result.d},x${result.n},#0x${this.hexify(result.mask,16)}`;
        }

        if (info.type === 'A') {
            result.addr = (result.I << 2) + (result.i) + va;
            if (opcode === 'adrp') result.addr <<= 12;
            return `${info.opcode} x${result.d},#0x${result.addr.toString(16)}`;
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
        handler(opc, opcode, operands);
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
