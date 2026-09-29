import type { Metadata } from "next"
import { Inter, Great_Vibes } from "next/font/google"
import "./globals.css"
import { PrivacyProvider } from "@/components/privacy-context"
import { AuthProvider } from "@/components/auth-context"
import { LanguageProvider } from "@/components/i18n-context"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

const greatVibes = Great_Vibes({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-logo",
})

export const metadata: Metadata = {
  title: "Finly - Financial Tracking & Wealth Management",
  description: "Multi-account bank aggregation with Woob, expense tracking, and budget project management.",
  verification: {
    google: "4wXa6Y7ytgfPB9Kzv66zwqoKlHwgY_TwUFcfS4t-mPc",
  },
  openGraph: {
    title: "Finly - Financial Tracking & Wealth Management",
    description: "Multi-account bank aggregation with Woob, expense tracking, and budget project management.",
    url: "https://louislefo.github.io/finly-site/",
    siteName: "Finly",
    images: [
      {
        url: "/logo-full.png",
        width: 1200,
        height: 630,
        alt: "Finly Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finly - Financial Tracking & Wealth Management",
    description: "Multi-account bank aggregation with Woob, expense tracking, and budget project management.",
    images: ["/logo-full.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${inter.variable} ${greatVibes.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#09090B] text-[#e5e1e4] font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        <AuthProvider>
          <LanguageProvider>
            <PrivacyProvider>
              {children}
            </PrivacyProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
