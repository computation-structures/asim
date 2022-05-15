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

// create cpu_tool object to hold all the methods...
//   cpu_tool.version: version string
//   cpu_tool.setup: create GUI inside of target div
// other .js files add other functionality (assembler, simulator)
var cpu_tool = (function (cpu_tool) {
    cpu_tool.version = '0.1';

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
    cpu_tool.setup = function (tool_div) {
	let gui = {};    // holds useful methods/state for this instance
	tool_div.cpu_tool = gui;   // be able to find state from DOM element

	// save any configuration info
	gui.configuration = tool_div.innerHTML.replace('<!--[CDATA[','').replace(']]-->','').trim()
        try {
	    gui.configuration = JSON.parse(gui.configuration);
	    //console.log(JSON.stringify(gui.configuration));
	    gui.ISA = gui.configuration.ISA || 'ARMv6';
	}
	catch {
	    console.log('Error parsing configuration info as JSON');
	}

	//////////////////////////////////////////////////
	// DOM for GUI
	//////////////////////////////////////////////////

	// set up DOM for GUI, replaces configuration info (which we've saved)
	tool_div.innerHTML = `
<div class="cpu_tool-wrapper">
  <div class="cpu_tool-body">
    <div class="cpu_tool-body-left">
      <div class="cpu_tool-body-left-header">
        <button class="cpu_tool-assemble-button btn btn-sm btn-primary">Assemble</button>
        <span class="cpu_tool-font-button cpu_tool-font-larger">A</span>
        <span class="cpu_tool-font-button cpu_tool-font-smaller">A</span>
        <span style="margin-left: 1em;">Buffer:</span>
        <select class="cpu_tool-editor-select"></select>
        <button class="cpu_tool-new-buffer btn btn-tiny btn-light">New buffer</button>
        <div class="cpu_tool-ISA">${gui.ISA}</div>
      </div>
      <div class="cpu_tool-buffer-name-wrapper">
        <div class="cpu_tool-read-only">&#x1F512;</div>
        <textarea class="cpu_tool-buffer-name" spellcheck="false"></textarea>
      </div>
      <!-- editor divs will be added here -->
    </div>
    <div class="cpu_tool-body-divider"></div>
    <div class="cpu_tool-body-right">
      <div class="cpu_tool-body-right-header">    
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
      </div>
      <!-- simulator divs will be added here -->
    </div>
  </div>
  <div class="cpu_tool-notice">
    <div style="float:right;">cpu_tool ${cpu_tool.version} &copy; 2022 Chris Terman</div>
  </div>
</div>
`;

	// various internal elements.  Most don't need to be saved explicitly in
	// tool state, but it makes for easier debugging.
	gui.left = tool_div.getElementsByClassName('cpu_tool-body-left')[0];
	gui.divider = tool_div.getElementsByClassName('cpu_tool-body-divider')[0];
	gui.right = tool_div.getElementsByClassName('cpu_tool-body-right')[0];
	gui.selector = tool_div.getElementsByClassName('cpu_tool-editor-select')[0];
	gui.new_buffer = tool_div.getElementsByClassName('cpu_tool-new-buffer')[0];
	gui.buffer_name = tool_div.getElementsByClassName('cpu_tool-buffer-name')[0];
	gui.read_only = tool_div.getElementsByClassName('cpu_tool-read-only')[0];
	gui.assemble_button = tool_div.getElementsByClassName('cpu_tool-assemble-button')[0];
	gui.font_larger = tool_div.getElementsByClassName('cpu_tool-font-larger')[0];
	gui.font_smaller = tool_div.getElementsByClassName('cpu_tool-font-smaller')[0];

	// adjust initial width so that only left pane and divider are visible
	gui.left.style.width = (gui.left.offsetWidth + gui.right.offsetWidth) + "px";

	//////////////////////////////////////////////////
	//  moveable divider
	//////////////////////////////////////////////////

	// set up moveable split divider
	gui.divider.addEventListener('mousedown', function (e) {
	    e = e || window.event;
	    e.preventDefault();
	    let oldx = e.clientX;   // remember starting X for the mouse
	    
	    // while dragging divider, disable mouse events on left and right panes
	    gui.left.style.userSelect = 'none';
	    gui.left.style.pointerEvents = 'none';
	    gui.right.style.userSelect = 'none';
	    gui.right.style.pointerEvents = 'none';

	    // adjust size of editor pane when mouse moves
	    function mousemove(e) {
		e = e || window.event;
		e.preventDefault();
		let dx = e.clientX - oldx;
		oldx = e.clientX;
		dx = Math.min(dx, gui.right.offsetWidth);
		gui.left.style.width = Math.max(0,gui.left.offsetWidth + dx) + "px";
	    }
	    document.addEventListener('mousemove', mousemove);

	    // all done -- remove event listeners, re-enable mouse events
	    function mouseup(e) {
		document.removeEventListener('mouseup', mouseup);
		document.removeEventListener('mousemove', mousemove);
		gui.left.style.removeProperty('user-select');
		gui.left.style.removeProperty('pointer-events');
		gui.right.style.removeProperty('user-select');
		gui.right.style.removeProperty('pointer-events');
	    }
	    document.addEventListener('mouseup', mouseup);
	});

	//////////////////////////////////////////////////
	// editor/buffer management
	//////////////////////////////////////////////////

	gui.editor_list = [];   // list of CodeMirror elements

	// create a new CodeMirror instance, add it to left pane,
	// update selector to include new buffer name
	function new_editor_pane(name, contents, readonly) {
	    gui.selector.innerHTML += `<option value="${name}" selected>${name}</option>`;

	    let options = {
		lineNumbers: true,
		mode: {name: "gas", architecture: gui.ISA},
		value: contents || ''
	    };
	    if (readonly) options.readOnly = true

	    // make a new editor pane
	    let cm = CodeMirror(function(cm) {
		gui.left.appendChild(cm);
		cm.id = name;
		if (readonly) cm.style.backgroundColor = '#ddd';
		gui.editor_list.push(cm);
		gui.buffer_name.innerHTML = name;
	    }, options);
	}

	// change font size in buffers
	function buffer_font_size(which) {
	    let larger = {'50%': '100%', '100%': '125%', '125%': '150%', '150%': '200%', '200%': '200%' };
	    let smaller = {'50%': '50%', '100%': '50%', '125%': '100%', '150%': '125%', '200%': '150%' };

	    for (let editor of gui.editor_list) {
		let current_size = editor.style.fontSize || '100%';
		editor.style.fontSize = (which == 'larger') ? larger[current_size] : smaller[current_size];
	    }
	}
	gui.font_larger.addEventListener('click',function () { buffer_font_size('larger'); });
	gui.font_smaller.addEventListener('click',function () { buffer_font_size('smaller'); });

	// select a buffer to view
	gui.select_buffer = function (name) {
	    // choose which instance to show
	    for (let editor of gui.editor_list) {
		if (editor.id == name) {
		    // selected
		    editor.style.display = 'block';
		    gui.read_only.style.display = editor.CodeMirror.options.readOnly ? 'block' : 'none';
		    gui.buffer_name.value = name;
		    editor.CodeMirror.focus();
		} else {
		    // not selected
		    editor.style.display = 'none';
		}
	    }

	    // update selector (not needed if buffer selection came from selector!)
	    for (let option of gui.selector.getElementsByTagName('option')){
		if (option.getAttribute('value') == name) {
		    option.selected = true;
		    break;
		}
	    }
	}

	// buffer selection events
	gui.selector.addEventListener('change', function () {
	    gui.select_buffer(gui.selector.value);
	});

	// is buffer name already used?
	function buffer_name_in_use(name) {
	    for (let editor of gui.editor_list) {
		if (editor.getAttribute.id == name)
		    return true;
	    }
	    return false;
	}

	// new buffer button
	gui.new_buffer.addEventListener('click', function () {
	    let index = 1;
	    let name;
	    while (true) {
		name = 'Untitled' + index;
		if (!buffer_name_in_use(name)) break;
		index += 1;
	    }
	    new_editor_pane(name)
	    gui.select_buffer(name);
	});

	// rename buffer after checking that new name is okay
	function rename_buffer() {
	    let old_name = gui.selector.value;
	    let new_name = gui.buffer_name.value;

	    // is new name okay?
	    if (new_name == old_name) return;
	    if (new_name == '' || buffer_name_in_use(new_name)) {
		alert(new_name=='' ? 'Buffer name cannot be blank.' : 'Buffer name already in use.');
		gui.buffer_name.value = old_name;
		return;
	    }

	    // change id attribute for renamed buffer
	    for (let editor of gui.editor_list) {
		if (editor.id == old_name) {
		    editor.id = new_name;
		    break;
		}
	    }

	    // change buffer selector
	    for (let option of gui.selector.getElementsByTagName('option')){
		if (option.getAttribute('value') == old_name) {
		    option.setAttribute('value', new_name);
		    option.innerHTML = new_name;
		    break;
		}
	    }
	}
	gui.buffer_name.addEventListener('change', rename_buffer);
	gui.buffer_name.addEventListener('keydown', function (e) {
	    e = e || window.event;
	    if ((e.keyCode ? e.keyCode : e.which) == 13) {
		rename_buffer();
		e.preventDefault();
		return false;
	    }
	});

	//////////////////////////////////////////////////
	// invoke the assembler on a buffer
	//////////////////////////////////////////////////

	gui.assemble = function () {
	    let top_level_buffer_name = gui.buffer_name.value;

	    // collect all the buffers since they may be referenced by .include
	    let buffer_dict = {};
	    for (let editor of gui.editor_list) {
		buffer_dict[editor.id] = editor.CodeMirror.doc.getValue();
	    }

	    let result = cpu_tool.assemble(top_level_buffer_name, buffer_dict, gui.ISA);
	    console.log(result);
	}

	gui.assemble_button.addEventListener('click',gui.assemble)

	//////////////////////////////////////////////////
	// initialize state: process configuration info
	//////////////////////////////////////////////////

	// set up buffers from configuration info
	if (gui.configuration.buffers) {
	    for (let buffer of gui.configuration.buffers) {
		new_editor_pane(buffer['name'], buffer['contents'], buffer['readonly']);
	    }
	} else {
	    new_editor_pane('Untitled');
	}

	// select first buffer to edit initially
	gui.select_buffer(gui.editor_list[0].id);
    }

    return cpu_tool;
})({});

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    for (let tool_div of document.getElementsByClassName('cpu_tool')) {
	cpu_tool.setup(tool_div);
    }
});
