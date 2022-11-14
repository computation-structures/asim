# usage: python3 build_verify.py
# produces verify.s
import sys,subprocess,os.path

import random

##################################################
## helper functions
##################################################

# generate random register number 0..31
def reg(r, sp = False):
    n = random.randint(0,31)
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
    """
    for r in ('X', 'W'):
        f.write('    %s %s, %s, #%d\n' %
                (opc, reg(r), reg(r), random.randint(0,63 if r=='X' else 31)))
    """
    f.write('\n')

##################################################
## build test program
##################################################

with open('temp.s','w') as f:
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
    gen_op2(f, 'mvn', include_rn = False, include_bitmask = False)
    gen_op2(f, 'orn', include_bitmask = False)
    gen_op2(f, 'orr')
    gen_shift(f, 'ror')
    gen_op2(f, 'tst', include_rd = False)

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

