## Creating ASim problems in edX

ASim can be integrated into edX using the *Custom Javascript Display and Grading*
problem type.  First, you need to upload ASim itself into the directory of files
associated with your edX course:

* in edX Studio, click on the `Content` dropdown at the top of the page,
then select `Files & Uploads`.

* upload the following files, which you'll find at the top level this
repo:

  * `asim.min.js`
  * `asim.min.css`
  * `asim_edx.html`
  * `educore_edx.html`
  * `educore_pipelined_edx.html`

Here are the steps to create an edX student exercise that uses ASim:

* In your course outline, locate/create the subsection where the
exercise will be located.

* Click on `New Unit`, then, in the `Add New Component` menu, click
on `Problem`.

* Select the `Advanced` tab, then click on "Custom JavaScript Display
and Grading" problem type.  This will provide a template that's initially
filled in with an example problem.  Here's the
<a href="https://edx.readthedocs.io/projects/open-edx-building-and-running-a-course/en/open-release-eucalyptus.master/exercises_tools/custom_javascript.html">documentation</a> for
the Custom JavaScript Problem type.

* In the unit section of your course outline, click on `Edit`, select
and delete the current contents of the editor buffer.  Replace with the following:

```
<problem>

  <script type="loncapa/python">
import json
def verify_checksum(expect, ans): return json.loads(ans)["response"]==expect
  </script>

  <p> This text is displayed before the ASim instance. </p>

  <customresponse cfn="verify_checksum" expect="<checksum>">
    <jsinput title="ASim"
             gradefn="gradefn"
             height="600"
             width="100%"
             get_statefn="getstate"
             set_statefn="setstate"
             initial_state='{"buffers":[<bufferspecs>]}'
             html_file="/static/asim_edx.html"/>
  </customresponse>

</problem>
```

* If you want to restrict programs to the Educore subset of the ARM instruction
set, change the `html_file` parameter to `"/static/educore_edx.html"`.  And if
you want the Educore pipelined emulation, change the parameter to
`"/static/educore_pipelined_edx.html"`.

* Modify the template, replacing `<bufferspecs>` with a
comma-separated list of <a href="https://www.json.org/json-en.html">JSON</a>
objects that specify which files you'd like to have pre-loaded into
the ASim editor buffers.  For example, to load a file called `test.s`,
you would specify `{"name":"test.s","url":"test.s"}`.  Note that JSON
is very particular about the syntax; in particular, when creating an
object, you cannot have an extra comma following the final name/value
pair as would be allowed in Python or Javascript.

* You will need to upload the referenced files to your course's
file directory using the `Files & Upload` page described above.

* You can mark a pre-loaded buffer as read-only by including `"readonly":true`
as one of the name/value pairs in the buffer spec.  This is useful
for instructor-supplied code such as test jigs.

* Edit the paragraph "This text is displayed..." to describe what you'd
like the student to do.  Note that edX is very particular about the
HTML syntax: it must follow the XHTML standard where every tag
has a matching closing tag.

* To support grading of your ASim problem, you'll need to replace
`<checksum>` with the appropriate string.  Please see the "Grading"
section below.

* While you're in the editor window, you can click on `Settings`
at top of the editor window and make the appropriate entries
for the problem's attributes, e.g., the display name.  If you would
like students to see a `Save` button, you should set the maximum
attempts property to a non-zero value.

* When you've completed your edits, click `Save` at the bottom of
the editor window.  If all is well, you should see a preview of your
new problem.

## Grading

ASim provides a way to check the contents of particular memory
locations after the student's program has finished running.  If the
contents of those locations match the specified values, ASim computes
a checksum of those values.  When the student clicks `Submit`, any edits
made by the student to their program are sent to the edX server, along
with the computed checksum.  The edX server saves student's program
and compares the student's checksum to the expected checksum.  If
the checksums match, the problem is marked correct.

To add checking to an exercise:

* modify your test code to save the results from the various test
cases into known memory locations.

* add `.mverify` directives after your test code.  These directives
have the form `.mverify addr, expect0, expect1, ...` where `addr` is
the (starting) address of one or more consecutive 32-bit memory words
whose contents should be verified.  `expect0` is the expected contents
of the first 32-bit word, `expect1` is the expected contents of the
second 32-bit word, and so on.  Your test code can include as many
`.mverify` directives as needed.

* the test code should use a `HLT` instruction to terminate
execution.  When executed, this instruction requests ASim to verify
the contents of the locations specified by `.mverify` directives.
ASim will report any discrepencies to the student.  If all the
locations contain the expected values, ASim computes and reports
the verification checksum.

* in edX Studio, modify the `customresponse` tag for the problem
to include the expected checksum, e.g.,

    `<customresponse cfn="verify_checksum" expect="4EF93F78">`

Here's some example test code that calls a `strlen` routine written by
the student, passing the address of a test string in X0.  When the
student's code returns an answer in X0, it's stored at
`answer:` and execution is halted.

```
// test_strlen.s: testing code for strlen.s

        .text
        .global strlen   // student provides this code...

        mov x0,#string  // pointer to test string
        bl strlen       // call strlen subroutine, answer in x0
        mov x1,#answer  // save result for later verification
        str w0,[x1]     // 32-bit store...
        hlt             // simulator will halt here

        .mverify answer,10   // expected answer is 10

        .data
answer: .word 0
string: .asciz "Hi there!\n"
```

When this test code is run using a correct implementation of `strlen`,
ASim displays the following status message when execution is
complete:

`Memory verification successful! (checksum 4EF93F78)`

This verifies that the memory location labeled `answer:` had the
expected value (10) when execution was halted.  Problem authors can run
their test code using a correct implementation to get the expected
checksum.

A typical graded ASim exercise includes

* a template file for the student to edit, usually involving a
procedure that returns a value or modifies a data structure, and

* a test-jig file that calls the student procedure one
or more times, saving the return value(s) for later verification.

For example, the `strlen.s` template might look like

```
.include "test_strlen.s"  // include testing code *** MUST BE THE FIRST LINE ***

// Please implement the strlen subroutine, which computes the length
// of an ASCII string whose address is passed in X0.  The length should
// be returned in X0.

strlen:
        // your code here, leaving answer in X0

        RET
```

To load both the template file and the test-jig file, use Studio
to modify the `initial-state` attribute of the `jsinput` tag to:

     initial_state='{"buffers":[{"name":"strlen.s","url":"strlen.s"},{"name":"test_strlen.s","url":"test_strlen.s","readonly":true}]}'

Note that the test-jig file has been marked as read-only so that it
cannot be modified by the student.  In this example, both `strlen.s`
and `test_strlen.s` should be uploaded in Studio as part of the
course files.
