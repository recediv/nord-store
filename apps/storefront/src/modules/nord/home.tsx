"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  Leaf,
  RotateCcw,
  Truck,
} from "lucide-react"
import type { CatalogResult, Product } from "@lib/nord/types"
import { money } from "@lib/nord/format"
import { useNord } from "@modules/nord/provider"
import { Link } from "@modules/nord/link"
import { StoreImage } from "@modules/nord/image"
import { ProductCard } from "@modules/nord/product-card"
import "./styles/home.css"

const GalleryShowcase = dynamic(() => import("./gallery"))

export type HomeData = {
  objects: Product[]
  fresh: CatalogResult
  picks: CatalogResult
}

export function Home({ home }: { home: HomeData }) {
  const { config, recent, storageReady, loadCatalog } = useNord()
  const { categories, categoryCounts } = config
  const [tab, setTab] = useState("")
  const recommendationsRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selection, setSelection] = useState<{
    key: string
    data?: CatalogResult
    error?: string
  } | null>(null)
  const recentHandle = storageReady ? recent[0] : undefined
  const defaultSelection = !tab && !recentHandle
  const selectionKey = new URLSearchParams({
    inStock: "true",
    limit: "4",
    ...(tab
      ? { category: tab }
      : recentHandle
        ? { similarTo: recentHandle, exclude: recentHandle }
        : { collection: "featured" }),
  }).toString()

  useEffect(() => {
    const element = recommendationsRef.current
    if (!element) return
    if (!("IntersectionObserver" in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: "150px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (defaultSelection || !visible || !storageReady) return
    const controller = new AbortController()
    loadCatalog(new URLSearchParams(selectionKey), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setSelection({ key: selectionKey, data })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSelection({
            key: selectionKey,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить подборку",
          })
        }
      })
    return () => controller.abort()
  }, [
    selectionKey,
    defaultSelection,
    visible,
    storageReady,
    loadCatalog,
    attempt,
  ])

  // The server seed belongs only to the featured query, never to a personal one.
  const currentSelection = selection?.key === selectionKey ? selection : null
  const picks = defaultSelection
    ? home.picks.products
    : currentSelection?.data?.products
  const selectionError = !defaultSelection && currentSelection?.error
  const pending = !defaultSelection && !picks && !selectionError

  return (
    <main className="home-page">
      <section className="container gallery-hero" aria-labelledby="home-title">
        <div className="gallery-hero-top">
          <span>Мебель, свет, предметы</span>
          <span>NORD / Коллекция 2026</span>
        </div>
        <div className="gallery-hero-layout">
          <div className="gallery-hero-copy">
            <span className="gallery-overline">
              Для пространства, в котором живут
            </span>
            <h1 id="home-title">
              Характер
              <br />в деталях.
            </h1>
            <p>
              Вещи, которые хочется трогать,
              <br />
              рассматривать и оставлять рядом.
            </p>
            <Link className="button" href="/catalog">
              Собрать свой дом <ArrowUpRight size={21} />
            </Link>
            <div className="gallery-hero-note">
              <span>01 /</span>
              <p>
                Неидеальные ритуалы.
                <br />
                Любимые предметы. Ваш дом.
              </p>
            </div>
          </div>
          <GalleryShowcase objects={home.objects} />
        </div>
        <nav className="home-departments" aria-label="Категории магазина">
          {categories.map((category) => (
            <Link key={category.id} href={`/catalog?category=${category.id}`}>
              <StoreImage
                image={category.image}
                preset="thumbnail"
                alt=""
                loading="lazy"
                fetchPriority="low"
              />
              <div>
                <strong>{category.name}</strong>
                <span>Предметов: {categoryCounts[category.id] || 0}</span>
              </div>
              <ArrowUpRight size={20} />
            </Link>
          ))}
        </nav>
      </section>

      <section
        className="container home-products-section"
        id="recommendations"
        ref={recommendationsRef}
        aria-labelledby="recommendations-title"
      >
        <div className="home-section-title">
          <div>
            <span className="gallery-overline">Выбрано для вас</span>
            <h2 id="recommendations-title">Останутся надолго.</h2>
            <p>
              {recentHandle && !tab
                ? "Подборка по вашим интересам"
                : "Формы и фактуры, к которым хочется возвращаться"}
            </p>
          </div>
          <Link className="text-link" href="/catalog?collection=featured">
            Вся подборка <ArrowUpRight size={20} />
          </Link>
        </div>
        <div
          className="product-tabs"
          role="group"
          aria-label="Категории рекомендаций"
        >
          {[{ id: "", name: "Для вас" }, ...categories].map((category) => (
            <button
              key={category.id}
              type="button"
              className={tab === category.id ? "active" : ""}
              aria-pressed={tab === category.id}
              onClick={() => setTab(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
        <div className="product-grid" aria-busy={pending}>
          {picks?.map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
          {pending &&
            Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="home-product-placeholder"
                aria-hidden="true"
              />
            ))}
        </div>
        {selectionError && (
          <div className="home-selection-error" role="alert">
            <p>{selectionError}</p>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setSelection(null)
                setAttempt((value) => value + 1)
              }}
            >
              Попробовать ещё раз <RotateCcw size={16} />
            </button>
          </div>
        )}
        {!pending && !selectionError && !picks?.length && (
          <p className="home-selection-empty" role="status">
            В этой подборке пока нет доступных предметов.
          </p>
        )}
        <div className="home-section-link">
          <Link className="text-link" href="/catalog?collection=featured">
            Больше хороших вещей <ArrowRight size={21} />
          </Link>
        </div>
      </section>

      <section
        className="container home-products-section home-new"
        aria-labelledby="new-products-title"
      >
        <div className="home-section-title">
          <div>
            <span className="gallery-overline">Свежий взгляд</span>
            <h2 id="new-products-title">Недавно в NORD.</h2>
            <p>Новые предметы и новые поводы быть дома</p>
          </div>
          <Link className="text-link" href="/catalog?collection=new">
            Все новинки <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="product-grid">
          {home.fresh.products.map((product) => (
            <ProductCard key={product.handle} product={product} />
          ))}
        </div>
        <div className="home-section-link">
          <Link className="text-link" href="/catalog?collection=new">
            Посмотреть все новинки <ArrowRight size={21} />
          </Link>
        </div>
      </section>

      <section
        className="container home-story"
        aria-labelledby="home-story-title"
      >
        <div className="home-story-photo">
          <StoreImage
            image="hero.jpg"
            preset="editorial"
            alt="Светлая гостиная с мягкой мебелью и предметами для дома"
            loading="lazy"
          />
        </div>
        <div className="home-story-copy">
          <Leaf size={36} strokeWidth={1.4} />
          <h2 id="home-story-title">
            У дома нет правил.
            <br />
            Есть ваши привычки.
          </h2>
          <p>
            Книги на полу, кофе у окна, кресло для кота.
            <br />
            Собирайте пространство, в котором хорошо вам.
          </p>
          <Link className="button" href="/inspiration">
            Подсмотреть идеи <ArrowUpRight size={22} />
          </Link>
        </div>
      </section>
      <nav className="container home-benefits" aria-label="Сервисы магазина">
        <Link href="/help/delivery">
          <Truck size={30} strokeWidth={1.4} />
          <div>
            <strong>Привезём к вам</strong>
            <span>
              {config.freeShippingFrom
                ? `Бесплатно от ${money(config.freeShippingFrom)} после скидки`
                : "Условия доставки при оформлении"}
            </span>
          </div>
          <ArrowRight size={20} />
        </Link>
        <Link href="/help/returns">
          <RotateCcw size={30} strokeWidth={1.4} />
          <div>
            <strong>Дайте себе время</strong>
            <span>{config.returnDays} дней, чтобы решить</span>
          </div>
          <ArrowRight size={20} />
        </Link>
        <Link href="/about">
          <Heart size={30} strokeWidth={1.4} />
          <div>
            <strong>Выбираем с любовью</strong>
            <span>Вещи для обычной, счастливой жизни</span>
          </div>
          <ArrowRight size={20} />
        </Link>
      </nav>
    </main>
  )
}

export default Home
