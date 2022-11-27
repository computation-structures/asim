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

// AArch64 Quick Reference
// https://courses.cs.washington.edu/courses/cse469/19wi/arm64.pdf

"use strict";

//////////////////////////////////////////////////
// ARMV8-A assembly/simulation
//////////////////////////////////////////////////

SimTool.ASim = class extends(SimTool.CPUTool) {
    constructor(tool_div) {
        // super() will call this.emulation_initialize()
        super(tool_div, 'Arm A64 asim.37', 'ARMV8A');
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

        this.mask64 = 0xFFFFFFFFFFFFFFFFn;   // BigInt mask for 64-bit unsigned
        this.max64 =  0x7FFFFFFFFFFFFFFFn;   // max 64-bit signed positive int
        this.off64 = 0x10000000000000000n;   // offset to convert unsigned to signed
        this.mask32 = 0xFFFFFFFFn;           // BigInt mask for 32-bit unsigned
        this.max32 = 0x7FFFFFFFn;           // max 32-bit signed positive int
        this.off32 = 0x100000000n;           // offset to convert unsigned to signed

        // addresses are always byte addresses; addresses are Numbers
        this.data_section_alignment = 256;
        this.bss_section_alignment = 8;
        this.address_space_alignment = 256;

        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 32;

        // ISA-specific tables and storage
        this.pc = 0n;
        this.nzcv = 0;   // condition codes
        this.register_file = new Array(32 + 2);    // include extra regs for SP and writes to XZR
        this.memory = new DataView(new ArrayBuffer(256));  // assembly will replace this
        this.inst_decode = Array(256);

        this.register_info();
        this.opcode_info();

        // reset to initial state
        this.emulation_reset();
    }

    // reset emulation state to initial values
    emulation_reset() {
        this.pc = 0n;
        this.nzcv = 0;   // condition codes
        this.register_file.fill(0n);

        if (this.assembler_memory !== undefined) {
            // allocate working copy of memory if needed
            if (this.memory === undefined || this.memory.byteLength !== this.assembler_memory.byteLength) {
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
                this.message.innerHTML = `Cannot decode instruction at physical address 0x${this.hexify(this.va_to_phys(this.pc))}`
                throw 'Halt Execution';
            }
        }

        // handler function will emulate instruction
        // if gui is passed, handler will call the appropriate gui update functions
        info.handler(this, info, update_display);

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
        row.push('<td colspan="8">');
        row.push('<span class="cpu_tool-addr" style="margin-right: 4px;">sp</span>');
        row.push(`<span id="r32">${this.hexify(this.register_file[32],this.register_nbits/4)}</span>`);
        row.push('<span class="cpu_tool-addr" style="margin-left: 4px; margin-right: 4px;">NZCV</span>');
        row.push(`<span id="nzcv">${this.nzcv.toString(2).padStart(4, '0')}</span>`);
        row.push('</td></tr>');
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

            {opcode: 'madd',   pattern: "z0011011000mmmmm0ooooonnnnnddddd", type: "R"},
            {opcode: 'msub',   pattern: "z0011011000mmmmm1ooooonnnnnddddd", type: "R"},
            {opcode: 'sdiv',   pattern: "z0011010110mmmmm000011nnnnnddddd", type: "R"},
            {opcode: 'smulh',  pattern: "z0011011010mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'udiv',   pattern: "z0011010110mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'umulh',  pattern: "z0011011110mmmmm011111nnnnnddddd", type: "R"},

            // u,x: 00=smaddl, 01=smsubl, 10=umaddl, 1=umsubl
            {opcode: 'muladd', pattern: "10011011u01mmmmmxooooonnnnnddddd", type: "MA"},

            // bit manipulation
            // x: 0=sbfm, 1=bfm, 2=ubfm
            {opcode: 'bf',     pattern: "zxx100110yrrrrrrssssssnnnnnddddd", type: "BF"},

            {opcode: 'cls',    pattern: "z101101011000000000101nnnnnddddd", type: "BITS"},
            {opcode: 'clz',    pattern: "z101101011000000000100nnnnnddddd", type: "BITS"},
            {opcode: 'rbit',   pattern: "z101101011000000000000nnnnnddddd", type: "BITS"},
            {opcode: 'rev',    pattern: "z10110101100000000001ynnnnnddddd", type: "BITS"},
            {opcode: 'rev16',  pattern: "z101101011000000000001nnnnnddddd", type: "BITS"},
            {opcode: 'rev32',  pattern: "1101101011000000000010nnnnnddddd", type: "BITS"},
            {opcode: 'extr',   pattern: "z00100111y0mmmmmiiiiiinnnnnddddd", type: "EXTR"},

            // logical and move

            // s: 0=LSL, 1=LSR, 2=ASR, 3=ROR
            // xxN: 000=and, 001=bic, 010=orr, 011=orn, 100=eor, 101=eon, 110=ands, 111=bics
            {opcode: 'bool',   pattern: "zxx01010ssNmmmmmaaaaaannnnnddddd", type: "R"},

            // x: 0=andm, 1=orrm, 2=eorm, 3:andms
            // y: 1=complement mask
            {opcode: 'boolm',  pattern: "zxx100100yrrrrrrssssssnnnnnddddd", type: "IM"},

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

            // c: 0=eq, 1=ne, 2=cs, 3=cc, 4=mi, 5=pl, 6=vs, 7=vc,
            //    8=hi, 9=ls, 10=ge, 11=lt, 12=gt, 13=le, 14=al, 15=nv
            {opcode: 'bcc',    pattern: "01010100IIIIIIIIIIIIIIIIIII0cccc", type: "BCC"},

            // conditional

            // x,y: 00: csel, 01: csinc, 10: csinv, 11: csneg
            // c: 0=eq, 1=ne, 2=cs, 3=cc, 4=mi, 5=pl, 6=vs, 7=vc,
            //    8=hi, 9=ls, 10=ge, 11=lt, 12=gt, 13=le, 14=al, 15=nv
            {opcode: 'csxx',   pattern: "zx011010100mmmmmcccc0ynnnnnddddd", type: "CS"},

            // x: 0: ccmn, 1: ccmp
            // y: 0: register, 1: immediate
            {opcode: 'ccxx',   pattern: "zx111010010mmmmmccccy0nnnnn0iiii", type: "CC"},

            // load and store
            // s: 0=str, 1=ldr, 2=ldrs/X, 3=ldrs/W
            // x: 0=unscaled offset, 1=post-index, 3=pre-index
            {opcode: 'ldst',   pattern: "zz111000ss0IIIIIIIIIxxnnnnnddddd", type: "D"},  // post-, pre-index
            {opcode: 'ldst.off',pattern:"zz111001ssiiiiiiiiiiiinnnnnddddd", type: "D"},  // scaled, unsigned offset
            // o: 2=UXTW, 3=LSL, 6=SXTW, 7=SXTX
            // y: 0=no shift, 1=scale by size
            // x: must be 2
            {opcode: 'ldst.reg',pattern:"zz111000ss1mmmmmoooyxxnnnnnddddd", type: "D"},  // register offset, n==SP allowed
            // x,z: 0=ldr (32-bit), 1=ldr, 2=ldrsw
            {opcode: 'ldr.pc', pattern: "xz011000IIIIIIIIIIIIIIIIIIIddddd", type: "D"},  // pc offset

            // x: 0=ldp32, 1=ldpsw, 2=ldp64
            // o: 1=ld, 0=st
            // s: 1=post index, 2=signed index, 3=pre index
            {opcode: 'ldstp',  pattern: "xx10100ssoIIIIIIIeeeeennnnnddddd", type: "P"},

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
        //  .type: 'register', 'shifted-register', 'extended-register', 'immediate', 'address', 'condition'
        //  .regname: xn or wn, n = 0..30 PLUS xzr, wzr, sp, fp, lp
        //  .reg:  n
        //  .shiftext:  lsl, lsr, asr, ror, [su]xt[bhwx]
        //  .shamt:  expression tree
        //  .imm: expression tree
        //  .addr: Array of operand objects  [...]
        //  .pre_index: boolean   [Xn, #i]!
        //  .post_index: boolean  [Xn], #i
        //  .condition: two-character condition code
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
        //   eq, ne, ...  (condition code)
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
            'wzr': 31, 'wsp': 31,
        };

        tool.parse_operands = function(operands) {
            let result = [];
            let index = 0;
            let prev = undefined;   // previous operand

            while (index < operands.length) {
                let operand = operands[index++];   // array of tokens
                let j = 0;   // index into array of tokens

                const token = operand[j];
                const tstring = (token.type === 'number') ? '' : token.token.toLowerCase();

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
                    if (operand[j].token === '#') j += 1;  // optional "#" in front of immediate
                    // prev operand must be a reg or an immediate if shift is LSL
                    if (prev !== undefined) {
                        prev.end = operand[operand.length - 1].end;
                        prev.shiftext = tstring;
                        prev.shamt = tool.read_expression(operand,j);
                        if (tool.pass === 2) prev.shamt = Number(tool.eval_expression(prev.shamt));
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
                    prev.shamt = undefined;
                    prev.end = operand[operand.length - 1];
                    if (j < operand.length) {
                        if (operand[j].token === '#') j += 1;  // optional "#" in front of immediate
                        prev.shamt = tool.read_expression(operand,j);
                        if (tool.pass === 2) prev.shamt = Number(tool.eval_expression(prev.shamt));
                        else prev.shamt = 0;
                    }
                    continue;
                }

                // address operand
                if (tstring === '[') {
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

                // immediate operand or condition name
                if (tstring === '#') j += 1;
                else if (operand.length === 1) {
                    const cond = {eq: 0, ne:1, cs:2, hs:2, cc:3, lo: 3, mi:4, pl:5, vs:6, vc:7,
                                  hi: 8, ls:9, ge:10, lt:11, gt:12, le:13, al:14, nv:15}[tstring]
                    if (cond !== undefined) {
                        prev = {
                            type: 'condition',
                            condition: tstring,
                            cc: cond,
                            start: operand[0].start,
                            end: operand[0].end,
                        }
                        result.push(prev);
                        continue;
                    }
                }

                let exp,imm;
                exp = this.read_expression(operand,j);
                if (tool.pass === 2) imm = tool.eval_expression(exp);
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
                        expression: exp,
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
            if (size !== undefined && operand.z !== size) 
                tool.syntax_error(`Expected ${size === 1 ? 'X' : 'W'} reg`,operand.start,operand.end);
            return operand.reg;
        }

        // return register number
        function check_register_or_sp(operand, size, zr_not_allowed) {
            if (operand.type !== 'sp') {
                check_operand(operand,'register');
                if (zr_not_allowed && operand.reg === 31) 
                    tool.syntax_error('Invalid operand',operand.start,operand.end);
            }
            if (size !== undefined && operand.z !== size) 
                tool.syntax_error(`Expected ${size === 1 ? 'X' : 'W'} reg`,operand.start,operand.end);
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
        function is_mask(n) { return ((n + 1n) & n) === 0n; }

        // is this number's binary representation a sequence
        // of 1's followed by a sequence of 0's
        function is_shifted_mask(n) { return is_mask((n - 1n) | n); }

        // number of trailing zeroes in binary representation
        function trailing_0s(n) {
            for (let i = 0; i < 64; i += 1, n >>= 1n)
                if ((n & 1n) === 1n) return i;
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
            if (tool.pass !== 2) {
                fields.y = 0;
                fields.r = 0;
                fields.s = 0;
                fields.mask = 0n;
                return true;
            }

            // https://kddnewton.com/2022/08/11/aarch64-bitmask-immediates.html
            let size = (fields.z == 1) ? 64 : 32;
            const v = BigInt.asUintN(size,mask);   // value to be encoded
            fields.mask = v;

            // can't encode all 0's or all 1;s
            if (v === 0n || v === ((1n << BigInt(size)) - 1n)) return undefined;

            // determine the size of the pattern that we’re dealing with.
            // To do this, we’ll start at 64-bits and work downward. If the binary
            // representation of the value is equal to itself when shifted by 32 bits,
            // then we know we can continue. Otherwise, it must be a 64-bit pattern.
            // Similarly, if the binary representation of the value is equal to itself
            // when shifted by 16 bits, we can continue on. We continue on in this
            // manner until we find the size.
            let imm = v;
            //let size = 64;
            for (;;) {
                size >>= 1;
                mask = (1n << BigInt(size)) - 1n;
                if ((imm & mask) !== ((imm >> BigInt(size)) & mask)) { size <<= 1; break; }
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
            fields.y = ((imms >> 6) & 1) ^ 1;
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
            const m = operands[noperands - 1];
            if (opc == 'tst') {
                fields = {d: 31, n: check_register(operands[0])};
                fields.z = operands[0].z;
            } else if (['cmp','cmn'].includes(opc)) {
                fields = {
                    d: 31,
                    n: check_register_or_sp(operands[0], undefined, ['adds','subs'].includes(xopc))
                };
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
                const rd_sp_ok = (['add','sub'].includes(xopc) && m.type!='shifted-register') ||
                      (m.type === 'immediate' && ['and','eor','orr'].includes(xopc));
                fields = {d: rd_sp_ok ? check_register_or_sp(operands[0], undefined, true) :
                                        check_register(operands[0])};
                fields.z = operands[0].z;
                const rn_sp_ok = ['add','sub','adds','subs'].includes(xopc) && m.type!='shifted-register';
                fields.n = rn_sp_ok ? check_register_or_sp(operands[1], fields.z, true) :
                                      check_register(operands[1], fields.z);
            }

            if (m.type === 'immediate') {
                if (context === 'arithmetic') {
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
                            m.shiftext = 'lsl';
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
                        if (m.z !== fields.z) 
                            tool.syntax_error(`Expected ${fields.z === 1 ? 'X' : 'W'} reg`,m.start,m.end);
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
                        if (fields.e === undefined) {
                            if (m.shiftext === 'lsl') fields.e = fields.z ? 3 : 2;
                            else tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                        }
                        if (m.shamt < 0 || m.shamt > 4)
                            tool.syntax_error('shift amount not in range 0:4',m.start,m.end);
                        fields.m = m.reg;
                        fields.i = m.shamt;
                    }
                }
                else if (context === 'logical') {
                    const encoding = {'and': 0, 'bic': 1, 'orr': 2, 'orn': 3,
                                      'eor': 4, 'eon': 5, 'ands': 6, 'bics': 7}[xopc];
                    fields.N = encoding & 0x1;
                    fields.x = encoding >> 1;
                    fields.m = m.reg;
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
            const sz = (fields.z == 0) ? 32 : 64;

            if (operands[2].type === 'immediate') {
                fields.n = check_register(operands[1], fields.z);
                const shift = check_immediate(operands[2], 0, sz - 1);
                switch(fields.s) {
                case 0:   // lsl
                    // use UBFM rd, rn, #(-shift mod sz), #(sz - 1 - shift)
                    opc = 'bf';
                    fields.x = 2;  // ubfm
                    fields.y = fields.z;
                    fields.r = (-shift) & (sz - 1);
                    fields.s = sz - 1 - shift;
                    break;
                case 1:   // lsr
                    // use UBFM rd, rn, #shift, #(sz - 1)
                    opc = 'bf';
                    fields.x = 2;  // ubfm
                    fields.y = fields.z;
                    fields.r = shift;
                    fields.s = sz - 1;
                    break;
                case 2:   // asr
                    // use SBFM rd, rn, #shift, #(sz - 1)
                    opc = 'bf';
                    fields.x = 0;  // sbfm
                    fields.y = fields.z;
                    fields.r = shift;
                    fields.s = sz - 1;
                    break;
                case 3:   // ror
                    // use EXTR rd, rn, rn, #shift
                    opc = 'extr';
                    fields.y = fields.z;
                    fields.m = fields.n;
                    fields.i = shift;
                    break;
                }
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

            let fields = {
                d: check_register(operands[0])
            };
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

        function assemble_bits(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            let fields = {
                d: opc == 'rev32' ? check_register(operands[0], 1) : check_register(operands[0])
            };
            fields.y = fields.z = operands[0].z;
            fields.n = check_register(operands[1], fields.z);

            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_extr(opc, opcode, operands) {
            if (operands.length !== 4)
                tool.syntax_error(`${opc.toUpperCase()} expects 4 operands`, opcode.start, opcode.end);

            const fields = {d: check_register(operands[0])};
            fields.y = fields.z = operands[0].z;
            fields.n = check_register(operands[1], fields.z);
            fields.m = check_register(operands[2], fields.z);
            fields.i = check_immediate(operands[3], 0, fields.z ? 63 : 31);

            // emit encoded instruction
            tool.inst_codec.encode(opc, fields, true);
        }
        
        function assemble_muladd(opc, opcode, operands) {
            let noperands = {smaddl: 4, smsubl: 4, umaddl: 4, umsubl: 4,
                             smnegl: 3, smull: 3, umnegl: 3, umull: 3}[opc];

            if (operands.length !== noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`, opcode.start, opcode.end);
            
            let fields = {
                d: check_register(operands[0], 1),
                n: check_register(operands[1], 0),
                m: check_register(operands[2], 0),
                o: (noperands === 4) ? check_register(operands[3], 1) : 31,
                u: opc.charAt(0) === 'u' ? 1 : 0,
                x: ['smsubl', 'umsubl', 'smnegl', 'umnegl'].includes(opc) ? 1 : 0
            };

            // emit encoded instruction
            tool.inst_codec.encode('muladd', fields, true);
        }

        function assemble_adr(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error(`${opc.toUpperCase()} expects 2 operands`, opcode.start, opcode.end);

            const fields = {
                d: check_register(operands[0], 1),
                i: 0,
                I: check_immediate(operands[1])
            };

            if (tool.pass === 2) {
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
            if (operands.length !== 1)
                tool.syntax_error(`${opc.toUpperCase()} expects 1 operand`, opcode.start, opcode.end);

            const fields = {
                x: {'b': 0, 'bl': 1}[opc],
                I: check_immediate(operands[0]),
            }
            if (tool.pass === 2) {
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
                c: {'b.eq': 0, 'b.ne': 1,
                    'b.cs': 2, 'b.cc': 3,
                    'b.hs': 2, 'b.lo': 3,
                    'b.mi': 4, 'b.pl': 5,
                    'b.vs': 6, 'b.vc': 7,
                    'b.hi': 8, 'b.ls': 9,
                    'b.ge': 10, 'b.lt': 11,
                    'b.gt': 12, 'b.le': 13,
                    'b.al': 14, 'b.nv': 15}[opc],
                I: check_immediate(operands[0]),
            };
            if (tool.pass === 2) {
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
                fields.d = check_register_or_sp(operands[0], undefined, true);
                fields.z = operands[0].z;
                fields.n = check_register_or_sp(operands[1], fields.z, true);
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
                        tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);

                    imm = operands[1].imm & tool.mask64;
                    const notimm = (~operands[1].imm) & tool.mask64;

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
                    if (encode_bitmask_immediate(imm, fields)) {
                        xopc = 'boolm';
                        fields.n = 31; // xzr
                        fields.x = 1;  // ORR
                    } else {
                        // no single-instruction encodings, generate sequence of movz,movk...
                        // NB: imm is not zero otherwise we would have encoded it above.
                        xopc = 'movx';
                        fields.x = 2; // movz
                        for (let i = 0; i < 4; i += 1) {
                            let n = Number(imm & 0xFFFFn);
                            if (n !== 0) {
                                fields.i = n
                                fields.s = i;
                                tool.inst_codec.encode(xopc, fields, true);
                            }
                            imm >>= 16n;
                            fields.x = 3;  // movk
                        }
                        return;
                    }
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
            const [_,op,unscaled,signed,size] = opc.match(/(ld|st)(u?)r(s?)([bhw]?)/);
            fields.z = {'b': 0, 'h': 1, 'w': 2}[size];
            if (fields.z === undefined) fields.z = (2 + operands[0].z);
            fields.s = (op === 'st') ? 0 : (signed ? (operands[0].z ? 2 : 3) : 1);
            
            let addr = operands[1].addr;    // expecting base, offset
            if (addr === undefined)
                tool.syntax_error('Invalid operand',operands[1].start,operands[1].end)
            fields.n = check_register_or_sp(addr[0], 1, true);   // base register
            const scale = fields.z;

            // is offset a register?
            if (addr.length === 2 && ['register','shifted-register','extended-register'].includes(addr[1].type)) {
                if (!operands[1].pre_index && !operands[1].post_index) {
                    fields.m = addr[1].reg;
                    fields.x = 2;
                    if (addr[1].shiftext === undefined) { fields.o = 3; fields.y = 0;}
                    else {
                        fields.o = {'lsl': 3, 'uxtw': 2, 'sxtw': 6, 'sxtx': 7}[addr[1].shiftext];
                        // validate shift/extend option
                        // LSL => shift amount must be 0 or 2/3 depending on target register
                        // LSL, SXTX => offset register must be Xm
                        // UXTX, SXTW => offset register must be Wm
                        if (fields.o === undefined ||
                            (fields.o===3 && !(addr[1].shamt === 0 || addr[1].shamt === scale)) ||
                            ((fields.o & 1) !== addr[1].z))
                            tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
                        if (addr[1].shamt === undefined || (scale != 0 && addr[1].shamt === 0))
                            fields.y = 0;
                        else if (addr[1].shamt !== scale)
                            tool.syntax_error(`Shift amount does not match size of ${operands[0].rname}`,operands[0].start,operands[0].end);
                        else fields.y = 1;
                    }
                    tool.inst_codec.encode('ldst.reg', fields, true);
                    return;
                }
            }

            // offset is ommitted or an immediate
            else if (addr !== undefined && addr.length <= 2 && addr[0] !== undefined) {
                if (unscaled) {  // ldur*, stur*
                    if (!operands[1].pre_index && !operands[1].post_index) {
                        if (addr[1] !== undefined) fields.I = check_immediate(addr[1], -256, 255);
                        else fields.I = 0;
                        fields.x = 0;   // unscaled offset
                        tool.inst_codec.encode('ldst', fields, true);
                        return;
                    } else
                        tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
                }
                else if (operands[1].pre_index) {
                    if (addr[1] !== undefined) fields.I = check_immediate(addr[1], -256, 255);
                    else fields.I = 0;
                    fields.x = 3;   // pre_index
                    tool.inst_codec.encode('ldst', fields, true);
                    return;
                }
                else if (operands[1].post_index) {
                    fields.I = operands[1].post_index;
                    if (fields.I < -256 || fields.I >= 256)
                        tool.syntax_error(`Immediate value ${fields.I} out of range -256:255`,
                                          operands[1].start, operands[1].end);

                    fields.x = 1;   // post_index
                    tool.inst_codec.encode('ldst', fields, true);
                    return;
                }
                else {
                    // must be scaled, unsigned offset
                    if (addr[1] !== undefined) fields.i = check_immediate(addr[1], 0, (4096 << scale) - 1);
                    else fields.i = 0;
                    if ((fields.i % (1 << scale)) !== 0)
                        tool.syntax_error(`Offset ${fields.i} must be a multiple of ${1 << scale}`,
                                          operands[1].start, operands[1].end);
                    fields.i >>= scale;
                    tool.inst_codec.encode('ldst.off', fields, true);
                    return;
                }
            }
            tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
        }

        function assemble_ldstp(opc, opcode, operands) {
            if (operands.length !== 3)
                tool.syntax_error(`${opc.toUpperCase()} expects 3 operands`,opcode.start,opcode.end);

            const fields = {d: check_register(operands[0])};
            fields.e = check_register(operands[1],operands[0].z);
            fields.x = (opc === 'ldpsw') ? 1 : operands[0].z*2;
            fields.o = (opc === 'stp') ? 0 : 1;

            let addr = operands[2].addr;    // expecting base, offset
            if (addr === undefined || addr[0] === undefined || addr.length > 2 || (addr.length == 2 && addr[1].type !== 'immediate'))
                tool.syntax_error('Invalid operand',operands[2].start,operands[2].end)
            fields.n = check_register_or_sp(addr[0], 1, true);   // base register

            const scale = (opc === 'ldpsw' || operands[0].z === 0) ? 2 : 3;
            fields.I = operands[2].post_index || (addr.length == 2 ? Number(addr[1].imm) : 0);
            const minv = -64 << scale;
            const maxv = (64 << scale) - 1;
            if (fields.I < minv || fields.I > maxv)
                tool.syntax_error(`Offset ${fields.I} out of range ${minv}:${maxv}`,
                                  operands[2].start, operands[2].end);
            if ((fields.I % (1 << scale)) !== 0)
                tool.syntax_error(`Offset ${fields.I} must be a multiple of ${1 << scale}`,
                                  operands[2].start, operands[2].end);
            fields.I >>= scale;

            if (operands[2].pre_index) fields.s = 3;   // pre-index
            else if (operands[2].post_index) fields.s = 1;   // post-index
            else fields.s = 2;   // signed offset

            tool.inst_codec.encode('ldstp', fields, true);
        }

        function assemble_csxx(opc, opcode, operands) {
            const noperands = {cinc: 3, cinv: 3, cneg: 3, csel: 4,
                               cset: 2, csetm: 2, csinc: 4, csinv: 4,
                               csneg:4}[opc];
            if (operands.length !== noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`,opcode.start,opcode.end);
            const cond = operands[noperands - 1];
            if (cond.type !== 'condition')
                tool.syntax_error(`${opc.toUpperCase()} expects a condition as the final operand`,cond.start,cond.end);

            const fields = {
                d: check_register(operands[0]),
                z: operands[0].z,
                c: cond.cc
            };

            const xopc = {csetm: 'csinv', cset: 'csinc', cinc: 'csinc',
                          cinv: 'csinv', cneg: 'csneg'}[opc] || opc;

            if (['csetm', 'cset'].includes(opc)) {
                fields.n = 31;
                fields.m = 31;
                if (fields.c === 14 || fields.c === 15)
                    tool.syntax_error('AL or NV not permitted',cond.start,cond.end);
                fields.c ^= 1;   // invert condition
            }
            else if (['cinc', 'cinv', 'cneg'].includes(opc)) {
                fields.n = check_register(operands[1], fields.z);
                if (opc !== 'cneg' && fields.n === 31)
                    tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
                fields.m = fields.n;
                fields.c ^= 1;   // invert condition
                if (fields.c === 14 || fields.c === 15)
                    tool.syntax_error('AL or NV not permitted',cond.start,cond.end);
            }
            else {
                fields.n = check_register(operands[1], fields.z);
                fields.m = check_register(operands[2], fields.z);
            }

            fields.x = (xopc === 'csinv' || xopc === 'csneg') ? 1 : 0;
            fields.y = (xopc === 'csinc' || xopc === 'csneg') ? 1 : 0;

            tool.inst_codec.encode('csxx', fields, true);
        }

        function assemble_ccxx(opc, opcode, operands) {
            if (operands.length !== 4)
                tool.syntax_error(`${opc.toUpperCase()} expects 4 operands`,opcode.start,opcode.end);
            const cond = operands[3];
            if (cond.type !== 'condition')
                tool.syntax_error(`${opc.toUpperCase()} expects a condition as the final operand`,cond.start,cond.end);

            const fields = {
                n: check_register(operands[0]),
                x: (opc === 'ccmp') ? 1 : 0,
                y: operands[1].type === 'immediate' ? 1 : 0,
                i: check_immediate(operands[2], 0, 15),
                c: cond.cc,
            };
            fields.z = operands[0].z;
            if (fields.y == 1) fields.m = check_immediate(operands[1], 0, 31);
            else fields.m = check_register(operands[1], fields.z);
            
            tool.inst_codec.encode('ccxx', fields, true);
        }

        function assemble_bit_field(opc, opcode, operands) {
            const noperands = {bfc: 3, sxtb: 2, sxth: 2, sxtw: 2, uxtb: 2, uxth: 2}[opc] || 4;
            if (operands.length != noperands)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`,opcode.start,opcode.end);
            const fields = {
                x: {'sbfm': 0, 'sbfiz': 0, 'sbfx': 0, 'sxtb': 0, 'sxth': 0, 'sxtw': 0,
                    'bfm': 1, 'bfc': 1, 'bfi': 1, 'bfxil': 1,
                    'ubfm': 2, 'ubfiz': 2, 'ubfx': 2, 'uxtb': 2, 'uxth': 2
                   }[opc]
            };

            let imm1, imm2;
            if (opc === 'bfc') {
                fields.d = check_register(operands[0]);
                fields.y = fields.z = operands[0].z;
                fields.n = 31;
                imm1 = check_immediate(operands[1], 0, fields.z ? 63 : 31);
                imm2 = check_immediate(operands[2], 0, fields.z ? 63 : 31);
            } else if (['sxtb','sxth','sxtw'].includes(opc)) {
                fields.d = check_register(operands[0]);
                fields.y = fields.z = operands[0].z;
                fields.n = check_register(operands[1], 0);
                imm1 = 0;
                imm2 = {sxtb: 7, sxth: 15, sxtw: 31}[opc];
            } else if (['uxtb','uxth'].includes(opc)) {
                fields.d = check_register(operands[0], 0);
                fields.y = fields.z = operands[0].z;
                fields.n = check_register(operands[1], 0);
                imm1 = 0;
                imm2 = {uxtb: 7, uxth: 15}[opc];
            } else {
                fields.d = check_register(operands[0]);
                fields.y = fields.z = operands[0].z;
                fields.n = check_register(operands[1], fields.z);
                imm1 = check_immediate(operands[2], 0, fields.z ? 63 : 31);
                imm2 = check_immediate(operands[3], 0, fields.z ? 63 : 31);
            }

            if (['bfxil', 'sbfx', 'ubfx'].includes(opc)) {
                // #lsb (range 0..31/63), #width (range 1..(32/64-lsb))
                if (tool.pass == 2 && (imm2 < 1 || imm2 > ((fields.z ? 64 : 32) - imm1)))
                    tool.syntax_error(`Width out of range 1 to ${fields.z ? 64 : 32}-lsb`,
                                      opcode.start,opcode.end);
                fields.r = imm1;
                fields.s = imm1 + imm2 - 1;
            }
            else if (['bfc', 'bfi', 'sbfiz', 'ubfiz'].includes(opc)) {
                // #lsb (range 0..31/63), #width (range 1..(32/64-lsb))
                if (tool.pass == 2 && (imm2 < 1 || imm2 > ((fields.z ? 64 : 32) - imm1)))
                    tool.syntax_error(`${opc}: Width out of range 1 to ${fields.z ? 64 : 32}-lsb}`,
                                      opcode.start,opcode.end);
                fields.r = (-imm1) & (fields.z ? 63 : 31);
                fields.s = imm2 - 1;
            }
            else {
                fields.r = imm1;
                fields.s = imm2;
            }

            tool.inst_codec.encode('bf', fields, true);
        }

        function assemble_not_implemented(opc, opcode, operands) {
            tool.syntax_error(`${opc.toUpperCase()} not yet supported`,opcode.start,opcode.end);
        }

        //////////////////////////////////////////////////
        // Assembly
        //////////////////////////////////////////////////

        this.assembly_handlers = new Map();
        // arithmetic
        this.assembly_handlers.set('adc', assemble_adcsbc);
        this.assembly_handlers.set('adcs', assemble_adcsbc);
        this.assembly_handlers.set('add', assemble_op2_arithmetic);
        this.assembly_handlers.set('adds', assemble_op2_arithmetic);
        this.assembly_handlers.set('adr', assemble_adr);
        this.assembly_handlers.set('adrp', assemble_adr);
        this.assembly_handlers.set('cmn', assemble_op2_arithmetic);
        this.assembly_handlers.set('cmp', assemble_op2_arithmetic);
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
        this.assembly_handlers.set('smaddl', assemble_muladd);
        this.assembly_handlers.set('smnegl', assemble_muladd);
        this.assembly_handlers.set('smsubl', assemble_muladd);
        this.assembly_handlers.set('smulh', assemble_registers);
        this.assembly_handlers.set('smull', assemble_muladd);
        this.assembly_handlers.set('sub', assemble_op2_arithmetic);
        this.assembly_handlers.set('subs', assemble_op2_arithmetic);
        this.assembly_handlers.set('udiv', assemble_registers);
        this.assembly_handlers.set('umaddl', assemble_muladd);
        this.assembly_handlers.set('umnegl', assemble_muladd);
        this.assembly_handlers.set('umsubl', assemble_muladd);
        this.assembly_handlers.set('umulh', assemble_registers);
        this.assembly_handlers.set('umull', assemble_muladd);

        // bit manipulation instructions
        this.assembly_handlers.set('bfc', assemble_bit_field);
        this.assembly_handlers.set('bfi', assemble_bit_field);
        this.assembly_handlers.set('bfm', assemble_bit_field);
        this.assembly_handlers.set('bfxil', assemble_bit_field);
        this.assembly_handlers.set('cls', assemble_bits);
        this.assembly_handlers.set('clz', assemble_bits);
        this.assembly_handlers.set('extr', assemble_extr);
        this.assembly_handlers.set('rbit', assemble_bits);
        this.assembly_handlers.set('rev', assemble_bits);
        this.assembly_handlers.set('rev16', assemble_bits);
        this.assembly_handlers.set('rev32', assemble_bits);
        this.assembly_handlers.set('sbfiz', assemble_bit_field);
        this.assembly_handlers.set('sbfm', assemble_bit_field);
        this.assembly_handlers.set('sbfx', assemble_bit_field);
        this.assembly_handlers.set('sxtb', assemble_bit_field);
        this.assembly_handlers.set('sxth', assemble_bit_field);
        this.assembly_handlers.set('sxtw', assemble_bit_field);
        this.assembly_handlers.set('ubfiz', assemble_bit_field);
        this.assembly_handlers.set('ubfm', assemble_bit_field);
        this.assembly_handlers.set('ubfx', assemble_bit_field);
        this.assembly_handlers.set('uxtb', assemble_bit_field);
        this.assembly_handlers.set('uxth', assemble_bit_field);

        // logical and move
        this.assembly_handlers.set('and', assemble_op2_logical);
        this.assembly_handlers.set('ands', assemble_op2_logical);
        this.assembly_handlers.set('asr', assemble_shift);
        this.assembly_handlers.set('bic', assemble_op2_logical);
        this.assembly_handlers.set('bics', assemble_op2_logical);
        this.assembly_handlers.set('eon', assemble_op2_logical);
        this.assembly_handlers.set('eor', assemble_op2_logical);
        this.assembly_handlers.set('lsl', assemble_shift);
        this.assembly_handlers.set('lsr', assemble_shift);
        this.assembly_handlers.set('mov', assemble_mov);
        this.assembly_handlers.set('movk', assemble_movx);
        this.assembly_handlers.set('movn', assemble_movx);
        this.assembly_handlers.set('movz', assemble_movx);
        this.assembly_handlers.set('mvn', assemble_op2_logical);
        this.assembly_handlers.set('orn', assemble_op2_logical);
        this.assembly_handlers.set('orr', assemble_op2_logical);
        this.assembly_handlers.set('ror', assemble_shift);
        this.assembly_handlers.set('tst', assemble_op2_logical);

        // branches
        this.assembly_handlers.set('b', assemble_bl);
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
        this.assembly_handlers.set('b.nv', assemble_bcc);
        this.assembly_handlers.set('bl', assemble_bl);
        this.assembly_handlers.set('blr', assemble_blr);
        this.assembly_handlers.set('br', assemble_blr);
        this.assembly_handlers.set('cbnz', assemble_cb);
        this.assembly_handlers.set('cbz', assemble_cb);
        this.assembly_handlers.set('ret', assemble_blr);
        this.assembly_handlers.set('tbz', assemble_tb);
        this.assembly_handlers.set('tbnz', assemble_tb);

        // conditionals
        this.assembly_handlers.set('ccmn', assemble_ccxx);
        this.assembly_handlers.set('ccmp', assemble_ccxx);
        this.assembly_handlers.set('cinc', assemble_csxx);
        this.assembly_handlers.set('cinv', assemble_csxx);
        this.assembly_handlers.set('cneg', assemble_csxx);
        this.assembly_handlers.set('csel', assemble_csxx);
        this.assembly_handlers.set('cset', assemble_csxx);
        this.assembly_handlers.set('csetm', assemble_csxx);
        this.assembly_handlers.set('csinc', assemble_csxx);
        this.assembly_handlers.set('csinv', assemble_csxx);
        this.assembly_handlers.set('csneg', assemble_csxx);

        // load and store
        this.assembly_handlers.set('ldp', assemble_ldstp);
        this.assembly_handlers.set('ldpsw', assemble_ldstp);
        this.assembly_handlers.set('ldr', assemble_ldst);
        this.assembly_handlers.set('ldrb', assemble_ldst);
        this.assembly_handlers.set('ldrh', assemble_ldst);
        this.assembly_handlers.set('ldrsb', assemble_ldst);
        this.assembly_handlers.set('ldrsh', assemble_ldst);
        this.assembly_handlers.set('ldrsw', assemble_ldst);
        this.assembly_handlers.set('ldur', assemble_ldst);
        this.assembly_handlers.set('ldurb', assemble_ldst);
        this.assembly_handlers.set('ldurh', assemble_ldst);
        this.assembly_handlers.set('ldursb', assemble_ldst);
        this.assembly_handlers.set('ldursh', assemble_ldst);
        this.assembly_handlers.set('ldursw', assemble_ldst);
        this.assembly_handlers.set('stp', assemble_ldstp);
        this.assembly_handlers.set('str', assemble_ldst);
        this.assembly_handlers.set('strb', assemble_ldst);
        this.assembly_handlers.set('strh', assemble_ldst);
        this.assembly_handlers.set('stur', assemble_ldst);
        this.assembly_handlers.set('sturb', assemble_ldst);
        this.assembly_handlers.set('sturh', assemble_ldst);
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
    //  Emulation handlers
    //////////////////////////////////////////////

    handle_not_implemented(tool, info, update_display) {
        tool.message.innerHTML = `Unimplemented opcode ${info.opcode.toUpperCase()} at physical address 0x${tool.hexify(tool.va_to_phys(tool.pc))}`;

        throw 'Halt Execution';
    }

    // expected info fields:
    // .dest  destination register number (sp=32, bit bucket = 33)
    // .n     first source register number (sp=32)
    // .m     second source register number
    // .N     1=complement second operand
    // .msel  undefined=as-is, 0=immediate,
    //        1=UXTB, 2=UXTH, 3=UXTW, 4=UXTX,
    //        5=SXTB, 6=SXTH, 7=SXTW, 8=SXTX,
    //        9=LSL, 10=LSR, 11=ASR, 12=ROR
    // .a     shifted-register shift amount (BigInt)
    // .cin   0=0, 1=1, 2=C bit  (for add operation)
    // .sz    32 or 64, bit size of result and operands
    // .i     immediate operand or extended-register shift amount (BigInt)
    // .alu   0=addc, 1=and, 2=or, 3=eor, 4=lsl, 5=lsr, 6=asr, 7=ror,
    //        8=madd, 9=msub, 10=sdiv, 11=udiv, 12=smulh, 13=umulh,
    //        14=smaddl, 15=smsubl, 16=umaddl, 17=umsubl
    // .flags true => set NZCV flags
    handle_alu(tool, info, update_display) {
        const op1 = tool.register_file[info.n] & info.vmask;
        let op2 = tool.register_file[info.m || 31] & info.vmask;

        // support op2 variants of second operand
        if (info.msel === 0) op2 = info.i;
        else if (info.msel !== undefined) switch (info.msel) {
            case 1: op2 = BigInt.asUintN(8, op2) << info.i; break;   // UXTB
            case 2: op2 = BigInt.asUintN(16, op2) << info.i; break;   // UXTH
            case 3: op2 = BigInt.asUintN(32, op2) << info.i; break;   // UXTW
            case 4: op2 = BigInt.asUintN(64, op2) << info.i; break;   // UXTX
            case 5: op2 = BigInt.asIntN(8, op2) << info.i; break;   // SXTB
            case 6: op2 = BigInt.asIntN(16, op2) << info.i; break;   // SXTH
            case 7: op2 = BigInt.asIntN(32, op2) << info.i; break;   // SXTW
            case 8: op2 = BigInt.asIntN(64, op2) << info.i; break;   // SXTX
            case 9: op2 <<= info.a; break;   // LSL
            case 10: op2 >>= info.a; break;   // LSR
            case 11: op2 = BigInt.asIntN(info.sz, op2) >> info.a; break;   // ASR
            case 12: op2 = ((op2 << BigInt(info.sz)) | op2) >> info.a; break;   // ROR
            default: op2 = 0n;
        }
        if (info.N === 1) op2 = ~op2;
        op2 &= info.vmask;

        // compute result
        let result,cin;
        switch (info.alu) {
        case 0:  // add with carry
            cin = info.cin;
            if (cin == 2) cin = (tool.nzcv & 0x2) ? 1 : 0;
            cin = BigInt(cin);
            result = op1 + op2 + cin;
            break;
        case 1:  // and
            result = op1 & op2;
            break;
        case 2:  // or
            result = op1 | op2;
            break;
        case 3:  // eor
            result = op1 ^ op2;
            break;
        case 4:  // lsl
            result = op1 << op2;
            break;
        case 5:  // lsr
            result = op1 >> op2;    // NB: op1 and op2 are unsigned
            break;
        case 6:  // asr
            result = BigInt.asIntN(info.sz, op1) >> op2;
            break;
        case 7:  // ror
            result = ((op1 << BigInt(info.sz)) | op1) >> op2;
            break;
        case 8:  // madd
            result = tool.register_file[info.o] + (op1 * op2);
            break;
        case 9:  // msub
            result = tool.register_file[info.o] - (op1 * op2);
            break;
        case 10:  // sdiv
            result = BigInt.asIntN(info.sz, op1) / BigInt.asIntN(info.sz, op2);
            break;
        case 11:  // udiv
            result = op1 / op2;
            break;
        case 12:  // smulh
            result = (BigInt.asIntN(info.sz, op1) * BigInt.asIntN(info.sz, op2)) >> 64n;
            break;
        case 13:  // umulh
            result = (op1 * op2) >> 64n;
            break;
        case 14:  // smaddl
            result = tool.register_file[info.o] + (BigInt.asIntN(32,op1) * BigInt.asIntN(32,op2));
            break;
        case 15:  // smsubl
            result = tool.register_file[info.o] - (BigInt.asIntN(32,op1) * BigInt.asIntN(32,op2));
            break;
        case 16:  // umaddl
            result = tool.register_file[info.o] + (BigInt.asUintN(32,op1) * BigInt.asUintN(32,op2));
            break;
        case 17:  // umsubl
            result = tool.register_file[info.o] - (BigInt.asUintN(32,op1) * BigInt.asUintN(32,op2));
            break;
        default:
            result = 0n;
            break;
        }
        const xresult = result & info.vmask;

        // set condition flags if requested
        if (info.flags) {
            tool.nzcv = 0;
            if (BigInt.asIntN(info.sz, xresult) < 0) tool.nzcv |= 0x8;
            if (xresult === 0n) tool.nzcv |= 0x4;
            if (info.alu === 0) {  // add with carry
                // NB: result is unsigned sum
                if (xresult !== result) tool.nzcv |= 0x2;
                const signed_sum = BigInt.asIntN(info.sz,op1) + BigInt.asIntN(info.sz,op2) + cin;
                if (BigInt.asIntN(info.sz, signed_sum) !== signed_sum) tool.nzcv |= 0x1;
            }

            if (update_display) {
                const flags = document.getElementById('nzcv');
                flags.classList.add('cpu_tool-reg-write');
                flags.innerHTML = tool.nzcv.toString(2).padStart(4, '0');
            }
        }

        // update register file and pc
        tool.register_file[info.dest] = xresult;
        tool.pc = (tool.pc + 4n) & tool.mask64;

        if (update_display) {
            tool.reg_read(info.n);
            if (info.msel !== 0) tool.reg_read(info.m);
            if (info.o !== undefined) tool.reg_read(info.o);
            if (info.dest !== 33) tool.reg_write(info.dest, xresult);
        }
    }

    handle_movx(tool, info, update_display) {
        let result = 0n;
        if (info.x === 3) result = tool.register_file[info.dest] & info.mask;
        result |= info.imm;
        if (info.x === 0) result = (~result) & info.vmask;

        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;

        if (update_display) tool.reg_write(info.dest, result);
    }

    // B, BL
    handle_b(tool, info, update_display) {
        if (info.x === 1) { // BL
            tool.register_file[30] = (tool.pc + 4n) & tool.mask64;
            if (update_display) tool.reg_write(30, this.register_file[30]);
        }
        if (this.addr === tool.pc) throw('Halt Execution'); // detect branch-dot
        this.pc = this.addr;
    }

    // return true if flags meet specified condition
    check_cc(flags, cc) {
        let test;
        switch (cc) {
        case 0: return (flags & 0b0100) !== 0;  // Z
        case 1: return (flags & 0b0100) === 0;  // !Z
        case 2: return (flags & 0b0010) !== 0;  // C
        case 3: return (flags & 0b0010) === 0;  // !C
        case 4: return (flags & 0b1000) !== 0;  // N
        case 5: return (flags & 0b1000) === 0;  // !N
        case 6: return (flags & 0b0001) !== 0;  // V
        case 7: return (flags & 0b0001) === 0;  // !V
        case 8: return (flags & 0b0110) === 0b0010; // C & !Z
        case 9: return (flags & 0b0110) !== 0b0010; // !(C & !Z)
        case 10:  // N = V
            test = flags & 0b1001;
            return (test === 0b0000) || (test === 0b1001);
        case 11:  // N != V
            test = flags & 0b1001;
            return (test !== 0b0000) && (test !== 0b1001);
        case 12:  // !Z & N = V
            test = flags & 0b1001;
            return ((flags & 0xb0100) == 0) && ((test === 0b0000) || (test === 0b1001));
        case 13:  // Z | N != V
            test = flags & 0b1001;
            return ((flags & 0xb0100) == 0b100) || ((test !== 0b0000) && (test !== 0b1001));
        case 14: return true;
        case 15: return false;
        }
    }

    // CCMN, CCMP
    handle_cc(tool, info, update_display) {
        const n = tool.register_file[info.n] & info.vmask;
        let m = (info.y === 1) ? info.m : (tool.register_file[info.m] & info.vmask);
        if (info.x === 0) m = (-m) & info.vmask;

        if (check_cc(tool.nzcv, info.c)) {
            // set flags from n-m
            const result = n - m;    // unsigned result
            const xresult = result & info.vmask;
            tool.nzvc = 0;
            if (BigInt.asIntN(info.sz, xresult) < 0) tool.nzcv |= 0x8;
            if (xresult === 0n) tool.nzcv |= 0x4;
            if (xresult !== result) tool.nzcv |= 0x2;
            const signed_difference = BigInt.asIntN(info.sz,n) - BigInt.asIntN(info.sz,m);
            if (BigInt.asIntN(info.sz, signed_difference) !== signed_difference) tool.nzcv |= 0x1;
        } else tool.nzcv = result.i;

        if (update_display) {
            const flags = document.getElementById('nzcv');
            flags.classList.add('cpu_tool-reg-write');
            flags.innerHTML = tool.nzcv.toString(2).padStart(4, '0');
        }
    }

    // CSEL, CSINC, CSINV, CSNEG
    handle_conditional_select(tool, info, update_display) {
        let result;
        if (check_cc(tool.nzcv, info.c)) {
            result =  tool.register_file[info.n];
            if (update_display) tool.reg_read(info.n);
        } else {
            result = tool.register_file[info.m]; 
            switch (x) {
            case 0: break;
            case 1: result += 1n; break;
            case 2: result = ~result;
            case 3: result = ~result + 1;
            }
            if (update_display) tool.reg_read(info.m);
        }
        result &= info.vmask;
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) tool.reg_write(info.dest, result);
    }

    // B.cc
    handle_bcc(tool, info, update_display) {
        if (check_cc(tool.nzvc, info.c)) {
            if (info.addr === tool.pc) throw "Halt Execution";   // detect branch-dot
            tool.pc = info.addr;
        } else tool.pc = (tool.pc + 4n) & tool.mask64;
    }

    // BR, BLR, RET
    handle_br(tool, info, update_display) {
        if (info.x === 1) {  // BLR
            tool.register_file[30] = (tool.pc + 4n) & tool.mask64;
            if (update_display) tool.reg_write(30, this.register_file[30]);
        }
        if (update_display) this.reg_read(info.h);
        const next_pc = tool.register_file[info.n];
        if (next_pc === tool.pc) throw('Halt Execution'); // detect branch-dot
        this.pc = next_pc;
    }

    // CBZ, CBNZ
    handle_cbz(tool, info, update_display) {
        if (update_display) tool.reg_read(info.n);

        const Xn = tool.register_file[info.n];
        const next_pc = (Xn === 0n ? info.x===0 : info.x===1) ? info.addr : (tool.pc + 4n) & tool.mask64;

        // detect branch-dot
        if (next_pc === tool.pc) throw('Halt Execution');
        else tool.pc = next_pc;
    }

    // TBZ, TBNZ
    handle_tb(tool, info, update_display) {
        if (update_display) tool.reg_read(info.n);

        const bit = (this.register_file[info.n] & info.mask) === 0n;
        if (result.x ? bit : !bit) {
            const next_pc = info.addr;
            if (next_pc === tool.pc) throw('Halt Execution');
            tool.pc = next_pc;
        } else
            tool.pc = (tool.pc + 4n) & tool.mask64;
    }
    
    // LDR literal, LDRSW literal
    handle_ldr_literal(tool, info, update_display) {
        const PA = tool.va_to_phys(info.offset);
        let result = tool.memory.getBigUint64(PA, tool.little_endian);
        if (info.x === 1) result = BigInt.asIntN(32, result) & tool.mask64;
        else result &= info.vmask;
        tool.register_file[info.dest] = result;

        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.mem_read(PA, (info.x==1 || info.z===0) ? 32: 64);
            tool.reg_write(info.dest, result);
        }
    }

    // CLS, CLZ
    handle_cl(tool, info, update_display) {
        let result = 0;
        let source = tool.register_file[info.n] & info.vmask;
        const mask = (info.z === 1) ? 0x8000000000000000n : 0x80000000n;  // msb
        if (info.opcode === 'cls') {
            const sign = source & mask;
            // result will be between 0 and 31/63
            for (let i = 1; i < info.sz; i += 1) {
                source <<= 1n;
                if ((source & mask) !== sign) break;
                result += 1;
            }
        } else {  // clz
            // result will be between 0 and 32/64
            for (let i = 0; i < info.sz; i += 1) {
                if ((source & mask) !== 0n) break;
                source <<= 1n;
                result += 1;
            }
        }
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_read(info.n);
            tool.reg_write(info.dest, result);
        }
    }

    // RBIT
    handle_rbit(tool, info, update_display) {
        let result = 0n;
        let source = tool.register_file[info.n] & info.vmask;
        for (let i = 0; i < info.sz; i += 1) {
            result <<= 1n;
            if ((source & 1n) === 1n) result |= 1n;
            source >>= 1n;
        }
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_read(info.n);
            tool.reg_write(info.dest, result);
        }
    }

    // REV, REV16, REV32
    handle_rev(tool, info, update_display) {
        let result = 0n;
        let source = tool.register_file[info.n] & info.vmask;
        let rotate;
        // how much to left-shift low byte to position it in result
        if (info.opcode === 'rev')
            rotate = (info.sz === 32) ? [24n, 16n, 8n, 0n] : [56n, 48n, 40n, 32n, 24n, 16n, 8n, 0n];
        else if (info.opcode === 'rev16')
            rotate = (info.sz === 32) ? [8n, 0n, 24n, 16n] : [8n, 0n, 24n, 16n, 40n, 32n, 56n, 48n];
        else   // rev32
            rotate = [24n, 16n, 8n, 0n, 56n, 48n, 40n, 32n];
        for (let shift of rotate) {
            result |= (source & 0xFFn) << shift;
            source >>= 8n;
        }
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_read(info.n);
            tool.reg_write(info.dest, result);
        }
    }

    // EXTR
    handle_extr(tool, info, update_display) {
        // concatenate the source registers
        let result = ((tool.register_file[info.n] & info.vmask) << BigInt(info.sz)) |
            (tool.register_file[info.m] & info.vmask);
        result = (result >> info.i) & info.vmask;
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_read(info.n);
            tool.reg_read(info.m);
            tool.reg_write(info.dest, result);
        }
    }

    // BFM, SBFM, UBFM
    handle_bfm(tool, info, update_display) {
        // concatenate Xn with a copy of itself
        let result = ((tool.register_file[info.n] & info.vmask) << BigInt(info.sz)) |
            (tool.register_file[info.n] & info.vmask);
        // rotate bit field into correct position, mask other bits
        result = (result >> info.ror) & info.maskn;
        // combine with existing bits in destination
        result |= (tool.register_file[info.d] & info.maskd);
        // if SBFM, sign-extend result
        if (info.sxtsz) result = BigInt.asIntN(info.sxtsz, result) & info.vmask;

        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_read(info.n);
            tool.reg_read(info.m);
            tool.reg_write(info.dest, result);
        }
    }

    // ADR, ADRP
    handle_adr(tool, info, update_display) {
        tool.register_file[info.dest] = info.addr;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.reg_write(info.dest, info.addr);
        }
    }

    //////////////////////////////////////////////
    //  Disassembler
    //////////////////////////////////////////////


    // reconstruct mask from y, r, s fields of instruction
    decode_bitmask_immediate(result) {
        let size, nones;
        if (result.y === 0 && ((result.s & 0b111110) === 0b111100)) {
            // 2-bit mask
            size = 2;
            nones = (result.s & 0b000001) + 1;    // always 1!
        }
        else if (result.y === 0 && ((result.s & 0b111100) === 0b111000)) {
            // 4-bit mask
            size = 4;
            nones = (result.s & 0b000011) + 1;    // 1:3
        }
        else if (result.y === 0 && ((result.s & 0b111000) === 0b110000)) {
            // 8-bit mask
            size = 8;
            nones = (result.s & 0b000111) + 1;   // 1:7
        }
        else if (result.y === 0 && ((result.s & 0b110000) === 0b100000)) {
            // 16-bit mask
            size = 16;
            nones = (result.s & 0b001111) + 1;   // 1:15
        }
        else if (result.y === 0 && ((result.s & 0b100000) === 0b000000)) {
            // 32-bit mask
            size = 32;
            nones = (result.s & 0b011111) + 1;   // 1:31
        }
        else if (result.y === 1) {
            // 64-bit mask
            size = 64;
            nones = (result.s & 0b111111) + 1;   // 1:63
        }

        // build mask with required number of bits
        let pattern = (1n << BigInt(nones)) - 1n;
        // now ROR pattern by result.r bits
        pattern = BigInt.asUintN(size, ((pattern << BigInt(size)) | pattern) >> BigInt(result.r));
        // replicate to build 32-bit or 64-bit mask
        result.sz = (result.z == 1) ? 64 : 32;
        result.vmask = (result.sz == 32) ? this.mask32 : this.mask64;
        result.i = 0n;
        for (let rep = 0; rep < result.sz/size; rep += 1)
            result.i |= (pattern << BigInt(rep*size));
    }

    // return text representation of instruction at addr
    // saves fields of decoded instruction in this.inst_code[pa/4]
    disassemble(pa, va) {
        const inst = this.memory.getUint32(pa,this.little_endian);
        const result = this.inst_codec.decode(inst);
        if (result === undefined) return undefined;

        const info = result.info
        if (va === undefined) va = BigInt(this.pa2va(pa));
        result.va = va;
        result.opcode = info.opcode;
        result.handler = this.handle_not_implemented;

        if (this.inst_decode) this.inst_decode[pa/4] = result;   // save all our hard work!

        // redirect writes to WZR/XZR to a bit bucket
        result.dest = (result.d === 31) ? 33 : result.d;
        result.sz = (result.z === 0) ? 32 : 64;   // use 64 if result.z is undefined
        result.vmask = (result.sz == 32) ? this.mask32 : this.mask64;

        let r = (result.z === 0) ? 'w' : 'x';   // use X if result.z is undefined
        let Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
        let Xn = (result.n === 31) ? `${r}zr` : `${r}${result.n}`;
        let Xm = (result.m === 31) ? `${r}zr` : `${r}${result.m}`;

        if (info.type === 'R') {
            result.handler = this.handle_alu;
            result.msel = undefined;  // use rm
            result.flags = false;
            result.alu = 0;   // default to add with carry

            if (result.opcode === 'bool') {
                switch (result.x) {
                case 0: result.opcode = (result.N === 0) ? 'and' : 'bic'; break;
                case 1: result.opcode = (result.N === 0) ? 'orr' : 'orn'; break;
                case 2: result.opcode = (result.N === 0) ? 'eor' : 'eon'; break;
                case 3: result.opcode = (result.N === 0) ? 'ands' : 'bics'; break;
                };
                result.alu = {0: 1, 1: 2, 2: 3, 3: 0}[result.x];
                if (result.x === 3) result.flags = true;
            }
            else if (result.opcode === 'shift') {
                result.opcode = {0: 'lsl', 1: 'lsr', 2: 'asr', 3: 'ror'}[result.s];
                result.alu = result.s + 4;
            }
            else if (result.opcode === 'adcsbc') {
                result.opcode = {0: 'adc', 1: 'adcs', 2: 'sbc', 3: 'sbcs'}[result.x];
                result.N = (result.x >= 2);
                if (result.x & 1) result.flags = true;
                result.cin = 2;
            }
            else if (result.opcode === 'addsub' || result.opcode === 'addsubx') {
                result.opcode = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];
                if (result.x >= 2) {   // sub, subs
                    // negate second operand = complement and add 1
                    result.N = 1;
                    result.cin = 1;
                }
                if (result.x & 1) result.flags = true;

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
                    if ((result.e & 0x3) !== 0x3) Xm = `w${result.m}`;
                }
            }
            else {
                // check for other opcodes here and set result.alu appropriately
                result.alu = {'madd': 8, 'msub': 9,
                              'sdiv': 10, 'udiv': 11,
                              'smulh': 12, 'umulh': 13,
                             }[result.opcode];
                if (result.alu === undefined)
                    result.handler = this.handle_not_implemented;
            }

            let i = `${result.opcode} ${Xd},${Xn},${Xm}`;

            // fourth operand?
            if (result.o !== undefined) {
                let Xo = (result.o === 31) ? `${r}zr` : `${r}${result.o}`;
                i += `,${Xo}`;
            }

            // shifted register?
            if (result.a !== undefined && result.a !== 0) {
                i += `,${['lsl','lsr','asr','ror'][result.s]} #${result.a}`;
                result.a = BigInt(result.a);   // for 64-bit operations
                result.msel = result.s + 9;
            } else {
                result.a = undefined;   // no shift needed
            }

            // extended register?
            if (result.e !== undefined) {
                i += `,${['uxtb','uxth','uxtw','uxtx','sxtb','sxth','sxtw','sxtx'][result.e]} #${result.i}`;
                result.i = BigInt(result.i);   // for 64-bit operations
                result.msel = result.e + 1;
            }
            return i;
        }

        if (info.type === 'I') {
            // convert opcode back to what user typed in...
            result.opcode = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];

            result.handler = this.handle_alu;
            if (result.x >= 2) {   // sub, subs
                // negate second operand = complement and add 1
                result.N = 1; 
                result.cin = 1;
            } else {  // add, adds
                result.N = 0;
                result.cin = 0;
            }
            result.flags = (result.x & 1) == 1;
            result.alu = 0;
            result.msel = 0;
            result.i = BigInt(result.i) & this.mask64;   // for 64-bit operations

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

            let i = `${result.opcode} ${Xd},${Xn},#${result.i}`;
            // shifted immediate?
            if (result.s === 1) {
                i += `,lsl #12`;
                result.i <<= 12n;   // adjust the actual immediate operand too
            }
            return i;
        }

        if (info.type === 'D') {
            if (info.opcode === 'ldr.pc') r = result.z ? 'x' : 'w';
            else if (result.s >= 2) r = (result.s & 1) ? 'w' : 'x';
            else r = (result.z === 3) ? 'x' : 'w';
            result.vmask = (r == 'x') ? this.mask64 : this.mask32;
            Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
            // handle SP as base register
            if (result.n === 31) {
                result.n = 32;   // SP is register[32]
                Xn = 'sp';
            } else Xn = `x${result.n}`;
            result.offset = BigInt(result.I || result.i || 0);   // for 64-bit operations

            if (info.opcode === 'ldr.pc') {
                if (result.x === 1) {
                    result.opcode = 'ldrsw';
                    Xd = Xd.replace('w','x');   // ldrsw target is always Xn
                } else result.opcode = 'ldr';
                result.offset = ((result.offset << 2n) + va) & this.mask64;
                result.handler = this.handle_ldr_literal;
                return `${result.opcode} ${Xd},0x${result.offset.toString(16)}`;
            }

            result.opcode = (result.s === 0) ? 'st' : 'ld'; // ld or st?
            if (result.x === 0) result.opcode += 'u';     // unscaled offset?
            result.opcode += 'r';
            result.opcode += result.s >= 2 ? 's' : '';    // signed?
            result.opcode += {0: 'b', 1: 'h', 2: (result.s >= 2 ? 'w': ''), 3: ''}[result.z];  // size?

            if (info.opcode === 'ldst.off') {
                result.offset <<= BigInt(result.z);
                let i = `${result.opcode} ${Xd},[${Xn}`;
                if (result.i !== 0n) i += `,#${result.offset}`
                return i + ']';
            }

            if (info.opcode === 'ldst.reg') {
                const shift = {2: 'uxtw', 3: 'lsl', 6: 'sxtw', 7: 'sxtx'}[result.o];
                Xm = `${(result.o & 1) ? 'x' : 'w'}${result.m}`
                return `${result.opcode} ${Xd},[${Xn},${Xm},${shift} #${result.y ? result.z:0}]`;
            }

            if (info.opcode === 'ldst') {
                // dispatch on addressing mode
                switch (result.x) {
                case 0:
                    const offset = (result.offset !== 0n)  ? `,#${result.offset}` : '';
                    return `${result.opcode} ${Xd},[${Xn}${offset}]`;
                case 1:
                    // post-index
                    return `${result.opcode} ${Xd},[${Xn}],#${result.offset}`;
                case 2:
                    return '???';
                case 3:
                    // pre-index
                    return `${result.opcode} ${Xd},[${Xn},#${result.offset}]!`;
                }
            }
        }

        if (info.type === 'P') {
            r = (result.x === 0) ? 'w' : 'x';
            Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
            const Xdd = (result.e === 31) ? `${r}zr` : `${r}${result.e}`;
            result.opcode = (result.x === 1) ? 'ldpsw' : (result.o ? 'ldp' : 'stp');

            // handle SP as base register
            if (result.n === 31) {
                result.n = 32;   // SP is register[32]
                Xn = 'sp';
            } else Xn = `x${result.n}`;

            const scale = (result.x === 2) ? 3 : 2;
            result.offset = BigInt(result.I << scale);   // for 64-bit operations

            // dispatch on addressing mode
            switch (result.s) {
            case 1:
                // post-index
                return `${result.opcode} ${Xd},[${Xn}],#${result.offset}`;
            case 2:
                return `${result.opcode} ${Xd},[${Xn},#${result.offset}]`;
            case 3:
                // pre-index
                return `${result.opcode} ${Xd},[${Xn},#${result.offset}]!`;
            }
        }

        if (info.type === 'B') {
            result.addr = (BigInt(result.I << 2) + va) & this.mask64;
            result.opcode = {0: 'b', 1: 'bl'}[result.x];
            result.handler = this.handle_b;
            return `${result.opcode} 0x${result.addr.toString(16)}`;
        }

        if (info.type === 'CB') {
            result.addr = (BigInt(result.I << 2) + va) & this.mask64;
            result.opcode = {0: 'cbz', 1: 'cbnz'}[result.x];
            result.handler = this.handle_cbz;
            return `${result.opcode} ${Xn},0x${result.addr.toString(16)}`;
        }

        if (info.type === 'TB') {
            result.addr = (BigInt(result.I << 2) + va) & this.mask64;
            if (result.z) result.b += 32;
            result.mask = (1n << BigInt(result.b));
            result.opcode = {0: 'tbz', 1: 'tbnz'}[result.x];
            result.handler = this.handle_tb;
            return `${result.opcode} ${Xn},#${result.b},0x${result.addr.toString(16)}`;
        }

        if (info.type === 'BL') {
            result.opcode = {0: 'bl', 1: 'blr', 2:'ret'}[result.x];
            result.handler = this.handle_br;
            return `${result.opcode} ${Xn}`;
        }

        if (info.type === 'BCC') {
            result.opcode = {0: 'b.eq', 1: 'b.ne',
                             2: 'b.cs', 3:'b.cc',
                             4: 'b.mi', 5: 'b.pl',
                             6: 'b.vs', 7: 'b.vc',
                             8: 'b.hi', 9: 'b.ls',
                             10: 'b.ge', 11: 'b.lt',
                             12: 'b.gt', 13: 'b.le',
                             14: 'b.al', 15: 'b.nv'}[result.c];
            result.addr = (BigInt(result.I << 2) + va) & this.mask64;
            result.handler = this.handle_bcc;
            return `${result.opcode} 0x${result.addr.toString(16)}`;
        }

        if (info.type === 'CS') {
            result.x = 2*result.x + result.y;
            result.opcode = {0: 'csel', 1: 'csinc', 2: 'csinv', 3: 'csneg'}[result.x];
            const cond = {0: 'eq', 1: 'ne',
                          2: 'cs', 3:'cc',
                          4: 'mi', 5: 'pl',
                          6: 'vs', 7: 'vc',
                          8: 'hi', 9: 'ls',
                          10: 'ge', 11: 'lt',
                          12: 'gt', 13: 'le',
                          14: 'al', 15: 'nv'}[result.c];
            return `${result.opcode} ${Xd},${Xn},${Xm},${cond}`;
        }

        if (info.type === 'CC') {
            result.opcode = {0: 'ccmn', 1: 'ccmp'}[result.x];
            const cond = {0: 'eq', 1: 'ne',
                          2: 'cs', 3:'cc',
                          4: 'mi', 5: 'pl',
                          6: 'vs', 7: 'vc',
                          8: 'hi', 9: 'ls',
                          10: 'ge', 11: 'lt',
                          12: 'gt', 13: 'le',
                          14: 'al', 15: 'nv'}[result.c];
            result.handler = this.handle_cc;
            if (result.y === 1) {
                result.m = BigInt(result.m);   // for 64-bit operations
                return `${result.opcode} ${Xn},#${result.m},#${result.i},${cond}`;
            } else
                return `${result.opcode} ${Xn},${Xm},#${result.i},${cond}`;
        }

        if (info.type === 'BF') {
            result.opcode = {0: 'sbfm', 1: 'bfm', 2: 'ubfm'}[result.x];
            if (result.s >= result.r) {
                // copy s-r+1 bits starting at bit r down to lsb
                result.ror = BigInt(result.r);  // rotate to bring bits to lsb
                // mask for rotated bit field from rn
                result.maskn = (2n << BigInt(result.s - result.r)) - 1n;  // mask for s-r+1 bits
                // mask for unaffected Xd bits
                result.maskd = (result.x === 1) ? (~result.maskn) & result.vmask : 0n;
                // MSB for sign-extension of result, undefined if no sxt
                result.sxtsz = (result.x === 0) ? result.s - result.r + 1 : undefined;
            } else {
                // copy s+1 lsb bits to bit sz-r
                result.ror = BigInt(result.r);
                // mask for rotated bit field from rn
                result.maskn = ((2n << BigInt(result.s)) - 1n) << BigInt(result.sz - result.r);
                // mask for unaffected Xd bits
                result.maskd = (result.x === 1) ? (~result.maskn) & result.vmask : 0n;
                // MSB for sign-extension of result, undefined if no sxt
                result.sxtsz = (result.x === 0) ? (result.sz - result.r) + result.s + 1 : undefined;
            }
            result.handler = this.handle_bfm;
            return `${result.opcode} ${Xd},${Xn},#${result.r},#${result.s}`;
        }

        if (info.type === 'BITS') {
            if (result.z === 1 && result.y === 0) result.opcode = 'rev32';
            result.handler = {
                'cls': this.handle_cl,
                'clz': this.handle_cl,
                'rbit': this.handle_rbit,
                'rev': this.handle_rev,
                'rev16': this.handle_rev,
                'rev32': this.handle_rev,
            }[result.opcode];
            return `${result.opcode} ${Xd},${Xn}`;
        }

        if (info.type === 'EXTR') {
            result.i = BigInt(result.i);
            result.handler = this.handle_extr;
            return `extr ${Xd},${Xn},${Xm},#${result.i}`;
        }
        
        if (info.type === 'IM') {
            // convert opcode back to what user typed in...
            result.opcode = {0: 'and', 1: 'orr', 2: 'eor', 3: 'ands'}[result.x];
            result.msel = 0;
            result.alu = {0: 1, 1: 2, 2: 3, 3: 1}[result.x];
            result.flags = (result.x == 3);
            result.handler = this.handle_alu;

            // these opcodes allow SP as destination...
            if (['and', 'eor', 'orr'].includes(result.opcode)) {
                if (result.d === 31) {
                    Xd = (result.z === 0) ? 'wsp' : 'sp';
                    result.dest = 32;    // SP is register file[32]
                }
            }

            // reconstruct mask from y, r, s fields of instruction
            this.decode_bitmask_immediate(result);

            return `${result.opcode} ${Xd},${Xn},#0x${this.hexify(result.i,result.z == 1 ? 16 : 8)}`;
        }

        if (info.type === 'A') {
            let imm = BigInt((result.I << 2) + (result.i));
            let base = va;
            if (info.opcode === 'adrp') {imm <<= 12n; base &= ~0xFFFn; }
            result.addr = (imm + base) & this.mask64;
            result.handler = this.handle_adr;
            return `${result.opcode} ${Xd},#0x${result.addr.toString(16)}`;
        }

        if (info.type === 'M') {
            result.opcode = {0: 'movn', 2: 'movz', 3: 'movk'}[result.x];
            const a = BigInt(result.s * 16);
            const shift = (result.s > 0) ? `,LSL #${a}` : '';
            result.imm = BigInt(result.i) << a;
            result.mask = (~(BigInt(0xFFFF) << a)) & result.vmask;
            result.handler = this.handle_movx;
            return `${result.opcode} ${Xd},#0x${result.i.toString(16)}${shift}`;
        }

        if (info.type === 'MA') {
            result.opcode = `${result.u ? 'u' : 's'}m${result.x ? 'sub' : 'add'}l`;
            result.sz = 64;
            result.vmask = this.mask64;
            result.alu = {'smaddl': 14, 'smsubl': 15,
                          'umaddl': 16, 'umsubl': 17}[result.opcode];
            result.handler = this.handle_alu;

            Xd = (result.d === 31) ? 'xzr' : `x${result.d}`;
            Xn = (result.n === 31) ? 'wzr' : `w${result.n}`;
            Xm = (result.m === 31) ? 'wzr' : `w${result.m}`;
            const Xo = (result.o === 31) ? 'xzr' : `x${result.o}`;
            return `${result.opcode} ${Xd},${Xn},${Xm},${Xo}`;
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
        while ((next = stream.next()) !== null) {
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
        while ((ch = stream.next()) !== null) {
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
        'x8', 'x9', 'x10', 'x11', 'x12', 'x13', 'x14', 'x15',
        'x16','x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
        'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'xzr',
        'sp', 'fp', 'lr',
        'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7',
        'w8', 'w9', 'w10', 'w11', 'w12', 'w13', 'w14', 'w15',
        'w16','w17', 'w18', 'w19', 'w20', 'w21', 'w22', 'w23',
        'w24', 'w25', 'w26', 'w27', 'w28', 'w29', 'w30', 'wzr',
        'wsp'
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
