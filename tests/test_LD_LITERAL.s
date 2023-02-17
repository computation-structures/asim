.text
.global _start
_start:
	b	_start_skip
_BACK_LD:
	.word	0x89abcdef
	.word	0x01234567
_start_skip:
	ldr	x0, _BACK_LD
	movk	x1, #0x123, lsl #48
	movk	x1, #0x4567, lsl #32
	movk	x1, #0x89ab, lsl #16
	movk	x1, #0xcdef
	cmp	x0, x1
	b.ne	_test_fail
	ldr	x0, _FORW_LD
	movk	x1, #0x11, lsl #48
	movk	x1, #0x2233, lsl #32
	movk	x1, #0x4455, lsl #16
	movk	x1, #0x6677
	cmp	x0, x1
	b.ne	_test_fail
	ldr	w0, _FORW_LD
	movk	w1, #0x4455, lsl #16
	movk	w1, #0x6677
	cmp	x0, x1
	b.ne	_test_fail
	mov	sp, x0
	ldr	xzr, _BACK_LD
	cmp	sp, x0
	b.ne	_test_fail
	nop
	nop
	cmp	sp, x0
	b.ne	_test_fail
	mov	x2, #0x0                   	// #0
	ldrsw	x0, _BACK_LD
	movk	x1, #0x123, lsl #48
	movk	x1, #0x4567, lsl #32
	movk	x1, #0x89ab, lsl #16
	movk	x1, #0xcdef
	add	x1, x2, w1, sxtw
	cmp	x0, x1
	b.ne	_test_fail
	ldrsw	x0, _FORW_LD
	movk	x1, #0x11, lsl #48
	movk	x1, #0x2233, lsl #32
	movk	x1, #0x4455, lsl #16
	movk	x1, #0x6677
	add	x1, x2, w1, sxtw
	cmp	x0, x1
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_FORW_LD:
	.word	0x44556677
	.word	0x00112233
