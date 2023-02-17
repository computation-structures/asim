.text
.global _start
_start:
	mov	sp, #0xaaaaaaaaaaaaaaaa    	// #-6148914691236517206
	mov	x0, #0x5555555555555555    	// #6148914691236517205
	mov	x1, sp
	bfxil	xzr, x0, #0, #64
	cmp	sp, x1
	b.ne	_test_fail
	tst	x0, xzr
	b.ne	_test_fail
	bfxil	x0, xzr, #0, #64
	tst	x0, x0
	b.ne	_test_fail
	ldr	x0, _BFM_INITIAL
	mov	x1, x0
	mov	x0, x1
	bfxil	x0, x1, #40, #16
	ldr	x2, _BFM_TEST_1
	cmp	x0, x2
	b.ne	_test_fail
	mov	x0, x1
	bfi	x0, x1, #48, #16
	ldr	x2, _BFM_TEST_2
	cmp	x0, x2
	b.ne	_test_fail
	mov	x0, x1
	bfxil	x0, x1, #47, #1
	ldr	x2, _BFM_TEST_3
	cmp	x0, x2
	b.ne	_test_fail
	ldr	x0, _UBFM_INITIAL
	mov	x1, x0
	ubfx	x0, x1, #32, #24
	ldr	x2, _UBFM_TEST_1
	cmp	x0, x2
	b.ne	_test_fail
	ubfiz	x0, x1, #4, #8
	ldr	x2, _UBFM_TEST_2
	cmp	x0, x2
	b.ne	_test_fail
	lsr	x0, x1, #63
	ldr	x2, _UBFM_TEST_3
	cmp	x0, x2
	b.ne	_test_fail
	ldr	x0, _SBFM_INITIAL
	mov	x1, x0
	sbfx	x0, x1, #32, #16
	ldr	x2, _SBFM_TEST_1
	cmp	x0, x2
	b.ne	_test_fail
	sbfiz	x0, x1, #4, #12
	ldr	x2, _SBFM_TEST_2
	cmp	x0, x2
	b.ne	_test_fail
	sbfx	x0, x1, #19, #1
	ldr	x2, _SBFM_TEST_3
	cmp	x0, x2
	b.ne	_test_fail
	sbfiz	w0, w1, #4, #12
	ldr	x2, _SBFM_TEST_W
	cmp	x0, x2
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_BFM_INITIAL:
	.word	0x89abcdef
	.word	0x01234567
_BFM_TEST_1:
	.word	0x89ab2345
	.word	0x01234567
_BFM_TEST_2:
	.word	0x89abcdef
	.word	0xcdef4567
_BFM_TEST_3:
	.word	0x89abcdee
	.word	0x01234567
_UBFM_INITIAL:
	.word	0x89abcdef
	.word	0x01234567
_UBFM_TEST_1:
	.word	0x00234567
	.word	0x00000000
_UBFM_TEST_2:
	.word	0x00000ef0
	.word	0x00000000
_UBFM_TEST_3:
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
_SBFM_INITIAL:
	.word	0x89abcdef
	.word	0x01234567
_SBFM_TEST_1:
	.word	0x00004567
	.word	0x00000000
_SBFM_TEST_2:
	.word	0xffffdef0
	.word	0xffffffff
_SBFM_TEST_3:
	.word	0xffffffff
	.word	0xffffffff
_SBFM_TEST_W:
	.word	0xffffdef0
	.word	0x00000000
