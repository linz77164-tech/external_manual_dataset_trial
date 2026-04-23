import type { Metadata } from "next"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: "Morphing Text — Magic UI",
  description: "SVG path interpolation with spring physics for smooth text transitions",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
