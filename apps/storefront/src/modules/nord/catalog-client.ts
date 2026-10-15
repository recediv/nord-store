"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CatalogResult } from "@lib/nord/types"
import { useNord } from "./provider"

const PAGE_SIZE = 12
type Snapshot = {
  key: string
  scope: string
  data: CatalogResult
  nextOffset: number
}
const snapshots = new Map<string, Snapshot>()

function requestKey(params: URLSearchParams, favorites: string[]) {
  const next = new URLSearchParams(params)
  next.delete("offset")
  next.delete("favorites")
  next.set("limit", String(PAGE_SIZE))
  if (next.get("collection") === "favorites")
    next.set("favorites", [...favorites].sort().join(","))
  next.sort()
  return next.toString()
}

function remember(snapshot: Snapshot) {
  snapshots.delete(snapshot.key)
  snapshots.set(snapshot.key, snapshot)
  if (snapshots.size > 24) snapshots.delete(snapshots.keys().next().value!)
}

export function useCatalogClient(
  params: URLSearchParams,
  initial: CatalogResult,
  seedQuery: string,
) {
  const { catalogScope, favorites, storageReady, loadCatalog } = useNord()
  const personalized = params.get("collection") === "favorites"
  const ready = !personalized || storageReady
  const queryKey = requestKey(params, favorites)
  const key = JSON.stringify([catalogScope, queryKey])
  const seedKey = requestKey(new URLSearchParams(seedQuery), [])
  const seedAllowed = !personalized && queryKey === seedKey
  const [snapshot, setSnapshot] = useState<Snapshot | undefined>(() => {
    const saved = typeof window !== "undefined" ? snapshots.get(key) : undefined
    return (
      saved ||
      (seedAllowed
        ? {
            key,
            scope: catalogScope,
            data: initial,
            nextOffset: initial.offset + initial.products.length,
          }
        : undefined)
    )
  })
  // Read the saved full range during render, before Next restores scroll on Back.
  const owned = snapshot?.key === key ? snapshot : snapshots.get(key)
  const current =
    owned ||
    (seedAllowed
      ? {
          key,
          scope: catalogScope,
          data: initial,
          nextOffset: initial.offset + initial.products.length,
        }
      : undefined)
  const data = ready
    ? current?.data ||
      (!personalized && snapshot?.scope === catalogScope
        ? snapshot.data
        : undefined)
    : undefined
  const [request, setRequest] = useState({ key, pending: !current, error: "" })
  const [revision, setRevision] = useState(0)
  const observedRevision = useRef(0)
  const generation = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const busy = useRef(false)
  const seed = useRef({ key: seedKey, data: initial })
  seed.current = { key: seedKey, data: initial }

  useEffect(() => {
    const version = ++generation.current
    controller.current?.abort()
    busy.current = false
    if (!ready) return
    const abort = new AbortController()
    controller.current = abort
    const saved = snapshots.get(key)
    const supplied =
      !personalized && seed.current.key === queryKey
        ? seed.current.data
        : undefined
    const available =
      saved ||
      (supplied
        ? {
            key,
            scope: catalogScope,
            data: supplied,
            nextOffset: supplied.offset + supplied.products.length,
          }
        : undefined)
    const forced = observedRevision.current !== revision
    observedRevision.current = revision
    if (
      available &&
      !forced &&
      available.data.generatedAt + 30000 > Date.now()
    ) {
      remember(available)
      setSnapshot(available)
      setRequest({ key, pending: false, error: "" })
      return () => {
        abort.abort()
        controller.current?.abort()
      }
    }
    const wanted = Math.max(PAGE_SIZE, saved?.data.products.length || 0)
    busy.current = true
    setRequest({ key, pending: true, error: "" })
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams(queryKey)
        query.set("limit", String(Math.min(24, wanted)))
        const head = await loadCatalog(query, abort.signal)
        const products = new Map(
          head.products.map((product) => [product.handle, product]),
        )
        let nextOffset = head.offset + head.products.length
        let generatedAt = head.generatedAt
        while (products.size < wanted && nextOffset < head.count) {
          abort.signal.throwIfAborted()
          query.set("offset", String(nextOffset))
          query.set("limit", String(Math.min(24, wanted - products.size)))
          const next = await loadCatalog(query, abort.signal)
          if (!next.products.length) break
          for (const product of next.products)
            products.set(product.handle, product)
          nextOffset = next.offset + next.products.length
          generatedAt = Math.min(generatedAt, next.generatedAt)
        }
        if (abort.signal.aborted || version !== generation.current) return
        const next = {
          key,
          scope: catalogScope,
          data: {
            ...head,
            products: Array.from(products.values()),
            generatedAt,
            offset: 0,
            limit: PAGE_SIZE,
          },
          nextOffset,
        }
        remember(next)
        setSnapshot(next)
        setRequest({ key, pending: false, error: "" })
      } catch (error) {
        if (!abort.signal.aborted && version === generation.current)
          setRequest({
            key,
            pending: false,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить товары.",
          })
      } finally {
        if (version === generation.current) busy.current = false
      }
    }, 180)
    return () => {
      clearTimeout(timer)
      abort.abort()
      controller.current?.abort()
    }
  }, [key, queryKey, catalogScope, ready, personalized, loadCatalog, revision])

  const loadMore = useCallback(async () => {
    const saved = snapshots.get(key)
    if (
      !ready ||
      busy.current ||
      !saved ||
      saved.nextOffset >= saved.data.count
    )
      return
    busy.current = true
    const version = generation.current
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setRequest({ key, pending: true, error: "" })
    try {
      const query = new URLSearchParams(queryKey)
      query.set("offset", String(saved.nextOffset))
      const next = await loadCatalog(query, abort.signal)
      if (abort.signal.aborted || version !== generation.current) return
      const products = new Map(
        saved.data.products.map((product) => [product.handle, product]),
      )
      for (const product of next.products) products.set(product.handle, product)
      const combined = {
        key,
        scope: catalogScope,
        data: {
          ...next,
          offset: 0,
          products: Array.from(products.values()),
          generatedAt: Math.min(saved.data.generatedAt, next.generatedAt),
        },
        nextOffset: next.offset + next.products.length,
      }
      // An empty page cannot be retried indefinitely after the catalogue shrinks.
      if (!next.products.length) combined.nextOffset = next.count
      remember(combined)
      setSnapshot(combined)
      setRequest({ key, pending: false, error: "" })
    } catch (error) {
      if (!abort.signal.aborted && version === generation.current)
        setRequest({
          key,
          pending: false,
          error:
            error instanceof Error
              ? error.message
              : "Не удалось загрузить следующую страницу.",
        })
    } finally {
      if (version === generation.current) busy.current = false
    }
  }, [key, queryKey, catalogScope, ready, loadCatalog])

  return {
    data,
    pending: !ready || (request.key === key ? request.pending : !current),
    error: request.key === key ? request.error : "",
    hasMore: !!current && current.nextOffset < current.data.count,
    loadMore,
    retry: () => setRevision((value) => value + 1),
  }
}
