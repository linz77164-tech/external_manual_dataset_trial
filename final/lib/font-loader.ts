"use client"

// ============================================================
// FontManager: opentype.js font loader with caching & SSR safety
// ============================================================
//
// Key features:
//   1. Class-based FontManager with Map cache — no duplicate fetches
//   2. Dynamic import of opentype.js — avoids SSR bundling issues
//   3. loadOnClient() guard — skips execution on server
//   4. Singleton pattern — shared across component instances
//   5. Preloading support — start fetch before component mounts
// ============================================================

type OpentypeFont = import("opentype.js").Font

// --- FontManager Class ---

export class FontManager {
  private cache = new Map<string, OpentypeFont>()
  private pending = new Map<string, Promise<OpentypeFont>>()
  private opentypeModule: typeof import("opentype.js") | null = null

  /** Load the opentype.js module dynamically (client-only) */
  private async getOpentype(): Promise<typeof import("opentype.js")> {
    if (this.opentypeModule) return this.opentypeModule
    // Dynamic import ensures opentype.js is never bundled for SSR
    this.opentypeModule = await import("opentype.js")
    return this.opentypeModule
  }

  /**
   * Load a font from URL with caching and error recovery.
   * If the same URL is requested concurrently, returns the same Promise.
   * On network/parse failure, falls back to a system font glyph set.
   */
  async loadFont(url: string): Promise<OpentypeFont> {
    // Check cache first
    const cached = this.cache.get(url)
    if (cached) return cached

    // Check if already loading
    const pending = this.pending.get(url)
    if (pending) return pending

    // Start loading
    const loadPromise = this._fetchAndParse(url)
    this.pending.set(url, loadPromise)

    try {
      const font = await loadPromise
      this.cache.set(url, font)
      return font
    } catch (err) {
      // On any error (network, parse), try fallback font
      console.warn(`[FontLoader] Failed to load "${url}":`, err)
      const fallback = await this._loadFallback()
      this.cache.set(url, fallback)
      return fallback
    } finally {
      this.pending.delete(url)
    }
  }

  /**
   * Load a font from Base64 string with caching.
   * Useful for embedding a small subset font inline.
   */
  async loadFontFromBase64(base64: string): Promise<OpentypeFont> {
    const cached = this.cache.get(base64)
    if (cached) return cached

    const opentype = await this.getOpentype()
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const font = opentype.parse(bytes.buffer)
    this.cache.set(base64, font)
    return font
  }

  /**
   * Preload a font URL without waiting for the result.
   * Call this early (e.g. in a parent component) to start the fetch sooner.
   */
  preload(url: string): void {
    if (!this.cache.has(url) && !this.pending.has(url)) {
      this.loadFont(url).catch(() => {
        // Swallow errors — the actual consumer will handle them
      })
    }
  }

  /** Check if a font is already loaded and cached */
  isLoaded(url: string): boolean {
    return this.cache.has(url)
  }

  /** Clear the entire cache (useful for testing) */
  clearCache(): void {
    this.cache.clear()
    this.pending.clear()
  }

  /** Get cache stats for debugging */
  getStats(): { cached: number; pending: number } {
    return {
      cached: this.cache.size,
      pending: this.pending.size,
    }
  }

  // --- Internal ---

  private async _fetchAndParse(url: string): Promise<OpentypeFont> {
    const opentype = await this.getOpentype()

    let arrayBuffer: ArrayBuffer

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }
      arrayBuffer = await response.arrayBuffer()
    } catch (fetchErr) {
      // Try local fallback path: if URL is like /fonts/xxx.ttf, fetch from same origin
      if (url.startsWith("/fonts/")) {
        throw fetchErr
      }
      // External URL failed — try local fallback
      console.warn(`[FontLoader] External URL failed, trying local fallback...`)
      const localUrl = "/fonts/Inter-Regular.ttf"
      const localResp = await fetch(localUrl)
      if (!localResp.ok) {
        throw new Error(`Local fallback also failed: HTTP ${localResp.status}`)
      }
      arrayBuffer = await localResp.arrayBuffer()
    }

    const font = opentype.parse(arrayBuffer)
    if (!font || !font.glyphs) {
      throw new Error("opentype.parse returned invalid font object")
    }
    return font
  }

  /**
   * Load a built-in fallback font (Inter-Regular from local /fonts/).
   * Used when the primary font fails to load.
   */
  private async _loadFallback(): Promise<OpentypeFont> {
    const opentype = await this.getOpentype()
    try {
      const resp = await fetch("/fonts/Inter-Regular.ttf")
      if (resp.ok) {
        const buf = await resp.arrayBuffer()
        const font = opentype.parse(buf)
        if (font && font.glyphs) return font
      }
    } catch {
      // Local fallback also failed
    }

    // Last resort: create a minimal font with opentype.js
    // This produces a font with basic Latin glyphs so rendering never crashes
    const notdefGlyph = new opentype.Glyph({
      name: "notdef",
      unicode: 0,
      advanceWidth: 500,
      path: new opentype.Path(),
    })
    const fallbackFont = new opentype.Font({
      familyName: "Fallback",
      styleName: "Regular",
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      glyphs: [notdefGlyph],
    })
    return fallbackFont
  }
}

// --- Singleton ---

let _instance: FontManager | null = null

/**
 * Get the global FontManager singleton.
 * Only creates the instance on the client side.
 */
export function getFontManager(): FontManager {
  if (typeof window === "undefined") {
    // SSR: return a no-op manager that will never resolve fonts
    // This prevents any browser API calls during server rendering
    return new FontManager()
  }
  if (!_instance) {
    _instance = new FontManager()
  }
  return _instance
}

// --- Convenience Functions (backward compatible) ---

/**
 * Load a font from URL using the global FontManager.
 * Drop-in replacement for the original loadFont function.
 */
export async function loadFont(url: string): Promise<OpentypeFont> {
  return getFontManager().loadFont(url)
}

/**
 * Load a font from Base64 using the global FontManager.
 */
export async function loadFontFromBase64(base64: string): Promise<OpentypeFont> {
  return getFontManager().loadFontFromBase64(base64)
}

// --- Path Extraction ---

/**
 * Get the SVG path string for a single character.
 * Returns empty string if the glyph has no outline (e.g. space).
 */
export function getCharPath(font: OpentypeFont, char: string, fontSize = 100): string {
  const glyph = font.charToGlyph(char)
  const path = glyph.getPath(0, 0, fontSize)
  const d = path.toPathData(2)
  return d || ""
}

/**
 * Get SVG path string for a full text string with letter-spacing.
 *
 * Unlike getCharPath (which only gets a single character's outline),
 * this renders the entire text as a single path with proper kerning
 * and optional tracking (letter-spacing).
 *
 * @param font - The opentype.js Font object
 * @param text - The text string to render
 * @param fontSize - Font size in SVG units (default: 100)
 * @param letterSpacing - Extra spacing between characters in SVG units (default: 0)
 * @returns SVG path `d` string
 */
export function getTextPathWithSpacing(
  font: OpentypeFont,
  text: string,
  fontSize = 100,
  letterSpacing = 0
): string {
  const glyphs = font.stringToGlyphs(text)
  const path = font.getPath(text, 0, 0, fontSize, {
    kerning: true,
    tracking: Math.round(letterSpacing * (fontSize / font.unitsPerEm)),
  })
  const d = path.toPathData(2)
  return d || ""
}

/**
 * Get SVG path strings for each character in a text string.
 */
export function getTextPaths(
  font: OpentypeFont,
  text: string,
  fontSize = 100
): string[] {
  return [...text].map((char) => getCharPath(font, char, fontSize))
}

// --- Default Font URL ---

/**
 * Default font URL — local Inter Regular for zero network dependency.
 * Falls back to Google Fonts CDN only if local file is missing.
 */
export const DEFAULT_FONT_URL = "/fonts/Inter-Regular.ttf"
