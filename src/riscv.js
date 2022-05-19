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

//////////////////////////////////////////////////
// RISC-V configuration info
//////////////////////////////////////////////////

// define everything inside a closure so as not to pollute namespace
(function () {

    //////////////////////////////////////////////////
    // custom CodeMirror mode
    //////////////////////////////////////////////////

    CodeMirror.defineMode("riscv", function(_config, parserConfig) {
	'use strict';

	var lineCommentStartSymbol = '#';

	// If an architecture is specified, its initialization function may
	// populate this array with custom parsing functions which will be
	// tried in the event that the standard functions do not find a match.
	var custom = [];

	var directives = {
	    ".global" : "builtin",
	    ".section" : "builtin",
	};

	var registers = {};
	registers.x0  = registers.zero = "variable";
	registers.x1  = registers.ra = "variable";
	registers.x2  = registers.sp = "variable";
	registers.x3  = registers.gp = "variable";
	registers.x4  = registers.tp = "variable";
	registers.x5  = registers.t0 = "variable";
	registers.x6  = registers.t1 = "variable";
	registers.x7  = registers.t2 = "variable";
	registers.x8  = registers.s0 = registers.fp = "variable";
	registers.x9  = registers.s1 = "variable";
	registers.x10  = registers.a0 = "variable";
	registers.x11  = registers.a1 = "variable";
	registers.x12  = registers.a2 = "variable";
	registers.x13  = registers.a3 = "variable";
	registers.x14  = registers.a4 = "variable";
	registers.x15  = registers.a5 = "variable";
	registers.x16  = registers.a6 = "variable";
	registers.x17  = registers.a7 = "variable";
	registers.x18  = registers.s2 = "variable";
	registers.x19  = registers.s3 = "variable";
	registers.x20  = registers.s4 = "variable";
	registers.x21  = registers.s5 = "variable";
	registers.x22  = registers.s6 = "variable";
	registers.x23  = registers.s7 = "variable";
	registers.x24  = registers.s8 = "variable";
	registers.x25  = registers.s9 = "variable";
	registers.x26  = registers.s10 = "variable";
	registers.x27  = registers.s11 = "variable";
	registers.x28  = registers.t3 = "variable";
	registers.x29  = registers.t4 = "variable";
	registers.x30  = registers.t5 = "variable";
	registers.x31  = registers.t6 = "variable";

	function nextUntilUnescaped(stream, end) {
	    var escaped = false, next;
	    while ((next = stream.next()) != null) {
		if (next === end && !escaped) {
		    return false;
		}
		escaped = !escaped && next === "\\";
	    }
	    return escaped;
	}

	function clikeComment(stream, state) {
	    var maybeEnd = false, ch;
	    while ((ch = stream.next()) != null) {
		if (ch === "/" && maybeEnd) {
		    state.tokenize = null;
		    break;
		}
		maybeEnd = (ch === "*");
	    }
	    return "comment";
	}

	// mode object for CodeMirror
	return {
	    lineComment: lineCommentStartSymbol,
	    blockCommentStart: "/*",
	    blockCommentEnd: "*/",

	    startState: function() { return { tokenize: null } },

	    token: function(stream, state) {
		if (state.tokenize) return state.tokenize(stream, state);

		if (stream.eatSpace()) return null;

		var style, cur, ch = stream.next();

		if (ch === "/") {
		    if (stream.eat("*")) {
			state.tokenize = clikeComment;
			return clikeComment(stream, state);
		    }
		}

		if (ch === lineCommentStartSymbol) {
		    stream.skipToEnd();
		    return "comment";
		}

		if (ch === '"') {
		    nextUntilUnescaped(stream, '"');
		    return "string";
		}

		if (ch === '.') {
		    stream.eatWhile(/\w/);
		    cur = stream.current().toLowerCase();
		    style = directives[cur];
		    return style || null;
		}

		if (ch === '=') {
		    stream.eatWhile(/\w/);
		    return "tag";
		}

		if (ch === '{') {
		    return "bracket";
		}

		if (ch === '}') {
		    return "bracket";
		}

		if (/\d/.test(ch)) {
		    if (ch === "0" && stream.eat("x")) {
			stream.eatWhile(/[0-9a-fA-F]/);
			return "number";
		    }
		    stream.eatWhile(/\d/);
		    return "number";
		}

		if (/\w/.test(ch)) {
		    stream.eatWhile(/\w/);
		    if (stream.eat(":")) {
			return 'tag';
		    }
		    cur = stream.current().toLowerCase();
		    style = registers[cur];
		    return style || null;
		}

		for (var i = 0; i < custom.length; i++) {
		    style = custom[i](ch, stream, state);
		    if (style) {
			return style;
		    }
		}
	    },
	};
    });

    //////////////////////////////////////////////////
    // register ISA info with cpu_tool
    //////////////////////////////////////////////////

    cpu_tool.isa_info["RISC-V"] = {
	gas_mode: 'riscv',    // CodeMirror should use our custom mode

	lineCommentStartSymbol: '#',
    }
})();
