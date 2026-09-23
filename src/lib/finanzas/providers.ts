import { unstable_cache } from "next/cache";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { universe } from "./universe";
import { metrics } from "./metrics";
import { parseHouseIndex, parseHousePdf, parseTrump } from "./parsers";
import type {
  Feed,
  Filing,
  Instrument,
  News,
  Point,
  Policy,
  Quote,
  Trade,
} from "./types";
async function get(url: string, maxBytes = 12000000, timeoutMs = 16000) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "FinanceLab/1.0 (personal research)",
      Accept: "*/*",
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`La fuente devolvió HTTP ${r.status}.`);
  if (Number(r.headers.get("content-length") ?? 0) > maxBytes)
    throw new Error("Respuesta demasiado grande.");
  const reader = r.body?.getReader();
  if (!reader) throw new Error("Respuesta vacía.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("Respuesta demasiado grande.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
async function feed<T>(
  source: string,
  coverage: string,
  run: () => Promise<T[]>,
): Promise<Feed<T>> {
  try {
    return {
      items: await run(),
      fetchedAt: new Date().toISOString(),
      source,
      coverage,
      error: null,
    };
  } catch {
    return {
      items: [],
      fetchedAt: new Date().toISOString(),
      source,
      coverage,
      error:
        "Fuente temporalmente no disponible. No se han sustituido los datos por ejemplos.",
    };
  }
}
type YahooChart = {
  chart: {
    result:
      | {
          meta: {
            regularMarketPrice: number;
            regularMarketTime: number;
            currency: string;
          };
          timestamp: number[];
          indicators: {
            quote: { close: (number | null)[]; volume: number[] }[];
          };
        }[]
      | null;
  };
};
export const getQuote = unstable_cache(
  async (instrument: Instrument): Promise<Quote> => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.symbol)}?interval=1d&range=2y`;
    const data: YahooChart = JSON.parse(
      strFromU8(await get(url, 12000000, 8000)),
    );
    const result = data.chart.result?.[0];
    if (!result) throw new Error("Cotización no disponible.");
    const q = result.indicators.quote[0];
    const history: Point[] = result.timestamp.flatMap((t, i) =>
      q.close[i] !== null && q.close[i] > 0
        ? [
            {
              date: new Date(t * 1000).toISOString().slice(0, 10),
              close: q.close[i]!,
              volume: q.volume[i] ?? 0,
            },
          ]
        : [],
    );
    const m = metrics(history);
    if (
      !m ||
      !Number.isFinite(result.meta.regularMarketPrice) ||
      !result.meta.regularMarketTime
    )
      throw new Error("Histórico incompleto.");
    return {
      ...instrument,
      ...m,
      price: result.meta.regularMarketPrice,
      currency: result.meta.currency,
      asOf: new Date(result.meta.regularMarketTime * 1000).toISOString(),
      history: history.slice(-253),
      source: `https://finance.yahoo.com/quote/${encodeURIComponent(instrument.symbol)}/`,
    };
  },
  ["finance-quote-v1"],
  { revalidate: 900 },
);
export async function getMarket(): Promise<Feed<Quote>> {
  const items: Quote[] = [];
  let failures = 0;
  // Bound concurrency: one user's dashboard must not burst all requests at once.
  for (let i = 0; i < universe.length; i += 6) {
    const results = await Promise.allSettled(
      universe.slice(i, i + 6).map(getQuote),
    );
    for (const r of results)
      if (r.status === "fulfilled") items.push(r.value);
      else failures++;
  }
  return {
    items,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance",
    coverage: `Universo seleccionado de ${universe.length} índices y empresas; no cubre todo el mercado. Precios indicativos, con posible retraso.`,
    error: failures
      ? `${failures} cotizaciones no disponibles. Las demás conservan su fecha real.`
      : null,
  };
}
export const getFilings = unstable_cache(
  () =>
    feed<Filing>(
      "Cámara de Representantes de EE. UU.",
      "Declaraciones PTR del año actual y anterior; no incluye el Senado.",
      async () => {
        const year = new Date().getUTCFullYear();
        const all: Filing[] = [];
        // A new year may not have a published index yet. Do not hide a failed year.
        for (const y of [year, year - 1]) {
          const zip = unzipSync(
            await get(
              `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/${y}FD.zip`,
              3000000,
            ),
          );
          const txt = zip[`${y}FD.txt`];
          if (!txt) throw new Error("Índice no reconocido.");
          all.push(...parseHouseIndex(strFromU8(txt), y));
        }
        return all.sort((a, b) => b.filed.localeCompare(a.filed));
      },
    ),
  ["finance-house-v1"],
  { revalidate: 21600 },
);
export const getTrump = unstable_cache(
  () =>
    feed<Trade>(
      "Quiver Quantitative",
      "Operaciones que aparecen en la página pública de Trump; cobertura parcial de una fuente secundaria.",
      async () =>
        parseTrump(
          strFromU8(
            await get("https://www.quiverquant.com/Donald-Trump-Stock-Trades/"),
          ),
        ).slice(0, 250),
    ),
  ["finance-trump-v2"],
  { revalidate: 21600 },
);
export const getPolicy = unstable_cache(
  () =>
    feed<Policy>(
      "Federal Register",
      "Últimas 30 órdenes ejecutivas publicadas; etiquetas sectoriales por palabras clave, sin inferir impacto.",
      async () => {
        const data = JSON.parse(
          strFromU8(
            await get(
              "https://www.federalregister.gov/api/v1/documents.json?per_page=30&order=newest&conditions%5Bpresidential_document_type%5D=executive_order",
            ),
          ),
        );
        if (!Array.isArray(data.results))
          throw new Error("Formato no reconocido.");
        return data.results.map(
          (r: {
            document_number: string;
            title: string;
            publication_date: string;
            html_url: string;
          }) => ({
            id: r.document_number,
            title: r.title,
            date: r.publication_date,
            url: safeUrl(r.html_url),
            sectors: [
              [/energy|oil|gas|nuclear/i, "Energía"],
              [/defense|military|weapon/i, "Defensa"],
              [/chip|artificial intelligence|technology/i, "Tecnología"],
              [/tariff|trade|import/i, "Comercio"],
              [/drug|health|pharma/i, "Salud"],
            ]
              .filter(([re]) => (re as RegExp).test(r.title))
              .map(([, s]) => s as string),
          }),
        );
      },
    ),
  ["finance-policy-v1"],
  { revalidate: 21600 },
);
export function safeUrl(s: unknown) {
  try {
    const u = new URL(String(s));
    return u.protocol === "https:" ? u.toString() : "#";
  } catch {
    return "#";
  }
}
export const getNews = unstable_cache(
  () =>
    feed<News>(
      "Google News / medios enlazados",
      "Titulares de bolsa, empresas, aranceles y bancos centrales. No son señales verificadas.",
      async () => {
        const xml = strFromU8(
          await get(
            "https://news.google.com/rss/search?q=bolsa%20Wall%20Street%20Europa%20aranceles%20when%3A3d&hl=es&gl=ES&ceid=ES%3Aes",
          ),
        );
        const data = new XMLParser({ ignoreAttributes: false }).parse(xml);
        const items = data?.rss?.channel?.item;
        if (!items) throw new Error("RSS no disponible.");
        return (Array.isArray(items) ? items : [items])
          .slice(0, 20)
          .map((r) => ({
            title: String(r.title),
            url: safeUrl(r.link),
            date: new Date(r.pubDate).toISOString(),
            source:
              typeof r.source === "string"
                ? r.source
                : String(r.source?.["#text"] ?? "Medio externo"),
          }));
      },
    ),
  ["finance-news-v1"],
  { revalidate: 3600 },
);
export const getFilingTrades = unstable_cache(
  async (filing: Filing): Promise<Feed<Trade>> =>
    feed(
      "Cámara de Representantes de EE. UU.",
      "Extracción automática parcial; consultar PDF original para verificar y ver todas las filas.",
      async () => {
        const { default: PDFParser } = await import("pdf2json");
        const bytes = Buffer.from(await get(filing.url, 5000000));
        const parsed = await new Promise<Parameters<typeof parseHousePdf>[0]>(
          (resolve, reject) => {
            const parser = new PDFParser();
            const timer = setTimeout(() => {
              parser.destroy();
              reject(new Error("Tiempo agotado"));
            }, 12000);
            parser.on("pdfParser_dataError", () => {
              clearTimeout(timer);
              parser.destroy();
              reject(new Error("No se pudo leer el PDF"));
            });
            parser.on("pdfParser_dataReady", (data) => {
              clearTimeout(timer);
              resolve(data as Parameters<typeof parseHousePdf>[0]);
              parser.destroy();
            });
            parser.parseBuffer(bytes);
          },
        );
        const trades = parseHousePdf(parsed, filing);
        if (!trades.length) throw new Error("Documento no reconocido.");
        return trades;
      },
    ),
  ["finance-pdf-v1"],
  { revalidate: 21600 },
);
