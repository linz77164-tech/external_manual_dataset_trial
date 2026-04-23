import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black text-white">
      <h1 className="text-4xl font-bold tracking-tight">
        Morphing Text Demo
      </h1>
      <p className="max-w-md text-center text-gray-400">
        SVG path interpolation with spring physics for smooth text transitions.
      </p>
      <Link
        href="/preview/morphing-text"
        className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200"
      >
        View Demo →
      </Link>
    </div>
  )
}
