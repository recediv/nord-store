"use client"

import { Fragment } from "react"
import type { CatalogResult, Facet } from "@lib/nord/types"
import { PriceFilter } from "./price-filter"

export function CatalogFilters({
  result,
  params,
  activeCount,
  reset,
  update,
  toggle,
  resetPrice,
}: {
  result: CatalogResult
  params: URLSearchParams
  activeCount: number
  reset: () => void
  update: (name: string, value: string) => void
  toggle: (name: Facet, value: string) => void
  resetPrice: () => void
}) {
  const priceControls = (
    <PriceFilter
      price={result.price}
      params={params}
      priceLimit={result.priceLimit}
      resultCount={result.count}
      update={update}
      resetPrice={resetPrice}
    />
  )
  return (
    <div className="filter-controls">
      <div className="filter-title">
        <h2>
          Фильтры{" "}
          {activeCount > 0 && (
            <span className="filter-active-count">{activeCount}</span>
          )}
        </h2>
        {(activeCount > 0 || params.get("q")) && (
          <button type="button" onClick={reset}>
            Сбросить всё
          </button>
        )}
      </div>
      <label className="facet-option stock-facet">
        <input
          type="checkbox"
          checked={params.get("inStock") === "true"}
          onChange={(event) =>
            update("inStock", event.target.checked ? "true" : "")
          }
        />
        <span>Только в наличии</span>
        <span className="facet-count">{result.availableCount}</span>
      </label>
      {result.facets.map((facet) => {
        const selected = (params.get(facet.id) || "").split(",").filter(Boolean)
        return (
          <Fragment key={facet.id}>
            <details className="facet-group" open>
              <summary>
                {facet.title}
                <span>{selected.length || ""}</span>
              </summary>
              <fieldset>
                <legend className="sr-only">{facet.title}</legend>
                {facet.options.map((option) => {
                  const checked = selected.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`facet-option ${!option.count && !checked ? "facet-disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${option.label}, ${option.count} товаров`}
                        checked={checked}
                        disabled={!option.count && !checked}
                        onChange={() => toggle(facet.id, option.value)}
                      />
                      {option.hex && (
                        <i
                          className="facet-color"
                          style={{ background: option.hex }}
                          aria-hidden="true"
                        />
                      )}
                      <span>{option.label}</span>
                      <span className="facet-count" aria-hidden="true">
                        {option.count}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            </details>
            {facet.id === "category" && priceControls}
          </Fragment>
        )
      })}
      {!result.facets.some((facet) => facet.id === "category") && priceControls}
    </div>
  )
}
