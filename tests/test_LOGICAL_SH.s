.text
.global _start
_start:
	ldr	x2, _TEST_LOGIC_INIT_SP
	mov	sp, x2
	ldr	x0, _TEST_LOGIC_INIT
	mov	x3, #0x0                   	// #0
	and	x1, x0, xzr
	cmp	x1, x3
	b.ne	_test_fail
	orr	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	eor	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	ands	x1, x0, xzr
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	and	x1, xzr, x0
	cmp	x1, x3
	b.ne	_test_fail
	mov	x1, x0
	cmp	x1, x0
	b.ne	_test_fail
	eor	x1, xzr, x0
	cmp	x1, x0
	b.ne	_test_fail
	ands	x1, xzr, x0
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	and	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	orr	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	eor	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	tst	x0, x0
	b.cs	_test_fail
	b.vs	_test_fail
	negs	xzr, x3
	b.ne	_test_fail
	cmp	sp, x2
	b.ne	_test_fail
	mov	w3, w0
	ands	w1, w0, w0
	b.pl	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	mov	x3, #0xffffffffffffffff    	// #-1
	bic	x1, x0, x0
	cmp	x1, xzr
	b.ne	_test_fail
	orn	x1, x0, x0
	cmp	x1, x3
	b.ne	_test_fail
	eon	x1, x0, x0
	cmp	x1, x3
	b.ne	_test_fail
	bics	x1, x0, x0
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, xzr
	b.ne	_test_fail
	ldr	x3, _TEST_LOGIC_1
	ands	x1, x0, x0, lsl #12
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_LOGIC_2
	ands	x1, x0, x0, lsr #16
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_LOGIC_3
	ands	x1, x0, x0, ror #24
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_LOGIC_4
	ands	x1, x0, x0, asr #48
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_LOGIC_4W
	ands	w1, w0, w0, asr #16
	b.cs	_test_fail
	b.vs	_test_fail
	cmp	w1, w3
	b.ne	_test_fail
	cmp	x3, x1
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_TEST_LOGIC_INIT_SP:
	.word	0xefef0101
	.word	0xababcdcd
_TEST_LOGIC_INIT:
	.word	0x89abcdef
	.word	0x01234567
_TEST_LOGIC_1:
	.word	0x888ac000
	.word	0x00024002
_TEST_LOGIC_2:
	.word	0x012389ab
	.word	0x00000123
_TEST_LOGIC_3:
	.word	0x01014589
	.word	0x01014501
_TEST_LOGIC_4:
	.word	0x00000123
	.word	0x00000000
_TEST_LOGIC_4W:
	.word	0x89ab89ab
	.word	0x00000000
