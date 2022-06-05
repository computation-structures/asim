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

var sim_tool;   // keep lint happy

// implement GNU-assembler-like functionality
(function () {
    "use strict";

    // current assembler version
    sim_tool.assembler_version = '0.1';

    //////////////////////////////////////////////////
    // AssemblerResults
    //////////////////////////////////////////////////

    // holds the results of assembling a program
    class AssemblerResults {
        constructor(isa) {
            this.isa = isa;    // info about target ISA

            this.errors = [];
            this.address_spaces = new Map();
            this.current_aspace = this.add_aspace('kernel');
            this.current_section = undefined;

            this.memory = undefined;
            this.pass = 0;
            this.next_pass();
        }

        // helper function for external directive and opcode assemblers
        syntax_error(message, start, end) {
            throw new sim_tool.SyntaxError(message, start, end);
        }

        // evaluate expression tree generated by read_expression
        eval_expression(tree) {
            let result = sim_tool.eval_expression(tree, this);
            // convert booleans to numeric values
            if (result === true) result = 1;
            if (result === false) result = 0;
            return result;
        }

        //////////////////////////////////////////////////
        // set up for an assembler pass
        //////////////////////////////////////////////////

        // do per-pass initialization
        next_pass() {
            this.pass += 1;
            if (this.pass > 2) return;

            if (this.pass == 1) {
                /* something here */
            }

            if (this.pass == 2) {
                // layout sections in virtual & physical memory at start of second pass
                let memsize = 0;
                for (let aspace of this.address_spaces.values()) {

                    // layout of sections in an address space is text, data, bss

                    // set end of .text so that data is aligned correctly
                    let text = aspace.sections.get('.text');
                    text.base = 0;
                    text.dot = this.align(text.dot, this.isa.data_section_alignment || 8);

                    // set end of .data so that bss is aligned correctly
                    let data = aspace.sections.get('.data');
                    data.base = text.dot;   // virtual address
                    data.dot = this.align(data.dot, this.isa.bss_section_alignment || 8);

                    // set end of .bss so that next address space is aligned correctly
                    let bss = aspace.sections.get('.bss');
                    bss.base = data.base + data.dot;   // virtual address
                    bss.dot = this.align(bss.dot, this.isa.address_space_alignment || 8);

                    // remember where in physical memory this address space starts
                    aspace.base = memsize;
                    aspace.size = bss.base + bss.dot;   // remember size of this address space

                    // create some symbols in kernel symbol table so program
                    // can access base and bounds of this address space
                    this.add_symbol(`_${aspace.name}_base_`, aspace.base, 'kernel');
                    this.add_symbol(`_${aspace.name}_bounds_`, aspace.size, 'kernel');

                    memsize += aspace.size;  // allocate space in physical memory
                }

                // create physical memory!
                this.memory = new DataView(new ArrayBuffer(memsize));
            }

            for (let aspace of this.address_spaces.values()) {
                // we'll want to generate the same index for each local label on each pass
                // so reinitialize table of last-used index for each local label
                aspace.local_label_index.clear();   // N => last index used

                // reset dot to 0 in all sections (only meaningful after first pass)
                if (this.pass > 1) {
                    for (let section of aspace.sections.values()) {
                        section.dot = 0;
                    }
                }
            }

            // start assembling into .text by default
            this.change_section('.text', 'kernel');
        }

        // add byte to memory at dot, advance dot
        emit8(v) {
            // remember to use physical address!
            if (this.memory) this.memory.setUint8(this.dot(true), v, this.isa.little_endian);
            this.incr_dot(1);
        }

        // add word to memory at dot, advance dot
        emit32(v) {
            // remember to use physical address!
            if (this.memory) this.memory.setUint32(this.dot(true), v, this.isa.little_endian);
            this.incr_dot(4);
        }

        // return hex string of what's in word at byte_offset
        location(byte_offset) {
            if (this.memory) {
                let v = this.memory.getUint32(byte_offset, this.isa.little_endian);
                return sim_tool.hexify(v);
            }
            return undefined;
        }

        //////////////////////////////////////////////////
        // sections: .text, .data, .bss
        //////////////////////////////////////////////////

        add_aspace(aname) {
            let aspace = this.address_spaces.get(aname);
            if (aspace === undefined) {
                aspace = {};
                aspace.name = aname;
                aspace.sections = new Map();
                aspace.sections.set(".text", {aspace: aspace, name: ".text", dot: 0, base: 0});
                aspace.sections.set(".data", {aspace: aspace, name: ".data", dot: 0, base: 0});
                aspace.sections.set(".bss", {aspace: aspace, name: ".bss", dot: 0, base: 0});
                aspace.symbol_table = new Map();
                aspace.local_label_index = new Map();
                aspace.base = 0;   // physical address of address space
                aspace.size = 0;   // length of address space in bytes

                this.address_spaces.set(aname, aspace);
            }
            return aspace;
        }

        // change which section we're assembling into, return section
        // return undefined if section not found
        change_section(sname, aname) {
            if (aname) this.current_aspace = this.add_aspace(aname);
            if (this.current_aspace.sections.has(sname))
                this.current_section = this.current_aspace.sections.get(sname);
            return this.current_section;
        }

        // return value where value>=v and value%alignment == 0
        align(v, alignment) {
            let remainder = v % alignment;
            return remainder > 0 ? v + alignment - remainder : v;
        }

        // adjust dot of current section to be a multiple of alignment
        align_dot(alignment) {
            this.current_section.dot = this.align(this.current_section.dot, alignment);
        }

        // reserve room in the current section
        incr_dot(amount) {
            this.current_section.dot += amount;
            return this.current_section.dot;
        }

        // get offset into current section
        dot(physical_address) {
            let value = this.current_section.dot;
            if (physical_address) {
                value += this.current_section.base + this.current_section.aspace.base;
            }
            return value;
        }

        //////////////////////////////////////////////////
        // symbol definition and lookup
        //////////////////////////////////////////////////

        // add a label to the symbol table
        add_label(label_token, sname, aname) {
            let aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
            if (aspace === undefined) return false;

            let section = sname ? aspace.sections.get(sname) : this.current_section;
            if (section === undefined) return false;

            let name = label_token.token;

            if (label_token.type == 'local_label') {
                // compute this label's (new) index
                let index = (aspace.local_label_index.get(name) || 0) + 1;
                aspace.local_label_index.set(name, index);

                // synthesize unique label name for the local label
                // include "*" so label name is one that user can't define
                name = 'L' + name + '*' + index.toString();
            } else if (this.pass == 1) {
                let previous = aspace.symbol_table.get(name);
                if (previous !== undefined) {
                    // oops, label already defined!
                    throw label_token.asSyntaxError(`Duplicate label definition for "${name}", originally defined at ${previous.definition.url()}`);
                }
            }
            aspace.symbol_table.set(name, {
                type: 'label',
                definition: label_token,   // remember where it was defined
                name: name,
                section: section,    // so we can update value with section.base
                value: section.dot,
            });

            return true;
        }

        // add a symbol to the symbol table (redefinition okay)
        add_symbol(name, value, aname) {
            let aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
            if (aspace === undefined) return false;

            let symbol = aspace.symbol_table.get(name);
            if (symbol === undefined) {
                symbol = {
                    type: 'symbol',
                    name: name,
                    section: undefined,    // assigned symbols don't need relocation
                };
                aspace.symbol_table.set(name, symbol);
            }
            symbol.definition = symbol,   // track most recent definition
            symbol.value = value;          // update value
            return true;
        }

        // look up value of symbol or local symbol
        symbol_value(name, physical_address, aname) {
            let aspace = aname ? this.address_spaces.get(aname) : this.current_aspace;
            if (aspace === undefined) return false;

            if (name === '.') return this.dot(physical_address);
            let lookup_name = name;

            if (/\d[fb]/.test(name)) {
                let direction = name.charAt(name.length - 1);
                name = name.slice(0, -1);  // remove direction suffix

                // get the current value of the appropriate local label index
                let index = aspace.local_label_index.get(name) || 0;
                if (direction == 'f') index += 1;  //referencing next definition

                // we can predict the unique symbol name associated with both the
                // previous and next local label with the given name
                lookup_name = 'L' + name + '*' + index.toString();
            }

            // find it in symbol table
            let symbol = aspace.symbol_table.get(lookup_name);
            if (symbol === undefined) return undefined;

            let value = symbol.value;

            // relocate label values
            if (symbol.type == 'label') {
                value += symbol.section.base;   // virtual address
                if (physical_address) value += symbol.section.aspace.base;
            }

            return value;
        }

        // return a Map from physical address to symbol name
        label_table() {
            let table = new Map();
            for (let aname of this.address_spaces.keys()) {
                let aspace = this.address_spaces.get(aname);
                for (let symbol of aspace.symbol_table.keys()) {
                    // we only want labels...
                    if (aspace.symbol_table.get(symbol).section === undefined)
                        continue;
                    table.set(this.symbol_value(symbol, true, aname), symbol);
                }
            }
            return table;
        }
    }

    //////////////////////////////////////////////////
    // Built-in directives
    //////////////////////////////////////////////////

    // .align n   (align dot to be 0 mod 2^n)
    function directive_align(results, key, operands, stream) {
        if (operands.length != 1 || operands[0].length != 1 ||
            operands[0][0].type != 'number' || operands[0][0].token < 1 || operands[0][0].token > 12)
            throw key.asSyntaxError('Expected a single numeric argument between 1 and 12');
        results.align_dot(2 << Number(operands[0][0].token));
        return true;
    }

    // .ascii, .asciz
    function directive_ascii(results, key, operands, stream) {
        for (let operand of operands) {
            if (operand.length != 1 || operand[0].type != 'string')
                results.syntax_error('Expected string',
                                     operand[0].start, operand[operand.length - 1].end);
            let str = operand[0].token;
            for (let i = 0; i < str.length; i += 1) {
                results.emit8(str.charCodeAt(i));
            }
            if (key.token == '.asciz') results.emit8(0);
        }
        return true;
    }

    // .global symbol, ...
    function directive_global(results, key, operands, stream) {
        // just check that the symbols are defined...
        for (let operand of operands) {
            if (operand.length != 1 || operand[0].type != 'symbol')
                results.syntax_error('Expected symbol name',
                                     operand[0].start, operand[operand.length - 1].end);
            if (results.pass == 2 && results.symbol_value(operand[0].token) === undefined)
                results.syntax_error('Undefined symbol',
                                     operand[0].start, operand[0].end);
        }

        return true;
    }

    // .include "buffer_name"
    function directive_include(results, key, operands, stream) {
        if (operands.length != 1 || operands[0].length != 1 || operands[0][0].type != 'string')
            throw key.asSyntaxError('Expected a single string argument');
        let bname = operands[0][0].token;
        if (!results.buffer_map.has(bname))
            throw operands[0][0].asSyntaxError(`Cannot find buffer "${bname}"`);
        stream.push_buffer(bname, results.buffer_map.get(bname));
        return true;
    }

    // .section, .text, .data, .bss
    function directive_section(results, key, operands, stream) {
        if (key.token == '.section') {
            key = operands[0];
            if (key.length != 1 || key[0].type != 'symbol' ||
                !(key[0].token == '.text' || key[0].token == '.data' || key[0].token == '.bss'))
                results.syntax_error('Expected .text, .data, or .bss',
                                     key[0].start, key[key.length - 1].end);
            operands = operands.slice(1);
        }

        let aname = results.current_aspace.name;
        if (operands.length == 1) {
            // grab name of address space
            aname = operands[1];
            if (aname.length != 1 || aname.token.type != 'symbol')
                results.syntax_error('Expected name of address space',
                                     aname[0].start, aname[key.length - 1].end);
            aname = aname[0].token;
        } else if (operands.length > 1) {
            let last = operands[operands.length - 1];
            results.syntaxError('Too many arguments!',
                                operands[1][0].start, last[last.length - 1].end);
        }

        results.change_section(key.token, aname);
        return true;
    }

    let built_in_directives = {
        ".align": directive_align,
        ".ascii": directive_ascii,
        ".asciz": directive_ascii,
        ".bss": directive_section,
        ".data": directive_section,
        ".global": directive_global,
        ".include": directive_include,
        ".section": directive_section,
        ".text": directive_section,
    };

    //////////////////////////////////////////////////
    // Assembler
    //////////////////////////////////////////////////

    // return undefined or expression represented as hierarchical lists or a leaf
    // where the leaves and operators are tokens
    // tokens is a list of tokens, eg, an operand as returned by read_operands
    sim_tool.read_expression = function (tokens, index) {
        // Uses "ordinary" precedence rules: from low to high
        //   expression := bitwise_OR
        //   bitwise_OR := bitwise_XOR ("|" bitwise_XOR)*
        //   bitwise_XOR := bitwise_AND ("^" bitwise_AND)*
        //   bitwise_AND := equality ("&" equality)*
        //   equality = relational (("==" | "!=") relational)?
        //   relational = shift (("<" | "<=" | ">=" | ">") shift)?
        //   shift = additive (("<<" | ">>" | ">>>") additive)*
        //   additive = multiplicative (("+" | "-") multiplicative)*
        //   multiplicative = unary (("*" | "/" | "%") unary)*
        //   unary = ("+" | "-")? term
        //   term = number | symbol | "(" expression ")"

        if (index === undefined) index = 0;

        function invalid_expression() {
            throw new sim_tool.SyntaxError('Invalid expression',
                                           tokens[0].start,
                                           tokens[tokens.length - 1].end);
        }

        // term = number | symbol | "(" expression ")"
        function read_term() {
            let token = tokens[index];
            if (token === undefined) invalid_expression();
            if (token.type == 'number' || token.type == 'symbol' || token.type == 'local_symbol') {
                index += 1;
                return token;
            } else if (token.token == '(') {
                let open_paren = token;
                // parenthesized expression
                index += 1;
                let result = read_expression_internal(tokens, index);
                token = tokens[index];
                if (token && token.token == ')') {
                    index += 1;
                    return result;
                }
                throw open_paren.asSyntaxError('Missing close parenthesis that matches this one');
            }
            throw token.asSyntaxError('Invalid expression');
        }

        // unary = ("+" | "-")? term
        function read_unary() {
            let sign = tokens[index];
            if (sign === undefined) invalid_expression();
            if (sign.token == '+' || sign.token == '-') index += 1;
            let result = read_term();
            if (sign.token == '-') result = [sign, result];
            return result;
        }

        // multiplicative = unary (("*" | "/" | "%") unary)*
        function read_multiplicative() {
            let result = read_unary();
            for (;;) {
                let operator = tokens[index];
                if (operator && (operator.token == '*' || operator.token == '/' || operator.token == '%')) {
                    index += 1;
                    result = [operator, result, read_unary()];
                } else break;
            }
            return result;
        }

        // additive = multiplicative (("+" | "-") multiplicative)*
        function read_additive() {
            let result = read_multiplicative();
            for (;;) {
                let operator = tokens[index];
                if (operator && (operator.token == '+' || operator.token == '-')) {
                    index += 1;
                    result = [operator, result, read_multiplicative()];
                } else break;
            }
            return result;
        }

        // MORE HERE...

        function read_expression_internal() {
            return read_additive();
        }

        let result = read_expression_internal();
        if (index != tokens.length)
            throw new sim_tool.SyntaxError('Extra tokens after expression ends',
                                       tokens[index].start, tokens[tokens.length - 1].end);
        return result;

    };

    // return value from expression tree
    sim_tool.eval_expression = function (tree, results) {
        if (tree.type == 'number') {
            return tree.token;
        } else if (tree.type == 'symbol' || tree.type == 'local_symbol') {
            let value = results.symbol_value(tree.token);
            if (value === undefined)
                throw tree.asSyntaxError('Undefined symbol');
            return value;
        } else if (tree.length == 2) {    // unary operator
            switch (tree[0].token) {
            case '-':
                return -sim_tool.eval_expression(tree[1], results);
            default:
                throw tree[0].asSyntaxError('Unrecongized unary operator');
            }
        } else {   // binary operator
            let left = sim_tool.eval_expression(tree[1], results);
            let right = sim_tool.eval_expression(tree[2], results);
            switch (tree[0].token) {
            case '+': return left + right;
            case '-': return left - right;
            case '*': return left * right;
            case '/': return left / right;
            case '%': return left % right;
            case '&': return left & right;
            case '^': return left ^ right;
            case '|': return left | right;
            default:
                throw tree[0].asSyntaxError('Unrecongized binary operator');
            }
        }
    }

    // returns list of tokens for each comma-separated operand in the current statement
    function read_operands(stream) {
        let operands = [];
        for (;;) {
            // read operand tokens until end of statement or ','
            let operand = undefined;
            for (;;) {
                // collect tokens for current operand
                let token = stream.next_token();

                // end of statement?
                if (token === undefined || token.token == ';') return operands;

                // more operands to come?
                if (token.token == ',') break;

                // create a new operand if needed
                if (operand === undefined) { operand = []; operands.push(operand); }
                operand.push(token);
            }
        }
    }

    // assemble contents of buffer
    // pass 1: define symbol values and count bytes
    // pass 2: eval expressions, assemble instructions, fill memory
    // buffer_dict is needed in case other buffers are .include'd
    function assemble_buffer(results, stream) {
        do {
            try {
                while (!stream.eol()) {
                    let key = stream.next_token();

                    // end of line?
                    if (key === undefined) break;
                    if (key.token == ';') continue;

                    if (key.type == 'label' || key.type == 'local_label') {
                        // define label
                        results.add_label(key);
                        continue;
                    } else if (key.type == 'symbol') {
                        // we'll need to know what comes after key token?
                        stream.eat_space_and_comments();

                        // symbol assignment?
                        if (stream.match('=')) {
                            /* let operands = */ read_operands(stream);
                            continue;
                        }

                        // directive?
                        if (key.token.charAt(0) == '.') {
                            let operands = read_operands(stream);

                            // ISA-specific directive?
                            if (results.isa.assemble_directive) {
                                if (results.isa.assemble_directive(results, key, operands))
                                    continue;
                            }

                            // built-in directive?
                            let handler = built_in_directives[key.token];
                            if (handler) {
                                if (handler(results, key, operands, stream)) continue;
                            }
                            throw key.asSyntaxError(`Unrecognized directive: ${key.token}`);
                        }

                        // macro invocation?

                        // opcode?
                        if (results.isa.assemble_opcode) {
                            // list of operands, each element is a list of tokens
                            let operands = read_operands(stream);
                            if (results.isa.assemble_opcode(results, key, operands))
                                continue;
                        }
                    }
                    
                    // if we get here, we didn't find a legit statement
                    throw key.asSyntaxError(`"${key.token}" not recognized as an opcode, directive, or macro name`, key.start, key.end);
                }
            } catch (e) {
                if (e instanceof sim_tool.SyntaxError) results.errors.push(e);
                else throw e;
            }
        } while (stream.next_line());
    }

    // assemble the contents of the specified buffer
    sim_tool.assemble = function (top_level_buffer_name, buffer_map, isa) {
        let stream = new sim_tool.TokenStream(isa);
        let results = new AssemblerResults(isa);
        results.buffer_map = buffer_map;   // for .include to find

        // pass 1: define symbol values and count bytes
        stream.push_buffer(top_level_buffer_name, buffer_map.get(top_level_buffer_name));
        assemble_buffer(results, stream);   // returns [content, errors]
        if (results.errors.length > 0) return results;

        // position sections consecutively in memory, adjust their base addresses appropriately
        results.next_pass();

        // pass 2: eval expressions, assemble instructions, fill memory
        stream.push_buffer(top_level_buffer_name, buffer_map.get(top_level_buffer_name));
        assemble_buffer(results, stream);

        return results;
    };

})();
