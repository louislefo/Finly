import { NextRequest, NextResponse } from "next/server"

const FRANKFURTER_ENDPOINTS = [
  "https://api.frankfurter.dev/v1",
  "https://api.frankfurter.app/v1",
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const subPath = (path || []).join("/")
  const searchParams = request.nextUrl.search || ""

  for (const baseUrl of FRANKFURTER_ENDPOINTS) {
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
        return NextResponse.json(data, {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        })
      }
    } catch {
      // Try next mirror
    }
  }

  return NextResponse.json(
    { error: "Failed to fetch forex data from Frankfurter API" },
    { status: 502 }
  )
}
