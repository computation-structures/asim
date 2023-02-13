        // An echo loop program that illustrates console I/O via MRS/MSR instructions
        // that access the console system register.

        .text

        // copy message to console
        mov x0,#welcome    // load pointer to welcome string
1:      ldrb w1,[x0],#1    // load next character from string, increment pointer
        cmp w1,#0
        b.eq 1f          // done when NUL character is reached
        msr console,x1     // output character to console
        b 1b
1:

echo_loop:
        mrs x0,console     // read next character from console
        cmp x0,#0
        b.eq echo_loop   // busy wait if no character present
        msr console,x0     // echo character to the console
        b echo_loop

        .data
welcome: .asciz "Echo loop: Please click on this console pane to select it for input, then start typing a message.  I'll echo each character to the console as you type it.\n\n"
