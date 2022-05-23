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

var cpu_tool;  // keep lint happy
var CodeMirror;

//////////////////////////////////////////////////
// RISC-V configuration info
//////////////////////////////////////////////////

cpu_tool.isa_info["RISC-V"] = (function () {
    // define everything inside a closure so as not to pollute namespace

    let info = {};    // holds info about this architecture
    info.line_comment = '#';
    info.block_comment_start = '/*';
    info.block_comment_end = '*/';
    info.cm_mode = 'riscv';
    info.littleEndian = true;

    //////////////////////////////////////////////////
    // ISA registers
    //////////////////////////////////////////////////

    // map token (register name) => info about each register
    //  .bin = binary value for assembly
    //  .cm_style = CodeMirror syntax coloring
    info.registers = {};
    for (let i = 0; i <= 31; i += 1) {
        info.registers['x'+i] = { bin: i, cm_style: 'variable' };
    }

    // ABI register names
    info.registers.zero = info.registers.x0;
    info.registers.ra = info.registers.x1;
    info.registers.sp = info.registers.x2;
    info.registers.gp = info.registers.x3;
    info.registers.tp = info.registers.x4;
    info.registers.fp = info.registers.x8;

    info.registers.t0 = info.registers.x5;
    info.registers.t1 = info.registers.x6;
    info.registers.t2 = info.registers.x7;
    info.registers.t3 = info.registers.x28;
    info.registers.t4 = info.registers.x29;
    info.registers.t5 = info.registers.x30;
    info.registers.t6 = info.registers.x31;

    info.registers.a0 = info.registers.x10;
    info.registers.a1 = info.registers.x11;
    info.registers.a2 = info.registers.x12;
    info.registers.a3 = info.registers.x13;
    info.registers.a4 = info.registers.x14;
    info.registers.a5 = info.registers.x15;
    info.registers.a6 = info.registers.x16;
    info.registers.a7 = info.registers.x17;

    info.registers.s0 = info.registers.x8;
    info.registers.s1 = info.registers.x9;
    info.registers.s2 = info.registers.x18;
    info.registers.s3 = info.registers.x19;
    info.registers.s4 = info.registers.x20;
    info.registers.s5 = info.registers.x21;
    info.registers.s6 = info.registers.x22;
    info.registers.s7 = info.registers.x23;
    info.registers.s8 = info.registers.x24;
    info.registers.s9 = info.registers.x25;
    info.registers.s10 = info.registers.x26;
    info.registers.s11 = info.registers.x27;

    //////////////////////////////////////////////////
    // opcodes
    //////////////////////////////////////////////////

    // opcode is inst[6:0]
    // funct3 is inst[14:12]
    // funct7 is inst{31:25]
    info.opcodes = {
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

    //////////////////////////////////////////////////
    // Directives
    //////////////////////////////////////////////////

    // start with built-in (architecture-independent) directives
    info.directives = { ...cpu_tool.built_in_directives };

    // add architecture-specific directives here

    //////////////////////////////////////////////////
    // custom CodeMirror mode for this ISA
    //////////////////////////////////////////////////

    CodeMirror.defineMode("riscv", function(/*_config, parserConfig*/) {
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
            lineComment: info.line_comment,
            blockCommentStart: info.block_comment_start,
            blockCommentEnd: info.block_comment_end,

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
                if (ch === info.line_comment) {
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
                    return info.directives[cur] ? 'builtin' : null;
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
                    let reginfo = info.registers[cur];
                    return (reginfo ? reginfo.cm_style : null);
                }
            },
        };
    });

    return info;

})();
