# ASim

ASim is browser-based tool for assembling and simulating Arm A64
assembly language programs.  ASim implements a useful subset of the
A64 opcodes and supports character I/O via a virtual console.

* See [`DEMO.md`](DEMO.md) for a demo of the tool and brief description of its user interface.
* See <a href="https://github.com/computation-structures/asim/blob/main/OPCODES.md" target="_blank">`OPCODES.md`</a> for list of supported opcodes and operands.
* See <a href="https://github.com/computation-structures/asim/blob/main/DEMO.md" target="_blank">`EDX.md`</a> for how to use ASim in an edX problem.

To add an instance of ASim to a webpage, copy `asim.min.js` and `asim.min.css` to your
webserver, then add the following links to the ASim code and style sheet:

```
<link rel="stylesheet" href="asim.min.css"/>
<script src="asim.min.js"></script>
```

After your webpage has loaded, ASim will convert any
`<div class="asim"></div>` on the page into an ASim instance.  If you
would like to pre-load assembly-language programs into one or more
edit buffers, you can add configuation info to the body of the `<div>`
using JSON syntax.  For example the following HTML asks ASim to load
two files, `strlen.s` and `test_strlen.s`, from the `tests` directory on
same server that was used to load `asim.min.js`.  In this example, the
test-jig file was marked as read-only so it won't be accidentally modifed
by the user.

```
<div class="asim">{
  "buffers": [
     { "name": "strlen.s", "url":"tests/strlen.s" },
     { "name": "test_strlen.s", "url":"tests/test_strlen.s", "readonly": true }
  ]
}</div>
```

Note that the Javascript JSON implementation is very picky about the
syntax.  In particular, it doesn't permit any extra commas after the
last element of an object or array (unlike Python and Javascript itself).

