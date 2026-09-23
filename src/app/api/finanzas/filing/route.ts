import { authorize, json } from "@/lib/finanzas/auth";
import { getFilings, getFilingTrades } from "@/lib/finanzas/providers";
export const maxDuration = 60;
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d{4}-\d+$/.test(id))
    return json({ error: "Documento no válido." }, 400);
  const filings = await getFilings();
  const filing = filings.items.find((f) => f.id === id);
  if (!filing)
    return json(
      { error: "Declaración no encontrada en el índice oficial." },
      404,
    );
  return json(await getFilingTrades(filing));
}
