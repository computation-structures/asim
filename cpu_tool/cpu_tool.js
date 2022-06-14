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

var sim_tool;   // keep lint happy

// create cpu_tool object to hold all the methods...
//   cpu_tool.version: version string
//   cpu_tool.setup: create GUI inside of target div
// other .js files add other functionality (assembler, simulator)
(function () {
    "use strict";

    sim_tool.cpu_tool_version = 'cpu_tool.18';

    // configuration and architectural info for each supported ISA.
    // included architecture-specific .js files register here.
    sim_tool.isa_info = {};

    // Create GUI inside of target div (and add attribute that points to methods/state).
    // Adds CodeMirror instance for each buffer name/contents in configuration JSON
    // useful methods/state:
    //  .configuration: results of parsing JSON inside of target div
    //  .ISA: name of target ISA
    //  .left: div for left (assembler) pane
    //  .right: div for right (simulator) pane
    //  .editor_list: CodeMirror DOM element for each editor
    //     .editor_list[n].CodeMirror = CodeMirror instance for nth editor
    //     .editor_list[n].id = name of buffer being edited
    sim_tool.cpu_tool_setup = function (tool_div, for_edx) {
        let configuration = sim_tool.read_configuration(tool_div, for_edx);
        
        // figure out which CPU were emulating
        let ISA = configuration.ISA || 'ARMv6';
        if (sim_tool.isa_info[ISA] === undefined)
            window.alert("Unrecognized ISA: " + ISA);

        // set up gui framework
        let gui = sim_tool.setup(tool_div, sim_tool.cpu_tool_version, sim_tool.isa_info[ISA].cm_mode);
        tool_div.sim_tool = gui;   // be able to find state from DOM element
        gui.ISA = ISA;
        gui.ISA_info = sim_tool.isa_info[ISA];
        gui.configuration = configuration;

        // customize gui
        gui.sim_tool_header_info.innerHTML = `<div class="sim_tool-ISA">${ISA}</div>`;
        gui.assemble_button = tool_div.getElementsByClassName('cpu_tool-assemble-button')[0];

        // set up simulation panes
        gui.right.innerHTML = `
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
        gui.reset = tool_div.getElementsByClassName('cpu_tool-reset')[0];
        gui.step = tool_div.getElementsByClassName('cpu_tool-step')[0];
        gui.walk = tool_div.getElementsByClassName('cpu_tool-walk')[0];
        gui.run = tool_div.getElementsByClassName('cpu_tool-run')[0];

        gui.sim_divs = tool_div.getElementsByClassName('cpu_tool-simulator-divs')[0];
        gui.regs = tool_div.getElementsByClassName('cpu_tool-regs')[0];
        gui.insts = tool_div.getElementsByClassName('cpu_tool-insts')[0];
        gui.memory = tool_div.getElementsByClassName('cpu_tool-memory')[0];
        gui.stack = tool_div.getElementsByClassName('cpu_tool-stack')[0];

        // hide stack pane if ISA doesn't have stack pointer
        if (gui.ISA_info.sp_register_number === undefined)
            gui.stack.parentElement.style.display = 'none';

        // ready to process configuration info
        sim_tool.process_configuration(gui, for_edx);

        //////////////////////////////////////////////////
        // simulator gui: panes for registers, disassembly, memory, stack
        //////////////////////////////////////////////////

        sim_tool.reset = function () {
            console.log('reset');
            gui.ISA_info.emulation_initialize(gui.result.memory);
            set_up_simulator_gui(gui.result);

            gui.reset.disabled = false;
            gui.step.disabled = false;
            gui.walk.disabled = false;
            gui.run.disabled = false;
        };
        gui.reset.addEventListener('click', sim_tool.reset);

        sim_tool.step = function () {
            console.log('step');
            gui.ISA_info.emulation_step(gui);
        };
        gui.step.addEventListener('click', sim_tool.step);
        
        sim_tool.walk = function () {
            console.log('walk');
        };
        gui.walk.addEventListener('click', sim_tool.walk);

        sim_tool.run = function () {
            console.log('run');
        };
        gui.run.addEventListener('click', sim_tool.run);

        function set_up_simulator_gui(result) {
            gui.sim_divs.focus();
            result.gui = gui;   // for ease of access
            let memory = result.memory;
            let label_table = result.label_table();
            let table;

            // how many hex digits for memory address?
            let asize = Math.ceil(Math.log2(memory.byteLength)/4);

            // fill register display
            table = ['<div class="cpu_tool-banner">Registers</div>'];
            table.push('<table cellpadding="2px" border="0">');
            let register_names = result.isa.register_names;
            let colsize = Math.ceil(register_names.length/4);
            for (let reg = 0; reg < colsize; reg += 1) {
                let row = ['<tr>'];
                for (let rnum = reg; rnum < 4*colsize; rnum += colsize) {
                    if (rnum < register_names.length) {
                        row.push(`<td class="cpu_tool-addr">${register_names[rnum]}</td>`);
                        row.push(`<td id="r${rnum}">00000000</td>`);
                    } else row.push('<td></td><td></td>');
                }
                row.push('</tr>');
                table.push(row.join(''));
            }
            table.push('</table>');
            gui.regs.innerHTML = table.join('');

            // fill in disassembly display
            table = ['<table cellpadding="2px" border="0">'];
            for (let addr = 0; addr < memory.byteLength; addr += 4) {
                let a = sim_tool.hexify(addr, asize);
                let label = '';
                if (label_table.has(addr)) {
                    label = label_table.get(addr);
                    if (/L\d\*\d+/.test(label)) label = label.charAt(1);
                    label += ':';
                    if (label.length > 10) {
                        a = a.slice(0,9) + '&hellip;:';
                    }
                }
                let v = memory.getUint32(addr,gui.ISA_info.little_endian);
                let i = gui.ISA_info.disassemble(v, addr);
                table.push(`<tr><td class="cpu_tool-addr">${a}</td>
                              <td>${sim_tool.hexify(v)}</td>
                              <td class="cpu_tool-label">${label}</td>
                              <td class="cpu_tool-inst" id="i${addr}">${i}</td>
                            </tr>`);
            }
            table.push('</table>');
            gui.insts.innerHTML = table.join('');

            // fill memory display
            table = ['<table cellpadding="2px" border="0">'];
            for (let addr = 0; addr < memory.byteLength; addr += 4) {
                table.push(`<tr>
                              <td class="cpu_tool-addr">${sim_tool.hexify(addr,asize)}</td>
                              <td id="m${addr}">${result.location(addr)}</td>
                            </tr>`);
            }
            table.push('</table>');
            gui.memory.innerHTML = table.join('');

            if (gui.stack) {
                // fill stack display
                table = ['<table cellpadding="2px" border="0">'];
                for (let addr = 0; addr < memory.byteLength; addr += 4) {
                    table.push(`<tr>
                                  <td class="cpu_tool-addr">${sim_tool.hexify(addr,asize)}</td>
                                  <td id="s${addr}">${result.location(addr)}</td>
                                </tr>`);
                }
                table.push('</table>');
                gui.stack.innerHTML = table.join('');
            }
        }

        // update reg display after a read
        gui.reg_read = function (rnum) {
            // remove previous read highlights
            for (let td of document.getElementsByClassName('cpu_tool-reg-read')) {
                td.classList.remove('cpu_tool-reg-read');
            }
            
            // highlight specified register
            let rtd = document.getElementById('r' + rnum);
            rtd.classList.add('cpu_tool-reg-read');
        };

        // update reg display after a write
        gui.reg_write = function (rnum, v) {
            // remove previous read highlights
            for (let td of document.getElementsByClassName('cpu_tool-reg-write')) {
                td.classList.remove('cpu_tool-reg-write');
            }
            
            // highlight specified register
            let rtd = document.getElementById('r' + rnum);
            rtd.classList.add('cpu_tool-reg-write');
            rtd.innerHTML = sim_tool.hexify(v, 8);

            // when writing to SP, scroll stack pane appropriately
            if (rnum == gui.ISA_info.sp_register_number) {
                let tos = document.getElementById('s' + v);
                tos.scrollIntoView({block: 'center'});
            }
        };

        // update mem displays after a read
        gui.mem_read = function (addr) {
            // remove previous read highlights
            for (let td of document.getElementsByClassName('cpu_tool-mem-read')) {
                td.classList.remove('cpu_tool-mem-read');
            }
            
            // highlight specified memory location
            let mtd = document.getElementById('m' + addr);
            mtd.classList.add('cpu_tool-mem-read');
            mtd.scrollIntoView();

            if (gui.ISA_info.sp_register_number) {
                let std = document.getElementById('s' + addr);
                std.classList.add('cpu_tool-mem-read');
                // stack pane scrolling controlled by sp value
            }
        };

        // update mem displays after a write
        gui.mem_write = function (addr, v) {
            // remove previous read highlights
            for (let td of document.getElementsByClassName('cpu_tool-mem-write')) {
                td.classList.remove('cpu_tool-mem-write');
            }
            
            // highlight specified memory location
            let mtd = document.getElementById('m' + addr);
            mtd.classList.add('cpu_tool-mem-write');
            mtd.innerHTML = sim_tool.hexify(v, 8);
            mtd.scrollIntoView();

            if (gui.ISA_info.sp_register_number) {
                let std = document.getElementById('s' + addr);
                std.classList.add('cpu_tool-mem-write');
                std.innerHTML = sim_tool.hexify(v, 8);
                // stack pane scrolling controlled by sp value
            }
        };

        // update disassembly display after executing an inst
        // pc is addr of next instruction to be executed
        gui.update_pc = function (pc) {
            console.log('update_pc',pc);
        };

        //////////////////////////////////////////////////
        // invoke the assembler on a buffer
        //////////////////////////////////////////////////

        // assemble the buffer 
        gui.assemble = function () {
            gui.error_div.style.display = 'none';  // hide previous errors
            let top_level_buffer_name = gui.buffer_name.value;

            // collect all the buffers since they may be referenced by .include
            let buffer_map = new Map();
            for (let editor of gui.editor_list) {
                buffer_map.set(editor.id, editor.CodeMirror.doc.getValue());
            }

            // invoke the assembler
            let result = sim_tool.assemble(top_level_buffer_name, buffer_map,
                                           sim_tool.isa_info[gui.ISA]);

            console.log(result);
            if (result.errors.length > 0) {
                gui.left_pane_only();
                gui.handle_errors(result.errors);
            } else {
                gui.result = result;
                sim_tool.reset();

                // figure how much to shink left pane
                let sim_width = gui.sim_divs.scrollWidth;
                let div_width = gui.divider.offsetWidth;
                let pct = 100*(sim_width + div_width + 27)/gui.left.parentElement.offsetWidth;
                gui.left.style.width = Math.max(0,100 - pct) + '%';
            }
        };

        gui.add_action_button('Assemble', gui.assemble);
        //gui.add_action_button('Say Hi!', function () { alert('Hi!'); }, ['btn-warning']);
    };
})();

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    // config comes from contents of div.cpu_tool
    for (let tool_div of document.getElementsByClassName('cpu_tool')) {
        sim_tool.cpu_tool_setup(tool_div, false);
    }

    // config comes from edx state
    for (let tool_div of document.getElementsByClassName('edx_cpu_tool')) {
        sim_tool.cpu_tool_setup(tool_div, true);
    }
});
