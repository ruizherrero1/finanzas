"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ThemeControl, useFinanceTheme } from "./ThemeControl";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ArrowUpRight as External,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Clock3,
  Globe2,
  Landmark,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { universe } from "@/lib/finanzas/universe";
import { lagDays, percent } from "@/lib/finanzas/metrics";
import type {
  Dashboard,
  Feed,
  Filing,
  Idea,
  Quote,
  Trade,
  Workspace,
} from "@/lib/finanzas/types";
type Tab = "Radar" | "Mercados" | "Políticos" | "Mi diario" | "Fuentes";
const tabs = [
  { name: "Radar", icon: Activity },
  { name: "Mercados", icon: ChartNoAxesCombined },
  { name: "Políticos", icon: Landmark },
  { name: "Mi diario", icon: BookOpen },
  { name: "Fuentes", icon: ShieldCheck },
] as const;
const number = (v: number | null, digits = 2) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("es-ES", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(v);
const pct = (v: number | null) =>
  v === null ? "—" : `${v > 0 ? "+" : ""}${number(v)}%`;
const date = (v: string) =>
  new Date(v.length === 10 ? v + "T12:00:00Z" : v).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const stamp = (v: string) =>
  new Date(v).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const stale = (q: Quote) => Date.now() - Date.parse(q.asOf) > 4 * 86400000;
function Change({ value }: { value: number | null }) {
  return (
    <span
      className={value === null ? "fl-muted" : value >= 0 ? "fl-up" : "fl-down"}
    >
      {value !== null &&
        (value >= 0 ? (
          <ArrowUpRight size={13} />
        ) : (
          <ArrowDownRight size={13} />
        ))}
      {pct(value)}
    </span>
  );
}
function Chart({ quote, large = false }: { quote: Quote; large?: boolean }) {
  const values = quote.history.slice(large ? -253 : -50).map((p) => p.close);
  if (values.length < 2) return <span>Sin histórico</span>;
  const low = Math.min(...values),
    high = Math.max(...values),
    range = high - low || 1;
  const h = large ? 220 : 45,
    w = large ? 700 : 150;
  const line = values
    .map(
      (v, i) =>
        `${(i * w) / (values.length - 1)},${h - 8 - ((v - low) / range) * (h - 16)}`,
    )
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={large ? "fl-chart-large" : "fl-spark"}
      role="img"
      aria-label={`Evolución del precio de ${quote.name}, ${large ? "un año" : "50 sesiones"}`}
    >
      <polyline
        points={line}
        fill="none"
        stroke={
          values.at(-1)! >= values[0]
            ? "var(--fl-chart-up)"
            : "var(--fl-chart-down)"
        }
        strokeWidth={large ? 2.6 : 1.8}
        vectorEffect="non-scaling-stroke"
      />
      {large &&
        [0, 0.5, 1].map((n) => (
          <line
            key={n}
            x1="0"
            x2={w}
            y1={8 + n * (h - 16)}
            y2={8 + n * (h - 16)}
            stroke="var(--fl-line)"
            strokeDasharray="3 5"
          />
        ))}
    </svg>
  );
}
function FeedStatus({ feed }: { feed: Feed<unknown> }) {
  return (
    <div className={`fl-feed-status ${feed.error ? "fl-warning" : ""}`}>
      <span className="fl-dot" />
      {feed.error ??
        `${feed.items.length} registros · consultado ${stamp(feed.fetchedAt)}`}
    </div>
  );
}
function Trades({ trades, limit = 40 }: { trades: Trade[]; limit?: number }) {
  return (
    <div className="fl-table-wrap">
      <table className="fl-table">
        <thead>
          <tr>
            <th>Declarante / titular</th>
            <th>Activo</th>
            <th>Movimiento</th>
            <th>Importe declarado</th>
            <th>Operación → publicación</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          {trades.slice(0, limit).map((t) => (
            <tr key={t.id}>
              <td>
                <strong>{t.person}</strong>
                <small>{t.owner}</small>
              </td>
              <td>
                <strong>{t.symbol ?? "Sin ticker"}</strong>
                <small title={t.asset}>{t.asset}</small>
              </td>
              <td>
                <span
                  className={`fl-pill ${t.type === "Compra" ? "green" : "gray"}`}
                >
                  {t.type}
                </span>
                {t.asset.includes("[OP]") && <small>Opciones</small>}
              </td>
              <td className="fl-mono">{t.amount}</td>
              <td>
                {t.traded ? date(t.traded) : "No indicada"}
                <small>
                  Publicación: {t.reported ? date(t.reported) : "No indicada"} ·{" "}
                  {lagDays(t.traded, t.reported) ?? "—"} días después
                </small>
              </td>
              <td>
                <a
                  href={t.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t.note}
                >
                  Ver original <External size={13} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!trades.length && (
        <div className="fl-empty">
          No hay operaciones disponibles con este filtro.
        </div>
      )}
    </div>
  );
}
export default function FinanceApp() {
  const theme = useFinanceTheme();
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [data, setData] = useState<Dashboard | null>(null),
    [workspace, setWorkspace] = useState<Workspace | null>(null),
    [tab, setTab] = useState<Tab>("Radar");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signing, setSigning] = useState(false);
  const [search, setSearch] = useState(""),
    [region, setRegion] = useState("Todos"),
    [sort, setSort] = useState("quarter"),
    [onlyWatch, setOnlyWatch] = useState(false),
    [selected, setSelected] = useState<Quote | null>(null);
  const [politician, setPolitician] = useState("Pelosi"),
    [politicView, setPoliticView] = useState<"house" | "trump" | "policy">(
      "house",
    ),
    [filing, setFiling] = useState<Filing | null>(null),
    [trades, setTrades] = useState<Feed<Trade> | null>(null),
    [reading, setReading] = useState(false);
  const [ideaOpen, setIdeaOpen] = useState(false),
    [ideaSymbol, setIdeaSymbol] = useState("MSFT"),
    [thesis, setThesis] = useState(""),
    [risk, setRisk] = useState(""),
    [horizon, setHorizon] = useState("6 meses"),
    [saving, setSaving] = useState(false);
  const activeUser = useRef<string | null>(null);
  const activeSession = useRef<string | null>(null),
    requestId = useRef(0),
    filingId = useRef(0),
    watchBusy = useRef(false);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const sb = createClient();
    const reset = (next: Session | null) => {
      if (!alive) return;
      const changed = activeUser.current !== (next?.user.id ?? null);
      activeUser.current = next?.user.id ?? null;
      activeSession.current = next?.access_token ?? null;
      setSession(next);
      setReady(true);
      if (!next || changed) {
        setIdeaOpen(false);
        requestId.current++;
        filingId.current++;
        setData(null);
        setWorkspace(null);
        setSelected(null);
        setTrades(null);
        setFiling(null);
        setLoading(false);
      }
    };
    sb.auth
      .getSession()
      .then(({ data, error }) => {
        if (error && alive) setError("No se pudo recuperar la sesión.");
        reset(data.session);
      })
      .catch(() => {
        if (alive) {
          setReady(true);
          setError("No se pudo recuperar la sesión.");
        }
      });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, next) => reset(next));
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [configured]);
  const api = useCallback(async (path: string, init?: RequestInit) => {
    const token = activeSession.current;
    if (!token) throw new Error("Inicia sesión para continuar.");
    const r = await fetch(`/api/finanzas/${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(65000),
    });
    const body = await r.json();
    if (!r.ok)
      throw new Error(body.error ?? "No se pudo completar la consulta.");
    if (activeSession.current !== token)
      throw new Error("La sesión ha cambiado.");
    return body;
  }, []);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const w: Workspace = await api("workspace");
      if (id !== requestId.current) return;
      setWorkspace(w);
      const d: Dashboard = await api("dashboard");
      if (id === requestId.current) setData(d);
    } catch (e) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : "No se pudo actualizar.");
        setData(null);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [api]);
  const sessionToken = session?.access_token;
  useEffect(() => {
    if (!sessionToken) return;
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(
      () => {
        if (document.visibilityState === "visible") void refresh();
      },
      15 * 60 * 1000,
    );
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [sessionToken, refresh]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setSigning(true);
    setError("");
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw new Error("Correo o contraseña incorrectos.");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setSigning(false);
    }
  }
  async function toggle(symbol: string) {
    if (!workspace || watchBusy.current) return;
    watchBusy.current = true;
    setNotice("");
    const next = workspace.watchlist.includes(symbol)
      ? workspace.watchlist.filter((s) => s !== symbol)
      : [...workspace.watchlist, symbol];
    try {
      await api("workspace", {
        method: "PATCH",
        body: JSON.stringify({ watchlist: next }),
      });
      setWorkspace((w) => (w ? { ...w, watchlist: next } : w));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      watchBusy.current = false;
    }
  }
  async function readFiling(f: Filing) {
    const id = ++filingId.current;
    setFiling(f);
    setTrades(null);
    setReading(true);
    try {
      const result = await api(`filing?id=${encodeURIComponent(f.id)}`);
      if (id === filingId.current) setTrades(result);
    } catch (e) {
      if (id === filingId.current) setError((e as Error).message);
    } finally {
      if (id === filingId.current) setReading(false);
    }
  }
  async function saveIdea(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api("ideas", {
        method: "POST",
        body: JSON.stringify({ symbol: ideaSymbol, thesis, risk, horizon }),
      });
      setWorkspace((w) => (w ? { ...w, ideas: result.ideas } : w));
      setIdeaOpen(false);
      setThesis("");
      setRisk("");
      setNotice(
        "Idea guardada con el precio indicativo actual. No se ha realizado ninguna operación.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function closeIdea(idea: Idea) {
    setSaving(true);
    try {
      const result = await api("ideas", {
        method: "POST",
        body: JSON.stringify({ action: "close", id: idea.id }),
      });
      setWorkspace((w) => (w ? { ...w, ideas: result.ideas } : w));
      setNotice("Simulación cerrada. No se ha realizado ninguna operación.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const market = data?.market.items ?? [];
  const companies = market.filter((q) => q.region !== "Índice");
  const shown = companies
    .filter(
      (q) =>
        (region === "Todos" || q.region === region) &&
        (!onlyWatch || workspace?.watchlist.includes(q.symbol)) &&
        `${q.name} ${q.symbol} ${q.sector}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (b[sort as "quarter" | "change" | "month"] ?? -Infinity) -
          (a[sort as "quarter" | "change" | "month"] ?? -Infinity),
    );
  const signals = companies
    .filter(
      (q) =>
        !stale(q) &&
        q.ma200 !== null &&
        q.price > q.ma200 &&
        (q.quarter ?? 0) > 0,
    )
    .sort((a, b) => (b.quarter ?? 0) - (a.quarter ?? 0));
  const movers = [...companies]
    .filter((q) => !stale(q))
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 5);
  const filings = (data?.filings.items ?? []).filter((f) =>
    f.name.toLowerCase().includes(politician.toLowerCase()),
  );
  const go = (next: Tab) => {
    setTab(next);
    setNotice("");
  };
  useEffect(() => {
    if (!selected && !ideaOpen) return;
    const modal = document.querySelector<HTMLElement>(".fl-modal");
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href],input,select,textarea",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setIdeaOpen(false);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [selected, ideaOpen]);
  if (!ready)
    return (
      <div className="finance-shell fl-center" data-theme={theme}>
        <div className="fl-loader" />
        <p>Comprobando tu sesión…</p>
      </div>
    );
  if (!session)
    return (
      <div className="finance-shell fl-login" data-theme={theme}>
        <section className="fl-login-story">
          <a href="/apps" className="fl-brand">
            <ChartNoAxesCombined /> Finance<span>Lab</span>
          </a>
          <div className="fl-kicker">TU OBSERVATORIO DE INVERSIÓN</div>
          <h1>
            Menos ruido.
            <br />
            <em>Más perspectiva.</em>
          </h1>
          <p>
            Mercados, capital y decisiones políticas. Un lugar privado para
            investigar tus próximas inversiones con datos y contexto.
          </p>
          <div className="fl-login-features">
            <span>
              <Globe2 /> EE. UU. + Europa
            </span>
            <span>
              <Landmark /> Radar político
            </span>
            <span>
              <BookOpen /> Tu diario de ideas
            </span>
          </div>
          <div className="fl-orbit" aria-hidden="true">
            <div />
            <div />
            <div />
            <Activity size={80} />
          </div>
          <small>
            Horizonte de meses a años · Sin ejecución de operaciones
          </small>
        </section>
        <section className="fl-login-form">
          <div className="fl-login-tools">
            <ThemeControl theme={theme} />
          </div>
          <div className="fl-lock">
            <LockKeyhole />
          </div>
          <div className="fl-kicker">ACCESO PERSONAL</div>
          <h2>Bienvenido a FinanceLab</h2>
          <p>
            Utiliza tu cuenta de TravelKit y Viajes. Este espacio está reservado
            a su propietario.
          </p>
          {configured ? (
            <form onSubmit={login}>
              <label>
                Correo electrónico
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button className="fl-primary" disabled={signing}>
                {signing ? "Verificando…" : "Entrar en mi espacio"}{" "}
                <ChevronRight size={16} />
              </button>
            </form>
          ) : (
            <div className="fl-error">
              El acceso aún necesita configuración.
            </div>
          )}
          {error && (
            <div role="alert" className="fl-error">
              {error}
            </div>
          )}
          <Link className="fl-quiet" href="/apps/viajes">
            Gestionar mi acceso en Viajes <External size={14} />
          </Link>
          <div className="fl-login-note">
            <ShieldCheck size={17} /> Sesión individual y datos protegidos en el
            servidor.
          </div>
        </section>
      </div>
    );
  return (
    <div className="finance-shell fl-app" data-theme={theme}>
      <aside className="fl-sidebar">
        <a href="/apps" className="fl-brand">
          <ChartNoAxesCombined /> Finance<span>Lab</span>
          <small>PERSONAL INTELLIGENCE</small>
        </a>
        <div className="fl-nav-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Secciones de Finanzas">
          {tabs.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => go(name)}
              className={tab === name ? "active" : ""}
            >
              <Icon size={18} />
              {name}
              {tab === name && <span />}
            </button>
          ))}
        </nav>
        <div className="fl-side-card">
          <div className="fl-kicker">EL VALOR DEL CONTEXTO</div>
          <p>Una operación publicada hoy pudo realizarse hace semanas.</p>
          <button onClick={() => go("Fuentes")}>
            Cómo leer las señales <ChevronRight size={14} />
          </button>
        </div>
        <div className="fl-account">
          <div className="fl-avatar">RR</div>
          <div>
            <strong>Mi espacio privado</strong>
            <small>
              <LockKeyhole size={10} /> Acceso exclusivo
            </small>
          </div>
        </div>
      </aside>
      <div className="fl-main">
        <header className="fl-topbar">
          <div>
            <span className="fl-breadcrumb">
              FinanceLab <ChevronRight size={12} /> {tab}
            </span>
            <span className="fl-private">
              <LockKeyhole size={12} /> Privado
            </span>
          </div>
          <div>
            <ThemeControl theme={theme} />
            <span className="fl-today">{date(new Date().toISOString())}</span>
            <button
              className="fl-icon-button"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Actualizar datos"
            >
              <RefreshCw size={17} className={loading ? "fl-spin" : ""} />
            </button>
            <button
              className="fl-icon-button"
              aria-label="Cerrar sesión"
              onClick={() =>
                void createClient().auth.signOut({ scope: "local" })
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <div className="fl-content">
          <div className="fl-heading">
            <div>
              <div className="fl-kicker">
                {tab === "Políticos"
                  ? "CAPITAL Y PODER"
                  : tab === "Mi diario"
                    ? "INVESTIGAR. REGISTRAR. APRENDER."
                    : "UNA VISIÓN CON PERSPECTIVA"}
              </div>
              <h1>
                {tab === "Radar"
                  ? "Tu radar de inversión."
                  : tab === "Mercados"
                    ? "El pulso del mercado."
                    : tab === "Políticos"
                      ? "Sigue las declaraciones."
                      : tab === "Mi diario"
                        ? "Ideas con memoria."
                        : "De dónde vienen los datos."}
              </h1>
              <p>
                {tab === "Radar"
                  ? "Lo que se mueve, lo que merece atención y lo que conviene verificar."
                  : tab === "Políticos"
                    ? "Operaciones declaradas y decisiones públicas, con sus fechas y sus límites."
                    : tab === "Mi diario"
                      ? "Escribe la tesis antes del resultado. Comprueba qué ha funcionado."
                      : tab === "Fuentes"
                        ? "Cobertura, frescura y metodología. Sin cifras de rentabilidad inventadas."
                        : "Empresas de EE. UU. y Europa para un horizonte de meses a años."}
              </p>
            </div>
            {workspace && (
              <button
                className="fl-primary"
                onClick={() => {
                  setIdeaOpen(true);
                  go("Mi diario");
                }}
              >
                <Plus size={16} /> Registrar idea
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="fl-error">
              {error}
              <button onClick={() => setError("")} aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="fl-success">
              <Check size={16} />
              {notice}
            </div>
          )}
          {loading && !data && (
            <div className="fl-loading">
              <div className="fl-loader" />
              <h3>Consultando tus fuentes</h3>
              <p>
                Mercados, declaraciones y actualidad. La primera carga puede
                tardar unos segundos.
              </p>
            </div>
          )}
          {!workspace && !loading && (
            <div className="fl-empty">
              El servidor debe verificar el acceso de tu cuenta para abrir el
              panel.
            </div>
          )}
          {data && workspace && (
            <>
              {(tab === "Radar" || tab === "Mercados") && (
                <div className="fl-index-grid">
                  {market
                    .filter((q) => q.region === "Índice")
                    .map((q) => (
                      <button
                        className="fl-index"
                        key={q.symbol}
                        onClick={() => setSelected(q)}
                      >
                        <div>
                          <span>{q.name}</span>
                          <span className="fl-market-dot" />
                        </div>
                        <strong>{number(q.price)}</strong>
                        <div>
                          <Change value={q.change} />
                          <small>{stamp(q.asOf)}</small>
                        </div>
                        <Chart quote={q} />
                      </button>
                    ))}
                </div>
              )}
              {tab === "Radar" && (
                <>
                  <div className="fl-radar-grid">
                    <section className="fl-panel">
                      <div className="fl-section-title">
                        <div>
                          <div className="fl-kicker">PARA INVESTIGAR</div>
                          <h2>
                            Tendencias a seguir <span>{signals.length}</span>
                          </h2>
                        </div>
                        <button
                          className="fl-text-button"
                          onClick={() => go("Mercados")}
                        >
                          Ver mercado <External size={15} />
                        </button>
                      </div>
                      <p className="fl-section-note">
                        Precio sobre su media de 200 sesiones y evolución
                        positiva en 3 meses. Filtro descriptivo, sin
                        rentabilidad predictiva.
                      </p>
                      <div className="fl-signal-list">
                        {signals.slice(0, 5).map((q, i) => (
                          <button
                            key={q.symbol}
                            onClick={() => setSelected(q)}
                            className="fl-signal"
                          >
                            <span className="fl-rank">0{i + 1}</span>
                            <span className="fl-symbol-icon">
                              {q.symbol.slice(0, 2)}
                            </span>
                            <div>
                              <strong>{q.name}</strong>
                              <small>
                                {q.symbol} · {q.sector}
                              </small>
                            </div>
                            <Chart quote={q} />
                            <div className="fl-align-right">
                              <Change value={q.quarter} />
                              <small>63 sesiones</small>
                            </div>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                        {!signals.length && (
                          <div className="fl-empty">
                            Ningún activo con datos disponibles cumple el
                            filtro.
                          </div>
                        )}
                      </div>
                      <FeedStatus feed={data.market} />
                    </section>
                    <section className="fl-panel fl-political-card">
                      <div className="fl-kicker">RADAR POLÍTICO</div>
                      <Landmark size={31} />
                      <h2>
                        Lo publicado.
                        <br />
                        No lo supuesto.
                      </h2>
                      <p>
                        Consulta qué se declaró, quién figura como titular y
                        cuánto tiempo pasó desde la operación.
                      </p>
                      <div className="fl-political-links">
                        <button
                          onClick={() => {
                            go("Políticos");
                            setPoliticView("house");
                            setPolitician("Pelosi");
                          }}
                        >
                          <span>
                            Nancy Pelosi<small>Declaraciones oficiales</small>
                          </span>
                          <External size={18} />
                        </button>
                        <button
                          onClick={() => {
                            go("Políticos");
                            setPoliticView("trump");
                          }}
                        >
                          <span>
                            Donald Trump
                            <small>Operaciones declaradas · Quiver</small>
                          </span>
                          <External size={18} />
                        </button>
                      </div>
                      <div className="fl-lag">
                        <Clock3 size={15} /> Comprueba siempre el retraso de
                        publicación.
                      </div>
                    </section>
                  </div>
                  <div className="fl-radar-grid bottom">
                    <section className="fl-panel">
                      <div className="fl-section-title">
                        <h2>Movimientos destacados</h2>
                        <span className="fl-pill gray">
                          Última sesión disponible
                        </span>
                      </div>
                      {movers.map((q) => (
                        <button
                          className="fl-mover"
                          key={q.symbol}
                          onClick={() => setSelected(q)}
                        >
                          <div>
                            <strong>{q.name}</strong>
                            <small>
                              {q.region} · {q.symbol}
                            </small>
                          </div>
                          <span>
                            {number(q.price)} <small>{q.currency}</small>
                          </span>
                          <Change value={q.change} />
                        </button>
                      ))}
                    </section>
                    <section className="fl-panel">
                      <div className="fl-section-title">
                        <h2>En el contexto de hoy</h2>
                        <Globe2 size={19} />
                      </div>
                      {data.news.items.slice(0, 4).map((n) => (
                        <a
                          className="fl-news"
                          key={n.url}
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <small>
                            {n.source} · {date(n.date)}
                          </small>
                          <strong>
                            {n.title}
                            <External size={13} />
                          </strong>
                        </a>
                      ))}
                      <FeedStatus feed={data.news} />
                    </section>
                  </div>
                </>
              )}
              {tab === "Mercados" && (
                <section className="fl-panel">
                  <div className="fl-filters">
                    <label className="fl-search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar empresa, ticker o sector"
                        placeholder="Empresa, ticker o sector"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <div className="fl-segments">
                      {["Todos", "EE. UU.", "Europa"].map((r) => (
                        <button
                          key={r}
                          onClick={() => setRegion(r)}
                          className={region === r ? "active" : ""}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <button
                      className={`fl-secondary ${onlyWatch ? "selected" : ""}`}
                      onClick={() => setOnlyWatch(!onlyWatch)}
                    >
                      <Star size={15} /> Mi lista
                    </button>
                    <select
                      aria-label="Ordenar mercado"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="quarter">Evolución 3 meses</option>
                      <option value="change">Última sesión</option>
                      <option value="month">Evolución 1 mes</option>
                      <option value="name">Nombre</option>
                    </select>
                  </div>
                  <div className="fl-table-wrap">
                    <table className="fl-table fl-market-table">
                      <thead>
                        <tr>
                          <th>Seguir</th>
                          <th>Empresa</th>
                          <th>Precio</th>
                          <th>Sesión</th>
                          <th>1 mes</th>
                          <th>3 meses</th>
                          <th>1 año</th>
                          <th>Evolución</th>
                          <th>Último precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((q) => (
                          <tr key={q.symbol}>
                            <td>
                              <button
                                aria-label={`${workspace.watchlist.includes(q.symbol) ? "Dejar de seguir" : "Seguir"} ${q.name}`}
                                className="fl-star"
                                onClick={() => void toggle(q.symbol)}
                              >
                                <Star
                                  size={16}
                                  fill={
                                    workspace.watchlist.includes(q.symbol)
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                            </td>
                            <td>
                              <button
                                className="fl-company"
                                onClick={() => setSelected(q)}
                              >
                                <strong>{q.name}</strong>
                                <small>
                                  {q.symbol} · {q.sector}
                                </small>
                              </button>
                            </td>
                            <td>
                              {number(q.price)}
                              <small>{q.currency}</small>
                            </td>
                            <td>
                              <Change value={q.change} />
                            </td>
                            <td>
                              <Change value={q.month} />
                            </td>
                            <td>
                              <Change value={q.quarter} />
                            </td>
                            <td>
                              <Change value={q.year} />
                            </td>
                            <td>
                              <Chart quote={q} />
                            </td>
                            <td>
                              <small>
                                {stamp(q.asOf)}
                                {stale(q) && " · Antiguo"}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!shown.length && (
                      <div className="fl-empty">
                        No hay empresas con estos filtros.
                      </div>
                    )}
                  </div>
                  <FeedStatus feed={data.market} />
                  <p className="fl-section-note">
                    1 mes = 21 sesiones; 3 meses = 63; 1 año = 252. Variación
                    del precio, sin dividendos ni conversión a euros. La vela
                    diaria puede estar en curso.
                  </p>
                </section>
              )}
              {tab === "Políticos" && (
                <>
                  <div className="fl-policy-intro">
                    <ShieldCheck size={19} />
                    <p>
                      <strong>
                        La fecha que importa es cuándo se hizo público.
                      </strong>{" "}
                      Estas declaraciones pueden llegar semanas después. Los
                      rangos no son importes exactos, y una operación familiar o
                      gestionada por terceros no prueba una decisión personal
                      del político.
                    </p>
                  </div>
                  <div className="fl-segments fl-politics-tabs">
                    <button
                      className={politicView === "house" ? "active" : ""}
                      onClick={() => setPoliticView("house")}
                    >
                      Congreso · Cámara
                    </button>
                    <button
                      className={politicView === "trump" ? "active" : ""}
                      onClick={() => setPoliticView("trump")}
                    >
                      Trump · Operaciones
                    </button>
                    <button
                      className={politicView === "policy" ? "active" : ""}
                      onClick={() => setPoliticView("policy")}
                    >
                      Decisiones políticas
                    </button>
                  </div>
                  {politicView === "house" && (
                    <>
                      <section className="fl-panel">
                        <div className="fl-section-title">
                          <h2>Declaraciones oficiales</h2>
                          <label className="fl-search">
                            <Search size={16} />
                            <input
                              aria-label="Buscar declarante"
                              placeholder="Nombre del declarante"
                              value={politician}
                              onChange={(e) => setPolitician(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="fl-chips">
                          {[
                            "Pelosi",
                            "Khanna",
                            "Gottheimer",
                            "McCaul",
                            "Greene",
                            "",
                          ].map((n) => (
                            <button
                              key={n}
                              onClick={() => setPolitician(n)}
                              className={politician === n ? "active" : ""}
                            >
                              {n || "Todos"}
                            </button>
                          ))}
                        </div>
                        <FeedStatus feed={data.filings} />
                        <p className="fl-section-note">
                          {data.filings.coverage} Se muestran hasta 50
                          declaraciones por filtro, ordenadas por fecha de
                          presentación.
                        </p>
                        <div className="fl-filing-list">
                          {filings.slice(0, 50).map((f) => (
                            <div className="fl-filing" key={f.id}>
                              <div className="fl-document">
                                <Landmark size={18} />
                              </div>
                              <div>
                                <strong>{f.name}</strong>
                                <small>
                                  Presentada {date(f.filed)} · {f.district} · #
                                  {f.id}
                                </small>
                              </div>
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                PDF <External size={14} />
                              </a>
                              <button
                                className="fl-secondary"
                                onClick={() => void readFiling(f)}
                              >
                                Leer operaciones <ChevronRight size={14} />
                              </button>
                            </div>
                          ))}
                          {!filings.length && (
                            <div className="fl-empty">
                              Sin declaraciones disponibles para este filtro.
                            </div>
                          )}
                        </div>
                      </section>
                      {filing && (
                        <section className="fl-panel fl-space-top">
                          <div className="fl-section-title">
                            <h2>
                              {filing.name} · {date(filing.filed)}
                            </h2>
                            <a
                              href={filing.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF completo <External size={14} />
                            </a>
                          </div>
                          <p className="fl-section-note">
                            Lectura automática parcial. Las filas con un formato
                            no reconocido se omiten; las opciones pueden tener
                            condiciones que solo aparecen en el PDF. No sumamos
                            declaraciones que podrían ser rectificaciones.
                          </p>
                          {reading ? (
                            <div className="fl-empty">
                              Leyendo el documento oficial…
                            </div>
                          ) : (
                            trades && (
                              <>
                                <FeedStatus feed={trades} />
                                <Trades trades={trades.items} limit={200} />
                              </>
                            )
                          )}
                        </section>
                      )}
                    </>
                  )}
                  {politicView === "trump" && (
                    <section className="fl-panel">
                      <div className="fl-section-title">
                        <h2>Donald Trump · operaciones declaradas</h2>
                        <a
                          href="https://www.quiverquant.com/Donald-Trump-Stock-Trades/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Fuente <External size={14} />
                        </a>
                      </div>
                      <p className="fl-section-note">
                        {data.trump.coverage} Se muestran hasta 100 registros
                        por fecha de publicación. La fuente no desglosa aquí
                        quién gestionó cada inversión.
                      </p>
                      <FeedStatus feed={data.trump} />
                      <Trades trades={data.trump.items} limit={100} />
                    </section>
                  )}
                  {politicView === "policy" && (
                    <section className="fl-panel">
                      <div className="fl-section-title">
                        <h2>Órdenes ejecutivas · Federal Register</h2>
                        <span className="fl-pill gray">Fuente oficial</span>
                      </div>
                      <p className="fl-section-note">
                        Decisiones públicas, separadas de las compras y ventas
                        personales. Las etiquetas señalan temas mencionados en
                        el título; no predicen el efecto en una acción.
                      </p>
                      <FeedStatus feed={data.policy} />
                      {data.policy.items.map((p) => (
                        <a
                          className="fl-policy"
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span className="fl-policy-date">{date(p.date)}</span>
                          <div>
                            <strong>{p.title}</strong>
                            <div className="fl-chips">
                              {p.sectors.map((s) => (
                                <span className="fl-pill gray" key={s}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                          <External size={17} />
                        </a>
                      ))}
                    </section>
                  )}
                </>
              )}
              {tab === "Mi diario" && (
                <>
                  <div className="fl-policy-intro">
                    <BookOpen size={20} />
                    <p>
                      <strong>
                        Una simulación para poner a prueba tus ideas.
                      </strong>{" "}
                      Registramos la fecha y el precio indicativo disponible al
                      guardar. La variación de precio excluye comisiones,
                      dividendos, impuestos, cambio de divisa y ajustes
                      posteriores por splits. No representa una operación real.
                    </p>
                  </div>
                  <div className="fl-ideas">
                    {workspace.ideas.map((idea) => {
                      const q = market.find((q) => q.symbol === idea.symbol),
                        current =
                          idea.status === "Cerrada" ? idea.exit : q?.price;
                      return (
                        <article className="fl-panel fl-idea" key={idea.id}>
                          <div className="fl-section-title">
                            <h2>{idea.symbol}</h2>
                            <span
                              className={`fl-pill ${idea.status === "Abierta" ? "green" : "gray"}`}
                            >
                              {idea.status}
                            </span>
                          </div>
                          <small>
                            {date(idea.createdAt)} · Horizonte {idea.horizon}
                          </small>
                          <h3>La tesis</h3>
                          <p>{idea.thesis}</p>
                          <h3>Qué podría salir mal</h3>
                          <p>{idea.risk}</p>
                          <div className="fl-idea-prices">
                            <div>
                              <small>Precio de referencia</small>
                              <strong>
                                {number(idea.entry)} {idea.currency}
                              </strong>
                              {idea.entryAsOf && (
                                <small>{stamp(idea.entryAsOf)}</small>
                              )}
                            </div>
                            <div>
                              <small>
                                {idea.status === "Cerrada"
                                  ? "Variación al cerrar"
                                  : "Variación indicativa"}
                              </small>
                              <strong>
                                <Change
                                  value={
                                    current
                                      ? percent(current, idea.entry)
                                      : null
                                  }
                                />
                              </strong>
                            </div>
                          </div>
                          {q && idea.status === "Abierta" && (
                            <small>
                              Último precio: {stamp(q.asOf)}
                              {stale(q) ? " · Antiguo" : ""}
                            </small>
                          )}
                          {idea.status === "Abierta" && (
                            <button
                              className="fl-secondary"
                              disabled={saving}
                              onClick={() => void closeIdea(idea)}
                            >
                              Cerrar simulación
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {!workspace.ideas.length && (
                      <section className="fl-panel fl-empty">
                        <BookOpen size={38} />
                        <h2>Tu próxima idea empieza aquí.</h2>
                        <p>
                          ¿Por qué te interesa una empresa? ¿Qué tendría que
                          ocurrir para cambiar de opinión?
                        </p>
                        <button
                          className="fl-primary"
                          onClick={() => setIdeaOpen(true)}
                        >
                          <Plus size={16} /> Registrar mi primera idea
                        </button>
                      </section>
                    )}
                  </div>
                </>
              )}
              {tab === "Fuentes" && (
                <>
                  <section className="fl-panel">
                    <div className="fl-section-title">
                      <h2>Estado de las conexiones</h2>
                      <span className="fl-pill green">Sin suscripciones</span>
                    </div>
                    {[
                      data.market,
                      data.filings,
                      data.trump,
                      data.policy,
                      data.news,
                    ].map((f) => (
                      <div className="fl-source" key={f.source}>
                        <div>
                          <h3>{f.source}</h3>
                          <p>{f.coverage}</p>
                        </div>
                        <FeedStatus feed={f} />
                      </div>
                    ))}
                  </section>
                  <div className="fl-method-grid">
                    <section className="fl-panel">
                      <h2>Qué hace el radar</h2>
                      <p>
                        Destaca empresas de un universo fijo con precio sobre la
                        media de 200 sesiones y cambio positivo en 63 sesiones.
                        Ordena por ese cambio. No incorpora valoración, balances
                        ni una prueba histórica de rentabilidad.
                      </p>
                      <p>
                        Las cotizaciones de Yahoo se consultan como máximo cada
                        15 minutos por activo; las declaraciones, operaciones de
                        Trump y órdenes, cada 6 horas; las noticias, cada hora.
                        Se actualiza al abrir y cada 15 minutos mientras el
                        panel está visible.
                      </p>
                      <p>
                        Yahoo y la página pública de Quiver son conectores sin
                        garantía de continuidad. Si fallan, se muestra la
                        incidencia. Nunca se generan cotizaciones o movimientos
                        ficticios.
                      </p>
                    </section>
                    <section className="fl-panel">
                      <h2>Antes de tomar una decisión</h2>
                      <ol>
                        <li>
                          Abre la fuente y comprueba operación, publicación y
                          titular.
                        </li>
                        <li>
                          Revisa cuánto se ha movido el precio desde entonces.
                        </li>
                        <li>
                          Contrasta valoración, resultados y riesgos de la
                          empresa.
                        </li>
                        <li>
                          Registra la tesis y el motivo que la invalidaría.
                        </li>
                      </ol>
                      <p>
                        No existe una rentabilidad garantizada. Las operaciones
                        de un político no demuestran información privilegiada ni
                        que seguirlas sea rentable.
                      </p>
                      <a
                        href="https://ethics.house.gov/periodic-transaction-report-calculator/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Plazos de declaración de la Cámara{" "}
                        <External size={13} />
                      </a>
                    </section>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="fl-footer">
            <span>
              <ShieldCheck size={13} /> FinanceLab · Solo tú
            </span>
            <span>Datos para investigar. Las decisiones son tuyas.</span>
          </footer>
        </div>
      </div>
      {selected && (
        <div className="fl-modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="fl-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle de ${selected.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="fl-close"
              onClick={() => setSelected(null)}
              aria-label="Cerrar detalle"
            >
              <X />
            </button>
            <div className="fl-kicker">
              {selected.region} · {selected.sector}
            </div>
            <h2>{selected.name}</h2>
            <p>
              {selected.symbol} · {stamp(selected.asOf)}
              {stale(selected) ? " · Dato antiguo" : ""}
            </p>
            <div className="fl-detail-price">
              {number(selected.price)} <small>{selected.currency}</small>
              <Change value={selected.change} />
            </div>
            <Chart quote={selected} large />
            <div className="fl-chart-labels">
              <span>{date(selected.history[0].date)}</span>
              <span>{date(selected.history.at(-1)!.date)}</span>
            </div>
            <div className="fl-detail-stats">
              <div>
                <small>3 meses</small>
                <strong>
                  <Change value={selected.quarter} />
                </strong>
              </div>
              <div>
                <small>Media 200 sesiones</small>
                <strong>{number(selected.ma200)}</strong>
              </div>
              <div>
                <small>Desde máximo 252 sesiones</small>
                <strong>{pct(selected.drawdown)}</strong>
              </div>
              <div>
                <small>Volumen / media 20 sesiones</small>
                <strong>{number(selected.volumeRatio)}×</strong>
              </div>
            </div>
            <p className="fl-section-note">
              Serie de precios diarios. La última vela puede estar en curso; el
              volumen parcial no es comparable a una sesión cerrada. Contrasta
              precios y ajustes corporativos antes de operar.
            </p>
            <div className="fl-modal-actions">
              <a
                className="fl-secondary"
                href={selected.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar fuente <External size={15} />
              </a>
              {selected.region !== "Índice" && (
                <button
                  className="fl-primary"
                  onClick={() => {
                    setIdeaSymbol(selected.symbol);
                    setSelected(null);
                    setTab("Mi diario");
                    setIdeaOpen(true);
                  }}
                >
                  <Plus size={15} /> Registrar idea
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {ideaOpen && (
        <div className="fl-modal-backdrop">
          <section
            className="fl-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Registrar idea"
          >
            <button
              className="fl-close"
              onClick={() => setIdeaOpen(false)}
              aria-label="Cerrar formulario"
            >
              <X />
            </button>
            <div className="fl-kicker">MI DIARIO DE INVERSIÓN</div>
            <h2>Una tesis, antes del resultado.</h2>
            {error && (
              <div role="alert" className="fl-error">
                {error}
              </div>
            )}
            <form onSubmit={saveIdea}>
              <div className="fl-form-grid">
                <label>
                  Empresa
                  <select
                    value={ideaSymbol}
                    onChange={(e) => setIdeaSymbol(e.target.value)}
                  >
                    {universe
                      .filter((q) => q.region !== "Índice")
                      .map((q) => (
                        <option key={q.symbol} value={q.symbol}>
                          {q.name} · {q.symbol}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Horizonte
                  <select
                    value={horizon}
                    onChange={(e) => setHorizon(e.target.value)}
                  >
                    {["3 meses", "6 meses", "1 año", "2 años"].map((h) => (
                      <option key={h}>{h}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                ¿Por qué te interesa?
                <textarea
                  value={thesis}
                  onChange={(e) => setThesis(e.target.value)}
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="Catalizador, valoración o cambio que quieres investigar…"
                />
              </label>
              <label>
                ¿Qué invalidaría tu tesis?
                <textarea
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  required
                  placeholder="Riesgos y condiciones que te harían cambiar de opinión…"
                />
              </label>
              <p className="fl-section-note">
                Al guardar se registra el precio indicativo disponible. Es una
                simulación; no se envían órdenes al mercado.
              </p>
              <button className="fl-primary" disabled={saving}>
                {saving ? "Guardando…" : "Guardar idea"} <Check size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
