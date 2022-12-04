# ASim Demo

To run a demo, click [here](https://people.csail.mit.edu/cjt/asim/asim.html)
or follow the instructions below to run everything locally
on your machine.

* clone this repo and make the top level of the repo your current
  working directory.

* `make server` to start a local server (requires python3)

* Browse to `http://localhost:8000/asim.html`.  This loads a webpage
that makes an instance of the ASim tool then loads an example assembly
language program.

<hr>

Once your browser is displaying the ASim tool, you can click
`Assemble`.  This will open the simulation pane to the right of the
editor pane.  The simulation pane has execution controls at the top
and several subpanes showing the state of the simulated processor.
You can click and drag the vertical divider between the editor and
simulation panes to adjust the layout.

Here are the simulation controls:

* `Reset`: reset the simulation to its initial state

* `Step`: execute the next (highlighted) instruction.  The state
  displays are updated to reflect any changes made by the executed
  instruction.  Reads and writes are indicated by highlighting the
  appropriate register and/or memory location.

* `Walk`: execute many steps sequentially, with a state update after
  each step.  Once started, the button changes to "Stop", which you
  can click to stop the simulation.  The simulation will also halt
  when it reaches a HLT or BRK instruction, or when the simulator
  detects that the PC hasn't changed after executing an instruction
  (i.e., an instruction like "b ." that branches to itself).

* `Run`: like `Walk` but don't update state display after each
  instruction.  Once started, the button changes to "Stop", which you
  can click to stop the simulation.  This is *much* faster with
  simulation rates of 10 MIPS or more on my relatively new iMac.

![ASim tool](https://github.com/computation-structures/asim/blob/main/docs/asim.png?raw=true)