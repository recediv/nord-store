"use client"

import { memo, useState } from "react"
import { Check, Heart, LoaderCircle, Sparkles } from "lucide-react"
import type { Product } from "@lib/nord/types"
import {
  defaultColor,
  getComparePrice,
  getPrice,
  getStock,
  money,
} from "@lib/nord/format"
import { Link } from "./link"
import { StoreImage } from "./image"
import { useNord } from "./provider"
import "./styles/product-card.css"

export function ProductBadges({
  product,
  price = product.price,
  comparePrice = product.comparePrice,
  className = "",
}: {
  product: Product
  price?: number
  comparePrice?: number | null
  className?: string
}) {
  const onSale = comparePrice !== null && comparePrice > price
  if (!product.isNew && !onSale) return null
  return (
    <div className={`product-badges ${className}`}>
      {product.isNew && (
        <span className="badge badge-new">
          <Sparkles size={12} aria-hidden="true" />
          Новинка
        </span>
      )}
      {onSale && (
        <span className="badge sale">
          −{Math.round((1 - price / comparePrice!) * 100)}%
        </span>
      )}
    </div>
  )
}

export function ProductCard({
  product,
  index = 2,
  priority = index < 2,
}: {
  product: Product
  index?: number
  priority?: boolean
}) {
  const {
    cart,
    config,
    favorites,
    storageReady,
    add,
    toggleFavorite,
    setDrawer,
  } = useNord()
  const inCart = (cart?.items || []).reduce(
    (count, item) =>
      item.product_handle === product.handle ? count + item.quantity : count,
    0,
  )
  return (
    <Card
      product={product}
      categoryName={
        product.categoryName ||
        config.categories.find((category) => category.id === product.category)
          ?.name ||
        product.category
      }
      liked={storageReady && favorites.includes(product.handle)}
      inCart={inCart}
      priority={priority}
      add={add}
      toggleFavorite={toggleFavorite}
      setDrawer={setDrawer}
    />
  )
}

const Card = memo(function Card({
  product,
  categoryName,
  liked,
  inCart,
  priority,
  add,
  toggleFavorite,
  setDrawer,
}: {
  product: Product
  categoryName: string
  liked: boolean
  inCart: number
  priority: boolean
  add: (product: Product, color?: string) => Promise<void>
  toggleFavorite: (handle: string) => void
  setDrawer: (open: boolean) => void
}) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState("")
  const color = defaultColor(product)
  const price = getPrice(product, color)
  const comparePrice = getComparePrice(product, color)
  const stock = color ? getStock(product, color) : 0
  async function buy() {
    if (inCart) return setDrawer(true)
    if (adding || !stock) return
    setAdding(true)
    setError("")
    try {
      await add(product, color)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось добавить товар. Попробуйте ещё раз.",
      )
    } finally {
      setAdding(false)
    }
  }
  return (
    <article className="product-card">
      <div className={`product-image image-${product.handle}`}>
        <Link
          href={`/product/${product.handle}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <StoreImage
            image={product.image}
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
          />
        </Link>
        <ProductBadges
          product={product}
          price={price}
          comparePrice={comparePrice}
        />
        <button
          type="button"
          className={`favorite-button ${liked ? "is-favorite" : ""}`}
          onClick={() => toggleFavorite(product.handle)}
          aria-label={`${liked ? "Убрать из избранного" : "В избранное"}: ${product.name}`}
          aria-pressed={liked}
        >
          <Heart size={18} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="product-meta">
        <span>{categoryName}</span>
        <div className="color-dots" role="group" aria-label="Доступные цвета">
          {product.colors.map((entry) => (
            <span
              key={entry.name}
              title={entry.name}
              style={{ background: entry.hex }}
            />
          ))}
        </div>
      </div>
      <h3>
        <Link className="product-name" href={`/product/${product.handle}`}>
          {product.name}
        </Link>
      </h3>
      <p className="product-subtitle">{product.description}</p>
      <div className="product-bottom">
        <div className="prices">
          {comparePrice !== null && comparePrice > price && (
            <del>{money(comparePrice)}</del>
          )}
          <strong>{money(price)}</strong>
        </div>
        <button
          type="button"
          className={`button card-buy ${inCart ? "added" : ""} ${!stock ? "unavailable" : ""}`}
          aria-label={
            inCart
              ? `Открыть корзину: ${product.name}, ${inCart} шт.`
              : `Добавить в корзину: ${product.name}, ${color}`
          }
          onClick={() => void buy()}
          disabled={(!stock && !inCart) || adding}
          aria-busy={adding}
        >
          {adding ? (
            <>
              <LoaderCircle size={17} className="spin" />
              Добавляем…
            </>
          ) : inCart ? (
            <>
              <Check size={17} />В корзине · {inCart}
            </>
          ) : !stock ? (
            "Нет в наличии"
          ) : (
            "В корзину"
          )}
        </button>
      </div>
      {error && (
        <p className="field-error small-text" role="alert">
          {error}
        </p>
      )}
    </article>
  )
})
