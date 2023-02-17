.text
.global _start
_start:
	ldr	x2, _TEST_INIT_SP
	mov	sp, x2
	ldr	x0, _TEST_INIT
	ldr	x3, _NEG_TEST_INIT
	tst	x0, x0
	adc	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	tst	x0, x0
	adcs	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	tst	x0, x0
	adc	x1, xzr, x0
	cmp	x1, x0
	b.ne	_test_fail
	tst	x0, x0
	adcs	x1, xzr, x0
	cmp	x1, x0
	b.ne	_test_fail
	ngc	x1, x0
	cmp	x1, x3
	b.ne	_test_fail
	ngcs	x1, x0
	cmp	x1, x3
	b.ne	_test_fail
	sbc	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	sbcs	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	mov	x3, #0x0                   	// #0
	adc	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	adcs	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	sbc	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	sbcs	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	cmp	sp, x2
	b.ne	_test_fail
	mov	w3, w0
	sbcs	w1, w0, wzr
	b.pl	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	mov	x3, #0xffffffffffffffff    	// #-1
	tst	xzr, xzr
	sbc	x1, x0, x0
	cmp	x1, x3
	b.ne	_test_fail
	tst	xzr, xzr
	sbcs	w1, w0, w0
	cmp	w1, w3
	b.ne	_test_fail
	add	x3, x0, x0
	add	x3, x3, #0x1
	adc	x1, x0, x0
	cmp	x1, x3
	b.ne	_test_fail
	adcs	w1, w0, w0
	cmp	w1, w3
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_TEST_INIT_SP:
	.word	0xefef0101
	.word	0xababcdcd
_NEG_TEST_INIT:
	.word	0x76543211
	.word	0xfedcba98
_TEST_INIT:
	.word	0x89abcdef
	.word	0x01234567
