import { authorize, json } from "@/lib/finanzas/auth";
import {
  getMarket,
  getFilings,
  getTrump,
  getPolicy,
  getNews,
} from "@/lib/finanzas/providers";
export const maxDuration = 60;
export async function GET(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const [market, filings, trump, policy, news] = await Promise.all([
    getMarket(),
    getFilings(),
    getTrump(),
    getPolicy(),
    getNews(),
  ]);
  return json({ market, filings, trump, policy, news });
}
