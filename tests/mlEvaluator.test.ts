import { describe, expect, it } from "vitest";
import { marketWon } from "@/lib/ml/evaluator";
import type { MarketKey } from "@/lib/engine/types";

type Case = [MarketKey, [number, number], [number, number]];

const cases: Case[] = [
  ["HOME_WIN", [2, 1], [1, 1]],
  ["AWAY_WIN", [1, 2], [1, 1]],
  ["DOUBLE_CHANCE_1X", [1, 1], [0, 1]],
  ["DOUBLE_CHANCE_X2", [1, 1], [1, 0]],
  ["DOUBLE_CHANCE_12", [1, 0], [1, 1]],
  ["OVER_0_5", [1, 0], [0, 0]],
  ["OVER_1_5", [1, 1], [1, 0]],
  ["OVER_2_5", [2, 1], [1, 1]],
  ["BTTS_YES", [1, 1], [2, 0]],
  ["HOME_OVER_0_5", [1, 0], [0, 2]],
  ["AWAY_OVER_0_5", [0, 1], [2, 0]],
  ["HOME_OVER_1_5", [2, 0], [1, 3]],
  ["AWAY_OVER_1_5", [0, 2], [3, 1]],
  ["COMBO_1X_OVER_1_5", [1, 1], [0, 2]],
  ["COMBO_X2_OVER_1_5", [1, 1], [2, 0]],
  ["COMBO_12_OVER_1_5", [2, 0], [1, 1]],
  ["COMBO_1X_OVER_2_5", [2, 1], [1, 1]],
  ["COMBO_X2_OVER_2_5", [1, 2], [2, 1]],
  ["COMBO_12_OVER_2_5", [2, 1], [2, 2]],
  ["COMBO_HOME_WIN_OVER_1_5", [2, 0], [1, 1]],
  ["COMBO_AWAY_WIN_OVER_1_5", [0, 2], [1, 1]],
  ["COMBO_HOME_WIN_OVER_2_5", [2, 1], [1, 2]],
  ["COMBO_AWAY_WIN_OVER_2_5", [1, 2], [2, 1]],
];

describe("historial ML: liquidación de todos los mercados", () => {
  it.each(cases)("%s tiene un caso de acierto y uno de fallo", (market, win, lose) => {
    expect(marketWon(market, win[0], win[1])).toBe(true);
    expect(marketWon(market, lose[0], lose[1])).toBe(false);
  });

  it("un combinado no cuenta como medio acierto", () => {
    expect(marketWon("COMBO_1X_OVER_1_5", 1, 0)).toBe(false); // gana 1X, falla +1.5
    expect(marketWon("COMBO_1X_OVER_1_5", 0, 2)).toBe(false); // gana +1.5, falla 1X
    expect(marketWon("COMBO_1X_OVER_1_5", 1, 1)).toBe(true);  // se cumplen ambas
  });
});
