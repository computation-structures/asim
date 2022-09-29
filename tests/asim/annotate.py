# add assembly results to .s file
import sys,subprocess,os.path

if len(sys.argv) < 2:
    print('usage: annotate pgm.s')
pgm = sys.argv[1].split('.')[0]

# run asm command on source file
subprocess.run(('as -o %s.o %s.s' % (pgm,pgm)).split(' '))

# read in asm file
with open('%s.s' % pgm,'r') as f:
    asm = f.read().split('\n')

# read .o output from assembler
with open('%s.o' % pgm,'rb') as f:
    obj = f.read()

# extract binary for assembled instructions
obj_as_int = [int.from_bytes(obj[i:i+4], byteorder='little') for i in range(0x138, len(obj), 4)]

index = 0
for line in asm:
    if line:
        line = line.split('  //')[0]   # remove old annotation
        print('%s  // %08x' % (line,obj_as_int[index]))
        index += 1
    else:
        print(line)
        
