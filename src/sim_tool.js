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

var CodeMirror;  // keep lint happy

var getstate, setstate, gradefn;   // routines call by edx

//////////////////////////////////////////////////
//////////////////////////////////////////////////
//
//  SimTool
//
//////////////////////////////////////////////////
//////////////////////////////////////////////////

// create basic user interface: left pane, moveable divider, right pane
// left pane: selectable CodeMirror editors
// right pane: contents determined by subclass
class SimTool {

    constructor(tool_div, version, cm_mode, github_url) {
        tool_div.sim_tool = this;  // so we can find this instance for debugging

        this.tool_div = tool_div;  // DOM element to populate with GUI
        this.version = version || 'sim_tool.1';    // version string user sees
        this.cm_mode = cm_mode;    // CodeMirror mode for editor panes
        this.github_url = github_url;

        // first read-in any configuration info provided in body of tool_div
        this.configuration = {};
        try {
            let body = this.tool_div.innerHTML.trim();
            body = body.replace('<!--[CDATA[','').replace(']]-->','').trim();
            this.configuration = JSON.parse(body || '{}');
        }
        catch {
            window.alert('Error parsing configuration info as JSON');
        }

        // editor panes
        this.editor_list = [];   // list of CodeMirror elements
        this.current_editor = undefined;

        // add/configure GUI elements
        this.setup_gui();          // fill tool_div with GUI elements
        this.left_pane_only();     // initially show only left (editors) pane

        // create editors for buffers listed in configuration
        this.process_configuration();
    }

    // set up editors for any buffers listed in JSON configuration string
    process_configuration() {
        if ((typeof this.configuration) !== 'object') {
            window.alert('Unexpected configuration info');
            this.configuration = {};
        }

        if (this.configuration.buffers) {
            // set up buffers from configuration info
            for (let buffer of this.configuration.buffers) {
                this.new_editor_pane(buffer);
            }
        } else {
            // default configuration
            this.new_editor_pane({name: 'Untitled'});
        }

        // select first buffer to edit
        this.select_buffer(this.editor_list[0].id);
    }

    // convert Number or BigInt to hex string of specified length
    hexify(v,ndigits) {
        if (ndigits === undefined) ndigits = 8;

        if (v === undefined) return '-'.padStart(ndigits,'-');

        let vstring;
        if (typeof v === 'bigint')
            vstring = BigInt.asUintN(ndigits * 4, v).toString(16);
        else
            vstring = (v>>>0).toString(16);          // >>> converts value to unsigned int

        return vstring.padStart(ndigits, '0');
    }

    //////////////////////////////////////////////////
    // GUI
    //////////////////////////////////////////////////

    setup_gui() {
        // set up DOM for GUI, replaces configuration info (which we've saved)
        this.tool_div.classList.add('sim_tool');
        this.tool_div.innerHTML = `
<div class="sim_tool-body">
  <!-- left pane: controls, error listing, editors -->
  <div id="body-left" class="sim_tool-body-left">
    <div class="sim_tool-body-left-header">
      <div id="action-buttons" class="sim_tool-action-buttons"></div>
      File:
      <select id="editor-select" class="sim_tool-editor-select"></select>
      <div id="read-only" class="sim_tool-read-only">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
        </svg>
        <div class="sim_tool-tip">File is read-only</div>
      </div>
      <div id="rename-buffer" class="sim_tool-control sim_tool-rename-buffer">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" transform="translate(0 4)" fill="currentColor" viewBox="0 0 16 16">
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"></path>
          <path transform="scale(0.5 0.5) translate(8 10)" d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"></path>
        </svg>
        <div class="sim_tool-tip">Rename file</div>
      </div>
      <div id="new-buffer" class="sim_tool-control sim_tool-new-buffer">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" transform="translate(0 4)" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 6.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V11a.5.5 0 0 1-1 0V9.5H6a.5.5 0 0 1 0-1h1.5V7a.5.5 0 0 1 .5-.5z"/>
          <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z"/>
         </svg>
        <div class="sim_tool-tip">New file</div>
      </div>
      <div id="upload-buffer" class="sim_tool-control sim_tool-upload-buffer">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" transform="translate(0 4)" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8.5 11.5a.5.5 0 0 1-1 0V7.707L6.354 8.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8.5 7.707V11.5z"/>
          <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
        </svg>
        <div class="sim_tool-tip">Load file</div>
      </div>
      <div id="choose-file" class="sim_tool-choose-file"></div>
      <a id="download-buffer" class="sim_tool-download-buffer" download="buffer_name" href="#">
        <div class="sim_tool-control">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" transform="translate(0 4)" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8.5 6.5a.5.5 0 0 0-1 0v3.793L6.354 9.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L8.5 10.293V6.5z"/>
            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
          </svg>
          <div class="sim_tool-tip">Download file</div>
        </div>
      </a>
      <div class="sim_tool-font-buttons">
        <div id="font-smaller" class="sim_tool-font-button sim_tool-font-smaller">A</div>
        <div id="font-larger" class="sim_tool-font-button sim_tool-font-larger">A</div>
      </div>
      <div id="key-map-indicator" class="sim_tool-key-map-indicator" key-map="default">
        <span>DEFAULT</span>
        <div class="sim_tool-key-map-list">
          <div class="sim_tool-key-map-choice" choice="default">DEFAULT</div>
          <div class="sim_tool-key-map-choice" choice="emacs">EMACS</div>
          <div class="sim_tool-key-map-choice" choice="sublime"">SUBLIME</div>
          <div class="sim_tool-key-map-choice" choice="vim"">VIM</div>
        </div>
      </div>
    </div>
    <div id="error-div" class="sim_tool-error-div">
      <div id="error-list" class="sim_tool-error-list"></div>
    </div>
    <!-- editor divs will be added here -->
  </div>

  <!-- moveable divider -->
  <div id="body-divider" class="sim_tool-body-divider"></div>

  <!-- right pane: simulation results -->
  <div id="body-right" class="sim_tool-body-right"> </div>
</div>

<!-- bug-report link, version -->
<div class="sim_tool-notice">
  <div id="message" class="sim_tool-message"></div>
  <div style="float:right;">
    <a style="margin-right:0.5em;" href="${this.github_url}/issues/new?labels=bug&title=Bug+report+for+${this.version}" target="_blank">send bug report</a>
    <a style="margin-right:0.5em;" href="${this.github_url}" target="_blank">github</a>
    ${this.version}
  </div>
</div>
`;

        // old bug-report link
        //<a style="margin-right:0.5em;" href="mailto:simulation_tools@computationstructures.org?subject=Bug report for ${this.version}">send bug report</a>

        
        // various internal elements.  Most don't need to be saved explicitly in
        // tool state, but it makes for easier debugging.
        this.left = this.tool_div.querySelector('#body-left');
        this.action_buttons = this.tool_div.querySelector('#action-buttons');
        this.error_div = this.tool_div.querySelector('#error-div');
        this.error_list = this.tool_div.querySelector('#error-list');
        this.divider = this.tool_div.querySelector('#body-divider');
        this.right = this.tool_div.querySelector('#body-right');
        this.message = this.tool_div.querySelector('#message');

        this.selector = this.tool_div.querySelector('#editor-select');
        this.rename_buffer = this.tool_div.querySelector('#rename-buffer');
        this.new_buffer = this.tool_div.querySelector('#new-buffer');
        this.upload_buffer = this.tool_div.querySelector('#upload-buffer');
        this.choose_file = this.tool_div.querySelector('#choose-file');
        this.download_buffer = this.tool_div.querySelector('#download-buffer');
        //this.buffer_name = this.tool_div.querySelector('#buffer-name');
        this.read_only = this.tool_div.querySelector('#read-only');
        this.font_larger = this.tool_div.querySelector('#font-larger');
        this.font_smaller = this.tool_div.querySelector('#font-smaller');
        this.key_map_indicator = this.tool_div.querySelector('#key-map-indicator');

        const gui = this;    // so we can reference inside of event handlers

        // make divider moveable
        this.setup_divider();

        // handle requests to change font size
        this.font_larger.addEventListener('click',function () { gui.buffer_font_size('larger'); });
        this.font_smaller.addEventListener('click',function () { gui.buffer_font_size('smaller'); });

        // allow user to select which key map to use
        for (let choice of this.tool_div.getElementsByClassName('sim_tool-key-map-choice')) {
            choice.addEventListener('click', function (e) {
                gui.select_key_map(e.target.getAttribute('choice'));
            });
        }

        // allow user to select which buffer to edit
        this.selector.addEventListener('change', function () {
            gui.select_buffer(gui.selector.value);
        });

        // rename buffer button
        this.rename_buffer.addEventListener('click', function () {
            const old_name = gui.selector.value;
            const new_name = window.prompt("Enter new file name",old_name);
            if (new_name === null) return;  // user canceled rename

            // is new name okay?
            if (new_name === old_name) return;
            if (new_name === '' || gui.buffer_name_in_use(new_name)) {
                alert(new_name=='' ? 'Buffer name cannot be blank.' : 'Buffer name already in use.');
                return;
            }

            // change id attribute for renamed buffer
            for (let editor of gui.editor_list) {
                if (editor.id === old_name) {
                    editor.id = new_name;
                    break;
                }
            }

            // change buffer selector
            for (let option of gui.selector.getElementsByTagName('option')){
                if (option.getAttribute('value') === old_name) {
                    option.setAttribute('value', new_name);
                    option.innerHTML = new_name;
                    break;
                }
            }
        });

        // new buffer button
        this.new_buffer.addEventListener('click', function () {
            const name = gui.unique_buffer_name('Untitled');
            gui.new_editor_pane({name: name});
            gui.select_buffer(name);
        });

        // upload buffer button
        this.upload_buffer.addEventListener('click', function () {
            const div = gui.choose_file;
            if (div.innerHTML != '') {
                div.innerHTML = '';
            } else {
                div.innerHTML = '<input type="file"/>';
                // if user chooses a file, read its contents into a new buffer
                div.getElementsByTagName('input')[0].addEventListener('change',function () {
                    const file = this.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function (e) {
                            const bname = gui.unique_buffer_name(file.name);
                            gui.new_editor_pane({name: bname, contents: e.target.result});
                            gui.select_buffer(bname);
                            div.innerHTML = '';
                        };
                        reader.readAsText(file);
                    } else div.innerHTML = '';
                });
            }
        });

        // download buffer button
        this.download_buffer.addEventListener('click', function () {
            const bname = gui.selector.value;
            const contents = gui.current_editor.CodeMirror.doc.getValue();

            // fill in attributes of <a> and let it do the work
            this.setAttribute('download',bname);
            this.setAttribute('href','data:text/plain;base64,' + btoa(contents));
        });

        // edx support: if we're a subwindow (eg, inside an iframe)
        //  * allow the iframe to be resized
        //  * set up getstate, setstate, gradefn so edX can contact us!
        if (window.parent !== window) {
            // find our iframe
            for (let iframe of window.parent.document.getElementsByTagName('iframe')) {
                if (iframe.contentWindow === window) {
                    iframe.style.resize = 'both';
                    iframe.setAttribute('sandbox',iframe.getAttribute('sandbox') + ' allow-modals');
                    break;
                }
            }
        }

        // set up functions to handle communication with edx
        let tool = this;

        // return updated configuration
        getstate = function (arg) {
            let config = { ...tool.configuration };   // copy configuration
            config.buffers = [];   // will rebuild from editor list

            // save each existing buffer
            for (let e of tool.editor_list) {
                const buffer = { name: e.id };
                config.buffers.push(buffer);

                if (e.readonly) {
                    buffer.readonly = true;
                    // use original URL, if any, for read-only buffers
                    if (e.url) buffer.url = e.url;
                }
                // if not using URL, remember current buffer content
                if (buffer.url === undefined)
                    buffer.contents = e.CodeMirror.doc.getValue() || '';
            }

            return JSON.stringify(config);
        }

        // parse incoming state object
        setstate = function (arg) {
            try {
                tool.configuration = JSON.parse(arg || '{}');

                // no longer want any existing buffers
                for (let e of tool.editor_list) {
                    e.style.display = 'none';
                    e.remove();
                }
                tool.editor_list = [];
                tool.current_editor = undefined;
                tool.selector.innerHTML = '';

                // process new configuration
                tool.process_configuration();
            }
            catch {
                console.log('Error parsing configuration info as JSON',arg);
            }
        }

        // return verification checksum as a JSON string
        gradefn = function (arg) {
            // tool.configuration.checksum should be filled in by
            // the client subclass once the user has met the
            // verification criteria.  It will be matched to the
            // checksum provided in the edX problem specification
            // to determine if the problem was completed successfully.
            return tool.configuration.checksum || "";
        }
    }

    clear_message() {
        this.message.innerHTML = '';
    }

    // set up moveable split divider
    setup_divider() {
        const gui = this;   // for reference inside of handlers

        this.divider.addEventListener('mousedown', function (e) {
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
    }

    // make only the left (editors) pane visible
    left_pane_only() {
        // make left fill space allocated to both left and right panes
        this.left.style.width = (100.0*(this.left.offsetWidth + this.right.offsetWidth) /
                                 this.left.parentElement.offsetWidth) + "%";
    }

    // add an action button to the right pane header
    add_action_button(label, callback, btn_classes) {
        if (btn_classes === undefined) btn_classes = ['btn-primary'];
        this.action_buttons.innerHTML += `<button class="sim_tool-action-button btn btn-sm ${btn_classes.join(' ')}">${label}</button>`;
        const button = this.action_buttons.lastChild;
        button.addEventListener('click', callback);
    }

    //////////////////////////////////////////////////
    // Editor panes
    //////////////////////////////////////////////////

    // is buffer name already used?
    buffer_name_in_use(name) {
        for (let editor of this.editor_list) {
            if (editor.id === name)
                return true;
        }
        return false;
    }

    // create a unique buffer name given a starting point
    unique_buffer_name(bname) {
        // create a unique buffer name
        let fname = bname, i = 0;
        while (this.buffer_name_in_use(fname)) {
            i += 1;
            fname = `${bname} (${i})`;
        }
        return fname;
    }

    // override to change which gutters appear in the editor panes
    gutter_list() {
        // default: single gutter showing line numbers
        return [ {className: 'CodeMirror-linenumbers'} ];
    }

    // override to handle clicks in the editor gutters
    gutter_click(cm, line, gutter, event) {
    }
    
    // override to handle changes to editor buffer
    editor_before_change(cm, event) {
    }

    // return new CodeMirror instance
    new_editor_pane(options) {
        const gui = this;   // for reference inside of handlers

        let name = this.unique_buffer_name(options.name);
        this.selector.innerHTML += `<option value="${name}" selected>${name}</option>`;

        const cm_options = {
            lineNumbers: true,
            mode: this.cm_mode,
            value: options.contents || '',
            keyMap: this.key_map_indicator.getAttribute('key-map') || 'default',
            gutters: this.gutter_list(),
        };
        if (options.readonly) cm_options.readOnly = true;

        // make a new editor pane
        const cm = CodeMirror(function(cm) {
            gui.left.appendChild(cm);
            cm.id = name;
            if (options.url) cm.url = options.url;
            if (options.readonly) {
                cm.readonly = true;
                cm.style.backgroundColor = '#ccc';
            }
            gui.editor_list.push(cm);
            //gui.buffer_name.innerHTML = name;
        }, cm_options);
        this.current_editor = cm;

        // register a handler for clicks in the gutters
        cm.tool = gui;
        cm.buffer_name = name;
        cm.on('gutterClick',this.gutter_click);
        cm.on('beforeChange',this.editor_before_change);

        // now start load of URL if there was one.
        // only works if we're loaded via a server to handle the XMLHttpRequest
        if (options.url) {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', options.url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            cm.doc.setValue(xhr.responseText);
                        } else
                            cm.doc.setValue(`Cannot read url:${options.url}.`);
                        cm.refresh();
                    }
                };
                xhr.send();
            } catch(e) {
                cm.doc.setValue(`Cannot read url:${options.url}.`);
            }
        }

        return cm;
    }

    // select a buffer to view
    select_buffer(name) {
        // choose which instance to show
        for (let editor of this.editor_list) {
            if (editor.id === name) {
                // selected
                editor.style.display = 'block';
                this.read_only.style.display = editor.CodeMirror.options.readOnly ? 'inline-block' : 'none';
                // call refresh after change in visibility has taken effect
                setTimeout(function () {
                    editor.CodeMirror.refresh();
                    editor.CodeMirror.focus();
                }, 1);
                this.current_editor = editor;
            } else {
                // not selected
                editor.style.display = 'none';
            }
        }

        // update selector (not needed if buffer selection came from selector!)
        for (let option of this.selector.getElementsByTagName('option')){
            if (option.getAttribute('value') === name) {
                option.selected = true;
                break;
            }
        }

        return this.current_editor;
    }

    upload_buffer(e) {
        const file = e.target.files[0];
        if (!file) return;

        const gui = this;   // for reference inside of event handlers

        // create and fill the buffer
        const fname = this.unique_buffer_name(file.name);
        const reader = new FileReader();
        reader.onload = function(e) {
            const cm = gui.new_editor_pane(fname);
            gui.select_buffer(fname);
            cm.doc.setValue(e.target.result);
        };
        reader.readAsText(file);

        this.choose_file.innerHTML = '';
    }

    // change font size in buffers
    buffer_font_size(which) {
        for (let editor of this.editor_list) {
            const font_size = getComputedStyle(editor).fontSize;
            let fsize = parseFloat(font_size.replace('px',''));
            fsize *= (which === 'larger') ? 1.1 : 1/1.1;
            editor.style.fontSize = fsize + 'px';
            editor.CodeMirror.refresh();
        }
    }

    // change key map
    select_key_map(choice) {
        this.key_map_indicator.setAttribute('key-map', choice);
        this.key_map_indicator.getElementsByTagName('span')[0].innerHTML = choice.toUpperCase();
        // change keyMap for all existing editors
        for (let editor of this.editor_list) {
            editor.CodeMirror.setOption('keyMap', choice);
        }
    }

    // highlight the error location for the user
    show_error(start,end) {
        const cm = this.select_buffer(start[0]);
        if (cm) {
            const doc = cm.CodeMirror.doc;
            doc.setSelection(CodeMirror.Pos(start[1] - 1 , start[2] - 1),
                             CodeMirror.Pos(end[1] - 1, end[2] - 1),
                             {scroll: true});
        }

        return false;  // don't follow the link!
    }

    // set up clickable list of errors in error list div
    handle_errors(errors, warnings) {
        const gui = this;   // for reference inside of event handlers

        if (errors.length === 0 && warnings.length === 0) return;

        this.error_list.innerHTML = '';

        if (errors) {
            // error list, one error per line
            for (let error of errors) {
                this.error_list.innerHTML += `Error [<a href="#" class="sim_tool-show-error" estart="${error.start[0]},${error.start[1]},${error.start[2]}" eend="${error.end[0]},${error.end[1]},${error.end[2]}">${error.start[0]}:${error.start[1]}</a>] ${error.message}<br/>`;
            }
        }

        if (warnings) {
            // error list, one error per line
            for (let error of warnings) {
                this.error_list.innerHTML += `Warning [<a href="#" class="sim_tool-show-error" estart="${error.start[0]},${error.start[1]},${error.start[2]}" eend="${error.end[0]},${error.end[1]},${error.end[2]}">${error.start[0]}:${error.start[1]}</a>] ${error.message}<br/>`;
            }
        }

        for (let a of this.tool_div.getElementsByClassName('sim_tool-show-error')) {
            a.addEventListener('click', function (e) {
                const start = e.target.getAttribute('estart').split(',');
                start[1] = parseInt(start[1]); start[2] = parseInt(start[2]);
                const end = e.target.getAttribute('eend').split(',');
                end[1] = parseInt(end[1]); end[2] = parseInt(end[2]);
                gui.show_error(start,end);
                e.preventDefault();
                return false;
            });
        }

        // show error list
        gui.error_div.style.display = 'block';
    }
}

// set up GUI in any div.sim_tool
window.addEventListener('load', function () {
    for (let div of document.getElementsByClassName('sim_tool')) {
        new SimTool(div);
    }
});

//////////////////////////////////////////////////
//////////////////////////////////////////////////
//
//  Helper classes
//
//////////////////////////////////////////////////
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// Syntax Error
//////////////////////////////////////////////////

// record a syntax error, along with the current stream location
SimTool.SyntaxError = class {
    constructor(message, start, end) {
        this.start = start;
        this.end = end;
        this.message = message;
    }

    toString() {
        return `${JSON.stringify(this.start)}, ${JSON.stringify(this.end)}: ${this.message}`;
    }
}

// record a syntax warning, along with the current stream location
SimTool.SyntaxWarning = class {
    constructor(message, start, end) {
        this.start = start;
        this.end = end;
        this.message = message;
    }

    toString() {
        return `${JSON.stringify(this.start)}, ${JSON.stringify(this.end)}: ${this.message}`;
    }
}

//////////////////////////////////////////////////
// Token
//////////////////////////////////////////////////

SimTool.Token = class {
    constructor (type, token, start, end) {
        this.type = type;
        this.token = token;
        this.start = start;   // [buffer, line, offset]
        this.end = end;
    }

    asSyntaxError (msg) {
        return new SimTool.SyntaxError(msg || this.token, this.start, this.end);
    }

    locationString(locn) {
        if (locn === undefined) locn = this.start;
        return `${locn[0]}:locn[1]}:locn[2]}`;
    }

    lineString(locn) {
        if (locn === undefined) locn = this.start;
        return `${this.start[0]}:${this.start[1]}`;
    }

    url(msg) {
        const start = `${this.start[0]},${this.start[1]},${this.start[2]}`;
        const end = `${this.end[0]},${this.end[1]},${this.end[2]}`;
        return `<a href="#" class="sim_tool-show-error" estart="${start}" eend="${end}">${msg || this.lineString()}</a>`;
    }

    toJSON() {
        return `[${this.type} '${this.token.toString()}' ${this.start[0]}:${this.start[1]}:${this.start[2]} ${this.end[0]}:${this.end[1]}:${this.end[2]}]`;
    }
}

//////////////////////////////////////////////////
// BufferStream
//////////////////////////////////////////////////

// return characters from a stack of buffers.
// stack is used to support .include and macro expansion
// modified from an old version of CodeMirror's string stream
SimTool.BufferStream = class {
    constructor () {
        this.buffer_list = [];    // stack of pending buffers
        this.state = undefined;
    }

    // add a new buffer to the stack.  Subsequent characters come from the
    // new buffer until exhausted, then return to current buffer.
    push_buffer(bname, bcontents) {
        const lines = bcontents.split('\n');
        this.state = {         // newly initialized state
            pos: 0,
            string: lines[0],
            lines: lines,
            line_number: 0,    // NB: zero based!
            buffer_name: bname
        };
        this.buffer_list.push(this.state);
    }

    // back to start of buffer
    reset_state() {
        this.state.pos = 0;
        this.state.line_number = 0;
        this.state.string = this.state.lines[0];
    }

    get buffer_name() {
        if (this.state === undefined) return undefined;
        return this.state.buffer_name;
    }

    // return line_number (starts at 1)
    get line_number() {
        if (this.state === undefined) return undefined;
        return this.state.line_number + 1;
    }

    // return column (starts at 1)
    get column() {
        if (this.state === undefined) return undefined;
        return this.state.pos + 1;
    }

    set column(val) {
        if (this.state) this.state.pos = val - 1;
    }

    // [buffer, line, col]
    get location() {
        if (this.state === undefined) return undefined;
        return [this.state.buffer_name, this.state.line_number + 1, this.state.pos + 1];
    }

    // move to next line, changing buffers if necessary
    // return true if there is a next line
    next_line(same_buffer) {
        if (this.state === undefined) return false;
        this.state.line_number += 1;
        if (this.state.line_number < this.state.lines.length) {
            // still more lines in this buffer
            this.state.string = this.state.lines[this.state.line_number];
            this.state.pos = 0;
        } else if (same_buffer) {
            // came to the end of the buffer
            return false;
        } else {
            // all done with current buffer, switch to previous buffer
            this.buffer_list.pop();
            this.state = this.buffer_list[this.buffer_list.length - 1];
        }
        return true;
    }

    // at end of current line?
    eol() {
        if (this.state === undefined) return true;
        return this.state.pos >= this.state.string.length;
    }

    // at start of current line?
    sol() {
        if (this.state === undefined) return true;
        return this.state.pos === 0;
    }

    // peek at next character on current line
    peek() {
        if (this.state === undefined) return undefined;
        // if pos >= string.length, the following will return undefined
        return this.state.string.charAt(this.state.pos);
    }

    // return next character on current line
    next() {
        if (this.state === undefined || this.state.pos >= this.state.string.length)
            return undefined;
        return this.state.string.charAt(this.state.pos++);
    }

    // return next character on current line if it matches.
    // match can be a specific character, a regexp, or a function
    eat(match) {
        if (this.state === undefined) return undefined;
        const ch = this.state.string.charAt(this.state.pos);
        const ok = (typeof match === "string") ? (ch === match) :
            (ch && (match.test ? match.test(ch) : match(ch)));
        if (ok) { this.state.pos += 1; return ch; }
        else return undefined;
    }

    // consumer characters that match, return true if there were some
    eatWhile(match) {
        if (this.state === undefined) return undefined;
        const start = this.state.pos;
        while (this.eat(match)) { /* keep looping while we find matches */ }
        return this.state.pos > start;
    }

    // consume whitespace, return true if there were some
    eatSpace() {
        if (this.state === undefined) return undefined;
        const start = this.state.pos;
        // \u00a0 is a "no break space"
        while (/[\s\u00a0]/.test(this.state.string.charAt(this.state.pos))) {
            if (this.eol()) break;
            this.state.pos += 1;
        }
        return this.state.pos > start;
    }

    // move to end of current line
    skipToEnd() {
        if (this.state) {
            this.state.pos = this.state.string.length;
        }
    }

    // return true if ch is found in remainder of line, skip its position
    skipTo(ch) {
        if (this.state === undefined) return undefined;
        const found = this.state.string.indexOf(ch, this.state.pos);
        if (found > -1) { this.state.pos = found; return true; }
        return undefined;
    }

    // go back n characters
    backUp(n) {
        if (this.state) this.state.pos -= n;
    }

    // return match if next characters match pattern, else undefined or null
    // if consume !== false: advance position past match
    match(pattern, consume, caseInsensitive) {
        if (this.state === undefined) return undefined;
        if (typeof pattern === "string") {
            const cased = function(str) { return caseInsensitive ? str.toLowerCase() : str; };
            const substr = this.state.string.substr(this.state.pos, pattern.length);
            if (cased(substr) === cased(pattern)) {
                if (consume !== false) this.state.pos += pattern.length;
                return substr;
            }
        } else {
            const match = this.state.string.slice(this.state.pos).match(pattern);
            if (match && match.index > 0) return null;
            if (match && consume !== false) this.state.pos += match[0].length;
            return match;
        }
        return undefined;
    }

}

//////////////////////////////////////////////////
// TokenStream
//////////////////////////////////////////////////

// options:
//  .line_comment         -- characters that start comment to end of line
//  .block_comment_start  -- characters that start a block comment
//  .block_comment_end    -- characters that end a block comment
SimTool.TokenStream = class extends SimTool.BufferStream {
    constructor (options) {
        super();

        this.options = options;   // ISA-specific information

        if (this.options.block_comment_end !== undefined) {
            this.options.block_comment_end_pattern =
                new RegExp('^.*?' + this.options.block_comment_end.replace('*','\\*'));
        }

        this.token = undefined;

        this.token_buffers = [];  // stack of pending token buffers
        this.token_state = undefined;
    }

    // push list of lines, each of which is a list of tokens
    push_tokens(lines) {
        // start reading from new token buffer
        this.token_state = {   // newly installed state
            pos: 0,
            tokens: lines[0],
            lines: lines,
            line_number: 0,
        };
        this.token_buffers.push(this.token_state);
    }

    match(pattern, consume, caseInsensitive) {
        // token buffers don't have spaces and comments!
        if (this.token_state !== undefined) {
            const next_token = this.token_state.tokens[this.token_state.pos + 1];
            // for now, assume pattern is just a string...
            if (next_token && next_token.token === pattern) {
                if (consume !== false) this.token_state.pos += 1;
                return next_token.token;
            }
            return undefined;
        } else {
            return super.match(pattern, consume, caseInsensitive);
        }
    }

    eol() {
        if (this.token_state !== undefined) {
            return this.token_state.pos >= this.token_state.tokens.length;
        } else {
            return super.eol();
        }
    }

    next_line() {
        // are reading tokens from saved state?
        if (this.token_state !== undefined) {
            // move to next line in token buffer
            this.token_state.line_number += 1;
            if (this.token_state.line_number < this.token_state.lines.length) {
                // still more lines of tokens
                this.token_state.tokens = this.token_state.lines[this.token_state.line_number];
                this.token_state.pos = 0;
            } else {
                // all done with current token buffer, return to previous buffer
                this.token_buffers.pop();
                this.token_state = this.token_buffers[this.token_buffers.length - 1];
            }
            return true;
        } else {
            // nope, reading from character buffer
            return super.next_line();
        }
    }

    // Reads one character from a string and returns it.
    // If the character is equal to end_char, and it's not escaped,
    // returns false instead (this lets you detect end of string)
    read_string_char(end_char) {
        const start = this.location;
        let chr = this.next();
        let octal;
        switch(chr) {
        case end_char:
            return false;
        case '\\':
            octal = this.match(/^[0-7]{1,3}/);
            if (octal) {
                const value = parseInt(octal[0], 8);
                if (value > 255) {
                    throw this.syntax_error("Octal escape sequence \\" + octal + " is larger than one byte (max is \\377)", start, this.location);
                }
                return String.fromCharCode(value);
            }
            chr = this.next();
            switch(chr) {
            case 'b': return '\b';
            case 'f': return '\f';
            case 'n': return '\n';
            case 'r': return '\r';
            case 't': return '\t';
            case '"': return '"';
            case "'": return "'";
            case '\\': return '\\';
            default:
                throw this.syntax_error("Unknown escape sequence \\" + chr + ". (if you want a literal backslash, try \\\\)", start, this.location);
            }
        default:
            return chr;
        }
    }

    // helper methods for external token parsers
    make_token(type, value, start, end) {
        return new SimTool.Token(type, value, start, end);
    }

    syntax_error(message, start, end) {
        throw new SimTool.SyntaxError(message, start, end);
    }

    // skip past whitespace and comments
    eat_space_and_comments () {
        while (!this.eol()) {
            this.eatSpace();
            const token_start = this.location;

            // start of line comment?
            if (this.options.line_comment !== undefined && this.match(this.options.line_comment)) {
                this.skipToEnd();
                continue;
            }

            // start of block comment?
            if (this.options.block_comment_start && this.match(this.options.block_comment_start)) {
                // keep consuming characters until we find end sequence
                for (;;) {
                    // found end of multi-line comment, so we're done
                    if (this.match(this.options.block_comment_end_pattern)) break;
                    else {
                        // keep looking: skip this line and try the next line
                        this.skipToEnd();
                        // block comment must end in current buffer...
                        if (!this.next_line(true)) {
                            throw this.syntax_error("Unterminated block comment",
                                                    token_start,
                                                    this.location);
                        }
                    }
                }
                continue;
            }

            break;   // must be at non-whitespace...
        }
    }

    // return next token from input buffers
    next_token() {
        // reading from a token buffer?
        if (this.token_state !== undefined) {
            // returns undefined once we've read all the tokens on the line
            this.token = this.token_state.tokens[this.token_state.pos++];
            return this.token;
        }

        let token_value, token_type, token_start;
        while (!this.eol()) {
            this.eat_space_and_comments();
            if (this.eol()) break;

            token_start = this.location;

            // custom token?
            if (this.options.next_token) {
                this.token = this.options.next_token(this);
                if (this.token !== undefined) return this.token;
            }

            // character constant?
            if (this.match("'")) {
                token_type = 'number';
                token_value = BigInt(this.read_string_char().charCodeAt(0));
                break;
            }

            // string constant?
            if (this.match('"')) {
                token_value = '';
                token_type = 'string';
                let unterminated = true;
                while (!this.eol()) {
                    const ch = this.read_string_char('"');
                    if (ch === false) { unterminated = false; break; }
                    else token_value += ch;
                }
                if (unterminated) {
                    throw this.syntax_error("Unterminated string constant", token_start, this.location);
                }
                break;
            }

            // label definition?
            token_type = 'label';
            token_value = this.match(/^([._$A-Z][._$A-Z0-9]*):/i);
            if (token_value) { token_value = token_value[1]; break; }

            // local label definition?
            token_type = 'local_label';
            token_value = this.match(/^(\d):/i);
            if (token_value) { token_value = token_value[1]; break; }

            // symbol reference?
            token_type = 'symbol';
            token_value = this.match(/^[._$A-Z][._$A-Z0-9]*/i);
            if (token_value) { token_value = token_value[0]; break; }

            // local symbol reference?
            token_type = 'local_symbol';
            token_value = this.match(/^\d[fb]/i);
            if (token_value) { token_value = token_value[0]; break; }

            // number?
            token_type = 'number';
            token_value = this.match(/^0x[0-9a-f]*/i);   // hex
            if (token_value) { token_value = BigInt(token_value[0]); break; }
            token_value = this.match(/^0b[01]*/i);       // binary
            if (token_value) { token_value = BigInt(token_value[0]); break; }
            token_value = this.match(/^0[0-7]*/);       // octal (and zero!)
            if (token_value) { token_value = BigInt(token_value[0], 8); break; }
            token_value = this.match(/^[1-9][0-9]*/);   // decimal
            if (token_value) { token_value = BigInt(token_value[0]); break; }
            // floats?

            // operator?
            // search for 2-character sequences before 1-character sequences!
            token_type = 'operator';
            token_value = this.match(/^\+\+|--|>>>|>>|<<|\*\*|==|!=/);
            if (token_value) { token_value = token_value[0]; break; }
            token_value = this.match(/[-#,;!()[\]{}\\+*/%=~&|^]/);
            if (token_value) { token_value = token_value[0]; break; }

            // if we reach here, we haven't found a token, so complain about next character
            if (!this.eol()) {
                token_value = this.next();
                throw this.syntax_error("Unexpected character", token_start, this.location);
            }

            // no token found
            token_value = undefined;
            token_type = undefined;
        }

        // build new token
        if (token_type === undefined) this.token = undefined;
        else this.token = new SimTool.Token(token_type, token_value, token_start, this.location);
        return this.token;
    }
}
