"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PREFERRED_LEAGUE_LABELS } from "@/lib/config/competitions";
import type { DailyAnalysis, MarketCandidate, AnalyzedFixtureSummary } from "@/lib/engine/types";
import type { AnalysisScope } from "@/lib/engine/analyze";
import { humanTipsterExplanation } from "@/lib/engine/humanExplanation";

type ComboHistoryPick = {
  fixtureId: number; fixtureLabel: string; leagueName?: string; market: string; marketLabel: string;
  odds: number; score: number; correct: boolean | null; resultHomeGoals: number | null; resultAwayGoals: number | null;
};
type ComboHistoryRow = {
  date: string; totalOdds: number; globalScore: number; globalConfidence: string; status: "ACERTADA" | "FALLIDA" | "PENDIENTE";
  correctPicks: number; failedPicks: number; pendingPicks: number; picks: ComboHistoryPick[];
};
type HistoryData = {
  rows: ComboHistoryRow[];
  summary: { total: number; resolved: number; correct: number; incorrect: number; pending: number; hitRate: number; averageOdds: number };
};

const AUTO_REFRESH_MS = 20 * 60 * 1000;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const odds = (v?: number) => v === undefined ? "—" : `@${v.toFixed(2)} EST.`;

function confidence(score = 0, probability = 0) {
  if (score >= 9 && probability >= .78) return "MUY ALTA";
  if (score >= 8 && probability >= .70) return "ALTA";
  return "MEDIA";
}

function PickCard({ pick, index }: { pick: MarketCandidate; index: number }) {
  return <article className="bet-card neon-card">
    <div className="bet-number">{String(index + 1).padStart(2, "0")}</div>
    <div className="bet-card-body">
      <div className="bet-card-head"><div><small>{pick.leagueName}</small><h3>{pick.fixtureLabel}</h3></div><span className="confidence-pill">{confidence(pick.score, pick.probability)}</span></div>
      <div className="market-beam">💎 {pick.marketLabel}</div>
      <div className="stat-chips"><span>💰 @{pick.odds.toFixed(2)}</span><span>🧠 {pct(pick.probability)}</span><span>⚡ {pick.score.toFixed(1)}/10</span></div>
      <p><strong>🎙️ Visión tipster:</strong> {humanTipsterExplanation(pick)}</p>
      <p className="comparison"><strong>🧠 Lectura IA:</strong> {pick.reasoning}</p>
      {pick.comparisonReason ? <p className="comparison"><strong>📊 Dato clave:</strong> {pick.comparisonReason}</p> : null}
    </div>
  </article>;
}


function BttsCard({ pick, index }: { pick: MarketCandidate; index: number }) {
  return <article className="bet-card neon-card">
    <div className="bet-number">{String(index + 1).padStart(2, "0")}</div>
    <div className="bet-card-body">
      <div className="bet-card-head"><div><small>{pick.leagueName}</small><h3>{pick.fixtureLabel}</h3></div><span className="confidence-pill">{confidence(pick.score, pick.probability)}</span></div>
      <div className="market-beam">🤝 Ambos Marcan (BTTS)</div>
      <div className="stat-chips"><span>🧠 {pct(pick.probability)}</span><span>⚡ {pick.score.toFixed(1)}/10</span></div>
      <p><strong>🎙️ Lectura:</strong> {humanTipsterExplanation(pick)}</p>
      <p className="comparison"><strong>🧠 Análisis IA:</strong> {pick.reasoning}</p>
      {pick.comparisonReason ? <p className="comparison"><strong>📊 Dato clave:</strong> {pick.comparisonReason}</p> : null}
    </div>
  </article>;
}

function AnalyzedRow({ item }: { item: AnalyzedFixtureSummary }) {
  return <details className={`analysis-row status-${item.status.toLowerCase()}`}>
    <summary>
      <div><strong>{item.fixtureLabel}</strong><small>{item.leagueName}</small></div>
      <div className="analysis-market">{item.bestMarketLabel}</div>
      <div className="analysis-numbers"><span>{odds(item.odds)}</span><span>{pct(item.probability)}</span><span>{(item.score ?? 0).toFixed(1)}/10</span></div>
      <b>{item.status}</b>
    </summary>
    <div className="analysis-detail"><p>{item.explanation}</p>{item.alternatives?.length ? <p><strong>Alternativas:</strong> {item.alternatives.slice(0,4).map(a => `${a.marketLabel} ${odds(a.odds)}`).join(" · ")}</p> : null}</div>
  </details>;
}

export default function Dashboard({ analysis }: { analysis: DailyAnalysis }) {
  const [data, setData] = useState(analysis);
  const [scope, setScope] = useState<AnalysisScope>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(14);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const inFlight = useRef(false);

  const filteredAnalyzed = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.analyzedFixtures.filter(i => !q || `${i.fixtureLabel} ${i.leagueName} ${i.bestMarketLabel}`.toLowerCase().includes(q));
  }, [data.analyzedFixtures, query]);

  const elite = useMemo(() => data.analyzedFixtures.filter(i => i.status === "PASA").slice(0, 8), [data.analyzedFixtures]);

  const bttsPicks = useMemo(() => data.candidates
    .filter(p => p.market === "BTTS_YES" && p.probability >= 0.70 && p.score >= 8)
    .sort((a, b) => b.score - a.score || b.probability - a.probability)
    .slice(0, 8), [data.candidates]);

  async function loadHistory() {
    try {
      const r = await fetch("/api/history", { cache: "no-store" });
      if (r.ok) setHistory(await r.json());
    } catch { setHistory(null); }
  }

  async function runAnalysis(nextScope = scope, silent = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const r = await fetch("/api/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: nextScope }) });
      if (r.ok) {
        setData(await r.json());
        localStorage.setItem("futbolylicts-analysis-scope", nextScope);
        await loadHistory();
      }
    } finally {
      inFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }

  function chooseScope(next: AnalysisScope) {
    setScope(next);
    void runAnalysis(next);
  }

  useEffect(() => {
    void loadHistory();
    const saved = localStorage.getItem("futbolylicts-analysis-scope") as AnalysisScope | null;
    if (saved && ["all","champions"].includes(saved) && saved !== "all") { setScope(saved); void runAnalysis(saved); }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void runAnalysis(scope, true); }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [scope]);

  return <main className="app-shell">
    <div className="light-orb orb-a"/><div className="light-orb orb-b"/><div className="light-orb orb-c"/>

    <header className="master-hero">
      <div className="brain-stage" aria-hidden="true">
        <div className="brain-halo halo-1"/><div className="brain-halo halo-2"/><div className="brain-halo halo-3"/>
        <div className="brain-core">🧠</div>
        <span className="brain-spark s1">✦</span><span className="brain-spark s2">✧</span><span className="brain-spark s3">✦</span>
      </div>
      <div className="hero-copy">
        <div className="brand-kicker">⚽ FUTBOLYLICTS-AI</div>
        <h1>EL <span>CEREBRO MAESTRO</span><br/>DEL FÚTBOL</h1>
        <p>Escanea la jornada, enfrenta mercados simples y combinados y deja pasar solo selecciones con valor. La cuota filtra; el análisis manda.</p>
        <div className="hero-badges"><span>MIN @1.25</span><span>OBJETIVO @8–@10</span><span>NO UNDER</span><span>NO HÁNDICAP</span></div>
      </div>
      <div className={`live-pill ${data.mode}`}>{data.mode === "live" ? "● DATOS REALES" : "◉ MODO DEMO"}</div>
    </header>

    <section className="command-center neon-panel">
      <div className="command-title"><div><small>🎛️ CABINA DEL MAESTRO</small><h2>¿Qué quieres analizar?</h2></div><button className="reanalyse" onClick={() => void runAnalysis(scope)} disabled={refreshing}>{refreshing ? "⚡ ANALIZANDO…" : "⚡ REANALIZAR"}</button></div>
      <div className="scope-grid">
        <button className={scope === "all" ? "active" : ""} onClick={() => chooseScope("all")}><span>🌍</span><strong>TODAS LAS LIGAS</strong><small>Combinada global de la jornada</small></button>
        <button className={scope === "champions" ? "active" : ""} onClick={() => chooseScope("champions")}><span>🏆</span><strong>SOLO CHAMPIONS</strong><small>Combinada exclusiva Champions</small></button>
      </div>
    </section>

    <nav className="neon-nav"><a href="#combo">🏆 Combinada</a><a href="#btts">🤝 Combinada BTTS</a><a href="#elite">🔥 Elite</a><a href="#analizados">🔎 Analizados</a><a href="#historial">📜 Historial</a></nav>

    <section className="rules-marquee">
      <div><b>💰 CUOTA</b><span>Nunca inferior a @1.25</span></div>
      <div><b>🧠 DECISIÓN</b><span>Valor + confianza antes que cuota</span></div>
      <div><b>🤝 BTTS</b><span>Solo · hasta @3 con ALTA/MUY ALTA</span></div>
      <div><b>🧩 COMBINADOS</b><span>Sí, cuando sean el mejor mercado</span></div>
      <div><b>🚫 BLOQUEADOS</b><span>No Under ni hándicap</span></div>
    </section>

    <section id="combo" className="combo-zone neon-panel mega-glow">
      <div className="section-head"><div><small>🏆 SELECCIÓN SUPREMA</small><h2>{scope === "champions" ? "Combinada Champions" : "Combinada del Día"}</h2><p>{data.combo.message}</p></div><div className="total-odds"><small>CUOTA TOTAL</small><strong>{data.combo.picks.length ? `@${data.combo.totalOdds.toFixed(2)}` : "BUSCANDO"}</strong><span>{data.combo.targetReached ? "OBJETIVO EN ZONA" : "CALIDAD PRIMERO"}</span></div></div>
      {data.combo.picks.length ? <div className="bet-list">{data.combo.picks.map((p,i)=><PickCard key={`${p.fixtureId}-${p.market}`} pick={p} index={i}/>)}</div> : <div className="empty-master"><span>🧠</span><h3>El cerebro no fuerza picks</h3><p>No hay suficientes oportunidades válidas para montar una combinada de calidad ahora mismo.</p></div>}
    </section>

    <section id="btts" className="combo-zone neon-panel">
      <div className="section-head"><div><small>🤝 FILTRO BTTS</small><h2>Combinada BTTS</h2><p>Selección estadística de partidos donde “Ambos Marcan” alcanza confianza ALTA o superior. No se calcula cuota conjunta.</p></div><span className="counter">{bttsPicks.length}</span></div>
      {bttsPicks.length ? <div className="bet-list">{bttsPicks.map((p,i)=><BttsCard key={`btts-${p.fixtureId}`} pick={p} index={i}/>)}</div> : <div className="empty-master"><span>🤝</span><h3>Sin BTTS de confianza alta</h3><p>El motor no encuentra ahora mismo partidos que superen el filtro BTTS establecido.</p></div>}
    </section>

    <section className="metrics-ribbon">
      <div><small>PARTIDOS</small><strong>{data.fixturesCount}</strong></div><div><small>PERMITIDOS</small><strong>{data.preferredFixturesCount}</strong></div><div><small>ANALIZADOS</small><strong>{data.analyzedFixturesCount}</strong></div><div><small>API</small><strong>{data.apiUsage.used}/{data.apiUsage.budget}</strong></div><div><small>CACHÉ</small><strong>{Math.round(data.cacheStatus.hitRate*100)}%</strong></div>
    </section>

    <section id="elite" className="neon-panel">
      <div className="section-head"><div><small>🔥 RADAR DE VALOR</small><h2>Oportunidades Elite</h2><p>Los mercados que mejor sobreviven a la criba del motor.</p></div><span className="counter">{elite.length}</span></div>
      <div className="elite-grid">{elite.map(item => <article className="elite-card" key={item.fixtureId}><small>{item.leagueName}</small><h3>{item.fixtureLabel}</h3><div className="market-beam">{item.bestMarketLabel}</div><div className="stat-chips"><span>{odds(item.odds)}</span><span>{pct(item.probability)}</span><span>{(item.score ?? 0).toFixed(1)}/10</span></div></article>)}</div>
    </section>

    <section id="analizados" className="neon-panel">
      <div className="section-head"><div><small>🔎 ESCÁNER TOTAL</small><h2>Partidos Analizados</h2><p>Busca un equipo, liga o mercado. Abre cada partido para ver por qué entra o queda fuera.</p></div><span className="counter">{filteredAnalyzed.length}</span></div>
      <input className="laser-search" value={query} onChange={e=>{setQuery(e.target.value);setVisible(14)}} placeholder="Buscar equipo, liga o mercado…"/>
      <div className="analysis-list">{filteredAnalyzed.slice(0,visible).map(i=><AnalyzedRow key={i.fixtureId} item={i}/>)}</div>
      {visible < filteredAnalyzed.length ? <button className="load-more" onClick={()=>setVisible(v=>v+14)}>VER 14 MÁS ✦</button> : null}
    </section>

    <section id="historial" className="neon-panel">
      <div className="section-head"><div><small>📜 MEMORIA DEL MAESTRO</small><h2>Historial de Combinadas</h2></div></div>
      {history ? <><div className="history-stats"><div><small>TOTAL</small><strong>{history.summary.total}</strong></div><div><small>ACERTADAS</small><strong>{history.summary.correct}</strong></div><div><small>FALLIDAS</small><strong>{history.summary.incorrect}</strong></div><div><small>PENDIENTES</small><strong>{history.summary.pending}</strong></div><div><small>ACIerto</small><strong>{Math.round(history.summary.hitRate*100)}%</strong></div><div><small>CUOTA MEDIA</small><strong>@{history.summary.averageOdds.toFixed(2)}</strong></div></div><div className="history-grid">{history.rows.slice(0,12).map(row=><details className={`history-card ${row.status.toLowerCase()}`} key={row.date}><summary><div><strong>{row.date}</strong><small>{row.picks.length} selecciones</small></div><b>@{row.totalOdds.toFixed(2)}</b><span>{row.status}</span></summary><div>{row.picks.map(p=><p key={`${p.fixtureId}-${p.market}`}><span>{p.correct===true?"✅":p.correct===false?"❌":"⏳"}</span><strong>{p.fixtureLabel}</strong><em>{p.marketLabel} · @{p.odds.toFixed(2)}</em></p>)}</div></details>)}</div></> : <p className="muted">Todavía no hay historial disponible.</p>}
    </section>

    <section className="league-wall neon-panel"><small>🏟️ UNIVERSO DE LIGAS</small><h2>Ligas conectadas al motor</h2><div>{PREFERRED_LEAGUE_LABELS.map(l=><span key={l}>{l}</span>)}</div></section>

    {data.warnings.length ? <section className="system-log">{data.warnings.slice(0,6).map((w,i)=><p key={i}>⚙️ {w}</p>)}</section> : null}
    <footer>⚽ Futbolylicts-AI · Análisis estadístico · +18 · Juega con responsabilidad</footer>
  </main>;
}
