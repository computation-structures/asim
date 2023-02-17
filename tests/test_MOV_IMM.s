.text
.global _start
_start:
	adr	x2, _MOV_MEM
	mov	x0, #0xaaaa                	// #43690
	ldur	x1, [x2]
	cmp	x0, x1
	b.ne	_test_fail
	mov	x0, #0xbbbb0000            	// #3149594624
	ldur	x1, [x2,#8]
	cmp	x0, x1
	b.ne	_test_fail
	mov	x0, #0xcccc00000000        	// #225176545394688
	ldur	x1, [x2,#16]
	cmp	x0, x1
	b.ne	_test_fail
	mov	x0, #0xdddd000000000000    	// #-2459809821474422784
	ldur	x1, [x2,#24]
	cmp	x0, x1
	b.ne	_test_fail
	mov	x0, #0x1111ffffffffffff    	// #1230045648225566719
	ldur	x1, [x2,#32]
	cmp	x0, x1
	b.ne	_test_fail
	mov	x0, #0xffffffff0000ffff    	// #-4294901761
	ldur	x1, [x2,#40]
	cmp	x0, x1
	b.ne	_test_fail
	movk	x0, #0xffff, lsl #16
	ldur	x1, [x2,#48]
	cmp	x0, x1
	b.ne	_test_fail
	movk	w0, #0x5555
	ldur	x1, [x2,#56]
	cmp	x0, x1
	b.ne	_test_fail
	mov	sp, #0xaaaaaaaaaaaaaaaa    	// #-6148914691236517206
	mov	x0, sp
	mov	xzr, #0xffff                	// #65535
	cmp	sp, x0
	b.ne	_test_fail
	tst	xzr, x0
	b.ne	_test_fail
	tst	x0, xzr
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_MOV_MEM:
	.word	0x0000aaaa
	.word	0x00000000
	.word	0xbbbb0000
        .word   0
        .word   0
	.word	0x0000cccc
	.word	0x00000000
	.word	0xdddd0000
	.word	0xffffffff
	.word	0x1111ffff
	.word	0x0000ffff
	.word	0xffffffff
	.word	0xffffffff
	.word	0xffffffff
	.word	0xffff5555
	.word	0x00000000
