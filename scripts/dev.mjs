import { fileURLToPath } from 'node:url'
import { childExitCode, signalExitCode, startProcess } from './process-tree.mjs'

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = []
let shutdown
function stop(code, signal = 'SIGTERM') {
  if (shutdown) return shutdown
  process.exitCode = code
  shutdown = (async () => {
    const results = await Promise.allSettled(children.map((child) => child.stop(signal)))
    for (const result of results)
      if (result.status === 'rejected') {
        console.error(result.reason.message)
        process.exitCode = 1
      }
    await Promise.all(children.map((child) => child.completion))
  })()
  return shutdown
}
const interrupt = () => {
  void stop(signalExitCode('SIGINT'), 'SIGINT')
}
const terminate = () => {
  void stop(signalExitCode('SIGTERM'))
}
process.on('SIGINT', interrupt)
process.on('SIGTERM', terminate)
try {
  for (const args of [
    ['run', 'dev', '--workspace', '@nord/backend'],
    ['--prefix', 'apps/storefront', 'run', 'dev'],
  ])
    children.push(
      startProcess(npm, args, {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        shell: process.platform === 'win32',
      }),
    )
  const first = await Promise.race(children.map((child) => child.completion))
  if (first.error) console.error(first.error.message)
  await stop(childExitCode(first))
} catch (error) {
  console.error(error.message)
  await stop(1)
} finally {
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', terminate)
}
