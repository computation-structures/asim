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
        <button class="assemble-btn btn btn-sm btn-primary">Assemble</button>
        <span style="margin-left: 1em;">Buffer:</span>
        <select class="cpu_tool-editor-select"></select>
        <button class="cpu_tool-new-buffer btn btn-tiny btn-primary">New buffer</button>
        <div class="cpu_tool-ISA">${tool.ISA}</div>
      </div>
      <textarea class="cpu_tool-buffer-name"></textarea>
      <!-- editor divs will be added here -->
    </div>
    <div class="cpu_tool-body-divider"></div>
    <div class="cpu_tool-body-right">
      Simulator
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

	// buffer selection events
	tool.editor_list = [];   // list of CodeMirror elements
	tool.selector.addEventListener('change', function () {
	    let name = tool.selector.value;
	    // choose which instance to show
	    for (let editor of tool.editor_list) {
		let selected = (editor.getAttribute('id') == name);
		editor.style.display = selected ? 'block' : 'none';
		if (selected) editor.CodeMirror.focus();
	    }
	    tool.buffer_name.innerHTML = name;
	});

	// new buffer button
	tool.new_buffer.addEventListener('click', function () {
	    new_editor_pane(tool, 'Untitled', '');
	});

	function rename_buffer() {
	    let old_name = tool.selector.value;
	    let new_name = tool.buffer_name.value;

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
		}
	    }
	}

	// rename buffer
	tool.buffer_name.addEventListener('change', rename_buffer);
	tool.buffer_name.addEventListener('input', function (e) {
	    e = e || window.event;
	    if (e.inputType == 'insertLineBreak') {
		e.target.value = e.target.value.replace('\n','');
		rename_buffer();
		return false;
	    }
	    return true;
	});


	// set up buffers from configuration info
	for (let buffer of tool.configuration['buffers']) {
	    new_editor_pane(tool, buffer['name'], buffer['contents']);
	}
    }

    function new_editor_pane(tool, name, contents) {
	tool.selector.innerHTML += `<option value="${name}" selected>${name}</option>`;

	// hide existing editor panes
	for (let editor of tool.editor_list) {
	    editor.style.display = 'none';
	}

	// make a new editor pane
	let cm = CodeMirror(function(cm) {
	    tool.left.appendChild(cm);
	    cm.setAttribute('id',name);
	    tool.editor_list.push(cm);
	    tool.buffer_name.innerHTML = name;
	}, {
	    lineNumbers: true,
	    mode: {name: "gas", architecture: tool.ISA},
	});
	cm.doc.setValue(contents);
	cm.focus();
    }

    return cpu_tool;
})({});

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    for (let tool of document.getElementsByClassName('cpu_tool')) {
	cpu_tool.setup(tool);
    }
});
