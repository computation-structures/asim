.text
.global _start
_start:
	ldr	x2, _TEST_INIT_SP
	mov	sp, x2
	ldr	x0, _TEST_INIT
	add	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	adds	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	sub	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	subs	x1, x0, xzr
	cmp	x1, x0
	b.ne	_test_fail
	ldr	x3, _NEG_TEST_INIT
	add	x1, xzr, x0
	cmp	x1, x0
	b.ne	_test_fail
	adds	x1, xzr, x0
	cmp	x1, x0
	b.ne	_test_fail
	neg	x1, x0
	cmp	x1, x3
	b.ne	_test_fail
	negs	x1, x0
	cmp	x1, x3
	b.ne	_test_fail
	mov	x3, #0x0                   	// #0
	add	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	cmn	x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	sub	xzr, x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	cmp	x0, x0
	negs	xzr, x3
	b.ne	_test_fail
	cmp	sp, x2
	b.ne	_test_fail
	mov	w3, w0
	subs	w1, w0, wzr
	b.pl	_test_fail
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_1_RESULT
	sub	x1, x0, x0, lsl #12
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_2_RESULT
	add	x1, x0, x0, lsr #16
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_3_RESULT
	sub	x1, x0, x0, asr #48
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_4_RESULT
	add	w1, w0, w0, asr #16
	cmp	w1, w3
	b.ne	_test_fail
	cmp	x3, x1
	b.ne	_test_fail
	mov	x0, #0x7fffffffffffffff    	// #9223372036854775807
	mov	x1, #0x1                   	// #1
	mov	x2, #0xffffffffffffffff    	// #-1
	mov	x4, #0xfffffffffffffffe    	// #-2
	cmn	x0, x1
	b.vc	_test_fail
	cmp	x0, x2
	b.vc	_test_fail
	cmp	x4, x0
	b.vc	_test_fail
	mov	w3, #0x7fffffff            	// #2147483647
	cmn	w3, w1
	b.vc	_test_fail
	cmp	w3, w2
	b.vc	_test_fail
	cmp	w4, w3
	b.vc	_test_fail
	orr	x0, x0, #0x8000000000000000
	cmn	x0, x1
	b.cc	_test_fail
	cmp	x0, x0
	b.cc	_test_fail
	orr	w0, w0, #0x80000000
	cmn	w0, w1
	b.cc	_test_fail
	cmp	w0, w0
	b.cc	_test_fail
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
_TEST_1_RESULT:
	.word	0xccccddef
	.word	0xcccccccc
_TEST_2_RESULT:
	.word	0xcf13579a
	.word	0x0123468a
_TEST_3_RESULT:
	.word	0x89abcccc
	.word	0x01234567
_TEST_4_RESULT:
	.word	0x89ab579a
	.word	0x00000000
