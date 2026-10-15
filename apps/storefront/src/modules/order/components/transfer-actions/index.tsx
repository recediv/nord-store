"use client"

import { acceptTransferRequest, declineTransferRequest } from "@lib/data/orders"
import { Button, Text } from "@modules/common/components/ui"
import type { TransferAction } from "@modules/order/components/transfer-confirmation"
import { useRef, useState } from "react"

type TransferStatus = "pending" | "success" | "error"

const TransferActions = ({
  id,
  token,
  action,
}: {
  id: string
  token: string
  action?: TransferAction
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const busy = useRef(false)
  const [status, setStatus] = useState<{
    accept: TransferStatus | null
    decline: TransferStatus | null
  } | null>({
    accept: null,
    decline: null,
  })

  const submit = async (choice: TransferAction) => {
    if (busy.current) return
    busy.current = true
    setStatus({
      accept: choice === "accept" ? "pending" : null,
      decline: choice === "decline" ? "pending" : null,
    })
    setErrorMessage(null)
    try {
      const { success, error } = await (choice === "accept"
        ? acceptTransferRequest(id, token)
        : declineTransferRequest(id, token))
      if (error) setErrorMessage(error)
      setStatus({
        accept: choice === "accept" ? (success ? "success" : "error") : null,
        decline: choice === "decline" ? (success ? "success" : "error") : null,
      })
    } catch {
      setErrorMessage(
        "Не удалось отправить подтверждение. Проверьте соединение и повторите попытку.",
      )
      setStatus({
        accept: choice === "accept" ? "error" : null,
        decline: choice === "decline" ? "error" : null,
      })
    } finally {
      busy.current = false
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      {status?.accept === "success" && (
        <Text className="text-emerald-500">Заказ успешно передан.</Text>
      )}
      {status?.decline === "success" && (
        <Text className="text-emerald-500">Передача заказа отклонена.</Text>
      )}
      {status?.accept !== "success" && status?.decline !== "success" && (
        <div className="flex gap-x-4">
          {action !== "decline" && (
            <Button
              size="large"
              onClick={() => void submit("accept")}
              isLoading={status?.accept === "pending"}
              disabled={
                status?.accept === "pending" || status?.decline === "pending"
              }
            >
              Подтвердить передачу
            </Button>
          )}
          {action !== "accept" && (
            <Button
              size="large"
              variant="secondary"
              onClick={() => void submit("decline")}
              isLoading={status?.decline === "pending"}
              disabled={
                status?.accept === "pending" || status?.decline === "pending"
              }
            >
              Отклонить передачу
            </Button>
          )}
        </div>
      )}
      {errorMessage && <Text className="text-red-500">{errorMessage}</Text>}
    </div>
  )
}

export default TransferActions
