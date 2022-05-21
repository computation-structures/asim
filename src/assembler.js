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

    // record a syntax error, along with the current stream location
    class SyntaxError {
	constructor(message, start, end) {
            this.start = start;
	    this.end = end;
            this.message = message;
	}

	toString() {
	    return `${JSON.stringify(this.start)}, ${JSON.stringify(this.end)}: ${this.message}`;
	}
    }

    class Token {
	constructor (type, token, start, end) {
	    this.type = type;
	    this.token = token;
	    this.start = start;   // [buffer, line, offset]
	    this.end = end;
	}

	toJSON() {
	    return `[${this.type} '${this.token.toString()}' ${this.start[0]}:${this.start[1]}:${this.start[2]} ${this.end[0]}:${this.end[1]}:${this.end[2]}]`;
	}
    }

    // return characters from a stack of buffers.
    // stack is used to support .include and macro expansion
    class BufferStream {
	constructor (isa) {
	    this.buffer_list = [];    // stack of pending buffers
	    this.state = undefined;
	    this.isa = isa;

	    // tokenizing support
	    this.token = undefined;
	    if (isa.block_comment_end !== undefined)
		isa.block_comment_end_pattern = new RegExp('^.*?' + isa.block_comment_end.replace('*','\\*'));
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
	// if consume !== false: advance position past match
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
		return match;
	    }
	}

	//////////////////////////////////////////////////
	// tokens!
	//////////////////////////////////////////////////

	next_token() {
	    let token_value, token_type, token_start;
	    while (!this.eol()) {
		this.eatSpace();
		token_start = this.location;

		// start of line comment?
		if (this.isa.line_comment !== undefined && this.match(this.isa.line_comment)) {
		    this.skipToEnd();
		    continue;
		}

		// start of block comment?
		if (this.isa.block_comment_start && this.match(this.isa.block_comment_start)) {
		    // keep consuming characters until we find end sequence
		    while (true) {
			// found end of multi-line comment, so we're done
			if (this.match(this.isa.block_comment_end_pattern)) break;
			else {
			    // keep looking: skip this line and try the next line
			    this.skipToEnd();
			    // block comment must end in current buffer...
			    if (!this.next_line(true)) {
				throw new SyntaxError("Unterminated block comment",
						      token_start,
						      this.location);
			    }
			}
		    }
		    continue;
		}

		// Reads one character from a string and returns it.
		// If the character is equal to end_char, and it's not escaped,
		// returns false instead (this lets you detect end of string)
		function read_char(stream, end_char) {
		    let start = stream.location;
		    let chr = stream.next();
		    switch(chr) {
		    case end_char:
			return false;
		    case '\\':
			let octal = stream.match(/^[0-7]{1,3}/);
			if (octal) {
			    let value = parseInt(octal[0], 0);
			    if (value > 255) {
				throw new SyntaxError("Octal escape sequence \\" + octal + " is larger than one byte (max is \\377)", start, stream.location);
			    }
			    return String.fromCharCode(value);
			}
			chr = stream.next();
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
			    throw new SyntaxError("Unknown escape sequence \\" + chr + ". (if you want a literal backslash, try \\\\)", start, stream.location);
			}
			break;
		    default:
			return chr;
		    }
		}

		// string constant?
		if (this.peek() == '"') {
		    token_value = '';
		    token_type = 'string';
		    let unterminated = true;
		    while (!stream.eol()) {
			let ch = read_char(this, '"');
			if (ch === false) {
			    unterminated = false;
			    break;
			}
			else token_value += ch;
		    }
		    if (unterminated) {
			throw new SyntaxError("Unterminated string constant", token_start, stream.location);
		    }
		    break;
		}

		// label definition?
		token_type = 'label';
		token_value = this.match(/^([\._$A-Z][\._$A-Z0-9]*):/i);
		if (token_value) { token_value = token_value[1]; break; }
		token_value = this.match(/^(\d+):/i);
		if (token_value) { token_value = token_value[1]; break; }

		// symbol or local symbol reference?
		token_type = 'symbol';
		token_value = this.match(/^[\._$A-Z][\._$A-Z0-9]*/i);
		if (token_value) { token_value = token_value[0]; break; }
		token_value = this.match(/^\d+[fb]/i);
		if (token_value) { token_value = token_value[0]; break; }

		// number?
		token_type = 'number';
		token_value = this.match(/^0x([0-9a-f]+)/i);   // hex
		if (token_value) { token_value = BigInt(token_value[1], 16); break; }
		token_value = this.match(/^0b([01]+)/i);       // binary
		if (token_value) { token_value = BigInt(token_value[1], 2); break; }
		token_value = this.match(/^0([0-7]+)/);       // octal
		if (token_value) { token_value = BigInt(token_value[1], 8); break; }
		token_value = this.match(/^[1-9][0-9]*|^0/);   // decimal
		if (token_value) { token_value = BigInt(token_value[0], 10); break; }
		// floats?

		// operator?
		// search for 2-character sequences before 1-character sequences!
		token_type = 'operator';
		token_value = this.match(/^\+\+|\-\-|>>|<<|\*\*/);
		if (token_value) { token_value = token_value[0]; break; }
		token_value = this.match(/[-,;()[\]{}+*%=~&|\^]/);
		if (token_value) { token_value = token_value[0]; break; }

		// if we reach here, we haven't found a token, so complain about next character
		if (!this.eol()) {
		    token_value = this.next();
		    throw new SyntaxError("Unexpected character", token_start, this.location);
		}

		// no token found
		token_value = undefined;
		token_type = undefined;
	    }

	    // build new token
	    if (token_type === undefined) this.token = undefined;
	    else this.token = new Token(token_type, token_value, token_start, this.location);
	    return this.token;
	}
    }

    //////////////////////////////////////////////////
    // Built-in directives
    //////////////////////////////////////////////////

    cpu_tool.built_in_directives = {
	global: function () {},
	section: function () {},
    }

    //////////////////////////////////////////////////
    // Assembler
    //////////////////////////////////////////////////

    // returns comma-separated operands, returns array of strings 
    function read_operands(stream) {
	let operands = [], token, start, end;
	while (true) {
	    eatSpace(stream);
	    if (stream.eol()) break;
	    start = stream.location;
	    if (stream.peek() == '"') {
		// string constant
		token = '"' + read_string(stream) + '"';
	        end = string.location;
	    } else {
		let tokens = [];
		while (true) {
		    token = stream.match(/^[A-Z0-9+\-=()[\].<>{}*\/%]+/i);
		    if (!token) break;
		    tokens.push(token[0]);
		    end = stream.location;
		    eatSpace(stream);
		    if (stream.eol() || stream.match(',')) break;
		}
		// reassemble token having eliminated extra whitespace and inline comments
		token = tokens.join('');
	    }
	    operands.push([token,start,end]);
	}
	return operands;
    }

    // parse a single line, throwing errors or pushing content
    function parse_line(stream, content) {
	let token;

	while (!stream.eol()) {
	    content.push(stream.next_token());
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
    cpu_tool.assemble = function (top_level_buffer_name, buffer_dict, isa) {
	let stream = new BufferStream(isa);
	stream.push_buffer(top_level_buffer_name, buffer_dict[top_level_buffer_name]);

	return parse(stream);   // returns {content: ..., errors: ..., ...}
    };

})();
