.text
.global _start
_start:
	ldr	x0, INITIAL_SP
	mov	sp, x0
	ldr	x0, INITIAL_X0
	tst	x0, x0
	ccmp	xzr, x0, #0x0, al
	b.pl	_test_fail
	ccmn	xzr, x0, #0x0, al
	b.mi	_test_fail
	ccmp	x0, xzr, #0x0, al
	b.mi	_test_fail
	ccmn	x0, xzr, #0x0, al
	b.mi	_test_fail
	mov	w0, w0
	ccmp	w0, w0, #0x0, al
	b.ne	_test_fail
	b.cc	_test_fail
	ccmp	xzr, xzr, #0xf, cc
	b.vc	_test_fail
	b.cc	_test_fail
	b.ne	_test_fail
	b.pl	_test_fail
	ccmn	xzr, xzr, #0x0, vc
	b.vs	_test_fail
	b.cs	_test_fail
	b.eq	_test_fail
	b.mi	_test_fail
	ccmp	xzr, xzr, #0xa, vs
	b.vs	_test_fail
	b.cc	_test_fail
	b.eq	_test_fail
	b.pl	_test_fail
	ccmn	xzr, xzr, #0x5, vs
	b.vc	_test_fail
	b.cs	_test_fail
	b.ne	_test_fail
	b.mi	_test_fail
	hlt #0
_test_fail:
	hlt #1
INITIAL_SP:
	.word	0xaaaa0000
	.word	0xaaaa0000
INITIAL_X0:
	.word	0x00005555
	.word	0x00005555
