import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Liquid Glass | Interactive Glass UI Experience",
  description:
    "Experience beautiful, interactive liquid glass effects with smooth animations and touch-friendly controls. A modern UI showcase built with Next.js.",
  keywords: ["liquid glass", "glass UI", "glassmorphism", "interactive design", "Next.js", "React"],
  authors: [{ name: "Liquid Glass" }],
  openGraph: {
    title: "Liquid Glass | Interactive Glass UI Experience",
    description:
      "Experience beautiful, interactive liquid glass effects with smooth animations and touch-friendly controls.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Liquid Glass | Interactive Glass UI Experience",
    description:
      "Experience beautiful, interactive liquid glass effects with smooth animations and touch-friendly controls.",
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
