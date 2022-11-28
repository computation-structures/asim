LIB_CSS =  lib/codemirror.css
LIB_JS = lib/codemirror.js lib/emacs.js lib/sublime.js lib/vim.js 

ASIM_CSS = sim_tool.css cpu_tool.css
ASIM_JS = sim_tool.js cpu_tool.js asim.js

all::

deploy: asim.min.js asim.min.css

asim.min.js: $(LIB_JS) $(ASIM_JS)
	terser $(LIB_JS) $(ASIM_JS) -o asim.min.js -c -m --keep-classnames

asim.min.css: $(LIB_CSS) $(ASIM_CSS)
	cleancss -o asim.min.css $(LIB_CSS) $(ASIM_CSS)

lint::
	eslint $(ASIM_JS)

server::
	python3 -m http.server

push::
	git commit -am "update"
	git push
