import type { Point } from "./types";
export const percent = (a: number, b: number) =>
  b > 0 ? (a / b - 1) * 100 : null;
export function metrics(points: Point[]) {
  const valid = points.filter((p) => Number.isFinite(p.close) && p.close > 0);
  const last = valid.at(-1);
  if (!last) return null;
  const ago = (n: number) =>
    valid.length > n
      ? percent(last.close, valid[valid.length - 1 - n].close)
      : null;
  const previousVolumes = valid
    .slice(-21, -1)
    .map((p) => p.volume)
    .filter((v) => v > 0);
  const volumeAverage =
    previousVolumes.reduce((a, b) => a + b, 0) / previousVolumes.length;
  return {
    change: ago(1),
    month: ago(21),
    quarter: ago(63),
    year: ago(252),
    ma200:
      valid.length >= 200
        ? valid.slice(-200).reduce((a, p) => a + p.close, 0) / 200
        : null,
    volumeRatio:
      previousVolumes.length === 20 && volumeAverage > 0
        ? last.volume / volumeAverage
        : null,
    drawdown: percent(
      last.close,
      Math.max(...valid.slice(-252).map((p) => p.close)),
    ),
  };
}
export function usDate(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(iso + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function lagDays(traded: string | null, reported: string | null) {
  if (!traded || !reported) return null;
  const lag = (Date.parse(reported) - Date.parse(traded)) / 86400000;
  return Number.isFinite(lag) && lag >= 0 ? Math.floor(lag) : null;
}
