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

SimTool.CPUTool = class extends SimTool {
    constructor(tool_div, version, cm_mode, for_edx) {
        super(tool_div, version || 'cpu_tool.19', cm_mode, for_edx);

        // get the emulator state set up
        this.emulation_initialize();

        // fill in right pane with CPU state display
        this.cpu_gui_setup();
        this.reset_action();
    }

    //////////////////////////////////////////////////
    // CPU simulation GUI
    //////////////////////////////////////////////////

    cpu_gui_setup() {
        // "Assemble" action button
        this.add_action_button('Assemble', function () {});

        // set up simulation panes
        this.right.innerHTML = `
<div class="cpu_tool-simulator-header">
  <button class="cpu_tool-simulator-control cpu_tool-reset btn btn-sm btn-primary" disabled>Reset</button>
  <button class="cpu_tool-simulator-control cpu_tool-step btn btn-sm btn-primary" disabled>Step</button>
  <button class="cpu_tool-simulator-control cpu_tool-walk btn btn-sm btn-primary" disabled>Walk</button>
  <button class="cpu_tool-simulator-control cpu_tool-run btn btn-sm btn-primary" disabled>Run</button>
</div>
<div class="cpu_tool-simulator-divs">
  <div class="cpu_tool-regs-and-insts">
    <div class="cpu_tool-pane cpu_tool-regs"></div>
    <div class="cpu_tool-banner" style="margin-bottom: -5px;">Disassembly</div>
    <div class="cpu_tool-pane cpu_tool-insts"></div>
  </div>
  <div class="cpu_tool-memory-column">
    <div class="cpu_tool-banner">Memory</div>
    <div class="cpu_tool-pane cpu_tool-memory"></div>
  </div>
  <div class="cpu_tool-pane cpu_tool-stack-column">
    <div class="cpu_tool-banner">Stack</div>
    <div class="cpu_tool-stack"></div>
  </div>
</div>
<div class="cpu_tool-footer">
</div>
`;
        this.reset_button = this.right.getElementsByClassName('cpu_tool-reset')[0];
        this.step_button = this.right.getElementsByClassName('cpu_tool-step')[0];
        this.walk_button = this.right.getElementsByClassName('cpu_tool-walk')[0];
        this.run_button = this.right.getElementsByClassName('cpu_tool-run')[0];

        this.sim_divs = this.right.getElementsByClassName('cpu_tool-simulator-divs')[0];
        this.regs_div = this.right.getElementsByClassName('cpu_tool-regs')[0];
        this.insts_div = this.right.getElementsByClassName('cpu_tool-insts')[0];
        this.memory_div = this.right.getElementsByClassName('cpu_tool-memory')[0];
        this.stack_div = this.right.getElementsByClassName('cpu_tool-stack')[0];

        if (this.stack_direction === undefined) this.stack_div.style.display = 'none';

        this.reset_button.addEventListener('click', this.reset_action);
        this.step_button.addEventListener('click', this.step_action);
        this.walk_button.addEventListener('click', this.walk_action);
        this.run_button.addEventListener('click', this.run_action);
    }

    // reset simulation, refresh state display
    reset_action() {
        this.emulation_reset();
        this.fill_in_simulator_gui();  // refresh state display by starting over...
        this.next_pc();

        this.reset_button.disabled = false;
        this.step_button.disabled = false;
        this.walk_button.disabled = false;
        this.run_button.disabled = false;
    }

    step_action() {
        try {
            emulation_step();
        } catch (err) {
            if (err != 'Halt Execution') throw err;
        }
    }
        
    walk_action() {
        function step_and_display() {
            // execute one instruction
            this.emulation_step(gui);
            // give browser a chance to update display
            setTimeout(step_and_display, 0);
        }

        try {
            step_and_display();
        } catch (err) {
            if (err != 'Halt Execution') throw err;
        }
    }

    run_action () {
        this.clear_highlights();
        this.insts_div.style.backgroundColor = 'grey';

        // give display a chance to update before starting execution
        setTimeout(function () {
            const start = new Date();
            let ncycles = 0;
            try {
                for (;;) {
                    // no display update...
                    this.emulation_step();
                    ncycles += 1;
                }
            } catch (err) {
                if (err != 'Halt Execution') throw err;
            }
            const end = new Date();
            // secs of execution time
            const secs = (end.getTime() - start.getTime())/1000.0;
            console.log(`${ncycles} insts in ${secs} seconds = ${ncycles/secs} insts/sec`);

            // rebuild display using current contents of register_file and memory
            this.insts_div.style.backgroundColor = 'white';
            this.fill_in_simulator_gui();
            this.next_pc();
        },0);
    };

    // required minimal state: .memory, .pc, .label_table
    emulation_initialize() {
        // to be overridden

        // some default values to get us started...
        this.label_table = new Map();   // addr => label_name

        this.little_endian = true;

        this.stack_direction = 'down';   // can be 'down', 'up', or undefined
        this.sp_register_number = 2;

        this.memory = new DataView(new ArrayBuffer(256));

        this.register_file = new Array(32);
        this.register_file.fill(0);
        this.register_names = new Array(32);
        for (let r = 0; r < this.register_file.length; r += 1)
            this.register_names[r] = 'r' + r;

        this.pc = 0;
    }

    emulation_reset() {
        // to be overridden
    }

    emulation_step() {
        // to be overridden
    }

    disassemble(v, addr) {
        // to be overridden
        return '???';
    }

    // return hexified contents of memory[addr]
    location(addr) {
        return this.hexify(this.memory.getUint32(addr, this.little_endian), 8);
    }

    // populate the state display with addresses/values
    fill_in_simulator_gui() {
        this.sim_divs.focus();

        let table;

        // how many hex digits for memory address?
        const asize = Math.ceil(Math.log2(this.memory.byteLength)/4);

        if (this.register_file !== undefined) {
            // fill register display
            table = ['<div class="cpu_tool-banner">Registers</div>'];
            table.push('<table cellpadding="2px" border="0">');
            const colsize = Math.ceil(this.register_names.length/4);
            for (let reg = 0; reg < colsize; reg += 1) {
                const row = ['<tr>'];
                for (let rnum = reg; rnum < 4*colsize; rnum += colsize) {
                    if (rnum < this.register_names.length) {
                        row.push(`<td class="cpu_tool-addr">${this.register_names[rnum]}</td>`);
                        row.push(`<td id="r${rnum}">${this.hexify(this.register_file[rnum],8)}</td>`);
                    } else row.push('<td></td><td></td>');
                }
                row.push('</tr>');
                table.push(row.join(''));
            }
            table.push('</table>');
            this.regs_div.innerHTML = table.join('');
        }

        // fill in disassembly display
        table = ['<table cellpadding="2px" border="0">'];
        for (let addr = 0; addr < this.memory.byteLength; addr += 4) {
            const a = this.hexify(addr, asize);
            let label = '';
            if (this.label_table.has(addr)) {
                label = this.label_table.get(addr);
                if (/L\d\*\d+/.test(label)) label = label.charAt(1);
                label += ':';
                if (label.length > 10) {
                    a = a.slice(0,9) + '&hellip;:';
                }
            }
            const v = this.memory.getUint32(addr,this.little_endian);
            const i = this.disassemble(v, addr);
            table.push(`<tr><td class="cpu_tool-addr">${a}</td>
                          <td>${this.hexify(v)}</td>
                          <td class="cpu_tool-label">${label}</td>
                          <td class="cpu_tool-inst" id="i${addr}">${i}</td>
                        </tr>`);
        }
        table.push('</table>');
        this.insts_div.innerHTML = table.join('');

        // fill memory display
        table = ['<table cellpadding="2px" border="0">'];
        for (let addr = 0; addr < this.memory.byteLength; addr += 4) {
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
            for (let addr = 0; addr < this.memory.byteLength; addr += 4) {
                table.push(`<tr>
                              <td class="cpu_tool-addr">${this.hexify(addr,asize)}</td>
                              <td id="s${addr}">${this.location(addr)}</td>
                            </tr>`);
            }
            table.push('</table>');
            this.stack_div.innerHTML = table.join('');
        }
    }

    is_visible(ele, container) {
        const { bottom, height, top } = ele.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return top <= containerRect.top ? containerRect.top - top <= height : bottom - containerRect.bottom <= height;
    }

    clear_highlights() {
        // remove previous read highlights
        for (let td of this.regs_div.getElementsByClassName('cpu_tool-reg-read')) {
            td.classList.remove('cpu_tool-reg-read');
        }
            
        // remove previous write highlights
        for (let td of this.regs_div.getElementsByClassName('cpu_tool-reg-write')) {
            td.classList.remove('cpu_tool-reg-write');
        }
            
        // remove previous read highlights
        for (let td of this.memory_div.getElementsByClassName('cpu_tool-mem-read')) {
            td.classList.remove('cpu_tool-mem-read');
        }
            
        // remove previous write highlights
        for (let td of this.memory_div.getElementsByClassName('cpu_tool-mem-write')) {
            td.classList.remove('cpu_tool-mem-write');
        }

        // remove previous inst highlights
        for (let td of this.insts_div.getElementsByClassName('cpu_tool-next-inst')) {
            td.classList.remove('cpu_tool-next-inst');
        }
    }

    // update reg display after a read
    reg_read(rnum) {
        // highlight specified register
        const rtd = document.getElementById('r' + rnum);
        rtd.classList.add('cpu_tool-reg-read');
    }

    // update reg display after a write
    reg_write(rnum, v) {
        // look for writes to x0, which have been redirected
        // duing inst decoding to register_file[-1].
        if (rnum == -1) return;

        // highlight specified register
        const rtd = document.getElementById('r' + rnum);
        rtd.classList.add('cpu_tool-reg-write');
        rtd.innerHTML = this.hexify(v, 8);

        // when writing to SP, scroll stack pane appropriately
        if (rnum == this.sp_register_number) {
            const tos = document.getElementById('s' + v);
            tos.scrollIntoView({block: 'center'});
        }
    }

    // update mem displays after a read
    mem_read(addr) {
        addr &= ~3;   // memory display is word aligned

        // highlight specified memory location
        const mtd = document.getElementById('m' + addr);
        mtd.classList.add('cpu_tool-mem-read');

        // make sure location is visible in memory pane
        if (!this.is_visible(mtd, this.memory_div))
            mtd.scrollIntoView({block: 'center'});

        if (this.sp_register_number) {
            const std = document.getElementById('s' + addr);
            std.classList.add('cpu_tool-mem-read');
            // stack pane scrolling controlled by sp value
        }
    }

    // update mem displays after a write
    mem_write(addr, v) {
        addr &= ~3;   // memory display is word aligned

        // highlight specified memory location
        const mtd = document.getElementById('m' + addr);
        mtd.classList.add('cpu_tool-mem-write');
        mtd.innerHTML = this.hexify(v, 8);

        // make sure location is visible in memory pane
        if (!this.is_visible(mtd, this.memory_div))
            mtd.scrollIntoView({block: 'center'});

        if (this.sp_register_number) {
            const std = document.getElementById('s' + addr);
            std.classList.add('cpu_tool-mem-write');
            std.innerHTML = this.hexify(v, 8);
            // stack pane scrolling controlled by sp value
        }
    }

    // update disassembly display after executing an inst
    // pc is addr of next instruction to be executed
    next_pc() {
        // remove previous read highlights
        for (let td of this.insts_div.getElementsByClassName('cpu_tool-next-inst')) {
            td.classList.remove('cpu_tool-next-inst');
        }
            
        const itd = document.getElementById('i' + this.pc);
        itd.parentElement.classList.add('cpu_tool-next-inst');

        // make sure next inst is visible in disassembly area
        if (!this.is_visible(itd, this.insts_div))
            itd.scrollIntoView({block: 'center'});
    }
};

// set up GUI in any div.sim_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('cpu_tool')) {
        new SimTool.CPUTool(div);
    }
});
