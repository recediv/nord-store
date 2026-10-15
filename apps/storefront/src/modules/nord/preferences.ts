"use client"

import { useCallback, useEffect, useState } from "react"
import type { StorefrontConfig } from "@lib/nord/types"
import { isProductHandle } from "@lib/nord/handles"

function saved<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback
  } catch {
    return fallback
  }
}
function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Preferences remain usable for this visit. */
  }
}
function handles(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter(isProductHandle))).slice(0, 100)
    : []
}
export function usePreferences(config: StorefrontConfig) {
  const [favorites, setFavorites] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [city, updateCity] = useState(config.showroom.city)
  const [storageReady, setStorageReady] = useState(false)
  useEffect(() => {
    setFavorites(handles(saved("nord.favorites.v1", [])))
    setRecent(handles(saved("nord.recent.v1", [])))
    const storedCity = saved<unknown>("nord.city", config.showroom.city)
    if (
      typeof storedCity === "string" &&
      storedCity.trim() &&
      storedCity.trim().length <= 100
    )
      updateCity(storedCity.trim())
    setStorageReady(true)
  }, [config.showroom.city])
  const setCity = useCallback((value: string) => {
    updateCity(value.slice(0, 100))
    persist("nord.city", value.slice(0, 100))
  }, [])
  const toggleFavorite = useCallback(
    (handle: string) =>
      setFavorites((previous) => {
        const next = previous.includes(handle)
          ? previous.filter((value) => value !== handle)
          : [...previous, handle].slice(-100)
        persist("nord.favorites.v1", next)
        return next
      }),
    [],
  )
  const recordView = useCallback(
    (handle: string) =>
      setRecent((previous) => {
        if (previous[0] === handle) return previous
        const next = [
          handle,
          ...previous.filter((value) => value !== handle),
        ].slice(0, 24)
        persist("nord.recent.v1", next)
        return next
      }),
    [],
  )
  return {
    favorites,
    recent,
    storageReady,
    city,
    setCity,
    toggleFavorite,
    recordView,
  }
}
