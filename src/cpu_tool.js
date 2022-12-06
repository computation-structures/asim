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
/* global SimTool */

SimTool.CPUTool = class extends SimTool {

    constructor(tool_div, version, cm_mode) {
        super(tool_div, version || 'cpu_tool.20', cm_mode);
        // get the emulator state set up
        this.emulation_initialize();

        if (this.directives === undefined) this.directives = new Map();
        this.add_built_in_directives();

        // fill in right pane with CPU state display
        this.cpu_gui_setup();
        this.reset_action();
    }

    // simulator pane layout for CPU with 64-bit registers
    //    controls
    //    --------------------------
    //    registers
    //    --------------------------
    //    insts  |  memory  |  stack
    //    --------------------------
    //    console
    template_64bit = `
<div class="cpu_tool-simulator-header">
  <button class="cpu_tool-simulator-control cpu_tool-reset btn btn-sm btn-primary" disabled>Reset</button>
  <button class="cpu_tool-simulator-control cpu_tool-step btn btn-sm btn-primary" disabled>Step</button>
  <button class="cpu_tool-simulator-control cpu_tool-walk btn btn-sm btn-primary" disabled>Walk</button>
  <button class="cpu_tool-simulator-control cpu_tool-walk-stop btn btn-sm btn-danger">Stop</button>
  <button class="cpu_tool-simulator-control cpu_tool-run btn btn-sm btn-primary" disabled>Run</button>
  <button class="cpu_tool-simulator-control cpu_tool-run-stop btn btn-sm btn-danger">Stop</button>
  <div class="cpu_tool-running"></div>
</div>
<div>
  <div class="cpu_tool-banner">Registers</div>
  <div class="cpu_tool-pane cpu_tool-regs"></div>
</div>
<div class="cpu_tool-memories">
  <div style="flex: 1 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Disassembly</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-disassembly"></div>
  </div>
  <div style="flex: 0 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Memory</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-memory"></div>
  </div>
  <div style="flex: 0 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Stack</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-stack"></div>
  </div>
</div>
<div class="cpu_tool-console-wrapper">
  <div class="cpu_tool-banner">Console</div>
  <textarea class="cpu_tool-console"></textara>
</div>
`;

    // simulator pane layout for CPU with 32-bit registers
    //    controls
    //    -----------------------------
    //    registers  |  memory  |  stack
    //    insts      |          |
    template_32bit = `
<div class="cpu_tool-simulator-header">
  <button class="cpu_tool-simulator-control cpu_tool-reset btn btn-sm btn-primary" disabled>Reset</button>
  <button class="cpu_tool-simulator-control cpu_tool-step btn btn-sm btn-primary" disabled>Step</button>
  <button class="cpu_tool-simulator-control cpu_tool-walk btn btn-sm btn-primary" disabled>Walk</button>
  <button class="cpu_tool-simulator-control cpu_tool-walk-stop btn btn-sm btn-danger">Stop</button>
  <button class="cpu_tool-simulator-control cpu_tool-run btn btn-sm btn-primary" disabled>Run</button>
  <button class="cpu_tool-simulator-control cpu_tool-run-stop btn btn-sm btn-danger">Stop</button>
</div>
<div style="overflow-y: hidden; display: flex; flex-flow: row; gap: 5px;">
  <div style="flex: 0 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Registers</div>
    <div class="cpu_tool-pane cpu_tool-regs"></div>
    <div class="cpu_tool-banner">Disassembly</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-disassembly"></div>
  </div>
  <div style="flex: 0 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Memory</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-memory"></div>
  </div>
  <div style="flex: 0 0 auto; display: flex; flex-flow: column;">
    <div class="cpu_tool-banner">Stack</div>
    <div style="flex: 1 1 auto;" class="cpu_tool-pane cpu_tool-stack"></div>
  </div>
</div>
`;
    
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    //
    // CPU simulation GUI
    //
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////

    cpu_gui_setup() {
        const gui = this;  // for reference inside of handlers...

        // "Assemble" action button
        this.add_action_button('Assemble', function () { gui.assemble(); });

        // set up simulation panes
        this.right.innerHTML = (this.register_nbits == 64) ? this.template_64bit : this.template_32bit;

        this.reset_button = this.right.getElementsByClassName('cpu_tool-reset')[0];
        this.step_button = this.right.getElementsByClassName('cpu_tool-step')[0];
        this.walk_button = this.right.getElementsByClassName('cpu_tool-walk')[0];
        this.walk_stop_button = this.right.getElementsByClassName('cpu_tool-walk-stop')[0];
        this.run_button = this.right.getElementsByClassName('cpu_tool-run')[0];
        this.run_stop_button = this.right.getElementsByClassName('cpu_tool-run-stop')[0];
        this.running = this.right.getElementsByClassName('cpu_tool-running')[0];

        this.sim_divs = this.right; //.getElementsByClassName('cpu_tool-simulator-divs')[0];
        this.regs_div = this.right.getElementsByClassName('cpu_tool-regs')[0];
        this.disassembly = this.right.getElementsByClassName('cpu_tool-disassembly')[0];
        this.memory_div = this.right.getElementsByClassName('cpu_tool-memory')[0];
        this.stack_div = this.right.getElementsByClassName('cpu_tool-stack')[0];

        this.console = this.right.getElementsByClassName('cpu_tool-console')[0];

        if (this.stack_direction === undefined) this.stack_div.style.display = 'none';

        const tool = this;   // for reference by handlers
        this.reset_button.addEventListener('click', function () { tool.reset_action(); });
        this.step_button.addEventListener('click', function () { tool.step_action(); });
        this.walk_button.addEventListener('click', function () { tool.walk_action(); });
        this.walk_stop_button.addEventListener('click', function () { tool.stop_action(); });
        this.run_button.addEventListener('click', function () { tool.run_action(); });
        this.run_stop_button.addEventListener('click', function () { tool.stop_action(); });

        this.console_chars = [];
        this.mouse_click = -1;   // no pending mouse click
        this.console.addEventListener('beforeinput',function (e) {
            let ch;
            if (e.inputType === 'insertLineBreak') ch = '\n';
            else if (e.inputType === 'deleteContentBackward') ch = '\u007F';
            else if (e.inputType === 'insertText') ch = e.data;
            if (ch && tool.console_chars.length < 8)
                tool.console_chars.push(ch);
            e.preventDefault();
            return false;
        });
        this.console.addEventListener('mousedown',function (e) {
            this.console.focus();
            this.mouse_click = ((e.clientX & 0xFFFF) << 16) + (e.clientY & 0xFFFF);
        });
    }

    reset_controls() {
        // all buttons enabled
        this.reset_button.disabled = false;
        this.step_button.disabled = false;
        this.walk_button.disabled = false;
        this.run_button.disabled = false;

        // display normal buttons, hide stop buttons
        this.walk_button.style.display = 'inline-block';
        this.walk_stop_button.style.display = 'none';
        this.run_button.style.display = 'inline-block';
        this.run_stop_button.style.display = 'none';
        this.running.style.display = 'none';
    }

    // reset simulation, refresh state display
    reset_action() {
        this.clear_message();
        this.emulation_reset();
        this.fill_in_simulator_gui();  // refresh state display by starting over...
        this.next_pc();
        this.reset_controls();

        // clear console
        this.console.value = '';
        this.console.setSelectionRange(0,0);
    }

    // request a stop to sequence of emulation steps
    stop_action() {
        this.stop_request = true;
    }

    // execute a single instruction, then update state display
    step_action() {
        this.clear_message();
        try {
            this.console.focus();
            this.emulation_step(true);
        } catch (err) {
            if ((typeof err) === 'string') this.message.innerHTML = err;
            else throw err;
        }
    }

    // execute instructions, updating state display after each
    walk_action() {
        this.console.focus();
        this.clear_message();
        const tool = this;
        this.stop_request = false;

        function step_and_display() {
            if (tool.stop_request) tool.reset_controls();
            else {
                try {
                    tool.emulation_step(true); // execute one instruction
                    setTimeout(step_and_display, 0);  // let browser update display
                } catch (err) {
                    tool.reset_controls();
                    if ((typeof err) === 'string') this.message.innerHTML = err;
                    else throw err;
                }
            }
        }

        this.reset_button.disabled = true;
        this.step_button.disabled = true;
        this.walk_button.style.display = 'none';
        this.walk_stop_button.style.display = 'inline-block';
        this.run_button.disabled = true;
        this.running.style.display = 'none';

        setTimeout(step_and_display, 0);
    }

    // execute instructions without updating state display (much faster!)
    run_action () {
        this.console.focus();
        this.clear_message();
        const tool = this;
        const start_ncycles = this.ncycles;
        const start = new Date();   // keep track of execution time

        function run_reset_controls() {
            tool.regs_div.style.backgroundColor = 'white';
            tool.disassembly.style.backgroundColor = 'white';
            tool.memory_div.style.backgroundColor = 'white';
            tool.stack_div.style.backgroundColor = 'white';

            tool.reset_controls();
            tool.fill_in_simulator_gui();
            tool.next_pc();

            const end = new Date();
            const secs = (end.getTime() - start.getTime())/1000.0;
            const ncyc = tool.ncycles - start_ncycles;
            tool.message.innerHTML = `Emulation stats: ${ncyc.toLocaleString('en-US')} instructions in ${secs} seconds = ${Math.round(ncyc/secs).toLocaleString('en-US')} instructions/sec`;
        }

        // execute 1,000,000 instructions, then check for stop request
        function step_1000000() {
            if (tool.stop_request) run_reset_controls();
            else {
                try {
                    // run for a million cycles
                    for (let count = 1000000; count > 0; count -= 1) {
                        tool.emulation_step(false);
                    }
                    setTimeout(step_1000000, 0);   // check for stop request
                } catch (err) {
                    run_reset_controls();
                    if ((typeof err) === 'string')
                        if (err !== 'Halt Execution') this.message.innerHTML = err;
                    else
                        throw err;
                }
            }
        }
        
        this.clear_highlights();
        this.stop_request = false;
        this.reset_button.disabled = true;
        this.step_button.disabled = true;
        this.walk_button.disabled = true;
        this.run_button.style.display = 'none';
        this.run_stop_button.style.display = 'inline-block';
        this.running.style.display = 'inline-block';

        this.regs_div.style.backgroundColor = 'grey';
        this.disassembly.style.backgroundColor = 'grey';  // indicate running...
        this.memory_div.style.backgroundColor = 'grey';
        this.stack_div.style.backgroundColor = 'grey';

        setTimeout(step_1000000, 0);
    }

    // required minimal state: .memory, .pc, .label_table
    emulation_initialize() {
        // to be overridden
        this.ncycles = 0;

        // meanwhile some values to facilitate testing
        this.line_comment = '#';
        this.block_comment_start = '/*';
        this.block_comment_end = '*/';
        this.little_endian = true;

        this.data_section_alignment = 256;
        this.bss_section_alignment = 8;
        this.address_space_alignment = 256;

        // some default values to get us started...
        this.label_table = new Map();   // addr => label_name
        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 2;

        this.assembler_memory = new DataView(new ArrayBuffer(256));

        this.register_file = new Array(32);
        this.register_file.fill(0);
        this.register_names = new Array(32);
        for (let r = 0; r < this.register_file.length; r += 1)
            this.register_names[r] = 'r' + r;

        this.emulation_reset();
    }

    // reset emulation state to initial values
    emulation_reset() {
        // should be overridden...
        this.ncycles = 0;
    }

    // execute a single instruction
    emulation_step(update_display) {  // eslint-disable-line no-unused-vars
        // to be overridden
    }

    // return text representation of instruction at addr
    disassemble(addr) {  // eslint-disable-line no-unused-vars
        // to be overridden
        return '???';
    }

    //////////////////////////////////////////////////
    //  update state display
    //////////////////////////////////////////////////

    // populate the state display with addresses/values
    fill_in_simulator_gui() {
        this.sim_divs.focus();

        let table;

        // how many hex digits for memory address?
        const asize = Math.ceil(Math.log2(this.memory.byteLength)/4);

        if (this.register_file !== undefined) {
            // fill register display
            table = ['<table cellpadding="2px" border="0" style="border-collapse: collapse;">'];
            const colsize = Math.ceil(this.register_names.length/4);
            for (let reg = 0; reg < colsize; reg += 1) {
                const row = ['<tr>'];
                for (let rnum = reg; rnum < 4*colsize; rnum += colsize) {
                    if (rnum < this.register_names.length) {
                        row.push(`<td class="cpu_tool-addr">${this.register_names[rnum]}</td>`);
                        row.push(`<td id="r${rnum}">${this.hexify(this.register_file[rnum],this.register_nbits/4)}</td>`);
                    } else row.push('<td></td><td></td>');
                }
                row.push('</tr>');
                table.push(row.join(''));
            }
            this.extra_registers(table);
            table.push('</table>');
            this.regs_div.innerHTML = table.join('');
        }

        // fill in disassembly display
        table = ['<table class="cpu_tool-disassembly" cellpadding="2px" border="0">'];
        for (let addr = 0; addr < this.memory.byteLength; addr += this.inst_nbits/8) {
            let a = this.hexify(addr, asize);
            let label = '';
            if (this.label_table && this.label_table.has(addr)) {
                label = this.label_table.get(addr);
                if (/L\d\*\d+/.test(label)) label = label.charAt(1);
                label += ':';
                if (label.length > 10) {
                    a = a.slice(0,9) + '&hellip;:';
                }
            }
            const i = this.disassemble(addr);   // PA, but also need PC/VA?

            // big-endian: address to left of word
            table.push(`<tr><td class="cpu_tool-addr">${a}</td>
                        <td>${this.location(addr, this.inst_nbits)}</td>
                        <td class="cpu_tool-label">${label}</td>
                        <td id="i${addr}"><div class="cpu_tool-inst">${i}</div></td>
                        </tr>`);
        }
        table.push('</table>');
        this.disassembly.innerHTML = table.join('');

        // fill memory display
        table = ['<table cellpadding="2px" border="0">'];
        for (let addr = 0; addr < this.memory.byteLength; addr += this.word_nbits/8) {
            table.push(`<tr>
                        <td class="cpu_tool-addr">${this.hexify(addr,asize)}</td>
                        <td id="m${addr}">${this.location(addr)}</td>
                        </tr>`);
        }
        table.push('</table>');
        this.memory_div.innerHTML = table.join('');

        if (this.stack_direction) {
            // fill stack display
            table = ['<table cellpadding="2px" border="0">'];
            for (let addr = 0; addr < this.memory.byteLength; addr += this.word_nbits/8) {
                table.push(`<tr>
                            <td class="cpu_tool-addr">${this.hexify(addr,asize)}</td>
                            <td id="s${addr}">${this.location(addr)}</td>
                            </tr>`);
            }
            table.push('</table>');
            this.stack_div.innerHTML = table.join('');
        }
    }

    // override to include extra rows in the register display
    extra_registers() {
    }

    is_visible(ele, container) {
        const { bottom, height, top } = ele.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
    }

    clear_highlights() {
        // need to make our copy of result returned by getElementsByClassName
        // since HTMLCollection is automatically updated when DOM changes
        let elist;

        // remove previous read highlights
        elist = Array.from(this.regs_div.getElementsByClassName('cpu_tool-reg-read'));
        for (let td of elist) td.classList.remove('cpu_tool-reg-read');
            
        // remove previous write highlights
        elist = Array.from(this.regs_div.getElementsByClassName('cpu_tool-reg-write'));
        for (let td of elist) td.classList.remove('cpu_tool-reg-write');
            
        // remove previous read highlights
        elist = Array.from(this.memory_div.getElementsByClassName('cpu_tool-mem-read'));
        for (let td of elist) td.classList.remove('cpu_tool-mem-read');
            
        // remove previous write highlights
        elist = Array.from(this.memory_div.getElementsByClassName('cpu_tool-mem-write'));
        for (let td of elist) td.classList.remove('cpu_tool-mem-write');

        // remove previous inst highlights
        elist = Array.from(this.disassembly.getElementsByClassName('cpu_tool-next-inst'));
        for (let td of elist) td.classList.remove('cpu_tool-next-inst');
    }

    // update reg display after a read
    reg_read(rnum) {
        // highlight specified register
        const rtd = document.getElementById('r' + rnum);
        if (rtd) rtd.classList.add('cpu_tool-reg-read');
    }

    // update reg display after a write
    reg_write(rnum, v) {
        // look for writes to x0, which have been redirected
        // duing inst decoding to register_file[-1].
        if (rnum === -1) return;

        // highlight specified register
        const rtd = document.getElementById('r' + rnum);
        if (rtd) {
            rtd.classList.add('cpu_tool-reg-write');
            rtd.innerHTML = this.hexify(v, this.register_nbits/4);
        }

        // when writing to SP, scroll stack pane appropriately
        if (rnum === this.sp_register_number) {
            const tos = document.getElementById('s' + v);
            tos.scrollIntoView({block: 'center'});
        }
    }

    // update mem displays after a read
    mem_read(addr, size) {
        //addr &= ~3;   // memory display is word aligned
        addr &= ~(this.word_nbits/8 - 1);   // memory display is word aligned

        // highlight specified memory location
        let mtd;
        if (size === 64) {
            mtd = document.getElementById('m' + (addr + 4));
            mtd.classList.add('cpu_tool-mem-read');
        }
        mtd = document.getElementById('m' + addr);
        mtd.classList.add('cpu_tool-mem-read');

        // make sure location is visible in memory pane
        if (!this.is_visible(mtd, this.memory_div))
            mtd.scrollIntoView({block: 'center'});

        if (this.sp_register_number) {
            if (size === 64) {
                mtd = document.getElementById('s' + (addr + 4));
                mtd.classList.add('cpu_tool-mem-read');
            }
            mtd = document.getElementById('s' + addr);
            mtd.classList.add('cpu_tool-mem-read');
            // stack pane scrolling controlled by sp value
        }
    }

    // update mem displays after a write
    mem_write(addr, v, size) {
        addr &= ~3;   // memory display is word aligned

        // highlight specified memory location
        let mtd = document.getElementById('m' + addr);
        mtd.classList.add('cpu_tool-mem-write');
        mtd.innerHTML = this.hexify(v & 0xFFFFFFFFn, 8);

        if (size === 64) {
            mtd = document.getElementById('m' + (addr + 4));
            mtd.classList.add('cpu_tool-mem-write');
            mtd.innerHTML = this.hexify((v >> 32n) & 0xFFFFFFFFn, 8);
        }

        // make sure location is visible in memory pane
        if (!this.is_visible(mtd, this.memory_div))
            mtd.scrollIntoView({block: 'center'});

        if (this.sp_register_number) {
            mtd = document.getElementById('s' + addr);
            mtd.classList.add('cpu_tool-mem-write');
            mtd.innerHTML = this.hexify(v & 0xFFFFFFFFn, 8);

            if (size === 64) {
                mtd = document.getElementById('s' + (addr + 4));
                mtd.classList.add('cpu_tool-mem-write');
                mtd.innerHTML = this.hexify((v >> 32n) & 0xFFFFFFFFn, 8);
            }
            // stack pane scrolling controlled by sp value
        }
    }

    // update disassembly display after executing an inst
    // pc is addr of next instruction to be executed
    next_pc() {
        // remove previous read highlights
        for (let td of this.disassembly.getElementsByClassName('cpu_tool-next-inst')) {
            td.classList.remove('cpu_tool-next-inst');
        }
            
        const itd = document.getElementById('i' + this.pc);
        if (itd) {
            itd.parentElement.classList.add('cpu_tool-next-inst');
            // make sure next inst is visible in disassembly area
            if (!this.is_visible(itd, this.disassembly))
                itd.scrollIntoView({block: 'center'});
        }
    }

    // add character to console output
    console_output(ch) {
        let txt = this.console.value;
        if (ch === '\u007F') txt = txt.slice(0,txt.length - 1);
        else txt += ch;
        this.console.value = txt;
        this.console.focus();
        this.console.setSelectionRange(txt.length, txt.length);
        this.console.scrollTop = this.console.scrollHeight;
    }

    // return the next character typed at the console, else undefined
    console_input() {
        return this.console_chars.shift();
    }

    // return mouse click coords, -1 if no click pending
    mouse_click() {
        const click = this.mouse_click;
        this.mouse_click = -1;
        return click;
    }

    //////////////////////////////////////////////////
    //////////////////////////////////////////////////
    //
    // Assembler
    //
    //////////////////////////////////////////////////
    //////////////////////////////////////////////////

    syntax_error(message, start, end) {
        throw new SimTool.SyntaxError(message, start, end);
    }

    syntax_warning(message, start, end) {
        throw new SimTool.SyntaxWarning(message, start, end);
    }

    add_built_in_directives() {
        const tool = this;   // for reference in handlers

        this.directives.set(".align", function(key, operands) {
            return tool.directive_align(key,operands);
        });
        this.directives.set(".ascii", function(key, operands) {
            return tool.directive_ascii(key,operands);
        });
        this.directives.set(".asciz", function(key, operands) {
            return tool.directive_ascii(key,operands);
        });
        this.directives.set(".averify", function(key, operands) {
            return tool.directive_averify(key,operands);
        });
        this.directives.set(".bss", function(key, operands) {
            return tool.directive_section(key,operands);
        });
        this.directives.set(".byte", function(key, operands) {
            return tool.directive_storage(key,operands);
        });
        this.directives.set(".data", function(key, operands) {
            return tool.directive_section(key,operands);
        });
        this.directives.set(".dword", function(key, operands) {
            return tool.directive_storage(key,operands);
        });
        this.directives.set(".global", function(key, operands) {
            return tool.directive_global(key,operands);
        });
        this.directives.set(".hword", function(key, operands) {
            return tool.directive_storage(key,operands);
        });
        this.directives.set(".include", function(key, operands) {
            return tool.directive_include(key,operands);
        });
        this.directives.set(".macro", function(key, operands) {
            return tool.directive_macro(key,operands);
        });
        this.directives.set(".section", function(key, operands) {
            return tool.directive_section(key,operands);
        });
        this.directives.set(".text", function(key, operands) {
            return tool.directive_section(key,operands);
        });
        this.directives.set(".word", function(key, operands) {
            return tool.directive_storage(key,operands);
        });
    }

    // assemble the contents of the specified buffer
    assemble() {
        this.clear_message();
        this.error_div.style.display = 'none';  // hide previous errors

        // collect all the buffers since they may be referenced by .include
        const top_level_buffer_name = this.buffer_name.value;
        this.buffer_map = new Map();
        for (let editor of this.editor_list) {
            this.buffer_map.set(editor.id, editor.CodeMirror.doc.getValue());
        }

        this.stream = new SimTool.TokenStream(this);
            
        // set up assembler state
        this.assembly_warnings = [];   // no warningsyet
        this.assembly_errors = [];   // no errors yet
        this.address_spaces = new Map();
        this.current_aspace = this.add_aspace('kernel');
        this.current_section = undefined;
        this.macro_map = new Map();    // macro name => {name, args, body}
        this.assembler_memory = undefined;

        this.pass = 0;
        this.next_pass();

        // pass 1: define symbol values and count bytes
        this.stream.push_buffer(top_level_buffer_name, this.buffer_map.get(top_level_buffer_name));
        if (this.assembly_prologue) this.stream.push_buffer('prologue',this.assembly_prologue);
        this.assemble_buffer();   // returns [content, errors]

        if (this.assembly_errors.length === 0) {

            // position sections consecutively in memory, adjust their base addresses appropriately
            this.next_pass();

            // pass 2: eval expressions, assemble instructions, fill memory
            this.stream.push_buffer(top_level_buffer_name, this.buffer_map.get(top_level_buffer_name));
            if (this.assembly_prologue) this.stream.push_buffer('prologue',this.assembly_prologue);
            this.assemble_buffer();

            console.log(this);   // so we can poke at assembly results after pass 2
        }

        if (this.assembly_errors.length > 0) {
            this.left_pane_only();
            this.handle_errors(this.assembly_errors);
        } else {
            this.handle_errors([], this.assembly_warnings);

            this.build_label_table();
            if (this.inst_decode) this.inst_decode.fill(undefined);
            this.reset_action();

            // figure how much to shink left pane
            const sim_width = this.sim_divs.scrollWidth;
            const div_width = this.divider.offsetWidth;
            const pct = 100*(sim_width + div_width + 27)/this.left.parentElement.offsetWidth;
            this.left.style.width = Math.max(0,100 - pct) + '%';
        }
    }

    // set up for an assembly pass through the code
    next_pass() {
        this.pass += 1;
        if (this.pass > 2) return;

        if (this.pass === 1) {
            /* something here */
        }

        if (this.pass === 2) {
            // layout sections in virtual & physical memory at start of second pass
            let memsize = 0;
            for (let aspace of this.address_spaces.values()) {

                // layout of sections in an address space is text, data, bss

                // set end of .text so that data is aligned correctly
                const text = aspace.sections.get('.text');
                text.base = 0;
                text.dot = this.align(text.dot, this.data_section_alignment || 8);

                // set end of .data so that bss is aligned correctly
                const data = aspace.sections.get('.data');
                data.base = text.dot;   // virtual address
                data.dot = this.align(data.dot, this.bss_section_alignment || 8);

                // set end of .bss so that next address space is aligned correctly
                const bss = aspace.sections.get('.bss');
                bss.base = data.base + data.dot;   // virtual address
                bss.dot = this.align(bss.dot, this.address_space_alignment || 8);

                // remember where in physical memory this address space starts
                aspace.base = memsize;
                aspace.size = bss.base + bss.dot;   // remember size of this address space

                // create some symbols in kernel symbol table so program
                // can access base and bounds of this address space
                this.add_symbol(`_${aspace.name}_base_`, aspace.base, 'kernel');
                this.add_symbol(`_${aspace.name}_bounds_`, aspace.size, 'kernel');

                memsize += aspace.size;  // allocate space in physical memory
            }

            // create physical memory!
            this.assembler_memory = new DataView(new ArrayBuffer(memsize));
        }

        for (let aspace of this.address_spaces.values()) {
            // we'll want to generate the same index for each local label on each pass
            // so reinitialize table of last-used index for each local label
            aspace.local_label_index.clear();   // N => last index used

            // reset dot to 0 in all sections (only meaningful after first pass)
            if (this.pass > 1) {
                for (let section of aspace.sections.values()) {
                    section.dot = 0;
                }
            }
        }

        // macros are define anew each pass (this avoids phase errors)
        this.macro_map.clear();

        // start assembling into .text by default
        this.change_section('.text', 'kernel');
    }

    // add byte to memory at dot, advance dot
    emit8(v) {
        // remember to use physical address!
        if (this.assembler_memory)
            this.assembler_memory.setUint8(this.dot(true), Number(v), this.little_endian);
        this.incr_dot(1);
    }

    // add halfword to memory at dot, advance dot
    emit16(v) {
        // remember to use physical address!
        if (this.assembler_memory)
            this.assembler_memory.setUint16(this.dot(true), Number(v), this.little_endian);
        this.incr_dot(2);
    }

    // add word to memory at dot, advance dot
    emit32(v) {
        // remember to use physical address!
        if (this.assembler_memory)
            this.assembler_memory.setUint32(this.dot(true), Number(v), this.little_endian);
        this.incr_dot(4);
    }

    // add double word to memory at dot, advance dot
    emit64(v) {
        // remember to use physical address!
        if (this.assembler_memory)
            this.assembler_memory.setBigUint64(this.dot(true), v, this.little_endian);
        this.incr_dot(8);
    }

    // return hex string of what's in word at byte_offset
    location(byte_offset, nbits) {
        // access DataView directly to avoid affecting the cache measurements
        if (this.memory && this.memory.memory) {
            if (nbits === undefined) nbits = this.word_nbits;

            let v;
            if (nbits <= 32)
                v = this.memory.memory.getUint32(byte_offset, this.little_endian);
            else
                v = this.memory.memory.getBigUint64(byte_offset, this.little_endian);

            return this.hexify(v, nbits/4);
        }
        return undefined;
    }

    //////////////////////////////////////////////////
    // sections: .text, .data, .bss
    //////////////////////////////////////////////////

    add_aspace(aname) {
        let aspace = this.address_spaces.get(aname);
        if (aspace === undefined) {
            aspace = {};
            aspace.name = aname;
            aspace.sections = new Map();
            aspace.sections.set(".text", {aspace: aspace, name: ".text", dot: 0, base: 0});
            aspace.sections.set(".data", {aspace: aspace, name: ".data", dot: 0, base: 0});
            aspace.sections.set(".bss", {aspace: aspace, name: ".bss", dot: 0, base: 0});
            aspace.symbol_table = new Map();
            aspace.local_label_index = new Map();
            aspace.base = 0;   // physical address of address space
            aspace.size = 0;   // length of address space in bytes

            this.address_spaces.set(aname, aspace);
        }
        return aspace;
    }

    // convert PA to VA
    pa2va(pa) {
        if (this.address_spaces === undefined) return undefined;

        // look through address spaces for one that includes this PA
        for (let aspace of this.address_spaces.values()) {
            const va = pa - aspace.base;
            if (pa >= aspace.base && va <= aspace.size) return va;
        }
        return undefined;
    }

    // change which section we're assembling into, return section
    // return undefined if section not found
    change_section(sname, aname) {
        if (aname) this.current_aspace = this.add_aspace(aname);
        if (this.current_aspace.sections.has(sname))
            this.current_section = this.current_aspace.sections.get(sname);
        return this.current_section;
    }

    // return value where value>=v and value%alignment === 0
    align(v, alignment) {
        const remainder = v % alignment;
        return remainder > 0 ? v + alignment - remainder : v;
    }

    // adjust dot of current section to be a multiple of alignment
    align_dot(alignment) {
        this.current_section.dot = this.align(this.current_section.dot, alignment);
    }

    // reserve room in the current section
    incr_dot(amount) {
        this.current_section.dot += amount;
        return this.current_section.dot;
    }

    // get offset into current section
    dot(physical_address) {
        let value = this.current_section.dot;
        if (physical_address) {
            value += this.current_section.base + this.current_section.aspace.base;
        }
        return value;
    }

    //////////////////////////////////////////////////
    // symbol definition and lookup
    //////////////////////////////////////////////////

    // add a label to the symbol table
    add_label(label_token, sname, aname) {
        const aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
        if (aspace === undefined) return false;

        const section = sname ? aspace.sections.get(sname) : this.current_section;
        if (section === undefined) return false;

        let name = label_token.token;

        if (label_token.type === 'local_label') {
            // compute this label's (new) index
            const index = (aspace.local_label_index.get(name) || 0) + 1;
            aspace.local_label_index.set(name, index);

            // synthesize unique label name for the local label
            // include "*" so label name is one that user can't define
            name = 'L' + name + '*' + index.toString();
        } else if (this.pass === 1) {
            const previous = aspace.symbol_table.get(name);
            if (previous !== undefined) {
                // oops, label already defined!
                throw label_token.asSyntaxError(`Duplicate label definition for "${name}", originally defined at ${previous.definition.url()}`);
            }
        }
        aspace.symbol_table.set(name, {
            type: 'label',
            definition: label_token,   // remember where it was defined
            name: name,
            section: section,    // so we can update value with section.base
            value: section.dot,
        });

        return true;
    }

    // add a symbol to the symbol table (redefinition okay)
    add_symbol(name, value, aname) {
        const aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
        if (aspace === undefined) return false;

        let symbol = aspace.symbol_table.get(name);
        if (symbol === undefined) {
            symbol = {
                type: 'symbol',
                name: name,
                section: undefined,    // assigned symbols don't need relocation
            };
            aspace.symbol_table.set(name, symbol);
        }
        symbol.definition = symbol,   // track most recent definition
        symbol.value = value;          // update value
        return true;
    }

    // look up value of symbol or local symbol
    symbol_value(name, physical_address, aname) {
        const aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
        if (aspace === undefined) return false;

        if (name === '.') return this.dot(physical_address);
        let lookup_name = name;

        if (/\d[fb]/.test(name)) {
            const direction = name.charAt(name.length - 1);
            name = name.slice(0, -1);  // remove direction suffix

            // get the current value of the appropriate local label index
            let index = aspace.local_label_index.get(name) || 0;
            if (direction === 'f') index += 1;  //referencing next definition

            // we can predict the unique symbol name associated with both the
            // previous and next local label with the given name
            lookup_name = 'L' + name + '*' + index.toString();
        }

        // find it in symbol table
        const symbol = aspace.symbol_table.get(lookup_name);
        if (symbol === undefined) return undefined;

        let value = symbol.value;

        // relocate label values
        if (symbol.type === 'label') {
            value += symbol.section.base;   // virtual address
            if (physical_address) value += symbol.section.aspace.base;
        }

        return value;
    }

    // build a Map from physical address to symbol name
    build_label_table() {
        this.label_table = new Map();
        for (let aname of this.address_spaces.keys()) {
            const aspace = this.address_spaces.get(aname);
            for (let symbol of aspace.symbol_table.keys()) {
                // we only want labels...
                if (aspace.symbol_table.get(symbol).section === undefined)
                    continue;
                this.label_table.set(this.symbol_value(symbol, true, aname), symbol);
            }
        }
    }

    //////////////////////////////////////////////////
    // Built-in directives
    //////////////////////////////////////////////////

    // .align n   (align dot to be 0 mod 2^n)
    directive_align(key, operands) {
        if (operands.length != 1 || operands[0].length != 1 ||
            operands[0][0].type != 'number' || operands[0][0].token < 1 || operands[0][0].token > 12)
            throw key.asSyntaxError('Expected a single numeric argument between 1 and 12');
        this.align_dot(2 << Number(operands[0][0].token));
        return true;
    }

    // .ascii, .asciz
    directive_ascii(key, operands) {
        for (let operand of operands) {
            if (operand.length != 1 || operand[0].type != 'string')
                this.syntax_error('Expected string',
                                  operand[0].start, operand[operand.length - 1].end);
            const str = operand[0].token;
            for (let i = 0; i < str.length; i += 1) {
                this.emit8(str.charCodeAt(i));
            }
            if (key.token === '.asciz') this.emit8(0);
        }
        return true;
    }

    // .averify addr, v0, v1, ...  // verify assembly at location addr++
    directive_averify(key, operands) {
        if (this.pass === 2) {
            let address = undefined;
            for (let operand of operands) {
                const v = Number(this.eval_expression(this.read_expression(operand)));
                if (address === undefined) address = v;
                else {
                    const vv = (address < this.assembler_memory.byteLength) ?
                          this.assembler_memory.getUint32(address, this.little_endian) : undefined;
                    if (vv === undefined)
                        this.syntax_error(`.averify address (0x${this.hexify(address)}) out of range`,operand[0].start,operand[operand.length-1].end);
                    else if (v !== vv)
                        this.syntax_warning(`Assembly mismatch at location 0x${this.hexify(address)}: expected 0x${this.hexify(v,8)}, got 0x${this.hexify(vv,8)}`,
                                          operand[0].start, operand[operand.length-1].end);
                    address += 4;
                }
            }
        }
        return true;
    }

    // .global symbol, ...
    directive_global(key, operands) {
        // just check that the symbols are defined...
        for (let operand of operands) {
            if (operand.length != 1 || operand[0].type != 'symbol')
                this.syntax_error('Expected symbol name',
                                  operand[0].start, operand[operand.length - 1].end);
            if (this.pass === 2 && this.symbol_value(operand[0].token) === undefined)
                this.syntax_error('Undefined symbol',
                                  operand[0].start, operand[0].end);
        }

        return true;
    }

    // .include "buffer_name"
    directive_include(key, operands) {
        if (operands.length != 1 || operands[0].length != 1 || operands[0][0].type != 'string')
            throw key.asSyntaxError('Expected a single string argument');
        const bname = operands[0][0].token;
        if (!this.buffer_map.has(bname))
            throw operands[0][0].asSyntaxError(`Cannot find buffer "${bname}"`);
        this.stream.push_buffer(bname, this.buffer_map.get(bname));
        return true;
    }

    // .macro name [operands] ... .endm
    directive_macro(key, operands) {
        // start by combining all the operand tokens (ie, any commas are ignored!)
        for (let i = 1; i < operands.length; i += 1) {
            for (let token of operands[i]) operands[0].push(token);
        }
        operands = operands[0];   // all the operands as one long list

        // first token is name of macro
        if (operands.length === 0)
            throw key.asSyntaxError('".macro" should be followed the macro name');
        if (operands[0].type != 'symbol')
            throw operands[0].asSyntaxError('Expected symbol as name of macro');

        // create macro definition and save it in the macro_map
        const macro = {
            name: operands[0].token,
            arguments: [],    // list of symbol tokens (for now)
            body: [],         // list of "lines" each of which is a list of tokens
        };

        // remaining operands should be symbols, each is the name of an argument
        for (let i = 1; i < operands.length; i += 1) {
            // TO DO: check for "= default" here...
            if (operands[i].type != 'symbol')
                throw operands[i].asSyntaxError('Expected symbol as macro argument name');
            macro.arguments.push(operands[i]);
        }

        // now read in the body tokens
        // read in tokens, line by line until we find matching .endm
        let nesting_count = 1;
        do {
            // we're at the start of a statement, so check for .endm or .macro
            const token = this.stream.next_token();
            if (token === undefined) continue;  // end of line
            else if (token.token === '.endm') {
                nesting_count -= 1;
                // did this .endm complete the original macro?
                if (nesting_count === 0) break;
            } else if (token.token === '.macro') {
                // a nested macro definition, which we just add to our body
                nesting_count += 1;
            }
            
            // otherwise save all the tokens on this line
            let line = [token];
            macro.body.push(line);
            while (!this.stream.eol()) {
                let token = this.stream.next_token();
                if (token.token === ';') {
                    // ';' marks end of this statement, is there more?
                    token = this.stream.next_token();
                    if (token) {
                        // first token of next statement
                        // so set up to read another statement
                        line = [token];
                        macro.body.push(line);
                        continue;
                    }
                }
                line.push(token);
            }
        } while (this.stream.next_line());

        // complain if we reach end of buffer without finding a .endm
        if (nesting_count != 0)
            throw key.asSyntaxError('no .endm found for this macro');

        // add macro definition to list of macros
        this.macro_map.set(macro.name,  macro);

        return true;
    }

    // .section, .text, .data, .bss
    directive_section(key, operands) {
        if (key.token === '.section') {
            key = operands[0];
            if (key.length != 1 || key[0].type != 'symbol' ||
                !(key[0].token === '.text' || key[0].token === '.data' || key[0].token === '.bss'))
                this.syntax_error('Expected .text, .data, or .bss',
                                  key[0].start, key[key.length - 1].end);
            operands = operands.slice(1);
        }

        let aname = this.current_aspace.name;
        if (operands.length === 1) {
            // grab name of address space
            aname = operands[1];
            if (aname.length != 1 || aname.token.type != 'symbol')
                this.syntax_error('Expected name of address space',
                                  aname[0].start, aname[key.length - 1].end);
            aname = aname[0].token;
        } else if (operands.length > 1) {
            const last = operands[operands.length - 1];
            this.syntaxError('Too many arguments!',
                             operands[1][0].start, last[last.length - 1].end);
        }

        this.change_section(key.token, aname);
        return true;
    }

    // .byte, .hword, .word, .dword
    directive_storage(key, operands) {
        for (let operand of operands) {
            let exp = this.read_expression(operand);
            exp = (this.pass === 2) ? this.eval_expression(exp) : 0n;
            if (key.token === '.byte') {
                this.emit8(exp);
            } else if (key.token === '.hword') {
                this.align_dot(2);
                this.emit16(exp);
            } else if (key.token === '.word') {
                this.align_dot(4);
                this.emit32(exp);
            } else if (key.token === '.dword') {
                this.align_dot(8);
                this.emit64(exp);
            }
        }
        return true;
    }

    // return undefined or expression represented as hierarchical lists or a leaf
    // where the leaves and operators are tokens
    // tokens is a list of tokens, eg, an operand as returned by read_operands
    read_expression(tokens, index) {
        // Uses "ordinary" precedence rules: from low to high
        //   expression := bitwise_OR
        //   bitwise_OR := bitwise_XOR ("|" bitwise_XOR)*
        //   bitwise_XOR := bitwise_AND ("^" bitwise_AND)*
        //   bitwise_AND := equality ("&" equality)*
        //   equality = relational (("==" | "!=") relational)?
        //   relational = shift (("<" | "<=" | ">=" | ">") shift)?
        //   shift = additive (("<<" | ">>" | ">>>") additive)*
        //   additive = multiplicative (("+" | "-") multiplicative)*
        //   multiplicative = unary (("*" | "/" | "%") unary)*
        //   unary = ("+" | "-" | "~")? term
        //   term = number | symbol | "(" expression ")"

        if (index === undefined) index = 0;

        function invalid_expression() {
            throw new SimTool.SyntaxError('Invalid expression',
                                          tokens[0].start,
                                          tokens[tokens.length - 1].end);
        }

        // term = number | symbol | "(" expression ")"
        function read_term() {
            let token = tokens[index];
            if (token === undefined) invalid_expression();
            if (token.type === 'number' || token.type === 'symbol' || token.type === 'local_symbol') {
                index += 1;
                return token;
            } else if (token.token === '(') {
                const open_paren = token;
                // parenthesized expression
                index += 1;
                const result = read_expression_internal(tokens, index);
                token = tokens[index];
                if (token && token.token === ')') {
                    index += 1;
                    return result;
                }
                throw open_paren.asSyntaxError('Missing close parenthesis that matches this one');
            }
            throw token.asSyntaxError('Invalid expression');
        }

        // unary = ("+" | "-" | "~")? term
        function read_unary() {
            const sign = tokens[index];
            if (sign === undefined) invalid_expression();
            // NB: in Safari '+' == 0n is true!  I guess '+' converted to BigInt is 0n...
            if (sign.token === '+' || sign.token === '-' || sign.token === '~') index += 1;
            let result = read_term();
            if (sign.token === '-' || sign.token === '~') result = [sign, result];
            return result;
        }

        // multiplicative = unary (("*" | "/" | "%") unary)*
        function read_multiplicative() {
            let result = read_unary();
            for (;;) {
                const operator = tokens[index];
                if (operator && (operator.token === '*' || operator.token === '/' || operator.token === '%')) {
                    index += 1;
                    result = [operator, result, read_unary()];
                } else break;
            }
            return result;
        }

        // additive = multiplicative (("+" | "-") multiplicative)*
        function read_additive() {
            let result = read_multiplicative();
            for (;;) {
                const operator = tokens[index];
                if (operator && (operator.token === '+' || operator.token === '-')) {
                    index += 1;
                    result = [operator, result, read_multiplicative()];
                } else break;
            }
            return result;
        }

        // shift = additive (("<<" | ">>" | ">>>") additive)*
        function read_shift() {
            let result = read_additive();
            for (;;) {
                const operator = tokens[index];
                if (operator && (operator.token === '<<' || operator.token === '>>' || operator.token === '>>>')) {
                    index += 1;
                    result = [operator, result, read_additive()];
                } else break;
            }
            return result;
        }

        // relational = shift (("<" | "<=" | ">=" | ">") shift)?
        function read_relational() {
            let result = read_shift();
            const operator = tokens[index];
            if (operator && (operator.token === '<' || operator.token === '<=' || operator.token === '>=' || operator.token === '>')) {
                    index += 1;
                    result = [operator, result, read_shift()];
            }
            return result;
        }

        // equality = relational (("==" | "!=") relational)?
        function read_equality() {
            let result = read_relational();
            const operator = tokens[index];
            if (operator && (operator.token === '==' || operator.token === '!=')) {
                    index += 1;
                    result = [operator, result, read_relational()];
            }
            return result;
        }

        // bitwise_AND := equality ("&" equality)*
        function read_bitwise_AND() {
            let result = read_equality();
            for (;;) {
                const operator = tokens[index];
                if (operator && operator.token === '&') {
                    index += 1;
                    result = [operator, result, read_equality()];
                } else break;
            }
            return result;
        }

        // bitwise_XOR := bitwise_AND ("^" bitwise_AND)*
        function read_bitwise_XOR() {
            let result = read_bitwise_AND();
            for (;;) {
                const operator = tokens[index];
                if (operator && operator.token === '^') {
                    index += 1;
                    result = [operator, result, read_bitwise_AND()];
                } else break;
            }
            return result;
        }

        // bitwise_OR := bitwise_XOR ("|" bitwise_OR)*
        function read_bitwise_OR() {
            let result = read_bitwise_XOR();
            for (;;) {
                const operator = tokens[index];
                if (operator && operator.token === '|') {
                    index += 1;
                    result = [operator, result, read_bitwise_XOR()];
                } else break;
            }
            return result;
        }

        function read_expression_internal() {
            return read_bitwise_OR();
        }

        const result = read_expression_internal();
        if (index != tokens.length)
            throw new SimTool.SyntaxError('Extra tokens after expression ends',
                                          tokens[index].start, tokens[tokens.length - 1].end);
        return result;
    }

    // return value from expression tree
    eval_expression(tree) {
        if (tree.type === 'number') {
            return tree.token;
        } else if (tree.type === 'symbol' || tree.type === 'local_symbol') {
            const value = this.symbol_value(tree.token);
            if (value === undefined)
                throw tree.asSyntaxError('Undefined symbol');
            return BigInt(value);
        } else if (tree.length === 2) {    // unary operator
            switch (tree[0].token) {
            case '-':
                return -this.eval_expression(tree[1]);
            case '+':
                return this.eval_expression(tree[1]);
            case '~':
                return ~this.eval_expression(tree[1]);
            default:
                throw tree[0].asSyntaxError('Unrecognized unary operator');
            }
        } else {   // binary operator
            const left = this.eval_expression(tree[1]);
            const right = this.eval_expression(tree[2]);
            switch (tree[0].token) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '&': return left & right;
            case '^': return left ^ right;
            case '|': return left | right;
            case '<<': return left << right;
            case '>>': return left >> right;
            case '>>>': return BigInt.asUintN(64,left) >> right;
            case '==': return (left == right) ? 1n : 0n;
            case '!=': return (left != right) ? 1n : 0n;
            case '<': return (left < right) ? 1n : 0n;
            case '<=': return (left <= right) ? 1n : 0n;
            case '>=': return (left >= right) ? 1n : 0n;
            case '>': return (left > right) ? 1n : 0n;
            default:
                throw tree[0].asSyntaxError('Unrecognized binary operator');
            }
        }
    }

    // macro expansion
    expand_macro(key, operands) {
        const macro = this.macro_map.get(key.token);    // macro definition: .name, .arguments, .body

        // correct number of arguments?
        if (operands.length != macro.arguments.length)
            throw key.asSyntaxError(`Expected ${macro.arguments.length} operands, got ${operands.length}`);

        // map arguments to operands
        const arg_map = new Map();   // symbol => list of tokens to substitute
        for (let i = 0; i < operands.length; i += 1)
            arg_map.set(macro.arguments[i].token, operands[i]);

        // expand body into list of lines, each a list of tokens
        const expansion = [];
        for (let mline of macro.body) {
            const eline = [];   // expanded line
            expansion.push(eline);
            for (let i = 0; i < mline.length; i += 1) {
                const token = mline[i];
                // look for \symbol reference to macro argument
                if (token.token === '\\') {
                    const arg_name = mline[i + 1];
                    if (arg_name && arg_name.type === 'symbol' && arg_map.has(arg_name.token)) {
                        i += 1;    // consume arg name
                        // copy appropriate operand into expansion
                        const subst = arg_map.get(arg_name.token);
                        for (let j = 0; j < subst.length; j += 1)
                            eline.push(subst[j]);
                        continue;  // done with expand arg reference
                    }
                }
                eline.push(token);
            }
        }

        // switch to reading tokens from expansion until exhausted
        this.stream.push_tokens(expansion);
    }

    // returns list of tokens for each comma-separated operand in the current statement.
    // Commas inside of nested (...), [...], {...} are treated as normal tokens
    read_operands() {
        const operands = [];
        const paren_stack = [];
        for (;;) {
            // read operand tokens until end of statement or ','
            let operand = undefined;
            for (;;) {
                // collect tokens for current operand
                const token = this.stream.next_token();

                // end of statement?
                if (token === undefined || token.token === ';') {
                    if (paren_stack.length > 0) {
                        let paren = paren_stack.pop();
                        throw paren.asSyntaxError(`Missing close ${paren.token}`);
                    }
                    return operands;
                }

                // create a new operand if needed
                if (operand === undefined) { operand = []; operands.push(operand); }

                // keep track of nested parens...
                if (token.token=='(' || token.token=='[' || token.token=='{') {
                    paren_stack.push(token);
                } else if (token.token == ')') {
                    let paren = paren_stack.pop();
                    if (paren === undefined)
                        throw token.asSyntaxError('Missing matching "("');
                    if (paren.token != '(')
                        throw paren.asSyntaxError('Missing matching ")"');
                } else if (token.token == ']') {
                    let paren = paren_stack.pop();
                    if (paren === undefined)
                        throw token.asSyntaxError('Missing matching "["');
                    if (paren.token != '[')
                        throw paren.asSyntaxError('Missing matching "]"');
                } else if (token.token == '}') {
                    let paren = paren_stack.pop();
                    if (paren === undefined)
                        throw token.asSyntaxError('Missing matching "{"');
                    if (paren.token != '{')
                        throw paren.asSyntaxError('Missing matching "}"');
                } else if (paren_stack.length === 0 && token.token === ',') {
                    // end of this operand? (empty operands okay)
                    break;
                }

                operand.push(token);
            }
        }
    }

    // assemble contents of buffer
    // pass 1: define symbol values and count bytes
    // pass 2: eval expressions, assemble instructions, fill memory
    // buffer_dict is needed in case other buffers are .included
    assemble_buffer() {
        do {
            try {
                while (!this.stream.eol()) {
                    const key = this.stream.next_token();

                    // end of line?
                    if (key === undefined) break;
                    if (key.token === ';') continue;

                    if (key.type === 'label' || key.type === 'local_label') {
                        // define label
                        this.add_label(key);
                        continue;
                    } else if (key.type === 'symbol') {
                        // we'll need to know what comes after key token?
                        this.stream.eat_space_and_comments();

                        // symbol assignment?
                        if (this.stream.match('=')) {
                            const operands = this.read_operands();
                            if (operands.length !== 1)
                                this.syntax_error('single expression expected following "="',
                                                  key.start, key.end);
                            // the expression must be able to evaluated during pass 1...
                            const value = this.eval_expression(this.read_expression(operands[0]));
                            this.add_symbol(key.token, value);
                            continue;
                        }

                        // directive?
                        if (key.token.charAt(0) === '.') {
                            const operands = this.read_operands();

                            // directive?
                            const handler = this.directives.get(key.token);
                            if (handler) {
                                if (handler(key, operands)) continue;
                            }
                            throw key.asSyntaxError(`Unrecognized directive: ${key.token}`);
                        }

                        // macro invocation?
                        if (this.macro_map.has(key.token)) {
                            const operands = this.read_operands();
                            this.expand_macro(key, operands);
                            continue;
                        }

                        // opcode?
                        // list of operands, each element is a list of tokens
                        const operands = this.read_operands();
                        if (this.assemble_opcode(key, operands))
                            continue;
                    }
                    
                    // if we get here, we didn't find a legit statement
                    throw key.asSyntaxError(`"${key.token}" not recognized as an opcode, directive, or macro name`, key.start, key.end);
                }
            } catch (e) {
                if (e instanceof SimTool.SyntaxError) this.assembly_errors.push(e);
                else if (e instanceof SimTool.SyntaxWarning) this.assembly_warnings.push(e);
                else throw e;
            }
        } while (this.stream.next_line());
    }

    assemble_opcode(key, operands) { // eslint-disable-line no-unused-vars
        // this will be overridden
        return false;
    }
};

// set up GUI in any div.cpu_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('cpu_tool')) {
        new SimTool.CPUTool(div);
    }
});

//////////////////////////////////////////////////
// Memory w/ cache support
//////////////////////////////////////////////////

// NB: underlying DataView will throw a RangeError when
// address is out of bounds

// NB: bigint reads return a 64-bit unsigned value

SimTool.Memory = class {
    constructor(little_endian) {
        this.little_endian = little_endian;
        this.memory = undefined;
        this.caches = [];     // list of Cache instances
        this.has_caches = false;
        this.mask64 = 0xFFFFFFFFFFFFFFFFn;
    }

    // add a cache model
    add_cache(cache) {
        this.caches.push(cache);
        this.has_caches = true;
    }

    // reset cache state
    reset() {
        for (let cache of this.caches) cache.reset();
    }

    // access underlying DataView
    get byteLength() {
        if (this.memory === undefined) return 0;
        else return this.memory.byteLength;
    }

    // load bytes from a prototype array
    load_bytes(prototype) {
        // allocate working copy of memory if needed
        if (this.memory === undefined || this.memory.byteLength !== prototype.byteLength)
            this.memory = new DataView(new ArrayBuffer(prototype.byteLength));

        // initialize memory by copying contents from assembler_memory
        new Uint8Array(this.memory.buffer).set(new Uint8Array(prototype.buffer));

        // reset state of any associated cache models
        this.reset()
    }

    //////////////////////////////////////////////////
    // read access support
    //////////////////////////////////////////////////

    // read_big* methods return 64-bit BigInt value 

    read_int8(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getInt8(addr);
    }

    read_bigint8(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getInt8(addr)) & this.mask64;
    }

    read_int16(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getInt16(addr, this.little_endian);
    }

    read_int16_aligned(addr) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getInt16(addr, this.little_endian);
    }

    read_bigint16(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getInt16(addr, this.little_endian)) & this.mask64;
    }

    read_bigint16_aligned(addr) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getInt16(addr, this.little_endian)) & this.mask64;
    }

    read_int32(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getInt32(addr, this.little_endian);
    }

    read_int32_aligned(addr) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit read from address ${addr}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getInt32(addr, this.little_endian);
    }

    read_bigint32(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getInt32(addr, this.little_endian)) & this.mask64;
    }

    read_bigint32_aligned(addr) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit read from address ${addr}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getInt32(addr, this.little_endian)) & this.mask64;
    }

    read_bigint64(addr) {
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.read(addr, false);
                if (cache.line_size < 2) cache.read(addr+4, false);
            }
        return this.memory.getBigUint64(addr, this.little_endian);
    }

    read_bigint64_aligned(addr) {
        if ((addr & 0x7) !== 0)
            throw `Misaligned 64-bit read from address ${addr}`;
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.read(addr, false);
                if (cache.line_size < 2) cache.read(addr+4, false);
            }
        return this.memory.getBigUint64(addr, this.little_endian);
    }

    read_uint8(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getUint8(addr);
    }

    read_biguint8(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getUint8(addr));
    }

    read_uint16(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getUint16(addr, this.little_endian);
    }

    read_uint16_aligned(addr) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return this.memory.getUint16(addr, this.little_endian);
    }

    read_biguint16(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getUint16(addr, this.little_endian));
    }

    read_biguint16_aligned(addr) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, false);
        return BigInt(this.memory.getUint16(addr, this.little_endian));
    }

    read_uint32(addr, fetch) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, fetch);
        return this.memory.getUint32(addr, this.little_endian);
    }

    read_uint32_aligned(addr, fetch) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr);
        return this.memory.getUint32(addr, this.little_endian);
    }

    // a clone of read_uint32, but marked as an instruction read
    fetch32(addr) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, true);
        return this.memory.getUint32(addr, this.little_endian);
    }

    // a clone of read_uint32_aligned, but marked as an instruction read
    fetch32_aligned(addr) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, true);
        return this.memory.getUint32(addr, this.little_endian);
    }
    
    read_biguint32(addr, fetch) {
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, fetch);
        return BigInt(this.memory.getUint32(addr, this.little_endian));
    }

    read_biguint32_aligned(addr, fetch) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit read from address 0x${addr.toString(16)})`;
        if (this.has_caches)
            for (let cache of this.caches) cache.read(addr, fetch);
        return BigInt(this.memory.getUint32(addr, this.little_endian));
    }

    read_biguint64(addr) {
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.read(addr, false);
                if (cache.line_size < 2) cache.read(addr+4, false);
            }
        return this.memory.getBigUint64(addr, this.little_endian);
    }

    read_biguint64_aligned(addr) {
        if ((addr & 0x7) !== 0)
            throw `Misaligned 64-bit read from address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.read(addr, false);
                if (cache.line_size < 2) cache.read(addr+4, false);
            }
        return this.memory.getBigUint64(addr, this.little_endian);
    }

    //////////////////////////////////////////////////
    // write access support
    //////////////////////////////////////////////////

    write_int8(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint8(addr, v);
    }

    write_bigint8(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint8(addr, Number(v & 0xFFn));
    }

    write_int16(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint16(addr, v, this.little_endian);
    }

    write_int16_aligned(addr, v) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit write to address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint16(addr, v, this.little_endian);
    }

    write_bigint16(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint16(addr, Number(v & 0xFFFFn), this.little_endian);
    }

    write_bigint16_aligned(addr, v) {
        if ((addr & 0x1) !== 0)
            throw `Misaligned 16-bit write to address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint16(addr, Number(v & 0xFFFFn), this.little_endian);
    }

    write_int32(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint32(addr, v, this.little_endian);
    }

    write_int32_aligned(addr, v) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit write to address ${addr}.toString(16)`;
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint32(addr, v, this.little_endian);
    }

    write_bigint32(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint32(addr, Number(v & 0xFFFFFFFFn), this.little_endian);
    }

    write_bigint32_aligned(addr, v) {
        if ((addr & 0x3) !== 0)
            throw `Misaligned 32-bit write to address 0x${addr}.toString(16)`;
        if (this.has_caches)
            for (let cache of this.caches) cache.write(addr);
        this.memory.setUint32(addr, Number(v & 0xFFFFFFFFn), this.little_endian);
    }

    write_bigint64(addr, v) {
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.write(addr);
                if (cache.line_size < 2) cache.write(addr+4);
            }
        this.memory.setBigUint64(addr, v, this.little_endian);
    }

    write_bigint64_aligned(addr, v) {
        if ((addr & 0x7) !== 0)
            throw `Misaligned 64-bit write to address 0x${addr.toString(16)}`;
        if (this.has_caches)
            for (let cache of this.caches) {
                cache.write(addr);
                if (cache.line_size < 2) cache.write(addr+4);
            }
        this.memory.setBigUint64(addr, v, this.little_endian);
    }
}

//////////////////////////////////////////////////
// Cache model
//////////////////////////////////////////////////

SimTool.Cache = class {
    // possible replacement strategies
    static LRU = 0;
    static FIFO = 1;
    static RANDOM = 2;
    static CYCLE = 3;

    // options.total_words: total 32-bit words in the cache (default = 64)
    // options.block_size: number of words/line (must be 2**N) (default = 1)
    // options.nways: number of lines/set (default = 1)
    // NB: total_words must be a multiple of nways*block_size
    // options.replacement_strategy: one of 'lru', 'fifo', 'random', 'cycle' (default = 'lru')
    // options.write_back: write-back or write-through? (default = true)
    // options.name: name of this model (default = '?')
    constructor(options) {
        if (options === undefined) options = {};  // go with the defaults...

        // load cache configuration with defaults
        this.name = options.name || '?';
        this.total_words = options.total_words || 64;
        this.line_size = options.line_size || 1;
        this.nways = options.nways || 1;  // number of lines/set

        let ls = this.line_size;
        // keep shifting ls until LSB isn't 0...
        if (ls > 0) while (ls & 1 === 0) ls >>= 1;
        if (ls !== 1)
            throw 'Cache: line_size must be a power of two';

        if (this.total_words > 0 && (this.total_words % (this.line_size * this.nways) !== 0))
            throw 'Cache: total words must be a multiple of line_size * nways';

        const replacement = options.replacement_strategy || 'lru';
        this.replacement_strategy = {
            'lru': SimTool.Cache.LRU,
            'fifo': SimTool.Cache.FIFO,
            'random': SimTool.Cache.RANDOM,
            'cycle': SimTool.Cache.CYCLE
        }[replacement.toLowerCase()];
        if (this.replacement_strategy === undefined)
            // replace unrecognized strategy with LRU
            this.replacement_strategy = SimTool.Cache.LRU;

        this.write_back = options.write_back;
        if (this.write_back === undefined) this.write_back = true;

        // derive other useful parameters
        this.total_lines = this.total_words / this.line_size;
        this.nlines = this.total_lines / this.nways;    // number of lines in each subcache
        this.line_shift = this.log2(this.line_size) + 2;  // shift/mask to retrieve line number
        this.line_mask = this.mask(this.nlines);
        this.tag_shift = this.line_shift + this.log2(this.nlines);   // shift/mask to retrieve tag
        this.tag_mask = (1 << (32 - this.tag_shift)) - 1;

        // cache state
        this.dirty = new Uint8Array(this.total_lines);   // boolean
        this.valid = new Uint8Array(this.total_lines);   // boolean
        this.tag = new Uint32Array(this.total_lines);
        this.age = new Uint32Array(this.total_lines);

        this.reset();
    }

    // number of bits to represent n
    log2(n) {
        let log = 0;
        for (let v = 1; log < 32; v <<= 1, log += 1)
            if (v >= n) break;
        return log;
    }

    // mask to select quantity of magnitude n
    mask(n) { return (1 << this.log2(n)) - 1; }

    // reset state and access accounting
    reset() {
        this.accesses = 0;
        this.fetch_hits = 0;
        this.fetch_misses = 0;
        this.read_hits = 0;
        this.read_misses = 0;
        this.write_hits = 0;
        this.write_misses = 0;
        this.dirty_replacements = 0;
        this.valid_replacements = 0;
        this.total_replacements = 0;
        this.r_way = 0;

        this.dirty.fill(0);
        this.valid.fill(0);
        this.tag.fill(0);
        this.age.fill(0);
    }

    // read access to addr, fetch is true if instruction fetch
    read(addr, fetch) {
        this.accesses += 1;

        // check the appropriate line of each subcache                                           
        const aline = (addr >> this.line_shift) & this.line_mask;
        const atag = (addr >> this.tag_shift) & this.tag_mask;
        let index = aline;
        for (let way = 0; way < this.nways; way += 1) {
            if (this.valid[index] && this.tag[index] === atag) {
                // hit!                                                                          
                if (fetch) this.fetch_hits += 1;
                else this.read_hits += 1;
                // access updates age if LRU
                if (this.replacement_strategy == SimTool.Cache.LRU)
                    this.age[index] = this.accesses;
                return;
            }
            index += this.nlines;
        }

        // miss -- select replacement and refill                                                 
        this.replace(aline, atag, false);
        if (fetch) this.fetch_misses += 1;
        else this.read_misses += 1;
    }

    // write access to addr
    write(addr) {
        this.accesses += 1;

        // check the appropriate line of each subcache                                           
        const aline = (addr >> this.line_shift) & this.line_mask;
        const atag = (addr >> this.tag_shift) & this.tag_mask;
        let index = aline;
        for (let way = 0; way < this.nways; way += 1) {
            if (this.valid[index] && this.tag[index] === atag) {
                // hit!                                                                          
                this.write_hits += 1;
                if (this.write_back) this.dirty[index] = 1;
                // access updates age if LRU
                if (this.replacement_strategy == SimTool.Cache.LRU)
                    this.age[index] = this.accesses;
                return;
            }
            index += this.nlines;
        }

        // miss -- select replacement and refill                                                 
        this.replace(aline, atag, this.write_back);
    }

    // choose replacement line using replacement_strategy
    replace(aline, atag, make_dirty) {
        let rway = this.r_way;
        let oldest, index;
        if (this.nways > 1) {
            switch (this.replacement_strategy) {
            case SimTool.Cache.LRU:
            case SimTool.Cace.FIFO:
                // look through subcaches to find oldest line
                oldest = this.age[aline];
                index = aline + this.nlines;
                rway = 0;
                for (let way = 1; way < this.nways; way += 1) {
                    if (this.age[index] < oldest) {
                        rway = way;
                        oldest = age[index];
                    }
                    index += this.nlines;
                }
                break;
            case SimTool.Cache.RANDOM:
                rway = Math.floor(Math.random() * (this.nways + 1));
                break;
            case SimTool.Cache.CYCLE:
                rway = (rway + 1) % this.nways;
                break;
            }
        }
        this.r_way = rway;   // subcache chosen to hold replacement

        // update state for correct subcache line
        aline += rway * this.nlines;

        // update statistics, handle write-back
        this.total_replacements += 1;
        if (this.valid[aline]) {
            this.valid_replacements += 1;
            // writeback line if dirty
            if (this.dirty[aline]) {
                this.dirty[aline] = 0;
                this.dirty_replacements += 1;
            }
        }

        // refill line with new data
        this.valid[aline] = 1;
        this.dirty[aline] = make_dirty ? 1 : 0;
        this.tag[aline] = atag;
        this.age[aline] = this.accesses;
    }
}

//////////////////////////////////////////////////
// InstructionCodec: table-driven instruction encoding/decoding
//////////////////////////////////////////////////

// provide Array of {opcode:,  pattern: pattern_string, ...}
// where pattern is a string with one character for each instruction bit
//   0,1: static opcode bits
//   one or more lower-case letters: instruction fields
//   one or more upper-case letters: sign-extended instruction fields
// eg, "aaaaa" is a 5-bit field named "a"
// eg, "IIIIIIIIIIII" is a 12-bit sign-extended field named "I"

// encode(opcode_name, {field_name: value, ...}) => binary encoded instruction
// decode(binary) => {opcode_name: xxx, field_name: value, ...}

SimTool.InstructionCodec = class {
    constructor(patterns, cpu_tool) {
        this.cpu_tool = cpu_tool;
        this.pattern_table = new Map();  // opcode_name => {mask:, match:, fields:, info: }]

        // build master table
        for (let info of patterns) 
            this.pattern_table.set(info.opcode, this.process_pattern(info));
    }

    // pattern string => {info:, mask:, match:, fields: [{name:, offset:, mask:, sxt:}, ...]}
    process_pattern(info) {
        const pstring = info.pattern;
        const result = {info: info, mask: 0, match: 0, fields: []};
        let prev_char = '';
        let field;   // field currently being processed
        const MSB = pstring.length - 1;
        // process pattern right (LSB) to left (MSB)
        for (let index = 0; index <= MSB; index += 1) {
            let bit = 1 << index;
            let ch = pstring.charAt(MSB - index);  // LSB at end of string
            if (ch == '0' || ch == '1') {
                // opcode bit
                result.mask |= bit;
                if (ch == '1') result.match |= bit;
            } else if (ch == prev_char) {
                // field name character extending current field
                // extend mask by one bit
                field.mask = (field.mask << 1) | 1;
            } else {
                // first char of new field
                field = {
                    name: ch,
                    offset: index, // offset from LSB
                    mask: 1,       // initially, a one-bit field
                    sxt: (ch.toUpperCase() == ch)   // true if field is sign-extended on decode
                };
                result.fields.push(field);   // remember new field
                prev_char = ch;
            }
        }

        return result;
    }

    // return binary for instruction given opcode name and field values
    encode(opcode_name, fields, emit) {
        const pattern = this.pattern_table.get(opcode_name.toLowerCase());
        if (pattern === undefined)
            throw "unrecognized opcode name: " + opcode_name;

        let inst = pattern.match;   // opcode bits

        // insert value for each instruction field
        for (let field of pattern.fields) {
            const v = fields[field.name];
            if (v === undefined)
                throw `no value provided for field ${field.name} ['${opcode_name}', ${JSON.stringify(fields)}]`;
            inst |= (v & field.mask) << field.offset;
        }

        if (emit !== undefined) this.cpu_tool.emit32(inst);
        return inst;
    }

    // return object with opcode and field attributes
    decode(binary) {
        // look through master table for an opcode match
        for (let opcode_info of this.pattern_table.values()) {
            if ((binary & opcode_info.mask) == opcode_info.match) {
                const result = {info: opcode_info.info}

                // extract instruction fields
                for (let field of opcode_info.fields) {
                    let v = (binary >> field.offset) & field.mask;
                    if (field.sxt) {
                        // field should be sign extended if MSB is one
                        const most_positive_value = field.mask >> 1;
                        if (v > most_positive_value)
                            v -= (most_positive_value + 1) << 1;
                    }
                    result[field.name] = v;
                }

                return result;
            }
        }

        // didn't match opcode
        return undefined;
    }
}
