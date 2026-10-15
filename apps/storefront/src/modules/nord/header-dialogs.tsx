"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Check, Search } from "lucide-react"
import type { Product } from "@lib/nord/types"
import { defaultColor, getPrice, money } from "@lib/nord/format"
import { useNord } from "./provider"
import { Link } from "./link"
import { StoreImage } from "./image"
import "./styles/header-dialogs.css"

export function SearchContents({
  onClose,
  onSearch,
}: {
  onClose: () => void
  onSearch: (query: string) => void
}) {
  const { config, loadCatalog } = useNord()
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    setProducts([])
    setError("")
    if (!query.trim()) {
      setPending(false)
      return
    }
    const controller = new AbortController()
    setPending(true)
    const timeout = setTimeout(
      () =>
        void loadCatalog(
          new URLSearchParams({ q: query.trim(), limit: "4" }),
          controller.signal,
        )
          .then((result) => {
            if (!controller.signal.aborted) setProducts(result.products)
          })
          .catch((reason) => {
            if (!controller.signal.aborted)
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Поиск временно недоступен.",
              )
          })
          .finally(() => {
            if (!controller.signal.aborted) setPending(false)
          }),
      180,
    )
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [query, loadCatalog])
  return (
    <>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSearch(query)
        }}
      >
        <Search size={22} />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Кресло, светильник, лён…"
          aria-label="Поисковый запрос"
        />
        <button className="button small" type="submit">
          Найти
        </button>
      </form>
      <p className="muted small-text">Попробуйте «кресло», «лампа» или «лён»</p>
      <div className="search-results" aria-busy={pending}>
        {products.map((product) => (
          <Link
            key={product.handle}
            href={`/product/${product.handle}`}
            onClick={onClose}
          >
            <StoreImage image={product.image} preset="thumbnail" alt="" />
            <span>
              {product.name}
              <small>
                {
                  config.categories.find(
                    (category) => category.id === product.category,
                  )?.name
                }
              </small>
            </span>
            <strong>{money(getPrice(product, defaultColor(product)))}</strong>
          </Link>
        ))}
      </div>
      {pending && (
        <p className="empty-search" role="status">
          Ищем товары…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {query.trim() && !pending && !error && !products.length && (
        <p className="empty-search">
          Точного совпадения нет. Измените запрос или откройте каталог.
        </p>
      )}
    </>
  )
}
export function CityContents({
  city,
  onSelect,
}: {
  city: string
  onSelect: (city: string) => void
}) {
  const { config } = useNord()
  const [value, setValue] = useState(city)
  const cities = config.cities?.length ? config.cities : [config.showroom.city]
  return (
    <>
      <p className="muted">
        Выберите город, чтобы сохранить его для оформления заказа.
      </p>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) onSelect(value.trim())
        }}
      >
        <input
          type="text"
          aria-label="Город"
          autoComplete="address-level2"
          maxLength={100}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="button small" disabled={!value.trim()}>
          Выбрать
        </button>
      </form>
      <div className="city-options">
        {cities.map((value) => (
          <button type="button" key={value} onClick={() => onSelect(value)}>
            {value}
            {value === city && <Check size={18} />}
          </button>
        ))}
      </div>
    </>
  )
}
export function MobileMenuContents({
  onClose,
  onCity,
}: {
  onClose: () => void
  onCity: () => void
}) {
  const { config, city } = useNord()
  return (
    <>
      <nav className="mobile-nav" aria-label="Навигация по магазину">
        {[
          ["Каталог", "/catalog"],
          ["Вдохновение", "/inspiration"],
          ["О NORD", "/about"],
          ["Избранное", "/catalog?collection=favorites"],
        ].map(([label, href]) => (
          <Link key={href} href={href} onClick={onClose}>
            {label}
            <ArrowRight size={19} />
          </Link>
        ))}
        <button type="button" onClick={onCity}>
          Ваш город: {city}
          <ArrowRight size={19} />
        </button>
      </nav>
      <div className="mobile-category-images">
        {config.categories.map((category) => (
          <Link
            key={category.id}
            href={`/catalog?category=${category.id}`}
            onClick={onClose}
          >
            <StoreImage image={category.image} preset="menu" alt="" />
            <span>
              {category.name}
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
