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

var sim_tool;  // keep lint happy
var CodeMirror;

//////////////////////////////////////////////////
// RISC-V assembly/simulation
//////////////////////////////////////////////////

(function () {
    "use strict";

    // define everything inside a closure so as not to pollute namespace

    //////////////////////////////////////////////////
    // ISA registers
    //////////////////////////////////////////////////

    // map token (register name) => info about each register
    //  .bin = binary value for assembly
    //  .cm_style = CodeMirror syntax coloring
    let registers = {};
    for (let i = 0; i <= 31; i += 1) {
        registers['x'+i] = { bin: i, cm_style: 'variable' };
    }

    // ABI register names
    registers.zero = registers.x0;
    registers.ra = registers.x1;
    registers.sp = registers.x2;
    registers.gp = registers.x3;
    registers.tp = registers.x4;
    registers.fp = registers.x8;

    registers.t0 = registers.x5;
    registers.t1 = registers.x6;
    registers.t2 = registers.x7;
    registers.t3 = registers.x28;
    registers.t4 = registers.x29;
    registers.t5 = registers.x30;
    registers.t6 = registers.x31;

    registers.a0 = registers.x10;
    registers.a1 = registers.x11;
    registers.a2 = registers.x12;
    registers.a3 = registers.x13;
    registers.a4 = registers.x14;
    registers.a5 = registers.x15;
    registers.a6 = registers.x16;
    registers.a7 = registers.x17;

    registers.s0 = registers.x8;
    registers.s1 = registers.x9;
    registers.s2 = registers.x18;
    registers.s3 = registers.x19;
    registers.s4 = registers.x20;
    registers.s5 = registers.x21;
    registers.s6 = registers.x22;
    registers.s7 = registers.x23;
    registers.s8 = registers.x24;
    registers.s9 = registers.x25;
    registers.s10 = registers.x26;
    registers.s11 = registers.x27;

    //////////////////////////////////////////////////
    // opcodes
    //////////////////////////////////////////////////

    // opcode is inst[6:0]
    // funct3 is inst[14:12]
    // funct7 is inst{31:25]
    let opcodes = {
        // call
        'lui':   { opcode: 0b0110111, type: 'U' },
        'auipc': { opcode: 0b0010111, type: 'U' },
        'jal':   { opcode: 0b1101111, type: 'J' },
        'jalr':  { opcode: 0b1100111, funct3: 0b000, type: 'I' },

        // branch
        'beq':   { opcode: 0b1100011, funct3: 0b000, type: 'B' },
        'bne':   { opcode: 0b1100011, funct3: 0b001, type: 'B' },
        'blt':   { opcode: 0b1100011, funct3: 0b100, type: 'B' },
        'bge':   { opcode: 0b1100011, funct3: 0b101, type: 'B' },
        'bltu':  { opcode: 0b1100011, funct3: 0b110, type: 'B' },
        'bgeu':  { opcode: 0b1100011, funct3: 0b111, type: 'B' },

        // ld
        'lb':    { opcode: 0b0000011, funct3: 0b000, type: 'I' },
        'lh':    { opcode: 0b0000011, funct3: 0b001, type: 'I' },
        'lw':    { opcode: 0b0000011, funct3: 0b010, type: 'I' },
        'ld':    { opcode: 0b0000011, funct3: 0b011, type: 'I' },
        'lbu':   { opcode: 0b0000011, funct3: 0b100, type: 'I' },
        'lhu':   { opcode: 0b0000011, funct3: 0b101, type: 'I' },
        'lwu':   { opcode: 0b0000011, funct3: 0b110, type: 'I' },

        // st
        'sb':    { opcode: 0b0100011, funct3: 0b000, type: 'S' },
        'sh':    { opcode: 0b0100011, funct3: 0b001, type: 'S' },
        'sw':    { opcode: 0b0100011, funct3: 0b010, type: 'S' },
        'sd':    { opcode: 0b0100011, funct3: 0b011, type: 'S' },

        // immediate
        'addi':  { opcode: 0b0010011, funct3: 0b000, type: 'I' },
        'addiw': { opcode: 0b0010011, funct3: 0b000, type: 'I' },
        'slli':  { opcode: 0b0010011, funct3: 0b001, funct7: 0b0000000, type: 'I' },
        'slliw': { opcode: 0b0010011, funct3: 0b001, funct7: 0b0000000, type: 'I' },
        'slti':  { opcode: 0b0010011, funct3: 0b010, type: 'I' },
        'sltiu': { opcode: 0b0010011, funct3: 0b011, type: 'I' },
        'xori':  { opcode: 0b0010011, funct3: 0b100, type: 'I' },
        'srli':  { opcode: 0b0010011, funct3: 0b101, funct7: 0b0000000, type: 'I' },
        'srliw': { opcode: 0b0010011, funct3: 0b101, funct7: 0b0000000, type: 'I' },
        'srai':  { opcode: 0b0010011, funct3: 0b101, funct7: 0b0100000, type: 'I' },
        'sraiw': { opcode: 0b0010011, funct3: 0b101, funct7: 0b0100000, type: 'I' },
        'ori':   { opcode: 0b0010011, funct3: 0b110, type: 'I' },
        'andi':  { opcode: 0b0010011, funct3: 0b111, type: 'I' },

        // operate
        'add':   { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000000, type: 'R' },
        'addw':  { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000000, type: 'R' },
        'sub':   { opcode: 0b0110011, funct3: 0b000, funct7: 0b0100000, type: 'R' },
        'subw':  { opcode: 0b0110011, funct3: 0b000, funct7: 0b0100000, type: 'R' },
        'mul':   { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' },
        'mulw':  { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' },
        'sll':   { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000000, type: 'R' },
        'sllw':  { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000000, type: 'R' },
        'mulh':  { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000001, type: 'R' },
        'slt':   { opcode: 0b0110011, funct3: 0b010, funct7: 0b0000000, type: 'R' },
        'mulhsu': { opcode: 0b0110011, funct3: 0b010, funct7: 0b0000001, type: 'R' },
        'sltu':  { opcode: 0b0110011, funct3: 0b011, funct7: 0b0000000, type: 'R' },
        'mulhu': { opcode: 0b0110011, funct3: 0b011, funct7: 0b0000001, type: 'R' },
        'xor':   { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000000, type: 'R' },
        'div':   { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' },
        'divw':  { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' },
        'srl':   { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000000, type: 'R' },
        'srlw':  { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000000, type: 'R' },
        'sra':   { opcode: 0b0110011, funct3: 0b101, funct7: 0b0100000, type: 'R' },
        'sraw':  { opcode: 0b0110011, funct3: 0b101, funct7: 0b0100000, type: 'R' },
        'divu':  { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' },
        'divuw': { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' },
        'or':    { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000000, type: 'R' },
        'rem':   { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' },
        'remw':  { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' },
        'and':   { opcode: 0b0110011, funct3: 0b111, funct7: 0b0000000, type: 'R' },
        'remu':  { opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' },
        'remuw': { opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' },

        // system
        'fence': { opcode: 0b0001111, funct3: 0b000, type: 'I', rs: 0, rd: 0 },
        'fence.i': { opcode: 0b0001111, funct3: 0b001, type: 'I', rs: 0, rd: 0 },
        'ecall': { opcode: 0b1110011, funct3: 0b000, type: 'I', rs: 0, rd: 0, imm: 0 },
        'ebreak': { opcode: 0b1110011, funct3: 0b000, type: 'I', rs: 0, rd: 0, imm: 1 },
        'csrrw': { opcode: 0b1110011, funct3: 0b001, type: 'I' },
        'csrrs': { opcode: 0b1110011, funct3: 0b010, type: 'I' },
        'csrrc': { opcode: 0b1110011, funct3: 0b011, type: 'I' },
        'csrrwi': { opcode: 0b1110011, funct3: 0b101, type: 'I' },
        'csrrsi': { opcode: 0b1110011, funct3: 0b110, type: 'I' },
        'csrrci': { opcode: 0b1110011, funct3: 0b111, type: 'I' },
    };

    // interpret operand as a register, returning its number
    // or undefined it's not a register
    function expect_register(operand) {
        if (operand.length == 1) {
            let rinfo = registers[operand[0].token.toLowerCase()];
            if (rinfo) return rinfo.bin;
        }
        return undefined;
    }

    // interpret operand as an offset, (base), or offset(base), return {offset:, base:}
    // or undefined it's not a base and offset expression
    function expect_base_and_offset(operand) {
        let len = operand.length;
        let result = {offset: 0, base: 0};

        // check for base register
        if (len >= 3 && operand[len-1].token == ')' && operand[len-3] == '(') {
            result.base = registers[operand[len-2].token.toLowerCase()];
            if (result.base == undefined) return undefined;
            operand = operand.slice(0,-3);
        }

        // check for offset
        // MORE HERE

        return result;
    }
    
    function assemble_B_type(results, opcode, operands, info) {
        results.incr_dot(4);
        return true;
    }
    
    function assemble_I_type(results, opcode, operands, info) {
        results.incr_dot(4);
        return true;
    }
    
    function assemble_J_type(results, opcode, operands, info) {
        results.incr_dot(4);
        return true;
    }

    // rd = rs1 op rs2
    function assemble_R_type(results, opcode, operands, info) {
        if (operands.length != 3)
            throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

        console.log(opcode,operands);

        let rd = expect_register(operands[0]);
        if (rd === undefined)
            throw results.syntax_error(`"${opcode.token}" expects a register as its first (rd) operand`,
                                       operands[0][0].start, operands[0][operands[0].length - 1].end);

        let rs1 = expect_register(operands[1]);
        if (rs1 === undefined)
            throw results.syntax_error(`"${opcode.token}" expects a register as its second (rs1) operand`,
                                       operands[1][0].start, operands[1][operands[1].length - 1].end);

        let rs2 = expect_register(operands[2]);
        if (rs2 === undefined)
            throw results.syntax_error(`"${opcode.token}" expects a register as its third (rs2) operand`,
                                       operands[2][0].start, operands[2][operands[2].length - 1].end);

        results.emit32(info.opcode | (rd << 7) | (info.funct3 << 12) | (rs1 << 15) |
                       (rs2 << 20) | (info.funct7 << 25));

        return true;
    }

    function assemble_S_type(results, opcode, operands, info) {
        results.incr_dot(4);
        return true;
    }
    
    function assemble_U_type(results, opcode, operands, info) {
        results.incr_dot(4);
        return true;
    }

    // return undefined if opcode not recognized, otherwise number of bytes
    // occupied by assembled instruction.
    // Call results.emit32(inst) to store binary into main memory at dot.
    // Call results.syntax_error(msg, start, end) to report an error
    function assemble_opcode(results, opcode, operands) {
        let info = opcodes[opcode.token.toLowerCase()];

        if (info === undefined) return undefined;

        if (info.type == 'R')
            return assemble_R_type(results, opcode, operands, info);
        if (info.type == 'I')
            return assemble_I_type(results, opcode, operands, info);
        if (info.type == 'B')
            return assemble_B_type(results, opcode, operands, info);
        if (info.type == 'S')
            return assemble_S_type(results, opcode, operands, info);
        if (info.type == 'J')
            return assemble_J_type(results, opcode, operands, info);
        if (info.type == 'U')
            return assemble_U_type(results, opcode, operands, info);
        return undefined;
    }

    //////////////////////////////////////////////////
    // Directives
    //////////////////////////////////////////////////

    // add ISA-specific directives here
    let directives = {};

    function assemble_directive(results, directive, operands) {
        let handler = directives[directive];
        return handler ? handler(results, directive, operands) : undefined;
    }

    //////////////////////////////////////////////////
    // custom CodeMirror mode for this ISA
    //////////////////////////////////////////////////

    let line_comment = '#';
    let block_comment_start = '/*';
    let block_comment_end = '*/';
    let cm_mode = 'riscv';

    CodeMirror.defineMode(cm_mode, function(/*_config, parserConfig*/) {
        'use strict';

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

        // mode object for CodeMirror
        return {
            mode_name: 'RISC-V',
            lineComment: line_comment,
            blockCommentStart: block_comment_start,
            blockCommentEnd: block_comment_end,

            startState: function() { return { tokenize: null } },

            // consume next token, return its CodeMirror syntax style
            token: function(stream, state) {
                if (state.tokenize) return state.tokenize(stream, state);

                if (stream.eatSpace()) return null;

                let ch = stream.next();

                // block comment
                if (ch === "/") {
                    if (stream.eat("*")) {
                        state.tokenize = clikeComment;
                        return clikeComment(stream, state);
                    }
                }

                // line comment
                if (ch === line_comment) {
                    stream.skipToEnd();
                    return "comment";
                }

                // string
                if (ch === '"') {
                    nextUntilUnescaped(stream, '"');
                    return "string";
                }

                // directive
                if (ch === '.') {
                    stream.eatWhile(/\w/);
                    let cur = stream.current().toLowerCase().substr(1);
                    return directives[cur] ? 'builtin' : null;
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
                    if (ch === "0" && stream.eat("x")) {
                        stream.eatWhile(/[0-9a-fA-F]/);
                        return "number";
                    }
                    stream.eatWhile(/\d/);
                    if (stream.eat(":")) {
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
                    let cur = stream.current().toLowerCase();
                    let reginfo = registers[cur];
                    return (reginfo ? reginfo.cm_style : null);
                }

                return undefined;
            },
        };
    });

    //////////////////////////////////////////////////
    // RISC-V ISA info
    //////////////////////////////////////////////////

    sim_tool.isa_info["RISC-V"] = {
        line_comment: line_comment,
        block_comment_start: block_comment_start,
        block_comment_end: block_comment_end,
        cm_mode: cm_mode,

        little_endian: true,
        data_section_alignment: 256,
        bss_section_alignment: 8,
        address_space_alignment: 256,

        assemble_directive: assemble_directive,
        assemble_opcode: assemble_opcode,
    };

})();
