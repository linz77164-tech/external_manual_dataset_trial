"use client"

import { MorphingText } from "@/components/magicui/morphing-text"

export default function MorphingTextPreview() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 bg-black p-8">
      <h1 className="text-2xl font-bold text-white">
        SVG Path Morphing Text
      </h1>

      {/* Main demo: multi-word cycle with spring physics */}
      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm text-gray-400">
          Spring Morphing (stiffness=200, damping=20, interval=3s)
        </h2>
        <div className="h-40 w-[600px] text-purple-400">
          <MorphingText
            texts={["MAGIC", "DESIGN", "MORPH", "ALEX"]}
            fontSize={120}
            numSamples={200}
            interval={3}
            stiffness={200}
            damping={20}
          />
        </div>
      </section>

      {/* Bouncier spring */}
      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm text-gray-400">
          Extra Bouncy (stiffness=120, damping=10, interval=3s)
        </h2>
        <div className="h-40 w-[600px] text-blue-400">
          <MorphingText
            texts={["MAGIC", "DESIGN", "MORPH", "ALEX"]}
            fontSize={120}
            numSamples={200}
            interval={3}
            stiffness={120}
            damping={10}
          />
        </div>
      </section>

      {/* Snappy spring */}
      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm text-gray-400">
          Snappy (stiffness=400, damping=30, interval=3s)
        </h2>
        <div className="h-40 w-[600px] text-emerald-400">
          <MorphingText
            texts={["MAGIC", "DESIGN", "MORPH", "ALEX"]}
            fontSize={120}
            numSamples={200}
            interval={3}
            stiffness={400}
            damping={30}
          />
        </div>
      </section>

      {/* Single characters with dynamic sampling */}
      <section className="flex flex-col items-center gap-4">
        <h2 className="text-sm text-gray-400">
          Dynamic Sampling (samplesPerUnit=2, interval=3s)
        </h2>
        <div className="h-40 w-[600px] text-amber-400">
          <MorphingText
            texts={["MAGIC", "DESIGN", "MORPH", "ALEX"]}
            fontSize={120}
            precision={{ samplesPerUnit: 2, minSamples: 64, maxSamples: 500 }}
            interval={3}
            stiffness={200}
            damping={20}
          />
        </div>
      </section>

      {/* Debug info */}
      <div className="mt-8 max-w-xl text-center text-xs text-gray-600">
        <p>
          Uses opentype.js → flatten → resample → centroid-align → interpolate.
          Progress driven by motion/react useSpring for jelly-like bounce.
          Spring formula: F = -stiffness × x - damping × v. Lower damping = more
          overshoot. Higher stiffness = faster settle.
        </p>
      </div>
    </div>
  )
}
