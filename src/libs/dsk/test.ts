import fs from 'node:fs/promises'
import { createDsk } from './create.ts'

const dsk = createDsk('Pixsaur')
await fs.writeFile('disk.dsk', dsk, { encoding: 'binary' })
