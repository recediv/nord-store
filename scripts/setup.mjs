import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { runProcess } from './process-tree.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
async function setup() {
  const backendEnv = resolve(root, 'apps/backend/.env')
  if (!existsSync(backendEnv)) {
    const example = readFileSync(resolve(root, 'apps/backend/.env.example'), 'utf8')
    writeFileSync(
      backendEnv,
      example
        .replace('nord-local-demo-jwt-change-for-production', randomBytes(32).toString('hex'))
        .replace('nord-local-demo-cookie-change-for-production', randomBytes(32).toString('hex')),
    )
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  for (const task of ['db:migrate', 'seed']) {
    await runProcess(npm, ['run', task], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  }
  const config = JSON.parse(readFileSync(resolve(root, '.runtime/store-config.json'), 'utf8'))
  const storefrontEnv = resolve(root, 'apps/storefront/.env.local')
  const previous = existsSync(storefrontEnv) ? readFileSync(storefrontEnv, 'utf8') : ''
  const retained = previous
    .split(/\r?\n/)
    .filter(
      (line) =>
        line &&
        !/^(?:VITE_(?:COMMERCE_MODE|MEDUSA_BACKEND_URL|MEDUSA_PUBLISHABLE_KEY)|NEXT_PUBLIC_(?:MEDUSA_BACKEND_URL|MEDUSA_PUBLISHABLE_KEY|DEFAULT_REGION|BASE_URL)|NODE_ENV)\s*=/.test(
          line,
        ),
    )
    .join('\n')
  writeFileSync(
    storefrontEnv,
    `${retained}${retained ? '\n' : ''}NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000\nNEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${config.publishableKey}\nNEXT_PUBLIC_BASE_URL=http://localhost:5180\n`,
  )
  console.log(
    'Next.js storefront ready. Run npm run dev:full. Storefront: http://localhost:5180/ · Medusa Admin: http://localhost:9000/app',
  )
}

try {
  await setup()
} catch (error) {
  console.error(error.message)
  process.exitCode = error.exitCode || 1
}
