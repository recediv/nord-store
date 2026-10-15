import { Heading, Text } from "@modules/common/components/ui"
import TransferActions from "@modules/order/components/transfer-actions"
import TransferImage from "@modules/order/components/transfer-image"

export type TransferAction = "accept" | "decline"

export default function TransferConfirmation({
  id,
  token,
  action,
}: {
  id: string
  token: string
  action?: TransferAction
}) {
  return (
    <main className="flex flex-col gap-y-6 items-start w-full max-w-lg px-5 mx-auto mt-10 mb-20">
      <TransferImage />
      <Heading level="h1" className="text-xl text-zinc-900">
        {action === "decline" ? "Отклонить передачу заказа" : "Передача заказа"}
      </Heading>
      <Text className="text-zinc-600">Заказ: {id}</Text>
      <Text className="text-zinc-600">
        {action === "decline"
          ? "Нажмите кнопку, чтобы отклонить запрос. Заказ останется у текущего владельца."
          : "Подтвердите передачу, только если вы ожидаете этот запрос. После подтверждения заказ будет принадлежать новому владельцу."}
      </Text>
      <TransferActions id={id} token={token} action={action} />
    </main>
  )
}
