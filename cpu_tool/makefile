SIM_TOOL_CSS =  ../lib/codemirror.css ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css ../sim_tool/sim_tool.css
SIM_TOOL_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js ../sim_tool/sim_tool.js ../sim_tool/streams.js

CSS = ${SIM_TOOL_CSS} cpu_tool.css
JS = ${SIM_TOOL_JS} cpu_tool.js assembler.js riscv.js

all:
	terser $(JS) -o cpu_tool.min.js -c -m --keep-classnames
	cleancss -o cpu_tool.min.css $(CSS)

lint::
	eslint *.js

push::
	cd ..; make push
