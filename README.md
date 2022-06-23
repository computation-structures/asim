# sim_tools

This collection of Javascript classes provides a framework for browser-based simulation
tools.  The available classes are

**SimTool** is the base class, which builds a two-pane GUI inside of the specified HTML
div.  There's a draggable center divider that lets the user adjust how the view is divided
between the right and left panes.  `SimTool` fills the right pane with a collection of CodeMirror
editors, with a drop-down selector that lets the user select which editor is accessible.
The contents of the left pane is determined by a subclass.

**CPUTool** is a subclass of `SimTool` that provides an GNU-AS-compatible assembler that
can convert an assembly language program into the binary representation for a specified instruction-set
archicture (ISA).  The assembler supports the standard set of assembly directives including macro definition
and expansion, labels, storage allocation and initialization, .text/.data/.bss sections, etc.  Support
for a particular ISA is provided by a subclass.  `CPUTool` creates a state display in the right pane,
which includes the current register values, a disassembly of the binary into RISC-V assembly, a view
of main memory contents, and a view of main memory around the current value of the stack pointer.

**RISCVTool** is a subcalss of `CPUTool` that knows how assemble and emulate
[RISC-V opcodes](https://riscv.org/wp-content/uploads/2017/05/riscv-spec-v2.2.pdf).

To run a demo:

* clone this repo and make the top level of the repo your current working directory.

* `make server` to start a local server

* Browse to `http://localhost:8000/riscv_tool_test.html`.

* Click `Assemble` in the left pane, which will automatically split page between the left and right
panes.  Then, in the right pane, click

        - `Reset` to reset the emulation to its initial state
        - `Step` to execute a single instruction, then update the state display in the right pane
        - `Walk` to execute many steps in succession
        - `Run` like `Walk` but don't update state display after each instruction.  This is *much* faster;
          I've been seeing execution rates of 70+ MIPS on my relatively new laptop.

