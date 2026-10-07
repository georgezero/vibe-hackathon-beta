export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getPresentationLiveData } from "@/lib/presentation-data";

export async function GET() {
  try {
    return NextResponse.json(await getPresentationLiveData());
  } catch (err) {
    console.error("/api/v1/presentation/live error:", err);
    return NextResponse.json({ error: "Failed to generate presentation data" }, { status: 500 });
  }
}
