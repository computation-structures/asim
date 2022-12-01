# ASim

ASim is browser-based tool for assembling and simulating Arm A64 assembly
language programs.  ASim implements a useful subset of the A64 opcodes; see
OPCODES.md for list of supported opcodes and operands.

To run a demo:

* clone this repo and make the top level of the repo your current working directory.

* `make server` to start a local server (requires python3)

* Browse to `http://localhost:8000/asim.html`.

* Click `Assemble` in the left pane, which will automatically split page between the left and right
panes.  Then, in the right pane, click

  - `Reset` to reset the emulation to its initial state
  - `Step` to execute a single instruction, then update the state display in the right pane
  - `Walk` to execute many steps in succession
  - `Run` like `Walk` but don't update state display after each instruction.  This is *much* faster;
     I've been seeing execution rates of 10+ MIPS on my relatively new iMac.

