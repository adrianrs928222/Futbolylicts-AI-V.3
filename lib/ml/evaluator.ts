import type { MarketKey } from "@/lib/engine/types";

/**
 * Resuelve EXACTAMENTE el mercado que el motor recomendó.
 *
 * - Un mercado simple se evalúa por su propia condición.
 * - Un mercado combinado solo es ACIERTO cuando se cumplen TODAS sus patas.
 * - El switch es exhaustivo: si se añade un MarketKey nuevo al motor, TypeScript
 *   obliga a añadir aquí su regla de liquidación antes de poder compilar.
 */
export function marketWon(market: MarketKey, home: number, away: number): boolean {
  const total = home + away;
  const homeWin = home > away;
  const awayWin = away > home;
  const draw = home === away;

  switch (market) {
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
    case "OVER_3_5": return total > 3;
    case "OVER_4_5": return total > 4;
    case "BTTS_YES": return home > 0 && away > 0;
    case "HOME_OVER_0_5": return home > 0;
    case "AWAY_OVER_0_5": return away > 0;
    case "HOME_OVER_1_5": return home > 1;
    case "AWAY_OVER_1_5": return away > 1;

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

    default: {
      const exhaustiveCheck: never = market;
      return exhaustiveCheck;
    }
  }
}
