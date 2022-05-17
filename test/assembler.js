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

// implement GNU-assembler-like functionality
(function () {
    // current assembler version
    cpu_tool.assembler_version = '0.1';

    //////////////////////////////////////////////////
    // BufferStream
    //////////////////////////////////////////////////

    // return characters from a stack of buffers.
    // stack is used to support .include and macro expansion
    class BufferStream {
	constructor () {
	    this.buffer_list = [];    // stack of pending buffers
	    this.state = undefined;
	}

	// add a new buffer to the stack.  Subsequent characters come from the
	// new buffer until exhausted, then return to current buffer.
	push_buffer(bname, bcontents) {
	    let lines = bcontents.split('\n');
	    this.state = {         // newly initialized state
		pos: 0,
		string: lines[0],
		lines: lines,
		line_number: 0,    // NB: zero based!
		buffer_name: bname
	    };
	    this.buffer_list.push(this.state);
	}

	get buffer_name() {
	    if (this.state === undefined) return undefined;
	    return this.state.buffer_name
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
	    if (this.state) this.state.pos = column - 1;
	}

	// buffer:line:col
	location(state) {
	    if (state)
		return `${state.buffer_name}:${state.line_number + 1}:${state.pos + 1}`
	    // use this.state if no explicit state is provided
	    if (this.state === undefined) return '';
	    let result = []
	    for (let state of this.buffer_list)
		result.push(this.location(state));
	    return result.join('::');
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
	    return this.state.string.charAt(state.pos);
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
            let ch = this.state.string.charAt(this.state.pos);
	    let ok = (typeof match == "string") ? (ch == match) :
		(ch && (match.test ? match.test(ch) : match(ch)));
            if (ok) { this.state.pos += 1; return ch; }
	    else return undefined;
	}

	// consumer characters that match, return true if there were some
	eatWhile(match) {
	    if (this.state === undefined) return undefined;
	    let start = this.state.pos;
	    while (this.eat(match)) {};
	    return this.state.pos > start;
	}

	// consume whitespace, return true if there were some
	eatSpace() {
	    if (this.state === undefined) return undefined;
	    let start = this.state.pos;
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
	    let found = this.state.string.indexOf(ch, this.state.pos);
	    if (found > -1) { this.state.pos = found; return true; }
	}

	// go back n characters
	backUp(n) {
	    if (this.state) this.state.pos -= n;
	}

	// return match if next characters match pattern, else undefined or null
	// if consume: advance position past match
	match(pattern, consume, caseInsensitive) {
	    if (this.state === undefined) return undefined;
	    if (typeof pattern == "string") {
		let cased = function(str) { return caseInsensitive ? str.toLowerCase() : str; };
		let substr = this.state.string.substr(this.state.pos, pattern.length);
		if (cased(substr) == cased(pattern)) {
		    if (consume !== false) this.state.pos += pattern.length;
		    return substr;
		}
	    } else {
		let match = this.state.string.slice(this.state.pos).match(pattern);
		if (match && match.index > 0) return null;
		if (match && consume !== false) this.state.pos += match[0].length;
		return match ? match[0] : null;  // the string that matched
	    }
	}
    }

    //////////////////////////////////////////////////
    // Assembler
    //////////////////////////////////////////////////

    // record a syntax error, along with the current stream location
    class SyntaxError extends Error {
	constructor(message, start, end) {
	    super();
            this.start = start;
	    this.end = end;
            this.message = message;
	}

	toString() {
	    return `${this.start}${this.end ? ':'+this.end : ''}: ${this.message}`;
	}
    }

    // Eats spaces and comments on current line (so nothing else needs to worry about either)
    function eatSpace(stream) {
	while (!stream.eol()) {
	    // skip to next non-whitespace character
            stream.eatSpace();

	    // start of line comment?
            if (stream.match("@")) { stream.skipToEnd(); break; }

	    // start of multi-line comment?  if so, skip to end of comment
            let start_location = stream.location();
            if (stream.match("/*")) {
		// keep consuming characters until we find "*/"
		while (true) {
		    // found end of multi-line comment, so we're done
                    if (stream.match(/^.*\*\//)) break;
		    else {
			// keep looking: skip this line and try the next line
			stream.skipToEnd();
			if (!stream.next_line(true)) {
                            throw new SyntaxError("Unclosed block comment",
						  start_location,
						  stream.location());
			}
                    }
		}
		continue;   // look for more whitespace
            }

	    // we must be at non-whitespace
	    break;
	}
    }

    // parse a single line, throwing errors or pushing content
    function parse_line(stream, content) {
	while (!stream.eol()) {
	    // skip any whitespace including comments.
	    // Might consume multiple lines if there's a multi-line comment
	    eatSpace(stream);
	    if (stream.eol()) break;

	    let location = stream.location();
	    let token = stream.match(/^\S+/);
	    if (token === null) break;
	    content.push([location, token]);

	    // check for temp label

	    // check for regular label

	    // check for directive

	    // check for opcode
	}
    }

    function parse(stream) {
	let content = [];    // results of the parse
	let errors = [];     // list of errors

	do {
	    // parse one line, catching any errors and saving them
	    try {
		parse_line(stream, content);
	    } catch (e) {
                if (e instanceof SyntaxError) errors.push(e);
		else throw e;
            }
	} while (stream.next_line());

	// return result
	return {content: content, errors: errors};
    }

    // assemble the contents of the specified buffer
    cpu_tool.assemble = function (top_level_buffer_name, buffer_dict, ISA) {
	let stream = new BufferStream();
	stream.push_buffer(top_level_buffer_name, buffer_dict[top_level_buffer_name]);

	return parse(stream);   // {content: ..., errors: ...}
    };

})();
