import { describe,expect,it } from "vitest";
import { cacheKey } from "@/lib/cache/cache";
describe("cacheKey",()=>{it("es estable aunque cambie el orden de parámetros",()=>expect(cacheKey("x",{a:1,b:2})).toBe(cacheKey("x",{b:2,a:1})));});
