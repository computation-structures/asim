.text
.global _start
_start:
	b.al	_start_forw
	hlt #1
_start_back:
	mov	w0, #0x0                   	// #0
	msr	nzcv, x0
	b.pl	l22
	hlt #1
l22:
	b.mi	_test_fail
	b.ne	l23
	hlt #1
l23:
	b.eq	_test_fail
	b.cc	l24
	hlt #1
l24:
	b.cs	_test_fail
	b.vc	l25
	hlt #1
l25:
	b.vs	_test_fail
	b.ls	l26
	hlt #1
l26:
	b.hi	_test_fail
	b.ge	l17
	hlt #1
l17:
	b.lt	_test_fail
	b.gt	l18
	hlt #1
l18:
	b.le	_test_fail
	b.al	lp1
	hlt #1
lp1:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x10000000            	// #268435456
	msr	nzcv, x0
	b.pl	l211
	hlt #1
l211:
	b.mi	_test_fail
	b.ne	l212
	hlt #1
l212:
	b.eq	_test_fail
	b.cc	l213
	hlt #1
l213:
	b.cs	_test_fail
	b.vs	l114
	hlt #1
l114:
	b.vc	_test_fail
	b.ls	l215
	hlt #1
l215:
	b.hi	_test_fail
	b.lt	l216
	hlt #1
l216:
	b.ge	_test_fail
	b.le	l217
	hlt #1
l217:
	b.gt	_test_fail
	b.al	lp10
	hlt #1
lp10:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x20000000            	// #536870912
	msr	nzcv, x0
	b.pl	l220
	hlt #1
l220:
	b.mi	_test_fail
	b.ne	l221
	hlt #1
l221:
	b.eq	_test_fail
	b.cs	l122
	hlt #1
l122:
	b.cc	_test_fail
	b.vc	l223
	hlt #1
l223:
	b.vs	_test_fail
	b.hi	l124
	hlt #1
l124:
	b.ls	_test_fail
	b.ge	l125
	hlt #1
l125:
	b.lt	_test_fail
	b.gt	l126
	hlt #1
l126:
	b.le	_test_fail
	b.al	lp19
	hlt #1
lp19:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x30000000            	// #805306368
	msr	nzcv, x0
	b.pl	l229
	hlt #1
l229:
	b.mi	_test_fail
	b.ne	l230
	hlt #1
l230:
	b.eq	_test_fail
	b.cs	l131
	hlt #1
l131:
	b.cc	_test_fail
	b.vs	l132
	hlt #1
l132:
	b.vc	_test_fail
	b.hi	l133
	hlt #1
l133:
	b.ls	_test_fail
	b.lt	l234
	hlt #1
l234:
	b.ge	_test_fail
	b.le	l235
	hlt #1
l235:
	b.gt	_test_fail
	b.al	lp28
	hlt #1
lp28:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x40000000            	// #1073741824
	msr	nzcv, x0
	b.pl	l238
	hlt #1
l238:
	b.mi	_test_fail
	b.eq	l139
	hlt #1
l139:
	b.ne	_test_fail
	b.cc	l240
	hlt #1
l240:
	b.cs	_test_fail
	b.vc	l241
	hlt #1
l241:
	b.vs	_test_fail
	b.ls	l242
	hlt #1
l242:
	b.hi	_test_fail
	b.ge	l143
	hlt #1
l143:
	b.lt	_test_fail
	b.le	l244
	hlt #1
l244:
	b.gt	_test_fail
	b.al	lp37
	hlt #1
lp37:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x50000000            	// #1342177280
	msr	nzcv, x0
	b.pl	l247
	hlt #1
l247:
	b.mi	_test_fail
	b.eq	l148
	hlt #1
l148:
	b.ne	_test_fail
	b.cc	l249
	hlt #1
l249:
	b.cs	_test_fail
	b.vs	l150
	hlt #1
l150:
	b.vc	_test_fail
	b.ls	l251
	hlt #1
l251:
	b.hi	_test_fail
	b.lt	l252
	hlt #1
l252:
	b.ge	_test_fail
	b.le	l253
	hlt #1
l253:
	b.gt	_test_fail
	b.al	lp46
	hlt #1
lp46:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x60000000            	// #1610612736
	msr	nzcv, x0
	b.pl	l256
	hlt #1
l256:
	b.mi	_test_fail
	b.eq	l157
	hlt #1
l157:
	b.ne	_test_fail
	b.cs	l158
	hlt #1
l158:
	b.cc	_test_fail
	b.vc	l259
	hlt #1
l259:
	b.vs	_test_fail
	b.ls	l260
	hlt #1
l260:
	b.hi	_test_fail
	b.ge	l161
	hlt #1
l161:
	b.lt	_test_fail
	b.le	l262
	hlt #1
l262:
	b.gt	_test_fail
	b.al	lp55
	hlt #1
lp55:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x70000000            	// #1879048192
	msr	nzcv, x0
	b.pl	l265
	hlt #1
l265:
	b.mi	_test_fail
	b.eq	l166
	hlt #1
l166:
	b.ne	_test_fail
	b.cs	l167
	hlt #1
l167:
	b.cc	_test_fail
	b.vs	l168
	hlt #1
l168:
	b.vc	_test_fail
	b.ls	l269
	hlt #1
l269:
	b.hi	_test_fail
	b.lt	l270
	hlt #1
l270:
	b.ge	_test_fail
	b.le	l271
	hlt #1
l271:
	b.gt	_test_fail
	b.al	lp64
	hlt #1
lp64:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x80000000            	// #-2147483648
	msr	nzcv, x0
	b.mi	l174
	hlt #1
l174:
	b.pl	_test_fail
	b.ne	l275
	hlt #1
l275:
	b.eq	_test_fail
	b.cc	l276
	hlt #1
l276:
	b.cs	_test_fail
	b.vc	l277
	hlt #1
l277:
	b.vs	_test_fail
	b.ls	l278
	hlt #1
l278:
	b.hi	_test_fail
	b.lt	l279
	hlt #1
l279:
	b.ge	_test_fail
	b.le	l280
	hlt #1
l280:
	b.gt	_test_fail
	b.al	lp73
	hlt #1
lp73:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0x90000000            	// #-1879048192
	msr	nzcv, x0
	b.mi	l183
	hlt #1
l183:
	b.pl	_test_fail
	b.ne	l284
	hlt #1
l284:
	b.eq	_test_fail
	b.cc	l285
	hlt #1
l285:
	b.cs	_test_fail
	b.vs	l186
	hlt #1
l186:
	b.vc	_test_fail
	b.ls	l287
	hlt #1
l287:
	b.hi	_test_fail
	b.ge	l188
	hlt #1
l188:
	b.lt	_test_fail
	b.gt	l189
	hlt #1
l189:
	b.le	_test_fail
	b.al	lp82
	hlt #1
lp82:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xa0000000            	// #-1610612736
	msr	nzcv, x0
	b.mi	l192
	hlt #1
l192:
	b.pl	_test_fail
	b.ne	l293
	hlt #1
l293:
	b.eq	_test_fail
	b.cs	l194
	hlt #1
l194:
	b.cc	_test_fail
	b.vc	l295
	hlt #1
l295:
	b.vs	_test_fail
	b.hi	l196
	hlt #1
l196:
	b.ls	_test_fail
	b.lt	l297
	hlt #1
l297:
	b.ge	_test_fail
	b.le	l298
	hlt #1
l298:
	b.gt	_test_fail
	b.al	lp91
	hlt #1
lp91:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xb0000000            	// #-1342177280
	msr	nzcv, x0
	b.mi	l1101
	hlt #1
l1101:
	b.pl	_test_fail
	b.ne	l2102
	hlt #1
l2102:
	b.eq	_test_fail
	b.cs	l1103
	hlt #1
l1103:
	b.cc	_test_fail
	b.vs	l1104
	hlt #1
l1104:
	b.vc	_test_fail
	b.hi	l1105
	hlt #1
l1105:
	b.ls	_test_fail
	b.ge	l1106
	hlt #1
l1106:
	b.lt	_test_fail
	b.gt	l1107
	hlt #1
l1107:
	b.le	_test_fail
	b.al	lp100
	hlt #1
lp100:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xc0000000            	// #-1073741824
	msr	nzcv, x0
	b.mi	l1110
	hlt #1
l1110:
	b.pl	_test_fail
	b.eq	l1111
	hlt #1
l1111:
	b.ne	_test_fail
	b.cc	l2112
	hlt #1
l2112:
	b.cs	_test_fail
	b.vc	l2113
	hlt #1
l2113:
	b.vs	_test_fail
	b.ls	l2114
	hlt #1
l2114:
	b.hi	_test_fail
	b.lt	l2115
	hlt #1
l2115:
	b.ge	_test_fail
	b.le	l2116
	hlt #1
l2116:
	b.gt	_test_fail
	b.al	lp109
	hlt #1
lp109:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xd0000000            	// #-805306368
	msr	nzcv, x0
	b.mi	l1119
	hlt #1
l1119:
	b.pl	_test_fail
	b.eq	l1120
	hlt #1
l1120:
	b.ne	_test_fail
	b.cc	l2121
	hlt #1
l2121:
	b.cs	_test_fail
	b.vs	l1122
	hlt #1
l1122:
	b.vc	_test_fail
	b.ls	l2123
	hlt #1
l2123:
	b.hi	_test_fail
	b.ge	l1124
	hlt #1
l1124:
	b.lt	_test_fail
	b.le	l2125
	hlt #1
l2125:
	b.gt	_test_fail
	b.al	lp118
	hlt #1
lp118:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xe0000000            	// #-536870912
	msr	nzcv, x0
	b.mi	l1128
	hlt #1
l1128:
	b.pl	_test_fail
	b.eq	l1129
	hlt #1
l1129:
	b.ne	_test_fail
	b.cs	l1130
	hlt #1
l1130:
	b.cc	_test_fail
	b.vc	l2131
	hlt #1
l2131:
	b.vs	_test_fail
	b.ls	l2132
	hlt #1
l2132:
	b.hi	_test_fail
	b.lt	l2133
	hlt #1
l2133:
	b.ge	_test_fail
	b.le	l2134
	hlt #1
l2134:
	b.gt	_test_fail
	b.al	lp127
	hlt #1
lp127:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xf0000000            	// #-268435456
	msr	nzcv, x0
	b.mi	l1137
	hlt #1
l1137:
	b.pl	_test_fail
	b.eq	l1138
	hlt #1
l1138:
	b.ne	_test_fail
	b.cs	l1139
	hlt #1
l1139:
	b.cc	_test_fail
	b.vs	l1140
	hlt #1
l1140:
	b.vc	_test_fail
	b.ls	l2141
	hlt #1
l2141:
	b.hi	_test_fail
	b.ge	l1142
	hlt #1
l1142:
	b.lt	_test_fail
	b.le	l2143
	hlt #1
l2143:
	b.gt	_test_fail
	b.al	lp136
	hlt #1
lp136:
	mrs	x1, nzcv
	cmp	x0, x1
	b.ne	_test_fail
	mov	w0, #0xa0000000            	// #-1610612736
	mov	wsp, w0
	msr	nzcv, xzr
	b.pl	l2145
	hlt #1
l2145:
	b.mi	_test_fail
	b.ne	l2146
	hlt #1
l2146:
	b.eq	_test_fail
	b.cc	l2147
	hlt #1
l2147:
	b.cs	_test_fail
	b.vc	l2148
	hlt #1
l2148:
	b.vs	_test_fail
	b.ls	l2149
	hlt #1
l2149:
	b.hi	_test_fail
	b.ge	l1150
	hlt #1
l1150:
	b.lt	_test_fail
	b.gt	l1151
	hlt #1
l1151:
	b.le	_test_fail
	b.al	lp144
	hlt #1
lp144:
	mrs	x1, nzcv
	cmp	x1, xzr
	b.ne	_test_fail
	cmp	sp, x0
	b.ne	_test_fail
	hlt #0
_test_fail:
	hlt #1
_start_forw:
	b.al	_start_back
	hlt #1
