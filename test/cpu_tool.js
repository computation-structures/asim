var cpu_tool = (function (cpu_tool) {
    const version = '0.1';

    cpu_tool.setup = function () {
	for (let tool of document.getElementsByClassName('cpu_tool')) {
	    // save any configuration info
	    tool.configuration = tool.innerHTML.replace('<!--[CDATA[','').replace(']]-->','').trim()
	    console.log(`"${tool.configuration}"`);

	    // replace with new innards
	    tool.innerHTML = `
<div class="cpu_tool-wrapper">
  <div class="cpu_tool-header">
    <button class="btn btn-sm btn-light cpu_tool-display-select Editor">Editor</button>
    <button class="btn btn-sm btn-light cpu_tool-display-select Split">Split</button>
    <button class="btn btn-sm btn-light cpu_tool-display-select Simulator">Simulator</button>
    <div style="float: right; font-size: small;">cpu_tool ${version}</div>
  </div>
  <div class="cpu_tool-body">
    <div class="cpu_tool-body-left">
      Editor
    </div>
    <div class="cpu_tool-body-divider"></div>
    <div class="cpu_tool-body-right">
      Simulator
    </div>
  </div>
</div>
`;

	    // the three tool panes
	    const left = tool.getElementsByClassName('cpu_tool-body-left')[0];
	    const divider = tool.getElementsByClassName('cpu_tool-body-divider')[0];
	    const right = tool.getElementsByClassName('cpu_tool-body-right')[0];

	    // select which of the three panes is visible
	    function set_pane_visibility(which) {
		left.style.display = (which == 'Split' || which == 'Editor') ? 'flex' : 'none';
		divider.style.display = (which == 'Split') ? 'block' : 'none';
		right.style.display = (which == 'Split' || which == 'Simulator') ? 'flex' : 'none';

		for (let button of tool.getElementsByClassName('cpu_tool-display-select')) {
		    if (button.classList.contains(which)) button.classList.add('selected');
		    else button.classList.remove('selected');
		}

		// in split mode, we control the width of the left pane, so disable flex
		left.style.flex = (which == 'Split') ? 'none' : '1 1 auto';
	    }
	    set_pane_visibility('Editor');

	    // click handlers for display select buttons
	    for (let button of tool.getElementsByClassName('cpu_tool-display-select')) {
		button.addEventListener('click', function (e) {
		    e = e || window.event;
		    let button = e.target;
		    set_pane_visibility(button.textContent);
		});
	    }

	    // set up moveable split divider
	    divider.addEventListener('mousedown', function (e) {
		const left = divider.previousElementSibling;
		e = e || window.event;
		e.preventDefault();
		let oldx = e.clientX;   // remember starting X for the mouse
		
		// while dragging divider, disable mouse events on left and right panes
		left.style.userSelect = 'none';
		left.style.pointerEvents = 'none';
		right.style.userSelect = 'none';
		right.style.pointerEvents = 'none';

		// adjust size of editor pane when mouse moves
		function mousemove(e) {
		    e = e || window.event;
		    e.preventDefault();
		    let dx = e.clientX - oldx;
		    oldx = e.clientX;
		    left.style.width = (left.offsetWidth + dx) + "px";
		}
		document.addEventListener('mousemove', mousemove);

		// all done -- remove event listeners, re-enable mouse events
		function mouseup(e) {
		    document.removeEventListener('mouseup', mouseup);
		    document.removeEventListener('mousemove', mousemove);
		    left.style.removeProperty('user-select');
		    left.style.removeProperty('pointer-events');
		    right.style.removeProperty('user-select');
		    right.style.removeProperty('pointer-events');
		}
		document.addEventListener('mouseup', mouseup);
	    });
	}
    }

    function editor_pane () {
	var editor = CodeMirror.fromTextArea(document.getElementById("code"), {
	    lineNumbers: true,
	    mode: {name: "gas", architecture: "ARMv6"},
	});
    }

    return cpu_tool;
})({});

// set up one or more div.cpu_tool elements
window.addEventListener('load', function () {
    cpu_tool.setup();
});
