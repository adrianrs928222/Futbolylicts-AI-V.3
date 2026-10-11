import { describe, expect, it } from "vitest";
import { estimatedModelOdds } from "@/lib/engine/scoring";

describe("estimatedModelOdds v0.21", () => {
  it("no usa 1/probabilidad como precio final", () => {
    expect(estimatedModelOdds(.80, "OVER_1_5")).toBe(1.29);
    expect(estimatedModelOdds(.70, "OVER_1_5")).toBe(1.44);
  });

  it("aplica calibración específica a BTTS", () => {
    expect(estimatedModelOdds(.75, "BTTS_YES")).toBeGreaterThanOrEqual(1.35);
    expect(estimatedModelOdds(.75, "BTTS_YES")).toBeLessThanOrEqual(1.45);
  });

  it("calibra los combinados aparte", () => {
    const simple = estimatedModelOdds(.80, "OVER_1_5");
    const combo = estimatedModelOdds(.80, "COMBO_1X_OVER_1_5");
    expect(combo).toBeGreaterThanOrEqual(simple);
  });
});
