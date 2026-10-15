"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, ChevronDown } from "lucide-react"
import { useNord } from "./provider"
import { Link } from "./link"
import { StoreImage } from "./image"

export default function MegaMenu() {
  const { config } = useNord()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hover = useRef(false)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        button.current?.focus()
      }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])
  useEffect(() => () => cancel(), [])
  return (
    <div
      ref={root}
      className={`nav-catalog ${open ? "is-open" : ""}`}
      onMouseEnter={() => {
        cancel()
        if (!open) {
          hover.current = true
          setOpen(true)
        }
      }}
      onMouseLeave={() => {
        timer.current = setTimeout(() => {
          hover.current = false
          setOpen(false)
        }, 160)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className="catalog-menu-trigger"
        aria-expanded={open}
        aria-controls="catalog-mega-menu"
        onClick={(event) => {
          if (event.detail && hover.current) {
            hover.current = false
            setOpen(true)
          } else {
            hover.current = false
            setOpen((value) => !value)
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setOpen(true)
            requestAnimationFrame(() =>
              root.current
                ?.querySelector<HTMLAnchorElement>(".mega-category")
                ?.focus(),
            )
          }
        }}
      >
        Каталог <ChevronDown size={15} />
      </button>
      <div
        className="mega-panel"
        id="catalog-mega-menu"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="container mega-inner">
          <div className="mega-intro">
            <span className="eyebrow">СОБЕРИТЕ СВОЙ ДОМ</span>
            <h2>
              У каждой вещи
              <br />
              свой характер.
            </h2>
            <p>
              Найдите то, что сделает
              <br />
              пространство вашим.
            </p>
            <Link
              className="text-link"
              href="/catalog"
              onClick={() => setOpen(false)}
            >
              Весь каталог <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mega-categories">
            {config.categories.map((category) => (
              <Link
                key={category.id}
                className="mega-category"
                href={`/catalog?category=${category.id}`}
                onClick={() => setOpen(false)}
              >
                <div className="mega-image">
                  {open && (
                    <StoreImage
                      image={category.image}
                      preset="menu"
                      alt={category.name}
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="mega-category-title">
                  <strong>{category.name}</strong>
                  <ArrowRight size={16} />
                </div>
                <span>{config.categoryCounts[category.id] || 0} товаров</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="mega-bottom container">
          <span>Продуманные вещи для повседневной жизни</span>
          <Link
            href="/catalog?collection=featured"
            onClick={() => setOpen(false)}
          >
            Выбрано для вас <ArrowRight size={15} />
          </Link>
          <Link href="/catalog?collection=sale" onClick={() => setOpen(false)}>
            Особые цены <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
