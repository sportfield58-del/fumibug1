import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateSW } from 'workbox-build'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)
const publicDir = path.join(root, 'public')
const campoDir = path.join(publicDir, 'campo')

generateSW({
  globDirectory: publicDir,
  globPatterns: ['campo/icons/**/*.png', 'campo/manifest.json'],
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) =>
        request.mode === 'navigate' && url.pathname.startsWith('/campo'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'campo-shell',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: ({ request, url }) =>
        request.method === 'GET' &&
        (url.pathname.startsWith('/v1/field/today') ||
          url.pathname.startsWith('/v1/field/my-stock')),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'campo-reads',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
      },
    },
    {
      urlPattern: ({ request, url }) =>
        url.pathname.startsWith('/_next/static/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'campo-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: ({ request }) => request.destination === 'image',
      handler: 'CacheFirst',
      options: {
        cacheName: 'campo-images',
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
  ],
  swDest: path.join(campoDir, 'sw.js'),
  inlineWorkboxRuntime: true,
  sourcemap: false,
  mode: 'production',
}).then(({ count, size }) => {
  console.log(`Generated sw.js: ${count} files, ${size} bytes`)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
