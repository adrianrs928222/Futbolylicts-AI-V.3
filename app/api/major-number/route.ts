import { NextRequest, NextResponse } from "next/server";
import { dateInMadrid } from "@/lib/date";
import { buildMajorNumberAnalysis } from "@/lib/specialMarkets/majorNumber";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? dateInMadrid();
    const data = await buildMajorNumberAnalysis(date);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo generar Mayor Número" }, { status: 500 });
  }
}
