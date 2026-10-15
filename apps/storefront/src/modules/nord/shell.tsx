"use client"

import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"
import { useTransitionRouter } from "next-view-transitions"
import {
  Check,
  Heart,
  LoaderCircle,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
} from "lucide-react"
import { useNord } from "./provider"
import { Link } from "./link"
import { Dialog } from "./dialog"
import MegaMenu from "./mega-menu"

const Loading = () => (
  <div className="deferred-loading" role="status">
    <LoaderCircle className="spin" size={20} /> Загружаем…
  </div>
)
const CartContents = dynamic(
  () => import("./cart").then((module) => module.CartContents),
  { loading: Loading },
)
const SearchContents = dynamic(
  () => import("./header-dialogs").then((module) => module.SearchContents),
  { loading: Loading },
)
const CityContents = dynamic(
  () => import("./header-dialogs").then((module) => module.CityContents),
  { loading: Loading },
)
const MobileMenuContents = dynamic(
  () => import("./header-dialogs").then((module) => module.MobileMenuContents),
  { loading: Loading },
)

export default function Shell({ children }: { children: ReactNode }) {
  const store = useNord()
  const router = useTransitionRouter()
  const [dialog, setDialog] = useState<"search" | "city" | "menu" | null>(null)
  const count =
    store.cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  const close = () => setDialog(null)
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        К содержимому
      </a>
      <header className="header">
        <div className="container header-main">
          <button
            type="button"
            className="icon-button mobile-menu"
            aria-label="Открыть меню"
            onClick={() => setDialog("menu")}
          >
            <Menu size={23} />
          </button>
          <Link className="logo" href="/" aria-label="NORD, главная">
            nord
            <span className="logo-point" aria-hidden="true">
              .
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Основная навигация">
            <MegaMenu />
            <Link href="/inspiration">Вдохновение</Link>
            <Link href="/about">О NORD</Link>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="city-button"
              disabled={store.pending || store.recovering}
              onClick={() => setDialog("city")}
            >
              <MapPin size={16} />
              <span>{store.city || "Выбрать город"}</span>
            </button>
            <span className="action-divider" aria-hidden="true" />
            <button
              type="button"
              className="icon-button"
              aria-label="Поиск товаров"
              onClick={() => setDialog("search")}
            >
              <Search size={21} />
            </button>
            <Link
              className="icon-button favorite-header"
              href="/catalog?collection=favorites"
              aria-label={`Избранное, ${store.favorites.length} товаров`}
            >
              <Heart size={21} />
              {store.favorites.length > 0 && (
                <span className="mini-count">{store.favorites.length}</span>
              )}
            </Link>
            <button
              type="button"
              className="bag-button"
              aria-label={`Корзина, ${count} товаров`}
              onClick={() => store.setDrawer(true)}
            >
              <ShoppingBag size={21} />
              <span>{count}</span>
            </button>
          </div>
        </div>
      </header>
      <div id="main-content" className="page-content">
        {children}
      </div>
      <footer className="footer">
        <div className="container footer-top">
          <div className="footer-brand">
            <Link className="logo" href="/">
              NORD<span>®</span>
            </Link>
            <p>
              Вещи с характером.
              <br />
              Пространство для жизни.
            </p>
            <span className="footer-note">Создавайте дом в своём ритме.</span>
          </div>
          <div>
            <h2>Магазин</h2>
            <Link href="/catalog">Весь каталог</Link>
            <Link href="/catalog?collection=new">Новинки</Link>
            <Link href="/catalog?collection=sale">Особые цены</Link>
            <Link href="/catalog?collection=favorites">Избранное</Link>
          </div>
          <div>
            <h2>Помощь</h2>
            <Link href="/help/delivery">Доставка и оплата</Link>
            <Link href="/help/returns">Обмен и возврат</Link>
            <Link href="/help/care">Уход за вещами</Link>
            <Link href="/help/contacts">Связаться с нами</Link>
          </div>
          <div>
            <h2>Ближе к NORD</h2>
            <Link href="/about">Наша история</Link>
            <Link href="/inspiration">Идеи для дома</Link>
            <p className="footer-contact">
              Демо-шоурум
              <br />
              {store.config.showroom.city}, {store.config.showroom.address}
              <br />
              <span>{store.config.showroom.hours}</span>
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 NORD. Демо-магазин.</span>
          <Link href="/help/privacy">Конфиденциальность</Link>
          <span>
            {store.mode === "demo"
              ? "Демо-режим · без реальных платежей"
              : "Medusa · тестовое оформление"}
          </span>
        </div>
      </footer>
      {dialog === "search" && (
        <Dialog title="Найдём вашу любимую вещь" onClose={close}>
          <SearchContents
            onClose={close}
            onSearch={(query) => {
              close()
              router.push(
                `/store${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
              )
            }}
          />
        </Dialog>
      )}
      {dialog === "city" && (
        <Dialog title="Ваш город" onClose={close}>
          <CityContents
            city={store.city}
            onSelect={(city) => {
              store.setCity(city)
              close()
            }}
          />
        </Dialog>
      )}
      {dialog === "menu" && (
        <Dialog title="Меню NORD" drawer onClose={close}>
          <MobileMenuContents
            onClose={close}
            onCity={() => setDialog("city")}
          />
        </Dialog>
      )}
      {store.drawer && (
        <Dialog
          title="Ваша корзина"
          drawer
          onClose={() => store.setDrawer(false)}
        >
          <CartContents drawer />
        </Dialog>
      )}
      {store.toast && !store.drawer && (
        <div className="toast" role="status">
          <Check size={18} />
          {store.toast}
        </div>
      )}
      {(store.recovery || store.cartError) && !store.drawer && (
        <div className="form-error cart-load-notice" role="alert">
          <p>
            {store.recovery
              ? "Проверяем результат оформления. Сохранённую корзину можно изменить после проверки заказа."
              : store.cartError}
          </p>
          <button
            type="button"
            className="text-link"
            disabled={store.recovering}
            onClick={() =>
              void (
                store.recovery ? store.resumeOrder() : store.refreshCart()
              ).catch(() => {})
            }
          >
            {store.recovering ? "Проверяем заказ…" : "Повторить"}
          </button>
        </div>
      )}
    </div>
  )
}
