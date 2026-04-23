// ============================================================
// SVG Path Geometry Utilities for Morphing Text
// ============================================================
// Core Principle: Path Resampling + Centroid Alignment
//
// Pipeline: SVG path string → parse → flatten → resample →
//           centroid-align → interpolate → output
//
// 1. FLATTEN: Convert all Bézier curves to line segments via
//    recursive midpoint subdivision (max depth 8, tolerance 0.5px).
//
// 2. RESAMPLE: Re-distribute points at uniform arc-length intervals.
//    Supports fixed (numSamples) or dynamic (samplesPerUnit) mode.
//
// 3. CENTROID ALIGNMENT: Match sub-paths between two characters using
//    a multi-factor cost function — winding direction (hole vs outline),
//    area similarity, and centroid proximity. Unmatched sub-paths get
//    "ghost" padding at the parent outline's centroid (holes shrink
//    inward, outlines materialize from center). Rotated starting-point
//    alignment minimizes visual swirling.
//
// 4. INTERPOLATE: Linear lerp between corresponding points at
//    parameter t ∈ [0,1]. The caller applies easing to t externally.
//
// 5. SMOOTH OUTPUT (optional): Catmull-Rom → Cubic Bézier conversion
//    for C1-continuous rounded strokes (TENSION = 0.5).
//
// Pure math functions with no React/DOM dependencies.
// ============================================================

// --- Types ---

/** A single 2D point */
export interface Point {
  x: number
  y: number
}

/** A sub-path (contour) represented as a polyline of points */
export interface SubPath {
  points: Point[]
  closed: boolean
}

/** A parsed path consisting of one or more sub-paths */
export interface ParsedPath {
  subPaths: SubPath[]
}

/**
 * Precision configuration for dynamic sampling.
 *
 * - `numSamples` (fixed): explicit number of sample points per sub-path
 * - `samplesPerUnit` (dynamic): number of samples per unit of path perimeter
 *   e.g. samplesPerUnit=2 means a path of perimeter 100 gets 200 samples
 * - `minSamples`: minimum samples regardless of path length (default 32)
 * - `maxSamples`: maximum samples regardless of path length (default 500)
 */
export interface Precision {
  numSamples?: number
  samplesPerUnit?: number
  minSamples?: number
  maxSamples?: number
}

const DEFAULT_PRECISION: Required<Omit<Precision, "numSamples" | "samplesPerUnit">> & {
  numSamples: number
  samplesPerUnit: number
} = {
  numSamples: 0, // 0 means "use dynamic sampling"
  samplesPerUnit: 2, // 2 samples per unit of perimeter
  minSamples: 32,
  maxSamples: 500,
}

// --- SVG Path Parser ---

interface PathCommand {
  type: string
  args: number[]
}

/**
 * Parse an SVG path `d` string into an array of commands.
 * Handles M, L, H, V, C, S, Q, T, A, Z (absolute and relative).
 */
function parseSvgPath(d: string): PathCommand[] {
  const commands: PathCommand[] = []
  const re = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g
  let match: RegExpExecArray | null

  while ((match = re.exec(d)) !== null) {
    const type = match[1]
    const argStr = match[2].trim()
    const args = argStr
      ? argStr
          .split(/[\s,]+/)
          .filter((s) => s.length > 0)
          .map(Number)
      : []
    commands.push({ type, args })
  }

  return commands
}

/**
 * Convert parsed SVG path commands into sub-paths.
 * Curve control points are tagged with _type metadata for later flattening.
 */
function commandsToRawSubPaths(commands: PathCommand[]): SubPath[] {
  const subPaths: SubPath[] = []
  let currentPoints: Array<Point & { _type?: string }> = []
  let currentClosed = false
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0

  const pushSubPath = () => {
    if (currentPoints.length > 0) {
      subPaths.push({ points: currentPoints, closed: currentClosed })
    }
    currentPoints = []
    currentClosed = false
  }

  for (const cmd of commands) {
    const { type, args } = cmd
    const isRelative = type === type.toLowerCase()

    switch (type.toUpperCase()) {
      case "M": {
        if (currentPoints.length > 0) pushSubPath()
        for (let i = 0; i < args.length; i += 2) {
          const x = isRelative ? cx + args[i] : args[i]
          const y = isRelative ? cy + args[i + 1] : args[i + 1]
          if (i === 0) {
            startX = x
            startY = y
          }
          currentPoints.push({ x, y })
          cx = x
          cy = y
        }
        break
      }
      case "L": {
        for (let i = 0; i < args.length; i += 2) {
          const x = isRelative ? cx + args[i] : args[i]
          const y = isRelative ? cy + args[i + 1] : args[i + 1]
          currentPoints.push({ x, y })
          cx = x
          cy = y
        }
        break
      }
      case "H": {
        for (const arg of args) {
          const x = isRelative ? cx + arg : arg
          currentPoints.push({ x, y: cy })
          cx = x
        }
        break
      }
      case "V": {
        for (const arg of args) {
          const y = isRelative ? cy + arg : arg
          currentPoints.push({ x: cx, y })
          cy = y
        }
        break
      }
      case "C": {
        for (let i = 0; i < args.length; i += 6) {
          const cp1x = isRelative ? cx + args[i] : args[i]
          const cp1y = isRelative ? cy + args[i + 1] : args[i + 1]
          const cp2x = isRelative ? cx + args[i + 2] : args[i + 2]
          const cp2y = isRelative ? cy + args[i + 3] : args[i + 3]
          const ex = isRelative ? cx + args[i + 4] : args[i + 4]
          const ey = isRelative ? cy + args[i + 5] : args[i + 5]
          currentPoints.push(
            { x: cp1x, y: cp1y, _type: "cubic-cp1" },
            { x: cp2x, y: cp2y, _type: "cubic-cp2" },
            { x: ex, y: ey }
          )
          cx = ex
          cy = ey
        }
        break
      }
      case "Q": {
        for (let i = 0; i < args.length; i += 4) {
          const cpx = isRelative ? cx + args[i] : args[i]
          const cpy = isRelative ? cy + args[i + 1] : args[i + 1]
          const ex = isRelative ? cx + args[i + 2] : args[i + 2]
          const ey = isRelative ? cy + args[i + 3] : args[i + 3]
          currentPoints.push(
            { x: cpx, y: cpy, _type: "quad-cp" },
            { x: ex, y: ey }
          )
          cx = ex
          cy = ey
        }
        break
      }
      case "Z": {
        currentClosed = true
        cx = startX
        cy = startY
        pushSubPath()
        break
      }
      case "S":
      case "T":
      case "A": {
        // Fallback for rare commands: treat as line-to
        for (let i = 0; i < args.length; i += 2) {
          if (i + 1 < args.length) {
            const x = isRelative ? cx + args[i] : args[i]
            const y = isRelative ? cy + args[i + 1] : args[i + 1]
            currentPoints.push({ x, y })
            cx = x
            cy = y
          }
        }
        break
      }
    }
  }

  pushSubPath()
  return subPaths
}

// --- Cubic/Quad Bezier Evaluation ---

function cubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  }
}

function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  }
}

// --- Flatten ---

function flattenSubPath(
  subPath: SubPath,
  tolerance: number
): SubPath {
  const src = subPath.points as Array<Point & { _type?: string }>
  const result: Point[] = []

  if (src.length === 0) return { points: [], closed: subPath.closed }
  result.push({ x: src[0].x, y: src[0].y })

  let i = 1
  while (i < src.length) {
    const pt = src[i]

    if (pt._type === "cubic-cp1" && i + 2 < src.length) {
      const cp1 = pt
      const cp2 = src[i + 1]
      const endPt = src[i + 2]
      const startPt = result[result.length - 1]
      const flatPts = flattenCubic(startPt, cp1, cp2, endPt, tolerance, 0)
      result.push(...flatPts)
      i += 3
    } else if (pt._type === "quad-cp" && i + 1 < src.length) {
      const cp = pt
      const endPt = src[i + 1]
      const startPt = result[result.length - 1]
      const flatPts = flattenQuad(startPt, cp, endPt, tolerance, 0)
      result.push(...flatPts)
      i += 2
    } else {
      result.push({ x: pt.x, y: pt.y })
      i += 1
    }
  }

  return { points: result, closed: subPath.closed }
}

function flattenCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tolerance: number,
  depth: number
): Point[] {
  const maxDepth = 8
  if ((cubicFlatness(p0, p1, p2, p3) < tolerance && depth > 0) || depth >= maxDepth) {
    return [{ x: p3.x, y: p3.y }]
  }

  const m01 = midpoint(p0, p1)
  const m12 = midpoint(p1, p2)
  const m23 = midpoint(p2, p3)
  const m012 = midpoint(m01, m12)
  const m123 = midpoint(m12, m23)
  const m0123 = midpoint(m012, m123)

  const left = flattenCubic(p0, m01, m012, m0123, tolerance, depth + 1)
  const right = flattenCubic(m0123, m123, m23, p3, tolerance, depth + 1)
  return [...left, ...right]
}

function flattenQuad(
  p0: Point,
  p1: Point,
  p2: Point,
  tolerance: number,
  depth: number
): Point[] {
  const maxDepth = 8
  if ((quadFlatness(p0, p1, p2) < tolerance && depth > 0) || depth >= maxDepth) {
    return [{ x: p2.x, y: p2.y }]
  }

  const m01 = midpoint(p0, p1)
  const m12 = midpoint(p1, p2)
  const m012 = midpoint(m01, m12)
  const left = flattenQuad(p0, m01, m012, tolerance, depth + 1)
  const right = flattenQuad(m012, m12, p2, tolerance, depth + 1)
  return [...left, ...right]
}

function cubicFlatness(p0: Point, p1: Point, p2: Point, p3: Point): number {
  return Math.max(pointToLineDistance(p0, p3, p1), pointToLineDistance(p0, p3, p2))
}

function quadFlatness(p0: Point, p1: Point, p2: Point): number {
  return pointToLineDistance(p0, p2, p1)
}

function pointToLineDistance(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return distance(a, p)
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x)
  return num / Math.sqrt(lenSq)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

// --- Resample ---

/**
 * Compute the perimeter (total arc length) of a sub-path.
 */
function computePerimeter(subPath: SubPath): number {
  const { points, closed } = subPath
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += distance(points[i], points[i + 1])
  }
  if (closed && points.length > 1) {
    total += distance(points[points.length - 1], points[0])
  }
  return total
}

/**
 * Resolve a Precision config into a concrete numSamples for a given sub-path.
 *
 * Logic:
 *   - If `precision.numSamples` is set (>0), use it directly (fixed mode)
 *   - Otherwise, compute: samplesPerUnit * perimeter, clamped to [minSamples, maxSamples]
 */
function resolveNumSamples(subPath: SubPath, precision: Precision): number {
  if (precision.numSamples && precision.numSamples > 0) {
    return precision.numSamples
  }

  const samplesPerUnit = precision.samplesPerUnit ?? DEFAULT_PRECISION.samplesPerUnit
  const minSamples = precision.minSamples ?? DEFAULT_PRECISION.minSamples
  const maxSamples = precision.maxSamples ?? DEFAULT_PRECISION.maxSamples

  const perimeter = computePerimeter(subPath)
  const dynamicN = Math.round(samplesPerUnit * perimeter)

  return Math.max(minSamples, Math.min(maxSamples, dynamicN))
}

/**
 * Resample a sub-path to exactly `numSamples` uniformly-spaced points.
 */
function resampleSubPath(subPath: SubPath, numSamples: number): SubPath {
  const { points, closed } = subPath
  if (points.length < 2 || numSamples < 2) {
    return { points: points.length > 0 ? [{ ...points[0] }] : [], closed }
  }

  // Build segments: for closed paths, add last→first
  const segments: Array<{ from: Point; to: Point; length: number }> = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ from: points[i], to: points[i + 1], length: distance(points[i], points[i + 1]) })
  }
  if (closed && points.length > 1) {
    segments.push({
      from: points[points.length - 1],
      to: points[0],
      length: distance(points[points.length - 1], points[0]),
    })
  }

  // Cumulative arc lengths
  const cumLen: number[] = [0]
  for (let i = 0; i < segments.length; i++) {
    cumLen.push(cumLen[i] + segments[i].length)
  }
  const totalLen = cumLen[cumLen.length - 1]

  if (totalLen === 0) {
    return {
      points: Array.from({ length: numSamples }, () => ({ ...points[0] })),
      closed,
    }
  }

  // Place samples at uniform arc-length intervals
  const sampled: Point[] = []
  let segIdx = 0

  for (let i = 0; i < numSamples; i++) {
    const t = (i / (numSamples - 1)) * totalLen

    while (segIdx < segments.length - 1 && cumLen[segIdx + 1] < t) {
      segIdx++
    }

    const segStart = cumLen[segIdx]
    const segLen = segments[segIdx].length
    const frac = segLen > 0 ? (t - segStart) / segLen : 0

    sampled.push({
      x: segments[segIdx].from.x + frac * (segments[segIdx].to.x - segments[segIdx].from.x),
      y: segments[segIdx].from.y + frac * (segments[segIdx].to.y - segments[segIdx].from.y),
    })
  }

  return { points: sampled, closed }
}

// --- Centroid Alignment ---

/**
 * Compute the centroid of a point array.
 */
function computeCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 }
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/**
 * Rotate a point array so that the point closest to `target` becomes index 0.
 * For closed sub-paths, rotating the point order doesn't change the shape,
 * only where the drawing starts — which is crucial for smooth interpolation.
 */
function rotatePointsToNearest(points: Point[], target: Point): Point[] {
  if (points.length === 0) return points

  let minDist = Infinity
  let bestIdx = 0

  for (let i = 0; i < points.length; i++) {
    const d = distance(points[i], target)
    if (d < minDist) {
      minDist = d
      bestIdx = i
    }
  }

  return [...points.slice(bestIdx), ...points.slice(0, bestIdx)]
}

/**
 * Compute the centroid of all sub-paths in a ParsedPath.
 * This is the global centroid used for ghost path placement.
 */
function computeGlobalCentroid(parsed: ParsedPath): Point {
  const allPoints = parsed.subPaths.flatMap((sp) => sp.points)
  return computeCentroid(allPoints)
}

/**
 * Compute the perimeter of a ParsedPath (sum of all sub-path perimeters).
 */
function computeParsedPathPerimeter(parsed: ParsedPath): number {
  return parsed.subPaths.reduce((sum, sp) => sum + computePerimeter(sp), 0)
}

/**
 * Compute distance between two points.
 * (Already defined above as `distance`, but this alias clarifies intent.)
 */

/**
 * Create a "ghost" sub-path — a zero-area path at a given position.
 *
 * Ghost paths are used to pad paths that have fewer sub-paths than their
 * morph target. For example, if character A has 1 sub-path (e.g. "O")
 * and character B has 2 sub-paths (e.g. "i" with dot + body), we add
 * a ghost sub-path to A so both have 2 sub-paths.
 *
 * The ghost consists of `numPoints` points all at the same position (centroid).
 * During interpolation, these points will smoothly move from the centroid
 * to the corresponding real points in the target, creating a "materializing"
 * or "dematerializing" effect for disconnected parts like dots.
 *
 * @param centroid - Where to place the ghost (typically the global centroid)
 * @param numPoints - Number of sample points (should match target sub-path)
 * @param closed - Whether the sub-path is closed (should match target)
 */
function createGhostSubPath(centroid: Point, numPoints: number, closed: boolean): SubPath {
  return {
    points: Array.from({ length: numPoints }, () => ({ x: centroid.x, y: centroid.y })),
    closed,
  }
}

/**
 * Create a "shrink-to-center" ghost sub-path for disappearing holes.
 *
 * When a hole (inner contour) needs to vanish (e.g. 'O' → 'M'), placing
 * the ghost at the global centroid would cause the hole to "fly out" of
 * its parent outline during the transition. Instead, we place the ghost
 * at the **parent outline's centroid**, so the hole shrinks inward toward
 * the center of its enclosing contour — like a die-cut hole closing up.
 *
 * This produces the "shrink-to-nothing" effect requested:
 * - The hole's points converge toward the outline's center
 * - The hole area decreases smoothly to zero
 * - No visual artifact of the hole escaping the outline boundary
 *
 * @param parentCentroid - Centroid of the enclosing outline (not the hole itself)
 * @param numPoints - Number of sample points (should match the disappearing hole)
 * @param closed - Whether the sub-path is closed
 */
function createShrinkGhostSubPath(parentCentroid: Point, numPoints: number, closed: boolean): SubPath {
  return createGhostSubPath(parentCentroid, numPoints, closed)
}

/**
 * Find the best "parent outline" for a hole sub-path.
 *
 * A hole's parent is the smallest non-hole sub-path that contains it.
 * We determine containment by checking if the hole's centroid falls
 * within the bounding box of each outline sub-path.
 *
 * If no containing outline is found (degenerate case), falls back to
 * the global centroid.
 */
function findParentOutlineCentroid(
  holeIdx: number,
  parsed: ParsedPath,
  globalCentroid: Point
): Point {
  const holeSp = parsed.subPaths[holeIdx]
  const holeCentroid = computeCentroid(holeSp.points)

  // Find all outline sub-paths (non-holes)
  const outlines = parsed.subPaths
    .map((sp, idx) => ({ sp, idx, isHole: isHole(sp) }))
    .filter((entry) => !entry.isHole && entry.idx !== holeIdx)

  let bestCentroid = globalCentroid
  let bestArea = Infinity

  for (const outline of outlines) {
    // Check if hole centroid is within outline's bounding box
    const pts = outline.sp.points
    if (pts.length === 0) continue

    const minX = Math.min(...pts.map((p) => p.x))
    const maxX = Math.max(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y))
    const maxY = Math.max(...pts.map((p) => p.y))

    if (
      holeCentroid.x >= minX && holeCentroid.x <= maxX &&
      holeCentroid.y >= minY && holeCentroid.y <= maxY
    ) {
      // Use the smallest containing outline (most specific parent)
      const area = computeArea(outline.sp)
      if (area < bestArea) {
        bestArea = area
        bestCentroid = computeCentroid(outline.sp.points)
      }
    }
  }

  return bestCentroid
}

/**
 * Compute the signed area of a closed sub-path using the shoelace formula.
 *
 * Positive area → counter-clockwise winding (typically outer contours)
 * Negative area → clockwise winding (typically holes/inner contours)
 *
 * This is crucial for distinguishing character outlines from holes:
 * - 'O' has 2 sub-paths: outer (CCW, positive area) + hole (CW, negative area)
 * - 'B' has 3 sub-paths: outer (CCW) + upper hole (CW) + lower hole (CW)
 * - 'I' has 1 sub-path: outer (CCW)
 */
function computeSignedArea(sp: SubPath): number {
  const { points, closed } = sp
  if (points.length < 3) return 0

  let area = 0
  const n = points.length

  for (let i = 0; i < n; i++) {
    const curr = points[i]
    const next = closed ? points[(i + 1) % n] : points[i + 1]
    if (!next) break
    area += curr.x * next.y - next.x * curr.y
  }

  return area / 2
}

/**
 * Compute the absolute (unsigned) area of a sub-path.
 */
function computeArea(sp: SubPath): number {
  return Math.abs(computeSignedArea(sp))
}

/**
 * Determine if a sub-path is a "hole" (inner contour) vs "outline" (outer contour).
 *
 * By SVG/TrueType convention:
 * - Counter-clockwise (positive signed area) → outer contour
 * - Clockwise (negative signed area) → hole/inner contour
 */
function isHole(sp: SubPath): boolean {
  return computeSignedArea(sp) < 0
}

/**
 * Sub-path descriptor used for intelligent matching.
 * Combines geometric properties (centroid, area, winding) for pairing.
 */
interface SubPathDescriptor {
  index: number
  centroid: Point
  area: number
  isHole: boolean
  /** Normalized area: area / maxArea across all sub-paths in the same path */
  relativeArea: number
}

/**
 * Build descriptor array for all sub-paths in a ParsedPath.
 */
function buildDescriptors(parsed: ParsedPath): SubPathDescriptor[] {
  const subPaths = parsed.subPaths
  const maxArea = Math.max(...subPaths.map((sp) => computeArea(sp)), 1)

  return subPaths.map((sp, index) => ({
    index,
    centroid: computeCentroid(sp.points),
    area: computeArea(sp),
    isHole: isHole(sp),
    relativeArea: computeArea(sp) / maxArea,
  }))
}

/**
 * Compute a matching cost between two sub-path descriptors.
 *
 * Cost factors (lower = better match):
 * 1. **Winding penalty**: holes should match holes, outlines should match outlines.
 *    Cross-winding pairing (outline↔hole) gets a heavy penalty (cost +2.0).
 * 2. **Position distance**: centroid distance, normalized by path scale.
 *    This prevents a hole from matching a distant outline.
 * 3. **Area similarity**: relative area difference.
 *    Large outlines should match large outlines, small holes match small holes.
 *    The area factor uses relative similarity: |relA - relB| / max(relA, relB).
 *
 * The combined cost ensures that:
 * - 'B's two holes match each other first (same winding + similar area + close position)
 * - 'O's outer matches 'M's outer (both non-holes)
 * - 'O's hole gets properly handled as an "unmatched hole" → shrink-to-centroid
 */
function computeMatchCost(
  descA: SubPathDescriptor,
  descB: SubPathDescriptor,
  scale: number
): number {
  // 1. Winding penalty: hole↔outline is very bad
  const windingPenalty = descA.isHole !== descB.isHole ? 2.0 : 0

  // 2. Position distance (normalized by scale)
  const positionDist = distance(descA.centroid, descB.centroid) / Math.max(scale, 1)

  // 3. Area similarity: 0 = perfect match, 1 = completely different scale
  const maxRelArea = Math.max(descA.relativeArea, descB.relativeArea, 0.001)
  const areaDiff = Math.abs(descA.relativeArea - descB.relativeArea) / maxRelArea

  return windingPenalty + positionDist * 0.5 + areaDiff * 0.8
}

/**
 * Find the optimal pairing of sub-paths between two paths using
 * area+position+winding intelligent matching.
 *
 * This replaces the previous centroid-only matching with a multi-factor
 * algorithm that respects the topology of characters:
 *
 * - Holes (inner contours) are matched to holes first
 * - Outlines (outer contours) are matched to outlines first
 * - Area similarity ensures small features match small features
 * - Position proximity breaks ties
 *
 * The algorithm uses a greedy approach with cost-based scoring:
 * 1. Compute descriptors for all sub-paths (centroid, area, winding)
 * 2. For each A sub-path, find the B sub-path with the lowest match cost
 * 3. Unmatched sub-paths get ghost padding
 *
 * @returns Pairing information: aToB mapping and unmatched B indices
 */
function matchSubPathsByCentroid(a: ParsedPath, b: ParsedPath): {
  aToB: Map<number, number>
  bUnmatched: number[]
} {
  const aToB = new Map<number, number>()
  const bUsed = new Set<number>()

  const descsA = buildDescriptors(a)
  const descsB = buildDescriptors(b)

  // Compute a characteristic scale (max dimension of bounding box)
  const allPoints = [...a.subPaths, ...b.subPaths].flatMap((sp) => sp.points)
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const scale = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    1
  )

  // Build all possible (A, B) pairs with costs
  const candidates: Array<{ aIdx: number; bIdx: number; cost: number }> = []

  for (const descA of descsA) {
    for (const descB of descsB) {
      const cost = computeMatchCost(descA, descB, scale)
      candidates.push({ aIdx: descA.index, bIdx: descB.index, cost })
    }
  }

  // Sort by cost (best matches first) and greedily assign
  candidates.sort((a, b) => a.cost - b.cost)

  for (const { aIdx, bIdx } of candidates) {
    if (aToB.has(aIdx) || bUsed.has(bIdx)) continue
    aToB.set(aIdx, bIdx)
    bUsed.add(bIdx)

    // Early exit: all A sub-paths matched
    if (aToB.size === descsA.length) break
  }

  // Collect unmatched B indices
  const bUnmatched: number[] = []
  for (let j = 0; j < b.subPaths.length; j++) {
    if (!bUsed.has(j)) bUnmatched.push(j)
  }

  return { aToB, bUnmatched }
}

/**
 * Align two parsed paths with Ghost Path Padding and intelligent
 * area+position+winding matching.
 *
 * Algorithm:
 * 1. Match sub-paths between A and B using area+position+winding cost
 * 2. Pad the shorter path with ghost sub-paths
 * 3. Reorder sub-paths so matched pairs are at the same index
 * 4. Resample to equal point counts per sub-path pair
 * 5. Rotate closed sub-paths for optimal starting-point alignment
 *
 * Ghost Path Padding solves the "disconnected paths" problem:
 * - When morphing "O" (2 sub-paths: outline + hole) → "M" (1 sub-path: outline),
 *   the hole in "O" needs to disappear. The ghost for the missing hole in "M"
 *   is placed at the outline's centroid, so the hole shrinks inward smoothly.
 * - When morphing "M" → "O", a ghost hole appears at the outline's centroid
 *   and expands outward into the hole of "O".
 *
 * Winding-aware ghost placement:
 * - Unmatched holes (inner contours) → ghost at parent outline's centroid (shrink inward)
 * - Unmatched outlines (outer contours) → ghost at global centroid (materialize from center)
 */
export function alignParsedPaths(a: ParsedPath, b: ParsedPath): [ParsedPath, ParsedPath] {
  // Step 1: Match sub-paths by area+position+winding cost
  const { aToB, bUnmatched } = matchSubPathsByCentroid(a, b)

  // Step 2: Build paired ordering
  // Format: each entry is [aIdx | -1, bIdx | -1] where -1 means "needs ghost"
  const pairs: Array<[number, number]> = []

  // Add matched pairs
  for (const [aIdx, bIdx] of aToB) {
    pairs.push([aIdx, bIdx])
  }

  // Add unmatched B sub-paths (A gets ghost)
  for (const bIdx of bUnmatched) {
    pairs.push([-1, bIdx])
  }

  // Handle A sub-paths with no B match (B gets ghost)
  const matchedAIndices = new Set(aToB.keys())
  for (let aIdx = 0; aIdx < a.subPaths.length; aIdx++) {
    if (!matchedAIndices.has(aIdx)) {
      pairs.push([aIdx, -1])
    }
  }

  // Step 3: Compute global centroids for ghost placement
  const globalCentroidA = computeGlobalCentroid(a)
  const globalCentroidB = computeGlobalCentroid(b)

  // Step 4: Build aligned sub-path arrays with winding-aware ghost padding
  const alignedA: SubPath[] = []
  const alignedB: SubPath[] = []

  for (const [aIdx, bIdx] of pairs) {
    const spA = aIdx >= 0 ? a.subPaths[aIdx] : null
    const spB = bIdx >= 0 ? b.subPaths[bIdx] : null

    if (spA && spB) {
      // Both exist — resample to same point count
      const maxPts = Math.max(spA.points.length, spB.points.length)
      const resampledA = resampleSubPath(spA, maxPts)
      const resampledB = resampleSubPath(spB, maxPts)

      // Rotate closed sub-paths for optimal alignment
      if (resampledA.closed && resampledB.closed) {
        const centroidA = computeCentroid(resampledA.points)
        const centroidB = computeCentroid(resampledB.points)
        alignedA.push({
          points: rotatePointsToNearest(resampledA.points, centroidB),
          closed: resampledA.closed,
        })
        alignedB.push({
          points: rotatePointsToNearest(resampledB.points, centroidA),
          closed: resampledB.closed,
        })
      } else {
        alignedA.push(resampledA)
        alignedB.push(resampledB)
      }
    } else if (spA && !spB) {
      // A has sub-path, B needs ghost
      const numPts = spA.points.length

      // Winding-aware: if A's sub-path is a hole, the ghost in B should be
      // placed at A's parent outline centroid (so the hole shrinks inward).
      // If A is an outline, the ghost appears at B's global centroid.
      const ghostCentroidB = isHole(spA)
        ? findParentOutlineCentroid(aIdx, a, globalCentroidB)
        : globalCentroidB

      const ghostB = createShrinkGhostSubPath(ghostCentroidB, numPts, spA.closed)
      alignedA.push(spA)
      alignedB.push(ghostB)
    } else if (!spA && spB) {
      // B has sub-path, A needs ghost
      const numPts = spB.points.length

      // Winding-aware: if B's sub-path is a hole, the ghost in A should be
      // placed at B's parent outline centroid (so the hole materializes inward).
      // If B is an outline, the ghost appears at A's global centroid.
      const ghostCentroidA = isHole(spB)
        ? findParentOutlineCentroid(bIdx, b, globalCentroidA)
        : globalCentroidA

      const ghostA = createShrinkGhostSubPath(ghostCentroidA, numPts, spB.closed)
      alignedA.push(ghostA)
      alignedB.push(spB)
    }
  }

  return [{ subPaths: alignedA }, { subPaths: alignedB }]
}

// --- Interpolation ---

/**
 * Interpolate between two aligned, resampled parsed paths.
 *
 * Both paths must have the same number of sub-paths with the same number
 * of points each (guaranteed by preparePathsForMorph).
 *
 * The parameter t ∈ [0, 1] controls the blend:
 *   t = 0 → path A (source character)
 *   t = 1 → path B (target character)
 *
 * For each point j in each sub-path:
 *   result[j].x = A[j].x + t * (B[j].x - A[j].x)
 *   result[j].y = A[j].y + t * (B[j].y - A[j].y)
 *
 * This is a standard linear interpolation (lerp):
 *   lerp(a, b, t) = a + t * (b - a) = (1-t)*a + t*b
 *
 * The caller should apply easing to t BEFORE passing it here.
 * For example: easeInOutCubic(progress) → t, then interpolatePaths(A, B, t)
 * This keeps the interpolation math pure and composable.
 */
export function interpolatePaths(a: ParsedPath, b: ParsedPath, t: number): ParsedPath {
  // Clamp t to [0, 1] for safety
  const tc = Math.max(0, Math.min(1, t))

  // Defensive: ensure both inputs have valid subPaths
  const subPathsA = a?.subPaths ?? []
  const subPathsB = b?.subPaths ?? []

  if (subPathsA.length === 0 && subPathsB.length === 0) {
    return { subPaths: [] }
  }
  if (subPathsA.length === 0) return { subPaths: subPathsB.map((sp) => ({ ...sp, points: sp.points.map((p) => ({ ...p })) })) }
  if (subPathsB.length === 0) return { subPaths: subPathsA.map((sp) => ({ ...sp, points: sp.points.map((p) => ({ ...p })) })) }

  const subPaths: SubPath[] = []
  const count = Math.min(subPathsA.length, subPathsB.length)

  for (let i = 0; i < count; i++) {
    const spA = subPathsA[i]
    const spB = subPathsB[i]
    const n = Math.min(spA.points.length, spB.points.length)

    if (n === 0) continue

    const points: Point[] = []

    for (let j = 0; j < n; j++) {
      const ax = spA.points[j].x
      const ay = spA.points[j].y
      const bx = spB.points[j].x
      const by = spB.points[j].y

      points.push({
        x: ax + tc * (bx - ax),
        y: ay + tc * (by - ay),
      })
    }

    subPaths.push({ points, closed: spA.closed || spB.closed })
  }

  return { subPaths }
}

// --- Catmull-Rom → Cubic Bezier Smoothing ---

/**
 * Tension parameter for Catmull-Rom smoothing.
 * 0 = no smoothing (C1 continuous), 1 = maximum smoothing.
 * Default 0.5 gives pleasant rounded corners without over-smoothing.
 */
const CATMULL_ROM_TENSION = 0.5

/**
 * Convert Catmull-Rom control points to Cubic Bezier control points.
 *
 * Given four points P0, P1, P2, P3 on a Catmull-Rom spline,
 * the cubic Bezier control points for the segment P1→P2 are:
 *
 *   CP1 = P1 + (P2 - P0) / (6 * tension^-1)   = P1 + T * (P2 - P0)
 *   CP2 = P2 - (P3 - P1) / (6 * tension^-1)   = P2 - T * (P3 - P1)
 *
 * Where T = tension / 6 ≈ 0.0833 for tension=0.5
 *
 * This ensures the cubic Bezier curve passes through P1 and P2
 * with tangent direction matching the Catmull-Rom spline.
 */
function catmullRomToBezier(p0: Point, p1: Point, p2: Point, p3: Point): {
  cp1: Point
  cp2: Point
} {
  const t = CATMULL_ROM_TENSION / 6
  return {
    cp1: {
      x: p1.x + t * (p2.x - p0.x),
      y: p1.y + t * (p2.y - p0.y),
    },
    cp2: {
      x: p2.x - t * (p3.x - p1.x),
      y: p2.y - t * (p3.y - p1.y),
    },
  }
}

/**
 * Get a point from the array with wrapping for closed paths
 * and clamping for open paths.
 */
function getPoint(points: Point[], index: number, closed: boolean): Point {
  const n = points.length
  if (n === 0) return { x: 0, y: 0 }

  if (closed) {
    // Wrap around: index -1 → last, index n → 0
    const wrapped = ((index % n) + n) % n
    return points[wrapped]
  }

  // Clamp: don't go beyond bounds
  return points[Math.max(0, Math.min(n - 1, index))]
}

/**
 * Convert a sub-path's polyline points into smooth cubic Bezier segments
 * using Catmull-Rom interpolation.
 *
 * For each segment between points[i] and points[i+1], we compute
 * cubic Bezier control points using the neighboring points:
 *
 *   P_prev = points[i-1]  (or wrapped/clamped)
 *   P_curr = points[i]
 *   P_next = points[i+1]
 *   P_next2 = points[i+2] (or wrapped/clamped)
 *
 *   CP1 = P_curr + T*(P_next - P_prev)
 *   CP2 = P_next - T*(P_next2 - P_curr)
 *
 * This produces C1-continuous curves through all sample points,
 * eliminating the "polygonal" appearance of linear segments.
 *
 * @returns SVG path `d` string fragment (without M prefix)
 */
function smoothSubPathToD(sp: SubPath): string {
  const { points, closed } = sp
  if (points.length === 0) return ""
  if (points.length === 1) return `L${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`

  const parts: string[] = []

  const segmentCount = closed ? points.length : points.length - 1

  for (let i = 0; i < segmentCount; i++) {
    const p0 = getPoint(points, i - 1, closed)
    const p1 = getPoint(points, i, closed)
    const p2 = getPoint(points, i + 1, closed)
    const p3 = getPoint(points, i + 2, closed)

    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3)

    parts.push(
      `C${cp1.x.toFixed(2)},${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)},${cp2.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
    )
  }

  return parts.join("")
}

// --- SVG Output ---

/**
 * Convert a ParsedPath back to an SVG path `d` string.
 * Uses linear (L) segments — produces polygonal output.
 */
export function parsedPathToD(parsed: ParsedPath): string {
  const parts: string[] = []

  for (const sp of parsed.subPaths) {
    if (sp.points.length === 0) continue

    parts.push(`M${sp.points[0].x.toFixed(2)},${sp.points[0].y.toFixed(2)}`)

    for (let i = 1; i < sp.points.length; i++) {
      parts.push(`L${sp.points[i].x.toFixed(2)},${sp.points[i].y.toFixed(2)}`)
    }

    if (sp.closed) {
      parts.push("Z")
    }
  }

  return parts.join("")
}

/**
 * Convert a ParsedPath to a smooth SVG path `d` string using
 * Catmull-Rom → Cubic Bezier interpolation.
 *
 * Unlike parsedPathToD (which uses L segments creating sharp corners),
 * this function produces C (cubic Bezier) segments that flow smoothly
 * through all sample points, giving the morphing text a rounded,
 * organic appearance even during interpolation.
 *
 * The smoothing uses Catmull-Rom spline tangent estimation:
 *   - For each segment, the tangent at point P_i is proportional to (P_{i+1} - P_{i-1})
 *   - This ensures C1 continuity (smooth first derivatives) at every point
 *   - The TENSION parameter (0.5) controls how "tight" the curves are
 */
export function smoothPathToD(parsed: ParsedPath): string {
  const parts: string[] = []

  for (const sp of parsed.subPaths) {
    if (sp.points.length === 0) continue

    // Move to first point
    parts.push(`M${sp.points[0].x.toFixed(2)},${sp.points[0].y.toFixed(2)}`)

    // Generate smooth cubic Bezier segments
    const smoothPart = smoothSubPathToD(sp)
    if (smoothPart) parts.push(smoothPart)

    if (sp.closed) {
      parts.push("Z")
    }
  }

  return parts.join("")
}

// --- Public API ---

/**
 * Flatten an SVG path string: convert all curves to line segments.
 */
export function flattenPath(d: string, tolerance = 0.5): ParsedPath {
  const commands = parseSvgPath(d)
  const rawSubPaths = commandsToRawSubPaths(commands)
  const subPaths = rawSubPaths.map((sp) => flattenSubPath(sp, tolerance))
  return { subPaths }
}

/**
 * Resample a parsed path with dynamic or fixed sample count.
 *
 * @param parsed - The flattened parsed path
 * @param precisionOrNum - Either a number (fixed samples) or a Precision object (dynamic)
 *
 * Examples:
 *   resamplePath(parsed, 200)              // Fixed: 200 samples per sub-path
 *   resamplePath(parsed, { samplesPerUnit: 2, minSamples: 32, maxSamples: 500 })
 *                                          // Dynamic: 2 samples per unit of perimeter
 *   resamplePath(parsed, { numSamples: 200 })  // Same as fixed 200
 */
export function resamplePath(
  parsed: ParsedPath,
  precisionOrNum: number | Precision = {}
): ParsedPath {
  const precision: Precision =
    typeof precisionOrNum === "number"
      ? { numSamples: precisionOrNum }
      : precisionOrNum

  const subPaths = parsed.subPaths.map((sp) => {
    const n = resolveNumSamples(sp, precision)
    return resampleSubPath(sp, n)
  })
  return { subPaths }
}

/**
 * Full pipeline: SVG path strings → flatten → resample → centroid-align
 *
 * Returns aligned ParsedPath[] ready for interpolation.
 *
 * @param paths - Array of SVG path `d` strings
 * @param precisionOrNum - Either a number (fixed samples) or Precision config
 *
 * When using dynamic sampling, all paths are first resampled independently,
 * then during alignment, sub-paths with different point counts are
 * re-resampled to the maximum count of each pair.
 */
export function preparePathsForMorph(
  paths: string[],
  precisionOrNum: number | Precision = {}
): ParsedPath[] {
  if (paths.length === 0) return []

  // Filter out empty/invalid paths
  const validPaths = paths.filter((d) => d && typeof d === "string" && d.trim().length > 0)
  if (validPaths.length === 0) return []

  // Step 1: Flatten all paths (with defensive try/catch per path)
  const flattened: ParsedPath[] = []
  for (const d of validPaths) {
    try {
      const parsed = flattenPath(d)
      if (parsed.subPaths.length > 0 && parsed.subPaths.some((sp) => sp.points.length > 0)) {
        flattened.push(parsed)
      }
    } catch (err) {
      console.warn("[svg-path-utils] flattenPath failed for:", d.slice(0, 60), err)
    }
  }

  if (flattened.length === 0) return []

  // Step 2: Resample all paths (with dynamic or fixed count)
  const resampled = flattened.map((p) => {
    try {
      return resamplePath(p, precisionOrNum)
    } catch (err) {
      console.warn("[svg-path-utils] resamplePath failed:", err)
      return p
    }
  })

  if (resampled.length === 1) return resampled

  // Step 3: Pairwise align with centroid rotation
  const aligned: ParsedPath[] = [resampled[0]]

  for (let i = 1; i < resampled.length; i++) {
    try {
      const [a, b] = alignParsedPaths(resampled[i - 1], resampled[i])
      aligned[i - 1] = a
      aligned.push(b)
    } catch (err) {
      console.warn("[svg-path-utils] alignParsedPaths failed at index", i, err)
      aligned.push(resampled[i])
    }
  }

  // Also align first and last for loop morphing
  try {
    const [first, last] = alignParsedPaths(aligned[0], aligned[aligned.length - 1])
    aligned[0] = first
    aligned[aligned.length - 1] = last
  } catch (err) {
    console.warn("[svg-path-utils] Final alignParsedPaths failed:", err)
  }

  return aligned
}
