import { NextResponse } from "next/server";

// Lightweight liveness check used by the SEER Desktop agent to decide whether
// to flip its sidebar status dot to green. Must be public and return quickly.
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "seer-mcp", ts: Date.now() },
    { status: 200 }
  );
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
