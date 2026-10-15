"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import {
  ArrowRight,
  Check,
  Heart,
  Maximize2,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react"
import type { Product } from "@lib/nord/types"
import {
  defaultColor,
  getComparePrice,
  getPrice,
  getStock,
  money,
} from "@lib/nord/format"
import { Dialog } from "@modules/nord/dialog"
import { StoreImage } from "@modules/nord/image"
import { Link } from "@modules/nord/link"
import { ProductBadges, ProductCard } from "@modules/nord/product-card"
import { useNord } from "@modules/nord/provider"
import "./styles/product.css"

export type ProductPageProps = { product: Product; related: Product[] }

function scrollToReviews(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  event.stopPropagation()
  const reviews = document.getElementById("product-reviews")
  if (!reviews) return
  const url = new URL(window.location.href)
  url.hash = "product-reviews"
  window.history.replaceState(window.history.state, "", url)
  reviews.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  })
}

export function ProductPage({ product, related }: ProductPageProps) {
  const { config, favorites, toggleFavorite, add, recordView, storageReady } =
    useNord()
  const [selection, setSelection] = useState({ handle: "", color: "" })
  const [zoom, setZoom] = useState(false)
  const [addingHandle, setAddingHandle] = useState<string | null>(null)
  const [error, setError] = useState<{
    handle: string
    message: string
  } | null>(null)
  const recordedHandle = useRef<string | null>(null)
  const operation = useRef(0)
  const selectedColor =
    selection.handle === product.handle &&
    product.colors.some((option) => option.name === selection.color)
      ? selection.color
      : defaultColor(product)
  const price = getPrice(product, selectedColor)
  const comparePrice = getComparePrice(product, selectedColor)
  const stock = getStock(product, selectedColor)
  const favorite = favorites.includes(product.handle)
  const adding = addingHandle === product.handle
  const categoryName =
    product.categoryName ||
    config.categories.find((category) => category.id === product.category)?.name
  const reviews = product.reviewEntries || []

  useEffect(() => {
    if (storageReady && recordedHandle.current !== product.handle) {
      recordedHandle.current = product.handle
      recordView(product.handle)
    }
  }, [product.handle, recordView, storageReady])

  useEffect(() => {
    setZoom(false)
  }, [product.handle])

  async function addToCart() {
    const currentOperation = ++operation.current
    setAddingHandle(product.handle)
    setError(null)
    try {
      await add(product, selectedColor)
    } catch (cause) {
      if (currentOperation === operation.current) {
        setError({
          handle: product.handle,
          message:
            cause instanceof Error
              ? cause.message
              : "Не удалось добавить товар. Попробуйте ещё раз.",
        })
      }
    } finally {
      if (currentOperation === operation.current) setAddingHandle(null)
    }
  }

  const rating = (
    <>
      <Star size={15} fill="currentColor" aria-hidden="true" />
      <span className="rating-number">{product.rating.toFixed(1)}</span>
      <span>Демо-оценок: {product.reviews}</span>
    </>
  )

  return (
    <main className="container product-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <ol>
          <li>
            <Link href="/">Главная</Link>
          </li>
          <li>
            <Link href="/catalog">Каталог</Link>
          </li>
          {categoryName && (
            <li>
              <Link
                href={`/catalog?category=${encodeURIComponent(product.category)}`}
              >
                {categoryName}
              </Link>
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>
      <div className="product-detail">
        <div className={`detail-image image-${product.handle}`}>
          <StoreImage
            image={product.image}
            alt={`${product.name}, демонстрационная фотография`}
            sizes="(min-width: 1151px) 590px, (min-width: 601px) 48vw, calc(100vw - 40px)"
            width={1100}
            height={1200}
            fetchPriority="high"
          />
          <ProductBadges
            product={product}
            price={price}
            comparePrice={comparePrice}
          />
          <button
            type="button"
            className="image-zoom icon-button"
            aria-label={`Увеличить фотографию: ${product.name}`}
            aria-haspopup="dialog"
            onClick={() => setZoom(true)}
          >
            <Maximize2 size={21} aria-hidden="true" />
          </button>
          <span className="photo-caption">
            Демонстрационная фотография · цвет может отличаться
          </span>
        </div>
        <div className="detail-info">
          <span className="eyebrow">
            {categoryName ? `${categoryName} / ` : ""}NORD COLLECTION
          </span>
          <h1>{product.name}</h1>
          <p className="detail-subtitle">{product.subtitle}</p>
          {reviews.length > 0 ? (
            <a
              href="#product-reviews"
              className="detail-rating"
              onClick={scrollToReviews}
              data-reviews-anchor
            >
              {rating}
            </a>
          ) : (
            <span className="detail-rating">{rating}</span>
          )}
          <div className="detail-price" aria-live="polite" aria-atomic="true">
            <strong>{money(price)}</strong>
            {comparePrice !== null && comparePrice > price && (
              <>
                <del>{money(comparePrice)}</del>
                <span>−{money(comparePrice - price)}</span>
              </>
            )}
          </div>
          <p className="detail-description">{product.description}</p>
          {product.colors.length > 0 && (
            <fieldset className="color-picker">
              <legend>
                Цвет: <strong>{selectedColor}</strong>
              </legend>
              <div>
                {product.colors.map((color) => (
                  <button
                    type="button"
                    key={color.name}
                    style={{ backgroundColor: color.hex }}
                    className={selectedColor === color.name ? "selected" : ""}
                    aria-label={`${color.name}${getStock(product, color.name) < 1 ? ", нет в наличии" : ""}`}
                    aria-pressed={selectedColor === color.name}
                    title={color.name}
                    onClick={() =>
                      setSelection({
                        handle: product.handle,
                        color: color.name,
                      })
                    }
                  >
                    {selectedColor === color.name && (
                      <Check size={18} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <p
            className={`stock-status${stock < 1 ? " out-of-stock" : ""}`}
            aria-live="polite"
          >
            <span aria-hidden="true" />
            {stock > 0 ? `В наличии · ${stock} шт.` : "Временно нет в наличии"}
          </p>
          <div className="detail-buy">
            <button
              type="button"
              className="button"
              disabled={adding || stock < 1}
              aria-busy={adding}
              onClick={addToCart}
            >
              {adding
                ? "Добавляем…"
                : stock > 0
                  ? "Добавить в корзину"
                  : "Нет в наличии"}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`favorite-detail icon-button${favorite ? " is-favorite" : ""}`}
              onClick={() => toggleFavorite(product.handle)}
              aria-label={
                favorite
                  ? "Убрать товар из избранного"
                  : "Добавить товар в избранное"
              }
              aria-pressed={favorite}
              title={favorite ? "В избранном" : "В избранное"}
            >
              <Heart
                size={23}
                fill={favorite ? "currentColor" : "none"}
                aria-hidden="true"
              />
            </button>
          </div>
          {error?.handle === product.handle && (
            <p className="detail-error" role="alert">
              {error.message}
            </p>
          )}
          <div className="product-service">
            <span>
              <Truck size={18} aria-hidden="true" />
              Доставка при оформлении
            </span>
            <span>
              <RotateCcw size={18} aria-hidden="true" />
              Возврат в течение {config.returnDays} дней
            </span>
            <span>
              <ShieldCheck size={18} aria-hidden="true" />
              Продуманное качество
            </span>
          </div>
          <details className="product-accordion" open>
            <summary>Характеристики</summary>
            <dl className="specs">
              {Object.entries(product.specs).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="product-accordion">
            <summary>Доставка и возврат</summary>
            <p>
              Доступные способы и точную стоимость доставки рассчитаем при
              оформлении.
              {config.freeShippingFrom
                ? ` По доступным стандартным тарифам — бесплатно от ${money(config.freeShippingFrom)} после скидок. Доступность зависит от адреса и состава заказа.`
                : ""}
              {` Самовывоз: ${config.showroom.city}, ${config.showroom.address}.`}
            </p>
            <p>
              Не подошло? В магазине предусмотрен возврат в течение{" "}
              {config.returnDays} дней.{" "}
              <Link href="/help/returns">Подробнее о возврате</Link>
            </p>
          </details>
        </div>
      </div>
      {reviews.length > 0 && (
        <section
          id="product-reviews"
          className="product-reviews"
          aria-labelledby="reviews-title"
        >
          <div>
            <span className="eyebrow">ДЕМО-ОТЗЫВЫ</span>
            <h2 id="reviews-title">Маленькие истории о доме</h2>
            <p className="muted">
              Примеры отзывов для демонстрации карточки товара.
            </p>
          </div>
          {reviews.map((review, index) => (
            <article key={`${review.name}-${index}`}>
              <h3 className="sr-only">Отзыв: {review.name}</h3>
              <span
                className="review-stars"
                role="img"
                aria-label={`${review.rating} из 5`}
              >
                {"★".repeat(
                  Math.min(5, Math.max(0, Math.round(review.rating))),
                )}
              </span>
              <p>{review.text}</p>
              <small>{review.name} · Демо-отзыв</small>
            </article>
          ))}
        </section>
      )}
      {related.length > 0 && (
        <section className="section" aria-labelledby="related-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ХОРОШО ВМЕСТЕ</span>
              <h2 id="related-title">Ещё немного уюта</h2>
            </div>
            <Link
              className="text-link"
              href={`/catalog?category=${encodeURIComponent(product.category)}`}
            >
              Посмотреть всё <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="product-grid">
            {related.map((entry, index) => (
              <ProductCard key={entry.handle} product={entry} index={index} />
            ))}
          </div>
        </section>
      )}
      {zoom && (
        <Dialog title={product.name} onClose={() => setZoom(false)} wide>
          <StoreImage
            className="zoom-photo"
            image={product.image}
            sizes="(min-width: 1000px) 900px, 90vw"
            alt={product.name}
            width={1400}
            height={1400}
          />
        </Dialog>
      )}
    </main>
  )
}

export default ProductPage
