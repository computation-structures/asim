.text
.global _start
_start:
	mov	x0, #0x0                   	// #0
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0x1
	mov	x1, x0
	ands	x0, x0, #0x1
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0x1
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0x1
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0x2
	mov	x1, x0
	ands	x0, x0, #0x2
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0x2
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0x2
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0x800000000000
	mov	x1, x0
	ands	x0, x0, #0x800000000000
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0x800000000000
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0x800000000000
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0x8000000000000000
	mov	x1, x0
	ands	x0, x0, #0x8000000000000000
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0x8000000000000000
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0x8000000000000000
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0xffff0000ffff0000
	mov	x1, x0
	ands	x0, x0, #0xffff0000ffff0000
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0xffff0000ffff0000
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0xffff0000ffff0000
	tst	x0, x0
	b.ne	_test_fail
	orr	x0, x0, #0xffffffff00000000
	mov	x1, x0
	ands	x0, x0, #0xffffffff00000000
	b.eq	_test_fail
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	and	x0, x1, #0xffffffff00000000
	cmp	x1, x0, uxtx
	b.ne	_test_fail
	eor	x0, x0, #0xffffffff00000000
	tst	x0, x0
	b.ne	_test_fail
	mov	sp, #0xaaaaaaaaaaaaaaaa    	// #-6148914691236517206
	tst	xzr, #0x5555555555555555
	ldr	x0, MEM_CONST
	cmp	sp, x0
	b.ne	_test_fail
	tst	xzr, xzr
	b.ne	_test_fail
	eor	wsp, w0, #0x55555555
	mov	x0, sp
	eor	x0, x0, #0xffffffff
	tst	x0, x0
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
MEM_CONST:
	.word	0xaaaaaaaa
	.word	0xaaaaaaaa
