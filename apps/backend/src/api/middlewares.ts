import { defineMiddlewares } from '@medusajs/framework/http'
import {
  normalizeAdminHandle,
  normalizeAdminProductBatchHandles,
} from './middlewares/normalize-handles'

export default defineMiddlewares({
  routes: [
    {
      matcher: '/admin/products',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('title', true)],
    },
    {
      matcher: '/admin/products/:id',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('title')],
    },
    {
      matcher: '/admin/products/batch',
      methods: ['POST'],
      middlewares: [normalizeAdminProductBatchHandles],
    },
    {
      matcher: '/admin/product-categories',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('name', true)],
    },
    {
      matcher: '/admin/product-categories/:id',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('name')],
    },
    {
      matcher: '/admin/collections',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('title', true)],
    },
    {
      matcher: '/admin/collections/:id',
      methods: ['POST'],
      middlewares: [normalizeAdminHandle('title')],
    },
  ],
})
