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
        // LEGv8 from H&P
        this.opcodes = {
            add:    {pattern: "10001011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            addi:   {pattern: "1001000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            addis:  {pattern: "1011000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            adds:   {pattern: "10101011ss0mmmmmaaaaaannnnnddddd", type: "R"},
            and:    {pattern: "10001010000mmmmmaaaaaannnnnddddd", type: "R"},
            andi:   {pattern: "1001001000IIIIIIIIIIIInnnnnddddd", type: "IM"},
            andis:  {pattern: "1111001000IIIIIIIIIIIInnnnnddddd", type: "IM"},
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
            bl:     {pattern: "100101IIIIIIIIIIIIIIIIIIIIIIIIII", type: "B"},
            br:     {pattern: "11010110000mmmmmaaaaaannnnnddddd", type: "R"},
            cbnz:   {pattern: "10110101IIIIIIIIIIIIIIIIIIIttttt", type: "CB"},
            cbz:    {pattern: "10110100IIIIIIIIIIIIIIIIIIIttttt", type: "CB"},
            eor:    {pattern: "11001010000mmmmmaaaaaannnnnddddd", type: "R"},
            eori:   {pattern: "1101001000IIIIIIIIIIIInnnnnddddd", type: "IM"},
            ldur:   {pattern: "11111000010IIIIIIIII00nnnnnttttt", type: "D"},
            ldurb:  {pattern: "00111000010IIIIIIIII00nnnnnttttt", type: "D"},
            ldurh:  {pattern: "01111000010IIIIIIIII00nnnnnttttt", type: "D"},
            ldursw: {pattern: "10111000100IIIIIIIII00nnnnnttttt", type: "D"},
            ldxr:   {pattern: "1100100001011111011111nnnnnttttt", type: "D"},
            lsl:    {pattern: "10011010110mmmmm001000nnnnnddddd", type: "R"},
            lsr:    {pattern: "10011010110mmmmm001001nnnnnddddd", type: "R"},
            asr:    {pattern: "10011010110mmmmm001010nnnnnddddd", type: "R"},
            lsli:   {pattern: "10001011000nnnnnaaaaaa11111ddddd", type: "I"},  // add Xd,XZR,Xn,LSL #a
            lsri:   {pattern: "10001011010nnnnnaaaaaa11111ddddd", type: "I"},  // add Xd,XZR,Xn,LSR #a
            asri:   {pattern: "10001011100nnnnnaaaaaa11111ddddd", type: "I"},  // add Xd,XZR,Xn,ASR #a
            movk:   {pattern: "111100101IIIIIIIIIIIIIIIIIIddddd", type: "M"},
            movz:   {pattern: "110100101IIIIIIIIIIIIIIIIIIddddd", type: "M"},
            mul:    {pattern: "10011011000mmmmm011111nnnnnddddd", type: "R"},
            orr:    {pattern: "10101010000mmmmmaaaaaannnnnddddd", type: "R"},
            orri:   {pattern: "1011001000IIIIIIIIIIIInnnnnddddd", type: "IM"},
            sdiv:   {pattern: "10011010110mmmmm000010nnnnnddddd", type: "R"},
            smulh:  {pattern: "10011011010mmmmm011111nnnnnddddd", type: "R"},
            stur:   {pattern: "11111000000IIIIIIIII00nnnnnttttt", type: "D"},
            sturb:  {pattern: "00111000000IIIIIIIII00nnnnnttttt", type: "D"},
            sturh:  {pattern: "01111000000IIIIIIIII00nnnnnttttt", type: "D"},
            sturw:  {pattern: "10111000000IIIIIIIII00nnnnnttttt", type: "D"},
            stxr:   {pattern: "11001000000IIIIIIIII00nnnnnttttt", type: "D"},
            sub:    {pattern: "11001011000mmmmmaaaaaannnnnddddd", type: "R"},
            subi:   {pattern: "1101000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            subis:  {pattern: "1111000100IIIIIIIIIIIInnnnnddddd", type: "I"},
            subs:   {pattern: "11101011000mmmmmaaaaaannnnnddddd", type: "R"},
            udiv:   {pattern: "10011010110mmmmm000011nnnnnddddd", type: "R"},
            umulh:  {pattern: "10011011110mmmmm011111nnnnnddddd", type: "R"},

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
            //ldurd:  {pattern: "11111000010IIIIIIIII00nnnnnttttt", type: "D"},
            //ldurs:  {pattern: "10111100010IIIIIIIII00nnnnnttttt", type: "D"},
            //sturd : {pattern: "11111100000IIIIIIIII00nnnnnttttt", type: "D"},
            //sturs:  {pattern: "10111100000IIIIIIIII00nnnnnttttt", type: "D"},
        }

        this.inst_codec = new SimTool.InstructionCodec();

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

    // define functions that assemble and emulate each opcode
    opcode_handlers() {
        const tool = this;  // for reference by handlers

        this.assembly_handlers = new Map();

        this.assembly_handers.set('add',function (operands) {
        });

        this.execution_handlers = new Map();  // execution handlers: opcode => function
    }

    //////////////////////////////////////////////////
    // Assembly
    //////////////////////////////////////////////////

    // is operand a register name: return regnumber or undefined
    is_register(operand) {
        return (operand !== undefined && operand.length === 1 && operand[0].type=='symbol') ?
            this.registers.get(operand[0].token.toLowerCase()) : undefined;
    }

    // interpret operand as a register
    expect_register(operand, oname, fields, fname) {
        const reg = this.is_register(operand);
        if (reg !== undefined) { fields[fname] = reg; return; }
        this.syntax_error(`Register name expected for the ${oname} operand`,
                          operand[0].start, operand[operand.length - 1].end);
        return undefined;   // never executed...
    }

    // is operand an immediate?  return expression tree or undefined
    is_immediate(operand) {
        return (operand !== undefined && operand[0].type=='operator' && operand[0].token='#' ) ?
            this.read_expression(operand,1) : undefined;
    }

    // interpret operand as an immediate
    expect_immediate(operand, oname, fields, fname) {
        const imm = this.is_immediate(operand);
        if (reg !== undefined) { fields[fname] = reg; return; }
        this.syntax_error(`Immediate expression expected for the ${oname} operand`,
                          operand[0].start, operand[operand.length - 1].end);
        return undefined;   // never executed...
    }

    // "op Rd, Rn, Rm"
    // add, adds, and, ands, eor, orr, sub, subs, lsl, lsr, asr
    assemble_R_type(opcode, operands, info) {
        if (operands.length != 3)
            throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

        const fields = {s: 0, a: 0};   // LSL #0
        this.expect_register(operands[0], 'Rd', fields, 'd');
        this.expect_register(operands[1], 'Rn', fields, 'n');
        this.expect_register(operands[2], 'Rm', fields, 'm');
        this.inst_codec.encode(opcode.token, fields);
    }

    // "op Rd, Rn, #imm"    [imm is unsigned]
    // addi, addis, subi, subis; lsl, lsr, asr
    assemble_I_type(opcode, operands, info) {
        if (operands.length != 3)
            throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

        const fields = {};
        this.expect_register(operands[0], 'Rd', fields, 'd');
        this.expect_register(operands[1], 'Rn', fields, 'n');
        this.expect_immediate(operands[2], 'immediate', fields, 'I');
        fields.a = fields.I;     // for shift instructions
        this.inst_codec.encode(opcode.token, fields);
    }

    assemble_D_type(opcode, operands, info) {
        return undefined;
    }
    
    assemble_B_type(opcode, operands, info) {
        return undefined;
    }
    
    assemble_CB_type(opcode, operands, info) {
        return undefined;
    }
    
    assemble_IM_type(opcode, operands, info) {
        return undefined;
    }
    
    assemble_M_type(opcode, operands, info) {
        return undefined;
    }
    
    // return undefined if opcode not recognized, otherwise true
    // Call this.emit32(inst) to store binary into main memory at dot.
    // Call this.syntax_error(msg, start, end) to report an error
    assemble_opcode(opcode, operands) {
        if (opcode.type !== 'symbol') return undefined;
        const info = this.opcodes.get(opcode.token.toLowerCase());
        if (info === undefined) return undefined;

        if (info.type === 'R')
            return this.assemble_R_type(opcode, operands, info)
        if (info.type === 'I')
            return this.assemble_I_type(opcode, operands, info)
        if (info.type === 'D')
            return this.assemble_D_type(opcode, operands, info)
        if (info.type === 'B')
            return this.assemble_B_type(opcode, operands, info)
        if (info.type === 'CB')
            return this.assemble_CB_type(opcode, operands, info)
        if (info.type === 'M')
            return this.assemble_IM_type(opcode, operands, info)
        if (info.type === 'IM')
            return this.assemble_IM_type(opcode, operands, info)
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
