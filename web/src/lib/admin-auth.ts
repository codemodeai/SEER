import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  error?: string;
}

export async function verifyAdmin(
  authHeader: string | null
): Promise<AdminAuthResult> {
  if (!authHeader) {
    return { authorized: false, error: "Unauthorized" };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { authorized: false, error: "Unauthorized" };
  }

  // Check admin role in users table
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!userData || userData.role !== "admin") {
    return { authorized: false, error: "Forbidden" };
  }

  return { authorized: true, userId: user.id };
}
