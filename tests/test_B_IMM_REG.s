.text
.global _start
_start:
	ldr	w0, _test_state
	cmp	w0, wzr
	b.eq	_test_b_imm
	add	w0, w0, #0x1
	str	w0, [sp,xzr]
	ret
_test_b_imm:
	b	_test_b_forw
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
_test_b_back:
	adr	x1, _test_b_back+0x8
	bl	_test_bl_forw
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
_test_bl_back:
	cmp	x30, x1
	b.ne	_test_fail
	b	_test_br
_test_b_forw:
	b	_test_b_back
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
_test_bl_forw:
	cmp	x30, x1
	b.ne	_test_fail
	adr	x1, _test_bl_end+0x4
_test_bl_end:
	bl	_test_bl_back
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
_test_br:
	adr	x0, _test_br_tgt
	br	x0
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
_test_br_tgt:
	adr	x0, _test_blr_tgt
	adr	x1, _test_br_tgt+0xc
	blr	x0
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
_test_blr_tgt:
	cmp	x30, x1
	b.ne	_test_fail
	adr	x0, _test_ret_tgt
	ret	x0
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
_test_ret_tgt:
	adr	x1, _test_state
	mov	sp, x1
	mov	w0, #0x1                   	// #1
	str	w0, [sp,xzr]
	adr	x30, 1f  // rewrite so we can insert BRK! was _test_ret_tgt+0x18
	br	xzr
1:      blr	xzr
	adr	x30, 1f  // rewrite so we can insert BRK! was _test_ret_tgt+0x24
	ret	xzr
1:      ldr	w0, [sp,xzr]
	cmp	w0, #0x4
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_test_state:
	.word	0x00000000
