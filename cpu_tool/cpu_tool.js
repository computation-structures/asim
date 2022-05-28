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

// create cpu_tool object to hold all the methods...
//   cpu_tool.version: version string
//   cpu_tool.setup: create GUI inside of target div
// other .js files add other functionality (assembler, simulator)
sim_tool.cpu_tool = (function () {
    let cpu_tool = {};
    cpu_tool.version = 'cpu_tool.11';

    // configuration and architectural info for each supported ISA.
    // included architecture-specific .js files register here.
    cpu_tool.isa_info = {};

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
    cpu_tool.setup = function (tool_div, for_edx) {
        let configuration = sim_tool.read_configuration(tool_div, for_edx);
        
        // figure out which CPU were emulating
        let ISA = configuration.ISA || 'ARMv6';
        if (cpu_tool.isa_info[ISA] === undefined)
            window.alert("Unrecognized ISA: " + ISA);

        // set up gui framework
        let gui = sim_tool.setup(tool_div, cpu_tool.version, cpu_tool.isa_info[ISA].cm_mode);
        tool_div.sim_tool = gui;   // be able to find state from DOM element
        gui.ISA = ISA;
        gui.configuration = configuration;

        // customize gui
        gui.sim_tool_header_info.innerHTML = `<div class="sim_tool-ISA">${ISA}</div>`;
        gui.sim_tool_simulator_header = tool_div.getElementsByClassName('sim_tool-simulator-header')[0];
        gui.sim_tool_simulator_header.innerHTML = `
            <div class="cpu_tool-simulator-control cpu_tool-reset">
              <i class="fa-solid fa-backward-fast"></i>
              <div class="cpu_tool-tip">reset to beginning</div>
            </div>
            <div class="cpu_tool-simulator-control cpu_tool-back-one">
              <i class="fa-solid fa-backward-step"></i>
              <div class="cpu_tool-tip">go back one instruction</div>
            </div>
            <div class="cpu_tool-simulator-control cpu_tool-forward-one">
              <i class="fa-solid fa-forward-step"></i>
              <div class="cpu_tool-tip">go forward one instruction</div>
            </div>
            <div class="cpu_tool-simulator-control cpu_tool-start-execution">
              <i class="fa-solid fa-forward"></i>
              <div class="cpu_tool-tip">start execution</div>
            </div>
            <div class="cpu_tool-simulator-control cpu_tool-finish-execution">
              <i class="fa-solid fa-forward-fast"></i>
              <div class="cpu_tool-tip">finish execution</div>
            </div>
         `;

        gui.simulator_divs = tool_div.getElementsByClassName('cpu_tool-simulator-divs')[0];
        gui.assemble_button = tool_div.getElementsByClassName('cpu_tool-assemble-button')[0];

        // ready to process configuration info
        sim_tool.process_configuration(gui, for_edx);

        //////////////////////////////////////////////////
        // invoke the assembler on a buffer
        //////////////////////////////////////////////////

        // assemble the buffer 
        gui.assemble = function () {
            gui.error_div.style.display = 'none';  // hide previous errors
            let top_level_buffer_name = gui.buffer_name.value;

            // collect all the buffers since they may be referenced by .include
            let buffer_dict = {};
            for (let editor of gui.editor_list) {
                buffer_dict[editor.id] = editor.CodeMirror.doc.getValue();
            }

            // invoke the assembler
            let result = cpu_tool.assemble(top_level_buffer_name, buffer_dict,
                                           cpu_tool.isa_info[gui.ISA]);

            console.log(result);
            if (result.errors.length > 0) {
                gui.left_pane_only();
                sim_tool.handle_errors(result.errors);
            } else {
                // invoke simulator?!
            }
        };

        gui.add_action_button('Assemble', gui.assemble);
        //gui.add_action_button('Say Hi!', function () { alert('Hi!'); }, ['btn-warning']);
    };

    return cpu_tool;
})();

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    // config comes from contents of div.cpu_tool
    for (let tool_div of document.getElementsByClassName('cpu_tool')) {
        sim_tool.cpu_tool.setup(tool_div, false);
    }

    // config comes from edx state
    for (let tool_div of document.getElementsByClassName('edx_cpu_tool')) {
        sim_tool.cpu_tool.setup(tool_div, true);
    }
});
