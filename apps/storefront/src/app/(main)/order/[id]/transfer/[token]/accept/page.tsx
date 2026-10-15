import TransferConfirmation from "@modules/order/components/transfer-confirmation"

export default async function TransferPage({
  params,
}: {
  params: Promise<{ id: string; token: string }>
}) {
  const { id, token } = await params
  return <TransferConfirmation id={id} token={token} action="accept" />
}
