'use client'

/**
 * Pan/zoom viewer for the poster-size coin-type hierarchy diagram generated
 * by scripts/gen-coin-hierarchy-diagram.py (public/images/coin-type-hierarchy.png
 * + public/data/coin-type-hierarchy.json — the manifest of every node's
 * bilingual label and pixel bounding box in that image).
 *
 * The image itself already bakes in the labels/photos/silhouettes/connecting
 * lines — this component only adds the interaction layer on top: drag to
 * pan, wheel/pinch to zoom, and one invisible clickable overlay per manifest
 * node (positioned in the same raw pixel space as the image, since it's a
 * sibling inside the same scaled/translated layer) that smoothly zooms the
 * view to frame that node on click.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export type TypologyViewerNode = {
  id: string
  level: number
  labelZh: string
  labelEn: string
  path?: string[]
  hasOwnPhoto?: boolean
  bbox: [number, number, number, number]
}

export type TypologyViewerManifest = {
  width: number
  height: number
  nodes: TypologyViewerNode[]
}

const MAX_SCALE = 3
const CLICK_DRAG_THRESHOLD = 6
const NODE_ZOOM_PADDING = 70
const ZOOM_BUTTON_FACTOR = 1.5
const TRANSITION_MS = 450

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function TypologyViewer({
  src,
  manifest,
  height = 620,
}: {
  src: string
  manifest: TypologyViewerManifest
  height?: number
}) {
  const { t, lang } = useLanguage()
  const viewportRef = useRef<HTMLDivElement>(null)
  const minScaleRef = useRef(0.05)

  const [transform, setTransform] = useState({ scale: 0, tx: 0, ty: 0 })
  const [transitioning, setTransitioning] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const ready = transform.scale > 0

  const draggingRef = useRef(false)
  const lastPointRef = useRef({ x: 0, y: 0 })
  const dragDistRef = useRef(0)
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchStartDistRef = useRef(0)
  const pinchStartScaleRef = useRef(1)

  const fitToView = useCallback(() => {
    const vp = viewportRef.current
    if (!vp) return
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    const fitScale = Math.min(vw / manifest.width, vh / manifest.height)
    minScaleRef.current = fitScale
    setTransitioning(true)
    setTransform({
      scale: fitScale,
      tx: (vw - manifest.width * fitScale) / 2,
      ty: (vh - manifest.height * fitScale) / 2,
    })
    window.setTimeout(() => setTransitioning(false), TRANSITION_MS)
  }, [manifest.width, manifest.height])

  // Fit-to-view on mount, and re-fit whenever the panel's own size changes
  // (e.g. the window is resized) — only while the user hasn't zoomed past
  // the fit level yet, so we don't yank the view out from under someone
  // mid-exploration just because they resized their window a little.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    fitToView()
    const observer = new ResizeObserver(() => {
      setTransform((prev) => {
        const vw = vp.clientWidth
        const vh = vp.clientHeight
        const fitScale = Math.min(vw / manifest.width, vh / manifest.height)
        const wasAtFit = Math.abs(prev.scale - minScaleRef.current) < 0.001
        minScaleRef.current = fitScale
        if (!wasAtFit) return prev
        return { scale: fitScale, tx: (vw - manifest.width * fitScale) / 2, ty: (vh - manifest.height * fitScale) / 2 }
      })
    })
    observer.observe(vp)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zoomAt = useCallback((cursorX: number, cursorY: number, factor: number) => {
    setTransform((prev) => {
      const newScale = clamp(prev.scale * factor, minScaleRef.current, MAX_SCALE)
      const contentX = (cursorX - prev.tx) / prev.scale
      const contentY = (cursorY - prev.ty) / prev.scale
      return { scale: newScale, tx: cursorX - contentX * newScale, ty: cursorY - contentY * newScale }
    })
  }, [])

  const zoomToNode = useCallback((node: TypologyViewerNode) => {
    const vp = viewportRef.current
    if (!vp) return
    const [x0, y0, x1, y1] = node.bbox
    const nodeW = x1 - x0
    const nodeH = y1 - y0
    const vw = vp.clientWidth
    const vh = vp.clientHeight
    const targetScale = clamp(
      Math.min((vw - NODE_ZOOM_PADDING * 2) / nodeW, (vh - NODE_ZOOM_PADDING * 2) / nodeH),
      minScaleRef.current,
      MAX_SCALE
    )
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    setTransitioning(true)
    setTransform({ scale: targetScale, tx: vw / 2 - cx * targetScale, ty: vh / 2 - cy * targetScale })
    window.setTimeout(() => setTransitioning(false), TRANSITION_MS)
  }, [])

  // React's onWheel prop is passive by default, so e.preventDefault() inside
  // it silently no-ops and the page scrolls instead of the viewer zooming --
  // a real (non-passive) listener is the only way to actually stop that.
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    function onWheelNative(e: WheelEvent) {
      e.preventDefault()
      const rect = vp!.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
    }
    vp.addEventListener('wheel', onWheelNative, { passive: false })
    return () => vp.removeEventListener('wheel', onWheelNative)
  }, [zoomAt])

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 1) {
      draggingRef.current = true
      lastPointRef.current = { x: e.clientX, y: e.clientY }
      dragDistRef.current = 0
    } else if (pointersRef.current.size === 2) {
      draggingRef.current = false
      const pts = [...pointersRef.current.values()]
      pinchStartDistRef.current = dist(pts[0], pts[1])
      pinchStartScaleRef.current = transform.scale
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2) {
      const rect = viewportRef.current!.getBoundingClientRect()
      const pts = [...pointersRef.current.values()]
      const d = dist(pts[0], pts[1])
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top
      if (pinchStartDistRef.current > 0) {
        const targetScale = clamp(
          (pinchStartScaleRef.current * d) / pinchStartDistRef.current,
          minScaleRef.current,
          MAX_SCALE
        )
        setTransform((prev) => {
          const contentX = (midX - prev.tx) / prev.scale
          const contentY = (midY - prev.ty) / prev.scale
          return { scale: targetScale, tx: midX - contentX * targetScale, ty: midY - contentY * targetScale }
        })
      }
      return
    }

    if (!draggingRef.current) return
    const dx = e.clientX - lastPointRef.current.x
    const dy = e.clientY - lastPointRef.current.y
    dragDistRef.current += Math.abs(dx) + Math.abs(dy)
    lastPointRef.current = { x: e.clientX, y: e.clientY }
    setTransform((prev) => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }))
  }

  function onPointerUp(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchStartDistRef.current = 0
    if (pointersRef.current.size === 0) draggingRef.current = false
  }

  function handleNodeClick(node: TypologyViewerNode) {
    if (dragDistRef.current > CLICK_DRAG_THRESHOLD) return
    zoomToNode(node)
  }

  const clickableNodes = useMemo(() => manifest.nodes, [manifest.nodes])

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{t('coinTypeList.typologyViewer.hint')}</p>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              const vp = viewportRef.current!
              zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, ZOOM_BUTTON_FACTOR)
            }}
            aria-label={t('coinTypeList.typologyViewer.zoomIn')}
            className="flex h-8 w-8 items-center justify-center rounded border border-brand/30 bg-white text-lg font-semibold text-brand shadow-sm transition hover:bg-brand-light"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              const vp = viewportRef.current!
              zoomAt(vp.clientWidth / 2, vp.clientHeight / 2, 1 / ZOOM_BUTTON_FACTOR)
            }}
            aria-label={t('coinTypeList.typologyViewer.zoomOut')}
            className="flex h-8 w-8 items-center justify-center rounded border border-brand/30 bg-white text-lg font-semibold text-brand shadow-sm transition hover:bg-brand-light"
          >
            &minus;
          </button>
          <button
            type="button"
            onClick={fitToView}
            aria-label={t('coinTypeList.typologyViewer.reset')}
            className="rounded border border-brand/30 bg-white px-2.5 text-xs font-semibold text-brand shadow-sm transition hover:bg-brand-light"
          >
            {t('coinTypeList.typologyViewer.reset')}
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ height, touchAction: 'none' }}
        className="relative w-full cursor-grab overflow-hidden rounded border border-brand/15 bg-white active:cursor-grabbing"
      >
        {ready && (
          <div
            style={{
              width: manifest.width,
              height: manifest.height,
              transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              transition: transitioning ? `transform ${TRANSITION_MS}ms ease` : undefined,
            }}
            className="absolute left-0 top-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a single
                huge poster image panned/zoomed via raw CSS transforms; next/image's
                responsive-sizing pipeline isn't a fit for this. */}
            <img
              src={src}
              alt="Coin type hierarchy diagram"
              width={manifest.width}
              height={manifest.height}
              draggable={false}
              style={{ width: manifest.width, height: manifest.height, maxWidth: 'none', display: 'block' }}
            />
            {clickableNodes.map((node) => {
              const [x0, y0, x1, y1] = node.bbox
              const isHovered = hovered === node.id
              return (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
                  title={`${node.labelZh} · ${node.labelEn}`}
                  style={{ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }}
                  className={`absolute cursor-pointer rounded transition-colors ${
                    isHovered ? 'bg-brand/10 ring-2 ring-brand' : ''
                  }`}
                />
              )
            })}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-[11px] text-gray-500 shadow-sm">
          {lang === 'zh' ? '早期中国钱币类型学层级图' : 'Early Chinese Coin Type Hierarchy'}
        </div>
      </div>
    </div>
  )
}
