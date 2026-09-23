import { usDate } from "./metrics";
import type { Filing, Trade } from "./types";
export function parseHouseIndex(text: string, year: number): Filing[] {
  const [header, ...lines] = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  const cols = header.split("\t");
  return lines
    .flatMap((line) => {
      const cells = line.split("\t");
      const row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ""]));
      const filed = usDate(row.FilingDate);
      if (row.FilingType !== "P" || !/^\d+$/.test(row.DocID) || !filed)
        return [];
      return [
        {
          id: `${year}-${row.DocID}`,
          name: `${row.First} ${row.Last}`.trim(),
          filed,
          url: `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/${year}/${row.DocID}.pdf`,
          district: row.StateDst,
        },
      ];
    })
    .sort((a, b) => b.filed.localeCompare(a.filed));
}
export function parseTrump(html: string): Trade[] {
  const raw = html.match(
    /\b(?:let|const|var)\s+trumpTradesData\s*=\s*(\[[\s\S]*?\]);/,
  );
  if (!raw) throw new Error("La fuente ha cambiado de formato.");
  // Public source emits NaN for unknown return values. Never evaluate source JavaScript.
  const normalized = raw[1].replace(/"(?:\\.|[^"\\])*"|\bNaN\b/g, (token) =>
    token === "NaN" ? "null" : token,
  );
  const data: unknown = JSON.parse(normalized);
  if (!Array.isArray(data)) throw new Error("Formato no válido.");
  return data
    .flatMap((row: unknown) => {
      if (
        !Array.isArray(row) ||
        row.length < 8 ||
        !row.slice(0, 4).every((x) => typeof x === "string") ||
        typeof row[5] !== "string" ||
        typeof row[6] !== "string" ||
        typeof row[7] !== "string"
      )
        return [];
      const reported = row[2].slice(0, 10),
        traded = row[3].slice(0, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(reported) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(traded)
      )
        return [];
      return [
        {
          id: row[7],
          person: "Donald Trump",
          asset: row[6],
          symbol: /^[A-Z0-9.\-]{1,15}$/.test(row[0]) ? row[0] : null,
          type:
            row[1] === "Purchase"
              ? "Compra"
              : row[1] === "Sale"
                ? "Venta"
                : row[1],
          owner: "Titularidad no desglosada por esta fuente",
          traded,
          reported,
          amount: row[5],
          source: "https://www.quiverquant.com/Donald-Trump-Stock-Trades/",
          note: "Fuente secundaria: Quiver. Operación declarada; no demuestra quién decidió la inversión.",
        },
      ];
    })
    .sort(
      (a, b) =>
        b.reported!.localeCompare(a.reported!) ||
        b.traded!.localeCompare(a.traded!),
    );
}
type PdfText = { x: number; y: number; R: { T: string }[] };
export function parseHousePdf(
  data: { Pages: { Texts: PdfText[] }[] },
  filing: Filing,
): Trade[] {
  const trades: Trade[] = [];
  for (const [pageIndex, page] of data.Pages.entries()) {
    const cells = page.Texts.map((c) => ({
      x: c.x,
      y: c.y,
      text: c.R.map((r) => {
        try {
          return decodeURIComponent(r.T);
        } catch {
          return "";
        }
      })
        .join("")
        .replace(/\0/g, "")
        .trim(),
    })).filter((c) => c.text);
    const dates = cells.filter(
      (c) => /^\d{2}\/\d{2}\/\d{4}$/.test(c.text) && c.x > 18 && c.x < 23,
    );
    for (const date of dates) {
      const sameRow = cells.filter((c) => Math.abs(c.y - date.y) < 0.15);
      if (!sameRow.some((c) => c.x > 23 && c.x < 27 && usDate(c.text)))
        continue;
      const typeCell = sameRow.find(
        (c) => c.x > 15 && c.x < 19 && /^(P|S(?:\s*\(.*\))?|E)$/.test(c.text),
      );
      if (!typeCell) continue;
      const row = cells
        .filter((c) => c.y >= date.y - 0.1 && c.y < date.y + 1.5)
        .sort((a, b) => (Math.abs(a.y - b.y) < 0.15 ? a.x - b.x : a.y - b.y));
      const asset = row
        .filter((c) => c.x >= 5.5 && c.x < 15.5)
        .map((c) => c.text)
        .join(" ")
        .trim();
      const amount = row
        .filter((c) => c.x >= 27 && c.x < 32)
        .map((c) => c.text)
        .join(" ")
        .trim();
      if (!asset || !/^\$[\d,]+\s*-\s*\$[\d,]+$/.test(amount)) continue;
      const owner = sameRow.find((c) => c.x > 2 && c.x < 5.5)?.text ?? "";
      trades.push({
        id: `${filing.id}-${pageIndex}-${date.y}`,
        person: filing.name,
        asset,
        symbol: asset.match(/\(([A-Z][A-Z0-9.\-]{0,9})\)/)?.[1] ?? null,
        type:
          typeCell.text === "P"
            ? "Compra"
            : typeCell.text.startsWith("S")
              ? "Venta"
              : "Intercambio",
        owner:
          owner === "SP"
            ? "Cónyuge"
            : owner === "JT"
              ? "Titularidad conjunta"
              : owner === "DC"
                ? "Hijo dependiente"
                : owner || "No indicado",
        traded: usDate(date.text),
        reported: filing.filed,
        amount,
        source: filing.url,
        note: `Extracción automática del PDF, página ${pageIndex + 1}. ${asset.includes("[OP]") ? "Opciones: no equivale a comprar acciones. " : ""}Revisar el original; puede haber filas no reconocidas o declaraciones rectificadas.`,
      });
    }
  }
  return trades;
}
