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

var cpu_tool = (function (cpu_tool) {
    const version = '0.1';

    cpu_tool.setup = function (tool_div) {
	let tool = {};
	tool_div.cpu_tool = tool;

	// save any configuration info
	tool.configuration = tool_div.innerHTML.replace('<!--[CDATA[','').replace(']]-->','').trim()
        try {
	    tool.configuration = JSON.parse(tool.configuration);
	    //console.log(JSON.stringify(tool.configuration));
	    tool.ISA = tool.configuration.ISA || 'ARMv6';
	}
	catch {
	    console.log('Error parsing configuration info as JSON');
	}


	// replace with new innards
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
        <div class="cpu_tool-ISA">${tool.ISA}</div>
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
    <div style="float:right;">cpu_tool ${version} &copy; 2022 Chris Terman</div>
  </div>
</div>
`;

	// various internal elements
	tool.left = tool_div.getElementsByClassName('cpu_tool-body-left')[0];
	tool.divider = tool_div.getElementsByClassName('cpu_tool-body-divider')[0];
	tool.right = tool_div.getElementsByClassName('cpu_tool-body-right')[0];
	tool.selector = tool_div.getElementsByClassName('cpu_tool-editor-select')[0];
	tool.new_buffer = tool_div.getElementsByClassName('cpu_tool-new-buffer')[0];
	tool.buffer_name = tool_div.getElementsByClassName('cpu_tool-buffer-name')[0];
	tool.read_only = tool_div.getElementsByClassName('cpu_tool-read-only')[0];
	tool.assemble_button = tool_div.getElementsByClassName('cpu_tool-assemble-button')[0];
	tool.font_larger = tool_div.getElementsByClassName('cpu_tool-font-larger')[0];
	tool.font_smaller = tool_div.getElementsByClassName('cpu_tool-font-smaller')[0];

	// adjust initial width so that only left pane and divider are visible
	tool.left.style.width = (tool.left.offsetWidth + tool.right.offsetWidth) + "px";

	// set up moveable split divider
	tool.divider.addEventListener('mousedown', function (e) {
	    e = e || window.event;
	    e.preventDefault();
	    let oldx = e.clientX;   // remember starting X for the mouse
	    
	    // while dragging divider, disable mouse events on left and right panes
	    tool.left.style.userSelect = 'none';
	    tool.left.style.pointerEvents = 'none';
	    tool.right.style.userSelect = 'none';
	    tool.right.style.pointerEvents = 'none';

	    // adjust size of editor pane when mouse moves
	    function mousemove(e) {
		e = e || window.event;
		e.preventDefault();
		let dx = e.clientX - oldx;
		oldx = e.clientX;
		dx = Math.min(dx, tool.right.offsetWidth);
		tool.left.style.width = Math.max(0,tool.left.offsetWidth + dx) + "px";
	    }
	    document.addEventListener('mousemove', mousemove);

	    // all done -- remove event listeners, re-enable mouse events
	    function mouseup(e) {
		document.removeEventListener('mouseup', mouseup);
		document.removeEventListener('mousemove', mousemove);
		tool.left.style.removeProperty('user-select');
		tool.left.style.removeProperty('pointer-events');
		tool.right.style.removeProperty('user-select');
		tool.right.style.removeProperty('pointer-events');
	    }
	    document.addEventListener('mouseup', mouseup);
	});

	// change font size in buffers
	function buffer_font_size(which) {
	    let larger = {'50%': '100%', '100%': '125%', '125%': '150%', '150%': '200%', '200%': '200%' };
	    let smaller = {'50%': '50%', '100%': '50%', '125%': '100%', '150%': '125%', '200%': '150%' };

	    for (let editor of tool.editor_list) {
		let current_size = editor.style.fontSize || '100%';
		editor.style.fontSize = (which == 'larger') ? larger[current_size] : smaller[current_size];
	    }
	}
	tool.font_larger.addEventListener('click',function () { buffer_font_size('larger'); });
	tool.font_smaller.addEventListener('click',function () { buffer_font_size('smaller'); });

	// select a buffer to view
	tool.select_buffer = function (name) {
	    // choose which instance to show
	    for (let editor of tool.editor_list) {
		if (editor.getAttribute('id') == name) {
		    // selected
		    editor.CodeMirror.focus();
		    editor.style.display = 'block';
		    tool.read_only.style.display = editor.CodeMirror.options.readOnly ? 'block' : 'none';
		    tool.buffer_name.value = name;
		} else {
		    // not selected
		    editor.style.display = 'none';
		}
	    }

	    // update selector
	    for (let option of tool.selector.getElementsByTagName('option')){
		if (option.getAttribute('value') == name) {
		    option.selected = true;
		    break;
		}
	    }
	}

	// buffer selection events
	tool.editor_list = [];   // list of CodeMirror elements
	tool.selector.addEventListener('change', function () {
	    tool.select_buffer(tool.selector.value);
	});

	// is buffer name already used?
	function buffer_name_in_use(name) {
	    for (let editor of tool.editor_list) {
		if (editor.getAttribute('id') == name)
		    return true;
	    }
	    return false;
	}

	// new buffer button
	tool.new_buffer.addEventListener('click', function () {
	    let index = 1;
	    let name;
	    while (true) {
		name = 'Untitled' + index;
		if (!buffer_name_in_use(name)) break;
		index += 1;
	    }
	    new_editor_pane(tool, name)
	    tool.select_buffer(name);
	});

	// rename buffer after checking that new name is okay
	function rename_buffer() {
	    let old_name = tool.selector.value;
	    let new_name = tool.buffer_name.value;

	    // is new name okay?
	    if (new_name == old_name) return;
	    if (new_name == '' || buffer_name_in_use(new_name)) {
		alert(new_name=='' ? 'Buffer name cannot be blank.' : 'Buffer name already in use.');
		tool.buffer_name.value = old_name;
		return;
	    }

	    // change id attribute for renamed buffer
	    for (let editor of tool.editor_list) {
		if (editor.getAttribute('id') == old_name) {
		    editor.setAttribute('id', new_name);
		    break;
		}
	    }

	    // change buffer selector
	    for (let option of tool.selector.getElementsByTagName('option')){
		if (option.getAttribute('value') == old_name) {
		    option.setAttribute('value', new_name);
		    option.innerHTML = new_name;
		    break;
		}
	    }
	}
	tool.buffer_name.addEventListener('change', rename_buffer);
	tool.buffer_name.addEventListener('keydown', function (e) {
	    e = e || window.event;
	    if ((e.keyCode ? e.keyCode : e.which) == 13) {
		rename_buffer();
		e.preventDefault();
		return false;
	    }
	});

	// set up buffers from configuration info
	if (tool.configuration.buffers) {
	    for (let buffer of tool.configuration.buffers) {
		new_editor_pane(tool, buffer['name'], buffer['contents'], buffer['readonly']);
	    }
	} else {
	    new_editor_pane(tool, 'Untitled');
	}
	tool.select_buffer(tool.editor_list[0].getAttribute('id'));
    }

    function new_editor_pane(tool, name, contents, readonly) {
	tool.selector.innerHTML += `<option value="${name}" selected>${name}</option>`;

	let options = {
	    lineNumbers: true,
	    mode: {name: "gas", architecture: tool.ISA},
	    value: contents || ''
	};
	if (readonly) options.readOnly = true

	// make a new editor pane
	let cm = CodeMirror(function(cm) {
	    tool.left.appendChild(cm);
	    cm.setAttribute('id',name);
	    if (readonly) cm.style.backgroundColor = '#ddd';
	    tool.editor_list.push(cm);
	    tool.buffer_name.innerHTML = name;
	}, options);
    }

    return cpu_tool;
})({});

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    for (let tool of document.getElementsByClassName('cpu_tool')) {
	cpu_tool.setup(tool);
    }
});
