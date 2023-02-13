/*
This is a sample Arm A64 assembly program that implements "strlen",
a subroutine that computes the length of an ASCIZ string pointed to
by x0.  There's a separate test-jig program (test_strlen.s) that calls
strlen with a test string of length 10.

To run:

* click "Assemble" button.  This will open the simulation pane, which
  has execution controls at the top and several subpanes showing the state
  of the simulated processor.  You can click and drag the vertical divider
  between the editor and simulation panes to adjust the layout.

* click "Step" to execute the next (highlighted) instruction in the
  program.  The state displays are updated to reflect any changes made
  by the executed instruction.  Reads and writes are indicated by
  highlighting the appropriate register and/or memory location.

* click "Walk" to execute many steps sequential, with a state update
  after each step.  You can click "Stop" to stop a running simulation.
  The simulation will also halt when it reaches a HLT or BRK instruction,
  or when the simulator detects that the PC hasn't changed after executing
  an instruction (i.e., an instruction like "b ." that branches to itself).

* click "Run" to execute the program without state updates.  This is
  must faster, with simulation rates of 10 MIPS or more!
*/

        .include "test_strlen.s" // include test-jig source file

        .text
        .global strlen
strlen:                         // pointer to string in x0
        add x9,x0,#1            // remember starting value of pointer + 1
1:      ldrb w10,[x0],#1        // load unsigned byte from string, increment pointer
        cmp w10,#0
        b.ne 1b                 // if it's not zero, keep looking!
        sub x0,x0,x9            // compute how much pointer changed

        // busy loop to test simulator's instructions/second
        mov x12,#0x800000
1:      subs x12,x12,#1
        b.ne 1b

        ret                     // return to caller
