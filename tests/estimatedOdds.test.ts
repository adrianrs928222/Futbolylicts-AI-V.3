import { describe, expect, it } from "vitest";
import { estimatedModelOdds } from "@/lib/engine/scoring";

describe("estimatedModelOdds", () => {
  it("converts model probability into transparent fair decimal odds", () => {
    expect(estimatedModelOdds(0.80)).toBe(1.25);
    expect(estimatedModelOdds(0.78)).toBe(1.28);
    expect(estimatedModelOdds(0.70)).toBe(1.43);
  });

  it("keeps the estimate inside technical bounds", () => {
    expect(estimatedModelOdds(0.99)).toBe(1.05);
    expect(estimatedModelOdds(0.01)).toBe(20);
  });
});
