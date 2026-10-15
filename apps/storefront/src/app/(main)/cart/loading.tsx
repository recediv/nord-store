import { CartSkeleton } from "@modules/nord/cart"

export default function Loading() {
  return (
    <main className="container cart-page">
      <div className="page-title">
        <h1>Ваша корзина</h1>
      </div>
      <CartSkeleton />
    </main>
  )
}
