import { Context } from '@netlify/functions'
const { exec } = require('child_process')
import path from 'path'
import fs from 'fs/promises'

export default async (request: Request, context: Context) => {
  const res = exec(
    `${path.join(process.cwd())}/bin/rasm ./asm/main.asm -o pixsaur`,
    async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`)
        return new Response(`Error: ${error.message}`, { status: 500 })
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`)
        return new Response(`Error: ${stderr}`, { status: 500 })
      }

      const out = await fs.readFile(
        path.join(process.cwd(), 'pixsaur.dsk'),
        'binary'
      )

      console.log('here', out)
      return new Response(out)
    }
  )

  console.log('res', res)
}
