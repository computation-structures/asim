        .text

        // copy message to console
        mov x0,#welcome
1:      ldrb x1,[x0],#1
        cbz x1,1f
        msr console,x1
        b 1b
1:

echo_loop:
        mrs x0,console
        cbz x0,echo_loop
        msr console,x0
        b echo_loop

        .data
welcome: .asciz "Echo loop: Please click on this console pane to select it for input, then start typing a message.  I'll echo each character to the console as you type it.\n\n"
