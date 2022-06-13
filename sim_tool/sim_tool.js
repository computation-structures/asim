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

var CodeMirror;  // keep lint happy

// create cpu_tool object to hold all the methods...
//   cpu_tool.version: version string
//   cpu_tool.setup: create GUI inside of target div
// other .js files add other functionality (assembler, simulator)
var sim_tool = (function (cpu_tool, for_edx) {
    "use strict";

    let sim_tool = {};

    sim_tool.read_configuration = function (tool_div, for_edx) {
        // save any configuration info
        let configuration = tool_div.innerHTML.replace('<!--[CDATA[','').replace(']]-->','').trim();
        try {
            configuration = JSON.parse(configuration);
        }
        catch {
            window.alert('Error parsing configuration info as JSON');
        }
        return configuration;
    };

    // Create GUI inside of target div (and add attribute that points to methods/state).
    // Adds CodeMirror instance for each buffer name/contents in configuration JSON
    // useful methods/state:
    //  .configuration: results of parsing JSON inside of target div
    //  .left: div for left (assembler) pane
    //  .right: div for right (simulator) pane
    //  .editor_list: CodeMirror DOM element for each editor
    //     .editor_list[n].CodeMirror = CodeMirror instance for nth editor
    //     .editor_list[n].id = name of buffer being edited
    sim_tool.setup = function (tool_div, version, cm_mode) {
        let gui = {};    // holds useful methods/state for this instance
        tool_div.sim_tool = gui;   // be able to find state from DOM element

        //////////////////////////////////////////////////
        // DOM for GUI
        //////////////////////////////////////////////////

        // set up DOM for GUI, replaces configuration info (which we've saved)
        tool_div.classList.add('sim_tool');
        tool_div.innerHTML = `
  <div class="sim_tool-body">
    <div class="sim_tool-body-left">
      <div class="sim_tool-body-left-header">
        <div class="sim_tool-action-buttons"></div>
        File:
        <select class="sim_tool-editor-select"></select>
        <div class="sim_tool-control sim_tool-new-buffer">
           <i class="fa-solid fa-file-circle-plus"></i>
           <div class="sim_tool-tip">New file</div>
        </div>
        <div class="sim_tool-control sim_tool-upload-buffer">
           <i class="fa-solid fa-file-arrow-up"></i>
           <div class="sim_tool-tip">Load file</div>
        </div>
        <div class="sim_tool-choose-file"></div>
        <a class="sim_tool-download-buffer" download="buffer_name" href="#">
          <div class="sim_tool-control">
             <i class="fa-solid fa-file-arrow-down"></i>
             <div class="sim_tool-tip">Download file</div>
           </div>
        </a>
        <div class="sim_tool-header-info"></div>
        <div class="sim_tool-key-map-indicator" key-map="emacs">
          <span>EMACS</span>
          <div class="sim_tool-key-map-list">
            <div class="sim_tool-key-map-choice" choice="default">DEFAULT</div>
            <div class="sim_tool-key-map-choice" choice="emacs">EMACS</div>
            <div class="sim_tool-key-map-choice" choice="sublime"">SUBLIME</div>
            <div class="sim_tool-key-map-choice" choice="vim"">VIM</div>
          </div>
        </div>
        <div class="sim_tool-font-button sim_tool-font-smaller">A</div>
        <div class="sim_tool-font-button sim_tool-font-larger">A</div>
      </div>
      <div class="sim_tool-error-div">
        <div class="sim_tool-error-header"></div>
        <div class="sim_tool-error-list"></div>
      </div>
      <div class="sim_tool-buffer-name-wrapper">
        <div class="sim_tool-read-only"><i class="fa fa-lock"></i></div>
        <textarea class="sim_tool-buffer-name" spellcheck="false"></textarea>
      </div>
      <!-- editor divs will be added here -->
    </div>
    <div class="sim_tool-body-divider"></div>
    <div class="sim_tool-body-right">
    </div>
  </div>
  <div class="sim_tool-notice">
    <div style="float:right;">
      <a style="margin-right:0.5em;" href="mailto:simulation_tools@computationstructures.org?subject=Bug report for sim_tool.${version}">send bug report<a>
      ${version}
    </div>
  </div>
`;
        // various internal elements.  Most don't need to be saved explicitly in
        // tool state, but it makes for easier debugging.
        gui.left = tool_div.getElementsByClassName('sim_tool-body-left')[0];
        gui.sim_tool_action_buttons = tool_div.getElementsByClassName('sim_tool-action-buttons')[0];
        gui.sim_tool_header_info = tool_div.getElementsByClassName('sim_tool-header-info')[0];
        gui.error_div = tool_div.getElementsByClassName('sim_tool-error-div')[0];
        gui.error_header = tool_div.getElementsByClassName('sim_tool-error-header')[0];
        gui.error_list = tool_div.getElementsByClassName('sim_tool-error-list')[0];
        gui.divider = tool_div.getElementsByClassName('sim_tool-body-divider')[0];
        gui.right = tool_div.getElementsByClassName('sim_tool-body-right')[0];

        gui.selector = tool_div.getElementsByClassName('sim_tool-editor-select')[0];
        gui.new_buffer = tool_div.getElementsByClassName('sim_tool-new-buffer')[0];
        gui.upload_buffer = tool_div.getElementsByClassName('sim_tool-upload-buffer')[0];
        gui.choose_file = tool_div.getElementsByClassName('sim_tool-choose-file')[0];
        gui.download_buffer = tool_div.getElementsByClassName('sim_tool-download-buffer')[0];
        gui.buffer_name = tool_div.getElementsByClassName('sim_tool-buffer-name')[0];
        gui.read_only = tool_div.getElementsByClassName('sim_tool-read-only')[0];
        gui.font_larger = tool_div.getElementsByClassName('sim_tool-font-larger')[0];
        gui.font_smaller = tool_div.getElementsByClassName('sim_tool-font-smaller')[0];
        gui.key_map_indicator = tool_div.getElementsByClassName('sim_tool-key-map-indicator')[0];

        // adjust initial width so that only left pane and divider are visible
        gui.left_pane_only = function () {
            gui.left.style.width = (100.0*(gui.left.offsetWidth + gui.right.offsetWidth)/gui.left.parentElement.offsetWidth) + "%";
        };
        gui.left_pane_only();

        gui.add_action_button = function(label, callback, btn_classes) {
            if (btn_classes === undefined) btn_classes = ['btn-primary'];
            gui.sim_tool_action_buttons.innerHTML += `<button class="sim_tool-action-button btn btn-sm ${btn_classes.join(' ')}">${label}</button>`;
            let button = gui.sim_tool_action_buttons.lastChild;
            button.addEventListener('click', callback);
        };

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
            function mouseup() {
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
        gui.current_editor = undefined;

        // create a new CodeMirror instance, add it to left pane,
        // update selector to include new buffer name
        gui.new_editor_pane = function(name, contents, readonly) {
            name = unique_buffer_name(name);
            gui.selector.innerHTML += `<option value="${name}" selected>${name}</option>`;

            // support loading contents from url
            let url = undefined;
            if (contents && contents.startsWith('url:')) {
                url = contents.substr(4);
                contents = '';
            }

            let options = {
                lineNumbers: true,
                mode: cm_mode,
                value: contents || '',
                keyMap: gui.key_map_indicator.getAttribute('key-map') || 'default'
            };
            if (readonly) options.readOnly = true;

            // make a new editor pane
            let cm = CodeMirror(function(cm) {
                gui.left.appendChild(cm);
                cm.id = name;
                if (readonly) cm.style.backgroundColor = '#ddd';
                gui.editor_list.push(cm);
                gui.buffer_name.innerHTML = name;
            }, options);
            gui.current_editor = cm;

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
                            cm.refresh();
                        }
                    };
                    xhr.send();
                } catch(e) {
                    cm.doc.setValue(`Cannot read url:${url}.`);
                }
            }

            return cm;
        };

        // change font size in buffers
        function buffer_font_size(which) {
            for (let editor of gui.editor_list) {
                let font_size = getComputedStyle(editor).fontSize;
                let fsize = parseFloat(font_size.replace('px',''));
                fsize *= (which == 'larger') ? 1.1 : 1/1.1;
                editor.style.fontSize = fsize + 'px';
                editor.CodeMirror.refresh();
            }
        }
        gui.font_larger.addEventListener('click',function () { buffer_font_size('larger'); });
        gui.font_smaller.addEventListener('click',function () { buffer_font_size('smaller'); });

        function select_key_map(choice) {
            gui.key_map_indicator.setAttribute('key-map', choice);
            gui.key_map_indicator.getElementsByTagName('span')[0].innerHTML = choice.toUpperCase();
            // change keyMap for all existing editors
            for (let editor of gui.editor_list) {
                editor.CodeMirror.setOption('keyMap', choice);
            }
        }
        for (let choice of tool_div.getElementsByClassName('sim_tool-key-map-choice')) {
            choice.addEventListener('click', function (e) {
                select_key_map(e.target.getAttribute('choice'));
            });
        }

        // select a buffer to view
        gui.select_buffer = function (name) {
            // choose which instance to show
            for (let editor of gui.editor_list) {
                if (editor.id == name) {
                    // selected
                    editor.style.display = 'block';
                    gui.read_only.style.display = editor.CodeMirror.options.readOnly ? 'block' : 'none';
                    gui.buffer_name.value = name;
                    editor.CodeMirror.refresh();
                    editor.CodeMirror.focus();
                    gui.current_editor = editor;
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

            return gui.current_editor;
        };

        // buffer selection events
        gui.selector.addEventListener('change', function () {
            gui.select_buffer(gui.selector.value);
        });

        // is buffer name already used?
        function buffer_name_in_use(name) {
            for (let editor of gui.editor_list) {
                if (editor.id == name)
                    return true;
            }
            return false;
        }

        // create a unique buffer name given a starting point
        function unique_buffer_name(bname) {
            // create a unique buffer name
            let fname = bname, i = 0;
            while (buffer_name_in_use(fname)) {
                i += 1;
                fname = `${bname} (${i})`;
            }
            return fname;
        }

        // new buffer button
        gui.new_buffer.addEventListener('click', function () {
            let name = unique_buffer_name('Untitled');
            gui.new_editor_pane(name);
            gui.select_buffer(name);
        });

        // upload buffer button
        gui.upload_buffer.addEventListener('click', function () {
            let div = gui.choose_file;
            if (div.innerHTML != '') {
                div.innerHTML = '';
            } else {
                div.innerHTML = '<input type="file"/>';
                div.getElementsByTagName('input')[0].addEventListener('change',upload_buffer);
            }
        });

        function upload_buffer(e) {
            let file = e.target.files[0];
            if (!file) return;

            // create and fill the buffer
            let fname = unique_buffer_name(file.name);
            let reader = new FileReader();
            reader.onload = function(e) {
                let cm = gui.new_editor_pane(fname);
                gui.select_buffer(fname);
                cm.doc.setValue(e.target.result);
            };
            reader.readAsText(file);

           gui.choose_file.innerHTML = '';
        }

        // download buffer button
        gui.download_buffer.addEventListener('click', function () {
            let bname = gui.buffer_name.value;
            let contents = gui.current_editor.CodeMirror.doc.getValue();

            // fill in attributes of <a> and let it do the work
            this.setAttribute('download',bname);
            this.setAttribute('href','data:text/plain;base64,' + btoa(contents));
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
            return undefined;
        });

        // highlight the error location for the user
        function show_error(start,end) {
            let cm = gui.select_buffer(start[0]);
            if (cm) {
                let doc = cm.CodeMirror.doc;
                doc.setSelection(CodeMirror.Pos(start[1] - 1 , start[2] - 1),
                                 CodeMirror.Pos(end[1] - 1, end[2] - 1),
                                 {scroll: true});
            }

            return false;  // don't follow the link!
        };

        // set up clickable list of errors
        gui.handle_errors = function(errors) {
            // header
            gui.error_header.innerHTML = `${errors.length} Error${errors.length > 1?'s':''}:`;

            // the list, one error per line
            gui.error_list.innerHTML = '';
            for (let error of errors) {
                gui.error_list.innerHTML += `[<a href="#" class="sim_tool-show-error" estart="${error.start[0]},${error.start[1]},${error.start[2]}" eend="${error.end[0]},${error.end[1]},${error.end[2]}">${error.start[0]}:${error.start[1]}</a>] ${error.message}<br/>`;
            }

            for (let a of document.getElementsByClassName('sim_tool-show-error')) {
                a.addEventListener('click', function (e) {
                    let start = e.target.getAttribute('estart').split(',');
                    start[1] = parseInt(start[1]); start[2] = parseInt(start[2]);
                    let end = e.target.getAttribute('eend').split(',');
                    end[1] = parseInt(end[1]); end[2] = parseInt(end[2]);
                    show_error(start,end);
                    e.preventDefault();
                    return false;
                });
            }

            // show error list
            gui.error_div.style.display = 'block';
        };

        // pass gui stuff back to specific tool
        return gui;
    };

    sim_tool.hexify = function(v,ndigits) {
        if (ndigits === undefined) ndigits = 8;
        return v.toString(16).padStart(ndigits, '0');
    };

    //////////////////////////////////////////////////
    // initialize state: process configuration info
    //////////////////////////////////////////////////

    sim_tool.process_configuration = function(gui, for_edx) {
        if (for_edx) {
            // edx state supplies configuration
            window.alert('edx integration not yet complete.');
        } else if (gui.configuration.buffers) {
            // set up buffers from configuration info
            for (let buffer of gui.configuration.buffers) {
                gui.new_editor_pane(buffer['name'], buffer['contents'], buffer['readonly']);
            }
        } else {
            // default configuration
            gui.new_editor_pane('Untitled');
        }

        // select first buffer to edit
        gui.select_buffer(gui.editor_list[0].id);
    };

    return sim_tool;
})();
