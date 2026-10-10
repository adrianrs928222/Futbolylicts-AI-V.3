import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildDailyAnalysis } from "@/lib/engine/analyze";
import { learn } from "@/lib/ml/service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.ML_CRON_SECRET;
  if (secret && request.headers.get("x-ml-secret") !== secret) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const date = typeof body?.date === "string" ? body.date : dateInMadrid();
  const days = Number.isFinite(Number(body?.days)) ? Math.max(1, Math.min(60, Number(body.days))) : Number(process.env.ML_BOOTSTRAP_DAYS ?? 14);
  const analysis = await buildDailyAnalysis(date);
  const result = await learn(analysis, days);
  return NextResponse.json({ ok: true, date, ...result }, { headers: { "Cache-Control": "no-store" } });
}
