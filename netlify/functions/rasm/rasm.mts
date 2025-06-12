import { Context } from '@netlify/functions'
const { spawn } = require('child_process')
import path from 'path'

export default (request: Request, context: Context) => {
  const rasm = spawn(path.join(process.cwd(), 'bin', 'rasm'), [
    path.join(process.cwd(), 'asm', 'main.asm'),
    '-o',
    'pixsaur'
  ])

  rasm.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`)
  })

  rasm.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`)
  })

  rasm.on('error', (error) => {
    console.log(`error: ${error.message}`)
  })

  rasm.on('close', (code) => {
    console.log(`child process exited with code ${code}`)
  })

  const url = new URL(request.url)
  const subject = url.searchParams.get('name') || 'World'

  return new Response(`Hello ${subject}`)
}
