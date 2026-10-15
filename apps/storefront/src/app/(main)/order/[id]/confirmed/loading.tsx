import "@modules/nord/styles/checkout.css"

export default function Loading() {
  return (
    <main className="container confirmation-page">
      <h1>Подтверждение заказа</h1>
      <p role="status" aria-busy="true">
        Загружаем подтверждение…
      </p>
    </main>
  )
}
