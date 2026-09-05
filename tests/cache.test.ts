import { describe, expect, it } from "vitest";
import { cacheKey } from "@/lib/cache/cache";

describe("cache", () => {
  it("genera la misma clave aunque cambie el orden de parámetros", () => {
    const a = cacheKey("fixtures", { date: "2026-09-02", league: 1 });
    const b = cacheKey("fixtures", { league: 1, date: "2026-09-02" });
    expect(a).toBe(b);
  });
});
