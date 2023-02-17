.text
.global _start
_start:
	ldr	x2, _TEST_INIT_SP
	mov	sp, x2
	ldr	x0, _TEST_INIT
	ldr	x3, _TEST_SP_RESULT_A
	ldr	x4, _TEST_SP_RESULT_S
	add	x1, sp, x0
	cmp	x1, x3
	b.ne	_test_fail
	adds	x1, sp, x0, sxtx
	cmp	x1, x3
	b.ne	_test_fail
	sub	w1, wsp, w0
	cmp	w1, w4
	b.ne	_test_fail
	subs	w1, wsp, w0, sxtw
	cmp	w1, w4
	b.ne	_test_fail
	add	sp, sp, x0
	cmp	sp, x3
	b.ne	_test_fail
	sub	sp, sp, x0, sxtx
	cmp	sp, x2
	b.ne	_test_fail
	mov	x5, #0x0                   	// #0
	mov	x6, sp
	cmn	x0, x0, uxtx
	negs	xzr, x5
	b.ne	_test_fail
	cmp	sp, x0, sxtx
	negs	xzr, x5
	b.ne	_test_fail
	add	x1, sp, xzr
	cmp	x1, x6
	b.ne	_test_fail
	adds	x1, sp, wzr, sxtw
	cmp	x1, x6
	b.ne	_test_fail
	sub	w1, wsp, wzr, uxth
	cmp	w1, w6
	b.ne	_test_fail
	subs	w1, wsp, wzr, uxtb #2
	cmp	w1, w6
	b.ne	_test_fail
	ldr	x3, _TEST_1_RESULT
	sub	x1, x0, w0, uxtb #2
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_2_RESULT
	add	x1, x0, w0, sxth #1
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_3_RESULT
	sub	x1, x0, w0, sxtw #3
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_4_RESULT
	add	x1, x0, x0, sxtx #4
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_5_RESULT
	add	x1, x0, w0, uxtw #1
	cmp	x1, x3
	b.ne	_test_fail
	ldr	x3, _TEST_6_RESULT
	sub	w1, w0, w0, uxth #2
	cmp	w1, w3
	b.ne	_test_fail
	cmp	x3, x1
	ldr	x3, _TEST_7_RESULT
	add	w1, w0, w0, uxtb
	cmp	w1, w3
	b.ne	_test_fail
	cmp	x3, x1
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_TEST_INIT_SP:
	.word	0xefef0101
	.word	0xababcdcd
_TEST_INIT:
	.word	0x89abcdef
	.word	0x01234567
_TEST_1_RESULT:
	.word	0x89abca33
	.word	0x01234567
_TEST_2_RESULT:
	.word	0x89ab69cd
	.word	0x01234567
_TEST_3_RESULT:
	.word	0x3c4d5e77
	.word	0x0123456b
_TEST_4_RESULT:
	.word	0x2468acdf
	.word	0x13579be0
_TEST_5_RESULT:
	.word	0x9d0369cd
	.word	0x01234568
_TEST_6_RESULT:
	.word	0x89a89633
	.word	0x00000000
_TEST_7_RESULT:
	.word	0x89abcede
	.word	0x00000000
_TEST_SP_RESULT_A:
	.word	0x799acef0
	.word	0xaccf1335
_TEST_SP_RESULT_S:
	.word	0x66433312
	.word	0xaa888866
