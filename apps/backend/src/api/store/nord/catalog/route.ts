import type { MedusaStoreRequest, MedusaResponse } from '@medusajs/framework/http'
import type { CatalogQuery } from '../../../../catalog-contract'
import { queryCatalog } from '../../../../lib/catalog'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  const query: CatalogQuery = {}
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') query[key] = value
  }
  res.setHeader('Cache-Control', 'private, no-store')
  res.json(await queryCatalog(req, query))
}
