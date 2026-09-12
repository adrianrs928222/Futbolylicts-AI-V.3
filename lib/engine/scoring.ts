import { competitionCategory } from "@/lib/config/competitions";
import { FUTBOLYLICTS_RULES } from "@/lib/config/rules";
import type { Confidence, EnrichedFixture, MarketCandidate, MarketKey } from "@/lib/engine/types";
import { isOfficialCandidateEligible } from "@/lib/engine/eligibility";
import {
  bttsProbability,
  clamp,
  outcomeProbabilities,
  overProbability,
  poissonProbability,
  teamOverProbability,
} from "@/lib/engine/math";

function confidenceFromMetrics(score: number, probability: number): Confidence {
  if (score >= 9 && probability >= 0.78) return "MUY_ALTA";
  if (score >= 8 && probability >= 0.70) return "ALTA";
  if (score >= 7.5 && probability >= 0.65) return "MEDIA_ALTA";
  if (score >= 7 && probability >= 0.58) return "MEDIA";
  return "BAJA";
}

function expectedGoals(fixture: EnrichedFixture) {
  const homeAttack = fixture.homeForm.goalsForPerGame;
  const homeDefenceLeak = fixture.homeForm.goalsAgainstPerGame;
  const awayAttack = fixture.awayForm.goalsForPerGame;
  const awayDefenceLeak = fixture.awayForm.goalsAgainstPerGame;

  let lambdaHome = clamp(homeAttack * 0.58 + awayDefenceLeak * 0.42, 0.25, 3.2);
  let lambdaAway = clamp(awayAttack * 0.58 + homeDefenceLeak * 0.42, 0.25, 3.2);

  const ppgGap = fixture.homeForm.pointsPerGame - fixture.awayForm.pointsPerGame;
  lambdaHome *= clamp(1 + ppgGap * 0.055, 0.84, 1.16);
  lambdaAway *= clamp(1 - ppgGap * 0.055, 0.84, 1.16);

  if (fixture.standings?.homeRank && fixture.standings?.awayRank) {
    const rankGap = fixture.standings.awayRank - fixture.standings.homeRank;
    lambdaHome *= clamp(1 + rankGap * 0.008, 0.9, 1.12);
    lambdaAway *= clamp(1 - rankGap * 0.008, 0.9, 1.12);
  }
  return { lambdaHome, lambdaAway };
}

function jointScorelineProbability(
  lambdaHome: number,
  lambdaAway: number,
  predicate: (homeGoals: number, awayGoals: number) => boolean,
  maxGoals = 10,
) {
  let matched = 0;
  let total = 0;
  for (let h = 0; h <= maxGoals; h += 1) {
    const ph = poissonProbability(lambdaHome, h);
    for (let a = 0; a <= maxGoals; a += 1) {
      const p = ph * poissonProbability(lambdaAway, a);
      total += p;
      if (predicate(h, a)) matched += p;
    }
  }
  return total > 0 ? matched / total : 0;
}

export function isSameGameComboMarket(market: MarketKey) {
  return market.startsWith("COMBO_");
}

function oddsCalibration(market: MarketKey) {
  const cfg = FUTBOLYLICTS_RULES.estimatedOdds;
  if (isSameGameComboMarket(market)) return { anchor: 0.46, reliability: cfg.comboReliability, overround: cfg.comboOverround };
  if (["HOME_WIN", "AWAY_WIN"].includes(market)) return { anchor: 0.50, reliability: cfg.winnerReliability, overround: cfg.winnerOverround };
  if (["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "DOUBLE_CHANCE_12"].includes(market)) return { anchor: 0.50, reliability: cfg.doubleChanceReliability, overround: cfg.doubleChanceOverround };
  if (market === "BTTS_YES") return { anchor: 0.50, reliability: cfg.bttsReliability, overround: cfg.bttsOverround };
  if (["HOME_OVER_0_5", "AWAY_OVER_0_5", "HOME_OVER_1_5", "AWAY_OVER_1_5"].includes(market)) {
    return { anchor: 0.50, reliability: cfg.teamTotalsReliability, overround: cfg.teamTotalsOverround };
  }
  return { anchor: 0.50, reliability: cfg.totalsReliability, overround: cfg.totalsOverround };
}

/**
 * Cuota EST. estilo bookmaker.
 *
 * No es 1/probabilidad. Primero suaviza la probabilidad del modelo hacia un
 * precio de mercado más conservador y después añade un margen. Los Bet Builders
 * reciben una calibración propia porque dos condiciones correlacionadas no deben
 * tratarse como apuestas independientes.
 */
export function estimatedModelOdds(probability: number, market: MarketKey = "OVER_1_5"): number {
  const p = clamp(probability, 0.05, 0.95);
  const { anchor, reliability, overround } = oddsCalibration(market);
  const marketProbability = clamp(anchor + (p - anchor) * reliability, 0.06, 0.92);
  const offeredImplied = clamp(marketProbability * overround, 0.07, 0.94);
  const decimal = 1 / offeredImplied;
  return Math.round(clamp(decimal, 1.06, 12) * 100) / 100;
}

export function marketProbability(market: MarketKey, fixture: EnrichedFixture): number {
  const { lambdaHome, lambdaAway } = expectedGoals(fixture);
  const outcomes = outcomeProbabilities(lambdaHome, lambdaAway);
  const total = lambdaHome + lambdaAway;
  switch (market) {
    case "HOME_WIN": return outcomes.home;
    case "AWAY_WIN": return outcomes.away;
    case "DOUBLE_CHANCE_1X": return outcomes.home + outcomes.draw;
    case "DOUBLE_CHANCE_X2": return outcomes.away + outcomes.draw;
    case "DOUBLE_CHANCE_12": return outcomes.home + outcomes.away;
    case "OVER_0_5": return overProbability(total, 0.5);
    case "OVER_1_5": return overProbability(total, 1.5);
    case "OVER_2_5": return overProbability(total, 2.5);
    case "OVER_3_5": return overProbability(total, 3.5);
    case "OVER_4_5": return overProbability(total, 4.5);
    case "BTTS_YES": return bttsProbability(lambdaHome, lambdaAway);
    case "HOME_OVER_0_5": return teamOverProbability(lambdaHome, 0.5);
    case "AWAY_OVER_0_5": return teamOverProbability(lambdaAway, 0.5);
    case "HOME_OVER_1_5": return teamOverProbability(lambdaHome, 1.5);
    case "AWAY_OVER_1_5": return teamOverProbability(lambdaAway, 1.5);
    case "COMBO_1X_OVER_1_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h >= a && h + a >= 2);
    case "COMBO_X2_OVER_1_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => a >= h && h + a >= 2);
    case "COMBO_12_OVER_1_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h !== a && h + a >= 2);
    case "COMBO_1X_OVER_2_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h >= a && h + a >= 3);
    case "COMBO_X2_OVER_2_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => a >= h && h + a >= 3);
    case "COMBO_12_OVER_2_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h !== a && h + a >= 3);
    case "COMBO_HOME_WIN_OVER_1_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h > a && h + a >= 2);
    case "COMBO_AWAY_WIN_OVER_1_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => a > h && h + a >= 2);
    case "COMBO_HOME_WIN_OVER_2_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => h > a && h + a >= 3);
    case "COMBO_AWAY_WIN_OVER_2_5": return jointScorelineProbability(lambdaHome, lambdaAway, (h, a) => a > h && h + a >= 3);
  }
}

export function marketLabel(market: MarketKey, fixture: EnrichedFixture): string {
  const home = fixture.fixture.home.name;
  const away = fixture.fixture.away.name;
  switch (market) {
    case "HOME_WIN": return `Gana ${home}`;
    case "AWAY_WIN": return `Gana ${away}`;
    case "DOUBLE_CHANCE_1X": return `${home} o empate (1X)`;
    case "DOUBLE_CHANCE_X2": return `Empate o ${away} (X2)`;
    case "DOUBLE_CHANCE_12": return `${home} o ${away} (12)`;
    case "OVER_0_5": return "Más de 0.5 goles";
    case "OVER_1_5": return "Más de 1.5 goles";
    case "OVER_2_5": return "Más de 2.5 goles";
    case "OVER_3_5": return "Más de 3.5 goles";
    case "OVER_4_5": return "Más de 4.5 goles";
    case "BTTS_YES": return "Ambos marcan: Sí";
    case "HOME_OVER_0_5": return `${home} marca +0.5`;
    case "AWAY_OVER_0_5": return `${away} marca +0.5`;
    case "HOME_OVER_1_5": return `${home} marca +1.5`;
    case "AWAY_OVER_1_5": return `${away} marca +1.5`;
    case "COMBO_1X_OVER_1_5": return `1X + Más de 1.5 goles`;
    case "COMBO_X2_OVER_1_5": return `X2 + Más de 1.5 goles`;
    case "COMBO_12_OVER_1_5": return `12 + Más de 1.5 goles`;
    case "COMBO_1X_OVER_2_5": return `1X + Más de 2.5 goles`;
    case "COMBO_X2_OVER_2_5": return `X2 + Más de 2.5 goles`;
    case "COMBO_12_OVER_2_5": return `12 + Más de 2.5 goles`;
    case "COMBO_HOME_WIN_OVER_1_5": return `${home} gana + Más de 1.5 goles`;
    case "COMBO_AWAY_WIN_OVER_1_5": return `${away} gana + Más de 1.5 goles`;
    case "COMBO_HOME_WIN_OVER_2_5": return `${home} gana + Más de 2.5 goles`;
    case "COMBO_AWAY_WIN_OVER_2_5": return `${away} gana + Más de 2.5 goles`;
  }
}

function hasWinnerCondition(market: MarketKey) {
  return ["HOME_WIN", "AWAY_WIN", "COMBO_HOME_WIN_OVER_1_5", "COMBO_AWAY_WIN_OVER_1_5", "COMBO_HOME_WIN_OVER_2_5", "COMBO_AWAY_WIN_OVER_2_5"].includes(market);
}
function hasOver25Condition(market: MarketKey) {
  return ["OVER_2_5", "OVER_3_5", "OVER_4_5", "COMBO_1X_OVER_2_5", "COMBO_X2_OVER_2_5", "COMBO_12_OVER_2_5", "COMBO_HOME_WIN_OVER_2_5", "COMBO_AWAY_WIN_OVER_2_5"].includes(market);
}

function competitionPenalty(fixture: EnrichedFixture, market: MarketKey): number {
  const category = competitionCategory(fixture.fixture.league.name);
  const round = (fixture.fixture.round ?? "").toLowerCase();
  let penalty = 0;
  if (category === "national_cup") {
    penalty += hasWinnerCondition(market) ? 0.24 : 0.08;
    if (/final|semi|quarter|round of 16|octavos|cuartos|semifinal/.test(round)) penalty -= 0.03;
  }
  if (["champions", "europa", "conference"].includes(category)) {
    if (/qualif|play-off|knockout|round of 16|quarter|semi|final/.test(round)) {
      if (hasWinnerCondition(market)) penalty += 0.06;
      if (market === "BTTS_YES" || hasOver25Condition(market)) penalty += 0.04;
    }
  }
  if (fixture.homeForm.matches < 5 || fixture.awayForm.matches < 5) penalty += 0.18;
  if (market === "DOUBLE_CHANCE_12") penalty += 0.02;
  if (isSameGameComboMarket(market)) penalty += 0.06;
  return penalty;
}

function competitionPhrase(fixture: EnrichedFixture) {
  const category = competitionCategory(fixture.fixture.league.name);
  const round = fixture.fixture.round ? ` (${fixture.fixture.round})` : "";
  if (category === "national_cup") return `Es copa${round}, así que existe algo más de riesgo por rotaciones.`;
  if (category === "champions") return `Es Champions${round}; el contexto europeo pesa en la lectura.`;
  if (category === "europa") return `Es Europa League${round}; se tiene en cuenta la gestión táctica.`;
  if (category === "conference") return `Es Conference League${round}; se tiene en cuenta la gestión táctica.`;
  return `En liga pesan sobre todo la forma, el perfil de goles y la clasificación.`;
}

function buildRiskNote(market: MarketKey, fixture: EnrichedFixture, probability: number): string {
  const category = competitionCategory(fixture.fixture.league.name);
  const risks: string[] = [];
  if (probability < 0.76) risks.push("el margen es bueno, pero no enorme");
  if (Math.min(fixture.homeForm.matches, fixture.awayForm.matches) < 6) risks.push("la muestra reciente es algo corta");
  if (category === "national_cup") risks.push("una rotación fuerte puede cambiar el guion");
  if (market === "BTTS_YES") risks.push("una portería a cero rompe el BTTS");
  if (hasOver25Condition(market)) risks.push("un ritmo más bajo puede dejar el partido en uno o dos goles");
  if (hasWinnerCondition(market)) risks.push("el empate no sirve para la condición de ganador");
  if (market === "DOUBLE_CHANCE_12") risks.push("el empate es el único resultado que hace fallar el 12");
  if (isSameGameComboMarket(market)) risks.push("deben cumplirse las dos condiciones del combinado");
  return risks.length ? `${risks.slice(0, 2).join("; ")}.` : "No aparece un riesgo dominante con los datos disponibles.";
}

function buildReasoning(market: MarketKey, fixture: EnrichedFixture): string {
  const hf = fixture.homeForm;
  const af = fixture.awayForm;
  const home = fixture.fixture.home.name;
  const away = fixture.fixture.away.name;
  const context = competitionPhrase(fixture);
  switch (market) {
    case "HOME_WIN": return `${home} llega con mejor equilibrio de resultados y producción. ${context}`;
    case "AWAY_WIN": return `${away} llega con mejor equilibrio de resultados y producción pese a jugar fuera. ${context}`;
    case "DOUBLE_CHANCE_1X": return `${home} tiene un perfil suficientemente estable como para cubrir victoria o empate sin exigir que gane. ${context}`;
    case "DOUBLE_CHANCE_X2": return `${away} tiene argumentos para no perder y el X2 protege también el empate. ${context}`;
    case "DOUBLE_CHANCE_12": return `El partido presenta un perfil de victoria/derrota más claro que de empate; el 12 cubre a los dos ganadores. ${context}`;
    case "BTTS_YES": return `Los dos equipos muestran capacidad para marcar y también conceden con frecuencia. El 1-1 queda protegido, algo que +2.5 no cubre. ${context}`;
    case "OVER_2_5": return `El volumen de gol reciente es alto y hay vías para llegar a tres goles incluso si uno de los dos equipos lleva casi todo el peso ofensivo. ${context}`;
    case "OVER_3_5": return `El partido proyecta un ritmo ofensivo alto y cuatro goles tienen respaldo suficiente para competir con líneas más conservadoras de cuota demasiado baja. ${context}`;
    case "OVER_4_5": return `La proyección es excepcionalmente ofensiva; cinco goles solo entran cuando la confianza y la cuota compensan claramente el salto de riesgo. ${context}`;
    case "OVER_1_5": return `Dos goles tienen varias vías de entrada y esta línea ofrece más cobertura que exigir ganador o tres goles. ${context}`;
    case "HOME_OVER_0_5": return `${home} marca con regularidad; pedir un solo gol evita depender del resultado final. ${context}`;
    case "AWAY_OVER_0_5": return `${away} marca con regularidad; pedir un solo gol evita depender del resultado final. ${context}`;
    case "HOME_OVER_1_5": return `${home} tiene suficiente producción ofensiva para buscar dos goles sin depender de que gane el partido. ${context}`;
    case "AWAY_OVER_1_5": return `${away} tiene suficiente producción ofensiva para buscar dos goles sin depender de que gane el partido. ${context}`;
    case "COMBO_1X_OVER_1_5": return `${home} no perder + dos goles totales encaja con el guion más probable. La probabilidad conjunta se calcula directamente sobre marcadores posibles, no multiplicando mercados. ${context}`;
    case "COMBO_X2_OVER_1_5": return `${away} no perder + dos goles totales encaja con el guion más probable. La probabilidad conjunta se calcula directamente sobre marcadores posibles. ${context}`;
    case "COMBO_12_OVER_1_5": return `El empate pierde peso y, además, el partido tiene suficientes vías para alcanzar dos goles. El 12 y +1.5 se evalúan como un único escenario conjunto. ${context}`;
    case "COMBO_1X_OVER_2_5": return `${home} no perder y tres goles o más ofrece una cuota útil, pero solo entra si ambas condiciones siguen siendo fuertes por separado. ${context}`;
    case "COMBO_X2_OVER_2_5": return `${away} no perder y tres goles o más ofrece una cuota útil, pero solo entra si ambas condiciones siguen siendo fuertes por separado. ${context}`;
    case "COMBO_12_OVER_2_5": return `El empate se considera secundario y el partido tiene perfil de tres goles o más. El combinado cubre tanto 2-1/1-2 como 3-0/0-3. ${context}`;
    case "COMBO_HOME_WIN_OVER_1_5": return `${home} tiene ventaja suficiente y el partido presenta buenas vías para dos goles. La condición extra solo se acepta si la cuota compensa el riesgo. ${context}`;
    case "COMBO_AWAY_WIN_OVER_1_5": return `${away} tiene ventaja suficiente y el partido presenta buenas vías para dos goles. La condición extra solo se acepta si la cuota compensa el riesgo. ${context}`;
    case "COMBO_HOME_WIN_OVER_2_5": return `${home} puede ganar en un partido abierto; se exigen tres goles solo cuando el salto de cuota compensa la pérdida de cobertura. ${context}`;
    case "COMBO_AWAY_WIN_OVER_2_5": return `${away} puede ganar en un partido abierto; se exigen tres goles solo cuando el salto de cuota compensa la pérdida de cobertura. ${context}`;
    default: return `${home} – ${away}: la selección combina forma, producción y contexto.`;
  }
}

function marketEvidenceSupport(market: MarketKey, fixture: EnrichedFixture): number {
  const hf = fixture.homeForm;
  const af = fixture.awayForm;
  const homeNonLoss = hf.matches ? (hf.wins + hf.draws) / hf.matches : 0.5;
  const awayNonLoss = af.matches ? (af.wins + af.draws) / af.matches : 0.5;
  const homeWin = hf.matches ? hf.wins / hf.matches : 0.35;
  const awayWin = af.matches ? af.wins / af.matches : 0.35;
  const noDraw = 1 - ((hf.matches ? hf.draws / hf.matches : 0.3) + (af.matches ? af.draws / af.matches : 0.3)) / 2;
  const over15 = (hf.over15Pct + af.over15Pct) / 2;
  const over25 = (hf.over25Pct + af.over25Pct) / 2;
  const btts = (hf.bttsPct + af.bttsPct + hf.scoringPct + af.scoringPct + hf.concededPct + af.concededPct) / 6;
  const homeScores = (hf.scoringPct + af.concededPct) / 2;
  const awayScores = (af.scoringPct + hf.concededPct) / 2;
  const homeTwo = clamp((hf.goalsForPerGame / 2.0) * 0.6 + homeScores * 0.4, 0, 1);
  const awayTwo = clamp((af.goalsForPerGame / 2.0) * 0.6 + awayScores * 0.4, 0, 1);

  switch (market) {
    case "HOME_WIN": return homeWin;
    case "AWAY_WIN": return awayWin;
    case "DOUBLE_CHANCE_1X": return homeNonLoss;
    case "DOUBLE_CHANCE_X2": return awayNonLoss;
    case "DOUBLE_CHANCE_12": return noDraw;
    case "OVER_0_5": return Math.max(homeScores, awayScores);
    case "OVER_1_5": return over15;
    case "OVER_2_5": return over25;
    case "OVER_3_5": return clamp(over25 * 0.82, 0, 1);
    case "OVER_4_5": return clamp(over25 * 0.66, 0, 1);
    case "BTTS_YES": return btts;
    case "HOME_OVER_0_5": return homeScores;
    case "AWAY_OVER_0_5": return awayScores;
    case "HOME_OVER_1_5": return homeTwo;
    case "AWAY_OVER_1_5": return awayTwo;
    case "COMBO_1X_OVER_1_5": return Math.min(homeNonLoss, over15);
    case "COMBO_X2_OVER_1_5": return Math.min(awayNonLoss, over15);
    case "COMBO_12_OVER_1_5": return Math.min(noDraw, over15);
    case "COMBO_1X_OVER_2_5": return Math.min(homeNonLoss, over25);
    case "COMBO_X2_OVER_2_5": return Math.min(awayNonLoss, over25);
    case "COMBO_12_OVER_2_5": return Math.min(noDraw, over25);
    case "COMBO_HOME_WIN_OVER_1_5": return Math.min(homeWin, over15);
    case "COMBO_AWAY_WIN_OVER_1_5": return Math.min(awayWin, over15);
    case "COMBO_HOME_WIN_OVER_2_5": return Math.min(homeWin, over25);
    case "COMBO_AWAY_WIN_OVER_2_5": return Math.min(awayWin, over25);
  }
}

export function statisticalMarketScore(market: MarketKey, fixture: EnrichedFixture): number {
  const probability = clamp(marketProbability(market, fixture), 0.01, 0.99);
  const sampleStability = clamp(Math.min(fixture.homeForm.matches, fixture.awayForm.matches) / 8, 0.55, 1);
  const evidence = marketEvidenceSupport(market, fixture);
  let score = 6 + (probability - 0.5) * 8;
  score += (sampleStability - 0.75) * 0.7;
  // La nota no es la probabilidad: si la muestra reciente apoya de forma clara
  // el mismo guion, el mercado puede tener nota ALTA incluso cerca del 70%.
  score += clamp((evidence - 0.55) * 1.2, -0.18, 0.45);
  score -= competitionPenalty(fixture, market);
  return clamp(score, 0, 10);
}

export const PRICING_MARKETS: MarketKey[] = [
  "HOME_WIN", "AWAY_WIN", "DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "DOUBLE_CHANCE_12",
  "OVER_0_5", "OVER_1_5", "OVER_2_5", "OVER_3_5", "OVER_4_5", "BTTS_YES",
  "HOME_OVER_0_5", "AWAY_OVER_0_5", "HOME_OVER_1_5", "AWAY_OVER_1_5",
];

export const ANALYSIS_MARKETS: MarketKey[] = [
  ...PRICING_MARKETS,
  "COMBO_1X_OVER_1_5", "COMBO_X2_OVER_1_5",
  "COMBO_1X_OVER_2_5", "COMBO_X2_OVER_2_5", "COMBO_12_OVER_2_5",
  "COMBO_HOME_WIN_OVER_1_5", "COMBO_AWAY_WIN_OVER_1_5",
  "COMBO_HOME_WIN_OVER_2_5", "COMBO_AWAY_WIN_OVER_2_5",
];

function oddsUsefulness(odds: number) {
  if (odds >= FUTBOLYLICTS_RULES.preferredOddsSweetMin && odds <= FUTBOLYLICTS_RULES.preferredOddsSweetMax) return 1;
  if (odds >= FUTBOLYLICTS_RULES.preferredOddsMin && odds <= FUTBOLYLICTS_RULES.preferredOddsMax) return 0.7;
  if (odds < FUTBOLYLICTS_RULES.preferredOddsMin) return Math.max(-0.5, (odds - FUTBOLYLICTS_RULES.preferredOddsMin) * 2.5);
  return Math.max(-0.5, (FUTBOLYLICTS_RULES.preferredOddsMax - odds) * 1.5);
}

export function candidateIntelligence(candidate: MarketCandidate): number {
  const market = candidate.market;
  const odds = candidate.odds ?? 1;
  const probability = candidate.probability ?? 0;
  const score = candidate.score ?? 0;

  // Valor global: probabilidad + confianza + cuota.
  // Ningún mercado tiene prioridad por defecto.
  let value =
    probability * 30 +
    score * 4 +
    Math.log(Math.max(odds, 1.01)) * 15;

  // Penaliza cuotas demasiado exprimidas.
  if (odds < 1.20) value -= 35;
  if (odds < 1.30) value -= 12;

  // Líneas de goles: +2.5, +3.5 y +4.5 compiten entre sí.
  if (market === "OVER_2_5") {
    value += 1;
    if (odds < 1.40) value -= 8;
  }

  if (market === "OVER_3_5") {
    value += 5;
    if (odds >= 1.50) value += 3;
  }

  if (market === "OVER_4_5") {
    value += 3;
    if (odds >= 1.80) value += 4;
  }

  // Mercados de equipo: útiles para favoritos fuertes.
  if (market === "HOME_OVER_1_5" || market === "AWAY_OVER_1_5") {
    value += 9;
  }

  if (market === "HOME_OVER_0_5" || market === "AWAY_OVER_0_5") {
    value += 3;
  }

  // Combinados con sentido.
  if (
    market === "COMBO_HOME_WIN_OVER_1_5" ||
    market === "COMBO_AWAY_WIN_OVER_1_5"
  ) {
    value += 7;
  }

  if (
    market === "COMBO_HOME_WIN_OVER_2_5" ||
    market === "COMBO_AWAY_WIN_OVER_2_5"
  ) {
    value += 4;
  }

  // BTTS solo si la cuota aporta valor.
  if (market === "BTTS_YES" && odds >= 1.40) {
    value += 4;
  }

  // Un combinado no gana solo por tener más cuota.
  if (isSameGameComboMarket(market)) {
    value -= 1.5;
  }

  // Zona objetivo.
  if (odds >= 1.30 && odds <= 1.90) {
    value += 5;
  }

  return value;
}

export function compareIntelligentCandidates(a: MarketCandidate, b: MarketCandidate) {
  const scoreGap = b.score - a.score;
  if (Math.abs(scoreGap) > FUTBOLYLICTS_RULES.scoreTieTolerance) return scoreGap;
  return candidateIntelligence(b) - candidateIntelligence(a) || b.probability - a.probability;
}

function buildComparisonReason(top: MarketCandidate, options: MarketCandidate[]): string {
  const runner = options.find((candidate) => candidate.market !== top.market);
  const btts = options.find((candidate) => candidate.market === "BTTS_YES");
  const over25 = options.find((candidate) => candidate.market === "OVER_2_5");

  if (top.market === "BTTS_YES" && over25) {
    return `BTTS queda por delante de +2.5: protege el 1-1 y el equilibrio entre ambos ataques es más convincente que depender de un tercer gol.`;
  }
  if (top.market === "OVER_2_5" && btts) {
    return `+2.5 queda por delante de BTTS: también cubre marcadores como 3-0 o 0-3, útiles cuando uno de los dos puede concentrar gran parte del gol.`;
  }
  if (isSameGameComboMarket(top.market)) {
    const runnerText = runner ? ` Frente a ${runner.marketLabel},` : "";
    return `${runnerText} el combinado mantiene nivel ALTA/MUY ALTA y la mejora de cuota estimada compensa la condición extra; si no compensara, el motor se quedaría con el mercado simple.`.trim();
  }
  if (runner) {
    return `${top.marketLabel} ofrece el mejor equilibrio entre cobertura, estabilidad y cuota. ${runner.marketLabel} queda como segunda opción, pero no mejora el conjunto lo suficiente.`;
  }
  return `Es la opción más equilibrada que encuentra el motor para este partido.`;
}

/** Genera y sobreanaliza todos los mercados permitidos del partido. */
export function scoreMarkets(fixture: EnrichedFixture): MarketCandidate[] {
  const candidates: MarketCandidate[] = ANALYSIS_MARKETS.map((market) => {
    const probability = clamp(marketProbability(market, fixture), 0.01, 0.99);
    const score = statisticalMarketScore(market, fixture);
    return {
      fixtureId: fixture.fixture.id,
      fixtureLabel: `${fixture.fixture.home.name} – ${fixture.fixture.away.name}`,
      leagueName: fixture.fixture.league.name,
      category: fixture.category,
      market,
      marketLabel: marketLabel(market, fixture),
      odds: estimatedModelOdds(probability, market),
      bookmaker: "Modelo calibrado",
      realOdds: false,
      probability,
      score,
      confidence: confidenceFromMetrics(score, probability),
      reasoning: buildReasoning(market, fixture),
      riskNote: buildRiskNote(market, fixture, probability),
      homeLogo: fixture.fixture.home.logo,
      awayLogo: fixture.fixture.away.logo,
    } satisfies MarketCandidate;
  });

  const ranked = [...candidates].sort(compareIntelligentCandidates);
  const top = ranked.find(isOfficialCandidateEligible) ?? ranked[0];
  if (top) {
    const comparisonPool = [top, ...ranked.filter((candidate) => candidate.market !== top.market)];
    top.comparisonReason = buildComparisonReason(top, comparisonPool);
    top.alternatives = ranked
      .filter((candidate) => candidate.market !== top.market)
      .slice(0, 4)
      .map((candidate) => ({
        market: candidate.market,
        marketLabel: candidate.marketLabel,
        probability: candidate.probability,
        score: candidate.score,
        odds: candidate.odds,
      }));
  }
  return candidates;
}

function pricingUtility(market: MarketKey, probability: number): number {
  const odds = estimatedModelOdds(probability, market);
  const coverageBonus = ["DOUBLE_CHANCE_1X", "DOUBLE_CHANCE_X2", "OVER_1_5", "HOME_OVER_0_5", "AWAY_OVER_0_5"].includes(market) ? 0.12 : 0;
  const comboPenalty = isSameGameComboMarket(market) ? 0.12 : 0;
  const tinyOddsPenalty = market === "OVER_0_5" ? 0.55 : 0;
  return probability * 10 + oddsUsefulness(odds) + coverageBonus - comboPenalty - tinyOddsPenalty;
}

export function rankMarketsForPricing(fixture: EnrichedFixture): MarketKey[] {
  return PRICING_MARKETS
    .map((market) => ({ market, probability: clamp(marketProbability(market, fixture), 0.01, 0.99) }))
    .filter(({ probability }) => probability >= 0.52)
    .sort((a, b) => pricingUtility(b.market, b.probability) - pricingUtility(a.market, a.probability))
    .map(({ market }) => market);
}

export function rankMarketsForAnalysis(fixture: EnrichedFixture): MarketKey[] {
  const scored = scoreMarkets(fixture);
  return [...scored]
    .filter((candidate) => candidate.probability >= 0.52 && candidate.score >= 6.8)
    .sort(compareIntelligentCandidates)
    .map((candidate) => candidate.market);
}

export function fixturePricingPriority(fixture: EnrichedFixture): number {
  const ranked = rankMarketsForAnalysis(fixture).slice(0, 4);
  if (!ranked.length) return 0;
  return Math.max(...ranked.map((market) => {
    const probability = clamp(marketProbability(market, fixture), 0.01, 0.99);
    return pricingUtility(market, probability);
  }));
}
