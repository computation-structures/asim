all::
	cd ..; make

lint::
	eslint *.js

push::
	cd ..; make push

SIM_TOOL_CSS =  ../lib/codemirror.css ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css ../common/sim_tool.css
SIM_TOOL_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js ../sim_tool/sim_tool.js ../sim_tool/streams.js

CSS = ${SIM_TOOL_CSS} cpu_tool.css
JS = ${SIM_TOOL_JS} cpu_tool.js assembler.js emulator.js riscv.js

edx::
	cp edx_cpu_tool.html ../edx/cpu_tool.html
	terser $(JS) -o ../edx/cpu_tool.min.js -c -m --keep-classnames
	cleancss -o ../edx/cpu_tool.min.css $(CSS)


