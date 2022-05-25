server::
	python3 -m http.server&

push::
	git commit -am "update"
	git push

FONT_AWESOME = lib/fontawesome.css lib/solid.css lib/regular.css

CM_CSS = lib/codemirror.css
CM_JS = lib/codemirror.js lib/emacs.js lib/sublime.js lib/vim.js

CPUTOOL_CSS = src/gui.css
CPUTOOL_JS = src/gui.js src/assembler.js src/riscv.js

JS = $(CM_JS) $(CPUTOOL_JS)
CSS = $(FONT_AWESOME) $(CM_CSS) $(CPUTOOL_CSS)

edx::
	terser $(JS) -o edx/cpu_tool.min.js -c -m --keep-classnames
	cleancss -o edx/cpu_tool.min.css $(CSS)
