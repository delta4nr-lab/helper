"use client"

import * as React from "react"

// Прев'ю одного DOCX-шаблону: сервер уже обрав випадковий { id, title },
// клієнт тягне байти з публічного роута і рендерить через docx-preview —
// зі збереженням структури документа (таблиці, вирівнювання, шрифти).
// Аркуш масштабується, щоб повністю вміщатися у вікно прев'ю (мініатюра).
// Без ротації: один шаблон до наступного завантаження сторінки.

export type PreviewDocItem = {
  id: string
  title: string
}

type Status = "loading" | "ready" | "error"

export function PreviewDoc({ item }: { item: PreviewDocItem }) {
  const frameRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [status, setStatus] = React.useState<Status>("loading")

  React.useEffect(() => {
    const frame = frameRef.current
    const container = containerRef.current
    if (!frame || !container) return

    let cancelled = false
    let disposeObserver: (() => void) | undefined
    container.replaceChildren()
    container.style.width = ""
    container.style.height = ""
    setStatus("loading")

    // Масштабує аркуш так, щоб він цілком уміщався у вікні прев'ю.
    const fit = (page: HTMLElement, wrapper: HTMLElement) => {
      const frameW = frame.clientWidth
      const frameH = frame.clientHeight
      const pageW = page.offsetWidth
      const pageH = page.offsetHeight
      if (!frameW || !frameH || !pageW || !pageH) return
      const scale = Math.min(frameW / pageW, frameH / pageH)
      wrapper.style.transform = `scale(${scale})`
      container.style.width = `${Math.round(pageW * scale)}px`
      container.style.height = `${Math.round(pageH * scale)}px`
    }

    void (async () => {
      try {
        const response = await fetch(`/api/templates/${item.id}/docx-preview`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(buffer, container, undefined, {
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
        })
        if (cancelled) return

        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper")
        const pages = wrapper
          ? Array.from(wrapper.querySelectorAll<HTMLElement>("section.docx"))
          : []
        const firstPage = pages[0]
        if (!wrapper || !firstPage) {
          setStatus("error")
          return
        }

        // Прев'ю = перша сторінка; решту ховаємо, щоб не плодити прокрутку.
        pages.slice(1).forEach((page) => {
          page.style.display = "none"
        })

        // Прибираємо сірий фон і відступи ворпера docx-preview.
        wrapper.style.background = "transparent"
        wrapper.style.padding = "0"
        wrapper.style.display = "block"
        wrapper.style.transformOrigin = "top left"

        fit(firstPage, wrapper)

        const observer = new ResizeObserver(() => fit(firstPage, wrapper))
        observer.observe(frame)
        disposeObserver = () => observer.disconnect()

        setStatus("ready")
      } catch (error) {
        console.warn("[template-preview] не вдалося відрендерити DOCX", error)
        if (!cancelled) setStatus("error")
      }
    })()

    return () => {
      cancelled = true
      disposeObserver?.()
    }
  }, [item.id])

  return (
    <div className="mx-auto max-w-130 bg-white shadow-inner dark:bg-zinc-900">
      {status === "error" ? (
        <p className="py-8 text-center text-xs text-zinc-500">
          Не вдалося відобразити документ.
        </p>
      ) : (
        <div
          ref={frameRef}
          className="relative flex aspect-[210/297] w-full items-start justify-center overflow-hidden"
        >
          <div ref={containerRef} />
        </div>
      )}
    </div>
  )
}
