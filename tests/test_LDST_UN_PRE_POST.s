.text
.global _start
_start:
	adr	x0, _array_start
	mov	x3, x0
	ldurb	w1, [x0]
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursb	w1, [x0]
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldurb	w1, [x0,#56]
	movk	w2, #0x0, lsl #16
	movk	w2, #0xa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursb	w1, [x0,#56]
	movk	w2, #0xffff, lsl #16
	movk	w2, #0xffa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursb	x1, [x0,#56]
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xffff, lsl #16
	movk	x2, #0xffa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldurh	w1, [x0,#64]
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b48
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursh	w1, [x0,#64]
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b48
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldurh	w1, [x0,#120]
	movk	w2, #0x0, lsl #16
	movk	w2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursh	w1, [x0,#120]
	movk	w2, #0xffff, lsl #16
	movk	w2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursh	x1, [x0,#120]
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xffff, lsl #16
	movk	x2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldur	w1, [x0,#128]
	movk	w2, #0x6ead, lsl #16
	movk	w2, #0x7b50
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldur	w1, [x0,#248]
	movk	w2, #0xfead, lsl #16
	movk	w2, #0xc3bf
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldursw	x1, [x0,#248]
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xfead, lsl #16
	movk	x2, #0xc3bf
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	mov	x3, x0
	ldur	x1, [x0,#192]
	movk	x2, #0xdead, lsl #48
	movk	x2, #0xabba, lsl #32
	movk	x2, #0x6ead, lsl #16
	movk	x2, #0x7b58
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	add	x3, x0, #0x0
	ldrb	w1, [x0,#0]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x0
	add	x3, x0, #0x0
	ldrsb	w1, [x0,#0]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x0
	add	x3, x0, #0x38
	ldrb	w1, [x0,#56]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0xa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x38
	ldrsb	w1, [x0,#56]!
	movk	w2, #0xffff, lsl #16
	movk	w2, #0xffa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x38
	ldrsb	x1, [x0,#56]!
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xffff, lsl #16
	movk	x2, #0xffa7
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x40
	ldrh	w1, [x0,#64]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b48
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x40
	add	x3, x0, #0x40
	ldrsh	w1, [x0,#64]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b48
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x40
	add	x3, x0, #0x78
	ldrh	w1, [x0,#120]!
	movk	w2, #0x0, lsl #16
	movk	w2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x78
	ldrsh	w1, [x0,#120]!
	movk	w2, #0xffff, lsl #16
	movk	w2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x78
	ldrsh	x1, [x0,#120]!
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xffff, lsl #16
	movk	x2, #0xc3af
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x80
	ldr	w1, [x0,#128]!
	movk	w2, #0x6ead, lsl #16
	movk	w2, #0x7b50
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x80
	add	x3, x0, #0xf8
	ldr	w1, [x0,#248]!
	movk	w2, #0xfead, lsl #16
	movk	w2, #0xc3bf
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xf8
	add	x3, x0, #0xf8
	ldrsw	x1, [x0,#248]!
	movk	x2, #0xffff, lsl #48
	movk	x2, #0xffff, lsl #32
	movk	x2, #0xfead, lsl #16
	movk	x2, #0xc3bf
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xf8
	add	x3, x0, #0xc0
	ldr	x1, [x0,#192]!
	movk	x2, #0xdead, lsl #48
	movk	x2, #0xabba, lsl #32
	movk	x2, #0x6ead, lsl #16
	movk	x2, #0x7b58
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xc0
	add	x3, x0, #0x0
	ldrb	w1, [x0],#0
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x0
	add	x3, x0, #0x0
	ldrsb	w1, [x0],#0
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x0
	add	x3, x0, #0x38
	ldrb	w1, [x0],#56
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x38
	ldrsb	w1, [x0],#56
	movk	w2, #0x0, lsl #16
	movk	w2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x38
	ldrsb	x1, [x0],#56
	movk	x2, #0x0, lsl #48
	movk	x2, #0x0, lsl #32
	movk	x2, #0x0, lsl #16
	movk	x2, #0x40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x38
	add	x3, x0, #0x40
	ldrh	w1, [x0],#64
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x40
	add	x3, x0, #0x40
	ldrsh	w1, [x0],#64
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x40
	add	x3, x0, #0x78
	ldrh	w1, [x0],#120
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x78
	ldrsh	w1, [x0],#120
	movk	w2, #0x0, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x78
	ldrsh	x1, [x0],#120
	movk	x2, #0x0, lsl #48
	movk	x2, #0x0, lsl #32
	movk	x2, #0x0, lsl #16
	movk	x2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x78
	add	x3, x0, #0x80
	ldr	w1, [x0],#128
	movk	w2, #0x6ead, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0x80
	add	x3, x0, #0xf8
	ldr	w1, [x0],#248
	movk	w2, #0x6ead, lsl #16
	movk	w2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xf8
	add	x3, x0, #0xf8
	ldrsw	x1, [x0],#248
	movk	x2, #0x0, lsl #48
	movk	x2, #0x0, lsl #32
	movk	x2, #0x6ead, lsl #16
	movk	x2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xf8
	add	x3, x0, #0xc0
	ldr	x1, [x0],#192
	movk	x2, #0xdead, lsl #48
	movk	x2, #0xabba, lsl #32
	movk	x2, #0x6ead, lsl #16
	movk	x2, #0x7b40
	cmp	x1, x2
	b.ne	_test_fail
	cmp	x3, x0
	b.ne	_test_fail
	sub	x0, x0, #0xc0
	add	sp, x0, #0xc
	ldur	x1, [x0,#12]
	ldur	x2, [sp]
	cmp	x1, x2
	b.ne	_test_fail
	mov	x1, sp
	ldur	xzr, [x0]
	cmp	sp, x1
	b.ne	_test_fail
	adr	x10, _array_end
	ldur	x1, [x10,#-256]
	ldur	x2, [x0]
	cmp	x1, x2
	b.ne	_test_fail
	adr	x20, _array_end
	adr	x21, _array_end+0x8
	mov	x22, x20
	movk	x0, #0x302, lsl #48
	movk	x0, #0x100, lsl #32
	movk	x0, #0xfffe, lsl #16
	movk	x0, #0xfdfc
l1203:
	strb	w0, [x20],#1
	ror	x0, x0, #4
	ror	x0, x0, #4
	cmp	x20, x21
	b.ne	l1203
	ldr	x1, _array_end
	cmp	x1, x0
	b.ne	_test_fail
l2203:
	strb	wzr, [x20,#-1]!
	cmp	x20, x22
	b.ne	l2203
	ldr	x1, _array_end
	cmp	x1, xzr
	b.ne	_test_fail
	movk	x0, #0x1234, lsl #48
	movk	x0, #0x8765, lsl #32
	movk	x0, #0xacbd, lsl #16
	movk	x0, #0xfe90
l1206:
	strh	w0, [x20],#2
	ror	x0, x0, #8
	ror	x0, x0, #8
	cmp	x20, x21
	b.ne	l1206
	ldr	x1, _array_end
	cmp	x1, x0
	b.ne	_test_fail
l2206:
	strh	wzr, [x20,#-2]!
	cmp	x20, x22
	b.ne	l2206
	ldr	x1, _array_end
	cmp	x1, xzr
	b.ne	_test_fail
	movk	x0, #0xfedc, lsl #48
	movk	x0, #0xba98, lsl #32
	movk	x0, #0x123, lsl #16
	movk	x0, #0x4567
l1209:
	str	w0, [x20],#4
	ror	x0, x0, #16
	ror	x0, x0, #16
	cmp	x20, x21
	b.ne	l1209
	ldr	x1, _array_end
	cmp	x1, x0
	b.ne	_test_fail
l2209:
	str	wzr, [x20,#-4]!
	cmp	x20, x22
	b.ne	l2209
	ldr	x1, _array_end
	cmp	x1, xzr
	b.ne	_test_fail
	movk	x0, #0x123, lsl #48
	movk	x0, #0x4567, lsl #32
	movk	x0, #0x89ab, lsl #16
	movk	x0, #0xcdef
l1212:
	str	x0, [x20],#8
	ror	x0, x0, #32
	ror	x0, x0, #32
	cmp	x20, x21
	b.ne	l1212
	ldr	x1, _array_end
	cmp	x1, x0
	b.ne	_test_fail
l2212:
	str	xzr, [x20,#-8]!
	cmp	x20, x22
	b.ne	l2212
	ldr	x1, _array_end
	cmp	x1, xzr
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
.byte 0x00
_array_start:
	.word	0x6ead7b40
	.word	0xdeadabba
	.word	0xfead7b41
	.word	0xdeadabba
	.word	0x6eadc342
	.word	0xdeadabba
	.word	0xfeadc343
	.word	0xdeadabba
	.word	0x6ead7ba4
	.word	0xdeadabba
	.word	0xfead7ba5
	.word	0xdeadabba
	.word	0x6eadc3a6
	.word	0xdeadabba
	.word	0xfeadc3a7
	.word	0xdeadabba
	.word	0x6ead7b48
	.word	0xdeadabba
	.word	0xfead7b49
	.word	0xdeadabba
	.word	0x6eadc34a
	.word	0xdeadabba
	.word	0xfeadc34b
	.word	0xdeadabba
	.word	0x6ead7bac
	.word	0xdeadabba
	.word	0xfead7bad
	.word	0xdeadabba
	.word	0x6eadc3ae
	.word	0xdeadabba
	.word	0xfeadc3af
	.word	0xdeadabba
	.word	0x6ead7b50
	.word	0xdeadabba
	.word	0xfead7b51
	.word	0xdeadabba
	.word	0x6eadc352
	.word	0xdeadabba
	.word	0xfeadc353
	.word	0xdeadabba
	.word	0x6ead7bb4
	.word	0xdeadabba
	.word	0xfead7bb5
	.word	0xdeadabba
	.word	0x6eadc3b6
	.word	0xdeadabba
	.word	0xfeadc3b7
	.word	0xdeadabba
	.word	0x6ead7b58
	.word	0xdeadabba
	.word	0xfead7b59
	.word	0xdeadabba
	.word	0x6eadc35a
	.word	0xdeadabba
	.word	0xfeadc35b
	.word	0xdeadabba
	.word	0x6ead7bbc
	.word	0xdeadabba
	.word	0xfead7bbd
	.word	0xdeadabba
	.word	0x6eadc3be
	.word	0xdeadabba
	.word	0xfeadc3bf
	.word	0xdeadabba
_array_end:
