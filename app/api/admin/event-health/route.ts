import { NextRequest, NextResponse } from "next/server";
import { getEventHealthData } from "@/lib/event-health";
import { withAdminApi, type AdminApiAuthorization } from "@/lib/admin-api";

async function getEventHealth(_request: NextRequest, _context: unknown, authorization: AdminApiAuthorization) {
  void authorization;
  const data = await getEventHealthData();
  if (!data) return NextResponse.json({ error: "No active event is configured." }, { status: 409 });
  return NextResponse.json(data);
}

export const GET = withAdminApi("GET /api/admin/event-health", getEventHealth);
