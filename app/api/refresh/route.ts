import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildDailyAnalysis } from "@/lib/engine/analyze";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const date = typeof body?.date === "string" ? body.date : dateInMadrid();
  const analysis = await buildDailyAnalysis(date);
  return NextResponse.json(analysis, {
    headers: { "Cache-Control": "no-store" },
  });
}
