.text
.global _start
_start:
	ldr	x30, _EXTR_TEST_RINIT
	ldr	x0, _EXTR_TEST_INIT
	mov	sp, x30
	ldr	x2, _EXTR_TEST_1_M
	extr	x1, x0, xzr, #32
	cmp	x1, x2
	b.ne	_test_fail
	ldr	x2, _EXTR_TEST_1_N
	extr	x1, xzr, x0, #32
	cmp	x1, x2
	b.ne	_test_fail
	ldr	x2, _EXTR_TEST_2_M
	extr	x1, x0, xzr, #0
	cmp	x1, x2
	b.ne	_test_fail
	ldr	x2, _EXTR_TEST_2_N
	extr	x1, xzr, x0, #0
	cmp	x1, x2
	b.ne	_test_fail
	ror	xzr, x0, #11
	cmp	sp, x30
	b.ne	_test_fail
	cmp	sp, x30
	b.ne	_test_fail
	ldr	x2, _EXTR_TEST_W_M
	extr	w1, w0, w30, #8
	cmp	x1, x2
	b.ne	_test_fail
	ldr	x2, _EXTR_TEST_W_N
	extr	w1, w30, w0, #8
	cmp	x1, x2
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_EXTR_TEST_INIT:
	.word	0x89abcdef
	.word	0x01234567
_EXTR_TEST_RINIT:
	.word	0x76543210
	.word	0xfedcba98
_EXTR_TEST_1_M:
	.word	0x00000000
	.word	0x89abcdef
_EXTR_TEST_1_N:
	.word	0x01234567
	.word	0x00000000
_EXTR_TEST_2_M:
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
_EXTR_TEST_2_N:
	.word	0x89abcdef
	.word	0x01234567
_EXTR_TEST_W_M:
	.word	0xef765432
	.word	0x00000000
_EXTR_TEST_W_N:
	.word	0x1089abcd
	.word	0x00000000
