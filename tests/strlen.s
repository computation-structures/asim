.include "test_strlen.s"    // include testing code *** MUST BE THE FIRST LINE ***

// Please implement the strlen subroutine, which computes the length
// of an ASCII string whose address is passed in X0.  The length should
// be returned in X0.

        .text
        .global strlen
strlen:
        // your code here, leaving answer in X0

        RET
