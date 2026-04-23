"use client"

import { type ComponentType, type FC, useState } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"

// ---------- Static fallback (always works) ----------
function StaticTitle() {
  return (
    <h1
      className={cn(
        "text-black dark:text-white",
        "relative mx-0 max-w-174 pt-5 md:mx-auto md:px-4 md:py-2",
        "text-left font-semibold tracking-tighter text-balance md:text-center",
        "text-5xl sm:text-7xl md:text-7xl lg:text-7xl"
      )}
    >
      UI library for Design Engineers
    </h1>
  )
}

// ---------- Dynamic MorphingText (SSR disabled, error-safe) ----------
const MorphingTextLazy: ComponentType<{
  texts: string[]
  fontSize?: number
  precision?: number | { numSamples?: number; samplesPerUnit?: number; minSamples?: number; maxSamples?: number }
  interval?: number
  stiffness?: number
  damping?: number
  restDelta?: number
  trigger?: "auto" | "hover"
  hoverToIndex?: number
  fill?: string
  smooth?: boolean
  fontUrl?: string
  letterSpacing?: number
  className?: string
  onMorphComplete?: (settledIndex: number) => void
}> = dynamic(
  () =>
    import("@/components/magicui/morphing-text").then((mod) => mod.MorphingText),
  {
    ssr: false,
    loading: () => <StaticTitle />,
  }
)

// ---------- HeroTitle with error boundary ----------
export const HeroTitle: FC = () => {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return <StaticTitle />
  }

  return (
    <ErrorBoundaryFallback onError={() => setHasError(true)}>
      {/* SVG Filter Definitions: Neon Glow + Inner Shadow */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <title>Visual effect filters for morphing text</title>
        <defs>
          {/* Neon glow: multi-layer Gaussian blur merged with source */}
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur3" />
            <feMerge>
              <feMergeNode in="blur3" />
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Inner shadow: directional depth inside strokes */}
          <filter id="inner-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="blur" />
            <feOffset dx="2" dy="3" result="offsetBlur" />
            <feFlood floodColor="#000000" floodOpacity="0.6" result="color" />
            <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
            <feComposite in="shadow" in2="SourceAlpha" operator="in" result="innerShadow" />
            <feMerge>
              <feMergeNode in="innerShadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Combined: neon glow + inner shadow for maximum depth */}
          <filter id="neon-glow-depth" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="is-blur" />
            <feOffset in="is-blur" dx="1.5" dy="2" result="is-offset" />
            <feFlood floodColor="#000000" floodOpacity="0.5" result="is-color" />
            <feComposite in="is-color" in2="is-offset" operator="in" result="is-shadow" />
            <feComposite in="is-shadow" in2="SourceAlpha" operator="in" result="innerShadow" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur3" />
            <feMerge>
              <feMergeNode in="innerShadow" />
              <feMergeNode in="blur3" />
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="neon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
            <animate attributeName="x1" values="0%;100%;0%" dur="6s" repeatCount="indefinite" />
            <animate attributeName="x2" values="100%;0%;100%" dur="6s" repeatCount="indefinite" />
          </linearGradient>
        </defs>
      </svg>
      <div
        className={cn(
          "relative mx-0 max-w-174 pt-5 md:mx-auto md:px-4 md:py-2",
          "text-left md:text-center",
          "min-h-[100px] md:min-h-[120px] lg:min-h-[140px]",
          "flex items-center justify-center",
          "pointer-events-auto"
        )}
        style={{
          filter: "url(#neon-glow-depth)",
          color: "url(#neon-gradient)",
        }}
      >
        <MorphingTextLazy
          texts={["MAGIC UI", "WOW", "MORPHING", "WUZHIJING"]}
          fontSize={120}
          precision={{ numSamples: 200 }}
          trigger="hover"
          hoverToIndex={1}
          stiffness={200}
          damping={20}
          restDelta={0.001}
          fill="url(#neon-gradient)"
          smooth={true}
          fontUrl="/fonts/Inter-Bold.ttf"
          letterSpacing={60}
          className="h-[80px] w-[600px] md:h-[100px] md:w-[700px] lg:h-[120px] lg:w-[900px]"
        />
      </div>
    </ErrorBoundaryFallback>
  )
}

// ---------- Minimal error boundary ----------
import { Component, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  onError: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundaryFallback extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: Error): void {
    console.error("[HeroTitle] MorphingText crashed:", error)
    this.props.onError()
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <StaticTitle />
    }
    return this.props.children
  }
}
