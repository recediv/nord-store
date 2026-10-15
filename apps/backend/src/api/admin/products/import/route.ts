import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError } from '@medusajs/framework/utils'
import { importProductsWorkflow } from '@medusajs/medusa/core-flows'
import { transliterateProductImportBuffer } from '../../../../lib/product-import-csv'

type ImportRequest = MedusaRequest & {
  file?: { originalname: string; buffer: Buffer }
}

export async function POST(req: ImportRequest, res: MedusaResponse) {
  if (!req.file)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'No file was uploaded for importing')
  const contents = await transliterateProductImportBuffer(req.file.buffer)
  const { result, transaction } = await importProductsWorkflow(req.scope).run({
    input: {
      filename: req.file.originalname,
      fileContent: contents.toString('utf8'),
    },
  })
  res.status(202).json({ transaction_id: transaction.transactionId, summary: result })
}
