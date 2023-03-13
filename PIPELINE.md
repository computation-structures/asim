## 5-stage Pipeline Emulation

The `educore-pipelined` variant of ASim includes a datapath diagram
for a classic 5-stage pipelined mircoarchitecture (see figure at the
bottom of this page).  After each step of the emulation, the diagram
is annotated with the register and signal values from each pipeline
stage.

The datapath diagram includes the following types of components:

| Component | Description |
| --- | --- |
| <img width="150px" src="/docs/register.png"> | *Register.*  Registers store a single value. The current value stored in the register is shown on its output signal ("0x20" in this example).  All registers are loaded in parallel at the beginning of each emulation step with the value shown on their input signals ("0x24" in this example). The newly-loaded value is then propagated through the pipeline stage. |
| <img width="150px" src="/docs/memory.png"> | *Memory.*  Memories store multiple values and an address is used to select which value is read or written.  Memory writes, if enabled, occur at the beginning of each emulation step. Memory reads, if enabled, occur whenever the read address changes. |
| <img width="150px" src="/docs/mux.png"> | *Multiplexor.*  A multiplexor selects one of its input values to be its output value.  The labels above the multiplexor list the signals available as inputs.  The label in the body of the multiplexor indicates which input is being selected ("alu" in this example).  The value of the selected input is displayed on the multiplexor's output signal ("0x0123456789abcdef" in this example). |
| <img width="150px" src="/docs/logic.png"> | *Logic block.*  A combinational logic block computes its output values based on the values of its inputs.  Labels in the body of a block indicate the computation being performed.  In this example, the Barrel Shifter block is performing a 32-bit rotate-right operation on the 128-bit value formed by concatenting the `EX_n` value with the `EX_m` value. |

<br>Screenshot of pipeline diagram:

<img src="/docs/pipeline.png">
