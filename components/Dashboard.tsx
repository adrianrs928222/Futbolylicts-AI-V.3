"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/config/competitions";
import type { CompetitionCategory, DailyAnalysis, MarketCandidate } from "@/lib/engine/types";

const AUTO_REFRESH_MS = 20 * 60 * 1000;

const categoryOrder: CompetitionCategory[] = [
  "champions",
  "europa",
  "conference",
  "national_cup",
  "top_league",
  "other",
];

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function confidenceLabel(score: number, probability: number) {
  const veryHigh = score >= 9 && probability >= 0.78;
  const high = score >= 8 && probability >= 0.70;
  if (veryHigh) return { label: "MUY ALTA", className: "very-high" };
  if (high) return { label: "ALTA", className: "high" };
  return { label: "NO ALTA", className: "candidate-label" };
}

function analyzedStatusLabel(status: "PASA" | "CERCA" | "FUERA" | "SIN_CUOTA") {
  if (status === "PASA") return "PASA EL FILTRO";
  if (status === "CERCA") return "CERCA DEL CORTE";
  if (status === "SIN_CUOTA") return "CUOTA EST.";
  return "NO ENTRA";
}

function oddsText(odds?: number, realOdds = false) {
  if (odds === undefined) return "Sin cuota";
  return `@${odds.toFixed(2)} ${realOdds ? "REAL" : "EST."}`;
}

function PickCard({ pick, index }: { pick: MarketCandidate; index: number }) {
  return (
    <article className="pick-card">
      <div className="pick-index">{index + 1}</div>
      <div className="pick-main">
        <div className="pick-topline">
          <strong>{pick.fixtureLabel}</strong>
          <span className={`confidence ${confidenceLabel(pick.score, pick.probability).className}`}>
            {confidenceLabel(pick.score, pick.probability).label}
          </span>
        </div>
        <div className="market">💎 {pick.marketLabel}</div>
        <div className="metrics">
          <span>💰 @{pick.odds.toFixed(2)} {pick.realOdds ? "REAL" : "EST."}</span>
          <span>🧠 {pct(pick.probability)}</span>
          <span>💙 {pick.score.toFixed(1)}/10</span>
        </div>
        <p>{pick.reasoning}</p>
        <p className="risk-note"><strong>Qué puede hacer fallar el pick:</strong> {pick.riskNote}</p>
      </div>
    </article>
  );
}

function AnalysisPickCard({ pick, index }: { pick: import("@/lib/engine/types").AnalyzedFixtureSummary; index: number }) {
  const confidence = confidenceLabel(pick.score ?? 0, pick.probability);
  return (
    <article className="pick-card analysis-pick-card">
      <div className="pick-index">{index + 1}</div>
      <div className="pick-main">
        <div className="pick-topline">
          <strong>{pick.fixtureLabel}</strong>
          <span className={`confidence ${confidence.className}`}>{confidence.label}</span>
        </div>
        <div className="market">💎 {pick.bestMarketLabel}</div>
        {pick.alternatives && pick.alternatives.length > 0 && (
          <div className="market-alternatives">
            <strong>También valora:</strong> {pick.alternatives.map((alt) => `${alt.marketLabel} (${pct(alt.probability)} · ${alt.score.toFixed(1)}/10 · ${oddsText(alt.odds, alt.realOdds)})`).join(" · ")}
          </div>
        )}
        <div className="metrics">
          <span>🧠 {pct(pick.probability)}</span>
          <span>💙 {(pick.score ?? 0).toFixed(1)}/10</span>
          <span>💰 {oddsText(pick.odds, pick.realOdds)}</span>
        </div>
        <p>{pick.explanation}</p>
      </div>
    </article>
  );
}

export default function Dashboard({ analysis }: { analysis: DailyAnalysis }) {
  const [category, setCategory] = useState<CompetitionCategory | "all">("all");
  const [data, setData] = useState(analysis);
  const [refreshing, setRefreshing] = useState(false);
  const [fixtureQuery, setFixtureQuery] = useState("");
  const refreshInFlight = useRef(false);
  const lastRefreshAt = useRef(Date.now());

  const filteredCandidates = useMemo(() => {
    const strong = data.candidates.filter((candidate) => {
      const implied = 1 / Math.max(candidate.odds, 1.01);
      const edge = candidate.probability - implied;
      const veryHigh = candidate.score >= 9 && candidate.probability >= 0.78;
      return (
        candidate.realOdds &&
        !veryHigh &&
        candidate.score >= 8 &&
        candidate.probability >= 0.70 &&
        candidate.odds >= 1.25 &&
        candidate.odds <= 1.75 &&
        edge >= 0.03 &&
        (candidate.market !== "BTTS_YES" || candidate.odds >= 1.35)
      );
    });
    return category === "all" ? strong : strong.filter((candidate) => candidate.category === category);
  }, [category, data]);

  const visibleAnalyzed = useMemo(() => {
    return category === "all"
      ? data.analyzedFixtures
      : data.analyzedFixtures.filter((item) => item.category === category);
  }, [category, data]);

  const highlightedAnalyzed = useMemo(() => {
    return visibleAnalyzed
      .filter((item) => item.probability >= 0.70 && (item.score ?? 0) >= 8)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.probability - a.probability)
      .slice(0, 10);
  }, [visibleAnalyzed]);

  const visibleTodayFixtures = useMemo(() => {
    const q = fixtureQuery.trim().toLowerCase();
    return data.allFixtures.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!q) return true;
      return `${item.fixtureLabel} ${item.leagueName}`.toLowerCase().includes(q);
    });
  }, [category, data.allFixtures, fixtureQuery]);

  function kickoffTime(value: string) {
    try {
      return new Intl.DateTimeFormat("es-ES", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "—";
    }
  }

  function fixtureState(status: string, analyzed: boolean) {
    if (analyzed) return { label: "ANALIZADO", className: "done" };
    if (["1H", "HT", "2H", "ET", "P", "LIVE"].includes(status)) return { label: "EN JUEGO", className: "live-game" };
    if (["FT", "AET", "PEN"].includes(status)) return { label: "FINALIZADO", className: "finished" };
    if (["PST", "CANC", "ABD"].includes(status)) return { label: status, className: "finished" };
    return { label: "EN JORNADA", className: "queued" };
  }

  const useAnalysisCombo = !data.combo.official && data.analysisPicks.length > 0;
  const analysisComboStats = useMemo(() => {
    const picks = data.analysisPicks;
    if (!picks.length) {
      return {
        averageScore: 0,
        combinedProbability: 0,
        totalOdds: undefined as number | undefined,
        oddsMode: undefined as "REAL" | "EST." | undefined,
      };
    }
    const averageScore = picks.reduce((sum, pick) => sum + (pick.score ?? 0), 0) / picks.length;
    const combinedProbability = picks.reduce((product, pick) => product * pick.probability, 1);
    const hasAllOdds = picks.every((pick) => pick.odds !== undefined);
    const totalOdds = hasAllOdds
      ? picks.reduce((product, pick) => product * (pick.odds ?? 1), 1)
      : undefined;
    const oddsMode = hasAllOdds
      ? picks.every((pick) => pick.realOdds) ? "REAL" : "EST."
      : undefined;
    return { averageScore, combinedProbability, totalOdds, oddsMode };
  }, [data.analysisPicks]);

  async function refresh(silent = false) {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Sin fijar la fecha: el servidor usa siempre la fecha actual de Madrid.
        // Así, al cambiar de día, la web salta sola a la nueva jornada.
        body: JSON.stringify({}),
      });
      if (response.ok) {
        setData(await response.json());
        lastRefreshAt.current = Date.now();
      }
    } finally {
      refreshInFlight.current = false;
      if (!silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      // No gastamos llamadas si la pestaña lleva cerrada/oculta.
      if (document.visibilityState === "visible") void refresh(true);
    }, AUTO_REFRESH_MS);

    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefreshAt.current >= AUTO_REFRESH_MS
      ) {
        void refresh(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <div className="brand">LA MENTE DEL GOL <span>★</span></div>
          <div className="subbrand">Futbolylicts-AI</div>
        </div>
        <div className={`mode-badge ${data.mode === "demo" ? "demo" : "live"}`}>
          {data.mode === "demo" ? "MODO DEMO" : "DATOS REALES"}
        </div>
      </header>

      <section className="controls-grid">
        <div className="rule-box"><small>CUOTA OBJETIVO</small><strong>@8 – @10 · centro @9</strong></div>
        <div className="rule-box"><small>ALTA</small><strong>≥70% + ≥8.0/10</strong></div>
        <div className="rule-box"><small>COMBINADA</small><strong>SOLO ALTA · no MUY ALTA</strong></div>
        <div className="rule-box"><small>PATAS</small><strong>4–6 · SOLO ALTA</strong></div>
        <div className="rule-box"><small>CUOTA/PICK</small><strong>@1.25 – @1.75</strong></div>
        <div className="rule-box"><small>ROTACIÓN</small><strong>Automática · cada 20 min</strong></div>
        <div className="rule-box"><small>CUOTA OPERATIVA</small><strong>REAL si existe · EST. si falta</strong></div>
        <div className="rule-box"><small>VALOR</small><strong>≥3 pts sobre cuota REAL</strong></div>
        <div className="rule-box"><small>BTTS / +2.5</small><strong>Libres según calidad</strong></div>
        <div className="rule-box"><small>COMBINADOS</small><strong>1X/X2/Ganador + +1.5/+2.5</strong></div>
        <div className="rule-box blocked"><small>MERCADOS UNDER</small><strong>DESACTIVADOS</strong></div>
        <div className="rule-box"><small>RESERVAS</small><strong>Solo Eerste Divisie</strong></div>
      </section>

      <section className="category-bar" aria-label="Categorías de competición">
        <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todas</button>
        {categoryOrder.map((key) => (
          <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>
            {CATEGORY_LABELS[key]} <span>{data.categoryCounts[key] ?? 0}</span>
          </button>
        ))}
      </section>

      <section className={`daily-combo ${data.combo.official ? "official" : "no-official"}`}>
        <div className="section-title-row">
          <div>
            <div className="eyebrow">🏆 Combinada del dia</div>
            <h1>Combinada del día</h1>
            <p>
              {useAnalysisCombo
                ? `Estos son los ${data.analysisPicks.length} picks ALTA que el motor combina usando la cuota REAL cuando existe y la cuota EST. como cuota operativa cuando no existe. Busca quedar entre @8 y @10, con centro @9. Los MUY ALTA siguen visibles abajo, pero no entran. Si no se puede llegar al rango sin rebajar la confianza, se muestra la combinación ALTA más cercana. La jornada se revisa automáticamente cada 20 min.`
                : data.combo.message}
            </p>
          </div>
          <button className="refresh" onClick={() => void refresh(false)} disabled={refreshing}>
            {refreshing ? "Revisando…" : "Reanalizar"}
          </button>
        </div>

        {useAnalysisCombo ? (
          <div className="combo-list">
            {data.analysisPicks.map((pick, index) => (
              <AnalysisPickCard key={`analysis-combo-${pick.fixtureId}`} pick={pick} index={index} />
            ))}
          </div>
        ) : data.combo.picks.length > 0 ? (
          <div className="combo-list">
            {data.combo.picks.map((pick, index) => <PickCard key={`${pick.fixtureId}-${pick.market}`} pick={pick} index={index} />)}
          </div>
        ) : null}

        <div className="combo-footer">
          <span>💰 Total: <strong>
            {useAnalysisCombo
              ? analysisComboStats.totalOdds !== undefined
                ? `@${analysisComboStats.totalOdds.toFixed(2)} ${analysisComboStats.oddsMode ?? ""}`.trim()
                : "Pendiente de cuotas"
              : data.combo.picks.length > 0 ? `@${data.combo.totalOdds.toFixed(2)}` : "—"}
          </strong></span>
          <span>💙 Calidad media: <strong>
            {useAnalysisCombo
              ? `${analysisComboStats.averageScore.toFixed(1)}/10`
              : data.combo.picks.length > 0 ? `${data.combo.globalScore.toFixed(1)}/10` : "—"}
          </strong></span>
          <span>🧠 Prob. combinada est.: <strong>
            {useAnalysisCombo
              ? pct(analysisComboStats.combinedProbability)
              : data.combo.picks.length > 0 ? pct(data.combo.globalProbability) : "—"}
          </strong></span>
        </div>
      </section>

      <section className="info-strip">
        <div><small>PARTIDOS DEL DÍA</small><strong>{data.fixturesCount}</strong></div>
        <div><small>ANALIZADOS EN PROFUNDIDAD</small><strong>{data.analyzedFixturesCount}</strong></div>
        <div>
          <small>APIS</small>
          <strong>
            Fútbol {data.apiUsage.used}/{data.apiUsage.budget}
            {data.apiUsage.odds ? ` · Cuotas ${data.apiUsage.odds.used}/${data.apiUsage.odds.budget}` : ""}
          </strong>
        </div>
        <div><small>CACHÉ</small><strong>{data.cacheStatus.persistent ? `Persistente ${Math.round(data.cacheStatus.hitRate * 100)}%` : `Memoria ${Math.round(data.cacheStatus.hitRate * 100)}%`}</strong></div>
      </section>

      <section className="highlights-section">
        <div className="section-title-row">
          <div>
            <div className="eyebrow">🔥 CONFIANZA DEL MOTOR</div>
            <h2>Mejores partidos analizados</h2>
            <p>Aquí se siguen mostrando perfiles ALTA y MUY ALTA del motor para que veas todo el análisis. La Combinada del día usa SOLO ALTA y busca @8–@10 usando cuotas REAL o EST. sin rebajar el filtro. Los demás siguen visibles abajo en “Partidos analizados”.</p>
          </div>
          <span className="count">{highlightedAnalyzed.length}</span>
        </div>
        <div className="highlight-grid">
          {highlightedAnalyzed.map((item) => {
            const high = item.probability >= 0.70 && (item.score ?? 0) >= 8;
            const veryHigh = item.probability >= 0.78 && (item.score ?? 0) >= 9;
            return (
              <article className="highlight-card" key={`highlight-${item.fixtureId}`}>
                <div className="highlight-top">
                  <strong>{item.fixtureLabel}</strong>
                  <span className={`confidence ${veryHigh ? "very-high" : high ? "high" : "candidate-label"}`}>
                    {veryHigh ? "MUY ALTA" : high ? "ALTA" : "CANDIDATO"}
                  </span>
                </div>
                <div className="analyzed-league">{item.leagueName}</div>
                <div className="analyzed-market">💎 {item.bestMarketLabel}</div>
                <div className="analyzed-metrics">
                  <span>🧠 {pct(item.probability)}</span>
                  <span>💙 {item.score !== undefined ? `${item.score.toFixed(1)}/10` : "Nota pendiente"}</span>
                  <span>💰 {oddsText(item.odds, item.realOdds)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="today-section">
        <div className="section-title-row today-title-row">
          <div>
            <div className="eyebrow">📅 TODOS LOS PARTIDOS DE HOY</div>
            <h2>{category === "all" ? "Jornada completa" : CATEGORY_LABELS[category]}</h2>
            <p>Se muestran TODOS los partidos elegibles del día, también los ya iniciados o finalizados. Los marcados como ANALIZADO han recibido análisis profundo; ninguno desaparece por no tener pick.</p>
          </div>
          <span className="count">{visibleTodayFixtures.length}</span>
        </div>
        <input
          className="fixture-search"
          value={fixtureQuery}
          onChange={(event) => setFixtureQuery(event.target.value)}
          placeholder="Buscar equipo o liga…"
          aria-label="Buscar partido o liga"
        />
        <div className="today-list">
          {visibleTodayFixtures.map((item) => {
            const state = fixtureState(item.status, item.analyzed);
            return (
              <div className="today-row" key={`today-${item.fixtureId}`}>
                <span className="today-time">{kickoffTime(item.kickoff)}</span>
                <div className="today-match">
                  <strong>{item.fixtureLabel}</strong>
                  <small>{item.leagueName}</small>
                </div>
                <span className={`today-state ${state.className}`}>{state.label}</span>
              </div>
            );
          })}
          {visibleTodayFixtures.length === 0 && <p className="empty">No hay partidos que coincidan con este filtro.</p>}
        </div>
      </section>

      <section className="candidates">
        <div className="section-title-row">
          <div>
            <div className="eyebrow">PICKS QUE PASAN EL FILTRO</div>
            <h2>{category === "all" ? "Todas las categorías" : CATEGORY_LABELS[category]}</h2>
          </div>
          <span className="count">{filteredCandidates.length}</span>
        </div>

        <div className="candidate-grid">
          {filteredCandidates.map((pick) => (
            <div className="candidate" key={`${pick.fixtureId}-${pick.market}`}>
              <div className="candidate-title">{pick.fixtureLabel}</div>
              <div className="candidate-market">{pick.marketLabel}</div>
              <div className="candidate-meta">
                <b>@{pick.odds.toFixed(2)}</b>
                <span>{pct(pick.probability)}</span>
                <span>{pick.score.toFixed(1)}/10</span>
                <span>valor +{Math.round((pick.probability - 1 / pick.odds) * 100)} pts</span>
              </div>
            </div>
          ))}
          {filteredCandidates.length === 0 && <p className="empty">Todavía no hay picks con cuota real que pasen a la vez 70%+, nota 8.0+, rango de cuota y valor. Mira “Confianza del motor” para ver dónde se queda cada partido.</p>}
        </div>
      </section>


      <section className="analyzed-section">
        <div className="section-title-row">
          <div>
            <div className="eyebrow">🔎 PARTIDOS ANALIZADOS</div>
            <h2>Qué ha visto el motor</h2>
            <p>Se muestran incluso los que no entran. Si no llega cuota real, verás una cuota justa estimada del motor marcada como EST.; nunca se presenta como precio real de Bet365.</p>
          </div>
          <span className="count">{visibleAnalyzed.length}</span>
        </div>

        <div className="analyzed-grid">
          {visibleAnalyzed.map((item) => (
            <article className={`analyzed-card status-${item.status.toLowerCase().replace("_", "-")}`} key={item.fixtureId}>
              <div className="analyzed-head">
                <div>
                  <div className="analyzed-title">{item.fixtureLabel}</div>
                  <div className="analyzed-league">{item.leagueName}</div>
                </div>
                <span className="analyzed-status">{analyzedStatusLabel(item.status)}</span>
              </div>
              <div className="analyzed-market">💎 {item.bestMarketLabel}</div>
              {item.alternatives && item.alternatives.length > 0 && (
                <div className="market-alternatives">
                  <strong>También valora:</strong> {item.alternatives.map((alt) => `${alt.marketLabel} (${pct(alt.probability)} · ${alt.score.toFixed(1)}/10 · ${oddsText(alt.odds, alt.realOdds)})`).join(" · ")}
                </div>
              )}
              <div className="analyzed-metrics">
                <span>🧠 {pct(item.probability)}</span>
                <span>💙 {item.score !== undefined ? `${item.score.toFixed(1)}/10` : "Nota pendiente"}</span>
                <span>💰 {oddsText(item.odds, item.realOdds)}</span>
              </div>
              <p>{item.explanation}</p>
            </article>
          ))}
        </div>
      </section>

      {data.warnings.length > 0 && (
        <section className="warnings">
          {data.warnings.slice(0, 6).map((warning, i) => <p key={i}>ℹ️ {warning}</p>)}
        </section>
      )}

      <footer>Futbolylicts-AI · Pronósticos probabilísticos · +18 · Juega con responsabilidad</footer>
    </main>
  );
}
