SIM_TOOL_CSS =  ../lib/codemirror.css \
  ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css \
  ../sim_tool/sim_tool.css
SIM_TOOL_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js \
  ../sim_tool/sim_tool.js ../sim_tool/streams.js

CPU_TOOL_CSS = cpu_tool.css
CPU_TOOL_JS = cpu_tool.js assembler.js riscv.js


all:
	terser $(SIM_TOOL_JS) $(CPU_TOOL_JS) -o cpu_tool.min.js -c -m --keep-classnames
	cleancss -o cpu_tool.min.css $(SIM_TOOL_CSS) $(CPU_TOOL_JS)

lint::
	eslint $(CPU_TOOL_JS)

push::
	cd ..; make push
