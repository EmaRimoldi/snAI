import { createClient } from "@supabase/supabase-js";

// Public values by design (equivalent to the anon key); env vars can override.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://zgfanoruqwftbqhhvtwg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ThFBIsq2HyTAGwuWgdVuNw_bvfUh6Vy";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
