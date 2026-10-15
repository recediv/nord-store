import type { MedusaStoreRequest, MedusaResponse } from '@medusajs/framework/http'
import { storefrontConfig } from '../../../../lib/storefront-config'

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.json(await storefrontConfig(req))
}
