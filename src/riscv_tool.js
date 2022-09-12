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
// RISC-V assembly/simulation
//////////////////////////////////////////////////

SimTool.RISCVTool = class extends(SimTool.CPUTool) {
    constructor(tool_div, arch_name) {
        // super() will call this.emulation_initialize()
        super(tool_div, 'riscv_tool.10', 'RISC-V', arch_name);
    }

    //////////////////////////////////////////////////
    // ISA emulation
    //////////////////////////////////////////////////

    // provide RISC-V-specific information
    emulation_initialize() {
        // things CPUTool needs to know about our ISA
        this.line_comment = '#';
        this.block_comment_start = '/*';
        this.block_comment_end = '*/';
        this.little_endian = true;

        this.inst_nbits = 32;           // size of instruction in bits (multiple of 8)
        this.word_nbits = 32;           // size of memory word in bits (multiple of 8)

        // addresses are always byte addresses; addresses are Numbers
        this.data_section_alignment = 256;
        this.bss_section_alignment = 8;
        this.address_space_alignment = 256;

        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 2;

        // ISA-specific tables and storage
        this.register_file = new Array(32 + 1);    // include extra reg for writes to x0
        this.memory = new DataView(new ArrayBuffer(256));  // assembly will replace this

        this.register_info();
        this.opcode_info();
        this.opcode_handlers();

        // reset to initial state
        this.emulation_reset();
    }

    // reset emulation state to initial values
    emulation_reset() {
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
            const inst = this.memory.getUint32(EA,this.little_endian);
            this.disassemble(inst, this.pc);   // fills in inst_decode
            info = this.inst_decode[EAindex];
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

    // overriden...
    va_to_phys(va) {
        return va;
    }

    //////////////////////////////////////////////////
    // ISA registers
    //////////////////////////////////////////////////

    // set up this.registers, this.register_names
    register_info() {
        // map token (register name) => info about each register
        //  .bin = binary value for assembly
        //  .cm_style = CodeMirror syntax coloring
        this.registers = new Map();
        for (let i = 0; i <= 31; i += 1) {
            this.registers.set('x'+i, { bin: i, cm_style: 'variable' });
        }

        // ABI register names
        this.registers.set('zero', this.registers.get('x0'));
        this.registers.set('ra', this.registers.get('x1'));
        this.registers.set('sp', this.registers.get('x2'));
        this.registers.set('gp', this.registers.get('x3'));
        this.registers.set('tp', this.registers.get('x4'));
        this.registers.set('fp', this.registers.get('x8'));

        this.registers.set('t0', this.registers.get('x5'));
        this.registers.set('t1', this.registers.get('x6'));
        this.registers.set('t2', this.registers.get('x7'));
        this.registers.set('t3', this.registers.get('x28'));
        this.registers.set('t4', this.registers.get('x29'));
        this.registers.set('t5', this.registers.get('x30'));
        this.registers.set('t6', this.registers.get('x31'));

        this.registers.set('a0', this.registers.get('x10'));
        this.registers.set('a1', this.registers.get('x11'));
        this.registers.set('a2', this.registers.get('x12'));
        this.registers.set('a3', this.registers.get('x13'));
        this.registers.set('a4', this.registers.get('x14'));
        this.registers.set('a5', this.registers.get('x15'));
        this.registers.set('a6', this.registers.get('x16'));
        this.registers.set('a7', this.registers.get('x17'));

        this.registers.set('s0', this.registers.get('x8'));
        this.registers.set('s1', this.registers.get('x9'));
        this.registers.set('s2', this.registers.get('x18'));
        this.registers.set('s3', this.registers.get('x19'));
        this.registers.set('s4', this.registers.get('x20'));
        this.registers.set('s5', this.registers.get('x21'));
        this.registers.set('s6', this.registers.get('x22'));
        this.registers.set('s7', this.registers.get('x23'));
        this.registers.set('s8', this.registers.get('x24'));
        this.registers.set('s9', this.registers.get('x25'));
        this.registers.set('s10', this.registers.get('x26'));
        this.registers.set('s11', this.registers.get('x27'));

        this.register_names = [];
        for (let rname of this.registers.keys()) {
            const reg = this.registers.get(rname);
            if (rname.charAt(0) != 'x')
                this.register_names[reg.bin] = rname;
        }
    }

    //////////////////////////////////////////////////
    // ISA opcodes
    //////////////////////////////////////////////////

    // set up this.opcodes, this.disassembly_table
    // opcode is inst[6:0]
    // funct3 is inst[14:12]
    // funct7 is inst{31:25]
    opcode_info() {
        this.opcodes = new Map();
        
        // eventually we'll use this for instruction encode/decode
        this.opcode_list = [
            {opcode: 'lui', pattern: "iiiiiiiiiiiiiiiiiiiiddddd0110111", type: 'U'},
            {opcode: 'auipc', pattern: "iiiiiiiiiiiiiiiiiiiiddddd0010111", type: 'U'},
            {opcode: 'jal', pattern: "iiiiiiiiiiiiiiiiiiiiddddd1101111", type: 'J'},
            {opcode: 'jalr', pattern: "iiiiiiiiiiiirrrrr000ddddd1100111", type: 'I'},

            {opcode: 'beq', pattern: "IIIIIIIsssssrrrrr000iiiii1100011", type: 'B'},
            {opcode: 'bne', pattern: "IIIIIIIsssssrrrrr001iiiii1100011", type: 'B'},
            {opcode: 'blt', pattern: "IIIIIIIsssssrrrrr100iiiii1100011", type: 'B'},
            {opcode: 'bge', pattern: "IIIIIIIsssssrrrrr101iiiii1100011", type: 'B'},
            {opcode: 'bltu', pattern: "IIIIIIIsssssrrrrr110iiiii1100011", type: 'B'},
            {opcode: 'bgeu', pattern: "IIIIIIIsssssrrrrr111iiiii1100011", type: 'B'},

            {opcode: 'lb', pattern: "IIIIIIIIIIIIrrrrr000ddddd0000011", type: 'I'},
            {opcode: 'lh', pattern: "IIIIIIIIIIIIrrrrr001ddddd0000011", type: 'I'},
            {opcode: 'lw', pattern: "IIIIIIIIIIIIrrrrr010ddddd0000011", type: 'I'},
            {opcode: 'lbu', pattern: "IIIIIIIIIIIIrrrrr100ddddd0000011", type: 'I'},
            {opcode: 'lhu', pattern: "IIIIIIIIIIIIrrrrr101ddddd0000011", type: 'I'},
            {opcode: 'sb', pattern: "IIIIIIIsssssrrrrr000iiiii0100011", type: 'S'},
            {opcode: 'sh', pattern: "IIIIIIIsssssrrrrr001iiiii0100011", type: 'S'},
            {opcode: 'sw', pattern: "IIIIIIIsssssrrrrr010iiiii0100011", type: 'S'},

            {opcode: 'addi', pattern: "IIIIIIIIIIIIrrrrr000ddddd0010011", type: 'I'},
            {opcode: 'slti', pattern: "IIIIIIIIIIIIrrrrr010ddddd0010011", type: 'I'},
            {opcode: 'sltiu', pattern: "IIIIIIIIIIIIrrrrr011ddddd0010011", type: 'I'},
            {opcode: 'xori', pattern: "IIIIIIIIIIIIrrrrr100ddddd0010011", type: 'I'},
            {opcode: 'ori', pattern: "IIIIIIIIIIIIrrrrr110ddddd0010011", type: 'I'},
            {opcode: 'andi', pattern: "IIIIIIIIIIIIrrrrr111ddddd0010011", type: 'I'},

            {opcode: 'slli', pattern: "0000000aaaaarrrrr001ddddd0010011", type: 'I'},
            {opcode: 'srli', pattern: "0000000aaaaarrrrr101ddddd0010011", type: 'I'},
            {opcode: 'srai', pattern: "0100000aaaaarrrrr101ddddd0010011", type: 'I'},

            {opcode: 'add', pattern: "0000000sssssrrrrr000ddddd0110011", type: 'R'},
            {opcode: 'sub', pattern: "0100000sssssrrrrr000ddddd0110011", type: 'R'},
            {opcode: 'sll', pattern: "0000000sssssrrrrr001ddddd0110011", type: 'R'},
            {opcode: 'slt', pattern: "0000000sssssrrrrr010ddddd0110011", type: 'R'},
            {opcode: 'sltu', pattern: "0000000sssssrrrrr011ddddd0110011", type: 'R'},
            {opcode: 'xor', pattern: "0000000sssssrrrrr100ddddd0110011", type: 'R'},
            {opcode: 'srl', pattern: "0000000sssssrrrrr101ddddd0110011", type: 'R'},
            {opcode: 'sra', pattern: "0100000sssssrrrrr101ddddd0110011", type: 'R'},
            {opcode: 'or', pattern: "0000000sssssrrrrr110ddddd0110011", type: 'R'},
            {opcode: 'and', pattern: "0000000sssssrrrrr111ddddd0110011", type: 'R'},

            {opcode: 'fence', pattern: "0000ppppssss00000000000000001111", type: 'R'},
            {opcode: 'fence.i', pattern: "00000000000000000000000000001111", type: 'R'},
            {opcode: 'ecall', pattern: "00000000000000000000000001110011", type: 'R'},
            {opcode: 'ebreak', pattern: "00000000000100000000000001110011", type: 'R'},
            {opcode: 'csrrw', pattern: "ccccccccccccrrrrr001ddddd1110011", type: 'R'},
            {opcode: 'csrrs', pattern: "ccccccccccccrrrrr010ddddd1110011", type: 'R'},
            {opcode: 'csrrc', pattern: "ccccccccccccrrrrr011ddddd1110011", type: 'R'},
            {opcode: 'csrrwi', pattern: "cccccccccccczzzzz101ddddd1110011", type: 'R'},
            {opcode: 'csrrsi', pattern: "cccccccccccczzzzz110ddddd1110011", type: 'R'},
            {opcode: 'csrrci', pattern: "cccccccccccczzzzz111ddddd1110011", type: 'R'},
        ];
        this.extra_opcode_info();   // hook for 64-bit opcodes
        this.inst_codec = new SimTool.InstructionCodec(this.opcode_list, this);

        // RV32I
        this.opcodes.set('lui', { opcode: 0b0110111, type: 'U' });
        this.opcodes.set('auipc', {opcode: 0b0010111, type: 'U' });
        this.opcodes.set('jal', { opcode: 0b1101111, type: 'J' });
        this.opcodes.set('jalr',{ opcode: 0b1100111, funct3: 0b000, type: 'I' });
        this.opcodes.set('beq', { opcode: 0b1100011, funct3: 0b000, type: 'B' });
        this.opcodes.set('bne', { opcode: 0b1100011, funct3: 0b001, type: 'B' });
        this.opcodes.set('blt', { opcode: 0b1100011, funct3: 0b100, type: 'B' });
        this.opcodes.set('bge', { opcode: 0b1100011, funct3: 0b101, type: 'B' });
        this.opcodes.set('bltu',{ opcode: 0b1100011, funct3: 0b110, type: 'B' });
        this.opcodes.set('bgeu',{ opcode: 0b1100011, funct3: 0b111, type: 'B' });
        this.opcodes.set('lb',  { opcode: 0b0000011, funct3: 0b000, type: 'I' });
        this.opcodes.set('lh',  { opcode: 0b0000011, funct3: 0b001, type: 'I' });
        this.opcodes.set('lw',  { opcode: 0b0000011, funct3: 0b010, type: 'I' });
        this.opcodes.set('lbu', { opcode: 0b0000011, funct3: 0b100, type: 'I' });
        this.opcodes.set('lhu', { opcode: 0b0000011, funct3: 0b101, type: 'I' });
        this.opcodes.set('sb',  { opcode: 0b0100011, funct3: 0b000, type: 'S' });
        this.opcodes.set('sh',  { opcode: 0b0100011, funct3: 0b001, type: 'S' });
        this.opcodes.set('sw',  { opcode: 0b0100011, funct3: 0b010, type: 'S' });
        this.opcodes.set('addi',{ opcode: 0b0010011, funct3: 0b000, type: 'I' });
        this.opcodes.set('slti',{ opcode: 0b0010011, funct3: 0b010, type: 'I' });
        this.opcodes.set('sltiu', {opcode: 0b0010011, funct3: 0b011, type: 'I' });
        this.opcodes.set('xori',{ opcode: 0b0010011, funct3: 0b100, type: 'I' });
        this.opcodes.set('ori', { opcode: 0b0010011, funct3: 0b110, type: 'I' });
        this.opcodes.set('andi',{ opcode: 0b0010011, funct3: 0b111, type: 'I' });
        this.opcodes.set('slli',{ opcode: 0b0010011, funct3: 0b001, funct7: 0b0000000, type: 'I' });
        this.opcodes.set('srli',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0000000, type: 'I' });
        this.opcodes.set('srai',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0100000, type: 'I' });
        this.opcodes.set('add', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('sub', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0100000, type: 'R' });
        this.opcodes.set('sll', { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('slt', { opcode: 0b0110011, funct3: 0b010, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('sltu',{ opcode: 0b0110011, funct3: 0b011, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('xor', { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('srl', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('sra', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0100000, type: 'R' });
        this.opcodes.set('or',  { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('and', { opcode: 0b0110011, funct3: 0b111, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('fence', {opcode: 0b0001111, funct3: 0b000, type: 'I', rs: 0, rd: 0 });
        this.opcodes.set('fence.i', {opcode: 0b0001111, funct3: 0b001, type: 'I', rs: 0, rd: 0 });
        this.opcodes.set('ecall', {opcode: 0b1110011, funct3: 0b000, type: 'I', rs: 0, rd: 0, imm: 0 });
        this.opcodes.set('ebreak', {opcode: 0b1110011, funct3: 0b000, type: 'I', rs: 0, rd: 0, imm: 1 });
        this.opcodes.set('csrrw', {opcode: 0b1110011, funct3: 0b001, type: 'I' });
        this.opcodes.set('csrrs', {opcode: 0b1110011, funct3: 0b010, type: 'I' });
        this.opcodes.set('csrrc', {opcode: 0b1110011, funct3: 0b011, type: 'I' });
        this.opcodes.set('csrrwi', {opcode: 0b1110011, funct3: 0b101, type: 'I' });
        this.opcodes.set('csrrsi', {opcode: 0b1110011, funct3: 0b110, type: 'I' });
        this.opcodes.set('csrrci', {opcode: 0b1110011, funct3: 0b111, type: 'I' });

        // RV32M
        //this.opcodes.set('mul', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('mulh',{ opcode: 0b0110011, funct3: 0b001, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('mulhsu', {opcode: 0b0110011, funct3: 0b010, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('mulhu', {opcode: 0b0110011, funct3: 0b011, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('div', { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('divu',{ opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('rem', { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('remu',{ opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' });

        //////////////////////////////////////////////////
        // Disassembly
        //////////////////////////////////////////////////

        // build disassembly tables: tbl[opcode][funct3][funct7]
        this.disassembly_table = [];
        for (let opcode_name of this.opcodes.keys()) {
            const info = this.opcodes.get(opcode_name);

            // first level: 7-bit opcode lookup
            let entry = this.disassembly_table[info.opcode];
            if (entry === undefined) {
                entry = [];
                this.disassembly_table[info.opcode] = entry;
            }

            // is there a second level?
            if (info.funct3 !== undefined) {
                let xentry = entry[info.funct3];
                if (xentry === undefined) {
                    xentry = [];
                    entry[info.funct3] = xentry;
                }
                entry = xentry;

                // is there a third level?
                if (info.funct7 !== undefined) {
                    xentry = entry[info.funct7];
                    if (xentry === undefined) {
                        xentry = [];
                        entry[info.funct7] = xentry;
                    }
                    entry = xentry;
                }
            }

            // leaf of tree: annotate appropriately
            if (entry.opcode_name) {
                //console.log('duplicate?',opcode_name,info,entry);
            } else {
                entry.opcode_name = opcode_name;
                entry.opcode_info = info;
            }
        }

        // define macros for official pseudo ops
        // remember to escape the backslashes in the macro body!
        this.assembly_prologue = `
.macro nop
addi zero,zero,0
.endm
.macro li rd,imm
addi \\rd,zero,\\imm
.endm
.macro mv rd,rd
addi \\rd,\\rs,0
.endm
.macro not rd,rs
xori \\rd,\\rs,0
.endm
.macro neg rd,rs
sub \\rd,zero,\\rs
.endm
.macro sext.w rd,rs
addiw \\rd,\\rs,0
.endm
.macro seqz rd,rs
sltiu \\rs,\\rs,1
.endm
.macro snez rd,rs
slt \\rd,\\rs,zero
.endm
.macro sgtz rd,rs
slt \\rd,zero,\\rs
.endm
.macro beqz rs,offset
beq \\rs,zero,\\offset
.endm
.macro bnez rs,offset
bne \\rs,zero,\\offset
.endm
.macro blez rs,offset
bge zero,\\rs,\\offset
.endm
.macro bgez rs,offset
bge \\rs,zero,\\offset
.endm
.macro bltz rs,offset
blt \\rs,zero,\\offset
.endm
.macro bgtz rs,offset
blt zero,\\rs,\\offset
.endm
.macro bgt rs,rt,offset
blt \\rt,\\rs,\\offset
.endm
.macro ble rs,rt,offset
bge \\rt,\\rs,\\offset
.endm
.macro bgtu rs,rt,offset
bltu \\rt,\\rs,\\offset
.endm
.macro bleu rs,rt,offset
bgeu \\rt,\\rs,\\offset
.endm
.macro j offset
jal zero,\\offset
.endm
.macro jr rs
jalr zero,\\rs
.endm
.macro ret
jalr zero,x1
.endm
`;
    }

    // return text representation of instruction at addr
    disassemble(addr) {
        const inst = this.memory.getUint32(addr,this.little_endian);

        // opcode lookup
        let entry = this.disassembly_table[inst & 0x7F];
        if (entry === undefined) return '???';
        if (entry.opcode_name) {
            return this.disassemble_opcode(inst, entry.opcode_name, entry.opcode_info, addr);
        } else {
            // funct3 look up
            entry = entry[(inst >> 12) & 0x7];
            if (entry === undefined) return '???';
            if (entry.opcode_name) {
                return this.disassemble_opcode(inst, entry.opcode_name, entry.opcode_info, addr);
            } else {
                // funct7 lookup
                entry = entry[(inst >> 25) & 0x7F];
                if (entry === undefined || entry.opcode_name === undefined) return '???';
                return this.disassemble_opcode(inst, entry.opcode_name, entry.opcode_info, addr);
            }
        }
    }

    //////////////////////////////////////////////////
    // Assembly
    //////////////////////////////////////////////////

    // interpret operand as a register, returning its number
    // or undefined it's not a register
    expect_register(operand, oname) {
        if (operand.length === 1) {
            const rinfo = this.registers.get(operand[0].token.toLowerCase());
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
        let reg = operand[0].token.toLowerCase();
        if (len === 1 && this.registers.has(reg)) {
            result.base = this.registers.get(reg).bin;
            return result;
        }

        // check for (base)
        if (len >= 3 && operand[len-1].token === ')' && operand[len-3].token === '(') {
            reg = operand[len-2].token.toLowerCase90;
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

    // branches
    assemble_B_type(opcode, operands, info) {
        if (operands.length != 3)
            throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

        const rs1 = this.expect_register(operands[0], 'rs1');
        const rs2 = this.expect_register(operands[1], 'rs2');
        let imm = this.read_expression(operands[2]);
        if (imm === undefined)
            this.syntax_error(`"${opcode.token}" expects an address expression as its third operand`,
                                 operands[2][0].start, operands[2][operands[2].length - 1].end);
        if (this.pass === 2) {
            imm = Number(this.eval_expression(imm));
            imm -= this.dot();  // compute offset
            if (imm < -2048 || imm > 2047)
                this.syntax_error(`Expression evaluates to an offset of ${imm.toString()}, which is too large to fit in the immediate field. `,
                                  operands[2][0].start, operands[2][operands[2].length - 1].end);
        } else imm = 0;
        this.emit32(info.opcode | (info.funct3 << 12) |
                    ((rs1 & 0x3F) << 15) | ((rs2 & 0x3F) << 20) |
                    (((imm >> 11) & 0x1) << 7) |
                    (((imm >> 1) & 0xF) << 8) |
                    (((imm >> 5) & 0x3F) << 25) |
                    (((imm >> 12) & 0x1) << 31));
        return true;

    }
    
    // register-immediate and loads
    assemble_I_type(opcode, operands, info) {
        // check for register-immediate instructions
        if (info.opcode === this.opcodes.get('addi').opcode) {
            if (operands.length != 3)
                throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

            const rd = this.expect_register(operands[0], 'rd');
            const rs1 = this.expect_register(operands[1], 'rs1');
            let imm = this.read_expression(operands[2]);
            if (imm === undefined)
                this.syntax_error(`"${opcode.token}" expects an numeric expression as its third operand`,
                                  operands[2][0].start, operands[2][operands[2].length - 1].end);

            if (this.pass === 2) {
                imm = Number(this.eval_expression(imm));   // avoid BigInts
                if (imm < -(1 << 11) || imm >= (1 << 11))
                    this.syntax_error(`Value (${imm.toString()}) is too large to fit in the 12-bit immediate field. `,
                                       operands[2][0].start, operands[2][operands[2].length - 1].end);
            } else imm = 0;

            // shift-immediate instructions use bottom 5 bits (6 bits in 64-bit ISA) of imm as shift count
            if (info.funct7 !== undefined) imm = (imm & (this.register_nbits == 64 ? 0x3F : 0x1F)) | (info.funct7 << 5);

            this.emit32(info.opcode | (rd << 7) | (info.funct3 << 12) | (rs1 << 15) |
                        ((imm & 0xFFF) << 20));
            return true;
        }
            
        // check for base_and_offset instructions (lb..., jalr)
        if (info.opcode === this.opcodes.get('lb').opcode || info.opcode === this.opcodes.get('jalr').opcode) {
            if (operands.length != 2)
                throw opcode.asSyntaxError(`"${opcode.token}" expects two operands`);
            const rd = this.expect_register(operands[0], 'rd');
            const bo = this.expect_base_and_offset(operands[1]);
            this.emit32(info.opcode | (rd << 7) | (info.funct3 << 12) | (bo.base << 15) |
                        ((bo.offset & 0xFFF) << 20));
            return true;
        }

        // check for system instructions

        this.incr_dot(4);
        return true;
    }
    
    // jal
    assemble_J_type(opcode, operands, info) {
        if (operands.length != 2)
            throw opcode.asSyntaxError(`"${opcode.token}" expects two operands`);
        const rd = this.expect_register(operands[0], 'rd');
        let imm = this.read_expression(operands[1]);
        if (imm === undefined)
            this.syntax_error(`"${opcode.token}" expects an address expression as its second operand`,
                              operands[1][0].start, operands[1][operands[1].length - 1].end);
        if (this.pass === 2) {
            imm = Number(this.eval_expression(imm));
            imm -= this.dot();  // compute offset
            if (imm < -(1<<20) || imm >= (1<<20))
                this.syntax_error(`Offset (${imm.toString()}) is too large to fit in the 21-bit immediate field. `,
                                  operands[2][0].start, operands[2][operands[2].length - 1].end);
        } else imm = 0;

        this.emit32(info.opcode | (rd << 7) |
                    (((imm >> 12) & 0xFF) << 12) |
                    (((imm >> 11) & 0x1) << 20) |
                    (((imm >> 1) & 0x3FF) << 21) |
                    (((imm >> 20) & 0x1) << 31));
        return true;
    }

    // rd = rs1 op rs2
    assemble_R_type(opcode, operands, info) {
        if (operands.length != 3)
            throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);
        const rd = this.expect_register(operands[0], 'rd');
        const rs1 = this.expect_register(operands[1], 'rs1');
        const rs2 = this.expect_register(operands[2], 'rs2');
        this.emit32(info.opcode | (rd << 7) | (info.funct3 << 12) | (rs1 << 15) |
                    (rs2 << 20) | (info.funct7 << 25));
        return true;
    }

    // store
    assemble_S_type(opcode, operands, info) {
        if (operands.length != 2)
            throw opcode.asSyntaxError(`"${opcode.token}" expects two operands`);
        const rs2 = this.expect_register(operands[0], 'rs2');
        const bo = this.expect_base_and_offset(operands[1]);
        this.emit32(info.opcode | ((bo.offset & 0x1F) << 7) | (info.funct3 << 12) |
                    (bo.base << 15) | (rs2 << 20) | (((bo.offset >> 5) & 0x7F) << 25));
        return true;
    }
    
    // lui, auipc
    assemble_U_type(opcode, operands, info) {
        if (operands.length != 2)
            throw opcode.asSyntaxError(`"${opcode.token}" expects two operands`);
        const rd = this.expect_register(operands[0], this, 'rd');

        let imm = this.read_expression(operands[1]);
        if (imm === undefined)
            this.syntax_error(`"${opcode.token}" expects an address expression as its second operand`,
                              operands[1][0].start, operands[1][operands[1].length - 1].end);
        if (this.pass === 2) {
            imm = Number(this.eval_expression(imm));
            // form offset for auipc
            if (info.opcode === this.opcodes.get('auipc').opcode) imm -= this.dot();
        } else imm = 0;
        this.emit32(info.opcode | ((rd & 0x3F) << 7) | ((imm & 0xFFFFF) << 12));
        return true;
    }

    // return undefined if opcode not recognized, otherwise number of bytes
    // occupied by assembled instruction.
    // Call results.emit32(inst) to store binary into main memory at dot.
    // Call results.syntax_error(msg, start, end) to report an error
    assemble_opcode(opcode, operands) {
        if (opcode.type !== 'symbol') return undefined;
        const info = this.opcodes.get(opcode.token.toLowerCase());
        if (info === undefined) return undefined;

        if (info.type === 'R')
            return this.assemble_R_type(opcode, operands, info);
        if (info.type === 'I')
            return this.assemble_I_type(opcode, operands, info);
        if (info.type === 'B')
            return this.assemble_B_type(opcode, operands, info);
        if (info.type === 'S')
            return this.assemble_S_type(opcode, operands, info);
        if (info.type === 'J')
            return this.assemble_J_type(opcode, operands, info);
        if (info.type === 'U')
            return this.assemble_U_type(opcode, operands, info);
        return undefined;
    }
}

//////////////////////////////////////////////////
// RISC-V32
//////////////////////////////////////////////////

SimTool.RISCV32Tool = class extends(SimTool.RISCVTool) {
    constructor(tool_div) {
        super(tool_div, 'RISC-V32');
    }

    emulation_initialize() {
        this.register_nbits = 32;       // 32-bit registers
        this.pc = 0;

        super.emulation_initialize();
    }

    emulation_reset() {
        this.pc = 0;
        this.register_file.fill(0);
        super.emulation_reset();
    }

    // convert virtual address to physical address
    // NB: physical address is a Number
    va_to_phys(va) {
        // no MMU (yet...)
        return va;
    }

    extra_opcode_info() { }

    // NB: rd fields of zero are redirected to this.register_file[32]
    disassemble_opcode(v, opcode, info, addr) {
        if (info === undefined) return '???';

        if (info.type === 'R') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    rs1: rs1,
                    rs2: rs2,
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${this.register_names[rs2]}`;
        }
        if (info.type === 'I') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            let imm = (v >> 20) & 0xFFF;
            if (imm >= (1<<11)) imm -= (1 << 12);  // sign extension

            // shift-immediate instructions only use low-order 5 bits of imm
            if (info.funct7) imm &= 0x1F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    rs1: rs1,
                    imm: imm,
                    handler: this.inst_handlers.get(opcode)
                };

            // base and offset
            if (info.opcode === this.opcodes.get('lb').opcode || info.opcode === this.opcodes.get('jalr').opcode) {
                if (imm === 0) {
                    return `${opcode} ${this.register_names[rd]},(${this.register_names[rs1]})`;
                } else if (rs1 === 0) {
                    return `${opcode} ${this.register_names[rd]},${imm}`;
                }
            } else
                return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${imm}`;
        }
        if (info.type === 'S') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ((v >> 7) & 0x1F) | (((v >> 25) & 0x7F) << 5);
            if (imm > ((1<<11) - 1)) imm -= (1 << 12);  // sign extension

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rs1: rs1,
                    rs2: rs2,
                    imm: imm,
                    handler: this.inst_handlers.get(opcode)
                };

            if (imm === 0) {
                return `${opcode} ${this.register_names[rs2]},(${this.register_names[rs1]})`;
            } else if (rs1 === 0) {
                return `${opcode} ${this.register_names[rs2]},${imm}`;
            }
        }
        if (info.type === 'B') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ( (((v >> 7) & 0x1) << 11) |
                        (((v >> 8) & 0xF) << 1) |
                        (((v >> 25) & 0x3F) << 5) |
                        (((v >> 31) & 0x1) << 12) );
            if (imm >= (1 << 12)) imm -= (1 << 13);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rs1: rs1,
                    rs2: rs2,
                    imm: imm,
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rs1]},${this.register_names[rs2]},0x${imm.toString(16)}`;
        }
        if (info.type === 'U') {
            const rd = (v >> 7) & 0x1F;
            let imm = (v >> 12) & 0xFFFFF;
            if (imm >= (1 << 19)) imm -= (1 << 20);  // sign extension
            imm = imm << 12;
            if (info.opcode === this.opcodes.get('auipc').opcode) imm += addr;
            imm &= ~0xFFF;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    imm: imm,
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},0x${(imm < 0 ? imm+0x100000000 : imm) .toString(16)}`;
        }
        if (info.type === 'J') {
            const rd = (v >> 7) & 0x1F;
            let imm = ( (((v >> 12) & 0xFF) << 12) |
                        (((v >> 20) & 0x1) << 11) |
                        (((v >> 21) & 0x3FF) << 1) |
                        (((v >> 31) & 0x1) << 20) );
            if (imm >= (1<<20)) imm -= (1 << 21);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    imm: imm,
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},0x${(imm).toString(16)}`;;
        }
        return opcode + '???';
    }

    // define functions that emulate each opcode
    opcode_handlers() {
        const tool = this;  // for reference by handlers

        this.inst_handlers = new Map();  // execution handlers: opcode => function
 
        // NB: "0 | x" converts Number x to a signed 32-bit value
        // NB: "x >>> 0" converts Number x to a unsigned 32-bit value

        //////////////////////////////////////////////////
        //  Branches
        //////////////////////////////////////////////////

        this.inst_handlers.set('jal',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.pc + 4);
            // this.pc has already been added to imm...
            tool.pc = decode.imm;

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('jalr',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.pc + 4);

            // jalr clears low bit of the target address
            tool.pc = 0 | ((tool.register_file[decode.rs1] + decode.imm) & ~0x1);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('beq',function (decode, gui) {
            if (tool.register_file[decode.rs1] === tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bne',function (decode, gui) {
            if (tool.register_file[decode.rs1] != tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('blt',function (decode, gui) {
            if (tool.register_file[decode.rs1] < tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bge',function (decode, gui) {
            if (tool.register_file[decode.rs1] >= tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bltu',function (decode, gui) {
            // >>> operator converts args to unsigned integers
            if ((tool.register_file[decode.rs1]>>>0) < (tool.register_file[decode.rs2]>>>0)) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bgeu',function (decode, gui) {
            // >>> operator converts args to unsigned integers
            if ((tool.register_file[decode.rs1]>>>0) >= (tool.register_file[decode.rs2]>>>0)) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        //////////////////////////////////////////////////
        //  Load/Store
        //////////////////////////////////////////////////

        this.inst_handlers.set('lui',function (decode, gui) {
            // set bits 31:12 of RD, sign-extend
            tool.register_file[decode.rd] = decode.imm << 12;
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('auipc',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (this.pc + (decode.imm << 12));
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('lb',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            tool.register_file[decode.rd] = tool.memory.getInt8(PA, true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lbu',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            tool.register_file[decode.rd] = tool.memory.getUint8(PA, true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lh',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            tool.register_file[decode.rd] = tool.memory.getInt16(PA, true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lhu',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            tool.register_file[decode.rd] = tool.memory.getUint16(PA, true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lw',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            tool.register_file[decode.rd] = tool.memory.getInt32(PA, true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('sb',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            tool.memory.setInt8(PA, tool.register_file[decode.rs2], true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(EA, true));
            }
        });

        this.inst_handlers.set('sh',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            // complain if not halfword aligned?
            tool.memory.setInt16(PA, tool.register_file[decode.rs2], true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(PA, true));
            }
        });

        this.inst_handlers.set('sw',function (decode, gui) {
            const EA = 0 | (tool.register_file[decode.rs1] + decode.imm);
            const PA = tool.va_to_phys(EA);
            // complain if not word aligned?
            tool.memory.setInt32(PA, tool.register_file[decode.rs2], true);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(PA, true));
            }
        });

        //////////////////////////////////////////////////
        //  Arithmetic
        //////////////////////////////////////////////////

        this.inst_handlers.set('addi',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] + decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('add',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] + tool.register_file[decode.rs2]);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sub',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] -  tool.register_file[decode.rs2]);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        // RV32M

        this.inst_handlers.set('mul',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulh',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhsu',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhu',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('div',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('divu',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('rem',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        this.inst_handlers.set('remu',function (decode, gui) {
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
            }
        });

        //////////////////////////////////////////////////
        //  Boolean
        //////////////////////////////////////////////////

        this.inst_handlers.set('or',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] |  tool.register_file[decode.rs2]);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('ori',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] | decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('and',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] & tool.register_file[decode.rs2]);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('andi',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] & decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('xor',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] ^  tool.register_file[decode.rs2]);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('xori',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] ^ decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        //////////////////////////////////////////////////
        //  Shift
        //////////////////////////////////////////////////

        this.inst_handlers.set('sll',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] << (tool.register_file[decode.rs2] & 0x1F));
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('slli',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] << decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srl',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] >>> (tool.register_file[decode.rs2] & 0x1F));
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srli',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] >>> decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sra',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] >> (tool.register_file[decode.rs2] & 0x1F));
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srai',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] >> decode.imm);
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        //////////////////////////////////////////////////
        //  Test
        //////////////////////////////////////////////////

        this.inst_handlers.set('slti',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] < decode.imm) ? 1 : 0;
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sltiu',function (decode, gui) {
            tool.register_file[decode.rd] = ((tool.register_file[decode.rs1] >>> 0) < decode.imm) ? 1 : 0;
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('slt',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] < tool.register_file[decode.rs2]) ? 1 : 0;
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sltu',function (decode, gui) {
            tool.register_file[decode.rd] = ((tool.register_file[decode.rs1]>>>0) < (tool.register_file[decode.rs2]>>>0)) ? 1 : 0;
            tool.pc = 0 | (tool.pc + 4);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });
    }
}

//////////////////////////////////////////////////
// RISC-V64
//////////////////////////////////////////////////

SimTool.RISCV64Tool = class extends(SimTool.RISCVTool) {
    constructor(tool_div) {
        super(tool_div, 'RISC-V64');
    }

    emulation_initialize() {
        this.register_nbits = 64;       // 64-bit registers
        this.pc = 0n;
        super.emulation_initialize();
    }

    emulation_reset() {
        this.pc = 0n;
        this.register_file.fill(0n);
        super.emulation_reset();
    }

    // convert virtual address to physical address
    // NB: physical address is a Number
    va_to_phys(va) {
        // no MMU (yet...)
        return Number(va);
    }

    extra_opcode_info() {
        this.opcode_list.push({opcode: 'lwu', pattern: "IIIIIIIIIIIIrrrrr110ddddd0000011", type: 'I'});
        this.opcode_list.push({opcode: 'ld', pattern: "IIIIIIIIIIIIrrrrr011ddddd0000011", type: 'I'});
        this.opcode_list.push({opcode: 'sd', pattern: "IIIIIIIsssssrrrrr011iiiii0100011", type: 'S'});
        this.opcode_list.push({opcode: 'slli', pattern: "000000aaaaaarrrrr001ddddd0010011", type: 'I'});
        this.opcode_list.push({opcode: 'srli', pattern: "000000aaaaaarrrrr101ddddd0010011", type: 'I'});
        this.opcode_list.push({opcode: 'srai', pattern: "010000aaaaaarrrrr101ddddd0010011", type: 'I'});
        this.opcode_list.push({opcode: 'addiw', pattern: "IIIIIIIIIIIIrrrrr000ddddd0011011", type: 'I'});
        this.opcode_list.push({opcode: 'sllwi', pattern: "0000000aaaaarrrrr001ddddd0011011", type: 'I'});
        this.opcode_list.push({opcode: 'srliw', pattern: "0000000aaaaarrrrr101ddddd0011011", type: 'I'});
        this.opcode_list.push({opcode: 'sraiw', pattern: "0100000aaaaarrrrr101ddddd0011011", type: 'I'});
        this.opcode_list.push({opcode: 'addw', pattern: "0000000sssssrrrrr000ddddd0111011", type: 'R'});
        this.opcode_list.push({opcode: 'subw', pattern: "0100000sssssrrrrr000ddddd0111011", type: 'R'});
        this.opcode_list.push({opcode: 'sllw', pattern: "0000000sssssrrrrr001ddddd0111011", type: 'R'});
        this.opcode_list.push({opcode: 'srlw', pattern: "0000000sssssrrrrr101ddddd0111011", type: 'R'});
        this.opcode_list.push({opcode: 'sraw', pattern: "0100000sssssrrrrr101ddddd0111011", type: 'R'});

        // RV64I
        this.opcodes.set('lwu',  { opcode: 0b0000011, funct3: 0b110, type: 'I' });
        this.opcodes.set('ld',   { opcode: 0b0000011, funct3: 0b011, type: 'I' });
        this.opcodes.set('sd',   { opcode: 0b0100011, funct3: 0b011, type: 'S' });
        this.opcodes.set('addiw',{ opcode: 0b0010011, funct3: 0b000, type: 'I' });
        this.opcodes.set('slliw',{ opcode: 0b0010011, funct3: 0b001, funct7: 0b0000000, type: 'I' });
        this.opcodes.set('srliw',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0000000, type: 'I' });
        this.opcodes.set('sraiw',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0100000, type: 'I' });
        this.opcodes.set('addw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('subw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0100000, type: 'R' });
        this.opcodes.set('sllw', { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('srlw', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000000, type: 'R' });
        this.opcodes.set('sraw', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0100000, type: 'R' });

        // RV64M
        //this.opcodes.set('mulw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('divw', { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('divuw',{ opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('remw', { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('remuw',{ opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' });
    }

    // NB: rd fields of zero are redirected to this.register_file[32]
    disassemble_opcode(v, opcode, info, addr) {
        if (info === undefined) return '???';

        if (info.type === 'R') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    rs1: rs1,
                    rs2: rs2,
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${this.register_names[rs2]}`;
        }
        if (info.type === 'I') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            let imm = (v >> 20) & 0xFFF;
            if (imm >= (1<<11)) imm -= (1 << 12);  // sign extension

            // shift-immediate instructions only use low-order 5 bits of imm
            if (info.funct7) imm &= 0x3F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    rs1: rs1,
                    imm: BigInt(imm),
                    handler: this.inst_handlers.get(opcode)
                };

            // base and offset
            if (info.opcode === this.opcodes.get('lb').opcode || info.opcode === this.opcodes.get('jalr').opcode) {
                if (imm === 0) {
                    return `${opcode} ${this.register_names[rd]},(${this.register_names[rs1]})`;
                } else if (rs1 === 0) {
                    return `${opcode} ${this.register_names[rd]},${imm}`;
                }
            } else
                return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${imm}`;
        }
        if (info.type === 'S') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ((v >> 7) & 0x1F) | (((v >> 25) & 0x7F) << 5);
            if (imm > ((1<<11) - 1)) imm -= (1 << 12);  // sign extension

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rs1: rs1,
                    rs2: rs2,
                    imm: BigInt(imm),
                    handler: this.inst_handlers.get(opcode)
                };

            if (imm === 0) {
                return `${opcode} ${this.register_names[rs2]},(${this.register_names[rs1]})`;
            } else if (rs1 === 0) {
                return `${opcode} ${this.register_names[rs2]},${imm}`;
            }
        }
        if (info.type === 'B') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ( (((v >> 7) & 0x1) << 11) |
                        (((v >> 8) & 0xF) << 1) |
                        (((v >> 25) & 0x3F) << 5) |
                        (((v >> 31) & 0x1) << 12) );
            if (imm >= (1 << 12)) imm -= (1 << 13);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rs1: rs1,
                    rs2: rs2,
                    imm: BigInt(imm),
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rs1]},${this.register_names[rs2]},0x${imm.toString(16)}`;
        }
        if (info.type === 'U') {
            const rd = (v >> 7) & 0x1F;
            let imm = (v >> 12) & 0xFFFFF;
            if (imm >= (1 << 19)) imm -= (1 << 20);  // sign extension
            imm = imm << 12;
            if (info.opcode === this.opcodes.get('auipc').opcode) imm += addr;
            imm &= ~0xFFF;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    imm: BigInt(imm),
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},0x${(imm < 0 ? imm+0x100000000 : imm) .toString(16)}`;
        }
        if (info.type === 'J') {
            const rd = (v >> 7) & 0x1F;
            let imm = ( (((v >> 12) & 0xFF) << 12) |
                        (((v >> 20) & 0x1) << 11) |
                        (((v >> 21) & 0x3FF) << 1) |
                        (((v >> 31) & 0x1) << 20) );
            if (imm >= (1<<20)) imm -= (1 << 21);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {
                    rd: rd || 32,    // writes to x0 go to reg[32]
                    imm: BigInt(imm),
                    handler: this.inst_handlers.get(opcode)
                };

            return `${opcode} ${this.register_names[rd]},0x${(imm).toString(16)}`;;
        }
        return opcode + '???';
    }

    // define functions that emulate each opcode
    opcode_handlers() {
        const tool = this;  // for reference by handlers

        this.inst_handlers = new Map();  // execution handlers: opcode => function

        //////////////////////////////////////////////////
        //  Branches
        //////////////////////////////////////////////////

        this.inst_handlers.set('jal',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(64, tool.pc + 4n);
            // this.pc has already been added to imm...
            tool.pc = decode.imm;

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('jalr',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(64, tool.pc + 4n);

            // jalr clears low bit of the target address
            tool.pc = (tool.register_file[decode.rs1] + decode.imm) & ~(1n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('beq',function (decode, gui) {
            if (tool.register_file[decode.rs1] === tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bne',function (decode, gui) {
            if (tool.register_file[decode.rs1] != tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('blt',function (decode, gui) {
            if (tool.register_file[decode.rs1] < tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bge',function (decode, gui) {
            if (tool.register_file[decode.rs1] >= tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bltu',function (decode, gui) {
            if (BigInt.asUintN(64, tool.register_file[decode.rs1]) < BigInt.asUintN(64, tool.register_file[decode.rs2])) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bgeu',function (decode, gui) {
            if (BigInt.asUintN(64, tool.register_file[decode.rs1]) >= BigInt.asUintN(64, tool.register_file[decode.rs2])) {
                // this.pc has already been added to imm...
                if (tool.pc === decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        //////////////////////////////////////////////////
        //  Load/Store
        //////////////////////////////////////////////////

        this.inst_handlers.set('lui',function (decode, gui) {
            // set bits 31:12 of RD, sign-extend
            tool.register_file[decode.rd] = BigInt.asIntN(32, decode.imm << 12n);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('auipc',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, BigInt(this.pc) + (decode.imm << 12n));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('lb',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(EA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getInt8(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lbu',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getUint8(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lh',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getInt16(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lhu',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getUint16(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lw',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getInt32(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('lwu',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getUint32(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('ld',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.register_file[decode.rd] = BigInt(tool.memory.getBigInt64(PA, this.little_endian));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(PA);
            }
        });

        this.inst_handlers.set('sb',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            tool.memory.setInt8(PA, BigInt.asIntN(8,tool.register_file[decode.rs2]), this.little_endian);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(PA, this.little_endian));
            }
        });

        this.inst_handlers.set('sh',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            // complain if not halfword aligned?
            tool.memory.setInt16(PA, BigInt.asIntN(16,tool.register_file[decode.rs2]), this.little_endian);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(PA, this.little_endian));
            }
        });

        this.inst_handlers.set('sw',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            // complain if not word aligned?
            tool.memory.setInt32(PA, BigInt.asIntN(32, tool.register_file[decode.rs2]), this.little_endian);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getInt32(PA, true));
            }
        });

        this.inst_handlers.set('sd',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            const PA = tool.va_to_phys(VA);
            // complain if not word aligned?
            tool.memory.setBigInt64(PA, tool.register_file[decode.rs2], this.little_endian);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(PA, tool.memory.getBigInt64(PA, this.little_endian));
            }
        });
                               
        //////////////////////////////////////////////////
        //  Arithmetic
        //////////////////////////////////////////////////

        this.inst_handlers.set('addi',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] + decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('addiw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, tool.register_file[decode.rs1] + decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });
    
        this.inst_handlers.set('add',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] + tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('addw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, tool.register_file[decode.rs1] + tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sub',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] -  tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('subw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, tool.register_file[decode.rs1] -  tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        // RV32M

        this.inst_handlers.set('mul',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulh',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhsu',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhu',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('div',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('divu',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('rem',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        this.inst_handlers.set('remu',function (decode, gui) {
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
            }
        });

        //////////////////////////////////////////////////
        //  Boolean
        //////////////////////////////////////////////////

        this.inst_handlers.set('or',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] |  tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('ori',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] | decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('and',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] & tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('andi',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] & decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('xor',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] ^  tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('xori',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] ^ decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        //////////////////////////////////////////////////
        //  Shift
        //////////////////////////////////////////////////

        this.inst_handlers.set('sll',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] << BigInt.asUintN(6, rool.register_file[decode.rs2]));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sllw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, tool.register_file[decode.rs1] << BigInt.asUintN(6, rool.register_file[decode.rs2]));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });
                               
        this.inst_handlers.set('slli',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(64, tool.register_file[decode.rs1] << decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('slliw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asIntN(32, tool.register_file[decode.rs1] << decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });
                               
        this.inst_handlers.set('srl',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(64, tool.register_file[decode.rs1]) >> BigInt.asUintN(6, tool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srlw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(32, tool.register_file[decode.rs1]) >> BigInt.asUintN(6, rool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srli',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(64, tool.register_file[decode.rs1]) >> decode.imm;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srliw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(32, tool.register_file[decode.rs1]) >> decode.imm;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });
                               
        this.inst_handlers.set('sra',function (decode, gui) {
            tool.register_file[decode.rd] = tool.register_file[decode.rs1] >> BigInt.asUintN(6, rool.register_file[decode.rs2]);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sraw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInt.asUintN(32, tool.register_file[decode.rs1] >> BigInt.asUintN(6, rool.register_file[decode.rs2]));
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srai',function (decode, gui) {
            tool.register_file[decode.rd] = tool.register_file[decode.rs1] >> decode.imm;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sraiw',function (decode, gui) {
            tool.register_file[decode.rd] = BigInit.asUintN(32, tool.register_file[decode.rs1] >> decode.imm);
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        //////////////////////////////////////////////////
        //  Test
        //////////////////////////////////////////////////

        this.inst_handlers.set('slti',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] < decode.imm) ? 1n : 0n;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sltiu',function (decode, gui) {
            tool.register_file[decode.rd] = (BigInt.asUintN(64, tool.register_file[decode.rs1]) < BigInt.asUintN(64, decode.imm)) ? 1n : 0n;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });


        this.inst_handlers.set('slt',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] < tool.register_file[decode.rs2]) ? 1n : 0n
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sltu',function (decode, gui) {
            tool.register_file[decode.rd] = (BigInt.asUintN(64, tool.register_file[decode.rs1]) < BigInt.asUintN(64, tool.register_file[decode.rs2])) ? 1n : 0n;
            tool.pc = BigInt.asUintN(64, tool.pc + 4n);

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

    }
}

//////////////////////////////////////////////////
// RISC-V syntax coloring
//////////////////////////////////////////////////

CodeMirror.defineMode('RISC-V', function() {
    'use strict';

    const line_comment = '#';
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
        'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'x31',
        'zero', 'ra', 'sp', 'gp', 'tp', 'fp',
        't0', 't1', 't2', 't3', 't4', 't5', 't6',
        'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
        's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'
    ];

    // mode object for CodeMirror
    return {
        mode_name: 'RISC-V',
        lineComment: '#',
        blockCommentStart: '/*',
        blockCommentEnd: '*/',

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

// set up GUI in any div.riscv_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('riscv32_tool')) {
        new SimTool.RISCV32Tool(div);
    }
    for (let div of document.getElementsByClassName('riscv64_tool')) {
        new SimTool.RISCV64Tool(div);
    }
});
