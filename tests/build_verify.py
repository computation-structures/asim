# usage: python3 build_verify.py
# produces verify.s
import sys,subprocess,os.path

import random

##################################################
## helper functions
##################################################

# generate random register number 0..31
def reg(r, sp = False, zr = True):
    n = random.randint(0,31 if zr else 30)
    if n == 31: return ('SP' if r=='X' else 'WSP') if sp else ('%sZR' % r)
    else: return '%s%d' % (r,n)

# generate statements with N registers
def gen_regs(f, opc, N, size = ['X', 'W']):
    for r in size:
        f.write('    %s %s\n' % (opc, ', '.join(reg(r)
                                                for _ in range(N))))
    f.write('\n')

# generate statements with op2 second operands
def gen_op2(f, opc, spd = False, spn = False, arithmetic = False,
            include_rd = True, include_rn = True,
            include_extended_register = True,
            include_immediate = True, include_bitmask = True):
    for r in ('X', 'W'):
        # register
        f.write('    %s %s%s%s\n' %
                (opc,
                 ('%s, ' % reg(r, sp=spd)) if include_rd else '',
                 ('%s, ' % reg(r, sp=spn)) if include_rn else '',
                 reg(r)))

        # stack pointer
        if spd and include_rd:
            f.write('    %s %s, %s, %s\n' %
                    (opc, 'SP' if r=='X' else 'WSP', reg(r, sp=spn), reg(r)))
        if spn and include_rn:
            f.write('    %s %s%s, %s\n' %
                    (opc, ('%s, ' % reg(r, sp=spd)) if include_rd else '',
                     'SP' if r=='X' else 'WSP', reg(r)))

        # shifted register
        for shift in ('LSL', 'LSR', 'ASR') if arithmetic else ('LSL', 'LSR', 'ASR', 'ROR'):
            f.write('    %s %s%s%s, %s #%d\n' %
                    (opc,
                     ('%s, ' % reg(r)) if include_rd else '',
                     ('%s, ' % reg(r)) if include_rn else '',
                     reg(r),
                     shift, random.randint(0,63 if r=='X' else 31)))

        if arithmetic:
            # extended register
            if include_extended_register:
                for ext in ('SXTB','UXTB','SXTH','UXTH','SXTW','UXTW','SXTX','UXTX'):
                    if r=='W' and ext[-1]=='X': continue
                    f.write('    %s %s%s%s, %s #%d\n' %
                            (opc,
                             ('%s, ' % reg(r, sp=spd)) if include_rd else '',
                             ('%s, ' % reg(r, sp=spn)) if include_rn else '',
                             reg('X' if ext[-1]=='X' else 'W'),
                             ext, random.randint(0,3)))
            # immediate
            if include_immediate:
                f.write('    %s %s%s#%d\n' %
                        (opc,
                         ('%s, ' % reg(r, sp=spd)) if include_rd else '',
                         ('%s, ' % reg(r, sp=spn)) if include_rn else '',
                         random.randint(0,4095)))
                f.write('    %s %s%s#%d, LSL #12\n' %
                        (opc,
                         ('%s, ' % reg(r, sp=spd)) if include_rd else '',
                         ('%s, ' % reg(r, sp=spn)) if include_rn else '',
                         random.randint(0,4095)))
        elif include_bitmask:
            allow_sp = opc in ('and','eor','orr')

            # bitmask immediate
            if r == 'X':
                masks = (0xAAAAAAAAAAAAAAAA,
                         0x6666666666666666,
                         0x3E3E3E3E3E3E3E3E,
                         0x00FE00FE00FE00FE,
                         0x0F0000000F000000,
                         0x003FFFFFFC000000)
            else:
                masks = (0xAAAAAAAA,
                         0x66666666,
                         0x3E3E3E3E,
                         0x00FE00FE,
                         0x0F000000)
            for mask in masks:
                f.write('    %s %s%s#0x%x\n' %
                        (opc,
                         ('%s, ' % reg(r, sp=allow_sp)) if include_rd else '',
                         ('%s, ' % reg(r)) if include_rn else '',
                         mask))

    f.write('\n')

def gen_muladd(f, opc, include_xa = True):
    f.write('    %s %s, %s, %s%s\n' % (
        opc,
        reg('X'),  reg('W'),  reg('W'),
        (', %s' % reg('X')) if include_xa else ''
        ))
    f.write('\n')

def gen_shift(f, opc):
    gen_regs(f, opc, 3)
    for r in ('X', 'W'):
        f.write('    %s %s, %s, #%d\n' %
                (opc, reg(r), reg(r), random.randint(0,63 if r=='X' else 31)))
    f.write('\n')

def gen_movknz(f, opc):
    for r in ('X','W'):
        for shift in (0,16,32,48) if r=='X' else (0,16):
            f.write('    %s %s, #0x%x, LSL #%d\n' %
                    (opc, reg(r), random.randint(0,(1 << 16) - 1), shift))
    f.write('\n')

def gen_csxx(f, opc, n=3, alnv = True, zr = True):
    for r in ('X','W'):
        for cond in ['eq', 'ne', 'cs', 'hs', 'cc', 'lo',
                     'mi', 'pl', 'vs', 'vc', 'hi', 'ls',
                     'ge', 'lt', 'gt', 'le'] + (['al','nv'] if alnv else []):
            f.write('    %s %s, %s\n' %
                    (opc, ', '.join(reg(r, zr=zr) for _ in range(n)), cond))
    f.write('\n')

def gen_ccxx(f, opc):
    for r in ('X','W'):
        for cond in ['eq', 'ne', 'cs', 'hs', 'cc', 'lo',
                     'mi', 'pl', 'vs', 'vc', 'hi', 'ls',
                     'ge', 'lt', 'gt', 'le', 'al','nv']:
            f.write('    %s %s, %s, #%d, %s\n' %
                    (opc, reg(r), reg(r), random.randint(0,15), cond))
            f.write('    %s %s, #%d, #%d, %s\n' %
                    (opc, reg(r), random.randint(0,31), random.randint(0,15), cond))
    f.write('\n')
    
def gen_ldstu(f, opc, size = ['X', 'W']):
    for r in size:
        f.write('    %s %s,[%s]\n' % (opc, reg(r), reg('X', sp=True)))
        f.write('    %s %s,[%s, #%d]\n' % (opc, reg(r), reg('X', sp=True), random.randint(-256,-1)))
        f.write('    %s %s,[SP, #%d]\n' % (opc, reg(r), random.randint(0,255)))

def gen_ldst(f, opc, size = ['X', 'W'], scale = None):
    for r in size:
        if scale is None:
            xscale = 2 if (r=='W') else 3
        else:
            xscale = scale
        #f.write('; r=%s, scale=%s, xscale=%s\n' % (r,scale,xscale))

        # no offset
        f.write('    %s %s,[%s]\n' % (opc, reg(r), reg('X', sp=True)))
        f.write('    %s %s,[SP]\n' % (opc, reg(r)))

        # scaled unsigned offset
        f.write('    %s %s,[%s, #%d]\n' % (opc, reg(r), reg('X', sp=True), random.randint(0, 4095) << xscale))
        f.write('    %s %s,[SP, #%d]\n' % (opc, reg(r), random.randint(0, 4095) << xscale))

        # post-index (ensure Xd, Xn are different regs)
        Xd = reg(r)
        while True:
            Xn = reg('X', sp=True)
            if Xd[1:] != Xn[1:]: break
        f.write('    %s %s,[%s], #%d\n' % (opc, Xd, Xn, random.randint(-256, 255)))
        f.write('    %s %s,[SP], #%d\n' % (opc, reg(r), random.randint(-256, 255)))

        # pre-index (ensure Xd, Xn are different regs)
        Xd = reg(r)
        while True:
            Xn = reg('X', sp=True)
            if Xd[1:] != Xn[1:]: break
        f.write('    %s %s,[%s, #%d]!\n' % (opc, Xd, Xn, random.randint(-256,255)))
        f.write('    %s %s,[SP, #%d]!\n' % (opc, reg(r), random.randint(-256,255)))

        # extended register
        #f.write('    %s %s,[%s, %s]\n' % (opc, reg(r), reg('X', sp=True), reg('X')))
        #f.write('    %s %s,[%s, %s]\n' % (opc, reg(r), reg('X', sp=True), reg('W')))
        for extend in ('UXTW', 'LSL', 'SXTW', 'SXTX'):
            rr = 'W' if extend in ('UXTW', 'SXTW') else 'X'
            if extend != 'LSL':
                f.write('    %s %s,[%s, %s, %s]\n' %
                        (opc, reg(r), reg('X', sp=True), reg(rr), extend))
            f.write('    %s %s,[%s, %s, %s #0]\n' %
                    (opc, reg(r), reg('X', sp=True), reg(rr), extend))
            f.write('    %s %s,[%s, %s, %s #%d]\n' %
                    (opc, reg(r), reg('X', sp=True), reg(rr), extend, xscale))

    f.write('\n')

def gen_ldstp(f, opc, size = ['X','W']):
    for r in size:
        xscale = 2 if (opc=='ldpsw' or r=='W') else 3

        Xd = reg(r)
        while True:
            Xdd = reg(r)
            if Xdd != Xd: break

        # no offset
        f.write('    %s %s,%s,[%s]\n' % (opc, Xd, Xdd, reg('X', sp=True)))
        f.write('    %s %s,%s,[SP]\n' % (opc, Xd, Xdd))

        # signed offset
        Xd = reg(r)
        while True:
            Xdd = reg(r)
            if Xdd != Xd: break

        f.write('    %s %s,%s,[%s, #%d]\n' % (opc, Xd, Xdd, reg('X', sp=True),
                                              random.randint(-64,63) << xscale))
        f.write('    %s %s,%s,[SP, #%d]\n' % (opc, Xd, Xdd,
                                              random.randint(-64,63) << xscale))

        # post-index (ensure Xd, Xn are different regs)
        Xd = reg(r)
        while True:
            Xdd = reg(r)
            if Xdd != Xd: break

        while True:
            Xn = reg('X', sp=True)
            if Xd[1:] != Xn[1:] and Xdd[1:] != Xn[1:] : break
        f.write('    %s %s,%s,[%s], #%d\n' % (opc, Xd, Xdd, Xn,
                                              random.randint(-64,63) << xscale))
        f.write('    %s %s,%s,[SP], #%d\n' % (opc, reg(r), reg(r),
                                              random.randint(-64,63) << xscale))

        # pre-index (ensure Xd, Xn are different regs)
        Xd = reg(r)
        while True:
            Xdd = reg(r)
            if Xdd != Xd: break

        while True:
            Xn = reg('X', sp=True)
            if Xd[1:] != Xn[1:] and Xdd[1:] != Xn[1:] : break
        f.write('    %s %s,%s,[%s, #%d]!\n' % (opc, Xd, Xdd, Xn,
                                              random.randint(-64,63) << xscale))
        f.write('    %s %s,%s,[SP, #%d]!\n' % (opc, reg(r), reg(r),
                                              random.randint(-64,63) << xscale))

    f.write('\n')

def gen_bfm(f, opc):
    for r in ('X','W'):
        for _ in range(5):
            immr = random.randint(0, 63 if r=='X' else 31)
            imms = random.randint(0, 63 if r=='X' else 31)
            f.write('    %s %s, %s, #%d, #%d\n' %
                    (opc, reg(r), reg(r), immr, imms))
            f.write('    %s %s, %s, #%d, #%d\n' %
                    (opc, reg(r), reg(r), imms, immr))
    f.write('\n')

def gen_bf(f, opc):
    for r in ('X','W'):
        for _ in range(3):
            lsb = random.randint(0, 63 if r=='X' else 31)
            width = random.randint(1, (64 if r=='X' else 32) - lsb)
            f.write('    %s %s%s, #%d, #%d\n' %
                    (opc, reg(r), (', %s' % reg(r)) if opc != 'bfc' else '', lsb, width))

##################################################
## build test program
##################################################

with open('temp.s','w') as f:
    f.write('// This program is generated by build_verify.py\n\n')
    f.write('// The generator outputs statements for all supported\n')
    f.write('// opcodes using the different operand formats that\n')
    f.write('// are legal for that opcode.\n\n')
    f.write('// When you click Assemble, the assembler will report any\n')
    f.write('// differences between the binary generated by ASim and the\n')
    f.write('// the binary generated by Apple\'s M1 assembler.\n\n')
    f.write('// This program is NOT intended to be executed!.\n\n')

    f.write('start:\n')

    # arithmetic instructions
    gen_regs(f, 'adc', 3)
    gen_regs(f, 'adcs', 3)
    gen_op2(f, 'add', spd = True, spn = True, arithmetic = True)
    gen_op2(f, 'adds', spn = True, arithmetic = True)
    #f.write('    adr %s, start\n' % reg('X'))   # xtools complains about relocation error
    #f.write('    adrp %s, start\n' % reg('X'))
    gen_op2(f, 'cmn', spd = True, spn = True, arithmetic = True, include_rd = False)
    gen_op2(f, 'cmp', spd = True, spn = True, arithmetic = True, include_rd = False)
    gen_regs(f, 'madd', 4)
    gen_regs(f, 'mneg', 3)
    gen_regs(f, 'msub', 4)
    gen_regs(f, 'mul', 3)
    gen_op2(f, 'neg', arithmetic = True, include_rn = False,
            include_extended_register = False, include_immediate = False)
    gen_op2(f, 'negs', arithmetic = True, include_rn = False,
            include_extended_register = False, include_immediate = False)
    gen_regs(f, 'ngc', 2)
    gen_regs(f, 'ngcs', 2)
    gen_regs(f, 'sbc', 3)
    gen_regs(f, 'sbcs', 3)
    gen_regs(f, 'sdiv', 3)
    gen_muladd(f, 'smaddl')
    gen_muladd(f, 'smnegl', include_xa = False)
    gen_muladd(f, 'smsubl')
    gen_regs(f, 'smulh', 3, size=['X'])
    gen_muladd(f, 'smull', include_xa = False)
    gen_op2(f, 'sub', spd = True, spn = True, arithmetic = True)
    gen_op2(f, 'subs', spn = True, arithmetic = True)
    gen_regs(f, 'udiv', 3)
    gen_muladd(f, 'umaddl')
    gen_muladd(f, 'umnegl', include_xa = False)
    gen_muladd(f, 'umsubl')
    gen_regs(f, 'umulh', 3, size=['X'])
    gen_muladd(f, 'umull', include_xa = False)

    # logical and move instructions
    gen_op2(f, 'and')
    gen_op2(f, 'ands')
    gen_shift(f, 'asr')
    gen_op2(f, 'bic', include_bitmask = False)
    gen_op2(f, 'bics', include_bitmask = False)
    gen_op2(f, 'eon', include_bitmask = False)
    gen_op2(f, 'eor')
    gen_shift(f, 'lsl')
    gen_shift(f, 'lsr')

    f.write('    mov x1,x2\n')
    f.write('    mov sp,x3\n')
    f.write('    mov x4,sp\n')
    f.write('    mov x5,#-0x8765\n')
    f.write('    mov x6,#0x12340000\n')
    f.write('    mov x7,#0xFEDC00000000\n')
    f.write('    mov x8,#0x7654000000000000\n')
    f.write('    mov x9,#0xF83FF83FF83FF83F\n')
    f.write('    mov w1,22\n')
    f.write('    mov wsp,w3\n')
    f.write('    mov w4,wsp\n')
    f.write('    mov w5,#-0x8765\n')
    f.write('    mov w6,#0x12340000\n')
    f.write('    mov w9,#0xF83FF83F\n')
    f.write('\n')

    gen_movknz(f, 'movk')
    gen_movknz(f, 'movn')
    gen_movknz(f, 'movz')
    gen_op2(f, 'mvn', include_rn = False, include_bitmask = False)
    gen_op2(f, 'orn', include_bitmask = False)
    gen_op2(f, 'orr')
    gen_shift(f, 'ror')
    gen_op2(f, 'tst', include_rd = False)

    # branches
    for opc in ('b',
                'b.eq', 'b.ne', 'b.cs', 'b.hs', 'b.cc', 'b.lo',
                'b.mi', 'b.pl', 'b.vs', 'b.vc', 'b.hi', 'b.ls',
                'b.ge', 'b.lt', 'b.gt', 'b.le', 'b.al',
                'bl'):
        f.write('    %s start\n    %s end\n' % (opc, opc))
    f.write('    blr %s\n' % reg('X'))
    f.write('    br %s\n' % reg('X'))
    for opc in ('cbnz', 'cbz'):
        for r in ('X','W'):
            f.write('    %s %s,start\n    %s %s,end\n' % (opc, reg(r), opc, reg(r)))
    f.write('    ret\n    ret %s\n' % reg('X'))
    for opc in ('tbnz', 'tbz'):
        for r in ('X','W'):
            f.write('    %s %s,#%d,start\n    %s %s,#%d,end\n' %
                    (opc, reg(r), random.randint(0,63 if r=='X' else 31),
                     opc, reg(r), random.randint(0,63 if r=='X' else 31)))
    f.write('\n')

    gen_csxx(f, 'cinc', n=2, alnv = False, zr = False)
    gen_csxx(f, 'cinv', n=2, alnv = False, zr = False)
    gen_csxx(f, 'cneg', n=2, alnv = False, zr = False)
    gen_csxx(f, 'csel')
    gen_csxx(f, 'cset', n=1, alnv = False)
    gen_csxx(f, 'csetm', n=1, alnv = False)
    gen_csxx(f, 'csinc')
    gen_csxx(f, 'csinv')
    gen_csxx(f, 'csneg')
    gen_ccxx(f, 'ccmn')
    gen_ccxx(f, 'ccmp')

    gen_ldstu(f, 'ldur')
    gen_ldstu(f, 'ldurb', size = ['W'])
    gen_ldstu(f, 'ldurh', size = ['W'])
    gen_ldstu(f, 'ldursb')
    gen_ldstu(f, 'ldursh')
    gen_ldstu(f, 'ldursw', size = ['X'])
    gen_ldstu(f, 'stur')
    gen_ldstu(f, 'sturb', size = ['W'])
    gen_ldstu(f, 'sturh', size = ['W'])
    f.write('\n')

    gen_ldst(f, 'ldr')
    gen_ldst(f, 'ldrb', size = ['W'], scale=0)
    gen_ldst(f, 'ldrh', size = ['W'], scale=1)
    gen_ldst(f, 'ldrsb', scale=0)
    gen_ldst(f, 'ldrsh', scale=1)
    gen_ldst(f, 'ldrsw', size = ['X'], scale=2)
    gen_ldst(f, 'str')
    gen_ldst(f, 'strb', size = ['W'], scale=0)
    gen_ldst(f, 'strh', size = ['W'], scale=1)

    f.write('    ldr %s, start\n' % reg('X'))
    f.write('    ldr %s, end\n' % reg('W'))
    f.write('    ldrsw %s, start\n' % reg('X'))
    f.write('\n')

    gen_ldstp(f, 'ldp')
    gen_ldstp(f, 'ldpsw', size=['X'])
    gen_ldstp(f, 'stp')

    gen_bfm(f, 'bfm')
    gen_bfm(f, 'sbfm')
    gen_bfm(f, 'ubfm')

    gen_bf(f, 'bfxil')
    gen_bf(f, 'sbfiz')
    gen_bf(f, 'sbfx')
    gen_bf(f, 'bfc')
    gen_bf(f, 'bfi')
    gen_bf(f, 'bfxil')
    gen_bf(f, 'ubfiz')
    gen_bf(f, 'ubfx')
    f.write('\n')

    f.write('    extr %s, %s, %s, #%d\n' %
            (reg('W'), reg('W'), reg('W'), random.randint(0,31)))
    f.write('    extr %s, %s, %s, #%d\n' %
            (reg('X'), reg('X'), reg('X'), random.randint(0,63)))
    f.write('\n')

    for opc in ('sxtb', 'sxth', 'sxtw', 'uxtb','uxth'):
        if opc not in ('uxtb', 'uxth'):
            f.write('    %s %s, %s\n' % (opc, reg('X'), reg('W')))
        if opc != 'sxtw':
            f.write('    %s %s, %s\n' % (opc, reg('W'), reg('W')))
    f.write('\n')

    gen_regs(f, 'cls', N = 2)
    gen_regs(f, 'clz', N = 2)
    gen_regs(f, 'rbit', N = 2)
    gen_regs(f, 'rev', N = 2)
    gen_regs(f, 'rev16', N = 2)
    gen_regs(f, 'rev32', N = 2, size = ['X'])

    f.write('end:\n')

with open('temp.s','r') as f:
    pgm = f.read()

##################################################
## assemble test program
##################################################

# run asm command on source file
subprocess.run(('as -o temp.o temp.s'.split(' ')))

# read .o output from assembler
with open('temp.o','rb') as f:
    obj = f.read()

# .o format
# https://opensource.apple.com/source/xnu/xnu-7195.81.3/EXTERNAL_HEADERS/mach-o/loader.h.auto.html
# 0x00: 0xfeedfacf => magic: 64-bit big-endian magic number
# 0x04: 0x0100000c => cputype: 64-bit ARM compatible CPUS
# 0x08: 0x00000000 => cpusubtype
# 0x0C: 0x00000001 => filetype
# 0x10: ox00000004 => ncmds
# 0x14: 0x00000118 => sizeofcmds  (0x118 + 0x20 = 0x138)
# 0x18: 0x00000000 => flags 
# 0x1C: 0x00000000 => reserved

# 0x20: 0x00000019 => cmd: LC_SEGMENT_64
# 0x24: 0x00000098 => cmdsize
# 0x28: 0x00000000 0x00000000 0x00000000 0x00000000 => segname[16]
# 0x38: 0x00000000 0x00000000 => vmaddr
# 0x40: 0x00000030 0x00000000 => vmsize
# 0x48: 0x00000138 0x00000000 => fileoff
# 0x50: 0x00000030 0x00000000 => filesize
# 0x58: 0x00000007 => max VM protection
# 0x5C: 0x00000007 => min VM protection
# 0x60: 0x00000001 => nsects
# 0x64: 0x00000000 => flags

# 0xB8: 0x00000032 => cmd: LC_BUILD_VERSION
# 0xBC: 0x00000018 => cmdsize

# 0xD0: 0x00000002 => cmd: LC_SYM_TAB
# 0xD4: 0x00000018 => cmdsize

# 0xE8: 0x0000000b => cmd: LC_DYSYMTAB
# 0xEC: 0x00000050 => cmdsize

# 0x138: ...

offset = int.from_bytes(obj[0x48:0x50], byteorder='little')
length = int.from_bytes(obj[0x50:0x58], byteorder='little')
print(offset,length)


# extract binary for assembled instructions
obj_as_int = [int.from_bytes(obj[i:i+4], byteorder='little') for i in range(offset, offset+length, 4)]

with open('verify.s','w') as f:
    f.write(pgm)
    f.write('\n')
    for i in range(0, len(obj_as_int), 4):
        values = ['0x%08x' % obj_as_int[i + j]
                  for j in range(4)
                  if i + j < len(obj_as_int)]
        f.write('.averify 0x%08x,%s\n' % (4*i, ','.join(values)))

