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
    // current assembler version
    sim_tool.assembler_version = '0.1';

    //////////////////////////////////////////////////
    // Built-in directives
    //////////////////////////////////////////////////

    let built_in_directives = {
        ".global": function () { return true; },
        ".section": function () { return true; },
    };

    //////////////////////////////////////////////////
    // AssemblerResults
    //////////////////////////////////////////////////

    // holds the results of assembling a program
    class AssemblerResults {
        constructor(isa) {
            this.isa = isa;    // info about target ISA

            this.errors = [];
            this.address_spaces = {};
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

        //////////////////////////////////////////////////
        // set up for an assembler pass
        //////////////////////////////////////////////////

        // do per-pass initialization
        next_pass() {
            this.pass += 1;
            if (this.pass > 2) return;

            if (this.pass == 1) {
            }

            if (this.pass == 2) {
                // layout sections in virtual & physical memory at start of second pass
                let memsize = 0;
                for (let aname in this.address_spaces) {
                    let aspace = this.address_spaces[aname];

                    // layout of sections in an address space is text, data, bss

                    // set end of .text so that data is aligned correctly
                    let text = aspace.sections['.text'];
                    text.base = 0;
                    text.dot = this.align(text.dot, this.isa.data_section_alignment || 8);

                    // set end of .data so that bss is aligned correctly
                    let data = aspace.sections['.data'];
                    data.base = text.dot;   // virtual address
                    data.dot = this.align(data.dot, this.isa.bss_section_alignment || 8);

                    // set end of .bss so that next address space is aligned correctly
                    let bss = aspace.sections['.bss'];
                    bss.base = data.base + data.dot;   // virtual address
                    bss.dot = this.align(bss.dot, this.isa.address_space_alignment || 8);

                    // remember where in physical memory this address space starts
                    aspace.base = memsize;
                    aspace.size = bss.base + bss.dot;   // remember size of this address space

                    // create some symbols in kernel symbol table so program
                    // can access base and bounds of this address space
                    this.add_symbol(`_${aname}_base_`, aspace.base, 'kernel');
                    this.add_symbol(`_${aname}_bounds_`, aspace.size, 'kernel');

                    memsize += aspace.size;  // allocate space in physical memory
                }

                // create physical memory!
                this.memory = new DataView(new ArrayBuffer(memsize));
            }

            for (let aname in this.address_spaces) {
                let aspace = this.address_spaces[aname];

                // we'll want to generate the same index for each local label on each pass
                // so reinitialize table of last-used index for each local label
                aspace.local_label_index = {};   // N => last index used

                // reset dot to 0 in all sections (only meaningful after first pass)
                if (this.pass > 1) {
                    for (let sname in aspace.sections) {
                        let section = aspace.sections[sname];
                        section.dot = 0;
                    }
                }
            }

            // start assembling into .text by default
            this.change_section('.text', 'kernel');
        }

        // add value to memory at dot, advance dot
        emit32(v) {
            // remember to use physical address!
            if (this.memory) this.memory.setUint32(this.dot(true), v, this.isa.little_endian);
            this.incr_dot(4);
        };

        // return hex string of what's in word at byte_offset
        location(byte_offset) {
            if (this.memory) {
                let v = this.memory.getUint32(byte_offset, this.isa.little_endian);
                return ('00000000' + v.toString(16)).slice(0,16);
            }
            return undefined;
        }

        //////////////////////////////////////////////////
        // sections: .text, .data, .bss
        //////////////////////////////////////////////////

        add_aspace(aname) {
            let aspace = this.address_spaces[aname];
            if (aspace === undefined) {
                aspace = {};
                aspace.name = aname;
                aspace.sections = {
                    ".text": {aspace: aspace, name: ".text", dot: 0, base: 0},
                    ".data": {aspace: aspace, name: ".data", dot: 0, base: 0},
                    ".bss": {aspace: aspace, name: ".bss", dot: 0, base: 0},
                };
                aspace.symbol_table = {};
                aspace.local_label_index = {};
                aspace.base = 0;   // physical address of address space
                aspace.size = 0;   // length of address space in bytes

                this.address_spaces[aname] = aspace;
            }
            return aspace;
        }

        // change which section we're assembling into, return section
        // return undefined if section not found
        change_section(sname, aname) {
            if (aname) this.current_aspace = this.add_aspace(aname);
            this.current_section = this.current_aspace.sections[sname];
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
            let aspace = aname ? this.address_spaces[aname] : this.current_aspace;
            if (aspace === undefined) return false;

            let section = sname ? aspace.sections[sname] : this.current_section;
            if (section === undefined) return false;

            let name = label_token.token;

            if (label_token.type == 'local_label') {
                // compute this label's (new) index
                let index = (aspace.local_label_index[name] || 0) + 1;
                aspace.local_label_index[name] = index;   // update record of last index used

                // synthesize unique label name for the local label
                // include "*" so label name is one that user can't define
                name = 'L' + name + '*' + index.toString();
            } else if (this.pass == 1) {
                let previous = aspace.symbol_table[name];
                if (previous !== undefined) {
                    // oops, label already defined!
                    throw label_token.asSyntaxError(`Duplicate label definition for "${name}", originally defined at ${previous.definition.url(undefined,'sim_tool.show_error')}`);
                }
            }
            aspace.symbol_table[name] = {
                type: 'label',
                definition: label_token,   // remember where it was defined
                name: name,
                section: section,    // so we can update value with section.base
                value: section.dot,
            };

            return true;
        }

        // add a symbol to the symbol table (redefinition okay)
        add_symbol(name, value, aname) {
            let aspace = aname ? this.address_spaces[aname] : this.current_aspace;
            if (aspace === undefined) return false;

            let symbol = aspace.symbol_table[name];
            if (symbol === undefined) {
                symbol = {
                    type: 'symbol',
                    name: name,
                    section: undefined,    // assigned symbols don't need relocation
                };
                aspace.symbol_table[name] = symbol;
            }
            symbol.definition = symbol,   // track most recent definition
            symbol.value = value;          // update value
            return true;
        }

        // look up value of symbol or local symbol
        symbol_value(name, physical_address, aname) {
            let aspace = aname ? this.address_spaces[aname] : this.current_aspace;
            if (aspace === undefined) return false;

            if (name === '.') return this.dot(physical_address);
            let lookup_name = name;

            if (/d[fn]/.test(name)) {
                let direction = name.charAt(name.length - 1);
                name = name.slice(0, -1);  // remove direction suffix

                // get the current value of the appropriate local label index
                let index = aspace.local_label_index[name] || 0;
                if (direction == 'f') index += 1;  //referencing next definition

                // we can predict the unique symbol name associated with both the
                // previous and next local label with the given name
                lookup_name = 'L' + name + '*' + index.toString();
            }

            // find it in symbol table
            let symbol = aspace.symbol_table[lookup_name];
            if (symbol === undefined) return undefined;

            let value = symbol.value;

            // relocate label values
            if (symbol.type == 'label') {
                value += symbol.section.base;   // virtual address
                if (physical_address) value += symbol.section.aspace.base;
            }

            return value;
        }
    }

    //////////////////////////////////////////////////
    // Assembler
    //////////////////////////////////////////////////

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
        return undefined;   // shouldn't get here, but keep lint happy
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
                                if (handler(results, key, operands)) continue;
                            }
                            throw key.asSyntaxError(`"${key.token}" not recognized as a directive`);
                        }

                        // macro invocation?

                        // opcode?
                        if (results.isa.assemble_opcode) {
                            // list of operands, each element is a list of tokens
                            let operands = read_operands(stream);
                            results.isa.assemble_opcode(results, key, operands);
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
    sim_tool.assemble = function (top_level_buffer_name, buffer_dict, isa) {
        let stream = new sim_tool.TokenStream(isa);
        let results = new AssemblerResults(isa);
        results.buffer_dict = buffer_dict;   // for .include to find

        // pass 1: define symbol values and count bytes
        stream.push_buffer(top_level_buffer_name, buffer_dict[top_level_buffer_name]);
        assemble_buffer(results, stream);   // returns [content, errors]
        if (results.errors.length > 0) return results;

        // position sections consecutively in memory, adjust their base addresses appropriately
        results.next_pass();

        // pass 2: eval expressions, assemble instructions, fill memory
        stream.push_buffer(top_level_buffer_name, buffer_dict[top_level_buffer_name]);
        assemble_buffer(results, stream);

        return results;
    };

})();
