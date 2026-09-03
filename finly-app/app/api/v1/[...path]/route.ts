import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, await params)
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  })
}

async function handleProxy(request: NextRequest, params: { path: string[] }) {
  try {
    const subPath = (params.path || []).join("/")
    const searchParams = request.nextUrl.search || ""
    const targetUrl = `${BACKEND_URL}/api/v1/${subPath}${searchParams}`

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    const authHeader = request.headers.get("authorization")
    if (authHeader) {
      headers["authorization"] = authHeader
    }

    let body: any = undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        const text = await request.text()
        if (text) body = text
      } catch {
        // empty body
      }
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    })

    const contentType = response.headers.get("content-type") || ""
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text()

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    })
  } catch (err: any) {
    console.error("[API Proxy Route Error]:", err)
    return NextResponse.json(
      { detail: `Impossible de joindre le serveur backend (${err.message}). Vérifiez que le serveur FastAPI est démarré sur le port 8000.` },
      { status: 502 }
    )
  }
}
