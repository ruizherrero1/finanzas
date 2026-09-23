import {
  createClient as supabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export function createClient() {
  return (client ??= supabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  ));
}
