export type Instrument = {
  symbol: string;
  name: string;
  region: "EE. UU." | "Europa" | "Índice";
  sector: string;
};
export type Point = { date: string; close: number; volume: number };
export type Quote = Instrument & {
  price: number;
  currency: string;
  asOf: string;
  change: number | null;
  month: number | null;
  quarter: number | null;
  year: number | null;
  ma200: number | null;
  volumeRatio: number | null;
  drawdown: number | null;
  history: Point[];
  source: string;
};
export type Filing = {
  id: string;
  name: string;
  filed: string;
  url: string;
  district: string;
};
export type Trade = {
  id: string;
  person: string;
  asset: string;
  symbol: string | null;
  type: string;
  owner: string;
  traded: string | null;
  reported: string | null;
  amount: string;
  source: string;
  note: string;
};
export type Policy = {
  id: string;
  title: string;
  date: string;
  url: string;
  sectors: string[];
};
export type News = { title: string; url: string; date: string; source: string };
export type Feed<T> = {
  items: T[];
  fetchedAt: string;
  error: string | null;
  source: string;
  coverage: string;
};
export type Dashboard = {
  market: Feed<Quote>;
  filings: Feed<Filing>;
  trump: Feed<Trade>;
  policy: Feed<Policy>;
  news: Feed<News>;
};
export type Idea = {
  id: string;
  symbol: string;
  thesis: string;
  risk: string;
  createdAt: string;
  entry: number;
  entryAsOf: string;
  currency: string;
  horizon: string;
  status: "Abierta" | "Cerrada";
  exit: number | null;
  closedAt: string | null;
  exitAsOf: string | null;
};
export type Workspace = { watchlist: string[]; ideas: Idea[] };
