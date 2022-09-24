LIB_CSS =  ../lib/codemirror.css
LIB_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js 

RISCV_CSS = sim_tool.css cpu_tool.css
RISCV_JS = sim_tool.js cpu_tool.js rvsim.js

ASIM_CSS = sim_tool.css cpu_tool.css
ASIM_JS = sim_tool.js cpu_tool.js asim.js

all::

demo: rvsim.min.js rvsim.min.css asim.min.js asim.min.css
	cp *.min.* ../demo/
	cp -r ../tests ../demo/

rvsim.min.js: $(LIB_JS) $(RISCV_JS)
	terser $(LIB_JS) $(RISCV_JS) -o rvsim.min.js -c -m --keep-classnames

rvsim.min.css: $(LIB_CSS) $(RISCV_CSS)
	cleancss -o rvsim.min.css $(LIB_CSS) $(RISCV_CSS)

asim.min.js: $(LIB_JS) $(ASIM_JS)
	terser $(LIB_JS) $(ASIM_JS) -o asim.min.js -c -m --keep-classnames

asim.min.css: $(LIB_CSS) $(ASIM_CSS)
	cleancss -o asim.min.css $(LIB_CSS) $(ASIM_CSS)

lint::
	eslint $(RISCV_JS)

push::
	git commit -am "update"
	git push
