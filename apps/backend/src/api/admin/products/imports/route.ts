import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import type { IFileModuleService } from '@medusajs/framework/types'
import { Modules } from '@medusajs/framework/utils'
import { importProductsAsChunksWorkflow } from '@medusajs/medusa/core-flows'
import type { AdminImportProductsType } from '@medusajs/medusa/api/admin/products/validators'
import {
  prepareProductImportCsv,
  removePreparedImportCsv,
} from '../../../../lib/product-import-csv'

export async function POST(req: MedusaRequest<AdminImportProductsType>, res: MedusaResponse) {
  const file = req.scope.resolve<IFileModuleService>(Modules.FILE)
  const prepared = await prepareProductImportCsv(file, req.validatedBody.file_key)
  try {
    const { result, transaction } = await importProductsAsChunksWorkflow(req.scope).run({
      input: {
        filename: req.validatedBody.originalname,
        fileKey: prepared || req.validatedBody.file_key,
      },
    })
    res.status(202).json({ transaction_id: transaction.transactionId, summary: result })
  } finally {
    // Native chunks no longer depend on the prepared CSV.
    if (prepared) await removePreparedImportCsv(file, prepared)
  }
}
