import { defineConfig, loadEnv } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors:
        process.env.STORE_CORS ||
        'http://localhost:5180,http://127.0.0.1:5180,http://localhost:4173,http://127.0.0.1:4173',
      adminCors: process.env.ADMIN_CORS || 'http://localhost:9000,http://127.0.0.1:9000',
      authCors:
        process.env.AUTH_CORS ||
        'http://localhost:5180,http://127.0.0.1:5180,http://localhost:4173,http://127.0.0.1:4173,http://localhost:9000,http://127.0.0.1:9000',
      jwtSecret: process.env.JWT_SECRET || 'nord-local-demo-jwt-change-for-production',
      cookieSecret: process.env.COOKIE_SECRET || 'nord-local-demo-cookie-change-for-production',
    },
  },
  modules: [
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: './src/modules/optimized-file',
            id: 'local',
            options: {
              backend_url: `${(process.env.MEDUSA_PUBLIC_URL || 'http://localhost:9000').replace(/\/$/, '')}/static`,
            },
          },
        ],
      },
    },
  ],
})
