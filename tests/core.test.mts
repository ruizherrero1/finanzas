import test from "node:test";
import assert from "node:assert/strict";
import { metrics, lagDays, usDate } from "../src/lib/finanzas/metrics.ts";
import {
  parseHouseIndex,
  parseTrump,
  parseHousePdf,
} from "../src/lib/finanzas/parsers.ts";
import { authorize } from "../src/lib/finanzas/auth.ts";
test("returns unknown metrics for insufficient data, not a zero return", () => {
  assert.equal(metrics([]), null);
  const m = metrics([{ date: "2026-01-01", close: 100, volume: 100 }])!;
  assert.equal(m.month, null);
  assert.equal(m.year, null);
  assert.equal(m.ma200, null);
  assert.equal(m.volumeRatio, null);
});
test("financial windows use prior sessions without lookahead", () => {
  const p = Array.from({ length: 253 }, (_, i) => ({
    date: String(i),
    close: i + 100,
    volume: 100,
  }));
  const m = metrics(p)!;
  assert.ok(Math.abs(m.year! - 252) < 1e-9);
  assert.equal(m.ma200, 252.5);
  assert.equal(m.volumeRatio, 1);
  assert.equal(m.drawdown, 0);
});
test("validates actual calendar dates and does not invent a negative disclosure lag", () => {
  assert.equal(usDate("2/30/2026"), null);
  assert.equal(usDate("8/21/2026"), "2026-08-21");
  assert.equal(lagDays("2026-07-24", "2026-08-21"), 28);
  assert.equal(lagDays("2026-08-22", "2026-08-21"), null);
});
test("House index selects PTR filings and rejects malicious document ids", () => {
  const result = parseHouseIndex(
    "First\tLast\tFilingType\tFilingDate\tDocID\tStateDst\nNancy\tPelosi\tP\t8/21/2026\t123\tCA11\nNancy\tPelosi\tA\t8/21/2026\t124\tCA11\nNancy\tPelosi\tP\t8/21/2026\t../x\tCA11",
    2026,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].filed, "2026-08-21");
  assert.match(result[0].url, /2026\/123.pdf$/);
});
test("Trump data maps publication and transaction dates distinctly and does not execute source code", () => {
  const result = parseTrump(
    'let trumpTradesData = [["AAPL","Purchase","2026-09-22 00:00:00","2026-07-24 00:00:00",55,"$1,001 - $15,000","Apple","id-1",8000]];',
  );
  assert.equal(result[0].reported, "2026-09-22");
  assert.equal(result[0].traded, "2026-07-24");
  assert.equal(result[0].amount, "$1,001 - $15,000");
  assert.throws(() => parseTrump("let trumpTradesData = [process.exit()];"));
});
test("PDF reader retains spouse and options; refuses an ambiguous amount", () => {
  const f = {
    id: "2026-123",
    name: "Nancy Pelosi",
    filed: "2026-08-21",
    district: "CA11",
    url: "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/123.pdf",
  };
  const c = (x: number, y: number, T: string) => ({
    x,
    y,
    R: [{ T: encodeURIComponent(T) }],
  });
  const cells = [
    c(3.8, 20, "SP"),
    c(6.2, 20, "Intel (INTC) [OP]"),
    c(16, 20, "P"),
    c(20, 20, "07/24/2026"),
    c(23.5, 20, "07/24/2026"),
    c(27.5, 20, "$250,001 -"),
    c(27.5, 20.7, "$500,000"),
  ];
  const result = parseHousePdf({ Pages: [{ Texts: cells }] }, f);
  assert.equal(result.length, 1);
  assert.equal(result[0].owner, "Cónyuge");
  assert.equal(result[0].symbol, "INTC");
  assert.match(result[0].note, /Opciones/);
  assert.equal(
    parseHousePdf({ Pages: [{ Texts: cells.slice(0, -1) }] }, f).length,
    0,
  );
});
test("API denies anonymous requests before calling any provider", async () => {
  const result = await authorize(
    new Request("http://localhost/api/finanzas/dashboard"),
  );
  assert.equal(result.error?.status, 401);
  assert.match(result.error!.headers.get("Cache-Control")!, /no-store/);
});
test("API denies valid users without owner workspace and rejects forged metadata", async () => {
  const oldFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test";
  globalThis.fetch = async (input) =>
    String(input).includes("/auth/v1/user")
      ? Response.json({
          id: "other",
          email_confirmed_at: new Date().toISOString(),
          is_anonymous: false,
          user_metadata: { owner: true },
        })
      : Response.json(null);
  try {
    const result = await authorize(
      new Request("http://localhost", {
        headers: { Authorization: "Bearer other" },
      }),
    );
    assert.equal(result.error?.status, 403);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
