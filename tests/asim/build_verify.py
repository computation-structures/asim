# build pgm_verify.s
import sys,subprocess,os.path

if len(sys.argv) < 2:
    print('usage: build_verify.py pgm.s')
pgm = sys.argv[1].split('.')[0]

# run asm command on source file
subprocess.run(('as -o %s.o %s.s' % (pgm,pgm)).split(' '))

# read .o output from assembler
with open('%s.o' % pgm,'rb') as f:
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

with open('%s_verify.s' % pgm,'w') as f:
    for i in range(0, len(obj_as_int), 4):
        values = ['0x%08x' % obj_as_int[i + j]
                  for j in range(4)
                  if i + j < len(obj_as_int)]
        f.write('.averify 0x%08x,%s\n' % (4*i, ','.join(values)))

