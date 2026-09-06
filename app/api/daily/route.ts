import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildDailyAnalysis } from "@/lib/engine/analyze";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? dateInMadrid();
  const analysis = await buildDailyAnalysis(date);
  return NextResponse.json(analysis, {
    headers: { "Cache-Control": "no-store" },
  });
}
