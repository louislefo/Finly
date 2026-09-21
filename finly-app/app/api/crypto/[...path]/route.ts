import { NextRequest, NextResponse } from "next/server"

const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision/api/v3",
  "https://api1.binance.com/api/v3",
  "https://api2.binance.com/api/v3",
  "https://api3.binance.com/api/v3",
  "https://api.binance.com/api/v3",
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const subPath = (path || []).join("/")
  const searchParams = request.nextUrl.search || ""

  for (const baseUrl of BINANCE_ENDPOINTS) {
    try {
      const targetUrl = `${baseUrl}/${subPath}${searchParams}`
      const res = await fetch(targetUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FinlyApp/1.0",
        },
        cache: "no-store",
      })

      if (res.ok) {
        const data = await res.json()
        // If Binance returned an error object like { code: 0, msg: "Service unavailable..." }
        if (data && typeof data === "object" && !Array.isArray(data) && data.code !== undefined && data.code !== 200) {
          continue
        }
        return NextResponse.json(data, {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
          },
        })
      }
    } catch {
      // Try next mirror
    }
  }

  return NextResponse.json(
    { error: "Failed to fetch crypto data from all Binance mirrors" },
    { status: 502 }
  )
}
