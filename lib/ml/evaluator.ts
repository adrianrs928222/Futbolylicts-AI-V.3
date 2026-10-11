import type { MarketKey } from "@/lib/engine/types";

/**
 * Resuelve EXACTAMENTE el mercado que el motor recomendó.
 *
 * - Un mercado simple se evalúa por su propia condición.
 * - Un mercado combinado solo es ACIERTO cuando se cumplen TODAS sus patas.
 * - El switch es exhaustivo: si se añade un MarketKey nuevo al motor, TypeScript
 *   obliga a añadir aquí su regla de liquidación antes de poder compilar.
 */
export function marketWon(market: MarketKey, home: number, away: number, halftimeHome?: number, halftimeAway?: number): boolean {
  if (market.startsWith("HT_")) {
    if (halftimeHome === undefined || halftimeAway === undefined) throw new Error("Se necesita marcador al descanso para liquidar mercados HT");
    const htTotal = halftimeHome + halftimeAway;
    switch (market) {
      case "HT_OVER_0_5": return htTotal >= 1;
      case "HT_OVER_1_5": return htTotal >= 2;
      case "HT_HOME_WIN": return halftimeHome > halftimeAway;
      case "HT_DRAW": return halftimeHome === halftimeAway;
      case "HT_AWAY_WIN": return halftimeAway > halftimeHome;
      case "HT_DOUBLE_CHANCE_1X": return halftimeHome >= halftimeAway;
      case "HT_DOUBLE_CHANCE_X2": return halftimeAway >= halftimeHome;
    }
  }
  if (market === "SH_OVER_1_5") {
    if (halftimeHome === undefined || halftimeAway === undefined) throw new Error("Se necesita marcador al descanso para liquidar goles en segunda parte");
    return (home - halftimeHome) + (away - halftimeAway) >= 2;
  }
  const total = home + away;
  const homeWin = home > away;
  const awayWin = away > home;
  const draw = home === away;

  switch (market) {
    // Mercados HT tratados arriba (nunca usar marcador final como descanso).
    case "SH_OVER_1_5": throw new Error("Marcador al descanso no disponible");
    case "HT_OVER_0_5":
    case "HT_OVER_1_5":
    case "HT_HOME_WIN":
    case "HT_DRAW":
    case "HT_AWAY_WIN":
    case "HT_DOUBLE_CHANCE_1X":
    case "HT_DOUBLE_CHANCE_X2": throw new Error("Marcador al descanso no disponible");
    // Resultado simple
    case "HOME_WIN": return homeWin;
    case "AWAY_WIN": return awayWin;

    // Doble oportunidad simple
    case "DOUBLE_CHANCE_1X": return homeWin || draw;
    case "DOUBLE_CHANCE_X2": return awayWin || draw;
    case "DOUBLE_CHANCE_12": return !draw;

    // Goles simples
    case "OVER_0_5": return total > 0;
    case "OVER_1_5": return total > 1;
    case "OVER_2_5": return total > 2;
    case "BTTS_YES": return home > 0 && away > 0;
    case "HOME_OVER_0_5": return home > 0;
    case "AWAY_OVER_0_5": return away > 0;
    case "HOME_OVER_1_5": return home > 1;
    case "AWAY_OVER_1_5": return away > 1;

    // Gana cualquier mitad. Con el marcador final solo podemos confirmar de forma
    // conservadora los casos en los que el equipo ganó el partido: una diferencia
    // final positiva implica que ganó al menos una de las dos mitades.
    case "HOME_WIN_ANY_HALF": return homeWin;
    case "AWAY_WIN_ANY_HALF": return awayWin;

    // Combinados: TODAS las condiciones deben cumplirse
    case "COMBO_1X_OVER_1_5": return (homeWin || draw) && total > 1;
    case "COMBO_X2_OVER_1_5": return (awayWin || draw) && total > 1;
    case "COMBO_12_OVER_1_5": return !draw && total > 1;
    case "COMBO_1X_OVER_2_5": return (homeWin || draw) && total > 2;
    case "COMBO_X2_OVER_2_5": return (awayWin || draw) && total > 2;
    case "COMBO_12_OVER_2_5": return !draw && total > 2;
    case "COMBO_HOME_WIN_OVER_1_5": return homeWin && total > 1;
    case "COMBO_AWAY_WIN_OVER_1_5": return awayWin && total > 1;
    case "COMBO_HOME_WIN_OVER_2_5": return homeWin && total > 2;
    case "COMBO_AWAY_WIN_OVER_2_5": return awayWin && total > 2;
    case "COMBO_1X_UNDER_4_5": return (homeWin || draw) && total < 5;
    case "COMBO_X2_UNDER_4_5": return (awayWin || draw) && total < 5;

    case "COMBO_1X_UNDER_3_5": return (homeWin || draw) && total < 4;
    case "COMBO_X2_UNDER_3_5": return (awayWin || draw) && total < 4;
    case "COMBO_1X_OVER_0_5": return (homeWin || draw) && total > 0;
    case "COMBO_X2_OVER_0_5": return (awayWin || draw) && total > 0;
    case "COMBO_1X_OVER_1_5_UNDER_4_5": return (homeWin || draw) && total > 1 && total < 5;
    case "COMBO_X2_OVER_1_5_UNDER_4_5": return (awayWin || draw) && total > 1 && total < 5;

    default: {
      const exhaustiveCheck: never = market;
      return exhaustiveCheck;
    }
  }
}
