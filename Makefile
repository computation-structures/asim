all:
	make cpu_tool.js
	make cpu_tool.css
	open cpu_tool.html

cpu_tool.js::
	cat lib/codemirror.js > cpu_tool.js
	cat lib/emacs.js >> cpu_tool.js
	cat lib/vim.js >> cpu_tool.js
	cat lib/sublime.js >> cpu_tool.js
	cat src/gui.js  >> cpu_tool.js
	cat src/assembler.js  >> cpu_tool.js
	cat src/riscv.js  >> cpu_tool.js

cpu_tool.css::
	cat src/gui.css > cpu_tool.css
	cat lib/fontawesome.css >> cpu_tool.css
	cat lib/solid.css >> cpu_tool.css
	cat lib/regular.css >> cpu_tool.css
	cat lib/codemirror.css >> cpu_tool.css

