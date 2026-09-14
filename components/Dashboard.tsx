"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS, PREFERRED_LEAGUE_LABELS } from "@/lib/config/competitions";
import type { CompetitionCategory, DailyAnalysis, MarketCandidate, AnalyzedFixtureSummary } from "@/lib/engine/types";

type ComboHistoryPick = {
  fixtureId: number; fixtureLabel: string; leagueName?: string; market: string; marketLabel: string;
  odds: number; score: number; correct: boolean | null; resultHomeGoals: number | null; resultAwayGoals: number | null;
};
type ComboHistoryRow = {
  date: string; totalOdds: number; globalScore: number; globalConfidence: string; status: "ACERTADA" | "FALLIDA" | "PENDIENTE";
  correctPicks: number; failedPicks: number; pendingPicks: number; picks: ComboHistoryPick[];
};

type MajorNumberMarket = {
  metric: "cards" | "corners" | "shotsOnTarget" | "shots"; label: string;
  homeProbability: number; drawProbability: number; awayProbability: number;
  prediction: "HOME" | "DRAW" | "AWAY"; predictionLabel: string; probability: number;
  estimatedOdds: number; score: number; homeAverage: number; awayAverage: number; sampleHome: number; sampleAway: number;
  edge: number; intelligenceScore: number; reasoning: string;
  source: "API-Football"; homeTotal: number; awayTotal: number;
};
type MajorNumberFixture = {
  fixtureId: number; fixtureLabel: string; leagueName: string; kickoff: string;
  home: { id:number; name:string; logo?:string|null }; away: { id:number; name:string; logo?:string|null };
  markets: MajorNumberMarket[]; best: MajorNumberMarket | null;
};
type MajorNumberData = {
  date: string; generatedAt: string; fixtures: MajorNumberFixture[];
  combo: { picks: Array<{ fixtureId:number; fixtureLabel:string; leagueName:string; market:string; marketLabel:string; selection:string; probability:number; estimatedOdds:number; score:number; intelligenceScore:number; reasoning:string }>; totalOdds:number; globalProbability:number; score:number };
  note: string; warnings: string[];
};
type HistoryData = {
  rows: ComboHistoryRow[];
  summary: { total: number; resolved: number; correct: number; incorrect: number; pending: number; hitRate: number; averageOdds: number };
};

const AUTO_REFRESH_MS = 20 * 60 * 1000;
const categoryOrder: CompetitionCategory[] = ["champions", "europa", "conference", "national_cup", "top_league", "other"];
function pct(value: number) { return `${Math.round(value * 100)}%`; }
function confidenceLabel(score: number, probability: number) {
  if (score >= 9 && probability >= .78) return { label: "MUY ALTA", className: "very-high" };
  if (score >= 8 && probability >= .70) return { label: "ALTA", className: "high" };
  return { label: "NO ALTA", className: "candidate-label" };
}
function analyzedStatusLabel(status: AnalyzedFixtureSummary["status"]) {
  if (status === "PASA") return "PASA EL FILTRO";
  if (status === "CERCA") return "CERCA DEL CORTE";
  if (status === "SIN_CUOTA") return "CUOTA EST.";
  return "NO ENTRA";
}
function oddsText(odds?: number) { return odds === undefined ? "Sin cuota" : `@${odds.toFixed(2)} EST.`; }

function PickCard({ pick, index, kickoff }: { pick: MarketCandidate; index: number; kickoff?: string }) {
  const confidence = confidenceLabel(pick.score, pick.probability);
  return <article className="pick-card">
    <div className="pick-index">{index + 1}</div>
    <div className="pick-main">
      <div className="pick-topline">
        <div><strong>{pick.fixtureLabel}</strong>{kickoff ? <small className="kickoff-everywhere">🕒 {kickoff}</small> : null}</div>
        <span className={`confidence ${confidence.className}`}>{confidence.label}</span>
      </div>
      <div className="market">💎 {pick.marketLabel}</div>
      <div className="metrics">
        <span>💰 @{pick.odds.toFixed(2)} EST.</span>
        <span>💙 {pick.score.toFixed(1)}/10</span>
      </div>
      <p><strong>🧠 Por qué lo elegimos:</strong> {pick.reasoning}</p>
      {pick.comparisonReason ? <p className="market-alternatives"><strong>Comparación final:</strong> {pick.comparisonReason}</p> : null}
      {pick.alternatives?.length ? <p className="market-alternatives"><strong>También valoramos:</strong> {pick.alternatives.slice(0, 3).map((a) => `${a.marketLabel} (@${a.odds.toFixed(2)} EST.)`).join(" · ")}</p> : null}
      <p className="risk-note"><strong>Qué puede hacer fallar el pick:</strong> {pick.riskNote}</p>
    </div>
  </article>;
}

function AnalysisPickCard({ pick, index, kickoff }: { pick: AnalyzedFixtureSummary; index: number; kickoff?: string }) {
  const confidence = confidenceLabel(pick.score ?? 0, pick.probability);
  return <article className="pick-card">
    <div className="pick-index">{index + 1}</div>
    <div className="pick-main">
      <div className="pick-topline">
        <div><strong>{pick.fixtureLabel}</strong>{kickoff ? <small className="kickoff-everywhere">🕒 {kickoff}</small> : null}</div>
        <span className={`confidence ${confidence.className}`}>{confidence.label}</span>
      </div>
      <div className="market">💎 {pick.bestMarketLabel}</div>
      {pick.alternatives?.length ? <div className="market-alternatives"><strong>También valora:</strong> {pick.alternatives.map((a) => `${a.marketLabel} (${pct(a.probability)} · ${a.score.toFixed(1)}/10 · ${oddsText(a.odds)})`).join(" · ")}</div> : null}
      <div className="metrics"><span>🧠 {pct(pick.probability)}</span><span>💙 {(pick.score ?? 0).toFixed(1)}/10</span><span>💰 {oddsText(pick.odds)}</span></div>
      <p>{pick.explanation}</p>
    </div>
  </article>;
}

export default function Dashboard({ analysis }: { analysis: DailyAnalysis }) {
  const [category, setCategory] = useState<CompetitionCategory | "all">("all");
  const [data, setData] = useState(analysis);
  const [refreshing, setRefreshing] = useState(false);
  const [fixtureQuery, setFixtureQuery] = useState("");
  const [analyzedQuery, setAnalyzedQuery] = useState("");
  const [analyzedFilter, setAnalyzedFilter] = useState<"all" | AnalyzedFixtureSummary["status"]>("all");
  const [analyzedVisibleCount, setAnalyzedVisibleCount] = useState(12);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [majorNumber, setMajorNumber] = useState<MajorNumberData | null>(null);
  const [majorNumberLoading, setMajorNumberLoading] = useState(false);
  const [majorNumberError, setMajorNumberError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const lastRefreshAt = useRef(Date.now());

  const filteredCandidates = useMemo(() => {
    const strong = data.candidates.filter((c) => c.score >= 8 && c.probability >= .70 && c.odds >= 1.25 && c.odds <= 1.75 && (c.market !== "BTTS_YES" || c.odds >= 1.35));
    return category === "all" ? strong : strong.filter((c) => c.category === category);
  }, [category, data]);

  const visibleAnalyzed = useMemo(() => category === "all" ? data.analyzedFixtures : data.analyzedFixtures.filter((i) => i.category === category), [category, data]);
  const highlightedAnalyzed = useMemo(() => visibleAnalyzed.filter((i) => i.probability >= .70 && (i.score ?? 0) >= 8).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.probability - a.probability).slice(0, 10), [visibleAnalyzed]);
  const analyzedCounts = useMemo(() => ({
    all: visibleAnalyzed.length,
    PASA: visibleAnalyzed.filter((i) => i.status === "PASA").length,
    CERCA: visibleAnalyzed.filter((i) => i.status === "CERCA").length,
    FUERA: visibleAnalyzed.filter((i) => i.status === "FUERA" || i.status === "SIN_CUOTA").length,
  }), [visibleAnalyzed]);
  const filteredAnalyzedMenu = useMemo(() => {
    const q = analyzedQuery.trim().toLowerCase();
    return visibleAnalyzed.filter((i) => {
      const matchesStatus = analyzedFilter === "all" || (analyzedFilter === "FUERA" ? (i.status === "FUERA" || i.status === "SIN_CUOTA") : i.status === analyzedFilter);
      const matchesQuery = !q || `${i.fixtureLabel} ${i.leagueName} ${i.bestMarketLabel}`.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [visibleAnalyzed, analyzedFilter, analyzedQuery]);
  const displayedAnalyzed = useMemo(() => filteredAnalyzedMenu.slice(0, analyzedVisibleCount), [filteredAnalyzedMenu, analyzedVisibleCount]);
  const analyzedFixtureMeta = useMemo(() => new Map(data.allFixtures.map((fixture) => [fixture.fixtureId, fixture])), [data.allFixtures]);
  const kickoffByFixture = useMemo(() => new Map(data.allFixtures.map((fixture) => [fixture.fixtureId, kickoffTime(fixture.kickoff)])), [data.allFixtures]);
  const visibleTodayFixtures = useMemo(() => {
    const q = fixtureQuery.trim().toLowerCase();
    return data.allFixtures.filter((i) => (category === "all" || i.category === category) && (!q || `${i.fixtureLabel} ${i.leagueName}`.toLowerCase().includes(q)));
  }, [category, data.allFixtures, fixtureQuery]);

  function kickoffTime(value: string) {
    try { return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
    catch { return "—"; }
  }
  function fixtureState(status: string, analyzed: boolean, preferred?: boolean) {
    if (analyzed) return { label: "ANALIZADO", className: "done" };
    if (["1H", "HT", "2H", "ET", "P", "LIVE"].includes(status)) return { label: "EN JUEGO", className: "live-game" };
    if (["FT", "AET", "PEN", "PST", "CANC", "ABD"].includes(status)) return { label: status, className: "finished" };
    if (preferred === false) return { label: "NO PRIORITARIA", className: "finished" };
    return { label: "EN JORNADA", className: "queued" };
  }

  async function loadMajorNumber() {
    if (majorNumberLoading) return;
    setMajorNumberLoading(true);
    setMajorNumberError(null);
    try {
      const response = await fetch(`/api/major-number?date=${encodeURIComponent(data.date)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? `Error ${response.status}`);
      setMajorNumber(body as MajorNumberData);
    } catch (error) {
      setMajorNumberError(error instanceof Error ? error.message : "No se pudo generar Mayor Número");
    } finally {
      setMajorNumberLoading(false);
    }
  }

  async function refresh(silent = false) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (response.ok) {
        setData(await response.json());
        await loadHistory();
        lastRefreshAt.current = Date.now();
      }
    } finally {
      refreshInFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const response = await fetch("/api/history", { cache: "no-store" });
      if (!response.ok) throw new Error("history");
      setHistory(await response.json() as HistoryData);
    } catch {
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { void loadHistory(); }, [data.date]);
  useEffect(() => { setAnalyzedVisibleCount(12); }, [category, analyzedFilter, analyzedQuery, data.date]);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(true); }, AUTO_REFRESH_MS);
    const onVisibility = () => { if (document.visibilityState === "visible" && Date.now() - lastRefreshAt.current >= AUTO_REFRESH_MS) void refresh(true); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);

  return <main className="shell">
    <header className="hero hero-maestro">
      <div className="hero-brain" aria-hidden="true"><span className="brain-crown">👑</span><span className="brain-icon">🧠</span></div>
      <div className="hero-copy">
        <div className="brand">Futbolylicts<span>-AI</span></div>
        <div className="maestro-title">EL MAESTRO DEL FÚTBOL</div>
        <div className="hero-kicker">ANALIZA · CALCULA · APRENDE · GANA</div>
      </div>
      <div className="hero-side">
        <div className={`mode-badge ${data.mode}`}>{data.mode === "demo" ? "MODO DEMO" : "DATOS REALES"}</div>
        <div className="hero-slogan">EL FÚTBOL<br/>NO ES SUERTE<br/><strong>ES ANÁLISIS</strong></div>
      </div>
      <div className="hero-player" aria-hidden="true">⚽</div>
    </header>

    <section className="controls-grid betting-rules">
      <div className="rule-box"><small>🎯 OBJETIVO DEL DÍA</small><strong>Combinada entre @8 y @10 sí o sí, buscando la mejor mezcla de mercados.</strong></div>
      <div className="rule-box"><small>🔥 CONFIANZA</small><strong>Solo entran picks ALTA o MUY ALTA.</strong></div>
      <div className="rule-box"><small>🔢 NÚMERO DE PICKS</small><strong>4–6 normalmente. Hasta 8 solo si hace falta para cerrar @8–@10.</strong></div>
      <div className="rule-box"><small>💰 CUOTA POR PICK</small><strong>Priorizamos @1.25–@1.75 EST., sin forzar una selección peor solo por subir cuota.</strong></div>
      <div className="rule-box"><small>⚽ MERCADOS</small><strong>Resultado, doble oportunidad, goles, BTTS y mercados combinados compiten entre sí. Entra el mejor.</strong></div>
      <div className="rule-box"><small>🌍 TODA LA JORNADA</small><strong>Intentamos analizar todos los partidos disponibles de las competiciones permitidas y solo destacamos los que tienen valor.</strong></div>
      <div className="rule-box"><small>🔄 ÚLTIMA REVISIÓN</small><strong>Antes de cerrar la combinada volvemos a comparar cada pata y cambiamos solo si mejora.</strong></div>
      <div className="rule-box blocked"><small>🚫 MERCADOS QUE NO USAMOS</small><strong>No Under ni hándicap</strong></div>
      <div className="rule-box"><small>💾 AHORRO DE DATOS</small><strong>Guardamos análisis recientes para no repetir llamadas y aprovechar mejor la API.</strong></div>
      <div className="rule-box leagues-box"><small>🏟️ LIGAS DISPONIBLES</small><strong>{PREFERRED_LEAGUE_LABELS.join(" · ")}</strong></div>
    </section>

    <section className="category-bar">
      <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todas</button>
      {categoryOrder.map((k) => <button key={k} className={category === k ? "active" : ""} onClick={() => setCategory(k)}>{CATEGORY_LABELS[k]} <span>{data.categoryCounts[k] ?? 0}</span></button>)}
    </section>

    <nav className="dashboard-nav" aria-label="Secciones principales">
      <a href="#inicio">🏠 Inicio</a>
      <a href="#combinada">🏆 Combinada</a>
      <a href="#btts-combo">🔥 Combinada BTTS</a>
      <a href="#league-combos">⚽ Por ligas</a>
      <a href="#major-number">📈 Mayor número</a>
      <a href="#analizados">📊 Analizados <span>{data.analyzedFixturesCount}</span></a>
      <a href="#historial">📜 Historial <span>{history?.summary.total ?? 0}</span></a>
    </nav>

    <section id="inicio" className="maestro-intro-grid">
      <article className="maestro-intro-card brain-card">
        <div className="intro-icon">🧠</div>
        <div><small>INTELIGENCIA ARTIFICIAL</small><h2>Al servicio del fútbol</h2><p>Probabilidades, contexto, forma reciente y valor estadístico unidos en una sola lectura.</p></div>
      </article>
      <article className="maestro-intro-card trophy-card">
        <div className="intro-icon">🏆</div>
        <div><small>SELECCIÓN INTELIGENTE</small><h2>Combinada del Día</h2><p>El motor compara mercados y busca una cuota objetivo @8–@10 con picks de confianza alta.</p></div>
      </article>
      <article className="maestro-intro-card fire-card">
        <div className="intro-icon">🔥</div>
        <div><small>AMBOS MARCAN</small><h2>Combinada BTTS</h2><p>Solo escenarios BTTS ya analizados por el motor, sin llamadas adicionales.</p></div>
      </article>
      <article className="maestro-intro-card major-card">
        <div className="intro-icon">📈</div>
        <div><small>MAYOR NÚMERO</small><h2>Tarjetas · Córners · Remates</h2><p>Módulo paralelo con estadísticas históricas, separado del motor principal.</p></div>
      </article>
    </section>

    <section id="combinada" className={`daily-combo ${data.combo.official ? "official" : "no-official"}`}>
      <div className="section-title-row">
        <div>
          <div className="eyebrow">🏆 COMBINADA DEL DÍA</div>
          <h1>Combinada del día</h1>
          <p>{data.combo.message}</p>
          <p>Primero sobreanaliza cada partido, decide cuál es su mercado más inteligente y después compara esos mejores picks entre sí. Puede repetir BTTS, +2.5, 1X + +1.5 o cualquier otro mercado si realmente son los mejores.</p>
          <p className="combo-bookmaker-gate">Todas las cuotas son <strong>EST.</strong> y están calibradas tipo bookmaker. El motor no publica una Combinada del Día de @2–@7: busca <strong>@8–@10</strong> como objetivo duro usando únicamente picks ALTA/MUY ALTA.</p>
        </div>
        <button className="refresh" onClick={() => void refresh(false)} disabled={refreshing}>{refreshing ? "Revisando…" : "Reanalizar"}</button>
      </div>
      {data.combo.picks.length ? <div className="combo-list">{data.combo.picks.map((p, i) => <PickCard key={`${p.fixtureId}-${p.market}`} pick={p} index={i} kickoff={kickoffByFixture.get(p.fixtureId)} />)}</div> : <p className="empty combo-empty">El motor está buscando una combinación @8–@10. Primero intenta 4–6 picks y, si no existe, puede usar hasta 8 sin bajar de ALTA.</p>}
      <div className="combo-footer">
        <span>💰 Cuota total EST.: <strong>{data.combo.picks.length ? `@${data.combo.totalOdds.toFixed(2)}` : "—"}</strong></span>
        <span>💙 Nota de confianza: <strong>{data.combo.picks.length ? `${data.combo.globalScore.toFixed(1)}/10` : "—"}</strong></span>
        <span>🚦 Confianza: <strong>{data.combo.picks.length ? data.combo.globalConfidence.replace("_", " ") : "—"}</strong></span>
      </div>
    </section>

    <section id="btts-combo" className="panel derived-combo-panel">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">⚽ COMBINADA BTTS</div>
          <h2>COMBINADA BTTS</h2>
          <p>Se construye únicamente con BTTS de alta confianza que ya fueron calculados por el motor. No hace llamadas nuevas ni crea caché adicional.</p>
        </div>
        <span className="count">{data.bttsCombo?.picks?.length ?? 0}</span>
      </div>
      {(data.bttsCombo?.picks?.length ?? 0) > 0 ? <>
        <div className="combo-list">{(data.bttsCombo?.picks ?? []).map((p, i) => <PickCard key={`btts-${p.fixtureId}-${p.market}`} pick={p} index={i} kickoff={kickoffByFixture.get(p.fixtureId)} />)}</div>
        <div className="combo-footer">
          <span>💰 Cuota total EST.: <strong>@{data.bttsCombo.totalOdds.toFixed(2)}</strong></span>
          <span>💙 Nota media: <strong>{data.bttsCombo.globalScore.toFixed(1)}/10</strong></span>
          <span>🚦 Confianza: <strong>{data.bttsCombo.globalConfidence.replace("_", " ")}</strong></span>
        </div>
      </> : <p className="empty combo-empty">{data.bttsCombo?.message ?? "No existen suficientes escenarios BTTS de alta confianza para esta jornada."}</p>}
    </section>

    <section id="league-combos" className="panel league-combos-panel">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">🏟️ COMBINADAS POR LIGA</div>
          <h2>Una combinada independiente por competición</h2>
          <p>Se generan en memoria a partir de los candidatos del análisis diario. No consultan API-Football, The Odds API, Supabase ni la caché.</p>
        </div>
        <span className="count">{data.leagueCombos?.length ?? 0}</span>
      </div>
      {(data.leagueCombos?.length ?? 0) > 0 ? <div className="league-combos-grid">
        {(data.leagueCombos ?? []).map((leagueCombo) => <article className="league-combo-card" key={leagueCombo.key}>
          <div className="league-combo-head">
            <div><small>COMBINADA DE LIGA</small><h3>{leagueCombo.leagueName}</h3></div>
            <strong>@{leagueCombo.totalOdds.toFixed(2)} EST.</strong>
          </div>
          <p>{leagueCombo.message}</p>
          <div className="league-combo-picks">{leagueCombo.picks.map((pick, index) => <div className="league-combo-pick" key={`${leagueCombo.key}-${pick.fixtureId}-${pick.market}`}>
            <span>{index + 1}</span>
            <div><strong>{pick.fixtureLabel}</strong><small>🕒 {kickoffByFixture.get(pick.fixtureId) ?? "—"} · {pick.marketLabel}</small></div>
            <div className="league-combo-meta"><b>@{pick.odds.toFixed(2)}</b><small>{pct(pick.probability)} · {pick.score.toFixed(1)}/10</small></div>
          </div>)}</div>
          <div className="league-combo-footer"><span>💙 {leagueCombo.globalScore.toFixed(1)}/10</span><span>🚦 {leagueCombo.globalConfidence.replace("_", " ")}</span></div>
        </article>)}
      </div> : <p className="history-empty">Hoy no hay ligas con al menos dos selecciones ALTA/MUY ALTA para formar una combinada independiente.</p>}
    </section>

    <section id="major-number" className="panel major-number-panel">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">📈 COMBINADA DEL DÍA · MAYOR NÚMERO</div>
          <h2>¿Qué equipo hará más?</h2>
          <p>Tarjetas, córners, remates a puerta y remates. Elige de forma inteligente ponderando probabilidad, ventaja frente a la segunda opción, estabilidad y muestra histórica. Es un módulo separado: no cambia ni sustituye el motor principal.</p>
        </div>
        <button className="refresh" onClick={() => void loadMajorNumber()} disabled={majorNumberLoading}>{majorNumberLoading ? "Calculando…" : majorNumber ? "Recalcular" : "Analizar Mayor Número"}</button>
      </div>
      {!majorNumber && !majorNumberLoading && !majorNumberError ? <p className="history-empty">Pulsa <strong>Analizar Mayor Número</strong>. Solo entonces se consultan las estadísticas necesarias; la portada normal no gasta llamadas extra por este módulo.</p> : null}
      {majorNumberLoading ? <p className="history-empty">🧠 Revisando estadísticas históricas y reutilizando la caché existente…</p> : null}
      {majorNumberError ? <p className="warning-inline">⚠️ {majorNumberError}</p> : null}
      {majorNumber ? <>
        <div className="major-combo-summary">
          <div><small>SELECCIONES</small><strong>{majorNumber.combo.picks.length}</strong></div>
          <div><small>CUOTA TOTAL EST.</small><strong>{majorNumber.combo.picks.length ? `@${majorNumber.combo.totalOdds.toFixed(2)}` : "—"}</strong></div>
          <div><small>CONFIANZA MEDIA</small><strong>{majorNumber.combo.picks.length ? pct(majorNumber.combo.globalProbability) : "—"}</strong></div>
          <div><small>NOTA</small><strong>{majorNumber.combo.picks.length ? `${majorNumber.combo.score.toFixed(1)}/10` : "—"}</strong></div>
        </div>
        {majorNumber.combo.picks.length ? <div className="major-combo-picks">{majorNumber.combo.picks.map((pick, index) => <div className="major-combo-pick" key={`${pick.fixtureId}-${pick.market}`}>
          <span>{index + 1}</span><div><strong>{pick.fixtureLabel}</strong><small>🕒 {kickoffTime(majorNumber.fixtures.find((f) => f.fixtureId === pick.fixtureId)?.kickoff ?? "")} · {pick.marketLabel} → <b>{pick.selection}</b></small><small>🧠 Inteligencia {pick.intelligenceScore.toFixed(1)}/10 · {pick.reasoning}</small></div><div><b>@{pick.estimatedOdds.toFixed(2)} EST.</b><small>{pct(pick.probability)} · {pick.score.toFixed(1)}/10</small></div>
        </div>)}</div> : <p className="history-empty">No hay suficientes señales estadísticas para una combinada Mayor Número fiable.</p>}
        <div className="major-fixtures">{majorNumber.fixtures.map((fixture) => <article className="major-fixture-card" key={fixture.fixtureId}>
          <div className="major-fixture-head"><div><small>{fixture.leagueName} · 🕒 {kickoffTime(fixture.kickoff)}</small><h3>{fixture.fixtureLabel}</h3></div>{fixture.best ? <span className="confidence high">MEJOR: {fixture.best.predictionLabel}</span> : null}</div>
          {fixture.markets.length ? <div className="major-table-wrap"><table className="major-table"><thead><tr><th>Mayor número</th><th>{fixture.home.name}</th><th>Empate</th><th>{fixture.away.name}</th></tr></thead><tbody>{fixture.markets.map((m) => <tr key={m.metric}><th>{m.label}<small>Prom. {m.homeAverage.toFixed(1)} vs {m.awayAverage.toFixed(1)}</small></th><td className={m.prediction === "HOME" ? "major-winner" : ""}>{pct(m.homeProbability)}</td><td className={m.prediction === "DRAW" ? "major-winner" : ""}>{pct(m.drawProbability)}</td><td className={m.prediction === "AWAY" ? "major-winner" : ""}>{pct(m.awayProbability)}</td></tr>)}</tbody></table></div> : <p className="history-empty">Sin muestra suficiente para este partido.</p>}
          {fixture.best ? <><div className="major-best"><span>🎯 {fixture.best.label}: <strong>{fixture.best.predictionLabel}</strong></span><span>💰 @{fixture.best.estimatedOdds.toFixed(2)} EST.</span><span>🧠 {pct(fixture.best.probability)}</span><span>⚡ {fixture.best.score.toFixed(1)}/10</span><span>🧠 Inteligencia {fixture.best.intelligenceScore.toFixed(1)}/10</span></div><p className="major-reasoning">{fixture.best.reasoning}</p><div className="major-source-proof"><strong>✓ DATOS REALES · {fixture.best.source}</strong><span>{fixture.best.sampleHome} partidos de {fixture.home.name} · total {fixture.best.homeTotal.toFixed(0)} · media {fixture.best.homeAverage.toFixed(1)}</span><span>{fixture.best.sampleAway} partidos de {fixture.away.name} · total {fixture.best.awayTotal.toFixed(0)} · media {fixture.best.awayAverage.toFixed(1)}</span><small>Calculado únicamente con estadísticas recibidas para partidos reales. Si la API no devuelve muestra suficiente, este mercado no se publica.</small></div></> : null}
        </article>)}</div>
        <p className="major-note">{majorNumber.note}</p>
        {majorNumber.warnings.length ? <details className="major-warnings"><summary>Ver avisos de datos ({majorNumber.warnings.length})</summary><ul>{majorNumber.warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}</ul></details> : null}
      </> : null}
    </section>

    <section id="historial" className="panel history-panel combo-history-panel">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">📜 HISTORIAL</div>
          <h2>Combinadas del día</h2>
          <p>Aquí cuenta una sola cosa: el resultado de la combinada oficial @8–@10. Si falla una pata, la combinada sale FALLIDA; solo aparece ACERTADA cuando entran todas. Los mercados combinados cuentan exactamente igual.</p>
        </div>
        <span className="count">{history?.summary.total ?? 0}</span>
      </div>
      {historyLoading ? <p className="history-empty">Cargando historial…</p> : history?.rows.length ? <>
        <div className="history-summary combo-history-summary">
          <div><small>COMBINADAS</small><strong>{history.summary.total}</strong></div>
          <div><small>✅ ACERTADAS</small><strong>{history.summary.correct}</strong></div>
          <div><small>❌ FALLIDAS</small><strong>{history.summary.incorrect}</strong></div>
          <div><small>⏳ PENDIENTES</small><strong>{history.summary.pending}</strong></div>
          <div><small>% ACIERTO</small><strong>{Math.round(history.summary.hitRate * 100)}%</strong></div>
          <div><small>CUOTA MEDIA</small><strong>@{history.summary.averageOdds.toFixed(2)}</strong></div>
        </div>
        <div className="combo-history-list">{history.rows.map((row) => <details className={`combo-history-item ${row.status.toLowerCase()}`} key={row.date}>
          <summary>
            <div className="combo-history-main"><strong>{row.date}</strong><small>{row.picks.length} picks · {row.correctPicks}/{row.picks.length} acertados</small></div>
            <div className="combo-history-odds">@{row.totalOdds.toFixed(2)}</div>
            <span className={`history-status ${row.status === "ACERTADA" ? "correct" : row.status === "FALLIDA" ? "incorrect" : "pending"}`}>{row.status}</span>
          </summary>
          <div className="combo-history-picks">{row.picks.map((pick, index) => <div className="combo-history-pick" key={`${row.date}-${pick.fixtureId}-${pick.market}`}>
            <span className="combo-leg-state">{pick.correct === true ? "✅" : pick.correct === false ? "❌" : "⏳"}</span>
            <div><strong>{index + 1}. {pick.fixtureLabel}</strong><small>{pick.leagueName ?? ""}</small><div className="market">{pick.marketLabel}</div></div>
            <div className="combo-leg-meta"><span>@{pick.odds.toFixed(2)} EST.</span><span>{pick.correct !== null && pick.resultHomeGoals !== null && pick.resultAwayGoals !== null ? `${pick.resultHomeGoals}-${pick.resultAwayGoals}` : "Pendiente"}</span></div>
          </div>)}</div>
        </details>)}</div>
      </> : <p className="history-empty">Todavía no hay una combinada oficial registrada. En cuanto se publique una @8–@10 con datos reales aparecerá aquí y se resolverá como ACERTADA, FALLIDA o PENDIENTE.</p>}
    </section>

    <section className="info-strip">
      <div><small>PARTIDOS DEL DÍA</small><strong>{data.fixturesCount}</strong></div>
      <div><small>EN LIGAS DISPONIBLES</small><strong>{data.preferredFixturesCount}</strong></div>
      <div><small>ANALIZADOS A FONDO</small><strong>{data.analyzedFixturesCount}</strong></div>
      <div><small>API FÚTBOL</small><strong>{data.apiUsage.used}/{data.apiUsage.budget}</strong></div>
      <div><small>CUOTAS</small><strong>EST. · sin gastar Odds API</strong></div>
      <div><small>CACHÉ</small><strong>{Math.round(data.cacheStatus.hitRate * 100)}%</strong></div>
    </section>

    <section className="panel">
      <div className="section-title-row"><div><div className="eyebrow">🔥 CONFIANZA DEL MOTOR</div><h2>Mejores partidos analizados</h2><p>ALTA y MUY ALTA. Todos los mercados compiten entre sí y BTTS se enfrenta siempre a +2.5 cuando el partido tiene perfil de goles.</p></div><span className="count">{highlightedAnalyzed.length}</span></div>
      <div className="highlight-grid">{highlightedAnalyzed.map((i) => { const c = confidenceLabel(i.score ?? 0, i.probability); return <article className="highlight-card" key={i.fixtureId}><div className="highlight-top"><strong>{i.fixtureLabel}</strong><span className={`confidence ${c.className}`}>{c.label}</span></div><small>{i.leagueName} · 🕒 {kickoffByFixture.get(i.fixtureId) ?? "—"}</small><div className="market">💎 {i.bestMarketLabel}</div><div className="metrics"><span>🧠 {pct(i.probability)}</span><span>💙 {(i.score ?? 0).toFixed(1)}/10</span><span>💰 {oddsText(i.odds)}</span></div></article>; })}</div>
    </section>

    <section id="jornada" className="panel">
      <div className="section-title-row"><div><div className="eyebrow">📅 JORNADA ANALIZADA</div><h2>Jornada completa · {data.date}</h2><p>Si hoy ya no permite formar una combinada oficial prematch, la app salta automáticamente a mañana. Las ligas no prioritarias no entran en la combinada oficial.</p></div><span className="count">{visibleTodayFixtures.length}</span></div>
      <input className="fixture-search" value={fixtureQuery} onChange={(e: { target: { value: string } }) => setFixtureQuery(e.target.value)} placeholder="Buscar equipo o liga…" />
      <div className="today-list">{visibleTodayFixtures.map((i) => { const s = fixtureState(i.status, i.analyzed, i.preferred); return <div className="today-row" key={i.fixtureId}><span>{kickoffTime(i.kickoff)}</span><div><strong>{i.fixtureLabel}</strong><small>{i.leagueName}</small></div><span className={`today-state ${s.className}`}>{s.label}</span></div>; })}</div>
    </section>

    <section className="panel">
      <div className="section-title-row"><div><div className="eyebrow">PICKS QUE PASAN EL FILTRO</div><h2>Candidatos</h2></div><span className="count">{filteredCandidates.length}</span></div>
      <div className="candidate-grid">{filteredCandidates.map((p) => <div className="candidate" key={`${p.fixtureId}-${p.market}`}><strong>{p.fixtureLabel}</strong><small className="kickoff-everywhere">🕒 {kickoffByFixture.get(p.fixtureId) ?? "—"}</small><div className="market">{p.marketLabel}</div><div className="metrics"><span>@{p.odds.toFixed(2)} EST.</span><span>{pct(p.probability)}</span><span>{p.score.toFixed(1)}/10</span></div></div>)}</div>
    </section>

    <section id="analizados" className="panel analyzed-explorer">
      <div className="section-title-row">
        <div>
          <div className="eyebrow">🔎 PARTIDOS ANALIZADOS</div>
          <h2>Explorador de análisis</h2>
          <p>El motor analiza el máximo que permite la fuente de datos. Aquí los tienes ordenados en un menú compacto: busca, filtra y abre solo el partido que quieras ver en detalle.</p>
        </div>
        <span className="count">{filteredAnalyzedMenu.length}</span>
      </div>

      <div className="analyzed-toolbar">
        <input className="fixture-search analyzed-search" value={analyzedQuery} onChange={(e: { target: { value: string } }) => setAnalyzedQuery(e.target.value)} placeholder="Buscar equipo, liga o mercado…" />
        <div className="analyzed-tabs" role="tablist" aria-label="Filtrar partidos analizados">
          <button className={analyzedFilter === "all" ? "active" : ""} onClick={() => setAnalyzedFilter("all")}>Todos <span>{analyzedCounts.all}</span></button>
          <button className={analyzedFilter === "PASA" ? "active" : ""} onClick={() => setAnalyzedFilter("PASA")}>Pasan <span>{analyzedCounts.PASA}</span></button>
          <button className={analyzedFilter === "CERCA" ? "active" : ""} onClick={() => setAnalyzedFilter("CERCA")}>Cerca <span>{analyzedCounts.CERCA}</span></button>
          <button className={analyzedFilter === "FUERA" ? "active" : ""} onClick={() => setAnalyzedFilter("FUERA")}>Fuera <span>{analyzedCounts.FUERA}</span></button>
        </div>
      </div>

      <div className="analyzed-menu">
        {displayedAnalyzed.map((i) => {
          const meta = analyzedFixtureMeta.get(i.fixtureId);
          return <details className={`analyzed-item status-${i.status.toLowerCase().replace("_", "-")}`} key={i.fixtureId}>
            <summary>
              <div className="analyzed-summary-main">
                <div className="analyzed-summary-title"><strong>{i.fixtureLabel}</strong><small>{i.leagueName}{meta?.kickoff ? ` · ${kickoffTime(meta.kickoff)}` : ""}</small></div>
                <div className="analyzed-summary-market">💎 {i.bestMarketLabel}</div>
              </div>
              <div className="analyzed-summary-metrics">
                <span>{pct(i.probability)}</span>
                <span>{(i.score ?? 0).toFixed(1)}/10</span>
                <span>{oddsText(i.odds)}</span>
                <span className="analyzed-status">{analyzedStatusLabel(i.status)}</span>
              </div>
            </summary>
            <div className="analyzed-details">
              <p>{i.explanation}</p>
              {i.alternatives?.length ? <div className="market-alternatives"><strong>También valora:</strong> {i.alternatives.map((a) => `${a.marketLabel} (${pct(a.probability)} · ${a.score.toFixed(1)}/10 · ${oddsText(a.odds)})`).join(" · ")}</div> : null}
              <div className="metrics"><span>🧠 Probabilidad {pct(i.probability)}</span><span>💙 Nota {(i.score ?? 0).toFixed(1)}/10</span><span>💰 {oddsText(i.odds)}</span></div>
            </div>
          </details>;
        })}
        {!displayedAnalyzed.length ? <p className="history-empty">No hay partidos que coincidan con este filtro.</p> : null}
      </div>

      {displayedAnalyzed.length < filteredAnalyzedMenu.length ? <div className="analyzed-more-row">
        <button className="analyzed-more" onClick={() => setAnalyzedVisibleCount((count) => count + 12)}>Mostrar 12 más</button>
        <button className="analyzed-more secondary" onClick={() => setAnalyzedVisibleCount(filteredAnalyzedMenu.length)}>Ver todos ({filteredAnalyzedMenu.length})</button>
      </div> : filteredAnalyzedMenu.length > 12 ? <div className="analyzed-more-row"><button className="analyzed-more secondary" onClick={() => setAnalyzedVisibleCount(12)}>Compactar</button></div> : null}
    </section>

    {data.analysisPicks.length > 0 ? <section className="panel"><div className="section-title-row"><div><div className="eyebrow">🧠 SHORTLIST</div><h2>Selecciones que el motor vigila</h2></div><span className="count">{data.analysisPicks.length}</span></div><div className="combo-list">{data.analysisPicks.map((p, i) => <AnalysisPickCard key={p.fixtureId} pick={p} index={i} kickoff={kickoffByFixture.get(p.fixtureId)} />)}</div></section> : null}



    {data.warnings.length > 0 && <section className="warnings">{data.warnings.slice(0, 8).map((w, i) => <p key={i}>ℹ️ {w}</p>)}</section>}
    <footer className="maestro-footer"><strong>👑 Futbolylicts-AI · EL MAESTRO DEL FÚTBOL</strong><span>Los datos hablan. La inteligencia decide.</span><small>+18 · Juega con responsabilidad</small></footer>
  </main>;
}
