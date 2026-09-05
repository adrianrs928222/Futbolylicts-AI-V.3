import { competitionCategory } from "@/lib/config/competitions";
import type {
  Confidence,
  EnrichedFixture,
  MarketCandidate,
  MarketKey,
} from "@/lib/engine/types";
import {
  bttsProbability,
  clamp,
  outcomeProbabilities,
  overProbability,
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

export function marketProbability(market: MarketKey, fixture: EnrichedFixture): number {
  const { lambdaHome, lambdaAway } = expectedGoals(fixture);
  const outcomes = outcomeProbabilities(lambdaHome, lambdaAway);
  const total = lambdaHome + lambdaAway;

  switch (market) {
    case "HOME_WIN":
      return outcomes.home;
    case "AWAY_WIN":
      return outcomes.away;
    case "DOUBLE_CHANCE_1X":
      return outcomes.home + outcomes.draw;
    case "DOUBLE_CHANCE_X2":
      return outcomes.away + outcomes.draw;
    case "DOUBLE_CHANCE_12":
      return outcomes.home + outcomes.away;
    case "OVER_0_5":
      return overProbability(total, 0.5);
    case "OVER_1_5":
      return overProbability(total, 1.5);
    case "OVER_2_5":
      return overProbability(total, 2.5);
    case "BTTS_YES":
      return bttsProbability(lambdaHome, lambdaAway);
    case "HOME_OVER_0_5":
      return teamOverProbability(lambdaHome, 0.5);
    case "AWAY_OVER_0_5":
      return teamOverProbability(lambdaAway, 0.5);
    case "HOME_OVER_1_5":
      return teamOverProbability(lambdaHome, 1.5);
    case "AWAY_OVER_1_5":
      return teamOverProbability(lambdaAway, 1.5);
  }
}

function competitionPenalty(fixture: EnrichedFixture, market: MarketKey): number {
  const category = competitionCategory(fixture.fixture.league.name);
  const round = (fixture.fixture.round ?? "").toLowerCase();
  let penalty = 0;

  // Copa nacional: más riesgo de rotación y de partidos raros. Penalizamos más los ganadores puros.
  if (category === "national_cup") {
    penalty += market === "HOME_WIN" || market === "AWAY_WIN" ? 0.24 : 0.08;
    if (/final|semi|quarter|round of 16|octavos|cuartos|semifinal/.test(round)) {
      penalty -= 0.03; // fases importantes suelen reducir algo la incertidumbre de motivación.
    }
  }

  // Europa: partidos de eliminatoria pueden ser tácticos; no damos por hecho un perfil de liga.
  if (["champions", "europa", "conference"].includes(category)) {
    if (/qualif|play-off|knockout|round of 16|quarter|semi|final/.test(round)) {
      if (market === "HOME_WIN" || market === "AWAY_WIN") penalty += 0.06;
      if (market === "BTTS_YES" || market === "OVER_2_5") penalty += 0.04;
    }
  }

  if (fixture.homeForm.matches < 5 || fixture.awayForm.matches < 5) penalty += 0.18;
  if (market === "BTTS_YES") penalty += 0.08;
  if (market === "DOUBLE_CHANCE_12") penalty += 0.03;

  return penalty;
}

function competitionPhrase(fixture: EnrichedFixture) {
  const category = competitionCategory(fixture.fixture.league.name);
  const round = fixture.fixture.round ? ` (${fixture.fixture.round})` : "";
  if (category === "national_cup") return `Es partido de copa${round}, así que el motor penaliza algo más la rotación y los ganadores puros.`;
  if (category === "champions") return `Contexto Champions${round}: el motor trata el partido como europeo y no como una jornada de liga normal.`;
  if (category === "europa") return `Contexto Europa League${round}: se incorpora la posible gestión táctica propia de competición europea.`;
  if (category === "conference") return `Contexto Conference League${round}: se incorpora la posible gestión táctica propia de competición europea.`;
  return `Contexto de liga${round}: pesan especialmente forma, producción de goles y clasificación.`;
}

function buildRiskNote(market: MarketKey, fixture: EnrichedFixture, probability: number): string {
  const category = competitionCategory(fixture.fixture.league.name);
  const hf = fixture.homeForm;
  const af = fixture.awayForm;
  const risks: string[] = [];

  if (probability < 0.78) risks.push("la probabilidad es buena, pero no está entre las más fuertes del día");
  if (Math.min(hf.matches, af.matches) < 6) risks.push("la muestra reciente todavía es corta");
  if (category === "national_cup") risks.push("las rotaciones de copa pueden cambiar el guion del partido");
  if (["champions", "europa", "conference"].includes(category) && /qualif|play-off|knockout|round of 16|quarter|semi|final/i.test(fixture.fixture.round ?? "")) {
    risks.push("el contexto de eliminatoria puede volver el partido más táctico");
  }
  if (market === "BTTS_YES") risks.push("una portería a cero de cualquiera de los dos rompe el mercado");
  if (market === "OVER_2_5") risks.push("un partido más cerrado de lo previsto puede dejar la línea en solo 1–2 goles");
  if (market === "HOME_WIN" || market === "AWAY_WIN") risks.push("un empate basta para hacer fallar el ganador simple");
  if (market === "DOUBLE_CHANCE_12") risks.push("el empate es el único resultado que hace fallar el 12");

  return risks.length ? risks.slice(0, 2).join("; ") + "." : "No aparece un factor de riesgo dominante con los datos disponibles.";
}

function buildReasoning(market: MarketKey, fixture: EnrichedFixture, probability: number): string {
  const hf = fixture.homeForm;
  const af = fixture.awayForm;
  const pct = Math.round(probability * 100);
  const context = competitionPhrase(fixture);

  switch (market) {
    case "DOUBLE_CHANCE_12":
      return `El empate queda como escenario secundario. Forma: ${fixture.fixture.home.name} ${hf.pointsPerGame.toFixed(2)} PPG y ${fixture.fixture.away.name} ${af.pointsPerGame.toFixed(2)} PPG; probabilidad estimada de que gane uno de los dos: ${pct}%. ${context}`;
    case "BTTS_YES":
      return `Ambos tienen argumentos ofensivos: marcan en ${Math.round(hf.scoringPct * 100)}% y ${Math.round(af.scoringPct * 100)}% de la muestra, con BTTS reciente de ${Math.round(hf.bttsPct * 100)}% y ${Math.round(af.bttsPct * 100)}%. ${context}`;
    case "OVER_2_5":
      return `Perfil de goles alto: +2.5 reciente de ${Math.round(hf.over25Pct * 100)}% y ${Math.round(af.over25Pct * 100)}%, con medias totales de ${(hf.goalsForPerGame + hf.goalsAgainstPerGame).toFixed(2)} y ${(af.goalsForPerGame + af.goalsAgainstPerGame).toFixed(2)}. ${context}`;
    case "OVER_1_5":
      return `La línea +1.5 ofrece cobertura: frecuencias recientes de ${Math.round(hf.over15Pct * 100)}% y ${Math.round(af.over15Pct * 100)}%. ${context}`;
    case "HOME_OVER_0_5":
      return `${fixture.fixture.home.name} marca en ${Math.round(hf.scoringPct * 100)}% de la muestra reciente; pedir un gol evita depender del resultado. ${context}`;
    case "AWAY_OVER_0_5":
      return `${fixture.fixture.away.name} marca en ${Math.round(af.scoringPct * 100)}% de la muestra reciente; pedir un gol evita depender del resultado. ${context}`;
    default:
      return `La selección combina forma, producción/concesión, clasificación y contexto competitivo. Probabilidad estimada: ${pct}%. ${context}`;
  }
}

export function statisticalMarketScore(market: MarketKey, fixture: EnrichedFixture): number {
  const probability = clamp(marketProbability(market, fixture), 0.01, 0.99);
  const sampleStability = clamp(
    Math.min(fixture.homeForm.matches, fixture.awayForm.matches) / 8,
    0.55,
    1,
  );

  let score = 6 + (probability - 0.5) * 8;
  score += (sampleStability - 0.75) * 0.7;
  score -= competitionPenalty(fixture, market);
  return clamp(score, 0, 10);
}

export function scoreMarkets(fixture: EnrichedFixture): MarketCandidate[] {
  return fixture.odds.map((quote) => {
    const probability = clamp(marketProbability(quote.market, fixture), 0.01, 0.99);
    const implied = 1 / quote.decimal;
    const edge = probability - implied;

    let score = statisticalMarketScore(quote.market, fixture);
    score += clamp(edge * 4, -0.6, 0.6);
    score = clamp(score, 0, 10);

    return {
      fixtureId: fixture.fixture.id,
      fixtureLabel: `${fixture.fixture.home.name} – ${fixture.fixture.away.name}`,
      category: fixture.category,
      market: quote.market,
      marketLabel: quote.label,
      odds: quote.decimal,
      bookmaker: quote.bookmaker,
      realOdds: quote.real,
      probability,
      score,
      confidence: confidenceFromMetrics(score, probability),
      reasoning: buildReasoning(quote.market, fixture, probability),
      riskNote: buildRiskNote(quote.market, fixture, probability),
      homeLogo: fixture.fixture.home.logo,
      awayLogo: fixture.fixture.away.logo,
    };
  });
}


const PRICING_MARKETS: MarketKey[] = [
  "HOME_WIN",
  "AWAY_WIN",
  "DOUBLE_CHANCE_1X",
  "DOUBLE_CHANCE_X2",
  "DOUBLE_CHANCE_12",
  "OVER_0_5",
  "OVER_1_5",
  "OVER_2_5",
  "BTTS_YES",
  "HOME_OVER_0_5",
  "AWAY_OVER_0_5",
  "HOME_OVER_1_5",
  "AWAY_OVER_1_5",
];

function pricingUtility(market: MarketKey, probability: number): number {
  const fairOdds = 1 / Math.max(0.01, probability);
  let priceFit = 0;

  if (fairOdds >= 1.25 && fairOdds <= 1.75) priceFit = 1.0;
  else if (fairOdds < 1.25 && fairOdds >= 1.16) priceFit = 0.25;
  else if (fairOdds > 1.75 && fairOdds <= 2.15) priceFit = 0.2;
  else priceFit = -0.55;

  // Preferimos mercados que suelen aportar cuota útil sin perder cobertura.
  const coverageBonus =
    market === "DOUBLE_CHANCE_1X" ||
    market === "DOUBLE_CHANCE_X2" ||
    market === "OVER_1_5" ||
    market === "HOME_OVER_0_5" ||
    market === "AWAY_OVER_0_5"
      ? 0.18
      : 0;

  const valueBonus =
    market === "OVER_2_5" ||
    market === "BTTS_YES" ||
    market === "HOME_OVER_1_5" ||
    market === "AWAY_OVER_1_5" ||
    market === "DOUBLE_CHANCE_12"
      ? 0.12
      : 0;

  // +0.5 de partido suele pagar demasiado poco; solo sube si la probabilidad/precio lo justifican.
  const tinyOddsPenalty = market === "OVER_0_5" ? 0.45 : 0;

  return probability * 10 + priceFit + coverageBonus + valueBonus - tinyOddsPenalty;
}

export function rankMarketsForPricing(fixture: EnrichedFixture): MarketKey[] {
  return PRICING_MARKETS
    .map((market) => ({
      market,
      probability: clamp(marketProbability(market, fixture), 0.01, 0.99),
    }))
    .filter(({ probability }) => probability >= 0.52)
    .sort(
      (a, b) =>
        pricingUtility(b.market, b.probability) - pricingUtility(a.market, a.probability),
    )
    .map(({ market }) => market);
}

export function fixturePricingPriority(fixture: EnrichedFixture): number {
  const ranked = rankMarketsForPricing(fixture).slice(0, 4);
  if (!ranked.length) return 0;
  return Math.max(
    ...ranked.map((market) => {
      const probability = clamp(marketProbability(market, fixture), 0.01, 0.99);
      return pricingUtility(market, probability);
    }),
  );
}
