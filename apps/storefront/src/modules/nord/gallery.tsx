"use client"

import { useState, type CSSProperties } from "react"
import { ArrowUpRight, Plus } from "lucide-react"
import type { Product } from "@lib/nord/types"
import { money } from "@lib/nord/format"
import { useNord } from "@modules/nord/provider"
import { Link } from "@modules/nord/link"
import { StoreImage } from "@modules/nord/image"

export function GalleryShowcase({ objects: products }: { objects: Product[] }) {
  const { config } = useNord()
  const [active, setActive] = useState(config.scenes[0]?.handle || "")
  const objects = config.scenes.flatMap((scene) => {
    const product = products.find((product) => product.handle === scene.handle)
    return product ? [{ ...scene, product }] : []
  })
  const visible = objects.some((scene) => scene.handle === active)
    ? active
    : objects[0]?.handle

  return (
    <section className="gallery-showcase" aria-labelledby="showcase-title">
      <h2 id="showcase-title" className="sr-only">
        Предметы коллекции
      </h2>
      {objects.map((scene, index) => {
        const expanded = scene.handle === visible
        const panelId = `showcase-${scene.handle}`
        return (
          <article
            key={scene.handle}
            className={`showcase-panel ${expanded ? "is-expanded" : ""} ${scene.cutout ? "has-cutout" : ""}`}
            style={
              {
                "--panel-bg": scene.bg,
                "--panel-ink": scene.ink,
                "--panel-muted": scene.muted,
              } as CSSProperties
            }
          >
            <button
              type="button"
              className="showcase-switch"
              aria-label={`Показать ${scene.product.name}`}
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setActive(scene.handle)}
            >
              <span className="preview-index">0{index + 1}</span>
              <span className="preview-name">
                {expanded
                  ? config.categories.find(
                      (category) => category.id === scene.product.category,
                    )?.name
                  : scene.product.name}
              </span>
              <Plus size={17} />
            </button>
            <div
              className="showcase-content"
              id={panelId}
              aria-hidden={!expanded}
              inert={!expanded}
            >
              <Link
                className="showcase-image"
                href={`/product/${scene.handle}`}
                tabIndex={expanded ? 0 : -1}
              >
                <StoreImage
                  image={scene.image}
                  preset="showcase"
                  alt={expanded ? scene.product.name : ""}
                  fetchPriority={index === 0 ? "high" : "auto"}
                />
              </Link>
              <Link
                className="showcase-caption"
                href={`/product/${scene.handle}`}
                tabIndex={expanded ? 0 : -1}
              >
                <div>
                  <span>{scene.product.material}</span>
                  <h3>{scene.product.name}</h3>
                </div>
                <span>
                  {money(scene.product.price)}
                  <ArrowUpRight size={21} />
                </span>
              </Link>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default GalleryShowcase
