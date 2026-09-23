import { authorize, json } from "@/lib/finanzas/auth";
import { universe } from "@/lib/finanzas/universe";
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  return json({
    watchlist: auth.workspace.watchlist,
    ideas: auth.workspace.ideas,
  });
}
export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  try {
    const raw = await request.text();
    if (raw.length > 300000)
      return json({ error: "Contenido demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (
      !Array.isArray(body.watchlist) ||
      body.watchlist.length > 100 ||
      body.watchlist.some(
        (s: unknown) =>
          typeof s !== "string" || !universe.some((i) => i.symbol === s),
      )
    )
      return json({ error: "Lista no válida." }, 400);
    const { error } = await auth.supabase
      .from("finance_workspace")
      .update({
        watchlist: [...new Set(body.watchlist)],
        updated_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    return error
      ? json({ error: "No se guardaron los cambios." }, 503)
      : json({ ok: true });
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }
}
