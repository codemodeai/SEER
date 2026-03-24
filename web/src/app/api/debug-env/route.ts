import { NextResponse } from "next/server";

// Debug endpoint removed for security — was exposing credentials publicly.
// Use Vercel dashboard or local .env to inspect environment variables.
export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been disabled." },
    { status: 403 }
  );
}
