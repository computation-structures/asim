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

// parser.SyntaxError(message,start,end)
// parser.Token(type, token, start, end)
// parser.BufferStream()
// parser.TokenStream(options) extends parser.BufferStream()
//   .next_token()  -- returns next Token from current buffer
//   options is an object with zero or more of the following
//    .line_comment         -- characters that start comment to end of line
//    .block_comment_start  -- characters that start a block comment
//    .block_comment_end    -- characters that end a block comment

var sim_tool;  // keep lint happy

(function () {
    //////////////////////////////////////////////////
    // Syntax Error
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
    sim_tool.SyntaxError = SyntaxError;

    //////////////////////////////////////////////////
    // Token
    //////////////////////////////////////////////////

    class Token {
        constructor (type, token, start, end) {
            this.type = type;
            this.token = token;
            this.start = start;   // [buffer, line, offset]
            this.end = end;
        }

        asSyntaxError (msg) {
            return new SyntaxError(msg || this.token, this.start, this.end);
        }

        locationString(locn) {
            if (locn == undefined) locn = this.start;
            return `${locn[0]}:locn[1]}:locn[2]}`;
        }

        lineString(locn) {
            if (locn == undefined) locn = this.start;
            return `${this.start[0]}:${this.start[1]}`;
        }

        url(msg) {
            let start = `${this.start[0]},${this.start[1]},${this.start[2]}`;
            let end = `${this.end[0]},${this.end[1]},${this.end[2]}`;
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

        // back to start of buffer
        reset_state() {
            this.state.pos = 0;
            this.state.line_number = 0;
            this.state.string = this.state.lines[0];
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
            while (this.eat(match)) { /* keep looping while we find matches */ }
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
            return undefined;
        }

    }
    sim_tool.BufferStream = BufferStream;

    //////////////////////////////////////////////////
    // TokenStream
    //////////////////////////////////////////////////

    // options:
    //  .line_comment         -- characters that start comment to end of line
    //  .block_comment_start  -- characters that start a block comment
    //  .block_comment_end    -- characters that end a block comment
    class TokenStream extends BufferStream {
        constructor (options) {
            super();

            this.options = options;   // ISA-specific information

            if (this.options.block_comment_end !== undefined) {
                this.options.block_comment_end_pattern =
                    new RegExp('^.*?' + this.options.block_comment_end.replace('*','\\*'));
            }

            this.token = undefined;
        }

        // Reads one character from a string and returns it.
        // If the character is equal to end_char, and it's not escaped,
        // returns false instead (this lets you detect end of string)
        read_string_char(end_char) {
            let start = this.location;
            let chr = this.next();
            let octal;
            switch(chr) {
            case end_char:
                return false;
            case '\\':
                octal = this.match(/^[0-7]{1,3}/);
                if (octal) {
                    let value = parseInt(octal[0], 8);
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
            return new Token(type, value, start, end);
        }
        syntax_error(message, start, end) {
            throw new SyntaxError(message, start, end);
        }

        // skip past whitespace and comments
        eat_space_and_comments () {
            while (!this.eol()) {
                this.eatSpace();
		let token_start = this.location;

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
                    token_value = this.read_string_char().charCodeAt(0);
                    break;
                }

                // string constant?
                if (this.match('"')) {
                    token_value = '';
                    token_type = 'string';
                    let unterminated = true;
                    while (!this.eol()) {
                        let ch = this.read_string_char('"');
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
                token_value = this.match(/^0x([0-9a-f]+)/i);   // hex
                if (token_value) { token_value = BigInt(token_value[1], 16); break; }
                token_value = this.match(/^0b([01]*)/i);       // binary
                if (token_value) { token_value = BigInt(token_value[1], 2); break; }
                token_value = this.match(/^0([0-7]*)/);       // octal (and zero!)
                if (token_value) { token_value = BigInt(token_value[1], 8); break; }
                token_value = this.match(/^[1-9][0-9]*/);   // decimal
                if (token_value) { token_value = BigInt(token_value[0], 10); break; }
                // floats?

                // operator?
                // search for 2-character sequences before 1-character sequences!
                token_type = 'operator';
                token_value = this.match(/^\+\+|--|>>|<<|\*\*|==/);
                if (token_value) { token_value = token_value[0]; break; }
                token_value = this.match(/[-,;()[\]{}+*%=~&|^]/);
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
            else this.token = new Token(token_type, token_value, token_start, this.location);
            return this.token;
        }
    };
    sim_tool.TokenStream = TokenStream;
})();
