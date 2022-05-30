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

sim_tool.Emulator = (function () {
    class Emulator {
        constructor(memsize, littleEndian) {
            this.littleEndian = littleEndian;

            // build main memory of specified size
            this.main_memory = new DataView(new ArrayBuffer(memsize));
        }

        //////////////////////////////////////////////////
        // memory access (can throw RangeError)
        //////////////////////////////////////////////////

        // instruction fetch (for cache simulation)
        ifetch16(addr) {
            return this.memory.getUint16(addr, this.littleEndian);
        }
        ifetch32(addr) {
            return this.memory.getUint32(addr, this.littleEndian);
        }

        // load unsigned data
        ld8u(addr) {
            return this.memory.getUint8(addr, this.littleEndian);
        }
        ld16u(addr) {
            return this.memory.getUint16(addr, this.littleEndian);
        }
        ld32u(addr) {
            return this.memory.getUint32(addr, this.littleEndian);
        }
        ld64u(addr) {
            return this.memory.getBigUint64(addr, this.littleEndian);
        }

        // load signed data
        ld8(addr) {
            return this.memory.getInt8(addr, this.littleEndian);
        }
        ld16(addr) {
            return this.memory.getInt16(addr, this.littleEndian);
        }
        ld32(addr) {
            return this.memory.getInt32(addr, this.littleEndian);
        }
        ld64(addr) {
            return this.memory.getBigInt64(addr, this.littleEndian);
        }
        ldf32(addr) {
            return this.memory.getFloat32(addr, this.littleEndian);
        }
        ldf64(addr) {
            return this.memory.getFloat64(addr, this.littleEndian);
        }

        // store data
        st8(addr, v) {
            this.memory.setInt8(addr, v, this.littleEndian);
        }
        st16(addr, v) {
            this.memory.setInt16(addr, v, this.littleEndian);
        }
        st32(addr, v) {
            this.memory.setInt32(addr, v, this.littleEndian);
        }
        st64(addr, v) {
            this.memory.setBigInt64(addr, v, this.littleEndian);
        }
        stf32(addr, v) {
            this.memory.setFloat32(addr, v, this.littleEndian);
        }
        stf64(addr, v) {
            this.memory.setFloat64(addr, v, this.littleEndian);
        }
    };

    return Emulator;
})();
