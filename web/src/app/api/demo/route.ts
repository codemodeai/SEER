import { NextRequest, NextResponse } from "next/server";

const MCP_DEMO_URL = "https://mcp.seermcp.com/api/demo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(MCP_DEMO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Optimization failed. Try again." },
      { status: 500 }
    );
  }
}
