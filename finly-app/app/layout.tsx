import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { PrivacyProvider } from "@/components/privacy-context"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
})

export const metadata: Metadata = {
  title: "Finly - PWA de Suivi Financier & Agrégation Bancaire",
  description: "Agrégation bancaire multi-comptes GoCardless, suivi des dépenses et gestion de projets budgétaires.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={`dark ${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#09090B] text-[#e5e1e4] font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        <PrivacyProvider>
          {/* Top Header with Route Links & Account Dropdown */}
          <AppHeader />

          {/* Dynamic Page Content */}
          <main className="flex-1 p-4 md:p-8 overflow-y-auto">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileNav />
        </PrivacyProvider>
      </body>
    </html>
  )
}
