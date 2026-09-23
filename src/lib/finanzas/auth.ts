import { createClient } from "@supabase/supabase-js";
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  Vary: "Authorization",
};
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: privateHeaders });
}
export async function authorize(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token)
    return {
      error: json(
        { error: "Inicia sesión con tu cuenta de TravelKit/Viajes." },
        401,
      ),
    };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return {
      error: json({ error: "Acceso pendiente de configuración." }, 503),
    };
  const supabase = createClient(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(12000) }),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user || !user.email_confirmed_at || user.is_anonymous)
      return { error: json({ error: "La sesión no es válida." }, 401) };
    const { data: workspace, error: accessError } = await supabase
      .from("finance_workspace")
      .select("owner_id,watchlist,ideas")
      .eq("singleton", true)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (accessError)
      return {
        error: json(
          { error: "No se pudo comprobar el acceso. Inténtalo de nuevo." },
          503,
        ),
      };
    if (!workspace)
      return {
        error: json(
          { error: "Finanzas está reservado a su propietario." },
          403,
        ),
      };
    return { supabase, workspace, user };
  } catch {
    return { error: json({ error: "No se pudo verificar la sesión." }, 503) };
  }
}
