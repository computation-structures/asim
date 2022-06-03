SIM_TOOL_CSS =  ../lib/codemirror.css \
  ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css \
  ../sim_tool/sim_tool.css
SIM_TOOL_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js \
  ../sim_tool/sim_tool.js ../sim_tool/streams.js

CPU_TOOL_CSS = cpu_tool.css
CPU_TOOL_JS = cpu_tool.js assembler.js riscv.js


all::

demo: cpu_tool.min.js cpu_tool.min.css
	cp cpu_tool.min.html ../demo/cpu_tool.html
	cp *.min.* ../demo/
	cp ../lib/*.woff2 ../lib/*.ttf ../demo/
	cp -r tests ../demo/

cpu_tool.min.js: $(SIM_TOOL_JS) $(CPU_TOOL_JS)
	terser $(SIM_TOOL_JS) $(CPU_TOOL_JS) -o cpu_tool.min.js -c -m --keep-classnames

cpu_tool.min.css: $(SIM_TOOL_CSS) $(CPU_TOOL_CSS)
	cleancss -o cpu_tool.min.css $(SIM_TOOL_CSS) $(CPU_TOOL_CSS)

lint::
	eslint $(CPU_TOOL_JS)

push::
	cd ..; make push
