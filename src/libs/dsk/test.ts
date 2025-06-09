import fs from 'node:fs/promises'

import { createBlankDSK } from './create-dsk.ts'

const blankDsk = createBlankDSK('PIXSAUR')

// dskWithFiles now contains both files, AMSDOS-compatible, with extents if needed
await fs.writeFile('disk.dsk', blankDsk, { encoding: null })
