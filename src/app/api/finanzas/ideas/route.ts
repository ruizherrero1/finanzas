import { randomUUID } from "node:crypto";
import { authorize, json } from "@/lib/finanzas/auth";
import { getQuote } from "@/lib/finanzas/providers";
import { universe } from "@/lib/finanzas/universe";
import type { Idea } from "@/lib/finanzas/types";
export async function POST(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  try {
    const raw = await request.text();
    if (raw.length > 10000)
      return json({ error: "Texto demasiado largo." }, 413);
    const body = JSON.parse(raw);
    let ideas: Idea[] = auth.workspace.ideas;
    if (body.action === "close") {
      const idea = ideas.find(
        (i) => i.id === body.id && i.status === "Abierta",
      );
      if (!idea) return json({ error: "Idea no encontrada." }, 404);
      const instrument = universe.find((i) => i.symbol === idea.symbol);
      if (!instrument) return json({ error: "Activo no disponible." }, 400);
      const quote = await getQuote(instrument);
      if (Date.now() - Date.parse(quote.asOf) > 4 * 86400000)
        return json(
          { error: "Cotización demasiado antigua para cerrar la simulación." },
          409,
        );
      ideas = ideas.map((i) =>
        i.id === idea.id
          ? {
              ...i,
              status: "Cerrada",
              exit: quote.price,
              closedAt: new Date().toISOString(),
              exitAsOf: quote.asOf,
            }
          : i,
      );
    } else {
      const instrument = universe.find(
        (i) => i.symbol === body.symbol && i.region !== "Índice",
      );
      if (
        !instrument ||
        typeof body.thesis !== "string" ||
        body.thesis.trim().length < 10 ||
        body.thesis.length > 2000 ||
        typeof body.risk !== "string" ||
        body.risk.trim().length < 5 ||
        body.risk.length > 1000 ||
        !["3 meses", "6 meses", "1 año", "2 años"].includes(body.horizon)
      )
        return json(
          { error: "Indica activo, tesis, riesgo y horizonte válidos." },
          400,
        );
      if (ideas.length >= 200)
        return json({ error: "Se ha alcanzado el límite de 200 ideas." }, 400);
      const quote = await getQuote(instrument);
      if (Date.now() - Date.parse(quote.asOf) > 4 * 86400000)
        return json(
          { error: "Cotización demasiado antigua para registrar una entrada." },
          409,
        );
      ideas = [
        {
          id: randomUUID(),
          symbol: instrument.symbol,
          thesis: body.thesis.trim(),
          risk: body.risk.trim(),
          horizon: body.horizon,
          createdAt: new Date().toISOString(),
          entry: quote.price,
          entryAsOf: quote.asOf,
          currency: quote.currency,
          status: "Abierta",
          exit: null,
          closedAt: null,
          exitAsOf: null,
        },
        ...ideas,
      ];
    }
    // Optimistic locking avoids silently losing an idea saved from another tab.
    const { data, error } = await auth.supabase
      .from("finance_workspace")
      .update({ ideas, updated_at: new Date().toISOString() })
      .eq("singleton", true)
      .eq("ideas", JSON.stringify(auth.workspace.ideas))
      .select("ideas");
    if (error) return json({ error: "No se pudo guardar la idea." }, 503);
    if (!data?.length)
      return json(
        {
          error:
            "El diario ha cambiado en otra pestaña. Actualiza antes de guardar.",
        },
        409,
      );
    return json({ ideas });
  } catch {
    return json(
      { error: "No se pudo guardar. Comprueba la conexión y los datos." },
      503,
    );
  }
}
