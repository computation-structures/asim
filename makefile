LIB_CSS =  src/lib/codemirror.css
LIB_JS = src/lib/codemirror.js src/lib/emacs.js src/lib/sublime.js src/lib/vim.js 

ASIM_CSS = src/sim_tool.css src/cpu_tool.css
ASIM_JS = src/sim_tool.js src/cpu_tool.js src/asim.js

dummy::

minify: asim.min.js asim.min.css

asim.min.js: $(LIB_JS) $(ASIM_JS)
	terser $(LIB_JS) $(ASIM_JS) -o asim.min.js -c -m --keep-classnames

asim.min.css: $(LIB_CSS) $(ASIM_CSS)
	cleancss -o asim.min.css $(LIB_CSS) $(ASIM_CSS)

lint::
	eslint $(ASIM_JS)

server::
	python3 -m http.server

push:	asim.min.js asim.min.css
	git commit -am "update"
	git push

pushdemo: asim.min.js asim.min.css
	scp asim.html asim.min* csail:public_html/asim/
	scp tests/strlen.s tests/test_strlen.s csail:public_html/asim/tests/
