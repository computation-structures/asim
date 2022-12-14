## ASim Assembly Language Syntax

## Macros

## Directives

* `.align <n>`<br>
If necessary, add bytes to the current section until the least-significant
`<n>` bits section's location counter are 0.  This is equivalent to
`.balign <2**n>`.

* `.ascii "<string>"...`<br>
`.asciz "<string>"..."`<br>
expects 0 or more string literals separated by commas, where each
string is enclosed in double quotes (").  It assembles each ASCII
character of the string into consecutive locations in the current
section.  `.asciz` adds an additional zero byte after the last
character.

* `.balign <n>`<br>
`<n>` must be a power of two.  If necessary, add bytes to the current
section until the section's location counter is an exact multiple of
`<n>`.

* `.bss`<br>
more here...

* `.byte`<br>
more here...

* `.cache`<br>
more here...

* `.data`<br>
more here...

* `.endm`<br>
more here...

* `.global`<br>
more here...

* `.hword`<br>
more here...

* `.include`<br>
more here...

* `.long`<br>
more here...

* `.macro`<br>
more here...

* `.p2align`<br>
more here...

* `.quad`<br>
more here...

* `.section`<br>
more here...

* `.text`<br>
more here...

* `.word`<br>
more here...

