"use client"

import type { PriceFacet } from "@lib/nord/types"
import { money } from "@lib/nord/format"

export function PriceFilter({
  price,
  params,
  priceLimit,
  resultCount,
  update,
  resetPrice,
}: {
  price: PriceFacet
  params: URLSearchParams
  priceLimit: number
  resultCount: number
  update: (name: string, value: string) => void
  resetPrice: () => void
}) {
  const read = (name: string, fallback: number) => {
    const value = params.get(name)
    const number = value === null || value === "" ? fallback : Number(value)
    return Number.isFinite(number)
      ? Math.max(0, Math.min(priceLimit, number))
      : fallback
  }
  const selectedMin = read(
    "minPrice",
    Math.min(price.min, read("maxPrice", price.max)),
  )
  const selectedMax = read("maxPrice", Math.max(price.max, selectedMin))
  const rangeMin = Math.min(price.min, selectedMin, selectedMax)
  const rangeMax = Math.max(price.max, selectedMin, selectedMax, rangeMin + 1)
  const width = rangeMax - rangeMin
  const minPosition = ((selectedMin - rangeMin) / width) * 100
  const maxPosition = ((selectedMax - rangeMin) / width) * 100
  const largestBin = Math.max(1, ...price.bins.map((bin) => bin.count))
  return (
    <details className="facet-group price-facet" open>
      <summary>
        Цена, ₽
        <span
          title={`Товаров в выбранной цене: ${resultCount}; доступно по остальным фильтрам: ${price.count}`}
        >
          {resultCount}
        </span>
      </summary>
      <div className="price-inputs facet-price">
        <label>
          <span>От</span>
          <input
            type="number"
            min="0"
            max={priceLimit}
            step="1"
            aria-label="Минимальная цена"
            value={selectedMin}
            onChange={(event) => update("minPrice", event.target.value)}
          />
        </label>
        <label>
          <span>До</span>
          <input
            type="number"
            min="0"
            max={priceLimit}
            step="1"
            aria-label="Максимальная цена"
            value={selectedMax}
            onChange={(event) => update("maxPrice", event.target.value)}
          />
        </label>
      </div>
      <div
        className={`price-distribution ${price.min === price.max ? "single-price" : ""}`}
        role="img"
        aria-label={`Распределение цен: ${price.bins.map((bin) => `${money(bin.from)} — ${money(bin.to)}: ${bin.count} товаров`).join("; ")}`}
      >
        {price.bins.map((bin, index) => (
          <div
            key={index}
            className={`price-bin ${bin.to >= selectedMin && bin.from <= selectedMax ? "selected" : ""}`}
            title={`${money(bin.from)} — ${money(bin.to)}: ${bin.count} товаров`}
          >
            <span style={{ height: `${(bin.count / largestBin) * 100}%` }} />
          </div>
        ))}
      </div>
      <div
        className="dual-price-slider"
        onPointerDown={(event) => {
          if (
            (event.target as HTMLElement).tagName === "INPUT" ||
            !price.count ||
            price.min === price.max
          )
            return
          const bounds = event.currentTarget.getBoundingClientRect()
          const value = Math.round(
            rangeMin +
              Math.max(
                0,
                Math.min(1, (event.clientX - bounds.left) / bounds.width),
              ) *
                width,
          )
          if (Math.abs(value - selectedMin) < Math.abs(value - selectedMax))
            update("minPrice", String(Math.min(value, selectedMax)))
          else update("maxPrice", String(Math.max(value, selectedMin)))
        }}
      >
        <span className="dual-price-track" />
        <span
          className="dual-price-selected"
          style={{
            left: `${Math.min(minPosition, maxPosition)}%`,
            right: `${100 - Math.max(minPosition, maxPosition)}%`,
          }}
        />
        <input
          className="range-min"
          style={{ zIndex: minPosition > 90 ? 4 : 2 }}
          type="range"
          min={rangeMin}
          max={rangeMax}
          step="1"
          value={selectedMin}
          disabled={!price.count || price.min === price.max}
          onChange={(event) =>
            update(
              "minPrice",
              String(Math.min(Number(event.target.value), selectedMax)),
            )
          }
          aria-label="Нижняя граница цены"
        />
        <input
          className="range-max"
          type="range"
          min={rangeMin}
          max={rangeMax}
          step="1"
          value={selectedMax}
          disabled={!price.count || price.min === price.max}
          onChange={(event) =>
            update(
              "maxPrice",
              String(Math.max(Number(event.target.value), selectedMin)),
            )
          }
          aria-label="Верхняя граница цены"
        />
      </div>
      <div className="dual-price-captions">
        <span>{money(selectedMin)}</span>
        <span>{money(selectedMax)}</span>
      </div>
      {selectedMin > selectedMax && (
        <p className="field-error small-text">
          Цена «от» должна быть меньше цены «до».
        </p>
      )}
      {(params.has("minPrice") || params.has("maxPrice")) && (
        <button type="button" className="reset-price" onClick={resetPrice}>
          Сбросить цену
        </button>
      )}
    </details>
  )
}
