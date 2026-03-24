import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loginLimiter } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { success, remaining, reset } = await loginLimiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 10 minutes." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }

  // Parse body
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  // Authenticate via Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401, headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  }

  return NextResponse.json(
    {
      session: data.session,
      user: { id: data.user.id, email: data.user.email },
    },
    { headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
