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
var cpu_tool = (function (cpu_tool, for_edx) {
    cpu_tool.version = '0.1';

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
    cpu_tool.setup = function (tool_div) {
        let gui = {};    // holds useful methods/state for this instance
        tool_div.cpu_tool = gui;   // be able to find state from DOM element

        // save any configuration info
        gui.configuration = tool_div.innerHTML.replace('<!--[CDATA[','').replace(']]-->','').trim()
        try {
            gui.configuration = JSON.parse(gui.configuration);
            //console.log(JSON.stringify(gui.configuration));
            gui.ISA = gui.configuration.ISA || 'ARMv6';

            // do we know about this ISA?
            if (cpu_tool.isa_info[gui.ISA] === undefined)
                window.alert("Unrecognized ISA: " + gui.ISA);
        }
        catch {
            window.alert('Error parsing configuration info as JSON');
        }

        //////////////////////////////////////////////////
        // DOM for GUI
        //////////////////////////////////////////////////

        // set up DOM for GUI, replaces configuration info (which we've saved)
        tool_div.innerHTML = `
  <div class="cpu_tool-body">
    <div class="cpu_tool-body-left">
      <div class="cpu_tool-settings-pane">
        Font size:
        <span class="cpu_tool-font-button cpu_tool-font-larger">A</span>
        <span class="cpu_tool-font-button cpu_tool-font-smaller">A</span>
        <br>
        Key map:
        <select class="cpu_tool-key-map">
          <option value="default" selected>default</option>
          <option value="emacs">emacs</option>
          <option value="sublime">sublime</option>
          <option value="vim">vim</option>
        </select>
      </div>
      <div class="cpu_tool-body-left-header">
        <button class="cpu_tool-assemble-button btn btn-sm btn-primary">Assemble</button>
        Buffer:
        <select class="cpu_tool-editor-select"></select>
        <button class="cpu_tool-new-buffer btn btn-tiny btn-light">New buffer</button>
        <div class="cpu_tool-settings-icon"><i class="fa fa-gear"></i></div>
        <div class="cpu_tool-ISA">${gui.ISA}</div>
      </div>
      <div class="cpu_tool-error-div">
        <div class="cpu_tool-error-header"></div>
        <div class="cpu_tool-error-list"></div>
      </div>
      <div class="cpu_tool-buffer-name-wrapper">
        <div class="cpu_tool-read-only"><i class="fa fa-lock"></i></div>
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
     <div class="cpu_tool-simulator-divs"
       <!-- simulator divs will be added here -->
     </div>
    </div>
  </div>
  <div class="cpu_tool-notice">
    <div style="float:right;">
      <a style="margin-right:0.5em;" href="mailto:edx_lab_tools@computationstructures.org?subject=Bug report for cpu_tool ${cpu_tool.version}">send bug report<a>
      <!--<a style="margin-right:0.5em;" href="https://github.com/computation-structures/edx_cpu_tool/issues/new?title=Bug+report+for+cpu_tool+${cpu_tool.version}&body=Describe+the+problem" target="_blank">send bug report<a>-->
      cpu_tool ${cpu_tool.version}
    </div>
  </div>
`;

        // various internal elements.  Most don't need to be saved explicitly in
        // tool state, but it makes for easier debugging.
        gui.left = tool_div.getElementsByClassName('cpu_tool-body-left')[0];
        gui.divider = tool_div.getElementsByClassName('cpu_tool-body-divider')[0];
        gui.right = tool_div.getElementsByClassName('cpu_tool-body-right')[0];
        gui.settings_pane = tool_div.getElementsByClassName('cpu_tool-settings-pane')[0];
	gui.simulator_divs = tool_div.getElementsByClassName('cpu_tool-simulator-divs')[0];

        gui.selector = tool_div.getElementsByClassName('cpu_tool-editor-select')[0];
        gui.new_buffer = tool_div.getElementsByClassName('cpu_tool-new-buffer')[0];
        gui.buffer_name = tool_div.getElementsByClassName('cpu_tool-buffer-name')[0];
        gui.read_only = tool_div.getElementsByClassName('cpu_tool-read-only')[0];
        gui.assemble_button = tool_div.getElementsByClassName('cpu_tool-assemble-button')[0];
        gui.font_larger = tool_div.getElementsByClassName('cpu_tool-font-larger')[0];
        gui.font_smaller = tool_div.getElementsByClassName('cpu_tool-font-smaller')[0];
        gui.settings_icon = tool_div.getElementsByClassName('cpu_tool-settings-icon')[0];
        gui.key_map = tool_div.getElementsByClassName('cpu_tool-key-map')[0];

        // adjust initial width so that only left pane and divider are visible
        gui.left.style.width = (100.0*(gui.left.offsetWidth + gui.right.offsetWidth)/gui.left.parentElement.offsetWidth) + "%";

        // settings pane
        gui.settings_icon.addEventListener('click', function () {
            let style = gui.settings_pane.style;
            style.display = (style.display == '' || style.display == 'none') ? 'block': 'none';
        });

        // key bindings
        gui.key_map.addEventListener('change', function () {
            let key_map = gui.key_map.value;
            // change keyMap for all existing editors
            for (let editor of gui.editor_list) {
                editor.CodeMirror.setOption('keyMap', key_map);
            }
        });

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
                gui.left.style.width = Math.max(0,100*(gui.left.offsetWidth + dx)/gui.left.parentElement.offsetWidth) + "%";
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

            // support loading contents from url
            let url = undefined;
            if (contents.startsWith('url:')) {
                url = contents.substr(4);
                contents = '';
            }

            let options = {
                lineNumbers: true,
                mode: cpu_tool.isa_info[gui.ISA].cm_mode,
                value: contents || '',
                keyMap: gui.key_map.value || 'default'
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

            // now start load of URL if there was one.
            // only works if we're loaded via a server to handle the XMLHttpRequest
            if (url) {
                try {
                    let xhr = new XMLHttpRequest();
                    xhr.open('GET', url, true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState == 4) {
			    if (xhr.status == 200)
				cm.doc.setValue(xhr.responseText);
			    else
				cm.doc.setValue(`Cannot read url:${url}.`);
			}
		    };
		    xhr.send();
		} catch(e) {
		    cm.doc.setValue(`Cannot read url:${url}.`);
		}
	    }
	}

	// change font size in buffers
	function buffer_font_size(which) {
	    let larger = {'50%': '100%', '100%': '125%', '125%': '150%', '150%': '200%', '200%': '200%' };
	    let smaller = {'50%': '50%', '100%': '50%', '125%': '100%', '150%': '125%', '200%': '150%' };

	    for (let editor of gui.editor_list) {
		let current_size = editor.style.fontSize || '100%';
		editor.style.fontSize = (which == 'larger') ? larger[current_size] : smaller[current_size];
		editor.CodeMirror.refresh();
	    }
	}
	gui.font_larger.addEventListener('click',function () { buffer_font_size('larger'); });
	gui.font_smaller.addEventListener('click',function () { buffer_font_size('smaller'); });

	// select a buffer to view
	gui.select_buffer = function (name) {
	    let selection;

	    // choose which instance to show
	    for (let editor of gui.editor_list) {
		if (editor.id == name) {
		    // selected
		    editor.style.display = 'block';
		    gui.read_only.style.display = editor.CodeMirror.options.readOnly ? 'block' : 'none';
		    gui.buffer_name.value = name;
		    editor.CodeMirror.focus();
		    selection = editor;
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

	    return selection;
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

	gui.error_div = tool_div.getElementsByClassName('cpu_tool-error-div')[0];
	gui.error_header = tool_div.getElementsByClassName('cpu_tool-error-header')[0];
	gui.error_list = tool_div.getElementsByClassName('cpu_tool-error-list')[0];

	// toggle error list display
	gui.error_header.addEventListener('click', function () {
	    let caret = gui.error_header.getElementsByTagName('i')[0];
	    let list_style = gui.error_list.style;
	    if (list_style.display == 'block' || list_style.display == '') {
		list_style.display = 'none';
		caret.classList.remove('fa-caret-down');
		caret.classList.add('fa-caret-right');
	    } else {
		list_style.display = 'block';
		caret.classList.remove('fa-caret-right');
		caret.classList.add('fa-caret-down');
	    }
	});

	// highlight the error location for the user
	cpu_tool.show_error = function(start,end) {
	    let cm = gui.select_buffer(start[0]);
	    if (cm) {
		let doc = cm.CodeMirror.doc;
		doc.setSelection(CodeMirror.Pos(start[1] - 1 , start[2] - 1),
				 CodeMirror.Pos(end[1] - 1, end[2] - 1),
				 {scroll: true});
		console.log('selected',doc.getSelection());
	    }

	    return false;  // don't follow the link!
	}

	// set up clickable list of errors
	function handle_errors(errors) {
	    // header
	    gui.error_header.innerHTML = `<span style="cursor: pointer;"><i class="fa fa-caret-down"></i></span> ${errors.length} Error${errors.length > 1?'s':''}:`

	    // the list, one error per line
	    gui.error_list.innerHTML = '';
	    for (let error of errors) {
		let start = `['${error.start[0]}',${error.start[1]},${error.start[2]}]`;
		let end = `['${error.end[0]}',${error.end[1]},${error.end[2]}]`;
		gui.error_list.innerHTML += `[<a href="#" onclick="return cpu_tool.show_error(${start},${end});">${error.start[0]}:${error.start[1]}</a>] ${error.message}<br>`;
	    }

	    // show error list
	    gui.error_div.style.display = 'block';
	}

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
		gui.left.style.width = '95%';
		handle_errors(result.errors);
	    } else {
	    }
	}

	gui.assemble_button.addEventListener('click',gui.assemble)

	//////////////////////////////////////////////////
	// initialize state: process configuration info
	//////////////////////////////////////////////////

	if (for_edx) {
	    // edx state supplies configuration
	    window.alert('edx integration not yet complete.')
        } else if (gui.configuration.buffers) {
	    // set up buffers from configuration info
	    for (let buffer of gui.configuration.buffers) {
		new_editor_pane(buffer['name'], buffer['contents'], buffer['readonly']);
	    }
	} else {
	    // default configuration
	    new_editor_pane('Untitled');
	}

	// select first buffer to edit initially
	gui.select_buffer(gui.editor_list[0].id);
    }

    return cpu_tool;
})({});

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    // config comes from contents of div.cpu_tool
    for (let tool_div of document.getElementsByClassName('cpu_tool')) {
	cpu_tool.setup(tool_div, false);
    }

    // config comes from edx state
    for (let tool_div of document.getElementsByClassName('edx_cpu_tool')) {
	cpu_toolsetup(tool_div, true);
    }
});
