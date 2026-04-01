import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    "";

  const isDev = process.env.NODE_ENV === "development";

  return NextResponse.json({
    country: country || (isDev ? "IN" : ""),
    isIndia: country === "IN" || (isDev && !country),
  });
}
