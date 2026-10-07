import { NextRequest, NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin-api";

const VALID_MODES = ["default", "sim", "mixed"] as const;
type SeedMode = (typeof VALID_MODES)[number];

async function seedDemoData(req: NextRequest) {
  let mode: SeedMode;
  try {
    const body = await req.json();
    if (!VALID_MODES.includes(body.mode)) {
      return NextResponse.json({ error: "Invalid mode. Use: default | sim | mixed" }, { status: 400 });
    }
    mode = body.mode;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (mode === "default") {
      const { seed } = await import("@/lib/db/seed");
      await seed();
    } else if (mode === "sim") {
      const { seed } = await import("@/lib/db/seed-sim");
      await seed();
    } else {
      const { seed } = await import("@/lib/db/seed-mixed");
      await seed();
    }
    return NextResponse.json({ ok: true, mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withAdminApi("POST /api/admin/seed", seedDemoData);
