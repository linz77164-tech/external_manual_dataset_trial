"use client"

// ============================================================
// MorphingText — SVG Path Interpolation with Spring Physics
// ============================================================
//
// Core Principle: Path Resampling + Centroid Alignment
//
//   1. FONT → PATH: opentype.js parses TrueType/OpenType fonts into
//      SVG path data (M/L/C/Z commands) for each text string.
//
//   2. FLATTEN: All curve segments (cubic/quadratic Bézier) are
//      recursively subdivided into line segments (polyline).
//
//   3. RESAMPLE: Each polyline is re-sampled to a uniform number of
//      points via arc-length parameterization. This equalizes the
//      point density across all paths, which is required for
//      point-to-point interpolation.
//
//   4. CENTROID ALIGNMENT: Sub-paths are matched across characters
//      using a multi-factor cost function (winding direction, area
//      similarity, centroid proximity). Matched pairs are rotated
//      so their starting points are closest, minimizing visual
//      "swirling" during interpolation. Unmatched sub-paths get
//      "ghost" padding — zero-area paths at the parent outline's
//      centroid that shrink/inflate smoothly (hole ↔ no-hole).
//
//   5. INTERPOLATE: Linear interpolation (lerp) between each pair
//      of corresponding points. The interpolation parameter `t` is
//      driven by a spring (motion/react useSpring), giving the
//      morphing a natural, bouncy feel with configurable stiffness
//      and damping.
//
//   6. SMOOTH OUTPUT: Optionally, the interpolated polyline is
//      converted to cubic Bézier curves via Catmull-Rom spline
//      tangent estimation, producing rounded, organic strokes.
//
// Performance: An adaptive sentinel monitors frame time. If the
// average interpolation cost exceeds 16ms (60fps budget), the
// sample count is automatically reduced. It recovers when headroom
// is available.
//
// Public API:
//   - precision: { numSamples } or { samplesPerUnit, minSamples, maxSamples }
//   - stiffness / damping: spring physics parameters
//   - onMorphComplete: callback fired when a morph cycle settles
//   - trigger: "auto" (cycles) | "hover" (enter/leave)
//   - smooth: Catmull-Rom cubic Bézier output (default: true)
//   - letterSpacing: extra inter-character spacing
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useSpring } from "motion/react"

import { cn } from "@/lib/utils"
import {
  DEFAULT_FONT_URL,
  getFontManager,
  getTextPathWithSpacing,
} from "@/registry/lib/font-loader"
import {
  interpolatePaths,
  parsedPathToD,
  preparePathsForMorph,
  smoothPathToD,
  type Precision,
} from "@/registry/lib/svg-path-utils"

type Font = import("opentype.js").Font

type TriggerMode = "auto" | "hover"

interface MorphingTextProps {
  /** Array of text strings to morph between */
  texts: string[]
  className?: string
  /** Font size in SVG units (default: 200) */
  fontSize?: number
  /** @deprecated Use precision instead */
  numSamples?: number
  /** Precision config: fixed numSamples or dynamic sampling */
  precision?: Precision
  /**
   * How morphing is triggered:
   * - "auto": cycles through texts automatically at `interval` seconds
   * - "hover": morphs to the next text on mouse enter, springs back on mouse leave
   * @default "auto"
   */
  trigger?: TriggerMode
  /** Interval between morph transitions in seconds (default: 3), only for trigger="auto" */
  interval?: number
  /** URL of the font file to load (default: /fonts/Inter-Regular.ttf) */
  fontUrl?: string
  /** Spring stiffness (default: 200) — higher = snappier */
  stiffness?: number
  /** Spring damping (default: 20) — lower = more bouncy */
  damping?: number
  /**
   * restDelta for the spring — controls when the spring is considered "at rest".
   * Smaller values = more overshoot before settling (viscous feel).
   * @default 0.001
   */
  restDelta?: number
  /**
   * In hover mode, which text index to morph TO on hover.
   * Defaults to the next text in the array (index 1).
   */
  hoverToIndex?: number
  /** SVG fill color for the text path (default: "currentColor") */
  fill?: string
  /**
   * Use Catmull-Rom cubic Bézier smoothing for the SVG output.
   * Produces rounded, organic curves instead of polygonal line segments.
   * @default true
   */
  smooth?: boolean
  /**
   * Extra spacing between characters (in font design units).
   * Gives the morphing text more physical space for smoother transitions.
   * @default 0
   */
  letterSpacing?: number
  /**
   * Callback fired when a morph transition completes (spring settles).
   * Receives the index of the text that the morph settled on.
   */
  onMorphComplete?: (settledIndex: number) => void
}

export const MorphingText: React.FC<MorphingTextProps> = ({
  texts,
  className,
  fontSize = 200,
  numSamples,
  precision,
  trigger = "auto",
  interval = 3,
  fontUrl = DEFAULT_FONT_URL,
  stiffness = 200,
  damping = 20,
  restDelta = 0.001,
  hoverToIndex,
  fill = "currentColor",
  smooth = true,
  letterSpacing = 0,
  onMorphComplete,
}) => {
  const [font, setFont] = useState<Font | null>(null)
  const mountedRef = useRef(true)

  const resolvedPrecision = useMemo<Precision>(() => {
    if (numSamples && numSamples > 0) return { numSamples }
    if (precision) return precision
    return { numSamples: 200 }
  }, [numSamples, precision])

  // ─── Performance Monitor: auto-downgrade precision if frame budget exceeded ───
  const [adaptiveNumSamples, setAdaptiveNumSamples] = useState<number | null>(null)
  const frameTimeHistory = useRef<number[]>([])
  const BUDGET_MS = 16 // 60fps = 16.67ms per frame

  const effectivePrecision = useMemo<Precision>(() => {
    if (adaptiveNumSamples !== null) {
      return { numSamples: adaptiveNumSamples }
    }
    return resolvedPrecision
  }, [adaptiveNumSamples, resolvedPrecision])

  const [isLoaded, setIsLoaded] = useState(false)

  // Load font (cached, SSR-safe, with error recovery)
  useEffect(() => {
    mountedRef.current = true
    setIsLoaded(false)
    getFontManager()
      .loadFont(fontUrl)
      .then((f) => {
        if (mountedRef.current) {
          setFont(f)
          setIsLoaded(true)
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setIsLoaded(false)
        }
      })
    return () => {
      mountedRef.current = false
    }
  }, [fontUrl])

  // Prepare morphing paths
  const preparedPaths = useMemo(() => {
    if (!font || texts.length === 0) return []
    try {
      const rawPaths = texts.map((text) => getTextPathWithSpacing(font, text, fontSize, letterSpacing))
      return preparePathsForMorph(
        rawPaths.filter((d) => d && d.trim().length > 0),
        effectivePrecision
      )
    } catch {
      return []
    }
  }, [font, texts, fontSize, letterSpacing, effectivePrecision])

  // ─── Spring-driven morph progress ───
  const morphProgress = useSpring(0, {
    stiffness,
    damping,
    restDelta,
  })

  // ─── Hover mode state ───
  const [isHovered, setIsHovered] = useState(false)
  const fromIndex = 0
  const toIndex = useMemo(() => {
    if (hoverToIndex !== undefined) return hoverToIndex
    return Math.min(1, Math.max(preparedPaths.length - 1, 0))
  }, [hoverToIndex, preparedPaths.length])

  // ─── Auto-cycle mode ───
  const [autoFromIndex, setAutoFromIndex] = useState(0)
  const autoToIndex = useMemo(
    () => (autoFromIndex + 1) % Math.max(preparedPaths.length, 1),
    [autoFromIndex, preparedPaths.length]
  )

  const activeFromIndex = trigger === "hover" ? fromIndex : autoFromIndex
  const activeToIndex = trigger === "hover" ? toIndex : autoToIndex

  // ─── onMorphComplete: detect spring settle ───
  const onMorphCompleteRef = useRef(onMorphComplete)
  onMorphCompleteRef.current = onMorphComplete

  const lastSettledIndex = useRef<number | null>(null)
  const morphSettled = useRef(false)

  // ─── Auto-cycle timer ───
  useEffect(() => {
    if (trigger !== "auto") return
    if (preparedPaths.length < 2) return

    let settleTimer: ReturnType<typeof setTimeout>

    const triggerMorph = () => {
      morphSettled.current = false
      morphProgress.set(0)
      requestAnimationFrame(() => {
        morphProgress.set(1)
      })

      const settleEstimate = (4 * damping) / stiffness + 0.3
      const pauseDuration = Math.max(interval - settleEstimate, 0.5)
      settleTimer = setTimeout(() => {
        setAutoFromIndex((prev) => (prev + 1) % preparedPaths.length)
      }, (settleEstimate + pauseDuration) * 1000)
    }

    triggerMorph()
    const cycleId = setInterval(triggerMorph, interval * 1000)

    return () => {
      clearInterval(cycleId)
      clearTimeout(settleTimer)
    }
  }, [trigger, preparedPaths.length, interval, morphProgress, stiffness, damping])

  // ─── Hover mode: drive spring based on hover state ───
  useEffect(() => {
    if (trigger !== "hover") return
    if (preparedPaths.length < 2) return

    if (isHovered) {
      morphSettled.current = false
      morphProgress.set(0)
      requestAnimationFrame(() => {
        morphProgress.set(1)
      })
    } else {
      morphProgress.set(0)
    }
  }, [isHovered, trigger, morphProgress, preparedPaths.length])

  // Mouse event handlers
  const handleMouseEnter = useCallback(() => {
    if (trigger === "hover") setIsHovered(true)
  }, [trigger])

  const handleMouseLeave = useCallback(() => {
    if (trigger === "hover") setIsHovered(false)
  }, [trigger])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (trigger === "hover" && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        setIsHovered(true)
      }
    },
    [trigger]
  )

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (trigger === "hover" && (e.key === "Enter" || e.key === " ")) {
        setIsHovered(false)
      }
    },
    [trigger]
  )

  // ─── Derive interpolated `d` attribute from spring value ───
  const [currentD, setCurrentD] = useState("")

  const toD = smooth ? smoothPathToD : parsedPathToD

  useEffect(() => {
    if (preparedPaths.length === 0) return
    if (preparedPaths.length === 1) {
      setCurrentD(toD(preparedPaths[0]))
      return
    }

    setCurrentD(toD(preparedPaths[activeFromIndex]))

    const unsubscribe = morphProgress.on("change", (t: number) => {
      const start = performance.now()

      const clamped = Math.max(0, Math.min(1, t))
      const interpolated = interpolatePaths(
        preparedPaths[activeFromIndex],
        preparedPaths[activeToIndex],
        clamped
      )
      setCurrentD(toD(interpolated))

      // Performance monitor: track frame time
      const elapsed = performance.now() - start
      frameTimeHistory.current.push(elapsed)
      if (frameTimeHistory.current.length > 30) {
        frameTimeHistory.current.shift()
      }

      // Check average every 30 frames
      if (frameTimeHistory.current.length >= 30) {
        const avg = frameTimeHistory.current.reduce((a, b) => a + b, 0) / frameTimeHistory.current.length
        if (avg > BUDGET_MS) {
          const currentSamples = adaptiveNumSamples ?? (resolvedPrecision.numSamples ?? 200)
          const newSamples = Math.max(32, Math.floor(currentSamples * 0.7))
          if (newSamples < currentSamples) {
            setAdaptiveNumSamples(newSamples)
            frameTimeHistory.current = []
          }
        } else if (avg < BUDGET_MS * 0.5 && adaptiveNumSamples !== null) {
          const maxSamples = resolvedPrecision.numSamples ?? 200
          const newSamples = Math.min(maxSamples, Math.floor(adaptiveNumSamples * 1.3))
          if (newSamples > adaptiveNumSamples) {
            setAdaptiveNumSamples(newSamples)
            frameTimeHistory.current = []
          }
        }
      }

      // onMorphComplete: detect when spring settles (t ≈ 1 with tiny velocity)
      if (clamped > 0.998 && !morphSettled.current) {
        morphSettled.current = true
        const settledIdx = trigger === "hover" ? toIndex : autoToIndex
        if (settledIdx !== lastSettledIndex.current) {
          lastSettledIndex.current = settledIdx
          onMorphCompleteRef.current?.(settledIdx)
        }
      }
    })

    return unsubscribe
  }, [preparedPaths, activeFromIndex, activeToIndex, morphProgress, smooth, adaptiveNumSamples, resolvedPrecision, toD, trigger, toIndex, autoToIndex])

  const isHoverMode = trigger === "hover"

  // Render: if font not loaded or no valid paths, show plain <span> placeholder
  if (!isLoaded || !font || preparedPaths.length === 0) {
    return (
      <div
        className={cn(
          "relative mx-auto w-full max-w-3xl",
          isHoverMode && "cursor-pointer",
          isHoverMode && "z-10",
          className
        )}
        style={{
          pointerEvents: isHoverMode ? "auto" : undefined,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role={isHoverMode ? "button" : undefined}
        tabIndex={isHoverMode ? 0 : undefined}
        aria-label={isHoverMode ? `Hover to morph from "${texts[0]}" to "${texts[toIndex]}"` : "Morphing text animation"}
      >
        <span
          className="block w-full text-center"
          style={{
            fontSize: `${Math.min(fontSize / 4, 48)}px`,
            lineHeight: 1.2,
            color: fill !== "currentColor" ? fill : undefined,
          }}
        >
          {texts[0] ?? ""}
        </span>
      </div>
    )
  }

  // Compute viewBox from all prepared paths
  const viewBox = useMemo(() => {
    if (preparedPaths.length === 0) return "-10 -220 240 240"
    const allPoints = preparedPaths.flatMap((p) =>
      p.subPaths.flatMap((sp) => sp.points)
    )
    if (allPoints.length === 0) return "-10 -220 240 240"
    const xs = allPoints.map((p) => p.x)
    const ys = allPoints.map((p) => p.y)
    const minX = Math.min(...xs) - 10
    const minY = Math.min(...ys) - 10
    const maxX = Math.max(...xs) + 10
    const maxY = Math.max(...ys) + 10
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
  }, [preparedPaths])

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-3xl",
        isHoverMode && "cursor-pointer",
        isHoverMode && "z-10",
        className
      )}
      style={{
        pointerEvents: isHoverMode ? "auto" : undefined,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      role={isHoverMode ? "button" : undefined}
      tabIndex={isHoverMode ? 0 : undefined}
      aria-label={
        isHoverMode
          ? `Hover or focus to morph from "${texts[0]}" to "${texts[toIndex]}"`
          : "Morphing text animation"
      }
    >
      <svg
        viewBox={viewBox}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: "none" }}
      >
        <title>
          {isHoverMode
            ? `Morph from ${texts[0]} to ${texts[toIndex]}`
            : "Morphing Text Animation"}
        </title>
        <path
          d={currentD}
          fill={fill}
          stroke="none"
        />
      </svg>
    </div>
  )
}
