.text
.global _start
_start:
	ldr	x2, INITIAL_SP
	mov	sp, x2
	ldr	x0, INITIAL_X0
	ldr	x1, INITIAL_X1
	tst	x0, x0
	csel	x10, xzr, x0, al
	cmp	x10, xzr
	b.ne	_test_fail
	csinc	x10, xzr, x0, al
	cmp	x10, xzr
	b.ne	_test_fail
	csinv	x10, xzr, x0, al
	cmp	x10, xzr
	b.ne	_test_fail
	csneg	x10, xzr, x0, al
	cmp	x10, xzr
	b.ne	_test_fail
	mov	x11, #0x0                   	// #0
	csel	x10, x0, xzr, vs
	cmp	x10, x11
	b.ne	_test_fail
	mov	x11, #0x1                   	// #1
	csinc	x10, x0, xzr, vs
	cmp	x10, x11
	b.ne	_test_fail
	mov	x11, #0xffffffffffffffff    	// #-1
	csinv	x10, x0, xzr, vs
	cmp	x10, x11
	b.ne	_test_fail
	mov	x11, #0x0                   	// #0
	csneg	x10, x0, xzr, vs
	cmp	x10, x11
	b.ne	_test_fail
	csel	xzr, x1, x0, al
	cmp	sp, x2
	b.ne	_test_fail
	tst	xzr, xzr
	b.ne	_test_fail
	csinc	xzr, x1, x0, al
	cmp	sp, x2
	b.ne	_test_fail
	tst	xzr, xzr
	b.ne	_test_fail
	csinv	xzr, x1, x0, al
	cmp	sp, x2
	b.ne	_test_fail
	tst	xzr, xzr
	b.ne	_test_fail
	csneg	xzr, x1, x0, al
	cmp	sp, x2
	b.ne	_test_fail
	tst	xzr, xzr
	b.ne	_test_fail
	mov	x11, #0xf                   	// #15
	mov	x12, #0x8                   	// #8
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, hi
	csel	x20, x0, x1, ls
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, gt
	csel	x20, x0, x1, le
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, ge
	csel	x20, x0, x1, lt
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x11, #0x8000000000000000    	// #-9223372036854775808
	mov	x12, #0x8                   	// #8
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, hi
	csel	x20, x0, x1, ls
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, le
	csel	x20, x0, x1, gt
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, lt
	csel	x20, x0, x1, ge
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x11, x12
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, ls
	csel	x20, x0, x1, hi
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, le
	csel	x20, x0, x1, gt
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	mov	x10, xzr
	mov	x20, xzr
	cmp	x11, x12
	csel	x10, x1, x0, ge
	csel	x20, x0, x1, lt
	cmp	x10, x1
	b.ne	_test_fail
	cmp	x20, x1
	b.ne	_test_fail
	tst	xzr, xzr
	mov	w11, w0
	csel	w10, w0, w1, eq
	cmp	x10, x11
	b.ne	_test_fail
	mov	w11, w1
	csel	w10, w0, w1, ne
	cmp	x10, x11
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
INITIAL_SP:
	.word	0x76543210
	.word	0xfedcba98
INITIAL_X0:
	.word	0xbabef007
	.word	0xdeadabba
INITIAL_X1:
	.word	0xdabbf879
	.word	0xbeef0008
