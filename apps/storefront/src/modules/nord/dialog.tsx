"use client"

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ChevronDown, X } from "lucide-react"

export function Dialog({
  title,
  onClose,
  children,
  drawer = false,
  wide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  drawer?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const [closing, setClosing] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const close = useRef(onClose)
  close.current = onClose
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function requestClose() {
    if (timer.current) return
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      close.current()
      return
    }
    setClosing(true)
    timer.current = setTimeout(() => close.current(), drawer ? 240 : 180)
  }
  useEffect(() => {
    const dialog = ref.current!
    const documentRoot = document.documentElement
    const oldOverflow = documentRoot.style.overflowY
    const oldGap = documentRoot.style.getPropertyValue("--nord-scrollbar-gap")
    const gap = Math.max(
      0,
      window.innerWidth - documentRoot.getBoundingClientRect().width,
    )
    documentRoot.style.setProperty("--nord-scrollbar-gap", `${gap}px`)
    documentRoot.style.overflowY = "hidden"
    dialog.showModal()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      dialog.close()
      documentRoot.style.overflowY = oldOverflow
      documentRoot.style.setProperty("--nord-scrollbar-gap", oldGap)
    }
  }, [])
  useEffect(() => {
    const dialog = ref.current!
    const update = () =>
      setCanScroll(
        dialog.scrollHeight - dialog.clientHeight - dialog.scrollTop > 3,
      )
    const observer = new ResizeObserver(update)
    observer.observe(dialog.querySelector(".dialog-inner")!)
    dialog.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      dialog.removeEventListener("scroll", update)
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog ${drawer ? "drawer" : ""} ${wide ? "wide" : ""} ${closing ? "is-closing" : ""}`}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-heading">
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Закрыть"
            onClick={requestClose}
          >
            <X size={23} />
          </button>
        </div>
        {children}
      </div>
      {drawer && canScroll && (
        <div className="drawer-scroll-cue" aria-hidden="true">
          <ChevronDown size={20} />
        </div>
      )}
    </dialog>
  )
}
