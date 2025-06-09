import fs from 'node:fs/promises'

import { addAmsdosFilesToDsk } from './add-file.ts'
import { createDsk } from './create-dsk.ts'

const blankDsk = createDsk('PIXSAUR')

// dskWithFiles now contains both files, AMSDOS-compatible, with extents if needed
await fs.writeFile('disk.dsk', blankDsk, { encoding: null })
