import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildDailyAnalysis } from "@/lib/engine/analyze";
import { applyMlCalibration } from "@/lib/ml/adapter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? dateInMadrid();
  const analysis = await buildDailyAnalysis(date);
  const calibrated = await applyMlCalibration(analysis);
  return NextResponse.json(calibrated, { headers: { "Cache-Control": "no-store" } });
}
