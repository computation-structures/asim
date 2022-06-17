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
    constructor(tool_div, for_edx) {
        // calls this.emulation_initialize()
        super(tool_div, 'riscv_tool.8', 'riscv', for_edx);

        this.build_cm_mode();
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

        this.data_section_alignment = 256;
        this.bss_section_alignment = 8;
        this.address_space_alignment = 256;

        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 2;

        // ISA-specific tables and storage
        this.pc = 0;
        this.register_file = new Array(32);
        this.memory = new DataView(new ArrayBuffer(256));  // assembly will replace this

        this.register_info();
        this.opcode_info();
        this.opcode_handlers();

        // reset to initial state
        this.emulation_reset();
    }

    // reset emulation state to initial values
    emulation_reset() {
        this.pc = 0;
        this.register_file.fill(0);

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
        this.opcodes.set('mul', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('mulh',{ opcode: 0b0110011, funct3: 0b001, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('mulhsu', {opcode: 0b0110011, funct3: 0b010, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('mulhu', {opcode: 0b0110011, funct3: 0b011, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('div', { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('divu',{ opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('rem', { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' });
        this.opcodes.set('remu',{ opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' });

        // RV64I
        //this.opcodes.set('lwu',  { opcode: 0b0000011, funct3: 0b110, type: 'I' });
        //this.opcodes.set('ld',   { opcode: 0b0000011, funct3: 0b011, type: 'I' });
        //this.opcodes.set('sd',   { opcode: 0b0100011, funct3: 0b011, type: 'S' });
        //this.opcodes.set('addiw',{ opcode: 0b0010011, funct3: 0b000, type: 'I' });
        //this.opcodes.set('slliw',{ opcode: 0b0010011, funct3: 0b001, funct7: 0b0000000, type: 'I' });
        //this.opcodes.set('srliw',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0000000, type: 'I' });
        //this.opcodes.set('sraiw',{ opcode: 0b0010011, funct3: 0b101, funct7: 0b0100000, type: 'I' });
        //this.opcodes.set('addw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000000, type: 'R' });
        //this.opcodes.set('subw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0100000, type: 'R' });
        //this.opcodes.set('sllw', { opcode: 0b0110011, funct3: 0b001, funct7: 0b0000000, type: 'R' });
        //this.opcodes.set('srlw', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0000000, type: 'R' });
        //this.opcodes.set('sraw', { opcode: 0b0110011, funct3: 0b101, funct7: 0b0100000, type: 'R' });

        // RV64M
        //this.opcodes.set('mulw', { opcode: 0b0110011, funct3: 0b000, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('divw', { opcode: 0b0110011, funct3: 0b100, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('divuw',{ opcode: 0b0110011, funct3: 0b101, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('remw', { opcode: 0b0110011, funct3: 0b110, funct7: 0b0000001, type: 'R' });
        //this.opcodes.set('remuw',{ opcode: 0b0110011, funct3: 0b111, funct7: 0b0000001, type: 'R' });

        //////////////////////////////////////////////////
        // Diassembly
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

    // NB: rd fields of zero are redirected to this.register_file[-1]
    disassemble_opcode(v, opcode, info, addr) {
        if (info === undefined) return '???';

        if (info.type == 'R') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rd: rd || -1, rs1: rs1, rs2: rs2,
                                       handler: this.inst_handlers.get(opcode)};

            return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${this.register_names[rs2]}`;
        }
        if (info.type == 'I') {
            const rd = (v >> 7) & 0x1F;
            const rs1 = (v >> 15) & 0x1F;
            let imm = (v >> 20) & 0xFFF;
            if (imm >= (1<<11)) imm -= (1 << 12);  // sign extension

            // shift-immediate instructions only use low-order 5 bits of imm
            if (info.funct7) imm &= 0x1F;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rd: rd || -1, rs1: rs1, imm: imm,
                                       handler: this.inst_handlers.get(opcode)};

            // base and offset
            if (info.opcode == this.opcodes.get('lb').opcode || info.opcode == this.opcodes.get('jalr').opcode) {
                if (imm == 0) {
                    return `${opcode} ${this.register_names[rd]},(${this.register_names[rs1]})`;
                } else if (rs1 == 0) {
                    return `${opcode} ${this.register_names[rd]},${imm}`;
                }
            } else
                return `${opcode} ${this.register_names[rd]},${this.register_names[rs1]},${imm}`;
        }
        if (info.type == 'S') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ((v >> 7) & 0x1F) | (((v >> 25) & 0x7F) << 5);
            if (imm > ((1<<11) - 1)) imm -= (1 << 12);  // sign extension

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rs1: rs1, rs2: rs2, imm: imm,
                                       handler: this.inst_handlers.get(opcode)};

            if (imm == 0) {
                return `${opcode} ${this.register_names[rs2]},(${this.register_names[rs1]})`;
            } else if (rs1 == 0) {
                return `${opcode} ${this.register_names[rs2]},${imm}`;
            }
        }
        if (info.type == 'B') {
            const rs1 = (v >> 15) & 0x1F;
            const rs2 = (v >> 20) & 0x1F;
            let imm = ( (((v >> 7) & 0x1) << 11) |
                        (((v >> 8) & 0xF) << 1) |
                        (((v >> 25) & 0x3F) << 5) |
                        (((v >> 31) & 0x1) << 12) );
            if (imm >= (1 << 12)) imm -= (1 << 13);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rs1: rs1, rs2: rs2, imm: imm,
                                       handler: this.inst_handlers.get(opcode)};

            return `${opcode} ${this.register_names[rs1]},${this.register_names[rs2]},0x${imm.toString(16)}`;
        }
        if (info.type == 'U') {
            const rd = (v >> 7) & 0x1F;
            let imm = (v >> 12) & 0xFFFFF;
            if (imm >= (1 << 19)) imm -= (1 << 20);  // sign extension
            imm = imm << 12;
            if (info.opcode == this.opcodes.get('auipc').opcode) imm += addr;
            imm &= ~0xFFF;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rd: rd || -1, imm: imm,
                                       handler: this.inst_handlers.get(opcode)};

            return `${opcode} ${this.register_names[rd]},0x${(imm < 0 ? imm+0x100000000 : imm) .toString(16)}`;
        }
        if (info.type == 'J') {
            const rd = (v >> 7) & 0x1F;
            let imm = ( (((v >> 12) & 0xFF) << 12) |
                        (((v >> 20) & 0x1) << 11) |
                        (((v >> 21) & 0x3FF) << 1) |
                        (((v >> 31) & 0x1) << 20) );
            if (imm >= (1<<20)) imm -= (1 << 21);   // sign extension
            imm += addr;

            if (this.inst_decode)
                this.inst_decode[addr/4] = {rd: rd || -1, imm: imm,
                                       handler: this.inst_handlers.get(opcode)};

            return `${opcode} ${this.register_names[rd]},0x${(imm).toString(16)}`;;
        }
        return opcode + '???';
    }

    // define functions that emulate each opcode
    opcode_handlers() {
        const tool = this;  // for reference by handlers
        this.inst_handlers = new Map();  // execution handlers: opcode => function

        //////////////////////////////////////////////////
        // handlers for RV32I opcodes
        //////////////////////////////////////////////////

        this.inst_handlers.set('lui',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('auipc',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('jal',function (decode, gui) {
            tool.register_file[decode.rd] = tool.pc + 4;
            // this.pc has already been added to imm...
            tool.pc = decode.imm;

            if (gui) {
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('jalr',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.pc + 4);

            // jalr clears low bit of the target address
            tool.pc = (tool.register_file[decode.rs1] + decode.imm) & ~0x1;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('beq',function (decode, gui) {
            if (tool.register_file[decode.rs1] == tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bne',function (decode, gui) {
            if (tool.register_file[decode.rs1] != tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('blt',function (decode, gui) {
            if (tool.register_file[decode.rs1] < tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bge',function (decode, gui) {
            if (tool.register_file[decode.rs1] >= tool.register_file[decode.rs2]) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bltu',function (decode, gui) {
            // >>> operator converts args to unsigned integers
            if ((tool.register_file[decode.rs1]>>>0) < (tool.register_file[decode.rs2]>>>0)) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('bgeu',function (decode, gui) {
            // >>> operator converts args to unsigned integers
            if ((tool.register_file[decode.rs1]>>>0) >= (tool.register_file[decode.rs2]>>>0)) {
                // this.pc has already been added to imm...
                if (tool.pc == decode.imm) throw 'Halt Execution';  // detect branch dot
                tool.pc = decode.imm;
            } else tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
            }
        });

        this.inst_handlers.set('lb',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.register_file[decode.rd] = tool.memory.getInt8(EA, true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(EA & ~3);
            }
        });

        this.inst_handlers.set('lh',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.register_file[decode.rd] = tool.memory.getInt16(EA, true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(EA & ~3);
            }
        });

        this.inst_handlers.set('lw',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.register_file[decode.rd] = tool.memory.getInt32(EA, true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(EA & ~3);
            }
        });

        this.inst_handlers.set('lbu',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.register_file[decode.rd] = tool.memory.getUint8(EA, true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(EA & ~3);
            }
        });

        this.inst_handlers.set('lhu',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.register_file[decode.rd] = tool.memory.getUint16(EA, true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
                tool.mem_read(EA & ~3);
            }
        });

        this.inst_handlers.set('sb',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            tool.memory.setInt8(EA, tool.register_file[decode.rs2], true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                EA &= ~3;
                tool.mem_write(EA, tool.memory.getInt32(EA, true));
            }
        });

        this.inst_handlers.set('sh',function (decode, gui) {
            const EA = tool.register_file[decode.rs1] + decode.imm;
            // complain if not halfword aligned?
            tool.memory.setInt16(EA, tool.register_file[decode.rs2], true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(EA, tool.memory.getInt32(EA, true));
            }
        });

        this.inst_handlers.set('sw',function (decode, gui) {
            const EA = (tool.register_file[decode.rs1] + decode.imm);
            // complain if not word aligned?
            tool.memory.setInt32(EA, tool.register_file[decode.rs2], true);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.mem_write(EA, tool.memory.getInt32(EA, true));
            }
        });

        this.inst_handlers.set('addi',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] + decode.imm);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('slli',function (decode, gui) {
            tool.register_file[decode.rd] = tool.register_file[decode.rs1] << decode.imm;
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('slti',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('sltiu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('xori',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] ^ decode.imm);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srli',function (decode, gui) {
            tool.register_file[decode.rd] = tool.register_file[decode.rs1] >>> decode.imm;
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srai',function (decode, gui) {
            tool.register_file[decode.rd] = tool.register_file[decode.rs1] >> decode.imm;
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('ori',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] | decode.imm);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('andi',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] & decode.imm);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('add',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] + tool.register_file[decode.rs2]);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sub',function (decode, gui) {
            tool.register_file[decode.rd] = 0 | (tool.register_file[decode.rs1] -  tool.register_file[decode.rs2]);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('sll',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('slt',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('sltu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('xor',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] ^  tool.register_file[decode.rs2]);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('srl',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('srl',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('sra',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('or',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] |  tool.register_file[decode.rs2]);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        this.inst_handlers.set('and',function (decode, gui) {
            tool.register_file[decode.rd] = (tool.register_file[decode.rs1] &  tool.register_file[decode.rs2]);
            tool.pc += 4;

            if (gui) {
                tool.reg_read(decode.rs1);
                tool.reg_read(decode.rs2);
                tool.reg_write(decode.rd, tool.register_file[decode.rd]);
            }
        });

        // RV32M

        this.inst_handlers.set('mul',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('mulh',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhsu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('mulhu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('div',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('divu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('rem',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

        this.inst_handlers.set('remu',function (decode, gui) {
            tool.pc += 4;

            if (gui) {
            }
        });

    }

    //////////////////////////////////////////////////
    // Assembly
    //////////////////////////////////////////////////

    // interpret operand as a register, returning its number
    // or undefined it's not a register
    expect_register(operand, oname) {
        if (operand.length == 1) {
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
        if (len == 1 && this.registers.has(operand[0].token)) {
            result.base = this.registers.get(operand[0].token).bin;
            return result;
        }

        // check for (base)
        if (len >= 3 && operand[len-1].token == ')' && operand[len-3].token == '(') {
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
            if (this.pass == 2 && offset !== undefined) {
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
        if (this.pass == 2) {
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
        if (info.opcode == this.opcodes.get('addi').opcode) {
            if (operands.length != 3)
                throw opcode.asSyntaxError(`"${opcode.token}" expects three operands`);

            const rd = this.expect_register(operands[0], 'rd');
            const rs1 = this.expect_register(operands[1], 'rs1');
            let imm = this.read_expression(operands[2]);
            if (imm === undefined)
                this.syntax_error(`"${opcode.token}" expects an numeric expression as its third operand`,
                                  operands[2][0].start, operands[2][operands[2].length - 1].end);

            if (this.pass == 2) {
                imm = Number(this.eval_expression(imm));   // avoid BigInts
                if (imm < -(1 << 11) || imm >= (1 << 11))
                    this.syntax_error(`Value (${imm.toString()}) is too large to fit in the 12-bit immediate field. `,
                                       operands[2][0].start, operands[2][operands[2].length - 1].end);
            } else imm = 0;

            // shift-immediate instructions reuse top 7 bits of immediate field
            if (info.funct7) imm = (imm & 0x1F) | (info.funct7 << 5);

            this.emit32(info.opcode | (rd << 7) | (info.funct3 << 12) | (rs1 << 15) |
                        ((imm & 0xFFF) << 20));
            return true;
        }
            
        // check for base_and_offset instructions (lb..., jalr)
        if (info.opcode == this.opcodes.get('lb').opcode || info.opcode == this.opcodes.get('jalr').opcode) {
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
        if (this.pass == 2) {
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
        if (this.pass == 2) {
            imm = Number(this.eval_expression(imm));
            // form offset for auipc
            if (info.opcode == this.opcodes.get('auipc').opcode) imm -= this.dot();
        } else imm = 0;
        this.emit32(info.opcode | ((rd & 0x3F) << 7) | (((imm >> 12) & 0xFFFFF) << 12));
        return true;
    }

    // return undefined if opcode not recognized, otherwise number of bytes
    // occupied by assembled instruction.
    // Call results.emit32(inst) to store binary into main memory at dot.
    // Call results.syntax_error(msg, start, end) to report an error
    assemble_opcode(opcode, operands) {
        const info = this.opcodes.get(opcode.token.toLowerCase());

        if (info === undefined) return undefined;

        if (info.type == 'R')
            return this.assemble_R_type(opcode, operands, info);
        if (info.type == 'I')
            return this.assemble_I_type(opcode, operands, info);
        if (info.type == 'B')
            return this.assemble_B_type(opcode, operands, info);
        if (info.type == 'S')
            return this.assemble_S_type(opcode, operands, info);
        if (info.type == 'J')
            return this.assemble_J_type(opcode, operands, info);
        if (info.type == 'U')
            return this.assemble_U_type(opcode, operands, info);
        return undefined;
    }

    //////////////////////////////////////////////////
    // custom CodeMirror mode for this ISA
    //////////////////////////////////////////////////

    build_cm_mode() {
        const tool = this;   // for reference in mode
        CodeMirror.defineMode('risc-v', function() {
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
                        return (tool.directives.get(cur)) ? 'builtin' : null;
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
                        const cur = stream.current().toLowerCase();
                        return tool.registers.has(cur) ? tool.registers.get(cur).cm_style : null;
                    }

                    return undefined;
                },
            };
        });
    }
}


// set up GUI in any div.riscv_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('riscv_tool')) {
        new SimTool.RISCVTool(div);
    }
});
