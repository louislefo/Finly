import React from "react"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center items-center">
      {children}
    </div>
  )
}
