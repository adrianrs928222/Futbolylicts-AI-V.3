import { NextResponse } from "next/server";
import { status } from "@/lib/ml/service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await status(), { headers: { "Cache-Control": "no-store" } });
}
