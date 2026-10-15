import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runProcess } from './process-tree.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const apps = path.join(root, 'apps')
const storefront = path.join(apps, 'storefront')
const output = path.join(storefront, 'out-demo')
const requestedBase = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '/'
const base = requestedBase === '/' ? '' : `/${requestedBase.replace(/^\/+|\/+$/g, '')}`
if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(base) && base !== '')
  throw new Error('BASE_PATH должен быть / либо путём вида /repository/.')

const temporary = await fs.mkdtemp(path.join(apps, '.nord-demo-build-'))
const modulesLink = path.join(temporary, 'node_modules')

async function copyDemoRoutes(source, destination) {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const filename = path.join(source, entry.name)
    if (entry.isDirectory()) {
      await copyDemoRoutes(filename, path.join(destination, entry.name))
    } else if (entry.isFile() && entry.name.endsWith('.demo.tsx')) {
      await fs.mkdir(destination, { recursive: true })
      await fs.copyFile(
        filename,
        path.join(destination, entry.name.replace(/\.demo\.tsx$/, '.tsx')),
      )
    }
  }
}

try {
  // Isolate Next 15's export build to preserve native output and relative imports.
  // Explicit demo flags replace environment files.
  const source = path.join(storefront, 'src')
  const nativeApp = path.join(source, 'app')
  const middleware = path.join(source, 'middleware.ts')
  await fs.cp(source, path.join(temporary, 'src'), {
    recursive: true,
    filter: (filename) => filename !== nativeApp && filename !== middleware,
  })
  // Next's app loader requires conventional page.tsx/layout.tsx filenames.
  await copyDemoRoutes(nativeApp, path.join(temporary, 'src/app'))
  for (const name of [
    'public',
    'package.json',
    'tsconfig.json',
    'next-env.d.ts',
    'next.config.js',
    'check-env-variables.js',
    'postcss.config.js',
    'tailwind.config.js',
  ]) {
    await fs.cp(path.join(storefront, name), path.join(temporary, name), { recursive: true })
  }
  await fs.cp(path.join(storefront, 'demo-assets'), path.join(temporary, 'public'), {
    recursive: true,
  })
  await fs.symlink(
    path.join(storefront, 'node_modules'),
    modulesLink,
    process.platform === 'win32' ? 'junction' : 'dir',
  )

  await runProcess(
    process.execPath,
    [path.join(storefront, 'node_modules/next/dist/bin/next'), 'build', temporary],
    {
      cwd: temporary,
      env: {
        ...process.env,
        NORD_STATIC_DEMO: '1',
        NEXT_PUBLIC_COMMERCE_MODE: 'demo',
        BASE_PATH: base || '/',
        NEXT_PUBLIC_BASE_PATH: base,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  )

  const exported = path.join(temporary, '.next-demo')
  await fs.access(path.join(exported, 'index.html'))
  await fs.writeFile(path.join(exported, '.nojekyll'), '')
  await fs.writeFile(
    path.join(exported, 'demo-build.json'),
    JSON.stringify(
      {
        basePath: `${base}/`,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  )
  // Restrict cleanup to the fixed storefront output directory.
  if (path.resolve(output) !== path.join(storefront, 'out-demo'))
    throw new Error('Некорректный output.')
  await fs.rm(output, { recursive: true, force: true })
  await fs.rename(exported, output)
  console.log(`NORD JSON demo: ${output} (BASE_PATH=${base || '/'})`)
} finally {
  // Unlink dependencies before recursive cleanup.
  const link = await fs.lstat(modulesLink).catch((error) => {
    if (error.code !== 'ENOENT') throw error
    return null
  })
  if (link) {
    if (!link.isSymbolicLink())
      throw new Error('node_modules временной сборки должен быть ссылкой.')
    await fs.unlink(modulesLink)
  }
  if (
    path.dirname(path.resolve(temporary)) !== apps ||
    !path.basename(temporary).startsWith('.nord-demo-build-')
  )
    throw new Error('Небезопасный путь временной сборки.')
  await fs.rm(temporary, { recursive: true, force: true })
}
