"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  LoaderCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import type { CatalogResult, Facet, Product } from "@lib/nord/types"
import { money } from "@lib/nord/format"
import { catalogMetadata } from "@lib/nord/catalog-meta"
import { assetPath } from "@lib/nord/asset-path"
import { useNord } from "./provider"
import { Link } from "./link"
import { Dialog } from "./dialog"
import { ProductCard } from "./product-card"
import { CatalogFilters } from "./filters"
import { useCatalogClient } from "./catalog-client"
import "./styles/catalog.css"

const facets: Facet[] = ["category", "material", "room", "color"]

function ProductGrid({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const previous = useRef<string[]>([])
  const initialized = useRef(false)
  const handles = useMemo(
    () => products.map((product) => product.handle),
    [products],
  )
  useLayoutEffect(() => {
    const before = previous.current
    previous.current = handles
    if (!initialized.current) {
      initialized.current = true
      return
    }
    if (
      handles.join("|") === before.join("|") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    const appending =
      before.length > 0 &&
      before.every((handle, index) => handles[index] === handle)
    const animations = Array.from(ref.current?.children || [])
      .slice(appending ? before.length : 0)
      .map((card, index) =>
        card.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 300,
            delay: Math.min(index * 20, 100),
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          },
        ),
      )
    return () => animations.forEach((animation) => animation.cancel())
  }, [handles])
  return (
    <div ref={ref} className="product-grid catalog-grid">
      {products.map((product, index) => (
        <ProductCard key={product.handle} product={product} index={index} />
      ))}
    </div>
  )
}

export function Catalog({
  initial,
  query,
}: {
  initial: CatalogResult
  query: string
}) {
  const { config, favorites, mode } = useNord()
  const urlQuery = useSearchParams().toString()
  const [restored, setRestored] = useState(mode !== "demo")
  const [optimistic, setOptimistic] = useState({
    source: urlQuery,
    value: urlQuery,
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => setRestored(true), [])
  useEffect(() => {
    setOptimistic((previous) =>
      previous.source === urlQuery
        ? previous
        : {
            source: urlQuery,
            value: window.location.search.slice(1),
          },
    )
  }, [urlQuery])
  const currentQuery = restored
    ? optimistic.source === urlQuery
      ? optimistic.value
      : urlQuery
    : query
  const params = useMemo(
    () => new URLSearchParams(currentQuery),
    [currentQuery],
  )
  const { data, pending, error, hasMore, loadMore, retry } = useCatalogClient(
    params,
    initial,
    query,
  )
  const collection = params.get("collection")
  const { title, filtered, canonical } = catalogMetadata(
    params,
    config.categories,
  )
  const activeCount =
    facets.reduce(
      (sum, facet) =>
        sum + (params.get(facet) || "").split(",").filter(Boolean).length,
      0,
    ) +
    Number(params.has("minPrice")) +
    Number(params.has("maxPrice")) +
    Number(params.get("inStock") === "true")

  function commit(next: URLSearchParams) {
    next.delete("offset")
    next.delete("limit")
    next.delete("favorites")
    const value = next.toString()
    if (value === currentQuery) return
    setOptimistic({ source: urlQuery, value })
    // Native history updates integrate with Next's useSearchParams, without an
    // RSC navigation, scroll reset, or remount of a range input under the pointer.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${value ? `?${value}` : ""}`,
    )
  }
  function update(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    commit(next)
  }
  function toggle(facet: Facet, value: string) {
    const selected = (params.get(facet) || "").split(",").filter(Boolean)
    update(
      facet,
      selected.includes(value)
        ? selected.filter((entry) => entry !== value).join(",")
        : [...selected, value].join(","),
    )
  }
  function reset() {
    const next = new URLSearchParams()
    if (collection) next.set("collection", collection)
    commit(next)
  }
  function resetPrice() {
    const next = new URLSearchParams(params)
    next.delete("minPrice")
    next.delete("maxPrice")
    commit(next)
  }
  const chips = facets.flatMap((facet) =>
    (params.get(facet) || "")
      .split(",")
      .filter(Boolean)
      .map((value) => ({
        key: `${facet}:${value}`,
        label:
          data?.facets
            .find((entry) => entry.id === facet)
            ?.options.find((option) => option.value === value)?.label || value,
        remove: () => toggle(facet, value),
      })),
  )
  if (params.get("q"))
    chips.push({
      key: "q",
      label: `Поиск: ${params.get("q")}`,
      remove: () => update("q", ""),
    })
  for (const [key, label] of [
    ["minPrice", "От"],
    ["maxPrice", "До"],
  ])
    if (params.has(key))
      chips.push({
        key,
        label: `${label} ${money(Number(params.get(key)))}`,
        remove: () => update(key, ""),
      })
  if (params.get("inStock") === "true")
    chips.push({
      key: "inStock",
      label: "В наличии",
      remove: () => update("inStock", ""),
    })
  const controls = data && (
    <CatalogFilters
      result={data}
      params={params}
      activeCount={activeCount}
      reset={reset}
      update={update}
      toggle={toggle}
      resetPrice={resetPrice}
    />
  )

  return (
    <main className="container catalog-page">
      {/* React 19 owns and hoists these tags for SSR and history-only filters.
          The route opts these three fields out of Next's streamed metadata. */}
      <title>{`${title} — NORD`}</title>
      <meta
        name="robots"
        content={filtered ? "noindex,follow" : "index,follow"}
      />
      <link rel="canonical" href={assetPath(canonical)} />
      <nav aria-label="Хлебные крошки" className="breadcrumbs">
        <ol>
          <li>
            <Link href="/">Главная</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <div className="catalog-heading">
        <div className="catalog-heading-copy">
          <span className="eyebrow">СОБЕРИТЕ СВОЁ ПРОСТРАНСТВО</span>
          <h1>
            {title}
            <sup>{data?.count ?? ""}</sup>
          </h1>
          <p>Вещи с характером, которые легко становятся частью дома.</p>
        </div>
        <div className="catalog-toolbar">
          <form
            className="catalog-search"
            role="search"
            aria-label="Поиск по каталогу"
            onSubmit={(event) => event.preventDefault()}
          >
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={params.get("q") || ""}
              onChange={(event) => update("q", event.target.value)}
              placeholder="Найти свою вещь"
              aria-label="Поиск в каталоге"
            />
            {params.get("q") && (
              <button
                type="button"
                aria-label="Очистить поиск"
                onClick={() => update("q", "")}
              >
                <X size={16} />
              </button>
            )}
            <button type="submit" aria-label="Найти товары">
              <ArrowRight size={18} />
            </button>
          </form>
          <button
            type="button"
            className="mobile-filter-button"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal size={17} />
            Фильтры {activeCount > 0 && `(${activeCount})`}
          </button>
        </div>
      </div>
      {!data ? (
        <div
          className="catalog-initial-state"
          role={error ? "alert" : "status"}
        >
          {error ? (
            <>
              <p>{error}</p>
              <button type="button" className="button" onClick={retry}>
                Повторить загрузку
              </button>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={28} />
              <p>Собираем ваше пространство…</p>
            </>
          )}
        </div>
      ) : (
        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Фильтры товаров">
            {controls}
          </aside>
          <div className="catalog-results" aria-busy={pending}>
            <div className="catalog-results-heading">
              <div className="filter-chips">
                {chips.map((chip) => (
                  <button
                    type="button"
                    key={chip.key}
                    onClick={chip.remove}
                    aria-label={`Убрать фильтр: ${chip.label}`}
                  >
                    {chip.label}
                    <X size={13} />
                  </button>
                ))}
              </div>
              <label className="sort-control">
                <span>Сначала</span>
                <select
                  aria-label="Сортировка"
                  value={params.get("sort") || "popular"}
                  onChange={(event) => update("sort", event.target.value)}
                >
                  <option value="popular">Популярные</option>
                  <option value="price-asc">Дешевле</option>
                  <option value="price-desc">Дороже</option>
                  <option value="new">Новинки</option>
                  <option value="rating">С высоким рейтингом</option>
                </select>
              </label>
            </div>
            <p className="results-count" role="status" aria-live="polite">
              {pending ? (
                "Обновляем товары…"
              ) : (
                <>
                  Найдено товаров: <strong>{data.count}</strong>
                </>
              )}
            </p>
            {error && (
              <div className="form-error" role="alert">
                <p>{error}</p>
                <button type="button" className="text-link" onClick={retry}>
                  Повторить загрузку
                </button>
              </div>
            )}
            {data.products.length ? (
              <>
                <h2 className="sr-only">Товары каталога</h2>
                <ProductGrid products={data.products} />
                <div className="catalog-pagination">
                  <span>
                    Показано {data.products.length} из {data.count}
                  </span>
                  {hasMore && (
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => void loadMore()}
                      disabled={pending}
                    >
                      Показать ещё 12 <ArrowRight size={17} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Search size={40} strokeWidth={1} />
                <h2>
                  {collection === "favorites"
                    ? "Сохраните то, что нравится"
                    : "Пока ничего не нашлось"}
                </h2>
                <p>
                  {collection === "favorites" && !favorites.length
                    ? "Нажмите на сердечко у товара, чтобы добавить его сюда."
                    : "Попробуйте изменить запрос или убрать несколько фильтров."}
                </p>
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    collection === "favorites" && !favorites.length
                      ? commit(new URLSearchParams())
                      : reset()
                  }
                >
                  {collection === "favorites" && !favorites.length
                    ? "Посмотреть каталог"
                    : "Сбросить фильтры"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {filtersOpen && (
        <Dialog
          title="Подберите свою вещь"
          drawer
          onClose={() => setFiltersOpen(false)}
        >
          {controls}
          <button
            type="button"
            className="button full mobile-apply-filters"
            onClick={() => setFiltersOpen(false)}
          >
            Показать {data?.count ?? 0} товаров <ArrowRight size={18} />
          </button>
        </Dialog>
      )}
    </main>
  )
}

export default Catalog
