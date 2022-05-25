all::
	cd ..; make

lint::
	eslint *.js

push::
	cd ..; make push

COMMON_CSS =  ../lib/codemirror.css ../lib/fontawesome.css ../lib/solid.css ../lib/regular.css ../common/sim_tool.css
COMMON_JS = ../lib/codemirror.js ../lib/emacs.js ../lib/sublime.js ../lib/vim.js ../common/sim_tool.js ../common/parser.js

CSS = ${COMMON_CSS} gui.css
JS = ${COMMON_JS} gui.js assembler.js riscv.js

edx::
	cp edx_cpu_tool.html ../edx/cpu_tool.html
	terser $(JS) -o ../edx/cpu_tool.min.js -c -m --keep-classnames
	cleancss -o ../edx/cpu_tool.min.css $(CSS)


