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

SimTool.ASim = class extends(SimTool.CPUTool) {
    constructor(tool_div) {
        // super() will call this.emulation_initialize()
        super(tool_div, 'asim.23', 'ARMV8A', 'AArch64');
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
        this.register_file = new Array(32 + 2);    // include extra regs for SP and writes to XZR
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
        }
        this.registers.set('xzr', 31);

        this.register_names = [];
        for (let rname of this.registers.keys()) {
            const reg = this.registers.get(rname);
            this.register_names[reg] = rname;
        }

        // for use by assy programs
        this.registers.set('sp', 31);
        this.registers.set('fp', 29);
        this.registers.set('lr', 30);

        /*
        for (let i = 0; i <= 30; i += 1) {
            this.registers.set('w'+i, i);
        }
        this.registers.set('wzr', 31);
        */
    }

    extra_registers(table) {
        let row = ['<tr style="border-top: 1px solid gray;">'];
        // sp
        row.push('<td class="cpu_tool-addr">sp</td>');
        row.push(`<td id="sp">${this.hexify(this.register_file[32],this.register_nbits/4)}</td>`);
        row.push('</tr>');
        table.push(row.join(''));
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

            // x: 0=adc, 1=adcs, 2=sbc, 3=sbcs
            {opcode: 'adcsbc', pattern: "zxx11010000mmmmm000000nnnnnddddd", type: "R"},

            // s: 0=LSL, 1=LSR, 2=ASR, 3=Reserved
            // x: 0=add, 1=adds, 2=sub, 3=subs (shifted register)
            {opcode: 'addsub', pattern: "zxx01011ss0mmmmmaaaaaannnnnddddd", type: "R"},

            // x: 0=add, 1=adds, 2=sub, 3=subs
            // o: 0=UXTB, 1=UXTH, 2=UXTW/LSL, 3=UXTX/LSL, 4=SXTB, 5=SXTH, 6=SXTW, 7=SXTX
            // add, sub, adds, subs (extended register)
            // n: SP allowed for add, adds, sub, subs
            // d: SP allowed for add, sub
            {opcode: 'addsubx',pattern: "zxx01011001mmmmmeeeiiinnnnnddddd", type: "R"},

            // s: 0=LSL #0, 1=LSL #12
            // x: 0=add, 1=adds, 2=sub, 3=subs (immediate)
            // n: SP allowed for add, adds, sub, subs
            // d: SP allowed for add, sub
            {opcode: 'addsubi',pattern: "zxx100010siiiiiiiiiiiinnnnnddddd", type: "I"},

            {opcode: 'adr',    pattern: "0ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},
            {opcode: 'adrp',   pattern: "1ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},
            {opcode: 'madd',   pattern: "10011011000mmmmm0ooooonnnnnddddd", type: "R"},
            {opcode: 'msub',   pattern: "10011011000mmmmm1ooooonnnnnddddd", type: "R"},
            {opcode: 'sdiv',   pattern: "10011010110mmmmm000011nnnnnddddd", type: "R"},
            {opcode: 'smulh',  pattern: "10011011010mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'udiv',   pattern: "10011010110mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'umulh',  pattern: "10011011110mmmmm011111nnnnnddddd", type: "R"},

            // logical and move

            // s: 0=LSL, 1=LSR, 2=ASR, 3=ROR
            // xxN: 000: and, 001: bic, 010: orr, 011: orn, 100: eor, 101: eon, 110: ands, 111: bics
            {opcode: 'bool',   pattern: "zxx01010ssNmmmmmaaaaaannnnnddddd", type: "R"},

            // x: 0=andm, 1=orrm, 2=eorm, 3:andms
            {opcode: 'boolm',  pattern: "zxx100100Nrrrrrrssssssnnnnnddddd", type: "IM"},

            // s: 0=LSL, 1=LSR, 2=ASR, 3=ROR
            {opcode: 'shift',  pattern: "z0011010110mmmmm0010ssnnnnnddddd", type: "R"},

            // x: 0=movn, 2=movz, 3=movk
            {opcode: 'movx',   pattern: "zxx100101ssiiiiiiiiiiiiiiiiddddd", type: "M"},

            // branch

            // x: 0=b, 1=bl
            {opcode: 'brel',   pattern: "x00101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},

            // x: 0=bl, 1=blr, 2=ret
            {opcode: 'blink',  pattern: "110101100xx11111000000nnnnn00000", type: "BL"},

            // x: 0=cbz, 1=cbnz
            {opcode: 'cb',     pattern: "z011010xIIIIIIIIIIIIIIIIIIInnnnn", type: "CB"},

            // x: 0=tbz, 1=tbnz
            {opcode: 'tb',     pattern: "z011011xbbbbbIIIIIIIIIIIIIInnnnn", type: "TB"},

            // x: 0=eq, 1=ne, 2=cs, 3=cc, 4=mi, 5=pl, 6=vs, 7=vc,
            //    8=hi, 9=ls, 10=ge, 11=lt, 12=gt, 13=le, 14=al, 15=al
            {opcode: 'bcc',    pattern: "01010100IIIIIIIIIIIIIIIIIII0xxxx", type: "BCC"},

            // load and store
            // s: 0=str, 1=ldr, 2:3=ldrs
            // x: 0=unscaled offset, 1=post-index, 2=shifted-register, 3=pre-index
            {opcode: 'ldst',   pattern: "zz111000ss0IIIIIIIIIxxnnnnnddddd", type: "D"},  // post-, pre-index
            {opcode: 'ldst.off',pattern:"zz111001ssiiiiiiiiiiiinnnnnddddd", type: "D"},  // scaled, unsigned offset

            // o: 2=UXTW, 011=LSL, 110=SXTW, 111=SXTX
            // s: 0=no shift, 1=scale by size
            {opcode: 'ldst.reg',pattern:"zz111000011mmmmmooos10nnnnnddddd", type: "D"},  // register offset, n==SP allowed

            // x: 0=ldr (32-bit), 1=ldr, 2=ldrsw
            {opcode: 'ldr.pc', pattern: "xz011000IIIIIIIIIIIIIIIIIIIddddd", type: "D"},  // pc offset

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

        //////////////////////////////////////////////////
        // opcode operand parsing
        //////////////////////////////////////////////////

        // return Array of operand objects.  Possible properties for operand object:
        //  .type: 'register', 'shifted-register', 'extended-register', 'immediate', 'address'
        //  .regname: xn or wn, n = 0..30 PLUS xzr, wzr, sp, fp, lp
        //  .reg:  n
        //  .shiftext:  lsl, lsr, asr, ror, [su]xt[bhwx]
        //  .shamt:  expression tree
        //  .imm: expression tree
        //  .addr: Array of operand objects  [...]
        //  .pre_index: boolean   [Xn, #i]!
        //  .post_index: boolean  [Xn], #i
        // parses
        //   Xn or Wn
        //   rn, (LSL|LSR|ASR|ROR) #i    shifted register
        //   Wn, {S,U}XT[BHW] {#i)       extended register
        //   Xn, {S,U}XTX {#i)           extended register
        //   #i{, LSL #0|12}
        //   [Xn{, #i}]
        //   [Xn], #i
        //   [Xn, #i]!
        //   [Xn, Xm{, LSL #0|s}]
        //   [Xn, Wm,{S,U}XTW {#0|s}]
        //   [Xn, Xm,{SXTX {#0|s}]
        // operands has one element for each comma-separated operand
        // each element is an Array of tokens
        tool.register_operands = {
            'x0': 0, 'x1': 1, 'x2': 2, 'x3': 3, 'x4': 4, 'x5': 5, 'x6': 6, 'x7': 7,
            'x8': 8, 'x9': 9, 'x10': 10, 'x11': 11, 'x12': 12, 'x13': 13, 'x14': 14, 'x15': 15,
            'x16': 16, 'x17': 17, 'x18': 18, 'x19': 19, 'x20': 20, 'x21': 21, 'x22': 22, 'x23': 23,
            'x24': 24, 'x25': 25, 'x26': 26, 'x27': 27, 'x28': 28, 'x29': 29, 'x30': 30,
            'xzr': 31, 'sp': 31, 'lr': 30, 'fp': 29,
            'w0': 0, 'w1': 1, 'w2': 2, 'w3': 3, 'w4': 4, 'w5': 5, 'w6': 6, 'w7': 7,
            'w8': 8, 'w9': 9, 'w10': 10, 'w11': 11, 'w12': 12, 'w13': 13, 'w14': 14, 'w15': 15,
            'w16': 16, 'w17': 17, 'w18': 18, 'w19': 19, 'w20': 20, 'w21': 21, 'w22': 22, 'w23': 23,
            'w24': 24, 'w25': 25, 'w26': 26, 'w27': 27, 'w28': 28, 'w29': 29, 'w30': 30,
            'wzr': 31,
        };

        tool.parse_operands = function(operands) {
            let result = [];
            let index = 0;
            let prev = undefined;   // previous operand

            while (index < operands.length) {
                let operand = operands[index++];   // array of tokens
                let j = 0;   // index into array of tokens

                const token = operand[j];
                const tstring = (token.type == 'number') ? '' : token.token.toLowerCase();

                // register name
                if (tool.register_operands[tstring] !== undefined) {
                    prev = {
                        type: (tstring==='sp' || tstring==='wsp') ? 'sp' : 'register',
                        rname: tstring,
                        reg: tool.register_operands[tstring],
                        start: operand[0].start,
                        end: operand[0].end,
                        z: tstring.charAt(0) === 'w' ? 0 : 1,   // sp, fp, lr are 'X'
                    };
                    result.push(prev);
                    j += 1;
                    if (j < operand.length)
                        throw this.syntax_error(`Invalid operand`,
                                                operand[0].start, operand[operand.length - 1].end);
                    continue;  // on to next operand
                }

                // shifted register
                // modifies previous register or immediate operand
                if (tstring.match(/^(lsl|lsr|asr|ror)/)) {
                    j += 1;
                    if (operand[j].token == '#') j += 1;  // optional "#" in front of immediate
                    // prev operand must be a reg or an immediate if shift is LSL
                    if (prev !== undefined) {
                        prev.end = operand[operand.length - 1].end;
                        prev.shiftext = tstring;
                        prev.shamt = tool.read_expression(operand,j);
                        if (tool.pass == 2) prev.shamt = Number(tool.eval_expression(prev.shamt));
                        else prev.shamt = 0;
                        if (prev.type === 'register') {
                            prev.type = 'shifted-register';
                            continue;
                        }
                        if (tstring === 'lsl' && prev.type === 'immediate') {
                            continue;
                        }
                    }
                    tool.syntax_error(`Shift ${tstring.toUpperCase()} cannot be applied to previous operand`,
                                      operand[0].start, operand[operand.length - 1].end);
                }

                // extended register
                // modifies previous register or immediate operand
                if (tstring.match(/^[su]xt[bhwx]/)) {
                    j += 1;
                    const sz = tstring.charAt(tstring.length - 1);
                    if (prev === undefined || prev.type !== 'register' ||
                        (sz === 'x' && prev.z !== 1) ||
                        (sz !== 'x' && prev.z !== 0))
                        tool.syntax_error(`Register extension ${tstring.toUpperCase()} cannot be applied to previous operand`,
                                          operand[0].start, operand[operand.length - 1].end);
                    prev.type = 'extended-register';
                    prev.shiftext = tstring;
                    prev.shamt = 0;
                    prev.end = operand[operand.length - 1];
                    if (j < operand.length) {
                        if (operand[j].token == '#') j += 1;  // optional "#" in front of immediate
                        prev.shamt = tool.read_expression(operand,j);
                        if (tool.pass == 2) prev.shamt = Number(tool.eval_expression(prev.shamt));
                        else prev.shamt = 0;
                    }
                    continue;
                }

                // address operand
                if (tstring == '[') {
                    let astart = j+1;
                    let aend = operand.length - 1;

                    // look for pre-index indicator
                    let pre_index = false;
                    if (operand[aend].token === '!') { pre_index = true; aend -= 1; }

                    if (operand[aend].token !== ']')
                        tool.syntax_error('Invalid operand',
                                          operand[0].start, operand[operand.length - 1].end);

                    // now parse what was between [ and ]
                    // by building array of comma-separated operands
                    // then recursively parse that array
                    let addr = [[]];  // will add additional elements if needed
                    while (astart < aend) {
                        if (operand[astart].token === ',') addr.push([]);
                        else addr[addr.length - 1].push(operand[astart]);
                        astart += 1;
                    }
                    prev = {
                        type: 'address',
                        addr: tool.parse_operands(addr),
                        pre_index: pre_index,
                        start: operand[0].start,
                        end: operand[operand.length - 1].end,
                    }
                    result.push(prev);
                    continue;
                }

                // immediate operand
                if (tstring == '#') j += 1;
                let imm = this.read_expression(operand,j);
                if (tool.pass == 2) imm = tool.eval_expression(imm);
                else imm = 0n;

                // is this a post-index for previous address operand?
                if (prev !== undefined && prev.type === 'address' && !prev.pre_index) {
                    prev.post_index = Number(imm);
                    prev.end = operand[operand.length - 1].end;
                }
                else {
                    // not a post index, so it's an immediate operand
                    prev = {
                        type: 'immediate',
                        imm: imm,
                        start: operand[0].start,
                        end: operand[operand.length - 1].end,
                    };
                    result.push(prev);
                }
            }

            return result;
        }

        function check_operand(operand, type) {
            if (operand.type !== type)
                tool.syntax_error(`Expected ${type} operand`,operand.start,operand.end);
            return true;
        }

        // return register number
        function check_register(operand, size) {
            check_operand(operand,'register');
            if (size !== undefined && operand.z != size) 
                tool.syntax_error(`Expected ${size == 1 ? 'X' : 'W'} reg`,operand.start,operand.end);
            return operand.reg;
        }

        // return register number
        function check_register_or_sp(operand, size) {
            if (operand.type !== 'sp') {
                check_operand(operand,'register');
            }
            if (size !== undefined && operand.z != size) 
                tool.syntax_error(`Expected ${size == 1 ? 'X' : 'W'} reg`,operand.start,operand.end);
            return operand.reg;
        }
        
        // return immediate value as Number
        function check_immediate(operand, minv, maxv) {
            check_operand(operand,'immediate');
            if (tool.pass === 2) {
                if (minv !== undefined && (operand.imm < minv || operand.imm > maxv))
                    tool.syntax_error(`Immediate value ${operand.imm} out of range ${minv}:${maxv}`,
                                      operand.start, operand.end);
                return Number(operand.imm);
            } else return 0;
        }

        function check_sp(operand) {
            return operand !== undefined && operand.type === 'sp';
        }

        //////////////////////////////////////////////////
        // bit-mask immediates
        //////////////////////////////////////////////////

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
        function encode_bitmask_immediate(mask, fields) {
            if (mask === undefined) return false;
            if (tool.pass != 2) {
                fields.N = 0;
                fields.r = 0;
                fields.s = 0;
                fields.mask = 0n;
                return true;
            }

            // https://kddnewton.com/2022/08/11/aarch64-bitmask-immediates.html
            const v = BigInt.asUintN(64,mask);   // value to be encoded
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

        ////////////////////////////////////////////////
        //  Assembler helper functions
        ////////////////////////////////////////////////

        // op Rd, Rn, Rm (, (LSL|LSR|ASR|ROR) #imm)?  [all]
        // op Rd, Rn, #imm (, LSL #(0|12))?   [arithmetic]
        // op Rd, Rn, #mask   [logical, test]
        function assemble_op2(opc, opcode, operands, context) {
            let noperands = {cmn: 2, cmp: 2, mvn: 2, neg: 2,
                             negs: 2, mvn: 2, tst: 2}[opc] || 3;
            let xopc = {cmn: 'adds', cmp: 'subs', mvn: 'orn',
                        neg: 'sub', negs: 'subs', tst: 'ands'}[opc] || opc;
            
            if (noperands !== operands.length)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`,
                                  opcode.start, opcode.end);

            let fields;
            if (['tst','cmp','cmn'].includes(opc)) {
                fields = {d: 31, n: check_register(operands[0])};
                fields.z = operands[0].z;
            } else if (opc === 'mvn') {
                fields = {d: check_register(operands[0]), n: 31};
                fields.z = operands[0].z;
            } else if (opc === 'neg' || opc === 'negs') {
                fields = {d: check_register(operands[0]), n: 31};
                fields.z = operands[0].z;
                if (!(operands[1].type === 'register' || operands[1].type === 'shifted-register'))
                    tool.syntax_error('Invalid operand',operands[1].start,operands[1].end)
            } else {
                const rd_sp_ok = ['add','sub'].includes(xopc);
                fields = {d: rd_sp_ok ? check_register_or_sp(operands[0]) :
                                        check_register(operands[0])};
                fields.z = operands[0].z;
                const rn_sp_ok = ['add','sub','adds','subs'].includes(xopc);
                fields.n = rn_sp_ok ? check_register_or_sp(operands[1], fields.z) :
                                      check_register(operands[1], fields.z);
            }

            const m = operands[noperands - 1];
            if (m.type === 'immediate') {
                if (context == 'arithmetic') {
                    // switch to corresponding immediate opcode for encoding/decoding
                    fields.x = {add: 0, adds: 1, sub: 2, subs: 3}[xopc];
                    xopc = 'addsubi';

                    // third operand is immediate
                    fields.i = check_immediate(m, 0, 4095);
                    fields.s = 0;

                    // check for shift spec
                    if (m.shiftext !== undefined) {
                        if (m.shiftext !== 'lsl' || !(m.shamt === 0 || m.shamt === 12))
                            tool.syntax_error('Immediate shift must be LSL of 0 or 12',m.start,m.end);
                        fields.s = (m.shamt === 12) ? 1 : 0;
                    }
                } else {
                    // switch to corresponding mask opcode for encoding/decoding
                    fields.x = {and: 0, orr: 1, eor: 2, ands: 3}[xopc]
                    if (fields.x === undefined) 
                        tool.syntax_error(`Immediate operand not permitted for ${opc.toUpperCase()}`,
                                          m.start, m.end);
                    xopc = 'boolm';
                    if (!encode_bitmask_immediate(m.imm,fields))
                        tool.syntax_error(`Cannot encode immediate as a bitmask`,m.start,m.end);
                }
            } else {
                // last operand is register
                if (context === 'arithmetic') {
                    fields.x = {add: 0, adds: 1, sub: 2, subs: 3}[xopc];
                    if (m.type === 'register') {
                        if (operands[0].type === 'sp' || operands[1].type === 'sp') {
                            // use extended-register format if Xd or Xn is SP
                            m.type = 'extended-register';
                            m.shiftext = 'uxtx';
                            m.shamt = 0;
                        } else {
                            xopc = 'addsub';
                            fields.m = check_register(m, fields.z);
                            fields.s = 0;
                            fields.a = 0;
                        }
                    }
                    if (m.type === 'shifted-register') {
                        if (operands[0].type === 'sp')
                            tool.syntax_error('SP not allowed',operands[0].start,operands[0].end);
                        if (operands[1].type === 'sp')
                            tool.syntax_error('SP not allowed',operands[1].start,operands[1].end);

                        xopc = 'addsub';
                        if (m.z != fields.z) 
                            tool.syntax_error(`Expected ${fields.z == 1 ? 'X' : 'W'} reg`,m.start,m.end);
                        fields.s = {lsl: 0, lsr: 1, asr: 2}[m.shiftext];
                        if (fields.s === undefined)
                            tool.syntax_error(`${m.shiftext} not allowed for ${opc.toUpperCase()}`,m.start,m.end);
                        if (m.shamt < 0 || m.shamt > (fields.z ? 63: 31))
                            tool.syntax_error(`shift amount not in range 0:${fields.z ? 63 : 31}`,m.start,m.end);
                        fields.m = m.reg;
                        fields.a = m.shamt;
                    }
                    else if (m.type === 'extended-register') {
                        xopc = 'addsubx';

                        // disallow xzr and wzr for Rd and Rn (aliases with SP)
                        if ((fields.x & 1)===0 && fields.d === 31 && operands[0].type !== 'sp')
                            tool.syntax_error(`${operands[0].rname} not allowed`,operands[0].start,operands[0].end);
                        if ((fields.x & 1)===0 && fields.n === 31 && operands[1].type !== 'sp')
                            tool.syntax_error(`${operands[1].rname} not allowed`,operands[1].start,operands[1].end);

                        fields.e = {'uxtb': 0, 'uxth': 1, 'uxtw': 2, 'uxtx': 3,
                                    'sxtb': 4, 'sxth': 5, 'sxtw': 6, 'sxtx': 7}[m.shiftext];
                        if (fields.e === undefined)
                            tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                        if (m.shamt < 0 || m.shamt > 4)
                            tool.syntax_error('shift amount not in range 0:4',m.start,m.end);
                        fields.m = m.reg;
                        fields.i = m.shamt;
                    }
                }
                else if (context === 'logical') {
                    const encoding = {'and': 0, 'bic': 1, 'orr': 2, 'orn': 3,
                                      'eor': 4, 'eon': 5, 'ands': 6, 'bics': 7}[opc];
                    fields.N = encoding & 0x1;
                    fields.x = encoding >> 1;
                    fields.a = 0;
                    fields.s = 0;
                    if (m.type === 'shifted-register') {
                        fields.s = {lsl: 0, lsr: 1, asr: 2, ror: 3}[m.shiftext];
                        if (fields.s === undefined)
                            tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                        if (m.shamt < 0 || m.shamt > (fields.z ? 63: 31))
                            tool.syntax_error(`shift amount not in range 0:${fields.z ? 63 : 31}`,m.start,m.end);
                        fields.a = m.shamt;
                    }
                    else if (m.type === 'extended-register') 
                        tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                    xopc = 'bool';
                }
            }

            // emit encoded instruction
            tool.inst_codec.encode(xopc, fields, true);
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

            let fields = {
                d: check_register(operands[0]),
                s: {'lsl': 0, 'lsr': 1, 'asr': 2, 'ror': 3}[opc]
            };
            fields.z = operands[0].z;

            if (operands[2].type === 'immediate') {
                // imm as third operand: use ORR Xd,XZR,Xm,<shift> #<amount>
                fields.n = 31;
                fields.m = check_register(operands[1], fields.z);
                fields.a = check_immediate(operands[2], 0, fields.z ? 63 : 31);
                fields.x = 1;   // orr
                fields.N = 0;
                opc = 'bool';
            } else {
                // register as third operand
                fields.n = check_register(operands[1], fields.z);
                fields.m = check_register(operands[2], fields.z);
                opc = 'shift';
            }
            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_movx(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            let fields = {
                x: {movn: 0, movz: 2, movk: 3}[opc],
                d: check_register(operands[0]),
                i: check_immediate(operands[1], 0, 65535),
                s: operands[1].shamt || 0,
            };
            fields.z = operands[0].z;

            if (![0, 16, 32, 48].includes(fields.s))
                tool.syntax_error(`Shift must be LSL of 0, 16, 32, or 48`,
                                  operands[1].start, operands[1].end)
            fields.s >>= 4;  // encode shift amount

            // emit encoded instruction
            tool.inst_codec.encode('movx', fields, true);
        }

        function assemble_adcsbc(opc, opcode, operands) {
            let noperands = {adc: 3, adcs: 3, ngc: 2, ngcs: 2, sbc: 3, sbcs: 3}[opc];

            if (operands.length !== noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`, opcode.start, opcode.end);

            const fields = {
                d: check_register(operands[0]),
                z: operands[0].z,
            }

            if (opc === 'ngc' || opc === 'ngcs') {
                opc = (opc === 'ngc') ? 'sbc' : 'sbcs';
                fields.n = 31;
                fields.m = check_register(operands[1], operands[0].z);
            } else {
                fields.n = check_register(operands[1], operands[0].z);
                fields.m = check_register(operands[2], operands[0].z);
            }

            fields.x = {adc: 0, adcs: 1, sbc: 2, sbcs: 3}[opc]

            // emit encoded instruction
            tool.inst_codec.encode('adcsbc', fields, true);
        }

        function assemble_registers(opc, opcode, operands) {
            let noperands = {madd: 4, mneg: 3, msub: 4, mul: 3,
                             sdiv: 3, smulh: 3,
                             udiv: 3, umulh: 3}[opc];

            if (operands.length !== noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`, opcode.start, opcode.end);

            let fields = {d: check_register(operands[0])};
            fields.z = operands[0].z;
            fields.n = check_register(operands[1], fields.z);
            fields.m = check_register(operands[2], fields.z);
            if (noperands > 3) fields.o = check_register(operands[3], fields.z);
            
            if (opc === 'mul' || opc === 'mneg') {
                opc = (opc === 'mul') ? 'madd' : 'msub';
                fields.o = 31;
            }

            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_adr(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            const fields = {
                d: check_register(operands[0], 1),
                i: 0,
                I: check_immediate(operands[1])
            };

            if (tool.pass == 2) {
                let pc = tool.dot();
                if (opc === 'adrp') { fields.I >>= 12; pc >>= 12; }
                const imm = fields.I - pc;   // offset from pc
                if (imm < -1048576 || imm > 1048575) {
                    tool.syntax_error(`Offset ${imm} is out of range -1048576:1048575`,
                                      operands[1].start, operands[1].end);
                }
                fields.i = imm & 0x3;
                fields.I = imm >> 2;
            }

            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_bl(opc, opcode, operands) {
            if (operands.length != 1)
                tool.syntax_error(`${opc.toUpperCase()} expects 1 operand`, opcode.start, opcode.end);

            const fields = {
                x: {'b': 0, 'bl': 1}[opc],
                I: check_immediate(operands[0]),
            }
            if (tool.pass == 2) {
                fields.I -= tool.dot();
                fields.I >>= 2;   // word offset
                const maxv = 2**25;
                if (fields.I < -maxv || fields.I >= maxv)
                    tool.syntax_error(`Offset too large`, operands[1].start, operands[1].end);
            }

            // emit encoded instruction
            tool.inst_codec.encode('brel', fields, true);
        }

        function assemble_blr(opc, opcode, operands) {
            
            const fields = {x: {'br': 0, 'blr': 1, 'ret': 2}[opc]};
            if (opc === 'ret' && operands.length === 0) {
                fields.n = 30;
            } else {
                if (operands.length !== 1)
                    tool.syntax_error(`${opc.toUpperCase()} expects 1 operand`, opcode.start, opcode.end);
                fields.n = check_register(operands[0], 1);
            }

            // emit encoded instruction
            tool.inst_codec.encode('blink', fields, true);
        }
        
        function assemble_cb(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            const fields = {
                n: check_register(operands[0]),
                x: {'cbz': 0, 'cbnz': 1}[opc],
                I: check_immediate(operands[1]),
            };
            fields.z = operands[0].z;
            if (tool.pass === 2) {
                fields.I -= tool.dot();
                fields.I >>= 2;   // word offset
                const maxv = 2**18;
                if (fields.I < -maxv || fields.I >= maxv)
                    tool.syntax_error(`Offset too large`, operands[1].start, operands[1].end);
            }

            // emit encoded instruction
            tool.inst_codec.encode('cb', fields, true);
        }

        function assemble_tb(opc, opcode, operands) {
            if (operands.length !== 3)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            const fields = {
                n: check_register(operands[0]),
                x: {'tbz': 0, 'tbnz': 1}[opc],
                I: check_immediate(operands[2]),
                z: 0,
            };
            fields.b = check_immediate(operands[1],0,operands[0].z ? 63 : 31);
            if (fields.b > 31) {
                fields.z = 1;
                fields.b -= 32;
            }
            if (tool.pass === 2) {
                fields.I -= tool.dot();
                fields.I >>= 2;   // word offset
                const maxv = 2**13;
                if (fields.I < -maxv || fields.I >= maxv)
                    tool.syntax_error(`Offset too large`, operands[1].start, operands[1].end);
            }

            // emit encoded instruction
            tool.inst_codec.encode('tb', fields, true);
        }

        function assemble_bcc(opc, opcode, operands) {
            if (operands.length !== 1)
                tool.syntax_error(`${opc.toUpperCase()} expects 1 operand`, opcode.start, opcode.end);

            const fields = {
                x: {'b.eq': 0, 'b.ne': 1,
                    'b.cs': 2, 'b.cc': 3,
                    'b.hs': 2, 'b.lo': 3,
                    'b.mi': 4, 'b.pl': 5,
                    'b.vs': 6, 'b.vc': 7,
                    'b.hi': 8, 'b.ls': 9,
                    'b.ge': 10, 'b.lt': 11,
                    'b.gt': 12, 'b.le': 13,
                    'b.al': 14}[opc],
                I: check_immediate(operands[0]),
            };
            if (tool.pass == 2) {
                fields.I -= tool.dot();
                fields.I >>= 2;   // word offset
                const maxv = 2**18;
                if (fields.I < -maxv || fields.I >= maxv)
                    tool.syntax_error(`Offset too large`, operands[0].start, operands[0].end);
            }

            // emit encoded instruction
            tool.inst_codec.encode('bcc', fields, true);
        }
        
        function assemble_mov(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            let xopc = undefined;
            const fields = {}

            // MOV to/from SP
            if (operands[0].type === 'sp' || operands[1].type === 'sp') {
                // use ADD Xd, Xn, #0
                fields.d = check_register_or_sp(operands[0]);
                fields.z = operands[0].z;
                fields.n = check_register_or_sp(operands[1], fields.z);
                fields.x = 0;
                fields.i = 0;
                fields.s = 0;
                xopc = 'addsubi';
            } else {
                fields.d = check_register(operands[0]);
                fields.z = operands[0].z;

                if (operands[1].type === 'register') {
                    // use ORR Rd, XZR, Rm
                    fields.n = 31;
                    fields.m = check_register(operands[1], fields.z);
                    fields.x = 1;
                    fields.N = 0;
                    fields.s = 0;
                    fields.a = 0;
                    xopc = 'bool';
                }

                let imm;
                if (xopc === undefined) {
                    if (operands[1].type !== 'immediate')
                        tool.syntax_error('Invalidoperand',operands[1].start,operands[1].end);

                    imm = BigInt.asUintN(64, operands[1].imm);
                    const notimm = BigInt.asUintN(64, ~operands[1].imm);

                    // wide immediate => movz
                    // inverted wide immediate => movn
                    for (let s = 0; s < (fields.z ? 4 : 2); s += 1) {
                        const shamt = BigInt(s * 16);
                        if ((imm & ~(0xFFFFn << shamt)) === 0n) {
                            xopc = 'movx';
                            fields.x = 2;   // movz
                            fields.s = s;
                            fields.i = Number(imm >> shamt);
                            break;
                        }
                        if ((notimm & ~(0xFFFFn << shamt)) === 0n) {
                            xopc = 'movx';
                            fields.x = 0;   // movn
                            fields.s = s;
                            fields.i = Number(notimm >> shamt);
                            break;
                        }
                    }
                }

                // bitmask immediate => ORR Rd, XZR, #imm
                if (xopc === undefined) {
                    if (!encode_bitmask_immediate(imm, fields))
                        // out of options for how to encode MOV second operand
                        tool.syntax_error('MOV cannot encode immediate operand',operands[1].start,operands[1].end);
                    xopc = 'boolm';
                    fields.n = 31; // xzr
                    fields.x = 1;  // ORR
                }
            }

            // emit encoded instruction
            tool.inst_codec.encode(xopc, fields, true);
        }

        function assemble_ldst(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`,opcode.start,opcode.end);

            let fields = {};
            if (operands[1].type === 'immediate' && ['ldr','ldrsw'].includes(opc)) {
                if (opc === 'ldrsw') {
                    fields.d = check_register(operands[0], 1);   // Xn required as target
                    fields.x = 1;
                    fields.z = 0;
                } else {
                    fields.d = check_register(operands[0]);
                    fields.x = 0;
                    fields.z = operands[0].z;
                }
                fields.I = check_immediate(operands[1]);
                if (tool.pass === 2) {
                    fields.I -= tool.dot();
                    fields.I >>= 2;
                    const maxv = 2**18;
                    if (fields.I < -maxv || fields.I >= maxv)
                        tool.syntax_error(`Offset too large`, operands[1].start, operands[1].end);
                }
                tool.inst_codec.encode('ldr.pc', fields, true);
                return;
            }

            fields.d = check_register(operands[0]);
            check_operand(operands[1], 'address');

            const [_,op,unscaled,signed,size] = opc.match(/(ld|st)(u?)r(s?)([bhw]?)/);
            fields.z = {'b': 0, 'h': 1, 'w': 2}[size];
            if (fields.z === undefined) fields.z = (2 + operands[0].z);
            fields.s = (op == 'st') ? 0 : (signed ? 2 : 1);
            
            if (unscaled) {   // ldur*, stur*
                let addr = operands[1].addr;
                if (addr !== undefined && addr.length <= 2 && addr[0] !== undefined) {
                    fields.n = check_register_or_sp(addr[0], 1);   // base register
                    if (addr[1] !== undefined) fields.I = check_immediate(addr[1], -256, 255);
                    else fields.I = 0;
                    fields.x = 0;   // unscaled offset
                    tool.inst_codec.encode('ldst', fields, true);
                    return;
                } 
                tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
            }
        }

        this.assembly_handlers = new Map();
        // arithmetic
        this.assembly_handlers.set('adc', assemble_adcsbc);
        this.assembly_handlers.set('adcs', assemble_adcsbc);
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
        this.assembly_handlers.set('ngc', assemble_adcsbc);
        this.assembly_handlers.set('ngcs', assemble_adcsbc);
        this.assembly_handlers.set('sbc', assemble_adcsbc);
        this.assembly_handlers.set('sbcs', assemble_adcsbc);
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
        this.assembly_handlers.set('mov', assemble_mov);
        this.assembly_handlers.set('movk', assemble_movx);
        this.assembly_handlers.set('movn', assemble_movx);
        this.assembly_handlers.set('movz', assemble_movx);
        this.assembly_handlers.set('mvn', assemble_op2_arithmetic);
        this.assembly_handlers.set('orn', assemble_op2_logical);
        this.assembly_handlers.set('orr', assemble_op2_logical);
        this.assembly_handlers.set('ror', assemble_shift);
        this.assembly_handlers.set('tst', assemble_op2_logical);

        // load and store
        this.assembly_handlers.set('ldr', assemble_ldst);
        this.assembly_handlers.set('ldrb', assemble_ldst);
        this.assembly_handlers.set('ldrh', assemble_ldst);
        //this.assembly_handlers.set('ldrw', assemble_ldst);
        this.assembly_handlers.set('ldrsb', assemble_ldst);
        this.assembly_handlers.set('ldrsh', assemble_ldst);
        this.assembly_handlers.set('ldrsw', assemble_ldst);
        this.assembly_handlers.set('ldur', assemble_ldst);
        this.assembly_handlers.set('ldurb', assemble_ldst);
        this.assembly_handlers.set('ldurh', assemble_ldst);
        //this.assembly_handlers.set('ldurw', assemble_ldst);
        this.assembly_handlers.set('ldursb', assemble_ldst);
        this.assembly_handlers.set('ldursh', assemble_ldst);
        this.assembly_handlers.set('ldursw', assemble_ldst);
        this.assembly_handlers.set('str', assemble_ldst);
        this.assembly_handlers.set('strb', assemble_ldst);
        this.assembly_handlers.set('strh', assemble_ldst);
        //this.assembly_handlers.set('strw', assemble_ldst);
        this.assembly_handlers.set('stur', assemble_ldst);
        this.assembly_handlers.set('sturb', assemble_ldst);
        this.assembly_handlers.set('sturh', assemble_ldst);
        //this.assembly_handlers.set('sturw', assemble_ldst);

        // branches
        this.assembly_handlers.set('b', assemble_bl);
        this.assembly_handlers.set('bl', assemble_bl);
        this.assembly_handlers.set('br', assemble_blr);
        this.assembly_handlers.set('blr', assemble_blr);
        this.assembly_handlers.set('ret', assemble_blr);
        this.assembly_handlers.set('cbz', assemble_cb);
        this.assembly_handlers.set('cbnz', assemble_cb);
        this.assembly_handlers.set('tbz', assemble_tb);
        this.assembly_handlers.set('tbnz', assemble_tb);
        this.assembly_handlers.set('b.eq', assemble_bcc);
        this.assembly_handlers.set('b.ne', assemble_bcc);
        this.assembly_handlers.set('b.cs', assemble_bcc);
        this.assembly_handlers.set('b.hs', assemble_bcc);
        this.assembly_handlers.set('b.cc', assemble_bcc);
        this.assembly_handlers.set('b.lo', assemble_bcc);
        this.assembly_handlers.set('b.mi', assemble_bcc);
        this.assembly_handlers.set('b.pl', assemble_bcc);
        this.assembly_handlers.set('b.vs', assemble_bcc);
        this.assembly_handlers.set('b.vc', assemble_bcc);
        this.assembly_handlers.set('b.hi', assemble_bcc);
        this.assembly_handlers.set('b.ls', assemble_bcc);
        this.assembly_handlers.set('b.ge', assemble_bcc);
        this.assembly_handlers.set('b.lt', assemble_bcc);
        this.assembly_handlers.set('b.gt', assemble_bcc);
        this.assembly_handlers.set('b.le', assemble_bcc);
        this.assembly_handlers.set('b.al', assemble_bcc);

        this.execution_handlers = new Map();  // execution handlers: opcode => function
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

        handler(opc, opcode, this.parse_operands(operands));
        return true;
    }


    //////////////////////////////////////////////
    //  Disassembler
    //////////////////////////////////////////////

    // return text representation of instruction at addr
    // saves fields of decoded instruction in this.inst_code[pa/4]
    disassemble(pa, va) {
        const inst = this.memory.getUint32(pa,this.little_endian);
        const result = this.inst_codec.decode(inst);
        if (result === undefined) return undefined;

        const info = result.info
        if (va === undefined) va = BigInt(this.pa2va(pa));
        result.va = va;

        if (this.inst_decode) this.inst_decode[pa/4] = result;   // save all our hard work!

        const r = (result.z === 0) ? 'w' : 'x';   // use X if result.z is undefined

        // redirect writes to WZR/XZR to a bit bucket
        result.dest = (result.d === 31) ? 33 : result.d;

        let Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
        let Xn = (result.n === 31) ? `${r}zr` : `${r}${result.n}`;
        let Xm = (result.m === 31) ? `${r}zr` : `${r}${result.m}`;

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
            else if (xopc === 'adcsbc') {
                xopc = {0: 'adc', 1: 'adcs', 2: 'sbc', 3: 'sbcs'}[result.x];
            }
            else if (xopc === 'addsub' || xopc === 'addsubx') {
                xopc = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];
                if (info.opcode === 'addsubx') {
                    // Xd is allowed to be SP only for add/sub
                    if ((result.x & 1)===0 && result.d === 31) {
                        Xd = (result.z === 0) ? 'wsp' : 'sp';
                        result.dest = 32;    // SP is register file[32]
                    }
                    if (result.n === 31) {
                        Xn = (result.z === 0) ? 'wsp' : 'sp';
                        result.n = 32;    // SP is register file[32]
                    }
                    // B, H, W extensions happen on W regs
                    if ((result.e & 0x3) != 0x3) Xm = `w${result.m}`;
                }
            }

            let i = `${xopc} ${Xd},${Xn},${Xm}`;

            // fourth operand?
            if (result.o !== undefined) {
                let Xo = (result.o === 31) ? `${r}zr` : `${r}${result.o}`;
                i += `,${Xo}`;
            }

            // shifted register?
            if (result.a !== undefined && result.a !== 0) {
                i += `,${['lsl','lsr','asr','ror'][result.s]} #${result.a}`;
                result.a = BigInt(result.a);   // for 64-bit operations
            } else result.a = undefined;   // no shift needed

            // extended register?
            if (result.e !== undefined) {
                i += `,${['uxtb','uxth','uxtw','uxtx','sxtb','sxth','sxtw','sxtx'][result.e]} #${result.i}`;
                result.i = BigInt(result.i);   // for 64-bit operations
            }
            return i;
        }

        if (info.type === 'I') {
            // convert opcode back to what user typed in...
            let opc = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];

            result.i = BigInt(result.i);   // for 64-bit operations

            // handle accesses to SP
            if ((result.x & 1) === 0 && result.d === 31) {
                result.dest = 32;   // SP is register[32]
                Xd = (result.z === 0) ? 'wsp' : 'sp';
            }
            if (result.n === 31) {
                result.n = 32;     // SP is register[32]
                Xn = (result.z === 0) ? 'wsp' : 'sp';
            }
            //if (result.s === 0 && result.i === 0n) return `mov ${Xd},${Xn}`;

            let i = `${opc} ${Xd},${Xn},#${result.i}`;
            // shifted immediate?
            if (result.s === 1) {
                i += `,lsl #12`;
                result.i <<= 12n;   // adjust the actual immediate operand too
            }
            return i;
        }

        if (info.type === 'D') {
            result.offset = BigInt(result.I || result.i || 0);   // for 64-bit operations

            if (info.opcode === 'ldr.pc') {
                let opc;
                if (result.x === 1) {
                    opc = 'ldrsw';
                    Xd = Xd.replace('w','x');   // ldrsw target is always Xn
                } else opc = 'ldr';
                result.offset = (result.offset << 2n) + va;
                return `${opc} ${Xd},0x${result.offset.toString(16)}`;
            }

            if (info.opcode === 'ldst') {
                let opc = result.s == 0 ? 'st' : 'ld'; // ld or st?
                if (result.x == 0) opc += 'u';     // unscaled offset?
                opc += 'r';
                opc += result.s == 2 ? 's' : '';    // signed?
                opc += {0: 'b', 1: 'h', 2: 'w', 3: ''}[result.z];  // size?
                result.opcode = opc;

                // handle SP as base register
                if (result.n === 31) {
                    result.n = 32;   // SP is register[32]
                    Xn = 'sp';
                }

                // dispatch on addressing mode
                switch (result.x) {
                case 0:
                    const offset = (result.offset !== 0n)  ? `,#${result.offset}` : '';
                    return `${opc} ${Xd},[${Xn}${offset}]`;
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

            let i = `${opc} ${Xd},[${Xn}`;
            if (result.I !== 0n) i += `,#${result.I}`
            return i + ']';
        }

        if (info.type === 'B') {
            result.addr = BigInt(result.I << 2) + va;
            return `${{0: 'b', 1: 'bl'}[result.x]} 0x${result.addr.toString(16)}`;
        }

        if (info.type === 'CB') {
            result.addr = BigInt(result.I << 2) + va;
            return `${{0: 'cbz', 1: 'cbnz'}[result.x]} ${Xn},0x${result.addr.toString(16)}`;
        }

        if (info.type === 'TB') {
            result.addr = BigInt(result.I << 2) + va;
            if (result.z) result.b += 32;
            return `${{0: 'tbz', 1: 'tbnz'}[result.x]} ${Xn},#${result.b},0x${result.addr.toString(16)}`;
        }

        if (info.type === 'BL') {
            return `${{0: 'bl', 1: 'blr', 2:'ret'}[result.x]} ${Xn}`;
        }

        if (info.type === 'BCC') {
            const opc = {0: 'b.eq', 1: 'b.ne',
                         2: 'b.cs', 3:'b.cc',
                         4: 'b.mi', 5: 'b.pl',
                         6: 'b.vs', 7: 'b.vc',
                         8: 'b.hi', 9: 'b.ls',
                         10: 'b.ge', 11: 'b.lt',
                         12: 'b.gt', 13: 'b.le',
                         14: 'b.al', 15: 'b.al'}[result.x];
            result.addr = BigInt(result.I << 2) + va;
            return `${opc} 0x${result.addr.toString(16)}`;
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

            return `${opc} ${Xd},${Xn},#0x${this.hexify(result.mask,16)}`;
        }

        if (info.type === 'A') {
            let imm = BigInt((result.I << 2) + (result.i));
            let base = va;
            if (info.opcode === 'adrp') {imm <<= 12n; base &= ~0xFFFn; }
            result.addr = imm + base;
            return `${info.opcode} ${Xd},#0x${result.addr.toString(16)}`;
        }

        if (info.type === 'M') {
            const opc = {0: 'movn', 2: 'movz', 3: 'movk'}[result.x];
            const a = result.s * 16;
            const shift = (result.s > 0) ? `,LSL #${a}` : '';
            result.imm = BigInt(result.i) << BigInt(a);
            result.mask = BigInt(0xFFFF) << BigInt(a);
            return `${opc} ${Xd},#0x${result.i.toString(16)}${shift}`;
        }

        return undefined;
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
        'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7',
        'w8', 'w9', 'w10', 'w11', 'w12', 'w23', 'w14', 'w15',
        'w16','w17', 'w18', 'w19', 'w20', 'w21', 'w22', 'w23',
        'w24', 'w25', 'w26', 'w27', 'w28', 'w29', 'w30', 'wzr',
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
    for (let div of document.getElementsByClassName('asim')) {
        new SimTool.ASim(div);
    }
});
