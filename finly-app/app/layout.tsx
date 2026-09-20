import type { Metadata } from "next"
import { Inter, Great_Vibes } from "next/font/google"
import "./globals.css"
import { PrivacyProvider } from "@/components/privacy-context"
import { AuthProvider } from "@/components/auth-context"
import { LanguageProvider } from "@/components/i18n-context"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"

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
              <SidebarProvider defaultOpen={true}>
                {/* Official Shadcn Desktop Left Sidebar with User Account at Bottom Left */}
                <AppSidebar />

                {/* Main Content Area */}
                <SidebarInset className="bg-[#09090B] flex flex-col min-h-screen">
                  {/* Top Contextual Header with SidebarTrigger, Privacy toggle & Action buttons */}
                  <AppHeader />

                  {/* Dynamic Page Content */}
                  <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto pb-24 md:pb-8">
                    {children}
                  </main>

                  {/* Mobile Bottom Navigation Bar (Synthèse, Budget, Analyse, Projet) */}
                  <MobileNav />
                </SidebarInset>
              </SidebarProvider>
            </PrivacyProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
