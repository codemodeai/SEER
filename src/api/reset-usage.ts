import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabase } from "../lib/supabase.js";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const { error } = await supabase
    .from("users")
    .update({ usage_this_month: 0 })
    .neq("plan", "none");

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ status: "ok", message: "Monthly usage reset complete" });
}
