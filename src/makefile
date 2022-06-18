LIB_CSS =  ../lib/codemirror.css ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css
LIB_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js 

RISCV_CSS = sim_tool.css cpu_tool.css
RISCV_JS = sim_tool.js cpu_tool.js riscv_tool.js

all::

demo: riscv_tool.min.js riscv_tool.min.css
	cp riscv_tool.min.html ../demo/riscv_tool.html
	cp *.min.* ../demo/
	cp ../lib/*.woff2 ../lib/*.ttf ../demo/
	cp -r ../tests ../demo/

riscv_tool.min.js: $(LIB_JS) $(RISCV_JS)
	terser $(LIB_JS) $(RISCV_JS) -o riscv_tool.min.js -c -m --keep-classnames

riscv_tool.min.css: $(LIB_CSS) $(RISCV_CSS)
	cleancss -o riscv_tool.min.css $(LIB_CSS) $(RISCV_CSS)

lint::
	eslint $(RISCV_JS)

push::
	git commit -am "update"
	git push
