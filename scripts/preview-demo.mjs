import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const root = fileURLToPath(new URL('../apps/storefront/out-demo/', import.meta.url))
const { basePath } = JSON.parse(await fs.readFile(path.join(root, 'demo-build.json'), 'utf8'))
const mount = basePath.replace(/\/$/, '')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.rsc': 'text/x-component; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

async function sendFile(request, response, filename, status = 200) {
  const info = await fs.stat(filename)
  const extension = path.extname(filename)
  const relative = path.relative(root, filename).split(path.sep).join('/')
  const url = new URL(request.url, 'http://localhost')
  const immutable = relative.startsWith('_next/static/') || url.searchParams.has('v')
  const document = ['.html', '.txt', '.rsc', '.json'].includes(extension)
  response.statusCode = status
  response.setHeader('Content-Type', mime[extension] || 'application/octet-stream')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader(
    'Cache-Control',
    status !== 200 || document
      ? 'no-cache'
      : immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400',
  )
  const etag = `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`
  response.setHeader('ETag', etag)
  response.setHeader('Last-Modified', info.mtime.toUTCString())
  if (status === 200 && request.headers['if-none-match'] === etag) {
    response.statusCode = 304
    response.end()
    return
  }
  response.setHeader('Content-Length', info.size)
  if (request.method === 'HEAD') response.end()
  else await pipeline(createReadStream(filename), response)
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end()
      return
    }
    const url = new URL(request.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)
    if (mount && (pathname === '/' || pathname === mount)) {
      response.writeHead(302, { Location: `${basePath}${url.search}` }).end()
      return
    }
    if (mount && !pathname.startsWith(`${mount}/`)) {
      response
        .writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('Страница не найдена.')
      return
    }
    const relative = pathname.slice(mount.length).replace(/^\/+/, '')
    const filename = path.resolve(root, relative)
    const within = path.relative(root, filename)
    if (
      relative.includes('\\') ||
      relative.includes('\0') ||
      within === '..' ||
      within.startsWith(`..${path.sep}`) ||
      path.isAbsolute(within)
    ) {
      response.writeHead(403).end()
      return
    }
    let target = filename
    let info = await fs.stat(target).catch((error) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error
      return null
    })
    if (info?.isDirectory()) {
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: `${url.pathname}/${url.search}` }).end()
        return
      }
      target = path.join(target, 'index.html')
      info = await fs.stat(target).catch((error) => {
        if (error.code !== 'ENOENT') throw error
        return null
      })
    }
    if (info?.isFile()) await sendFile(request, response, target)
    else await sendFile(request, response, path.join(root, '404.html'), 404)
  } catch (error) {
    if (!response.headersSent) {
      response.writeHead(error instanceof URIError ? 400 : 500, {
        'Content-Type': 'text/plain; charset=utf-8',
      })
      response.end(error instanceof URIError ? 'Некорректный URL.' : 'Не удалось открыть файл.')
    } else response.destroy(error)
  }
})

const port = Number(process.env.PORT || 4174)
const host = process.env.HOST || '127.0.0.1'
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Некорректный PORT.')
server.listen(port, host, () => console.log(`NORD JSON demo: http://${host}:${port}${basePath}`))
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close())
