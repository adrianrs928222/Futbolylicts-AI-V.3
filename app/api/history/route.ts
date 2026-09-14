import { NextResponse } from "next/server";
import { getVisibleHistory } from "@/lib/ml/history";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getVisibleHistory(180), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar el historial" }, { status: 500 });
  }
}
