## ASim Assembly Language Syntax

#### Constants

#### Expressions

## Built-in loader

## Macros

## Directives

* `.align <n>`<br>
If necessary, add bytes to the current section until the least-significant
`<n>` bits of the section's location counter are 0.  This is equivalent to
`.balign <2**n>`.

* `.ascii "<string>"...`<br>
`.asciz "<string>"...`<br>
expects 0 or more string literals separated by commas, where each
string literal is enclosed in double quotes ("). Each ASCII character
of the string is assembled into consecutive locations in the current
section.  `.asciz` adds an additional zero byte after the last
character.

* `.balign <n>`<br>
`<n>` must be a power of two.  If necessary, add bytes to the current
section until the section's location counter is an exact multiple of
`<n>`.

* `.bss`<br>
Subsequent assembly output will be placed in the bss (block static
storage) section memory.  See the "Built-in loader" section for
details about how the assembler organizes memory.  Typically, the
bss section contains the uninitialized storage for the program.

* `.byte <expression>...`<br>
expects zero or more expressions, separated by commas.  The value of
each expression is assembled into the next 8-bit byte of the current section.

* `.cache`<br>
more here...

* `.data`<br>
Subsequent assembly output will be placed in the data
section of memory.  See the "Built-in loader" section for
details about how the assembler organizes memory.  Typically,
the data section contains the initialized storage for the
program.

* `.endm`<br>
more here...

* `.global`<br>
more here...

* `.hword <expression>...`<br>
expects zero or more expressions, separated by commas.  The value of
each expression is assembled into the next 16-bit halfword (2 bytes)
of the current section.  There is an implicit `.align 1` before each
`.hword` directive.

* `.include "<buffer_name>"`<br>
Expects a single string, which is the name of another editor buffer.
Stop assembling from the current buffer and switch to assembling from
the named buffer.  When the end of that buffer is reached, resume
assembling from the next line of the current buffer.

* `.long <expression>...`<br>
expects zero or more expressions, separated by commas.  The value of
each expression is assembled into the next 64-bit word (8 bytes)
of the current section.  There is an implicit `.align 3` before each
`.long` directive.

* `.macro`<br>
more here...

* `.p2align`<br>
If necessary, add bytes to the current section until the least-significant
`<n>` bits of the section's location counter are 0.  This is equivalent to
`.balign <2**n>`.  This directive is an alias for `.align`.

* `.quad <expression>...`<br>
expects zero or more expressions, separated by commas.  The value of
each expression is assembled into the next 64-bit word (8 bytes)
of the current section.  There is an implicit `.align 3` before each
`.quad` directive.  This directive is an alias for `.long`.

* `.section <section> [, <address_space>]`<br>
`<section>` should be one of `.text`, `.data`, `.bss`.  Subsequent
assembly output will be placed in the specified section of memory.
`<address_space>` is an optional second argument specifying the
name of an address space.  If not specified, it defaults to the
current address space.  At the start of assembly, the current
address space is `"kernel"`.  See the "Built-in loader" section for
details about how the assembler organizes memory.

* `.text`<br>
Subsequent assembly output will be placed in the text
section of memory.  See the "Built-in loader" section for
details about how the assembler organizes memory.  Typically,
the text section contains the assembled instructions for the
program.

* `.word <expression>...`<br>
expects zero or more expressions, separated by commas.  The value of
each expression is assembled into the next 32-bit word (4 bytes)
of the current section.  There is an implicit `.align 2` before each
`.word` directive.

