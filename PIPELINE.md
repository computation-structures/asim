## 5-stage Pipeline Emulation

The `educore-pipelined` variant of ASim includes a datapath diagram
for a classic 5-stage pipelined mircoarchitecture (see figure at the
bottom of this page).  After each step of the emulation, the diagram
is annotated with the register and signal values from each pipeline
stage.

The datapath diagram includes the following types of components:

| Component | Description |
| --- | --- |
| <img width="150px" src="/docs/register.png"> | *Register.*  Registers store a single value. The current value stored in the register is shown next the output signal ("0x20" in this example).  The register value is loaded at the beginning of each emulation step with the value shown on the input signal ("0x24" in this example).  The newly-loadvalue is then propagated through the pipeline stage. |
| <img width="150px" src="/docs/Memory.png"> | *Memory.*  Memories store multiple values and an address is used to select which value is read or written.  Memory writes, if enable, occur at the beginning of each emulation step. |

<br>Screenshot of pipeline diagram:

<img src="/docs/pipeline.png">
