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

cpu_tool.isa_info["RISC-V"] = (function () {
    // define everything inside a closure so as not to pollute namespace

    let info = {};    // holds info about this architecture
    info.lineCommentStartSymbol = '#';
    info.cm_mode = "riscv";

    //////////////////////////////////////////////////
    // ISA registers
    //////////////////////////////////////////////////

    // map token (register name) => info about each register
    //  .bin = binary value for assembly
    //  .cm_style = CodeMirror syntax coloring
    info.registers = {}

    alt_register_names = [
	'zero', 'ra', 'sp', 'gp', 'tp',
	't0', 't1', 't2',    // temp
	's0', 's1',   // proc must save/restore if used
	'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',  // proc args
	's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',  // save/restore
	't3', 't4', 't5', 't6',  // temp
    ];
    for (let i = 0; i <= 31; i += 1) {
	info.registers['x'+i] = { bin: i, cm_style: 'variable'};
	info.registers[alt_register_names[i]] = { bin: i, cm_style: 'variable'};
    }

    //////////////////////////////////////////////////
    // opcodes
    //////////////////////////////////////////////////

    // indexed by inst[6:0], funct3 is inst[14:12]
    info.opcode = {
	0b0110111: { type:'U', op:'lui' },
	0b0010111: { type:'U', op:'auipc' },
	0b1101111: { type:'J': op:'jal' },
	0b1100111: { funct3: {
	    0b000: { type: 'I', op:'jalr' },
	}},

    	0b1100011: { funct3: {
	    0b000: { type: 'B', op:'beq' },
    	    0b001: { type: 'B', op:'bne' },
    	    0b100: { type: 'B', op:'blt' },
    	    0b101: { type: 'B', op:'bge' },
    	    0b110: { type: 'B', op:'bltu' },
    	    0b111: { type: 'B', op:'bgeu'},
	}},

    	0b0000011: { funct3: {
	    0b000: { type: 'I', op: 'lb' },
	    0b001: { type: 'I', op: 'lh' },
	    0b010: { type: 'I', op: 'lw' },
	    0b100: { type: 'I', op: 'lubU' },
	    0b101: { type: 'I', op: 'lhu' },
	}},

	ob0100011: { funct3: {
	    0b000: { type: 'S', op: 'sb' },
	    0b001: { type: 'S', op: 'sh' },
	    0b010: { type: 'S', op: 'sw' },
	}},

	ob0010011: { funct3 {
	    0b000: { type: 'I', op: 'addi' },
	    0b010: { type: 'I', op: 'slti' },
	    0b011: { type: 'I', op: 'sltiu' },
	    0b100: { type: 'I', op: 'xori' },
	    0b110: { type: 'I', op: 'ori' },
	    0b111: { type: 'I', op: 'andi' },
	}},
    };

    //////////////////////////////////////////////////
    // Directives
    //////////////////////////////////////////////////

    // start with built-in (architecture-independent) directives
    info.directives = { ...cpu_tool.built_in_directives };

    // add architecture-specific directives here

    //////////////////////////////////////////////////
    // custom CodeMirror mode for this ISA
    //////////////////////////////////////////////////

    CodeMirror.defineMode("riscv", function(_config, parserConfig) {
	'use strict';

	// consume characters until end character is found
	function nextUntilUnescaped(stream, end) {
	    let escaped = false, next;
	    while ((next = stream.next()) != null) {
		if (next === end && !escaped) {
		    return false;
		}
		escaped = !escaped && next === "\\";
	    }
	    return escaped;
	}

	// consume block comment
	function clikeComment(stream, state) {
	    let maybeEnd = false, ch;
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
	    mode_name: 'RISC-V',
	    lineComment: info.lineCommentStartSymbol,
	    blockCommentStart: "/*",
	    blockCommentEnd: "*/",

	    startState: function() { return { tokenize: null } },

	    // consume next token, return its CodeMirror syntax style
	    token: function(stream, state) {
		if (state.tokenize) return state.tokenize(stream, state);

		if (stream.eatSpace()) return null;

		let ch = stream.next();

		// block comment
		if (ch === "/") {
		    if (stream.eat("*")) {
			state.tokenize = clikeComment;
			return clikeComment(stream, state);
		    }
		}

		// line comment
		if (ch === info.lineCommentStartSymbol) {
		    stream.skipToEnd();
		    return "comment";
		}

		// string
		if (ch === '"') {
		    nextUntilUnescaped(stream, '"');
		    return "string";
		}

		// directive
		if (ch === '.') {
		    stream.eatWhile(/\w/);
		    let cur = stream.current().toLowerCase().substr(1);
		    return info.directives[cur] ? 'builtin' : null;
		}

		// symbol assignment
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

		// numbers
		if (/\d/.test(ch)) {
		    if (ch === "0" && stream.eat("x")) {
			stream.eatWhile(/[0-9a-fA-F]/);
			return "number";
		    }
		    stream.eatWhile(/\d/);
		    if (stream.eat(":")) {
			return 'tag';
		    }
		    return "number";
		}

		// symbol
		if (/\w/.test(ch)) {
		    stream.eatWhile(/\w/);
		    if (stream.eat(":")) {
			return 'tag';
		    }
		    let cur = stream.current().toLowerCase();
		    let reginfo = info.registers[cur];
		    return (reginfo ? reginfo.cm_style : null);
		}
	    },
	};
    });

    return info;

})();
