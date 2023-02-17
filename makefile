LIB_CSS =  src/lib/codemirror.css
LIB_JS = src/lib/codemirror.js src/lib/emacs.js src/lib/sublime.js src/lib/vim.js 

ASIM_CSS = src/sim_tool.css src/cpu_tool.css
ASIM_JS = src/sim_tool.js src/cpu_tool.js src/asim.js

DEMO_S = tests/strlen.s tests/strlen_solution.s tests/test_strlen.s tests/echo_loop.s tests/caches.s tests/verify_assembly.s tests/verify_simulation.s tests/test_*.s

TAG = $(shell grep "asim_version =" src/asim.js | sed "s/.*'\(.*\)'.*/\1/")

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

release::
	git tag -a $(TAG) -m "version $(TAG)"
	git push origin $(TAG)

push:	asim.min.js asim.min.css
	git commit -am "update"
	git push

pushdemo: asim.min.js asim.min.css
	scp asim.html educore.html asim.min* csail:public_html/asim/
	scp $(DEMO_S) csail:public_html/asim/tests/
