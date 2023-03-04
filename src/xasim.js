/*
Copyright 2022-2023 Christopher J. Terman

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

// Arm A64 Quick Reference
// https://courses.cs.washington.edu/courses/cse469/19wi/arm64.pdf

// Class hierarchy:
//  SimTool            basic UI with editor pane and simulation results pane
//   CPUTool           assembler framework, rudimentary state display for emulation
//   ArmA64Assembler   A64 assembler/disassembler, emulation framework
//    ASim             simple single-cycle A64 emulation (not pipelined)

/* global SimTool, CodeMirror, BigInt */
"use strict";

//////////////////////////////////////////////////
// Arm A64 assembly
//////////////////////////////////////////////////

SimTool.ArmA64Assembler = class extends SimTool.CPUTool {
    constructor(tool_div, version) {
        // super() will call this.emulation_initialize()
        super(tool_div, version, 'ARMV8A', 'https://github.com/computation-structures/asim');
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
        this.educore = this.version.indexOf('Educore') !== -1;

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
        this.sp_register_number = 31;

        // ISA-specific tables and storage
        this.exception_level = 1;
        this.pc = 0n;
        this.nzcv = 0;   // condition codes
        this.register_file = new Array(32 + 2);    // include extra regs for reads and writes to XZR
        this.memory = new SimTool.Memory(this.little_endian);
        this.source_map = [];
        this.inst_decode = []; // holds decoded inst objs

        this.register_info();
        this.opcode_info();
        this.handler_info();

        // reset to initial state
        this.emulation_reset();
    }

    //////////////////////////////////////////////////
    // Emulation framework
    //////////////////////////////////////////////////

    // default emulation handler
    handle_not_implemented(tool, info, update_display) {
        tool.message.innerHTML = `Unimplemented opcode ${info.opcode.toUpperCase()} at physical address 0x${tool.hexify(tool.va_to_phys(tool.pc))}`;

        throw 'Halt Execution';
    }

    // set up emulation handlers for each instruction group
    handler_info() {
        // to be overridden
        this.handlers = {
            adr: this.handle_not_implemented,  // ADR, ADRP
            alu: this.handle_not_implemented,  // arith, bool operations
            b: this.handle_not_implemented,  // B, BL
            bcc: this.handle_not_implemented,  // B.cc
            bfm: this.handle_not_implemented,  // BFM, SBFM, UBFM
            br: this.handle_not_implemented,  // BR, BLR, RET
            cbz: this.handle_not_implemented,  // CBZ, CBNZ
            cc: this.handle_not_implemented,  // CCMN, CCMP
            cl: this.handle_not_implemented,  // CLS, CLZ
            cs: this.handle_not_implemented,  // CSEL, CSINC, CSINV, CSNEG
            extr: this.handle_not_implemented,  // EXTR
            hlt: this.handle_not_implemented,  // BRK, HLT
            ldr_literal: this.handle_not_implemented,  // LDR literal, LDRSW literal
            ldst: this.handle_not_implemented,  // LDR*, STR*
            ldstp: this.handle_not_implemented,  // LDP, LDPSW, STP
            movx: this.handle_not_implemented,  // MOVK, MOVN, MOVZ
            nop: this.handle_not_implemented,  // NOP
            not_implemented: this.handle_not_implemented,
            rbit: this.handle_not_implemented,  // RBIT
            rev: this.handle_not_implemented,  // REV, REV16, REV32
            sysreg: this.handle_not_implemented,  // MRS, MSR
            tb: this.handle_not_implemented,  // TBZ, TBNZ
        };
    }

    // reset emulation state to initial values
    emulation_reset() {
        super.emulation_reset();

        this.pc = 0n;
        this.nzcv = 0;   // condition codes
        this.register_file.fill(0n);

        if (this.assembler_memory !== undefined) {
            this.memory.load_bytes(this.assembler_memory);
            if (this.inst_decode === undefined ||
                this.inst_decode.length != this.assembler_memory.byteLength/4)
                this.inst_decode = Array(this.assembler_memory.byteLength/4);  
        }

        this.memory.reset(this.caches);   // reset cache models
    }

    // execute a single instruction
    emulation_step(update_display) {
        this.ncycles += 1;
        if (update_display) this.clear_highlights();

        // have we already decoded the instruction?
        const EA = this.va_to_phys(this.pc);
        this.memory.fetch32_aligned(EA);  // register instruction fetch
        const EAindex = EA / 4;
        let info = this.inst_decode[EAindex];

        // if not, do it now...
        if (info === undefined) {
            this.disassemble(EA, this.pc);   // fills in inst_decode
            info = this.inst_decode[EA/4];
            if (info === undefined) {
                this.message.innerHTML = `Cannot decode instruction at physical address 0x${this.hexify(this.va_to_phys(this.pc))}`;
                throw 'Halt Execution';
            }
        }

        // handler function will emulate instruction
        // if gui is passed, handler will call the appropriate gui update functions
        info.handler(this, info, update_display);

        // update PC and disassembly displays
        if (update_display) this.next_pc(this.pc);

        // breakpoint set for next instruction?
        const loc = this.source_map[this.va_to_phys(this.pc)/4];
        if (loc && loc.breakpoint) throw "Halt Execution";
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
        this.registers.set('sp', 31);

        this.register_names = [];
        for (let rname of this.registers.keys()) {
            const reg = this.registers.get(rname);
            this.register_names[reg] = rname;
        }

        // for use by assy programs
        this.registers.set('xzr', 31);
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
        //row.push(`<span id="EL" class="cpu_tool-addr" style="margin-right: 4px;">EL${this.exception_level}:</span>`);
        row.push('<span class="cpu_tool-addr" style="margin-right: 4px;">pc</span>');
        row.push(`<span id="pc">${this.hexify(this.pc,this.register_nbits/4)}</span>`);
        row.push('<span class="cpu_tool-addr" style="margin-left: 4px; margin-right: 4px;">NZCV</span>');
        row.push(`<span id="nzcv">${this.nzcv.toString(2).padStart(4, '0')}</span>`);
        row.push('</td></tr>');
        table.push(row.join(''));
    }

    next_pc() {
        document.getElementById('pc').innerHTML = this.hexify(this.pc,16);
        super.next_pc();
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
            {opcode: 'addsub', pattern: "zxx01011ss0mmmmmjjjjjjnnnnnddddd", type: "R"},

            // x: 0=add, 1=adds, 2=sub, 3=subs
            // o: 0=UXTB, 1=UXTH, 2=UXTW/LSL, 3=UXTX/LSL, 4=SXTB, 5=SXTH, 6=SXTW, 7=SXTX
            // add, sub, adds, subs (extended register)
            // note: n: SP allowed for add, adds, sub, subs
            // note: d: SP allowed for add, sub
            {opcode: 'addsubx',pattern: "zxx01011001mmmmmooojjjnnnnnddddd", type: "R"},

            // s: 0=LSL #0, 1=LSL #12
            // x: 0=add, 1=adds, 2=sub, 3=subs (immediate)
            // n: SP allowed for add, adds, sub, subs
            // d: SP allowed for add, sub
            {opcode: 'addsubi',pattern: "zxx100010siiiiiiiiiiiinnnnnddddd", type: "I"},

            {opcode: 'adr',    pattern: "0ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},
            {opcode: 'adrp',   pattern: "1ii10000IIIIIIIIIIIIIIIIIIIddddd", type: "A"},

            {opcode: 'madd',   pattern: "z0011011000mmmmm0aaaaannnnnddddd", type: "R"},
            {opcode: 'msub',   pattern: "z0011011000mmmmm1aaaaannnnnddddd", type: "R"},
            {opcode: 'sdiv',   pattern: "z0011010110mmmmm000011nnnnnddddd", type: "R"},
            {opcode: 'smulh',  pattern: "z0011011010mmmmm011111nnnnnddddd", type: "R"},
            {opcode: 'udiv',   pattern: "z0011010110mmmmm000010nnnnnddddd", type: "R"},
            {opcode: 'umulh',  pattern: "z0011011110mmmmm011111nnnnnddddd", type: "R"},

            // u,x: 00=smaddl, 01=smsubl, 10=umaddl, 1=umsubl
            {opcode: 'muladd', pattern: "10011011u01mmmmmxaaaaannnnnddddd", type: "MA"},

            // bit manipulation
            // x: 0=sbfm, 1=bfm, 2=ubfm
            {opcode: 'bf',     pattern: "zxx100110yrrrrrrssssssnnnnnddddd", type: "BF"},

            {opcode: 'cls',    pattern: "z101101011000000000101nnnnnddddd", type: "BITS"},
            {opcode: 'clz',    pattern: "z101101011000000000100nnnnnddddd", type: "BITS"},
            {opcode: 'rbit',   pattern: "z101101011000000000000nnnnnddddd", type: "BITS"},
            {opcode: 'rev',    pattern: "z10110101100000000001ynnnnnddddd", type: "BITS"},
            {opcode: 'rev16',  pattern: "z101101011000000000001nnnnnddddd", type: "BITS"},
            {opcode: 'rev32',  pattern: "1101101011000000000010nnnnnddddd", type: "BITS"},
            {opcode: 'extr',   pattern: "z00100111y0mmmmmjjjjjjnnnnnddddd", type: "EXTR"},

            // logical and move

            // s: 0=LSL, 1=LSR, 2=ASR, 3=ROR
            // xxN: 000=and, 001=bic, 010=orr, 011=orn, 100=eor, 101=eon, 110=ands, 111=bics
            {opcode: 'bool',   pattern: "zxx01010ssNmmmmmjjjjjjnnnnnddddd", type: "R"},

            // x: 0=andm, 1=orrm, 2=eorm, 3:andms
            // y: 1=complement mask
            // d: SP allowed for and, eor, orr
            {opcode: 'boolm',  pattern: "zxx100100yrrrrrrssssssnnnnnddddd", type: "IM"},

            // s: 0=LSL, 1=LSR, 2=ASR, 3=ROR
            {opcode: 'shift',  pattern: "z0011010110mmmmm0010ssnnnnnddddd", type: "R"},

            // x: 0=movn, 2=movz, 3=movk
            {opcode: 'movx',   pattern: "zxx100101ssiiiiiiiiiiiiiiiiddddd", type: "M"},

            // branch

            // x: 0=b, 1=bl
            {opcode: 'brel',   pattern: "x00101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},

            // x: 0=br, 1=blr, 2=ret
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
            {opcode: 'ccxx',   pattern: "zx111010010mmmmmccccy0nnnnn0jjjj", type: "CC"},

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

            // x: 0=32-bit ld/st, 1=ldpsw, 2=64-bit ld/st
            // o: 1=ld, 0=st
            // s: 1=post index, 2=signed index, 3=pre index
            {opcode: 'ldstp',  pattern: "xx10100ssoIIIIIIIeeeeennnnnddddd", type: "P"},

            // system
            {opcode: 'hlt',    pattern: "11010100010jjjjjjjjjjjjjjjj00000", type: "H"},
            {opcode: 'brk',    pattern: "11010100001jjjjjjjjjjjjjjjj00000", type: "H"},
            {opcode: 'svc',    pattern: "11010100000jjjjjjjjjjjjjjjj00001", type: "H"},
            {opcode: 'eret',   pattern: "11010110100111110000001111100000", type: "ERET"},
            {opcode: 'nop',    pattern: "11010101000000110010000000011111", type: "NOP"},
            // x: 0 = MSR, 1 = MRS
            // i: 0x5A10=NZCV, 1=console, 2=mouse, 3=cycles
            {opcode: 'sysreg', pattern: "1101010100x1jjjjjjjjjjjjjjjddddd", type: "SYS"},

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
                        end: operand[operand.length - 1].end
                    };
                    result.push(prev);
                    continue;
                }

                // immediate operand or condition name
                if (tstring === '#') j += 1;
                else if (operand.length === 1) {
                    const cond = {eq: 0, ne:1, cs:2, hs:2, cc:3, lo: 3, mi:4, pl:5, vs:6, vc:7,
                                  hi: 8, ls:9, ge:10, lt:11, gt:12, le:13, al:14, nv:15}[tstring];
                    if (cond !== undefined) {
                        prev = {
                            type: 'condition',
                            condition: tstring,
                            cc: cond,
                            start: operand[0].start,
                            end: operand[0].end,
                        };
                        result.push(prev);
                        continue;
                    }
                    const sysreg = {
                        nzcv: 0x5A10,
                        console: 1,
                        mouse: 2,
                        cycles: 3
                    }[tstring];
                    if (sysreg !== undefined) {
                        prev = {
                            type: 'sysreg',
                            imm: sysreg,
                            sysreg: tstring,
                            start: operand[0].start,
                            end: operand[0].end,
                        };
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
        };

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
        function check_register_or_sp(operand, size) {
            if (operand.type !== 'sp') {
                check_operand(operand,'register');
                if (operand.reg === 31) 
                    tool.syntax_error('XZR/WZR not allowed',operand.start,operand.end);
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
            let noperands = {cmn: 2, cmp: 2, neg: 2,
                             negs: 2, mvn: 2, tst: 2}[opc] || 3;
            let xopc = {cmn: 'adds', cmp: 'subs', mvn: 'orn',
                        neg: 'sub', negs: 'subs', tst: 'ands'}[opc] || opc;
            
            if (noperands !== operands.length)
                tool.syntax_error(`${opc.toUpperCase()} expects ${noperands} operands`,
                                  opcode.start, opcode.end);

            // handle aliases
            if (['cmn','cmp','tst'].includes(opc)) {
                const zr = {type: 'register', reg: 31, start: opcode.start, end:opcode.end, z: operands[0].z};
                operands.unshift(zr);   // add zr as Xd
            }
            else if (['mvn','neg','negs'].includes(opc)) {
                const zr = {type: 'register', reg: 31, start: opcode.start, end:opcode.end, z: operands[0].z};
                operands.splice(1, 0, zr);  // add zr as Xn
            }

            // if third operand is a register, convert to shifted-reg or extended-reg as appropriate
            const m = operands[2];
            if (m.type === 'register') {
                // check for sp as Xd or Xn
                if (operands[0].type === 'sp' || operands[1].type === 'sp') {
                    // must be extended-reg
                    m.type = 'extended-register';
                    m.shiftext = 'lsl';
                    m.shamt = 0;
                }
                else {
                    // default to shifted-reg (*zr allowed...)
                    m.type = 'shifted-register';
                    m.shiftext = 'lsl';
                    m.shamt = 0;
                }
            }

            const fields = {};

            // validate SP as Xd
            // only allowed for add/sub (imm or xreg), and/eor/orr (imm)
            const rd_sp_ok = (['add','sub'].includes(xopc) && m.type !== 'shifted-register') ||
                  (['and','eor','orr'].includes(xopc) && m.type === 'immediate');
            fields.d = rd_sp_ok ? check_register_or_sp(operands[0], undefined) : check_register(operands[0]);
            fields.z = operands[0].z;

            // validate SP as Xn
            // only allowed for add/adds/sub/subs (imm or xreg)
            const rn_sp_ok = ['add','sub','adds','subs'].includes(xopc) && m.type !== 'shifted-register';
            fields.n = rn_sp_ok ? check_register_or_sp(operands[1], fields.z) : check_register(operands[1], fields.z);

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
                    fields.x = {and: 0, orr: 1, eor: 2, ands: 3}[xopc];
                    if (fields.x === undefined) 
                        tool.syntax_error(`Immediate operand not permitted for ${opc.toUpperCase()}`,
                                          m.start, m.end);
                    xopc = 'boolm';
                    if (!encode_bitmask_immediate(m.imm,fields))
                        tool.syntax_error(`Cannot encode immediate as a bitmask`,m.start,m.end);
                }
            }
            else if (['register','shifted-register','extended-register'].includes(m.type)) {
                // last operand is register
                fields.m = m.reg;

                // if last operand is (still) just a register, recode as shifted-register
                if (m.type === 'register') {
                    m.type = 'shifted-register';
                    m.shiftext = 'lsl';
                    m.shamt = 0;
                }

                if (context === 'arithmetic') {
                    fields.x = {add: 0, adds: 1, sub: 2, subs: 3}[xopc];
                    if (m.type === 'shifted-register') {
                        xopc = 'addsub';
                        fields.s = {lsl: 0, lsr: 1, asr: 2}[m.shiftext];
                        if (fields.s === undefined)
                            tool.syntax_error(`${m.shiftext} not allowed for ${opc.toUpperCase()}`,m.start,m.end);
                        if (m.shamt < 0 || m.shamt > (fields.z ? 63: 31))
                            tool.syntax_error(`shift amount not in range 0:${fields.z ? 63 : 31}`,m.start,m.end);
                        fields.j = m.shamt;
                    }
                    else if (m.type === 'extended-register') {
                        xopc = 'addsubx';
                        fields.o = {'uxtb': 0, 'uxth': 1, 'uxtw': 2, 'uxtx': 3,
                                    'sxtb': 4, 'sxth': 5, 'sxtw': 6, 'sxtx': 7}[m.shiftext];
                        if (fields.o === undefined) {
                            if (m.shiftext === 'lsl') fields.o = fields.z ? 3 : 2;
                            else tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                        }
                        if (m.shamt === undefined) m.shamt = 0;
                        if (m.shamt < 0 || m.shamt > 4)
                            tool.syntax_error('shift amount not in range 0:4',m.start,m.end);
                        fields.j = m.shamt;
                    }
                } else {
                    // logical
                    const encoding = {'and': 0, 'bic': 1, 'orr': 2, 'orn': 3,
                                      'eor': 4, 'eon': 5, 'ands': 6, 'bics': 7}[xopc];
                    fields.N = encoding & 0x1;
                    fields.x = encoding >> 1;
                    fields.j = 0;
                    fields.s = 0;
                    if (m.type === 'shifted-register') {
                        fields.s = {lsl: 0, lsr: 1, asr: 2, ror: 3}[m.shiftext];
                        if (fields.s === undefined)
                            tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                        if (m.shamt < 0 || m.shamt > (fields.z ? 63: 31))
                            tool.syntax_error(`shift amount not in range 0:${fields.z ? 63 : 31}`,m.start,m.end);
                        fields.j = m.shamt;
                    }
                    else if (m.type === 'extended-register') 
                        tool.syntax_error(`${m.shiftext} not allowed`,m.start,m.end);
                    xopc = 'bool';
                }
            }
            else tool.syntax_error(`Illegal operand`,m.start,m.end);

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
                    fields.j = shift;
                    break;
                }
            } else if (!tool.educore)  {
                // register as third operand
                fields.n = check_register(operands[1], fields.z);
                fields.m = check_register(operands[2], fields.z);
                opc = 'shift';
            } else {
                tool.syntax_error('Illegal operand', operands[2].start, operands[2].end);
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

            if (fields.z === 0)
                if (![0, 16].includes(fields.s))
                    tool.syntax_error(`Shift must be LSL of 0, 16`,
                                      operands[1].start, operands[1].end);
            else
                if (![0, 16, 32, 48].includes(fields.s))
                    tool.syntax_error(`Shift must be LSL of 0, 16, 32, or 48`,
                                     operands[1].start, operands[1].end);
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
            };

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
            if (noperands > 3) fields.a = check_register(operands[3], fields.z);
            
            if (opc === 'mul' || opc === 'mneg') {
                opc = (opc === 'mul') ? 'madd' : 'msub';
                fields.a = 31;
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
            fields.j = check_immediate(operands[3], 0, fields.z ? 63 : 31);

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
                a: (noperands === 4) ? check_register(operands[3], 1) : 31,
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
            };
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
            const fields = {};

            // MOV reg to/from SP
            if ((operands[0].type === 'sp' && (operands[1].type === 'register' || operands[1].type === 'sp')) ||
                (operands[1].type === 'sp' && (operands[0].type === 'register' || operands[0].type === 'sp'))) {
                // use ADD Xd, Xn, #0
                fields.d = check_register_or_sp(operands[0], undefined);
                fields.z = operands[0].z;
                fields.n = check_register_or_sp(operands[1], fields.z);
                fields.x = 0;
                fields.i = 0;
                fields.s = 0;
                xopc = 'addsubi';
            }
            // MOV reg to reg
            else if (operands[0].type === 'register' && operands[1].type === 'register') {
                // use ORR Rd, XZR, Rm
                fields.d = check_register(operands[0]);
                fields.z = operands[0].z;
                fields.n = 31;
                fields.m = check_register(operands[1], fields.z);
                fields.x = 1;
                fields.N = 0;
                fields.s = 0;
                fields.j = 0;
                xopc = 'bool';
            }
            // MOV reg|sp, #imm
            else {
                if (operands[1].type !== 'immediate')
                    tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);

                const imm = operands[1].imm & tool.mask64;

                // if destination is not SP, consider wide immediates
                if (operands[0].type !== 'sp') {
                    fields.d = check_register(operands[0]);
                    fields.z = operands[0].z;
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

                // still not found an option?  try:
                // bitmask immediate => ORR Rd|SP, XZR, #imm
                if (xopc === undefined) {
                    fields.d = check_register_or_sp(operands[0]);
                    fields.z = operands[0].z;
                    if (encode_bitmask_immediate(imm, fields)) {
                        xopc = 'boolm';
                        fields.n = 31; // xzr
                        fields.x = 1;  // ORR
                    } else
                        tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
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
            const [_,op,unscaled,signed,size] = opc.match(/(ld|st)(u?)r(s?)([bhw]?)/);  // eslint-disable-line no-unused-vars
            fields.z = {'b': 0, 'h': 1, 'w': 2}[size];
            if (fields.z === undefined) fields.z = (2 + operands[0].z);
            fields.s = (op === 'st') ? 0 : (signed ? (operands[0].z ? 2 : 3) : 1);
            
            // enforce register size restrictions
            if (['ldrsw','ldursw'].includes(opc) && operands[0].z !== 1)
                tool.syntax_error(`${opc.toUpperCase()} requires Xn as a target`,
                                  operands[0].start, operands[0].end);
            if (!signed && (fields.z === 0 || fields.z === 1) && operands[0].z !== 0)
                tool.syntax_error(`${opc.toUpperCase()} requires Wn as a target`,
                                  operands[0].start, operands[0].end);

            let addr = operands[1].addr;    // expecting base, offset
            if (addr === undefined)
                tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
            fields.n = check_register_or_sp(addr[0], 1);   // base register (sp allowed)
            const scale = fields.z;

            // is offset a register?
            if (addr.length === 2 && ['register','shifted-register','extended-register'].includes(addr[1].type)) {
                if (!operands[1].pre_index && operands[1].post_index === undefined) {
                    fields.m = addr[1].reg;
                    fields.x = 2;
                    if (addr[1].shiftext === undefined) { fields.o = 3; fields.y = 0;}
                    else {
                        fields.o = {'lsl': 3, 'uxtw': 2, 'sxtw': 6, 'sxtx': 7}[addr[1].shiftext];
                        // validate shift/extend option
                        if (fields.o === undefined)
                            tool.syntax_error('Invalid operand',operands[1].start,operands[1].end);
                        // LSL => shift amount must be 0 or scale
                        if (fields.o===3 && !(addr[1].shamt === 0 || addr[1].shamt === scale))
                            tool.syntax_error(`Index shift amount must be 0 or ${scale}`,
                                              operands[1].start,operands[1].end);
                        // LSL, SXTX => offset register must be Xm
                        // UXTX, SXTW => offset register must be Wm
                        if ((fields.o & 1) !== addr[1].z)
                            tool.syntax_error('Offset register size and extend operation must match',operands[1].start,operands[1].end);
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
                    if (!operands[1].pre_index && operands[1].post_index === undefined) {
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
                else if (operands[1].post_index !== undefined) {
                    fields.I = operands[1].post_index;
                    if (fields.I < -256 || fields.I >= 256)
                        tool.syntax_error(`Immediate value ${fields.I} out of range -256:255`,
                                          operands[1].start, operands[1].end);

                    fields.x = 1;   // post_index
                    tool.inst_codec.encode('ldst', fields, true);
                    return;
                }
                else {
                    if (tool.educore)
                        tool.syntax_error('scaled offsets not supported on Educore',operands[1].start,operands[1].end);
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
                tool.syntax_error('Invalid operand',operands[2].start,operands[2].end);
            fields.n = check_register_or_sp(addr[0], 1);   // base register

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
                j: check_immediate(operands[2], 0, 15),
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
                imm2 = check_immediate(operands[2], 1, fields.z ? 64 : 32);
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
                imm2 = check_immediate(operands[3], 0, fields.z ? 64 : 32);
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

        function assemble_hlt(opc, opcode, operands) {
            if (operands.length > 1)
                tool.syntax_error(`${opc.toUpperCase()} instruction expects at most 1 operand`,
                                  opcode.start,opcode.end);
            const fields = {
                j: operands.length > 0 ? check_immediate(operands[0], 0, 65535) : 0,
            };
            tool.inst_codec.encode(opc, fields, true);
        }

        function assemble_nop(opc, opcode, operands) {
            if (operands.length !== 0)
                tool.syntax_error('NOP instruction expects no operands',
                                  opcode.start,opcode.end);
            tool.inst_codec.encode('nop', {}, true);
        }

        function assemble_sysreg(opc, opcode, operands) {
            if (operands.length !== 2)
                tool.syntax_error('${opc.toUpperCase()} instruction expects 2 operands',
                                  opcode.start,opcode.end);

            function check_sysreg(operand) {
                if (operand.type !== 'sysreg')
                    tool.syntax_error('Expected name of system register',
                                      operand.start,operand.end);
                return operand.imm;
            }

            const fields = {};
            if (opc === 'mrs') {  // mrs (read System Register)
                fields.x = 1;
                fields.d = check_register(operands[0], 1);
                fields.j = check_sysreg(operands[1]);
            } else if (opc === 'msr') {  // msr  (write System Register)
                fields.x = 0;
                fields.d = check_register(operands[1], 1);
                fields.j = check_sysreg(operands[0]);
            } else
                tool.syntax_error('Unrecognized opcode',opcode.start,opcode.end);
            tool.inst_codec.encode('sysreg', fields, true);
        }

        /*
        function assemble_not_implemented(opc, opcode, operands) {
            tool.syntax_error(`${opc.toUpperCase()} not yet supported`,opcode.start,opcode.end);
        }
        */

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
        if (!this.educore) this.assembly_handlers.set('madd', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('mneg', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('msub', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('mul', assemble_registers);
        this.assembly_handlers.set('neg', assemble_op2_arithmetic);
        this.assembly_handlers.set('negs', assemble_op2_arithmetic);
        this.assembly_handlers.set('ngc', assemble_adcsbc);
        this.assembly_handlers.set('ngcs', assemble_adcsbc);
        this.assembly_handlers.set('sbc', assemble_adcsbc);
        this.assembly_handlers.set('sbcs', assemble_adcsbc);
        if (!this.educore) this.assembly_handlers.set('sdiv', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('smaddl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('smnegl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('smsubl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('smulh', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('smull', assemble_muladd);
        this.assembly_handlers.set('sub', assemble_op2_arithmetic);
        this.assembly_handlers.set('subs', assemble_op2_arithmetic);
        if (!this.educore) this.assembly_handlers.set('udiv', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('umaddl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('umnegl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('umsubl', assemble_muladd);
        if (!this.educore) this.assembly_handlers.set('umulh', assemble_registers);
        if (!this.educore) this.assembly_handlers.set('umull', assemble_muladd);

        // bit manipulation instructions
        this.assembly_handlers.set('bfc', assemble_bit_field);
        this.assembly_handlers.set('bfi', assemble_bit_field);
        this.assembly_handlers.set('bfm', assemble_bit_field);
        this.assembly_handlers.set('bfxil', assemble_bit_field);
        if (!this.educore) this.assembly_handlers.set('cls', assemble_bits);
        if (!this.educore) this.assembly_handlers.set('clz', assemble_bits);
        this.assembly_handlers.set('extr', assemble_extr);
        if (!this.educore) this.assembly_handlers.set('rbit', assemble_bits);
        if (!this.educore) this.assembly_handlers.set('rev', assemble_bits);
        if (!this.educore) this.assembly_handlers.set('rev16', assemble_bits);
        if (!this.educore) this.assembly_handlers.set('rev32', assemble_bits);
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
        if (!this.educore) this.assembly_handlers.set('cbnz', assemble_cb);
        if (!this.educore) this.assembly_handlers.set('cbz', assemble_cb);
        this.assembly_handlers.set('ret', assemble_blr);
        if (!this.educore) this.assembly_handlers.set('tbz', assemble_tb);
        if (!this.educore) this.assembly_handlers.set('tbnz', assemble_tb);

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
        if (!this.educore) this.assembly_handlers.set('ldp', assemble_ldstp);
        if (!this.educore) this.assembly_handlers.set('ldpsw', assemble_ldstp);
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
        if (!this.educore) this.assembly_handlers.set('stp', assemble_ldstp);
        this.assembly_handlers.set('str', assemble_ldst);
        this.assembly_handlers.set('strb', assemble_ldst);
        this.assembly_handlers.set('strh', assemble_ldst);
        this.assembly_handlers.set('stur', assemble_ldst);
        this.assembly_handlers.set('sturb', assemble_ldst);
        this.assembly_handlers.set('sturh', assemble_ldst);

        // system
        this.assembly_handlers.set('hlt', assemble_hlt);
        this.assembly_handlers.set('brk', assemble_hlt);
        this.assembly_handlers.set('svc', assemble_hlt);
        this.assembly_handlers.set('eret', assemble_hlt);
        this.assembly_handlers.set('nop', assemble_nop);
        this.assembly_handlers.set('mrs', assemble_sysreg);
        this.assembly_handlers.set('msr', assemble_sysreg);
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

        const start_dot = this.dot(true);
        handler(opc, opcode, this.parse_operands(operands));
        if (this.pass == 2 && this.source_map) {
            const last_operand = operands[operands.length - 1];
            const loc = {
                start: opcode.start,
                end: last_operand ? last_operand[last_operand.length - 1].end : opcode.end,
                breakpoint: false,
            };
            const end_dot = this.dot(true);
            for (let pc = start_dot; pc <= end_dot; pc += 4) {
                this.source_map[pc/4] = loc;
            }
        }
        return true;
    }

    // Arm-specific directives
    add_built_in_directives() {
        // standard directives
        super.add_built_in_directives();

        // Arm-specific directives
        const tool = this;

        this.directives.set(".balign", function(key, operands) {
            return tool.directive_balign(key,operands);
        });
        this.directives.set(".p2align", function(key, operands) {
            return tool.directive_align(key,operands);
        });
        this.directives.set(".quad", function(key, operands) {
            key.token = '.long';   // .quad is an alias for .long
            return tool.directive_storage(key,operands);
        });
    }

    // .balign n   (align dot to be 0 mod n, n must be a power of two)
    directive_balign(key, operands) {
        if (operands.length !== 1)
            throw key.asSyntaxError('Expected one argument');
        const n = Number(this.eval_expression(this.read_expression(operands[0])));

        // check for power of two
        let m = n;
        if (m > 0) while ((m & 1) === 0) m >> 1;
        if (m !== 1)
            this.syntax_error('operand must be a power of two',
                              operands[0].start, operands[0].end);

        this.align_dot(n);
        return true;
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

    // decode instruction found at mem[pa]
    disassemble(pa, va) {
        const inst = this.memory.memory.getUint32(pa, this.little_endian);  // bypass cache accounting
        return this.disassemble_inst(inst, pa, va);
    }

    // return text representation of instruction at addr
    // saves fields of decoded instruction in this.inst_code[pa/4]
    disassemble_inst(inst, pa, va) {
        const result = this.inst_codec.decode(inst);
        if (result === undefined) return undefined;

        const info = result.info;
        if (va === undefined && pa !== undefined) va = BigInt(this.pa2va(pa));
        result.pa = pa;
        result.va = va;
        result.opcode = info.opcode;
        result.handler = this.handlers.not_implemented;

        if (pa !== undefined && this.inst_decode) this.inst_decode[pa/4] = result;   // save all our hard work!

        // redirect writes to WZR/XZR to a bit bucket
        result.dest = (result.d === 31) ? 33 : result.d;

        // redirect reads from WZR/XZR to register_file[32] which is always zero
        if (result.n === 31) result.n = 32;
        if (result.m === 31) result.m = 32;
        if (result.a === 31) result.a = 32;

        result.sz = (result.z === 0) ? 32 : 64;   // use 64 if result.z is undefined
        result.vmask = (result.sz == 32) ? this.mask32 : this.mask64;

        let r = (result.z === 0) ? 'w' : 'x';   // use X if result.z is undefined
        let Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
        let Xn = (result.n === 32) ? `${r}zr` : `${r}${result.n}`;
        let Xm = (result.m === 32) ? `${r}zr` : `${r}${result.m}`;

        if (info.type === 'R') {
            result.iclass = 'alu';
            result.handler = this.handlers.alu;
            result.msel = undefined;  // use rm
            result.flags = false;
            result.alu = 0;   // default to add with carry

            if (result.opcode === 'bool') {
                switch (result.x) {
                case 0: result.opcode = (result.N === 0) ? 'and' : 'bic'; break;
                case 1: result.opcode = (result.N === 0) ? 'orr' : 'orn'; break;
                case 2: result.opcode = (result.N === 0) ? 'eor' : 'eon'; break;
                case 3: result.opcode = (result.N === 0) ? 'ands' : 'bics'; break;
                }
                if (result.N === -1) result.N = 1;   // didn't want sign-extension!
                result.alu = {0: 1, 1: 2, 2: 3, 3: 1}[result.x];
                if (result.x === 3) result.flags = true;
            }
            else if (result.opcode === 'shift') {
                result.opcode = {0: 'lsl', 1: 'lsr', 2: 'asr', 3: 'ror'}[result.s];
                result.alu = result.s + 4;
            }
            else if (result.opcode === 'adcsbc') {
                result.opcode = {0: 'adc', 1: 'adcs', 2: 'sbc', 3: 'sbcs'}[result.x];
                result.N = (result.x >= 2) ? 1 : 0;
                if (result.x & 1) result.flags = true;
                result.cin = 2;
            }
            else if (result.opcode === 'addsub' || result.opcode === 'addsubx') {
                result.opcode = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];
                if (result.x >= 2) {   // sub, subs
                    // negate second operand = complement and add 1
                    result.N = 1;
                    result.cin = 1;
                } else {
                    result.N = 0;
                    result.cin = 0;
                }
                if (result.x & 1) result.flags = true;

                if (info.opcode === 'addsubx') {
                    // Xd is allowed to be SP only for add/sub
                    if ((result.x & 1)===0 && result.d === 31) {
                        result.dest = 31;
                        Xd = (result.z === 0) ? 'wsp' : 'sp';
                    }
                    // Xn is allowed to be SP only for add/sub
                    if (result.n === 32) {
                        result.n = 31;
                        Xn = (result.z === 0) ? 'wsp' : 'sp';
                    }
                    // B, H, W extensions happen on W regs
                    if ((result.o & 0x3) !== 0x3) Xm = `w${result.m}`;
                }
            }
            else {
                // check for other opcodes here and set result.alu appropriately
                result.alu = {'madd': 8, 'msub': 9,
                              'sdiv': 10, 'udiv': 11,
                              'smulh': 12, 'umulh': 13,
                             }[result.opcode];
                if (result.alu === undefined) {
                    result.iclass = 'not_implemented';
                    result.handler = this.handlers.not_implemented;
                }
            }

            let i = `${result.opcode} ${Xd},${Xn},${Xm}`;

            // fourth operand?
            if (result.a !== undefined) {
                let Xa = (result.a === 32) ? `${r}zr` : `${r}${result.a}`;
                i += `,${Xa}`;
            }

            // shifted register?
            if (result.o === undefined && result.j !== undefined /*&& result.j !== 0*/) {
                // don't show shifts by #0
                if (result.j !== 0)
                    i += `,${['lsl','lsr','asr','ror'][result.s]} #${result.j}`;
                result.j = BigInt(result.j);   // for 64-bit operations
                result.msel = result.s + 9;
            }

            // extended register?
            if (result.o !== undefined) {
                // don't show UXTX #0
                if (result.o !== 3 || result.j !== 0)
                    i += `,${['uxtb','uxth','uxtw','uxtx','sxtb','sxth','sxtw','sxtx'][result.o]} ${result.j ? ' #'+result.j : ''}`;
                result.j = BigInt(result.j);   // for 64-bit operations
                result.msel = result.o + 1;
            }
            result.assy = i;
            return result;
        }

        if (info.type === 'I') {
            // convert opcode back to what user typed in...
            result.opcode = {0: 'add', 1: 'adds', 2: 'sub', 3: 'subs'}[result.x];

            result.iclass = 'alu';
            result.handler = this.handlers.alu;
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
                result.dest = 31;
                Xd = (result.z === 0) ? 'wsp' : 'sp';
            }
            if (result.n === 32) {
                result.n = 31;
                Xn = (result.z === 0) ? 'wsp' : 'sp';
            }
            //if (result.s === 0 && result.i === 0n) return `mov ${Xd},${Xn}`;

            let i = `${result.opcode} ${Xd},${Xn},#${result.i}`;
            // shifted immediate?
            if (result.s === 1) {
                i += `,lsl #12`;
                result.i <<= 12n;   // adjust the actual immediate operand too
            }
            result.assy = i;
            return result;
        }

        if (info.type === 'D') {
            if (info.opcode === 'ldr.pc') r = result.z ? 'x' : 'w';
            else if (result.s >= 2) r = (result.s & 1) ? 'w' : 'x';
            else r = (result.z === 3) ? 'x' : 'w';
            let Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
            result.vmask = (r == 'x') ? this.mask64 : this.mask32;
            // handle SP as base register
            if (result.n === 32) {
                result.n = 31;
                Xn = 'sp';
            } else Xn = `x${result.n}`;
            result.i = BigInt(result.I===undefined ? (result.i===undefined ? 0 : result.i) : result.I) & this.mask64;   // for 64-bit operations
            result.offset = result.i;

            if (info.opcode === 'ldr.pc') {
                if (result.x === 1) {
                    result.opcode = 'ldrsw';
                    Xd = Xd.replace('w','x');   // ldrsw target is always Xn
                    result.sz = 64;
                    result.vmask = this.mask64;
                } else result.opcode = 'ldr';
                result.i = result.i << 2n;
                result.offset = (result.i + va) & this.mask64;
                result.iclass = 'ldr_literal';
                result.handler = this.handlers.ldr_literal;
                result.assy = `${result.opcode} ${Xd},0x${result.offset.toString(16)}`;
                return result;
            }

            result.iclass = 'ldst';
            result.handler = this.handlers.ldst;
            result.osel = 0;   // default: just add offset to base reg
            if (result.s === 0) {
                result.opcode = 'st';
                result.a = result.d;   // use A port on register file
            } else result.opcode = 'ld';
            if (result.s === 0 && result.d === 31) result.d = 32;  // st from WZR/XZR => read from register_file[32]
            if (result.x === 0) result.opcode += 'u';     // unscaled offset?
            result.opcode += 'r';
            result.opcode += result.s >= 2 ? 's' : '';    // signed?
            result.opcode += {0: 'b', 1: 'h', 2: (result.s >= 2 ? 'w': ''), 3: ''}[result.z];  // size?
            if (info.opcode === 'ldst.off') {
                result.i = (result. i << BigInt(result.z)) & this.mask64;
                result.offset = result.i;
                let i = `${result.opcode} ${Xd},[${Xn}`;
                if (result.i !== 0n) i += `,#${result.offset}`;
                result.assy = i + ']';
                return result;
            }

            if (info.opcode === 'ldst.reg') {
                const shift = {2: 'uxtw', 3: 'lsl', 6: 'sxtw', 7: 'sxtx'}[result.o];
                result.osel = {2: 3, 3: 4, 6: 5, 7: 6}[result.o];  // select offset opereration
                result.shamt = BigInt(result.y ? result.z : 0);   // index shift amount
                Xm = `${(result.o & 1) ? 'x' : 'w'}${result.m === 32 ? 'zr' : result.m}`;
                const temp = result.shamt ? `,${shift} #${result.shamt}` : '';
                result.assy = `${result.opcode} ${Xd},[${Xn},${Xm}${temp}]`;
                return result;
            }

            if (info.opcode === 'ldst') {
                // dispatch on addressing mode
                let offset;
                switch (result.x) {
                case 0:
                    offset = (result.offset !== 0n)  ? `,#${result.offset}` : '';
                    result.assy = `${result.opcode} ${Xd},[${Xn}${offset}]`;
                    break;
                case 1:
                    // post-index
                    result.osel = 2;
                    result.assy = `${result.opcode} ${Xd},[${Xn}],#${result.offset}`;
                    break;
                case 2:
                    result.assy = '???';
                    break;
                case 3:
                    // pre-index
                    result.osel = 1;
                    result.assy = `${result.opcode} ${Xd},[${Xn},#${result.offset}]!`;
                    break;
                }
                return result;
            }
        }

        if (info.type === 'P') {
            r = (result.x === 0) ? 'w' : 'x';
            result.vmask = (result.x === 0) ? this.mask32 : this.mask64;
            Xd = (result.d === 31) ? `${r}zr` : `${r}${result.d}`;
            const Xdd = (result.e === 31) ? `${r}zr` : `${r}${result.e}`;
            result.opcode = (result.x === 1) ? 'ldpsw' : (result.o ? 'ldp' : 'stp');
            result.iclass = 'ldstp';
            result.handler = this.handlers.ldstp;

            // handle SP as base register
            if (result.n === 32) {
                result.n = 31;   // SP is register[32]
                Xn = 'sp';
            } else Xn = `x${result.n}`;

            const scale = (result.x === 2) ? 3 : 2;
            result.offset = BigInt(result.I << scale);   // for 64-bit operations

            // dispatch on addressing mode
            switch (result.s) {
            case 1:
                // post-index
                result.assy = `${result.opcode} ${Xd},${Xdd},[${Xn}],#${result.offset}`;
                break;
            case 2:
                result.assy = `${result.opcode} ${Xd},${Xdd},[${Xn},#${result.offset}]`;
                break;
            case 3:
                // pre-index
                result.assy = `${result.opcode} ${Xd},${Xdd},[${Xn},#${result.offset}]!`;
                break;
            }
            return result;
        }

        if (info.type === 'B') {
            result.i = BigInt(result.I << 2) & this.mask64;
            result.addr = (result.i + va) & this.mask64;
            result.opcode = {0: 'b', 1: 'bl'}[result.x];
            result.iclass = 'b';
            result.handler = this.handlers.b;
            result.assy = `${result.opcode} 0x${result.addr.toString(16)}`;
            return result;
        }

        if (info.type === 'CB') {
            result.i = BigInt(result.I << 2) & this.mask64;
            result.addr = (result.i + va) & this.mask64;
            result.opcode = {0: 'cbz', 1: 'cbnz'}[result.x];
            result.iclass ='cbz';
            result.handler = this.handlers.cbz;
            result.assy = `${result.opcode} ${Xn},0x${result.addr.toString(16)}`;
            return result;
        }

        if (info.type === 'TB') {
            result.i = BigInt(result.I << 2) & this.mask64;
            result.addr = (result.i + va) & this.mask64;
            if (result.z) result.b += 32;
            result.mask = (1n << BigInt(result.b));
            result.opcode = {0: 'tbz', 1: 'tbnz'}[result.x];
            result.iclass = 'tb';
            result.handler = this.handlers.tb;
            result.assy = `${result.opcode} ${Xn},#${result.b},0x${result.addr.toString(16)}`;
            return result;
        }

        if (info.type === 'BL') {
            result.opcode = {0: 'br', 1: 'blr', 2:'ret'}[result.x];
            result.iclass = 'br';
            result.handler = this.handlers.br;
            result.assy = `${result.opcode} ${Xn}`;
            return result;
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
            result.i = BigInt(result.I << 2) & this.mask64;
            result.addr = (result.i + va) & this.mask64;
            result.iclass = 'bcc';
            result.handler = this.handlers.bcc;
            result.assy = `${result.opcode} 0x${result.addr.toString(16)}`;
            return result;
        }

        if (info.type === 'CS') {
            result.x = 2*result.x + result.y;
            result.opcode = {0: 'csel', 1: 'csinc', 2: 'csinv', 3: 'csneg'}[result.x];
            result.iclass = 'cs';
            result.handler = this.handlers.cs;
            const cond = {0: 'eq', 1: 'ne',
                          2: 'cs', 3:'cc',
                          4: 'mi', 5: 'pl',
                          6: 'vs', 7: 'vc',
                          8: 'hi', 9: 'ls',
                          10: 'ge', 11: 'lt',
                          12: 'gt', 13: 'le',
                          14: 'al', 15: 'nv'}[result.c];
            result.assy = `${result.opcode} ${Xd},${Xn},${Xm},${cond}`;
            return result;
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
            result.iclass = 'cc';
            result.handler = this.handlers.cc;
            if (result.y === 1) {
                result.m = BigInt(result.m);   // for 64-bit operations
                result.assy = `${result.opcode} ${Xn},#${result.m},#${result.j},${cond}`;
            } else
                result.assy = `${result.opcode} ${Xn},${Xm},#${result.j},${cond}`;
            return result;
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
                result.sxtsz = (result.x === 0) ? result.s - result.r + 1 : 0;
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
            result.iclass = 'bfm';
            result.handler = this.handlers.bfm;
            result.assy = `${result.opcode} ${Xd},${Xn},#${result.r},#${result.s}`;
            return result;
        }

        if (info.type === 'BITS') {
            if (result.z === 1 && result.y === 0) result.opcode = 'rev32';
            result.iclass = {
                'cls': 'cls',
                'clz': 'cl',
                'rbit': 'rbit',
                'rev': 'rev',
                'rev16': 'rev',
                'rev32': 'rev',
            }[result.opcode];
            result.handler = {
                'cls': this.handlers.cl,
                'clz': this.handlers.cl,
                'rbit': this.handlers.rbit,
                'rev': this.handlers.rev,
                'rev16': this.handlers.rev,
                'rev32': this.handlers.rev,
            }[result.opcode];
            result.assy = `${result.opcode} ${Xd},${Xn}`;
            return result;
        }

        if (info.type === 'EXTR') {
            result.j = BigInt(result.j);
            result.iclass = 'extr';
            result.handler = this.handlers.extr;
            result.assy = `extr ${Xd},${Xn},${Xm},#${result.j}`;
            return result;
        }
        
        if (info.type === 'IM') {
            // convert opcode back to what user typed in...
            result.opcode = {0: 'and', 1: 'orr', 2: 'eor', 3: 'ands'}[result.x];
            result.msel = 0;
            result.alu = {0: 1, 1: 2, 2: 3, 3: 1}[result.x];
            result.flags = (result.x == 3);
            result.iclass = 'alu';
            result.handler = this.handlers.alu;

            // and, eor, orr allow SP for Xd
            if (result.x !== 3) {
                if (result.d === 31) {
                    Xd = (result.z === 0) ? 'wsp' : 'sp';
                    result.dest = 31;    // SP is register file[32]
                }
            }

            // reconstruct mask from y, r, s fields of instruction
            this.decode_bitmask_immediate(result);

            result.assy = `${result.opcode} ${Xd},${Xn},#0x${this.hexify(result.i,result.z == 1 ? 16 : 8)}`;
            return result;
        }

        if (info.type === 'A') {
            result.i = BigInt((result.I << 2) + result.i) & this.mask64;
            let base = va;
            if (info.opcode === 'adrp') {
                result.i = (result.i << 12n) & this.mask64;
                result.pcmask = (~0xFFFn) & this.mask64;
                base &= ~0xFFFn;
            }
            result.addr = (result.i + base) & this.mask64;
            result.iclass = 'adr';
            result.handler = this.handlers.adr;
            result.assy = `${result.opcode} ${Xd},#0x${result.addr.toString(16)}`;
            return result;
        }

        if (info.type === 'M') {
            result.opcode = {0: 'movn', 2: 'movz', 3: 'movk'}[result.x];
            const a = BigInt(result.s * 16);
            const shift = (result.s > 0) ? `,LSL #${a}` : '';
            let imm = result.i;
            result.i = BigInt(result.i) << a;
            result.maskn = BigInt(0xFFFF) << a;
            result.iclass = 'movx';
            result.handler = this.handlers.movx;
            result.assy = `${result.opcode} ${Xd},#0x${imm.toString(16)}${shift}`;
            return result;
        }

        if (info.type === 'MA') {
            result.opcode = `${result.u ? 'u' : 's'}m${result.x ? 'sub' : 'add'}l`;
            result.sz = 64;
            result.vmask = this.mask64;
            result.alu = {'smaddl': 14, 'smsubl': 15,
                          'umaddl': 16, 'umsubl': 17}[result.opcode];
            result.iclass = 'alu';
            result.handler = this.handlers.alu;

            Xd = (result.d === 31) ? 'xzr' : `x${result.d}`;
            Xn = (result.n === 31) ? 'wzr' : `w${result.n}`;
            Xm = (result.m === 31) ? 'wzr' : `w${result.m}`;
            const Xa = (result.a === 31) ? 'xzr' : `x${result.a}`;
            result.assy = `${result.opcode} ${Xd},${Xn},${Xm},${Xa}`;
            return result;
        }

        if (info.type === 'H') {
            if (['svc','eret'].includes(result.opcode)) {
                result.iclass = 'not_implmented';
                result.handler = this.handlers.not_implemented;
            } else {
                result.iclass = 'hlt';
                result.handler = this.handlers.hlt;
            }
            result.incrpc = (result.opcode === 'brk');
            result.assy = `${result.opcode} #${result.j}`;
            return result;
        }

        if (info.type === 'ERET') {
            result.handler = this.handlers.not_implemented;
            result.assy = `${result.opcode}`;
            return result;
        }

        if (info.type === 'NOP') {
            result.iclass = 'nop';
            result.handler = this.handlers.nop;
            result.assy = 'nop';
            return result;
        }

        if (info.type === 'SYS') {
            result.opcode = {0: 'msr', 1: 'mrs'}[result.x];
            if (result.x === 0 && result.d === 31) result.d = 32;  // read from XZR...
            result.sysreg = {
                0x5A10: 'NZCV',
                1: 'console',
                2: 'mouse',
                3: 'cycles',
                default: '???'
            }[result.j];
            result.iclass = 'sysreg';
            result.handler = this.handlers.sysreg;
            if (result.x === 0)
                result.assy = `msr ${result.sysreg},${Xd}`;
            else
                result.assy = `mrs ${Xd},${result.sysreg}`;
            return result
        }

        result.iclass = 'not_implemented';
        result.assy = '???';
        return result;
    }
}

//////////////////////////////////////////////////
// Arm A64/EDUCORE emulation (single-cycle, not pipelined)
//////////////////////////////////////////////////

SimTool.ASim = class extends SimTool.ArmA64Assembler {
    static asim_version = 'asim.67';

    constructor(tool_div, educore) {
        // super() will call this.emulation_initialize()
        super(tool_div, `Arm ${educore ? 'Educore' : 'A64'} ${SimTool.ASim.asim_version}`);
    }

    //////////////////////////////////////////////
    //  Emulation handlers
    //////////////////////////////////////////////

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

        // support variants of second operand
        let op2;
        if (info.msel === 0) op2 = info.i;
        else {
            op2 = tool.register_file[info.m] & info.vmask;
            if (info.msel !== undefined) switch (info.msel) {
                case 1: op2 = BigInt.asUintN(8, op2) << info.j; break;   // UXTB
                case 2: op2 = BigInt.asUintN(16, op2) << info.j; break;  // UXTH
                case 3: op2 = BigInt.asUintN(32, op2) << info.j; break;  // UXTW
                case 4: op2 = BigInt.asUintN(64, op2) << info.j; break;  // UXTX
                case 5: op2 = BigInt.asIntN(8, op2) << info.j; break;    // SXTB
                case 6: op2 = BigInt.asIntN(16, op2) << info.j; break;   // SXTH
                case 7: op2 = BigInt.asIntN(32, op2) << info.j; break;   // SXTW
                case 8: op2 = BigInt.asIntN(64, op2) << info.j; break;   // SXTX
                case 9: op2 <<= info.j; break;   // LSL
                case 10: op2 >>= info.j; break;   // LSR
                case 11: op2 = BigInt.asIntN(info.sz, op2) >> info.j; break;   // ASR
                case 12: op2 = ((op2 << BigInt(info.sz)) | op2) >> info.j; break;   // ROR
                default: op2 = 0n;
            }
        }
        if (info.N === 1) op2 = ~op2;
        op2 &= info.vmask;

        // compute result
        let result,cin;
        switch (info.alu) {
        case 0:  // add with carry
            cin = info.cin;
            if (cin === 2) cin = (tool.nzcv & 0x2) ? 1 : 0;
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
            result = tool.register_file[info.a] + (op1 * op2);
            break;
        case 9:  // msub
            result = tool.register_file[info.a] - (op1 * op2);
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
            result = tool.register_file[info.a] + (BigInt.asIntN(32,op1) * BigInt.asIntN(32,op2));
            break;
        case 15:  // smsubl
            result = tool.register_file[info.a] - (BigInt.asIntN(32,op1) * BigInt.asIntN(32,op2));
            break;
        case 16:  // umaddl
            result = tool.register_file[info.a] + (BigInt.asUintN(32,op1) * BigInt.asUintN(32,op2));
            break;
        case 17:  // umsubl
            result = tool.register_file[info.a] - (BigInt.asUintN(32,op1) * BigInt.asUintN(32,op2));
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
        if (info.x === 3) result = tool.register_file[info.dest] & (~info.maskn & info.vmask);
        result |= info.i;
        if (info.x === 0) result = (~result) & info.vmask;

        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;

        if (update_display) tool.reg_write(info.dest, result);
    }

    // B, BL
    handle_b(tool, info, update_display) {
        if (info.x === 1) { // BL
            tool.register_file[30] = (tool.pc + 4n) & tool.mask64;
            if (update_display) tool.reg_write(30, tool.register_file[30]);
        }
        if (info.addr === tool.pc) throw('Halt Execution'); // detect branch-dot
        tool.pc = info.addr;
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
            return ((flags & 0b0100) === 0) && ((test === 0b0000) || (test === 0b1001));
        case 13:  // Z | N != V
            test = flags & 0b1001;
            return ((flags & 0b0100) === 0b0100) || ((test !== 0b0000) && (test !== 0b1001));
        case 14: return true;
        case 15: return false;
        default: return false;
        }
    }

    // CCMN, CCMP
    handle_cc(tool, info, update_display) {
        const n = tool.register_file[info.n] & info.vmask;
        let m = (info.y === 1) ? info.m : (tool.register_file[info.m] & info.vmask);
        //if (info.x === 0) m = (-m) & info.vmask;

        let result;
        if (tool.check_cc(tool.nzcv, info.c)) {
            // set flags from n-m
            let cin = 0n;
            // complement and add 1 to perform subtract
            if (info.x) { cin = 1n; m = (~m) & info.vmask; }
            result = n + m + cin;   // unsigned result
            const xresult = result & info.vmask;
            tool.nzcv = 0;
            if (BigInt.asIntN(info.sz, xresult) < 0) tool.nzcv |= 0x8;
            if (xresult === 0n) tool.nzcv |= 0x4;
            if (xresult !== result) tool.nzcv |= 0x2;
            const signed_n = BigInt.asIntN(info.sz,n);
            const signed_m = BigInt.asIntN(info.sz,m);
            const signed_result = (info.x === 0) ? signed_n + signed_m : signed_n - signed_m;    // unsigned result
            if (BigInt.asIntN(info.sz, signed_result) !== signed_result) tool.nzcv |= 0x1;
        } else tool.nzcv = info.j;
        tool.pc = (tool.pc + 4n) & tool.mask64;

        if (update_display) {
            const flags = document.getElementById('nzcv');
            flags.classList.add('cpu_tool-reg-write');
            flags.innerHTML = tool.nzcv.toString(2).padStart(4, '0');
        }
    }

    // CSEL, CSINC, CSINV, CSNEG
    handle_cs(tool, info, update_display) {
        let result;
        if (tool.check_cc(tool.nzcv, info.c)) {
            result = tool.register_file[info.n];
            if (update_display) tool.reg_read(info.n);
        } else {
            result = tool.register_file[info.m]; 
            switch (info.x) {
            case 0: break;
            case 1: result += 1n; break;
            case 2: result = ~result; break;
            case 3: result = -result; break;
            }
            if (update_display) tool.reg_read(info.m);
        }
        result &= info.vmask;
        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) tool.reg_write(info.dest, result);
    }

    // B.cc
    handle_bcc(tool, info, update_display) {  // eslint-disable-line no-unused-vars
        if (tool.check_cc(tool.nzcv, info.c)) {
            if (info.addr === tool.pc) throw "Halt Execution";   // detect branch-dot
            tool.pc = info.addr;
        } else tool.pc = (tool.pc + 4n) & tool.mask64;
    }

    // BR, BLR, RET
    handle_br(tool, info, update_display) {
        if (info.x === 1) {  // BLR
            tool.register_file[30] = (tool.pc + 4n) & tool.mask64;
            if (update_display) tool.reg_write(30, tool.register_file[30]);
        }
        if (update_display) tool.reg_read(info.h);
        const next_pc = tool.register_file[info.n];
        if (next_pc === tool.pc) throw('Halt Execution'); // detect branch-dot
        tool.pc = next_pc;
    }

    // CBZ, CBNZ
    handle_cbz(tool, info, update_display) {
        if (update_display) tool.reg_read(info.n);

        const Xn = tool.register_file[info.n];
        const next_pc = (Xn === 0n ? info.x===0 : info.x===1) ? info.addr : (tool.pc + 4n) & tool.mask64;

        // detect branch-dot
        if (next_pc === tool.pc) throw('Halt Execution');
        else tool.pc = next_pc;

        if (update_display) {
            tool.reg_read(info.n);
        }
    }

    // TBZ, TBNZ
    handle_tb(tool, info, update_display) {
        if (update_display) tool.reg_read(info.n);

        const bit_is_zero = (tool.register_file[info.n] & info.mask) === 0n;
        // info.x: 0=TBZ, 1=TBNZ
        if (info.x ? !bit_is_zero : bit_is_zero) {
            if (tool.pc === info.addr) throw('Halt Execution');
            tool.pc = info.addr;
        } else
            tool.pc = (tool.pc + 4n) & tool.mask64;
    }
    
    // LDR literal, LDRSW literal
    handle_ldr_literal(tool, info, update_display) {
        const PA = tool.va_to_phys(info.offset);
        let result = tool.memory.read_biguint64(PA);
        if (info.x === 1) result = BigInt.asIntN(32, result) & tool.mask64;
        else result &= info.vmask;

        tool.register_file[info.dest] = result;
        tool.pc = (tool.pc + 4n) & tool.mask64;
        if (update_display) {
            tool.mem_read(PA, (info.x==1 || info.z===0) ? 32: 64);
            tool.reg_write(info.dest, result);
        }
    }

    // LDR*, STR*
    // info.dest    destination register
    // info.n       base register
    // info.m       offset register (if defined)
    // info.offset  immediate offset, appropriately scaled and sign-extended
    // info.osel    0=offset, 1=pre-index using offset, 2=post-index using offset
    // info.z       0=byte, 1=halfword, 2=word, 3=dword
    // info.s       0=str, 1=ldr, 2,3=ldrs
    handle_ldst(tool, info, update_display) {
        let EA = tool.register_file[info.n];   // read base register

        // adjust with offset
        switch (info.osel) {
        case 0:   // offset
        case 1:   // pre-index
            EA = (EA + info.offset) & tool.mask64;
            if (info.osel === 1) {  // pre-index
                tool.register_file[info.n] = EA;
                if (update_display) tool.reg_write(info.n, EA);
            }
            break;
        case 2:   // post-index
            tool.register_file[info.n] = (tool.register_file[info.n] + info.offset) & tool.mask64;
            if (update_display) tool.reg_write(info.n, tool.register_file[info.n]);
            break;
        case 3:   // register offset, uxtw  (shifted 0-extended 32-bit value)
            EA = (EA + ((tool.register_file[info.m] & tool.mask32) << info.shamt)) & tool.mask64;
            break;
        case 4:   // register offset, lsl/uxtx  (shifted 64-bit value)
            EA = (EA + (tool.register_file[info.m] << info.shamt)) & tool.mask64;
            break;
        case 5:   // register offset, sxtw (shifted sign-extended 32-bit value)
            EA = (EA + (BigInt.asIntN(32, tool.register_file[info.m]) << info.shamt)) & tool.mask64;
            break;
        case 6:   // register offset, sxtx (shifted 64-bit value)
            EA = (EA + (tool.register_file[info.m] << info.shamt)) & tool.mask64;
            break;
        }
            
        // handle memory operation
        // "Unaligned accesses are allowed to addresses marked as Normal, but not to Device regions."
        const PA = tool.va_to_phys(EA);
        if (info.s === 0) {   // store
            let data = tool.register_file[info.d];
            switch (info.z) {
            case 0: tool.memory.write_bigint8(PA, data); break;
            case 1: tool.memory.write_bigint16(PA, data); break;
            case 2: tool.memory.write_bigint32(PA, data); break;
            case 3: tool.memory.write_bigint64(PA, data); break;
            }
            if (update_display) {
                tool.reg_read(info.d);
                if (info.z < 2) {  // did we write less than a full word?
                    // then read in modified word so we can update display correctly
                    data = tool.memory.read_biguint32(PA & ~0x3);
                }
                tool.mem_write(PA, data, (info.z === 3) ? 64 : 32);
            }
        } else {  // load
            let result;
            if (info.s === 1) {   // unsigned
                switch (info.z) {
                case 0: result = tool.memory.read_biguint8(PA); break;
                case 1: result = tool.memory.read_biguint16(PA); break;
                case 2: result = tool.memory.read_biguint32(PA); break;
                case 3: result = tool.memory.read_biguint64(PA); break;
                }
            } else {   // signed
                switch (info.z) {
                case 0: result = tool.memory.read_bigint8(PA); break;
                case 1: result = tool.memory.read_bigint16(PA); break;
                case 2: result = tool.memory.read_bigint32(PA); break;
                case 3: result = tool.memory.read_bigint64(PA); break;
                }
                result &= info.vmask;
            }
            tool.register_file[info.dest] = result;
            if (update_display) {
                tool.mem_read(PA, (info.z === 3) ? 64 : 32);
                tool.reg_write(info.dest, result);
            }
        }

        tool.pc = (tool.pc + 4n) & tool.mask64;
    }

    // LDP, LDPSW, STP
    handle_ldstp(tool, info, update_display) {
        let EA = tool.register_file[info.n];   // read base register
        if (update_display) tool.reg_read(info.n);

        // adjust with offset
        switch (info.s) {
        case 1:   // post-index
            tool.register_file[info.n] = (tool.register_file[info.n] + info.offset) & tool.mask64;
            if (update_display) tool.reg_write(info.n, tool.register_file[info.n]);
            break;
        case 2:   // offset
            EA = (EA + info.offset) & tool.mask64;
            break;
        case 3:   // pre-index
            EA = (EA + info.offset) & tool.mask64;
            tool.register_file[info.n] = EA;
            if (update_display) tool.reg_write(info.n, EA);
            break;
        }

        // memory operation
        const PA = tool.va_to_phys(EA);
        const PA2 = tool.va_to_phys(EA + (info.x == 2 ? 8n : 4n));

        if (info.o === 0) {  // st
            if (info.x === 0) { // 32-bit
                const data1 =  tool.register_file[info.d] & tool.mask32;
                tool.memory.write_bigint32_aligned(PA, data1);
                const data2 = tool.register_file[info.e] & tool.mask32;
                tool.memory.write_bigint32_aligned(PA2, data2);
                if (update_display) {
                    tool.reg_read(info.d);
                    tool.reg_read(info.e);
                    tool.mem_write(PA, data1);
                    tool.mem_write(PA2, data2);
                }
            } else {  // 64-bit
                tool.memory.write_bigint64_aligned(PA, tool.register_file[info.d]);
                tool.memory.write_bigint64_aligned(PA2, tool.register_file[info.e]);
                if (update_display) {
                    tool.reg_read(info.d);
                    tool.reg_read(info.e);
                    tool.mem_write(PA, tool.register_file[info.d], 64);
                    tool.mem_write(PA2, tool.register_file[info.e], 64);
                }
            }
        } else {  // ld
            if (info.x === 0) { // 32-bit
                tool.register_file[info.d] = tool.memory.read_biguint32_aligned(PA);
                tool.register_file[info.e] = tool.memory.read_biguint32_aligned(PA2);
                if (update_display) {
                    tool.reg_write(info.d, tool.register_file[info.d]);
                    tool.reg_write(info.e, tool.register_file[info.e]);
                    tool.mem_read(PA);
                    tool.mem_read(PA2);
                }
            } else if (info.x === 2) {  // 64-bit
                tool.register_file[info.d] = tool.memory.read_bigint64_aligned(PA);
                tool.register_file[info.e] = tool.memory.read_bigint64_aligned(PA2);
                if (update_display) {
                    tool.reg_write(info.d, tool.register_file[info.d]);
                    tool.reg_write(info.e, tool.register_file[info.e]);
                    tool.mem_read(PA, 64);
                    tool.mem_read(PA2, 64);
                }
            } else { // ldpsw
                tool.register_file[info.d] = tool.memory.read_bigint32_aligned(PA);
                tool.register_file[info.e] = tool.memory.read_bigint32_aligned(PA2);
                if (update_display) {
                    tool.reg_write(info.d, tool.register_file[info.d]);
                    tool.reg_write(info.e, tool.register_file[info.e]);
                    tool.mem_read(PA);
                    tool.mem_read(PA2);
                }
            }
        }

        tool.pc = (tool.pc + 4n) & tool.mask64;
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
        tool.register_file[info.dest] = BigInt(result);
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
        result = (result >> info.j) & info.vmask;
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

    // BRK, HLT
    handle_hlt(tool, info, update_display) {
        if (info.incrpc) tool.pc = (tool.pc + 4n) & tool.mask64;
        else if (info.j === 0xFFFF) tool.verify_memory();  // performed when HLT #0xFFFF executed
        if (update_display) tool.next_pc(tool.pc);
        throw('Halt Execution');
    }

    // NOP
    handle_nop(tool, info, update_display) {
        tool.pc = (tool.pc + 4n) & tool.mask64;
    }

    // MRS, MSR
    handle_sysreg(tool, info, update_display) {
        if (info.x === 0) {   // msr
            switch (info.j) {
            case 0x5A10:
                tool.nzcv = Number((tool.register_file[info.d] >> 28n) & 0xFn);
                if (update_display) {
                    const flags = document.getElementById('nzcv');
                    flags.classList.add('cpu_tool-reg-write');
                    flags.innerHTML = tool.nzcv.toString(2).padStart(4, '0');
                }
                break;
            case 1:
                // console output: convert character to UTF-16
                const ch = String.fromCharCode(Number(tool.register_file[info.d] & 0xFFFFn));
                tool.console_output(ch);
                break;
            }
            if (update_display) tool.reg_read(info.d);
        } else { // mrs
            let v;
            switch (info.j) {
            case 0x5A10:
                v = BigInt(tool.nzcv) << 28n;
                if (update_display) {
                    document.getElementById('nzcv').classList.add('cpu_tool-reg-read');
                }
                break;
            case 1:
                // console input
                v = tool.console_input();
                if (v === undefined) v = 0n;
                else v = BigInt(v.charCodeAt(0));
                break;
            case 2:
                // mouse input
                v = BigInt(tool.mouse_input());
                break;
            case 3:
                // cycle counter
                v = BigInt(tool.ncycles);
                break;
            }
            tool.register_file[info.dest] = v;
            if (update_display) tool.reg_write(info.d, v);
        }

        tool.pc = (tool.pc + 4n) & tool.mask64;
    }

    // override base class to set up basic handlers for each instruction class
    handler_info() {
        this.handlers = {
            adr: this.handle_adr,  // ADR, ADRP
            alu: this.handle_alu,  // arith, bool operations
            b: this.handle_b,  // B, BL
            bcc: this.handle_bcc,  // B.cc
            bfm: this.handle_bfm,  // BFM, SBFM, UBFM
            br: this.handle_br,  // BR, BLR, RET
            cbz: this.handle_cbz,  // CBZ, CBNZ
            cc: this.handle_cc,  // CCMN, CCMP
            cl: this.handle_cl,  // CLS, CLZ
            cs: this.handle_cs,  // CSEL, CSINC, CSINV, CSNEG
            extr: this.handle_extr,  // EXTR
            hlt: this.handle_hlt,  // BRK, HLT
            ldr_literal: this.handle_ldr_literal,  // LDR literal, LDRSW literal
            ldst: this.handle_ldst,  // LDR*, STR*
            ldstp: this.handle_ldstp,  // LDP, LDPSW, STP
            movx: this.handle_movx,  // MOVK, MOVN, MOVZ
            nop: this.handle_nop,  // NOP
            not_implemented: this.handle_not_implemented,
            rbit: this.handle_rbit,  // RBIT
            rev: this.handle_rev,  // REV, REV16, REV32
            sysreg: this.handle_sysreg,  // MRS, MSR
            tb: this.handle_tb,  // TBZ, TBNZ
        };
    }
};

//////////////////////////////////////////////////
// Arm Educore emulation (pipelined)
//////////////////////////////////////////////////

var xdp;   // for ease of access during debugging

SimTool.ASimPipelined = class extends SimTool.ArmA64Assembler {
    constructor(tool_div) {
        // super() will call this.emulation_initialize()
        super(tool_div, `Arm Educore ${SimTool.ASim.asim_version}`);
    }

    disassemble_inst(inst, pa, va) {
        // build data structure of fields and control signals from binary word
        let result = super.disassemble_inst(inst, pa, va);
        if (result === undefined) result = this.hlt_inst;

        // datapath control signals (default value undefined, ie, false or 0)

	// read_n_valid     reading from N port?
	// read_m_valid     reading from M port?
	// read_a_valid     reading from A port?
	// read_reg_an      regfile N port read address
	// read_reg_am      regfile M port read address
	// read_reg_aa      regfile A port read address
	// read_n_sp        N-port read is for SP
	// fex_n_mux        select FEX_n value 0: PC, 1: PCpage, 2: Reg[N]
	// fex_m_mux        select FEX_m value 0: immediate, 1: Reg[M]
	// immediate        64-bit immediate operand
        // tmask
        // wmask
        
	// shamt            shift amount as BigInt (0..[63:31])
	// imm_sz           MSB number of barrel_in
	// imm_n            N bit from immediate decode
	// FnH              one of mask64, mask32
	// barrel_op        0: LSL, 1: LSR, 2: ASR, 3: ROR
	// barrel_lo_mux    barrel shift lower input select 0: ex_n, 1: ex_m
	// barrel_hi_mux    barrel shift upper input select 0: ex_n, 1: same as lower
	// bitext_sign_ext  sign-extend immediate operand?
	// alu_op_a_mux     0: 0n, 1: ex_a, 2: ex_n
	// alu_op_b_mux     0: bit extension, 1: wmask
	// wtmask           0: barrel_out, 1: barrel_out & wmask & tmask
	// alu_invert_b     invert alu B operand?
	// alu_cmd          0: and, 1: orr, 2: eor, 3: ands, 4: add (cin=0), 5: add (cin=1), 6: add (cin=C)
	// ex_out_mux       0: aligned ID_PC, 1: alu, 2: output of cond mux, 3: pstate as 64 bits
	// c                condition to match
	// pstate_en        write to PSTATE register?
	// pstate_mux       0: alu flags, 1: ex_a[31:28], 2: (match ? alu flags : imm_nzvc)
	// br_condition_mux 0: pstate match, 1: always
	// next_PC_mux      0: pc_adder, 1: ex_n
	// PC_add_op_mux    0: pc+4, 1: ex_n + en_m

	// mem_read            memory read?
	// mem_write           memory write?
	// mem_size            8, 16, 32, 64
	// mem_addr_mux        0: mem_ex_out, 1: mem_n
	// mem_sign_ext        sign-extend memory read data?
	// mem_load_FnH        one of mask64, mask32

	// wload_en        write to memory data write port (wb_rt_addr)?
	// rt_addr         address for memory data write port
	// write_en        write to wb_ex_out write port (wb_rd_addr)?
	// rd_addr         address for wb_ex_out write port

	// Error detection
	// decode_err
        
        // set up default values
        if (result.dest !== undefined && result.dest !== 33) {
            // no write if Xd is xzr...
            result.rd_addr = result.dest;
            result.write_en = 1;
        }
        if (result.n !== undefined) {
            if (result.n === 32) {   // read from xzr
                result.read_n_valid = 0;
                result.read_reg_an = 31;
                result.read_n_sp = 0;
            } else {
                result.read_n_valid = 1;
                result.read_reg_an = result.n;
                result.read_n_sp = (result.n === 31);
            }
            // route ex_n to alu_op_a
            result.fex_n_mux = 2;  // reg[n]
            result.alu_op_a_mux = 2;
        }
        if (result.m !== undefined) {
            if (result.m === 32) {   // read from xzr
                result.read_m_valid = 0;
                result.read_reg_am = 31;
            } else {
                result.read_m_valid = 1;
                result.read_reg_am = result.m;
            }
            result.fex_m_mux = 1;   // reg[m]
            // route ex_n to alu_b_op
            result.fex_m_mux = 1;
            result.barrel_lo_mux = 1;  // ex_m
            result.barrel_hi_mux = 1;  // same as lower
            result.barrel_op = 0;  // LSL #0
            result.original_shamt = result.shamt;
            result.shamt = 0n;
            result.tmask = result.vmask;  // no masking
            result.alu_op_b_mux = 0;
        }
        if (result.a !== undefined) {
            if (result.a === 32) {
                result.read_a_valid = 0;
                result.read_reg_aa = 31;
            } else {
                result.read_a_valid = 1;
                result.read_reg_aa = result.a;
            }
        }
        result.FnH = result.vmask;
        result.imm_sz = (result.vmask == this.mask64 ? 64 : 32);

        // add pipeline control signals
        switch (result.iclass) {
        case 'adr':
            // like LDR but no memory operation...
            result.fex_n_mux = (result.opcode === 'adrp') ? 1 : 0;  // PCpage/PC
            result.fex_m_mux = 0;  // imm
            result.FnH = this.mask64;   // 64-bit arithmetic
            result.barrel_op = 0;  // LSL #0
            result.shamt = 0n;
            result.barrel_lo_mux = 1;  // ex_m
            result.barrel_hi_mux = 1;  // same as lower
            result.wtmask = 0;     // no masking
            result.bitext_sign_ext = 0;  // no sxt
            result.alu_op_a_mux = 2;  // ex_n (ie, the PC)
            result.alu_op_b_mux = 0;  // shift/mask/sxt
            result.alu_invert_b = 0;  // don't invert alu op b
            result.alu_cmd = 4;  // add
            result.ex_out_mux = 1;  // alu output
            break;

        case 'alu':
            if (result.msel === undefined) {
                // use ex_m without shift/mask/sxt
                result.barrel_op = 0;    // LSL #0
                result.shamt = 0n;
            } else if (result.msel === 0) {  // imm
                if (result.alu === 0) {  // add/sub
                    result.fex_m_mux = 0; // load ex_m with immediate field
                    result.barrel_lo_mux = 1;  // ex_m
                    result.barrel_hi_mux = 1;  // same as lower
                    result.barrel_op = 0; // LSL #0
                    result.shamt = 0n;
                    result.alu_op_b_mux = 0;
                } else {  // and,eor,orr using bitfield mask
                    result.alu_op_b_mux = 1;
                }
            } else if (result.msel <= 8) {  // extended reg
                result.shamt = result.j;
                if (result.msel >= 5) result.bitext_sign_ext = 1;
                switch (result.msel & 0x3) {
                case 1:   // 8 bits
                    result.imm_sz = 8 + Number(result.j);
                    break;
                case 2:   // 16 bits
                    result.imm_sz = 16 + Number(result.j);
                    break;
                case 3:   // 32 bits
                    result.imm_sz = 32 + Number(result.j);
                    break;
                case 0:   // 64 bits
                    result.imm_sz = 64;
                    break;
                }
            } else {   // shifted op2
                result.barrel_op = result.msel - 9;   // LSL, LSR, ASR, ROR
                result.shamt = result.j;
            }
            result.alu_invert_b = result.N;
            switch (result.alu) {
            case 0:   // add with carry
                result.alu_cmd = 4 + result.cin;
                break;
            case 1:   // and
                result.alu_cmd = 0;
                break;
            case 2:   // orr
                result.alu_cmd = 1;
                break;
            case 3:   // eor
                result.alu_cmd = 2;
                break;
            default:
                throw 'Unsupported ALU operation';
                break;
            }
            if (result.flags) {
                result.pstate_en = 1;
                result.pstate_mux = 0;
            }
            result.ex_out_mux = 1;  // alu output
            break;

        case 'b':
            result.br_condition_mux = 1;   // unconditional branch
            result.next_PC_mux = 0;
            result.PC_add_op_mux = 1;
            // route PC and offset to pc_addr inputs in case branch is taken
            result.fex_n_mux = 0;  // pc
            result.fex_m_mux = 0;  // immediate
            if (result.x === 1) {  // bl
                result.ex_out_mux = 0;  // ID_PC
                result.rd_addr = 30;
                result.write_en = 1;
            }
            break;

        case 'bcc':
            // condition to check for is encoded in result.c
            result.br_condition_mux = 0;   // branch if pstate_match
            result.next_PC_mux = 0;
            result.PC_add_op_mux = 1;
            // route PC and offset to pc_addr inputs in case branch is taken
            result.fex_n_mux = 0;  // pc
            result.fex_m_mux = 0;  // immediate
            break;

        case 'bfm':
            result.alu_op_a_mux = (result.x == 1) ? 2 : 0;   // ex_n for BFM, else 0
            result.barrel_lo_mux = 0;  // ex_n
            result.barrel_hi_mux = 0;  // ex_n
            result.barrel_op = 3;      // ror
            result.shamt = result.ror;
            result.wtmask = 1;         // uses result.maskn from decode
            if (result.sxtsz > 0) {
                result.bitext_sign_ext = 1;
                result.imm_sz = result.sxtsz;
            }
            result.alu_op_b_mux = 0;   // shift/mask/sxt
            result.alu_cmd = 1;        // orr
            result.ex_out_mux = 1;     // alu output
            break;

        case 'br':
            result.next_PC_mux = 1;     // ex_n
            if (result.x === 1) { // bl
                result.ex_out_mux = 0;  // ID_PC
                result.rd_addr = 30;
                result.write_en = 1;
            }
            break;

        case 'cc':  // CCMN/CCMP
            if (result.y) {  // imm instead of Rm
                result.read_reg_am = undefined;
                result.read_m_valid = 0;
                result.i = BigInt(result.m);
                result.fex_m_mux = 0;  // imm
                result.barrel_lo_mux = 1 // imm (ex_m)
                result.barrel_hi_mux = 1 // same as lo
                result.barrel_op = 0;   // LSL #0
                result.original_shamt = result.shamt;
                result.shamt = 0n;
                result.read_m_valid = 0;
            }
            if (result.x) {  // CCMP
                result.alu_invert_b = 1; // compute ex_n - em_m
                result.alu_cmd = 5;
            } else {         // CCMN
                result.alu_cmd = 4;    // compute ex_n - (~ex_m)
            }
            result.pstate_mux = 2;     // pmatch ? alu_nzvc : imm
            result.pstate_en = 1;
            break;

        case 'cs': // CSEL, CSINC, CSINV, CSNEG
            result.alu_op_a_mux = 0;   // zero
            result.alu_invert_b = (result.x & 0x2) ? 1 : 0;  // invert for CSINV/CSNEG
            result.alu_cmd = (result.x & 0x1) ? 5 : 1;  // add+1 for CSINC/CSNEG, else orr
            result.ex_out_mux = 2;     // cond
            break;

        case 'extr':
            result.barrel_lo_mux = 1;  // ex_m
            result.barrel_hi_mux = 0;  // ex_n
            result.barrel_op = 3;      // ror
            result.shamt = result.j;
            result.alu_op_a_mux = 0;   // zero
            result.alu_cmd = 1;        // orr
            result.ex_out_mux = 1;     // alu output
            break;

        case 'hlt':
            // just like nop, so nothing to do :)
            break;

        case 'ldr_literal':
            result.fex_n_mux = 0;  // PC
            result.fex_m_mux = 0;  // imm
            result.FnH = this.mask64;   // 64-bit arithmetic
            result.barrel_op = 0;  // LSL #0
            result.shamt = 0n;
            result.barrel_lo_mux = 1;  // ex_m
            result.barrel_hi_mux = 1;  // same as lower
            result.wtmask = 0;     // no masking
            result.bitext_sign_ext = 0;  // no sxt
            result.alu_op_a_mux = 2;  // ex_n (ie, the PC)
            result.alu_op_b_mux = 0;  // shift/mask/sxt
            result.alu_invert_b = 0;  // don't invert alu op b
            result.alu_cmd = 4;  // add
            result.ex_out_mux = 1;  // alu output
            result.mem_read = 1;
            result.mem_addr_mux = 0;  // from mem_ex_out
            result.mem_load_FnH = result.vmask;
            result.mem_size = (result.z === 1) ? 64 : 32;
            result.mem_sign_ext = (result.x === 1);
            if (result.dest != 32) {
                result.wload_en = 1;
                result.rt_addr = result.dest;
                // undo defaults set above
                result.write_en = 0;
                result.rd_addr = undefined;
            }
            break;

        case 'ldst':
            // compute the memory address
            result.write_en = 0;    // undo default action when Rd is present
            if (result.osel <= 2) { // immediate offset
                // route to alu_op_b
                result.fex_m_mux = 0; // load ex_m with immediate field
                result.barrel_lo_mux = 1;  // ex_m
                result.barrel_hi_mux = 1;  // same as lower
                result.barrel_op = 0; // LSL #0
                result.shamt = 0n;
                result.imm_sz = 64;
                // use ex_n for post_index, otherwise use ALU output
                result.mem_addr_mux = (result.osel === 2) ? 1 : 0;
                // update base register value for pre- and post-index
                if (result.osel !== 0) {
                    result.write_en = 1;
                    result.rd_addr = result.n; // up
                } else {
                    result.write_en = 0;
                    result.rd_addr = undefined;
                }
            } else {  // register offset
                result.shamt = result.original_shamt;  // recover from Rm hackery above
                result.bitext_sign_ext = (result.osel == 5) ? 1 : 0;  // sxtw
                // result.shamt gives amount to left shift offset register
                // compute size of shifted offset register
                result.imm_sz = (result.osel & 1) ? 32 + Number(result.shamt) : 64;
                // use ex_n for post_index, otherwise use ALU output
                result.mem_addr_mux = 0;
            }
            // use alu to compute base+offset, send to MEM stage
            result.alu_op_b_mux = 0;
            result.alu_invert_b = 0;  // don't invert alu op b
            result.alu_cmd = 4;  // add base and offset
            result.ex_out_mux = 1;  // alu output to MEM stage
            // MEM and WB control signals
            result.mem_size = 8 << result.z;
            if (result.s === 0) { // memory write
                if (result.dest === 33) {   // destination === xzr?
                    result.read_a_valid = 0;
                    result.read_reg_aa = 31;
                } else {
                    result.read_a_valid = 1;
                    result.read_reg_aa = result.dest;
                }
                result.mem_write = 1;  // memory write
            } else {   // memory read
                result.mem_read = 1;
                result.mem_sign_ext = (result.s >= 2) ? 1 : 0;   // ldrs
                result.mem_load_FnH = result.vmask;
                if (result.dest !== 33) {   // Rt is not *zr
                    result.wload_en = 1;
                    result.rt_addr = result.dest;
                }
            }
            break;

        case 'movx':
            result.fex_m_mux = 0;  // imm
            result.FnH = result.vmask;
            result.barrel_lo_mux = 1;  // ex_m
            result.barrel_hi_mux = 1;  // same as lower
            result.barrel_op = 0;  // LSL
            result.shamt = BigInt(result.s * 16);
            result.i >>= result.shamt;  // undo already-completed shift!
            result.alu_op_b_mux = 0;
            result.alu_cmd = 1;  // orr
            switch (result.x) {
            case 0:  // movn
                result.alu_op_a_mux = 0;   // zero
                result.alu_invert_b = 1;   // complement immediate value
                break;
            case 2:  // movz
                result.alu_op_a_mux = 0;   // zero
                break;
            case 3:  // movk
                // arrange to read Rd using Ra port
                if (result.dest === 32) {
                    result.read_a_valid = 0;
                    result.read_reg_aa = 31;
                } else {
                    result.read_a_valid = 1;
                    result.read_reg_aa = result.dest;
                }
                result.alu_op_a_mux = 1;   // ex_a
                result.wtmask = 1;         // bit clear alu_op_a (using maskn)
                break;
            }
            result.ex_out_mux = 1;  // alu output
            break;

        case 'nop':
            // nothing to do :)
            break;

        case 'sysreg':
            if (result.x) { // MRS  (system reg -> reg[d] -> system reg)
                result.ex_out_mux = 3;  // pstate as 64 bits
            } else {        // MSR  (reg[a] -> system reg)
                // use A port to read data
                if (result.dest === 33) {   // destination === xzr?
                    result.read_a_valid = 0;
                    result.read_reg_aa = 31;
                } else {
                    result.read_a_valid = 1;
                    result.read_reg_aa = result.dest;
                }
                result.pstate_mux = 1  // select ex_a[31:28]
                result.pstate_en = 1;
                result.rd_addr = undefined;  // undo defaults from above
                result.write_en = 0;
            }
            break;

        default:
            throw `Unsupported instruction class in disassemble_inst: ${result.iclass}`;
        }

        return result;
    }

    static template_simulator_display = `
<style>
  #datapath { width: 100%; border-collapse: collapse; }
  .stage { font: 10pt monospace; padding-top: 3px;}
  .slabel { font: 12pt sanserif; border-top: 0.5px solid black; padding-right: 0.5em; text-align: center; }
  .reg  { min-width: 150px; border: 0.5px solid black; background-color: #DDD; text-align: center; }
  .regx { min-width: 150px; border: 0.5px solid black; text-align: center; background-color: #EFE; overflow: hidden; white-space: nowrap; }
  .regv { min-width: 150px; font: 10pt monospace; text-align: center; }
  .rega { min-width: 150px; font: 10pt monospace; text-align: center; line-height: 6px; }
  .regi { min-width: 150px; font: 10pt monospace; text-align: center; overflow: hidden; white-space: nowrap; }
  .regd { min-width: 150px; font: 10pt monospace; overflow: hidden; white-space: nowrap;}
 </style>
<div id="simulator-display" style="flex: 1 1 auto; display: flex; overflow: auto;">
  <div style="flex: 0 0 auto; display: flex; flex-direction: column; overflow: auto;">
    <div class="cpu_tool-banner">Registers</div>
    <div class="cpu_tool-pane" id="registers" style="font: 9pt monospace; line-height: 7pt;"></div>
    <div class="cpu_tool-banner" style="margin-top: 3px;">Memory</div>
    <div class="cpu_tool-pane" id="memory" style="flex: 1 1 auto; font: 9pt monospace; line-height: 7pt; overflow-y:scroll; min-height: 50px;"></div>
  </div>
  <div style="flex: 1 1 auto; display: flex; flex-direction: column; margin-left: 3px;">
    <div class="cpu_tool-banner">Datapath</div>
    <div id="datapath" class="cpu_tool-pane" style="flex: 1 1 auto; overflow:auto; padding: 5px;">
      <table border="0" cellpadding="3" style="width: 100%;">
        <tr><td></td><td class="stage" id="dp-pre-IF"></td></tr>
        <tr><td class="slabel">IF</td><td class="stage" id="dp-IF"></td></tr>
        <tr><td class="slabel">ID</td><td class="stage" id="dp-ID"></td></tr>
        <tr><td class="slabel">EX</td><td class="stage" id="dp-EX"></td></tr>
        <tr><td class="slabel">MEM</td><td class="stage" id="dp-MEM"></td></tr>
        <tr><td class="slabel">WB</td><td class="stage" id="dp-WB"></td></tr>
      </table>
      <p id="previous-insts"></p>
    </div>
  </div>
</div>
`;

    cpu_gui_setup() {
        const gui = this;

        // "Assemble" action button
        this.add_action_button('Assemble', function () { gui.assemble(); });

        // set up simulation panes
        this.right.innerHTML = this.template_simulator_header + SimTool.ASimPipelined.template_simulator_display;
        this.cpu_gui_simulation_controls();

        this.update_display = this.update_datapath_diagram; 
    }

    fill_in_simulator_gui() {
        this.right.focus();

        let table;

        // fill in register display
        table = ['<table cellspacing="3" border="0">'];
        for (let reg = 0; reg < 31; reg += 1)
            table.push(`<tr><td class="cpu_tool-addr">x${reg}</td><td id="r${reg}">0000000000000000</td></tr>`);
        table.push('<tr><td class="cpu_tool-addr">sp</td><td id="r31">0000000000000000</td></tr>');
        table.push('<tr><td class="cpu_tool-addr">nzcv</td><td id="nzcv">0000</td></tr>');
        table.push('</table>');
        document.getElementById('registers').innerHTML = table.join('\n');

        // fill in memory display
        const asize = Math.ceil(Math.log2(this.memory.byteLength)/4);  // digits for memory address
        table = ['<table cellspacing="3" border="0">'];
        for (let addr = 0; addr < this.memory.byteLength; addr += 8) {
            table.push(`<tr><td class="cpu_tool-addr">${this.hexify(addr,asize)}</td><td id="m${addr}">${this.location(addr,64)}</td></tr>`);
        }
        table.push('</table>');
        document.getElementById('memory').innerHTML = table.join('\n');
    }

    update_tabular_display() {
        const dp = this.dp;
        const inst = dp.id_inst;
        const einst = dp.ex_inst;
        const minst = dp.mem_inst;
        const winst = dp.wb_inst;

        document.getElementById('dp-pre-IF').innerHTML = `
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td class="regv">${einst.next_PC_mux ? 'ex_n' : (einst.PC_add_op_mux & dp.branch_taken) ? 'ex_n + en_m' : 'if_pc + 4'}</td>
    <td class="regd"><i>mux select</i></td>
  </tr>
  <tr>
    <td class="regv">${this.hexify(dp.next_if_pc,16)}</td>
    <td></td>
  </tr>
  <tr>
    <td class="rega">&darr;</td>
    <td></td>
  </tr>
</table>
`;

        document.getElementById('dp-IF').innerHTML = `
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td class="reg">IF_PC</td>
    <td class="regd"></td>
    <td class="regd"></td>
    <td class="regv"></td>
  </tr>
  <tr>
    <td class="regx">${this.hexify(dp.if_pc,16)}</td>
    <td class="regv" colspan="2">Mem[${dp.if_pc.toString(16)}]&rarr;${this.hexify(dp.next_id_inst.inst,8)}</td>
    <td class="regi">${dp.next_id_inst.assy}</td>
  </tr>
  <tr>
    <td class="rega">&darr;</td>
    <td class="rega"></td>
    <td class="rega"></td>
    <td class="rega">&darr;</td>
  </tr>
</table>
`;

        document.getElementById('dp-ID').innerHTML = `
<table border="0" cellpadding="0" cellspacing="0">
  <tr valign="top">
    <td class="reg">ID_PC</td>
    <td class="regv" rowspan="3" colspan="2" style="min-width: 300px;">
       ${dp.bubble ? '<span style="color: red;">bubble (taken branch)</span><br>' : ''}
       ${dp.stall ? '<span style="color: red;">stall (await memory read)</span><br>' : ''}
       ${dp.an===undefined?'':'<span style="margin-top: .3em; margin-right: .3em;">Rn['+dp.an+']&rarr;'+this.hexify(dp.id_n,16)+'</span><br>'}
       ${dp.am===undefined?'':'<span style="margin-right: .3em;">Rm['+dp.am+']&rarr;'+this.hexify(dp.id_m,16)+'</span><br>'}
       ${dp.aa===undefined?'&nbsp;':'<span style="margin-right: .3em;">Ra['+dp.aa+']&rarr;'+this.hexify(dp.id_a,16)+'</span>'}
    </td>
    <td class="reg">ID_INST</td>
  </tr>
  <tr valign="top">
    <td class="regx">${this.hexify(dp.id_pc,16)}</td>
    <td class="regx">${inst.assy}</td>
  </tr>
  <tr valign="top">
    <td class="regd">&nbsp;</td>
    <td class="regd">&nbsp;</td>
  </tr>
</table>
<table border="0" cellpadding="0" cellspacing="0" style="padding-top: 1em;">
  <tr>
    <td class="regv">${dp.fex_n_mux}</td>
    <td class="regv">${dp.fex_m_mux}</td>
    <td class="regv"></td>
    <td class="regd"><i>mux select</i></td>
  <tr>
    <td class="regv">${this.hexify(dp.next_fex_n,16)}</td>
    <td class="regv">${this.hexify(dp.next_fex_m,16)}</td>
    <td class="regv">${this.hexify(dp.next_fex_a,16)}</td>
    <td class="regd"></td>
  </tr>
  <tr>
    <td class="rega">&darr;</td>
    <td class="rega">&darr;</td>
    <td class="rega">&darr;</td>
    <td class="rega"></td>
  </tr>
</table>
`;

        document.getElementById('dp-EX').innerHTML = `
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td class="reg">FEX_n</td>
    <td class="reg">FEX_m</td>
    <td class="reg">FEX_a</td>
    <td class="reg">EX_INST</td>
  </tr>
  <tr>
    <td class="regx">${this.hexify(dp.fex_n,16)}</td>
    <td class="regx">${this.hexify(dp.fex_m,16)}</td>
    <td class="regx">${this.hexify(dp.fex_a,16)}</td>
    <td class="regx">${einst.assy}</td>
  </tr>
  <tr>
    <td class="regv">${dp.n_bypass}</td>
    <td class="regv">${dp.m_bypass}</td>
    <td class="regv">${dp.a_bypass}</td>
    <td class="regd"></td>
  </tr>
  <tr>
    <td class="regv">${this.hexify(dp.ex_n,16)}</td>
    <td class="regv">${this.hexify(dp.ex_m,16)}</td>
    <td class="regv">${this.hexify(dp.ex_a,16)}</td>
    <td class="regd"><i>after forwarding</i></td>
  </tr>
</table>
<div style="white-space: pre; font: 10pt monospace;">
cc-check:      ${einst.c !== undefined ? 'condition: '+dp.cc_check+', match: '+dp.pstate_match : '-'}
barrel_in:     ${this.hexify(dp.barrel_in_hi,16)}:${this.hexify(dp.barrel_in_lo,16)} ${dp.barrel_mux}
barrel_out:    ${this.hexify(dp.barrel_out,16)} ${dp.barrel_cmd}
alu_op_a:      ${this.hexify(dp.alu_op_a,16)} ${dp.alu_a_sel}
alu_op_b:      ${this.hexify(dp.alu_op_b,16)} ${dp.alu_b_sel}
alu_out:       ${this.hexify(dp.alu_out,16)} ${dp.alu_cmd}
next_nzcv:     ${dp.next_nzcv.toString(2).padStart(4,'0')}             ${dp.nzcv_mux}

</div>
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td class="regv">${dp.ex_out_sel}</td>
    <td class="regv"></td>
    <td class="regv"></td>
    <td class="regd"><i>mux select</i></td>
  </tr>
  <tr>
    <td class="regv">${this.hexify(dp.next_mem_ex_out,16)}</td>
    <td class="regv">${this.hexify(dp.next_mem_n,16)}</td>
    <td class="regv">${this.hexify(dp.next_mem_a,16)}</td>
    <td class="regv"></td>
  </tr>
  <tr>
    <td class="rega">&darr;</td>
    <td class="rega">&darr;</td>
    <td class="rega">&darr;</td>
    <td class="rega"></td>
  </tr>
</table>
</div>
`;

        document.getElementById('dp-MEM').innerHTML = `
<table border="0"cellpadding="0" cellspacing="0">
  <tr>
    <td class="reg">MEM_EX_out</td>
    <td class="reg">MEM_n</td>
    <td class="reg">MEM_a</td>
    <td class="reg">MEM_inst</td>
  </tr>
  <tr>
    <td class="regx">${this.hexify(dp.mem_ex_out,16)}</td>
    <td class="regx">${this.hexify(dp.mem_n,16)}</td>
    <td class="regx">${this.hexify(dp.mem_a,16)}</td>
    <td class="regx">${minst.assy}</td>
  </tr>
</table>
<div style="text-align: center; font: 10pt monospace; margin-top: 10px;">
  ${minst.mem_read ? 'Mem['+dp.mem_VA.toString(16)+']&rarr;'+this.hexify(dp.next_wb_mem_out,16) : ''}
  ${minst.mem_write ? dp.mem_wdata_mux+' '+this.hexify(dp.mem_wdata,16)+'&rarr;Mem['+dp.mem_VA.toString(16)+']' : ''}<br>
</div>
<table cellpadding="0" cellspacing="0">
  <tr>
    <td class="regv">${this.hexify(dp.next_wb_ex_out,16)}</td>
    <td class="regv">${this.hexify(dp.next_wb_mem_out,16)}</td>
  </tr>
  <tr>
    <td class="rega">&darr;</td>
    <td class="rega">&darr;</td>
  </tr>
</table>
`;
        
        document.getElementById('dp-WB').innerHTML = `
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td class="reg">WB_EX_out</td>
    <td class="reg">WB_MEM_out</td>
    <td class="regd"></td>
    <td class="reg">WB_inst</td>
  </tr>
  <tr>
    <td class="regx">${this.hexify(dp.wb_ex_out,16)}</td>
    <td class="regx">${this.hexify(dp.wb_mem_out,16)}</td>
    <td class="regd"></td>
    <td class="regx">${winst.assy}</td>
  </tr>
  <tr>
    <td class="rega"></td>
    <td class="rega">&darr;</td>
    <td class="rega"></td>
    <td class="rega"></td>
  </tr>
  <tr>
    <td class="regv"></td>
    <td class="regv">${this.hexify(dp.wb_mem_out_sxt,16)}</td>
    <td class="regd"><i>WB_MEM_sxt</i></td>
    <td class="regv"></td>
  </tr>
<table>
<div style="text-align: center; font: 10pt monospace; margin-top: 10px;">
  ${winst.write_en ? this.hexify(dp.wb_ex_out,16)+'&rarr;Rd['+winst.rd_addr+']' : '&nbsp;'}<br>
  ${winst.wload_en ? this.hexify(dp.wb_mem_out_sxt,16)+'&rarr;Rt['+winst.rt_addr+']' : '&nbsp;'}<br>
</div>
`;

        const inst_list = []
        for (let inst of dp.previous_insts) {
            let loc = this.source_map[inst.pa/4];
            if (loc) {
                loc = loc.start[0] + ':' + loc.start[1];
            } else loc = '-';
            inst_list.push(`<li>[${loc}] ${inst.assy}</li>`);
        }
        document.getElementById('previous-insts').innerHTML = `
Recent previous instructions (most recent last):<ul>${inst_list.join('\n')}</ul>
`;
    }

    emulation_reset() {
        // handle any remaining initialization
        if (this.dp === undefined) {
            this.dp = { register_file: new Array(32), previous_insts: [] };
            xdp = this.dp;  // global var for ease of access
            this.nop_inst = this.disassemble_inst(0b11010101000000110010000000011111);
            this.nop_inst.assy = 'nop*';
            this.hlt_inst = this.disassemble_inst(0b11010100010111111111111111100000);  // HLT #0xFFFF
        }

        if (this.assembler_memory !== undefined) {
            this.memory.load_bytes(this.assembler_memory);
            if (this.inst_decode === undefined ||
                this.inst_decode.length != this.assembler_memory.byteLength/4)
                this.inst_decode = Array(this.assembler_memory.byteLength/4);  
        }

        this.memory.reset(this.caches);   // reset cache models
        this.ncycles = 0;

        const dp = this.dp;
        dp.register_file.fill(0n);
        dp.previous_insts.length = 0;
        dp.nzcv = 0;
        dp.halt = undefined;

        // IF state
        dp.if_pc = 0n;

        // ID state
        dp.id_pc = undefined;
        dp.id_inst = this.nop_inst;

        // EX state
        dp.fex_n = undefined;
        dp.fex_m = undefined;
        dp.fex_a = undefined;
        dp.ex_inst = this.nop_inst;

        // MEM state
        dp.mem_n = undefined;
        dp.mem_ex_out = undefined;
        dp.mem_a = undefined;
        dp.mem_inst = this.nop_inst;

        // WB state
        dp.wb_ex_out = undefined;
        dp.wb_mem_out = undefined;
        dp.wb_inst = this.nop_inst;

        // propagate new state through each pipeline stage
        if (this.assembler_memory !== undefined) {
            this.pipeline_propagate(true);
            this.update_display();
            this.next_pc(0);
        }
    }

    clear_highlights() {
        // no highlights yet!
    }

    // execute a single instruction
    emulation_step(update_display) {
        if (update_display) this.clear_highlights();

        this.pipeline_clock(update_display);
        this.pipeline_propagate(update_display);

        // keep track of previous 5 instructions (most recent last)
        const dp = this.dp
        while (dp.previous_insts.length > 4) dp.previous_insts.shift();
        dp.previous_insts.push(dp.ex_inst);

        if (update_display) {
            this.update_display();
            this.next_pc();
        }
    }

    // simulate internal logic of each pipeline stage
    pipeline_propagate(update_display) {
        const dp = this.dp;
        const inst = dp.id_inst;
        const einst = dp.ex_inst;
        const minst = dp.mem_inst;
        const winst = dp.wb_inst;

        //////////////////////////////////////////////////
        // Hazard detection
        //////////////////////////////////////////////////

        // check for HLT in EX stage
        if (einst.opcode === 'hlt') dp.halt = true;

        // compute pstate_match (needed for conditional branches)
        if (einst.c !== undefined) {
            const N = (dp.nzcv & 0b1000) !== 0;
            const Z = (dp.nzcv & 0b0100) !== 0;
            const C = (dp.nzcv & 0b0010) !== 0;
            const V = (dp.nzcv & 0b0001) !== 0;
            switch (einst.c) {
            case 0b0000:
                dp.pstate_match = Z;
                dp.cc_check = 'EQ';
                break;
            case 0b0001:
                dp.pstate_match = !Z;
                dp.cc_check = 'NE';
                break;
            case 0b0010:
                dp.pstate_match = C;
                dp.cc_check = 'CS';
                break;
            case 0b0011:
                dp.pstate_match = !C;
                dp.cc_check = 'CC';
                break;
            case 0b0100:
                dp.pstate_match = N;
                dp.cc_check = 'MI';
                break;
            case 0b0101:
                dp.pstate_match = !N;
                dp.cc_check = 'PL';
                break;
            case 0b0110:
                dp.pstate_match = V;
                dp.cc_check = 'VS';
                break;
            case 0b0111:
                dp.pstate_match = !V;
                dp.cc_check = 'VC';
                break;
            case 0b1000:
                dp.pstate_match = (!Z & C);
                dp.cc_check = 'HI';
                break;
            case 0b1001:
                dp.pstate_match = (Z | !C);
                dp.cc_check = 'LS';
                break;
            case 0b1010:
                dp.pstate_match = (N === V);
                dp.cc_check = 'GE';
                break;
            case 0b1011:
                dp.pstate_match = (N !== V);
                dp.cc_check = 'LT';
                break;
            case 0b1100:
                dp.pstate_match = ((N === V) & !Z);
                dp.cc_check = 'GT';
                break;
            case 0b1101:
                dp.pstate_match = ((N !== V) | Z);
                dp.cc_check = 'LE';
                break;
            case 0b1110:
                dp.pstate_match = 1;
                dp.cc_check = 'AL';
                break;
            case 0b1111:
                dp.pstate_match = 0;
                dp.cc_check = 'NV';
                break;
            default:
                dp.pstate_match = 0;
                dp.cc_check = '-';
            }
        } else {
            dp.cc_check = '-';
            dp.pstate_match = 0;
        }

        // determine if EX stage is executing a taken branch.
        // If so, discard the instructions in the IF and ID stages.
        dp.branch_taken = einst.br_condition_mux || dp.pstate_match;
        dp.bubble = einst.next_PC_mux || (einst.PC_add_op_mux && dp.branch_taken);

        // if we're trying to read a register whose contents come from
        // a memory read in the EX stage, we need to stall IF and ID stages
        // for one cycle...
        dp.stall = !dp.bubble && einst.wload_en &&
            ((inst.read_n_valid && (inst.read_reg_an == einst.rt_addr)) ||
             (inst.read_m_valid && (inst.read_reg_am == einst.rt_addr)) ||
             (inst.read_a_valid && (inst.read_reg_aa == einst.rt_addr) && !inst.mem_write));

        //////////////////////////////////////////////////
        // WB stage
        //////////////////////////////////////////////////

        if (winst.mem_read) {
            // deal with data size and sign extension on memory reads
            let data = dp.wb_mem_out;
            data = winst.mem_sign_ext ?
                BigInt.asIntN(winst.mem_size,data) :
                BigInt.asUintN(winst.mem_size,data);
            dp.wb_mem_out_sxt = data & winst.mem_load_FnH;
        } else dp.wb_mem_out_sxt = undefined;
        
        dp.rt_write = winst.wload_en;  // for display
        dp.rt_addr = winst.rt_addr;
        dp.rd_write = winst.write_en;  // for display
        dp.rd_addr = winst.rd_addr;

        //////////////////////////////////////////////////
        // MEM stage
        //////////////////////////////////////////////////

        dp.mem_read = minst.mem_read;    // for state display
        dp.mem_write = minst.mem_write;
        if (minst.mem_write || minst.mem_read) {
            dp.mem_VA = minst.mem_addr_mux ? dp.mem_n : dp.mem_ex_out;
            dp.mem_PA = this.va_to_phys(dp.mem_VA);

            if (minst.mem_write) {
                // forward write data (in Xa) from WB stage?
                if (winst.wload_en && (minst.read_reg_aa === winst.rt_addr)) {
                    dp.mem_wdata = dp.wb_mem_out_sxt;
                    dp.mem_wdata_mux = '[WB_MEM_sxt]';
                } else {
                    dp.mem_wdata = dp.mem_a;
                    dp.mem_wdata_mux = '[MEM_a]';
                }
            } else dp.mem_wdata = undefined;

        } else {
            dp.mem_VA = undefined;
            dp.mem_PA = undefined;
            dp.mem_wdata = undefined;
        }

        // compute next values for MEM/WB pipeline registers
        if (minst.mem_read) {
            switch (minst.mem_size) {
            case 8:
                dp.next_wb_mem_out = this.memory.read_biguint8(dp.mem_PA);
                break;
            case 16:
                dp.next_wb_mem_out = this.memory.read_biguint16(dp.mem_PA);
                break;
            case 32:
                dp.next_wb_mem_out = this.memory.read_biguint32(dp.mem_PA);
                break;
            case 64:
                dp.next_wb_mem_out = this.memory.read_biguint64(dp.mem_PA);
                break;
            }
            //dp.next_wb_mem_out = this.memory.read_bigint64(dp.mem_PA);
        } else dp.next_wb_mem_out = undefined;
        dp.next_wb_ex_out = dp.mem_ex_out;
        dp.next_wb_inst = minst;

        //////////////////////////////////////////////////
        // EX stage
        //////////////////////////////////////////////////

        // bypass from MEM and WB stages if necessary
        if (!einst.read_n_valid) {
            dp.ex_n = dp.fex_n;
            dp.n_bypass = '&darr;';
        } else if (minst.write_en && (minst.rd_addr === einst.read_reg_an)) {
            dp.ex_n = dp.mem_ex_out & einst.FnH;
            dp.n_bypass = 'MEM_EX_out&rarr;';
        } else if (winst.write_en && (winst.rd_addr === einst.read_reg_an)) {
            dp.ex_n = dp.wb_ex_out & einst.FnH;
            dp.n_bypass = 'WB_EX_out&rarr;';
        } else if (winst.wload_en && (winst.rt_addr === einst.read_reg_an)) {
            dp.ex_n = dp.wb_mem_out_sxt & einst.FnH;
            dp.n_bypass = 'WB_MEM_sxt&rarr;';
        } else {
            dp.ex_n = dp.fex_n;
            dp.n_bypass = '&darr;';
        }

        if (!einst.read_m_valid) {
            dp.ex_m = dp.fex_m;
            dp.m_bypass = '&darr;';
        } else if (minst.write_en && (minst.rd_addr === einst.read_reg_am)) {
            dp.ex_m = dp.mem_ex_out & einst.FnH;
            dp.m_bypass = 'MEM_EX_out&rarr;';
        } else if (winst.write_en && (winst.rd_addr === einst.read_reg_am)) {
            dp.ex_m = dp.wb_ex_out & einst.FnH;
            dp.m_bypass = 'WB_EX_out&rarr;';
        } else if (winst.wload_en && (winst.rt_addr === einst.read_reg_am)) {
            dp.ex_m = dp.wb_mem_out_sxt & einst.FnH;
            dp.m_bypass = 'WB_MEM_sxt&rarr;';
        } else {
            dp.ex_m = dp.fex_m;
            dp.m_bypass = '&darr;';
        }

        if (!einst.read_a_valid) {
            dp.ex_a = dp.fex_a;
            dp.a_bypass = '&darr;';
        } else if (minst.write_en && (minst.rd_addr === einst.read_reg_aa)) {
            dp.ex_a = dp.mem_ex_out & einst.FnH;
            dp.a_bypass = 'MEM_EX_out&rarr;';
        } else if (winst.write_en && (winst.rd_addr === einst.read_reg_aa)) {
            dp.ex_a = dp.wb_ex_out & einst.FnH;
            dp.a_bypass = 'WB_EX_out&rarr;';
        } else if (winst.wload_en && (winst.rt_addr === einst.read_reg_aa)) {
            dp.ex_a = dp.wb_mem_out_sxt & einst.FnH;
            dp.a_bypass = 'WB_MEM_sxt&rarr;';
        } else {
            dp.ex_a = dp.fex_a;
            dp.a_bypass = '&darr;';
        }

        const sz = (einst.FnH === this.mask64) ? 64 : 32;

        // barrel shifter
        if (einst.barrel_op !== undefined) {
            dp.barrel_in_lo = einst.barrel_lo_mux ? dp.ex_m : dp.ex_n;
            dp.barrel_in_hi = einst.barrel_hi_mux ? dp.barrel_in_lo : dp.ex_n;
            dp.barrel_mux = einst.barrel_lo_mux ?
                (einst.barrel_hi_mux ? '[ex_m:ex_m]' : '[ex_n:ex_m]') :
                (einst.barrel_hi_mux ? '[ex_n:ex_n]' : '[ex_n:ex_n]');

            switch(einst.barrel_op) {
            case 0: // LSL
                dp.barrel_cmd = `[LSL #${einst.shamt || 0}]`;
                dp.barrel_out = (dp.barrel_in_lo << einst.shamt) & einst.FnH;
                break;
            case 1: // LSR
                dp.barrel_cmd = `[LSR #${einst.shamt || 0}]`;
                dp.barrel_out = (dp.barrel_in_lo >> einst.shamt) & einst.FnH;
                break;
            case 2: // ASR
                dp.barrel_cmd = `[ASR #${einst.shamt || 0}]`;
                dp.barrel_out = (BigInt.asIntN(sz,dp.barrel_in_lo) >> einst.shamt) & einst.FnH;
                break;
            case 3: // ROR
                dp.barrel_cmd = `[ROR #${einst.shamt || 0}]`;
                // triggers some sort of bug if I try to do it in one expression?!
                //dp.barrel_out == (((dp.barrel_in_hi << BigInt(sz)) | dp.barrel_in_lo) >> einst.shamt) & einst.FnH;
                let temp = (dp.barrel_in_hi << BigInt(sz));
                temp |= dp.barrel_in_lo;
                temp >>= einst.shamt;
                temp &= einst.FnH;
                dp.barrel_out = temp;
                break;
            }
        } else {
            dp.barrel_cmd = '';
            dp.barrel_in_lo = undefined;
            dp.barrel_in_hi = undefined;
            dp.barrel_out = undefined;
            dp.barrel_mux = '';
        }

        // masking and bit extender
        let bitext_out = dp.barrel_out;
        if (bitext_out !== undefined) {
            if (einst.wtmask) bitext_out &= (einst.maskn & einst.FnH);
            if (einst.bitext_sign_ext) bitext_out = BigInt.asIntN(einst.imm_sz, bitext_out) & einst.FnH;
            else bitext_out = BigInt.asUintN(einst.imm_sz, bitext_out);
        }

        // alu operands
        if (einst.alu_op_a_mux === 2) {
            dp.alu_op_a = dp.ex_n;
            dp.alu_a_sel = '[ex_n]';
        } else if (einst.alu_op_a_mux === 1) {
            dp.alu_op_a = dp.ex_a;
            dp.alu_a_sel = '[ex_a]';
        } else if (einst.alu_op_a_mux === 0) {
            dp.alu_op_a = 0n;
            dp.alu_a_sel = '[zero]';
        } else {
            dp.alu_op_a = undefined;
            dp.alu_a_sel = '';
        }
        if (einst.wtmask) dp.alu_op_a &= (~einst.maskn & einst.FnH);

        if (einst.alu_op_b_mux === 0) {
            dp.alu_op_b = bitext_out;
            dp.alu_b_sel = '[shift/mask/sxt]';
        } else if (einst.alu_op_b_mux === 1) {
            dp.alu_op_b = einst.i;
            dp.alu_b_sel = '[wmask]';
        } else {
            dp.alu_op_b = undefined;
            dp.alu_b_sel = '';
        }

        // alu 
        let alu_result, cin;
        const xalu_op_b = einst.alu_invert_b ? (~dp.alu_op_b & einst.FnH) : dp.alu_op_b;
        if (einst.alu_cmd === undefined) {
            dp.alu_out = undefined;
            dp.alu_cmd = '';
        } else {
            switch (einst.alu_cmd) {
            case 0:  // and
            case 3:  // ands
                alu_result = dp.alu_op_a & xalu_op_b;
                dp.alu_cmd = einst.alu_invert_b ? '[bic]' : '[and]';
                break;
            case 1:  // orr
                alu_result = dp.alu_op_a | xalu_op_b;
                dp.alu_cmd = einst.alu_invert_b ? '[orn]' : '[orr]';
                break;
            case 2:  // eor
                alu_result = dp.alu_op_a ^ xalu_op_b;
                dp.alu_cmd = einst.alu_invert_b ? '[eon]' : '[eor]';
                break;
            case 4:  // add (cin = 0)
                cin = 0n;
                alu_result = dp.alu_op_a + xalu_op_b;
                dp.alu_cmd = '[add]';
                break;
            case 5:  // add (cin = 1)
                cin = 1n;
                alu_result = dp.alu_op_a + xalu_op_b + 1n;
                dp.alu_cmd = '[sub]';
                break;
            case 6:  // add (cin = PSTATE[C])
                cin = (dp.nzcv & 0b0010) ? 1n : 0n;
                alu_result = dp.alu_op_a + xalu_op_b + cin;
                dp.alu_cmd = einst.alu_invert_b ? '[sbc]' : '[adc]';
                break;
            }
            dp.alu_out = alu_result & einst.FnH;
        }

        // alu NZCV flags (only computed when they're being looked at)
        if (einst.pstate_mux === 0 || einst.pstate_mux === 2) {
            dp.alu_nzcv = 0;
            if (BigInt.asIntN(sz, dp.alu_out) < 0) dp.alu_nzcv |= 8;
            if (dp.alu_out === 0n) dp.alu_nzcv |= 4;
            if (einst.alu_cmd >= 4) {
                // NB: alu_result is unsigned sum
                if (dp.alu_out !== alu_result) dp.alu_nzcv |= 0x2;
                const signed_sum = BigInt.asIntN(sz,dp.alu_op_a) + BigInt.asIntN(sz,xalu_op_b) + cin;
                if (BigInt.asIntN(sz, signed_sum) !== signed_sum) dp.alu_nzcv |= 0x1;
            }
        } else dp.alu_nzcv = undefined;

        // next value for PSTATE register
        if (!einst.pstate_en) {
            dp.next_nzcv = dp.nzcv;
            dp.nzcv_mux = '';
        } else if (einst.pstate_mux === undefined)  {
            dp.next_nzcv = undefined;
            dp.nzcv_mux = '-';
        } else if (einst.pstate_mux === 0) {
            dp.next_nzcv = dp.alu_nzcv;
            dp.nzcv_mux = '[alu flags]';
        } else if (einst.pstate_mux === 1) {
            dp.next_nzcv = Number((dp.ex_a >> 28n) & 0xFn);
            dp.nzcv_mux = '[reg]';
        } else if (einst.pstate_mux === 2) {
            dp.next_nzcv = dp.pstate_match ? dp.alu_nzcv : einst.j;
            dp.nzcv_mux = `[cond ${dp.pstate_match ? 'alu':'inst'}]`;
        }
            
        // compute next values for EX/MEM pipeline registers
        dp.next_mem_n = dp.ex_n;
        dp.next_mem_a = dp.ex_a;
        dp.next_mem_inst = dp.halt ? this.nop_inst : dp.ex_inst;

        if (einst.ex_out_mux === 0) {
            dp.next_mem_ex_out = dp.id_pc;
            dp.ex_out_sel = '[id_pc]';
        } else if (einst.ex_out_mux === 1) {
            dp.next_mem_ex_out = dp.alu_out;
            dp.ex_out_sel = '[alu_out]';
        } else if (einst.ex_out_mux === 2) {
            dp.next_mem_ex_out = dp.pstate_match ? dp.ex_n : dp.alu_out;
            dp.ex_out_sel = '[cond]';
        } else if (einst.ex_out_mux === 3) {
            dp.next_mem_ex_out = BigInt(dp.nzcv) << 28n;
            dp.ex_out_sel = '[pstate]';
        } else {
            dp.next_mem_ex_out = undefined;
            dp.ex_out_sel = '';
        }

        //////////////////////////////////////////////////
        // IF, ID stages
        //////////////////////////////////////////////////

        if (dp.halt || dp.stall) {
            // state in stages IF and ID remains unchanged
            dp.next_if_pc = dp.if_pc;
            dp.next_id_pc = dp.id_pc;
            dp.next_id_inst = dp.id_inst;
            // insert NOP into EXE stage
            dp.next_fex_n = undefined;
            dp.next_fex_m = undefined;
            dp.next_fex_a = undefined;
            // keep HLT instruction stalled in EX stage
            dp.next_ex_inst = dp.halt ? dp.ex_inst : this.nop_inst;
        } else {
            //////////////////////////////////////////////////
            // IF stage
            //////////////////////////////////////////////////

            if (einst.next_PC_mux) {
                dp.next_if_pc = dp.ex_n & 0xFFFFFFFFFFFFFFFCn;
                dp.next_PC_mux = '[EX_n]';
                dp.pc_adder_mux0 = '';
                dp.pc_adder_mux1 = '';
            } else if (einst.PC_add_op_mux && dp.branch_taken) {
                dp.next_if_pc = (dp.ex_n + dp.ex_m) & 0xFFFFFFFFFFFFFFFCn;
                dp.next_PC_mux = '[pc_adder]';
                dp.pc_adder_mux0 = '[EX_n]';
                dp.pc_adder_mux1 = '[EX_m]';
            } else {
                dp.next_if_pc = dp.if_pc + 4n;
                dp.next_PC_mux = '[pc_adder]';
                dp.pc_adder_mux0 = '[PC]';
                dp.pc_adder_mux1 = '[4]';
            }

            if (dp.bubble) {
                dp.next_id_inst = this.nop_inst;
                dp.next_id_pc = undefined;
            } else {
                const PA = this.va_to_phys(dp.if_pc);
                // indicate instruction fetch for cache accounting
                this.memory.fetch32_aligned(PA);
                // use already-decoded instruction...
                let decode = this.inst_decode[PA / 4];
                if (decode === undefined) {
                    // oops, not yet decoded, so do it now
                    decode = this.disassemble(PA, this.if_pc);
                    if (decode === undefined) {
                        this.message.innerHTML = `Cannot decode instruction at physical address 0x${this.hexify(PA)}`;
                        throw 'Halt Execution';
                    }
                }
                dp.next_id_inst = decode;
                dp.next_id_pc = dp.if_pc;
            }

            //////////////////////////////////////////////////
            // ID stage
            //////////////////////////////////////////////////

            // compute next values for IF/EX pipeline registers
            if (dp.bubble) {
                dp.next_fex_n = undefined;
                dp.next_fex_m = undefined;
                dp.next_fex_a = undefined;
                dp.next_ex_inst = this.nop_inst;
            } else {
                // register file reads (bypass register-file write values to read ports)
                if (inst.read_n_valid) {
                    dp.an = inst.read_reg_an;
                    dp.id_n = 
                        (dp.an === winst.rd_addr && winst.write_en) ? dp.wb_ex_out :
                        (dp.an === winst.rt_addr && winst.wload_en) ? dp.wb_mem_out_sxt :
                        dp.register_file[dp.an];
                    dp.id_n &= inst.FnH;
                } else if (inst.read_reg_an === 31) {
                    dp.an = 'xzr';
                    dp.id_n = 0n;   // read XZR
                } else {
                    dp.an = undefined;
                    dp.id_n = undefined;
                }

                if (inst.read_m_valid) {
                    dp.am = inst.read_reg_am;
                    dp.id_m =
                        (dp.am === winst.rd_addr && winst.write_en) ? dp.wb_ex_out :
                        (dp.am === winst.rt_addr && winst.wload_en) ? dp.wb_mem_out_sxt :
                        dp.register_file[dp.am];
                    dp.id_m &= inst.FnH;
                } else if (inst.read_reg_am === 31) {
                    dp.id_m = 0n;   // read XZR
                    dp.am = 'xzr';
                } else {
                    dp.am = undefined;
                    dp.id_m = undefined;
                }

                if (inst.read_a_valid) {
                    dp.aa = inst.read_reg_aa;
                    dp.id_a =
                        (dp.aa === winst.rd_addr && winst.write_en) ? dp.wb_ex_out :
                        (dp.aa === winst.rt_addr && winst.wload_en) ? dp.wb_mem_out_sxt :
                        dp.register_file[dp.aa];
                    dp.id_a &= inst.FnH;
                } else if (inst.read_reg_aa === 31) {
                    dp.id_a = 0n;   // read XZR
                    dp.aa = 'xzr';
                } else {
                    dp.aa = undefined;
                    dp.id_a = undefined;
                }

                if (inst.fex_n_mux === 2) {
                    dp.next_fex_n = dp.id_n;
                    dp.fex_n_mux = `[R${dp.an}]`;
                } else if (inst.fex_n_mux === 0) {
                    dp.next_fex_n = dp.id_pc;
                    dp.fex_n_mux = '[ID_pc]';
                } else if (inst.fex_n_mux === 1) {
                    dp.next_fex_n = dp.id_pc & 0xFFFFFFFFFFFFF000n;
                    dp.fex_n_mux = '[ID_pc_page]';
                } else {
                    dp.next_fex_n = undefined;
                    dp.fex_n_mux = '&mdash;';
                }

                if (inst.fex_m_mux === 1) {
                    dp.next_fex_m = dp.id_m;
                    dp.fex_m_mux = `[R${dp.am}]`;
                } else if (inst.fex_m_mux === 0) {
                    dp.next_fex_m = inst.i;
                    dp.fex_m_mux = '[Immediate]';
                } else {
                    dp.next_fex_m = undefined;
                    dp.fex_m_mux = '&mdash;';
                }

                dp.next_fex_a = dp.id_a;
                dp.next_ex_inst = inst;
            }
        }

        // let caller know if BRK or HLT has reached EX stage
        if (dp.halt || einst.opcode === 'brk') {
            this.update_display();
            throw "Halt Execution";
        }

        // breakpoint set for instruction in EXE stage?
        const loc = this.source_map[dp.ex_inst.pa/4];
        if (loc && loc.breakpoint) {
            this.update_display();
            throw "Halt Execution";
        }
    }

    // update pipeline state
    pipeline_clock(update_display) {
        const dp = this.dp;
        this.ncycles += 1;

        //////////////////////////////////////////////////
        // IF stage
        //////////////////////////////////////////////////

        // pipeline regs
        dp.if_pc = dp.next_if_pc;

        //////////////////////////////////////////////////
        // ID stage
        //////////////////////////////////////////////////

        // pipeline regs
        dp.id_pc = dp.next_id_pc;
        dp.id_inst = dp.next_id_inst;

        //////////////////////////////////////////////////
        // EX stage
        //////////////////////////////////////////////////

        if (dp.ex_inst.pstate_en === 1) {
            dp.nzcv = dp.next_nzcv;
            if (update_display) {
                document.getElementById('nzcv').innerHTML =
                    dp.nzcv.toString(2).padStart(4,'0');
            }
        }

        // pipeline regs
        dp.fex_n = dp.next_fex_n;
        dp.fex_m = dp.next_fex_m;
        dp.fex_a = dp.next_fex_a;
        dp.ex_inst = dp.next_ex_inst;

        //////////////////////////////////////////////////
        // MEM stage
        //////////////////////////////////////////////////

        // write to memory
        const minst = dp.mem_inst;
        if (minst.mem_write === 1) {
            switch (minst.mem_size) {
            case 8:  this.memory.write_bigint8(dp.mem_PA, dp.mem_wdata); break;
            case 16: this.memory.write_bigint16(dp.mem_PA, dp.mem_wdata); break;
            case 32: this.memory.write_bigint32(dp.mem_PA, dp.mem_wdata); break;
            case 64: this.memory.write_bigint64(dp.mem_PA, dp.mem_wdata); break;
            }
            if (update_display) {
                // which 64-bit word(s) were updated?
                const aligned_lo = dp.mem_PA & ~0x7;
                const mtd = document.getElementById('m' + aligned_lo);
                mtd.innerHTML = this.location(aligned_lo,64);

                // make sure location is visible in memory pane
                if (!this.is_visible(mtd, document.getElementById('memory')))
                    mtd.scrollIntoView({block: 'center'});

                // did we also change the next word? (ie an unaligned write)
                // see if address of last modified byte is in the same 64-bit word
                const aligned_hi = (dp.mem_PA + minst.mem_size/8 - 1) & ~0x7;
                if (aligned_hi !== aligned_lo)
                    document.getElementById('m' + aligned_hi).innerHTML =
                    this.location(aligned_hi,64);
            }
        }

        // pipeline regs
        dp.mem_n = dp.next_mem_n;
        dp.mem_ex_out = dp.next_mem_ex_out;
        dp.mem_a = dp.next_mem_a;
        dp.mem_inst = dp.next_mem_inst;

        //////////////////////////////////////////////////
        // WB stage
        //////////////////////////////////////////////////

        // writes to register file
        const winst = dp.wb_inst;

        if (winst.wload_en === 1) {
            dp.register_file[winst.rt_addr] = dp.wb_mem_out_sxt;
            if (update_display) {
                const e = document.getElementById('r' + winst.rt_addr);
                if (e) e.innerHTML = this.hexify(dp.wb_mem_out_sxt,16);
            }
        }

        if (winst.write_en === 1) {
            dp.register_file[winst.rd_addr] = dp.wb_ex_out;
            if (update_display) {
                const e = document.getElementById('r' + winst.rd_addr);
                if (e) e.innerHTML = this.hexify(dp.wb_ex_out,16);
            }
        }

        // pipeline regs
        dp.wb_ex_out = dp.next_wb_ex_out;
        dp.wb_mem_out = dp.next_wb_mem_out;
        dp.wb_inst = dp.next_wb_inst;
    }

    next_pc(default_PA) {
        if (this.source_highlight) {
            this.source_highlight.doc.removeLineClass(this.source_highlight.line,'background','cpu_tool-next-inst');
            this.source_highlight = undefined;
        }

        if (this.source_map) {
            const PA = this.dp.ex_inst.pa || default_PA;
            if (PA !== undefined) {
                const loc = this.source_map[PA/4];
                if (loc) {
                    const cm = this.select_buffer(loc.start[0]);
                    if (cm) {
                        const doc = cm.CodeMirror.doc;
                        doc.addLineClass(loc.start[1] - 1,'background','cpu_tool-next-inst');
                        this.source_highlight = {doc: doc, line: loc.start[1]-1};
                        cm.CodeMirror.scrollIntoView({line: loc.start[1] - 1, ch: loc.start[2]});
                    }
                }
            }
        }
    }

    //////////////////////////////////////////////////
    // Animated pipeline diagram
    //////////////////////////////////////////////////

    static template_datapath_diagram = `
<style>
  #pipeline-diagram { min-width: 600px; }
  #pipeline-diagram .stage-divider { stroke: #DDD; stroke-width: 2; fill: none; }
  #pipeline-diagram .stage-label { font: 12px serif; stroke: none; fill: grey; }
  #pipeline-diagram .wire { stroke: black; stroke-width: 0.5; fill: none;}
  #pipeline-diagram .wire-label { font: 6px sanserif; fill: black; }
  #pipeline-diagram .outline { stroke: black; stroke-width: 0.5; fill: none;}
  #pipeline-diagram .reg { stroke: black; stroke-width: 0.5; fill: #DDD;}
  #pipeline-diagram .reg-value { stroke: black; stroke-width: 0.5; fill: #EFE;}
  #pipeline-diagram .label { font: 8px sanserif; fill: black; }
  #pipeline-diagram .reg-name { font: 8px sanserif; fill: black; }
  #pipeline-diagram .icon { font: 8px sanserif; fill: black; }
  #pipeline-diagram .value { font: 8px monospace; fill: blue; }
  #pipeline-diagram .mux-value { font: 6px monospace; fill: blue; }
</style>
<svg id="pipeline-diagram" viewBox="0 0 200 200">
  <defs>
    <marker id="arrow" markerWidth="4" markerHeight="4" refX="4" refY="2" orient="auto">
      <polygon points="0 0, 4 2, 0 4"/>
    </marker>
  </defs>
</svg>
`;

    update_datapath_diagram() {
        if (this.diagram === undefined) {
            document.getElementById('datapath').innerHTML =
                SimTool.ASimPipelined.template_datapath_diagram;
            this.diagram = document.getElementById('pipeline-diagram')
            this.make_diagram();
        }

        // fill in diagram values from datapath info
        const dp = this.dp;
        for (let v of document.getElementsByClassName('value')) {
            const id = v.getAttribute('id');
            if (true /*id in dp*/) {
                const value = dp[id];
                const vtype = v.getAttribute('dtype')
                if (vtype === 'hex') {
                    v.innerHTML = (value === undefined) ?
                        '&mdash;' : '0x'+value.toString(16);
                } else if (vtype === 'decimal') {
                    v.innerHTML = (value === undefined) ?
                        '&mdash;' : value.toString();
                } else if (vtype === 'hex64') {
                    v.innerHTML = (value === undefined) ?
                        ''.padEnd(16,'-') : '0x'+this.hexify(value,16);
                } else if (vtype === 'hex32') {
                    v.innerHTML = (value === undefined) ?
                        ''.padEnd(8,'-') : this.hexify(value,8);
                } else if (vtype === 'inst') {
                    v.innerHTML = (value === undefined) ? '?' : `${value.assy}`;
                } else if (vtype === 'ctl') {
                    v.innerHTML = value ? 1 : 0;
                } else {
                    v.innerHTML = (value === undefined) ? '&mdash;' : value.toString();
                }
            }
        }
    }

    make_diagram() {
        let h = 30;
        let v = 10;

        v += this.make_pre_IF_stage(h, v);
        v += this.make_IF_stage(h, v);
        v += this.make_ID_stage(h, v);
        v += this.make_EX_stage(h, v);
        v += this.make_MEM_stage(h, v);
        v += this.make_WB_stage(h, v);

        // update viewBox
        this.diagram.setAttribute('viewBox',`-5 0 455 ${v}`);
    }

    make_pre_IF_stage(h, v) {
        const stage_height = 45;

        // next_PC_mux
        const pc_mux_y = v + stage_height - 22;
        this.make_mux([h+20,pc_mux_y], 60, 10, 'next_PC_mux');
        this.make_wire([h+50,pc_mux_y+10], [h+50,v+stage_height])

        // mux output connecting to IF-stage register
        const next_if_pc = this.make_label([h+52,pc_mux_y+16], 'value', 'start', 'middle');
        next_if_pc.setAttribute('id','next_if_pc');
        next_if_pc.setAttribute('dtype','hex');

        // EX_n input
        this.make_wire([h+30,pc_mux_y-5], [h+30,pc_mux_y])
        this.make_label([h+30, pc_mux_y-7], 'wire-label', 'middle', 'auto',
                        {text: 'EX_n'});

        // PC adder
        this.make_rect([h+45,pc_mux_y-15], 50, 10, 'outline', '+');
        this.make_wire([h+70,pc_mux_y-5], [h+70,pc_mux_y])

        // PC adder muxes
        this.make_mux([h+40,pc_mux_y-25], 30, 7, 'pc_adder_mux0');
        this.make_wire([h+55,pc_mux_y-18], [h+55,pc_mux_y-15])
        this.make_label([h+55,pc_mux_y-27], 'wire-label', 'middle', 'auto',
                        {text: "EX_n | IF_pc"});
        this.make_mux([h+70,pc_mux_y-25], 30, 7, 'pc_adder_mux1');
        this.make_wire([h+85,pc_mux_y-18], [h+85,pc_mux_y-15])
        this.make_label([h+85,pc_mux_y-27], 'wire-label', 'middle', 'auto',
                        {text: "EX_m | 4"});

        return stage_height;
    }

    make_IF_stage(h, v) {
        const stage_height = 46;
        const center_y = v + 12 + stage_height/2;

        this.make_svg('path', {'class': 'stage-divider', d: `M ${h-20} ${v+12} l 430 0`});
        this.make_label([h-5, center_y], 'stage-label', 'end', 'middle', {text: 'IF'});

        // IF_pc register
        this.make_reg([h, v], 100, 12, 'IF_pc', 'if_pc', 'hex64');

        // wire to ID_PC
        this.make_wire([h+50,v+24], [h+50,v+stage_height])

        // instruction memory
        const instruction_memory = this.make_rect([h+150,center_y-10], 100, 20, 'reg',
                                                  'Instruction Memory');
        // wire to instruction memory
        this.make_svg('path',{
            'class': 'wire',
            d: `M ${h+50} ${center_y} l 100 0`,
            'marker-end': 'url(#arrow)',
        })

        // wire from instruction memory
        this.make_svg('path',{
            'class': 'wire',
            d: `M ${h+250} ${center_y} l 100 0 l 0 ${stage_height/2 - 12}`,
            'marker-end': 'url(#arrow)',
        });

        const if_pc = this.make_label([h+148,center_y - 2], 'value', 'end', 'auto');
        if_pc.setAttribute('id','if_pc');
        if_pc.setAttribute('dtype','hex');

        // next_id_inst value
        const if_inst = this.make_label([h+252,center_y - 2], 'value', 'start', 'auto');
        if_inst.setAttribute('id','next_id_inst');
        if_inst.setAttribute('dtype','inst');

        return stage_height;   // height;
    }

    make_ID_stage(h, v) {
        const stage_height = 60;

        this.make_svg('path', {'class': 'stage-divider', d: `M ${h-20} ${v+12} l 430 0`});
        this.make_label([h-5, v + 12 + stage_height/2], 'stage-label', 'end', 'middle',
                        {text: 'ID'});

        this.make_reg([h, v], 100, 12, 'ID_pc', 'id_pc', 'hex64');
        this.make_reg([h+300, v], 100, 12, 'ID_inst', 'id_inst', 'inst');

        this.make_wire([h+350,v+24], [h+350,v+29]);
        this.make_rect([h+300,v+29], 100, 10, 'outline', 'instruction decode');
        this.make_wire([h+350,v+39], [h+350,v+stage_height]);

        this.make_mux([h+10,v + stage_height - 22], 80, 10, 'fex_n_mux');
        this.make_label([h+50, v + stage_height - 24], 'wire-label', 'middle', 'auto',
                        {text: "ID_pc | ID_pc_page | Rn"});
        this.make_wire([h+50,v + stage_height - 12], [h+50,v + stage_height]);
        const next_fex_n = this.make_label([h+50,v + stage_height - 6], 'value', 'middle', 'middle');
        next_fex_n.setAttribute('id','next_fex_n');
        next_fex_n.setAttribute('dtype','hex64');

        this.make_mux([h+110,v + stage_height - 22], 80, 10, 'fex_m_mux');
        this.make_label([h+150, v + stage_height - 24], 'wire-label', 'middle', 'auto',
                        {text: "Immediate | Rm"});
        this.make_wire([h+150,v + stage_height - 12], [h+150,v + stage_height]);
        const next_fex_m = this.make_label([h+150,v + stage_height - 6], 'value', 'middle', 'middle');
        next_fex_m.setAttribute('id','next_fex_m');
        next_fex_m.setAttribute('dtype','hex64');

        this.make_wire([h+250,v + stage_height - 12], [h+250,v + stage_height]);
        this.make_label([h+250, v + stage_height - 14], 'wire-label', 'middle', 'auto',
                        {text: "Ra"});
        const next_fex_a = this.make_label([h+250,v + stage_height - 6], 'value', 'middle', 'middle');
        next_fex_a.setAttribute('id','next_fex_a');
        next_fex_a.setAttribute('dtype','hex64');

        return stage_height;   // return height
    }

    make_EX_stage(h, v) {
        const stage_height = 100;
        this.make_svg('path', {'class': 'stage-divider', d: `M ${h-20} ${v+12} l 430 0`});
        this.make_label([h-5, v + 12 + stage_height/2], 'stage-label', 'end', 'middle',
                        {text: 'EX'});

        this.make_reg([h, v], 100, 12, 'FEX_n', 'fex_n', 'hex64');
        this.make_reg([h+100, v], 100, 12, 'FEX_m', 'fex_m', 'hex64');
        this.make_reg([h+200, v], 100, 12, 'FEX_a', 'fex_a', 'hex64');
        this.make_reg([h+300, v], 100, 12, 'EX_inst', 'ex_inst', 'inst');
        this.make_wire([h+350, v+24],[h+350, v+stage_height]);

        return stage_height;   // return height
    }

    make_MEM_stage(h, v) {
        const stage_height = 80;
        this.make_svg('path', {'class': 'stage-divider', d: `M ${h-20} ${v+12} l 430 0`});
        this.make_label([h-5, v + 12 + stage_height/2], 'stage-label', 'end', 'middle',
                        {text: 'MEM'});

        this.make_reg([h, v], 100, 12, 'MEM_EX_out', 'mem_ex_out', 'hex64');
        this.make_reg([h+100, v], 100, 12, 'MEM_n', 'mem_n', 'hex64');
        this.make_reg([h+200, v], 100, 12, 'MEM_a', 'mem_a', 'hex64');
        this.make_reg([h+300, v], 100, 12, 'MEM_inst', 'mem_inst', 'inst');
        this.make_wire([h+350, v+24],[h+350, v+stage_height]);
        this.make_wire([h+50, v+24],[h+50, v+stage_height]);
        
        const mem_x = h + 160;
        const mem_y = v + 32;
        this.make_rect([mem_x, mem_y], 80, 40, 'reg');
        this.make_label([mem_x+40, mem_y+19], 'label', 'middle', 'auto', {text: 'Data'});
        this.make_label([mem_x+40, mem_y+21], 'label', 'middle', 'hanging', {text: 'Memory'});

        this.make_label([mem_x+2, mem_y+8], 'wire-label', 'start', 'middle', {text: 'addr'});
        this.make_wire([mem_x-10, mem_y+8], [mem_x, mem_y+8]);
        const addr = this.make_label([mem_x-12, mem_y+8], 'value', 'end', 'middle');
        addr.setAttribute('id','mem_PA');
        addr.setAttribute('dtype','hex');

        this.make_label([mem_x+2, mem_y+16], 'wire-label', 'start', 'middle', {text: 'wdata'});
        this.make_wire([mem_x-10, mem_y+16], [mem_x, mem_y+16]);
        const wdata = this.make_label([mem_x-12, mem_y+16], 'value', 'end', 'middle');
        wdata.setAttribute('id','mem_wdata');
        wdata.setAttribute('dtype','hex');

        this.make_label([mem_x+2, mem_y+24], 'wire-label', 'start', 'middle', {text: 'read'});
        this.make_wire([mem_x-10, mem_y+24], [mem_x, mem_y+24]);
        const rd = this.make_label([mem_x-12, mem_y+24], 'value', 'end', 'middle');
        rd.setAttribute('id','mem_read');
        rd.setAttribute('dtype','ctl');

        this.make_label([mem_x+2, mem_y+32], 'wire-label', 'start', 'middle', {text: 'write'});
        this.make_wire([mem_x-10, mem_y+32], [mem_x, mem_y+32]);
        const wr = this.make_label([mem_x-12, mem_y+32], 'value', 'end', 'middle');
        wr.setAttribute('id','mem_write');
        wr.setAttribute('dtype','ctl');

        this.make_label([mem_x+78, mem_y+8], 'wire-label', 'end', 'middle', {text: 'rdata'});
        this.make_svg('path',{
            'class': 'wire',
            d: `M ${mem_x+80} ${mem_y+8} l 10 0 L ${mem_x+90} ${v+stage_height}`,
            'marker-end': 'url(#arrow)',
        });
        const rdata = this.make_label([mem_x+92, mem_y+8], 'value', 'start', 'middle');
        rdata.setAttribute('id','next_wb_mem_out');
        rdata.setAttribute('dtype','hex');

        return stage_height;   // return height
    }

    make_WB_stage(h, v) {
        const stage_height = 80;
        this.make_svg('path', {'class': 'stage-divider', d: `M ${h-20} ${v+12} l 430 0`});
        this.make_label([h-5, v + 12 + stage_height/2], 'stage-label', 'end', 'middle',
                        {text: 'WB'});

        this.make_reg([h, v], 100, 12, 'WB_EX_out', 'wb_ex_out', 'hex64');
        this.make_reg([h+200, v], 100, 12, 'WB_MEM_out', 'wb_mem_out', 'hex64');
        this.make_reg([h+300, v], 100, 12, 'WB_inst', 'wb_inst', 'inst');

        const mem_x = h + 160;
        const mem_y = v + 32;
        this.make_rect([mem_x, mem_y], 80, 40, 'reg');
        this.make_label([mem_x+40, mem_y+19], 'label', 'middle', 'auto', {text: 'Register'});
        this.make_label([mem_x+40, mem_y+21], 'label', 'middle', 'hanging', {text: 'File'});

        this.make_label([mem_x+2, mem_y+8], 'wire-label', 'start', 'middle', {text: 'wdata'});
        this.make_wire([mem_x-10, mem_y+8], [mem_x, mem_y+8]);
        const rddata = this.make_label([mem_x-12, mem_y+8], 'value', 'end', 'middle');
        rddata.setAttribute('id','wb_ex_out');
        rddata.setAttribute('dtype','hex');

        this.make_label([mem_x+2, mem_y+16], 'wire-label', 'start', 'middle', {text: 'addr'});
        this.make_wire([mem_x-10, mem_y+16], [mem_x, mem_y+16]);
        const rdaddr = this.make_label([mem_x-12, mem_y+16], 'value', 'end', 'middle');
        rdaddr.setAttribute('id','rd_addr');
        rdaddr.setAttribute('dtype','decimal');

        this.make_label([mem_x+2, mem_y+24], 'wire-label', 'start', 'middle', {text: 'write'});
        this.make_wire([mem_x-10, mem_y+24], [mem_x, mem_y+24]);
        const rdwr = this.make_label([mem_x-12, mem_y+24], 'value', 'end', 'middle');
        rdwr.setAttribute('id','rd_write');
        rdwr.setAttribute('dtype','ctl');

        this.make_label([mem_x+78, mem_y+8], 'wire-label', 'end', 'middle', {text: 'wdata'});
        this.make_wire([mem_x+90, mem_y+8], [mem_x+80, mem_y+8]);
        const rtdata = this.make_label([mem_x+92, mem_y+8], 'value', 'start', 'middle');
        rtdata.setAttribute('id','wb_mem_out_sxt');
        rtdata.setAttribute('dtype','hex');

        this.make_label([mem_x+78, mem_y+16], 'wire-label', 'end', 'middle', {text: 'addr'});
        this.make_wire([mem_x+90, mem_y+16], [mem_x+80, mem_y+16]);
        const rtaddr = this.make_label([mem_x+92, mem_y+16], 'value', 'start', 'middle');
        rtaddr.setAttribute('id','rt_addr');
        rtaddr.setAttribute('dtype','decimal');

        this.make_label([mem_x+78, mem_y+24], 'wire-label', 'end', 'middle', {text: 'write'});
        this.make_wire([mem_x+90, mem_y+24], [mem_x+80, mem_y+24]);
        const rtwr = this.make_label([mem_x+92, mem_y+24], 'value', 'start', 'middle');
        rtwr.setAttribute('id','rt_write');
        rtwr.setAttribute('dtype','ctl');

        return stage_height;   // return height
    }

    //////////////////////////////////////////////////
    // SVG helper functions
    //////////////////////////////////////////////////

    make_svg(tag,attrs) {
        var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
        this.diagram.append(el);
        return el;
    }

    // text label at pos
    // hposition: 'start', 'middle', 'end'
    // vposition: 'auto', 'middle', 'hanging'
    make_label(pos, lclass, hposition, vposition, attributes) {
        const lbl = this.make_svg('text', {
            'class': lclass, x : pos[0] , y: pos[1],
            'dominant-baseline': vposition, 'text-anchor': hposition,
        });
        for (let a in attributes) {
            if (attributes[a] === undefined) continue;
            if (a == 'text') lbl.innerHTML = attributes[a]
            else lbl.setAttribute(a, attributes[a]);
        }
        return lbl;
    }

    make_mux(pos, w, h, id) {
        const mux = this.make_svg('path', {
            'class': 'outline',
            d: `M ${pos[0]} ${pos[1]} l ${w} 0 l ${-h} ${h} l ${-w + 2*h} 0 z`,
        });
        const lbl = this.make_label([pos[0] + w/2, pos[1] + h/2], 'value mux-value', 'middle', 'middle', {id: id});
        return mux;
    }

    make_alu(pos, label) {
        const h = 20;
        const alu = this.make_svg('path', {
            'class': 'outline',
            d: `M ${pos[0]} ${pos[1]} m -35 ${-h} l 30 0 l 5 5 l 5 -5 l 30 0 l -10 ${h} l -50 0 z`,
        });
        this.make_label([pos[0], pos[1] - h/2 + 4], 'label', 'middle', 'middle',
                        {text: label})
        alu.A = [pos[0]-15, pos[1]-h];
        alu.B = [pos[0]+15, pos[1]-h];
        alu.OUT = [pos[0], pos[1]];
        return alu;
    }

    make_rect(pos, w, h, rclass, label) {
        const reg = this.make_svg('path', {
            'class': rclass || 'reg',
            d: `M ${pos[0]} ${pos[1]} l ${w} 0 l 0 ${h} l ${-w} 0 z`,
        });
        if (label)
            this.make_label([pos[0] + w/2, pos[1] + h/2 + 1], 'reg-name',
                            'middle', 'middle', {text: label});
    }

    make_reg(pos, w, h, label, id, dtype) {
        this.make_rect(pos, w, h, 'reg', label);
        this.make_rect([pos[0],pos[1]+h], w, h, 'reg-value');
        const v = this.make_label([pos[0] + w/2, pos[1] + h + h/2], 'value',
                                  'middle', 'middle');
        v.setAttribute('id',id);
        v.setAttribute('dtype',dtype);
    }

    make_wire(start, end, wclass) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        return this.make_svg('path', {
            'class': wclass || 'wire',
            d: `M ${start[0]} ${start[1]} ${dx ? `l 0 ${dy/2}`:''} ${dx ? `l ${dx} 0`:''} l 0 ${dx ? dy/2 : dy}`,
            'marker-end': 'url(#arrow)',
        });
    }

};

//////////////////////////////////////////////////
// ARMV8A syntax coloring
//////////////////////////////////////////////////

CodeMirror.defineMode('ARMV8A', function() {
    'use strict';

    const line_comment = '//';   // eslint-disable-line no-unused-vars
    const block_comment_start = '/*';  // eslint-disable-line no-unused-vars
    const block_comment_end = '*/';  // eslint-disable-line no-unused-vars

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
        while ((ch = stream.next())) {
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
        '.balign',
        '.bss',
        '.byte',
        '.cache',
        '.data',
        '.endm',
        '.global',
        '.hword',
        '.include',
        '.long',
        '.macro',
        '.p2align',
        '.quad',
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
        new SimTool.ASim(div, false);
    }
    for (let div of document.getElementsByClassName('educore')) {
        new SimTool.ASim(div, true);
    }
    for (let div of document.getElementsByClassName('educore-pipelined')) {
        new SimTool.ASimPipelined(div);
    }
});
